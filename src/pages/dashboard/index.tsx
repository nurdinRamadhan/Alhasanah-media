import React, { useMemo, useState } from "react";
import { useList } from "@refinedev/core";
import {
    Row, Col, Card, Typography, theme, Statistic,
    Select, Empty, Divider, Tag, Skeleton
} from "antd";
import {
    UserOutlined, WalletOutlined, ArrowUpOutlined,
    ShoppingCartOutlined, RocketOutlined, PieChartOutlined,
    BarChartOutlined, FilterOutlined, SyncOutlined,
} from "@ant-design/icons";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ComposedChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { motion, AnimatePresence, Variants } from "framer-motion";
import dayjs from "dayjs";
import { ISantri, ITagihanSantri, IPengeluaran, IPesertaDiklat } from "../../types";

const { Title, Text } = Typography;
const { useToken } = theme;

// ─────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────
const GOLD        = "#C9A84C";
const GOLD_BRIGHT = "#FFB700";
const GOLD_LIGHT  = "#FDE68A";
const GOLD_DEEP   = "#8B6914";
const SUCCESS     = "#059669";
const DANGER      = "#DC2626";
const INFO        = "#2563EB";
const PURPLE      = "#7C3AED";

const EXPENSE_PALETTE = [GOLD, INFO, DANGER, SUCCESS, PURPLE, "#64748B"];

// Hijri year options
const HIJRI_YEARS = Array.from({ length: 10 }, (_, i) => ({
    label: `${1445 + i} H`,
    value: 1445 + i,
}));

// ─────────────────────────────────────────────
// ANIMATION VARIANTS
// ─────────────────────────────────────────────
const fadeUp: Variants = {
    hidden:  { opacity: 0, y: 18 },
    visible: (i = 0) => ({
        opacity: 1, y: 0,
        transition: { duration: 0.48, ease: [0.22, 1, 0.36, 1], delay: i * 0.08 },
    }),
};

const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

// ─────────────────────────────────────────────
// HELPER — Format rupiah singkat
// ─────────────────────────────────────────────
const fmtRupiah = (v: number) => {
    if (v >= 1_000_000_000) return `Rp ${(v / 1_000_000_000).toFixed(1)} M`;
    if (v >= 1_000_000)     return `Rp ${(v / 1_000_000).toFixed(1)} Jt`;
    if (v >= 1_000)         return `Rp ${(v / 1_000).toFixed(0)} Rb`;
    return `Rp ${v}`;
};

const fmtFull = (v: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v);

// ─────────────────────────────────────────────
// PREMIUM TOOLTIP
// ─────────────────────────────────────────────
const PremiumTooltip = ({ active, payload, label, token: tk }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: tk.colorBgElevated,
            border: `1px solid ${tk.colorBorderSecondary}`,
            borderRadius: 14,
            padding: "12px 16px",
            boxShadow: "0 16px 40px rgba(0,0,0,0.25)",
            backdropFilter: "blur(12px)",
            minWidth: 180,
        }}>
            <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 11,
                letterSpacing: "0.08em", textTransform: "uppercase",
                color: GOLD_BRIGHT }}>{label}</p>
            {payload.map((entry: any, i: number) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%",
                        background: entry.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: tk.colorTextSecondary }}>{entry.name}</span>
                    <span style={{ marginLeft: "auto", fontWeight: 700, fontSize: 13,
                        fontFamily: "'DM Mono', monospace", color: tk.colorText }}>
                        {typeof entry.value === "number" && entry.value > 100_000
                            ? fmtFull(entry.value)
                            : entry.value}
                    </span>
                </div>
            ))}
        </div>
    );
};

// ─────────────────────────────────────────────
// SECTION LABEL
// ─────────────────────────────────────────────
const SectionLabel = ({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: `linear-gradient(135deg, ${GOLD}22 0%, ${GOLD_BRIGHT}18 100%)`,
            border: `1px solid ${GOLD}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: GOLD_BRIGHT, fontSize: 18,
        }}>{icon}</div>
        <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800,
                fontSize: 18, letterSpacing: "-0.03em", lineHeight: 1.2 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: "var(--text-secondary)",
                marginTop: 2 }}>{subtitle}</div>}
        </div>
        <div style={{ flex: 1, height: 1,
            background: `linear-gradient(90deg, ${GOLD}30 0%, transparent 100%)`,
            marginLeft: 8 }} />
    </div>
);

// ─────────────────────────────────────────────
// KPI CARD
// ─────────────────────────────────────────────
interface KPICardProps {
    title: string; value: number | string; icon: React.ReactNode;
    color: string; subtext?: React.ReactNode; loading?: boolean;
    prefix?: string; trend?: "up" | "down" | "neutral"; index?: number;
    isDark: boolean; token: ReturnType<typeof useToken>["token"];
}

const KPICard: React.FC<KPICardProps> = ({
    title, value, icon, color, subtext, loading,
    prefix, trend, index = 0, isDark, token: tk,
}) => {
    const isNeg = trend === "down";
    const trendColor = isNeg ? DANGER : (trend === "up" ? SUCCESS : GOLD);

    return (
        <motion.div custom={index} variants={fadeUp}>
            <Card
                bordered={false}
                className="premium-card gold-top-line"
                style={{
                    borderRadius: 20,
                    border: `1px solid ${isDark ? "rgba(201,168,76,0.10)" : "rgba(201,168,76,0.15)"}`,
                    background: isDark ? "var(--surface-card)" : "#fff",
                    boxShadow: isDark
                        ? "0 4px 24px rgba(0,0,0,0.45)"
                        : "0 2px 16px rgba(0,0,0,0.05), 0 0 0 1px rgba(201,168,76,0.08)",
                    position: "relative", overflow: "hidden", height: "100%",
                }}
            >
                {/* Faint geo watermark */}
                <div style={{
                    position: "absolute", bottom: -20, right: -20,
                    width: 110, height: 110, borderRadius: "50%",
                    background: `radial-gradient(circle, ${color}14 0%, transparent 70%)`,
                    pointerEvents: "none",
                }} />

                <Skeleton loading={loading} active paragraph={{ rows: 2 }}>
                    <div style={{ display: "flex", alignItems: "flex-start",
                        justifyContent: "space-between", gap: 12 }}>
                        {/* Left content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                                fontSize: 10, fontWeight: 800, letterSpacing: "0.12em",
                                textTransform: "uppercase", color: "var(--text-tertiary)",
                                fontFamily: "'Syne', sans-serif", marginBottom: 10,
                            }}>{title}</div>

                            <div style={{
                                fontFamily: "'Syne', sans-serif", fontWeight: 800,
                                fontSize: typeof value === "number" && value > 999_999 ? 22 : 28,
                                letterSpacing: "-0.04em", lineHeight: 1, color: tk.colorText,
                                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            }}>
                                {prefix && (
                                    <span style={{ fontSize: 13, fontWeight: 600,
                                        color: "var(--text-secondary)", marginRight: 2 }}>{prefix}</span>
                                )}
                                {typeof value === "number"
                                    ? new Intl.NumberFormat("id-ID").format(value)
                                    : value}
                            </div>

                            <div style={{ marginTop: 10 }}>{subtext}</div>
                        </div>

                        {/* Icon badge */}
                        <div style={{
                            width: 52, height: 52, borderRadius: 16, flexShrink: 0,
                            background: `linear-gradient(135deg, ${color}1A 0%, ${color}35 100%)`,
                            border: `1px solid ${color}30`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: color, fontSize: 22,
                            boxShadow: `0 6px 20px ${color}22`,
                        }}>{icon}</div>
                    </div>
                </Skeleton>
            </Card>
        </motion.div>
    );
};

// ─────────────────────────────────────────────
// GAUGE — Diklat revenue mini stat
// ─────────────────────────────────────────────
const GaugeBar = ({ label, value, max, color }: any) => {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return (
        <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between",
                marginBottom: 5, fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>{label}</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700,
                    fontSize: 11, color: GOLD_BRIGHT }}>{fmtRupiah(value)}</span>
            </div>
            <div style={{ height: 6, borderRadius: 99,
                background: "rgba(201,168,76,0.10)", overflow: "hidden" }}>
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.9, ease: [0.22,1,0.36,1], delay: 0.2 }}
                    style={{
                        height: "100%", borderRadius: 99,
                        background: `linear-gradient(90deg, ${color}, ${GOLD_BRIGHT})`,
                        boxShadow: `0 0 8px ${GOLD}60`,
                    }}
                />
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────
// CUSTOM PIE LABEL
// ─────────────────────────────────────────────
const renderCustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.06) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
        <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central"
            style={{ fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>
            {`${(percent * 100).toFixed(0)}%`}
        </text>
    );
};

// ─────────────────────────────────────────────
// MAIN DASHBOARD
// ─────────────────────────────────────────────
export const DashboardPage = () => {
    const { token } = useToken();
    const isDark = token.colorBgLayout === "#000000" ||
        (typeof document !== "undefined" && document.documentElement.classList.contains("dark"));

    const [selectedYear, setSelectedYear] = useState<number>(dayjs().year());
    const [selectedHijriYear, setSelectedHijriYear] = useState<number>(1447);

    // ── Fetch ──────────────────────────────────
    const { data: santriData, isLoading: santriLoading } = useList<ISantri>({
        resource: "santri", pagination: { mode: "off" },
        filters: [{ field: "status_santri", operator: "eq", value: "AKTIF" }],
    });

    const { data: tagihanData, isLoading: tagihanLoading } = useList<ITagihanSantri>({
        resource: "tagihan_santri", pagination: { mode: "off" },
        filters: [
            { field: "created_at", operator: "gte", value: dayjs().year(selectedYear).startOf("year").toISOString() },
            { field: "created_at", operator: "lte", value: dayjs().year(selectedYear).endOf("year").toISOString() },
        ],
    });

    const { data: pengeluaranData, isLoading: pengeluaranLoading } = useList<IPengeluaran>({
        resource: "pengeluaran", pagination: { mode: "off" },
        filters: [
            { field: "tanggal_pengeluaran", operator: "gte", value: dayjs().year(selectedYear).startOf("year").format("YYYY-MM-DD") },
            { field: "tanggal_pengeluaran", operator: "lte", value: dayjs().year(selectedYear).endOf("year").format("YYYY-MM-DD") },
        ],
    });

    const { data: diklatData, isLoading: diklatLoading } = useList<IPesertaDiklat>({
        resource: "peserta_diklat", pagination: { mode: "off" },
        filters: [{ field: "tahun_diklat", operator: "eq", value: selectedHijriYear }],
    });

    // ── Computed ───────────────────────────────
    const cashflowChartData = useMemo(() => {
        const months = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];
        const data = months.map(m => ({ name: m, income: 0, expense: 0 }));
        tagihanData?.data?.forEach(t => {
            if (t.status === "LUNAS") data[dayjs(t.created_at).month()].income += Number(t.nominal_tagihan);
        });
        pengeluaranData?.data?.forEach(p => {
            data[dayjs(p.tanggal_pengeluaran).month()].expense += Number(p.nominal);
        });
        return data;
    }, [tagihanData, pengeluaranData]);

    const expenseCategoryData = useMemo(() => {
        const groups: Record<string, number> = {};
        (pengeluaranData?.data || []).forEach(p => {
            groups[p.kategori] = (groups[p.kategori] || 0) + Number(p.nominal);
        });
        return Object.keys(groups).map(k => ({ name: k, value: groups[k] })).sort((a, b) => b.value - a.value);
    }, [pengeluaranData]);

    const diklatStats = useMemo(() => {
        const raw = diklatData?.data || [];
        return ["MAULID","SYABAN","RAMADHAN","DZULHIJJAH"].map(evt => {
            const p = raw.filter(x => x.jenis_diklat === evt);
            return {
                name: evt,
                Peserta: p.length,
                Pemasukan: p.reduce((a, c) => a + Number(c.biaya_pendaftaran) + Number(c.belanja_kitab_nominal), 0),
            };
        });
    }, [diklatData]);

    // ── KPIs ───────────────────────────────────
    const totalSantri   = santriData?.data?.length || 0;
    const totalRevenue  = tagihanData?.data?.filter(t => t.status === "LUNAS")
        .reduce((a, c) => a + Number(c.nominal_tagihan), 0) || 0;
    const totalExpense  = pengeluaranData?.data?.reduce((a, c) => a + Number(c.nominal), 0) || 0;
    const netProfit     = totalRevenue - totalExpense;
    const totalDiklat   = diklatData?.data?.length || 0;
    const totalDiklatRev = diklatStats.reduce((a, c) => a + c.Pemasukan, 0);
    const maxDiklatRev   = Math.max(...diklatStats.map(d => d.Pemasukan), 1);

    const yearOptions = Array.from({ length: 5 }, (_, i) => {
        const y = dayjs().year() - i;
        return { label: `Tahun ${y}`, value: y };
    });

    // ── Shared card style ──────────────────────
    const cardStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
        borderRadius: 20,
        border: `1px solid ${isDark ? "rgba(201,168,76,0.10)" : "rgba(201,168,76,0.14)"}`,
        background: isDark ? "var(--surface-card)" : "#fff",
        boxShadow: isDark
            ? "0 4px 24px rgba(0,0,0,0.42)"
            : "0 2px 16px rgba(0,0,0,0.05)",
        ...extra,
    });

    const selectStyle: React.CSSProperties = {
        background: isDark ? "rgba(255,255,255,0.04)" : "rgba(201,168,76,0.06)",
        border: `1px solid ${isDark ? "rgba(201,168,76,0.18)" : "rgba(201,168,76,0.25)"}`,
        borderRadius: 10,
    };

    // ─────────────────────────────────────────────
    return (
        <motion.div initial="hidden" animate="visible" variants={stagger}
            style={{ paddingBottom: 48 }}>

            {/* ═══════════════════════════════════════
                HEADER
            ═══════════════════════════════════════ */}
            <motion.div variants={fadeUp}
                style={{
                    display: "flex", flexWrap: "wrap", justifyContent: "space-between",
                    alignItems: "flex-end", gap: 16, marginBottom: 32,
                    paddingBottom: 24,
                    borderBottom: `1px solid ${isDark ? "rgba(201,168,76,0.10)" : "rgba(201,168,76,0.14)"}`,
                }}>
                <div>
                    {/* Eyebrow */}
                    <div style={{
                        display: "flex", alignItems: "center", gap: 8,
                        fontSize: 11, fontWeight: 700, letterSpacing: "0.14em",
                        textTransform: "uppercase", color: GOLD, marginBottom: 6,
                        fontFamily: "'Syne', sans-serif",
                    }}>
                        <span className="live-dot" />
                        Sistem Manajemen Pesantren
                    </div>
                    <Title level={2} style={{
                        margin: 0, fontFamily: "'Syne', sans-serif", fontWeight: 800,
                        letterSpacing: "-0.04em", lineHeight: 1.15,
                        color: token.colorText,
                    }}>
                        Dashboard{" "}
                        <span className="text-gold-shimmer">Eksekutif</span>
                    </Title>
                    <Text style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4, display: "block" }}>
                        Laporan Keuangan &amp; Kegiatan · {dayjs().format("dddd, DD MMMM YYYY")}
                    </Text>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {/* Year filter */}
                    <div style={{ ...selectStyle, display: "flex", alignItems: "center",
                        gap: 8, padding: "0 12px", height: 38 }}>
                        <FilterOutlined style={{ color: GOLD, fontSize: 13 }} />
                        <Select
                            variant="borderless"
                            value={selectedYear}
                            onChange={setSelectedYear}
                            options={yearOptions}
                            style={{ width: 120, fontWeight: 700 }}
                        />
                    </div>

                    {/* Live badge */}
                    <div style={{
                        display: "flex", alignItems: "center", gap: 7,
                        padding: "0 14px", height: 38, borderRadius: 10,
                        background: `linear-gradient(135deg, ${GOLD}18 0%, ${GOLD_BRIGHT}12 100%)`,
                        border: `1px solid ${GOLD}30`,
                        fontSize: 12, fontWeight: 700, color: GOLD_BRIGHT,
                    }}>
                        <span className="live-dot" />
                        Live
                    </div>
                </div>
            </motion.div>

            {/* ═══════════════════════════════════════
                ROW 1 — KPI CARDS
            ═══════════════════════════════════════ */}
            <Row gutter={[20, 20]} style={{ marginBottom: 28 }}>
                {[
                    {
                        title: "Santri Mukim Aktif",
                        value: totalSantri,
                        icon: <UserOutlined />, color: SUCCESS,
                        loading: santriLoading, trend: "up" as const,
                        subtext: (
                            <Tag style={{ borderRadius: 20, fontSize: 10, fontWeight: 700,
                                background: `${SUCCESS}18`, color: SUCCESS, border: `1px solid ${SUCCESS}30`,
                                padding: "0 10px" }}>
                                ● AKTIF
                            </Tag>
                        ),
                    },
                    {
                        title: "Pemasukan Syahriah",
                        value: totalRevenue, prefix: "Rp",
                        icon: <ArrowUpOutlined />, color: GOLD_BRIGHT,
                        loading: tagihanLoading, trend: "up" as const,
                        subtext: (
                            <span style={{ fontSize: 11, color: GOLD, fontWeight: 700,
                                fontFamily: "'DM Mono', monospace" }}>
                                ↑ Tahun {selectedYear}
                            </span>
                        ),
                    },
                    {
                        title: "Pengeluaran Operasional",
                        value: totalExpense, prefix: "Rp",
                        icon: <ShoppingCartOutlined />, color: DANGER,
                        loading: pengeluaranLoading, trend: "down" as const,
                        subtext: (
                            <span style={{ fontSize: 11, color: DANGER, fontWeight: 700,
                                fontFamily: "'DM Mono', monospace" }}>
                                ↓ Total Pengeluaran
                            </span>
                        ),
                    },
                    {
                        title: "Saldo Kas Pesantren",
                        value: netProfit, prefix: "Rp",
                        icon: <WalletOutlined />,
                        color: netProfit >= 0 ? GOLD_BRIGHT : DANGER,
                        loading: tagihanLoading || pengeluaranLoading,
                        trend: netProfit >= 0 ? "up" as const : "down" as const,
                        subtext: netProfit >= 0 ? (
                            <span style={{ fontSize: 11, color: GOLD, fontWeight: 800,
                                fontFamily: "'Syne', sans-serif", letterSpacing: "0.06em" }}>
                                ◆ SURPLUS
                            </span>
                        ) : (
                            <span style={{ fontSize: 11, color: DANGER, fontWeight: 800 }}>
                                ▼ DEFISIT
                            </span>
                        ),
                    },
                ].map((kpi, i) => (
                    <Col key={i} xs={24} sm={12} lg={6}>
                        <KPICard {...kpi} index={i} isDark={isDark} token={token} />
                    </Col>
                ))}
            </Row>

            {/* ═══════════════════════════════════════
                ROW 2 — CASHFLOW + PIE
            ═══════════════════════════════════════ */}
            <motion.div variants={fadeUp} custom={4} style={{ marginBottom: 28 }}>
                <SectionLabel
                    icon={<BarChartOutlined />}
                    title="Analisis Keuangan"
                    subtitle={`Arus Kas & Komposisi Pengeluaran Tahun ${selectedYear}`}
                />
                <Row gutter={[20, 20]}>

                    {/* ── CASHFLOW AREA CHART ── */}
                    <Col xs={24} lg={16}>
                        <Card
                            bordered={false}
                            className="scan-line"
                            style={{ ...cardStyle(), height: "100%" }}
                            bodyStyle={{ padding: "24px 20px 16px" }}
                            title={
                                <div style={{ display: "flex", justifyContent: "space-between",
                                    alignItems: "center" }}>
                                    <div>
                                        <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800,
                                            fontSize: 16, letterSpacing: "-0.03em" }}>
                                            Arus Kas Tahunan
                                        </div>
                                        <div style={{ fontSize: 11, color: "var(--text-secondary)",
                                            fontWeight: 400 }}>
                                            Pemasukan vs Pengeluaran per Bulan
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", gap: 12 }}>
                                        <span style={{ display: "flex", alignItems: "center", gap: 5,
                                            fontSize: 11, fontWeight: 600 }}>
                                            <span style={{ width: 10, height: 10, borderRadius: "50%",
                                                background: GOLD_BRIGHT, display: "inline-block" }} />
                                            Masuk
                                        </span>
                                        <span style={{ display: "flex", alignItems: "center", gap: 5,
                                            fontSize: 11, fontWeight: 600 }}>
                                            <span style={{ width: 10, height: 10, borderRadius: "50%",
                                                background: DANGER, display: "inline-block" }} />
                                            Keluar
                                        </span>
                                    </div>
                                </div>
                            }
                        >
                            <div style={{ width: "100%", height: 300 }}>
                                <ResponsiveContainer>
                                    <AreaChart data={cashflowChartData}
                                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%"   stopColor={GOLD_BRIGHT} stopOpacity={0.35} />
                                                <stop offset="100%" stopColor={GOLD_BRIGHT} stopOpacity={0.02} />
                                            </linearGradient>
                                            <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%"   stopColor={DANGER} stopOpacity={0.30} />
                                                <stop offset="100%" stopColor={DANGER} stopOpacity={0.02} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="4 4" vertical={false}
                                            stroke={token.colorBorderSecondary} strokeOpacity={0.5} />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false}
                                            tick={{ fill: token.colorTextSecondary, fontSize: 11,
                                                fontFamily: "'DM Sans', sans-serif" }} dy={8} />
                                        <YAxis axisLine={false} tickLine={false}
                                            tick={{ fill: token.colorTextSecondary, fontSize: 10,
                                                fontFamily: "'DM Mono', monospace" }}
                                            tickFormatter={fmtRupiah} width={70} />
                                        <Tooltip
                                            content={<PremiumTooltip token={token} />}
                                            cursor={{ stroke: `${GOLD}40`, strokeWidth: 1.5,
                                                strokeDasharray: "4 4" }}
                                        />
                                        <Area type="monotone" dataKey="income" name="Pemasukan"
                                            stroke={GOLD_BRIGHT} strokeWidth={2.5}
                                            fill="url(#gIncome)" dot={false}
                                            activeDot={{ r: 5, fill: GOLD_BRIGHT,
                                                stroke: token.colorBgElevated, strokeWidth: 2 }} />
                                        <Area type="monotone" dataKey="expense" name="Pengeluaran"
                                            stroke={DANGER} strokeWidth={2}
                                            fill="url(#gExpense)" dot={false}
                                            activeDot={{ r: 5, fill: DANGER,
                                                stroke: token.colorBgElevated, strokeWidth: 2 }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </Col>

                    {/* ── EXPENSE PIE ── */}
                    <Col xs={24} lg={8}>
                        <Card bordered={false} style={{ ...cardStyle(), height: "100%" }}
                            bodyStyle={{ padding: "24px 20px" }}
                            title={
                                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800,
                                    fontSize: 16, letterSpacing: "-0.03em" }}>
                                    <PieChartOutlined style={{ color: GOLD_BRIGHT, marginRight: 8 }} />
                                    Komposisi Pengeluaran
                                </div>
                            }
                        >
                            {expenseCategoryData.length > 0 ? (
                                <>
                                    <div style={{ width: "100%", height: 210 }}>
                                        <ResponsiveContainer>
                                            <PieChart>
                                                <defs>
                                                    {EXPENSE_PALETTE.map((c, i) => (
                                                        <radialGradient key={i} id={`pg${i}`}>
                                                            <stop offset="0%" stopColor={c} stopOpacity={1} />
                                                            <stop offset="100%" stopColor={c} stopOpacity={0.7} />
                                                        </radialGradient>
                                                    ))}
                                                </defs>
                                                <Pie data={expenseCategoryData}
                                                    cx="50%" cy="50%"
                                                    innerRadius={55} outerRadius={85}
                                                    paddingAngle={4} dataKey="value"
                                                    labelLine={false} label={renderCustomPieLabel}
                                                    strokeWidth={0}
                                                >
                                                    {expenseCategoryData.map((_, i) => (
                                                        <Cell key={i}
                                                            fill={`url(#pg${i % EXPENSE_PALETTE.length})`} />
                                                    ))}
                                                </Pie>
                                                <Tooltip
                                                    content={<PremiumTooltip token={token} />}
                                                    cursor={false}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>

                                    {/* Legend list */}
                                    <div style={{ marginTop: 4 }}>
                                        {expenseCategoryData.slice(0, 5).map((item, i) => (
                                            <div key={i} style={{
                                                display: "flex", alignItems: "center",
                                                justifyContent: "space-between",
                                                padding: "6px 0",
                                                borderBottom: i < Math.min(expenseCategoryData.length, 5) - 1
                                                    ? `1px solid ${token.colorBorderSecondary}` : "none",
                                            }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                    <span style={{
                                                        width: 8, height: 8, borderRadius: "50%",
                                                        background: EXPENSE_PALETTE[i % EXPENSE_PALETTE.length],
                                                        flexShrink: 0,
                                                    }} />
                                                    <span style={{ fontSize: 12, color: "var(--text-secondary)",
                                                        fontWeight: 500, maxWidth: 110,
                                                        overflow: "hidden", textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap" }}>{item.name}</span>
                                                </div>
                                                <span style={{ fontFamily: "'DM Mono', monospace",
                                                    fontSize: 11, fontWeight: 700, color: token.colorText }}>
                                                    {fmtRupiah(item.value)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <Empty description="Belum ada data pengeluaran"
                                    style={{ marginTop: 40, color: "var(--text-tertiary)" }} />
                            )}
                        </Card>
                    </Col>
                </Row>
            </motion.div>

            {/* ═══════════════════════════════════════
                DIVIDER — DIKLAT SECTION
            ═══════════════════════════════════════ */}
            <motion.div variants={fadeUp} custom={5}>
                <Divider style={{
                    borderColor: isDark ? "rgba(201,168,76,0.10)" : "rgba(201,168,76,0.18)",
                    margin: "36px 0 32px",
                }} />

                <SectionLabel
                    icon={<RocketOutlined />}
                    title="Analisis Kegiatan Diklat"
                    subtitle="Statistik Peserta & Dana Pasaran"
                />
            </motion.div>

            {/* ═══════════════════════════════════════
                ROW 3 — DIKLAT
            ═══════════════════════════════════════ */}
            <motion.div variants={fadeUp} custom={6}>
                <Row gutter={[20, 20]}>

                    {/* ── CONTROL CENTER ── */}
                    <Col xs={24} lg={7}>
                        <Card bordered={false}
                            style={{ ...cardStyle(), height: "100%", position: "relative", overflow: "hidden" }}
                            bodyStyle={{ padding: 24 }}
                        >
                            {/* Decorative gold blobs */}
                            <div style={{
                                position: "absolute", top: -30, right: -30,
                                width: 140, height: 140,
                                background: `radial-gradient(circle, ${GOLD}22 0%, transparent 70%)`,
                                pointerEvents: "none",
                            }} />
                            <div style={{
                                position: "absolute", bottom: -20, left: -20,
                                width: 100, height: 100,
                                background: `radial-gradient(circle, ${INFO}12 0%, transparent 70%)`,
                                pointerEvents: "none",
                            }} />

                            {/* Section label */}
                            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em",
                                textTransform: "uppercase", color: "var(--text-tertiary)",
                                fontFamily: "'Syne', sans-serif", marginBottom: 14 }}>
                                Control Center
                            </div>

                            {/* Year selector */}
                            <div style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "8px 12px", borderRadius: 12, marginBottom: 24,
                                background: isDark ? "rgba(255,255,255,0.03)" : "rgba(201,168,76,0.05)",
                                border: `1px solid ${isDark ? "rgba(201,168,76,0.14)" : "rgba(201,168,76,0.18)"}`,
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <SyncOutlined spin={diklatLoading}
                                        style={{ color: GOLD_BRIGHT, fontSize: 14 }} />
                                    <span style={{ fontWeight: 700, fontSize: 13 }}>Tahun Hijriah</span>
                                </div>
                                <Select variant="borderless" value={selectedHijriYear}
                                    onChange={setSelectedHijriYear} options={HIJRI_YEARS}
                                    style={{ width: 112, fontWeight: 800, color: GOLD_BRIGHT }} />
                            </div>

                            {/* Total mufasirin */}
                            <div style={{ marginBottom: 20 }}>
                                <div style={{ fontSize: 11, color: "var(--text-secondary)",
                                    marginBottom: 4 }}>Total Mufasirin</div>
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={selectedHijriYear}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -8 }}
                                        transition={{ duration: 0.3 }}
                                        style={{ display: "flex", alignItems: "baseline", gap: 8 }}
                                    >
                                        <span style={{ fontFamily: "'Syne', sans-serif",
                                            fontWeight: 800, fontSize: 42, letterSpacing: "-0.05em",
                                            lineHeight: 1, color: token.colorText }}>
                                            {totalDiklat}
                                        </span>
                                        <span style={{ fontSize: 13, color: SUCCESS, fontWeight: 700 }}>
                                            Mufasirin
                                        </span>
                                    </motion.div>
                                </AnimatePresence>
                            </div>

                            <Divider dashed style={{
                                margin: "0 0 20px",
                                borderColor: isDark ? "rgba(201,168,76,0.10)" : "rgba(201,168,76,0.18)",
                            }} />

                            {/* Revenue breakdown bars */}
                            <div>
                                <div style={{ fontSize: 11, color: "var(--text-secondary)",
                                    fontWeight: 700, marginBottom: 14 }}>Dana per Pasaran</div>
                                {diklatStats.map((d, i) => (
                                    <GaugeBar key={d.name} label={d.name}
                                        value={d.Pemasukan} max={maxDiklatRev}
                                        color={EXPENSE_PALETTE[i % EXPENSE_PALETTE.length]} />
                                ))}
                            </div>

                            {/* Total revenue card */}
                            <div style={{
                                marginTop: 20, padding: "16px 18px",
                                borderRadius: 16, position: "relative", overflow: "hidden",
                                background: isDark
                                    ? "linear-gradient(135deg, #0D0D1A 0%, #111128 100%)"
                                    : `linear-gradient(135deg, ${GOLD_DEEP} 0%, #3D2800 100%)`,
                                boxShadow: `0 8px 32px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(201,168,76,0.20)`,
                            }}>
                                {/* Shimmer overlay */}
                                <div style={{
                                    position: "absolute", inset: 0,
                                    background: `linear-gradient(105deg, transparent 40%, rgba(201,168,76,0.07) 60%, transparent 80%)`,
                                    pointerEvents: "none",
                                }} />
                                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)",
                                    fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
                                    marginBottom: 8 }}>Dana Terkumpul</div>
                                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                                    <span style={{ color: GOLD_BRIGHT, fontSize: 13,
                                        fontWeight: 700 }}>Rp</span>
                                    <span style={{ color: "#fff", fontFamily: "'Syne', sans-serif",
                                        fontWeight: 800, fontSize: 26, letterSpacing: "-0.04em" }}>
                                        {new Intl.NumberFormat("id-ID").format(totalDiklatRev)}
                                    </span>
                                </div>
                                <div style={{ marginTop: 10, display: "flex",
                                    alignItems: "center", gap: 6, fontSize: 10,
                                    color: "rgba(255,255,255,0.35)" }}>
                                    <span className="live-dot" style={{ width: 5, height: 5 }} />
                                    Realtime Update · {selectedHijriYear} H
                                </div>
                            </div>
                        </Card>
                    </Col>

                    {/* ── DIKLAT COMPOSED CHART ── */}
                    <Col xs={24} lg={17}>
                        <Card bordered={false}
                            style={{ ...cardStyle() }}
                            bodyStyle={{ padding: "8px 20px 20px" }}
                            title={
                                <div style={{ padding: "8px 0" }}>
                                    <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800,
                                        fontSize: 16, letterSpacing: "-0.03em" }}>
                                        Statistik Diklat Pasaran
                                    </div>
                                    <div style={{ fontSize: 11, color: "var(--text-secondary)",
                                        fontWeight: 400 }}>
                                        Volume Peserta vs Dana Terkumpul · {selectedHijriYear} H
                                    </div>
                                </div>
                            }
                        >
                            <div style={{ width: "100%", height: 360 }}>
                                <ResponsiveContainer>
                                    {/* ✅ FIX: ComposedChart, bukan BarChart + Area */}
                                    <ComposedChart data={diklatStats}
                                        margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
                                        <defs>
                                            <linearGradient id="diklatBarGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%"   stopColor={GOLD_BRIGHT} stopOpacity={1} />
                                                <stop offset="100%" stopColor={GOLD}        stopOpacity={0.7} />
                                            </linearGradient>
                                            <linearGradient id="diklatAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%"   stopColor={SUCCESS} stopOpacity={0.35} />
                                                <stop offset="100%" stopColor={SUCCESS} stopOpacity={0.02} />
                                            </linearGradient>
                                        </defs>

                                        <CartesianGrid strokeDasharray="4 4" vertical={false}
                                            stroke={token.colorBorderSecondary} strokeOpacity={0.5} />

                                        <XAxis dataKey="name" axisLine={false} tickLine={false}
                                            tick={{ fill: token.colorTextSecondary, fontSize: 11,
                                                fontWeight: 700, fontFamily: "'Syne', sans-serif" }} dy={8} />

                                        <YAxis yAxisId="left" axisLine={false} tickLine={false}
                                            tick={{ fill: token.colorTextSecondary, fontSize: 10,
                                                fontFamily: "'DM Mono', monospace" }}
                                            label={{ value: "Peserta", angle: -90, position: "insideLeft",
                                                style: { fill: token.colorTextSecondary, fontSize: 11 },
                                                offset: 10 }}
                                        />

                                        <YAxis yAxisId="right" orientation="right"
                                            axisLine={false} tickLine={false}
                                            tick={{ fill: token.colorTextSecondary, fontSize: 10,
                                                fontFamily: "'DM Mono', monospace" }}
                                            tickFormatter={fmtRupiah}
                                        />

                                        <Tooltip
                                            content={<PremiumTooltip token={token} />}
                                            cursor={{ fill: `${GOLD}08` }}
                                        />

                                        <Legend
                                            verticalAlign="top" align="right" iconType="circle"
                                            wrapperStyle={{ paddingBottom: 16, fontSize: 12,
                                                fontFamily: "'DM Sans', sans-serif",
                                                color: token.colorText }}
                                        />

                                        <Bar yAxisId="left" dataKey="Peserta" name="Jumlah Peserta"
                                            fill="url(#diklatBarGrad)"
                                            radius={[10, 10, 4, 4]} barSize={40}
                                        />

                                        <Area yAxisId="right" type="monotone"
                                            dataKey="Pemasukan" name="Dana Terkumpul"
                                            stroke={SUCCESS} strokeWidth={2.5}
                                            fill="url(#diklatAreaGrad)"
                                            dot={{ r: 5, fill: SUCCESS,
                                                stroke: token.colorBgElevated, strokeWidth: 2 }}
                                            activeDot={{ r: 7 }}
                                        />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </Col>
                </Row>
            </motion.div>
        </motion.div>
    );
};
