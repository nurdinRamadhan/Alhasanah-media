import React from "react";
import { useOne } from "@refinedev/core";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import { Typography, Card, Row, Col, Avatar, Tag, Button, Statistic, Divider, Spin, Space, theme, Tooltip, Badge } from "antd";
import {
    ReadOutlined,
    HistoryOutlined,
    DownloadOutlined,
    ArrowLeftOutlined,
    StarFilled,
    CalendarOutlined,
    BookOutlined,
    TrophyOutlined,
    RiseOutlined,
    FireOutlined,
} from "@ant-design/icons";
import { ISantri } from "../../types";
import { useNavigate, useParams } from "react-router-dom";
import { formatFullDate, formatDualDate, formatMasehi } from "../../utility/dateHelper";
import { supabaseClient } from "../../utility/supabaseClient";
import { santriAlias } from "../../utility/privacy";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as ReTooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell,
} from "recharts";

const { Title, Text } = Typography;
const { useToken } = theme;

// ─────────────────────────── Types ───────────────────────────
type HafalanRow = {
    id: number;
    tanggal: string | null;
    surat: string | null;
    ayat_awal: number | null;
    ayat_akhir: number | null;
    juz: number | null;
    total_hafalan: number | null;
    status: string | null;
    predikat: string | null;
    catatan: string | null;
    status_setoran: string | null;
    alasan_tolak: string | null;
};

type HafalanSummary = {
    total_count: number;
    latest: HafalanRow | null;
    all_rows: HafalanRow[];
};

// ─────────────────────────── Helpers ───────────────────────────
const formatAyat = (item: HafalanRow) => {
    if (item.ayat_awal && item.ayat_akhir) return `${item.ayat_awal}–${item.ayat_akhir}`;
    return "–";
};

const PREDIKAT_CONFIG: Record<string, { color: string; bg: string; darkBg: string; icon: React.ReactNode }> = {
    MUMTAZ:   { color: "#D97706", bg: "#FEF3C7", darkBg: "#451A03", icon: <StarFilled style={{ fontSize: 10 }} /> },
    JAYYID:   { color: "#059669", bg: "#D1FAE5", darkBg: "#022C22", icon: <TrophyOutlined style={{ fontSize: 10 }} /> },
    MAQBUL:   { color: "#2563EB", bg: "#DBEAFE", darkBg: "#1E3A5F", icon: <BookOutlined style={{ fontSize: 10 }} /> },
    KURANG:   { color: "#DC2626", bg: "#FEE2E2", darkBg: "#450A0A", icon: <FireOutlined style={{ fontSize: 10 }} /> },
};
const getPredikat = (p: string | null) => PREDIKAT_CONFIG[p ?? ""] ?? { color: "#6B7280", bg: "#F3F4F6", darkBg: "#1F2937", icon: null };

// ─────────────────────────── Juz Grid ───────────────────────────
const JuzGrid: React.FC<{ completedJuz: number; isDark: boolean }> = ({ completedJuz, isDark }) => {
    const cells = Array.from({ length: 30 }, (_, i) => i + 1);
    return (
        <div>
            <Text style={{ fontSize: 11, color: isDark ? "#94A3B8" : "#64748B", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Progress Juz
            </Text>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 4, marginTop: 8 }}>
                {cells.map((juz) => {
                    const done = juz <= completedJuz;
                    const isCurrent = juz === completedJuz;
                    return (
                        <Tooltip key={juz} title={`Juz ${juz}`}>
                            <div
                                style={{
                                    aspectRatio: "1",
                                    borderRadius: 4,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 9,
                                    fontWeight: 600,
                                    cursor: "default",
                                    transition: "all 0.2s",
                                    background: done
                                        ? isCurrent
                                            ? "linear-gradient(135deg, #D97706, #F59E0B)"
                                            : "linear-gradient(135deg, #047857, #10B981)"
                                        : isDark ? "#1E293B" : "#F1F5F9",
                                    color: done ? "#fff" : isDark ? "#334155" : "#CBD5E1",
                                    boxShadow: isCurrent ? "0 0 8px rgba(217,119,6,0.6)" : done ? "0 1px 3px rgba(4,120,87,0.3)" : "none",
                                    border: isCurrent ? "1.5px solid #F59E0B" : "none",
                                }}
                            >
                                {juz}
                            </div>
                        </Tooltip>
                    );
                })}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 8, alignItems: "center" }}>
                {[
                    { color: "#047857", label: "Selesai" },
                    { color: "#D97706", label: "Posisi Kini" },
                    { color: isDark ? "#1E293B" : "#F1F5F9", label: "Belum", border: true },
                ].map(({ color, label, border }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: color, border: border ? `1px solid ${isDark ? "#334155" : "#CBD5E1"}` : "none" }} />
                        <Text style={{ fontSize: 10, color: isDark ? "#94A3B8" : "#64748B" }}>{label}</Text>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─────────────────────────── KPI Card ───────────────────────────
const KPICard: React.FC<{
    label: string;
    value: React.ReactNode;
    sub?: React.ReactNode;
    icon: React.ReactNode;
    accent: string;
    isDark: boolean;
}> = ({ label, value, sub, icon, accent, isDark }) => (
    <div style={{
        background: isDark ? "#1E293B" : "#FFFFFF",
        border: `1px solid ${isDark ? "#334155" : "#E2E8F0"}`,
        borderRadius: 12,
        padding: "16px 18px",
        position: "relative",
        overflow: "hidden",
    }}>
        <div style={{
            position: "absolute", top: 0, right: 0, width: 60, height: 60,
            background: accent, opacity: 0.08, borderRadius: "0 12px 0 60px",
        }} />
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{
                width: 36, height: 36, borderRadius: 8, background: accent + "20",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: accent, fontSize: 16, flexShrink: 0,
            }}>
                {icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 11, color: isDark ? "#94A3B8" : "#64748B", display: "block", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    {label}
                </Text>
                <div style={{ fontSize: 22, fontWeight: 700, color: isDark ? "#F1F5F9" : "#0F172A", lineHeight: 1.2, marginTop: 2 }}>
                    {value}
                </div>
                {sub && <Text style={{ fontSize: 11, color: isDark ? "#64748B" : "#94A3B8", marginTop: 2 }}>{sub}</Text>}
            </div>
        </div>
    </div>
);

// ─────────────────────────── Trend Chart ───────────────────────────
const TrendChart: React.FC<{ data: HafalanRow[]; isDark: boolean }> = ({ data, isDark }) => {
    const chartData = [...data]
        .filter((r) => r.tanggal && r.total_hafalan !== null)
        .sort((a, b) => (a.tanggal! > b.tanggal! ? 1 : -1))
        .slice(-20)
        .map((r, i) => ({
            idx: i + 1,
            juz: r.total_hafalan,
            label: r.tanggal ? r.tanggal.slice(5) : "",
        }));

    if (chartData.length < 2) return (
        <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: isDark ? "#475569" : "#CBD5E1", fontSize: 12 }}>Belum cukup data untuk tren</Text>
        </div>
    );

    return (
        <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#047857" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#047857" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1E293B" : "#F1F5F9"} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: isDark ? "#475569" : "#CBD5E1" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fill: isDark ? "#475569" : "#CBD5E1" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                <ReTooltip
                    contentStyle={{ background: isDark ? "#1E293B" : "#fff", border: "none", borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [`${v} Juz`, "Total"]}
                />
                <Area type="monotone" dataKey="juz" stroke="#047857" strokeWidth={2} fill="url(#trendGrad)" dot={false} />
            </AreaChart>
        </ResponsiveContainer>
    );
};

// ─────────────────────────── Predikat Chart ───────────────────────────
const PredikatChart: React.FC<{ data: HafalanRow[]; isDark: boolean }> = ({ data, isDark }) => {
    const counts: Record<string, number> = {};
    data.forEach((r) => { if (r.predikat) counts[r.predikat] = (counts[r.predikat] ?? 0) + 1; });
    const chartData = Object.entries(counts).map(([name, value]) => ({ name, value }));
    if (chartData.length === 0) return null;

    const colorMap: Record<string, string> = { MUMTAZ: "#D97706", JAYYID: "#059669", MAQBUL: "#2563EB", KURANG: "#DC2626" };

    return (
        <ResponsiveContainer width="100%" height={90}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1E293B" : "#F1F5F9"} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: isDark ? "#475569" : "#94A3B8" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fill: isDark ? "#475569" : "#94A3B8" }} tickLine={false} axisLine={false} />
                <ReTooltip contentStyle={{ background: isDark ? "#1E293B" : "#fff", border: "none", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry) => (
                        <Cell key={entry.name} fill={colorMap[entry.name] ?? "#6B7280"} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
};

// ─────────────────────────── Main Component ───────────────────────────
export const HafalanShow = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { token } = useToken();

    const hexLum = (hex: string) => {
        const c = hex.replace("#", "");
        if (c.length < 6) return 200;
        return .299 * parseInt(c.slice(0, 2), 16) + .587 * parseInt(c.slice(2, 4), 16) + .114 * parseInt(c.slice(4, 6), 16);
    };
    const isDark = hexLum(token.colorBgContainer) < 128;

    const { data: santriData, isLoading: santriLoading } = useOne<ISantri>({
        resource: "santri",
        id: id as string,
        meta: {
            idColumnName: "nis",
            select: "nama, nis, kelas, jurusan, jenis_kelamin, status_santri, total_hafalan, foto_url",
        },
    });

    const [summary, setSummary] = React.useState<HafalanSummary>({ total_count: 0, latest: null, all_rows: [] });
    const [loadingStats, setLoadingStats] = React.useState(true);

    React.useEffect(() => {
        if (!id) return;
        setLoadingStats(true);
        supabaseClient
            .from("hafalan_tahfidz")
            .select("id,tanggal,surat,ayat_awal,ayat_akhir,juz,total_hafalan,status,predikat,catatan,status_setoran,alasan_tolak", { count: "exact" })
            .eq("santri_nis", id)
            .order("tanggal", { ascending: false })
            .order("id", { ascending: false })
            .then(({ data, count }) => {
                setSummary({
                    total_count: count || 0,
                    latest: (data?.[0] as HafalanRow | undefined) || null,
                    all_rows: (data || []) as HafalanRow[],
                });
                setLoadingStats(false);
            });
    }, [id]);

    const record = santriData?.data;

    // ── Computed stats ──
    const mumtazCount = summary.all_rows.filter((r) => r.predikat === "MUMTAZ").length;
    const mumtazRate = summary.total_count > 0 ? Math.round((mumtazCount / summary.total_count) * 100) : 0;
    const kurangCount = summary.all_rows.filter((r) => r.predikat === "KURANG").length;
    const kurangRate = summary.total_count > 0 ? Math.round((kurangCount / summary.total_count) * 100) : 0;
    const completedJuz = summary.latest?.total_hafalan ?? 0;

    // Streak: consecutive days with setoran (sederhana)
    const uniqueDays = [...new Set(summary.all_rows.map((r) => r.tanggal).filter(Boolean))];
    const streak = uniqueDays.length;

    const [predikatFilter, setPredikatFilter] = React.useState<string | null>(null);

    const exportLaporan = async () => {
        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet("Riwayat Hafalan");
        ws.mergeCells("A1:H1");
        const titleCell = ws.getCell("A1");
        titleCell.value = `LAPORAN HAFALAN — ${record?.nama || santriAlias(record?.nis)} (${record?.nis})`;
        titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FF047857" } };
        titleCell.alignment = { vertical: "middle", horizontal: "center" };

        ws.mergeCells("A2:H2");
        ws.getCell("A2").value = `Riwayat setoran ${summary.total_count} kali · ${formatMasehi(new Date())}`;
        ws.getCell("A2").font = { name: "Arial", size: 10, italic: true };
        ws.getCell("A2").alignment = { horizontal: "center" };

        ws.addRow([]);
        const headerRow = ws.addRow(["NO", "TANGGAL", "SURAT", "AYAT", "JUZ", "TOTAL HAFALAN", "PREDIKAT", "STATUS SETORAN", "ALASAN", "CATATAN"]);
        headerRow.eachCell((cell) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF047857" } };
            cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
            cell.alignment = { vertical: "middle", horizontal: "center" };
            cell.border = {
                top: { style: "thin" }, left: { style: "thin" },
                bottom: { style: "thin" }, right: { style: "thin" },
            };
        });

        summary.all_rows.forEach((item, index) => {
            const row = ws.addRow([
                index + 1,
                item.tanggal ? formatFullDate(item.tanggal) : "-",
                item.surat || "-",
                item.ayat_awal && item.ayat_akhir ? `${item.ayat_awal}–${item.ayat_akhir}` : "-",
                item.juz ?? "-",
                item.total_hafalan ?? "-",
                item.predikat || "-",
                item.status_setoran === 'LANCAR' ? 'Lancar' : item.status_setoran === 'MENGULANG' ? 'Mengulang' : '-',
                item.status_setoran === 'MENGULANG' && item.alasan_tolak ? item.alasan_tolak : '-',
                item.catatan || "-",
            ]);
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: "thin", color: { argb: "FFE5E7EB" } },
                    left: { style: "thin", color: { argb: "FFE5E7EB" } },
                    bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
                    right: { style: "thin", color: { argb: "FFE5E7EB" } },
                };
                if (index % 2 !== 0)
                    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0FDF4" } };
            });
        });

        ws.autoFilter = "A4:J4";
        [5, 18, 20, 10, 8, 14, 14, 14, 20, 30].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

        const buffer = await workbook.xlsx.writeBuffer();
        const dateStr = new Date().toISOString().split("T")[0];
        const fileName = `Laporan_Hafalan_${record?.nis || "santri"}_${dateStr}.xlsx`;
        saveAs(new Blob([buffer]), fileName);
    };

    if (santriLoading || !record) {
        return (
            <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Spin size="large" />
            </div>
        );
    }

    // ── Helpers ──

    // ── Table columns ──
    const columns: ProColumns<HafalanRow>[] = [
        {
            title: "Tanggal",
            dataIndex: "tanggal",
            width: 160,
            render: (_, item) => (
                <Space direction="vertical" size={0}>
                    <Text style={{ fontSize: 12, color: token.colorText, fontWeight: 500 }}>
                        {item.tanggal ? formatFullDate(item.tanggal) : "–"}
                    </Text>
                    <Text style={{ fontSize: 10, color: token.colorTextSecondary }}>
                        {item.tanggal ? formatDualDate(item.tanggal) : ""}
                    </Text>
                </Space>
            ),
        },
        {
            title: "Surat / Ayat",
            key: "surat",
            render: (_, item) => (
                <Space direction="vertical" size={0}>
                    <Text style={{ fontWeight: 600, fontSize: 13, color: token.colorText }}>{item.surat || "–"}</Text>
                    <Text style={{ fontSize: 11, color: token.colorTextSecondary }}>Ayat {formatAyat(item)}</Text>
                </Space>
            ),
        },
        {
            title: "Juz",
            dataIndex: "juz",
            width: 70,
            render: (_, item) => item.juz ? (
                <div style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 32, height: 32, borderRadius: 8, background: "#04785720",
                    fontWeight: 700, fontSize: 13, color: "#047857",
                }}>
                    {item.juz}
                </div>
            ) : <Text style={{ color: token.colorTextSecondary }}>–</Text>,
        },
        {
            title: "Total",
            dataIndex: "total_hafalan",
            width: 90,
            render: (_, item) => item.total_hafalan !== null && item.total_hafalan !== undefined ? (
                <Tag style={{
                    background: "#04785710", borderColor: "#04785740", color: "#047857",
                    borderRadius: 6, fontWeight: 600, fontSize: 11,
                }}>
                    {item.total_hafalan} Juz
                </Tag>
            ) : "–",
        },
        {
            title: "Predikat",
            dataIndex: "predikat",
            width: 110,
            render: (_, item) => {
                const cfg = getPredikat(item.predikat);
                return item.predikat ? (
                    <div style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        background: isDark ? cfg.darkBg : cfg.bg,
                        color: cfg.color, borderRadius: 6, padding: "2px 8px",
                        fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
                    }}>
                        {cfg.icon}
                        {item.predikat}
                    </div>
                ) : <Text style={{ color: token.colorTextSecondary }}>–</Text>;
            },
        },
        {
            title: "Catatan",
            dataIndex: "catatan",
            ellipsis: { showTitle: false },
            render: (_, item) => (
                <Tooltip title={item.catatan || "–"}>
                    <Text style={{ color: token.colorTextSecondary, fontSize: 12 }} ellipsis>
                        {item.catatan || "–"}
                    </Text>
                </Tooltip>
            ),
        },
    ];

    return (
        <div style={{ background: token.colorBgLayout, minHeight: "100vh", padding: "20px 20px 80px" }}>

            {/* ── HEADER NAV ── */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <Button
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate("/hafalan")}
                    style={{
                        background: "transparent", border: `1px solid ${token.colorBorderSecondary}`,
                        color: token.colorTextSecondary, borderRadius: 8,
                    }}
                >
                    Kembali
                </Button>
                <Button
                    type="primary"
                    icon={<DownloadOutlined />}
                    onClick={exportLaporan}
                    style={{
                        background: "linear-gradient(135deg, #047857, #10B981)",
                        border: "none", borderRadius: 8, fontWeight: 600,
                    }}
                >
                    Eksport Laporan
                </Button>
            </div>

            <Row gutter={[20, 20]}>

                {/* ── KOLOM KIRI: Profile + Stats ── */}
                <Col xs={24} lg={8}>
                    <Space direction="vertical" style={{ width: "100%" }} size={16}>

                        {/* Profile Card */}
                        <div style={{
                            background: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}`,
                            borderRadius: 16, overflow: "hidden",
                        }}>
                            {/* Decorative header strip */}
                            <div style={{
                                height: 6,
                                background: "linear-gradient(90deg, #047857, #10B981, #D97706)",
                            }} />
                            <div style={{ padding: "24px 20px 20px", textAlign: "center" }}>
                                <Badge
                                    offset={[-8, 8]}
                                    count={
                                        <div style={{
                                            width: 18, height: 18, borderRadius: "50%",
                                            background: String(record.status_santri) === "aktif" ? "#10B981" : "#EF4444",
                                            border: `2px solid ${token.colorBgContainer}`,
                                        }} />
                                    }
                                >
                                    <Avatar
                                        size={88}
                                        src={record.foto_url}
                                        icon={<ReadOutlined />}
                                        style={{
                                            background: "linear-gradient(135deg, #047857, #10B981)",
                                            color: "#fff", fontSize: 32,
                                            border: `3px solid ${isDark ? "#334155" : "#E2E8F0"}`,
                                        }}
                                    />
                                </Badge>
                                <Title level={4} style={{ margin: "12px 0 2px", color: token.colorText }}>
                                    {record.nama || santriAlias(record.nis)}
                                </Title>
                                <Text style={{ color: token.colorTextSecondary, fontSize: 12 }}>
                                    {record.nis} · {record.kelas}
                                </Text>
                                {record.jurusan && (
                                    <div style={{ marginTop: 6 }}>
                                        <Tag style={{
                                            background: isDark ? "#1E3A5F" : "#DBEAFE",
                                            borderColor: "transparent", color: "#2563EB",
                                            borderRadius: 20, fontSize: 11,
                                        }}>
                                            {record.jurusan}
                                        </Tag>
                                    </div>
                                )}

                                <Divider style={{ borderColor: token.colorBorderSecondary, margin: "16px 0" }} />

                                {/* Juz Grid — SIGNATURE ELEMENT */}
                                <JuzGrid completedJuz={completedJuz} isDark={isDark} />
                            </div>
                        </div>

                        {/* KPI Grid */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <KPICard
                                label="Total Setoran"
                                value={loadingStats ? <Spin size="small" /> : summary.total_count}
                                sub="sesi tercatat"
                                icon={<HistoryOutlined />}
                                accent="#2563EB"
                                isDark={isDark}
                            />
                            <KPICard
                                label="Posisi Juz"
                                value={loadingStats ? <Spin size="small" /> : (summary.latest?.juz ? `${summary.latest.juz}` : "–")}
                                sub={summary.latest?.surat ?? "Belum ada"}
                                icon={<ReadOutlined />}
                                accent="#047857"
                                isDark={isDark}
                            />
                            <KPICard
                                label="Total Hafalan"
                                value={loadingStats ? <Spin size="small" /> : `${completedJuz} Juz`}
                                sub={`${Math.round((completedJuz / 30) * 100)}% dari 30 Juz`}
                                icon={<BookOutlined />}
                                accent="#7C3AED"
                                isDark={isDark}
                            />
                            <KPICard
                                label="Mumtaz Rate"
                                value={loadingStats ? <Spin size="small" /> : `${mumtazRate}%`}
                                sub={`${mumtazCount} dari ${summary.total_count}`}
                                icon={<TrophyOutlined />}
                                accent="#D97706"
                                isDark={isDark}
                            />
                        </div>

                        {/* Kurang Rate */}
                        {kurangCount > 0 && (
                            <div style={{
                                display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                                borderRadius: 8, background: isDark ? "#450A0A" : "#FEE2E2",
                                border: `1px solid ${isDark ? "#7F1D1D" : "#FECACA"}`,
                            }}>
                                <FireOutlined style={{ color: "#DC2626", fontSize: 12 }} />
                                <Text style={{ fontSize: 11, color: isDark ? "#FCA5A5" : "#991B1B", fontWeight: 600 }}>
                                    {kurangCount} setoran ({kurangRate}%) bernilai Kurang — perlu perhatian khusus
                                </Text>
                            </div>
                        )}

                        {/* Trend mini */}
                        <div style={{
                            background: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}`,
                            borderRadius: 16, padding: "16px 20px",
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                <Text style={{ fontSize: 12, fontWeight: 600, color: token.colorText }}>
                                    <RiseOutlined style={{ color: "#047857", marginRight: 6 }} />
                                    Tren Hafalan
                                </Text>
                                <Text style={{ fontSize: 10, color: token.colorTextSecondary }}>20 setoran terakhir</Text>
                            </div>
                            {loadingStats ? <Spin size="small" /> : <TrendChart data={summary.all_rows} isDark={isDark} />}
                        </div>

                        {/* Distribusi Predikat */}
                        <div style={{
                            background: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}`,
                            borderRadius: 16, padding: "16px 20px",
                        }}>
                            <Text style={{ fontSize: 12, fontWeight: 600, color: token.colorText, display: "block", marginBottom: 8 }}>
                                <StarFilled style={{ color: "#D97706", marginRight: 6 }} />
                                Distribusi Predikat
                            </Text>
                            {loadingStats ? <Spin size="small" /> : <PredikatChart data={summary.all_rows} isDark={isDark} />}
                        </div>

                    </Space>
                </Col>

                {/* ── KOLOM KANAN: Riwayat Table ── */}
                <Col xs={24} lg={16}>
                    {/* Predikat Filter Strip */}
                    <div style={{
                        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                        marginBottom: 12, padding: "8px 4px",
                    }}>
                        <Text style={{ fontSize: 11, color: token.colorTextSecondary, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                            Filter Predikat:
                        </Text>
                        {[
                            { label: "Semua", value: null, color: token.colorTextSecondary, bg: "transparent", border: token.colorBorderSecondary },
                            { label: `Mumtaz (${mumtazCount})`, value: "MUMTAZ", color: "#D97706", bg: isDark ? "#451A03" : "#FEF3C7", border: "#D97706" },
                            { label: `Jayyid (${summary.all_rows.filter(r => r.predikat === "JAYYID").length})`, value: "JAYYID", color: "#059669", bg: isDark ? "#022C22" : "#D1FAE5", border: "#059669" },
                            { label: `Maqbul (${summary.all_rows.filter(r => r.predikat === "MAQBUL").length})`, value: "MAQBUL", color: "#2563EB", bg: isDark ? "#1E3A5F" : "#DBEAFE", border: "#2563EB" },
                            { label: `Kurang (${kurangCount})`, value: "KURANG", color: "#DC2626", bg: isDark ? "#450A0A" : "#FEE2E2", border: "#DC2626" },
                        ].map((opt) => (
                            <div
                                key={opt.value ?? "all"}
                                onClick={() => setPredikatFilter(opt.value)}
                                style={{
                                    padding: "4px 10px",
                                    borderRadius: 6,
                                    cursor: "pointer",
                                    fontSize: 11,
                                    fontWeight: predikatFilter === opt.value ? 700 : 500,
                                    background: predikatFilter === opt.value ? opt.bg : "transparent",
                                    color: predikatFilter === opt.value ? opt.color : token.colorTextSecondary,
                                    border: `1px solid ${predikatFilter === opt.value ? opt.border : token.colorBorderSecondary}`,
                                    transition: "all 0.15s",
                                }}
                            >
                                {opt.label}
                            </div>
                        ))}
                        {predikatFilter && (
                            <Button
                                size="small"
                                onClick={() => setPredikatFilter(null)}
                                style={{ fontSize: 10, borderRadius: 6, color: token.colorTextSecondary, background: "transparent", border: `1px solid ${token.colorBorderSecondary}` }}
                            >
                                Reset
                            </Button>
                        )}
                    </div>
                    <div style={{
                        background: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}`,
                        borderRadius: 16, overflow: "hidden",
                    }}>
                        <ProTable<HafalanRow>
                            columns={columns}
                            rowKey="id"
                            search={false}
                            options={{ density: false, reload: true, fullScreen: false, setting: false }}
                            headerTitle={
                                <Space>
                                    <div style={{
                                        width: 28, height: 28, borderRadius: 6,
                                        background: "#04785720", display: "flex",
                                        alignItems: "center", justifyContent: "center",
                                        color: "#047857",
                                    }}>
                                        <CalendarOutlined />
                                    </div>
                                    <div>
                                        <Text strong style={{ color: token.colorText, fontSize: 14 }}>Riwayat Setoran Ziyadah</Text>
                                        <div>
                                            <Text style={{ color: token.colorTextSecondary, fontSize: 11 }}>
                                                {summary.total_count} total · {streak} hari aktif
                                            </Text>
                                        </div>
                                    </div>
                                </Space>
                            }
                            request={async (params) => {
                                const current = params.current || 1;
                                const pageSize = params.pageSize || 20;
                                const from = (current - 1) * pageSize;
                                const to = from + pageSize - 1;
                                let query = supabaseClient
                                    .from("hafalan_tahfidz")
                                    .select("id,tanggal,surat,ayat_awal,ayat_akhir,juz,total_hafalan,status,predikat,catatan", { count: "exact" })
                                    .eq("santri_nis", id);
                                if (predikatFilter) {
                                    query = query.eq("predikat", predikatFilter);
                                }
                                const { data, error, count } = await query
                                    .order("tanggal", { ascending: false })
                                    .order("id", { ascending: false })
                                    .range(from, to);
                                if (error) return { data: [], success: false, total: 0 };
                                return { data: (data || []) as HafalanRow[], success: true, total: count || 0 };
                            }}
                            pagination={{
                                defaultPageSize: 20,
                                showSizeChanger: true,
                                showQuickJumper: true,
                                size: "small",
                                style: { padding: "12px 16px" },
                            }}
                            rowClassName={(_, index) => index % 2 === 0 ? "row-even" : "row-odd"}
                            style={{ borderRadius: 0 }}
                            cardProps={{ bodyStyle: { padding: 0 } }}
                        />
                    </div>
                </Col>
            </Row>

            {/* ── Inline CSS overrides ── */}
            <style>{`
                .row-even td { background: ${isDark ? "#0F172A08" : "#F8FAFC"} !important; }
                .ant-pro-table .ant-table-thead > tr > th {
                    background: ${isDark ? "#1E293B" : "#F8FAFC"} !important;
                    color: ${token.colorTextSecondary} !important;
                    font-size: 11px !important;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    border-bottom: 1px solid ${token.colorBorderSecondary} !important;
                    font-weight: 600;
                }
                .ant-pro-table .ant-table-cell {
                    border-bottom: 1px solid ${isDark ? "#1E2D3D" : "#F1F5F9"} !important;
                }
                .ant-pro-table-list-toolbar {
                    border-bottom: 1px solid ${token.colorBorderSecondary};
                    padding: 14px 16px !important;
                }
            `}</style>
        </div>
    );
};
