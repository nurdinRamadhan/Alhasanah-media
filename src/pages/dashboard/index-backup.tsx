import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useList, useGetIdentity } from "@refinedev/core";
import {
    Row, Col, Card, Typography, theme, Statistic,
    Select, Empty, Divider, Tag, Skeleton, message, Segmented
} from "antd";
import {
    UserOutlined, WalletOutlined, ArrowUpOutlined,
    ShoppingCartOutlined, RocketOutlined, PieChartOutlined,
    BarChartOutlined, FilterOutlined,
    HistoryOutlined, ArrowDownOutlined,
} from "@ant-design/icons";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
    ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { motion, Variants } from "framer-motion";
import dayjs from "dayjs";
import { ISantri, IPesertaDiklat, IUserIdentity } from "../../types";
import { supabaseClient } from "../../utility/supabaseClient";

const { Title, Text } = Typography;
const { useToken } = theme;

const GOLD        = "#C9A84C";
const GOLD_BRIGHT = "#FFB700";
const SUCCESS     = "#059669";
const DANGER      = "#DC2626";
const INFO        = "#2563EB";
const PURPLE      = "#7C3AED";

const SEGMENT_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    "L-TAHFIDZ": { label: "Laki-laki Tahfidz", color: INFO, icon: <UserOutlined /> },
    "L-KITAB":   { label: "Laki-laki Kitab",   color: PURPLE, icon: <UserOutlined /> },
    "P-ALL":     { label: "Perempuan",         color: DANGER, icon: <UserOutlined /> },
};

const EXPENSE_PALETTE = [GOLD, INFO, DANGER, SUCCESS, PURPLE, "#64748B"];

const HIJRI_YEARS = Array.from({ length: 10 }, (_, i) => ({
    label: `${1445 + i} H`,
    value: 1445 + i,
}));

const fadeUp: Variants = {
    hidden:  { opacity: 0, y: 18 },
    visible: (i = 0) => ({
        opacity: 1, y: 0,
        transition: { duration: 0.48, ease: [0.22, 1, 0.36, 1], delay: i * 0.08 },
    }),
};

const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

const fmtRupiah = (v: number) => {
    if (v >= 1_000_000_000) return `Rp ${(v / 1_000_000_000).toFixed(1)} M`;
    if (v >= 1_000_000)     return `Rp ${(v / 1_000_000).toFixed(1)} Jt`;
    if (v >= 1_000)         return `Rp ${(v / 1_000).toFixed(0)} Rb`;
    return `Rp ${v}`;
};

const fmtFull = (v: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v);

interface SegmentKpi { segment: string; total_cash_in: number; total_opex: number; total_receivables: number; surplus_deficit: number }
interface CashflowRow { month_index: number; month_name: string; segment: string; income: number; expense: number }
interface ExpenseRow { segment: string; name: string; value: number }

const PremiumTooltip = ({ active, payload, label, token: tk }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: tk.colorBgElevated,
            border: `1px solid ${tk.colorBorderSecondary}`,
            borderRadius: 14, padding: "12px 16px",
            boxShadow: "0 16px 40px rgba(0,0,0,0.25)",
            backdropFilter: "blur(12px)", minWidth: 180,
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
                        {typeof entry.value === "number" && entry.value > 100_000 ? fmtFull(entry.value) : entry.value}
                    </span>
                </div>
            ))}
        </div>
    );
};

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
            {subtitle && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{subtitle}</div>}
        </div>
        <div style={{ flex: 1, height: 1,
            background: `linear-gradient(90deg, ${GOLD}30 0%, transparent 100%)`, marginLeft: 8 }} />
    </div>
);

interface MiniKPICardProps {
    title: string; value: number; icon: React.ReactNode;
    color: string; loading?: boolean; prefix?: string;
    isDark: boolean; token: any;
}

const MiniKPICard: React.FC<MiniKPICardProps> = ({ title, value, icon, color, loading, prefix, isDark, token: tk }) => (
    <Card
        bordered={false}
        style={{
            borderRadius: 14, height: "100%",
            border: `1px solid ${isDark ? "rgba(201,168,76,0.10)" : "rgba(201,168,76,0.15)"}`,
            background: tk.colorBgContainer,
            boxShadow: isDark ? "0 2px 12px rgba(0,0,0,0.35)" : "0 1px 8px rgba(0,0,0,0.04)",
            position: "relative", overflow: "hidden",
        }}
    >
        <div style={{
            position: "absolute", bottom: -16, right: -16,
            width: 80, height: 80, borderRadius: "50%",
            background: `radial-gradient(circle, ${color}12 0%, transparent 70%)`,
            pointerEvents: "none",
        }} />
        <Skeleton loading={loading} active paragraph={{ rows: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: `linear-gradient(135deg, ${color}18 0%, ${color}28 100%)`,
                    border: `1px solid ${color}25`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color, fontSize: 15,
                }}>{icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontSize: 9, fontWeight: 800, letterSpacing: "0.1em",
                        textTransform: "uppercase", color: "var(--text-tertiary)",
                        marginBottom: 3,
                    }}>{title}</div>
                    <div style={{
                        fontFamily: "'Syne', sans-serif", fontWeight: 800,
                        fontSize: typeof value === "number" && value > 999999 ? 14 : 17,
                        letterSpacing: "-0.03em", lineHeight: 1, color: tk.colorText,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                        {prefix && <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-secondary)", marginRight: 1 }}>{prefix}</span>}
                        {new Intl.NumberFormat("id-ID").format(value)}
                    </div>
                </div>
            </div>
        </Skeleton>
    </Card>
);

const renderCustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.06) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
        <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central"
            style={{ fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>
            {`${(percent * 100).toFixed(0)}%`}
        </text>
    );
};

const GaugeBar = ({ label, value, max, color }: any) => {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return (
        <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>{label}</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 11, color: GOLD_BRIGHT }}>{fmtRupiah(value)}</span>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: "rgba(201,168,76,0.10)", overflow: "hidden" }}>
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
                    style={{ height: "100%", borderRadius: 99, background: `linear-gradient(90deg, ${color}, ${GOLD_BRIGHT})`, boxShadow: `0 0 8px ${GOLD}60` }}
                />
            </div>
        </div>
    );
};

export const DashboardPage = () => {
    const { token } = useToken();
    const isDark = token.colorBgLayout === "#000000" ||
        (typeof document !== "undefined" && document.documentElement.classList.contains("dark"));

    const { data: user } = useGetIdentity<IUserIdentity>();

    const [selectedYear, setSelectedYear] = useState<number>(dayjs().year());
    const [selectedHijriYear, setSelectedHijriYear] = useState<number>(1447);
    const [cashflowTab, setCashflowTab] = useState<string>("ALL");

    const [segmentKpis, setSegmentKpis] = useState<SegmentKpi[]>([]);
    const [cashflowData, setCashflowData] = useState<CashflowRow[]>([]);
    const [expenseData, setExpenseData] = useState<ExpenseRow[]>([]);
    const [isLoadingFinance, setIsLoadingFinance] = useState(true);

    const availableSegments = useMemo(() => {
        return segmentKpis.map(s => s.segment);
    }, [segmentKpis]);

    useEffect(() => {
        if (!["ALL", ...availableSegments].includes(cashflowTab)) {
            setCashflowTab(availableSegments[0] || "ALL");
        }
    }, [availableSegments, cashflowTab]);

    const fetchSegmentData = useCallback(async () => {
        setIsLoadingFinance(true);
        try {
            const [kpiRes, cashRes, expRes] = await Promise.all([
                supabaseClient.rpc('get_dashboard_segment_kpis', { p_year: selectedYear }),
                supabaseClient.rpc('get_dashboard_segment_cashflow', { p_year: selectedYear }),
                supabaseClient.rpc('get_dashboard_segment_expense', { p_year: selectedYear }),
            ]);

            if (kpiRes.error) throw kpiRes.error;
            if (cashRes.error) throw cashRes.error;
            if (expRes.error) throw expRes.error;

            setSegmentKpis((kpiRes.data || []) as SegmentKpi[]);
            setCashflowData((cashRes.data || []) as CashflowRow[]);
            setExpenseData((expRes.data || []) as ExpenseRow[]);
        } catch (err: any) {
            console.error("Dashboard segment RPC error:", err);
            message.error("Gagal memuat data dashboard");
        } finally {
            setIsLoadingFinance(false);
        }
    }, [selectedYear]);

    useEffect(() => {
        fetchSegmentData();
    }, [fetchSegmentData]);

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
        return ["MAULID","SYABAN","RAMADHAN","DZULHIJJAH"].map(evt => {
            const p = raw.filter(x => x.jenis_diklat === evt);
            return {
                name: evt,
                Peserta: p.length,
                Pemasukan: p.reduce((a, c) => a + Number(c.biaya_pendaftaran) + Number(c.belanja_kitab_nominal), 0),
            };
        });
    }, [diklatData]);

    const totalDiklat = diklatData?.total || 0;
    const maxDiklatRev = Math.max(...diklatStats.map(d => d.Pemasukan), 1);

    const kpiMap = useMemo(() => {
        const map = new Map<string, SegmentKpi>();
        segmentKpis.forEach(k => map.set(k.segment, k));
        return map;
    }, [segmentKpis]);

    const cashflowMap = useMemo(() => {
        const map = new Map<string, CashflowRow[]>();
        cashflowData.forEach(r => {
            if (!map.has(r.segment)) map.set(r.segment, []);
            map.get(r.segment)!.push(r);
        });
        return map;
    }, [cashflowData]);

    const displayCashflow = cashflowTab === "ALL" ? (cashflowMap.get("TOTAL") || []) : (cashflowMap.get(cashflowTab) || []);

    const expenseMap = useMemo(() => {
        const map = new Map<string, ExpenseRow[]>();
        expenseData.forEach(r => {
            if (!map.has(r.segment)) map.set(r.segment, []);
            map.get(r.segment)!.push(r);
        });
        return map;
    }, [expenseData]);

    const yearOptions = Array.from({ length: 5 }, (_, i) => {
        const y = dayjs().year() - i;
        return { label: `Tahun ${y}`, value: y };
    });

    const cashflowTabs = useMemo(() => {
        const tabs: { label: string; value: string }[] = [];
        if (availableSegments.length === 3 || !segmentKpis.length) {
            tabs.push({ label: "Semua Segmen", value: "ALL" });
        }
        availableSegments.forEach(seg => {
            if (SEGMENT_CONFIG[seg]) {
                tabs.push({ label: SEGMENT_CONFIG[seg].label, value: seg });
            }
        });
        return tabs;
    }, [availableSegments, segmentKpis]);

    const totalSantri = santriData?.total || 0;

    return (
        <motion.div initial="hidden" animate="visible" variants={stagger} style={{ paddingBottom: 48 }}>

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
                    <div style={{
                        fontSize: 12, color: "var(--text-secondary)", fontWeight: 600,
                        display: "flex", alignItems: "center", gap: 6,
                    }}>
                        <UserOutlined style={{ color: GOLD }} />
                        {totalSantri} Santri Aktif
                    </div>
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

            {/* CASHFLOW CHART */}
            <motion.div variants={fadeUp} custom={1} style={{ marginBottom: 28 }}>
                <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    flexWrap: "wrap", gap: 12, marginBottom: 16,
                }}>
                    <SectionLabel
                        icon={<BarChartOutlined />}
                        title="Arus Kas Tahunan"
                        subtitle={`Tahun ${selectedYear}`}
                    />
                    <Segmented
                        value={cashflowTab}
                        onChange={(val) => setCashflowTab(val as string)}
                        options={cashflowTabs}
                        style={{ fontSize: 12, fontWeight: 600 }}
                    />
                </div>
                <Card
                    bordered={false}
                    style={{
                        borderRadius: 20, background: token.colorBgContainer,
                        border: `1px solid ${GOLD}22`,
                    }}
                    bodyStyle={{ padding: "20px 20px 12px" }}
                >
                    <div style={{ width: "100%", height: 280 }}>
                        {isLoadingFinance ? <Skeleton active paragraph={{ rows: 4 }} /> : (
                            <ResponsiveContainer>
                                <AreaChart data={displayCashflow}>
                                    <defs>
                                        <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={GOLD_BRIGHT} stopOpacity={0.3}/><stop offset="100%" stopColor={GOLD_BRIGHT} stopOpacity={0.01}/></linearGradient>
                                        <linearGradient id="gEx" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={DANGER} stopOpacity={0.2}/><stop offset="100%" stopColor={DANGER} stopOpacity={0.01}/></linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                    <XAxis dataKey="month_name" tick={{ fontSize: 10 }} />
                                    <YAxis tickFormatter={fmtRupiah} width={60} tick={{ fontSize: 10 }} />
                                    <ReTooltip content={<PremiumTooltip token={token} />} />
                                    <Area type="monotone" dataKey="income" name="Pemasukan" stroke={GOLD_BRIGHT} fill="url(#gIn)" strokeWidth={2} />
                                    <Area type="monotone" dataKey="expense" name="Pengeluaran" stroke={DANGER} fill="url(#gEx)" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </Card>
            </motion.div>

            {/* 3-COLUMN SEGMENT LAYOUT */}
            <motion.div variants={fadeUp} custom={2} style={{ marginBottom: 28 }}>
                <SectionLabel
                    icon={<PieChartOutlined />}
                    title="Analisis Keuangan Per Segmen"
                    subtitle="Pemasukan, pengeluaran, tunggakan & saldo kas per gender & jurusan"
                />
                <Row gutter={[16, 16]}>
                    {availableSegments.map((seg) => {
                        const cfg = SEGMENT_CONFIG[seg];
                        const kpi = kpiMap.get(seg);
                        const expenses = expenseMap.get(seg) || [];
                        const segColor = cfg?.color || GOLD;
                        return (
                            <Col key={seg} xs={24} md={12} lg={8}>
                                <div style={{
                                    borderRadius: 20,
                                    border: `1px solid ${isDark ? "rgba(201,168,76,0.10)" : "rgba(201,168,76,0.12)"}`,
                                    background: token.colorBgContainer,
                                    overflow: "hidden",
                                    height: "100%",
                                }}>
                                    {/* Segment Header */}
                                    <div style={{
                                        padding: "16px 18px 14px",
                                        borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"}`,
                                        display: "flex", alignItems: "center", gap: 10,
                                    }}>
                                        <div style={{
                                            width: 36, height: 36, borderRadius: 10,
                                            background: `linear-gradient(135deg, ${segColor}20 0%, ${segColor}35 100%)`,
                                            border: `1px solid ${segColor}30`,
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            color: segColor, fontSize: 16,
                                        }}>{cfg?.icon || <UserOutlined />}</div>
                                        <div>
                                            <div style={{ fontWeight: 800, fontSize: 14, color: token.colorText, lineHeight: 1.2 }}>
                                                {cfg?.label || seg}
                                            </div>
                                            <div style={{ fontSize: 10, color: segColor, fontWeight: 700, marginTop: 2 }}>
                                                {seg === "P-ALL" ? "Kitab & Tahfidz" : seg.replace("-", " · ")}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Mini KPI Cards */}
                                    <div style={{ padding: "14px 16px 8px", display: "flex", flexDirection: "column", gap: 8 }}>
                                        <MiniKPICard
                                            title="Pemasukan Tunai"
                                            value={kpi?.total_cash_in || 0}
                                            prefix="Rp"
                                            icon={<ArrowUpOutlined />}
                                            color={SUCCESS}
                                            loading={isLoadingFinance}
                                            isDark={isDark}
                                            token={token}
                                        />
                                        <MiniKPICard
                                            title="Pengeluaran"
                                            value={kpi?.total_opex || 0}
                                            prefix="Rp"
                                            icon={<ArrowDownOutlined />}
                                            color={DANGER}
                                            loading={isLoadingFinance}
                                            isDark={isDark}
                                            token={token}
                                        />
                                        <MiniKPICard
                                            title="Tunggakan Piutang"
                                            value={kpi?.total_receivables || 0}
                                            prefix="Rp"
                                            icon={<HistoryOutlined />}
                                            color={GOLD_BRIGHT}
                                            loading={isLoadingFinance}
                                            isDark={isDark}
                                            token={token}
                                        />
                                        <MiniKPICard
                                            title="Saldo Kas"
                                            value={kpi?.surplus_deficit || 0}
                                            prefix="Rp"
                                            icon={<WalletOutlined />}
                                            color={(kpi?.surplus_deficit || 0) >= 0 ? SUCCESS : DANGER}
                                            loading={isLoadingFinance}
                                            isDark={isDark}
                                            token={token}
                                        />
                                    </div>

                                    {/* Pie Chart */}
                                    <div style={{ padding: "6px 8px 12px" }}>
                                        {isLoadingFinance ? (
                                            <Skeleton active style={{ margin: "0 8px" }} />
                                        ) : expenses.length > 0 ? (
                                            <div style={{ width: "100%", height: 200 }}>
                                                <ResponsiveContainer>
                                                    <PieChart>
                                                        <Pie
                                                            data={expenses}
                                                            innerRadius={36}
                                                            outerRadius={68}
                                                            paddingAngle={4}
                                                            dataKey="value"
                                                            label={renderCustomPieLabel}
                                                        >
                                                            {expenses.map((_, i) => (
                                                                <Cell key={i} fill={EXPENSE_PALETTE[i % EXPENSE_PALETTE.length]} />
                                                            ))}
                                                        </Pie>
                                                        <ReTooltip content={<PremiumTooltip token={token} />} />
                                                        <Legend
                                                            verticalAlign="bottom"
                                                            iconSize={8}
                                                            formatter={(val: string) => (
                                                                <span style={{ fontSize: 10, color: token.colorTextSecondary }}>{val}</span>
                                                            )}
                                                        />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </div>
                                        ) : (
                                            <div style={{ padding: "16px 0" }}>
                                                <Empty description="Belum ada data pengeluaran" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Col>
                        );
                    })}
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
                                    <AreaChart data={diklatStats}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                        <XAxis dataKey="name" />
                                        <YAxis yAxisId="left" orientation="left" stroke={GOLD} />
                                        <YAxis yAxisId="right" orientation="right" tickFormatter={fmtRupiah} stroke={SUCCESS} />
                                        <ReTooltip content={<PremiumTooltip token={token} />} />
                                        <Area yAxisId="right" type="monotone" dataKey="Pemasukan" stroke={SUCCESS} fill={SUCCESS} fillOpacity={0.1} />
                                        <Area yAxisId="left" type="monotone" dataKey="Peserta" stroke={GOLD} fill={GOLD} fillOpacity={0.1} />
                                        <Legend verticalAlign="bottom" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </Col>
                </Row>
            </motion.div>
        </motion.div>
    );
};
