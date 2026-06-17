import React, { useMemo, useState, useEffect } from "react";
import { useList } from "@refinedev/core";
import {
    Row, Col, Card, Typography, theme, Statistic,
    Select, Empty, Divider, Tag, Skeleton, message
} from "antd";
import {
    UserOutlined, WalletOutlined, ArrowUpOutlined,
    ShoppingCartOutlined, RocketOutlined, PieChartOutlined,
    BarChartOutlined, FilterOutlined, SyncOutlined,
    HistoryOutlined,
} from "@ant-design/icons";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ComposedChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { motion, Variants } from "framer-motion";
import dayjs from "dayjs";
import { ISantri, IPesertaDiklat } from "../../types";
import { supabaseClient } from "../../utility/supabaseClient";

const { Title, Text } = Typography;
const { useToken } = theme;

// ─────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────
const GOLD        = "#C9A84C";
const GOLD_BRIGHT = "#FFB700";
const SUCCESS     = "#059669";
const DANGER      = "#DC2626";
const INFO        = "#2563EB";
const PURPLE      = "#7C3AED";

const EXPENSE_PALETTE = [GOLD, INFO, DANGER, SUCCESS, PURPLE, "#64748B"];

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
    prefix?: string; index?: number;
    isDark: boolean; token: any;
}

const KPICard: React.FC<KPICardProps> = ({
    title, value, icon, color, subtext, loading,
    prefix, index = 0, isDark, token: tk,
}) => {
    return (
        <motion.div custom={index} variants={fadeUp}>
            <Card
                bordered={false}
                className="premium-card gold-top-line"
                style={{
                    borderRadius: 20,
                    border: `1px solid ${isDark ? "rgba(201,168,76,0.10)" : "rgba(201,168,76,0.15)"}`,
                    background: tk.colorBgContainer,
                    boxShadow: isDark
                        ? "0 4px 24px rgba(0,0,0,0.45)"
                        : "0 2px 16px rgba(0,0,0,0.05), 0 0 0 1px rgba(201,168,76,0.08)",
                    position: "relative", overflow: "hidden", height: "100%",
                }}
            >
                <div style={{
                    position: "absolute", bottom: -20, right: -20,
                    width: 110, height: 110, borderRadius: "50%",
                    background: `radial-gradient(circle, ${color}14 0%, transparent 70%)`,
                    pointerEvents: "none",
                }} />

                <Skeleton loading={loading} active paragraph={{ rows: 2 }}>
                    <div style={{ display: "flex", alignItems: "flex-start",
                        justifyContent: "space-between", gap: 12 }}>
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
// GAUGE
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

    // ── FINANCIAL DATA STATES ──────────────────
    const [financeStats, setFinanceStats] = useState<any>({ total_cash_in: 0, total_opex: 0, total_receivables: 0, surplus_deficit: 0 });
    const [cashflowData, setCashflowData] = useState<any[]>([]);
    const [expenseData, setExpenseData] = useState<any[]>([]);
    const [isLoadingFinance, setIsLoadingFinance] = useState(true);

    // ── FETCH RPC DATA (Direct Supabase Call to Bypass Provider Error) ─────────────────
    useEffect(() => {
        const fetchDashboardData = async () => {
            setIsLoadingFinance(true);
            try {
                // 1. Fetch KPIs
                const { data: kpiData, error: kpiError } = await supabaseClient.rpc('get_dashboard_financial_stats', { p_year: selectedYear });
                if (kpiError) throw kpiError;
                if (kpiData && kpiData.length > 0) setFinanceStats(kpiData[0]);

                // 2. Fetch Cashflow Chart
                const { data: flowData, error: flowError } = await supabaseClient.rpc('get_dashboard_cashflow_chart', { p_year: selectedYear });
                if (flowError) throw flowError;
                setCashflowData(flowData || []);

                // 3. Fetch Composition
                const { data: compData, error: compError } = await supabaseClient.rpc('get_dashboard_expense_composition', { p_year: selectedYear });
                if (compError) throw compError;
                setExpenseData(compData || []);

            } catch (err: any) {
                console.error("Dashboard RPC Error:", err);
                message.error("Gagal memuat data keuangan dashboard");
            } finally {
                setIsLoadingFinance(false);
            }
        };

        fetchDashboardData();
    }, [selectedYear]);

    // ── Legacy List Data (For Santri & Diklat counts) ───────────
    const { data: santriData, isLoading: santriLoading } = useList<ISantri>({
        resource: "santri", pagination: { mode: "off" },
        filters: [{ field: "status_santri", operator: "eq", value: "AKTIF" }],
    });

    const { data: diklatData, isLoading: diklatLoading } = useList<IPesertaDiklat>({
        resource: "peserta_diklat", pagination: { mode: "off" },
        filters: [{ field: "tahun_diklat", operator: "eq", value: selectedHijriYear }],
    });

    // ── Computed Stats ──────────────────────────
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

    const totalSantri   = santriData?.total || 0;
    const totalDiklat   = diklatData?.total || 0;
    const totalDiklatRev = diklatStats.reduce((a, c) => a + c.Pemasukan, 0);
    const maxDiklatRev   = Math.max(...diklatStats.map(d => d.Pemasukan), 1);

    const yearOptions = Array.from({ length: 5 }, (_, i) => {
        const y = dayjs().year() - i;
        return { label: `Tahun ${y}`, value: y };
    });

    // ─────────────────────────────────────────────
    return (
        <motion.div initial="hidden" animate="visible" variants={stagger}
            style={{ paddingBottom: 48 }}>

            {/* HEADER */}
            <motion.div variants={fadeUp}
                style={{
                    display: "flex", flexWrap: "wrap", justifyContent: "space-between",
                    alignItems: "flex-end", gap: 16, marginBottom: 32,
                    paddingBottom: 24,
                    borderBottom: `1px solid ${isDark ? "rgba(201,168,76,0.10)" : "rgba(201,168,76,0.14)"}`,
                }}>
                <div>
                    <div style={{
                        display: "flex", alignItems: "center", gap: 8,
                        fontSize: 11, fontWeight: 700, letterSpacing: "0.14em",
                        textTransform: "uppercase", color: GOLD, marginBottom: 6,
                        fontFamily: "'Syne', sans-serif",
                    }}>
                        <span className="live-dot" />
                        Sistem Manajemen Pesantren (Presisi Tinggi)
                    </div>
                    <Title level={2} style={{
                        margin: 0, fontFamily: "'Syne', sans-serif", fontWeight: 800,
                        letterSpacing: "-0.04em", lineHeight: 1.15,
                        color: token.colorText,
                    }}>
                        Dashboard{" "}
                        <span className="text-gold-shimmer">Presisi Eksekutif</span>
                    </Title>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(201,168,76,0.06)", border: `1px solid ${isDark ? "rgba(201,168,76,0.18)" : "rgba(201,168,76,0.25)"}`, borderRadius: 10, display: "flex", alignItems: "center", gap: 8, padding: "0 12px", height: 38 }}>
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

            {/* ROW 1 — KPI CARDS */}
            <Row gutter={[20, 20]} style={{ marginBottom: 28 }}>
                <Col xs={24} sm={12} lg={6}>
                    <KPICard 
                        title="Santri Mukim Aktif" value={totalSantri} icon={<UserOutlined />} color={SUCCESS} loading={santriLoading} isDark={isDark} token={token}
                        subtext={<Tag color="green">Realtime</Tag>}
                    />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <KPICard 
                        title="Pemasukan Tunai" value={financeStats.total_cash_in} prefix="Rp" icon={<ArrowUpOutlined />} color={GOLD_BRIGHT} loading={isLoadingFinance} isDark={isDark} token={token}
                        subtext={<span style={{fontSize:10, color:GOLD}}>Termasuk Cicilan</span>}
                    />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <KPICard 
                        title="Tunggakan Piutang" value={financeStats.total_receivables} prefix="Rp" icon={<HistoryOutlined />} color={DANGER} loading={isLoadingFinance} isDark={isDark} token={token}
                        subtext={<span style={{fontSize:10, color:DANGER}}>Tagihan Belum Lunas</span>}
                    />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <KPICard 
                        title="Saldo Kas Unit" value={financeStats.surplus_deficit} prefix="Rp" icon={<WalletOutlined />} color={financeStats.surplus_deficit >= 0 ? SUCCESS : DANGER} loading={isLoadingFinance} isDark={isDark} token={token}
                        subtext={<span style={{fontSize:10, color:GOLD}}>{financeStats.surplus_deficit >= 0 ? "SURPLUS" : "DEFISIT"}</span>}
                    />
                </Col>
            </Row>

            {/* ROW 2 — CASHFLOW + PIE */}
            <motion.div variants={fadeUp} custom={4} style={{ marginBottom: 28 }}>
                <SectionLabel
                    icon={<BarChartOutlined />}
                    title="Analisis Keuangan Server-Side"
                    subtitle={`Data Teragregasi Presisi Tinggi Tahun ${selectedYear}`}
                />
                <Row gutter={[20, 20]}>
                    <Col xs={24} lg={16}>
                        <Card bordered={false} style={{ borderRadius: 20, background: token.colorBgContainer, border: `1px solid ${GOLD}22` }} bodyStyle={{ padding: "24px 20px 16px" }} title="Arus Kas Tahunan (Income vs Expense)">
                            <div style={{ width: "100%", height: 300 }}>
                                <ResponsiveContainer>
                                    <AreaChart data={cashflowData}>
                                        <defs>
                                            <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={GOLD_BRIGHT} stopOpacity={0.3}/><stop offset="100%" stopColor={GOLD_BRIGHT} stopOpacity={0.01}/></linearGradient>
                                            <linearGradient id="gEx" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={DANGER} stopOpacity={0.2}/><stop offset="100%" stopColor={DANGER} stopOpacity={0.01}/></linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                        <XAxis dataKey="month_name" tick={{fontSize:10}} />
                                        <YAxis tickFormatter={fmtRupiah} width={60} tick={{fontSize:10}} />
                                        <Tooltip content={<PremiumTooltip token={token} />} />
                                        <Area type="monotone" dataKey="income" name="Masuk" stroke={GOLD_BRIGHT} fill="url(#gIn)" />
                                        <Area type="monotone" dataKey="expense" name="Keluar" stroke={DANGER} fill="url(#gEx)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </Col>

                    <Col xs={24} lg={8}>
                        <Card bordered={false} style={{ borderRadius: 20, background: token.colorBgContainer, border: `1px solid ${GOLD}22`, height: "100%" }} title="Komposisi Pengeluaran">
                            {!isLoadingFinance && expenseData.length > 0 ? (
                                <div style={{ width: "100%", height: 350 }}>
                                    <ResponsiveContainer>
                                        <PieChart>
                                            <Pie data={expenseData} innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={renderCustomPieLabel}>
                                                {expenseData.map((_, i) => <Cell key={i} fill={EXPENSE_PALETTE[i % EXPENSE_PALETTE.length]} />)}
                                            </Pie>
                                            <Tooltip content={<PremiumTooltip token={token} />} />
                                            <Legend verticalAlign="bottom" />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : isLoadingFinance ? <Skeleton active /> : <Empty style={{marginTop:50}} />}
                        </Card>
                    </Col>
                </Row>
            </motion.div>

            {/* DIKLAT SECTION */}
            <motion.div variants={fadeUp} custom={5}>
                <Divider style={{ borderColor: GOLD + "22", margin: "36px 0" }} />
                <SectionLabel icon={<RocketOutlined />} title="Analisis Diklat Pasaran" subtitle="Statistik Peserta & Dana" />
                <Row gutter={[20, 20]}>
                    <Col xs={24} lg={7}>
                        <Card bordered={false} style={{ borderRadius: 20, background: token.colorBgContainer, border: `1px solid ${GOLD}22` }}>
                            <div style={{ marginBottom: 20 }}>
                                <Text type="secondary" strong>Tahun Hijriah</Text>
                                <Select style={{ width: '100%', marginTop: 8 }} value={selectedHijriYear} onChange={setSelectedHijriYear} options={HIJRI_YEARS} />
                            </div>
                            <Statistic title="Total Mufasirin" value={totalDiklat} prefix={<UserOutlined />} valueStyle={{ color: SUCCESS, fontWeight: 800, fontSize: 32 }} />
                            <Divider />
                            {diklatStats.map((d, i) => (
                                <GaugeBar key={d.name} label={d.name} value={d.Pemasukan} max={maxDiklatRev} color={EXPENSE_PALETTE[i % EXPENSE_PALETTE.length]} />
                            ))}
                        </Card>
                    </Col>
                    <Col xs={24} lg={17}>
                        <Card bordered={false} style={{ borderRadius: 20, background: token.colorBgContainer, border: `1px solid ${GOLD}22` }} title="Volume Peserta vs Dana Terkumpul">
                            <div style={{ width: "100%", height: 350 }}>
                                <ResponsiveContainer>
                                    <ComposedChart data={diklatStats}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                        <XAxis dataKey="name" />
                                        <YAxis yAxisId="left" orientation="left" stroke={GOLD} />
                                        <YAxis yAxisId="right" orientation="right" tickFormatter={fmtRupiah} stroke={SUCCESS} />
                                        <Tooltip content={<PremiumTooltip token={token} />} />
                                        <Bar yAxisId="left" dataKey="Peserta" fill={GOLD} radius={[4,4,0,0]} barSize={40} />
                                        <Area yAxisId="right" type="monotone" dataKey="Pemasukan" stroke={SUCCESS} fill={SUCCESS} fillOpacity={0.1} />
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
