import React, { useState } from "react";
import { useOne } from "@refinedev/core";
import {
    Typography, Avatar, Tag, Button, Spin, Tooltip, theme,
    DatePicker, Space,
} from "antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import {
    ArrowLeftOutlined, UserOutlined, FireOutlined,
    BookOutlined, TrophyOutlined, BarChartOutlined,
    RiseOutlined, CalendarOutlined, DownloadOutlined,
} from "@ant-design/icons";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    ResponsiveContainer, Legend,
} from "recharts";
import { ISantri } from "../../types";
import { useNavigate, useParams } from "react-router-dom";
import { supabaseClient } from "../../utility/supabaseClient";
import { formatDualDate } from "../../utility/dateHelper";
import { santriAlias } from "../../utility/privacy";
import dayjs from "dayjs";

const { Text } = Typography;

// ─── Types ───────────────────────────────────────────────────────────────────

type MurojaahRow = {
    id: number;
    tanggal: string | null;
    jenis_murojaah: "SABAQ" | "MANZIL" | null;
    juz: number | null;
    surat: string | null;
    ayat_awal: number | null;
    ayat_akhir: number | null;
    halaman_awal: number | null;
    halaman_akhir: number | null;
    predikat: string | null;
    catatan: string | null;
    status_absensi: string | null;
    sesi: string | null;
};

type MurojaahSummary = {
    total_count: number;
    week_count: number;
    month_count: number;
};

type AggregateData = {
    heatmapDates: Set<string>;
    juzFreq: Record<number, number>;
    predikatDist: Record<string, number>;
    jenisDist: { SABAQ: number; MANZIL: number };
    monthlyTrend: { bulan: string; sabaq: number; manzil: number }[];
    streakCurrent: number;
    streakMax: number;
    mumtazRate: number;
    avgPerWeek: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatCoverage = (item: MurojaahRow): string => {
    if (item.surat) {
        return `${item.surat}${item.ayat_awal && item.ayat_akhir ? ` (Ayat ${item.ayat_awal}–${item.ayat_akhir})` : ""}`;
    }
    if (item.halaman_awal && item.halaman_akhir) {
        return `Halaman ${item.halaman_awal}–${item.halaman_akhir}`;
    }
    return item.juz ? `Juz ${item.juz}` : "–";
};

const MONTH_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

const hexLum = (hex: string): number => {
    const c = hex.replace("#", "");
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    return 0.299 * r + 0.587 * g + 0.114 * b;
};

/** Build all analytics from raw aggregate rows */
function buildAggregates(rows: { tanggal: string | null; jenis_murojaah: string | null; juz: number | null; predikat: string | null }[]): AggregateData {
    const heatmapDates = new Set<string>();
    const juzFreq: Record<number, number> = {};
    const predikatDist: Record<string, number> = {};
    const jenisDist = { SABAQ: 0, MANZIL: 0 };
    const monthlyMap: Record<string, { sabaq: number; manzil: number }> = {};

    const now = new Date();
    const yearAgo = new Date(now);
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);

    rows.forEach((r) => {
        if (!r.tanggal) return;
        const d = new Date(r.tanggal);

        // Heatmap — last 365 days only
        if (d >= yearAgo) heatmapDates.add(r.tanggal.slice(0, 10));

        // Juz freq
        if (r.juz) juzFreq[r.juz] = (juzFreq[r.juz] ?? 0) + 1;

        // Predikat dist
        const pred = r.predikat ?? "–";
        predikatDist[pred] = (predikatDist[pred] ?? 0) + 1;

        // Jenis dist
        if (r.jenis_murojaah === "SABAQ") jenisDist.SABAQ++;
        else if (r.jenis_murojaah === "MANZIL") jenisDist.MANZIL++;

        // Monthly trend — last 6 months
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!monthlyMap[key]) monthlyMap[key] = { sabaq: 0, manzil: 0 };
        if (r.jenis_murojaah === "SABAQ") monthlyMap[key].sabaq++;
        else if (r.jenis_murojaah === "MANZIL") monthlyMap[key].manzil++;
    });

    // Monthly trend — last 6 months sorted
    const monthlyTrend = Object.entries(monthlyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([k, v]) => {
            const [yr, mo] = k.split("-");
            return { bulan: `${MONTH_ID[Number(mo) - 1]} '${yr.slice(2)}`, ...v };
        });

    // Streak — consecutive days going back from today
    let streakCurrent = 0;
    let streakMax = 0;
    let temp = 0;
    const sorted = [...heatmapDates].sort();
    for (let i = 0; i < sorted.length; i++) {
        if (i === 0) { temp = 1; continue; }
        const prev = new Date(sorted[i - 1]);
        const cur = new Date(sorted[i]);
        const diff = (cur.getTime() - prev.getTime()) / 86400000;
        if (diff === 1) temp++;
        else temp = 1;
        if (temp > streakMax) streakMax = temp;
    }
    // Is the streak ongoing (last date is today or yesterday)?
    const lastDate = sorted[sorted.length - 1];
    if (lastDate) {
        const daysDiff = (now.getTime() - new Date(lastDate).getTime()) / 86400000;
        if (daysDiff <= 1) {
            // Walk back from end to count current streak
            let cur = 1;
            for (let i = sorted.length - 2; i >= 0; i--) {
                const d1 = new Date(sorted[i + 1]);
                const d0 = new Date(sorted[i]);
                if ((d1.getTime() - d0.getTime()) / 86400000 === 1) cur++;
                else break;
            }
            streakCurrent = cur;
        }
    }
    if (streakMax < temp) streakMax = temp;

    const total = rows.length;
    const mumtazCount = predikatDist["MUMTAZ"] ?? 0;
    const mumtazRate = total > 0 ? Math.round((mumtazCount / total) * 100) : 0;

    // Avg per week — based on heatmap days (active days ÷ weeks in range)
    const weeksInRange = 52;
    const activeDays = heatmapDates.size;
    const avgPerWeek = parseFloat((activeDays / weeksInRange).toFixed(1));

    return { heatmapDates, juzFreq, predikatDist, jenisDist, monthlyTrend, streakCurrent, streakMax, mumtazRate, avgPerWeek };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Juz coverage map 1–30 */
const JuzMap: React.FC<{ juzFreq: Record<number, number> }> = ({ juzFreq }) => {
    const max = Math.max(...Object.values(juzFreq), 1);
    const getJuzStyle = (juz: number): React.CSSProperties => {
        const count = juzFreq[juz] ?? 0;
        if (count === 0) return { background: "var(--ant-color-fill-quaternary)", color: "var(--ant-color-text-quaternary)" };
        const ratio = count / max;
        if (ratio < 0.33) return { background: "#ede9fe", color: "#5b21b6" };
        if (ratio < 0.67) return { background: "#c4b5fd", color: "#3b0764" };
        return { background: "#7c3aed", color: "#ede9fe" };
    };

    return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 2 }}>
            {Array.from({ length: 30 }, (_, i) => i + 1).map((juz) => (
                <Tooltip key={juz} title={`Juz ${juz}: ${juzFreq[juz] ?? 0}× murojaah`} placement="top">
                    <div
                        style={{
                            height: 24,
                            borderRadius: 3,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 8,
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "transform 0.12s",
                            ...getJuzStyle(juz),
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.15)")}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                    >
                        {juz}
                    </div>
                </Tooltip>
            ))}
        </div>
    );
};

/** Predikat distribution bars */
const PREDIKAT_ORDER = ["MUMTAZ", "JAYYID JIDDAN", "JAYYID", "DHOIF", "–"];
const PREDIKAT_COLOR: Record<string, string> = {
    MUMTAZ: "#7c3aed",
    "JAYYID JIDDAN": "#3b82f6",
    JAYYID: "#60a5fa",
    DHOIF: "#f59e0b",
    "–": "#9ca3af",
};

const PredikatBars: React.FC<{ dist: Record<string, number>; total: number; isDark?: boolean }> = ({ dist, total, isDark }) => {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {PREDIKAT_ORDER.filter((p) => dist[p]).map((p) => {
                const count = dist[p] ?? 0;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                const color = PREDIKAT_COLOR[p] ?? "#9ca3af";
                return (
                    <div key={p} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "8px 10px", borderRadius: 8,
                        border: `1px solid ${isDark ? "#1E293B" : "#F1F5F9"}`,
                        background: isDark ? "#0F172A15" : "#F8FAFC",
                    }}>
                        <div style={{ width: 3, height: 24, borderRadius: 2, background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: "var(--ant-color-text-secondary)", width: 92, flexShrink: 0, fontWeight: 500 }}>{p}</span>
                        <div style={{ flex: 1, height: 7, background: "var(--ant-color-fill-quaternary)", borderRadius: 999, overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 999, transition: "width 0.6s ease" }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color, width: 36, textAlign: "right" }}>{count}</span>
                        <span style={{ fontSize: 10, color: "var(--ant-color-text-tertiary)", width: 28 }}>{pct}%</span>
                    </div>
                );
            })}
        </div>
    );
};

/** Section label */
const SectionLabel: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 500, color: "var(--ant-color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
        {icon}
        <span>{label}</span>
    </div>
);

/** KPI card */
const KpiCard: React.FC<{
    icon: React.ReactNode;
    value: React.ReactNode;
    label: string;
    sub?: React.ReactNode;
    accent?: string;
    isDark?: boolean;
}> = ({ icon, value, label, sub, accent, isDark }) => {
    const accentColor = accent ?? "#7c3aed";
    return (
        <div style={{
            background: "var(--ant-color-bg-container)",
            border: `1px solid ${isDark ? "#334155" : "var(--ant-color-border-secondary)"}`,
            borderRadius: 12,
            display: "flex",
            flexDirection: "column",
            boxShadow: isDark ? "0 1px 3px rgba(0,0,0,0.25)" : "0 1px 3px rgba(0,0,0,0.06)",
            overflow: "hidden",
        }}>
            <div style={{ height: 4, background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88)`, flexShrink: 0 }} />
            <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: `${accentColor}18`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: accentColor, fontSize: 16,
                }}>
                    {icon}
                </div>
                <span style={{ fontSize: 26, fontWeight: 500, lineHeight: 1, color: accentColor }}>{value}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ant-color-text)", letterSpacing: "0.02em" }}>{label}</span>
                {sub && <span style={{ fontSize: 10, color: "var(--ant-color-text-tertiary)" }}>{sub}</span>}
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const MurojaahShow: React.FC = () => {
    const { token } = theme.useToken();
    const isDark = hexLum(token.colorBgContainer) < 128;
    const { id } = useParams();
    const navigate = useNavigate();

    // Santri profile
    const { data: santriData, isLoading } = useOne<ISantri>({
        resource: "santri",
        id: id as string,
        meta: {
            idColumnName: "nis",
            select: "nama, nis, kelas, jurusan, jenis_kelamin, status_santri, foto_url",
        },
    });

    // Summary from existing RPC
    const [summary, setSummary] = React.useState<MurojaahSummary>({ total_count: 0, week_count: 0, month_count: 0 });

    // Aggregate analytics state
    const [agg, setAgg] = React.useState<AggregateData | null>(null);
    const [dateCountMap, setDateCountMap] = React.useState<Map<string, number>>(new Map());
    const [aggLoading, setAggLoading] = React.useState(true);
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
        dayjs().startOf("month"),
        dayjs().endOf("month"),
    ]);

    const flattenMurojaah = (raw: any): MurojaahRow => ({
        id: raw.id,
        tanggal: raw.tanggal,
        jenis_murojaah: raw.jenis_murojaah,
        juz: raw.juz,
        surat: raw.surat,
        ayat_awal: raw.ayat_awal,
        ayat_akhir: raw.ayat_akhir,
        halaman_awal: raw.halaman_awal,
        halaman_akhir: raw.halaman_akhir,
        predikat: raw.predikat,
        catatan: raw.catatan,
        status_absensi: raw.tahfidz_absensi?.status ?? null,
        sesi: raw.tahfidz_absensi?.tahfidz_sesi?.sesi ?? null,
    });

    React.useEffect(() => {
        if (!id) return;

        // Existing RPC
        supabaseClient
            .rpc("get_admin_murojaah_summaries", { p_santri_nis: [id] })
            .then(({ data }) => {
                const row = data?.[0];
                if (row) {
                    setSummary({
                        total_count: Number(row.total_count || 0),
                        week_count: Number(row.week_count || 0),
                        month_count: Number(row.month_count || 0),
                    });
                }
            });

        // Aggregate fetch with date filter
        setAggLoading(true);
        const start = dateRange[0].startOf("day").toISOString();
        const end = dateRange[1].endOf("day").toISOString();
        supabaseClient
            .from("murojaah_tahfidz")
            .select("tanggal, jenis_murojaah, juz, predikat")
            .eq("santri_nis", id)
            .gte("tanggal", start)
            .lte("tanggal", end)
            .order("tanggal", { ascending: true })
            .then(({ data }) => {
                if (!data) { setAggLoading(false); return; }

                const built = buildAggregates(data);
                setAgg(built);

                // Build date→count map for heatmap intensity
                const dcm = new Map<string, number>();
                data.forEach((r) => {
                    if (!r.tanggal) return;
                    const key = r.tanggal.slice(0, 10);
                    dcm.set(key, (dcm.get(key) ?? 0) + 1);
                });
                setDateCountMap(dcm);
                setAggLoading(false);
            });
    }, [id, dateRange]);

    if (isLoading || !santriData?.data) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 320 }}>
                <Spin size="large" />
            </div>
        );
    }

    const record = santriData.data;
    const displayName = record.nama || santriAlias(record.nis);
    const initials = displayName.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();
    const total = summary.total_count;

    const STATUS_CFG: Record<string, { label: string; color: string }> = {
        HADIR: { label: "Hadir", color: "#16A34A" },
        SAKIT: { label: "Sakit", color: "#D97706" },
        GHAIB: { label: "Ghaib", color: "#DC2626" },
        SEKOLAH: { label: "Sekolah", color: "#2563EB" },
        PULANG: { label: "Pulang", color: "#9333EA" },
    };

    // ── ProTable columns ────────────────────────────────────────────────────
    const columns: ProColumns<MurojaahRow>[] = [
        {
            title: "Tanggal",
            dataIndex: "tanggal",
            width: 170,
            render: (_, item) => (
                <Text style={{ fontSize: 12, color: "var(--ant-color-text-secondary)" }}>
                    {item.tanggal ? formatDualDate(item.tanggal) : "–"}
                </Text>
            ),
        },
        {
            title: "Sesi",
            dataIndex: "sesi",
            width: 70,
            render: (_, item) => item.sesi ? (
                <Tag style={{
                    background: item.sesi === 'PAGI' ? '#FEF3C7' : '#DBEAFE',
                    border: 'none', borderRadius: 6,
                    color: item.sesi === 'PAGI' ? '#D97706' : '#2563EB',
                    fontWeight: 600, fontSize: 10,
                }}>
                    {item.sesi}
                </Tag>
            ) : <Text style={{ color: "var(--ant-color-text-tertiary)" }}>–</Text>,
        },
        {
            title: "Status",
            dataIndex: "status_absensi",
            width: 85,
            render: (_, item) => {
                const cfg = STATUS_CFG[item.status_absensi ?? ""];
                return cfg ? (
                    <Tag color={cfg.color} style={{ borderRadius: 6, fontWeight: 600, fontSize: 10 }}>
                        {cfg.label}
                    </Tag>
                ) : <Text style={{ color: "var(--ant-color-text-tertiary)" }}>–</Text>;
            },
        },
        {
            title: "Jenis",
            dataIndex: "jenis_murojaah",
            width: 88,
            render: (_, item) => (
                <Tag color={item.jenis_murojaah === "SABAQ" ? "blue" : "purple"} style={{ fontSize: 11 }}>
                    {item.jenis_murojaah ?? "–"}
                </Tag>
            ),
        },
        {
            title: "Juz",
            dataIndex: "juz",
            width: 72,
            render: (_, item) => item.juz
                ? <Text strong style={{ fontSize: 12 }}>Juz {item.juz}</Text>
                : <Text type="secondary" style={{ fontSize: 12 }}>–</Text>,
        },
        {
            title: "Cakupan",
            key: "coverage",
            render: (_, item) => (
                <Text ellipsis={{ tooltip: formatCoverage(item) }} style={{ fontSize: 12, maxWidth: 180 }}>
                    {formatCoverage(item)}
                </Text>
            ),
        },
        {
            title: "Predikat",
            dataIndex: "predikat",
            width: 130,
            render: (_, item) => {
                const colorMap: Record<string, string> = {
                    MUMTAZ: "success",
                    "JAYYID JIDDAN": "processing",
                    JAYYID: "blue",
                    DHOIF: "warning",
                };
                return (
                    <Tag color={colorMap[item.predikat ?? ""] ?? "default"} style={{ fontSize: 11 }}>
                        {item.predikat ?? "–"}
                    </Tag>
                );
            },
        },
        {
            title: "Catatan",
            dataIndex: "catatan",
            width: 200,
            render: (_, item) => (
                <Text type="secondary" ellipsis={{ tooltip: item.catatan || "–" }} style={{ fontSize: 12 }}>
                    {item.catatan || "–"}
                </Text>
            ),
        },
    ];

    // ── Styles ───────────────────────────────────────────────────────────────
    const card: React.CSSProperties = {
        background: token.colorBgContainer,
        border: `1px solid ${isDark ? "#334155" : token.colorBorderSecondary}`,
        borderRadius: 12,
        padding: "16px 20px",
        boxShadow: isDark ? "0 1px 3px rgba(0,0,0,0.25)" : "0 1px 3px rgba(0,0,0,0.06)",
    };

    const divider: React.CSSProperties = {
        height: "0.5px",
        background: token.colorBorderSecondary,
        margin: "12px 0",
    };

    return (
        <div style={{ padding: "16px 16px 80px" }}>

            {/* ── Header ── */}
            <div style={{ marginBottom: 16, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div>
                    <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/murojaah")} style={{ marginBottom: 12 }}>
                        Kembali
                    </Button>
                    <div>
                        <Text style={{ fontSize: 18, fontWeight: 500, display: "block" }}>Detail Murojaah</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            Progres, konsistensi & riwayat aktivitas tahfidz santri
                        </Text>
                    </div>
                </div>
                <DatePicker.RangePicker
                    value={dateRange}
                    onChange={(dates: any) => {
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
            </div>

            {/* ── Profile + KPI row ── */}
            <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 20, marginBottom: 24, alignItems: "start" }}>

                {/* Profile card */}
                <div style={{ ...card, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: 0, overflow: "hidden" }}>
                    <div style={{ height: 4, background: record.status_santri === "AKTIF" ? "linear-gradient(90deg, #16a34a, #4ade80)" : "linear-gradient(90deg, #94a3b8, #cbd5e1)", flexShrink: 0, width: "100%" }} />
                    <div style={{ padding: "20px 20px 16px", display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
                    <Avatar
                        size={72}
                        src={record.foto_url}
                        icon={!record.foto_url ? <UserOutlined /> : undefined}
                        style={{ background: "var(--ant-color-primary-bg)", color: "var(--ant-color-primary)", marginBottom: 8 }}
                    >
                        {!record.foto_url ? initials : undefined}
                    </Avatar>
                    <Text style={{ fontSize: 16, fontWeight: 600, display: "block" }}>{displayName}</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>{record.nis}</Text>

                    <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", justifyContent: "center" }}>
                        <Tag color={record.status_santri === "AKTIF" ? "success" : "default"} style={{ fontSize: 10, margin: 0 }}>
                            {record.status_santri ?? "–"}
                        </Tag>
                        {record.kelas && (
                            <Tag color="purple" style={{ fontSize: 10, margin: 0 }}>{record.kelas}</Tag>
                        )}
                    </div>

                    <div style={divider} />

                    {/* Meta */}
                    {[
                        { label: "Takhasus", val: record.jurusan ?? "–" },
                        { label: "Jenis kelamin", val: record.jenis_kelamin ?? "–" },
                    ].map(({ label, val }) => (
                        <div key={label} style={{ display: "flex", justifyContent: "space-between", width: "100%", fontSize: 12, padding: "4px 0", borderBottom: `1px solid ${isDark ? "#1E293B" : "#F1F5F9"}`, }}>
                            <span style={{ color: "var(--ant-color-text-secondary)" }}>{label}</span>
                            <span style={{ fontWeight: 600 }}>{val}</span>
                        </div>
                    ))}

                    <div style={divider} />

                    {/* Summary mini */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, width: "100%" }}>
                        {[
                            { val: total, lbl: "Total", color: undefined },
                            { val: summary.week_count, lbl: "Pekan ini", color: "#7c3aed" },
                            { val: summary.month_count, lbl: "Bulan ini", color: "#2563eb" },
                        ].map(({ val, lbl, color }) => (
                            <div key={lbl} style={{
                                background: `${color ?? "#7c3aed"}0D`,
                                borderRadius: 8, padding: "8px 4px", textAlign: "center",
                                border: `1px solid ${color ?? "#7c3aed"}22`,
                            }}>
                                <div style={{ fontSize: 20, fontWeight: 600, color: color ?? "var(--ant-color-text)", lineHeight: 1 }}>{val}</div>
                                <div style={{ fontSize: 10, color: "var(--ant-color-text-secondary)", marginTop: 3 }}>{lbl}</div>
                            </div>
                        ))}
                    </div>
                    </div>
                </div>

                {/* KPI + Heatmap */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* KPI row */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                        <KpiCard
                            icon={<FireOutlined />}
                            value={agg?.streakCurrent ?? "–"}
                            label="Streak aktif (hari)"
                            sub={agg ? `Terpanjang: ${agg.streakMax} hari` : undefined}
                            accent={agg && agg.streakCurrent > 0 ? "#7c3aed" : undefined}
                            isDark={isDark}
                        />
                        <KpiCard
                            icon={<BookOutlined />}
                            value={agg ? Object.keys(agg.juzFreq).length : "–"}
                            label="Juz terpantau"
                            sub="Dari 30 juz"
                            isDark={isDark}
                        />
                        <KpiCard
                            icon={<TrophyOutlined />}
                            value={agg ? `${agg.mumtazRate}%` : "–"}
                            label="Rate Mumtaz"
                            accent={agg && agg.mumtazRate >= 70 ? "#16a34a" : agg && agg.mumtazRate >= 50 ? "#d97706" : "#dc2626"}
                            isDark={isDark}
                        />
                        <KpiCard
                            icon={<CalendarOutlined />}
                            value={agg ? `${agg.jenisDist.SABAQ} vs ${agg.jenisDist.MANZIL}` : "–"}
                            label="Sabaq vs Manzil"
                            sub={agg ? `${Math.round((agg.jenisDist.SABAQ / (agg.jenisDist.SABAQ + agg.jenisDist.MANZIL || 1)) * 100)}% Sabaq` : undefined}
                            accent="#3b82f6"
                            isDark={isDark}
                        />
                    </div>

                    {/* Sebaran juz */}
                    <div style={{ ...card, padding: "12px 16px" }}>
                        <SectionLabel icon={<BookOutlined style={{ fontSize: 12 }} />} label="Sebaran juz yang dimurojaahkan" />
                        {aggLoading ? <Spin /> : agg ? (
                            <>
                                <JuzMap juzFreq={agg.juzFreq} />
                                <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 8, fontSize: 10, color: "var(--ant-color-text-tertiary)" }}>
                                    <span>Belum</span>
                                    {[
                                        "var(--ant-color-fill-quaternary)",
                                        "#ede9fe", "#c4b5fd", "#7c3aed",
                                    ].map((bg, i) => (
                                        <div key={i} style={{ width: 8, height: 8, borderRadius: 2, background: bg }} />
                                    ))}
                                    <span>Sering</span>
                                </div>
                            </>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* ── Analytics row ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 24 }}>

                {/* Row 1: Predikat + Jenis | Tren aktivitas */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

                    {/* Left: Predikat + Jenis */}
                    <div style={card}>
                        <SectionLabel icon={<TrophyOutlined style={{ fontSize: 13 }} />} label="Distribusi predikat" />
                        {aggLoading ? <Spin /> : agg ? (
                            <PredikatBars dist={agg.predikatDist} total={total} isDark={isDark} />
                        ) : null}

                        <div style={divider} />

                        <SectionLabel icon={<BarChartOutlined style={{ fontSize: 13 }} />} label="Rasio jenis murojaah" />
                        {agg && (
                            <div style={{ display: "flex", gap: 8 }}>
                                {[
                                    { label: "Sabaq", count: agg.jenisDist.SABAQ, bg: "#dbeafe", fg: "#1e3a8a", sub: "#1e40af" },
                                    { label: "Manzil", count: agg.jenisDist.MANZIL, bg: "#ede9fe", fg: "#3b0764", sub: "#5b21b6" },
                                ].map(({ label, count, bg, fg, sub }) => {
                                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                                    return (
                                        <div key={label} style={{
                                            flex: 1, background: bg, borderRadius: 8, padding: "10px 14px",
                                            border: "1px solid transparent",
                                            boxShadow: isDark ? "0 1px 2px rgba(0,0,0,0.2)" : "0 1px 2px rgba(0,0,0,0.04)",
                                        }}>
                                            <div style={{ fontSize: 22, fontWeight: 600, color: fg, lineHeight: 1 }}>{count}</div>
                                            <div style={{ fontSize: 11, color: sub, marginTop: 3, fontWeight: 500 }}>{label} ({pct}%)</div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Right: Tren aktivitas */}
                    <div style={card}>
                        <SectionLabel icon={<RiseOutlined style={{ fontSize: 13 }} />} label="Tren aktivitas — 6 bulan terakhir" />
                        {aggLoading ? <Spin /> : agg && agg.monthlyTrend.length > 0 ? (
                            <>
                                <div style={{ display: "flex", gap: 16, marginBottom: 10, fontSize: 11, color: token.colorTextSecondary }}>
                                    {[{ color: "#3b82f6", label: "Sabaq" }, { color: "#a78bfa", label: "Manzil" }].map(({ color, label }) => (
                                        <span key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                            <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: "inline-block" }} />
                                            {label}
                                        </span>
                                    ))}
                                </div>
                                <ResponsiveContainer width="100%" height={180}>
                                    <BarChart data={agg.monthlyTrend} barSize={18}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={token.colorBorderSecondary} vertical={false} />
                                        <XAxis dataKey="bulan" tick={{ fontSize: 11, fill: token.colorTextSecondary }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 10, fill: token.colorTextSecondary }} axisLine={false} tickLine={false} width={28} />
                                        <RechartsTooltip
                                            contentStyle={{ fontSize: 12, borderRadius: 8, border: "0.5px solid var(--ant-color-border-secondary)", background: "var(--ant-color-bg-container)" }}
                                            cursor={{ fill: token.colorFillSecondary }}
                                        />
                                        <Bar dataKey="sabaq" name="Sabaq" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                                        <Bar dataKey="manzil" name="Manzil" stackId="a" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </>
                        ) : (
                            <Text type="secondary" style={{ fontSize: 12 }}>Belum ada data tren.</Text>
                        )}
                    </div>
                </div>

                {/* Row 2: Full width — Log table */}
                <div style={{ ...card, padding: 0, overflow: "hidden", flex: 1 }}>
                    <ProTable<MurojaahRow>
                        key={`${dateRange[0].format("YYYYMMDD")}-${dateRange[1].format("YYYYMMDD")}`}
                        columns={columns}
                        rowKey="id"
                        search={false}
                        options={{ density: true, reload: true }}
                        headerTitle={
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: token.colorTextSecondary, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                <BookOutlined style={{ fontSize: 13 }} />
                                <span>Log Murojaah</span>
                            </div>
                        }
                        request={async (params) => {
                            const current = params.current || 1;
                            const pageSize = params.pageSize || 15;
                            const from = (current - 1) * pageSize;
                            const to = from + pageSize - 1;

                            const { data, error, count } = await supabaseClient
                                .from("murojaah_tahfidz")
                                .select(`
                                    id,tanggal,jenis_murojaah,juz,surat,ayat_awal,ayat_akhir,halaman_awal,halaman_akhir,predikat,catatan,
                                    tahfidz_absensi!absensi_id(
                                        status,
                                        tahfidz_sesi!inner(sesi)
                                    )
                                `, { count: "exact" })
                                .eq("santri_nis", id)
                                .gte("tanggal", dateRange[0].startOf("day").toISOString())
                                .lte("tanggal", dateRange[1].endOf("day").toISOString())
                                .order("tanggal", { ascending: false })
                                .order("id", { ascending: false })
                                .range(from, to);

                            if (error) return { data: [], success: false, total: 0 };
                            return { data: (data || []).map(flattenMurojaah), success: true, total: count || 0 };
                        }}
                        pagination={{ defaultPageSize: 15, showSizeChanger: true, size: "small" }}
                        size="small"
                        style={{ borderRadius: 0 }}
                    />
                </div>
            </div>
        </div>
    );
};
