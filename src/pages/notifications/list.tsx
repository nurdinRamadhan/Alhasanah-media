import React, { useMemo, useState, useCallback } from "react";
import { useTable, useSelect } from "@refinedev/antd";
import { useList, useNavigation } from "@refinedev/core";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import {
    Tag, Typography, Space, Select, theme, Button, Modal,
    Form, Input, Radio, message, Tooltip, Badge, Skeleton,
    Popconfirm, Card, Row, Col, Statistic, Divider, Alert
} from "antd";
import {
    BellOutlined, CheckCircleOutlined, ClockCircleOutlined,
    CloseCircleOutlined, UserOutlined, NotificationOutlined,
    PlusOutlined, RiseOutlined, FallOutlined, SendOutlined,
    ThunderboltOutlined, TeamOutlined, InfoCircleOutlined,
    ReloadOutlined, BarChartOutlined, FireOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/id";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
    ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { ISantri } from "../../types";
import { supabaseClient } from "../../utility/supabaseClient";

dayjs.extend(relativeTime);
dayjs.locale("id");

const { Text, Title } = Typography;
const { TextArea } = Input;

// ─── Framer Motion Variants ───────────────────────────────────────────────────
const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
        opacity: 1, y: 0,
        transition: { delay: i * 0.08, duration: 0.4, ease: "easeOut" as const }
    })
};

const scaleIn = {
    hidden: { opacity: 0, scale: 0.92 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.35, ease: "easeOut" as const } }
};

// ─── Animated Counter ─────────────────────────────────────────────────────────
const AnimatedNumber: React.FC<{ value: number; duration?: number }> = ({ value, duration = 800 }) => {
    const [display, setDisplay] = React.useState(0);
    React.useEffect(() => {
        let start = 0;
        const step = value / (duration / 16);
        const timer = setInterval(() => {
            start += step;
            if (start >= value) { setDisplay(value); clearInterval(timer); }
            else setDisplay(Math.floor(start));
        }, 16);
        return () => clearInterval(timer);
    }, [value, duration]);
    return <>{display.toLocaleString("id-ID")}</>;
};

// ─── Custom Tooltip for Recharts ──────────────────────────────────────────────
const CustomAreaTooltip = ({ active, payload, label, token }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: token.colorBgElevated, border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 10, padding: "10px 14px", boxShadow: token.boxShadow,
            fontSize: 12, minWidth: 140
        }}>
            <p style={{ color: token.colorTextDescription, margin: "0 0 6px" }}>{label}</p>
            {payload.map((p: any) => (
                <p key={p.name} style={{ color: p.color, margin: "2px 0", fontWeight: 600 }}>
                    {p.name}: <span style={{ color: token.colorText }}>{p.value}</span>
                </p>
            ))}
        </div>
    );
};

// ─── KPI Card Component ───────────────────────────────────────────────────────
interface KpiCardProps {
    title: string; value: number; icon: React.ReactNode;
    color: string; bgGradient: string; trend?: number;
    subtitle?: string; loading?: boolean; index: number;
    token: any;
}
const KpiCard: React.FC<KpiCardProps> = ({ title, value, icon, color, bgGradient, trend, subtitle, loading, index, token }) => (
    <motion.div custom={index} variants={fadeUp} initial="hidden" animate="visible">
        <Card
            bordered={false}
            style={{
                borderRadius: 16,
                overflow: "hidden",
                background: token.colorBgContainer,
                boxShadow: `0 1px 3px ${token.colorFillSecondary}, 0 8px 24px ${token.colorFillSecondary}`,
                border: `1px solid ${token.colorBorderSecondary}`,
                position: "relative",
            }}
            bodyStyle={{ padding: "20px 24px" }}
        >
            {/* Accent glow top-right */}
            <div style={{
                position: "absolute", top: -20, right: -20, width: 90, height: 90,
                borderRadius: "50%", background: bgGradient, opacity: 0.15, pointerEvents: "none"
            }} />
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: token.colorTextDescription, fontWeight: 500, letterSpacing: 0.5, textTransform: "uppercase" }}>
                        {title}
                    </Text>
                    {loading ? (
                        <Skeleton.Input active size="large" style={{ width: 80, marginTop: 8 }} />
                    ) : (
                        <div style={{ fontSize: 28, fontWeight: 800, color: token.colorText, lineHeight: 1.2, marginTop: 4 }}>
                            <AnimatedNumber value={value} />
                        </div>
                    )}
                    {subtitle && (
                        <Text style={{ fontSize: 11, color: token.colorTextDescription, marginTop: 4, display: "block" }}>
                            {subtitle}
                        </Text>
                    )}
                    {trend !== undefined && !loading && (
                        <Space size={4} style={{ marginTop: 8 }}>
                            {trend >= 0
                                ? <RiseOutlined style={{ color: "#10b981", fontSize: 12 }} />
                                : <FallOutlined style={{ color: "#ef4444", fontSize: 12 }} />
                            }
                            <Text style={{ fontSize: 11, color: trend >= 0 ? "#10b981" : "#ef4444", fontWeight: 600 }}>
                                {Math.abs(trend)}% vs kemarin
                            </Text>
                        </Space>
                    )}
                </div>
                <div style={{
                    width: 46, height: 46, borderRadius: 12,
                    background: bgGradient, display: "flex",
                    alignItems: "center", justifyContent: "center",
                    fontSize: 20, color: "#fff", flexShrink: 0,
                    boxShadow: `0 4px 12px ${color}55`
                }}>
                    {icon}
                </div>
            </div>
        </Card>
    </motion.div>
);

// ─── Status Config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
    sent: {
        color: "#10b981", bg: "#d1fae5", darkBg: "#064e3b",
        icon: <CheckCircleOutlined />, label: "Terkirim", dot: "success" as const
    },
    pending: {
        color: "#f59e0b", bg: "#fef3c7", darkBg: "#451a03",
        icon: <ClockCircleOutlined />, label: "Menunggu", dot: "warning" as const
    },
    failed: {
        color: "#ef4444", bg: "#fee2e2", darkBg: "#450a0a",
        icon: <CloseCircleOutlined />, label: "Gagal", dot: "error" as const
    },
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const NotificationList = () => {
    const { token } = theme.useToken();
    const isDark = token.colorBgBase === "#000" || token.colorBgContainer === "rgb(22,22,22)"
        || Number(token.colorBgBase?.replace?.(/[^0-9,]/g, "")?.split(",")?.[0] ?? 255) < 50;

    const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
    const [broadcastStep, setBroadcastStep] = useState<"compose" | "preview">("compose");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [broadcastForm] = Form.useForm();
    const [previewData, setPreviewData] = useState<any>(null);
    const { push } = useNavigation();

    // ── Data Fetching ──────────────────────────────────────────────────────────
    const { tableProps, tableQueryResult } = useTable({
        resource: "notification_queue",
        sorters: { initial: [{ field: "created_at", order: "desc" }] },
        onSearch: (params: any) => {
            const filters: any[] = [];
            if (params.created_at) {
                filters.push(
                    { field: "created_at", operator: "gte", value: dayjs(params.created_at[0]).startOf("day").toISOString() },
                    { field: "created_at", operator: "lte", value: dayjs(params.created_at[1]).endOf("day").toISOString() }
                );
            }
            if (params.user_id) filters.push({ field: "user_id", operator: "eq", value: params.user_id });
            if (params.status) filters.push({ field: "status", operator: "eq", value: params.status });
            return filters;
        },
    });

    const { selectProps: santriSelectProps } = useSelect<ISantri>({
        resource: "santri",
        optionLabel: "nama",
        optionValue: "wali_id",
        meta: { select: "nama, nis, wali_id, kelas, jurusan, status_santri" },
        pagination: { pageSize: 500 },
    });

    const { data: profilesData, isLoading: profilesLoading } = useList<any>({
        resource: "profiles",
        pagination: { pageSize: 500 },
    });

    // Fetch all notifications (lightweight) for KPI & Charts
    const { data: allData, isLoading: statsLoading, refetch: refetchStats } = useList<any>({
        resource: "notification_queue",
        pagination: { pageSize: 2000 },
        sorters: [{ field: "created_at", order: "desc" }],
        meta: { select: "id, status, created_at, source_table" },
    });

    // ── KPI Calculations ───────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const all = allData?.data ?? [];
        const total = all.length;
        const sent = all.filter(n => n.status === "sent").length;
        const failed = all.filter(n => n.status === "failed").length;
        const pending = all.filter(n => n.status === "pending").length;
        const deliveryRate = total > 0 ? Math.round((sent / total) * 100) : 0;

        // Yesterday stats for trend
        const yesterday = dayjs().subtract(1, "day").startOf("day");
        const yesterdayEnd = dayjs().subtract(1, "day").endOf("day");
        const yesterdayAll = all.filter(n => dayjs(n.created_at).isBetween?.(yesterday, yesterdayEnd));
        const todayAll = all.filter(n => dayjs(n.created_at).isAfter(dayjs().startOf("day")));
        const todaySent = todayAll.filter(n => n.status === "sent").length;

        return { total, sent, failed, pending, deliveryRate, todaySent, todayTotal: todayAll.length };
    }, [allData]);

    // ── Chart Data: Last 7 days ────────────────────────────────────────────────
    const chartData = useMemo(() => {
        const all = allData?.data ?? [];
        return Array.from({ length: 7 }, (_, i) => {
            const day = dayjs().subtract(6 - i, "day");
            const dayStart = day.startOf("day").toISOString();
            const dayEnd = day.endOf("day").toISOString();
            const dayItems = all.filter(n => n.created_at >= dayStart && n.created_at <= dayEnd);
            return {
                day: day.format("ddd, DD/MM"),
                Terkirim: dayItems.filter(n => n.status === "sent").length,
                Gagal: dayItems.filter(n => n.status === "failed").length,
                Menunggu: dayItems.filter(n => n.status === "pending").length,
                total: dayItems.length,
            };
        });
    }, [allData]);

    // ── Donut Chart Data ───────────────────────────────────────────────────────
    const pieData = useMemo(() => [
        { name: "Terkirim", value: stats.sent, color: "#10b981" },
        { name: "Menunggu", value: stats.pending, color: "#f59e0b" },
        { name: "Gagal", value: stats.failed, color: "#ef4444" },
    ].filter(d => d.value > 0), [stats]);

    // ── Broadcast Handler ──────────────────────────────────────────────────────
    const handlePreview = (values: any) => {
        setPreviewData(values);
        setBroadcastStep("preview");
    };

    const handleBroadcast = async () => {
        setIsSubmitting(true);
        try {
            const { data, error } = await supabaseClient.rpc("broadcast_notification_v3", {
                p_title: previewData.title,
                p_body: previewData.body,
                p_target_kelas: previewData.target,
                p_source: "broadcast_admin",
            });
            if (error) throw error;
            message.success({
                content: `✅ Berhasil membuat ${data[0]?.inserted_count ?? 0} antrean notifikasi!`,
                duration: 4,
            });
            setIsBroadcastModalOpen(false);
            setBroadcastStep("compose");
            broadcastForm.resetFields();
            setPreviewData(null);
            tableQueryResult.refetch();
            refetchStats();
        } catch (err: any) {
            message.error("Gagal melakukan broadcast: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const profileMap = useMemo(() => {
        const map: Record<string, string> = {};
        profilesData?.data?.forEach(p => { map[p.id] = p.full_name; });
        return map;
    }, [profilesData]);

    const santriMap = useMemo(() => {
        const map: Record<string, string> = {};
        santriSelectProps.options?.forEach((o: any) => { map[String(o.value)] = String(o.label); });
        return map;
    }, [santriSelectProps.options]);

    // ── Table Columns ──────────────────────────────────────────────────────────
    const columns: ProColumns<any>[] = [
        {
            title: "Waktu",
            dataIndex: "created_at",
            valueType: "dateRange",
            width: 140,
            sorter: true,
            fieldProps: { placeholder: ["Dari", "Sampai"] },
            search: {
                transform: (value) => ({
                    created_at: [
                        dayjs(value[0]).startOf("day").toISOString(),
                        dayjs(value[1]).endOf("day").toISOString(),
                    ]
                })
            },
            render: (_, record) => (
                <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: token.colorText }}>
                        {dayjs(record.created_at).format("DD MMM YYYY")}
                    </div>
                    <div style={{ fontSize: 11, color: token.colorTextDescription, marginTop: 2 }}>
                        {dayjs(record.created_at).format("HH:mm")} · {dayjs(record.created_at).fromNow()}
                    </div>
                </div>
            ),
        },
        {
            title: "Penerima",
            dataIndex: "user_id",
            width: 200,
            ellipsis: true,
            renderFormItem: () => (
                <Select {...santriSelectProps} showSearch allowClear placeholder="Cari santri..." />
            ),
            render: (_, record) => {
                const name = profileMap[record.user_id];
                const santriName = santriMap[record.user_id];
                return (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                            width: 34, height: 34, borderRadius: 10,
                            background: `linear-gradient(135deg, ${token.colorPrimary}33, ${token.colorPrimary}66)`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 14, fontWeight: 700, color: token.colorPrimary, flexShrink: 0,
                        }}>
                            {(name || "?")[0]?.toUpperCase()}
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: token.colorText, lineHeight: 1.3 }}>
                                {profilesLoading ? <Skeleton.Input size="small" active style={{ width: 90 }} />
                                    : (name || <span style={{ color: token.colorTextDisabled, fontStyle: "italic" }}>Tidak ditemukan</span>)}
                            </div>
                            <div style={{ fontSize: 11, color: token.colorTextDescription, lineHeight: 1.2, marginTop: 1 }}>
                                {santriName || "Umum / Broadcast"}
                            </div>
                        </div>
                    </div>
                );
            },
        },
        {
            title: "Notifikasi",
            dataIndex: "title",
            hideInSearch: true,
            render: (_, record) => (
                <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: token.colorText, marginBottom: 6, lineHeight: 1.3 }}>
                        {record.title}
                    </div>
                    <div style={{
                        background: isDark ? token.colorFillSecondary : token.colorFillAlter,
                        borderLeft: `3px solid ${token.colorPrimary}`,
                        padding: "8px 12px", borderRadius: "0 8px 8px 0",
                        fontSize: 12, color: token.colorTextDescription,
                        lineHeight: 1.6, whiteSpace: "pre-wrap",
                        maxHeight: 60, overflow: "hidden",
                    }}>
                        {record.body}
                    </div>
                </div>
            ),
        },
        {
            title: "Status",
            dataIndex: "status",
            width: 120,
            valueEnum: {
                pending: { text: "Menunggu", status: "Default" },
                sent: { text: "Terkirim", status: "Success" },
                failed: { text: "Gagal", status: "Error" },
            },
            render: (_, record) => {
                const cfg = STATUS_CONFIG[record.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
                return (
                    <Tooltip title={record.status === "failed" ? record.error_message : undefined}>
                        <Tag
                            icon={cfg.icon}
                            style={{
                                borderRadius: 20, padding: "3px 12px",
                                background: isDark ? cfg.darkBg : cfg.bg,
                                color: cfg.color, border: `1px solid ${cfg.color}44`,
                                fontWeight: 600, fontSize: 11, display: "inline-flex",
                                alignItems: "center", gap: 5
                            }}
                        >
                            {cfg.label}
                        </Tag>
                    </Tooltip>
                );
            },
        },
        {
            title: "Sumber",
            dataIndex: "source_table",
            width: 110,
            hideInSearch: true,
            render: (val) => {
                const labels: Record<string, { label: string; color: string }> = {
                    broadcast_admin: { label: "Broadcast", color: "purple" },
                    pembayaran: { label: "Pembayaran", color: "blue" },
                    absensi: { label: "Absensi", color: "cyan" },
                    manual: { label: "Manual", color: "geekblue" },
                };
                const cfg = labels[val as keyof typeof labels] ?? { label: val || "Manual", color: "default" };
                return (
                    <Tag color={cfg.color} style={{ fontSize: 10, borderRadius: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>
                        {cfg.label}
                    </Tag>
                );
            },
        },
    ];

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div style={{ padding: "0 0 40px", minHeight: "100vh", background: token.colorBgLayout }}>

            {/* ── Page Header ─────────────────────────────────────────────────── */}
            <motion.div variants={fadeUp} custom={0} initial="hidden" animate="visible"
                style={{
                    padding: "24px 24px 0",
                    marginBottom: 24,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    flexWrap: "wrap", gap: 12,
                }}
            >
                <div>
                    <Space size={10} align="center">
                        <div style={{
                            width: 40, height: 40, borderRadius: 12,
                            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            boxShadow: "0 4px 14px #6366f155", fontSize: 20, color: "#fff"
                        }}>
                            <BellOutlined />
                        </div>
                        <div>
                            <Title level={4} style={{ margin: 0, lineHeight: 1.1, fontSize: 20 }}>
                                Pusat Notifikasi
                            </Title>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                Monitoring & manajemen antrean pengiriman notifikasi
                            </Text>
                        </div>
                    </Space>
                </div>
                <Space>
                    <Tooltip title="Refresh data">
                        <Button icon={<ReloadOutlined />} onClick={() => { tableQueryResult.refetch(); refetchStats(); }} />
                    </Tooltip>
                    <Button
                        icon={<NotificationOutlined />}
                        danger
                        onClick={() => { setBroadcastStep("compose"); setIsBroadcastModalOpen(true); }}
                        style={{ fontWeight: 600 }}
                    >
                        Broadcast Masal
                    </Button>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => push("/notifications/create")}
                        style={{
                            fontWeight: 600,
                            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                            border: "none", boxShadow: "0 4px 12px #6366f155"
                        }}
                    >
                        Kirim Notifikasi
                    </Button>
                </Space>
            </motion.div>

            <div style={{ padding: "0 24px" }}>

                {/* ── KPI Cards ──────────────────────────────────────────────── */}
                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                    {[
                        {
                            title: "Total Notifikasi",
                            value: stats.total,
                            icon: <BellOutlined />,
                            color: "#6366f1",
                            bgGradient: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                            subtitle: `${stats.todayTotal} dikirim hari ini`,
                        },
                        {
                            title: "Berhasil Terkirim",
                            value: stats.sent,
                            icon: <CheckCircleOutlined />,
                            color: "#10b981",
                            bgGradient: "linear-gradient(135deg, #10b981, #059669)",
                            trend: stats.todayTotal > 0 ? Math.round((stats.todaySent / stats.todayTotal) * 100) - 70 : 0,
                            subtitle: `${stats.deliveryRate}% delivery rate`,
                        },
                        {
                            title: "Menunggu Kirim",
                            value: stats.pending,
                            icon: <ClockCircleOutlined />,
                            color: "#f59e0b",
                            bgGradient: "linear-gradient(135deg, #f59e0b, #d97706)",
                            subtitle: "Dalam antrean sistem",
                        },
                        {
                            title: "Gagal Terkirim",
                            value: stats.failed,
                            icon: <CloseCircleOutlined />,
                            color: "#ef4444",
                            bgGradient: "linear-gradient(135deg, #ef4444, #dc2626)",
                            subtitle: stats.failed > 0 ? "⚠️ Perlu perhatian" : "Tidak ada masalah",
                        },
                    ].map((kpi, i) => (
                        <Col xs={24} sm={12} lg={6} key={kpi.title}>
                            <KpiCard {...kpi} loading={statsLoading} index={i} token={token} />
                        </Col>
                    ))}
                </Row>

                {/* ── Delivery Rate Alert ─────────────────────────────────────── */}
                <AnimatePresence>
                    {stats.failed > 10 && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ marginBottom: 16 }}>
                            <Alert
                                type="warning" showIcon
                                message={`${stats.failed} notifikasi gagal terkirim — harap periksa koneksi FCM atau validitas token perangkat penerima.`}
                                style={{ borderRadius: 10 }}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Charts Row ──────────────────────────────────────────────── */}
                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                    {/* Area Chart */}
                    <Col xs={24} lg={16}>
                        <motion.div variants={scaleIn} initial="hidden" animate="visible">
                            <Card
                                bordered={false}
                                style={{
                                    borderRadius: 16,
                                    border: `1px solid ${token.colorBorderSecondary}`,
                                    boxShadow: `0 1px 3px ${token.colorFillSecondary}`,
                                    height: "100%"
                                }}
                                bodyStyle={{ padding: "20px 20px 12px" }}
                            >
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                                    <div>
                                        <Space size={8}>
                                            <BarChartOutlined style={{ color: token.colorPrimary }} />
                                            <Text strong style={{ fontSize: 14 }}>Tren Pengiriman 7 Hari Terakhir</Text>
                                        </Space>
                                        <div style={{ fontSize: 12, color: token.colorTextDescription, marginTop: 2 }}>
                                            Volume harian per status notifikasi
                                        </div>
                                    </div>
                                </div>
                                {statsLoading ? (
                                    <Skeleton active paragraph={{ rows: 4 }} />
                                ) : (
                                    <ResponsiveContainer width="100%" height={200}>
                                        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="gradSent" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="gradFailed" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="gradPending" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke={token.colorBorderSecondary} vertical={false} />
                                            <XAxis dataKey="day" tick={{ fontSize: 10, fill: token.colorTextDescription }} axisLine={false} tickLine={false} />
                                            <YAxis tick={{ fontSize: 10, fill: token.colorTextDescription }} axisLine={false} tickLine={false} allowDecimals={false} />
                                            <ReTooltip content={(p) => <CustomAreaTooltip {...p} token={token} />} />
                                            <Area type="monotone" dataKey="Terkirim" stroke="#10b981" fill="url(#gradSent)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                                            <Area type="monotone" dataKey="Gagal" stroke="#ef4444" fill="url(#gradFailed)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                                            <Area type="monotone" dataKey="Menunggu" stroke="#f59e0b" fill="url(#gradPending)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                )}
                                {/* Legend */}
                                <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8 }}>
                                    {[
                                        { label: "Terkirim", color: "#10b981" },
                                        { label: "Gagal", color: "#ef4444" },
                                        { label: "Menunggu", color: "#f59e0b" },
                                    ].map(l => (
                                        <Space key={l.label} size={6}>
                                            <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color }} />
                                            <Text style={{ fontSize: 11, color: token.colorTextDescription }}>{l.label}</Text>
                                        </Space>
                                    ))}
                                </div>
                            </Card>
                        </motion.div>
                    </Col>

                    {/* Donut Chart + Delivery Rate */}
                    <Col xs={24} lg={8}>
                        <motion.div variants={scaleIn} initial="hidden" animate="visible" style={{ height: "100%" }}>
                            <Card
                                bordered={false}
                                style={{
                                    borderRadius: 16,
                                    border: `1px solid ${token.colorBorderSecondary}`,
                                    boxShadow: `0 1px 3px ${token.colorFillSecondary}`,
                                    height: "100%"
                                }}
                                bodyStyle={{ padding: "20px" }}
                            >
                                <Space size={8} style={{ marginBottom: 4 }}>
                                    <FireOutlined style={{ color: "#f59e0b" }} />
                                    <Text strong style={{ fontSize: 14 }}>Distribusi Status</Text>
                                </Space>
                                <div style={{ fontSize: 12, color: token.colorTextDescription, marginBottom: 12 }}>
                                    Komposisi antrean keseluruhan
                                </div>
                                {statsLoading ? (
                                    <Skeleton active paragraph={{ rows: 3 }} />
                                ) : pieData.length > 0 ? (
                                    <>
                                        <ResponsiveContainer width="100%" height={160}>
                                            <PieChart>
                                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                                                    paddingAngle={3} dataKey="value" stroke="none">
                                                    {pieData.map((entry, index) => (
                                                        <Cell key={index} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <ReTooltip
                                                    formatter={(value: any, name: any) => [`${value} notif`, name]}
                                                    contentStyle={{
                                                        background: token.colorBgElevated,
                                                        border: `1px solid ${token.colorBorderSecondary}`,
                                                        borderRadius: 8, fontSize: 12
                                                    }}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                                            {pieData.map(d => (
                                                <div key={d.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                                    <Space size={6}>
                                                        <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color }} />
                                                        <Text style={{ fontSize: 12, color: token.colorTextDescription }}>{d.name}</Text>
                                                    </Space>
                                                    <Space size={8}>
                                                        <Text style={{ fontSize: 12, fontWeight: 700, color: d.color }}>{d.value}</Text>
                                                        <Text style={{ fontSize: 10, color: token.colorTextDescription }}>
                                                            ({stats.total > 0 ? Math.round((d.value / stats.total) * 100) : 0}%)
                                                        </Text>
                                                    </Space>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Delivery rate bar */}
                                        <Divider style={{ margin: "12px 0" }} />
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                            <Text style={{ fontSize: 11, color: token.colorTextDescription }}>Delivery Rate</Text>
                                            <Text style={{ fontSize: 13, fontWeight: 800, color: stats.deliveryRate >= 80 ? "#10b981" : "#ef4444" }}>
                                                {stats.deliveryRate}%
                                            </Text>
                                        </div>
                                        <div style={{ height: 6, background: token.colorFillSecondary, borderRadius: 3, overflow: "hidden" }}>
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${stats.deliveryRate}%` }}
                                                transition={{ duration: 1, ease: "easeOut", delay: 0.4 }}
                                                style={{
                                                    height: "100%", borderRadius: 3,
                                                    background: stats.deliveryRate >= 80
                                                        ? "linear-gradient(90deg, #10b981, #059669)"
                                                        : "linear-gradient(90deg, #ef4444, #dc2626)"
                                                }}
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ textAlign: "center", padding: "30px 0", color: token.colorTextDescription }}>
                                        Belum ada data
                                    </div>
                                )}
                            </Card>
                        </motion.div>
                    </Col>
                </Row>

                {/* ── Main Table ───────────────────────────────────────────────── */}
                <motion.div variants={fadeUp} custom={5} initial="hidden" animate="visible">
                    <ProTable
                        {...tableProps}
                        columns={columns}
                        rowKey="id"
                        search={{
                            labelWidth: "auto",
                            defaultCollapsed: false,
                            searchText: "Terapkan Filter",
                            resetText: "Reset",
                            span: { xs: 24, sm: 12, md: 8, lg: 6, xl: 6, xxl: 6 },
                        }}
                        headerTitle={
                            <Space size={8}>
                                <Badge
                                    count={stats.pending}
                                    overflowCount={999}
                                    style={{ background: "#f59e0b" }}
                                >
                                    <div style={{
                                        width: 32, height: 32, borderRadius: 8,
                                        background: `${token.colorPrimary}15`,
                                        display: "flex", alignItems: "center",
                                        justifyContent: "center", fontSize: 16, color: token.colorPrimary
                                    }}>
                                        <SendOutlined />
                                    </div>
                                </Badge>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>Antrean Notifikasi</div>
                                    <div style={{ fontSize: 11, color: token.colorTextDescription, fontWeight: 400 }}>
                                        {tableProps.dataSource?.length ?? 0} data ditampilkan
                                    </div>
                                </div>
                            </Space>
                        }
                        toolBarRender={() => []}
                        options={{
                            density: true,
                            fullScreen: true,
                            reload: () => { tableQueryResult.refetch(); refetchStats(); },
                        }}
                        pagination={{
                            defaultPageSize: 10,
                            showSizeChanger: true,
                            showTotal: (total) => (
                                <Text type="secondary" style={{ fontSize: 12 }}>Total {total} notifikasi</Text>
                            ),
                        }}
                        rowClassName={(record) => {
                            if (record.status === "failed") return "notification-row-failed";
                            if (record.status === "pending") return "notification-row-pending";
                            return "";
                        }}
                        onRow={(record) => ({
                            style: {
                                borderLeft: record.status === "failed"
                                    ? "3px solid #ef4444"
                                    : record.status === "pending"
                                        ? "3px solid #f59e0b"
                                        : "3px solid transparent",
                            }
                        })}
                        expandable={{
                            expandedRowRender: (record) => (
                                <div style={{
                                    padding: "12px 16px",
                                    background: isDark ? token.colorFillSecondary : "#f8fafc",
                                    borderRadius: 8, margin: "0 0 8px 0"
                                }}>
                                    <Row gutter={24}>
                                        <Col span={12}>
                                            <Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>ID Notifikasi</Text>
                                            <div style={{ fontFamily: "monospace", fontSize: 12, marginTop: 4, color: token.colorTextDescription }}>{record.id}</div>
                                        </Col>
                                        <Col span={12}>
                                            <Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>Pesan Lengkap</Text>
                                            <div style={{ fontSize: 13, marginTop: 4, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{record.body}</div>
                                        </Col>
                                    </Row>
                                </div>
                            ),
                            rowExpandable: () => true,
                        }}
                        style={{
                            borderRadius: 16,
                            overflow: "hidden",
                            border: `1px solid ${token.colorBorderSecondary}`,
                            boxShadow: `0 1px 3px ${token.colorFillSecondary}`,
                        }}
                        cardProps={{ bodyStyle: { padding: 0 } }}
                    />
                </motion.div>
            </div>

            {/* ── Broadcast Modal ──────────────────────────────────────────────── */}
            <Modal
                open={isBroadcastModalOpen}
                onCancel={() => { setIsBroadcastModalOpen(false); setBroadcastStep("compose"); setPreviewData(null); }}
                footer={null}
                centered
                width={520}
                destroyOnClose
                styles={{
                    content: { borderRadius: 20, padding: 0, overflow: "hidden" },
                    body: { padding: 0 }
                }}
            >
                {/* Modal Header */}
                <div style={{
                    padding: "24px 28px 20px",
                    background: "linear-gradient(135deg, #7c3aed, #6366f1)",
                    color: "#fff"
                }}>
                    <Space size={12} align="center">
                        <div style={{
                            width: 44, height: 44, borderRadius: 12,
                            background: "rgba(255,255,255,0.2)",
                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22
                        }}>
                            <ThunderboltOutlined />
                        </div>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.2 }}>Broadcast Masal</div>
                            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
                                {broadcastStep === "compose" ? "Tulis pesan untuk semua penerima" : "Konfirmasi sebelum mengirim"}
                            </div>
                        </div>
                    </Space>
                    {/* Steps */}
                    <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                        {["Tulis Pesan", "Konfirmasi"].map((step, i) => (
                            <div key={step} style={{
                                flex: 1, height: 3, borderRadius: 2,
                                background: i === 0 || broadcastStep === "preview"
                                    ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)"
                            }} />
                        ))}
                    </div>
                </div>

                <div style={{ padding: "24px 28px" }}>
                    <AnimatePresence mode="wait">
                        {broadcastStep === "compose" ? (
                            <motion.div key="compose" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                                <Form
                                    form={broadcastForm}
                                    layout="vertical"
                                    onFinish={handlePreview}
                                    initialValues={{ target: "ALL" }}
                                >
                                    <Form.Item name="target" label={<Text strong>Target Penerima</Text>} rules={[{ required: true }]}>
                                        <Radio.Group buttonStyle="solid" style={{ width: "100%" }}>
                                            <Space wrap>
                                                <Radio.Button value="ALL">
                                                    <Space size={4}><TeamOutlined />Semua Wali</Space>
                                                </Radio.Button>
                                                <Radio.Button value="1">Kelas 1</Radio.Button>
                                                <Radio.Button value="2">Kelas 2</Radio.Button>
                                                <Radio.Button value="3">Kelas 3</Radio.Button>
                                            </Space>
                                        </Radio.Group>
                                    </Form.Item>
                                    <Form.Item name="title" label={<Text strong>Judul Notifikasi</Text>}
                                        rules={[{ required: true, message: "Judul wajib diisi" }]}>
                                        <Input placeholder="Contoh: Pengumuman Libur Ramadhan" size="large" style={{ borderRadius: 10 }} />
                                    </Form.Item>
                                    <Form.Item name="body" label={<Text strong>Isi Pesan</Text>}
                                        rules={[{ required: true, message: "Pesan wajib diisi" }]}>
                                        <TextArea rows={4} placeholder="Tulis pesan yang jelas dan informatif..." style={{ borderRadius: 10 }} />
                                    </Form.Item>
                                    <div style={{
                                        background: isDark ? token.colorFillSecondary : "#eff6ff",
                                        border: `1px solid ${isDark ? token.colorBorderSecondary : "#bfdbfe"}`,
                                        borderRadius: 10, padding: "10px 14px",
                                        display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 20
                                    }}>
                                        <InfoCircleOutlined style={{ color: "#3b82f6", marginTop: 2, flexShrink: 0 }} />
                                        <Text style={{ fontSize: 12, color: isDark ? token.colorTextDescription : "#1d4ed8" }}>
                                            Notifikasi akan masuk ke antrean dan dikirim secara bertahap. Cek kembali sebelum konfirmasi.
                                        </Text>
                                    </div>
                                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                                        <Button onClick={() => setIsBroadcastModalOpen(false)}>Batal</Button>
                                        <Button type="primary" htmlType="submit" icon={<SendOutlined />}
                                            style={{ background: "linear-gradient(135deg, #7c3aed, #6366f1)", border: "none" }}>
                                            Lanjut ke Preview
                                        </Button>
                                    </div>
                                </Form>
                            </motion.div>
                        ) : (
                            <motion.div key="preview" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                {/* Preview Card */}
                                <div style={{
                                    background: isDark ? token.colorFillSecondary : "#f8fafc",
                                    borderRadius: 12, padding: "16px",
                                    border: `1px solid ${token.colorBorderSecondary}`,
                                    marginBottom: 16
                                }}>
                                    <div style={{ fontSize: 11, color: token.colorTextDescription, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
                                        Preview Notifikasi
                                    </div>
                                    <div style={{
                                        background: token.colorBgContainer, borderRadius: 10,
                                        padding: "14px", border: `1px solid ${token.colorBorderSecondary}`
                                    }}>
                                        <Space size={10}>
                                            <div style={{
                                                width: 36, height: 36, borderRadius: 10,
                                                background: "linear-gradient(135deg, #7c3aed, #6366f1)",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                fontSize: 18, color: "#fff"
                                            }}>🔔</div>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: 13 }}>{previewData?.title}</div>
                                                <div style={{ fontSize: 11, color: token.colorTextDescription }}>Al-Hasanah Admin · Baru saja</div>
                                            </div>
                                        </Space>
                                        <div style={{ fontSize: 13, color: token.colorTextDescription, marginTop: 10, lineHeight: 1.6 }}>
                                            {previewData?.body}
                                        </div>
                                    </div>
                                    <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                                        <Tag color="purple">
                                            Target: {previewData?.target === "ALL" ? "Semua Wali" : `Kelas ${previewData?.target}`}
                                        </Tag>
                                        <Tag color="blue">Sumber: broadcast_admin</Tag>
                                    </div>
                                </div>

                                <Alert
                                    type="warning" showIcon
                                    message="Aksi ini tidak dapat dibatalkan setelah dikirim."
                                    style={{ borderRadius: 10, marginBottom: 20, fontSize: 12 }}
                                />

                                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                                    <Button onClick={() => setBroadcastStep("compose")}>← Kembali</Button>
                                    <Popconfirm
                                        title="Kirim Broadcast?"
                                        description={`Notifikasi akan dikirim ke ${previewData?.target === "ALL" ? "semua wali" : `wali kelas ${previewData?.target}`}. Lanjutkan?`}
                                        onConfirm={handleBroadcast}
                                        okText="Ya, Kirim!"
                                        cancelText="Tunda"
                                        okButtonProps={{ danger: true, loading: isSubmitting }}
                                    >
                                        <Button
                                            type="primary" danger icon={<ThunderboltOutlined />}
                                            loading={isSubmitting}
                                            style={{ fontWeight: 600 }}
                                        >
                                            Kirim Sekarang
                                        </Button>
                                    </Popconfirm>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </Modal>
        </div>
    );
};
