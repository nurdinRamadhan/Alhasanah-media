import React, { useState, useEffect, useMemo } from "react";
import {
    Button, Typography, Space, Select, Segmented, message,
    Avatar, Tag, Spin, theme, Dropdown, Modal, DatePicker, Input,
    InputNumber, Switch, Tooltip as AntTooltip, Checkbox, Card, Row, Col, Badge, Alert,
} from "antd";
import {
    PlusOutlined, CalendarOutlined, FileExcelOutlined, UserOutlined,
    EditOutlined, DeleteOutlined, CheckCircleOutlined, CloseCircleOutlined,
    ReloadOutlined, BookOutlined, BarChartOutlined, ThunderboltOutlined,
    TeamOutlined, WarningOutlined, InfoCircleOutlined, CheckOutlined,
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
import { motion, AnimatePresence } from "framer-motion";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
    ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

const { Text, Title } = Typography;
const { useToken } = theme;

// ─── Status Config (resolved from token, no hardcodes) ────────────────────────
const getStatusConfig = (token: any) => [
    { key: "HADIR",  label: "Hadir",  icon: "✅", code: "H",  color: token.colorSuccess, bg: token.colorSuccessBg, border: token.colorSuccessBorder },
    { key: "SAKIT",  label: "Sakit",  icon: "🤒", code: "S",  color: token.colorWarning, bg: token.colorWarningBg, border: token.colorWarningBorder },
    { key: "IZIN",   label: "Izin",   icon: "📝", code: "I",  color: token.colorInfo,    bg: token.colorInfoBg,    border: token.colorInfoBorder },
    { key: "PULANG", label: "Pulang", icon: "🏠", code: "P",  color: token.colorTextSecondary, bg: token.colorFillAlter, border: token.colorBorderSecondary },
    { key: "GHAIB",  label: "Ghaib",  icon: "❌", code: "GH", color: token.colorError,   bg: token.colorErrorBg,   border: token.colorErrorBorder },
];

// Excel fills remain fixed ARGB (Excel has no dark-mode)
const STATUS_FILLS: Record<string, string> = {
    HADIR: "FFD1FAE5", SAKIT: "FFFEF3C7", IZIN: "FFDBEAFE",
    GHAIB: "FFFEE2E2", PULANG: "FFF3E8FF",
};

const HARI_LABEL: Record<number, { short: string; full: string }> = {
    1: { short: "Sab", full: "Sabtu" },
    2: { short: "Ahd", full: "Ahad" },
    3: { short: "Sen", full: "Senin" },
    4: { short: "Sel", full: "Selasa" },
    5: { short: "Rab", full: "Rabu" },
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

const getWeekDates = (tahun: number, bulan: number, mingguKe: number) => {
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
        result.push({ tanggal: dayjs(d).format("YYYY-MM-DD"), hariKe: i + 1, sesiKe: 1 });
    }
    return result;
};

// ─── Animated Counter ─────────────────────────────────────────────────────────
const AnimatedNumber: React.FC<{ value: number }> = ({ value }) => {
    const [display, setDisplay] = React.useState(0);
    React.useEffect(() => {
        let start = 0;
        const step = value / 25;
        const timer = setInterval(() => {
            start += step;
            if (start >= value) { setDisplay(value); clearInterval(timer); }
            else setDisplay(Math.floor(start));
        }, 16);
        return () => clearInterval(timer);
    }, [value]);
    return <>{display}</>;
};

// ─── KPI Card ────────────────────────────────────────────────────────────────
const KpiCard: React.FC<{
    label: string; value: number; total: number;
    icon: string; color: string; bg: string; border: string;
    index: number; token: any;
}> = ({ label, value, total, icon, color, bg, border, index, token }) => {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.07, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
        >
            <Card
                bordered={false}
                style={{
                    borderRadius: 14, border: `1px solid ${border}`,
                    background: token.colorBgContainer,
                    boxShadow: `0 2px 12px ${token.colorFillSecondary}`,
                    overflow: "hidden", position: "relative",
                }}
                bodyStyle={{ padding: "16px 18px" }}
            >
                <div style={{
                    position: "absolute", top: -16, right: -16,
                    width: 64, height: 64, borderRadius: "50%",
                    background: color, opacity: 0.08,
                }} />
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                        background: bg, display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: 20,
                    }}>
                        {icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 11, color: token.colorTextDescription, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "block" }}>
                            {label}
                        </Text>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
                            <span style={{ fontSize: 24, fontWeight: 800, color: color, lineHeight: 1 }}>
                                <AnimatedNumber value={value} />
                            </span>
                            <span style={{ fontSize: 11, color: token.colorTextDescription }}>santri</span>
                        </div>
                    </div>
                    <div style={{
                        width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                        background: `conic-gradient(${color} ${pct * 3.6}deg, ${token.colorFillSecondary} 0deg)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                        <div style={{
                            width: 24, height: 24, borderRadius: "50%",
                            background: token.colorBgContainer,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 9, fontWeight: 800, color: color,
                        }}>
                            {pct}%
                        </div>
                    </div>
                </div>
                {/* Progress bar */}
                <div style={{ marginTop: 10, height: 3, borderRadius: 2, background: token.colorFillSecondary }}>
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: index * 0.07 + 0.3 }}
                        style={{ height: "100%", borderRadius: 2, background: color }}
                    />
                </div>
            </Card>
        </motion.div>
    );
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomBarTooltip = ({ active, payload, label, token }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: token.colorBgElevated, border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 10, padding: "10px 14px", boxShadow: token.boxShadow, minWidth: 140,
        }}>
            <p style={{ color: token.colorTextDescription, margin: "0 0 6px", fontSize: 11 }}>{label}</p>
            {payload.map((p: any) => (
                <p key={p.name} style={{ color: p.fill, margin: "2px 0", fontWeight: 600, fontSize: 12 }}>
                    {p.name}: <span style={{ color: token.colorText }}>{p.value}</span>
                </p>
            ))}
        </div>
    );
};

// ─── Helper colLetter ─────────────────────────────────────────────────────────
const colLetter = (n: number): string => {
    let s = "";
    while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
    return s;
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const NgajiList: React.FC = () => {
    const { token } = useToken();
    const isDark = hexLum(token.colorBgContainer) < 128;
    const { data: identity } = useGetIdentity<any>();
    const userIdentity = identity as IUserIdentity | undefined;
    const STATUS_ABSENSI = useMemo(() => getStatusConfig(token), [token]);

    const scope = useMemo(() => {
        if (!userIdentity) return { restricted: false, lockedGender: null as string | null, lockedJurusan: null as string | null };
        if (["super_admin", "rois", "dewan"].includes(userIdentity.role)) return { restricted: false, lockedGender: null, lockedJurusan: null };
        if (userIdentity.scopeGender === "P") return { restricted: true, lockedGender: "P", lockedJurusan: "ALL" as string | null };
        if (userIdentity.scopeGender === "L") return { restricted: true, lockedGender: "L", lockedJurusan: userIdentity.scopeJurusan };
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

    // ── Fetch santri ──────────────────────────────────────────────────────────
    useEffect(() => {
        (async () => {
            try {
                let query = supabaseClient
                    .from("santri")
                    .select("nis, nama, kelas, total_hafalan, foto_url")
                    .eq("jurusan", "TAHFIDZ")
                    .eq("status_santri", "AKTIF");
                if (scope.lockedGender) query = query.eq("jenis_kelamin", scope.lockedGender);
                const { data, error } = await query.order("kelas").order("nama");
                if (error) throw error;
                setSantriList(data || []);
                setFetchKey(k => k + 1);
            } catch (e: any) { message.error("Gagal memuat santri: " + e.message); }
        })();
    }, [scope]);

    // ── Fetch absensi for current week ────────────────────────────────────────
    useEffect(() => {
        if (!tahun || !bulan || !mingguKe || !identity?.id) return;
        setLoading(true);
        setSesiByKey({});
        setAbsensiGrid({});
        (async () => {
            try {
                const tanggalMulai = weekDates[0].tanggal;
                const tanggalAkhir = weekDates[weekDates.length - 1].tanggal;
                const { data: existingAll, error: selectErr } = await supabaseClient
                    .from("ngaji_sesi")
                    .select("id, hari_ke, sesi_ke, tanggal")
                    .eq("kegiatan_id", "NGAJI")
                    .gte("tanggal", tanggalMulai)
                    .lte("tanggal", tanggalAkhir);
                if (selectErr) throw selectErr;

                const existingMap = new Map((existingAll || []).map((r: any) => [`${r.hari_ke}_${r.sesi_ke}`, r]));
                const sesiResult: Record<string, string> = {};
                const toInsert: any[] = [];

                for (const wd of weekDates) {
                    const key = `${wd.hariKe}_${wd.sesiKe}`;
                    const existing = existingMap.get(key);
                    if (existing) { sesiResult[key] = existing.id; }
                    else {
                        toInsert.push({
                            kegiatan_id: "NGAJI", bulan_hijriah: bulanLabel, tahun_hijriah: tahun,
                            bulan_hijriah_number: bulan, minggu_ke: mingguKe,
                            tanggal: wd.tanggal, hari_ke: wd.hariKe, sesi_ke: wd.sesiKe, created_by: identity.id,
                        });
                    }
                }
                if (toInsert.length > 0) {
                    const { data: inserted, error: insertErr } = await supabaseClient
                        .from("ngaji_sesi")
                        .upsert(toInsert, { onConflict: "kegiatan_id,bulan_hijriah,tahun_hijriah,minggu_ke,hari_ke,sesi_ke" })
                        .select("id, hari_ke, sesi_ke");
                    if (insertErr) throw insertErr;
                    (inserted || []).forEach((r: any) => { sesiResult[`${r.hari_ke}_${r.sesi_ke}`] = r.id; });
                }
                setSesiByKey(sesiResult);

                const uniqueTanggal = [...new Set(weekDates.map(wd => wd.tanggal))];
                const hijriDates = uniqueTanggal.map(t => resolveHijri(t));
                const orFilter = hijriDates
                    .map(h => `and(tahun_hijriah.eq.${h.hy},bulan_hijriah_number.eq.${h.hm},hari_hijriah.eq.${h.hd},sesi_ke.eq.1)`)
                    .join(",");

                const { data: absensiData, error: absenErr } = await supabaseClient
                    .from("ngaji_absensi")
                    .select("tahun_hijriah, bulan_hijriah_number, hari_hijriah, sesi_ke, santri_nis, status")
                    .or(orFilter);
                if (absenErr) throw absenErr;

                const grid: Record<string, Record<string, { status: string | null }>> = {};
                (absensiData || []).forEach((a: any) => {
                    if (!grid[a.santri_nis]) grid[a.santri_nis] = {};
                    grid[a.santri_nis][`${a.tahun_hijriah}_${a.bulan_hijriah_number}_${a.hari_hijriah}_${a.sesi_ke}`] = { status: a.status };
                });
                setAbsensiGrid(grid);
            } catch (e: any) { message.error("Gagal memuat absensi: " + e.message); }
            finally { setLoading(false); }
        })();
    }, [tahun, bulan, mingguKe, identity?.id, fetchKey, bulanLabel]);

    // ── KPI Stats ─────────────────────────────────────────────────────────────
    const weekStats = useMemo(() => {
        const counts: Record<string, number> = { HADIR: 0, SAKIT: 0, IZIN: 0, PULANG: 0, GHAIB: 0 };
        const total = santriList.length * 5;
        let filled = 0;

        santriList.forEach(santri => {
            const santriAbs = absensiGrid[santri.nis] || {};
            weekDates.forEach(wd => {
                const h = resolveHijri(wd.tanggal);
                const gk = `${h.hy}_${h.hm}_${h.hd}_1`;
                const st = santriAbs[gk]?.status;
                if (st && counts[st] !== undefined) { counts[st]++; filled++; }
            });
        });

        const totalFilled = Object.values(counts).reduce((a, b) => a + b, 0);
        const rate = total > 0 ? Math.round((counts.HADIR / total) * 100) : 0;
        return { counts, total, filled: totalFilled, rate, santriTotal: santriList.length };
    }, [absensiGrid, santriList, weekDates]);

    // ── Daily chart data (for current week) ───────────────────────────────────
    const dailyChartData = useMemo(() => {
        return weekDates.map((wd, i) => {
            const h = resolveHijri(wd.tanggal);
            const gk = `${h.hy}_${h.hm}_${h.hd}_1`;
            const row: Record<string, any> = { day: HARI_LABEL[i + 1]?.short ?? `H${i + 1}`, date: dayjs(wd.tanggal).format("DD/MM") };
            ["HADIR", "SAKIT", "IZIN", "GHAIB", "PULANG"].forEach(st => { row[st] = 0; });
            santriList.forEach(s => {
                const st = absensiGrid[s.nis]?.[gk]?.status;
                if (st && row[st] !== undefined) row[st]++;
            });
            return row;
        });
    }, [weekDates, absensiGrid, santriList]);

    // ── Per-santri row summary ────────────────────────────────────────────────
    const getSantriWeekSummary = (nis: string) => {
        const santriAbs = absensiGrid[nis] || {};
        const counts: Record<string, number> = { HADIR: 0, SAKIT: 0, IZIN: 0, PULANG: 0, GHAIB: 0 };
        weekDates.forEach(wd => {
            const h = resolveHijri(wd.tanggal);
            const gk = `${h.hy}_${h.hm}_${h.hd}_1`;
            const st = santriAbs[gk]?.status;
            if (st && counts[st] !== undefined) counts[st]++;
        });
        return counts;
    };

    // ── Handle status click ───────────────────────────────────────────────────
    const handleStatusClick = async (nis: string, tanggal: string, sesiKe: number, status: string) => {
        const h = resolveHijri(tanggal);
        const { hy, hm, hd } = h;
        const cellKey = `${nis}_${hy}_${hm}_${hd}_${sesiKe}`;
        if (savingCells[cellKey]) return;
        setSavingCells(prev => ({ ...prev, [cellKey]: true }));
        const gridKey = `${hy}_${hm}_${hd}_${sesiKe}`;
        try {
            if (status === "") {
                await supabaseClient.from("ngaji_absensi").delete()
                    .eq("tahun_hijriah", hy).eq("bulan_hijriah_number", hm)
                    .eq("hari_hijriah", hd).eq("sesi_ke", sesiKe).eq("santri_nis", nis);
                setAbsensiGrid(prev => {
                    if (!prev[nis]) return prev;
                    const next = { ...prev, [nis]: { ...prev[nis] } };
                    delete next[nis][gridKey];
                    return next;
                });
            } else {
                await supabaseClient.from("ngaji_absensi").upsert(
                    { tahun_hijriah: hy, bulan_hijriah_number: hm, hari_hijriah: hd, sesi_ke: sesiKe, santri_nis: nis, status },
                    { onConflict: "tahun_hijriah,bulan_hijriah_number,hari_hijriah,sesi_ke,santri_nis" }
                );
                setAbsensiGrid(prev => ({ ...prev, [nis]: { ...prev[nis], [gridKey]: { status } } }));
            }
        } catch { message.error("Gagal menyimpan"); }
        finally { setSavingCells(prev => ({ ...prev, [cellKey]: false })); }
    };

    const yearOptions = useMemo(() => {
        const years: number[] = [];
        for (let y = todayHijri.hy - 2; y <= todayHijri.hy + 2; y++) years.push(y);
        return years;
    }, [todayHijri.hy]);

    // ── Koreksi Hijriah state ──────────────────────────────────────────────────
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
        const { data } = await supabaseClient.from("koreksi_bulan_hijriah")
            .select("tahun_hijriah, bulan_hijriah_number, tanggal_awal_masehi, panjang_bulan, verified, keterangan")
            .order("tahun_hijriah", { ascending: false }).order("bulan_hijriah_number", { ascending: false });
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
            if (h.hy === thn && h.hm === bln && h.hd === 1) { setKoreksiAwal(d); return; }
        }
    };

    const openKoreksiModal = () => {
        setKoreksiTahun(tahun); setKoreksiBulan(bulan);
        setKoreksiAwal(null); setKoreksiPanjang(30);
        setKoreksiVerified(false); setKoreksiKet("");
        autoFillKoreksi(tahun, bulan);
        setKoreksiOpen(true); loadKoreksi();
    };

    const handleKoreksiSave = async () => {
        if (!koreksiTahun) { message.warning("Isi tahun"); return; }
        if (!koreksiAwal) { message.warning("Isi tanggal awal"); return; }
        setKoreksiSaving(true);
        try {
            const { error } = await supabaseClient.from("koreksi_bulan_hijriah").upsert({
                tahun_hijriah: koreksiTahun, bulan_hijriah_number: koreksiBulan,
                tanggal_awal_masehi: koreksiAwal.format("YYYY-MM-DD"),
                panjang_bulan: koreksiPanjang, verified: koreksiVerified,
                keterangan: koreksiKet.trim() || null,
            }, { onConflict: "tahun_hijriah,bulan_hijriah_number" });
            if (error) throw error;
            message.success("Koreksi tersimpan"); korRefresh(); loadKoreksi();
        } catch (e: any) { message.error("Gagal: " + e.message); }
        finally { setKoreksiSaving(false); }
    };

    const handleKoreksiDelete = async (thn: number, bln: number) => {
        try {
            await supabaseClient.from("koreksi_bulan_hijriah").delete()
                .eq("tahun_hijriah", thn).eq("bulan_hijriah_number", bln);
            message.success("Koreksi dihapus"); korRefresh(); loadKoreksi();
        } catch (e: any) { message.error("Gagal hapus: " + e.message); }
    };

    // ── Excel Export (fixed + polished) ──────────────────────────────────────
    const exportWeeksData = async (weekNumbers: number[]) => {
        if (exporting || weekNumbers.length === 0) { message.warning("Pilih minimal satu minggu"); return; }
        setExporting(true);
        setExportModalOpen(false);
        try {
            const { data: santri } = await supabaseClient.from("santri")
                .select("nis, nama, kelas, total_hafalan")
                .eq("jurusan", "TAHFIDZ").eq("status_santri", "AKTIF")
                .order("kelas").order("nama");
            const santriListData = santri || [];

            const weeksData = weekNumbers.map(mg => ({ mingguKe: mg, dates: getWeekDates(tahun, bulan, mg) }));
            const allTanggals = [...new Set(weeksData.flatMap(w => w.dates.map(d => d.tanggal)))].sort();

            // Fetch / ensure sesi records exist
            const tglMulai = allTanggals[0];
            const tglAkhir = allTanggals[allTanggals.length - 1];
            const { data: existingSesi } = await supabaseClient.from("ngaji_sesi")
                .select("id, hari_ke, sesi_ke, tanggal").eq("kegiatan_id", "NGAJI")
                .gte("tanggal", tglMulai).lte("tanggal", tglAkhir);
            const existingSesiSet = new Set((existingSesi || []).map((s: any) => `${s.tanggal}_${s.hari_ke}_${s.sesi_ke}`));
            const toCreateExport: any[] = [];
            for (const week of weeksData) {
                for (const wd of week.dates) {
                    const key = `${wd.tanggal}_${wd.hariKe}_${wd.sesiKe}`;
                    if (!existingSesiSet.has(key)) {
                        toCreateExport.push({
                            kegiatan_id: "NGAJI", bulan_hijriah: bulanLabel, tahun_hijriah: tahun,
                            bulan_hijriah_number: bulan, minggu_ke: week.mingguKe,
                            tanggal: wd.tanggal, hari_ke: wd.hariKe, sesi_ke: wd.sesiKe, created_by: identity?.id,
                        });
                    }
                }
            }
            if (toCreateExport.length > 0) {
                await supabaseClient.from("ngaji_sesi").upsert(toCreateExport, { onConflict: "kegiatan_id,bulan_hijriah,tahun_hijriah,minggu_ke,hari_ke,sesi_ke" });
            }

            // Fetch absensi for all selected dates
            const exportAbsensiGrid: Record<string, Record<string, { status: string | null }>> = {};
            const orClauses = allTanggals.map(t => {
                const h = resolveHijri(t);
                return `and(tahun_hijriah.eq.${h.hy},bulan_hijriah_number.eq.${h.hm},hari_hijriah.eq.${h.hd},sesi_ke.eq.1)`;
            });
            const { data: absData } = await supabaseClient.from("ngaji_absensi")
                .select("tahun_hijriah, bulan_hijriah_number, hari_hijriah, sesi_ke, santri_nis, status")
                .or(orClauses.join(","));
            (absData || []).forEach((a: any) => {
                if (!exportAbsensiGrid[a.santri_nis]) exportAbsensiGrid[a.santri_nis] = {};
                exportAbsensiGrid[a.santri_nis][`${a.tahun_hijriah}_${a.bulan_hijriah_number}_${a.hari_hijriah}_${a.sesi_ke}`] = { status: a.status };
            });

            // ── Build Workbook ────────────────────────────────────────────
            const wb = new ExcelJS.Workbook();
            wb.creator = "Al-Hasanah Admin";
            wb.created = new Date();

            const multiWeek = weeksData.length > 1;
            const COLS_BASE = 3;       // No | Nama | Hafalan
            const COLS_PER_WEEK = 9;   // 5 hari + H + S + I + G
            const COLS_RECAP = 4;      // Total H | S | I | G
            const totalCols = COLS_BASE + (weeksData.length * COLS_PER_WEEK) + (multiWeek ? COLS_RECAP : 0);

            const ws = wb.addWorksheet("Absensi Ngaji", {
                pageSetup: { fitToPage: true, fitToWidth: 1, orientation: "landscape" },
                views: [{ state: "frozen", xSplit: 3, ySplit: 4, activeCell: "D5" }],
            });

            // ── Row 1: Title ──────────────────────────────────────────────
            ws.mergeCells(`A1:${colLetter(totalCols)}1`);
            const titleCell = ws.getCell("A1");
            const weekLabel = weekNumbers.length === 1
                ? `Minggu ke-${weekNumbers[0]}`
                : `Minggu ${weekNumbers.join(", ")}`;
            titleCell.value = `ABSENSI NGAJI TAHFIDZ — ${bulanLabel.toUpperCase()} ${tahun} H  |  ${weekLabel}`;
            titleCell.font = { size: 14, bold: true, color: { argb: "FFFFFFFF" }, name: "Calibri" };
            titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7C3AED" } };
            titleCell.alignment = { horizontal: "center", vertical: "middle" };
            ws.getRow(1).height = 26;

            // ── Row 2: Subtitle (metadata) ────────────────────────────────
            ws.mergeCells(`A2:${colLetter(totalCols)}2`);
            const subtitleCell = ws.getCell("A2");
            subtitleCell.value = `Dicetak: ${dayjs().format("DD MMMM YYYY, HH:mm")}  |  Total Santri: ${santriListData.length}  |  Kegiatan: Ngaji Tahfidz`;
            subtitleCell.font = { size: 9, italic: true, color: { argb: "FF6B7280" }, name: "Calibri" };
            subtitleCell.alignment = { horizontal: "center" };
            ws.getRow(2).height = 16;

            // ── Row 3: Group headers ──────────────────────────────────────
            const groupRowValues: any[] = ["", "", ""];
            let gColStart = 4;
            weeksData.forEach(week => {
                const dates = week.dates;
                const firstDate = dayjs(dates[0].tanggal).format("DD/MM");
                const lastDate = dayjs(dates[4].tanggal).format("DD/MM");
                groupRowValues.push(`MINGGU KE-${week.mingguKe}  (${firstDate} – ${lastDate})`);
                for (let i = 0; i < COLS_PER_WEEK - 1; i++) groupRowValues.push("");
            });
            if (multiWeek) {
                groupRowValues.push("REKAP SELURUH MINGGU YANG DIPILIH");
                for (let i = 0; i < COLS_RECAP - 1; i++) groupRowValues.push("");
            }

            const groupRow = ws.getRow(3);
            groupRow.values = groupRowValues;
            groupRow.height = 22;

            let gc = 4;
            weeksData.forEach(() => {
                ws.mergeCells(`${colLetter(gc)}3:${colLetter(gc + COLS_PER_WEEK - 1)}3`);
                const cell = groupRow.getCell(gc);
                cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" }, name: "Calibri" };
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC9A84C" } };
                cell.alignment = { horizontal: "center", vertical: "middle" };
                gc += COLS_PER_WEEK;
            });
            if (multiWeek) {
                ws.mergeCells(`${colLetter(gc)}3:${colLetter(gc + COLS_RECAP - 1)}3`);
                const recapCell = groupRow.getCell(gc);
                recapCell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" }, name: "Calibri" };
                recapCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
                recapCell.alignment = { horizontal: "center", vertical: "middle" };
            }

            // ── Row 4: Sub-headers ────────────────────────────────────────
            const subRow: any[] = ["NO", "NAMA SANTRI", "HAFALAN"];
            weeksData.forEach(week => {
                week.dates.forEach((wd, i) => {
                    const h = resolveHijri(wd.tanggal);
                    subRow.push(`${HARI_LABEL[i + 1]?.full ?? ""}\n${h.hd} ${HIJRI_MONTHS[h.hm - 1]}`);
                });
                subRow.push("H", "S", "I", "A");
            });
            if (multiWeek) subRow.push("∑H", "∑S", "∑I", "∑A");

            const subRowObj = ws.getRow(4);
            subRowObj.values = subRow;
            subRowObj.height = 34;
            subRowObj.eachCell((cell: any, colNum: number) => {
                cell.font = { bold: true, size: 8, name: "Calibri" };
                cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
                const isStat = colNum > 3;
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isStat ? "FFEFF6FF" : "FFF9FAFB" } };
                cell.border = {
                    top: { style: "thin", color: { argb: "FFD1D5DB" } },
                    bottom: { style: "medium", color: { argb: "FF9CA3AF" } },
                    left: { style: "thin", color: { argb: "FFD1D5DB" } },
                    right: { style: "thin", color: { argb: "FFD1D5DB" } },
                };
            });

            // ── Column widths ─────────────────────────────────────────────
            ws.columns = [
                { key: "no", width: 5 },
                { key: "nama", width: 26 },
                { key: "hafalan", width: 9 },
                ...weeksData.flatMap(() => [
                    { key: "", width: 9 }, { key: "", width: 9 }, { key: "", width: 9 },
                    { key: "", width: 9 }, { key: "", width: 9 },
                    { key: "", width: 6 }, { key: "", width: 6 }, { key: "", width: 6 }, { key: "", width: 6 },
                ]),
                ...(multiWeek ? [
                    { key: "", width: 7 }, { key: "", width: 7 }, { key: "", width: 7 }, { key: "", width: 7 },
                ] : []),
            ];

            // ── Data rows ────────────────────────────────────────────────
            const perWeekGrandTotals = weeksData.map(() => ({ H: 0, S: 0, I: 0, A: 0 }));
            const recapGrandTotals = { H: 0, S: 0, I: 0, A: 0 };

            santriListData.forEach((s: any, idx: number) => {
                const rv: any[] = [idx + 1, s.nama || santriAlias(s.nis), s.total_hafalan || "–"];
                const weeklyCounts: { H: number; S: number; I: number; A: number }[] = [];

                weeksData.forEach((week, wi) => {
                    let cH = 0, cS = 0, cI = 0, cA = 0;
                    week.dates.forEach(wd => {
                        const hi = resolveHijri(wd.tanggal);
                        const gk = `${hi.hy}_${hi.hm}_${hi.hd}_1`;
                        const st = exportAbsensiGrid[s.nis]?.[gk]?.status;
                        rv.push(st ? (st === "HADIR" ? "H" : st === "SAKIT" ? "S" : st === "IZIN" ? "I" : st === "PULANG" ? "P" : "GH") : "");
                        if (st === "HADIR") cH++;
                        else if (st === "SAKIT") cS++;
                        else if (st === "IZIN") cI++;
                        else if (st === "GHAIB" || st === "PULANG") cA++;
                    });
                    rv.push(cH || "", cS || "", cI || "", cA || "");
                    weeklyCounts.push({ H: cH, S: cS, I: cI, A: cA });
                    perWeekGrandTotals[wi].H += cH;
                    perWeekGrandTotals[wi].S += cS;
                    perWeekGrandTotals[wi].I += cI;
                    perWeekGrandTotals[wi].A += cA;
                });

                if (multiWeek) {
                    const totH = weeklyCounts.reduce((a, c) => a + c.H, 0);
                    const totS = weeklyCounts.reduce((a, c) => a + c.S, 0);
                    const totI = weeklyCounts.reduce((a, c) => a + c.I, 0);
                    const totA = weeklyCounts.reduce((a, c) => a + c.A, 0);
                    rv.push(totH || "", totS || "", totI || "", totA || "");
                    recapGrandTotals.H += totH;
                    recapGrandTotals.S += totS;
                    recapGrandTotals.I += totI;
                    recapGrandTotals.A += totA;
                }

                const dataRow = ws.addRow(rv);
                const isEven = idx % 2 === 1;
                dataRow.height = 18;

                // Per-row base styling
                dataRow.eachCell((cell: any, colNum: number) => {
                    cell.font = { size: 9, name: "Calibri" };
                    cell.alignment = { horizontal: colNum <= 2 ? "left" : "center", vertical: "middle" };
                    if (isEven) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
                    cell.border = {
                        bottom: { style: "hair", color: { argb: "FFE5E7EB" } },
                        left: { style: "hair", color: { argb: "FFE5E7EB" } },
                        right: { style: "hair", color: { argb: "FFE5E7EB" } },
                    };
                });

                // Color-fill attendance cells
                let ci = COLS_BASE + 1;
            weeksData.forEach(week => {
                    week.dates.forEach(wd => {
                        const hi = resolveHijri(wd.tanggal);
                        const gk = `${hi.hy}_${hi.hm}_${hi.hd}_1`;
                        const st = exportAbsensiGrid[s.nis]?.[gk]?.status;
                        if (st) {
                            const fill = STATUS_FILLS[st];
                            if (fill) dataRow.getCell(ci).fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
                        }
                        ci++;
                    });
                    ci += 4; // skip per-week stat cols
                });
            });

            // ── Per-week subtotal row (for each week) ─────────────────────
            ws.addRow([]);
            weeksData.forEach((week, wi) => {
                const totRow: any[] = ["", `→ Subtotal Minggu ke-${week.mingguKe}`, ""];
                weeksData.forEach((_, wj) => {
                    for (let d = 0; d < 5; d++) totRow.push(""); // hari
                    if (wj === wi) {
                        totRow.push(perWeekGrandTotals[wj].H || "", perWeekGrandTotals[wj].S || "", perWeekGrandTotals[wj].I || "", perWeekGrandTotals[wj].A || "");
                    } else {
                        totRow.push("", "", "", "");
                    }
                });
                if (multiWeek) totRow.push("", "", "", "");

                const subtotalRow = ws.addRow(totRow);
                subtotalRow.height = 17;
                subtotalRow.eachCell((cell: any, colNum: number) => {
                    cell.font = { bold: true, italic: true, size: 9, name: "Calibri", color: { argb: "FF374151" } };
                    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7ED" } };
                    cell.alignment = { horizontal: colNum <= 2 ? "left" : "center", vertical: "middle" };
                });
            });

            // ── Grand total row (only when multi-week) ────────────────────
            if (multiWeek) {
                ws.addRow([]);
                const grandTotals: any[] = ["", "✦ TOTAL KESELURUHAN", ""];
                weeksData.forEach((_, wi) => {
                    for (let d = 0; d < 5; d++) grandTotals.push("");
                    grandTotals.push(
                        perWeekGrandTotals[wi].H || "",
                        perWeekGrandTotals[wi].S || "",
                        perWeekGrandTotals[wi].I || "",
                        perWeekGrandTotals[wi].A || ""
                    );
                });
                grandTotals.push(recapGrandTotals.H || "", recapGrandTotals.S || "", recapGrandTotals.I || "", recapGrandTotals.A || "");

                const gRow = ws.addRow(grandTotals);
                gRow.height = 20;
                gRow.eachCell((cell: any, colNum: number) => {
                    cell.font = { bold: true, size: 10, name: "Calibri", color: { argb: "FFFFFFFF" } };
                    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
                    cell.alignment = { horizontal: colNum <= 2 ? "left" : "center", vertical: "middle" };
                });
            }

            // AutoFilter
            ws.autoFilter = { from: "A4", to: `${colLetter(totalCols)}4` };

            const buffer = await wb.xlsx.writeBuffer();
            const wkLabel = weekNumbers.length >= mingguMaxKe ? "SemuaMinggu" : `Mg${weekNumbers.join("_")}`;
            saveAs(new Blob([buffer]), `AbsensiNgaji_${bulanLabel}_${tahun}H_${wkLabel}_${dayjs().format("YYYYMMDD")}.xlsx`);
            message.success("✅ File Excel berhasil diunduh");
        } catch (error: any) {
            message.error("Gagal export: " + error.message);
        } finally { setExporting(false); }
    };

    // ── Donut data ─────────────────────────────────────────────────────────────
    const donutData = useMemo(() =>
        STATUS_ABSENSI
            .map(s => ({ name: s.label, value: weekStats.counts[s.key] ?? 0, color: s.color, icon: s.icon }))
            .filter(d => d.value > 0),
        [weekStats, STATUS_ABSENSI]
    );

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div style={{ padding: "0 0 80px", background: token.colorBgLayout, minHeight: "100vh" }}>

            {/* ── Page Header ───────────────────────────────────────────────── */}
            <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                style={{
                    padding: "24px 24px 0",
                    display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                    flexWrap: "wrap", gap: 12, marginBottom: 20,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{
                        width: 44, height: 44, borderRadius: 12,
                        background: `linear-gradient(135deg, ${token.colorPrimary}, ${token.colorPrimaryActive})`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 22, boxShadow: `0 4px 14px ${token.colorPrimary}44`, flexShrink: 0,
                    }}>📖</div>
                    <div>
                        <Title level={4} style={{ margin: 0, lineHeight: 1.15, fontSize: 19, fontWeight: 800 }}>
                            Absensi Ngaji Tahfidz
                        </Title>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            {bulanLabel} {tahun} H · Minggu ke-{mingguKe} · {santriList.length} santri aktif
                        </Text>
                    </div>
                </div>
                <Space wrap>
                    <Button icon={<ReloadOutlined />} onClick={() => setFetchKey(k => k + 1)} />
                    <Button
                        icon={<EditOutlined />} onClick={openKoreksiModal}
                        style={{ color: token.colorWarning, borderColor: token.colorWarningBorder }}
                    >
                        Koreksi Hijriah
                    </Button>
                    <Button
                        icon={<FileExcelOutlined />} loading={exporting}
                        onClick={() => { setSelectedExportWeeks([mingguKe]); setExportModalOpen(true); }}
                        style={{ color: token.colorSuccess, borderColor: token.colorSuccessBorder, fontWeight: 600 }}
                    >
                        Export Excel
                    </Button>
                    <Button
                        type="primary" icon={<CalendarOutlined />}
                        onClick={() => {
                            const h = getCurrentHijri();
                            setTahun(h.hy); setBulan(h.hm);
                            const mk = Math.min(Math.ceil(h.hd / 7), 4);
                            setMingguKe(mk); setShowWeek5(mk === 5);
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
                <motion.div
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08, duration: 0.35 }}
                    style={{
                        background: token.colorBgContainer,
                        border: `1px solid ${token.colorBorderSecondary}`,
                        borderRadius: 14, padding: "14px 20px", marginBottom: 20,
                        display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center",
                        boxShadow: `0 1px 4px ${token.colorFillSecondary}`,
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <CalendarOutlined style={{ color: token.colorPrimary, fontSize: 14 }} />
                        <Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>Tahun:</Text>
                        <Select
                            value={tahun} size="small"
                            onChange={v => { setTahun(v); setMingguKe(1); setShowWeek5(false); }}
                            options={yearOptions.map(y => ({ label: `${y} H`, value: y }))}
                            style={{ width: 100 }}
                        />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>Bulan:</Text>
                        <Select
                            value={bulan} size="small"
                            onChange={v => { setBulan(v); setMingguKe(1); setShowWeek5(false); }}
                            options={HIJRI_MONTHS.map((name, i) => ({ label: name, value: i + 1 }))}
                            style={{ width: 148 }}
                        />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>Minggu:</Text>
                        <Segmented
                            value={mingguKe} size="small"
                            onChange={v => setMingguKe(v as number)}
                            options={Array.from({ length: mingguMaxKe }, (_, i) => ({ label: `Mg ${i + 1}`, value: i + 1 }))}
                        />
                        {!showWeek5 && (
                            <Button type="dashed" size="small" icon={<PlusOutlined />}
                                onClick={() => { setShowWeek5(true); setMingguKe(5); }}
                                style={{ borderRadius: 6, fontSize: 11, height: 24, padding: "0 8px" }}
                            >
                                Mg 5
                            </Button>
                        )}
                    </div>
                    {/* Current week range badge */}
                    {weekDates.length > 0 && (
                        <div style={{
                            marginLeft: "auto", padding: "4px 12px", borderRadius: 8,
                            background: token.colorPrimaryBg, border: `1px solid ${token.colorPrimaryBorder}`,
                        }}>
                            <Text style={{ fontSize: 11, color: token.colorPrimary, fontWeight: 600 }}>
                                {dayjs(weekDates[0].tanggal).format("DD MMM")} – {dayjs(weekDates[4].tanggal).format("DD MMM YYYY")}
                            </Text>
                        </div>
                    )}
                </motion.div>

                {/* ── KPI Cards ──────────────────────────────────────────────── */}
                {!loading && (
                    <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
                        {/* Total santri */}
                        <Col xs={12} sm={8} lg={4}>
                            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
                                <Card bordered={false} style={{
                                    borderRadius: 14, border: `1px solid ${token.colorBorderSecondary}`,
                                    background: token.colorBgContainer, boxShadow: `0 2px 12px ${token.colorFillSecondary}`,
                                }} bodyStyle={{ padding: "16px 18px" }}>
                                    <Text style={{ fontSize: 10, color: token.colorTextDescription, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", display: "block" }}>
                                        Total Santri
                                    </Text>
                                    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, marginTop: 4 }}>
                                        <span style={{ fontSize: 28, fontWeight: 800, color: token.colorText, lineHeight: 1 }}>
                                            <AnimatedNumber value={weekStats.santriTotal} />
                                        </span>
                                        <Text style={{ fontSize: 11, color: token.colorTextDescription, marginBottom: 3 }}>aktif</Text>
                                    </div>
                                    <Text style={{ fontSize: 10, color: token.colorTextDescription, marginTop: 4, display: "block" }}>
                                        {weekStats.filled}/{weekStats.total} terisi ({Math.round((weekStats.filled / Math.max(weekStats.total, 1)) * 100)}%)
                                    </Text>
                                    <div style={{ marginTop: 8, height: 3, borderRadius: 2, background: token.colorFillSecondary }}>
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.round((weekStats.filled / Math.max(weekStats.total, 1)) * 100)}%` }}
                                            transition={{ duration: 0.8, ease: "easeOut" }}
                                            style={{ height: "100%", borderRadius: 2, background: token.colorPrimary }}
                                        />
                                    </div>
                                </Card>
                            </motion.div>
                        </Col>
                        {STATUS_ABSENSI.map((s, i) => (
                            <Col xs={12} sm={8} lg={4} key={s.key}>
                                <KpiCard
                                    label={s.label} value={weekStats.counts[s.key] ?? 0}
                                    total={weekStats.total} icon={s.icon}
                                    color={s.color} bg={s.bg} border={s.border}
                                    index={i + 1} token={token}
                                />
                            </Col>
                        ))}
                    </Row>
                )}

                {/* ── Attendance Rate Alert ───────────────────────────────────── */}
                <AnimatePresence>
                    {!loading && weekStats.rate < 70 && weekStats.filled > 0 && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ marginBottom: 16 }}>
                            <Alert type="warning" showIcon icon={<WarningOutlined />}
                                message={`Tingkat kehadiran minggu ini ${weekStats.rate}% — di bawah target 70%. Harap ditindaklanjuti.`}
                                style={{ borderRadius: 10 }}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Charts Row ──────────────────────────────────────────────── */}
                {!loading && weekStats.total > 0 && (
                    <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                        {/* Grouped bar chart */}
                        <Col xs={24} lg={15}>
                            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.38, delay: 0.1 }}>
                                <Card bordered={false} style={{
                                    borderRadius: 16, border: `1px solid ${token.colorBorderSecondary}`,
                                    boxShadow: `0 1px 4px ${token.colorFillSecondary}`, height: "100%",
                                }} bodyStyle={{ padding: "18px 20px 12px" }}>
                                    <div style={{ marginBottom: 14 }}>
                                        <Space size={8}>
                                            <BarChartOutlined style={{ color: token.colorPrimary }} />
                                            <Text strong style={{ fontSize: 13 }}>Distribusi Harian — Minggu ke-{mingguKe}</Text>
                                        </Space>
                                        <div style={{ fontSize: 11, color: token.colorTextDescription, marginTop: 2 }}>
                                            Breakdown status kehadiran per hari (Sabtu – Rabu)
                                        </div>
                                    </div>
                                    <ResponsiveContainer width="100%" height={190}>
                                        <BarChart data={dailyChartData} barSize={14} barGap={2}
                                            margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke={token.colorBorderSecondary} vertical={false} />
                                            <XAxis dataKey="day" tick={{ fontSize: 11, fill: token.colorTextDescription }} axisLine={false} tickLine={false} />
                                            <YAxis tick={{ fontSize: 10, fill: token.colorTextDescription }} axisLine={false} tickLine={false} allowDecimals={false} />
                                            <ReTooltip content={(p) => <CustomBarTooltip {...p} token={token} />} cursor={{ fill: token.colorFillSecondary }} />
                                            {STATUS_ABSENSI.map(s => (
                                                <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[3, 3, 0, 0]} />
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

                        {/* Donut + rate */}
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
                                                {/* Center label */}
                                                <div style={{
                                                    position: "absolute", top: "50%", left: "50%",
                                                    transform: "translate(-50%, -50%)",
                                                    textAlign: "center", pointerEvents: "none",
                                                }}>
                                                    <div style={{ fontSize: 20, fontWeight: 800, color: token.colorSuccess, lineHeight: 1 }}>{weekStats.rate}%</div>
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

                {/* ── Attendance Table ──────────────────────────────────────────── */}
                <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22, duration: 0.38 }}>
                    <Card
                        bordered={false}
                        style={{
                            borderRadius: 16, border: `1px solid ${token.colorBorderSecondary}`,
                            overflow: "hidden", boxShadow: `0 1px 4px ${token.colorFillSecondary}`,
                        }}
                        bodyStyle={{ padding: 0 }}
                    >
                        {/* Table Header Bar */}
                        <div style={{
                            padding: "14px 20px",
                            borderBottom: `1px solid ${token.colorBorderSecondary}`,
                            background: token.colorFillAlter,
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                        }}>
                            <Space size={10}>
                                <Badge
                                    count={weekStats.counts.GHAIB + weekStats.counts.PULANG}
                                    overflowCount={999}
                                    style={{ background: token.colorError }}
                                    offset={[4, 0]}
                                >
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
                                <Text type="secondary" style={{ fontSize: 11, paddingLeft: 6 }}>Klik ▾ untuk ubah</Text>
                            </Space>
                        </div>

                        {/* Table */}
                        {loading ? (
                            <div style={{ padding: "60px 20px", textAlign: "center" }}>
                                <Spin size="large" />
                                <div style={{ marginTop: 12, color: token.colorTextDescription, fontSize: 13 }}>Memuat data absensi...</div>
                            </div>
                        ) : (
                            <div style={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                                    <thead>
                                        <tr style={{ background: token.colorFillAlter }}>
                                            <th rowSpan={2} style={{ ...thStyle(token), width: 36, textAlign: "center" }}>#</th>
                                            <th rowSpan={2} style={{ ...thStyle(token), width: 190, textAlign: "left" }}>Santri</th>
                                            <th rowSpan={2} style={{ ...thStyle(token), width: 46, textAlign: "center" }}>Kls</th>
                                            {weekDates.map((wd, i) => {
                                                const h = resolveHijri(wd.tanggal);
                                                const isOverflow = h && h.hm !== bulan;
                                                return (
                                                    <th key={i} style={{
                                                        ...thStyle(token), textAlign: "center", minWidth: 130,
                                                        borderBottom: `2px solid ${isOverflow ? token.colorWarningBorder : token.colorPrimaryBorder}`,
                                                    }}>
                                                        <div style={{
                                                            fontWeight: 700, fontSize: 12,
                                                            color: isOverflow ? token.colorWarning : token.colorPrimary,
                                                            display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                                                        }}>
                                                            {HARI_LABEL[i + 1]?.full}
                                                            {isOverflow && (
                                                                <AntTooltip title={`Hari ini berada di ${h.monthName} ${h.hy} H, bukan ${bulanLabel}`}>
                                                                    <span style={{ fontSize: 12, cursor: "help" }}>⚠️</span>
                                                                </AntTooltip>
                                                            )}
                                                        </div>
                                                        <div style={{ fontSize: 10, color: token.colorTextDescription, fontWeight: 400, marginTop: 2 }}>
                                                            {dayjs(wd.tanggal).format("DD/MM/YYYY")}
                                                        </div>
                                                        {h && (
                                                            <div style={{ fontSize: 10, color: isOverflow ? token.colorWarning : token.colorPrimary, fontWeight: 500 }}>
                                                                {h.hd} {h.monthName}
                                                            </div>
                                                        )}
                                                    </th>
                                                );
                                            })}
                                            {/* Summary header */}
                                            <th colSpan={4} style={{
                                                ...thStyle(token), textAlign: "center",
                                                background: token.colorPrimaryBg,
                                                borderBottom: `2px solid ${token.colorPrimaryBorder}`,
                                                fontSize: 10, color: token.colorPrimary, fontWeight: 700,
                                                letterSpacing: "0.06em", textTransform: "uppercase",
                                            }}>
                                                Rekap Minggu
                                            </th>
                                        </tr>
                                        <tr style={{ background: token.colorPrimaryBg }}>
                                            {["H", "S", "I", "A"].map(k => (
                                                <th key={k} style={{
                                                    padding: "6px 8px", textAlign: "center", fontSize: 11, fontWeight: 800,
                                                    color: token.colorPrimary, borderBottom: `1px solid ${token.colorBorderSecondary}`,
                                                    width: 40,
                                                }}>
                                                    {k}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {santriList.map((santri: any, idx: number) => {
                                            const santriAbsensi = absensiGrid[santri.nis] || {};
                                            const summary = getSantriWeekSummary(santri.nis);
                                            const alpha = summary.GHAIB + summary.PULANG;
                                            const isEven = idx % 2 === 0;

                                            return (
                                                <tr
                                                    key={santri.nis}
                                                    style={{
                                                        background: isEven ? token.colorBgContainer : token.colorFillAlter,
                                                        borderBottom: `1px solid ${token.colorBorderSecondary}`,
                                                        transition: "background 0.15s",
                                                    }}
                                                >
                                                    <td style={{ padding: "8px 10px", fontSize: 11, color: token.colorTextDescription, textAlign: "center" }}>
                                                        {idx + 1}
                                                    </td>
                                                    <td style={{ padding: "8px 12px" }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                                                            <Avatar
                                                                src={santri.foto_url} size={30}
                                                                icon={<UserOutlined />}
                                                                style={{ background: token.colorPrimary, color: "#fff", flexShrink: 0 }}
                                                            />
                                                            <div style={{ minWidth: 0 }}>
                                                                <div style={{ fontWeight: 600, fontSize: 12, color: token.colorText, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 }}>
                                                                    {santri.nama || santriAlias(santri.nis)}
                                                                </div>
                                                                <code style={{
                                                                    fontSize: 9, padding: "1px 5px", borderRadius: 4,
                                                                    background: token.colorFillSecondary, color: token.colorTextDescription,
                                                                }}>
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
                                                        }}>
                                                            {santri.kelas}
                                                        </div>
                                                    </td>

                                                    {/* Day cells */}
                                                    {weekDates.map((wd, hariIdx) => {
                                                        const h = resolveHijri(wd.tanggal);
                                                        const gridKey = `${h.hy}_${h.hm}_${h.hd}_1`;
                                                        const saveKey = `${santri.nis}_${gridKey}`;
                                                        const isSaving = savingCells[saveKey] || false;
                                                        const rec = santriAbsensi[gridKey];
                                                        const currentStatus = rec?.status || "";
                                                        const statusCfg = STATUS_ABSENSI.find(s => s.key === currentStatus);

                                                        return (
                                                            <td key={hariIdx} style={{ padding: "5px 5px", textAlign: "center" }}>
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
                                                                            if (wd) handleStatusClick(santri.nis, wd.tanggal, wd.sesiKe, currentStatus === k ? "" : k);
                                                                        },
                                                                    }}
                                                                    trigger={["click"]}
                                                                    disabled={!wd || isSaving}
                                                                >
                                                                    <div
                                                                        style={{
                                                                            cursor: !wd || isSaving ? "not-allowed" : "pointer",
                                                                            margin: "0 auto",
                                                                            width: 56, minHeight: 30,
                                                                            display: "flex", alignItems: "center", justifyContent: "center",
                                                                            borderRadius: 8,
                                                                            border: `1.5px solid ${statusCfg ? statusCfg.border : token.colorBorderSecondary}`,
                                                                            background: statusCfg ? statusCfg.bg : "transparent",
                                                                            color: statusCfg ? statusCfg.color : token.colorTextDisabled,
                                                                            fontWeight: statusCfg ? 800 : 400,
                                                                            fontSize: 11,
                                                                            opacity: isSaving ? 0.5 : 1,
                                                                            transition: "all 0.12s",
                                                                            userSelect: "none",
                                                                            gap: 3,
                                                                        }}
                                                                    >
                                                                        {isSaving ? (
                                                                            <Spin size="small" />
                                                                        ) : statusCfg ? (
                                                                            <>{statusCfg.icon} {statusCfg.code}</>
                                                                        ) : (
                                                                            <span style={{ fontSize: 14, color: token.colorBorderSecondary }}>–</span>
                                                                        )}
                                                                    </div>
                                                                </Dropdown>
                                                            </td>
                                                        );
                                                    })}

                                                    {/* Row summary */}
                                                    <td style={{ padding: "5px 6px", textAlign: "center" }}>
                                                        <div style={{
                                                            width: 28, height: 28, borderRadius: 7, margin: "0 auto",
                                                            background: summary.HADIR > 0 ? token.colorSuccessBg : token.colorFillAlter,
                                                            display: "flex", alignItems: "center", justifyContent: "center",
                                                            fontSize: 12, fontWeight: 800, color: summary.HADIR > 0 ? token.colorSuccess : token.colorTextDisabled,
                                                        }}>{summary.HADIR || "–"}</div>
                                                    </td>
                                                    <td style={{ padding: "5px 6px", textAlign: "center" }}>
                                                        <div style={{
                                                            width: 28, height: 28, borderRadius: 7, margin: "0 auto",
                                                            background: summary.SAKIT > 0 ? token.colorWarningBg : token.colorFillAlter,
                                                            display: "flex", alignItems: "center", justifyContent: "center",
                                                            fontSize: 12, fontWeight: 800, color: summary.SAKIT > 0 ? token.colorWarning : token.colorTextDisabled,
                                                        }}>{summary.SAKIT || "–"}</div>
                                                    </td>
                                                    <td style={{ padding: "5px 6px", textAlign: "center" }}>
                                                        <div style={{
                                                            width: 28, height: 28, borderRadius: 7, margin: "0 auto",
                                                            background: summary.IZIN > 0 ? token.colorInfoBg : token.colorFillAlter,
                                                            display: "flex", alignItems: "center", justifyContent: "center",
                                                            fontSize: 12, fontWeight: 800, color: summary.IZIN > 0 ? token.colorInfo : token.colorTextDisabled,
                                                        }}>{summary.IZIN || "–"}</div>
                                                    </td>
                                                    <td style={{ padding: "5px 6px", textAlign: "center" }}>
                                                        <div style={{
                                                            width: 28, height: 28, borderRadius: 7, margin: "0 auto",
                                                            background: alpha > 0 ? token.colorErrorBg : token.colorFillAlter,
                                                            display: "flex", alignItems: "center", justifyContent: "center",
                                                            fontSize: 12, fontWeight: 800, color: alpha > 0 ? token.colorError : token.colorTextDisabled,
                                                        }}>{alpha || "–"}</div>
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {/* Summary footer row */}
                                        {santriList.length > 0 && (
                                            <tr style={{ background: token.colorFillAlter, borderTop: `2px solid ${token.colorBorderSecondary}` }}>
                                                <td colSpan={3} style={{ padding: "10px 14px", fontWeight: 700, fontSize: 12, color: token.colorText }}>
                                                    TOTAL MINGGU INI
                                                </td>
                                                {weekDates.map((wd, i) => {
                                                    const h = resolveHijri(wd.tanggal);
                                                    const gk = `${h.hy}_${h.hm}_${h.hd}_1`;
                                                    const dayHadir = santriList.filter(s => absensiGrid[s.nis]?.[gk]?.status === "HADIR").length;
                                                    const dayFilled = santriList.filter(s => absensiGrid[s.nis]?.[gk]?.status).length;
                                                    return (
                                                        <td key={i} style={{ padding: "8px 4px", textAlign: "center" }}>
                                                            <div style={{ fontSize: 11, fontWeight: 700, color: token.colorSuccess }}>{dayHadir}H</div>
                                                            <div style={{ fontSize: 9, color: token.colorTextDescription }}>{dayFilled}/{santriList.length}</div>
                                                        </td>
                                                    );
                                                })}
                                                {/* total summary cells */}
                                                <td style={{ padding: "8px 6px", textAlign: "center" }}>
                                                    <div style={{ fontWeight: 800, fontSize: 13, color: token.colorSuccess }}>{weekStats.counts.HADIR}</div>
                                                </td>
                                                <td style={{ padding: "8px 6px", textAlign: "center" }}>
                                                    <div style={{ fontWeight: 800, fontSize: 13, color: token.colorWarning }}>{weekStats.counts.SAKIT}</div>
                                                </td>
                                                <td style={{ padding: "8px 6px", textAlign: "center" }}>
                                                    <div style={{ fontWeight: 800, fontSize: 13, color: token.colorInfo }}>{weekStats.counts.IZIN}</div>
                                                </td>
                                                <td style={{ padding: "8px 6px", textAlign: "center" }}>
                                                    <div style={{ fontWeight: 800, fontSize: 13, color: token.colorError }}>
                                                        {weekStats.counts.GHAIB + weekStats.counts.PULANG}
                                                    </div>
                                                </td>
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

            {/* ── Export Modal (premium) ───────────────────────────────────────── */}
            <Modal
                open={exportModalOpen}
                onCancel={() => setExportModalOpen(false)}
                footer={null}
                centered
                width={480}
                destroyOnClose
                styles={{
                    content: { borderRadius: 18, padding: 0, overflow: "hidden" },
                    body: { padding: 0 },
                }}
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
                            <div style={{ fontWeight: 800, fontSize: 16 }}>Export Absensi ke Excel</div>
                            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 1 }}>
                                {bulanLabel} {tahun} H · {santriList.length} santri
                            </div>
                        </div>
                    </Space>
                </div>

                <div style={{ padding: "22px 26px 26px" }}>
                    <Text style={{ fontSize: 12, color: token.colorTextDescription, display: "block", marginBottom: 14 }}>
                        Pilih minggu yang akan disertakan dalam laporan Excel:
                    </Text>

                    {/* Week cards */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
                        {Array.from({ length: mingguMaxKe }, (_, i) => {
                            const wk = i + 1;
                            const wkDates = getWeekDates(tahun, bulan, wk);
                            const isSelected = selectedExportWeeks.includes(wk);
                            const isCurrent = wk === mingguKe;
                            return (
                                <div
                                    key={wk}
                                    onClick={() => {
                                        setSelectedExportWeeks(prev =>
                                            prev.includes(wk) ? prev.filter(w => w !== wk) : [...prev, wk].sort()
                                        );
                                    }}
                                    style={{
                                        padding: "12px 14px", borderRadius: 12, cursor: "pointer",
                                        border: `2px solid ${isSelected ? token.colorSuccessBorder : token.colorBorderSecondary}`,
                                        background: isSelected ? token.colorSuccessBg : token.colorBgContainer,
                                        transition: "all 0.15s",
                                        display: "flex", alignItems: "center", gap: 12,
                                    }}
                                >
                                    <div style={{
                                        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                                        background: isSelected ? token.colorSuccess : token.colorFillSecondary,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        color: isSelected ? "#fff" : token.colorTextDisabled, fontSize: 14,
                                    }}>
                                        {isSelected ? <CheckOutlined style={{ fontSize: 13 }} /> : wk}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                                        <Text style={{ fontSize: 11, color: token.colorTextDescription }}>
                                            {dayjs(wkDates[0].tanggal).format("DD MMM")} – {dayjs(wkDates[4].tanggal).format("DD MMM YYYY")}
                                        </Text>
                                    </div>
                                    <div style={{ textAlign: "right" }}>
                                        <Text style={{ fontSize: 10, color: token.colorTextDescription }}>5 hari</Text>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Quick select */}
                    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                        <Button size="small" style={{ borderRadius: 8 }}
                            onClick={() => setSelectedExportWeeks([mingguKe])}>
                            Minggu Ini Saja
                        </Button>
                        <Button size="small" style={{ borderRadius: 8 }}
                            onClick={() => setSelectedExportWeeks(Array.from({ length: mingguMaxKe }, (_, i) => i + 1))}>
                            Pilih Semua
                        </Button>
                        <Button size="small" style={{ borderRadius: 8 }}
                            onClick={() => setSelectedExportWeeks([])}>
                            Batal Pilih
                        </Button>
                    </div>

                    {/* Summary */}
                    {selectedExportWeeks.length > 0 && (
                        <div style={{
                            padding: "10px 14px", borderRadius: 10, marginBottom: 18,
                            background: token.colorInfoBg, border: `1px solid ${token.colorInfoBorder}`,
                            display: "flex", gap: 8, alignItems: "flex-start",
                        }}>
                            <InfoCircleOutlined style={{ color: token.colorInfo, marginTop: 2, flexShrink: 0 }} />
                            <Text style={{ fontSize: 12, color: token.colorInfoText ?? token.colorInfo }}>
                                Akan mengekspor <strong>{selectedExportWeeks.length} minggu</strong> ·{" "}
                                <strong>{selectedExportWeeks.length * 5}</strong> hari ·{" "}
                                <strong>{santriList.length}</strong> santri ·{" "}
                                {selectedExportWeeks.length > 1 ? "Disertakan rekap bulanan" : "Tanpa rekap bulanan (1 minggu)"}
                            </Text>
                        </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: "flex", gap: 10 }}>
                        <Button style={{ flex: "0 0 auto", borderRadius: 10 }} onClick={() => setExportModalOpen(false)}>
                            Batal
                        </Button>
                        <Button
                            type="primary"
                            icon={<ThunderboltOutlined />}
                            loading={exporting}
                            disabled={selectedExportWeeks.length === 0}
                            onClick={() => exportWeeksData(selectedExportWeeks)}
                            style={{
                                flex: 1, borderRadius: 10, fontWeight: 700, height: 42,
                                background: selectedExportWeeks.length > 0
                                    ? `linear-gradient(135deg, ${token.colorSuccess}, ${token.colorSuccessActive ?? token.colorSuccess})`
                                    : undefined,
                                border: "none",
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

            {/* ── Koreksi Hijriah Modal ────────────────────────────────────────── */}
            <Modal
                title={<Space><EditOutlined style={{ color: token.colorWarning }} /> Koreksi Bulan Hijriah</Space>}
                open={koreksiOpen} onCancel={() => setKoreksiOpen(false)}
                width={520} footer={null} destroyOnHidden
            >
                <div style={{ marginBottom: 16, padding: "16px 0", borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
                    <Space wrap align="end">
                        <div>
                            <Text style={{ fontSize: 11, display: "block", marginBottom: 4, color: token.colorTextSecondary }}>Tahun H</Text>
                            <InputNumber value={koreksiTahun} onChange={v => { setKoreksiTahun(v || 0); }}
                                onBlur={() => autoFillKoreksi(koreksiTahun, koreksiBulan)}
                                min={1440} max={1500} style={{ width: 100 }} />
                        </div>
                        <div>
                            <Text style={{ fontSize: 11, display: "block", marginBottom: 4, color: token.colorTextSecondary }}>Bulan H</Text>
                            <Select value={koreksiBulan} onChange={v => { setKoreksiBulan(v); autoFillKoreksi(koreksiTahun, v); }}
                                options={HIJRI_MONTHS.map((n, i) => ({ label: n, value: i + 1 }))} style={{ width: 150 }} />
                        </div>
                        <div>
                            <Text style={{ fontSize: 11, display: "block", marginBottom: 4, color: token.colorTextSecondary }}>Awal Masehi</Text>
                            <DatePicker value={koreksiAwal} onChange={setKoreksiAwal} format="DD/MM/YYYY" style={{ width: 160 }} />
                        </div>
                    </Space>
                    <Space wrap align="end" style={{ marginTop: 12 }}>
                        <div>
                            <Text style={{ fontSize: 11, display: "block", marginBottom: 4, color: token.colorTextSecondary }}>Panjang</Text>
                            <Select value={koreksiPanjang} onChange={v => setKoreksiPanjang(v)}
                                options={[{ label: "30 hari", value: 30 }, { label: "29 hari", value: 29 }]} style={{ width: 110 }} />
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
                            {["Bulan", "Awal", "Panjang", "Status", "Aksi"].map(h => (
                                <th key={h} style={{ textAlign: "left", padding: "6px 8px", color: token.colorTextSecondary }}>{h}</th>
                            ))}
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
                                        : <Tag icon={<CloseCircleOutlined />} color="warning" style={{ fontSize: 10 }}>?</Tag>}
                                </td>
                                <td style={{ padding: "6px 8px" }}>
                                    <Button danger size="small" icon={<DeleteOutlined />}
                                        onClick={() => handleKoreksiDelete(r.tahun_hijriah, r.bulan_hijriah_number)} />
                                </td>
                            </tr>
                        ))}
                        {koreksiRows.length === 0 && (
                            <tr><td colSpan={5} style={{ padding: 16, textAlign: "center", color: token.colorTextDescription }}>Belum ada koreksi</td></tr>
                        )}
                    </tbody>
                </table>
            </Modal>
        </div>
    );
};

// ── Helper style ──────────────────────────────────────────────────────────────
const thStyle = (token: any): React.CSSProperties => ({
    padding: "10px 10px",
    fontSize: 11,
    fontWeight: 700,
    color: token.colorTextDescription,
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
    whiteSpace: "nowrap" as const,
});
