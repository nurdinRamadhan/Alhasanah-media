import React, { useState, useMemo, useEffect } from "react";
import { useTable } from "@refinedev/antd";
import { Row, Col, DatePicker, Typography, Tag, Space, Button, theme, Spin, Card, Table, Segmented, message, Divider, Statistic } from "antd";
import {
    DownloadOutlined, TeamOutlined, BookOutlined, SyncOutlined,
    CheckCircleFilled, CloseCircleOutlined, RiseOutlined,
    CalendarOutlined, BarChartOutlined, PieChartOutlined,
} from "@ant-design/icons";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from "recharts";
import dayjs from "dayjs";
import { supabaseClient } from "../../utility/supabaseClient";
import { formatHijri } from "../../utility/dateHelper";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { santriAlias } from "../../utility/privacy";

const { Text } = Typography;
const { RangePicker } = DatePicker;
const { useToken } = theme;

const STATUS_CFG: Record<string, { label: string; color: string }> = {
    HADIR:   { label: "Hadir",   color: "#16A34A" },
    SAKIT:   { label: "Sakit",   color: "#D97706" },
    GHAIB:   { label: "Ghaib",   color: "#DC2626" },
    SEKOLAH: { label: "Sekolah", color: "#2563EB" },
    PULANG:  { label: "Pulang",  color: "#9333EA" },
};

const hexLum = (hex: string): number => {
    const c = hex.replace("#", "");
    if (c.length < 6) return 200;
    return .299 * parseInt(c.slice(0, 2), 16) + .587 * parseInt(c.slice(2, 4), 16) + .114 * parseInt(c.slice(4, 6), 16);
};

// ── Fetch helper ──
const fetchRekapData = async (monthStart: string, monthEnd: string) => {
    const [absensi, hafalan, murojaah, santri] = await Promise.all([
        supabaseClient
            .from("tahfidz_absensi")
            .select("santri_nis, status, setoran, created_at, tahfidz_sesi!inner(tanggal, kegiatan_id, sesi)")
            .gte("tahfidz_sesi.tanggal", monthStart)
            .lte("tahfidz_sesi.tanggal", monthEnd)
            .order("created_at", { ascending: false }),
        supabaseClient
            .from("hafalan_tahfidz")
            .select("santri_nis, juz, predikat, status_setoran, created_at")
            .gte("created_at", monthStart)
            .lte("created_at", monthEnd),
        supabaseClient
            .from("murojaah_tahfidz")
            .select("santri_nis, predikat, status_setoran, created_at")
            .gte("created_at", monthStart)
            .lte("created_at", monthEnd),
        supabaseClient
            .from("santri")
            .select("nis, nama, kelas")
            .eq("jurusan", "TAHFIDZ")
            .eq("status_santri", "AKTIF"),
    ]);

    if (absensi.error) console.error("Absensi error:", absensi.error);
    if (hafalan.error) console.error("Hafalan error:", hafalan.error);
    if (murojaah.error) console.error("Murojaah error:", murojaah.error);
    if (santri.error) console.error("Santri error:", santri.error);

    return {
        absensi: absensi.data || [],
        hafalan: hafalan.data || [],
        murojaah: murojaah.data || [],
        santri: santri.data || [],
        errors: [absensi.error, hafalan.error, murojaah.error, santri.error].filter(Boolean),
    };
};

export const HafalanRekap = () => {
    const { token } = useToken();
    const isDark = hexLum(token.colorBgContainer) < 128;
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
        dayjs().startOf("month"),
        dayjs().endOf("month"),
    ]);
    const [activeTab, setActiveTab] = useState<string>("absensi");
    const [rawData, setRawData] = useState<{
        absensi: any[]; hafalan: any[]; murojaah: any[]; santri: any[];
    }>({ absensi: [], hafalan: [], murojaah: [], santri: [] });

    const fetchData = async () => {
        setLoading(true);
        const start = dateRange[0].format("YYYY-MM-DD");
        const end = dateRange[1].format("YYYY-MM-DD");
        const result = await fetchRekapData(start, end);
        if (result.errors.length > 0) {
            message.error("Gagal memuat data rekapitulasi");
        }
        setRawData(result);
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, [dateRange]);

    // ── Computed summaries ──

    const summaries = useMemo(() => {
        const { absensi, hafalan, murojaah, santri } = rawData;
        const santriMap = new Map(santri.map((s: any) => [s.nis, s]));
        const statusCount: Record<string, number> = {};
        const dailyStatus: Record<string, Record<string, number>> = {};
        let totalSetoran = 0;
        let totalHadir = 0;

        absensi.forEach((a: any) => {
            const s = a.status;
            statusCount[s] = (statusCount[s] || 0) + 1;
            if (s === "HADIR") totalHadir++;
            if (a.setoran) totalSetoran++;

            const tgl = a.tahfidz_sesi?.tanggal?.slice(0, 10);
            if (tgl) {
                if (!dailyStatus[tgl]) dailyStatus[tgl] = {};
                dailyStatus[tgl][s] = (dailyStatus[tgl][s] || 0) + 1;
            }
        });

        const perSantri: Record<string, { nis: string; nama: string; kelas: string; hadir: number; sakit: number; goib: number; sekolah: number; pulang: number; setoran: number; ziyadah: number; murojaah: number; lancar: number; mengulang: number }> = {};
        absensi.forEach((a: any) => {
            const nis = a.santri_nis;
            if (!perSantri[nis]) {
                const s = santriMap.get(nis) || {};
                perSantri[nis] = { nis, nama: s.nama || santriAlias(nis), kelas: s.kelas || "-", hadir: 0, sakit: 0, goib: 0, sekolah: 0, pulang: 0, setoran: 0, ziyadah: 0, murojaah: 0, lancar: 0, mengulang: 0 };
            }
            if (a.status === "HADIR") perSantri[nis].hadir++;
            else if (a.status === "SAKIT") perSantri[nis].sakit++;
            else if (a.status === "GHAIB") perSantri[nis].goib++;
            else if (a.status === "SEKOLAH") perSantri[nis].sekolah++;
            else if (a.status === "PULANG") perSantri[nis].pulang++;
            if (a.setoran) perSantri[nis].setoran++;
        });

        hafalan.forEach((h: any) => {
            if (perSantri[h.santri_nis]) {
                perSantri[h.santri_nis].ziyadah++;
                if (h.status_setoran === 'LANCAR') perSantri[h.santri_nis].lancar++;
                else if (h.status_setoran === 'MENGULANG') perSantri[h.santri_nis].mengulang++;
            }
        });
        murojaah.forEach((m: any) => {
            if (perSantri[m.santri_nis]) {
                perSantri[m.santri_nis].murojaah++;
                if (m.status_setoran === 'LANCAR') perSantri[m.santri_nis].lancar++;
                else if (m.status_setoran === 'MENGULANG') perSantri[m.santri_nis].mengulang++;
            }
        });

        // Daily chart data
        const sortedDays = Object.keys(dailyStatus).sort();
        const dailyChart = sortedDays.map(tgl => ({
            tanggal: tgl,
            ...dailyStatus[tgl],
            total: Object.values(dailyStatus[tgl]).reduce((a: number, b: number) => a + b, 0),
        }));

        // Pie chart data
        const pieData = Object.entries(STATUS_CFG).map(([key, cfg]) => ({
            name: cfg.label,
            value: statusCount[key] || 0,
            color: cfg.color,
        })).filter(d => d.value > 0);

        return {
            totalAbsensi: absensi.length,
            totalHadir,
            totalSetoran,
            totalZiyadah: hafalan.length,
            totalMurojaah: murojaah.length,
            santriCount: santri.length,
            perSantri: Object.values(perSantri),
            dailyChart,
            pieData,
            statusCount,
        };
    }, [rawData]);

    // ── Export ──
    const [exportLoading, setExportLoading] = useState(false);

    const DAYS_INDO = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    const formatSetoranText = (h: any): string => {
        const parts: string[] = [];
        if (h.juz) parts.push(`Juz ${h.juz}`);
        if (h.surat) {
            let s = h.surat;
            if (h.ayat_awal) {
                s += ` ${h.ayat_awal}`;
                if (h.ayat_akhir && h.ayat_akhir !== h.ayat_awal) {
                    s += `–${h.ayat_akhir}`;
                }
            }
            parts.push(s);
        }
        return parts.join(', ');
    };

    const mapStatusCode = (status: string, hasSetoran: boolean): string => {
        switch (status) {
            case 'HADIR': return hasSetoran ? 'H' : 'TS';
            case 'GHAIB': return 'GH';
            case 'SAKIT': return 'S';
            case 'SEKOLAH': return 'Sk';
            case 'PULANG': return 'P';
            default: return '';
        }
    };

    const colLetter = (n: number): string => {
        let s = '';
        while (n > 0) {
            const m = (n - 1) % 26;
            s = String.fromCharCode(65 + m) + s;
            n = Math.floor((n - 1) / 26);
        }
        return s;
    };

    const handleExport = async () => {
        setExportLoading(true);
        try {
            const wb = new ExcelJS.Workbook();
            const startStr = dateRange[0].format("DD MMM YYYY");
            const endStr = dateRange[1].format("DD MMM YYYY");

            // Sheet 1: Global Rekap
            const ws1 = wb.addWorksheet("Rekap Global");
            ws1.mergeCells("A1:H1");
            ws1.getCell("A1").value = `REKAP ABSENSI TAHFIDZ (${startStr} - ${endStr})`;
            ws1.getCell("A1").font = { size: 14, bold: true, color: { argb: "FFFFFFFF" } };
            ws1.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC9A84C" } };
            ws1.getCell("A1").alignment = { horizontal: "center" };
            ws1.getRow(3).values = ["Tanggal", "Kegiatan", "Sesi", "Status Terbanyak", "Total Absensi", "Hadir", "Sakit", "Ghaib", "Sekolah", "Pulang", "Setoran"];
            ws1.getRow(3).font = { bold: true };

            // Aggregate by date
            const byDate: Record<string, any> = {};
            rawData.absensi.forEach((a: any) => {
                const tgl = a.tahfidz_sesi?.tanggal?.slice(0, 10);
                if (!tgl) return;
                if (!byDate[tgl]) byDate[tgl] = { total: 0, hadir: 0, sakit: 0, goib: 0, sekolah: 0, pulang: 0, setoran: 0 };
                byDate[tgl].total++;
                byDate[tgl][a.status.toLowerCase()] = (byDate[tgl][a.status.toLowerCase()] || 0) + 1;
                if (a.setoran) byDate[tgl].setoran++;
            });
            Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).forEach(([tgl, d]) => {
                const topStatus = Object.entries(STATUS_CFG).sort(([,a], [,b]) => ((d[a.label.toLowerCase()] || 0) - (d[b.label.toLowerCase()] || 0))).pop();
                ws1.addRow([
                    tgl, "ZIYADAH/MUROJAAH", "PAGI/SIANG",
                    topStatus?.[0] || "-", d.total, d.hadir || 0, d.sakit || 0, d.goib || 0, d.sekolah || 0, d.pulang || 0, d.setoran || 0,
                ]);
            });

            // Sheet 2: Per Santri
            const ws2 = wb.addWorksheet("Per Santri");
            ws2.mergeCells("A1:M1");
            ws2.getCell("A1").value = `REKAP PER SANTRI (${startStr} - ${endStr})`;
            ws2.getCell("A1").font = { size: 14, bold: true, color: { argb: "FFFFFFFF" } };
            ws2.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7C3AED" } };
            ws2.getCell("A1").alignment = { horizontal: "center" };
            ws2.getRow(3).values = ["NIS", "Nama", "Kelas", "Hadir", "Sakit", "Ghaib", "Sekolah", "Pulang", "Setoran", "Ziyadah", "Murojaah", "Lancar", "Mengulang"];
            ws2.getRow(3).font = { bold: true };

            summaries.perSantri.forEach((s: any) => {
                ws2.addRow([s.nis, s.nama, s.kelas, s.hadir, s.sakit, s.goib, s.sekolah, s.pulang, s.setoran, s.ziyadah, s.murojaah, s.lancar, s.mengulang]);
            });
            ws2.columns = [
                { width: 15 }, { width: 25 }, { width: 10 }, { width: 8 }, { width: 8 }, { width: 8 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 12 },
            ];

            const buffer = await wb.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `Rekap_Absensi_Tahfidz_${dateRange[0].format("YYYYMM")}.xlsx`);
            message.success("Rekap berhasil diunduh");
        } catch (err: any) {
            message.error("Gagal export: " + err.message);
        } finally {
            setExportLoading(false);
        }
    };

    // ── Peta data hafalan (30 juz × santri, berdasarkan total_hafalan) ──
    const petaData = useMemo(() => {
        const { santri } = rawData;
        const santriList = santri
            .filter((s: any) => s.nis)
            .sort((a: any, b: any) => (a.nama || '').localeCompare(b.nama || ''));

        const JUZ_TOTAL = 30;
        const rows = santriList.map((s: any) => {
            const raw = String(s.total_hafalan || '');
            const parsed = parseInt(raw, 10) || 0;
            const total = Math.min(Math.max(0, parsed), JUZ_TOTAL);
            const row: Record<string, any> = {
                nis: s.nis,
                nama: s.nama || santriAlias(s.nis),
                total,
            };
            for (let j = 1; j <= JUZ_TOTAL; j++) {
                row[j] = j <= total;
            }
            return row;
        });

        return { juzTotal: JUZ_TOTAL, rows };
    }, [rawData]);
    const handleExportZiyadah = async () => {
        setExportLoading(true);
        try {
            const startStr = dateRange[0].format("YYYY-MM-DD");
            const endStr = dateRange[1].format("YYYY-MM-DD");

            const [absensiRes, santriRes, profileRes] = await Promise.all([
                supabaseClient
                    .from("tahfidz_absensi")
                    .select(`id, santri_nis, status, setoran, penyimak_id,
                        tahfidz_sesi!inner(tanggal, sesi),
                        hafalan_tahfidz(surat, ayat_awal, ayat_akhir, juz, predikat, status_setoran)`)
                    .gte("tahfidz_sesi.tanggal", startStr)
                    .lte("tahfidz_sesi.tanggal", endStr)
                    .eq("tahfidz_sesi.kegiatan_id", "ZIYADAH"),
                supabaseClient.from("santri")
            .select("nis, nama, kelas, total_hafalan")
                    .eq("jurusan", "TAHFIDZ")
                    .eq("status_santri", "AKTIF"),
                supabaseClient.from("profiles").select("id, full_name"),
            ]);

            if (absensiRes.error) throw absensiRes.error;
            const absensiList = absensiRes.data || [];
            const santriList = santriRes.data || [];
            const profileList = profileRes.data || [];

            const santriMap = new Map(santriList.map((s: any) => [s.nis, s]));
            const penyimakMap = new Map(profileList.map((p: any) => [p.id, p.full_name]));

            const lookup = new Map<string, { text: string; code: string; penyimak: string }>();
            const allDates = new Set<string>();
            const allNis = new Set<string>();

            for (const a of absensiList) {
                const sesiData = a.tahfidz_sesi as any;
                const tgl = sesiData.tanggal;
                const sesi = sesiData.sesi;
                const nis = a.santri_nis;
                const key = `${tgl}::${sesi}::${nis}`;
                allDates.add(tgl);
                allNis.add(nis);
                const h = a.hafalan_tahfidz;
                const hasSetoran = !!(a.setoran && h);
                const text = h ? formatSetoranText(h) : '';
                const code = mapStatusCode(a.status, hasSetoran);
                const penyimak = a.penyimak_id ? (penyimakMap.get(a.penyimak_id) || '') : '';
                lookup.set(key, { text, code, penyimak });
            }

            const dates = [...allDates].sort();
            const santriNis = [...allNis].sort((a: string, b: string) =>
                (santriMap.get(a)?.nama || '').localeCompare(santriMap.get(b)?.nama || ''),
            );

            const wb = new ExcelJS.Workbook();
            const ws = wb.addWorksheet('Setoran Ziyadah');

            const B = { bold: true };
            const C = { horizontal: 'center' as const };
            const TB = {
                top: { style: 'thin' as const },
                left: { style: 'thin' as const },
                bottom: { style: 'thin' as const },
                right: { style: 'thin' as const },
            };
            const GF = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF047857' } };
            const LGF = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF0FDF4' } };
            const WF = { color: { argb: 'FFFFFFFF' } };

            let r = 1;

            if (dates.length === 0) {
                ws.mergeCells('A1:D1');
                ws.getCell(1, 1).value = 'Tidak ada data setoran Ziyadah pada periode ini';
                ws.getCell(1, 1).font = { italic: true, color: { argb: 'FF999999' } };
            } else {
                const totalDays = dates.length;
                const totalCols = 2 + totalDays * 6 + 7;
                const totalStart = 3 + totalDays * 6;

                // ── Title ──
                ws.mergeCells(`A${r}:${colLetter(totalCols)}${r}`);
                const t = ws.getCell(r, 1);
                t.value = 'ABSENSI SETORAN (ZIYADAH)';
                t.font = { ...B, ...WF, size: 14 };
                t.fill = GF;
                t.alignment = C;
                r++;

                // ── Periode / Date Range ──
                const startMasehi = dayjs(dateRange[0]).format('DD MMMM YYYY');
                const endMasehi = dayjs(dateRange[1]).format('DD MMMM YYYY');
                const startHijri = formatHijri(dateRange[0].toDate());
                const endHijri = formatHijri(dateRange[1].toDate());
                ws.mergeCells(`A${r}:${colLetter(totalCols)}${r}`);
                const p = ws.getCell(r, 1);
                p.value = `Periode: ${startMasehi} - ${endMasehi} / ${startHijri} - ${endHijri}`;
                p.font = { size: 11, color: { argb: 'FF555555' } };
                p.alignment = C;
                r++;

                // ── Legend ──
                ws.mergeCells(`A${r}:${colLetter(totalCols)}${r}`);
                ws.getCell(r, 1).value = 'Keterangan: H=Hadir Setor | TS=Tidak Setor | S=Sakit | A=Alpha/Ghaib | Sk=Sekolah | P=Pulang';
                ws.getCell(r, 1).font = { italic: true, size: 9, color: { argb: 'FF888888' } };
                ws.getCell(r, 1).alignment = C;
                r += 2;

                // ── Day Headers ──
                const h1 = { ...B, size: 10, color: { argb: 'FF047857' } };
                ws.getCell(r, 1).value = 'NO';
                ws.getCell(r, 1).font = h1;
                ws.getCell(r, 1).fill = LGF;
                ws.getCell(r, 1).alignment = C;
                ws.getCell(r, 2).value = 'NAMA';
                ws.getCell(r, 2).font = h1;
                ws.getCell(r, 2).fill = LGF;
                ws.getCell(r, 2).alignment = C;

                let ci = 3;
                for (const tgl of dates) {
                    const d = dayjs(tgl);
                    const label = `${DAYS_INDO[d.day()].toUpperCase()} ${d.date()}`;
                    ws.mergeCells(`${colLetter(ci)}${r}:${colLetter(ci + 5)}${r}`);
                    const c = ws.getCell(r, ci);
                    c.value = label;
                    c.font = h1;
                    c.fill = LGF;
                    c.alignment = C;
                    ci += 6;
                }
                // Total columns header
                ws.mergeCells(`${colLetter(totalStart)}${r}:${colLetter(totalStart + 5)}${r}`);
                ws.getCell(r, totalStart).value = 'JUMLAH';
                ws.getCell(r, totalStart).font = h1;
                ws.getCell(r, totalStart).fill = LGF;
                ws.getCell(r, totalStart).alignment = C;
                ws.getCell(r, totalStart + 6).value = 'NAMA';
                ws.getCell(r, totalStart + 6).font = h1;
                ws.getCell(r, totalStart + 6).fill = LGF;
                ws.getCell(r, totalStart + 6).alignment = C;
                r++;

                // ── Sub-headers (PAGI/SIANG/Penyimak) ──
                ci = 3;
                for (const _tgl of dates) {
                    ws.mergeCells(`${colLetter(ci)}${r}:${colLetter(ci + 1)}${r}`);
                    ws.getCell(r, ci).value = 'PAGI';
                    ws.getCell(r, ci).font = B;
                    ws.getCell(r, ci).alignment = C;
                    ws.getCell(r, ci + 2).value = 'Penyimak';
                    ws.getCell(r, ci + 2).font = B;
                    ws.getCell(r, ci + 2).alignment = C;
                    ws.mergeCells(`${colLetter(ci + 3)}${r}:${colLetter(ci + 4)}${r}`);
                    ws.getCell(r, ci + 3).value = 'SIANG';
                    ws.getCell(r, ci + 3).font = B;
                    ws.getCell(r, ci + 3).alignment = C;
                    ws.getCell(r, ci + 5).value = 'Penyimak';
                    ws.getCell(r, ci + 5).font = B;
                    ws.getCell(r, ci + 5).alignment = C;
                    ci += 6;
                }
                // Total sub-headers
                ['H', 'TS', 'S', 'GH', 'Sk', 'P', 'NAMA'].forEach((label, ti) => {
                    ws.getCell(r, totalStart + ti).value = label;
                    ws.getCell(r, totalStart + ti).font = B;
                    ws.getCell(r, totalStart + ti).alignment = C;
                });
                r++;

                // ── Data rows ──
                for (let i = 0; i < santriNis.length; i++) {
                    const nis = santriNis[i];
                    const nama = santriMap.get(nis)?.nama || nis;
                    ws.getCell(r, 1).value = i + 1;
                    ws.getCell(r, 1).alignment = C;
                    ws.getCell(r, 2).value = nama;

                    ci = 3;
                    for (const tgl of dates) {
                        const pagi = lookup.get(`${tgl}::PAGI::${nis}`);
                        const siang = lookup.get(`${tgl}::SIANG::${nis}`);

                        ws.getCell(r, ci).value = pagi?.code || '';
                        ws.getCell(r, ci).alignment = C;
                        ws.getCell(r, ci + 1).value = pagi?.text || '';
                        ws.getCell(r, ci + 2).value = pagi?.penyimak || '';

                        ws.getCell(r, ci + 3).value = siang?.code || '';
                        ws.getCell(r, ci + 3).alignment = C;
                        ws.getCell(r, ci + 4).value = siang?.text || '';
                        ws.getCell(r, ci + 5).value = siang?.penyimak || '';

                        ci += 6;
                    }

                    // Totals per santri
                    const totals = { H: 0, TS: 0, S: 0, A: 0, Sk: 0, P: 0 };
                    for (const tgl of dates) {
                        for (const ses of ['PAGI', 'SIANG']) {
                            const entry = lookup.get(`${tgl}::${ses}::${nis}`);
                            if (entry?.code && entry.code in totals) {
                                totals[entry.code as keyof typeof totals]++;
                            }
                        }
                    }
                    ws.getCell(r, totalStart).value = totals.H || '';
                    ws.getCell(r, totalStart + 1).value = totals.TS || '';
                    ws.getCell(r, totalStart + 2).value = totals.S || '';
                    ws.getCell(r, totalStart + 3).value = totals.A || '';
                    ws.getCell(r, totalStart + 4).value = totals.Sk || '';
                    ws.getCell(r, totalStart + 5).value = totals.P || '';
                    ws.getCell(r, totalStart + 6).value = nama;
                    for (let ti = 0; ti < 7; ti++) ws.getCell(r, totalStart + ti).alignment = C;

                    for (let c = 1; c <= totalCols; c++) ws.getCell(r, c).border = TB;
                    r++;
                }

                // ── Column widths ──
                ws.getColumn(1).width = 5;
                ws.getColumn(2).width = 22;
                const dayStart = 3;
                const dayEnd = 3 + totalDays * 6;
                for (let c = dayStart; c < dayEnd; c++) {
                    const rel = (c - dayStart) % 6;
                    if (rel === 0 || rel === 3) ws.getColumn(c).width = 7;
                    else if (rel === 1 || rel === 4) ws.getColumn(c).width = 20;
                    else ws.getColumn(c).width = 16;
                }
                const totalColStart = dayEnd;
                for (let c = totalColStart; c <= totalColStart + 5; c++) ws.getColumn(c).width = 5;
                ws.getColumn(totalColStart + 6).width = 22;
            }

            const buffer = await wb.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `Setoran_Ziyadah_${dateRange[0].format("YYYYMM")}.xlsx`);
            message.success('Export setoran ziyadah berhasil');
        } catch (err: any) {
            message.error('Gagal export: ' + err.message);
        } finally {
            setExportLoading(false);
        }
    };

    // ── Chart colors ──
    const STATUS_COLORS = ["#16A34A", "#D97706", "#DC2626", "#2563EB", "#9333EA"];

    const cardStyle: React.CSSProperties = {
        background: token.colorBgContainer,
        border: `1px solid ${isDark ? "#334155" : token.colorBorderSecondary}`,
        borderRadius: 12,
        padding: "16px 20px",
        height: "100%",
    };

    return (
        <div style={{ padding: "0 0 80px" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                    <Text style={{ fontSize: 18, fontWeight: 700, display: "block" }}>
                        📊 Rekapitulasi Absensi Tahfidz
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        Rekap per {formatHijri(new Date())}
                    </Text>
                </div>
                <Space>
                    <RangePicker
                        value={dateRange}
                        onChange={(dates) => {
                            if (dates?.[0] && dates?.[1]) setDateRange([dates[0], dates[1]]);
                        }}
                        format="DD MMM YYYY"
                        presets={[
                            { label: "Bulan ini", value: [dayjs().startOf("month"), dayjs().endOf("month")] },
                            { label: "Bulan lalu", value: [dayjs().subtract(1, "month").startOf("month"), dayjs().subtract(1, "month").endOf("month")] },
                            { label: "Semua", value: [dayjs("2020-01-01"), dayjs()] },
                        ]}
                        style={{ borderRadius: 8 }}
                    />
                    <Button
                        type="primary"
                        icon={<DownloadOutlined />}
                        onClick={handleExport}
                        loading={exportLoading}
                        style={{ borderRadius: 8, background: "#16A34A", borderColor: "#16A34A" }}
                    >
                        Export Excel
                    </Button>
                    <Button
                        icon={<BookOutlined />}
                        onClick={handleExportZiyadah}
                        loading={exportLoading}
                        style={{ borderRadius: 8 }}
                    >
                        Export Setoran
                    </Button>
                </Space>
            </div>

            {loading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
                    <Spin size="large" />
                </div>
            ) : (
                <>
                    {/* ── KPI Cards ── */}
                    <Row gutter={12} style={{ marginBottom: 16 }}>
                        {[
                            { icon: <TeamOutlined />, value: summaries.santriCount, label: "Santri Aktif", accent: "#C9A84C" },
                            { icon: <CheckCircleFilled />, value: summaries.totalHadir, label: "Total Hadir", accent: "#16A34A" },
                            { icon: <BookOutlined />, value: summaries.totalSetoran, label: "Total Setoran", accent: "#7C3AED" },
                            { icon: <SyncOutlined />, value: summaries.totalZiyadah + summaries.totalMurojaah, label: "Ziyadah + Murojaah", sub: `${summaries.totalZiyadah} Ziy · ${summaries.totalMurojaah} Mur`, accent: "#2563EB" },
                            { icon: <CalendarOutlined />, value: summaries.totalAbsensi, label: "Total Absensi", accent: "#D97706" },
                        ].map((kpi, i) => (
                            <Col key={i} xs={12} sm={8} lg={4} xl={4}>
                                <div style={cardStyle}>
                                    <Statistic
                                        title={<span style={{ fontSize: 11, fontWeight: 600, color: token.colorTextSecondary }}>{kpi.label}</span>}
                                        value={kpi.value}
                                        prefix={<span style={{ color: kpi.accent, fontSize: 16 }}>{kpi.icon}</span>}
                                        valueStyle={{ fontSize: 24, fontWeight: 700, color: token.colorText }}
                                    />
                                    {kpi.sub && <Text style={{ fontSize: 10, color: token.colorTextTertiary }}>{kpi.sub}</Text>}
                                </div>
                            </Col>
                        ))}
                    </Row>

                    {/* ── Tabs: Charts / Table ── */}
                    <Segmented
                        value={activeTab}
                        onChange={(v) => setActiveTab(v as string)}
                        options={[
                            { label: <><BarChartOutlined /> Grafik Harian</>, value: "absensi" },
                            { label: <><PieChartOutlined /> Distribusi Status</>, value: "distribusi" },
                            { label: <><TeamOutlined /> Per Santri</>, value: "santri" },
                            { label: <>🗺️ Peta Hafalan</>, value: "peta" },
                        ]}
                        style={{ marginBottom: 16 }}
                    />

                    {activeTab === "absensi" && (
                        <div style={cardStyle}>
                            <Text strong style={{ fontSize: 14, display: "block", marginBottom: 12 }}>
                                Distribusi Absensi Harian
                            </Text>
                            <ResponsiveContainer width="100%" height={320}>
                                <BarChart data={summaries.dailyChart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={token.colorBorderSecondary} vertical={false} />
                                    <XAxis dataKey="tanggal" tick={{ fontSize: 10, fill: token.colorTextSecondary }} angle={-30} textAnchor="end" height={60} />
                                    <YAxis tick={{ fontSize: 10, fill: token.colorTextSecondary }} allowDecimals={false} />
                                    <RechartsTooltip
                                        contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${token.colorBorderSecondary}`, background: token.colorBgContainer }}
                                    />
                                    {Object.entries(STATUS_CFG).map(([key, cfg], idx) => (
                                        <Bar key={key} dataKey={key} name={cfg.label} stackId="a" fill={STATUS_COLORS[idx]} radius={[0, 0, 0, 0]} />
                                    ))}
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {activeTab === "distribusi" && (
                        <Row gutter={16}>
                            <Col xs={24} lg={12}>
                                <div style={cardStyle}>
                                    <Text strong style={{ fontSize: 14, display: "block", marginBottom: 12 }}>
                                        Distribusi Status Absensi
                                    </Text>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie
                                                data={summaries.pieData}
                                                cx="50%" cy="50%"
                                                innerRadius={60}
                                                outerRadius={100}
                                                paddingAngle={4}
                                                dataKey="value"
                                                label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                            >
                                                {summaries.pieData.map((entry, idx) => (
                                                    <Cell key={idx} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Legend />
                                            <RechartsTooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </Col>
                            <Col xs={24} lg={12}>
                                <div style={cardStyle}>
                                    <Text strong style={{ fontSize: 14, display: "block", marginBottom: 12 }}>
                                        Rincian Status
                                    </Text>
                                    {Object.entries(STATUS_CFG).map(([key, cfg]) => {
                                        const count = summaries.statusCount[key] || 0;
                                        const total = summaries.totalAbsensi || 1;
                                        const pct = Math.round((count / total) * 100);
                                        return (
                                            <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                                                <div style={{ width: 12, height: 12, borderRadius: 3, background: cfg.color, flexShrink: 0 }} />
                                                <Text style={{ fontSize: 13, flex: 1 }}>{cfg.label}</Text>
                                                <Text strong style={{ fontSize: 13, color: cfg.color }}>{count}</Text>
                                                <Text style={{ fontSize: 11, color: token.colorTextTertiary, width: 40, textAlign: "right" }}>{pct}%</Text>
                                                <div style={{ flex: 0.5, height: 6, background: token.colorFillSecondary, borderRadius: 999, overflow: "hidden" }}>
                                                    <div style={{ width: `${pct}%`, height: "100%", background: cfg.color, borderRadius: 999 }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </Col>
                        </Row>
                    )}

                    {activeTab === "santri" && (
                        <div style={cardStyle}>
                            <Text strong style={{ fontSize: 14, display: "block", marginBottom: 12 }}>
                                Rekap Per Santri
                            </Text>
                            <Table
                                dataSource={summaries.perSantri}
                                rowKey="nis"
                                pagination={{ pageSize: 20, showSizeChanger: true }}
                                size="small"
                                scroll={{ x: 900 }}
                                columns={[
                                    { title: "NIS", dataIndex: "nis", width: 100, fixed: "left" },
                                    { title: "Nama", dataIndex: "nama", width: 180, fixed: "left" },
                                    { title: "Kelas", dataIndex: "kelas", width: 70 },
                                    { title: "Hadir", dataIndex: "hadir", width: 70, sorter: (a: any, b: any) => a.hadir - b.hadir, render: (v: number) => <Text style={{ color: "#16A34A", fontWeight: 600 }}>{v}</Text> },
                                    { title: "Sakit", dataIndex: "sakit", width: 70, render: (v: number) => <Text style={{ color: "#D97706" }}>{v}</Text> },
                                    { title: "Ghaib", dataIndex: "goib", width: 70, render: (v: number) => <Text style={{ color: "#DC2626" }}>{v}</Text> },
                                    { title: "Sekolah", dataIndex: "sekolah", width: 80, render: (v: number) => <Text style={{ color: "#2563EB" }}>{v}</Text> },
                                    { title: "Pulang", dataIndex: "pulang", width: 80, render: (v: number) => <Text style={{ color: "#9333EA" }}>{v}</Text> },
                                    { title: "Setoran", dataIndex: "setoran", width: 80, sorter: (a: any, b: any) => a.setoran - b.setoran, render: (v: number) => <Text style={{ color: "#7C3AED", fontWeight: 600 }}>{v}</Text> },
                                    { title: "Ziyadah", dataIndex: "ziyadah", width: 80 },
                                    { title: "Murojaah", dataIndex: "murojaah", width: 90 },
                                    { title: "Lancar", dataIndex: "lancar", width: 70, render: (v: number) => <Text style={{ color: "#16A34A", fontWeight: 600 }}>{v}</Text> },
                                    { title: "Mengulang", dataIndex: "mengulang", width: 90, render: (v: number) => <Text style={{ color: "#D97706", fontWeight: 600 }}>{v}</Text> },
                                ]}
                            />
                        </div>
                    )}

                    {activeTab === "peta" && (
                        <div style={{ ...cardStyle, overflow: "auto" }}>
                            <Text strong style={{ fontSize: 14, display: "block", marginBottom: 4 }}>
                                Peta Hafalan — 30 Juz
                            </Text>
                            <Text style={{ fontSize: 11, color: token.colorTextTertiary, display: "block", marginBottom: 12 }}>
                                {"\u25CF"} LANCAR (TRUE)  {"\u25CB"} MENGULANG / Belum (FALSE)
                            </Text>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                <thead>
                                    <tr>
                                        <th style={{ padding: "6px 8px", border: `1px solid ${token.colorBorderSecondary}`, background: isDark ? "#1E293B" : "#F8FAFC", position: "sticky", left: 0, zIndex: 2, fontWeight: 600, textAlign: "left", minWidth: 160 }}>Nama Santri</th>
                                        <th style={{ padding: "6px 8px", border: `1px solid ${token.colorBorderSecondary}`, background: isDark ? "#1E293B" : "#F8FAFC", fontWeight: 600, textAlign: "center", minWidth: 44 }}>{"\u2211"}</th>
                                        {Array.from({ length: petaData.juzTotal }, (_, i) => (
                                            <th key={i + 1} style={{ padding: "6px 2px", border: `1px solid ${token.colorBorderSecondary}`, background: isDark ? "#1E293B" : "#F8FAFC", fontWeight: 600, textAlign: "center", fontSize: 9, minWidth: 22 }}>
                                                {i + 1}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {petaData.rows.map((s: any) => (
                                        <tr key={s.nis}>
                                            <td style={{ padding: "5px 8px", border: `1px solid ${token.colorBorderSecondary}`, position: "sticky", left: 0, background: token.colorBgContainer, fontWeight: 500, whiteSpace: "nowrap" }}>
                                                {s.nama}
                                            </td>
                                            <td style={{ padding: "5px 4px", border: `1px solid ${token.colorBorderSecondary}`, textAlign: "center", fontWeight: 700, fontSize: 13 }}>
                                                {s.total}
                                            </td>
                                            {Array.from({ length: petaData.juzTotal }, (_, i) => {
                                                const j = i + 1;
                                                const done = s[j];
                                                return (
                                                    <td key={j} style={{ padding: "4px 2px", border: `1px solid ${token.colorBorderSecondary}`, textAlign: "center", background: token.colorBgContainer, cursor: "default" }} title={`${s.nama} — Juz ${j}: ${done ? 'LANCAR' : 'MENGULANG / Belum'}`}>
                                                        <div style={{
                                                            width: 14, height: 14, borderRadius: "50%", margin: "0 auto",
                                                            background: done ? '#16A34A' : token.colorFillQuaternary,
                                                            border: `2px solid ${done ? '#16A34A' : token.colorBorder}`,
                                                            transition: "all 0.15s",
                                                        }} />
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
