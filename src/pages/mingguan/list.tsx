import React, { useState, useEffect, useMemo } from "react";
import {
    Button, Typography, Space, Select, Segmented, message,
    Avatar, Tag, Spin, theme, Modal, Tooltip as AntTooltip,
    Badge, Card, Row, Col, Alert, Dropdown,
} from "antd";
import {
    CalendarOutlined, FileExcelOutlined, UserOutlined, ReloadOutlined,
    CheckCircleOutlined, CloseCircleOutlined, CheckOutlined,
    BarChartOutlined, TeamOutlined, ThunderboltOutlined,
    InfoCircleOutlined, PlusOutlined, BookOutlined, WarningOutlined,
} from "@ant-design/icons";
import { useGetIdentity } from "@refinedev/core";
import dayjs from "dayjs";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { supabaseClient } from "../../utility/supabaseClient";
import { HIJRI_MONTHS } from "../../utility/dateHelper";
import { santriAlias } from "../../utility/privacy";
import hijriConverter from "hijri-converter";
import { motion, AnimatePresence } from "framer-motion";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip as ReTooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

const { Text, Title } = Typography;
const { useToken } = theme;

// ─── Status Config (token-based, zero hardcodes) ──────────────────────────────
const getStatusConfig = (token: any) => [
    { key: "HADIR",   label: "Hadir",   icon: "✅", code: "H",  color: token.colorSuccess,        bg: token.colorSuccessBg,   border: token.colorSuccessBorder },
    { key: "SAKIT",   label: "Sakit",   icon: "🤒", code: "S",  color: token.colorWarning,        bg: token.colorWarningBg,   border: token.colorWarningBorder },
    { key: "IZIN",    label: "Izin",    icon: "📝", code: "I",  color: token.colorInfo,            bg: token.colorInfoBg,      border: token.colorInfoBorder },
    { key: "SEKOLAH", label: "Sekolah", icon: "🏫", code: "Sk", color: token.colorPrimary,         bg: token.colorPrimaryBg,   border: token.colorPrimaryBorder },
    { key: "GHAIB",   label: "Ghaib",   icon: "❌", code: "GH", color: token.colorError,           bg: token.colorErrorBg,     border: token.colorErrorBorder },
    { key: "PULANG",  label: "Pulang",  icon: "🏠", code: "P",  color: token.colorTextSecondary,   bg: token.colorFillAlter,   border: token.colorBorderSecondary },
];

const KEGIATAN_INFO: Record<string, { label: string; icon: string; tokenColorKey: string }> = {
    HAFALAN:    { label: "Hafalan",          icon: "📖", tokenColorKey: "colorWarning" },
    ISTIGHOSAH: { label: "Istighosah",       icon: "🤲", tokenColorKey: "colorSuccess" },
    NGAOS_AANG: { label: "Ngaos Aang",       icon: "📚", tokenColorKey: "colorInfo" },
    TILAWAH:    { label: "Tilawah/Kaligrafi",icon: "🕌", tokenColorKey: "colorPrimary" },
    TAWASUL:    { label: "Tawasul",          icon: "🙏", tokenColorKey: "colorError" },
    MHQ:        { label: "MHQ",              icon: "🏆", tokenColorKey: "colorWarning" },
    MUHADHOROH: { label: "Muhadhoroh",       icon: "🎤", tokenColorKey: "colorPrimary" },
};

const KEGIATAN_MINGGUAN: Record<number, string[]> = {
    1: ["ISTIGHOSAH", "NGAOS_AANG", "TILAWAH", "TAWASUL"],
    2: ["NGAOS_AANG", "TILAWAH", "TAWASUL", "MUHADHOROH"],
    3: ["NGAOS_AANG", "TILAWAH", "TAWASUL", "MHQ"],
    4: ["NGAOS_AANG", "TILAWAH", "TAWASUL", "MHQ"],
    5: ["NGAOS_AANG", "TILAWAH", "TAWASUL", "MHQ"],
};

// Excel fills stay ARGB (Excel has no dark-mode)
const STATUS_FILLS: Record<string, string> = {
    HADIR: "FFD1FAE5", SAKIT: "FFFEF3C7", IZIN: "FFDBEAFE",
    SEKOLAH: "FFE0E7FF", GHAIB: "FFFEE2E2", PULANG: "FFFFEDD5",
};

const KEGIATAN_EXCEL_COLORS: Record<string, string> = {
    HAFALAN: "FFCA8A04", ISTIGHOSAH: "FF059669", NGAOS_AANG: "FF2563EB",
    TILAWAH: "FF7C3AED", TAWASUL: "FFDC2626", MHQ: "FFD97706", MUHADHOROH: "FF0369A1",
};

const colLetter = (n: number): string => {
    let s = "";
    while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
    return s;
};

const hexLum = (hex: string): number => {
    const c = hex.replace("#", "");
    return 0.299 * parseInt(c.slice(0, 2), 16)
         + 0.587 * parseInt(c.slice(2, 4), 16)
         + 0.114 * parseInt(c.slice(4, 6), 16);
};

const getCurrentHijri = () => {
    const now = new Date();
    return hijriConverter.toHijri(now.getFullYear(), now.getMonth() + 1, now.getDate());
};

// ─── Animated Counter ─────────────────────────────────────────────────────────
const AnimatedNumber: React.FC<{ value: number }> = ({ value }) => {
    const [display, setDisplay] = React.useState(0);
    React.useEffect(() => {
        let cur = 0;
        const step = Math.max(1, Math.ceil(value / 25));
        const t = setInterval(() => {
            cur += step;
            if (cur >= value) { setDisplay(value); clearInterval(t); }
            else setDisplay(cur);
        }, 16);
        return () => clearInterval(t);
    }, [value]);
    return <>{display}</>;
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard: React.FC<{
    label: string; value: number; total: number;
    icon: string; color: string; bg: string; border: string;
    index: number; token: any;
}> = ({ label, value, total, icon, color, bg, border, index, token }) => {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    return (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.07, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}>
            <Card bordered={false} style={{
                borderRadius: 14, border: `1px solid ${border}`,
                background: token.colorBgContainer,
                boxShadow: `0 2px 12px ${token.colorFillSecondary}`,
                overflow: "hidden", position: "relative",
            }} bodyStyle={{ padding: "16px 18px" }}>
                <div style={{
                    position: "absolute", top: -16, right: -16, width: 60, height: 60,
                    borderRadius: "50%", background: color, opacity: 0.08,
                }} />
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                        background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                    }}>{icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 10, color: token.colorTextDescription, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", display: "block" }}>
                            {label}
                        </Text>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
                            <span style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>
                                <AnimatedNumber value={value} />
                            </span>
                        </div>
                    </div>
                    <div style={{
                        width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                        background: `conic-gradient(${color} ${pct * 3.6}deg, ${token.colorFillSecondary} 0deg)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                        <div style={{
                            width: 22, height: 22, borderRadius: "50%",
                            background: token.colorBgContainer,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 9, fontWeight: 800, color,
                        }}>{pct}%</div>
                    </div>
                </div>
                <div style={{ marginTop: 10, height: 3, borderRadius: 2, background: token.colorFillSecondary }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: index * 0.07 + 0.3 }}
                        style={{ height: "100%", borderRadius: 2, background: color }} />
                </div>
            </Card>
        </motion.div>
    );
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, token }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: token.colorBgElevated, border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 10, padding: "10px 14px", boxShadow: token.boxShadow,
        }}>
            <p style={{ color: token.colorTextDescription, margin: "0 0 6px", fontSize: 11 }}>{label}</p>
            {payload.map((p: any) => (
                <p key={p.dataKey} style={{ color: p.fill, margin: "2px 0", fontWeight: 600, fontSize: 12 }}>
                    {p.name}: <span style={{ color: token.colorText }}>{p.value}</span>
                </p>
            ))}
        </div>
    );
};

// ─── thStyle helper ───────────────────────────────────────────────────────────
const thStyle = (token: any): React.CSSProperties => ({
    padding: "10px 10px", fontSize: 11, fontWeight: 700,
    color: token.colorTextDescription, borderBottom: `1px solid ${token.colorBorderSecondary}`,
    whiteSpace: "nowrap" as const,
});

// ─── Main Component ───────────────────────────────────────────────────────────
export const MingguanList: React.FC = () => {
    const { token } = useToken();
    const isDark = hexLum(token.colorBgContainer) < 128;
    const { data: identity } = useGetIdentity<any>();

    const todayHijri = useMemo(() => getCurrentHijri(), []);
    const [tahun, setTahun] = useState(todayHijri.hy);
    const [bulan, setBulan] = useState(todayHijri.hm);
    const [mingguKe, setMingguKe] = useState(Math.min(Math.ceil(todayHijri.hd / 7), 4));
    const [showWeek5, setShowWeek5] = useState(false);
    const mingguMaxKe = showWeek5 ? 5 : 4;

    const [santriList, setSantriList] = useState<any[]>([]);
    const [sesiMap, setSesiMap] = useState<Record<string, string>>({});
    const [absensiGrid, setAbsensiGrid] = useState<
        Record<string, Record<string, { status: string | null; nilai_hafalan: number | null }>>
    >({});
    const [loading, setLoading] = useState(true);
    const [savingCell, setSavingCell] = useState<string | null>(null);
    const [fetchKey, setFetchKey] = useState(0);
    const [exportLoading, setExportLoading] = useState(false);
    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [selectedExportWeeks, setSelectedExportWeeks] = useState<number[]>([mingguKe]);
    const [exportTahun, setExportTahun] = useState(tahun);
    const [exportBulan, setExportBulan] = useState(bulan);

    const STATUS_ABSENSI = useMemo(() => getStatusConfig(token), [token]);
    const kegiatanList = KEGIATAN_MINGGUAN[mingguKe] || [];
    const bulanLabel = HIJRI_MONTHS[bulan - 1];

    // ── Fetch santri ───────────────────────────────────────────────────────────
    useEffect(() => {
        supabaseClient
            .from("santri")
            .select("nis, nama, kelas, total_hafalan, foto_url")
            .eq("jurusan", "TAHFIDZ").eq("status_santri", "AKTIF")
            .order("kelas").order("nama")
            .then(({ data, error }) => {
                if (error) { message.error("Gagal memuat data santri"); return; }
                setSantriList(data || []);
            });
    }, []);

    // ── Fetch or create sesi + absensi ─────────────────────────────────────────
    useEffect(() => {
        if (!tahun || !bulan || !mingguKe) return;
        setLoading(true);
        setSesiMap({});
        setAbsensiGrid({});

        (async () => {
            const sesiResult: Record<string, string> = {};
            const allKegiatan = KEGIATAN_MINGGUAN[mingguKe] || [];
            if (allKegiatan.length === 0) { setLoading(false); return; }

            const gregorian = hijriConverter.toGregorian(tahun, bulan, 1);
            const firstOfMonth = new Date(gregorian.gy, gregorian.gm - 1, gregorian.gd);
            const weekOffset = (mingguKe - 1) * 7;
            const sesiDate = new Date(firstOfMonth);
            sesiDate.setDate(firstOfMonth.getDate() + weekOffset);
            const tanggalStr = dayjs(sesiDate).format("YYYY-MM-DD");

            for (const kid of allKegiatan) {
                const { data: existing } = await supabaseClient
                    .from("mingguan_sesi").select("id")
                    .eq("kegiatan_id", kid).eq("bulan_hijriah", bulanLabel)
                    .eq("tahun_hijriah", tahun).eq("minggu_ke", mingguKe).limit(1);

                let sesi = existing && existing.length > 0 ? existing[0] : null;
                if (!sesi) {
                    const { data: newSesi } = await supabaseClient
                        .from("mingguan_sesi")
                        .insert({
                            kegiatan_id: kid, bulan_hijriah: bulanLabel, tahun_hijriah: tahun,
                            bulan_hijriah_number: bulan, minggu_ke: mingguKe,
                            tanggal: tanggalStr, created_by: identity?.id,
                        })
                        .select("id").single();
                    sesi = newSesi;
                }
                if (sesi) sesiResult[kid] = sesi.id;
            }
            setSesiMap(sesiResult);

            const sesiIds = Object.values(sesiResult);
            if (sesiIds.length === 0) { setLoading(false); return; }

            const { data: absensiData } = await supabaseClient
                .from("mingguan_absensi")
                .select("sesi_id, santri_nis, status, nilai_hafalan")
                .in("sesi_id", sesiIds);

            const grid: Record<string, Record<string, { status: string | null; nilai_hafalan: number | null }>> = {};
            (absensiData || []).forEach((a: any) => {
                if (!grid[a.santri_nis]) grid[a.santri_nis] = {};
                grid[a.santri_nis][a.sesi_id] = { status: a.status, nilai_hafalan: a.nilai_hafalan };
            });
            setAbsensiGrid(grid);
            setLoading(false);
        })();
    }, [tahun, bulan, mingguKe, identity?.id, fetchKey, bulanLabel]);

    // ── Handle status click ────────────────────────────────────────────────────
    const handleStatusClick = async (nis: string, sesiId: string, status: string) => {
        const cellKey = `${nis}_${sesiId}`;
        if (savingCell) return;
        setSavingCell(cellKey);
        try {
            if (status === "") {
                await supabaseClient.from("mingguan_absensi").delete()
                    .eq("sesi_id", sesiId).eq("santri_nis", nis);
                setAbsensiGrid(prev => {
                    const next = { ...prev, [nis]: { ...prev[nis] } };
                    delete next[nis][sesiId];
                    return next;
                });
            } else {
                await supabaseClient.from("mingguan_absensi").upsert(
                    { sesi_id: sesiId, santri_nis: nis, status, nilai_hafalan: null },
                    { onConflict: "sesi_id, santri_nis" }
                );
                setAbsensiGrid(prev => ({
                    ...prev,
                    [nis]: { ...prev[nis], [sesiId]: { status, nilai_hafalan: null } },
                }));
            }
        } catch { message.error("Gagal menyimpan"); }
        finally { setSavingCell(null); }
    };

    const yearOptions = useMemo(() => {
        const years: number[] = [];
        for (let y = todayHijri.hy - 2; y <= todayHijri.hy + 2; y++) years.push(y);
        return years;
    }, [todayHijri.hy]);

    // ── KPI stats ─────────────────────────────────────────────────────────────
    const weekStats = useMemo(() => {
        const counts: Record<string, number> = { HADIR: 0, SAKIT: 0, IZIN: 0, SEKOLAH: 0, GHAIB: 0, PULANG: 0 };
        const totalCells = santriList.length * kegiatanList.length;
        let filled = 0;

        santriList.forEach(s => {
            kegiatanList.forEach(kid => {
                const sesiId = sesiMap[kid];
                if (!sesiId) return;
                const st = absensiGrid[s.nis]?.[sesiId]?.status;
                if (st && counts[st] !== undefined) { counts[st]++; filled++; }
            });
        });

        const rate = totalCells > 0 ? Math.round((counts.HADIR / totalCells) * 100) : 0;
        return { counts, totalCells, filled, rate };
    }, [absensiGrid, santriList, kegiatanList, sesiMap]);

    // ── Per-kegiatan chart data ────────────────────────────────────────────────
    const kegiatanChartData = useMemo(() =>
        kegiatanList.map(kid => {
            const sesiId = sesiMap[kid];
            const row: Record<string, any> = { kegiatan: KEGIATAN_INFO[kid]?.icon + " " + KEGIATAN_INFO[kid]?.label };
            STATUS_ABSENSI.forEach(s => { row[s.label] = 0; });
            if (sesiId) {
                santriList.forEach(s => {
                    const st = absensiGrid[s.nis]?.[sesiId]?.status;
                    if (st) {
                        const found = STATUS_ABSENSI.find(x => x.key === st);
                        if (found) row[found.label]++;
                    }
                });
            }
            return row;
        }),
        [kegiatanList, sesiMap, absensiGrid, santriList, STATUS_ABSENSI]
    );

    // ── Donut data ────────────────────────────────────────────────────────────
    const donutData = useMemo(() =>
        STATUS_ABSENSI
            .map(s => ({ name: s.label, value: weekStats.counts[s.key] ?? 0, color: s.color, icon: s.icon }))
            .filter(d => d.value > 0),
        [weekStats, STATUS_ABSENSI]
    );

    // ── Per-santri summary ─────────────────────────────────────────────────────
    const getSantriSummary = (nis: string) => {
        const counts: Record<string, number> = { HADIR: 0, SAKIT: 0, IZIN: 0, SEKOLAH: 0, GHAIB: 0, PULANG: 0 };
        kegiatanList.forEach(kid => {
            const sesiId = sesiMap[kid];
            if (!sesiId) return;
            const st = absensiGrid[nis]?.[sesiId]?.status;
            if (st && counts[st] !== undefined) counts[st]++;
        });
        return counts;
    };

    // ── Excel Export ──────────────────────────────────────────────────────────
    const handleExport = async (weekNumbers: number[]) => {
        if (weekNumbers.length === 0) { message.warning("Pilih minimal satu minggu"); return; }
        setExportLoading(true);
        setExportModalOpen(false);

        try {
            const expBulanLabel = HIJRI_MONTHS[exportBulan - 1];

            const { data: santriData } = await supabaseClient
                .from("santri").select("nis, nama, kelas, total_hafalan")
                .eq("jurusan", "TAHFIDZ").eq("status_santri", "AKTIF")
                .order("kelas").order("nama");
            const santriListData = santriData || [];

            // Fetch sesi per week
            type WeekBundle = { mingguKe: number; kegiatan: string[]; sesiRecords: any[] };
            const weekBundles: WeekBundle[] = [];

            for (const mg of weekNumbers) {
                const kegiatan = KEGIATAN_MINGGUAN[mg] || [];
                const { data: sesiRecords } = await supabaseClient
                    .from("mingguan_sesi").select("id, kegiatan_id, minggu_ke, tanggal")
                    .eq("tahun_hijriah", exportTahun)
                    .eq("bulan_hijriah_number", exportBulan)
                    .eq("minggu_ke", mg)
                    .in("kegiatan_id", kegiatan)
                    .order("kegiatan_id");
                weekBundles.push({ mingguKe: mg, kegiatan, sesiRecords: sesiRecords || [] });
            }

            // Fetch all absensi
            const allSesiIds = weekBundles.flatMap(wb => wb.sesiRecords.map(s => s.id));
            const absensiMap: Record<string, Record<string, any>> = {};
            if (allSesiIds.length > 0) {
                const { data: absData } = await supabaseClient
                    .from("mingguan_absensi").select("sesi_id, santri_nis, status")
                    .in("sesi_id", allSesiIds);
                (absData || []).forEach((a: any) => {
                    if (!absensiMap[a.sesi_id]) absensiMap[a.sesi_id] = {};
                    absensiMap[a.sesi_id][a.santri_nis] = a;
                });
            }

            // ── Build workbook ────────────────────────────────────────────────
            const wb = new ExcelJS.Workbook();
            wb.creator = "Al-Hasanah Admin";
            wb.created = new Date();

            const multiWeek = weekBundles.length > 1;
            const COLS_BASE = 3;       // No | Nama | Kelas
            const COLS_STATS = 4;      // H | S | I | GH per week
            const COLS_RECAP = 4;      // Σ per month (only if multi-week)

            // Compute column counts per week
            const colsPerWeek = (wb_: WeekBundle) => wb_.kegiatan.length + COLS_STATS;
            const totalCols = COLS_BASE
                + weekBundles.reduce((a, wb_) => a + colsPerWeek(wb_), 0)
                + (multiWeek ? COLS_RECAP : 0);

            const ws = wb.addWorksheet("Absensi Mingguan", {
                pageSetup: { fitToPage: true, fitToWidth: 1, orientation: "landscape" },
                views: [{ state: "frozen", xSplit: 3, ySplit: 4, activeCell: "D5" }],
            });

            // ── Row 1: Title ──────────────────────────────────────────────────
            ws.mergeCells(`A1:${colLetter(totalCols)}1`);
            const wkLabel = weekNumbers.length >= mingguMaxKe ? "Seluruh Minggu" : `Minggu ${weekNumbers.join(", ")}`;
            ws.getCell("A1").value = `ABSENSI MINGGUAN TAHFIDZ — ${expBulanLabel.toUpperCase()} ${exportTahun} H  |  ${wkLabel}`;
            ws.getCell("A1").font = { size: 14, bold: true, color: { argb: "FFFFFFFF" }, name: "Calibri" };
            ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7C3AED" } };
            ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
            ws.getRow(1).height = 26;

            // ── Row 2: Metadata ───────────────────────────────────────────────
            ws.mergeCells(`A2:${colLetter(totalCols)}2`);
            ws.getCell("A2").value = `Dicetak: ${dayjs().format("DD MMMM YYYY, HH:mm")}  |  Total Santri: ${santriListData.length}`;
            ws.getCell("A2").font = { size: 9, italic: true, color: { argb: "FF6B7280" }, name: "Calibri" };
            ws.getCell("A2").alignment = { horizontal: "center" };
            ws.getRow(2).height = 16;

            // ── Row 3: Week group headers ─────────────────────────────────────
            const grpValues: any[] = ["", "", ""];
            let gCol = COLS_BASE + 1;

            weekBundles.forEach(wb_ => {
                const tanggal = wb_.sesiRecords[0]?.tanggal;
                const dateStr = tanggal ? dayjs(tanggal).format("DD/MM/YYYY") : "–";
                grpValues.push(`MINGGU KE-${wb_.mingguKe}  (${expBulanLabel} ${exportTahun} H · ${dateStr})`);
                for (let i = 1; i < colsPerWeek(wb_); i++) grpValues.push("");
            });
            if (multiWeek) {
                grpValues.push("REKAP SELURUH MINGGU DIPILIH");
                for (let i = 1; i < COLS_RECAP; i++) grpValues.push("");
            }

            const grpRow = ws.getRow(3);
            grpRow.values = grpValues;
            grpRow.height = 22;

            weekBundles.forEach(wb_ => {
                ws.mergeCells(`${colLetter(gCol)}3:${colLetter(gCol + colsPerWeek(wb_) - 1)}3`);
                const cell = grpRow.getCell(gCol);
                cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" }, name: "Calibri" };
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC9A84C" } };
                cell.alignment = { horizontal: "center", vertical: "middle" };
                gCol += colsPerWeek(wb_);
            });
            if (multiWeek) {
                ws.mergeCells(`${colLetter(gCol)}3:${colLetter(gCol + COLS_RECAP - 1)}3`);
                const rc = grpRow.getCell(gCol);
                rc.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" }, name: "Calibri" };
                rc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
                rc.alignment = { horizontal: "center", vertical: "middle" };
            }

            // ── Row 4: Sub-headers ────────────────────────────────────────────
            const subValues: any[] = ["NO", "NAMA SANTRI", "KELAS"];
            weekBundles.forEach(wb_ => {
                wb_.kegiatan.forEach(kid => {
                    const info = KEGIATAN_INFO[kid];
                    subValues.push(`${info?.icon ?? ""} ${info?.label ?? kid}`);
                });
                subValues.push("H", "S", "I", "GH");
            });
            if (multiWeek) subValues.push("∑H", "∑S", "∑I", "∑GH");

            const subRow = ws.getRow(4);
            subRow.values = subValues;
            subRow.height = 36;
            subRow.eachCell((cell: any, colNum: number) => {
                cell.font = { bold: true, size: 8, name: "Calibri" };
                cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colNum > COLS_BASE ? "FFEFF6FF" : "FFF9FAFB" } };
                cell.border = {
                    top: { style: "thin", color: { argb: "FFD1D5DB" } },
                    bottom: { style: "medium", color: { argb: "FF9CA3AF" } },
                    left: { style: "thin", color: { argb: "FFD1D5DB" } },
                    right: { style: "thin", color: { argb: "FFD1D5DB" } },
                };
            });

            // Colour each kegiatan sub-header cell
            let headerCol = COLS_BASE + 1;
            weekBundles.forEach(wb_ => {
                wb_.kegiatan.forEach(kid => {
                    const c = ws.getRow(4).getCell(headerCol);
                    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: KEGIATAN_EXCEL_COLORS[kid] ?? "FF6B7280" } };
                    c.font = { bold: true, size: 8, color: { argb: "FFFFFFFF" }, name: "Calibri" };
                    headerCol++;
                });
                headerCol += COLS_STATS;
            });

            // ── Column widths ─────────────────────────────────────────────────
            ws.columns = [
                { key: "no", width: 5 },
                { key: "nama", width: 26 },
                { key: "kelas", width: 8 },
                ...weekBundles.flatMap(wb_ => [
                    ...wb_.kegiatan.map(() => ({ key: "", width: 12 })),
                    { key: "", width: 6 }, { key: "", width: 6 }, { key: "", width: 6 }, { key: "", width: 6 },
                ]),
                ...(multiWeek ? [
                    { key: "", width: 7 }, { key: "", width: 7 }, { key: "", width: 7 }, { key: "", width: 7 },
                ] : []),
            ];

            // ── Per-week grand totals (for footer rows) ───────────────────────
            type WeekTally = { H: number; S: number; I: number; GH: number };
            const perWeekTotals: WeekTally[] = weekBundles.map(() => ({ H: 0, S: 0, I: 0, GH: 0 }));
            const recapTotals: WeekTally = { H: 0, S: 0, I: 0, GH: 0 };

            // ── Data rows ─────────────────────────────────────────────────────
            santriListData.forEach((s: any, idx: number) => {
                const rv: any[] = [idx + 1, s.nama || santriAlias(s.nis), s.kelas ?? "–"];
                const weekCounts: WeekTally[] = weekBundles.map(() => ({ H: 0, S: 0, I: 0, GH: 0 }));

                weekBundles.forEach((wb_, wi) => {
                    wb_.kegiatan.forEach(kid => {
                        const sesiRec = wb_.sesiRecords.find(sr => sr.kegiatan_id === kid);
                        const st = sesiRec ? absensiMap[sesiRec.id]?.[s.nis]?.status : undefined;
                        const code = st === "HADIR" ? "H" : st === "SAKIT" ? "S" : st === "IZIN" ? "I"
                            : st === "SEKOLAH" ? "Sk" : st === "GHAIB" ? "GH" : st === "PULANG" ? "P" : "";
                        rv.push(code);
                        if (st === "HADIR") weekCounts[wi].H++;
                        else if (st === "SAKIT") weekCounts[wi].S++;
                        else if (st === "IZIN") weekCounts[wi].I++;
                        else if (st === "GHAIB" || st === "PULANG") weekCounts[wi].GH++;
                    });
                    rv.push(weekCounts[wi].H || "", weekCounts[wi].S || "", weekCounts[wi].I || "", weekCounts[wi].GH || "");
                    perWeekTotals[wi].H += weekCounts[wi].H;
                    perWeekTotals[wi].S += weekCounts[wi].S;
                    perWeekTotals[wi].I += weekCounts[wi].I;
                    perWeekTotals[wi].GH += weekCounts[wi].GH;
                });

                if (multiWeek) {
                    const totH = weekCounts.reduce((a, c) => a + c.H, 0);
                    const totS = weekCounts.reduce((a, c) => a + c.S, 0);
                    const totI = weekCounts.reduce((a, c) => a + c.I, 0);
                    const totGH = weekCounts.reduce((a, c) => a + c.GH, 0);
                    rv.push(totH || "", totS || "", totI || "", totGH || "");
                    recapTotals.H += totH; recapTotals.S += totS;
                    recapTotals.I += totI; recapTotals.GH += totGH;
                }

                const dataRow = ws.addRow(rv);
                const isEven = idx % 2 === 1;
                dataRow.height = 18;
                dataRow.eachCell((cell: any, colNum: number) => {
                    cell.font = { size: 9, name: "Calibri" };
                    cell.alignment = { horizontal: colNum <= 2 ? "left" : "center", vertical: "middle" };
                    if (isEven) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
                    cell.border = { bottom: { style: "hair", color: { argb: "FFE5E7EB" } } };
                });

                // Color-fill status cells
                let ci = COLS_BASE + 1;
                weekBundles.forEach(wb_ => {
                    wb_.kegiatan.forEach(kid => {
                        const sesiRec = wb_.sesiRecords.find(sr => sr.kegiatan_id === kid);
                        const st = sesiRec ? absensiMap[sesiRec.id]?.[s.nis]?.status : undefined;
                        if (st) {
                            const fill = STATUS_FILLS[st];
                            if (fill) dataRow.getCell(ci).fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
                        }
                        ci++;
                    });
                    ci += COLS_STATS;
                });
            });

            // ── Subtotal rows per week ─────────────────────────────────────────
            ws.addRow([]);
            weekBundles.forEach((wb_, wi) => {
                const stRow: any[] = ["", `→ Subtotal Minggu ke-${wb_.mingguKe}`, ""];
                weekBundles.forEach((_, wj) => {
                    for (let k = 0; k < weekBundles[wj].kegiatan.length; k++) stRow.push("");
                    if (wj === wi) {
                        stRow.push(perWeekTotals[wj].H || "", perWeekTotals[wj].S || "", perWeekTotals[wj].I || "", perWeekTotals[wj].GH || "");
                    } else { stRow.push("", "", "", ""); }
                });
                if (multiWeek) stRow.push("", "", "", "");

                const sr = ws.addRow(stRow);
                sr.height = 17;
                sr.eachCell((cell: any, colNum: number) => {
                    cell.font = { bold: true, italic: true, size: 9, name: "Calibri", color: { argb: "FF374151" } };
                    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7ED" } };
                    cell.alignment = { horizontal: colNum <= 2 ? "left" : "center", vertical: "middle" };
                });
            });

            // ── Grand total row ────────────────────────────────────────────────
            if (multiWeek) {
                ws.addRow([]);
                const totRow: any[] = ["", "✦ TOTAL KESELURUHAN", ""];
                weekBundles.forEach((wb_, wi) => {
                    for (let k = 0; k < wb_.kegiatan.length; k++) totRow.push("");
                    totRow.push(perWeekTotals[wi].H || "", perWeekTotals[wi].S || "", perWeekTotals[wi].I || "", perWeekTotals[wi].GH || "");
                });
                totRow.push(recapTotals.H || "", recapTotals.S || "", recapTotals.I || "", recapTotals.GH || "");
                const gRow = ws.addRow(totRow);
                gRow.height = 20;
                gRow.eachCell((cell: any, colNum: number) => {
                    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" }, name: "Calibri" };
                    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
                    cell.alignment = { horizontal: colNum <= 2 ? "left" : "center", vertical: "middle" };
                });
            }

            ws.autoFilter = { from: "A4", to: `${colLetter(totalCols)}4` };

            const buffer = await wb.xlsx.writeBuffer();
            const wkStr = weekNumbers.length >= mingguMaxKe ? "SemuaMinggu" : `Mg${weekNumbers.join("_")}`;
            saveAs(new Blob([buffer]), `AbsensiMingguan_${HIJRI_MONTHS[exportBulan - 1]}_${exportTahun}H_${wkStr}_${dayjs().format("YYYYMMDD")}.xlsx`);
            message.success("✅ File Excel berhasil diunduh");
        } catch (err: any) {
            message.error("Gagal export: " + err.message);
        } finally {
            setExportLoading(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div style={{ padding: "0 0 80px", background: token.colorBgLayout, minHeight: "100vh" }}>

            {/* ── Page Header ───────────────────────────────────────────────── */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
                style={{ padding: "24px 24px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{
                        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                        background: `linear-gradient(135deg, ${token.colorPrimary}, ${token.colorPrimaryActive})`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 22, boxShadow: `0 4px 14px ${token.colorPrimary}44`,
                    }}>📋</div>
                    <div>
                        <Title level={4} style={{ margin: 0, lineHeight: 1.15, fontSize: 19, fontWeight: 800 }}>
                            Absensi Mingguan Tahfidz
                        </Title>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            {bulanLabel} {tahun} H · Minggu ke-{mingguKe} · {kegiatanList.length} kegiatan aktif
                        </Text>
                    </div>
                </div>
                <Space wrap>
                    <Button icon={<ReloadOutlined />} onClick={() => setFetchKey(k => k + 1)} />
                    <Button
                        icon={<FileExcelOutlined />} loading={exportLoading}
                        onClick={() => {
                            setExportTahun(tahun); setExportBulan(bulan);
                            setSelectedExportWeeks([mingguKe]); setExportModalOpen(true);
                        }}
                        style={{ color: token.colorSuccess, borderColor: token.colorSuccessBorder, fontWeight: 600 }}
                    >
                        Export Excel
                    </Button>
                    <Button
                        type="primary" icon={<CalendarOutlined />}
                        onClick={() => {
                            const h = getCurrentHijri();
                            setTahun(h.hy); setBulan(h.hm);
                            setMingguKe(Math.min(Math.ceil(h.hd / 7), 4));
                        }}
                        style={{
                            background: `linear-gradient(135deg, ${token.colorPrimary}, ${token.colorPrimaryActive})`,
                            border: "none", fontWeight: 600,
                            boxShadow: `0 4px 12px ${token.colorPrimary}44`,
                        }}
                    >
                        Bulan Ini
                    </Button>
                </Space>
            </motion.div>

            <div style={{ padding: "0 24px" }}>

                {/* ── Filter Bar ──────────────────────────────────────────────── */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.35 }}>
                    <Card bordered={false} style={{
                        borderRadius: 14, border: `1px solid ${token.colorBorderSecondary}`,
                        boxShadow: `0 1px 4px ${token.colorFillSecondary}`, marginBottom: 20,
                    }} bodyStyle={{ padding: "14px 20px" }}>
                        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <CalendarOutlined style={{ color: token.colorPrimary, fontSize: 14 }} />
                                <Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>Tahun:</Text>
                                <Select value={tahun} size="small" onChange={setTahun}
                                    options={yearOptions.map(y => ({ label: `${y} H`, value: y }))} style={{ width: 100 }} />
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>Bulan:</Text>
                                <Select value={bulan} size="small"
                                    onChange={v => { setBulan(v); setMingguKe(1); }}
                                    options={HIJRI_MONTHS.map((name, i) => ({ label: name, value: i + 1 }))}
                                    style={{ width: 148 }} />
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>Minggu:</Text>
                                <Segmented value={mingguKe} size="small"
                                    onChange={v => setMingguKe(v as number)}
                                    options={Array.from({ length: mingguMaxKe }, (_, i) => ({ label: `Mg ${i + 1}`, value: i + 1 }))} />
                                {!showWeek5 && (
                                    <Button type="dashed" size="small" icon={<PlusOutlined />}
                                        onClick={() => { setShowWeek5(true); setMingguKe(5); }}
                                        style={{ borderRadius: 6, fontSize: 11, height: 24, padding: "0 8px" }}>
                                        Mg 5
                                    </Button>
                                )}
                            </div>
                        </div>
                        {/* Kegiatan tags */}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                            {kegiatanList.map(kid => {
                                const info = KEGIATAN_INFO[kid];
                                const color = (token as any)[info?.tokenColorKey ?? "colorPrimary"];
                                return (
                                    <Tag key={kid} style={{
                                        fontSize: 11, padding: "4px 12px", borderRadius: 8,
                                        background: `${color}15`,
                                        color, border: `1px solid ${color}44`, fontWeight: 600,
                                    }}>
                                        {info?.icon} {info?.label}
                                    </Tag>
                                );
                            })}
                        </div>
                    </Card>
                </motion.div>

                {/* ── KPI Cards ──────────────────────────────────────────────── */}
                {!loading && weekStats.totalCells > 0 && (
                    <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
                        {/* Completion card */}
                        <Col xs={12} sm={8} lg={4}>
                            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
                                <Card bordered={false} style={{
                                    borderRadius: 14, border: `1px solid ${token.colorBorderSecondary}`,
                                    background: token.colorBgContainer, boxShadow: `0 2px 12px ${token.colorFillSecondary}`,
                                }} bodyStyle={{ padding: "16px 18px" }}>
                                    <Text style={{ fontSize: 10, color: token.colorTextDescription, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", display: "block" }}>
                                        Terisi
                                    </Text>
                                    <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 4 }}>
                                        <span style={{ fontSize: 24, fontWeight: 800, color: token.colorText, lineHeight: 1 }}>
                                            <AnimatedNumber value={weekStats.filled} />
                                        </span>
                                        <span style={{ fontSize: 12, color: token.colorTextDescription }}>/{weekStats.totalCells}</span>
                                    </div>
                                    <Text style={{ fontSize: 10, color: token.colorTextDescription, marginTop: 4, display: "block" }}>
                                        {weekStats.rate}% input terisi
                                    </Text>
                                    <div style={{ marginTop: 8, height: 3, borderRadius: 2, background: token.colorFillSecondary }}>
                                        <motion.div
                                            initial={{ width: 0 }} animate={{ width: `${weekStats.rate}%` }}
                                            transition={{ duration: 0.8, ease: "easeOut" }}
                                            style={{ height: "100%", borderRadius: 2, background: token.colorPrimary }} />
                                    </div>
                                </Card>
                            </motion.div>
                        </Col>
                        {STATUS_ABSENSI.map((s, i) => (
                            <Col xs={12} sm={8} lg={4} key={s.key}>
                                <KpiCard
                                    label={s.label} value={weekStats.counts[s.key] ?? 0}
                                    total={weekStats.totalCells} icon={s.icon}
                                    color={s.color} bg={s.bg} border={s.border}
                                    index={i + 1} token={token}
                                />
                            </Col>
                        ))}
                    </Row>
                )}

                {/* ── Alert ──────────────────────────────────────────────────── */}
                <AnimatePresence>
                    {!loading && weekStats.rate < 70 && weekStats.filled > 0 && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ marginBottom: 16 }}>
                            <Alert type="warning" showIcon icon={<WarningOutlined />}
                                message={`Tingkat kehadiran minggu ini ${weekStats.rate}% — di bawah target. Harap ditindaklanjuti.`}
                                style={{ borderRadius: 10 }} />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Charts ─────────────────────────────────────────────────── */}
                {!loading && weekStats.totalCells > 0 && (
                    <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                        {/* Grouped bar: per-kegiatan */}
                        <Col xs={24} lg={15}>
                            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.38, delay: 0.1 }}>
                                <Card bordered={false} style={{
                                    borderRadius: 16, border: `1px solid ${token.colorBorderSecondary}`,
                                    boxShadow: `0 1px 4px ${token.colorFillSecondary}`,
                                }} bodyStyle={{ padding: "18px 20px 12px" }}>
                                    <Space size={8} style={{ marginBottom: 4 }}>
                                        <BarChartOutlined style={{ color: token.colorPrimary }} />
                                        <Text strong style={{ fontSize: 13 }}>Kehadiran Per Kegiatan — Minggu ke-{mingguKe}</Text>
                                    </Space>
                                    <div style={{ fontSize: 11, color: token.colorTextDescription, marginBottom: 14 }}>
                                        Distribusi status per kegiatan dalam minggu ini
                                    </div>
                                    <ResponsiveContainer width="100%" height={190}>
                                        <BarChart data={kegiatanChartData} barSize={13} barGap={2}
                                            margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke={token.colorBorderSecondary} vertical={false} />
                                            <XAxis dataKey="kegiatan" tick={{ fontSize: 10, fill: token.colorTextDescription }} axisLine={false} tickLine={false} />
                                            <YAxis tick={{ fontSize: 10, fill: token.colorTextDescription }} axisLine={false} tickLine={false} allowDecimals={false} />
                                            <ReTooltip content={(p) => <CustomTooltip {...p} token={token} />} cursor={{ fill: token.colorFillSecondary }} />
                                            {STATUS_ABSENSI.map(s => (
                                                <Bar key={s.key} dataKey={s.label} fill={s.color} radius={[3, 3, 0, 0]} />
                                            ))}
                                        </BarChart>
                                    </ResponsiveContainer>
                                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center", marginTop: 6 }}>
                                        {STATUS_ABSENSI.map(s => (
                                            <Space key={s.key} size={5}>
                                                <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
                                                <Text style={{ fontSize: 11, color: token.colorTextDescription }}>{s.label}</Text>
                                            </Space>
                                        ))}
                                    </div>
                                </Card>
                            </motion.div>
                        </Col>

                        {/* Donut */}
                        <Col xs={24} lg={9}>
                            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.38, delay: 0.18 }} style={{ height: "100%" }}>
                                <Card bordered={false} style={{
                                    borderRadius: 16, border: `1px solid ${token.colorBorderSecondary}`,
                                    boxShadow: `0 1px 4px ${token.colorFillSecondary}`, height: "100%",
                                }} bodyStyle={{ padding: "18px 20px" }}>
                                    <Space size={8} style={{ marginBottom: 2 }}>
                                        <TeamOutlined style={{ color: token.colorPrimary }} />
                                        <Text strong style={{ fontSize: 13 }}>Komposisi Status</Text>
                                    </Space>
                                    <div style={{ fontSize: 11, color: token.colorTextDescription, marginBottom: 10 }}>
                                        Distribusi kehadiran minggu ini
                                    </div>
                                    {donutData.length > 0 ? (
                                        <>
                                            <div style={{ position: "relative" }}>
                                                <ResponsiveContainer width="100%" height={140}>
                                                    <PieChart>
                                                        <Pie data={donutData} cx="50%" cy="50%" innerRadius={40} outerRadius={62}
                                                            paddingAngle={3} dataKey="value" stroke="none">
                                                            {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                                                        </Pie>
                                                        <ReTooltip
                                                            formatter={(v: any, n: any) => [`${v} santri`, n]}
                                                            contentStyle={{
                                                                background: token.colorBgElevated,
                                                                border: `1px solid ${token.colorBorderSecondary}`,
                                                                borderRadius: 8, fontSize: 11,
                                                            }}
                                                        />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                                <div style={{
                                                    position: "absolute", top: "50%", left: "50%",
                                                    transform: "translate(-50%, -50%)", textAlign: "center", pointerEvents: "none",
                                                }}>
                                                    <div style={{ fontSize: 20, fontWeight: 800, color: token.colorSuccess, lineHeight: 1 }}>
                                                        {weekStats.rate}%
                                                    </div>
                                                    <div style={{ fontSize: 9, color: token.colorTextDescription, marginTop: 2 }}>hadir</div>
                                                </div>
                                            </div>
                                            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                                                {donutData.map(d => (
                                                    <div key={d.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                                        <Space size={6}>
                                                            <span style={{ fontSize: 13 }}>{d.icon}</span>
                                                            <Text style={{ fontSize: 12, color: token.colorText }}>{d.name}</Text>
                                                        </Space>
                                                        <Space size={8}>
                                                            <Text style={{ fontSize: 12, fontWeight: 700, color: d.color }}>{d.value}</Text>
                                                            <Text style={{ fontSize: 10, color: token.colorTextDescription }}>
                                                                ({weekStats.totalCells > 0 ? Math.round((d.value / weekStats.totalCells) * 100) : 0}%)
                                                            </Text>
                                                        </Space>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{ textAlign: "center", padding: "30px 0", color: token.colorTextDescription, fontSize: 12 }}>
                                            Belum ada data absensi minggu ini
                                        </div>
                                    )}
                                </Card>
                            </motion.div>
                        </Col>
                    </Row>
                )}

                {/* ── Main Table ─────────────────────────────────────────────── */}
                <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22, duration: 0.38 }}>
                    <Card bordered={false} style={{
                        borderRadius: 16, border: `1px solid ${token.colorBorderSecondary}`,
                        overflow: "hidden", boxShadow: `0 1px 4px ${token.colorFillSecondary}`,
                    }} bodyStyle={{ padding: 0 }}>

                        {/* Table Header Bar */}
                        <div style={{
                            padding: "14px 20px", borderBottom: `1px solid ${token.colorBorderSecondary}`,
                            background: token.colorFillAlter,
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                        }}>
                            <Space size={10}>
                                <Badge count={weekStats.counts.GHAIB + weekStats.counts.PULANG} overflowCount={999}
                                    style={{ background: token.colorError }} offset={[4, 0]}>
                                    <BookOutlined style={{ color: token.colorPrimary, fontSize: 16 }} />
                                </Badge>
                                <div>
                                    <Text strong style={{ fontSize: 13 }}>{bulanLabel} {tahun} H — Minggu ke-{mingguKe}</Text>
                                    <Text type="secondary" style={{ fontSize: 11, marginLeft: 10 }}>{santriList.length} santri</Text>
                                </div>
                            </Space>
                            <Space size={6}>
                                {STATUS_ABSENSI.map(s => (
                                    <AntTooltip key={s.key} title={`${s.label}: ${weekStats.counts[s.key] ?? 0}`}>
                                        <Tag style={{
                                            background: s.bg, border: `1px solid ${s.border}`,
                                            color: s.color, borderRadius: 8,
                                            fontSize: 11, fontWeight: 700, cursor: "default",
                                        }}>
                                            {s.icon} {weekStats.counts[s.key] ?? 0}
                                        </Tag>
                                    </AntTooltip>
                                ))}
                                <Text type="secondary" style={{ fontSize: 11, paddingLeft: 4 }}>Klik ▾ untuk ubah</Text>
                            </Space>
                        </div>

                        {loading ? (
                            <div style={{ padding: "60px 20px", textAlign: "center" }}>
                                <Spin size="large" />
                                <div style={{ marginTop: 12, color: token.colorTextDescription, fontSize: 13 }}>Memuat data absensi...</div>
                            </div>
                        ) : kegiatanList.length === 0 ? (
                            <div style={{ padding: "60px 20px", textAlign: "center", color: token.colorTextDescription }}>
                                <InfoCircleOutlined style={{ fontSize: 32, marginBottom: 12 }} />
                                <div style={{ fontSize: 14, fontWeight: 600 }}>Tidak ada kegiatan untuk minggu ini</div>
                            </div>
                        ) : (
                            <div style={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                                    <thead>
                                        <tr style={{ background: token.colorFillAlter }}>
                                            <th style={{ ...thStyle(token), width: 36, textAlign: "center" }}>#</th>
                                            <th style={{ ...thStyle(token), width: 190, textAlign: "left" }}>Santri</th>
                                            <th style={{ ...thStyle(token), width: 46, textAlign: "center" }}>Kls</th>
                                            {kegiatanList.map(kid => {
                                                const info = KEGIATAN_INFO[kid];
                                                const color = (token as any)[info?.tokenColorKey ?? "colorPrimary"];
                                                const bgColor = (token as any)[(info?.tokenColorKey ?? "colorPrimary") + "Bg"];
                                                const borderColor = (token as any)[(info?.tokenColorKey ?? "colorPrimary") + "Border"];
                                                return (
                                                    <th key={kid} style={{
                                                        ...thStyle(token),
                                                        textAlign: "center", minWidth: 130,
                                                        background: bgColor,
                                                        borderBottom: `2px solid ${borderColor}`,
                                                        color,
                                                    }}>
                                                        <div style={{ fontWeight: 700, fontSize: 13 }}>{info?.icon} {info?.label}</div>
                                                    </th>
                                                );
                                            })}
                                            {/* Summary columns */}
                                            <th colSpan={STATUS_ABSENSI.length} style={{
                                                ...thStyle(token),
                                                textAlign: "center", background: token.colorPrimaryBg,
                                                borderBottom: `2px solid ${token.colorPrimaryBorder}`,
                                                color: token.colorPrimary, fontSize: 10,
                                                fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                                            }}>
                                                Rekap Minggu
                                            </th>
                                        </tr>
                                        {/* Sub-header for summary */}
                                        <tr style={{ background: token.colorPrimaryBg }}>
                                            <th colSpan={3} />
                                            {kegiatanList.map(kid => <th key={kid} />)}
                                            {STATUS_ABSENSI.map(s => (
                                                <th key={s.key} style={{
                                                    padding: "5px 6px", textAlign: "center",
                                                    fontSize: 11, fontWeight: 800, color: s.color,
                                                    borderBottom: `1px solid ${token.colorBorderSecondary}`,
                                                    width: 36,
                                                }}>
                                                    {s.code}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {santriList.map((santri: any, idx: number) => {
                                            const santriAbsensi = absensiGrid[santri.nis] || {};
                                            const summary = getSantriSummary(santri.nis);
                                            const isEven = idx % 2 === 0;

                                            return (
                                                <tr key={santri.nis} style={{
                                                    background: isEven ? token.colorBgContainer : token.colorFillAlter,
                                                    borderBottom: `1px solid ${token.colorBorderSecondary}`,
                                                }}>
                                                    <td style={{ padding: "8px 10px", fontSize: 11, color: token.colorTextDescription, textAlign: "center" }}>{idx + 1}</td>
                                                    <td style={{ padding: "8px 12px" }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                                                            <Avatar src={santri.foto_url} size={30} icon={<UserOutlined />}
                                                                style={{ background: token.colorPrimary, color: "#fff", flexShrink: 0 }} />
                                                            <div style={{ minWidth: 0 }}>
                                                                <div style={{ fontWeight: 600, fontSize: 12, color: token.colorText, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 }}>
                                                                    {santri.nama || santriAlias(santri.nis)}
                                                                </div>
                                                                <code style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: token.colorFillSecondary, color: token.colorTextDescription }}>
                                                                    {santri.nis}
                                                                </code>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: "8px 10px", textAlign: "center" }}>
                                                        <div style={{
                                                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                                                            width: 24, height: 24, borderRadius: 6, fontWeight: 800, fontSize: 11,
                                                            background: token.colorInfoBg, color: token.colorInfo,
                                                        }}>{santri.kelas}</div>
                                                    </td>

                                                    {/* Kegiatan cells — Dropdown (same pattern as Ngaji) */}
                                                    {kegiatanList.map(kid => {
                                                        const sesiId = sesiMap[kid];
                                                        const cellKey = `${santri.nis}_${sesiId}`;
                                                        const isSaving = savingCell === cellKey;
                                                        const rec = sesiId ? santriAbsensi[sesiId] : undefined;
                                                        const currentStatus = rec?.status || "";
                                                        const statusCfg = STATUS_ABSENSI.find(s => s.key === currentStatus);

                                                        return (
                                                            <td key={kid} style={{ padding: "5px 8px", textAlign: "center" }}>
                                                                <Dropdown
                                                                    menu={{
                                                                        items: [
                                                                            ...STATUS_ABSENSI.map(s => ({
                                                                                key: s.key,
                                                                                icon: <span>{s.icon}</span>,
                                                                                label: (
                                                                                    <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minWidth: 90 }}>
                                                                                        {s.label}
                                                                                        {currentStatus === s.key && <CheckOutlined style={{ color: token.colorSuccess, fontSize: 11 }} />}
                                                                                    </span>
                                                                                ),
                                                                            })),
                                                                            { type: "divider" as const },
                                                                            { key: "", icon: <CloseCircleOutlined />, label: "Hapus / Kosongkan", danger: true },
                                                                        ],
                                                                        onClick: ({ key: k }) => {
                                                                            if (!sesiId || isSaving) return;
                                                                            handleStatusClick(santri.nis, sesiId, currentStatus === k ? "" : k);
                                                                        },
                                                                    }}
                                                                    trigger={["click"]}
                                                                    disabled={!sesiId || isSaving}
                                                                >
                                                                    <div style={{
                                                                        cursor: !sesiId || isSaving ? "not-allowed" : "pointer",
                                                                        margin: "0 auto",
                                                                        minWidth: 80, minHeight: 32,
                                                                        display: "flex", alignItems: "center", justifyContent: "center",
                                                                        borderRadius: 8, gap: 5,
                                                                        border: `1.5px solid ${statusCfg ? statusCfg.border : token.colorBorderSecondary}`,
                                                                        background: statusCfg ? statusCfg.bg : "transparent",
                                                                        color: statusCfg ? statusCfg.color : token.colorTextDisabled,
                                                                        fontWeight: statusCfg ? 700 : 400,
                                                                        fontSize: 11,
                                                                        opacity: isSaving ? 0.5 : 1,
                                                                        transition: "all 0.12s",
                                                                        userSelect: "none",
                                                                        paddingLeft: 8, paddingRight: 8,
                                                                    }}>
                                                                        {isSaving ? (
                                                                            <Spin size="small" />
                                                                        ) : statusCfg ? (
                                                                            <>{statusCfg.icon} {statusCfg.label}</>
                                                                        ) : (
                                                                            <span style={{ fontSize: 14, color: token.colorBorderSecondary }}>–</span>
                                                                        )}
                                                                    </div>
                                                                </Dropdown>
                                                            </td>
                                                        );
                                                    })}

                                                    {/* Per-santri summary cells */}
                                                    {STATUS_ABSENSI.map(s => {
                                                        const v = summary[s.key] ?? 0;
                                                        return (
                                                            <td key={s.key} style={{ padding: "5px 4px", textAlign: "center" }}>
                                                                <div style={{
                                                                    width: 28, height: 28, borderRadius: 7, margin: "0 auto",
                                                                    background: v > 0 ? s.bg : token.colorFillAlter,
                                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                                    fontSize: 12, fontWeight: 800,
                                                                    color: v > 0 ? s.color : token.colorTextDisabled,
                                                                }}>{v || "–"}</div>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}

                                        {/* Footer total row */}
                                        {santriList.length > 0 && (
                                            <tr style={{ background: token.colorFillAlter, borderTop: `2px solid ${token.colorBorderSecondary}` }}>
                                                <td colSpan={3} style={{ padding: "10px 14px", fontWeight: 700, fontSize: 12, color: token.colorText }}>
                                                    TOTAL MINGGU INI
                                                </td>
                                                {kegiatanList.map(kid => {
                                                    const sesiId = sesiMap[kid];
                                                    const hadir = sesiId ? santriList.filter(s => absensiGrid[s.nis]?.[sesiId]?.status === "HADIR").length : 0;
                                                    const filled = sesiId ? santriList.filter(s => absensiGrid[s.nis]?.[sesiId]?.status).length : 0;
                                                    return (
                                                        <td key={kid} style={{ padding: "8px 6px", textAlign: "center" }}>
                                                            <div style={{ fontSize: 12, fontWeight: 700, color: token.colorSuccess }}>{hadir}H</div>
                                                            <div style={{ fontSize: 9, color: token.colorTextDescription }}>{filled}/{santriList.length}</div>
                                                        </td>
                                                    );
                                                })}
                                                {STATUS_ABSENSI.map(s => (
                                                    <td key={s.key} style={{ padding: "8px 4px", textAlign: "center" }}>
                                                        <div style={{ fontWeight: 800, fontSize: 13, color: s.color }}>
                                                            {weekStats.counts[s.key] ?? 0}
                                                        </div>
                                                    </td>
                                                ))}
                                            </tr>
                                        )}
                                    </tbody>
                                </table>

                                {santriList.length === 0 && (
                                    <div style={{ padding: "60px 20px", textAlign: "center", color: token.colorTextDescription }}>
                                        <TeamOutlined style={{ fontSize: 36, marginBottom: 12 }} />
                                        <div style={{ fontSize: 14, fontWeight: 600 }}>Tidak ada santri tahfidz aktif</div>
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>
                </motion.div>
            </div>

            {/* ── Export Modal (Premium, konsisten dengan Ngaji) ─────────────── */}
            <Modal
                open={exportModalOpen}
                onCancel={() => setExportModalOpen(false)}
                footer={null} centered width={500} destroyOnClose
                styles={{ content: { borderRadius: 18, padding: 0, overflow: "hidden" }, body: { padding: 0 } }}
            >
                {/* Header */}
                <div style={{
                    padding: "22px 26px 18px",
                    background: `linear-gradient(135deg, ${token.colorSuccess}, ${token.colorSuccessActive ?? token.colorSuccess})`,
                    color: "#fff",
                }}>
                    <Space size={12} align="center">
                        <div style={{
                            width: 40, height: 40, borderRadius: 10,
                            background: "rgba(255,255,255,0.2)",
                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
                        }}>
                            <FileExcelOutlined />
                        </div>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: 16 }}>Export Absensi Mingguan</div>
                            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 1 }}>
                                Pilih bulan & minggu yang akan diekspor
                            </div>
                        </div>
                    </Space>
                </div>

                <div style={{ padding: "22px 26px 26px" }}>
                    {/* Tahun & Bulan selector */}
                    <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                        <div style={{ flex: 1 }}>
                            <Text style={{ fontSize: 11, fontWeight: 600, color: token.colorTextDescription, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                Tahun Hijriah
                            </Text>
                            <Select value={exportTahun} onChange={setExportTahun} style={{ width: "100%" }}
                                options={yearOptions.map(y => ({ label: `${y} H`, value: y }))} />
                        </div>
                        <div style={{ flex: 2 }}>
                            <Text style={{ fontSize: 11, fontWeight: 600, color: token.colorTextDescription, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                Bulan Hijriah
                            </Text>
                            <Select value={exportBulan} onChange={setExportBulan} style={{ width: "100%" }}
                                options={HIJRI_MONTHS.map((name, i) => ({ label: name, value: i + 1 }))} />
                        </div>
                    </div>

                    <Text style={{ fontSize: 12, color: token.colorTextDescription, display: "block", marginBottom: 12 }}>
                        Pilih minggu yang akan disertakan:
                    </Text>

                    {/* Week cards */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 16 }}>
                        {Array.from({ length: mingguMaxKe }, (_, i) => {
                            const wk = i + 1;
                            const kegiatan = KEGIATAN_MINGGUAN[wk] || [];
                            const isSelected = selectedExportWeeks.includes(wk);
                            const isCurrent = wk === mingguKe && exportTahun === tahun && exportBulan === bulan;
                            return (
                                <div key={wk}
                                    onClick={() => setSelectedExportWeeks(prev =>
                                        prev.includes(wk) ? prev.filter(w => w !== wk) : [...prev, wk].sort()
                                    )}
                                    style={{
                                        padding: "11px 14px", borderRadius: 12, cursor: "pointer",
                                        border: `2px solid ${isSelected ? token.colorSuccessBorder : token.colorBorderSecondary}`,
                                        background: isSelected ? token.colorSuccessBg : token.colorBgContainer,
                                        transition: "all 0.15s",
                                        display: "flex", alignItems: "center", gap: 12,
                                    }}>
                                    <div style={{
                                        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                                        background: isSelected ? token.colorSuccess : token.colorFillSecondary,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        color: isSelected ? "#fff" : token.colorTextDisabled, fontSize: 14,
                                    }}>
                                        {isSelected ? <CheckCircleOutlined style={{ fontSize: 14 }} /> : wk}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                            <Text style={{ fontSize: 13, fontWeight: 700, color: isSelected ? token.colorSuccess : token.colorText }}>
                                                Minggu ke-{wk}
                                            </Text>
                                            {isCurrent && (
                                                <Tag style={{
                                                    fontSize: 9, borderRadius: 6, padding: "0 6px", height: 18, lineHeight: "18px",
                                                    background: token.colorPrimaryBg, border: `1px solid ${token.colorPrimaryBorder}`,
                                                    color: token.colorPrimary, fontWeight: 700,
                                                }}>
                                                    Minggu ini
                                                </Tag>
                                            )}
                                        </div>
                                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                                            {kegiatan.map(kid => {
                                                const info = KEGIATAN_INFO[kid];
                                                const c = (token as any)[info?.tokenColorKey ?? "colorPrimary"];
                                                return (
                                                    <span key={kid} style={{ fontSize: 10, color: c }}>
                                                        {info?.icon} {info?.label}
                                                    </span>
                                                );
                                            }).reduce((a: any[], el, i) => i > 0 ? [...a, <span key={`sep-${i}`} style={{ color: token.colorBorderSecondary }}>·</span>, el] : [el], [])}
                                        </div>
                                    </div>
                                    <Text style={{ fontSize: 10, color: token.colorTextDescription, flexShrink: 0 }}>
                                        {kegiatan.length} keg.
                                    </Text>
                                </div>
                            );
                        })}
                    </div>

                    {/* Quick select */}
                    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                        <Button size="small" style={{ borderRadius: 8 }} onClick={() => setSelectedExportWeeks([mingguKe])}>
                            Minggu Ini
                        </Button>
                        <Button size="small" style={{ borderRadius: 8 }} onClick={() => setSelectedExportWeeks(Array.from({ length: mingguMaxKe }, (_, i) => i + 1))}>
                            Pilih Semua
                        </Button>
                        <Button size="small" style={{ borderRadius: 8 }} onClick={() => setSelectedExportWeeks([])}>
                            Batal Pilih
                        </Button>
                    </div>

                    {/* Preview info */}
                    {selectedExportWeeks.length > 0 && (
                        <div style={{
                            padding: "10px 14px", borderRadius: 10, marginBottom: 16,
                            background: token.colorInfoBg, border: `1px solid ${token.colorInfoBorder}`,
                            display: "flex", gap: 8, alignItems: "flex-start",
                        }}>
                            <InfoCircleOutlined style={{ color: token.colorInfo, marginTop: 2, flexShrink: 0 }} />
                            <Text style={{ fontSize: 12, color: token.colorInfo }}>
                                Akan mengekspor <strong>{selectedExportWeeks.length} minggu</strong> ·{" "}
                                <strong>
                                    {selectedExportWeeks.reduce((t, mg) => t + (KEGIATAN_MINGGUAN[mg]?.length ?? 0), 0)}
                                </strong> kolom kegiatan ·{" "}
                                <strong>{santriList.length}</strong> santri
                                {selectedExportWeeks.length > 1 && " · Disertakan rekap bulanan"}
                            </Text>
                        </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 10 }}>
                        <Button style={{ flex: "0 0 auto", borderRadius: 10 }} onClick={() => setExportModalOpen(false)}>Batal</Button>
                        <Button
                            type="primary" icon={<ThunderboltOutlined />}
                            loading={exportLoading}
                            disabled={selectedExportWeeks.length === 0}
                            onClick={() => handleExport(selectedExportWeeks)}
                            style={{
                                flex: 1, borderRadius: 10, fontWeight: 700, height: 42, border: "none",
                                background: selectedExportWeeks.length > 0
                                    ? `linear-gradient(135deg, ${token.colorSuccess}, ${token.colorSuccessActive ?? token.colorSuccess})`
                                    : undefined,
                                boxShadow: selectedExportWeeks.length > 0 ? `0 4px 12px ${token.colorSuccess}44` : undefined,
                            }}
                        >
                            {selectedExportWeeks.length === 0
                                ? "Pilih minggu dahulu"
                                : `Download Excel · ${selectedExportWeeks.length} Minggu`}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
