import React, { useState, useMemo } from "react";
import { useTable, useSelect } from "@refinedev/antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import {
    Tag, Space, Button, Typography, Tooltip, Avatar,
    Modal, DatePicker, Select, Radio, message, Card,
    Spin, Progress, theme,
} from "antd";
import {
    PlusOutlined, UserOutlined, EyeOutlined,
    DownloadOutlined, FileExcelOutlined,
    FireOutlined, TeamOutlined, WarningOutlined,
    TrophyOutlined, BookOutlined, RiseOutlined, BarChartOutlined,
} from "@ant-design/icons";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
} from "recharts";
import { ISantri } from "../../types";
import { useNavigation } from "@refinedev/core";
import { formatHijri, formatMasehi } from "../../utility/dateHelper";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { supabaseClient } from "../../utility/supabaseClient";
import { santriAlias } from "../../utility/privacy";

dayjs.extend(isSameOrAfter);

const hexLum = (hex: string): number => {
    const c = hex.replace("#", "");
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    return 0.299 * r + 0.587 * g + 0.114 * b;
};

const { Text } = Typography;
const { RangePicker } = DatePicker;

// ─── Types ────────────────────────────────────────────────────────────────────

type MurojaahSummary = {
    santri_nis: string;
    total_count: number;
    week_count: number;
    month_count: number;
    last_tanggal: string | null;
    last_jenis_murojaah: "SABAQ" | "MANZIL" | null;
    last_juz: number | null;
    last_surat: string | null;
    last_ayat_awal: number | null;
    last_ayat_akhir: number | null;
    last_halaman_awal: number | null;
    last_halaman_akhir: number | null;
    last_predikat: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatMurojaahCoverage = (item?: Partial<MurojaahSummary> | null): string => {
    if (!item) return "Belum ada log";
    if (item.last_surat) {
        const ayat =
            item.last_ayat_awal && item.last_ayat_akhir
                ? ` Ayat ${item.last_ayat_awal}–${item.last_ayat_akhir}`
                : "";
        return `${item.last_surat}${ayat}`;
    }
    if (item.last_halaman_awal && item.last_halaman_akhir) {
        return `Hal. ${item.last_halaman_awal}–${item.last_halaman_akhir}`;
    }
    return item.last_juz ? `Juz ${item.last_juz}` : "Belum ada log";
};

/** Days since a date string */
const daysSince = (dateStr: string | null): number | null => {
    if (!dateStr) return null;
    return dayjs().diff(dayjs(dateStr.slice(0, 10)), "day");
};

const fetchAllMurojaahLogs = async (params: {
    startDate: string;
    endDate: string;
    santriNis?: string;
}) => {
    const pageSize = 1000;
    let from = 0;
    const rows: any[] = [];
    while (true) {
        let query = supabaseClient
            .from("murojaah_tahfidz")
            .select("*, santri(nama, nis, kelas)")
            .gte("tanggal", params.startDate)
            .lte("tanggal", params.endDate)
            .order("tanggal", { ascending: false })
            .range(from, from + pageSize - 1);
        if (params.santriNis) query = query.eq("santri_nis", params.santriNis);
        const { data, error } = await query;
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < pageSize) break;
        from += pageSize;
    }
    return rows;
};

// ─── Activity status helpers ──────────────────────────────────────────────────

type ActivityStatus = "aktif" | "perlu-perhatian" | "tidak-aktif" | "belum";

const getActivityStatus = (summary?: MurojaahSummary): ActivityStatus => {
    if (!summary || !summary.last_tanggal) return "belum";
    const days = daysSince(summary.last_tanggal);
    if (days === null) return "belum";
    if (days <= 7) return "aktif";
    if (days <= 14) return "perlu-perhatian";
    return "tidak-aktif";
};

const STATUS_CONFIG: Record<ActivityStatus, { label: string; color: string; antColor: string }> = {
    aktif: { label: "Aktif", color: "#16a34a", antColor: "success" },
    "perlu-perhatian": { label: "Perlu Perhatian", color: "#d97706", antColor: "warning" },
    "tidak-aktif": { label: "Tidak Aktif", color: "#dc2626", antColor: "error" },
    belum: { label: "Belum Ada Log", color: "#9ca3af", antColor: "default" },
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────

const KpiCard: React.FC<{
    icon: React.ReactNode;
    value: React.ReactNode;
    label: string;
    sub?: string;
    accent?: string;
    loading?: boolean;
    isDark?: boolean;
}> = ({ icon, value, label, sub, accent, loading, isDark }) => {
    const accentColor = accent ?? "#7c3aed";
    return (
        <div
            style={{
                background: "var(--ant-color-bg-container)",
                border: `1px solid ${isDark ? "#334155" : "var(--ant-color-border-secondary)"}`,
                borderRadius: 12,
                display: "flex",
                flexDirection: "column",
                flex: 1,
                boxShadow: isDark ? "0 1px 3px rgba(0,0,0,0.25)" : "0 1px 3px rgba(0,0,0,0.06)",
                overflow: "hidden",
            }}
        >
            <div style={{ height: 4, background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88)`, flexShrink: 0 }} />
            <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 4 }}>
                {loading ? (
                    <Spin size="small" style={{ marginTop: 4 }} />
                ) : (
                    <>
                        <div style={{
                            width: 30, height: 30, borderRadius: 8,
                            background: `${accentColor}18`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: accentColor, fontSize: 15,
                        }}>
                            {icon}
                        </div>
                        <span
                            style={{
                                fontSize: 28,
                                fontWeight: 500,
                                lineHeight: 1,
                                color: accentColor,
                            }}
                        >
                            {value}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ant-color-text)", letterSpacing: "0.02em" }}>{label}</span>
                        {sub && (
                            <span style={{ fontSize: 10, color: "var(--ant-color-text-tertiary)" }}>{sub}</span>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

// ─── Activity Donut (inline SVG bar) ─────────────────────────────────────────

const ActivityBreakdown: React.FC<{
    counts: Record<ActivityStatus, number>;
    total: number;
    isDark?: boolean;
}> = ({ counts, total, isDark }) => {
    const items: ActivityStatus[] = ["aktif", "perlu-perhatian", "tidak-aktif", "belum"];
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {items.map((s) => {
                const pct = total > 0 ? Math.round((counts[s] / total) * 100) : 0;
                const cfg = STATUS_CONFIG[s];
                return (
                    <div key={s} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: `1px solid ${isDark ? "#1E293B" : "#F1F5F9"}`,
                        background: isDark ? "#0F172A15" : "#F8FAFC",
                    }}>
                        <div style={{ width: 3, height: 24, borderRadius: 2, background: cfg.color, flexShrink: 0 }} />
                        <span
                            style={{
                                fontSize: 11,
                                color: "var(--ant-color-text-secondary)",
                                width: 110,
                                flexShrink: 0,
                                fontWeight: 500,
                            }}
                        >
                            {cfg.label}
                        </span>
                        <div
                            style={{
                                flex: 1,
                                height: 7,
                                background: "var(--ant-color-fill-quaternary)",
                                borderRadius: 999,
                                overflow: "hidden",
                            }}
                        >
                            <div
                                style={{
                                    width: `${pct}%`,
                                    height: "100%",
                                    background: cfg.color,
                                    borderRadius: 999,
                                    transition: "width 0.6s ease",
                                }}
                            />
                        </div>
                        <span
                            style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: cfg.color,
                                width: 22,
                                textAlign: "right",
                            }}
                        >
                            {counts[s]}
                        </span>
                        <span
                            style={{
                                fontSize: 10,
                                color: "var(--ant-color-text-tertiary)",
                                width: 28,
                            }}
                        >
                            {pct}%
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const MurojaahList: React.FC = () => {
    const { token } = theme.useToken();
    const isDark = hexLum(token.colorBgContainer) < 128;
    const { tableProps, tableQueryResult } = useTable<ISantri>({
        resource: "santri",
        syncWithLocation: true,
        meta: {
            select:
                "nama, nis, kelas, jurusan, jenis_kelamin, status_santri, pembimbing, total_hafalan, foto_url",
        },
        filters: {
            permanent: [
                { field: "jurusan", operator: "eq", value: "TAHFIDZ" },
                { field: "status_santri", operator: "eq", value: "AKTIF" },
            ],
        },
        sorters: { initial: [{ field: "kelas", order: "asc" }] },
    });

    const { push } = useNavigation();
    const [summariesByNis, setSummariesByNis] = useState<Record<string, MurojaahSummary>>({});
    const [summaryLoading, setSummaryLoading] = useState(true);

    React.useEffect(() => {
        const nisList = (tableQueryResult?.data?.data || [])
            .map((item) => item.nis)
            .filter(Boolean);

        if (nisList.length === 0) {
            setSummariesByNis({});
            setSummaryLoading(false);
            return;
        }

        let mounted = true;
        setSummaryLoading(true);
        supabaseClient
            .rpc("get_admin_murojaah_summaries", { p_santri_nis: nisList })
            .then(({ data, error }) => {
                if (!mounted) return;
                if (error) {
                    console.error("Gagal memuat ringkasan murojaah:", error);
                    setSummariesByNis({});
                } else {
                    const next: Record<string, MurojaahSummary> = {};
                    (data || []).forEach((item: MurojaahSummary) => {
                        next[item.santri_nis] = item;
                    });
                    setSummariesByNis(next);
                }
                setSummaryLoading(false);
            });

        return () => {
            mounted = false;
        };
    }, [tableQueryResult?.data?.data]);

    // ── Computed KPIs ────────────────────────────────────────────────────────

    const kpi = useMemo(() => {
        const summaries = Object.values(summariesByNis);
        const totalSantri = tableQueryResult?.data?.total ?? 0;

        const aktifMinggu = summaries.filter((s) => (s.week_count ?? 0) > 0).length;
        const totalSesiMinggu = summaries.reduce((acc, s) => acc + (s.week_count ?? 0), 0);
        const totalSesiBulan = summaries.reduce((acc, s) => acc + (s.month_count ?? 0), 0);

        const avgPerSantri =
            summaries.length > 0
                ? (totalSesiBulan / summaries.length).toFixed(1)
                : "0";

        const statusCounts: Record<ActivityStatus, number> = {
            aktif: 0,
            "perlu-perhatian": 0,
            "tidak-aktif": 0,
            belum: 0,
        };
        const allSantri = tableQueryResult?.data?.data ?? [];
        allSantri.forEach((s) => {
            const st = getActivityStatus(summariesByNis[s.nis]);
            statusCounts[st]++;
        });

        // Per-kelas breakdown for bar chart
        const kelasTally: Record<string, { aktif: number; total: number }> = {};
        allSantri.forEach((s) => {
            const kls = s.kelas ?? "–";
            if (!kelasTally[kls]) kelasTally[kls] = { aktif: 0, total: 0 };
            kelasTally[kls].total++;
            if (getActivityStatus(summariesByNis[s.nis]) === "aktif")
                kelasTally[kls].aktif++;
        });
        const kelasChart = Object.entries(kelasTally)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([kelas, v]) => ({
                kelas,
                aktif: v.aktif,
                tidakAktif: v.total - v.aktif,
            }));

        return {
            totalSantri,
            aktifMinggu,
            tidakAktifMinggu: totalSantri - aktifMinggu,
            totalSesiMinggu,
            totalSesiBulan,
            avgPerSantri,
            statusCounts,
            kelasChart,
        };
    }, [summariesByNis, tableQueryResult?.data]);

    // ── Export state ──────────────────────────────────────────────────────────

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [exportType, setExportType] = useState<"GLOBAL" | "PERSONAL">("GLOBAL");
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>([
        dayjs().startOf("month"),
        dayjs(),
    ]);
    const [selectedSantri, setSelectedSantri] = useState<string | null>(null);
    const [isLoadingExport, setIsLoadingExport] = useState(false);

    const { selectProps: santriSelectProps } = useSelect<ISantri>({
        resource: "santri",
        optionLabel: "nama",
        optionValue: "nis",
        meta: { select: "nama, nis, kelas, jurusan, status_santri" },
        filters: [{ field: "jurusan", operator: "eq", value: "TAHFIDZ" }],
        onSearch: (value) => [
            { field: "nama", operator: "contains", value },
            { field: "nis", operator: "contains", value },
        ],
    });

    // ── Export logic (preserved from original) ────────────────────────────────

    const handleExport = async () => {
        if (!dateRange) {
            message.error("Mohon pilih rentang tanggal terlebih dahulu");
            return;
        }
        setIsLoadingExport(true);
        try {
            const startDate = dateRange[0].startOf("day").toISOString();
            const endDate = dateRange[1].endOf("day").toISOString();
            const wb = new ExcelJS.Workbook();

            if (exportType === "GLOBAL") {
                const ws = wb.addWorksheet("Rekap Murojaah");
                const logs = await fetchAllMurojaahLogs({ startDate, endDate });

                ws.mergeCells("A1:G1");
                ws.getCell("A1").value = `LAPORAN MUROJAAH TAHFIDZ (${dateRange[0].format("DD MMM")} - ${dateRange[1].format("DD MMM YYYY")})`;
                ws.getCell("A1").font = { size: 14, bold: true, color: { argb: "FFFFFFFF" } };
                ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7E22CE" } };
                ws.getCell("A1").alignment = { horizontal: "center" };

                ws.getRow(3).values = ["Tanggal", "NIS", "Nama Santri", "Kelas", "Jenis", "Cakupan (Surat/Hal)", "Predikat", "Catatan"];
                ws.getRow(3).font = { bold: true };
                ws.columns = [
                    { key: "tgl", width: 15 }, { key: "nis", width: 15 }, { key: "nama", width: 25 },
                    { key: "kelas", width: 10 }, { key: "jenis", width: 10 }, { key: "cakupan", width: 30 },
                    { key: "predikat", width: 15 }, { key: "note", width: 30 },
                ];

                logs.forEach((item) => {
                    const cakupan = item.surat
                        ? `${item.surat} (Ayat ${item.ayat_awal}-${item.ayat_akhir})`
                        : `Hal. ${item.halaman_awal} - ${item.halaman_akhir} (Juz ${item.juz})`;
                    ws.addRow({
                        tgl: formatMasehi(item.tanggal),
                        nis: item.santri_nis,
                        nama: item.santri?.nama || santriAlias(item.santri?.nis),
                        kelas: item.santri?.kelas,
                        jenis: item.jenis_murojaah,
                        cakupan,
                        predikat: item.predikat,
                        note: item.catatan,
                    });
                });
            } else {
                if (!selectedSantri) {
                    message.error("Pilih santri terlebih dahulu");
                    setIsLoadingExport(false);
                    return;
                }
                const { data: santri } = await supabaseClient
                    .from("santri")
                    .select("nama, nis, kelas, jurusan")
                    .eq("nis", selectedSantri)
                    .single();
                if (!santri) throw new Error("Data santri tidak ditemukan.");
                const logs = await fetchAllMurojaahLogs({ startDate, endDate, santriNis: selectedSantri });
                const ws = wb.addWorksheet(`Murojaah - ${(santri.nama || santriAlias(santri.nis)).substring(0, 20)}`);

                ws.getCell("A1").value = "LAPORAN PERSONAL MUROJAAH";
                ws.getCell("A1").font = { size: 16, bold: true, color: { argb: "FF7E22CE" } };
                ws.getCell("A3").value = "Nama:"; ws.getCell("B3").value = santri.nama || santriAlias(santri.nis);
                ws.getCell("A4").value = "Kelas:"; ws.getCell("B4").value = santri.kelas;
                ws.getCell("A5").value = "Periode:"; ws.getCell("B5").value = `${dateRange[0].format("DD MMM")} s/d ${dateRange[1].format("DD MMM YYYY")}`;

                ws.getRow(7).values = ["Tanggal (M)", "Tanggal (H)", "Jenis", "Juz", "Cakupan Hafalan", "Predikat", "Paraf Musyrif"];
                ws.getRow(7).font = { bold: true, color: { argb: "FFFFFFFF" } };
                ws.getRow(7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7E22CE" } };
                ws.columns = [
                    { width: 18 }, { width: 22 }, { width: 12 }, { width: 8 }, { width: 40 }, { width: 15 }, { width: 15 },
                ];

                logs.forEach((item) => {
                    const cakupan = item.surat
                        ? `QS. ${item.surat} : ${item.ayat_awal}-${item.ayat_akhir}`
                        : `Halaman ${item.halaman_awal} - ${item.halaman_akhir}`;
                    ws.addRow([
                        formatMasehi(item.tanggal),
                        formatHijri(item.tanggal),
                        item.jenis_murojaah,
                        item.juz,
                        cakupan,
                        item.predikat,
                        "",
                    ]);
                });
            }

            const buffer = await wb.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `Laporan_Murojaah_${exportType}_${dayjs().format("YYYYMMDD")}.xlsx`);
            message.success("Laporan berhasil diunduh");
            setIsModalOpen(false);
        } catch (error: any) {
            message.error("Gagal export: " + error.message);
        } finally {
            setIsLoadingExport(false);
        }
    };

    // ── Table columns ─────────────────────────────────────────────────────────

    const columns: ProColumns<ISantri>[] = [
        {
            title: "Santri Tahfidz",
            dataIndex: "nis",
            width: 240,
            fixed: "left",
            render: (_, record) => {
                const status = getActivityStatus(summariesByNis[record.nis]);
                const cfg = STATUS_CONFIG[status];
                return (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ position: "relative", flexShrink: 0 }}>
                            <Avatar
                                src={record.foto_url}
                                size={40}
                                icon={<UserOutlined />}
                                style={{
                                    border: `2px solid ${cfg.color}22`,
                                    background: "var(--ant-color-primary-bg)",
                                    color: "var(--ant-color-primary)",
                                }}
                            />
                            <span
                                style={{
                                    position: "absolute",
                                    bottom: 0,
                                    right: 0,
                                    width: 9,
                                    height: 9,
                                    borderRadius: "50%",
                                    background: cfg.color,
                                    border: "1.5px solid var(--ant-color-bg-container)",
                                }}
                            />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                            <Text strong style={{ fontSize: 13, lineHeight: "18px" }}>
                                {record.nama || santriAlias(record.nis)}
                            </Text>
                            <Space size={4}>
                                <Tag bordered={false} style={{ margin: 0, fontSize: 10, padding: "0 6px", background: "var(--ant-color-fill-secondary)" }}>
                                    {record.nis}
                                </Tag>
                                <Tag color="cyan" style={{ margin: 0, fontSize: 10, padding: "0 6px" }}>
                                    Kelas {record.kelas}
                                </Tag>
                            </Space>
                        </div>
                    </div>
                );
            },
        },
        {
            title: "Pembimbing",
            dataIndex: "pembimbing",
            width: 160,
            render: (val) => (
                <Text style={{ fontSize: 12 }}>{val || "–"}</Text>
            ),
        },
        {
            title: "Status",
            key: "status",
            width: 130,
            search: false,
            render: (_, record) => {
                const summary = summariesByNis[record.nis];
                const status = getActivityStatus(summary);
                const cfg = STATUS_CONFIG[status];
                const days = summary?.last_tanggal ? daysSince(summary.last_tanggal) : null;
                return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <Tag
                            color={cfg.antColor}
                            style={{ margin: 0, fontSize: 10, width: "fit-content" }}
                        >
                            {cfg.label}
                        </Tag>
                        {days !== null && (
                            <Text type="secondary" style={{ fontSize: 10 }}>
                                {days === 0 ? "Hari ini" : `${days} hari lalu`}
                            </Text>
                        )}
                    </div>
                );
            },
        },
        {
            title: "Sesi",
            key: "summary",
            width: 200,
            search: false,
            render: (_, record) => {
                const summary = summariesByNis[record.nis];
                if (!summary) return <Text type="secondary" style={{ fontSize: 12 }}>–</Text>;
                const weekPct = summary.month_count > 0
                    ? Math.round((summary.week_count / summary.month_count) * 100)
                    : 0;
                return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <Space size={4}>
                            <Tag color="purple" style={{ margin: 0, fontSize: 10 }}>
                                Total {summary.total_count}
                            </Tag>
                            <Tag color="blue" style={{ margin: 0, fontSize: 10 }}>
                                Bulan {summary.month_count}
                            </Tag>
                        </Space>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Progress
                                percent={weekPct}
                                size="small"
                                showInfo={false}
                                strokeColor="#7c3aed"
                                style={{ flex: 1, margin: 0 }}
                            />
                            <Text style={{ fontSize: 10, color: "var(--ant-color-text-secondary)", whiteSpace: "nowrap" }}>
                                {summary.week_count} pekan ini
                            </Text>
                        </div>
                    </div>
                );
            },
        },
        {
            title: "Murojaah Terakhir",
            key: "last_murojaah",
            width: 260,
            search: false,
            render: (_, record) => {
                const summary = summariesByNis[record.nis];
                if (!summary?.last_tanggal) {
                    return (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            Belum ada log
                        </Text>
                    );
                }
                return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <Space size={4}>
                            {summary.last_jenis_murojaah && (
                                <Tag
                                    color={summary.last_jenis_murojaah === "SABAQ" ? "blue" : "purple"}
                                    style={{ margin: 0, fontSize: 10 }}
                                >
                                    {summary.last_jenis_murojaah}
                                </Tag>
                            )}
                            {summary.last_predikat && (
                                <Tag
                                    color={summary.last_predikat === "MUMTAZ" ? "success" : "default"}
                                    style={{ margin: 0, fontSize: 10 }}
                                >
                                    {summary.last_predikat}
                                </Tag>
                            )}
                        </Space>
                        <Text
                            ellipsis={{ tooltip: formatMurojaahCoverage(summary) }}
                            style={{ fontSize: 12, maxWidth: 240 }}
                        >
                            {formatMurojaahCoverage(summary)}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 10 }}>
                            {formatMasehi(summary.last_tanggal)}
                        </Text>
                    </div>
                );
            },
        },
        {
            title: "Aksi",
            valueType: "option",
            width: 130,
            fixed: "right",
            render: (_, record) => [
                <Tooltip title="Input Murojaah" key="add">
                    <Button
                        type="primary"
                        ghost
                        size="small"
                        icon={<PlusOutlined />}
                        style={{ borderColor: "#7c3aed", color: "#7c3aed" }}
                        onClick={() => push(`/murojaah/create?nis=${record.nis}`)}
                    />
                </Tooltip>,
                <Tooltip title="Lihat Log & Detail" key="view">
                    <Button
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => push(`/murojaah/show/${record.nis}`)}
                    >
                        Detail
                    </Button>
                </Tooltip>,
            ],
        },
    ];

    // ── Shared styles ─────────────────────────────────────────────────────────

    const card: React.CSSProperties = {
        background: token.colorBgContainer,
        border: `1px solid ${isDark ? "#334155" : token.colorBorderSecondary}`,
        borderRadius: 12,
        padding: "16px 20px",
        boxShadow: isDark ? "0 1px 3px rgba(0,0,0,0.25)" : "0 1px 3px rgba(0,0,0,0.06)",
    };

    const sectionLabel: React.CSSProperties = {
        fontSize: 11,
        fontWeight: 500,
        color: token.colorTextSecondary,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        marginBottom: 12,
        display: "flex",
        alignItems: "center",
        gap: 6,
    };

    const divider: React.CSSProperties = {
        height: "0.5px",
        background: token.colorBorderSecondary,
        margin: "14px 0",
    };

    const totalSantri = kpi.totalSantri;

    return (
        <>
            <div style={{ padding: "0 0 80px" }}>

                {/* ── Page header ── */}
                <div style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                            <Text style={{ fontSize: 18, fontWeight: 500, display: "block" }}>
                                Murojaah Tahfidz
                            </Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                Update per {formatHijri(new Date())}
                            </Text>
                        </div>
                        <Space>
                            <Button
                                icon={<FileExcelOutlined />}
                                onClick={() => setIsModalOpen(true)}
                                style={{ color: "#16a34a", borderColor: "#16a34a" }}
                            >
                                Export Center
                            </Button>
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={() => push("/murojaah/create")}
                                style={{ background: "#7c3aed", borderColor: "#7c3aed" }}
                            >
                                Input Baru
                            </Button>
                        </Space>
                    </div>
                </div>

                {/* ── KPI row ── */}
                <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                    <KpiCard
                        icon={<TeamOutlined />}
                        value={totalSantri}
                        label="Total santri aktif"
                        sub="Takhasus Tahfidz"
                        loading={summaryLoading}
                        isDark={isDark}
                    />
                    <KpiCard
                        icon={<FireOutlined />}
                        value={kpi.aktifMinggu}
                        label="Aktif minggu ini"
                        sub={`${totalSantri > 0 ? Math.round((kpi.aktifMinggu / totalSantri) * 100) : 0}% dari total santri`}
                        accent="#7c3aed"
                        loading={summaryLoading}
                        isDark={isDark}
                    />
                    <KpiCard
                        icon={<WarningOutlined />}
                        value={kpi.tidakAktifMinggu}
                        label="Belum murojaah minggu ini"
                        sub="Perlu tindak lanjut"
                        accent={kpi.tidakAktifMinggu > 0 ? "#dc2626" : "#16a34a"}
                        loading={summaryLoading}
                        isDark={isDark}
                    />
                    <KpiCard
                        icon={<BookOutlined />}
                        value={kpi.totalSesiMinggu}
                        label="Total sesi minggu ini"
                        sub={`${kpi.totalSesiBulan} sesi bulan ini`}
                        loading={summaryLoading}
                        isDark={isDark}
                    />
                    <KpiCard
                        icon={<RiseOutlined />}
                        value={kpi.avgPerSantri}
                        label="Rata-rata sesi/santri"
                        sub="Bulan ini"
                        loading={summaryLoading}
                        isDark={isDark}
                    />
                </div>

                {/* ── Analytics row ── */}
                <div
                    style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}
                >
                    {/* Status breakdown */}
                    <div style={card}>
                        <div style={sectionLabel}>
                            <TrophyOutlined style={{ fontSize: 13 }} />
                            <span>Distribusi status aktivitas santri</span>
                        </div>
                        {summaryLoading ? (
                            <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
                                <Spin />
                            </div>
                        ) : (
                            <ActivityBreakdown counts={kpi.statusCounts} total={totalSantri} isDark={isDark} />
                        )}
                    </div>

                    {/* Per-kelas bar chart */}
                    <div style={card}>
                        <div style={sectionLabel}>
                            <BarChartOutlined style={{ fontSize: 13 }} />
                            <span>Keaktifan per kelas — minggu ini</span>
                        </div>
                        {/* Legend */}
                        <div
                            style={{
                                display: "flex",
                                gap: 16,
                                marginBottom: 10,
                                fontSize: 11,
                                color: "var(--ant-color-text-secondary)",
                            }}
                        >
                            {[
                                { color: "#7c3aed", label: "Aktif" },
                                { color: isDark ? "#334155" : "#CBD5E1", label: "Tidak aktif" },
                            ].map(({ color, label }) => (
                                <span key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <span
                                        style={{
                                            width: 10,
                                            height: 10,
                                            borderRadius: 2,
                                            background: color,
                                            display: "inline-block",
                                        }}
                                    />
                                    {label}
                                </span>
                            ))}
                        </div>
                        {summaryLoading ? (
                            <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
                                <Spin />
                            </div>
                        ) : kpi.kelasChart.length > 0 ? (
                            <ResponsiveContainer width="100%" height={140}>
                                <BarChart data={kpi.kelasChart} barSize={20} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke={token.colorBorderSecondary}
                                        vertical={false}
                                    />
                                    <XAxis
                                        dataKey="kelas"
                                        tick={{ fontSize: 11, fill: token.colorTextSecondary }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 10, fill: token.colorTextSecondary }}
                                        axisLine={false}
                                        tickLine={false}
                                        allowDecimals={false}
                                    />
                                    <RechartsTooltip
                                        contentStyle={{
                                            fontSize: 12,
                                            borderRadius: 8,
                                            border: "0.5px solid var(--ant-color-border-secondary)",
                                            background: "var(--ant-color-bg-container)",
                                        }}
                                        cursor={{ fill: token.colorFillSecondary }}
                                    />
                                    <Bar dataKey="aktif" name="Aktif" stackId="a" fill="#7c3aed" radius={[0, 0, 0, 0]} />
                                    <Bar dataKey="tidakAktif" name="Tidak aktif" stackId="a" fill={isDark ? "#334155" : "#CBD5E1"} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                Data kelas belum tersedia.
                            </Text>
                        )}
                    </div>
                </div>

                {/* ── Main table ── */}
                <div
                    style={{
                        background: token.colorBgContainer,
                        border: `1px solid ${isDark ? "#334155" : token.colorBorderSecondary}`,
                        borderRadius: 12,
                        overflow: "hidden",
                    }}
                >
                    <ProTable<ISantri>
                        {...tableProps}
                        columns={columns}
                        rowKey="nis"
                        headerTitle={
                            <div style={{ display: "flex", flexDirection: "column" }}>
                                <Text strong style={{ fontSize: 14 }}>
                                    Daftar Santri Tahfidz
                                </Text>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                    {totalSantri} santri aktif terdaftar
                                </Text>
                            </div>
                        }
                        toolBarRender={false}
                        options={{ density: true, fullScreen: true, reload: true }}
                        search={{ labelWidth: "auto", layout: "vertical" }}
                        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
                        style={{ borderRadius: 0 }}
                        rowClassName={(record) => {
                            const status = getActivityStatus(summariesByNis[record.nis]);
                            return status === "tidak-aktif" ? "murojaah-row-warn" : "";
                        }}
                    />
                </div>

                {/* Row highlight style for inactive */}
                <style>{`
                    .murojaah-row-warn > td {
                        background: color-mix(in srgb, #dc2626 4%, transparent) !important;
                    }
                `}</style>
            </div>

            {/* ── Export Modal (preserved from original) ── */}
            <Modal
                title={
                    <Space>
                        <FileExcelOutlined style={{ color: "#16a34a" }} />
                        Export Data Murojaah
                    </Space>
                }
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                footer={[
                    <Button key="back" onClick={() => setIsModalOpen(false)}>
                        Batal
                    </Button>,
                    <Button
                        key="submit"
                        type="primary"
                        icon={<DownloadOutlined />}
                        loading={isLoadingExport}
                        onClick={handleExport}
                        style={{ background: "#16a34a", borderColor: "#16a34a" }}
                    >
                        Download Excel
                    </Button>,
                ]}
            >
                <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0" }}>
                    <Card size="small" style={{ background: "var(--ant-color-fill-quaternary)", border: `1px solid ${isDark ? "#334155" : "var(--ant-color-border-secondary)"}` }}>
                        <Text strong style={{ display: "block", marginBottom: 8 }}>
                            Jenis Laporan
                        </Text>
                        <Radio.Group
                            value={exportType}
                            onChange={(e) => setExportType(e.target.value)}
                            buttonStyle="solid"
                            style={{ width: "100%" }}
                        >
                            <Radio.Button value="GLOBAL" style={{ width: "50%", textAlign: "center" }}>
                                Rekap Semua Santri
                            </Radio.Button>
                            <Radio.Button value="PERSONAL" style={{ width: "50%", textAlign: "center" }}>
                                Rapor Personal
                            </Radio.Button>
                        </Radio.Group>
                    </Card>

                    {exportType === "PERSONAL" && (
                        <div>
                            <Text strong style={{ display: "block", marginBottom: 6 }}>
                                Pilih Santri
                            </Text>
                            <Select
                                {...santriSelectProps}
                                showSearch
                                placeholder="Ketik nama santri..."
                                style={{ width: "100%" }}
                                onChange={(val) => setSelectedSantri(val as unknown as string)}
                                allowClear
                            />
                        </div>
                    )}

                    <div>
                        <Text strong style={{ display: "block", marginBottom: 6 }}>
                            Rentang Periode
                        </Text>
                        <RangePicker
                            value={dateRange}
                            onChange={(dates) => setDateRange(dates as any)}
                            style={{ width: "100%" }}
                            format="DD MMM YYYY"
                            presets={[
                                { label: "Hari ini", value: [dayjs(), dayjs()] },
                                { label: "Minggu ini", value: [dayjs().startOf("week"), dayjs().endOf("week")] },
                                { label: "Bulan ini", value: [dayjs().startOf("month"), dayjs().endOf("month")] },
                            ]}
                        />
                        <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: "block" }}>
                            Disarankan export per bulan agar file tidak terlalu besar.
                        </Text>
                    </div>
                </div>
            </Modal>
        </>
    );
};
