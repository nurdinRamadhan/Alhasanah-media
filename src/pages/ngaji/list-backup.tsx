import React, { useState, useEffect, useMemo } from "react";
import {
    Button, Typography, Space, Select, Segmented, message,
    Avatar, Tag, Spin, theme, Dropdown, Modal, DatePicker, Input, InputNumber, Switch, Tooltip as AntTooltip,
    Checkbox,
} from "antd";
import {
    PlusOutlined, CalendarOutlined,
    FileExcelOutlined, UserOutlined, EditOutlined, DeleteOutlined,
    CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined,
} from "@ant-design/icons";
import { useGetIdentity } from "@refinedev/core";
import dayjs from "dayjs";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { supabaseClient } from "../../utility/supabaseClient";
import { HIJRI_MONTHS } from "../../utility/dateHelper";
import { santriAlias } from "../../utility/privacy";
import hijriConverter from "hijri-converter";
import type { IUserIdentity } from "../../types";
import { useHijriCorrection, resolveHijri } from "../../hooks/useHijriCorrection";

const { Text } = Typography;
const { useToken } = theme;

const STATUS_ABSENSI = [
    { key: 'HADIR',   label: 'Hadir',   icon: '✅', color: '#16A34A', bg: 'rgba(22,163,74,0.10)' },
    { key: 'SAKIT',   label: 'Sakit',   icon: '🤒', color: '#D97706', bg: 'rgba(217,119,6,0.10)' },
    { key: 'IZIN',    label: 'Izin',    icon: '📝', color: '#2563EB', bg: 'rgba(37,99,235,0.10)' },
    { key: 'PULANG',  label: 'Pulang',  icon: '🏠', color: '#9333EA', bg: 'rgba(147,51,234,0.10)' },
    { key: 'GHAIB',   label: 'Ghaib',   icon: '❌', color: '#DC2626', bg: 'rgba(220,38,38,0.10)' },
];

const STATUS_CODE: Record<string, string> = {
    HADIR: 'H', SAKIT: 'S', IZIN: 'I', PULANG: 'P', GHAIB: 'GH',
};

const STATUS_FILLS: Record<string, string> = {
    HADIR: 'FFD1FAE5', SAKIT: 'FFFEF3C7', IZIN: 'FFDBEAFE',
    GHAIB: 'FFFEE2E2', PULANG: 'FFFFEDD5',
};

const HARI_LABEL: Record<number, { short: string; full: string }> = {
    1: { short: 'Sab', full: 'Sabtu' },
    2: { short: 'Ahd', full: 'Ahad' },
    3: { short: 'Sen', full: 'Senin' },
    4: { short: 'Sel', full: 'Selasa' },
    5: { short: 'Rab', full: 'Rabu' },
};

const hexLum = (hex: string): number => {
    const c = hex.replace("#", "");
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    return 0.299 * r + 0.587 * g + 0.114 * b;
};

const getCurrentHijri = () => {
    const now = new Date();
    return hijriConverter.toHijri(now.getFullYear(), now.getMonth() + 1, now.getDate());
};

const getWeekDates = (tahun: number, bulan: number, mingguKe: number): { tanggal: string; hariKe: number; sesiKe: number }[] => {
    const gregorian = hijriConverter.toGregorian(tahun, bulan, 1);
    const firstOfMonth = new Date(gregorian.gy, gregorian.gm - 1, gregorian.gd);

    const firstDayOfWeek = firstOfMonth.getDay();
    // Hitung Saturday backward (before/on 1st)
    const daysSinceLastSaturday = (firstDayOfWeek - 6 + 7) % 7;
    const backwardSat = new Date(firstOfMonth);
    backwardSat.setDate(firstOfMonth.getDate() - daysSinceLastSaturday);
    // Hitung berapa hari dari 5 hari (Sabtu-Rabu) yang masuk bulan terpilih
    let inMonth = 0;
    for (let i = 0; i < 5; i++) {
        const d = new Date(backwardSat);
        d.setDate(backwardSat.getDate() + i);
        const h = hijriConverter.toHijri(d.getFullYear(), d.getMonth() + 1, d.getDate());
        if (h.hy === tahun && h.hm === bulan) inMonth++;
    }
    const weekStarts = new Date(firstOfMonth);
    if (inMonth <= 1) {
        // ≤1 hari masuk bulan ini → backward didominasi bulan sebelumnya
        // gunakan Saturday SETELAH 1st
        const daysUntilNextSaturday = (6 - firstDayOfWeek + 7) % 7;
        weekStarts.setDate(firstOfMonth.getDate() + daysUntilNextSaturday);
    } else {
        // ≥2 hari masuk bulan ini → backward aman
        weekStarts.setDate(firstOfMonth.getDate() - daysSinceLastSaturday);
    }

    const saturday = new Date(weekStarts);
    saturday.setDate(weekStarts.getDate() + (mingguKe - 1) * 7);

    const result: { tanggal: string; hariKe: number; sesiKe: number }[] = [];
    for (let i = 0; i < 5; i++) {
        const d = new Date(saturday);
        d.setDate(saturday.getDate() + i);
        const tanggal = dayjs(d).format("YYYY-MM-DD");
        const hariKe = i + 1;
        result.push({ tanggal, hariKe, sesiKe: 1 });
    }
    return result;
};

export const NgajiList: React.FC = () => {
    const { token } = useToken();
    const isDark = hexLum(token.colorBgContainer) < 128;
    const { data: identity } = useGetIdentity<any>();
    const userIdentity = identity as IUserIdentity | undefined;

    const scope = useMemo(() => {
        if (!userIdentity) return { restricted: false, lockedGender: null as string | null, lockedJurusan: null as string | null };
        if (["super_admin", "rois", "dewan"].includes(userIdentity.role)) return { restricted: false, lockedGender: null, lockedJurusan: null };
        if (userIdentity.scopeGender === 'P') return { restricted: true, lockedGender: 'P', lockedJurusan: 'ALL' as string | null };
        if (userIdentity.scopeGender === 'L') return { restricted: true, lockedGender: 'L', lockedJurusan: userIdentity.scopeJurusan };
        return { restricted: false, lockedGender: null, lockedJurusan: null };
    }, [userIdentity]);

    const todayHijri = useMemo(() => getCurrentHijri(), []);
    const [tahun, setTahun] = useState(todayHijri.hy);
    const [bulan, setBulan] = useState(todayHijri.hm);
    const [mingguKe, setMingguKe] = useState(Math.min(Math.ceil(todayHijri.hd / 7), 4));
    const [showWeek5, setShowWeek5] = useState(false);
    const mingguMaxKe = showWeek5 ? 5 : 4;
    const [santriList, setSantriList] = useState<any[]>([]);
    const [sesiByKey, setSesiByKey] = useState<Record<string, string>>({});
    const [absensiGrid, setAbsensiGrid] = useState<Record<string, Record<string, { status: string | null }>>>({});
    const [loading, setLoading] = useState(true);
    const [savingCells, setSavingCells] = useState<Record<string, boolean>>({});
    const [fetchKey, setFetchKey] = useState(0);
    const [exporting, setExporting] = useState(false);
    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [selectedExportWeeks, setSelectedExportWeeks] = useState<number[]>([mingguKe]);

    const weekDates = useMemo(() => getWeekDates(tahun, bulan, mingguKe), [tahun, bulan, mingguKe]);
    const bulanLabel = HIJRI_MONTHS[bulan - 1];
    useHijriCorrection();

    useEffect(() => {
        (async () => {
            try {
                let query = supabaseClient
                    .from("santri")
                    .select("nis, nama, kelas, total_hafalan, foto_url")
                    .eq("jurusan", "TAHFIDZ")
                    .eq("status_santri", "AKTIF");

                if (scope.lockedGender) {
                    query = query.eq("jenis_kelamin", scope.lockedGender);
                }

                const { data, error } = await query
                    .order("kelas", { ascending: true })
                    .order("nama", { ascending: true });

                if (error) throw error;
                setSantriList(data || []);
                setFetchKey(k => k + 1);
            } catch (e: any) {
                message.error("Gagal memuat data santri: " + (e.message || "Error"));
            }
        })();
    }, [scope]);

    useEffect(() => {
        if (!tahun || !bulan || !mingguKe || !identity?.id) return;
        setLoading(true);
        setSesiByKey({});
        setAbsensiGrid({});

        (async () => {
            try {
                // 1. Batch SELECT all existing sesi records for this date range
                const tanggalMulai = weekDates[0].tanggal;
                const tanggalAkhir = weekDates[weekDates.length - 1].tanggal;
                const { data: existingAll, error: selectErr } = await supabaseClient
                    .from("ngaji_sesi")
                    .select("id, hari_ke, sesi_ke, tanggal")
                    .eq("kegiatan_id", "NGAJI")
                    .gte("tanggal", tanggalMulai)
                    .lte("tanggal", tanggalAkhir);

                if (selectErr) throw selectErr;

                const existingMap = new Map((existingAll || []).map((r: any) => [
                    `${r.hari_ke}_${r.sesi_ke}`, r
                ]));

                const sesiResult: Record<string, string> = {};
                const toInsert: any[] = [];

                for (const wd of weekDates) {
                    const key = `${wd.hariKe}_${wd.sesiKe}`;
                    const existing = existingMap.get(key);

                    if (existing) {
                        sesiResult[key] = existing.id;
                    } else {
                        toInsert.push({
                            kegiatan_id: "NGAJI",
                            bulan_hijriah: bulanLabel,
                            tahun_hijriah: tahun,
                            bulan_hijriah_number: bulan,
                            minggu_ke: mingguKe,
                            tanggal: wd.tanggal,
                            hari_ke: wd.hariKe,
                            sesi_ke: wd.sesiKe,
                            created_by: identity.id,
                        });
                    }
                }

                // 3. Batch insert missing records (update jika metadata sudah ada dengan tanggal baru)
                if (toInsert.length > 0) {
                    const { data: inserted, error: insertErr } = await supabaseClient
                        .from("ngaji_sesi")
                        .upsert(toInsert, { onConflict: 'kegiatan_id,bulan_hijriah,tahun_hijriah,minggu_ke,hari_ke,sesi_ke' })
                        .select("id, hari_ke, sesi_ke");

                    if (insertErr) throw insertErr;
                    (inserted || []).forEach((r: any) => {
                        sesiResult[`${r.hari_ke}_${r.sesi_ke}`] = r.id;
                    });
                }

                setSesiByKey(sesiResult);

                const uniqueTanggal = [...new Set(weekDates.map(wd => wd.tanggal))];
                const hijriDates = uniqueTanggal.map(t => resolveHijri(t));
                const orClauses: string[] = [];
                for (const h of hijriDates) {
                    orClauses.push(`and(tahun_hijriah.eq.${h.hy},bulan_hijriah_number.eq.${h.hm},hari_hijriah.eq.${h.hd},sesi_ke.eq.1)`);
                }
                const orFilter = orClauses.join(',');
                const { data: absensiData, error: absenErr } = await supabaseClient
                    .from("ngaji_absensi")
                    .select("tahun_hijriah, bulan_hijriah_number, hari_hijriah, sesi_ke, santri_nis, status")
                    .or(orFilter);

                if (absenErr) throw absenErr;

                const grid: Record<string, Record<string, { status: string | null }>> = {};
                (absensiData || []).forEach((a: any) => {
                    if (!grid[a.santri_nis]) grid[a.santri_nis] = {};
                    const gridKey = `${a.tahun_hijriah}_${a.bulan_hijriah_number}_${a.hari_hijriah}_${a.sesi_ke}`;
                    grid[a.santri_nis][gridKey] = { status: a.status };
                });
                setAbsensiGrid(grid);
            } catch (e: any) {
                message.error("Gagal memuat data absensi: " + (e.message || "Error"));
            } finally {
                setLoading(false);
            }
        })();
    }, [tahun, bulan, mingguKe, identity?.id, fetchKey, bulanLabel]);

    const handleStatusClick = async (nis: string, tanggal: string, sesiKe: number, status: string) => {
        const h = resolveHijri(tanggal);
        const hy = h.hy;
        const hm = h.hm;
        const hd = h.hd;
        const cellKey = `${nis}_${hy}_${hm}_${hd}_${sesiKe}`;
        if (savingCells[cellKey]) return;
        setSavingCells(prev => ({ ...prev, [cellKey]: true }));
        const gridKey = `${hy}_${hm}_${hd}_${sesiKe}`;
        try {
            if (status === '') {
                await supabaseClient
                    .from("ngaji_absensi")
                    .delete()
                    .eq("tahun_hijriah", hy)
                    .eq("bulan_hijriah_number", hm)
                    .eq("hari_hijriah", hd)
                    .eq("sesi_ke", sesiKe)
                    .eq("santri_nis", nis);

                setAbsensiGrid(prev => {
                    if (!prev[nis]) return prev;
                    const next = { ...prev };
                    const nisAbs = { ...next[nis] };
                    delete nisAbs[gridKey];
                    next[nis] = nisAbs;
                    return next;
                });
            } else {
                await supabaseClient
                    .from("ngaji_absensi")
                    .upsert({
                        tahun_hijriah: hy,
                        bulan_hijriah_number: hm,
                        hari_hijriah: hd,
                        sesi_ke: sesiKe,
                        santri_nis: nis,
                        status,
                    }, { onConflict: "tahun_hijriah,bulan_hijriah_number,hari_hijriah,sesi_ke,santri_nis" });

                setAbsensiGrid(prev => ({
                    ...prev,
                    [nis]: { ...prev[nis], [gridKey]: { status } },
                }));
            }
        } catch {
            message.error("Gagal menyimpan");
        } finally {
            setSavingCells(prev => ({ ...prev, [cellKey]: false }));
        }
    };

    const yearOptions = useMemo(() => {
        const years: number[] = [];
        for (let y = todayHijri.hy - 2; y <= todayHijri.hy + 2; y++) years.push(y);
        return years;
    }, [todayHijri.hy]);

    const colLetter = (n: number): string => {
        let s = '';
        while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
        return s;
    };

    // ── Koreksi Hijriah modal ──
    const [koreksiOpen, setKoreksiOpen] = useState(false);
    const [koreksiTahun, setKoreksiTahun] = useState<number>(tahun);
    const [koreksiBulan, setKoreksiBulan] = useState<number>(bulan);
    const [koreksiAwal, setKoreksiAwal] = useState<dayjs.Dayjs | null>(null);
    const [koreksiPanjang, setKoreksiPanjang] = useState<30 | 29>(30);
    const [koreksiVerified, setKoreksiVerified] = useState(false);
    const [koreksiKet, setKoreksiKet] = useState("");
    const [koreksiSaving, setKoreksiSaving] = useState(false);
    const [koreksiRows, setKoreksiRows] = useState<any[]>([]);
    const [koreksiLoading, setKoreksiLoading] = useState(false);
    const { refresh: korRefresh } = useHijriCorrection();

    const loadKoreksi = async () => {
        setKoreksiLoading(true);
        const { data } = await supabaseClient
            .from("koreksi_bulan_hijriah")
            .select("tahun_hijriah, bulan_hijriah_number, tanggal_awal_masehi, panjang_bulan, verified, keterangan")
            .order("tahun_hijriah", { ascending: false })
            .order("bulan_hijriah_number", { ascending: false });
        setKoreksiRows(data || []);
        setKoreksiLoading(false);
    };

    const autoFillKoreksi = (thn: number, bln: number) => {
        if (!thn || !bln) return;
        const approxGreg = Math.round(622 + (thn - 1) * 354.367 / 365.2425);
        const sd = dayjs().year(approxGreg - 1).startOf("year");
        for (let i = 0; i < 800; i++) {
            const d = sd.add(i, "day");
            const h = hijriConverter.toHijri(d.year(), d.month() + 1, d.date());
            if (h.hy === thn && h.hm === bln && h.hd === 1) {
                setKoreksiAwal(d);
                return;
            }
        }
    };

    const openKoreksiModal = () => {
        setKoreksiTahun(tahun);
        setKoreksiBulan(bulan);
        setKoreksiAwal(null);
        setKoreksiPanjang(30);
        setKoreksiVerified(false);
        setKoreksiKet("");
        autoFillKoreksi(tahun, bulan);
        setKoreksiOpen(true);
        loadKoreksi();
    };

    const handleKoreksiSave = async () => {
        if (!koreksiTahun) { message.warning("Isi tahun"); return; }
        if (!koreksiAwal) { message.warning("Isi tanggal awal"); return; }
        setKoreksiSaving(true);
        try {
            const { error } = await supabaseClient
                .from("koreksi_bulan_hijriah")
                .upsert({
                    tahun_hijriah: koreksiTahun,
                    bulan_hijriah_number: koreksiBulan,
                    tanggal_awal_masehi: koreksiAwal.format("YYYY-MM-DD"),
                    panjang_bulan: koreksiPanjang,
                    verified: koreksiVerified,
                    keterangan: koreksiKet.trim() || null,
                }, { onConflict: "tahun_hijriah,bulan_hijriah_number" });
            if (error) throw error;
            message.success("Koreksi tersimpan");
            korRefresh();
            loadKoreksi();
        } catch (e: any) {
            message.error("Gagal: " + (e.message || ""));
        } finally {
            setKoreksiSaving(false);
        }
    };

    const handleKoreksiDelete = async (thn: number, bln: number) => {
        try {
            await supabaseClient
                .from("koreksi_bulan_hijriah")
                .delete()
                .eq("tahun_hijriah", thn)
                .eq("bulan_hijriah_number", bln);
            message.success("Koreksi dihapus");
            korRefresh();
            loadKoreksi();
        } catch (e: any) {
            message.error("Gagal hapus: " + (e.message || ""));
        }
    };

    const handleExport = () => {
        setSelectedExportWeeks([mingguKe]);
        setExportModalOpen(true);
    };

    const exportWeeksData = async (weekNumbers: number[]) => {
        if (exporting) return;
        setExporting(true);
        setExportModalOpen(false);
        try {
            const { data: santri } = await supabaseClient
                .from("santri")
                .select("nis, nama, kelas, total_hafalan")
                .eq("jurusan", "TAHFIDZ")
                .eq("status_santri", "AKTIF")
                .order("kelas", { ascending: true })
                .order("nama", { ascending: true });
            const santriListData = santri || [];

            const weeksData = weekNumbers.map(mg => ({
                mingguKe: mg,
                dates: getWeekDates(tahun, bulan, mg),
            }));

            const allTanggals = [...new Set(weeksData.flatMap(w => w.dates.map(d => d.tanggal)))].sort();
            const tglMulai = allTanggals[0];
            const tglAkhir = allTanggals[allTanggals.length - 1];

            const { data: existingSesi } = await supabaseClient
                .from("ngaji_sesi")
                .select("id, hari_ke, sesi_ke, tanggal")
                .eq("kegiatan_id", "NGAJI")
                .gte("tanggal", tglMulai)
                .lte("tanggal", tglAkhir);

            const existingSesiSet = new Set((existingSesi || []).map((s: any) => `${s.tanggal}_${s.hari_ke}_${s.sesi_ke}`));
            const toCreateExport: any[] = [];

            for (const week of weeksData) {
                for (const wd of week.dates) {
                    const key = `${wd.tanggal}_${wd.hariKe}_${wd.sesiKe}`;
                    if (!existingSesiSet.has(key)) {
                        toCreateExport.push({
                            kegiatan_id: "NGAJI",
                            bulan_hijriah: bulanLabel,
                            tahun_hijriah: tahun,
                            bulan_hijriah_number: bulan,
                            minggu_ke: week.mingguKe,
                            tanggal: wd.tanggal,
                            hari_ke: wd.hariKe,
                            sesi_ke: wd.sesiKe,
                            created_by: identity?.id,
                        });
                    }
                }
            }

            if (toCreateExport.length > 0) {
                await supabaseClient
                    .from("ngaji_sesi")
                    .upsert(toCreateExport, { onConflict: 'kegiatan_id,bulan_hijriah,tahun_hijriah,minggu_ke,hari_ke,sesi_ke' });
            }

            const exportAbsensiGrid: Record<string, Record<string, { status: string | null }>> = {};
            if (allTanggals.length > 0) {
                const orClauses = allTanggals.map(t => {
                    const h = resolveHijri(t);
                    return `and(tahun_hijriah.eq.${h.hy},bulan_hijriah_number.eq.${h.hm},hari_hijriah.eq.${h.hd},sesi_ke.eq.1)`;
                });
                const { data: absData } = await supabaseClient
                    .from("ngaji_absensi")
                    .select("tahun_hijriah, bulan_hijriah_number, hari_hijriah, sesi_ke, santri_nis, status")
                    .or(orClauses.join(','));
                (absData || []).forEach((a: any) => {
                    if (!exportAbsensiGrid[a.santri_nis]) exportAbsensiGrid[a.santri_nis] = {};
                    const gridKey = `${a.tahun_hijriah}_${a.bulan_hijriah_number}_${a.hari_hijriah}_${a.sesi_ke}`;
                    exportAbsensiGrid[a.santri_nis][gridKey] = { status: a.status };
                });
            }

            const COLS_BASE = 3; // No, Nama, Hafalan
            const COLS_PER_WEEK = 9; // 5 day cols + 4 stats cols
            const COLS_RECAP = 4;
            const totalCols = COLS_BASE + (weeksData.length * COLS_PER_WEEK) + COLS_RECAP;

            const wb = new ExcelJS.Workbook();
            const ws = wb.addWorksheet("Absensi Ngaji");

            ws.mergeCells(`A1:${colLetter(totalCols)}1`);
            ws.getCell("A1").value = `ABSENSI NGAJI — ${bulanLabel} ${tahun} H`;
            ws.getCell("A1").font = { size: 13, bold: true, color: { argb: "FFFFFFFF" } };
            ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC9A84C" } };
            ws.getCell("A1").alignment = { horizontal: "center" };
            ws.getRow(1).height = 22;
            ws.addRow([]);

            // Row 3: Group separators
            const groupRow: any[] = ["", "", ""];
            weeksData.forEach(week => {
                groupRow.push(`MINGGU Ke-${week.mingguKe}`);
                for (let i = 0; i < COLS_PER_WEEK - 1; i++) groupRow.push("");
            });
            groupRow.push("REKAP BULANAN");
            for (let i = 0; i < COLS_RECAP - 1; i++) groupRow.push("");
            const groupRowObj = ws.getRow(3);
            groupRowObj.values = groupRow;
            groupRowObj.height = 20;

            let gCol = 4;
            weeksData.forEach(() => {
                const sL = colLetter(gCol);
                const eL = colLetter(gCol + COLS_PER_WEEK - 1);
                ws.mergeCells(`${sL}3:${eL}3`);
                gCol += COLS_PER_WEEK;
            });
            const recapSL = colLetter(gCol);
            const recapEL = colLetter(gCol + COLS_RECAP - 1);
            ws.mergeCells(`${recapSL}3:${recapEL}3`);

            // Row 4: Sub-headers
            const subRow4: any[] = ["NO", "NAMA", "HAFALAN"];
            weeksData.forEach(week => {
                week.dates.forEach((wd, i) => {
                    const h = resolveHijri(wd.tanggal);
                    subRow4.push(`${HARI_LABEL[i + 1]?.full || ''} ${h.hd}`);
                });
                subRow4.push("H"); subRow4.push("S"); subRow4.push("I"); subRow4.push("G");
            });
            subRow4.push("Total H"); subRow4.push("Total S"); subRow4.push("Total I"); subRow4.push("Total G");
            const subRowObj = ws.getRow(4);
            subRowObj.values = subRow4;
            subRowObj.font = { bold: true, size: 8 };
            subRowObj.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
            subRowObj.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };

            // Column widths
            ws.columns = [
                { key: "no", width: 5 },
                { key: "nama", width: 24 },
                { key: "hafalan", width: 10 },
                ...weeksData.flatMap(() => [
                    { key: "", width: 8 }, { key: "", width: 8 }, { key: "", width: 8 },
                    { key: "", width: 8 }, { key: "", width: 8 },
                    { key: "", width: 8 }, { key: "", width: 8 },
                    { key: "", width: 8 }, { key: "", width: 8 },
                ]),
                { key: "", width: 8 }, { key: "", width: 8 },
                { key: "", width: 8 }, { key: "", width: 8 },
            ];

            // Recopy group row styling after columns set (ExcelJS quirk)
            ws.getRow(3).eachCell((cell: any) => {
                cell.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC9A84C" } };
                cell.alignment = { horizontal: "center", vertical: "middle" };
            });
            // Recap header in group row gets blue instead
            for (let c = gCol; c < gCol + COLS_RECAP; c++) {
                const cell = ws.getRow(3).getCell(c);
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
            }

            // Data rows
            santriListData.forEach((s: any, idx: number) => {
                const rv: any[] = [idx + 1, s.nama || santriAlias(s.nis), s.total_hafalan || '-'];
                let totalHadir = 0, totalSakit = 0, totalIzin = 0, totalAlpha = 0;

                weeksData.forEach(week => {
                    let cHadir = 0, cSakit = 0, cIzin = 0, cAlpha = 0;
                    for (let h = 1; h <= 5; h++) {
                        const wd = week.dates[h - 1];
                        const hi = wd ? resolveHijri(wd.tanggal) : null;
                        const gk = hi ? `${hi.hy}_${hi.hm}_${hi.hd}_1` : '';
                        const abs = gk ? exportAbsensiGrid[s.nis]?.[gk] : undefined;
                        rv.push(abs?.status ? STATUS_CODE[abs.status] || abs.status : '');
                        if (abs?.status === 'HADIR') cHadir++;
                        else if (abs?.status === 'SAKIT') cSakit++;
                        else if (abs?.status === 'IZIN') cIzin++;
                        else if (abs?.status === 'GHAIB' || abs?.status === 'PULANG') cAlpha++;
                    }
                    rv.push(cHadir || '', cSakit || '', cIzin || '', cAlpha || '');
                    totalHadir += cHadir;
                    totalSakit += cSakit;
                    totalIzin += cIzin;
                    totalAlpha += cAlpha;
                });

                rv.push(totalHadir || '', totalSakit || '', totalIzin || '', totalAlpha || '');

                const dataRow = ws.addRow(rv);

                // Color fills
                let ci = 4;
                weeksData.forEach(week => {
                    for (let h = 1; h <= 5; h++) {
                        const wd = week.dates[h - 1];
                        const hi = wd ? resolveHijri(wd.tanggal) : null;
                        const gk = hi ? `${hi.hy}_${hi.hm}_${hi.hd}_1` : '';
                        const abs = gk ? exportAbsensiGrid[s.nis]?.[gk] : undefined;
                        if (abs?.status) {
                            const fill = STATUS_FILLS[abs.status];
                            if (fill) dataRow.getCell(ci).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
                        }
                        ci++;
                    }
                    ci += 4; // skip stats cols
                });
            });

            const lastDataRowNum = ws.rowCount;

            let gHadir = 0, gSakit = 0, gIzin = 0, gAlpha = 0;
            santriListData.forEach((s: any) => {
                let cH = 0, cS = 0, cI = 0, cA = 0;
                weeksData.forEach(week => {
                    for (let h = 1; h <= 5; h++) {
                        const wd = week.dates[h - 1];
                        const hi = wd ? resolveHijri(wd.tanggal) : null;
                        const gk = hi ? `${hi.hy}_${hi.hm}_${hi.hd}_1` : '';
                        const abs = gk ? exportAbsensiGrid[s.nis]?.[gk] : undefined;
                        if (abs?.status === 'HADIR') cH++;
                        else if (abs?.status === 'SAKIT') cS++;
                        else if (abs?.status === 'IZIN') cI++;
                        else if (abs?.status === 'GHAIB' || abs?.status === 'PULANG') cA++;
                    }
                });
                gHadir += cH; gSakit += cS; gIzin += cI; gAlpha += cA;
            });

            const totalEmpties: any[] = [];
            weeksData.forEach(() => {
                for (let i = 0; i < COLS_PER_WEEK; i++) totalEmpties.push('');
            });
            ws.addRow([]);
            const finalRow = ws.addRow([
                '', 'TOTAL', '',
                ...totalEmpties,
                gHadir || '', gSakit || '', gIzin || '', gAlpha || '',
            ]);
            finalRow.font = { bold: true, size: 10 };
            finalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };

            // AutoFilter on row 4
            ws.autoFilter = { from: `A4`, to: `${colLetter(totalCols)}${lastDataRowNum}` };

            const buffer = await wb.xlsx.writeBuffer();
            const weekLabel = weekNumbers.length >= (showWeek5 ? 5 : 4) ? '1Bulan' : `Mg${weekNumbers.join('_')}`;
            saveAs(new Blob([buffer]), `Absensi_Ngaji_${bulanLabel}_${weekLabel}_${dayjs().format("YYYYMMDD")}.xlsx`);
            message.success("Berhasil diunduh");
        } catch (error: any) {
            message.error("Gagal export: " + error.message);
        } finally {
            setExporting(false);
        }
    };

    return (
        <div style={{ padding: "0 0 80px" }}>
            <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                        <Text style={{ fontSize: 18, fontWeight: 500, display: "block" }}>
                            📖 Absensi Ngaji Tahfidz
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            {bulanLabel} {tahun} H — Minggu ke-{mingguKe}
                        </Text>
                    </div>
                    <Space>
                        <Button
                            icon={<FileExcelOutlined />}
                            onClick={handleExport}
                            loading={exporting}
                            style={{ color: "#16a34a", borderColor: "#16a34a" }}
                        >
                            Export Excel
                        </Button>
                        <Button
                            icon={<EditOutlined />}
                            onClick={openKoreksiModal}
                            style={{ color: "#C9A84C", borderColor: "#C9A84C" }}
                        >
                            Koreksi Hijriah
                        </Button>
                        <Button
                            type="primary"
                            icon={<CalendarOutlined />}
                            onClick={() => {
                                const h = getCurrentHijri();
                                setTahun(h.hy);
                                setBulan(h.hm);
                                const mk = Math.min(Math.ceil(h.hd / 7), 4);
                                setMingguKe(mk);
                                setShowWeek5(mk === 5);
                            }}
                            style={{
                                background: "linear-gradient(135deg, #C9A84C, #8B6E23)",
                                border: "none",
                                borderRadius: 8, fontWeight: 600,
                            }}
                        >
                            Bulan Ini
                        </Button>
                    </Space>
                </div>
            </div>

            <div style={{
                background: token.colorBgContainer,
                border: `1px solid ${isDark ? "#334155" : token.colorBorderSecondary}`,
                borderRadius: 12, padding: "16px 20px", marginBottom: 16,
                boxShadow: isDark ? "0 1px 3px rgba(0,0,0,0.25)" : "0 1px 3px rgba(0,0,0,0.06)",
            }}>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                    <Space>
                        <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>Tahun:</Text>
                        <Select
                            value={tahun}
                            onChange={v => { setTahun(v); setMingguKe(1); setShowWeek5(false); }}
                            options={yearOptions.map(y => ({ label: `${y} H`, value: y }))}
                            size="small"
                            style={{ width: 100 }}
                        />
                    </Space>
                    <Space>
                        <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>Bulan:</Text>
                        <Select
                            value={bulan}
                            onChange={v => { setBulan(v); setMingguKe(1); setShowWeek5(false); }}
                            options={HIJRI_MONTHS.map((name, i) => ({ label: name, value: i + 1 }))}
                            size="small"
                            style={{ width: 150 }}
                        />
                    </Space>
                    <Space>
                        <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>Minggu:</Text>
                        <Segmented
                            value={mingguKe}
                            onChange={v => setMingguKe(v as number)}
                            size="small"
                            options={Array.from({ length: mingguMaxKe }, (_, i) => ({
                                label: `Mg ${i + 1}`,
                                value: i + 1,
                            }))}
                        />
                        {!showWeek5 && (
                            <Button
                                type="dashed"
                                size="small"
                                icon={<PlusOutlined />}
                                onClick={() => { setShowWeek5(true); setMingguKe(5); }}
                                style={{ borderRadius: 6, fontSize: 11, height: 24, padding: '0 8px' }}
                            >
                                Mg 5
                            </Button>
                        )}
                    </Space>
                </div>
            </div>

            <div style={{
                background: token.colorBgContainer,
                border: `1px solid ${isDark ? "#334155" : token.colorBorderSecondary}`,
                borderRadius: 12, overflow: "hidden",
            }}>
                {loading ? (
                    <div style={{ padding: "40px 20px", textAlign: "center" }}>
                        <Spin /> <span style={{ marginLeft: 8, color: token.colorTextSecondary }}>Memuat data...</span>
                    </div>
                ) : (
                    <>
                        <div style={{
                            padding: "12px 20px", borderBottom: `1px solid ${token.colorBorderSecondary}`,
                            background: isDark ? "#1E293B" : "#F8FAFC",
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                        }}>
                            <Space>
                                <Text strong>{bulanLabel} {tahun} H — Minggu ke-{mingguKe}</Text>
                                <Tag color="green" style={{ fontSize: 10 }}>{santriList.length} santri</Tag>
                            </Space>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                                Klik tag untuk ubah status
                            </Text>
                        </div>

                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1000 }}>
                                <thead>
                                    {/* Row 1: Day headers */}
                                    <tr style={{ background: isDark ? "#1E293B" : "#F8FAFC" }}>
                                        <th rowSpan={2} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, color: token.colorTextSecondary, fontWeight: 600, borderBottom: `1px solid ${token.colorBorderSecondary}`, width: 40 }}>#</th>
                                        <th rowSpan={2} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, color: token.colorTextSecondary, fontWeight: 600, borderBottom: `1px solid ${token.colorBorderSecondary}`, width: 180 }}>Santri</th>
                                        <th rowSpan={2} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, color: token.colorTextSecondary, fontWeight: 600, borderBottom: `1px solid ${token.colorBorderSecondary}`, width: 50 }}>Kls</th>
                                        {(() => {
                                            const cells: React.ReactNode[] = [];
                                            for (let hariKe = 1; hariKe <= 5; hariKe++) {
                                                const label = HARI_LABEL[hariKe];
                                                const wd = weekDates[hariKe - 1];
                                                const tanggal = wd?.tanggal || '';
                                                const h = tanggal ? resolveHijri(tanggal) : null;
                                                const isOverflow = h && h.hm !== bulan;
                                                cells.push(
                                                    <th key={`day-${hariKe}`} colSpan={1} style={{
                                                        padding: "8px 6px", textAlign: "center", fontSize: 11, fontWeight: 700,
                                                        color: isOverflow ? '#D97706' : '#7C3AED',
                                                        borderBottom: `1px solid ${token.colorBorderSecondary}`,
                                                        background: isDark ? '#1E1B2B' : '#F8F6FF',
                                                        minWidth: 150,
                                                    }}>
                                                        <div style={{ fontWeight: 700, fontSize: 12 }}>
                                                            {label?.full}
                                                            {isOverflow && <AntTooltip title={`Hari ini berada di bulan ${h.monthName} ${h.hy} H, bukan ${bulanLabel} ${tahun} H`}>
                                                                <span style={{ fontSize: 12, marginLeft: 4, cursor: "help" }}>⚠️</span>
                                                            </AntTooltip>}
                                                        </div>
                                                        <div style={{ fontWeight: 400, fontSize: 10, color: token.colorTextTertiary, marginTop: 2 }}>
                                                            {tanggal ? dayjs(tanggal).format("DD/MM/YYYY") : '—'}
                                                        </div>
                                                        {h && (
                                                            <div style={{ fontWeight: 500, fontSize: 10, color: isOverflow ? '#D97706' : '#7C3AED', marginTop: 1 }}>
                                                                {h.hd} {h.monthName} {h.hy} H
                                                            </div>
                                                        )}
                                                    </th>
                                                );
                                            }
                                            return cells;
                                        })()}
                                    </tr>
                                </thead>
                                <tbody>
                                    {santriList.map((santri: any, idx: number) => {
                                        const santriAbsensi = absensiGrid[santri.nis] || {};

                                        return (
                                            <tr key={santri.nis} style={{
                                                borderBottom: `1px solid ${isDark ? "#1E2D3D" : "#F1F5F9"}`,
                                            }}>
                                                <td style={{ padding: "10px 12px", fontSize: 11, color: token.colorTextSecondary }}>{idx + 1}</td>
                                                <td style={{ padding: "10px 12px" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                        <Avatar src={santri.foto_url} size={28} icon={<UserOutlined />} style={{ background: "#C9A84C", color: "#fff", flexShrink: 0 }} />
                                                        <div style={{ minWidth: 0 }}>
                                                            <div style={{ fontWeight: 600, fontSize: 12, color: token.colorText, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                                {santri.nama || santriAlias(santri.nis)}
                                                            </div>
                                                            <div style={{ fontSize: 10, color: token.colorTextSecondary }}>
                                                                <code style={{ background: isDark ? "#0F172A" : "#F1F5F9", padding: "1px 4px", borderRadius: 4, fontSize: 9 }}>{santri.nis}</code>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ padding: "10px 12px", textAlign: "center" }}>
                                                    <div style={{
                                                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                                                        width: 24, height: 24, borderRadius: 6,
                                                        background: isDark ? "#1E3A5F" : "#DBEAFE",
                                                        color: "#2563EB", fontWeight: 700, fontSize: 11,
                                                    }}>
                                                        {santri.kelas}
                                                    </div>
                                                </td>
                                                {(() => {
                                                    const cells: React.ReactNode[] = [];
                                                    for (let hariKe = 1; hariKe <= 5; hariKe++) {
                                                        const key = `${hariKe}_1`;
                                                        const wd = weekDates[hariKe - 1];
                                                        const h = wd ? resolveHijri(wd.tanggal) : null;
                                                        const gridKey = h ? `${h.hy}_${h.hm}_${h.hd}_1` : '';
                                                        const saveKey = `${santri.nis}_${gridKey}`;
                                                        const isSaving = savingCells[saveKey] || false;
                                                        const rec = gridKey ? santriAbsensi[gridKey] : undefined;
                                                            const currentStatus = rec?.status || '';
                                                            const status = STATUS_ABSENSI.find(s => s.key === currentStatus);

                                                            cells.push(
                                                                <td key={key} style={{ padding: "4px 4px", textAlign: "center" }}>
                                                                     <Dropdown
                                                                        menu={{
                                                                            items: STATUS_ABSENSI.map(s => ({
                                                                                key: s.key,
                                                                                icon: <span>{s.icon}</span>,
                                                                                label: (
                                                                                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minWidth: 80 }}>
                                                                                        {s.label}
                                                                                        {currentStatus === s.key && <span style={{ color: '#16A34A', fontWeight: 700 }}>✓</span>}
                                                                                    </span>
                                                                                ),
                                                                            })),
                                                                            onClick: ({ key: k }) => {
                                                                                if (wd) handleStatusClick(santri.nis, wd.tanggal, wd.sesiKe, currentStatus === k ? '' : k);
                                                                            },
                                                                        }}
                                                                        trigger={['click']}
                                                                        disabled={!wd || isSaving}
                                                                    >
                                                                        <Tag
                                                                            style={{
                                                                                cursor: !wd || isSaving ? 'not-allowed' : 'pointer',
                                                                                margin: 0, fontSize: 11,
                                                                                padding: '2px 8px', borderRadius: 4,
                                                                                border: `1.5px solid ${status ? status.color : token.colorBorderSecondary}`,
                                                                                background: status ? status.bg : 'transparent',
                                                                                color: status ? status.color : token.colorTextTertiary,
                                                                                fontWeight: status ? 700 : 400,
                                                                                opacity: isSaving ? 0.5 : 1,
                                                                                transition: 'all 0.12s',
                                                                                userSelect: 'none',
                                                                                display: 'inline-flex',
                                                                                alignItems: 'center',
                                                                                gap: 4,
                                                                            }}
                                                                        >
                                                                            {status ? `${status.icon} ${STATUS_CODE[currentStatus]}` : '−'}
                                                                        </Tag>
                                                                    </Dropdown>
                                                                </td>
                                                            );
                                                    }
                                                    return cells;
                                                })()}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {santriList.length === 0 && (
                                <div style={{ padding: "40px 20px", textAlign: "center", color: token.colorTextSecondary }}>
                                    Tidak ada santri tahfidz aktif
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

                        <Modal
                title={<span><FileExcelOutlined style={{ color: '#16a34a' }} /> Export Absensi Ngaji</span>}
                open={exportModalOpen}
                onCancel={() => setExportModalOpen(false)}
                onOk={() => exportWeeksData(selectedExportWeeks)}
                okText="Export"
                okButtonProps={{ loading: exporting, icon: <FileExcelOutlined />, style: { background: '#16a34a', borderColor: '#16a34a' } }}
                cancelButtonProps={{ disabled: exporting }}
                destroyOnClose
            >
                <div style={{ padding: '8px 0' }}>
                    <Text style={{ display: 'block', marginBottom: 12, color: token.colorTextSecondary }}>
                        Pilih Minggu yang akan di-export:
                    </Text>
                    <Checkbox.Group
                        value={selectedExportWeeks}
                        onChange={v => setSelectedExportWeeks(v as number[])}
                        options={Array.from({ length: mingguMaxKe }, (_, i) => ({
                            label: `Minggu ${i + 1}`,
                            value: i + 1,
                        }))}
                    />
                    <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                        <Button size="small" onClick={() => setSelectedExportWeeks([mingguKe])}>Minggu Ini</Button>
                        <Button size="small" onClick={() => setSelectedExportWeeks(Array.from({ length: mingguMaxKe }, (_, i) => i + 1))}>Semua Minggu</Button>
                    </div>
                </div>
            </Modal>

            <Modal
                title={<span><EditOutlined /> Koreksi Bulan Hijriah</span>
}
                open={koreksiOpen}
                onCancel={() => setKoreksiOpen(false)}
                width={520}
                footer={null}
                destroyOnHidden
            >
                <div style={{ marginBottom: 16, padding: "16px 0", borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
                    <Space wrap align="end">
                        <div>
                            <Text style={{ fontSize: 11, display: "block", marginBottom: 4, color: token.colorTextSecondary }}>Tahun H</Text>
                            <InputNumber
                                value={koreksiTahun}
                                onChange={v => { setKoreksiTahun(v || 0); }}
                                onBlur={() => autoFillKoreksi(koreksiTahun, koreksiBulan)}
                                min={1440} max={1500}
                                style={{ width: 100 }}
                            />
                        </div>
                        <div>
                            <Text style={{ fontSize: 11, display: "block", marginBottom: 4, color: token.colorTextSecondary }}>Bulan H</Text>
                            <Select
                                value={koreksiBulan}
                                onChange={v => { setKoreksiBulan(v); autoFillKoreksi(koreksiTahun, v); }}
                                options={HIJRI_MONTHS.map((n, i) => ({ label: n, value: i + 1 }))}
                                style={{ width: 150 }}
                            />
                        </div>
                        <div>
                            <Text style={{ fontSize: 11, display: "block", marginBottom: 4, color: token.colorTextSecondary }}>Awal Masehi</Text>
                            <DatePicker value={koreksiAwal} onChange={setKoreksiAwal} format="DD/MM/YYYY" style={{ width: 160 }} />
                        </div>
                    </Space>
                    <Space wrap align="end" style={{ marginTop: 12 }}>
                        <div>
                            <Text style={{ fontSize: 11, display: "block", marginBottom: 4, color: token.colorTextSecondary }}>Panjang</Text>
                            <Select
                                value={koreksiPanjang}
                                onChange={v => setKoreksiPanjang(v)}
                                options={[{ label: "30 hari", value: 30 }, { label: "29 hari", value: 29 }]}
                                style={{ width: 110 }}
                            />
                        </div>
                        <div>
                            <Text style={{ fontSize: 11, display: "block", marginBottom: 4, color: token.colorTextSecondary }}>Verified</Text>
                            <Switch checked={koreksiVerified} onChange={setKoreksiVerified} checkedChildren="Ya" unCheckedChildren="Tidak" />
                        </div>
                        <div>
                            <Text style={{ fontSize: 11, display: "block", marginBottom: 4, color: token.colorTextSecondary }}>Keterangan</Text>
                            <Input value={koreksiKet} onChange={e => setKoreksiKet(e.target.value)} placeholder="Opsional" style={{ width: 180 }} allowClear />
                        </div>
                        <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleKoreksiSave} loading={koreksiSaving}>Simpan</Button>
                    </Space>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <Text strong style={{ fontSize: 13 }}>Daftar Koreksi</Text>
                    <Button size="small" icon={<ReloadOutlined />} onClick={loadKoreksi} loading={koreksiLoading}>Refresh</Button>
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                        <tr style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
                            <th style={{ textAlign: "left", padding: "6px 8px", color: token.colorTextSecondary }}>Bulan</th>
                            <th style={{ textAlign: "left", padding: "6px 8px", color: token.colorTextSecondary }}>Awal</th>
                            <th style={{ textAlign: "left", padding: "6px 8px", color: token.colorTextSecondary }}>Panjang</th>
                            <th style={{ textAlign: "left", padding: "6px 8px", color: token.colorTextSecondary }}>Status</th>
                            <th style={{ textAlign: "left", padding: "6px 8px", color: token.colorTextSecondary }}>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {koreksiRows.map(r => (
                            <tr key={`${r.tahun_hijriah}_${r.bulan_hijriah_number}`} style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
                                <td style={{ padding: "6px 8px" }}>{HIJRI_MONTHS[r.bulan_hijriah_number - 1]} {r.tahun_hijriah} H</td>
                                <td style={{ padding: "6px 8px" }}>{dayjs(r.tanggal_awal_masehi).format("DD/MM/YYYY")}</td>
                                <td style={{ padding: "6px 8px" }}>{r.panjang_bulan} hr</td>
                                <td style={{ padding: "6px 8px" }}>
                                    {r.verified
                                        ? <Tag icon={<CheckCircleOutlined />} color="success" style={{ fontSize: 10 }}>OK</Tag>
                                        : <Tag icon={<CloseCircleOutlined />} color="warning" style={{ fontSize: 10 }}>?</Tag>
                                    }
                                </td>
                                <td style={{ padding: "6px 8px" }}>
                                    <Button danger size="small" icon={<DeleteOutlined />}
                                        onClick={() => handleKoreksiDelete(r.tahun_hijriah, r.bulan_hijriah_number)}
                                    />
                                </td>
                            </tr>
                        ))}
                        {koreksiRows.length === 0 && (
                            <tr><td colSpan={5} style={{ padding: 16, textAlign: "center", color: token.colorTextSecondary }}>Belum ada koreksi</td></tr>
                        )}
                    </tbody>
                </table>
            </Modal>
        </div>
    );
};
