import React, { useState, useMemo } from "react";
import { useTable } from "@refinedev/antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import {
    Space, Button, Typography, Tooltip, Avatar, Modal,
    message, Card, Row, Col, Select, DatePicker, Tag,
    Progress, Popconfirm, Segmented, theme, Badge, Divider,
} from "antd";
import {
    DownloadOutlined, PlusOutlined, WarningOutlined,
    DeleteOutlined, EditOutlined, ThunderboltOutlined,
    FileTextOutlined, UserOutlined, ReloadOutlined,
    FilterOutlined, ExclamationCircleOutlined,
    FireOutlined, AlertOutlined,
    BarChartOutlined, TeamOutlined, CalendarOutlined,
    TrophyOutlined, RiseOutlined, SafetyOutlined,
} from "@ant-design/icons";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { supabaseClient } from "../../utility/supabaseClient";
import { santriAlias } from "../../utility/privacy";
import { IPelanggaranSantri } from "../../types";
import { useNavigation, useDelete } from "@refinedev/core";
import { formatHijri, formatMasehi } from "../../utility/dateHelper";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useColorMode } from "../../contexts/color-mode";

dayjs.extend(relativeTime);

const { Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;
const { useToken } = theme;

// ─────────────────────────────────────────────────────────────
//  SEVERITY CONFIG
// ─────────────────────────────────────────────────────────────
const SEVERITY = {
    RINGAN: {
        label: "Ringan",
        color: "#059669",
        bg: "rgba(5,150,105,0.08)",
        border: "rgba(5,150,105,0.24)",
        gradient: "linear-gradient(135deg,#065F46 0%,#059669 55%,#10B981 100%)",
        icon: <SafetyOutlined />,
    },
    SEDANG: {
        label: "Sedang",
        color: "#D97706",
        bg: "rgba(217,119,6,0.09)",
        border: "rgba(217,119,6,0.28)",
        gradient: "linear-gradient(135deg,#78350F 0%,#D97706 55%,#F59E0B 100%)",
        icon: <AlertOutlined />,
    },
    BERAT: {
        label: "Berat",
        color: "#DC2626",
        bg: "rgba(220,38,38,0.08)",
        border: "rgba(220,38,38,0.24)",
        gradient: "linear-gradient(135deg,#7F1D1D 0%,#DC2626 55%,#F87171 100%)",
        icon: <FireOutlined />,
    },
} as const;

type JenisKey = keyof typeof SEVERITY;

// ─────────────────────────────────────────────────────────────
//  COMPONENT
// ─────────────────────────────────────────────────────────────
export const PelanggaranList = () => {
    const { token } = useToken();
    const { mode } = useColorMode();
    const isDark = mode === "dark";
    const { create, edit } = useNavigation();
    const { mutate: deleteMutate } = useDelete();

    // ── Gold Design System ────────────────────────
    const G = {
        text: isDark ? "#F59E0B" : "#B45309",
        bg: isDark ? "rgba(245,158,11,0.08)" : "rgba(212,160,23,0.06)",
        border: isDark ? "rgba(245,158,11,0.18)" : "rgba(180,83,9,0.14)",
        borderStrong: isDark ? "rgba(245,158,11,0.35)" : "rgba(180,83,9,0.28)",
        gradient: "linear-gradient(135deg,#92400E 0%,#B45309 30%,#D4A017 65%,#F59E0B 100%)",
        gradientSoft: isDark
            ? "linear-gradient(135deg,rgba(146,64,14,0.35) 0%,rgba(245,158,11,0.18) 100%)"
            : "linear-gradient(135deg,rgba(180,83,9,0.10) 0%,rgba(245,158,11,0.05) 100%)",
        shadow: isDark
            ? "0 8px 32px rgba(0,0,0,0.5),0 1px 0 rgba(255,255,255,0.05)"
            : "0 4px 24px rgba(0,0,0,0.07)",
        cardBorder: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.05)",
    };

    // ── Filter states ─────────────────────────────
    const [filterKelas, setFilterKelas] = useState<string | null>(null);
    const [filterJurusan, setFilterJurusan] = useState<string | null>(null);
    const [filterKategori, setFilterKategori] = useState<JenisKey | null>(null);
    const [filterDateRange, setFilterDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
    const [viewMode, setViewMode] = useState<"all" | "ringan" | "sedang" | "berat">("all");
    const [exportLoading, setExportLoading] = useState(false);

    // ── Table ─────────────────────────────────────
    const { tableProps, tableQueryResult } = useTable<IPelanggaranSantri>({
        resource: "pelanggaran_santri",
        syncWithLocation: false,
        meta: { select: "*, santri!inner(nama, nis, kelas, jurusan)" },
        sorters: { initial: [{ field: "tanggal", order: "desc" }] },
    });

    // ── Client-side filter ────────────────────────
    const allData = tableQueryResult?.data?.data || [];

    const filteredData = useMemo(() => {
        return allData.filter((item) => {
            if (filterKelas && item.santri?.kelas !== filterKelas) return false;
            if (filterJurusan && item.santri?.jurusan !== filterJurusan) return false;
            if (filterKategori && item.jenis_pelanggaran !== filterKategori) return false;
            if (viewMode !== "all" && item.jenis_pelanggaran !== viewMode.toUpperCase()) return false;
            if (filterDateRange) {
                const d = dayjs(item.tanggal);
                if (d.isBefore(filterDateRange[0], "day") || d.isAfter(filterDateRange[1], "day"))
                    return false;
            }
            return true;
        });
    }, [allData, filterKelas, filterJurusan, filterKategori, viewMode, filterDateRange]);

    const finalTableProps = {
        ...tableProps,
        dataSource: filteredData,
        pagination: { ...tableProps.pagination, total: filteredData.length },
    };

    // ── KPI Statistics ────────────────────────────
    const stats = useMemo(() => {
        const ringan = allData.filter((d) => d.jenis_pelanggaran === "RINGAN").length;
        const sedang = allData.filter((d) => d.jenis_pelanggaran === "SEDANG").length;
        const berat = allData.filter((d) => d.jenis_pelanggaran === "BERAT").length;
        const totalPoin = allData.reduce((s, d) => s + Number(d.poin || 0), 0);
        const total = allData.length;

        // Top offender — santri paling banyak pelanggaran
        const pelanggarPerNIS: Record<string, { nama: string; count: number; poin: number }> = {};
        allData.forEach((d) => {
            const nis = d.santri_nis;
            if (!pelanggarPerNIS[nis]) {
                pelanggarPerNIS[nis] = { nama: d.santri?.nama || santriAlias(d.santri?.nis) || "-", count: 0, poin: 0 };
            }
            pelanggarPerNIS[nis].count += 1;
            pelanggarPerNIS[nis].poin += Number(d.poin || 0);
        });
        const topOffenders = Object.entries(pelanggarPerNIS)
            .sort((a, b) => b[1].poin - a[1].poin)
            .slice(0, 3);

        // This month
        const thisMonth = allData.filter((d) =>
            dayjs(d.tanggal).isSame(dayjs(), "month")
        ).length;

        return { ringan, sedang, berat, total, totalPoin, topOffenders, thisMonth };
    }, [allData]);

    const hasActiveFilter =
        filterKelas || filterJurusan || filterKategori || filterDateRange || viewMode !== "all";

    const clearFilters = () => {
        setFilterKelas(null);
        setFilterJurusan(null);
        setFilterKategori(null);
        setFilterDateRange(null);
        setViewMode("all");
    };

    // ── Export Excel ──────────────────────────────
    const exportToExcel = async () => {
        setExportLoading(true);
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet("Data Pelanggaran");

            worksheet.mergeCells("A1:I1");
            const t = worksheet.getCell("A1");
            t.value = "PONDOK PESANTREN AL-HASANAH";
            t.font = { name: "Arial", size: 16, bold: true, color: { argb: "FFB45309" } };
            t.alignment = { vertical: "middle", horizontal: "center" };

            worksheet.mergeCells("A2:I2");
            const a = worksheet.getCell("A2");
            a.value = "Jl. Raya Cibeuti No.13, Cibeuti, Kec. Kawalu, Tasikmalaya, Jawa Barat 46182";
            a.font = { name: "Arial", size: 10, italic: true };
            a.alignment = { vertical: "middle", horizontal: "center" };

            worksheet.mergeCells("A3:I3");
            const c = worksheet.getCell("A3");
            c.value = "Telp: 0812-XXXX-XXXX | Email: info@alhasanah.com";
            c.font = { name: "Arial", size: 9 };
            c.alignment = { vertical: "middle", horizontal: "center" };

            worksheet.addRow([]);
            const rTitle = worksheet.addRow(["BUKU KEDISIPLINAN SANTRI — REKAP PELANGGARAN"]);
            rTitle.font = { bold: true, size: 12 };
            const rSub = worksheet.addRow([
                `Periode: ${filterDateRange
                    ? `${filterDateRange[0].format("DD MMM YYYY")} s/d ${filterDateRange[1].format("DD MMM YYYY")}`
                    : "Seluruh Data"
                } | Dicetak: ${dayjs().format("DD MMMM YYYY HH:mm")}`,
            ]);
            rSub.font = { size: 9, italic: true };
            worksheet.addRow([]);

            const headerRow = worksheet.addRow([
                "TANGGAL (M)", "TANGGAL (H)", "NIS", "NAMA SANTRI",
                "KELAS", "TAKHASUS", "KATEGORI", "POIN", "HUKUMAN / TINDAKAN", "CATATAN",
            ]);
            headerRow.eachCell((cell) => {
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF59E0B" } };
                cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
                cell.alignment = { vertical: "middle", horizontal: "center" };
                cell.border = {
                    top: { style: "thin" }, left: { style: "thin" },
                    bottom: { style: "thin" }, right: { style: "thin" },
                };
            });

            const { data: allExport } = await supabaseClient
                .from("pelanggaran_santri")
                .select("*, santri(nama, nis, kelas, jurusan)")
                .order("tanggal", { ascending: false });

            (allExport || []).forEach((item: any, index) => {
                const row = worksheet.addRow([
                    formatMasehi(item.tanggal),
                    formatHijri(item.tanggal),
                    item.santri?.nis,
                    (item.santri?.nama || santriAlias(item.santri?.nis))?.toUpperCase(),
                    item.santri?.kelas,
                    item.santri?.jurusan,
                    item.jenis_pelanggaran,
                    Number(item.poin),
                    item.hukuman,
                    item.catatan,
                ]);
                row.eachCell((cell, colNum) => {
                    cell.border = {
                        top: { style: "thin", color: { argb: "FFE5E7EB" } },
                        left: { style: "thin", color: { argb: "FFE5E7EB" } },
                        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
                        right: { style: "thin", color: { argb: "FFE5E7EB" } },
                    };
                    if (index % 2 !== 0)
                        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDF6E3" } };
                    if (item.jenis_pelanggaran === "BERAT" && colNum === 7) {
                        cell.font = { color: { argb: "FFDC2626" }, bold: true };
                    }
                });
            });

            const totalRow = worksheet.addRow([
                "", "", "", "", "", "", "TOTAL POIN",
                (allExport || []).reduce((s: number, i: any) => s + Number(i.poin || 0), 0),
                "", "",
            ]);
            totalRow.font = { bold: true };

            worksheet.autoFilter = "A7:J7";
            worksheet.views = [{ state: "frozen", xSplit: 0, ySplit: 7 }];
            [15, 20, 12, 30, 8, 12, 12, 8, 30, 40].forEach((w, i) => {
                worksheet.getColumn(i + 1).width = w;
            });

            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(
                new Blob([buffer]),
                `Rekap_Pelanggaran_${new Date().toISOString().split("T")[0]}.xlsx`
            );
            message.success("Laporan berhasil diunduh.");
        } catch {
            message.error("Gagal mengekspor data.");
        } finally {
            setExportLoading(false);
        }
    };

    // ── Reset Tahunan ─────────────────────────────
    const handleResetTahunan = () => {
        Modal.confirm({
            title: null,
            icon: null,
            content: (
                <div style={{ padding: "4px 0 8px" }}>
                    <div style={{
                        display: "flex", alignItems: "center", gap: 12,
                        marginBottom: 20,
                    }}>
                        <div style={{
                            width: 48, height: 48, borderRadius: 12,
                            background: "linear-gradient(135deg,#7F1D1D 0%,#DC2626 100%)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 20, color: "#fff", flexShrink: 0,
                            boxShadow: "0 6px 16px rgba(220,38,38,0.35)",
                        }}>
                            <ExclamationCircleOutlined />
                        </div>
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 900, color: token.colorText, letterSpacing: "-0.3px" }}>
                                Reset Sistem Kedisiplinan
                            </div>
                            <div style={{ fontSize: 12, color: token.colorTextSecondary, marginTop: 2 }}>
                                Pemulihan data tahunan
                            </div>
                        </div>
                    </div>
                    <div style={{
                        padding: "14px 16px", borderRadius: 12,
                        background: "rgba(220,38,38,0.07)",
                        border: "1.5px solid rgba(220,38,38,0.20)",
                    }}>
                        <div style={{ fontSize: 13, color: "#DC2626", fontWeight: 700, marginBottom: 6 }}>
                            ⚠ Tindakan ini akan menghapus SEMUA riwayat pelanggaran
                        </div>
                        <div style={{ fontSize: 12, color: token.colorTextSecondary, lineHeight: 1.6 }}>
                            Total <strong>{stats.total} record</strong> pelanggaran dengan akumulasi{" "}
                            <strong>{stats.totalPoin} poin</strong> akan dihapus permanen.
                            Proses ini tidak dapat dibatalkan.
                        </div>
                    </div>
                </div>
            ),
            okText: "Ya, Reset Sekarang",
            okType: "danger",
            cancelText: "Batal, Kembali",
            okButtonProps: {
                style: {
                    background: "linear-gradient(135deg,#7F1D1D 0%,#DC2626 100%)",
                    border: "none", fontWeight: 800, borderRadius: 8,
                },
            },
            onOk: async () => {
                try {
                    const { error } = await supabaseClient.rpc("reset_pelanggaran");
                    if (error) throw error;
                    message.success("Sistem poin berhasil di-reset untuk tahun ajaran baru.");
                    window.location.reload();
                } catch (err: any) {
                    message.error("Gagal mereset: " + err.message);
                }
            },
        });
    };

    // ── KPI Card sub-component ────────────────────
    const KpiCard = ({
        label, value, sub, color, gradient, icon, onClick, active,
    }: {
        label: string; value: React.ReactNode; sub?: string;
        color: string; gradient: string; icon: React.ReactNode;
        onClick?: () => void; active?: boolean;
    }) => (
        <Card
            bordered={false}
            onClick={onClick}
            bodyStyle={{ padding: "18px 20px 16px" }}
            style={{
                background: token.colorBgContainer,
                borderRadius: 16, overflow: "hidden", position: "relative",
                boxShadow: active ? `0 8px 28px ${color}28` : G.shadow,
                border: active ? `2px solid ${color}45` : G.cardBorder,
                cursor: onClick ? "pointer" : "default",
                transition: "all 0.2s cubic-bezier(.4,0,.2,1)",
            }}
        >
            <div style={{
                position: "absolute", top: 0, left: 0, right: 0,
                height: 3, background: gradient,
            }} />
            {active && (
                <div style={{
                    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                    background: `${color}05`, pointerEvents: "none",
                }} />
            )}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ flex: 1 }}>
                    <div style={{
                        fontSize: 9, fontWeight: 800, letterSpacing: "1.3px",
                        textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 9,
                    }}>
                        {label}
                    </div>
                    <div style={{
                        fontSize: 28, fontWeight: 900, color,
                        lineHeight: 1, letterSpacing: "-1.5px", marginBottom: 7,
                    }}>
                        {value}
                    </div>
                    {sub && (
                        <div style={{ fontSize: 11, color: token.colorTextSecondary, fontWeight: 500 }}>
                            {sub}
                        </div>
                    )}
                </div>
                <div style={{
                    width: 44, height: 44, borderRadius: 11, background: gradient,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 19, color: "#fff", flexShrink: 0, marginLeft: 12,
                    boxShadow: `0 5px 14px ${color}30`,
                }}>
                    {icon}
                </div>
            </div>
        </Card>
    );

    // ── Columns ───────────────────────────────────
    const columns: ProColumns<IPelanggaranSantri>[] = [
        {
            title: "TANGGAL",
            dataIndex: "tanggal",
            width: 155,
            fixed: "left",
            sorter: true,
            render: (_, record) => (
                <div>
                    <div style={{
                        fontWeight: 700, fontSize: 13, color: token.colorText,
                        letterSpacing: "-0.2px",
                    }}>
                        {dayjs(record.tanggal).format("DD MMM YYYY")}
                    </div>
                    <div style={{ fontSize: 11, color: G.text, fontWeight: 600, marginTop: 3 }}>
                        {formatHijri(record.tanggal)}
                    </div>
                    <div style={{
                        fontSize: 10, color: token.colorTextTertiary,
                        marginTop: 3, fontWeight: 500,
                    }}>
                        {dayjs(record.tanggal).fromNow() || dayjs(record.tanggal).format("dddd")}
                    </div>
                </div>
            ),
        },
        {
            title: "SANTRI",
            dataIndex: "santri_nis",
            width: 260,
            render: (_, record) => (
                <Space size={11} align="center">
                    <div style={{ position: "relative", flexShrink: 0 }}>
                        <Avatar
                            src={record.santri?.foto_url}
                            size={44}
                            icon={<UserOutlined />}
                            style={{
                                background: G.bg,
                                border: `2px solid ${G.border}`,
                                color: G.text,
                            }}
                        />
                        {/* Severity dot indicator */}
                        <div style={{
                            position: "absolute", bottom: 0, right: 0,
                            width: 12, height: 12, borderRadius: "50%",
                            background: SEVERITY[record.jenis_pelanggaran as JenisKey]?.color || "#6B7280",
                            border: `2px solid ${token.colorBgContainer}`,
                        }} />
                    </div>
                    <div>
                        <div style={{
                            fontWeight: 800, fontSize: 13.5, color: token.colorText,
                            lineHeight: 1.25, letterSpacing: "-0.2px",
                        }}>
                            {record.santri?.nama || santriAlias(record.santri?.nis) || "—"}
                        </div>
                        <div style={{ display: "flex", gap: 5, marginTop: 5, flexWrap: "wrap" }}>
                            <span style={{
                                fontSize: 10, padding: "1px 7px", borderRadius: 4,
                                background: token.colorFillAlter,
                                border: `1px solid ${token.colorBorderSecondary}`,
                                color: token.colorTextSecondary, fontWeight: 700,
                            }}>
                                Kls {record.santri?.kelas}
                            </span>
                            <span style={{
                                fontSize: 10, padding: "1px 7px", borderRadius: 4,
                                background: "rgba(6,182,212,0.07)",
                                border: "1px solid rgba(6,182,212,0.20)",
                                color: "#0891B2", fontWeight: 700,
                            }}>
                                {record.santri?.jurusan}
                            </span>
                        </div>
                    </div>
                </Space>
            ),
        },
        {
            title: "KATEGORI",
            dataIndex: "jenis_pelanggaran",
            width: 130,
            align: "center",
            render: (_, record) => {
                const s = SEVERITY[record.jenis_pelanggaran as JenisKey];
                if (!s) return null;
                return (
                    <div style={{ display: "flex", justifyContent: "center" }}>
                        <span style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            padding: "5px 13px", borderRadius: 20, fontSize: 10,
                            fontWeight: 900, letterSpacing: "0.7px",
                            background: s.bg, color: s.color, border: `1.5px solid ${s.border}`,
                        }}>
                            {s.icon}
                            {s.label.toUpperCase()}
                        </span>
                    </div>
                );
            },
        },
        {
            title: "POIN",
            dataIndex: "poin",
            width: 110,
            align: "center",
            sorter: true,
            render: (_, record) => {
                const poin = Number(record.poin || 0);
                const isHigh = poin >= 50;
                const isMed = poin >= 20 && poin < 50;
                const col = isHigh ? "#DC2626" : isMed ? "#D97706" : "#059669";
                const bg = isHigh ? "rgba(220,38,38,0.08)" : isMed ? "rgba(217,119,6,0.08)" : "rgba(5,150,105,0.08)";
                return (
                    <div style={{ textAlign: "center" }}>
                        <div style={{
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            width: 48, height: 48, borderRadius: "50%",
                            background: bg, border: `2px solid ${col}28`,
                            flexDirection: "column",
                        }}>
                            <span style={{
                                fontFamily: "ui-monospace,'Courier New',monospace",
                                fontWeight: 900, fontSize: 16, color: col,
                                lineHeight: 1,
                            }}>
                                {poin}
                            </span>
                        </div>
                        <div style={{
                            fontSize: 9, color: token.colorTextTertiary,
                            marginTop: 4, fontWeight: 700, letterSpacing: "0.5px",
                            textTransform: "uppercase",
                        }}>
                            POIN
                        </div>
                    </div>
                );
            },
        },
        {
            title: "HUKUMAN / TINDAKAN",
            dataIndex: "hukuman",
            width: 210,
            render: (_, record) => (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <div style={{
                        width: 24, height: 24, borderRadius: 6, flexShrink: 0, marginTop: 1,
                        background: "rgba(220,38,38,0.08)",
                        border: "1px solid rgba(220,38,38,0.18)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                        <ThunderboltOutlined style={{ fontSize: 11, color: "#DC2626" }} />
                    </div>
                    <Paragraph
                        ellipsis={{ rows: 2, tooltip: record.hukuman }}
                        style={{
                            margin: 0, fontSize: 12, fontWeight: 600,
                            color: isDark ? "#FCA5A5" : "#9B1C1C",
                            lineHeight: 1.5,
                        }}
                    >
                        {record.hukuman || "—"}
                    </Paragraph>
                </div>
            ),
        },
        {
            title: "KRONOLOGI / CATATAN",
            dataIndex: "catatan",
            width: 255,
            render: (_, record) => (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <div style={{
                        width: 24, height: 24, borderRadius: 6, flexShrink: 0, marginTop: 1,
                        background: token.colorFillAlter,
                        border: `1px solid ${token.colorBorderSecondary}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                        <FileTextOutlined style={{ fontSize: 11, color: token.colorTextTertiary }} />
                    </div>
                    <Paragraph
                        ellipsis={{ rows: 2, tooltip: record.catatan || undefined }}
                        style={{
                            margin: 0, fontSize: 12, color: token.colorTextSecondary,
                            lineHeight: 1.5,
                        }}
                    >
                        {record.catatan || <span style={{ opacity: 0.45, fontStyle: "italic" }}>Tidak ada catatan</span>}
                    </Paragraph>
                </div>
            ),
        },
        {
            title: "AKSI",
            valueType: "option",
            width: 90,
            fixed: "right",
            render: (_, record) => (
                <Space size={5}>
                    <Tooltip title="Edit Pelanggaran">
                        <Button
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => edit("pelanggaran_santri", record.id)}
                            style={{
                                border: `1.5px solid ${G.border}`,
                                color: G.text, background: G.bg,
                                borderRadius: 7, width: 30, height: 30,
                                display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                        />
                    </Tooltip>
                    <Popconfirm
                        title="Hapus Pelanggaran?"
                        description={
                            <span style={{ fontSize: 12 }}>
                                Data ini akan dihapus permanen.
                            </span>
                        }
                        onConfirm={() =>
                            deleteMutate({ resource: "pelanggaran_santri", id: record.id })
                        }
                        okText="Hapus"
                        cancelText="Batal"
                        okButtonProps={{ danger: true, size: "small" }}
                    >
                        <Tooltip title="Hapus Data">
                            <Button
                                danger size="small"
                                icon={<DeleteOutlined />}
                                style={{
                                    borderRadius: 7, width: 30, height: 30,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                }}
                            />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    // ── RENDER ────────────────────────────────────
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 18, paddingBottom: 80 }}>

            <style>{`
                .pelang-table .ant-table-thead .ant-table-cell {
                    background: ${isDark ? "rgba(245,158,11,0.09)" : "rgba(212,160,23,0.07)"} !important;
                    font-size: 10px !important; font-weight: 800 !important;
                    letter-spacing: 1.1px !important; text-transform: uppercase !important;
                    color: ${G.text} !important;
                    border-bottom: 2px solid ${G.borderStrong} !important;
                    padding: 12px 14px !important;
                }
                .pelang-table .ant-table-row:hover .ant-table-cell {
                    background: ${isDark ? "rgba(245,158,11,0.04)" : "rgba(212,160,23,0.03)"} !important;
                }
                .pelang-table .ant-table-cell {
                    transition: background 0.16s ease !important;
                    border-bottom: 1px solid ${token.colorBorderSecondary} !important;
                    padding: 12px 14px !important;
                }
                .pelang-table .ant-pro-table-list-toolbar {
                    padding: 14px 16px !important;
                    border-bottom: 1px solid ${G.border} !important;
                }
                .pelang-table .ant-table-body::-webkit-scrollbar { height: 5px; }
                .pelang-table .ant-table-body::-webkit-scrollbar-thumb {
                    background: ${G.border}; border-radius: 3px;
                }
                /* Berat row highlight */
                .pelang-table .row-berat > td {
                    background: ${isDark ? "rgba(220,38,38,0.04)" : "rgba(220,38,38,0.025)"} !important;
                }
                .pelang-table .row-berat:hover > td {
                    background: ${isDark ? "rgba(220,38,38,0.07)" : "rgba(220,38,38,0.05)"} !important;
                }
            `}</style>

            {/* ═══════════════════════════════════════════
                MASTHEAD
            ═══════════════════════════════════════════ */}
            <div style={{
                padding: "20px 24px",
                background: token.colorBgContainer,
                borderRadius: 16, boxShadow: G.shadow, border: G.cardBorder,
                position: "relative", overflow: "hidden",
                display: "flex", alignItems: "center",
                justifyContent: "space-between", flexWrap: "wrap", gap: 14,
            }}>
                {/* Red left accent — discipline context */}
                <div style={{
                    position: "absolute", left: 0, top: 0, bottom: 0, width: 4,
                    background: "linear-gradient(180deg,#7F1D1D 0%,#DC2626 50%,#F59E0B 100%)",
                    borderRadius: "16px 0 0 16px",
                }} />
                <div style={{
                    position: "absolute", right: -35, top: -35,
                    width: 130, height: 130, borderRadius: "50%",
                    background: isDark ? "rgba(220,38,38,0.04)" : "rgba(220,38,38,0.03)",
                    pointerEvents: "none",
                }} />

                <div style={{ display: "flex", alignItems: "center", gap: 14, paddingLeft: 10 }}>
                    <div style={{
                        width: 50, height: 50, borderRadius: 13,
                        background: "linear-gradient(135deg,#7F1D1D 0%,#DC2626 55%,#F87171 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 22, color: "#fff",
                        boxShadow: "0 6px 20px rgba(220,38,38,0.38)",
                    }}>
                        <WarningOutlined />
                    </div>
                    <div>
                        <div style={{
                            fontSize: 20, fontWeight: 900, color: token.colorText,
                            letterSpacing: "-0.5px", lineHeight: 1.2,
                        }}>
                            Buku Kedisiplinan Santri
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 11, color: token.colorTextSecondary }}>
                                Monitoring & Manajemen Pelanggaran
                            </span>
                            <span style={{
                                fontSize: 10, padding: "2px 9px", borderRadius: 20,
                                background: G.bg, border: `1px solid ${G.border}`,
                                color: G.text, fontWeight: 800, letterSpacing: "0.5px",
                            }}>
                                ✦ {formatHijri(new Date())}
                            </span>
                            {stats.thisMonth > 0 && (
                                <span style={{
                                    fontSize: 10, padding: "2px 9px", borderRadius: 20,
                                    background: "rgba(220,38,38,0.08)",
                                    border: "1px solid rgba(220,38,38,0.22)",
                                    color: "#DC2626", fontWeight: 800,
                                }}>
                                    {stats.thisMonth} pelanggaran bulan ini
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <Space size={8}>
                    <Tooltip title="Reset Sistem Tahunan">
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={handleResetTahunan}
                            style={{
                                border: "1.5px solid rgba(220,38,38,0.28)",
                                color: "#DC2626", background: "rgba(220,38,38,0.06)",
                                borderRadius: 9, height: 38,
                            }}
                        >
                            Reset Tahunan
                        </Button>
                    </Tooltip>
                    <Button
                        icon={<DownloadOutlined />}
                        loading={exportLoading}
                        onClick={exportToExcel}
                        style={{
                            borderRadius: 9, fontWeight: 700, height: 38,
                            border: "1.5px solid rgba(16,185,129,0.28)",
                            color: "#059669", background: "rgba(16,185,129,0.07)",
                        }}
                    >
                        Export Excel
                    </Button>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => create("pelanggaran_santri")}
                        style={{
                            background: "linear-gradient(135deg,#7F1D1D 0%,#DC2626 55%,#F87171 100%)",
                            border: "none", borderRadius: 9, fontWeight: 700, height: 38,
                            boxShadow: "0 4px 14px rgba(220,38,38,0.32)",
                        }}
                    >
                        Catat Pelanggaran
                    </Button>
                </Space>
            </div>

            {/* ═══════════════════════════════════════════
                KPI CARDS (clickable — filter by category)
            ═══════════════════════════════════════════ */}
            <Row gutter={[14, 14]}>
                <Col xs={24} sm={12} xl={5}>
                    <KpiCard
                        label="Total Pelanggaran"
                        value={<span style={{ fontSize: 36 }}>{stats.total}</span>}
                        sub={`Akumulasi ${stats.totalPoin} poin`}
                        color={isDark ? "#F59E0B" : "#B45309"}
                        gradient={G.gradient}
                        icon={<BarChartOutlined />}
                    />
                </Col>
                <Col xs={24} sm={12} xl={5}>
                    <KpiCard
                        label="Pelanggaran Ringan"
                        value={<span style={{ fontSize: 36 }}>{stats.ringan}</span>}
                        sub={`${stats.total ? Math.round((stats.ringan / stats.total) * 100) : 0}% dari total`}
                        color={SEVERITY.RINGAN.color}
                        gradient={SEVERITY.RINGAN.gradient}
                        icon={SEVERITY.RINGAN.icon}
                        onClick={() => setViewMode(viewMode === "ringan" ? "all" : "ringan")}
                        active={viewMode === "ringan"}
                    />
                </Col>
                <Col xs={24} sm={12} xl={5}>
                    <KpiCard
                        label="Pelanggaran Sedang"
                        value={<span style={{ fontSize: 36 }}>{stats.sedang}</span>}
                        sub={`${stats.total ? Math.round((stats.sedang / stats.total) * 100) : 0}% dari total`}
                        color={SEVERITY.SEDANG.color}
                        gradient={SEVERITY.SEDANG.gradient}
                        icon={SEVERITY.SEDANG.icon}
                        onClick={() => setViewMode(viewMode === "sedang" ? "all" : "sedang")}
                        active={viewMode === "sedang"}
                    />
                </Col>
                <Col xs={24} sm={12} xl={5}>
                    <KpiCard
                        label="Pelanggaran Berat"
                        value={<span style={{ fontSize: 36 }}>{stats.berat}</span>}
                        sub={`${stats.total ? Math.round((stats.berat / stats.total) * 100) : 0}% dari total`}
                        color={SEVERITY.BERAT.color}
                        gradient={SEVERITY.BERAT.gradient}
                        icon={SEVERITY.BERAT.icon}
                        onClick={() => setViewMode(viewMode === "berat" ? "all" : "berat")}
                        active={viewMode === "berat"}
                    />
                </Col>

                {/* Compliance / Distribution Card */}
                <Col xs={24} sm={24} xl={4}>
                    <Card
                        bordered={false}
                        bodyStyle={{ padding: "18px 20px 16px" }}
                        style={{
                            background: token.colorBgContainer, borderRadius: 16,
                            overflow: "hidden", position: "relative",
                            boxShadow: G.shadow, border: G.cardBorder, height: "100%",
                        }}
                    >
                        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: G.gradient }} />
                        <div style={{
                            fontSize: 9, fontWeight: 800, letterSpacing: "1.3px",
                            textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 14,
                        }}>
                            Distribusi Kategori
                        </div>
                        {stats.total > 0 ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {(["RINGAN", "SEDANG", "BERAT"] as JenisKey[]).map((k) => {
                                    const cnt = k === "RINGAN" ? stats.ringan : k === "SEDANG" ? stats.sedang : stats.berat;
                                    const pct = Math.round((cnt / stats.total) * 100);
                                    const s = SEVERITY[k];
                                    return (
                                        <div key={k}>
                                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                                <span style={{ fontSize: 10, fontWeight: 700, color: s.color }}>{s.label}</span>
                                                <span style={{ fontSize: 10, fontWeight: 800, color: token.colorText, fontFamily: "monospace" }}>
                                                    {cnt} <span style={{ color: token.colorTextTertiary, fontWeight: 500 }}>({pct}%)</span>
                                                </span>
                                            </div>
                                            <Progress
                                                percent={pct}
                                                showInfo={false}
                                                strokeColor={s.gradient}
                                                trailColor={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}
                                                strokeWidth={6}
                                                style={{ margin: 0 }}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{ textAlign: "center", color: token.colorTextTertiary, fontSize: 12, paddingTop: 10 }}>
                                Belum ada data
                            </div>
                        )}
                    </Card>
                </Col>
            </Row>

            {/* ═══════════════════════════════════════════
                TOP OFFENDERS + FILTER — 2 col layout
            ═══════════════════════════════════════════ */}
            <Row gutter={[14, 14]}>
                {/* Top Pelanggar Card */}
                <Col xs={24} lg={8}>
                    <Card
                        bordered={false}
                        bodyStyle={{ padding: "18px 20px" }}
                        style={{
                            background: token.colorBgContainer, borderRadius: 16,
                            boxShadow: G.shadow, border: G.cardBorder,
                            position: "relative", overflow: "hidden", height: "100%",
                        }}
                    >
                        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,#7F1D1D,#DC2626,#F87171)" }} />
                        <div style={{
                            display: "flex", alignItems: "center", gap: 9, marginBottom: 16,
                        }}>
                            <div style={{
                                width: 30, height: 30, borderRadius: 8,
                                background: "rgba(220,38,38,0.09)",
                                border: "1px solid rgba(220,38,38,0.20)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 14, color: "#DC2626",
                            }}>
                                <TrophyOutlined />
                            </div>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 800, color: token.colorText }}>
                                    Top Pelanggar
                                </div>
                                <div style={{ fontSize: 10, color: token.colorTextTertiary }}>
                                    Berdasarkan akumulasi poin
                                </div>
                            </div>
                        </div>

                        {stats.topOffenders.length === 0 ? (
                            <div style={{ textAlign: "center", color: token.colorTextTertiary, fontSize: 12, padding: "20px 0" }}>
                                Belum ada data pelanggaran
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {stats.topOffenders.map(([nis, data], idx) => (
                                    <div key={nis} style={{
                                        display: "flex", alignItems: "center", gap: 10,
                                        padding: "10px 12px", borderRadius: 10,
                                        background: idx === 0
                                            ? "rgba(220,38,38,0.06)"
                                            : token.colorFillAlter,
                                        border: `1px solid ${idx === 0 ? "rgba(220,38,38,0.18)" : token.colorBorderSecondary}`,
                                    }}>
                                        <div style={{
                                            width: 24, height: 24, borderRadius: "50%",
                                            background: idx === 0
                                                ? "linear-gradient(135deg,#DC2626,#F87171)"
                                                : idx === 1
                                                    ? "linear-gradient(135deg,#D97706,#F59E0B)"
                                                    : "linear-gradient(135deg,#6B7280,#9CA3AF)",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            fontSize: 11, fontWeight: 900, color: "#fff",
                                            flexShrink: 0,
                                        }}>
                                            {idx + 1}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{
                                                fontWeight: 700, fontSize: 12.5, color: token.colorText,
                                                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                            }}>
                                                {data.nama}
                                            </div>
                                            <div style={{ fontSize: 10, color: token.colorTextTertiary, marginTop: 1 }}>
                                                {data.count} kasus
                                            </div>
                                        </div>
                                        <div style={{
                                            fontFamily: "ui-monospace,monospace",
                                            fontWeight: 900, fontSize: 16,
                                            color: idx === 0 ? "#DC2626" : token.colorText,
                                        }}>
                                            {data.poin}
                                            <span style={{ fontSize: 9, fontWeight: 600, color: token.colorTextTertiary, marginLeft: 2 }}>
                                                poin
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </Col>

                {/* Filter Panel */}
                <Col xs={24} lg={16}>
                    <Card
                        bordered={false}
                        bodyStyle={{ padding: "18px 20px" }}
                        style={{
                            background: token.colorBgContainer, borderRadius: 16,
                            boxShadow: G.shadow, border: `1px solid ${G.border}`,
                            position: "relative", overflow: "hidden", height: "100%",
                        }}
                    >
                        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: G.gradient }} />

                        {/* Filter header */}
                        <div style={{
                            display: "flex", alignItems: "center",
                            justifyContent: "space-between", marginBottom: 16,
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{
                                    width: 28, height: 28, borderRadius: 7,
                                    background: G.bg, border: `1px solid ${G.border}`,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                }}>
                                    <FilterOutlined style={{ color: G.text, fontSize: 13 }} />
                                </div>
                                <span style={{
                                    fontSize: 10, fontWeight: 900, letterSpacing: "1.2px",
                                    textTransform: "uppercase", color: G.text,
                                }}>
                                    Filter Data
                                </span>
                                {hasActiveFilter && (
                                    <span style={{
                                        fontSize: 10, padding: "1px 8px", borderRadius: 10,
                                        background: "rgba(220,38,38,0.08)",
                                        border: "1px solid rgba(220,38,38,0.22)",
                                        color: "#DC2626", fontWeight: 800,
                                    }}>
                                        Aktif
                                    </span>
                                )}
                            </div>
                            {hasActiveFilter && (
                                <Button
                                    size="small"
                                    onClick={clearFilters}
                                    style={{
                                        fontSize: 11, height: 26, borderRadius: 6,
                                        border: `1px solid ${G.border}`,
                                        color: token.colorTextSecondary,
                                    }}
                                >
                                    Hapus Semua Filter
                                </Button>
                            )}
                        </div>

                        <Row gutter={[12, 12]}>
                            {/* Kelas */}
                            <Col xs={12} sm={8}>
                                <div style={{
                                    fontSize: 9, fontWeight: 800, letterSpacing: "1px",
                                    textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 5,
                                }}>
                                    Kelas
                                </div>
                                <Select
                                    allowClear
                                    placeholder="Semua Kelas"
                                    value={filterKelas}
                                    onChange={setFilterKelas}
                                    style={{ width: "100%" }}
                                    options={[1, 2, 3].map((k) => ({
                                        label: `Kelas ${k}`, value: `${k}`,
                                    }))}
                                />
                            </Col>

                            {/* Takhasus */}
                            <Col xs={12} sm={8}>
                                <div style={{
                                    fontSize: 9, fontWeight: 800, letterSpacing: "1px",
                                    textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 5,
                                }}>
                                    Takhasus
                                </div>
                                <Select
                                    allowClear
                                    placeholder="Semua Takhasus"
                                    value={filterJurusan}
                                    onChange={setFilterJurusan}
                                    style={{ width: "100%" }}
                                    options={[
                                        { label: "Tahfidz", value: "TAHFIDZ" },
                                        { label: "Kitab", value: "KITAB" },
                                    ]}
                                />
                            </Col>

                            {/* Kategori */}
                            <Col xs={12} sm={8}>
                                <div style={{
                                    fontSize: 9, fontWeight: 800, letterSpacing: "1px",
                                    textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 5,
                                }}>
                                    Kategori
                                </div>
                                <Select
                                    allowClear
                                    placeholder="Semua Kategori"
                                    value={filterKategori}
                                    onChange={setFilterKategori}
                                    style={{ width: "100%" }}
                                    options={[
                                        { label: "🟢 Ringan", value: "RINGAN" },
                                        { label: "🟡 Sedang", value: "SEDANG" },
                                        { label: "🔴 Berat", value: "BERAT" },
                                    ]}
                                />
                            </Col>

                            {/* Date Range */}
                            <Col xs={24} sm={16}>
                                <div style={{
                                    fontSize: 9, fontWeight: 800, letterSpacing: "1px",
                                    textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 5,
                                }}>
                                    Rentang Tanggal
                                </div>
                                <RangePicker
                                    value={filterDateRange}
                                    onChange={(dates) => setFilterDateRange(dates as any)}
                                    style={{ width: "100%" }}
                                    format="DD MMM YYYY"
                                    allowClear
                                    presets={[
                                        { label: "7 Hari Terakhir", value: [dayjs().subtract(7, "day"), dayjs()] },
                                        { label: "Bulan Ini", value: [dayjs().startOf("month"), dayjs().endOf("month")] },
                                        { label: "Bulan Lalu", value: [dayjs().subtract(1, "month").startOf("month"), dayjs().subtract(1, "month").endOf("month")] },
                                        { label: "3 Bulan Terakhir", value: [dayjs().subtract(3, "month"), dayjs()] },
                                    ]}
                                />
                            </Col>

                            {/* Quick filter by severity */}
                            <Col xs={24} sm={8}>
                                <div style={{
                                    fontSize: 9, fontWeight: 800, letterSpacing: "1px",
                                    textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 5,
                                }}>
                                    Tampilkan
                                </div>
                                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                                    {(["all", "ringan", "sedang", "berat"] as const).map((v) => {
                                        const isActive = viewMode === v;
                                        const col = v === "all" ? G.text : v === "ringan" ? SEVERITY.RINGAN.color : v === "sedang" ? SEVERITY.SEDANG.color : SEVERITY.BERAT.color;
                                        const bg = v === "all" ? G.bg : v === "ringan" ? SEVERITY.RINGAN.bg : v === "sedang" ? SEVERITY.SEDANG.bg : SEVERITY.BERAT.bg;
                                        const border = v === "all" ? G.border : v === "ringan" ? SEVERITY.RINGAN.border : v === "sedang" ? SEVERITY.SEDANG.border : SEVERITY.BERAT.border;
                                        return (
                                            <button
                                                key={v}
                                                onClick={() => setViewMode(v)}
                                                style={{
                                                    padding: "3px 10px", borderRadius: 20, fontSize: 10,
                                                    fontWeight: 800, cursor: "pointer", outline: "none",
                                                    border: `1.5px solid ${isActive ? col : token.colorBorderSecondary}`,
                                                    background: isActive ? bg : "transparent",
                                                    color: isActive ? col : token.colorTextTertiary,
                                                    transition: "all 0.15s ease",
                                                    textTransform: "capitalize",
                                                }}
                                            >
                                                {v === "all" ? "Semua" : v}
                                            </button>
                                        );
                                    })}
                                </div>
                            </Col>
                        </Row>

                        {/* Active filter summary */}
                        {hasActiveFilter && (
                            <div style={{
                                marginTop: 14, paddingTop: 12,
                                borderTop: `1px solid ${token.colorBorderSecondary}`,
                                display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                            }}>
                                <span style={{ fontSize: 10, color: token.colorTextTertiary, fontWeight: 700 }}>
                                    Menampilkan:
                                </span>
                                <span style={{
                                    fontSize: 11, fontWeight: 800,
                                    color: isDark ? "#F59E0B" : "#B45309",
                                }}>
                                    {filteredData.length} dari {allData.length} record
                                </span>
                                {filterKelas && (
                                    <Tag closable onClose={() => setFilterKelas(null)}
                                        style={{ borderRadius: 6, fontSize: 10, fontWeight: 700 }}>
                                        Kelas {filterKelas}
                                    </Tag>
                                )}
                                {filterJurusan && (
                                    <Tag closable onClose={() => setFilterJurusan(null)}
                                        style={{ borderRadius: 6, fontSize: 10, fontWeight: 700 }}>
                                        {filterJurusan}
                                    </Tag>
                                )}
                                {filterKategori && (
                                    <Tag
                                        closable
                                        onClose={() => setFilterKategori(null)}
                                        color={filterKategori === "BERAT" ? "red" : filterKategori === "SEDANG" ? "orange" : "green"}
                                        style={{ borderRadius: 6, fontSize: 10, fontWeight: 700 }}
                                    >
                                        {filterKategori}
                                    </Tag>
                                )}
                                {filterDateRange && (
                                    <Tag closable onClose={() => setFilterDateRange(null)}
                                        style={{ borderRadius: 6, fontSize: 10, fontWeight: 700 }}>
                                        {filterDateRange[0].format("DD MMM")} – {filterDateRange[1].format("DD MMM YYYY")}
                                    </Tag>
                                )}
                                {viewMode !== "all" && (
                                    <Tag closable onClose={() => setViewMode("all")}
                                        color={viewMode === "berat" ? "red" : viewMode === "sedang" ? "orange" : "green"}
                                        style={{ borderRadius: 6, fontSize: 10, fontWeight: 700 }}>
                                        Tampil: {viewMode}
                                    </Tag>
                                )}
                            </div>
                        )}
                    </Card>
                </Col>
            </Row>

            {/* ═══════════════════════════════════════════
                DATA TABLE
            ═══════════════════════════════════════════ */}
            <div style={{
                background: token.colorBgContainer,
                borderRadius: 16, overflow: "hidden",
                boxShadow: G.shadow, border: G.cardBorder,
            }}>
                <ProTable<IPelanggaranSantri>
                    {...finalTableProps}
                    columns={columns}
                    rowKey="id"
                    search={false}
                    className="pelang-table"
                    scroll={{ x: 1100 }}
                    rowClassName={(record) =>
                        record.jenis_pelanggaran === "BERAT" ? "row-berat" : ""
                    }
                    headerTitle={
                        <Space size={10} align="center">
                            <div style={{
                                width: 34, height: 34, borderRadius: 9,
                                background: "linear-gradient(135deg,#7F1D1D 0%,#DC2626 100%)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 15, color: "#fff",
                            }}>
                                <WarningOutlined />
                            </div>
                            <div>
                                <div style={{
                                    fontSize: 14, fontWeight: 800, color: token.colorText,
                                    letterSpacing: "-0.3px",
                                }}>
                                    Riwayat Pelanggaran
                                    {viewMode !== "all" && (
                                        <span style={{
                                            marginLeft: 8, fontSize: 11, padding: "1px 9px", borderRadius: 10,
                                            background: viewMode === "berat"
                                                ? "rgba(220,38,38,0.09)"
                                                : viewMode === "sedang"
                                                    ? "rgba(217,119,6,0.09)"
                                                    : "rgba(5,150,105,0.09)",
                                            color: viewMode === "berat" ? "#DC2626"
                                                : viewMode === "sedang" ? "#D97706" : "#059669",
                                            fontWeight: 800, border: "1px solid currentColor",
                                            borderColor: "inherit", verticalAlign: "middle",
                                        }}>
                                            {viewMode.toUpperCase()}
                                        </span>
                                    )}
                                </div>
                                <div style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 1 }}>
                                    {filteredData.length} record · Diperbarui {formatHijri(new Date())}
                                </div>
                            </div>
                        </Space>
                    }
                    toolBarRender={() => [
                        <Button
                            key="export"
                            icon={<DownloadOutlined />}
                            loading={exportLoading}
                            onClick={exportToExcel}
                            style={{ borderRadius: 8, fontWeight: 700 }}
                        >
                            Export
                        </Button>,
                        <Button
                            key="create"
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => create("pelanggaran_santri")}
                            style={{
                                background: "linear-gradient(135deg,#7F1D1D 0%,#DC2626 100%)",
                                border: "none", borderRadius: 8, fontWeight: 700,
                                boxShadow: "0 3px 10px rgba(220,38,38,0.30)",
                            }}
                        >
                            Catat
                        </Button>,
                    ]}
                    cardProps={{ bodyStyle: { padding: 0 } }}
                    tableStyle={{ padding: 0 }}
                    pagination={{
                        ...finalTableProps.pagination,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (total, range) =>
                            `${range[0]}-${range[1]} dari ${total} pelanggaran`,
                    }}
                />
            </div>
        </div>
    );
};
