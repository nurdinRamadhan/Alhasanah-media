import React, { useState, useMemo, useEffect } from "react";
import { useTable } from "@refinedev/antd";
import { Row, Col, DatePicker, Typography, Space, Button, theme, Spin, Table, Segmented, message, Divider, Statistic, Select, Modal, Checkbox } from "antd";
import {
    DownloadOutlined, TeamOutlined, BookOutlined, SyncOutlined,
    CheckCircleFilled, CloseCircleOutlined, RiseOutlined,
    CalendarOutlined, BarChartOutlined, PieChartOutlined,
    FileExcelOutlined,
} from "@ant-design/icons";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    ResponsiveContainer, Cell, PieChart, Pie, Legend, LineChart, Line, AreaChart, Area,
} from "recharts";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
dayjs.extend(isoWeek);
import { supabaseClient } from "../../utility/supabaseClient";
import { formatHijri, formatMasehi, HIJRI_MONTHS } from "../../utility/dateHelper";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { santriAlias } from "../../utility/privacy";
import hijriConverter from "hijri-converter";
const getCurrentHijri = () => {
    const now = new Date();
    return hijriConverter.toHijri(now.getFullYear(), now.getMonth() + 1, now.getDate());
};
import { resolveHijri, useHijriCorrection } from "../../hooks/useHijriCorrection";
import { useGetIdentity } from "@refinedev/core";

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

const HARI_LABEL: Record<number, { short: string; full: string }> = {
    1: { short: 'Sab', full: 'Sabtu' },
    2: { short: 'Ahd', full: 'Ahad' },
    3: { short: 'Sen', full: 'Senin' },
    4: { short: 'Sel', full: 'Selasa' },
    5: { short: 'Rab', full: 'Rabu' },
};

const getWeekDates = (tahun: number, bulan: number, mingguKe: number): { tanggal: string; hariKe: number; sesiKe: number }[] => {
    const gregorian = hijriConverter.toGregorian(tahun, bulan, 1);
    const firstOfMonth = new Date(gregorian.gy, gregorian.gm - 1, gregorian.gd);
    const firstDayOfWeek = firstOfMonth.getDay();
    const daysSinceLastSaturday = (firstDayOfWeek - 6 + 7) % 7;
    const backwardSat = new Date(firstOfMonth);
    backwardSat.setDate(firstOfMonth.getDate() - daysSinceLastSaturday);
    let inMonth = 0;
    for (let i = 0; i < 5; i++) {
        const d = new Date(backwardSat);
        d.setDate(backwardSat.getDate() + i);
        const h = hijriConverter.toHijri(d.getFullYear(), d.getMonth() + 1, d.getDate());
        if (h.hy === tahun && h.hm === bulan) inMonth++;
    }
    const weekStarts = new Date(firstOfMonth);
    if (inMonth <= 1) {
        const daysUntilNextSaturday = (6 - firstDayOfWeek + 7) % 7;
        weekStarts.setDate(firstOfMonth.getDate() + daysUntilNextSaturday);
    } else {
        weekStarts.setDate(firstOfMonth.getDate() - daysSinceLastSaturday);
    }
    const saturday = new Date(weekStarts);
    saturday.setDate(weekStarts.getDate() + (mingguKe - 1) * 7);
    const result: { tanggal: string; hariKe: number; sesiKe: number }[] = [];
    for (let i = 0; i < 5; i++) {
        const d = new Date(saturday);
        d.setDate(saturday.getDate() + i);
        const tanggal = dayjs(d).format("YYYY-MM-DD");
        result.push({ tanggal, hariKe: i + 1, sesiKe: 1 });
    }
    return result;
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
    const [statsViewMode, setStatsViewMode] = useState<string>("mingguan");
    const [rawData, setRawData] = useState<{
        absensi: any[]; hafalan: any[]; murojaah: any[]; santri: any[];
    }>({ absensi: [], hafalan: [], murojaah: [], santri: [] });

    // ── Statistik Mingguan ──
    const [statsData, setStatsData] = useState<{
        periodLabels: { key: string; label: string }[];
        periodStats: Record<string, Record<string, number>>;
        kegiatanStats: { kegiatan: string; label: string; hadir: number; total: number }[];
        totalSesi: number;
        totalAbsensi: number;
        totalHadir: number;
    }>({ periodLabels: [], periodStats: {}, kegiatanStats: [], totalSesi: 0, totalAbsensi: 0, totalHadir: 0 });
    const [statsLoading, setStatsLoading] = useState(false);

    // ── Statistik Ngaji ──
    const [ngajiStatsData, setNgajiStatsData] = useState<{
        periodLabels: { key: string; label: string }[];
        periodStats: Record<string, Record<string, number>>;
        totalSantri: number;
        totalSesi: number;
        totalAbsensi: number;
        totalHadir: number;
    }>({ periodLabels: [], periodStats: {}, totalSantri: 0, totalSesi: 0, totalAbsensi: 0, totalHadir: 0 });
    const [ngajiStatsLoading, setNgajiStatsLoading] = useState(false);
    const [ngajiStatsTahun, setNgajiStatsTahun] = useState<number>(getCurrentHijri().hy);
    const [ngajiStatsBulan, setNgajiStatsBulan] = useState<number>(getCurrentHijri().hm);

    // ── Export modals state ──
    const [expMingguanOpen, setExpMingguanOpen] = useState(false);
    const [expMingguanLoading, setExpMingguanLoading] = useState(false);
    const [expMingguanTahun, setExpMingguanTahun] = useState<number>(1448);
    const [expMingguanBulan, setExpMingguanBulan] = useState<number>(1);

    const [expSantriOpen, setExpSantriOpen] = useState(false);
    const [expSantriLoading, setExpSantriLoading] = useState(false);
    const [expSantriNis, setExpSantriNis] = useState<string | null>(null);
    const [expSantriSetoran, setExpSantriSetoran] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>([dayjs().startOf("month"), dayjs()]);
    const [expSantriMurojaah, setExpSantriMurojaah] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>([dayjs().startOf("month"), dayjs()]);
    const [expSantriTahun, setExpSantriTahun] = useState<number>(1448);
    const [expSantriBulan, setExpSantriBulan] = useState<number>(1);
    const [expSantriNgajiTahun, setExpSantriNgajiTahun] = useState<number>(getCurrentHijri().hy);
    const [expSantriNgajiBulan, setExpSantriNgajiBulan] = useState<number>(getCurrentHijri().hm);
    const [santriListExport, setSantriListExport] = useState<any[]>([]);

    // ── Ngaji export modal state ──
    const { data: identity } = useGetIdentity<any>();
    useHijriCorrection();
    const [expNgajiOpen, setExpNgajiOpen] = useState(false);
    const [expNgajiWeeks, setExpNgajiWeeks] = useState<number[]>([1]);
    const [expNgajiLoading, setExpNgajiLoading] = useState(false);
    const [expNgajiTahun, setExpNgajiTahun] = useState(getCurrentHijri().hy);
    const [expNgajiBulan, setExpNgajiBulan] = useState(getCurrentHijri().hm);

    // ── Load santri list for export ──
    useEffect(() => {
        supabaseClient.from("santri")
            .select("nis, nama")
            .eq("jurusan", "TAHFIDZ")
            .eq("status_santri", "AKTIF")
            .order("nama")
            .then(({ data }) => setSantriListExport(data || []));
    }, []);

    const fetchMingguanStats = async () => {
        setStatsLoading(true);
        try {
            const start = dateRange[0].format("YYYY-MM-DD");
            const end = dateRange[1].format("YYYY-MM-DD");

            const { data: sesiList } = await supabaseClient
                .from("mingguan_sesi")
                .select("id, kegiatan_id, tanggal, bulan_hijriah, minggu_ke, tahun_hijriah")
                .gte("tanggal", start)
                .lte("tanggal", end)
                .order("tanggal", { ascending: true });

            if (!sesiList || sesiList.length === 0) {
                setStatsData({ periodLabels: [], periodStats: {}, kegiatanStats: [], totalSesi: 0, totalAbsensi: 0, totalHadir: 0 });
                setStatsLoading(false);
                return;
            }

            const sesiIds = sesiList.map(s => s.id);
            const { data: absensiData } = await supabaseClient
                .from("mingguan_absensi")
                .select("sesi_id, status")
                .in("sesi_id", sesiIds);

            const absensiList = absensiData || [];

            // Group by period (week or month)
            const byPeriod: Record<string, { sesiIds: Set<string>; label: string }> = {};
            const kegiatanTotals: Record<string, { hadir: number; total: number }> = {};

            sesiList.forEach((sesi: any) => {
                const date = dayjs(sesi.tanggal);
                const periodKey = statsViewMode === "mingguan"
                    ? `${sesi.tahun_hijriah}-${sesi.bulan_hijriah}-M${sesi.minggu_ke}`
                    : date.format("YYYY-MM");
                const periodLabel = statsViewMode === "mingguan"
                    ? `Minggu ke-${sesi.minggu_ke}`
                    : date.format("MMM YYYY");

                if (!byPeriod[periodKey]) byPeriod[periodKey] = { sesiIds: new Set(), label: periodLabel };
                byPeriod[periodKey].sesiIds.add(sesi.id);

                if (!kegiatanTotals[sesi.kegiatan_id]) kegiatanTotals[sesi.kegiatan_id] = { hadir: 0, total: 0 };
                kegiatanTotals[sesi.kegiatan_id].total++;
            });

            absensiList.forEach((a: any) => {
                const sesi = sesiList.find(s => s.id === a.sesi_id);
                if (!sesi) return;
                if (a.status === 'HADIR' && kegiatanTotals[sesi.kegiatan_id]) {
                    kegiatanTotals[sesi.kegiatan_id].hadir++;
                }
            });

            const periodStats: Record<string, Record<string, number>> = {};
            absensiList.forEach((a: any) => {
                const sesi = sesiList.find(s => s.id === a.sesi_id);
                if (!sesi) return;
                const date = dayjs(sesi.tanggal);
                const periodKey = statsViewMode === "mingguan"
                    ? `${sesi.tahun_hijriah}-${sesi.bulan_hijriah}-M${sesi.minggu_ke}`
                    : date.format("YYYY-MM");

                if (!periodStats[periodKey]) {
                    periodStats[periodKey] = { HADIR: 0, SAKIT: 0, IZIN: 0, SEKOLAH: 0, GHAIB: 0, PULANG: 0, total: 0 };
                }
                periodStats[periodKey][a.status] = (periodStats[periodKey][a.status] || 0) + 1;
                periodStats[periodKey].total++;
            });

            const sortedLabels = Object.keys(byPeriod).sort().map(k => ({ key: k, label: byPeriod[k].label }));
            const totalSesi = sesiList.length;
            const totalAbsensi = absensiList.length;
            const totalHadir = absensiList.filter(a => a.status === 'HADIR').length;

            const kegiatanStats = Object.entries(KEGIATAN_INFO).map(([k, info]) => {
                const d = kegiatanTotals[k] || { hadir: 0, total: 0 };
                return { kegiatan: k, label: info.label, hadir: d.hadir, total: d.total };
            }).filter(d => d.total > 0);

            setStatsData({ periodLabels: sortedLabels, periodStats, kegiatanStats, totalSesi, totalAbsensi, totalHadir });
        } catch {
            // silent
        } finally {
            setStatsLoading(false);
        }
    };

    useEffect(() => { fetchMingguanStats(); }, [dateRange, statsViewMode]);

    const fetchNgajiStats = async () => {
        setNgajiStatsLoading(true);
        try {
            const allWeeks = [1, 2, 3, 4, 5].map(mg => getWeekDates(ngajiStatsTahun, ngajiStatsBulan, mg));
            const allDates = [...new Set(allWeeks.flatMap(w => w.map(d => d.tanggal)))].sort();
            if (allDates.length === 0) {
                setNgajiStatsData({ periodLabels: [], periodStats: {}, totalSantri: 0, totalSesi: 0, totalAbsensi: 0, totalHadir: 0 });
                setNgajiStatsLoading(false);
                return;
            }

            const { data: sesiList } = await supabaseClient
                .from("ngaji_sesi")
                .select("id, tanggal, hari_ke, sesi_ke, minggu_ke, bulan_hijriah, tahun_hijriah")
                .eq("kegiatan_id", "NGAJI")
                .in("tanggal", allDates)
                .order("tanggal", { ascending: true });

            if (!sesiList || sesiList.length === 0) {
                setNgajiStatsData({ periodLabels: [], periodStats: {}, totalSantri: 0, totalSesi: 0, totalAbsensi: 0, totalHadir: 0 });
                setNgajiStatsLoading(false);
                return;
            }

            const existingDates = [...new Set(sesiList.map((s: any) => s.tanggal))].sort();
            const orClauses = existingDates.map(t => {
                const h = resolveHijri(t);
                return `and(tahun_hijriah.eq.${h.hy},bulan_hijriah_number.eq.${h.hm},hari_hijriah.eq.${h.hd},sesi_ke.eq.1)`;
            });

            const { data: absensiData } = await supabaseClient
                .from("ngaji_absensi")
                .select("tahun_hijriah, bulan_hijriah_number, hari_hijriah, sesi_ke, santri_nis, status")
                .or(orClauses.join(','));

            const absensiList = absensiData || [];
            const santriSet = new Set<string>();
            absensiList.forEach((a: any) => santriSet.add(a.santri_nis));

            const byPeriod: Record<string, { dates: Set<string>; label: string }> = {};
            sesiList.forEach((sesi: any) => {
                const periodKey = `${sesi.tahun_hijriah}-${sesi.bulan_hijriah}-M${sesi.minggu_ke}`;
                if (!byPeriod[periodKey]) byPeriod[periodKey] = { dates: new Set(), label: `Minggu ke-${sesi.minggu_ke}` };
                byPeriod[periodKey].dates.add(sesi.tanggal);
            });

            const periodStats: Record<string, Record<string, number>> = {};
            absensiList.forEach((a: any) => {
                const h = { hy: a.tahun_hijriah, hm: a.bulan_hijriah_number, hd: a.hari_hijriah };
                const matchingSesi = sesiList.find((s: any) => {
                    const sh = resolveHijri(s.tanggal);
                    return sh.hy === h.hy && sh.hm === h.hm && sh.hd === h.hd;
                });
                if (!matchingSesi) return;
                const periodKey = `${matchingSesi.tahun_hijriah}-${matchingSesi.bulan_hijriah}-M${matchingSesi.minggu_ke}`;

                if (!periodStats[periodKey]) {
                    periodStats[periodKey] = { HADIR: 0, SAKIT: 0, IZIN: 0, PULANG: 0, GHAIB: 0, total: 0 };
                }
                periodStats[periodKey][a.status] = (periodStats[periodKey][a.status] || 0) + 1;
                periodStats[periodKey].total++;
            });

            const sortedLabels = Object.keys(byPeriod).sort().map(k => ({ key: k, label: byPeriod[k].label }));
            const totalSesi = sesiList.length;
            const totalAbsensi = absensiList.length;
            const totalHadir = absensiList.filter(a => a.status === 'HADIR').length;
            const totalSantri = santriSet.size;

            setNgajiStatsData({ periodLabels: sortedLabels, periodStats, totalSantri, totalSesi, totalAbsensi, totalHadir });
        } finally {
            setNgajiStatsLoading(false);
        }
    };

    useEffect(() => { fetchNgajiStats(); }, [ngajiStatsTahun, ngajiStatsBulan]);

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

        const perSantriArr = Object.values(perSantri);
        const totalLancar = perSantriArr.reduce((sum, s) => sum + s.lancar, 0);
        const totalMengulang = perSantriArr.reduce((sum, s) => sum + s.mengulang, 0);
        const persentaseHadir = absensi.length > 0 ? Math.round((totalHadir / absensi.length) * 100) : 0;
        const rataSetoran = santri.length > 0 ? parseFloat((totalSetoran / santri.length).toFixed(1)) : 0;

        return {
            totalAbsensi: absensi.length,
            totalHadir,
            totalSetoran,
            totalZiyadah: hafalan.length,
            totalMurojaah: murojaah.length,
            totalLancar,
            totalMengulang,
            persentaseHadir,
            rataSetoran,
            santriCount: santri.length,
            perSantri: perSantriArr,
            dailyChart,
            pieData,
            statusCount,
        };
    }, [rawData]);

    // ── Export ──
    const [exportLoading, setExportLoading] = useState(false);

    const STATUS_CODE: Record<string, string> = {
        HADIR: 'H', SAKIT: 'S', IZIN: 'I', SEKOLAH: 'Sk', GHAIB: 'GH', PULANG: 'P',
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
    const KEGIATAN_INFO: Record<string, { label: string; icon: string }> = {
        HAFALAN:    { label: 'Hafalan',    icon: '📖' },
        ISTIGHOSAH: { label: 'Istighosah', icon: '🤲' },
        NGAOS_AANG: { label: 'Ngaos Aang', icon: '📚' },
        TILAWAH:    { label: 'Tilawah/Kaligrafi', icon: '🕌' },
        TAWASUL:    { label: 'Tawasul',    icon: '🙏' },
        MHQ:        { label: 'MHQ',        icon: '🏆' },
        MUHADHOROH: { label: 'Muhadhoroh', icon: '🎤' },
    };

    const DAYS_INDO = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    const STATUS_FILLS: Record<string, string> = {
        HADIR: 'FFD1FAE5', SAKIT: 'FFFEF3C7', IZIN: 'FFDBEAFE',
        SEKOLAH: 'FFE0E7FF', GHAIB: 'FFFEE2E2', PULANG: 'FFFFEDD5',
    };

    const handleExportMingguan = async () => {
        setExpMingguanLoading(true);
        try {
            const bulanLabel = HIJRI_MONTHS[expMingguanBulan - 1];

            const { data: santri, error: santriErr } = await supabaseClient
                .from("santri")
                .select("nis, nama, kelas, total_hafalan")
                .eq("jurusan", "TAHFIDZ")
                .eq("status_santri", "AKTIF")
                .order("kelas", { ascending: true })
                .order("nama", { ascending: true });
            if (santriErr) { message.error("Gagal load santri: " + santriErr.message); setExpMingguanLoading(false); return; }
            const santriList = santri || [];
            console.log("[ExportMingguan] Santri count:", santriList.length, "NIS:", santriList.map((s: any) => s.nis));

            // Fetch absensi WITH joined kegiatan info — no UUID dependency
            const { data: joinData, error } = await supabaseClient
                .from("mingguan_absensi")
                .select("sesi_id, santri_nis, status, nilai_hafalan, mingguan_sesi!inner(kegiatan_id, minggu_ke)")
                .eq("mingguan_sesi.bulan_hijriah", bulanLabel)
                .eq("mingguan_sesi.tahun_hijriah", expMingguanTahun);

            console.log("[ExportMingguan] Join query error:", error);
            console.log("[ExportMingguan] Join data raw:", joinData?.length, "records");
            if (joinData && joinData.length > 0) {
                console.log("[ExportMingguan] First record:", JSON.stringify(joinData[0]));
                console.log("[ExportMingguan] mingguan_sesi key on first:", (joinData[0] as any).mingguan_sesi);
            }

            if (error) {
                message.error("Gagal mengambil data absensi: " + error.message);
                setExpMingguanLoading(false);
                return;
            }

            // Build index: absByKey[minggu_ke][kegiatan_id][santri_nis] = { status, nilai_hafalan }
            const absByKey: Record<string, Record<string, Record<string, { status: string; nilai_hafalan?: number }>>> = {};
            (joinData || []).forEach((a: any) => {
                const sesiInfo = a.mingguan_sesi;
                const wk = sesiInfo?.minggu_ke;
                const kid = sesiInfo?.kegiatan_id;
                if (!wk || !kid || wk > 4) return;
                if (!absByKey[wk]) absByKey[wk] = {};
                if (!absByKey[wk][kid]) absByKey[wk][kid] = {};
                absByKey[wk][kid][a.santri_nis] = { status: a.status, nilai_hafalan: a.nilai_hafalan };
            });
            console.log("[ExportMingguan] absByKey built, weeks:", Object.keys(absByKey));
            if (Object.keys(absByKey).length > 0) {
                const sampleWk = Object.keys(absByKey)[0];
                console.log(`[ExportMingguan] Week ${sampleWk} keys:`, Object.keys(absByKey[sampleWk]));
                const sampleKid = Object.keys(absByKey[sampleWk])[0];
                console.log(`[ExportMingguan] ${sampleWk}/${sampleKid} NIS:`, Object.keys(absByKey[sampleWk][sampleKid]));
                console.log(`[ExportMingguan] Sample abs:`, absByKey[sampleWk][sampleKid][Object.keys(absByKey[sampleWk][sampleKid])[0]]);
            }

            const KEGIATAN_MINGGUAN: Record<number, string[]> = {
                1: ['ISTIGHOSAH', 'NGAOS_AANG', 'TILAWAH', 'TAWASUL'],
                2: ['NGAOS_AANG', 'TILAWAH', 'TAWASUL', 'MUHADHOROH'],
                3: ['NGAOS_AANG', 'TILAWAH', 'TAWASUL', 'MHQ'],
                4: ['NGAOS_AANG', 'TILAWAH', 'TAWASUL', 'MHQ'],
            };

            // Build ordered column list from KEGIATAN_MINGGUAN
            const orderedCols: { kegiatan_id: string; minggu_ke: number }[] = [];
            for (let wk = 1; wk <= 4; wk++) {
                const activities = KEGIATAN_MINGGUAN[wk];
                if (!activities) continue;
                for (const kid of activities) {
                    orderedCols.push({ kegiatan_id: kid, minggu_ke: wk });
                }
            }

            // Debug info
            const totalAbsensi = Object.values(absByKey).reduce((sum, wk) =>
                sum + Object.values(wk).reduce((s2: number, kid) => s2 + Object.keys(kid).length, 0), 0);
            console.log("[ExportMingguan] Total absensi records indexed:", totalAbsensi);
            if (totalAbsensi === 0) {
                message.warning(`Tidak ada data absensi untuk ${bulanLabel} ${expMingguanTahun} H. Cek isi tabel mingguan_absensi.`);
                setExpMingguanLoading(false);
                return;
            }

            const wb = new ExcelJS.Workbook();
            const ws = wb.addWorksheet("Absensi Mingguan");

            const totalCols = 4 + orderedCols.length;
            const title = `LAPORAN ABSENSI MINGGUAN TAHFIDZ — ${bulanLabel} ${expMingguanTahun} H`;
            ws.mergeCells(`A1:${colLetter(totalCols)}1`);
            ws.getCell("A1").value = title;
            ws.getCell("A1").font = { size: 14, bold: true, color: { argb: "FFFFFFFF" } };
            ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC9A84C" } };
            ws.getCell("A1").alignment = { horizontal: "center" };
            ws.getRow(1).height = 26;

            const WEEK_COLORS = ["FF7C3AED", "FF2563EB", "FF16A34A", "FFD97706", "FFDC2626"];

            // ── Row 3: Week group headers ──
            ws.mergeCells("A3:D3");
            ws.getCell("A3").value = "DATA SANTRI";
            ws.getCell("A3").font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
            ws.getCell("A3").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF374151" } };
            ws.getCell("A3").alignment = { horizontal: "center", vertical: "middle" };

            let colIdx = 5;
            for (let wk = 1; wk <= 4; wk++) {
                const activities = KEGIATAN_MINGGUAN[wk] || [];
                if (activities.length === 0) continue;
                const startCol = colLetter(colIdx);
                const endCol = colLetter(colIdx + activities.length - 1);
                if (activities.length > 1) {
                    ws.mergeCells(`${startCol}3:${endCol}3`);
                }
                ws.getCell(`${startCol}3`).value = `MINGGU KE-${wk}`;
                ws.getCell(`${startCol}3`).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
                ws.getCell(`${startCol}3`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: WEEK_COLORS[(wk - 1) % WEEK_COLORS.length] } };
                ws.getCell(`${startCol}3`).alignment = { horizontal: "center", vertical: "middle" };
                colIdx += activities.length;
            }
            ws.getRow(3).height = 22;

            // ── Row 4: Activity sub-headers ──
            ws.columns = [
                { key: "no", width: 5 },
                { key: "nis", width: 13 },
                { key: "nama", width: 24 },
                { key: "kelas", width: 8 },
                ...orderedCols.map((_, i) => ({ key: `col_${i}`, width: 14 })),
            ];

            colIdx = 5;
            orderedCols.forEach((o) => {
                const c = colLetter(colIdx);
                const k = KEGIATAN_INFO[o.kegiatan_id];
                ws.getCell(`${c}4`).value = k?.label || o.kegiatan_id;
                ws.getCell(`${c}4`).font = { bold: true, size: 9, color: { argb: "FF374151" } };
                ws.getCell(`${c}4`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
                ws.getCell(`${c}4`).alignment = { horizontal: "center", vertical: "middle" };
                colIdx++;
            });

            ws.mergeCells(`A4:${colLetter(4)}4`);
            ws.getRow(4).height = 18;

            // ── Data rows ──
            // Log sample lookup for first santri
            if (santriList.length > 0 && orderedCols.length > 0) {
                const firstS = santriList[0];
                const firstO = orderedCols[0];
                const sampleAbs = absByKey[firstO.minggu_ke]?.[firstO.kegiatan_id]?.[firstS.nis];
                console.log(`[ExportMingguan] Lookup test: santri=${firstS.nis}, col=wk${firstO.minggu_ke}/${firstO.kegiatan_id} =>`, sampleAbs);
                console.log(`[ExportMingguan] STATUS_CODE HADIR =>`, STATUS_CODE['HADIR']);
            }
            santriList.forEach((s: any, idx: number) => {
                const row: any = {
                    no: idx + 1, nis: s.nis, nama: s.nama || santriAlias(s.nis), kelas: s.kelas,
                };
                orderedCols.forEach((o, oi) => {
                    const abs = absByKey[o.minggu_ke]?.[o.kegiatan_id]?.[s.nis];
                    row[`col_${oi}`] = STATUS_CODE[abs?.status] || abs?.status || '-';
                });
                ws.addRow(row);

                const dataRow = ws.getRow(ws.rowCount);
                orderedCols.forEach((o, oi) => {
                    const abs = absByKey[o.minggu_ke]?.[o.kegiatan_id]?.[s.nis];
                    if (abs?.status) {
                        const fill = STATUS_FILLS[abs.status];
                        if (fill) dataRow.getCell(5 + oi).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
                    }
                });
            });

            ws.autoFilter = { from: "A4", to: `${colLetter(totalCols)}4` };
            ws.views = [{ state: "frozen", ySplit: 4 }];

            const buffer = await wb.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `Absensi_Mingguan_${bulanLabel}_${expMingguanTahun}H.xlsx`);
            message.success(`Export mingguan berhasil (${totalAbsensi} record absensi)`);
            setExpMingguanOpen(false);
        } catch (err: any) {
            message.error("Gagal export mingguan: " + err.message);
        } finally {
            setExpMingguanLoading(false);
        }
    };

    const handleExportSantri = async () => {
        if (!expSantriNis) { message.error("Pilih santri terlebih dahulu"); return; }
        setExpSantriLoading(true);
        try {
            const santriData = santriListExport.find(s => s.nis === expSantriNis);
            const namaSantri = santriData?.nama || santriAlias(expSantriNis);
            const wb = new ExcelJS.Workbook();

            const B = { bold: true };
            const TB = {
                top: { style: 'thin' as const },
                left: { style: 'thin' as const },
                bottom: { style: 'thin' as const },
                right: { style: 'thin' as const },
            };

            // ── Sheet 1: Setoran Hafalan (Ziyadah) — Pivot PAGI/SIANG ──
            const ws1 = wb.addWorksheet("Setoran Hafalan");
            const setoranStart = expSantriSetoran?.[0].format("YYYY-MM-DD") || '';
            const setoranEnd = expSantriSetoran?.[1].format("YYYY-MM-DD") || '';

            const [absensiRes, profileRes] = await Promise.all([
                supabaseClient
                    .from("tahfidz_absensi")
                    .select(`id, santri_nis, status, setoran, penyimak_id,
                        tahfidz_sesi!inner(tanggal, sesi),
                        hafalan_tahfidz(surat, ayat_awal, ayat_akhir, juz, predikat, status_setoran)`)
                    .gte("tahfidz_sesi.tanggal", setoranStart)
                    .lte("tahfidz_sesi.tanggal", setoranEnd)
                    .eq("tahfidz_sesi.kegiatan_id", "ZIYADAH")
                    .eq("santri_nis", expSantriNis),
                supabaseClient.from("profiles").select("id, full_name"),
            ]);

            const absensiList = absensiRes.data || [];
            const profileList = profileRes.data || [];
            const penyimakMap = new Map(profileList.map((p: any) => [p.id, p.full_name]));

            const lookup = new Map<string, { status: string; setoranLabel: string; materi: string; penyimak: string; predikat: string }>();
            const allDates1 = new Set<string>();
            const nis = expSantriNis;

            for (const a of absensiList) {
                const sesiData = a.tahfidz_sesi as any;
                const tgl = sesiData.tanggal;
                const sesi = sesiData.sesi;
                const key = `${tgl}::${sesi}::${nis}`;
                allDates1.add(tgl);
                const h: any = a.hafalan_tahfidz;
                const hasSetoran = !!(a.setoran && h);
                const materi = h ? (() => {
                    const parts: string[] = [];
                    if (h.juz) parts.push(`Juz ${h.juz}`);
                    if (h.surat) {
                        const ayat = h.ayat_awal && h.ayat_akhir ? ` (${h.ayat_awal}-${h.ayat_akhir})` : '';
                        parts.push(`${h.surat}${ayat}`);
                    }
                    return parts.join(' · ');
                })() : '';
                const setoranLabel = a.status === 'HADIR' ? (hasSetoran ? 'SETOR' : 'TIDAK SETOR') : '-';
                const penyimak = a.penyimak_id ? (penyimakMap.get(a.penyimak_id) || '') : '';
                const predikat = (h as any)?.predikat || '-';
                lookup.set(key, { status: a.status, setoranLabel, materi, penyimak, predikat });
            }

            const dates = [...allDates1].sort();
            const totalCols1 = 16;

            const applySesiHeaderStyle = (cell: any, fillColor: string) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            };

            // ── Title ──
            ws1.mergeCells(`A1:${colLetter(totalCols1)}1`);
            const t = ws1.getCell("A1");
            t.value = `LAPORAN SETORAN ZIYADAH — ${namaSantri} — ${expSantriSetoran![0].format("DD MMM")} s/d ${expSantriSetoran![1].format("DD MMM YYYY")} M  /  ${formatHijri(expSantriSetoran![0].toDate())} s/d ${formatHijri(expSantriSetoran![1].toDate())} H`;
            t.font = { size: 13, bold: true, color: { argb: "FFFFFFFF" } };
            t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF047857" } };
            t.alignment = { horizontal: "center" };
            ws1.getRow(1).height = 22;

            // ── Header group row (row 3) ──
            ws1.mergeCells("A3:F3");
            ws1.getCell("A3").value = "DATA SANTRI";
            applySesiHeaderStyle(ws1.getCell("A3"), "FF374151");
            ws1.mergeCells("G3:K3");
            ws1.getCell("G3").value = "SESI PAGI";
            applySesiHeaderStyle(ws1.getCell("G3"), "FFD97706");
            ws1.mergeCells("L3:P3");
            ws1.getCell("L3").value = "SESI SIANG";
            applySesiHeaderStyle(ws1.getCell("L3"), "FF2563EB");

            // ── Column headers (row 4) ──
            ws1.getRow(4).values = [
                "NO", "Hari, Tgl (M)", "Tanggal (H)", "NIS", "Nama Santri", "Kelas",
                "Status", "Setoran", "Materi", "Predikat", "Penyimak",
                "Status", "Setoran", "Materi", "Predikat", "Penyimak",
            ];
            ws1.getRow(4).font = { bold: true };
            ws1.getRow(4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };

            // ── Column widths ──
            ws1.columns = [
                { key: "no", width: 5 },
                { key: "tglM", width: 22 },
                { key: "tglH", width: 18 },
                { key: "nis", width: 13 },
                { key: "nama", width: 24 },
                { key: "kelas", width: 8 },
                { key: "pagi_status", width: 11 },
                { key: "pagi_setoran", width: 11 },
                { key: "pagi_materi", width: 26 },
                { key: "pagi_predikat", width: 13 },
                { key: "pagi_penyimak", width: 16 },
                { key: "siang_status", width: 11 },
                { key: "siang_setoran", width: 11 },
                { key: "siang_materi", width: 26 },
                { key: "siang_predikat", width: 13 },
                { key: "siang_penyimak", width: 16 },
            ];

            // ── Data rows: one per tanggal ──
            const sRow = santriListExport.find(s => s.nis === expSantriNis) || { nama: namaSantri, kelas: '-' };
            const STATUS_FILLS_ZY: Record<string, string> = {
                HADIR: 'FFD1FAE5', SAKIT: 'FFFEF3C7', GHAIB: 'FFFEE2E2',
                SEKOLAH: 'FFDBEAFE', PULANG: 'FFFFEDD5',
            };

            dates.forEach((tgl, idx) => {
                const pagi = lookup.get(`${tgl}::PAGI::${nis}`);
                const siang = lookup.get(`${tgl}::SIANG::${nis}`);
                ws1.addRow({
                    no: idx + 1,
                    tglM: `${DAYS_INDO[new Date(tgl).getDay()]}, ${formatMasehi(tgl)}`,
                    tglH: formatHijri(new Date(tgl + "T00:00:00")),
                    nis: expSantriNis,
                    nama: namaSantri,
                    kelas: (sRow as any).kelas || '-',
                    pagi_status: pagi?.status || "-",
                    pagi_setoran: pagi?.setoranLabel || "-",
                    pagi_materi: pagi?.materi || "-",
                    pagi_predikat: pagi?.predikat || "-",
                    pagi_penyimak: pagi?.penyimak || "-",
                    siang_status: siang?.status || "-",
                    siang_setoran: siang?.setoranLabel || "-",
                    siang_materi: siang?.materi || "-",
                    siang_predikat: siang?.predikat || "-",
                    siang_penyimak: siang?.penyimak || "-",
                });
                const row = ws1.getRow(ws1.rowCount);
                const pFill = pagi?.status ? STATUS_FILLS_ZY[pagi.status] : undefined;
                if (pFill) row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pFill } };
                const sFill = siang?.status ? STATUS_FILLS_ZY[siang.status] : undefined;
                if (sFill) row.getCell(12).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sFill } };
            });

            // ── AutoFilter & frozen pane ──
            ws1.autoFilter = { from: "A4", to: `${colLetter(totalCols1)}4` };
            ws1.views = [{ state: "frozen", ySplit: 4 }];

            // ── Sheet 2: Murojaah — Pivot PAGI/SIANG ──
            const ws2 = wb.addWorksheet("Murojaah");
            const muroStart = expSantriMurojaah?.[0].format("YYYY-MM-DD") || '';
            const muroEnd = expSantriMurojaah?.[1].format("YYYY-MM-DD") || '';

            const [sesiRes2, detailRes2, profileRes2] = await Promise.all([
                supabaseClient
                    .from("tahfidz_sesi")
                    .select("id, tanggal, sesi, tahfidz_absensi!inner(santri_nis, status, penyimak_id, penyimak:profiles!penyimak_id(full_name))")
                    .eq("kegiatan_id", "MUROJAAH")
                    .gte("tanggal", muroStart)
                    .lte("tanggal", muroEnd)
                    .eq("tahfidz_absensi.santri_nis", expSantriNis),
                supabaseClient
                    .from("murojaah_tahfidz")
                    .select("santri_nis, tanggal, jenis_murojaah, juz, surat, ayat_awal, ayat_akhir, halaman_awal, halaman_akhir, status_setoran, predikat")
                    .eq("santri_nis", expSantriNis)
                    .gte("tanggal", muroStart)
                    .lte("tanggal", muroEnd),
                supabaseClient.from("profiles").select("id, full_name"),
            ]);

            const profileMap2 = new Map((profileRes2.data || []).map((p: any) => [p.id, p.full_name]));

            const formatCakupan = (d: any): string => {
                if (!d) return "-";
                if (d.surat) {
                    const ayat = d.ayat_awal && d.ayat_akhir ? ` : ${d.ayat_awal}-${d.ayat_akhir}` : "";
                    return `QS. ${d.surat}${ayat}`;
                }
                if (d.halaman_awal) {
                    const akhir = d.halaman_akhir ? `-${d.halaman_akhir}` : "";
                    return `Juz ${d.juz ?? "-"} Hal. ${d.halaman_awal}${akhir}`;
                }
                if (d.juz) return `Juz ${d.juz}`;
                return "-";
            };

            const detailMap2: Record<string, any> = {};
            (detailRes2.data || []).forEach((d: any) => {
                const key = `${d.santri_nis}_${dayjs(d.tanggal).format("YYYY-MM-DD")}`;
                detailMap2[key] = d;
            });

            const lookup2 = new Map<string, { status: string; jenis: string; cakupan: string; penyimak: string }>();
            const allDates2 = new Set<string>();
            const nis2 = expSantriNis;

            (sesiRes2.data || []).forEach((sesi: any) => {
                const tgl = dayjs(sesi.tanggal).format("YYYY-MM-DD");
                allDates2.add(tgl);
                (sesi.tahfidz_absensi || []).forEach((a: any) => {
                    const key = `${tgl}::${sesi.sesi}::${nis2}`;
                    const detail = detailMap2[`${nis2}_${tgl}`];
                    lookup2.set(key, {
                        status: a.status || "-",
                        jenis: detail?.jenis_murojaah || "-",
                        cakupan: formatCakupan(detail),
                        penyimak: a.penyimak?.full_name || profileMap2.get(a.penyimak_id) || "-",
                    });
                });
            });

            const dates2 = [...allDates2].sort();
            const totalCols2 = 14;

            const applySesiHeaderStyle2 = (cell: any, fillColor: string) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            };

            // ── Title ──
            ws2.mergeCells(`A1:${colLetter(totalCols2)}1`);
            ws2.getCell("A1").value = `LAPORAN MUROJAAH TAHFIDZ — ${namaSantri} — ${expSantriMurojaah![0].format("DD MMM")} s/d ${expSantriMurojaah![1].format("DD MMM YYYY")} M  /  ${formatHijri(expSantriMurojaah![0].toDate())} s/d ${formatHijri(expSantriMurojaah![1].toDate())} H`;
            ws2.getCell("A1").font = { size: 13, bold: true, color: { argb: "FFFFFFFF" } };
            ws2.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7E22CE" } };
            ws2.getCell("A1").alignment = { horizontal: "center" };
            ws2.getRow(1).height = 22;

            // ── Header group row (row 3) ──
            ws2.mergeCells("A3:F3");
            ws2.getCell("A3").value = "DATA SANTRI";
            applySesiHeaderStyle2(ws2.getCell("A3"), "FF374151");
            ws2.mergeCells("G3:J3");
            ws2.getCell("G3").value = "SESI PAGI";
            applySesiHeaderStyle2(ws2.getCell("G3"), "FFD97706");
            ws2.mergeCells("K3:N3");
            ws2.getCell("K3").value = "SESI SIANG";
            applySesiHeaderStyle2(ws2.getCell("K3"), "FF2563EB");

            // ── Column headers (row 4) ──
            ws2.getRow(4).values = [
                "NO", "Hari, Tgl (M)", "Tanggal (H)", "NIS", "Nama Santri", "Kelas",
                "Status", "Jenis", "Cakupan", "Penyimak",
                "Status", "Jenis", "Cakupan", "Penyimak",
            ];
            ws2.getRow(4).font = { bold: true };
            ws2.getRow(4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };

            // ── Column widths ──
            ws2.columns = [
                { key: "no", width: 5 },
                { key: "tglM", width: 22 },
                { key: "tglH", width: 18 },
                { key: "nis", width: 13 },
                { key: "nama", width: 24 },
                { key: "kelas", width: 8 },
                { key: "pagi_status", width: 11 },
                { key: "pagi_jenis", width: 11 },
                { key: "pagi_cakupan", width: 26 },
                { key: "pagi_penyimak", width: 16 },
                { key: "siang_status", width: 11 },
                { key: "siang_jenis", width: 11 },
                { key: "siang_cakupan", width: 26 },
                { key: "siang_penyimak", width: 16 },
            ];

            const sRow2 = santriListExport.find(s => s.nis === expSantriNis) || { nama: namaSantri, kelas: '-' };
            const STATUS_FILLS_MR: Record<string, string> = {
                HADIR: 'FFD1FAE5', SAKIT: 'FFFEF3C7', GHAIB: 'FFFEE2E2',
                SEKOLAH: 'FFDBEAFE', PULANG: 'FFFFEDD5',
            };

            dates2.forEach((tgl, idx) => {
                const pagi = lookup2.get(`${tgl}::PAGI::${nis2}`);
                const siang = lookup2.get(`${tgl}::SIANG::${nis2}`);
                ws2.addRow({
                    no: idx + 1,
                    tglM: `${DAYS_INDO[new Date(tgl).getDay()]}, ${formatMasehi(tgl)}`,
                    tglH: formatHijri(new Date(tgl + "T00:00:00")),
                    nis: expSantriNis,
                    nama: namaSantri,
                    kelas: (sRow2 as any).kelas || '-',
                    pagi_status: pagi?.status || "-",
                    pagi_jenis: pagi?.jenis || "-",
                    pagi_cakupan: pagi?.cakupan || "-",
                    pagi_penyimak: pagi?.penyimak || "-",
                    siang_status: siang?.status || "-",
                    siang_jenis: siang?.jenis || "-",
                    siang_cakupan: siang?.cakupan || "-",
                    siang_penyimak: siang?.penyimak || "-",
                });
                const row = ws2.getRow(ws2.rowCount);
                const pFill = pagi?.status ? STATUS_FILLS_MR[pagi.status] : undefined;
                if (pFill) row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pFill } };
                const sFill = siang?.status ? STATUS_FILLS_MR[siang.status] : undefined;
                if (sFill) row.getCell(11).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sFill } };
            });

            // ── AutoFilter & frozen pane ──
            ws2.autoFilter = { from: "A4", to: `${colLetter(totalCols2)}4` };
            ws2.views = [{ state: "frozen", ySplit: 4 }];

            // ── Sheet 3: Absensi Mingguan ──
            const ws3 = wb.addWorksheet("Mingguan");
            const bulanLabel = HIJRI_MONTHS[expSantriBulan - 1];

            const KEGIATAN_MINGGUAN: Record<number, string[]> = {
                1: ['ISTIGHOSAH', 'NGAOS_AANG', 'TILAWAH', 'TAWASUL'],
                2: ['NGAOS_AANG', 'TILAWAH', 'TAWASUL', 'MUHADHOROH'],
                3: ['NGAOS_AANG', 'TILAWAH', 'TAWASUL', 'MHQ'],
                4: ['NGAOS_AANG', 'TILAWAH', 'TAWASUL', 'MHQ'],
            };

            const { data: joinData } = await supabaseClient
                .from("mingguan_absensi")
                .select("sesi_id, santri_nis, status, nilai_hafalan, mingguan_sesi!inner(kegiatan_id, minggu_ke)")
                .eq("mingguan_sesi.bulan_hijriah", bulanLabel)
                .eq("mingguan_sesi.tahun_hijriah", expSantriTahun)
                .eq("santri_nis", expSantriNis);

            const absByKey: Record<string, Record<string, { status: string; nilai_hafalan?: number }>> = {};
            (joinData || []).forEach((a: any) => {
                const wk = a.mingguan_sesi?.minggu_ke;
                const kid = a.mingguan_sesi?.kegiatan_id;
                if (!wk || !kid || wk > 4) return;
                if (!absByKey[wk]) absByKey[wk] = {};
                absByKey[wk][kid] = { status: a.status, nilai_hafalan: a.nilai_hafalan };
            });

            const orderedCols: { kegiatan_id: string; minggu_ke: number }[] = [];
            for (let wk = 1; wk <= 4; wk++) {
                const activities = KEGIATAN_MINGGUAN[wk];
                if (!activities) continue;
                for (const kid of activities) {
                    orderedCols.push({ kegiatan_id: kid, minggu_ke: wk });
                }
            }

            const totalCols = 1 + orderedCols.length;
            const totalAbsensi = Object.values(absByKey).reduce((sum, wk) => sum + Object.keys(wk).length, 0);

            if (totalAbsensi > 0) {
                const WEEK_COLORS = ["FF7C3AED", "FF2563EB", "FF16A34A", "FFD97706", "FFDC2626"];

                const headerLabel = `ABSENSI MINGGUAN — ${namaSantri} — ${bulanLabel} ${expSantriTahun} H`;
                ws3.mergeCells(`A1:${colLetter(totalCols)}1`);
                ws3.getCell("A1").value = headerLabel;
                ws3.getCell("A1").font = { size: 13, bold: true, color: { argb: "FFFFFFFF" } };
                ws3.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC9A84C" } };
                ws3.getCell("A1").alignment = { horizontal: "center" };

                ws3.columns = [
                    { key: "kegiatan", width: 24 },
                    ...orderedCols.map((_, i) => ({ key: `col_${i}`, width: 16 })),
                ];

                // Row 3: Week headers
                ws3.getCell("A3").value = "KEGIATAN";
                ws3.getCell("A3").font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
                ws3.getCell("A3").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF374151" } };
                ws3.getCell("A3").alignment = { horizontal: "center", vertical: "middle" };

                let colIdx = 2;
                for (let wk = 1; wk <= 4; wk++) {
                    const activities = KEGIATAN_MINGGUAN[wk] || [];
                    if (activities.length === 0) continue;
                    const startCol = colLetter(colIdx);
                    const endCol = colLetter(colIdx + activities.length - 1);
                    if (activities.length > 1) {
                        ws3.mergeCells(`${startCol}3:${endCol}3`);
                    }
                    ws3.getCell(`${startCol}3`).value = `MINGGU KE-${wk}`;
                    ws3.getCell(`${startCol}3`).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
                    ws3.getCell(`${startCol}3`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: WEEK_COLORS[(wk - 1) % WEEK_COLORS.length] } };
                    ws3.getCell(`${startCol}3`).alignment = { horizontal: "center", vertical: "middle" };
                    colIdx += activities.length;
                }
                ws3.getRow(3).height = 22;

                // Row 4: Activity sub-headers
                ws3.getCell("A4").value = "Kegiatan";
                ws3.getCell("A4").font = { bold: true, size: 9, color: { argb: "FF374151" } };
                ws3.getCell("A4").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };

                orderedCols.forEach((o, si) => {
                    const c = colLetter(2 + si);
                    const k = KEGIATAN_INFO[o.kegiatan_id];
                    ws3.getCell(`${c}4`).value = k?.label || o.kegiatan_id;
                    ws3.getCell(`${c}4`).font = { bold: true, size: 9, color: { argb: "FF374151" } };
                    ws3.getCell(`${c}4`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
                    ws3.getCell(`${c}4`).alignment = { horizontal: "center", vertical: "middle" };
                });

                const row: any = { kegiatan: namaSantri };
                orderedCols.forEach((o, oi) => {
                    const abs = absByKey[o.minggu_ke]?.[o.kegiatan_id];
                    if (o.kegiatan_id === 'HAFALAN') {
                        row[`col_${oi}`] = abs?.nilai_hafalan ?? '-';
                    } else {
                        row[`col_${oi}`] = STATUS_CODE[abs?.status] || abs?.status || '-';
                    }
                });
                ws3.addRow(row);

                const dataRow = ws3.getRow(ws3.rowCount);
                orderedCols.forEach((o, oi) => {
                    const abs = absByKey[o.minggu_ke]?.[o.kegiatan_id];
                    if (abs?.status) {
                        const fill = STATUS_FILLS[abs.status];
                        if (fill) dataRow.getCell(2 + oi).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
                    }
                });
            } else {
                ws3.mergeCells("A1:B1");
                ws3.getCell("A1").value = `Tidak ada data mingguan untuk ${bulanLabel} ${expSantriTahun} H`;
                ws3.getCell("A1").font = { italic: true, color: { argb: "FF999999" } };
            }

            // ── Sheet 4: Absensi Ngaji Harian ──
            const ws4 = wb.addWorksheet("Ngaji");
            const allWeeks = [1, 2, 3, 4, 5].map(mg => getWeekDates(expSantriNgajiTahun, expSantriNgajiBulan, mg));
            const allDates = [...new Set(allWeeks.flatMap(w => w.map(d => d.tanggal)))].sort();

            const orClauses = allDates.map(t => {
                const h = resolveHijri(t);
                return `and(tahun_hijriah.eq.${h.hy},bulan_hijriah_number.eq.${h.hm},hari_hijriah.eq.${h.hd},sesi_ke.eq.1)`;
            });
            const { data: absNgaji } = await supabaseClient
                .from("ngaji_absensi")
                .select("tahun_hijriah, bulan_hijriah_number, hari_hijriah, sesi_ke, status")
                .eq("santri_nis", expSantriNis)
                .or(orClauses.join(','));

            const ngajiMap: Record<string, string> = {};
            (absNgaji || []).forEach((a: any) => {
                const key = `${a.tahun_hijriah}_${a.bulan_hijriah_number}_${a.hari_hijriah}_${a.sesi_ke}`;
                ngajiMap[key] = a.status;
            });

            const ngajiRows = allDates.map(t => {
                const h = resolveHijri(t);
                const key = `${h.hy}_${h.hm}_${h.hd}_1`;
                return { tanggal: t, h, status: ngajiMap[key] || '' };
            }).filter(r => r.status);

            if (ngajiRows.length > 0) {
                ws4.mergeCells("A1:E1");
                ws4.getCell("A1").value = `ABSENSI NGAJI — ${namaSantri} — ${HIJRI_MONTHS[expSantriNgajiBulan - 1]} ${expSantriNgajiTahun} H`;
                ws4.getCell("A1").font = { size: 13, bold: true, color: { argb: "FFFFFFFF" } };
                ws4.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF16A34A" } };
                ws4.getCell("A1").alignment = { horizontal: "center" };
                ws4.getRow(1).height = 22;

                ws4.getRow(3).values = ["No", "Tanggal", "Tanggal H", "Hari", "Status"];
                ws4.getRow(3).font = { bold: true };
                ws4.getRow(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };

                const DAY = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                let cHadir = 0, cSakit = 0, cIzin = 0, cPulang = 0, cGhaib = 0;
                ngajiRows.forEach((r, i) => {
                    const d = new Date(r.tanggal + 'T00:00:00');
                    if (r.status === 'HADIR') cHadir++;
                    else if (r.status === 'SAKIT') cSakit++;
                    else if (r.status === 'IZIN') cIzin++;
                    else if (r.status === 'PULANG') cPulang++;
                    else if (r.status === 'GHAIB') cGhaib++;
                    const hijriStr = `${r.h.monthName} ${r.h.hd} ${r.h.hy} H`;
                    const row = ws4.addRow([i + 1, dayjs(r.tanggal).format("DD MMM YYYY"), hijriStr, DAY[d.getDay()], r.status ? (STATUS_CODE[r.status] || r.status) : '']);
                    if (r.status) {
                        const fill = STATUS_FILLS[r.status];
                        if (fill) row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
                    }
                });

                ws4.addRow([]);
                const sumRow = ws4.addRow(['', '', 'TOTAL', '', '']);
                sumRow.font = { bold: true, size: 10 };
                ws4.addRow(['', '', 'Hadir', cHadir || '', '']);
                ws4.addRow(['', '', 'Sakit', cSakit || '', '']);
                ws4.addRow(['', '', 'Izin', cIzin || '', '']);
                ws4.addRow(['', '', 'Pulang', cPulang || '', '']);
                ws4.addRow(['', '', 'Ghaib', cGhaib || '', '']);
            } else {
                ws4.mergeCells("A1:B1");
                ws4.getCell("A1").value = `Tidak ada data ngaji untuk ${HIJRI_MONTHS[expSantriNgajiBulan - 1]} ${expSantriNgajiTahun} H`;
                ws4.getCell("A1").font = { italic: true, color: { argb: "FF999999" } };
            }
            ws4.columns = [{ width: 5 }, { width: 20 }, { width: 20 }, { width: 12 }, { width: 10 }];

            const buffer = await wb.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `Rekap_Santri_${expSantriNis}_${dayjs().format("YYYYMMDD")}.xlsx`);
            message.success("Export santri berhasil");
            setExpSantriOpen(false);
        } catch (err: any) {
            message.error("Gagal export santri: " + err.message);
        } finally {
            setExpSantriLoading(false);
        }
    };

    // ── Export Ngaji ──
    const handleExportNgaji = async () => {
        if (expNgajiLoading) return;
        setExpNgajiLoading(true);
        setExpNgajiOpen(false);
        try {
            const bulanLabel = HIJRI_MONTHS[expNgajiBulan - 1];
            const { data: santri } = await supabaseClient
                .from("santri")
                .select("nis, nama, kelas, total_hafalan")
                .eq("jurusan", "TAHFIDZ")
                .eq("status_santri", "AKTIF")
                .order("kelas", { ascending: true })
                .order("nama", { ascending: true });
            const santriListData = santri || [];

            const weeksData = expNgajiWeeks.map(mg => ({
                mingguKe: mg,
                dates: getWeekDates(expNgajiTahun, expNgajiBulan, mg),
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
                            tahun_hijriah: expNgajiTahun,
                            bulan_hijriah_number: expNgajiBulan,
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

            const STATUS_CODE_NGAJI: Record<string, string> = {
                HADIR: 'H', SAKIT: 'S', IZIN: 'I', PULANG: 'P', GHAIB: 'GH',
            };
            const STATUS_FILLS_NGAJI: Record<string, string> = {
                HADIR: 'FFD1FAE5', SAKIT: 'FFFEF3C7', IZIN: 'FFDBEAFE',
                GHAIB: 'FFFEE2E2', PULANG: 'FFFFEDD5',
            };

            const COLS_BASE = 3;
            const COLS_PER_WEEK = 10;
            const COLS_RECAP = 5;
            const totalCols = COLS_BASE + (weeksData.length * COLS_PER_WEEK) + COLS_RECAP;

            const wb = new ExcelJS.Workbook();
            const ws = wb.addWorksheet("Absensi Ngaji");

            ws.mergeCells(`A1:${colLetter(totalCols)}1`);
            ws.getCell("A1").value = `ABSENSI NGAJI — ${bulanLabel} ${expNgajiTahun} H`;
            ws.getCell("A1").font = { size: 13, bold: true, color: { argb: "FFFFFFFF" } };
            ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC9A84C" } };
            ws.getCell("A1").alignment = { horizontal: "center" };
            ws.getRow(1).height = 22;
            ws.addRow([]);

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

            const subRow4: any[] = ["NO", "NAMA", "HAFALAN"];
            weeksData.forEach(week => {
                week.dates.forEach((wd, i) => {
                    const h = resolveHijri(wd.tanggal);
                    subRow4.push(`${HARI_LABEL[i + 1]?.full || ''} ${h.hd}`);
                });
                subRow4.push("H"); subRow4.push("S"); subRow4.push("I"); subRow4.push("P"); subRow4.push("G");
            });
            subRow4.push("Total H"); subRow4.push("Total S"); subRow4.push("Total I"); subRow4.push("Total P"); subRow4.push("Total G");
            const subRowObj = ws.getRow(4);
            subRowObj.values = subRow4;
            subRowObj.font = { bold: true, size: 8 };
            subRowObj.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
            subRowObj.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };

            ws.columns = [
                { key: "no", width: 5 }, { key: "nama", width: 24 }, { key: "hafalan", width: 10 },
                ...weeksData.flatMap(() => [
                    { key: "", width: 8 }, { key: "", width: 8 }, { key: "", width: 8 },
                    { key: "", width: 8 }, { key: "", width: 8 },
                    { key: "", width: 8 }, { key: "", width: 8 },
                    { key: "", width: 8 }, { key: "", width: 8 }, { key: "", width: 8 },
                ]),
                { key: "", width: 8 }, { key: "", width: 8 },
                { key: "", width: 8 }, { key: "", width: 8 }, { key: "", width: 8 },
            ];

            ws.getRow(3).eachCell((cell: any) => {
                cell.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC9A84C" } };
                cell.alignment = { horizontal: "center", vertical: "middle" };
            });
            for (let c = gCol; c <= gCol + COLS_RECAP - 1; c++) {
                ws.getRow(3).getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
            }

            santriListData.forEach((s: any, idx: number) => {
                const rv: any[] = [idx + 1, s.nama || santriAlias(s.nis), s.total_hafalan || '-'];
                let totalHadir = 0, totalSakit = 0, totalIzin = 0, totalPulang = 0, totalAlpha = 0;
                weeksData.forEach(week => {
                    let cHadir = 0, cSakit = 0, cIzin = 0, cPulang = 0, cAlpha = 0;
                    for (let h = 1; h <= 5; h++) {
                        const wd = week.dates[h - 1];
                        const hi = wd ? resolveHijri(wd.tanggal) : null;
                        const gk = hi ? `${hi.hy}_${hi.hm}_${hi.hd}_1` : '';
                        const abs = gk ? exportAbsensiGrid[s.nis]?.[gk] : undefined;
                        rv.push(abs?.status ? STATUS_CODE_NGAJI[abs.status] || abs.status : '');
                        if (abs?.status === 'HADIR') cHadir++;
                        else if (abs?.status === 'SAKIT') cSakit++;
                        else if (abs?.status === 'IZIN') cIzin++;
                        else if (abs?.status === 'PULANG') cPulang++;
                        else if (abs?.status === 'GHAIB') cAlpha++;
                    }
                    rv.push(cHadir || '', cSakit || '', cIzin || '', cPulang || '', cAlpha || '');
                    totalHadir += cHadir;
                    totalSakit += cSakit;
                    totalIzin += cIzin;
                    totalPulang += cPulang;
                    totalAlpha += cAlpha;
                });
                rv.push(totalHadir || '', totalSakit || '', totalIzin || '', totalPulang || '', totalAlpha || '');

                const dataRow = ws.addRow(rv);
                let ci = 4;
                weeksData.forEach(week => {
                    for (let h = 1; h <= 5; h++) {
                        const wd = week.dates[h - 1];
                        const hi = wd ? resolveHijri(wd.tanggal) : null;
                        const gk = hi ? `${hi.hy}_${hi.hm}_${hi.hd}_1` : '';
                        const abs = gk ? exportAbsensiGrid[s.nis]?.[gk] : undefined;
                        if (abs?.status) {
                            const fill = STATUS_FILLS_NGAJI[abs.status];
                            if (fill) dataRow.getCell(ci).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
                        }
                        ci++;
                    }
                    ci += 5;
                });
            });

            const lastDataRowNum = ws.rowCount;
            let gHadir = 0, gSakit = 0, gIzin = 0, gPulang = 0, gAlpha = 0;
            santriListData.forEach((s: any) => {
                let cH = 0, cS = 0, cI = 0, cP = 0, cA = 0;
                weeksData.forEach(week => {
                    for (let h = 1; h <= 5; h++) {
                        const wd = week.dates[h - 1];
                        const hi = wd ? resolveHijri(wd.tanggal) : null;
                        const gk = hi ? `${hi.hy}_${hi.hm}_${hi.hd}_1` : '';
                        const abs = gk ? exportAbsensiGrid[s.nis]?.[gk] : undefined;
                        if (abs?.status === 'HADIR') cH++;
                        else if (abs?.status === 'SAKIT') cS++;
                        else if (abs?.status === 'IZIN') cI++;
                        else if (abs?.status === 'PULANG') cP++;
                        else if (abs?.status === 'GHAIB') cA++;
                    }
                });
                gHadir += cH; gSakit += cS; gIzin += cI; gPulang += cP; gAlpha += cA;
            });

            const totalEmpties: any[] = [];
            weeksData.forEach(() => {
                for (let i = 0; i < COLS_PER_WEEK; i++) totalEmpties.push('');
            });
            ws.addRow([]);
            const finalRow = ws.addRow([
                '', 'TOTAL', '', ...totalEmpties,
                gHadir || '', gSakit || '', gIzin || '', gPulang || '', gAlpha || '',
            ]);
            finalRow.font = { bold: true, size: 10 };
            finalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };

            ws.autoFilter = { from: `A4`, to: `${colLetter(totalCols)}${lastDataRowNum}` };

            const buffer = await wb.xlsx.writeBuffer();
            const weekLabel = expNgajiWeeks.length >= 5 ? '1Bulan' : `Mg${expNgajiWeeks.join('_')}`;
            saveAs(new Blob([buffer]), `Absensi_Ngaji_${bulanLabel}_${weekLabel}_${dayjs().format("YYYYMMDD")}.xlsx`);
            message.success("Berhasil diunduh");
        } catch (error: any) {
            message.error("Gagal export: " + error.message);
        } finally {
            setExpNgajiLoading(false);
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
                        icon={<CalendarOutlined />}
                        onClick={() => setExpMingguanOpen(true)}
                        style={{ borderRadius: 8, color: "#7C3AED", borderColor: "#7C3AED" }}
                    >
                        Export Mingguan
                    </Button>
                    <Button
                        icon={<CalendarOutlined />}
                        onClick={() => setExpNgajiOpen(true)}
                        style={{ borderRadius: 8, color: "#16A34A", borderColor: "#16A34A" }}
                    >
                        Export Ngaji
                    </Button>
                    <Button
                        icon={<TeamOutlined />}
                        onClick={() => setExpSantriOpen(true)}
                        style={{ borderRadius: 8, color: "#2563EB", borderColor: "#2563EB" }}
                    >
                        Export Santri
                    </Button>
                </Space>
            </div>

            {loading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
                    <Spin size="large" />
                </div>
            ) : (
                <>
                    {/* ── KPI Cards – Row 1: Umum ── */}
                    <Row gutter={12} style={{ marginBottom: 8 }}>
                        {[
                            { icon: <TeamOutlined />, value: summaries.santriCount, label: "Santri Aktif", accent: "#C9A84C" },
                            { icon: <CheckCircleFilled />, value: summaries.totalHadir, label: "Total Hadir", accent: "#16A34A" },
                            { icon: <CalendarOutlined />, value: summaries.totalAbsensi, label: "Total Absensi", accent: "#D97706" },
                            { icon: <RiseOutlined />, value: `${summaries.persentaseHadir}%`, label: "Kehadiran", accent: "#2563EB" },
                            { icon: <BookOutlined />, value: summaries.rataSetoran, label: "⌀ Setoran/Santri", accent: "#7C3AED" },
                        ].map((kpi, i) => (
                            <Col key={i} xs={12} sm={8} lg={4} xl={4}>
                                <div style={cardStyle}>
                                    <Statistic
                                        title={<span style={{ fontSize: 11, fontWeight: 600, color: token.colorTextSecondary }}>{kpi.label}</span>}
                                        value={kpi.value as any}
                                        prefix={<span style={{ color: kpi.accent, fontSize: 16 }}>{kpi.icon}</span>}
                                        valueStyle={{ fontSize: 24, fontWeight: 700, color: token.colorText }}
                                    />
                                </div>
                            </Col>
                        ))}
                    </Row>

                    {/* ── KPI Cards – Row 2: Hafalan & Murojaah ── */}
                    <Row gutter={12} style={{ marginBottom: 16 }}>
                        {[
                            { icon: <SyncOutlined />, value: summaries.totalZiyadah, label: "Ziyadah", sub: summaries.totalZiyadah + summaries.totalMurojaah > 0 ? `${((summaries.totalZiyadah / (summaries.totalZiyadah + summaries.totalMurojaah)) * 100).toFixed(0)}%` : '0%', accent: "#2563EB" },
                            { icon: <SyncOutlined />, value: summaries.totalMurojaah, label: "Murojaah", sub: summaries.totalZiyadah + summaries.totalMurojaah > 0 ? `${((summaries.totalMurojaah / (summaries.totalZiyadah + summaries.totalMurojaah)) * 100).toFixed(0)}%` : '0%', accent: "#7C3AED" },
                            { icon: <CheckCircleFilled />, value: summaries.totalLancar, label: "Lancar", sub: summaries.totalLancar + summaries.totalMengulang > 0 ? `${((summaries.totalLancar / (summaries.totalLancar + summaries.totalMengulang)) * 100).toFixed(0)}%` : '0%', accent: "#16A34A" },
                            { icon: <CloseCircleOutlined />, value: summaries.totalMengulang, label: "Mengulang", sub: summaries.totalLancar + summaries.totalMengulang > 0 ? `${((summaries.totalMengulang / (summaries.totalLancar + summaries.totalMengulang)) * 100).toFixed(0)}%` : '0%', accent: "#D97706" },
                            { icon: <BarChartOutlined />, value: summaries.totalSetoran, label: "Total Setoran", accent: "#9333EA" },
                        ].map((kpi, i) => (
                            <Col key={i} xs={12} sm={8} lg={4} xl={4}>
                                <div style={cardStyle}>
                                    <Statistic
                                        title={<span style={{ fontSize: 11, fontWeight: 600, color: token.colorTextSecondary }}>{kpi.label}</span>}
                                        value={kpi.value as any}
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
                            { label: <><BarChartOutlined /> Statistik Mingguan</>, value: "statistik" },
                        { label: <><BookOutlined /> Statistik Ngaji</>, value: "ngaji" },
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

                    {activeTab === "statistik" && (
                        <div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                                <Text strong style={{ fontSize: 16 }}>
                                    <BarChartOutlined style={{ marginRight: 6 }} />Statistik Absensi Mingguan
                                </Text>
                                <Segmented
                                    value={statsViewMode}
                                    onChange={(v) => setStatsViewMode(v as string)}
                                    size="small"
                                    options={[
                                        { label: "📅 Per Minggu", value: "mingguan" },
                                        { label: "📆 Per Bulan", value: "bulanan" },
                                    ]}
                                />
                            </div>

                            {statsLoading ? (
                                <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Spin size="large" /></div>
                            ) : statsData.periodLabels.length === 0 ? (
                                <div style={{ ...cardStyle, textAlign: "center", padding: 40 }}>
                                    <Text type="secondary">Tidak ada data absensi mingguan di periode ini</Text>
                                </div>
                            ) : (
                                <>
                                    {/* KPI Cards */}
                                    <Row gutter={12} style={{ marginBottom: 16 }}>
                                        {[
                                            { icon: <CalendarOutlined />, value: statsData.totalSesi, label: "Total Sesi", accent: "#7C3AED" },
                                            { icon: <TeamOutlined />, value: statsData.totalAbsensi, label: "Total Absensi", accent: "#2563EB" },
                                            { icon: <CheckCircleFilled />, value: statsData.totalHadir, label: "Total Hadir", accent: "#16A34A" },
                                            { icon: <RiseOutlined />, value: statsData.totalSesi > 0 ? (statsData.totalHadir / statsData.totalAbsensi * 100).toFixed(1) + '%' : '0%', label: "Rata-rata Kehadiran", accent: "#D97706" },
                                        ].map((kpi, i) => (
                                            <Col key={i} xs={12} sm={6}>
                                                <div style={cardStyle}>
                                                    <Statistic
                                                        title={<span style={{ fontSize: 11, fontWeight: 600, color: token.colorTextSecondary }}>{kpi.label}</span>}
                                                        value={kpi.value as any}
                                                        prefix={<span style={{ color: kpi.accent, fontSize: 16 }}>{kpi.icon}</span>}
                                                        valueStyle={{ fontSize: 24, fontWeight: 700, color: token.colorText }}
                                                    />
                                                </div>
                                            </Col>
                                        ))}
                                    </Row>

                                    <Row gutter={16} style={{ marginBottom: 16 }}>
                                        {/* Line Chart: Trend */}
                                        <Col xs={24} lg={14}>
                                            <div style={cardStyle}>
                                                <Text strong style={{ fontSize: 14, display: "block", marginBottom: 12 }}>
                                                    📈 Tren Kehadiran per {statsViewMode === "mingguan" ? "Minggu" : "Bulan"}
                                                </Text>
                                                <ResponsiveContainer width="100%" height={300}>
                                                    <AreaChart
                                                        data={statsData.periodLabels.map(p => ({
                                                            periode: p.label,
                                                            Hadir: statsData.periodStats[p.key]?.HADIR || 0,
                                                            Sakit: statsData.periodStats[p.key]?.SAKIT || 0,
                                                            Izin: statsData.periodStats[p.key]?.IZIN || 0,
                                                            Ghaib: statsData.periodStats[p.key]?.GHAIB || 0,
                                                            total: statsData.periodStats[p.key]?.total || 0,
                                                        }))}
                                                        margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
                                                    >
                                                        <defs>
                                                            <linearGradient id="colorHadir" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#16A34A" stopOpacity={0.3} /><stop offset="95%" stopColor="#16A34A" stopOpacity={0} /></linearGradient>
                                                            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7C3AED" stopOpacity={0.2} /><stop offset="95%" stopColor="#7C3AED" stopOpacity={0} /></linearGradient>
                                                        </defs>
                                                        <CartesianGrid strokeDasharray="3 3" stroke={token.colorBorderSecondary} vertical={false} />
                                                        <XAxis dataKey="periode" tick={{ fontSize: 10, fill: token.colorTextSecondary }} />
                                                        <YAxis tick={{ fontSize: 10, fill: token.colorTextSecondary }} allowDecimals={false} />
                                                        <RechartsTooltip
                                                            contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${token.colorBorderSecondary}`, background: token.colorBgContainer }}
                                                        />
                                                        <Area type="monotone" dataKey="total" name="Total" stroke="#7C3AED" fill="url(#colorTotal)" strokeWidth={2} />
                                                        <Area type="monotone" dataKey="Hadir" name="Hadir" stroke="#16A34A" fill="url(#colorHadir)" strokeWidth={2} />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </Col>

                                        {/* Bar Chart: Per Kegiatan */}
                                        <Col xs={24} lg={10}>
                                            <div style={cardStyle}>
                                                <Text strong style={{ fontSize: 14, display: "block", marginBottom: 12 }}>
                                                    📊 Kehadiran per Kegiatan
                                                </Text>
                                                <ResponsiveContainer width="100%" height={300}>
                                                    <BarChart
                                                        data={statsData.kegiatanStats.map(d => ({
                                                            ...d,
                                                            hadirPct: d.total > 0 ? Math.round(d.hadir / d.total * 100) : 0,
                                                        }))}
                                                        layout="vertical"
                                                        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                                                    >
                                                        <CartesianGrid strokeDasharray="3 3" stroke={token.colorBorderSecondary} horizontal={false} />
                                                        <XAxis type="number" tick={{ fontSize: 10, fill: token.colorTextSecondary }} domain={[0, 100]} unit="%" />
                                                        <YAxis dataKey="label" type="category" tick={{ fontSize: 10, fill: token.colorTextSecondary }} width={90} />
                                                        <RechartsTooltip
                                                            formatter={(value: any, name: any) => [name === 'hadirPct' ? `${value}%` : value, name === 'hadirPct' ? 'Kehadiran' : name]}
                                                            contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${token.colorBorderSecondary}`, background: token.colorBgContainer }}
                                                        />
                                                        <Bar dataKey="hadirPct" name="hadirPct" radius={[0, 4, 4, 0]}>
                                                            {statsData.kegiatanStats.map((_, i) => (
                                                                <Cell key={i} fill={i % 2 === 0 ? '#7C3AED' : '#2563EB'} />
                                                            ))}
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </Col>
                                    </Row>

                                    {/* Stacked Bar: Status per Periode */}
                                    <div style={cardStyle}>
                                        <Text strong style={{ fontSize: 14, display: "block", marginBottom: 12 }}>
                                            📊 Distribusi Status per {statsViewMode === "mingguan" ? "Minggu" : "Bulan"}
                                        </Text>
                                        <ResponsiveContainer width="100%" height={280}>
                                                <BarChart
                                                data={statsData.periodLabels.map(p => ({
                                                    periode: p.label,
                                                    Hadir: statsData.periodStats[p.key]?.HADIR || 0,
                                                    Sakit: statsData.periodStats[p.key]?.SAKIT || 0,
                                                    Izin: statsData.periodStats[p.key]?.IZIN || 0,
                                                    Sekolah: statsData.periodStats[p.key]?.SEKOLAH || 0,
                                                    Ghaib: statsData.periodStats[p.key]?.GHAIB || 0,
                                                    Pulang: statsData.periodStats[p.key]?.PULANG || 0,
                                                }))}
                                                margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" stroke={token.colorBorderSecondary} vertical={false} />
                                                <XAxis dataKey="periode" tick={{ fontSize: 10, fill: token.colorTextSecondary }} />
                                                <YAxis tick={{ fontSize: 10, fill: token.colorTextSecondary }} allowDecimals={false} />
                                                <RechartsTooltip
                                                    contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${token.colorBorderSecondary}`, background: token.colorBgContainer }}
                                                />
                                                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                                                <Bar dataKey="Hadir" name="Hadir" stackId="a" fill="#16A34A" radius={[0, 0, 0, 0]} />
                                                <Bar dataKey="Sakit" name="Sakit" stackId="a" fill="#D97706" radius={[0, 0, 0, 0]} />
                                                <Bar dataKey="Izin" name="Izin" stackId="a" fill="#2563EB" radius={[0, 0, 0, 0]} />
                                                <Bar dataKey="Sekolah" name="Sekolah" stackId="a" fill="#6366F1" radius={[0, 0, 0, 0]} />
                                                <Bar dataKey="Ghaib" name="Ghaib" stackId="a" fill="#DC2626" radius={[0, 0, 0, 0]} />
                                                <Bar dataKey="Pulang" name="Pulang" stackId="a" fill="#9333EA" radius={[0, 0, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                    {activeTab === "ngaji" && (
                        <div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                                <Text strong style={{ fontSize: 16 }}>
                                    <BookOutlined style={{ marginRight: 6, color: '#16a34a' }} />Statistik Absensi Ngaji
                                </Text>
                                <Space>
                                    <Select
                                        value={ngajiStatsTahun}
                                        onChange={v => setNgajiStatsTahun(v)}
                                        style={{ width: 110 }}
                                        options={Array.from({ length: 5 }, (_, i) => ({ label: `${1448 + i} H`, value: 1448 + i }))}
                                    />
                                    <Select
                                        value={ngajiStatsBulan}
                                        onChange={v => setNgajiStatsBulan(v)}
                                        style={{ width: 150 }}
                                        options={HIJRI_MONTHS.map((n, i) => ({ label: n, value: i + 1 }))}
                                    />
                                </Space>
                            </div>

                            {ngajiStatsLoading ? (
                                <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Spin size="large" /></div>
                            ) : ngajiStatsData.periodLabels.length === 0 ? (
                                <div style={{ ...cardStyle, textAlign: "center", padding: 40 }}>
                                    <Text type="secondary">Tidak ada data absensi ngaji untuk bulan {HIJRI_MONTHS[ngajiStatsBulan - 1]} {ngajiStatsTahun} H</Text>
                                </div>
                            ) : (
                                <>
                                    <Row gutter={12} style={{ marginBottom: 16 }}>
                                        {[
                                            { icon: <TeamOutlined />, value: ngajiStatsData.totalSantri, label: "Total Santri", accent: "#16A34A" },
                                            { icon: <CalendarOutlined />, value: ngajiStatsData.totalSesi, label: "Total Sesi", accent: "#7C3AED" },
                                            { icon: <CheckCircleFilled />, value: ngajiStatsData.totalHadir, label: "Total Hadir", accent: "#16A34A" },
                                            { icon: <RiseOutlined />, value: ngajiStatsData.totalSesi > 0 ? (ngajiStatsData.totalHadir / ngajiStatsData.totalSesi / (ngajiStatsData.totalSantri || 1) * 100).toFixed(1) + '%' : '0%', label: "Rata-rata Kehadiran", accent: "#D97706" },
                                        ].map((kpi, i) => (
                                            <Col key={i} xs={12} sm={3}>
                                                <div style={cardStyle}>
                                                    <Statistic
                                                        title={<span style={{ fontSize: 11, fontWeight: 600, color: token.colorTextSecondary }}>{kpi.label}</span>}
                                                        value={kpi.value as any}
                                                        prefix={<span style={{ color: kpi.accent, fontSize: 16 }}>{kpi.icon}</span>}
                                                        valueStyle={{ fontSize: 24, fontWeight: 700, color: token.colorText }}
                                                    />
                                                </div>
                                            </Col>
                                        ))}
                                    </Row>

                                    <Row gutter={16} style={{ marginBottom: 16 }}>
                                        <Col xs={24} lg={14}>
                                            <div style={cardStyle}>
                                                <Text strong style={{ fontSize: 14, display: "block", marginBottom: 12 }}>
                                                    📈 Tren Kehadiran Ngaji per Minggu
                                                </Text>
                                                <ResponsiveContainer width="100%" height={300}>
                                                    <AreaChart
                                                        data={ngajiStatsData.periodLabels.map(p => ({
                                                            periode: p.label,
                                                            Hadir: ngajiStatsData.periodStats[p.key]?.HADIR || 0,
                                                            Sakit: ngajiStatsData.periodStats[p.key]?.SAKIT || 0,
                                                            Izin: ngajiStatsData.periodStats[p.key]?.IZIN || 0,
                                                            Ghaib: ngajiStatsData.periodStats[p.key]?.GHAIB || 0,
                                                            total: ngajiStatsData.periodStats[p.key]?.total || 0,
                                                        }))}
                                                        margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
                                                    >
                                                        <defs>
                                                            <linearGradient id="colorNgajiHadir" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#16A34A" stopOpacity={0.3} /><stop offset="95%" stopColor="#16A34A" stopOpacity={0} /></linearGradient>
                                                            <linearGradient id="colorNgajiTotal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7C3AED" stopOpacity={0.2} /><stop offset="95%" stopColor="#7C3AED" stopOpacity={0} /></linearGradient>
                                                        </defs>
                                                        <CartesianGrid strokeDasharray="3 3" stroke={token.colorBorderSecondary} vertical={false} />
                                                        <XAxis dataKey="periode" tick={{ fontSize: 10, fill: token.colorTextSecondary }} />
                                                        <YAxis tick={{ fontSize: 10, fill: token.colorTextSecondary }} allowDecimals={false} />
                                                        <RechartsTooltip
                                                            contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${token.colorBorderSecondary}`, background: token.colorBgContainer }}
                                                        />
                                                        <Area type="monotone" dataKey="total" name="Total" stroke="#7C3AED" fill="url(#colorNgajiTotal)" strokeWidth={2} />
                                                        <Area type="monotone" dataKey="Hadir" name="Hadir" stroke="#16A34A" fill="url(#colorNgajiHadir)" strokeWidth={2} />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </Col>
                                        <Col xs={24} lg={10}>
                                            <div style={cardStyle}>
                                                <Text strong style={{ fontSize: 14, display: "block", marginBottom: 12 }}>
                                                    🥧 Distribusi Status Ngaji
                                                </Text>
                                                <ResponsiveContainer width="100%" height={300}>
                                                    <PieChart>
                                                        <Pie
                                                            data={(() => {
                                                                const totals: Record<string, number> = {};
                                                                Object.values(ngajiStatsData.periodStats).forEach(ps => {
                                                                    ['HADIR', 'SAKIT', 'IZIN', 'PULANG', 'GHAIB'].forEach(k => {
                                                                        totals[k] = (totals[k] || 0) + (ps[k] || 0);
                                                                    });
                                                                });
                                                                const colors: Record<string, string> = {
                                                                    HADIR: '#16A34A', SAKIT: '#D97706',
                                                                    IZIN: '#2563EB', PULANG: '#9333EA', GHAIB: '#DC2626'
                                                                };
                                                                return Object.entries(totals).map(([k, v]) => ({
                                                                    name: k, value: v, color: colors[k]
                                                                }));
                                                            })()}
                                                            cx="50%" cy="50%" outerRadius={90} innerRadius={50}
                                                            dataKey="value" label={({ name, value }) => `${name} ${value}`}
                                                            labelLine={{ strokeWidth: 1 }}
                                                        >
                                                            {(() => {
                                                                const totals: Record<string, number> = {};
                                                                Object.values(ngajiStatsData.periodStats).forEach(ps => {
                                                                    ['HADIR', 'SAKIT', 'IZIN', 'PULANG', 'GHAIB'].forEach(k => {
                                                                        totals[k] = (totals[k] || 0) + (ps[k] || 0);
                                                                    });
                                                                });
                                                                const colors: Record<string, string> = {
                                                                    HADIR: '#16A34A', SAKIT: '#D97706',
                                                                    IZIN: '#2563EB', PULANG: '#9333EA', GHAIB: '#DC2626'
                                                                };
                                                                return Object.entries(totals).map(([k]) => (
                                                                    <Cell key={k} fill={colors[k]} />
                                                                ));
                                                            })()}
                                                        </Pie>
                                                        <RechartsTooltip
                                                            contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${token.colorBorderSecondary}`, background: token.colorBgContainer }}
                                                        />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </Col>
                                    </Row>

                                    <div style={cardStyle}>
                                        <Text strong style={{ fontSize: 14, display: "block", marginBottom: 12 }}>
                                            📊 Distribusi Status per Minggu
                                        </Text>
                                        <ResponsiveContainer width="100%" height={320}>
                                            <BarChart
                                                data={ngajiStatsData.periodLabels.map(p => ({
                                                    periode: p.label,
                                                    Hadir: ngajiStatsData.periodStats[p.key]?.HADIR || 0,
                                                    Sakit: ngajiStatsData.periodStats[p.key]?.SAKIT || 0,
                                                    Izin: ngajiStatsData.periodStats[p.key]?.IZIN || 0,
                                                    Pulang: ngajiStatsData.periodStats[p.key]?.PULANG || 0,
                                                    Ghaib: ngajiStatsData.periodStats[p.key]?.GHAIB || 0,
                                                }))}
                                                margin={{ top: 24, right: 16, left: -8, bottom: 0 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" stroke={token.colorBorderSecondary} vertical={false} />
                                                <XAxis dataKey="periode" tick={{ fontSize: 11, fontWeight: 600, fill: token.colorText }} />
                                                <YAxis tick={{ fontSize: 10, fill: token.colorTextSecondary }} allowDecimals={false} />
                                                <RechartsTooltip
                                                    cursor={{ fill: token.colorBgElevated, opacity: 0.6 }}
                                                    contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${token.colorBorderSecondary}`, background: token.colorBgContainer }}
                                                />
                                                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                                                <Bar dataKey="Hadir" name="Hadir" fill="#16A34A" radius={[3, 3, 0, 0]} maxBarSize={28}
                                                    label={{ position: 'top', fontSize: 10, fontWeight: 600, fill: '#16A34A' }}
                                                />
                                                <Bar dataKey="Sakit" name="Sakit" fill="#D97706" radius={[3, 3, 0, 0]} maxBarSize={28}
                                                    label={{ position: 'top', fontSize: 10, fontWeight: 600, fill: '#D97706' }}
                                                />
                                                <Bar dataKey="Izin" name="Izin" fill="#2563EB" radius={[3, 3, 0, 0]} maxBarSize={28}
                                                    label={{ position: 'top', fontSize: 10, fontWeight: 600, fill: '#2563EB' }}
                                                />
                                                <Bar dataKey="Pulang" name="Pulang" fill="#9333EA" radius={[3, 3, 0, 0]} maxBarSize={28}
                                                    label={{ position: 'top', fontSize: 10, fontWeight: 600, fill: '#9333EA' }}
                                                />
                                                <Bar dataKey="Ghaib" name="Ghaib" fill="#DC2626" radius={[3, 3, 0, 0]} maxBarSize={28}
                                                    label={{ position: 'top', fontSize: 10, fontWeight: 600, fill: '#DC2626' }}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* ── Modal Export Mingguan ── */}
            <Modal
                title={<Space><CalendarOutlined style={{ color: "#7C3AED" }} /> Export Absensi Mingguan</Space>}
                open={expMingguanOpen}
                onCancel={() => setExpMingguanOpen(false)}
                footer={[
                    <Button key="back" onClick={() => setExpMingguanOpen(false)}>Batal</Button>,
                    <Button key="submit" type="primary" icon={<DownloadOutlined />}
                        loading={expMingguanLoading} onClick={handleExportMingguan}
                        style={{ background: "#7C3AED", borderColor: "#7C3AED" }}>
                        Download Excel
                    </Button>,
                ]}
            >
                <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0" }}>
                    <div>
                        <Text strong style={{ display: "block", marginBottom: 6 }}>Tahun Hijriah</Text>
                        <Select
                            value={expMingguanTahun}
                            onChange={setExpMingguanTahun}
                            style={{ width: "100%" }}
                            options={Array.from({ length: 5 }, (_, i) => {
                                const y = 1448 + i;
                                return { label: `${y} H`, value: y };
                            })}
                        />
                    </div>
                    <div>
                        <Text strong style={{ display: "block", marginBottom: 6 }}>Bulan Hijriah</Text>
                        <Select
                            value={expMingguanBulan}
                            onChange={setExpMingguanBulan}
                            style={{ width: "100%" }}
                            options={HIJRI_MONTHS.map((name, i) => ({ label: name, value: i + 1 }))}
                        />
                    </div>
                </div>
            </Modal>

            {/* ── Modal Export Ngaji ── */}
            <Modal
                title={<span><FileExcelOutlined style={{ color: '#16a34a' }} /> Export Absensi Ngaji</span>}
                open={expNgajiOpen}
                onCancel={() => setExpNgajiOpen(false)}
                onOk={() => handleExportNgaji()}
                okText="Export"
                okButtonProps={{ loading: expNgajiLoading, icon: <FileExcelOutlined />, style: { background: '#16a34a', borderColor: '#16a34a' } }}
                cancelButtonProps={{ disabled: expNgajiLoading }}
                destroyOnClose
            >
                <div style={{ padding: '8px 0' }}>
                    <Text style={{ display: 'block', marginBottom: 8, color: token.colorTextSecondary }}>Tahun & Bulan Hijriah</Text>
                    <Space style={{ marginBottom: 16 }}>
                        <Select
                            value={expNgajiTahun}
                            onChange={v => setExpNgajiTahun(v)}
                            style={{ width: 110 }}
                            options={Array.from({ length: 5 }, (_, i) => ({ label: `${1448 + i} H`, value: 1448 + i }))}
                        />
                        <Select
                            value={expNgajiBulan}
                            onChange={v => { setExpNgajiBulan(v); }}
                            style={{ width: 150 }}
                            options={HIJRI_MONTHS.map((n, i) => ({ label: n, value: i + 1 }))}
                        />
                    </Space>
                    <Text style={{ display: 'block', marginBottom: 12, color: token.colorTextSecondary }}>
                        Pilih Minggu yang akan di-export:
                    </Text>
                    <Checkbox.Group
                        value={expNgajiWeeks}
                        onChange={v => setExpNgajiWeeks(v as number[])}
                        options={Array.from({ length: 5 }, (_, i) => ({
                            label: `Minggu ${i + 1}`,
                            value: i + 1,
                        }))}
                    />
                    <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                        <Button size="small" onClick={() => setExpNgajiWeeks([1])}>Minggu Ini</Button>
                        <Button size="small" onClick={() => setExpNgajiWeeks([1, 2, 3, 4, 5])}>Semua Minggu</Button>
                    </div>
                </div>
            </Modal>

            {/* ── Modal Export Santri ── */}
            <Modal
                title={<Space><TeamOutlined style={{ color: "#2563EB" }} /> Export Rekap Santri</Space>}
                open={expSantriOpen}
                onCancel={() => setExpSantriOpen(false)}
                width={520}
                footer={[
                    <Button key="back" onClick={() => setExpSantriOpen(false)}>Batal</Button>,
                    <Button key="submit" type="primary" icon={<DownloadOutlined />}
                        loading={expSantriLoading} onClick={handleExportSantri}
                        style={{ background: "#2563EB", borderColor: "#2563EB" }}>
                        Download Excel
                    </Button>,
                ]}
            >
                <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0" }}>
                    <div>
                        <Text strong style={{ display: "block", marginBottom: 6 }}>Pilih Santri</Text>
                        <Select
                            value={expSantriNis}
                            onChange={setExpSantriNis}
                            placeholder="Cari santri..."
                            showSearch
                            style={{ width: "100%" }}
                            filterOption={(input, option) => (option?.label as string || '').toLowerCase().includes(input.toLowerCase())}
                            options={santriListExport.map(s => ({ label: `${s.nama} (${s.nis})`, value: s.nis }))}
                        />
                    </div>
                    <Divider style={{ margin: "4px 0", fontSize: 11, color: "#888" }}>Setoran Hafalan (Ziyadah)</Divider>
                    <div>
                        <Text strong style={{ display: "block", marginBottom: 6 }}>Rentang Tanggal</Text>
                        <RangePicker
                            value={expSantriSetoran}
                            onChange={(dates: any) => setExpSantriSetoran(dates)}
                            style={{ width: "100%" }}
                            format="DD MMM YYYY"
                        />
                    </div>
                    <Divider style={{ margin: "4px 0", fontSize: 11, color: "#888" }}>Murojaah</Divider>
                    <div>
                        <Text strong style={{ display: "block", marginBottom: 6 }}>Rentang Tanggal</Text>
                        <RangePicker
                            value={expSantriMurojaah}
                            onChange={(dates: any) => setExpSantriMurojaah(dates)}
                            style={{ width: "100%" }}
                            format="DD MMM YYYY"
                        />
                    </div>
                    <Divider style={{ margin: "4px 0", fontSize: 11, color: "#888" }}>Absensi Mingguan</Divider>
                    <div style={{ display: "flex", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                            <Text strong style={{ display: "block", marginBottom: 6 }}>Tahun Hijriah</Text>
                            <Select
                                value={expSantriTahun}
                                onChange={setExpSantriTahun}
                                style={{ width: "100%" }}
                                options={Array.from({ length: 5 }, (_, i) => {
                                    const y = 1448 + i;
                                    return { label: `${y} H`, value: y };
                                })}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <Text strong style={{ display: "block", marginBottom: 6 }}>Bulan Hijriah</Text>
                            <Select
                                value={expSantriBulan}
                                onChange={setExpSantriBulan}
                                style={{ width: "100%" }}
                                options={HIJRI_MONTHS.map((name, i) => ({ label: name, value: i + 1 }))}
                            />
                        </div>
                    </div>
                    <Divider style={{ margin: "4px 0", fontSize: 11, color: "#888" }}>Absensi Ngaji</Divider>
                    <div style={{ display: "flex", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                            <Text strong style={{ display: "block", marginBottom: 6 }}>Tahun Hijriah</Text>
                            <Select
                                value={expSantriNgajiTahun}
                                onChange={setExpSantriNgajiTahun}
                                style={{ width: "100%" }}
                                options={Array.from({ length: 5 }, (_, i) => {
                                    const y = 1448 + i;
                                    return { label: `${y} H`, value: y };
                                })}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <Text strong style={{ display: "block", marginBottom: 6 }}>Bulan Hijriah</Text>
                            <Select
                                value={expSantriNgajiBulan}
                                onChange={setExpSantriNgajiBulan}
                                style={{ width: "100%" }}
                                options={HIJRI_MONTHS.map((name, i) => ({ label: name, value: i + 1 }))}
                            />
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
