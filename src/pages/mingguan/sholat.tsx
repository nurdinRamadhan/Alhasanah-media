import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    Button, Typography, Space, Select, Segmented, message,
    Avatar, Tag, Spin, theme, Modal, Card, Row, Col,
    Badge, Alert, Tooltip as AntTooltip, Dropdown,
} from "antd";
import {
    CalendarOutlined, FileExcelOutlined, UserOutlined, ReloadOutlined,
    CheckCircleOutlined, CloseCircleOutlined, CheckOutlined,
    BarChartOutlined, TeamOutlined, ThunderboltOutlined,
    InfoCircleOutlined, PlusOutlined, WarningOutlined,
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

const KEGIATAN_ID    = "SHOLAT_HIFDZI";
const KEGIATAN_LABEL = "Sholat Hifdzi";
const KEGIATAN_ICON  = "🕌";

// ─── Status Config (token-based, zero hardcodes) ──────────────────────────────
const getStatusConfig = (token: any) => [
    { key: "HADIR",  label: "Hadir",  icon: "✅", code: "H",  color: token.colorSuccess,       bg: token.colorSuccessBg,  border: token.colorSuccessBorder },
    { key: "SAKIT",  label: "Sakit",  icon: "🤒", code: "S",  color: token.colorWarning,       bg: token.colorWarningBg,  border: token.colorWarningBorder },
    { key: "IZIN",   label: "Izin",   icon: "📝", code: "I",  color: token.colorInfo,           bg: token.colorInfoBg,     border: token.colorInfoBorder },
    { key: "GHAIB",  label: "Ghaib",  icon: "❌", code: "GH", color: token.colorError,          bg: token.colorErrorBg,    border: token.colorErrorBorder },
    { key: "PULANG", label: "Pulang", icon: "🏠", code: "P",  color: token.colorTextSecondary,  bg: token.colorFillAlter,  border: token.colorBorderSecondary },
];

// Excel fills stay fixed ARGB
const STATUS_FILLS: Record<string, string> = {
    HADIR: "FFD1FAE5", SAKIT: "FFFEF3C7", IZIN: "FFDBEAFE",
    GHAIB: "FFFEE2E2", PULANG: "FFFFEDD5",
};

const STATUS_EXCEL_COLORS: Record<string, string> = {
    HADIR: "FF059669", SAKIT: "FFD97706", IZIN: "FF2563EB",
    GHAIB: "FFDC2626", PULANG: "FF6B7280",
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
    label: string; value: number; total: number; subtitle?: string;
    icon: string; color: string; bg: string; border: string;
    index: number; token: any;
}> = ({ label, value, total, subtitle, icon, color, bg, border, index, token }) => {
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
                        background: bg, display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: 20,
                    }}>{icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 10, color: token.colorTextDescription, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", display: "block" }}>
                            {label}
                        </Text>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 2 }}>
                            <span style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>
                                <AnimatedNumber value={value} />
                            </span>
                            {subtitle && <Text style={{ fontSize: 10, color: token.colorTextDescription }}>{subtitle}</Text>}
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

// ─── Custom Tooltip ────────────────────────────────────────────────────────────
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

const thStyle = (token: any): React.CSSProperties => ({
    padding: "10px 12px", fontSize: 11, fontWeight: 700,
    color: token.colorTextDescription, borderBottom: `1px solid ${token.colorBorderSecondary}`,
    whiteSpace: "nowrap" as const,
});

// ─── Main Component ───────────────────────────────────────────────────────────
export const SholatHifdziList: React.FC = () => {
    const { token } = useToken();
    const isDark = hexLum(token.colorBgContainer) < 128;
    const { data: identity } = useGetIdentity<any>();

    const STATUS_ABSENSI = useMemo(() => getStatusConfig(token), [token]);

    const todayHijri = useMemo(() => getCurrentHijri(), []);
    const [tahun, setTahun] = useState(todayHijri.hy);
    const [bulan, setBulan] = useState(todayHijri.hm);
    const [mingguKe, setMingguKe] = useState(Math.min(Math.ceil(todayHijri.hd / 7), 4));
    const [showWeek5, setShowWeek5] = useState(false);
    const mingguMaxKe = showWeek5 ? 5 : 4;

    const [santriList, setSantriList] = useState<any[]>([]);
    const [sesiId, setSesiId] = useState<string | null>(null);
    const [absensiMap, setAbsensiMap] = useState<Record<string, string | null>>({});
    // monthlyAbsensi: sesiId → { nis → status }
    const [monthlyAbsensi, setMonthlyAbsensi] = useState<Record<string, Record<string, string>>>({});
    // sesiMingguMap: sesiId → minggu_ke  (used for weekly trend chart)
    const [sesiMingguMap, setSesiMingguMap] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [savingCell, setSavingCell] = useState<string | null>(null);
    const [fetchKey, setFetchKey] = useState(0);
    const [exportLoading, setExportLoading] = useState(false);
    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [exportTahun, setExportTahun] = useState(tahun);
    const [exportBulan, setExportBulan] = useState(bulan);

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

    // ── Fetch or create sesi + absensi for current week ────────────────────────
    useEffect(() => {
        if (!tahun || !bulan || !mingguKe) return;
        setLoading(true);
        setSesiId(null);
        setAbsensiMap({});

        (async () => {
            try {
                const { data: existing, error: errExist } = await supabaseClient
                    .from("sholat_hifdzi_sesi").select("id")
                    .eq("kegiatan_id", KEGIATAN_ID).eq("bulan_hijriah", bulanLabel)
                    .eq("tahun_hijriah", tahun).eq("minggu_ke", mingguKe).limit(1);

                if (errExist) { message.error("Gagal memuat sesi: " + errExist.message); setLoading(false); return; }

                let sesi = existing && existing.length > 0 ? existing[0] : null;
                if (!sesi) {
                    const { data: newSesi, error: errInsert } = await supabaseClient
                        .from("sholat_hifdzi_sesi")
                        .insert({
                            kegiatan_id: KEGIATAN_ID, bulan_hijriah: bulanLabel,
                            tahun_hijriah: tahun, bulan_hijriah_number: bulan,
                            minggu_ke: mingguKe,
                            tanggal: new Date().toISOString().slice(0, 10),
                            created_by: identity?.id,
                        })
                        .select("id").single();
                    if (errInsert) { message.error("Gagal membuat sesi baru: " + errInsert.message); setLoading(false); return; }
                    sesi = newSesi;
                }

                if (sesi) {
                    setSesiId(sesi.id);
                    const { data: absensiData, error: errAbsen } = await supabaseClient
                        .from("sholat_hifdzi_absensi").select("santri_nis, status").eq("sesi_id", sesi.id);
                    if (errAbsen) { message.error("Gagal memuat absensi: " + errAbsen.message); setLoading(false); return; }
                    const map: Record<string, string | null> = {};
                    (absensiData || []).forEach((a: any) => { map[a.santri_nis] = a.status; });
                    setAbsensiMap(map);
                }
            } catch (err: any) {
                message.error("Terjadi kesalahan: " + (err?.message || "unknown"));
            } finally {
                setLoading(false);
            }
        })();
    }, [tahun, bulan, mingguKe, identity?.id, fetchKey, bulanLabel]);

    // ── Fetch all monthly sesi + absensi (for distribusi + chart) ─────────────
    useEffect(() => {
        if (!tahun || !bulan) return;
        (async () => {
            try {
                const bl = HIJRI_MONTHS[bulan - 1];
                const { data: allSesi } = await supabaseClient
                    .from("sholat_hifdzi_sesi").select("id, minggu_ke")
                    .eq("kegiatan_id", KEGIATAN_ID).eq("bulan_hijriah", bl).eq("tahun_hijriah", tahun);

                if (!allSesi || allSesi.length === 0) {
                    setMonthlyAbsensi({}); setSesiMingguMap({}); return;
                }

                // Build sesiId → minggu_ke map
                const mingguMap: Record<string, number> = {};
                allSesi.forEach((s: any) => { mingguMap[s.id] = s.minggu_ke; });
                setSesiMingguMap(mingguMap);

                const allSesiIds = allSesi.map((s: any) => s.id);
                const { data: allAbs } = await supabaseClient
                    .from("sholat_hifdzi_absensi").select("sesi_id, santri_nis, status")
                    .in("sesi_id", allSesiIds);

                const grouped: Record<string, Record<string, string>> = {};
                (allAbs || []).forEach((a: any) => {
                    if (!grouped[a.sesi_id]) grouped[a.sesi_id] = {};
                    grouped[a.sesi_id][a.santri_nis] = a.status;
                });
                setMonthlyAbsensi(grouped);
            } catch { /* silent */ }
        })();
    }, [tahun, bulan]);

    // ── Compute distribusi per santri across entire month ─────────────────────
    const computeDistribusi = useCallback((nis: string): Record<string, number> => {
        const counts: Record<string, number> = { HADIR: 0, SAKIT: 0, IZIN: 0, GHAIB: 0, PULANG: 0 };
        Object.values(monthlyAbsensi).forEach(sesiAbs => {
            const st = sesiAbs[nis];
            if (st && counts[st] !== undefined) counts[st]++;
        });
        return counts;
    }, [monthlyAbsensi]);

    // ── KPI stats (current week) ───────────────────────────────────────────────
    const weekStats = useMemo(() => {
        const counts: Record<string, number> = { HADIR: 0, SAKIT: 0, IZIN: 0, GHAIB: 0, PULANG: 0 };
        let filled = 0;
        santriList.forEach(s => {
            const st = absensiMap[s.nis];
            if (st && counts[st] !== undefined) { counts[st]++; filled++; }
        });
        const total = santriList.length;
        const rate = total > 0 ? Math.round((counts.HADIR / total) * 100) : 0;
        return { counts, total, filled, rate };
    }, [absensiMap, santriList]);

    // ── Monthly aggregate stats ────────────────────────────────────────────────
    const monthlyStats = useMemo(() => {
        const counts: Record<string, number> = { HADIR: 0, SAKIT: 0, IZIN: 0, GHAIB: 0, PULANG: 0 };
        Object.values(monthlyAbsensi).forEach(sesiAbs => {
            Object.values(sesiAbs).forEach(st => {
                if (st && counts[st] !== undefined) counts[st]++;
            });
        });
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        return { counts, total };
    }, [monthlyAbsensi]);

    // ── Weekly trend chart (per-minggu breakdown) ──────────────────────────────
    const weeklyTrendData = useMemo(() => {
        // Group monthly data by minggu_ke
        const byMinggu: Record<number, Record<string, number>> = {};
        Object.entries(monthlyAbsensi).forEach(([sid, sesiAbs]) => {
            const mg = sesiMingguMap[sid];
            if (!mg) return;
            if (!byMinggu[mg]) byMinggu[mg] = { HADIR: 0, SAKIT: 0, IZIN: 0, GHAIB: 0, PULANG: 0 };
            Object.values(sesiAbs).forEach(st => {
                if (st && byMinggu[mg][st] !== undefined) byMinggu[mg][st]++;
            });
        });
        return [1, 2, 3, 4, 5]
            .filter(mg => byMinggu[mg] || mg <= mingguMaxKe)
            .map(mg => ({
                minggu: `Mg ${mg}${mg === mingguKe ? " ★" : ""}`,
                Hadir:  byMinggu[mg]?.HADIR  ?? 0,
                Sakit:  byMinggu[mg]?.SAKIT  ?? 0,
                Izin:   byMinggu[mg]?.IZIN   ?? 0,
                Ghaib:  byMinggu[mg]?.GHAIB  ?? 0,
                Pulang: byMinggu[mg]?.PULANG ?? 0,
            }));
    }, [monthlyAbsensi, sesiMingguMap, mingguKe, mingguMaxKe]);

    // ── Donut data (current week) ──────────────────────────────────────────────
    const donutData = useMemo(() =>
        STATUS_ABSENSI
            .map(s => ({ name: s.label, value: weekStats.counts[s.key] ?? 0, color: s.color, icon: s.icon }))
            .filter(d => d.value > 0),
        [weekStats, STATUS_ABSENSI]
    );

    // ── Handle status click (upsert via select→update/insert) ─────────────────
    const handleStatusClick = async (nis: string, status: string) => {
        if (!sesiId) return;
        const cellKey = `${nis}_${sesiId}`;
        if (savingCell) return;
        setSavingCell(cellKey);
        try {
            if (status === "") {
                // Delete (clear)
                await supabaseClient.from("sholat_hifdzi_absensi").delete()
                    .eq("sesi_id", sesiId).eq("santri_nis", nis);
                setAbsensiMap(prev => { const next = { ...prev }; delete next[nis]; return next; });
                setMonthlyAbsensi(prev => {
                    const next = { ...prev };
                    if (next[sesiId]) { const updated = { ...next[sesiId] }; delete updated[nis]; next[sesiId] = updated; }
                    return next;
                });
            } else {
                const { data: existing } = await supabaseClient.from("sholat_hifdzi_absensi")
                    .select("id").eq("sesi_id", sesiId).eq("santri_nis", nis).maybeSingle();
                if (existing) {
                    await supabaseClient.from("sholat_hifdzi_absensi")
                        .update({ status, updated_by: identity?.id }).eq("id", existing.id);
                } else {
                    await supabaseClient.from("sholat_hifdzi_absensi")
                        .insert({ sesi_id: sesiId, santri_nis: nis, status, created_by: identity?.id, updated_by: identity?.id });
                }
                setAbsensiMap(prev => ({ ...prev, [nis]: status }));
                setMonthlyAbsensi(prev => {
                    const next = { ...prev };
                    if (!next[sesiId]) next[sesiId] = {};
                    next[sesiId] = { ...next[sesiId], [nis]: status };
                    return next;
                });
            }
        } catch { message.error("Gagal menyimpan"); }
        finally { setSavingCell(null); }
    };

    const yearOptions = useMemo(() => {
        const years: number[] = [];
        for (let y = todayHijri.hy - 2; y <= todayHijri.hy + 2; y++) years.push(y);
        return years;
    }, [todayHijri.hy]);

    // ── Excel Export ──────────────────────────────────────────────────────────
    const handleExport = async () => {
        if (!exportTahun || !exportBulan) { message.error("Pilih tahun dan bulan"); return; }
        setExportLoading(true);
        setExportModalOpen(false);
        try {
            const expBulanLabel = HIJRI_MONTHS[exportBulan - 1];

            const { data: santriData } = await supabaseClient
                .from("santri").select("nis, nama, kelas, total_hafalan")
                .eq("jurusan", "TAHFIDZ").eq("status_santri", "AKTIF")
                .order("kelas").order("nama");
            const santriListData = santriData || [];

            const { data: sesiList } = await supabaseClient
                .from("sholat_hifdzi_sesi").select("id, minggu_ke, tanggal")
                .eq("tahun_hijriah", exportTahun).eq("bulan_hijriah", expBulanLabel)
                .order("minggu_ke", { ascending: true });

            if (!sesiList || sesiList.length === 0) {
                message.warning("Tidak ada data sholat hifdzi di bulan tersebut");
                setExportLoading(false);
                return;
            }

            const sesiIds = sesiList.map((s: any) => s.id);
            const { data: absensiData } = await supabaseClient
                .from("sholat_hifdzi_absensi").select("sesi_id, santri_nis, status")
                .in("sesi_id", sesiIds);

            const absensiBySesi: Record<string, Record<string, any>> = {};
            (absensiData || []).forEach((a: any) => {
                if (!absensiBySesi[a.sesi_id]) absensiBySesi[a.sesi_id] = {};
                absensiBySesi[a.sesi_id][a.santri_nis] = a;
            });

            // ── Build workbook ─────────────────────────────────────────────────
            const wb = new ExcelJS.Workbook();
            wb.creator = "Al-Hasanah Admin";
            wb.created = new Date();

            const STATUS_KEYS = ["HADIR", "SAKIT", "IZIN", "GHAIB", "PULANG"] as const;
            const COLS_BASE   = 3; // No | Nama | Kelas
            const COLS_RECAP  = STATUS_KEYS.length; // H | S | I | GH | P
            const totalCols   = COLS_BASE + sesiList.length + COLS_RECAP;
            const recapStart  = COLS_BASE + sesiList.length + 1;

            const ws = wb.addWorksheet("Sholat Hifdzi", {
                pageSetup: { fitToPage: true, fitToWidth: 1, orientation: "landscape" },
                views: [{ state: "frozen", xSplit: 3, ySplit: 4, activeCell: "D5" }],
            });

            // Row 1: Title
            ws.mergeCells(`A1:${colLetter(totalCols)}1`);
            ws.getCell("A1").value = `ABSENSI ${KEGIATAN_LABEL.toUpperCase()} — ${expBulanLabel.toUpperCase()} ${exportTahun} H`;
            ws.getCell("A1").font = { size: 14, bold: true, color: { argb: "FFFFFFFF" }, name: "Calibri" };
            ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7C3AED" } };
            ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
            ws.getRow(1).height = 26;

            // Row 2: Metadata
            ws.mergeCells(`A2:${colLetter(totalCols)}2`);
            ws.getCell("A2").value = `Dicetak: ${dayjs().format("DD MMMM YYYY, HH:mm")}  |  Total Santri: ${santriListData.length}  |  Sesi: ${sesiList.length} Minggu`;
            ws.getCell("A2").font = { size: 9, italic: true, color: { argb: "FF6B7280" }, name: "Calibri" };
            ws.getCell("A2").alignment = { horizontal: "center" };
            ws.getRow(2).height = 16;

            // Row 3: Group headers
            const grpValues: any[] = ["", "", ""];
            grpValues.push(`${KEGIATAN_ICON}  SESI MINGGUAN — ${expBulanLabel} ${exportTahun} H`);
            for (let i = 1; i < sesiList.length; i++) grpValues.push("");
            grpValues.push("REKAP STATUS BULANAN");
            for (let i = 1; i < COLS_RECAP; i++) grpValues.push("");

            const grpRow = ws.getRow(3);
            grpRow.values = grpValues;
            grpRow.height = 22;

            ws.mergeCells(`${colLetter(COLS_BASE + 1)}3:${colLetter(COLS_BASE + sesiList.length)}3`);
            const sesiCell = grpRow.getCell(COLS_BASE + 1);
            sesiCell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" }, name: "Calibri" };
            sesiCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC9A84C" } };
            sesiCell.alignment = { horizontal: "center", vertical: "middle" };

            ws.mergeCells(`${colLetter(recapStart)}3:${colLetter(totalCols)}3`);
            const recapCell = grpRow.getCell(recapStart);
            recapCell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" }, name: "Calibri" };
            recapCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
            recapCell.alignment = { horizontal: "center", vertical: "middle" };

            // Row 4: Sub-headers
            const subValues: any[] = ["NO", "NAMA SANTRI", "KELAS"];
            sesiList.forEach((s: any) => {
                const tgl = s.tanggal ? dayjs(s.tanggal).format("DD/MM/YY") : "";
                subValues.push(`Minggu ke-${s.minggu_ke}\n${tgl}`);
            });
            STATUS_KEYS.forEach(k => {
                const cfg = getStatusConfig({ colorSuccess: "green", colorWarning: "orange", colorInfo: "blue", colorError: "red", colorTextSecondary: "gray" });
                const found = cfg.find(c => c.key === k);
                subValues.push(found?.code ?? k);
            });

            const subRow = ws.getRow(4);
            subRow.values = subValues;
            subRow.height = 36;
            subRow.eachCell((cell: any, colNum: number) => {
                cell.font = { bold: true, size: 9, name: "Calibri" };
                cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colNum > COLS_BASE ? "FFEFF6FF" : "FFF9FAFB" } };
                cell.border = {
                    top: { style: "thin", color: { argb: "FFD1D5DB" } },
                    bottom: { style: "medium", color: { argb: "FF9CA3AF" } },
                    left: { style: "thin", color: { argb: "FFD1D5DB" } },
                    right: { style: "thin", color: { argb: "FFD1D5DB" } },
                };
            });
            // Color each sesi sub-header with alternating greens
            sesiList.forEach((_: any, i: number) => {
                const c = subRow.getCell(COLS_BASE + 1 + i);
                c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i % 2 === 0 ? "FF059669" : "FF047857" } };
                c.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" }, name: "Calibri" };
            });
            // Color recap sub-headers with semantic colors
            STATUS_KEYS.forEach((k, i) => {
                const c = subRow.getCell(recapStart + i);
                c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: STATUS_EXCEL_COLORS[k] ?? "FF374151" } };
                c.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" }, name: "Calibri" };
            });

            // Column widths
            ws.columns = [
                { key: "no", width: 5 },
                { key: "nama", width: 26 },
                { key: "kelas", width: 8 },
                ...sesiList.map((_: any) => ({ key: "", width: 13 })),
                ...STATUS_KEYS.map(() => ({ key: "", width: 8 })),
            ];

            // Grand totals accumulator
            const grandTotals: Record<string, number> = { HADIR: 0, SAKIT: 0, IZIN: 0, GHAIB: 0, PULANG: 0 };

            // Data rows
            santriListData.forEach((s: any, idx: number) => {
                const rv: any[] = [idx + 1, s.nama || santriAlias(s.nis), s.kelas ?? "–"];
                const counts: Record<string, number> = { HADIR: 0, SAKIT: 0, IZIN: 0, GHAIB: 0, PULANG: 0 };

                sesiList.forEach((sesi: any) => {
                    const abs = absensiBySesi[sesi.id]?.[s.nis];
                    const st = abs?.status;
                    const cfg2 = getStatusConfig({
                        colorSuccess: "", colorWarning: "", colorInfo: "", colorError: "", colorTextSecondary: "",
                        colorSuccessBg: "", colorWarningBg: "", colorInfoBg: "", colorErrorBg: "", colorFillAlter: "",
                        colorSuccessBorder: "", colorWarningBorder: "", colorInfoBorder: "", colorErrorBorder: "", colorBorderSecondary: "",
                    });
                    const found = cfg2.find(c => c.key === st);
                    rv.push(found?.code ?? (st ? st : ""));
                    if (st && counts[st] !== undefined) counts[st]++;
                });

                STATUS_KEYS.forEach(k => {
                    rv.push(counts[k] || "");
                    grandTotals[k] += counts[k];
                });

                const dataRow = ws.addRow(rv);
                const isEven = idx % 2 === 1;
                dataRow.height = 18;
                dataRow.eachCell((cell: any, colNum: number) => {
                    cell.font = { size: 9, name: "Calibri" };
                    cell.alignment = { horizontal: colNum <= 2 ? "left" : "center", vertical: "middle" };
                    if (isEven) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
                    cell.border = { bottom: { style: "hair", color: { argb: "FFE5E7EB" } } };
                });

                // Color attendance cells
                sesiList.forEach((sesi: any, si: number) => {
                    const abs = absensiBySesi[sesi.id]?.[s.nis];
                    if (abs?.status) {
                        const fill = STATUS_FILLS[abs.status];
                        if (fill) dataRow.getCell(COLS_BASE + 1 + si).fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
                    }
                });

                // Style recap cells
                STATUS_KEYS.forEach((k, ki) => {
                    const cell = dataRow.getCell(recapStart + ki);
                    if (counts[k] > 0) {
                        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: STATUS_FILLS[k] } };
                        cell.font = { bold: true, size: 9, color: { argb: STATUS_EXCEL_COLORS[k] }, name: "Calibri" };
                    }
                    cell.alignment = { horizontal: "center", vertical: "middle" };
                });
            });

            // Grand total row
            ws.addRow([]);
            const totRow: any[] = ["", "✦ TOTAL KESELURUHAN", ""];
            sesiList.forEach(() => totRow.push(""));
            STATUS_KEYS.forEach(k => totRow.push(grandTotals[k] || ""));
            const gRow = ws.addRow(totRow);
            gRow.height = 20;
            gRow.eachCell((cell: any, colNum: number) => {
                cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" }, name: "Calibri" };
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
                cell.alignment = { horizontal: colNum <= 2 ? "left" : "center", vertical: "middle" };
            });

            ws.autoFilter = { from: "A4", to: `${colLetter(totalCols)}4` };

            const buffer = await wb.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `SholatHifdzi_${expBulanLabel}_${exportTahun}H_${dayjs().format("YYYYMMDD")}.xlsx`);
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
                        background: `linear-gradient(135deg, ${token.colorSuccess}, ${token.colorSuccessActive ?? token.colorSuccess})`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 22, boxShadow: `0 4px 14px ${token.colorSuccess}44`,
                    }}>🕌</div>
                    <div>
                        <Title level={4} style={{ margin: 0, lineHeight: 1.15, fontSize: 19, fontWeight: 800 }}>
                            Absensi Sholat Hifdzi
                        </Title>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            {bulanLabel} {tahun} H · Minggu ke-{mingguKe} · {santriList.length} santri aktif
                        </Text>
                    </div>
                </div>
                <Space wrap>
                    <Button icon={<ReloadOutlined />} onClick={() => setFetchKey(k => k + 1)} />
                    <Button
                        icon={<FileExcelOutlined />} loading={exportLoading}
                        onClick={() => { setExportTahun(tahun); setExportBulan(bulan); setExportModalOpen(true); }}
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
                            background: `linear-gradient(135deg, ${token.colorSuccess}, ${token.colorSuccessActive ?? token.colorSuccess})`,
                            border: "none", fontWeight: 600,
                            boxShadow: `0 4px 12px ${token.colorSuccess}44`,
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
                                    onChange={v => { setBulan(v); setMingguKe(1); setShowWeek5(false); }}
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
                        {/* Kegiatan badge */}
                        <div style={{ marginTop: 12 }}>
                            <Tag style={{
                                fontSize: 11, padding: "4px 14px", borderRadius: 8,
                                background: token.colorSuccessBg,
                                color: token.colorSuccess,
                                border: `1px solid ${token.colorSuccessBorder}`, fontWeight: 600,
                            }}>
                                {KEGIATAN_ICON} {KEGIATAN_LABEL}
                            </Tag>
                        </div>
                    </Card>
                </motion.div>

                {/* ── KPI Cards ──────────────────────────────────────────────── */}
                {!loading && (
                    <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
                        {/* Terisi card */}
                        <Col xs={12} sm={8} lg={4}>
                            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
                                <Card bordered={false} style={{
                                    borderRadius: 14, border: `1px solid ${token.colorBorderSecondary}`,
                                    background: token.colorBgContainer, boxShadow: `0 2px 12px ${token.colorFillSecondary}`,
                                }} bodyStyle={{ padding: "16px 18px" }}>
                                    <Text style={{ fontSize: 10, color: token.colorTextDescription, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", display: "block" }}>
                                        Terisi Minggu Ini
                                    </Text>
                                    <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 4 }}>
                                        <span style={{ fontSize: 24, fontWeight: 800, color: token.colorText, lineHeight: 1 }}>
                                            <AnimatedNumber value={weekStats.filled} />
                                        </span>
                                        <span style={{ fontSize: 12, color: token.colorTextDescription }}>/{weekStats.total}</span>
                                    </div>
                                    <Text style={{ fontSize: 10, color: token.colorTextDescription, marginTop: 4, display: "block" }}>
                                        {weekStats.rate}% hadir · {monthlyStats.total} total bulan ini
                                    </Text>
                                    <div style={{ marginTop: 8, height: 3, borderRadius: 2, background: token.colorFillSecondary }}>
                                        <motion.div initial={{ width: 0 }} animate={{ width: `${weekStats.rate}%` }}
                                            transition={{ duration: 0.8, ease: "easeOut" }}
                                            style={{ height: "100%", borderRadius: 2, background: token.colorSuccess }} />
                                    </div>
                                </Card>
                            </motion.div>
                        </Col>
                        {STATUS_ABSENSI.map((s, i) => (
                            <Col xs={12} sm={8} lg={4} key={s.key}>
                                <KpiCard
                                    label={s.label}
                                    value={weekStats.counts[s.key] ?? 0}
                                    total={weekStats.total}
                                    subtitle="minggu ini"
                                    icon={s.icon} color={s.color} bg={s.bg} border={s.border}
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
                                message={`Tingkat kehadiran sholat minggu ini ${weekStats.rate}% — di bawah target. Harap ditindaklanjuti.`}
                                style={{ borderRadius: 10 }} />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Charts ─────────────────────────────────────────────────── */}
                {!loading && weeklyTrendData.length > 0 && (
                    <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                        {/* Weekly trend bar */}
                        <Col xs={24} lg={15}>
                            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.38, delay: 0.1 }}>
                                <Card bordered={false} style={{
                                    borderRadius: 16, border: `1px solid ${token.colorBorderSecondary}`,
                                    boxShadow: `0 1px 4px ${token.colorFillSecondary}`,
                                }} bodyStyle={{ padding: "18px 20px 12px" }}>
                                    <Space size={8} style={{ marginBottom: 4 }}>
                                        <BarChartOutlined style={{ color: token.colorPrimary }} />
                                        <Text strong style={{ fontSize: 13 }}>Tren Kehadiran Per Minggu — {bulanLabel} {tahun} H</Text>
                                    </Space>
                                    <div style={{ fontSize: 11, color: token.colorTextDescription, marginBottom: 14 }}>
                                        Distribusi status kehadiran sholat seluruh minggu bulan ini · ★ = minggu aktif
                                    </div>
                                    <ResponsiveContainer width="100%" height={190}>
                                        <BarChart data={weeklyTrendData} barSize={16} barGap={2}
                                            margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke={token.colorBorderSecondary} vertical={false} />
                                            <XAxis dataKey="minggu" tick={{ fontSize: 11, fill: token.colorTextDescription }} axisLine={false} tickLine={false} />
                                            <YAxis tick={{ fontSize: 10, fill: token.colorTextDescription }} axisLine={false} tickLine={false} allowDecimals={false} />
                                            <ReTooltip content={(p) => <CustomTooltip {...p} token={token} />} cursor={{ fill: token.colorFillSecondary }} />
                                            <Bar dataKey="Hadir"  fill={token.colorSuccess}       radius={[3, 3, 0, 0]} />
                                            <Bar dataKey="Sakit"  fill={token.colorWarning}       radius={[3, 3, 0, 0]} />
                                            <Bar dataKey="Izin"   fill={token.colorInfo}           radius={[3, 3, 0, 0]} />
                                            <Bar dataKey="Ghaib"  fill={token.colorError}          radius={[3, 3, 0, 0]} />
                                            <Bar dataKey="Pulang" fill={token.colorTextSecondary}  radius={[3, 3, 0, 0]} />
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

                        {/* Donut (current week) */}
                        <Col xs={24} lg={9}>
                            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.38, delay: 0.18 }} style={{ height: "100%" }}>
                                <Card bordered={false} style={{
                                    borderRadius: 16, border: `1px solid ${token.colorBorderSecondary}`,
                                    boxShadow: `0 1px 4px ${token.colorFillSecondary}`, height: "100%",
                                }} bodyStyle={{ padding: "18px 20px" }}>
                                    <Space size={8} style={{ marginBottom: 2 }}>
                                        <TeamOutlined style={{ color: token.colorPrimary }} />
                                        <Text strong style={{ fontSize: 13 }}>Minggu ke-{mingguKe}</Text>
                                    </Space>
                                    <div style={{ fontSize: 11, color: token.colorTextDescription, marginBottom: 10 }}>
                                        Distribusi status kehadiran minggu ini
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
                                                                ({weekStats.total > 0 ? Math.round((d.value / weekStats.total) * 100) : 0}%)
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

                        {/* Table header bar */}
                        <div style={{
                            padding: "14px 20px", borderBottom: `1px solid ${token.colorBorderSecondary}`,
                            background: token.colorFillAlter,
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                        }}>
                            <Space size={10}>
                                <Badge count={weekStats.counts.GHAIB + weekStats.counts.PULANG} overflowCount={999}
                                    style={{ background: token.colorError }} offset={[4, 0]}>
                                    <span style={{ fontSize: 20 }}>🕌</span>
                                </Badge>
                                <div>
                                    <Text strong style={{ fontSize: 13 }}>{bulanLabel} {tahun} H — Minggu ke-{mingguKe}</Text>
                                    {!sesiId && !loading && (
                                        <Tag color="error" style={{ marginLeft: 8, fontSize: 10 }}>Sesi tidak tersedia</Tag>
                                    )}
                                    <Text type="secondary" style={{ fontSize: 11, marginLeft: 10 }}>{santriList.length} santri</Text>
                                </div>
                            </Space>
                            <Space size={6}>
                                {STATUS_ABSENSI.map(s => (
                                    <AntTooltip key={s.key} title={`${s.label}: ${weekStats.counts[s.key] ?? 0}`}>
                                        <Tag style={{
                                            background: s.bg, border: `1px solid ${s.border}`,
                                            color: s.color, borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "default",
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
                        ) : (
                            <div style={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                                    <thead>
                                        <tr style={{ background: token.colorFillAlter }}>
                                            <th style={{ ...thStyle(token), width: 36, textAlign: "center" }}>#</th>
                                            <th style={{ ...thStyle(token), width: 200, textAlign: "left" }}>Santri</th>
                                            <th style={{ ...thStyle(token), width: 46, textAlign: "center" }}>Kls</th>
                                            {/* Status column */}
                                            <th style={{
                                                ...thStyle(token), textAlign: "center", minWidth: 160,
                                                background: token.colorSuccessBg,
                                                borderBottom: `2px solid ${token.colorSuccessBorder}`,
                                                color: token.colorSuccess, fontWeight: 700, fontSize: 13,
                                            }}>
                                                {KEGIATAN_ICON} {KEGIATAN_LABEL} · Minggu ke-{mingguKe}
                                            </th>
                                            {/* Monthly rekap header */}
                                            <th colSpan={STATUS_ABSENSI.length} style={{
                                                ...thStyle(token), textAlign: "center",
                                                background: token.colorPrimaryBg,
                                                borderBottom: `2px solid ${token.colorPrimaryBorder}`,
                                                color: token.colorPrimary, fontSize: 10,
                                                fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                                            }}>
                                                Rekap {bulanLabel} {tahun} H
                                            </th>
                                        </tr>
                                        {/* Sub-header for rekap */}
                                        <tr style={{ background: token.colorPrimaryBg }}>
                                            <th colSpan={4} />
                                            {STATUS_ABSENSI.map(s => (
                                                <th key={s.key} style={{
                                                    padding: "5px 6px", textAlign: "center",
                                                    fontSize: 13, fontWeight: 700,
                                                    color: s.color,
                                                    borderBottom: `1px solid ${token.colorBorderSecondary}`,
                                                    width: 40,
                                                }}>
                                                    {s.icon}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {santriList.map((santri: any, idx: number) => {
                                            const currentStatus = sesiId ? (absensiMap[santri.nis] ?? "") : "";
                                            const statusCfg = STATUS_ABSENSI.find(s => s.key === currentStatus);
                                            const isSaving = savingCell === `${santri.nis}_${sesiId}`;
                                            const dist = computeDistribusi(santri.nis);
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
                                                                style={{ background: token.colorSuccess, color: "#fff", flexShrink: 0 }} />
                                                            <div style={{ minWidth: 0 }}>
                                                                <div style={{ fontWeight: 600, fontSize: 12, color: token.colorText, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 150 }}>
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

                                                    {/* Status Dropdown — identik pola Ngaji & Mingguan */}
                                                    <td style={{ padding: "6px 10px", textAlign: "center" }}>
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
                                                                    { key: "__hapus__", icon: <CloseCircleOutlined />, label: "Hapus / Kosongkan", danger: true },
                                                                ],
                                                                onClick: ({ key: k }) => {
                                                                    if (!sesiId || isSaving) return;
                                                                    if (k === "__hapus__") { handleStatusClick(santri.nis, ""); }
                                                                    else if (k !== currentStatus) { handleStatusClick(santri.nis, k); }
                                                                    else { handleStatusClick(santri.nis, ""); }
                                                                },
                                                            }}
                                                            trigger={["click"]}
                                                            disabled={!sesiId || isSaving}
                                                        >
                                                            <div style={{
                                                                cursor: !sesiId || isSaving ? "not-allowed" : "pointer",
                                                                margin: "0 auto", width: 150, minHeight: 32,
                                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                                borderRadius: 8, gap: 6,
                                                                border: `1.5px solid ${statusCfg ? statusCfg.border : token.colorBorderSecondary}`,
                                                                background: statusCfg ? statusCfg.bg : "transparent",
                                                                color: statusCfg ? statusCfg.color : token.colorTextDisabled,
                                                                fontWeight: statusCfg ? 700 : 400, fontSize: 12,
                                                                opacity: isSaving ? 0.5 : 1, transition: "all 0.12s",
                                                                userSelect: "none",
                                                            }}>
                                                                {isSaving ? (
                                                                    <Spin size="small" />
                                                                ) : statusCfg ? (
                                                                    <>{statusCfg.icon} {statusCfg.label}</>
                                                                ) : (
                                                                    <span style={{ fontSize: 13, color: token.colorBorderSecondary }}>— Belum diisi —</span>
                                                                )}
                                                            </div>
                                                        </Dropdown>
                                                    </td>

                                                    {/* Monthly distribution per-santri */}
                                                    {STATUS_ABSENSI.map(s => {
                                                        const v = dist[s.key] ?? 0;
                                                        return (
                                                            <td key={s.key} style={{ padding: "5px 4px", textAlign: "center" }}>
                                                                <AntTooltip title={`${s.label}: ${v}x bulan ini`}>
                                                                    <div style={{
                                                                        width: 30, height: 30, borderRadius: 8, margin: "0 auto",
                                                                        background: v > 0 ? s.bg : token.colorFillAlter,
                                                                        display: "flex", alignItems: "center", justifyContent: "center",
                                                                        fontSize: 12, fontWeight: 800,
                                                                        color: v > 0 ? s.color : token.colorTextDisabled,
                                                                        border: v > 0 ? `1px solid ${s.border}` : "none",
                                                                        transition: "all 0.15s",
                                                                    }}>
                                                                        {v || "–"}
                                                                    </div>
                                                                </AntTooltip>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}

                                        {/* Footer total row */}
                                        {santriList.length > 0 && (
                                            <tr style={{ background: token.colorFillAlter, borderTop: `2px solid ${token.colorBorderSecondary}` }}>
                                                <td colSpan={4} style={{ padding: "10px 14px", fontWeight: 700, fontSize: 12, color: token.colorText }}>
                                                    TOTAL MINGGU INI
                                                    <Text type="secondary" style={{ fontWeight: 400, fontSize: 11, marginLeft: 8 }}>
                                                        · rekap bulanan →
                                                    </Text>
                                                </td>
                                                {STATUS_ABSENSI.map(s => (
                                                    <td key={s.key} style={{ padding: "8px 4px", textAlign: "center" }}>
                                                        <div style={{ fontWeight: 800, fontSize: 13, color: s.color }}>
                                                            {monthlyStats.counts[s.key] ?? 0}
                                                        </div>
                                                        <div style={{ fontSize: 9, color: token.colorTextDescription }}>bulan ini</div>
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

            {/* ── Export Modal ─────────────────────────────────────────────────── */}
            <Modal
                open={exportModalOpen}
                onCancel={() => setExportModalOpen(false)}
                footer={null} centered width={440} destroyOnClose
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
                            <div style={{ fontWeight: 800, fontSize: 16 }}>Export Sholat Hifdzi</div>
                            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 1 }}>
                                Ekspor seluruh sesi dalam 1 bulan Hijriah
                            </div>
                        </div>
                    </Space>
                </div>

                <div style={{ padding: "22px 26px 26px" }}>
                    <Text style={{ fontSize: 12, color: token.colorTextDescription, display: "block", marginBottom: 14 }}>
                        Pilih periode bulan yang akan diekspor ke Excel:
                    </Text>

                    <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
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

                    {/* Preview card */}
                    <div style={{
                        padding: "14px 16px", borderRadius: 12, marginBottom: 20,
                        background: token.colorSuccessBg, border: `1px solid ${token.colorSuccessBorder}`,
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                            <span style={{ fontSize: 22 }}>🕌</span>
                            <div>
                                <Text style={{ fontSize: 14, fontWeight: 700, color: token.colorSuccess, display: "block", lineHeight: 1.2 }}>
                                    {KEGIATAN_LABEL}
                                </Text>
                                <Text style={{ fontSize: 11, color: token.colorTextDescription }}>
                                    {HIJRI_MONTHS[exportBulan - 1]} {exportTahun} H
                                </Text>
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                            <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 18, fontWeight: 800, color: token.colorSuccess }}>{santriList.length}</div>
                                <div style={{ fontSize: 10, color: token.colorTextDescription }}>santri</div>
                            </div>
                            <div style={{ width: 1, background: token.colorSuccessBorder }} />
                            <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 18, fontWeight: 800, color: token.colorSuccess }}>4–5</div>
                                <div style={{ fontSize: 10, color: token.colorTextDescription }}>sesi/minggu</div>
                            </div>
                            <div style={{ width: 1, background: token.colorSuccessBorder }} />
                            <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 18, fontWeight: 800, color: token.colorSuccess }}>1</div>
                                <div style={{ fontSize: 10, color: token.colorTextDescription }}>sheet</div>
                            </div>
                        </div>
                    </div>

                    {/* Info note */}
                    <div style={{
                        padding: "10px 14px", borderRadius: 10, marginBottom: 20,
                        background: token.colorInfoBg, border: `1px solid ${token.colorInfoBorder}`,
                        display: "flex", gap: 8, alignItems: "flex-start",
                    }}>
                        <InfoCircleOutlined style={{ color: token.colorInfo, marginTop: 2, flexShrink: 0 }} />
                        <Text style={{ fontSize: 12, color: token.colorInfo }}>
                            Semua minggu dalam bulan ini akan diekspor dalam 1 sheet · Termasuk rekap status per santri (H/S/I/GH/P) · Disertakan grand total di baris terakhir
                        </Text>
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                        <Button style={{ flex: "0 0 auto", borderRadius: 10 }} onClick={() => setExportModalOpen(false)}>Batal</Button>
                        <Button
                            type="primary" icon={<ThunderboltOutlined />}
                            loading={exportLoading} onClick={handleExport}
                            style={{
                                flex: 1, borderRadius: 10, fontWeight: 700, height: 42, border: "none",
                                background: `linear-gradient(135deg, ${token.colorSuccess}, ${token.colorSuccessActive ?? token.colorSuccess})`,
                                boxShadow: `0 4px 12px ${token.colorSuccess}44`,
                            }}
                        >
                            Download Excel — {HIJRI_MONTHS[exportBulan - 1]} {exportTahun} H
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
