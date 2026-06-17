import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useList, useGetIdentity } from "@refinedev/core";
import {
    Row, Col, Card, Typography, theme, Select, Empty,
    Skeleton, message, Segmented, Divider,
} from "antd";
import {
    UserOutlined, WalletOutlined, ArrowUpOutlined, RocketOutlined,
    PieChartOutlined, BarChartOutlined, FilterOutlined,
    HistoryOutlined, ArrowDownOutlined, TeamOutlined,
} from "@ant-design/icons";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip as ReTooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend,
    ComposedChart, Bar, Line,
} from "recharts";
import { motion, Variants } from "framer-motion";
import dayjs from "dayjs";
import { ISantri, IPesertaDiklat, IUserIdentity } from "../../types";
import { supabaseClient } from "../../utility/supabaseClient";

const { Title } = Typography;
const { useToken } = theme;

// ─── Design Tokens ────────────────────────────────────────────────────────────
const GOLD        = "#C9A84C";
const GOLD_BRIGHT = "#FFB700";
const SUCCESS     = "#059669";
const DANGER      = "#DC2626";
const INFO        = "#2563EB";
const PURPLE      = "#7C3AED";
const AMBER       = "#D97706";

const SEGMENT_CONFIG: Record<string, {
    label: string; color: string; icon: React.ReactNode; short: string; bg: string;
}> = {
    "L-TAHFIDZ": { label: "Laki-laki Tahfidz", short: "L-Tahfidz", color: INFO,    icon: <UserOutlined />, bg: "#1d3557" },
    "L-KITAB":   { label: "Laki-laki Kitab",   short: "L-Kitab",   color: PURPLE,  icon: <UserOutlined />, bg: "#2d1b5e" },
    "P-ALL":     { label: "Perempuan",          short: "P-All",     color: "#EC4899", icon: <UserOutlined />, bg: "#3d1a35" },
};

const EXPENSE_PALETTE = [GOLD_BRIGHT, INFO, DANGER, SUCCESS, PURPLE, "#64748B"];
const HIJRI_YEARS = Array.from({ length: 10 }, (_, i) => ({ label: `${1445 + i} H`, value: 1445 + i }));

// ─── Motion ───────────────────────────────────────────────────────────────────
const fadeUp: Variants = {
    hidden:  { opacity: 0, y: 22 },
    visible: (i = 0) => ({
        opacity: 1, y: 0,
        transition: { duration: 0.52, ease: [0.22, 1, 0.36, 1], delay: i * 0.07 },
    }),
};
const stagger = { visible: { transition: { staggerChildren: 0.07 } } };

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtShort = (v: number) => {
    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}M`;
    if (v >= 1_000_000)     return `${(v / 1_000_000).toFixed(1)}Jt`;
    if (v >= 1_000)         return `${(v / 1_000).toFixed(0)}Rb`;
    return `${v}`;
};
const fmtRupiah = (v: number) => `Rp ${fmtShort(v)}`;
const fmtFull   = (v: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v);

// ─── Types ────────────────────────────────────────────────────────────────────
interface SegmentKpi   { segment: string; total_cash_in: number; total_opex: number; total_receivables: number; surplus_deficit: number }
interface CashflowRow  { month_index: number; month_name: string; segment: string; income: number; expense: number }
interface ExpenseRow   { segment: string; name: string; value: number }

// ─── Animated Value Counter ───────────────────────────────────────────────────
const AnimatedValue: React.FC<{ value: number; formatter?: (v: number) => string }> = ({ value, formatter }) => {
    const [displayed, setDisplayed] = useState(0);
    const prevRef = useRef(0);
    useEffect(() => {
        const start = prevRef.current;
        const startTime = performance.now();
        const update = (now: number) => {
            const t = Math.min((now - startTime) / 850, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            setDisplayed(Math.round(start + (value - start) * eased));
            if (t < 1) requestAnimationFrame(update);
            else prevRef.current = value;
        };
        requestAnimationFrame(update);
    }, [value]);
    return <>{formatter ? formatter(displayed) : displayed.toLocaleString("id-ID")}</>;
};

// ─── Premium Tooltip ──────────────────────────────────────────────────────────
const PremiumTooltip = ({ active, payload, label, token: tk }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: tk.colorBgElevated, border: `1px solid ${tk.colorBorderSecondary}`,
            borderRadius: 14, padding: "12px 16px", minWidth: 195,
            boxShadow: "0 24px 60px rgba(0,0,0,0.35)", backdropFilter: "blur(20px)",
        }}>
            <p style={{ margin: "0 0 10px", fontWeight: 700, fontSize: 11,
                letterSpacing: "0.1em", textTransform: "uppercase", color: GOLD_BRIGHT }}>
                {label}
            </p>
            {payload.map((e: any, i: number) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: e.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: tk.colorTextSecondary, flex: 1 }}>{e.name}</span>
                    <span style={{ fontWeight: 700, fontSize: 13, fontFamily: "'DM Mono', monospace", color: tk.colorText }}>
                        {typeof e.value === "number" && e.value > 100_000 ? fmtFull(e.value) : e.value.toLocaleString("id-ID")}
                    </span>
                </div>
            ))}
        </div>
    );
};

// ─── Health Score Ring (SVG) ──────────────────────────────────────────────────
const ScoreRing: React.FC<{ score: number; color: string; isDark: boolean; size?: number }> = ({
    score, color, isDark, size = 88,
}) => {
    const r = 33;
    const circ = 2 * Math.PI * r;
    const clamped = Math.max(0, Math.min(100, score));
    const ringColor = score >= 40 ? color : DANGER;
    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <svg width={size} height={size} viewBox="0 0 88 88">
                <circle cx="44" cy="44" r={r} fill="none"
                    stroke={isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"} strokeWidth="5" />
                <motion.circle
                    cx="44" cy="44" r={r} fill="none"
                    stroke={ringColor} strokeWidth="5" strokeLinecap="round"
                    strokeDasharray={circ}
                    initial={{ strokeDashoffset: circ }}
                    animate={{ strokeDashoffset: circ * (1 - clamped / 100) }}
                    transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1], delay: 0.5 }}
                    style={{ transform: "rotate(-90deg)", transformOrigin: "44px 44px" }}
                />
                <text x="44" y="40" textAnchor="middle" fill={ringColor}
                    style={{ fontSize: 18, fontWeight: 800, fontFamily: "'DM Mono', monospace" }}>
                    {clamped}
                </text>
                <text x="44" y="56" textAnchor="middle"
                    fill={isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)"}
                    style={{ fontSize: 8, fontFamily: "'Syne', sans-serif", fontWeight: 700, letterSpacing: "0.08em" }}>
                    HEALTH
                </text>
            </svg>
        </div>
    );
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
interface KPICardProps {
    label: string; value: number; formatter?: (v: number) => string;
    icon: React.ReactNode; color: string; subtext?: string;
    loading?: boolean; isDark: boolean; token: any; delay?: number;
}
const KPICard: React.FC<KPICardProps> = ({
    label, value, formatter, icon, color, subtext, loading, isDark, token: tk, delay = 0,
}) => (
    <motion.div variants={fadeUp} custom={delay} whileHover={{ y: -5, transition: { duration: 0.18 } }}
        style={{ height: "100%", cursor: "default" }}>
        <div style={{
            borderRadius: 20, padding: "22px 20px 18px", height: "100%",
            background: tk.colorBgContainer,
            border: `1px solid ${isDark ? color + "22" : color + "28"}`,
            position: "relative", overflow: "hidden",
            boxShadow: isDark
                ? `0 4px 28px rgba(0,0,0,0.45), inset 0 1px 0 ${color}12`
                : `0 2px 16px rgba(0,0,0,0.06), inset 0 1px 0 ${color}18`,
            transition: "box-shadow 0.2s",
        }}>
            {/* Ambient glow */}
            <div style={{
                position: "absolute", bottom: -40, right: -40, width: 130, height: 130,
                borderRadius: "50%", pointerEvents: "none",
                background: `radial-gradient(circle, ${color}18 0%, transparent 65%)`,
            }} />
            {/* Top accent line */}
            <div style={{
                position: "absolute", top: 0, left: "15%", right: "15%", height: 2,
                background: `linear-gradient(90deg, transparent, ${color}70, transparent)`,
            }} />
            <Skeleton loading={loading} active paragraph={{ rows: 2 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
                    <div style={{
                        width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                        background: `linear-gradient(135deg, ${color}20 0%, ${color}38 100%)`,
                        border: `1px solid ${color}30`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color, fontSize: 20,
                        boxShadow: `0 4px 14px ${color}22`,
                    }}>
                        {icon}
                    </div>
                </div>
                <div style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                    color: isDark ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.38)", marginBottom: 6,
                }}>
                    {label}
                </div>
                <div style={{
                    fontFamily: "'DM Mono', monospace", fontWeight: 800,
                    fontSize: formatter ? 20 : 30,
                    letterSpacing: "-0.04em", lineHeight: 1.1, color: tk.colorText,
                }}>
                    {formatter && <span style={{ fontSize: 13, fontWeight: 600, color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.4)", marginRight: 3 }}>Rp</span>}
                    <AnimatedValue value={value} formatter={formatter ? (v) => fmtShort(v) : undefined} />
                </div>
                {subtext && (
                    <div style={{ fontSize: 11, marginTop: 8, color: isDark ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.38)" }}>
                        {subtext}
                    </div>
                )}
            </Skeleton>
        </div>
    </motion.div>
);

// ─── Section Header ───────────────────────────────────────────────────────────
const SectionHeader = ({ icon, title, subtitle, action }: {
    icon: React.ReactNode; title: string; subtitle?: string; action?: React.ReactNode;
}) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
            <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: `linear-gradient(135deg, ${GOLD}20 0%, ${GOLD_BRIGHT}15 100%)`,
                border: `1px solid ${GOLD}28`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: GOLD_BRIGHT, fontSize: 17,
            }}>{icon}</div>
            <div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 17, letterSpacing: "-0.03em" }}>
                    {title}
                </div>
                {subtitle && <div style={{ fontSize: 12, color: "rgba(128,128,128,0.75)", marginTop: 2 }}>{subtitle}</div>}
            </div>
            <div style={{ flex: 1, height: 1, marginLeft: 10, background: `linear-gradient(90deg, ${GOLD}28 0%, transparent 80%)` }} />
        </div>
        {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
);

// ─── Metric Row ───────────────────────────────────────────────────────────────
const MetricRow = ({ label, value, color, icon, formatter, token: tk }: {
    label: string; value: number; color: string;
    icon: React.ReactNode; formatter?: (v: number) => string; token: any;
}) => (
    <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 0", borderBottom: `1px solid ${tk.colorBorderSecondary}`,
    }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
                width: 30, height: 30, borderRadius: 9,
                background: color + "1a", border: `1px solid ${color}28`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color, fontSize: 12,
            }}>{icon}</div>
            <span style={{ fontSize: 12, fontWeight: 500, color: tk.colorTextSecondary }}>{label}</span>
        </div>
        <span style={{
            fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 13,
            color: value < 0 ? DANGER : tk.colorText,
        }}>
            {formatter ? formatter(value) : value.toLocaleString("id-ID")}
        </span>
    </div>
);

// ─── Gauge Bar ────────────────────────────────────────────────────────────────
const GaugeBar = ({ label, value, max, color, count }: {
    label: string; value: number; max: number; color: string; count?: number;
}) => {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return (
        <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(128,128,128,0.9)" }}>{label}</span>
                    {count !== undefined && (
                        <span style={{ fontSize: 10, color: "rgba(128,128,128,0.55)", background: "rgba(128,128,128,0.08)", borderRadius: 4, padding: "1px 5px" }}>
                            {count} org
                        </span>
                    )}
                </div>
                <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 12, color: GOLD_BRIGHT }}>
                    {fmtRupiah(value)}
                </span>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: "rgba(201,168,76,0.10)", overflow: "hidden" }}>
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                    style={{
                        height: "100%", borderRadius: 99,
                        background: `linear-gradient(90deg, ${color}CC, ${GOLD_BRIGHT})`,
                        boxShadow: `0 0 10px ${GOLD}45`,
                    }}
                />
            </div>
        </div>
    );
};

// ─── Pie Label ────────────────────────────────────────────────────────────────
const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.07) return null;
    const R = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.52;
    return (
        <text x={cx + r * Math.cos(-midAngle * R)} y={cy + r * Math.sin(-midAngle * R)}
            fill="#fff" textAnchor="middle" dominantBaseline="central"
            style={{ fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>
            {`${(percent * 100).toFixed(0)}%`}
        </text>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export const DashboardPage = () => {
    const { token } = useToken();
    const isDark = token.colorBgLayout === "#000000" ||
        (typeof document !== "undefined" && document.documentElement.classList.contains("dark"));

    const { data: user } = useGetIdentity<IUserIdentity>();

    const [selectedYear, setSelectedYear]         = useState<number>(dayjs().year());
    const [selectedHijriYear, setSelectedHijriYear] = useState<number>(1447);
    const [cashflowTab, setCashflowTab]           = useState<string>("ALL");
    const [chartMode, setChartMode]               = useState<"area" | "bar" | "combo">("area");

    const [segmentKpis, setSegmentKpis]   = useState<SegmentKpi[]>([]);
    const [cashflowData, setCashflowData] = useState<CashflowRow[]>([]);
    const [expenseData, setExpenseData]   = useState<ExpenseRow[]>([]);
    const [isLoadingFinance, setIsLoadingFinance] = useState(true);

    const availableSegments = useMemo(() => segmentKpis.map(s => s.segment), [segmentKpis]);

    useEffect(() => {
        if (!["ALL", ...availableSegments].includes(cashflowTab)) {
            setCashflowTab(availableSegments[0] || "ALL");
        }
    }, [availableSegments, cashflowTab]);

    const fetchSegmentData = useCallback(async () => {
        setIsLoadingFinance(true);
        try {
            const [kpiRes, cashRes, expRes] = await Promise.all([
                supabaseClient.rpc("get_dashboard_segment_kpis",     { p_year: selectedYear }),
                supabaseClient.rpc("get_dashboard_segment_cashflow",  { p_year: selectedYear }),
                supabaseClient.rpc("get_dashboard_segment_expense",   { p_year: selectedYear }),
            ]);
            if (kpiRes.error)  throw kpiRes.error;
            if (cashRes.error) throw cashRes.error;
            if (expRes.error)  throw expRes.error;
            setSegmentKpis(  (kpiRes.data  || []) as SegmentKpi[]);
            setCashflowData( (cashRes.data || []) as CashflowRow[]);
            setExpenseData(  (expRes.data  || []) as ExpenseRow[]);
        } catch (err: any) {
            console.error("Dashboard segment RPC error:", err);
            message.error("Gagal memuat data dashboard");
        } finally {
            setIsLoadingFinance(false);
        }
    }, [selectedYear]);

    useEffect(() => { fetchSegmentData(); }, [fetchSegmentData]);

    const { data: santriData, isLoading: santriLoading } = useList<ISantri>({
        resource: "santri", pagination: { mode: "off" },
        filters: [{ field: "status_santri", operator: "eq", value: "AKTIF" }],
    });

    const { data: diklatData, isLoading: diklatLoading } = useList<IPesertaDiklat>({
        resource: "peserta_diklat", pagination: { mode: "off" },
        filters: [{ field: "tahun_diklat", operator: "eq", value: selectedHijriYear }],
    });

    const diklatStats = useMemo(() => {
        const raw = diklatData?.data || [];
        return ["MAULID", "SYABAN", "RAMADHAN", "DZULHIJJAH"].map(evt => {
            const p = raw.filter(x => x.jenis_diklat === evt);
            return {
                name: evt,
                Peserta: p.length,
                Pemasukan: p.reduce((a, c) => a + Number(c.biaya_pendaftaran) + Number(c.belanja_kitab_nominal), 0),
            };
        });
    }, [diklatData]);

    const totalDiklat   = diklatData?.total || 0;
    const maxDiklatRev  = Math.max(...diklatStats.map(d => d.Pemasukan), 1);
    const totalSantri   = santriData?.total || 0;

    const kpiMap = useMemo(() => {
        const m = new Map<string, SegmentKpi>();
        segmentKpis.forEach(k => m.set(k.segment, k));
        return m;
    }, [segmentKpis]);

    const cashflowMap = useMemo(() => {
        const m = new Map<string, CashflowRow[]>();
        cashflowData.forEach(r => {
            if (!m.has(r.segment)) m.set(r.segment, []);
            m.get(r.segment)!.push(r);
        });
        return m;
    }, [cashflowData]);

    const expenseMap = useMemo(() => {
        const m = new Map<string, ExpenseRow[]>();
        expenseData.forEach(r => {
            if (!m.has(r.segment)) m.set(r.segment, []);
            m.get(r.segment)!.push(r);
        });
        return m;
    }, [expenseData]);

    const displayCashflow = cashflowTab === "ALL"
        ? (cashflowMap.get("TOTAL") || [])
        : (cashflowMap.get(cashflowTab) || []);

    // Aggregates
    const totalCashIn      = useMemo(() => segmentKpis.reduce((a, k) => a + k.total_cash_in, 0),      [segmentKpis]);
    const totalOpex        = useMemo(() => segmentKpis.reduce((a, k) => a + k.total_opex, 0),          [segmentKpis]);
    const totalReceivables = useMemo(() => segmentKpis.reduce((a, k) => a + k.total_receivables, 0),   [segmentKpis]);
    const totalBalance     = useMemo(() => segmentKpis.reduce((a, k) => a + k.surplus_deficit, 0),     [segmentKpis]);

    const cfIncome  = displayCashflow.reduce((a, r) => a + r.income, 0);
    const cfExpense = displayCashflow.reduce((a, r) => a + r.expense, 0);
    const cfNet     = cfIncome - cfExpense;

    const yearOptions = Array.from({ length: 5 }, (_, i) => {
        const y = dayjs().year() - i;
        return { label: `Tahun ${y}`, value: y };
    });

    const cashflowTabs = useMemo(() => {
        const tabs: { label: string; value: string }[] = [];
        if (availableSegments.length >= 1 || !segmentKpis.length)
            tabs.push({ label: "Total", value: "ALL" });
        availableSegments.forEach(seg => {
            if (SEGMENT_CONFIG[seg])
                tabs.push({ label: SEGMENT_CONFIG[seg].short, value: seg });
        });
        return tabs;
    }, [availableSegments, segmentKpis]);

    const getHealthScore = (kpi?: SegmentKpi) => {
        if (!kpi || kpi.total_cash_in === 0) return 0;
        return Math.round(Math.max(0, Math.min(100, ((kpi.surplus_deficit / kpi.total_cash_in) * 100) + 50)));
    };

    // shared card style
    const cardStyle = {
        borderRadius: 22,
        background: token.colorBgContainer,
        border: `1px solid ${isDark ? `${GOLD}14` : `${GOLD}20`}`,
        boxShadow: isDark ? "0 8px 40px rgba(0,0,0,0.35)" : "0 4px 20px rgba(0,0,0,0.05)",
    };

    const TICK_STYLE = { fontSize: 10, fill: token.colorTextTertiary as string };

    return (
        <motion.div initial="hidden" animate="visible" variants={stagger} style={{ paddingBottom: 64 }}>

            {/* ── HEADER ──────────────────────────────────────────────────────── */}
            <motion.div variants={fadeUp} style={{
                display: "flex", flexWrap: "wrap", justifyContent: "space-between",
                alignItems: "flex-end", gap: 16, marginBottom: 36,
                paddingBottom: 28,
                borderBottom: `1px solid ${isDark ? `${GOLD}12` : `${GOLD}18`}`,
            }}>
                <div>
                    <div style={{
                        display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
                        fontSize: 11, fontWeight: 700, letterSpacing: "0.14em",
                        textTransform: "uppercase", color: GOLD,
                        fontFamily: "'Syne', sans-serif",
                    }}>
                        <motion.span
                            animate={{ opacity: [1, 0.25, 1], scale: [1, 0.85, 1] }}
                            transition={{ duration: 2.2, repeat: Infinity }}
                            style={{
                                width: 7, height: 7, borderRadius: "50%", display: "inline-block",
                                background: SUCCESS, boxShadow: `0 0 8px ${SUCCESS}`,
                            }}
                        />
                        Sistem Manajemen Pesantren · Live
                    </div>

                    <Title level={2} style={{
                        margin: 0, fontFamily: "'Syne', sans-serif", fontWeight: 800,
                        letterSpacing: "-0.04em", lineHeight: 1.1, color: token.colorText,
                    }}>
                        Command Center{" "}
                        <motion.span
                            animate={{ backgroundPosition: ["0% center", "200% center"] }}
                            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                            style={{
                                background: `linear-gradient(120deg, ${GOLD}, ${GOLD_BRIGHT}, #FFE680, ${GOLD})`,
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                                backgroundSize: "250% auto",
                                display: "inline-block",
                            }}
                        >
                            Al-Hasanah
                        </motion.span>
                    </Title>

                    <div style={{ fontSize: 13, color: token.colorTextSecondary, marginTop: 6 }}>
                        {dayjs().format("DD MMMM YYYY")}
                        {user?.name ? ` · Selamat datang, ${user.name}` : " · Dashboard Eksekutif"}
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div style={{
                        padding: "8px 16px", borderRadius: 12,
                        background: isDark ? `${SUCCESS}14` : `${SUCCESS}0d`,
                        border: `1px solid ${SUCCESS}30`,
                        display: "flex", alignItems: "center", gap: 8,
                    }}>
                        <TeamOutlined style={{ color: SUCCESS, fontSize: 15 }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: SUCCESS }}>
                            {santriLoading ? "—" : `${totalSantri} Santri Aktif`}
                        </span>
                    </div>
                    <div style={{
                        background: isDark ? "rgba(255,255,255,0.04)" : `${GOLD}08`,
                        border: `1px solid ${isDark ? `${GOLD}18` : `${GOLD}28`}`,
                        borderRadius: 12, display: "flex", alignItems: "center",
                        gap: 8, padding: "8px 14px",
                    }}>
                        <FilterOutlined style={{ color: GOLD, fontSize: 13 }} />
                        <Select
                            variant="borderless"
                            value={selectedYear}
                            onChange={setSelectedYear}
                            options={yearOptions}
                            style={{ width: 120, fontWeight: 700 }}
                        />
                    </div>
                </div>
            </motion.div>

            {/* ── KPI STRIP ────────────────────────────────────────────────────── */}
            <motion.div variants={stagger} style={{ marginBottom: 36 }}>
                <Row gutter={[14, 14]}>
                    {([
                        {
                            label: "Santri Aktif",    value: totalSantri,   icon: <TeamOutlined />,
                            color: SUCCESS, subtext: `${availableSegments.length || 3} segmen aktif`,
                            loading: santriLoading,
                        },
                        {
                            label: "Total Pemasukan", value: totalCashIn,   icon: <ArrowUpOutlined />,
                            color: GOLD_BRIGHT, formatter: fmtShort, subtext: `Tahun ${selectedYear}`,
                            loading: isLoadingFinance,
                        },
                        {
                            label: "Saldo Kas Bersih",value: totalBalance,  icon: <WalletOutlined />,
                            color: totalBalance >= 0 ? SUCCESS : DANGER,
                            formatter: fmtShort,
                            subtext: totalBalance >= 0 ? "Posisi Surplus ↑" : "Posisi Defisit ↓",
                            loading: isLoadingFinance,
                        },
                        {
                            label: "Total Pengeluaran",value: totalOpex,    icon: <ArrowDownOutlined />,
                            color: DANGER, formatter: fmtShort,
                            subtext: totalCashIn > 0 ? `Rasio ${((totalOpex / totalCashIn) * 100).toFixed(1)}%` : "—",
                            loading: isLoadingFinance,
                        },
                        {
                            label: "Tunggakan Piutang",value: totalReceivables, icon: <HistoryOutlined />,
                            color: AMBER, formatter: fmtShort,
                            subtext: "Total belum dibayar",
                            loading: isLoadingFinance,
                        },
                        {
                            label: "Mufasirin Diklat", value: totalDiklat,  icon: <RocketOutlined />,
                            color: PURPLE, subtext: `${selectedHijriYear} H`,
                            loading: diklatLoading,
                        },
                    ] as KPICardProps[]).map((kpi, i) => (
                        <Col key={kpi.label} xs={12} sm={8} lg={4}>
                            <KPICard {...kpi} isDark={isDark} token={token} delay={i} />
                        </Col>
                    ))}
                </Row>
            </motion.div>

            {/* ── CASHFLOW CHART ───────────────────────────────────────────────── */}
            <motion.div variants={fadeUp} custom={2} style={{ marginBottom: 32 }}>
                <Card bordered={false} style={cardStyle} bodyStyle={{ padding: "26px 28px 20px" }}>

                    {/* Chart Header */}
                    <div style={{
                        display: "flex", flexWrap: "wrap", justifyContent: "space-between",
                        alignItems: "center", gap: 14, marginBottom: 20,
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{
                                width: 42, height: 42, borderRadius: 13, flexShrink: 0,
                                background: `linear-gradient(135deg, ${GOLD}20, ${GOLD_BRIGHT}15)`,
                                border: `1px solid ${GOLD}28`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                color: GOLD_BRIGHT, fontSize: 18,
                            }}><BarChartOutlined /></div>
                            <div>
                                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 17, letterSpacing: "-0.02em" }}>
                                    Arus Kas Tahunan
                                </div>
                                <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
                                    Pemasukan vs Pengeluaran · {selectedYear}
                                </div>
                            </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <Segmented
                                value={chartMode}
                                onChange={(v) => setChartMode(v as any)}
                                options={[
                                    { label: "Area", value: "area" },
                                    { label: "Bar",  value: "bar"  },
                                    { label: "Kombo",value: "combo" },
                                ]}
                                size="small"
                                style={{ fontSize: 11, fontWeight: 600 }}
                            />
                            <Segmented
                                value={cashflowTab}
                                onChange={(val) => setCashflowTab(val as string)}
                                options={cashflowTabs}
                                style={{ fontSize: 11, fontWeight: 600 }}
                            />
                        </div>
                    </div>

                    {/* Summary mini-stats */}
                    <div style={{ display: "flex", gap: 12, marginBottom: 22, flexWrap: "wrap" }}>
                        {[
                            { label: "Pemasukan",   value: cfIncome,  color: GOLD_BRIGHT },
                            { label: "Pengeluaran", value: cfExpense, color: DANGER      },
                            { label: "Net Cash",    value: cfNet,     color: cfNet >= 0 ? SUCCESS : DANGER },
                        ].map(item => (
                            <div key={item.label} style={{
                                flex: 1, minWidth: 100, padding: "10px 16px", borderRadius: 12,
                                background: isDark ? `${item.color}0e` : `${item.color}08`,
                                border: `1px solid ${item.color}25`,
                            }}>
                                <div style={{
                                    fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
                                    textTransform: "uppercase", color: item.color, marginBottom: 4,
                                }}>
                                    {item.label}
                                </div>
                                <div style={{
                                    fontFamily: "'DM Mono', monospace", fontWeight: 800,
                                    fontSize: 16, color: item.color,
                                }}>
                                    {isLoadingFinance ? "—" : fmtFull(item.value)}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Chart canvas */}
                    <div style={{ width: "100%", height: 310 }}>
                        {isLoadingFinance ? (
                            <Skeleton active paragraph={{ rows: 7 }} />
                        ) : displayCashflow.length === 0 ? (
                            <Empty description="Belum ada data cashflow" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                        ) : (
                            <ResponsiveContainer>
                                {chartMode === "bar" ? (
                                    <ComposedChart data={displayCashflow} barGap={4} barCategoryGap="30%">
                                        <defs>
                                            <linearGradient id="bIn"  x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%"   stopColor={GOLD_BRIGHT} stopOpacity={0.95}/>
                                                <stop offset="100%" stopColor={GOLD_BRIGHT} stopOpacity={0.45}/>
                                            </linearGradient>
                                            <linearGradient id="bEx" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%"   stopColor={DANGER} stopOpacity={0.9}/>
                                                <stop offset="100%" stopColor={DANGER} stopOpacity={0.4}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.07} />
                                        <XAxis dataKey="month_name" tick={TICK_STYLE} axisLine={false} tickLine={false} />
                                        <YAxis tickFormatter={fmtRupiah} width={68} tick={TICK_STYLE} axisLine={false} tickLine={false} />
                                        <ReTooltip content={<PremiumTooltip token={token} />}
                                            cursor={{ fill: isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.025)" }} />
                                        <Bar dataKey="income"  name="Pemasukan"   fill="url(#bIn)"  radius={[5, 5, 0, 0]} maxBarSize={28} />
                                        <Bar dataKey="expense" name="Pengeluaran" fill="url(#bEx)" radius={[5, 5, 0, 0]} maxBarSize={28} />
                                        <Legend iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: token.colorTextSecondary }}>{v}</span>} />
                                    </ComposedChart>
                                ) : chartMode === "combo" ? (
                                    <ComposedChart data={displayCashflow} barCategoryGap="35%">
                                        <defs>
                                            <linearGradient id="cIn" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%"   stopColor={GOLD_BRIGHT} stopOpacity={0.85}/>
                                                <stop offset="100%" stopColor={GOLD_BRIGHT} stopOpacity={0.35}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.07} />
                                        <XAxis dataKey="month_name" tick={TICK_STYLE} axisLine={false} tickLine={false} />
                                        <YAxis tickFormatter={fmtRupiah} width={68} tick={TICK_STYLE} axisLine={false} tickLine={false} />
                                        <ReTooltip content={<PremiumTooltip token={token} />} />
                                        <Bar dataKey="income" name="Pemasukan" fill="url(#cIn)" radius={[5, 5, 0, 0]} maxBarSize={32} />
                                        <Line type="monotone" dataKey="expense" name="Pengeluaran"
                                            stroke={DANGER} strokeWidth={2.5}
                                            dot={{ r: 3, fill: DANGER, stroke: token.colorBgContainer, strokeWidth: 2 }}
                                            activeDot={{ r: 5 }} />
                                        <Legend iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: token.colorTextSecondary }}>{v}</span>} />
                                    </ComposedChart>
                                ) : (
                                    <AreaChart data={displayCashflow}>
                                        <defs>
                                            <linearGradient id="gIn"  x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%"   stopColor={GOLD_BRIGHT} stopOpacity={0.4}/>
                                                <stop offset="100%" stopColor={GOLD_BRIGHT} stopOpacity={0.02}/>
                                            </linearGradient>
                                            <linearGradient id="gEx" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%"   stopColor={DANGER} stopOpacity={0.3}/>
                                                <stop offset="100%" stopColor={DANGER} stopOpacity={0.01}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.07} />
                                        <XAxis dataKey="month_name" tick={TICK_STYLE} axisLine={false} tickLine={false} />
                                        <YAxis tickFormatter={fmtRupiah} width={68} tick={TICK_STYLE} axisLine={false} tickLine={false} />
                                        <ReTooltip content={<PremiumTooltip token={token} />} />
                                        <Area type="monotone" dataKey="income"  name="Pemasukan"
                                            stroke={GOLD_BRIGHT} fill="url(#gIn)" strokeWidth={2.5} />
                                        <Area type="monotone" dataKey="expense" name="Pengeluaran"
                                            stroke={DANGER} fill="url(#gEx)" strokeWidth={2.5} />
                                        <Legend iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: token.colorTextSecondary }}>{v}</span>} />
                                    </AreaChart>
                                )}
                            </ResponsiveContainer>
                        )}
                    </div>
                </Card>
            </motion.div>

            {/* ── SEGMENT KPI STRIP ────────────────────────────────────────────── */}
            <motion.div variants={fadeUp} custom={3} style={{ marginBottom: 32 }}>
                <SectionHeader
                    icon={<PieChartOutlined />}
                    title="Analisis Keuangan Per Segmen"
                    subtitle="Kesehatan finansial, metrik arus kas & distribusi pengeluaran"
                />

                {/* Per-segment top KPI row */}
                <Row gutter={[14, 14]} style={{ marginBottom: 20 }}>
                    {availableSegments.map((seg, i) => {
                        const cfg  = SEGMENT_CONFIG[seg];
                        const kpi  = kpiMap.get(seg);
                        const c    = cfg?.color || GOLD;
                        const hs   = getHealthScore(kpi);
                        return (
                            <Col key={seg} xs={24} md={8}>
                                <motion.div variants={fadeUp} custom={i + 3}
                                    whileHover={{ y: -4, transition: { duration: 0.18 } }}>
                                    <div style={{
                                        borderRadius: 20, overflow: "hidden", height: "100%",
                                        border: `1px solid ${isDark ? c + "22" : c + "28"}`,
                                        boxShadow: isDark ? `0 4px 24px rgba(0,0,0,0.4)` : `0 2px 16px rgba(0,0,0,0.06)`,
                                        background: token.colorBgContainer,
                                    }}>
                                        {/* Banner */}
                                        <div style={{
                                            padding: "18px 20px 16px",
                                            background: isDark
                                                ? `linear-gradient(135deg, ${c}20 0%, ${c}0a 100%)`
                                                : `linear-gradient(135deg, ${c}18 0%, ${c}08 100%)`,
                                            borderBottom: `1px solid ${c}20`,
                                            display: "flex", justifyContent: "space-between", alignItems: "center",
                                        }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                <div style={{
                                                    width: 42, height: 42, borderRadius: 13, flexShrink: 0,
                                                    background: `linear-gradient(135deg, ${c}30 0%, ${c}50 100%)`,
                                                    border: `1px solid ${c}40`,
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    color: c, fontSize: 19,
                                                }}>{cfg?.icon || <UserOutlined />}</div>
                                                <div>
                                                    <div style={{ fontWeight: 800, fontSize: 14, lineHeight: 1.2 }}>
                                                        {cfg?.label || seg}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: c, fontWeight: 700, marginTop: 2, letterSpacing: "0.04em" }}>
                                                        {seg === "P-ALL" ? "KITAB & TAHFIDZ" : seg.replace("-", " · ")}
                                                    </div>
                                                </div>
                                            </div>
                                            <ScoreRing score={hs} color={c} isDark={isDark} size={88} />
                                        </div>

                                        {/* Metrics */}
                                        <div style={{ padding: "14px 20px" }}>
                                            {isLoadingFinance ? <Skeleton active paragraph={{ rows: 4 }} /> : (
                                                <>
                                                    <MetricRow label="Pemasukan Tunai"  value={kpi?.total_cash_in    || 0} color={SUCCESS}                               icon={<ArrowUpOutlined />}  formatter={fmtFull} token={token} />
                                                    <MetricRow label="Total Pengeluaran" value={kpi?.total_opex       || 0} color={DANGER}                                icon={<ArrowDownOutlined />} formatter={fmtFull} token={token} />
                                                    <MetricRow label="Tunggakan Piutang" value={kpi?.total_receivables|| 0} color={AMBER}                                 icon={<HistoryOutlined />}  formatter={fmtFull} token={token} />
                                                    <MetricRow label="Saldo Kas"         value={kpi?.surplus_deficit || 0} color={(kpi?.surplus_deficit||0)>=0?SUCCESS:DANGER} icon={<WalletOutlined />}   formatter={fmtFull} token={token} />
                                                </>
                                            )}
                                        </div>

                                        {/* Expense donut */}
                                        <div style={{
                                            padding: "4px 20px 16px",
                                            borderTop: `1px solid ${token.colorBorderSecondary}`,
                                        }}>
                                            <div style={{
                                                fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                                                textTransform: "uppercase", color: c, padding: "12px 0 4px",
                                            }}>
                                                Distribusi Pengeluaran
                                            </div>
                                            {isLoadingFinance ? (
                                                <Skeleton active style={{ marginTop: 8 }} />
                                            ) : (expenseMap.get(seg) || []).length > 0 ? (
                                                <div style={{ width: "100%", height: 185 }}>
                                                    <ResponsiveContainer>
                                                        <PieChart>
                                                            <Pie
                                                                data={expenseMap.get(seg)}
                                                                innerRadius={42} outerRadius={68}
                                                                paddingAngle={3} dataKey="value"
                                                                label={renderPieLabel}
                                                            >
                                                                {(expenseMap.get(seg) || []).map((_, ii) => (
                                                                    <Cell key={ii} fill={EXPENSE_PALETTE[ii % EXPENSE_PALETTE.length]} stroke="transparent" />
                                                                ))}
                                                            </Pie>
                                                            <ReTooltip content={<PremiumTooltip token={token} />} />
                                                            <Legend
                                                                verticalAlign="bottom" iconSize={7} iconType="circle"
                                                                formatter={(v) => <span style={{ fontSize: 10, color: token.colorTextSecondary }}>{v}</span>}
                                                            />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            ) : (
                                                <Empty description="Belum ada data" image={Empty.PRESENTED_IMAGE_SIMPLE}
                                                    style={{ padding: "16px 0" }} />
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            </Col>
                        );
                    })}
                </Row>
            </motion.div>

            {/* ── DIKLAT ──────────────────────────────────────────────────────── */}
            <motion.div variants={fadeUp} custom={5}>
                <SectionHeader
                    icon={<RocketOutlined />}
                    title="Analisis Diklat Pasaran"
                    subtitle="Statistik peserta & dana per event tahun Hijriah"
                    action={
                        <div style={{
                            background: isDark ? "rgba(255,255,255,0.04)" : `${GOLD}08`,
                            border: `1px solid ${isDark ? `${GOLD}18` : `${GOLD}25`}`,
                            borderRadius: 10, display: "flex", alignItems: "center", gap: 8, padding: "6px 12px",
                        }}>
                            <FilterOutlined style={{ color: GOLD, fontSize: 12 }} />
                            <Select
                                variant="borderless" size="small"
                                value={selectedHijriYear}
                                onChange={setSelectedHijriYear}
                                options={HIJRI_YEARS}
                                style={{ width: 96, fontWeight: 700 }}
                            />
                        </div>
                    }
                />

                <Row gutter={[18, 18]}>
                    {/* Stat card */}
                    <Col xs={24} lg={7}>
                        <Card bordered={false} style={{ ...cardStyle, height: "100%" }} bodyStyle={{ padding: "24px" }}>
                            <div style={{
                                fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                                textTransform: "uppercase", color: GOLD, marginBottom: 4,
                            }}>
                                Total Mufasirin
                            </div>
                            <div style={{
                                fontFamily: "'DM Mono', monospace", fontWeight: 800,
                                fontSize: 48, letterSpacing: "-0.05em",
                                color: SUCCESS, lineHeight: 1, marginBottom: 4,
                            }}>
                                {diklatLoading ? <Skeleton.Input size="small" active /> : (
                                    <AnimatedValue value={totalDiklat} />
                                )}
                            </div>
                            <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 24 }}>
                                peserta terdaftar · {selectedHijriYear} H
                            </div>
                            <Divider style={{ borderColor: GOLD + "18", margin: "0 0 20px" }} />
                            {diklatStats.map((d, i) => (
                                <GaugeBar
                                    key={d.name}
                                    label={d.name}
                                    value={d.Pemasukan}
                                    max={maxDiklatRev}
                                    color={EXPENSE_PALETTE[i % EXPENSE_PALETTE.length]}
                                    count={d.Peserta}
                                />
                            ))}
                        </Card>
                    </Col>

                    {/* Chart card */}
                    <Col xs={24} lg={17}>
                        <Card bordered={false} style={cardStyle} bodyStyle={{ padding: "24px" }}>
                            <div style={{
                                fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14,
                                letterSpacing: "-0.01em", color: token.colorTextSecondary, marginBottom: 22,
                            }}>
                                Volume Peserta vs Dana Terkumpul · {selectedHijriYear} H
                            </div>
                            <div style={{ width: "100%", height: 340 }}>
                                {diklatLoading ? <Skeleton active paragraph={{ rows: 8 }} /> : (
                                    <ResponsiveContainer>
                                        <ComposedChart data={diklatStats} barCategoryGap="35%">
                                            <defs>
                                                <linearGradient id="dkIn" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%"   stopColor={SUCCESS} stopOpacity={0.85}/>
                                                    <stop offset="100%" stopColor={SUCCESS} stopOpacity={0.3}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.07} />
                                            <XAxis dataKey="name" tick={{ ...TICK_STYLE, fontSize: 11 }} axisLine={false} tickLine={false} />
                                            <YAxis yAxisId="left"  orientation="left"  stroke={GOLD}
                                                tick={{ fontSize: 10, fill: GOLD }} axisLine={false} tickLine={false} />
                                            <YAxis yAxisId="right" orientation="right" tickFormatter={fmtRupiah} stroke={SUCCESS}
                                                tick={{ fontSize: 10, fill: SUCCESS }} axisLine={false} tickLine={false} />
                                            <ReTooltip content={<PremiumTooltip token={token} />}
                                                cursor={{ fill: isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.025)" }} />
                                            <Bar yAxisId="right" dataKey="Pemasukan" name="Dana Terkumpul"
                                                fill="url(#dkIn)" radius={[6, 6, 0, 0]} maxBarSize={44} />
                                            <Line yAxisId="left" type="monotone" dataKey="Peserta" name="Jumlah Peserta"
                                                stroke={GOLD_BRIGHT} strokeWidth={2.5}
                                                dot={{ r: 5, fill: GOLD_BRIGHT, stroke: token.colorBgContainer, strokeWidth: 2 }}
                                                activeDot={{ r: 7 }} />
                                            <Legend iconSize={8}
                                                formatter={(v) => <span style={{ fontSize: 11, color: token.colorTextSecondary }}>{v}</span>} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </Card>
                    </Col>
                </Row>
            </motion.div>
        </motion.div>
    );
};
