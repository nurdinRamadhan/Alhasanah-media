import React, { useState, useMemo } from "react";
import { logActivity } from "../../utility/logger";
import { useTable, useSelect } from "@refinedev/antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import {
    Space, Button, Typography, Tooltip, message, Select,
    Modal, Avatar, Card, Row, Col, Tag, DatePicker,
    Progress, Popconfirm, theme, Divider, Badge,
} from "antd";
import {
    PlusOutlined, CheckCircleOutlined, CloseCircleOutlined,
    LoginOutlined, FileProtectOutlined, EditOutlined,
    DeleteOutlined, DownloadOutlined, UserOutlined,
    FileExcelOutlined, FilterOutlined, CalendarOutlined,
    TeamOutlined, ClockCircleOutlined, BarChartOutlined,
    SafetyOutlined, StopOutlined, SwapOutlined,
    SyncOutlined, HomeOutlined, ExportOutlined,
} from "@ant-design/icons";
import { IPerizinanSantri, ISantri, IUserIdentity } from "../../types";
import { useNavigation, useUpdate, useDelete, useGetIdentity } from "@refinedev/core";
import { formatHijri, formatMasehi } from "../../utility/dateHelper";
import dayjs from "dayjs";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { supabaseClient } from "../../utility/supabaseClient";
import { useColorMode } from "../../contexts/color-mode";

const { Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;
const { useToken } = theme;

// ─────────────────────────────────────────────────────────────
//  STATUS CONFIG
// ─────────────────────────────────────────────────────────────
const STATUS_MAP = {
    PENDING: {
        label: "Menunggu",
        color: "#D97706",
        bg: "rgba(217,119,6,0.09)",
        border: "rgba(217,119,6,0.28)",
        gradient: "linear-gradient(135deg,#78350F 0%,#D97706 55%,#F59E0B 100%)",
        icon: <ClockCircleOutlined />,
    },
    APPROVED: {
        label: "Disetujui",
        color: "#059669",
        bg: "rgba(5,150,105,0.09)",
        border: "rgba(5,150,105,0.24)",
        gradient: "linear-gradient(135deg,#065F46 0%,#059669 55%,#10B981 100%)",
        icon: <CheckCircleOutlined />,
    },
    REJECTED: {
        label: "Ditolak",
        color: "#DC2626",
        bg: "rgba(220,38,38,0.08)",
        border: "rgba(220,38,38,0.22)",
        gradient: "linear-gradient(135deg,#7F1D1D 0%,#DC2626 55%,#F87171 100%)",
        icon: <StopOutlined />,
    },
    KEMBALI: {
        label: "Sudah Kembali",
        color: "#4F46E5",
        bg: "rgba(79,70,229,0.08)",
        border: "rgba(79,70,229,0.22)",
        gradient: "linear-gradient(135deg,#1E1B4B 0%,#4F46E5 55%,#818CF8 100%)",
        icon: <HomeOutlined />,
    },
} as const;

type StatusKey = keyof typeof STATUS_MAP;

// ─────────────────────────────────────────────────────────────
//  PERIZINAN DESIGN TOKENS (Indigo/Blue accent)
// ─────────────────────────────────────────────────────────────
const IZN = {
    primary:    "#4F46E5",
    primaryBg:  "rgba(79,70,229,0.08)",
    primaryBdr: "rgba(79,70,229,0.22)",
    primaryGrad:"linear-gradient(135deg,#1E1B4B 0%,#4F46E5 55%,#818CF8 100%)",
};

// ─────────────────────────────────────────────────────────────
//  COMPONENT
// ─────────────────────────────────────────────────────────────
export const PerizinanList = () => {
    const { token } = useToken();
    const { mode } = useColorMode();
    const isDark = mode === "dark";
    const { data: user } = useGetIdentity<IUserIdentity>();
    const { edit, push } = useNavigation();
    const { mutate: updateMutate } = useUpdate();
    const { mutate: deleteMutate } = useDelete();

    // ── Gold shell ──────────────────────────────────────────
    const G = {
        text:        isDark ? "#F59E0B" : "#B45309",
        bg:          isDark ? "rgba(245,158,11,0.08)" : "rgba(212,160,23,0.06)",
        border:      isDark ? "rgba(245,158,11,0.18)" : "rgba(180,83,9,0.14)",
        borderStrong:isDark ? "rgba(245,158,11,0.35)" : "rgba(180,83,9,0.28)",
        gradient:    "linear-gradient(135deg,#92400E 0%,#B45309 30%,#D4A017 65%,#F59E0B 100%)",
        gradientSoft:isDark
            ? "linear-gradient(135deg,rgba(146,64,14,0.35) 0%,rgba(245,158,11,0.18) 100%)"
            : "linear-gradient(135deg,rgba(180,83,9,0.10) 0%,rgba(245,158,11,0.05) 100%)",
        shadow:      isDark
            ? "0 8px 32px rgba(0,0,0,0.5),0 1px 0 rgba(255,255,255,0.05)"
            : "0 4px 24px rgba(0,0,0,0.07)",
        cardBorder:  isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.05)",
    };

    // ── Filters ────────────────────────────────────────────
    const [filterKelas,     setFilterKelas]     = useState<string | null>(null);
    const [filterJurusan,   setFilterJurusan]   = useState<string | null>(null);
    const [filterStatus,    setFilterStatus]    = useState<StatusKey | null>(null);
    const [filterJenis,     setFilterJenis]     = useState<string | null>(null);
    const [filterDateRange, setFilterDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

    // ── Export modal ───────────────────────────────────────
    const [isExportOpen,    setIsExportOpen]    = useState(false);
    const [exportMode,      setExportMode]      = useState<"global" | "personal">("global");
    const [selectedNIS,     setSelectedNIS]     = useState<string | null>(null);
    const [exportLoading,   setExportLoading]   = useState(false);

    const { selectProps: santriSelectProps } = useSelect<ISantri>({
        resource: "santri",
        optionLabel: "nama",
        optionValue: "nis",
        onSearch: (v) => [
            { field: "nama", operator: "contains", value: v },
            { field: "nis",  operator: "contains", value: v },
        ],
    });

    // ── Table ──────────────────────────────────────────────
    const { tableProps, tableQueryResult } = useTable<IPerizinanSantri>({
        resource: "perizinan_santri",
        syncWithLocation: false,
        meta: { select: "*, santri!inner(nama, nis, kelas, jurusan, foto_url)" },
        sorters: { initial: [{ field: "created_at", order: "desc" }] },
    });

    // ── Client-side filter ─────────────────────────────────
    const allData = tableQueryResult?.data?.data || [];

    const filteredData = useMemo(() => {
        return allData.filter((item) => {
            if (filterKelas   && item.santri?.kelas   !== filterKelas)   return false;
            if (filterJurusan && item.santri?.jurusan !== filterJurusan) return false;
            if (filterStatus  && item.status          !== filterStatus)   return false;
            if (filterJenis   && item.jenis_izin      !== filterJenis)    return false;
            if (filterDateRange) {
                const d = dayjs(item.created_at);
                if (d.isBefore(filterDateRange[0], "day") || d.isAfter(filterDateRange[1], "day"))
                    return false;
            }
            return true;
        });
    }, [allData, filterKelas, filterJurusan, filterStatus, filterJenis, filterDateRange]);

    const finalTableProps = {
        ...tableProps,
        dataSource: filteredData,
        pagination: { ...tableProps.pagination, total: filteredData.length },
    };

    // ── Stats ──────────────────────────────────────────────
    const stats = useMemo(() => {
        const pending  = allData.filter((d) => d.status === "PENDING").length;
        const approved = allData.filter((d) => d.status === "APPROVED").length;
        const rejected = allData.filter((d) => d.status === "REJECTED").length;
        const kembali  = allData.filter((d) => d.status === "KEMBALI").length;
        const total    = allData.length;

        const thisMonth = allData.filter((d) =>
            dayjs(d.created_at).isSame(dayjs(), "month")
        ).length;

        // Jenis izin terbanyak
        const jenisMap: Record<string, number> = {};
        allData.forEach((d) => {
            if (d.jenis_izin) jenisMap[d.jenis_izin] = (jenisMap[d.jenis_izin] || 0) + 1;
        });
        const topJenis = Object.entries(jenisMap).sort((a, b) => b[1] - a[1]).slice(0, 4);

        // Santri dengan izin terbanyak
        const santriMap: Record<string, { nama: string; count: number }> = {};
        allData.forEach((d) => {
            const k = d.santri_nis;
            if (!santriMap[k]) santriMap[k] = { nama: d.santri?.nama || "-", count: 0 };
            santriMap[k].count += 1;
        });
        const topSantri = Object.entries(santriMap)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 3);

        // Izin aktif (approved belum kembali)
        const aktif = approved;

        return { pending, approved, rejected, kembali, total, thisMonth, topJenis, topSantri, aktif };
    }, [allData]);

    const hasFilter = filterKelas || filterJurusan || filterStatus || filterJenis || filterDateRange;
    const clearFilters = () => {
        setFilterKelas(null); setFilterJurusan(null);
        setFilterStatus(null); setFilterJenis(null);
        setFilterDateRange(null);
    };

    // unique jenis options from data
    const jenisOptions = useMemo(() => {
        const s = new Set(allData.map((d) => d.jenis_izin).filter(Boolean));
        return Array.from(s).map((j) => ({ label: j, value: j }));
    }, [allData]);

    // ══════════════════════════════════════════════════════
    //  UPDATE STATUS
    // ══════════════════════════════════════════════════════
    const handleUpdateStatus = (id: number, newStatus: string) => {
        const extra = newStatus === "APPROVED" ? { tanggal: dayjs().format("YYYY-MM-DD") } : {};
        updateMutate(
            {
                resource: "perizinan_santri",
                id,
                values: { status: newStatus, ...extra },
                successNotification: {
                    message: `Status diubah ke ${STATUS_MAP[newStatus as StatusKey]?.label || newStatus}`,
                    type: "success",
                },
            },
            {
                onSuccess: () =>
                    logActivity({
                        user,
                        action: "UPDATE",
                        resource: "perizinan_santri",
                        record_id: id.toString(),
                        details: { status: newStatus },
                    }),
            }
        );
    };

    // ══════════════════════════════════════════════════════
    //  EXPORT
    // ══════════════════════════════════════════════════════
    const handleExport = async () => {
        if (exportMode === "personal" && !selectedNIS) {
            message.warning("Pilih santri terlebih dahulu.");
            return;
        }
        setExportLoading(true);
        const instansi = {
            nama:   "PONDOK PESANTREN AL-HASANAH",
            alamat: "Jl. Raya Cibeuti No.13, Cibeuti, Kec. Kawalu, Tasikmalaya, Jawa Barat 46182",
            kontak: "Telp: 0812-XXXX-XXXX | Email: info@alhasanah.com",
        };
        const GOLD = "FFF59E0B";
        const WHITE = "FFFFFFFF";
        const STRIPE = "FFFDF6E3";
        const BORDER_COLOR = "FFE5E7EB";

        try {
            const wb = new ExcelJS.Workbook();

            const applyHeader = (ws: ExcelJS.Worksheet, cols: number, title: string, extra: string[] = []) => {
                const last = String.fromCharCode(64 + cols);
                ws.mergeCells(`A1:${last}1`);
                const t = ws.getCell("A1");
                t.value = instansi.nama;
                t.font = { size: 16, bold: true, color: { argb: "FFB45309" } };
                t.alignment = { horizontal: "center" };

                ws.mergeCells(`A2:${last}2`);
                const a = ws.getCell("A2");
                a.value = instansi.alamat;
                a.font = { size: 10, italic: true };
                a.alignment = { horizontal: "center" };

                ws.addRow([]);
                ws.addRow([title]).font = { bold: true, size: 12 };
                extra.forEach((e) => ws.addRow([e]).font = { size: 9 });
                ws.addRow([]);
            };

            const styleHeader = (row: ExcelJS.Row) => {
                row.eachCell((cell) => {
                    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GOLD } };
                    cell.font = { color: { argb: WHITE }, bold: true };
                    cell.alignment = { vertical: "middle", horizontal: "center" };
                    cell.border = {
                        top: { style: "thin" }, left: { style: "thin" },
                        bottom: { style: "thin" }, right: { style: "thin" },
                    };
                });
            };

            const styleRow = (row: ExcelJS.Row, idx: number) => {
                row.eachCell((cell) => {
                    cell.border = {
                        top: { style: "thin", color: { argb: BORDER_COLOR } },
                        left: { style: "thin", color: { argb: BORDER_COLOR } },
                        bottom: { style: "thin", color: { argb: BORDER_COLOR } },
                        right: { style: "thin", color: { argb: BORDER_COLOR } },
                    };
                    if (idx % 2 !== 0)
                        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: STRIPE } };
                });
            };

            if (exportMode === "global") {
                const ws = wb.addWorksheet("Rekap Perizinan");
                applyHeader(ws, 9, "REKAPITULASI PERIZINAN SANTRI", [
                    `Dicetak: ${dayjs().format("DD MMMM YYYY HH:mm")}`,
                ]);

                const hRow = ws.addRow([
                    "TGL PENGAJUAN (M)", "TGL PENGAJUAN (H)", "NAMA SANTRI",
                    "KELAS", "TAKHASUS", "JENIS IZIN", "ALASAN / KETERANGAN",
                    "STATUS", "RENCANA KEMBALI (M)",
                ]);
                styleHeader(hRow);

                const { data } = await supabaseClient
                    .from("perizinan_santri")
                    .select("*, santri(nama, kelas, jurusan)")
                    .order("created_at", { ascending: false });

                (data || []).forEach((item: any, idx) => {
                    const row = ws.addRow([
                        formatMasehi(item.created_at),
                        formatHijri(item.created_at),
                        item.santri?.nama?.toUpperCase(),
                        item.santri?.kelas,
                        item.santri?.jurusan,
                        item.jenis_izin,
                        item.keterangan,
                        item.status,
                        formatMasehi(item.tanggal_kembali),
                    ]);
                    styleRow(row, idx);
                    // warna status
                    const statusCell = row.getCell(8);
                    if (item.status === "APPROVED") statusCell.font = { color: { argb: "FF059669" }, bold: true };
                    if (item.status === "REJECTED") statusCell.font = { color: { argb: "FFDC2626" }, bold: true };
                    if (item.status === "PENDING")  statusCell.font = { color: { argb: "FFD97706" }, bold: true };
                });

                ws.addRow([]);
                ws.addRow(["", "", "", "", "", "", "", "TOTAL", (data || []).length]).font = { bold: true };
                ws.autoFilter = "A6:I6";
                ws.views = [{ state: "frozen", xSplit: 0, ySplit: 6 }];
                [20, 25, 30, 8, 12, 18, 35, 14, 20].forEach((w, i) => {
                    ws.getColumn(i + 1).width = w;
                });

                const buf = await wb.xlsx.writeBuffer();
                saveAs(new Blob([buf]), `Rekap_Perizinan_${new Date().toISOString().split("T")[0]}.xlsx`);
                message.success("Laporan global perizinan berhasil diunduh.");

            } else {
                const { data: santri } = await supabaseClient
                    .from("santri").select("*").eq("nis", selectedNIS).single();
                const { data: history } = await supabaseClient
                    .from("perizinan_santri").select("*")
                    .eq("santri_nis", selectedNIS)
                    .order("created_at", { ascending: false });

                const ws = wb.addWorksheet(`Riwayat - ${santri.nama}`);
                applyHeader(ws, 7, "LAPORAN RIWAYAT PERIZINAN SANTRI", [
                    `NAMA   : ${santri.nama.toUpperCase()}`,
                    `NIS    : ${santri.nis}`,
                    `KELAS  : ${santri.kelas} (${santri.jurusan})`,
                    `CETAK  : ${dayjs().format("DD MMMM YYYY HH:mm")}`,
                ]);

                const hRow = ws.addRow([
                    "TGL PENGAJUAN (M)", "TGL PENGAJUAN (H)",
                    "JENIS IZIN", "KETERANGAN",
                    "RENCANA KEMBALI (M)", "RENCANA KEMBALI (H)", "STATUS",
                ]);
                styleHeader(hRow);

                (history || []).forEach((item: any, idx) => {
                    const row = ws.addRow([
                        formatMasehi(item.created_at),
                        formatHijri(item.created_at),
                        item.jenis_izin,
                        item.keterangan,
                        formatMasehi(item.tanggal_kembali),
                        formatHijri(item.tanggal_kembali),
                        item.status,
                    ]);
                    styleRow(row, idx);
                });

                ws.addRow([]);
                ws.addRow([`Total Pengajuan: ${(history || []).length} kali`]).font = { bold: true };
                [20, 25, 18, 35, 22, 25, 14].forEach((w, i) => {
                    ws.getColumn(i + 1).width = w;
                });

                const buf = await wb.xlsx.writeBuffer();
                saveAs(new Blob([buf]), `Riwayat_Perizinan_${santri.nama.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`);
                message.success("Riwayat perizinan personal berhasil diunduh.");
            }

            setIsExportOpen(false);
        } catch {
            message.error("Gagal mengekspor data.");
        } finally {
            setExportLoading(false);
        }
    };

    // ══════════════════════════════════════════════════════
    //  KPI CARD
    // ══════════════════════════════════════════════════════
    const KpiCard = ({
        label, value, sub, color, gradient, icon,
        onClick, active,
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
                background: token.colorBgContainer, borderRadius: 16,
                overflow: "hidden", position: "relative",
                boxShadow: active ? `0 8px 28px ${color}28` : G.shadow,
                border: active ? `2px solid ${color}45` : G.cardBorder,
                cursor: onClick ? "pointer" : "default",
                transition: "all 0.2s cubic-bezier(.4,0,.2,1)",
            }}
        >
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: gradient }} />
            {active && (
                <div style={{
                    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                    background: `${color}04`, pointerEvents: "none",
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
                        fontSize: 30, fontWeight: 900, color,
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

    // ══════════════════════════════════════════════════════
    //  COLUMNS
    // ══════════════════════════════════════════════════════
    const columns: ProColumns<IPerizinanSantri>[] = [
        {
            title: "TGL PENGAJUAN",
            dataIndex: "created_at",
            width: 160,
            fixed: "left",
            sorter: true,
            render: (_, r) => (
                <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: token.colorText, letterSpacing: "-0.2px" }}>
                        {dayjs(r.created_at).format("DD MMM YYYY")}
                    </div>
                    <div style={{ fontSize: 11, color: G.text, fontWeight: 600, marginTop: 3 }}>
                        {formatHijri(r.created_at)}
                    </div>
                    <div style={{
                        display: "inline-flex", alignItems: "center", gap: 4, marginTop: 5,
                        padding: "1px 7px", borderRadius: 4,
                        background: IZN.primaryBg, border: `1px solid ${IZN.primaryBdr}`,
                    }}>
                        <CalendarOutlined style={{ fontSize: 9, color: IZN.primary }} />
                        <span style={{ fontSize: 9, fontWeight: 700, color: IZN.primary }}>
                            {dayjs(r.created_at).format("dddd")}
                        </span>
                    </div>
                </div>
            ),
        },
        {
            title: "SANTRI",
            dataIndex: "santri_nis",
            width: 255,
            render: (_, record) => (
                <Space size={11} align="center">
                    <div style={{ position: "relative", flexShrink: 0 }}>
                        <Avatar
                            size={44}
                            src={record.santri?.foto_url}
                            icon={<UserOutlined />}
                            style={{
                                background: IZN.primaryBg,
                                border: `2px solid ${IZN.primaryBdr}`,
                                color: IZN.primary,
                            }}
                        />
                        {/* Status dot */}
                        <div style={{
                            position: "absolute", bottom: 0, right: 0,
                            width: 12, height: 12, borderRadius: "50%",
                            background: STATUS_MAP[record.status as StatusKey]?.color || "#6B7280",
                            border: `2px solid ${token.colorBgContainer}`,
                        }} />
                    </div>
                    <div>
                        <div style={{
                            fontWeight: 800, fontSize: 13.5, color: token.colorText,
                            lineHeight: 1.25, letterSpacing: "-0.2px",
                        }}>
                            {record.santri?.nama?.toUpperCase() || "—"}
                        </div>
                        <div style={{
                            fontSize: 10, color: token.colorTextTertiary,
                            fontFamily: "ui-monospace,monospace", marginTop: 3,
                        }}>
                            NIS: {record.santri?.nis || "—"}
                        </div>
                        <div style={{ display: "flex", gap: 5, marginTop: 5 }}>
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
                                background: IZN.primaryBg, border: `1px solid ${IZN.primaryBdr}`,
                                color: IZN.primary, fontWeight: 700,
                            }}>
                                {record.santri?.jurusan}
                            </span>
                        </div>
                    </div>
                </Space>
            ),
        },
        {
            title: "JENIS & KEMBALI",
            key: "jenis",
            width: 195,
            render: (_, r) => (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "4px 11px", borderRadius: 8, fontSize: 11,
                        fontWeight: 800, width: "fit-content",
                        background: IZN.primaryBg, border: `1.5px solid ${IZN.primaryBdr}`,
                        color: IZN.primary,
                    }}>
                        <FileProtectOutlined style={{ fontSize: 10 }} />
                        {r.jenis_izin}
                    </span>
                    <div>
                        <div style={{
                            fontSize: 9, fontWeight: 800, letterSpacing: "0.8px",
                            textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 3,
                        }}>
                            Rencana Kembali
                        </div>
                        <div style={{
                            fontSize: 13, fontWeight: 700,
                            color: STATUS_MAP.REJECTED.color,
                        }}>
                            {dayjs(r.tanggal_kembali).format("DD MMM YYYY")}
                        </div>
                        <div style={{ fontSize: 10, color: G.text, fontWeight: 600 }}>
                            {formatHijri(r.tanggal_kembali)}
                        </div>
                    </div>
                </div>
            ),
        },
        {
            title: "ALASAN / KETERANGAN",
            dataIndex: "keterangan",
            width: 240,
            render: (_, r) => (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <div style={{
                        width: 24, height: 24, borderRadius: 6, flexShrink: 0, marginTop: 1,
                        background: token.colorFillAlter,
                        border: `1px solid ${token.colorBorderSecondary}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                        <FileProtectOutlined style={{ fontSize: 11, color: token.colorTextTertiary }} />
                    </div>
                    <Paragraph
                        ellipsis={{ rows: 2, tooltip: r.keterangan }}
                        style={{
                            margin: 0, fontSize: 12.5, fontWeight: 500,
                            color: token.colorText, lineHeight: 1.55,
                        }}
                    >
                        {r.keterangan || <span style={{ opacity: 0.4, fontStyle: "italic" }}>—</span>}
                    </Paragraph>
                </div>
            ),
        },
        {
            title: "STATUS",
            dataIndex: "status",
            width: 150,
            align: "center",
            render: (_, r) => {
                const s = STATUS_MAP[r.status as StatusKey];
                if (!s) return <Tag>{r.status}</Tag>;
                return (
                    <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "5px 14px", borderRadius: 20,
                        fontSize: 10, fontWeight: 900, letterSpacing: "0.7px",
                        background: s.bg, color: s.color, border: `1.5px solid ${s.border}`,
                    }}>
                        {s.icon}
                        {s.label.toUpperCase()}
                    </span>
                );
            },
        },
        {
            title: "AKSI",
            valueType: "option",
            width: 175,
            fixed: "right",
            render: (_, record) => {
                // PENDING — Approve / Reject / Edit
                if (record.status === "PENDING") {
                    return (
                        <Space size={5}>
                            <Popconfirm
                                title="Setujui Perizinan?"
                                description={<span style={{ fontSize: 12 }}>
                                    Pastikan persyaratan izin telah terpenuhi.
                                </span>}
                                onConfirm={() => handleUpdateStatus(record.id, "APPROVED")}
                                okText="✓ Setujui"
                                cancelText="Batal"
                                okButtonProps={{
                                    style: {
                                        background: STATUS_MAP.APPROVED.gradient,
                                        border: "none", color: "#fff", fontWeight: 700,
                                    },
                                }}
                            >
                                <Tooltip title="Setujui Izin">
                                    <Button
                                        size="small"
                                        icon={<CheckCircleOutlined />}
                                        style={{
                                            background: STATUS_MAP.APPROVED.gradient,
                                            border: "none", color: "#fff",
                                            borderRadius: 7, fontWeight: 700,
                                            fontSize: 11, height: 30,
                                            boxShadow: "0 3px 10px rgba(5,150,105,0.28)",
                                        }}
                                    >
                                        Setujui
                                    </Button>
                                </Tooltip>
                            </Popconfirm>

                            <Popconfirm
                                title="Tolak Perizinan?"
                                description={<span style={{ fontSize: 12 }}>Pengajuan izin akan ditolak.</span>}
                                onConfirm={() => handleUpdateStatus(record.id, "REJECTED")}
                                okText="Tolak"
                                cancelText="Batal"
                                okButtonProps={{ danger: true, size: "small" }}
                            >
                                <Tooltip title="Tolak Izin">
                                    <Button
                                        size="small"
                                        danger
                                        icon={<CloseCircleOutlined />}
                                        style={{ borderRadius: 7, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center" }}
                                    />
                                </Tooltip>
                            </Popconfirm>

                            <Tooltip title="Edit">
                                <Button
                                    size="small"
                                    icon={<EditOutlined />}
                                    onClick={() => edit("perizinan_santri", record.id)}
                                    style={{
                                        border: `1.5px solid ${G.border}`,
                                        color: G.text, background: G.bg,
                                        borderRadius: 7, width: 30, height: 30,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                    }}
                                />
                            </Tooltip>
                        </Space>
                    );
                }

                // APPROVED — Tandai Kembali
                if (record.status === "APPROVED") {
                    return (
                        <Space size={5}>
                            <Popconfirm
                                title="Catat Santri Kembali?"
                                description={<span style={{ fontSize: 12 }}>
                                    Konfirmasi bahwa santri sudah kembali ke pesantren.
                                </span>}
                                onConfirm={() => handleUpdateStatus(record.id, "KEMBALI")}
                                okText="✓ Tandai Kembali"
                                cancelText="Batal"
                                okButtonProps={{
                                    style: {
                                        background: STATUS_MAP.KEMBALI.gradient,
                                        border: "none", color: "#fff", fontWeight: 700,
                                    },
                                }}
                            >
                                <Tooltip title="Catat Santri Sudah Kembali">
                                    <Button
                                        size="small"
                                        icon={<LoginOutlined />}
                                        style={{
                                            background: STATUS_MAP.KEMBALI.gradient,
                                            border: "none", color: "#fff",
                                            borderRadius: 7, fontWeight: 700,
                                            fontSize: 11, height: 30,
                                            boxShadow: "0 3px 10px rgba(79,70,229,0.28)",
                                        }}
                                    >
                                        Kembali
                                    </Button>
                                </Tooltip>
                            </Popconfirm>
                            <Tooltip title="Edit">
                                <Button
                                    size="small"
                                    icon={<EditOutlined />}
                                    onClick={() => edit("perizinan_santri", record.id)}
                                    style={{
                                        border: `1.5px solid ${G.border}`,
                                        color: G.text, background: G.bg,
                                        borderRadius: 7, width: 30, height: 30,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                    }}
                                />
                            </Tooltip>
                        </Space>
                    );
                }

                // REJECTED / KEMBALI — Edit & Delete
                return (
                    <Space size={5}>
                        <Tooltip title="Edit">
                            <Button
                                size="small"
                                icon={<EditOutlined />}
                                onClick={() => edit("perizinan_santri", record.id)}
                                style={{
                                    border: `1.5px solid ${G.border}`,
                                    color: G.text, background: G.bg,
                                    borderRadius: 7, width: 30, height: 30,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                }}
                            />
                        </Tooltip>
                        <Popconfirm
                            title="Hapus Data Izin?"
                            description={<span style={{ fontSize: 12 }}>Data perizinan ini akan dihapus permanen.</span>}
                            onConfirm={() =>
                                deleteMutate(
                                    { resource: "perizinan_santri", id: record.id },
                                    {
                                        onSuccess: () =>
                                            logActivity({
                                                user,
                                                action: "DELETE",
                                                resource: "perizinan_santri",
                                                record_id: record.id.toString(),
                                                details: { id: record.id },
                                            }),
                                    }
                                )
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
                );
            },
        },
    ];

    // ══════════════════════════════════════════════════════
    //  RENDER
    // ══════════════════════════════════════════════════════
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 18, paddingBottom: 80 }}>

            <style>{`
                .izin-table .ant-table-thead .ant-table-cell {
                    background: ${isDark ? "rgba(79,70,229,0.10)" : "rgba(79,70,229,0.06)"} !important;
                    font-size: 10px !important; font-weight: 800 !important;
                    letter-spacing: 1.1px !important; text-transform: uppercase !important;
                    color: ${isDark ? "#818CF8" : "#4F46E5"} !important;
                    border-bottom: 2px solid ${isDark ? "rgba(79,70,229,0.30)" : "rgba(79,70,229,0.18)"} !important;
                    padding: 12px 14px !important;
                }
                .izin-table .ant-table-row:hover .ant-table-cell {
                    background: ${isDark ? "rgba(79,70,229,0.04)" : "rgba(79,70,229,0.025)"} !important;
                }
                .izin-table .ant-table-cell {
                    transition: background 0.16s ease !important;
                    border-bottom: 1px solid ${token.colorBorderSecondary} !important;
                    padding: 14px !important;
                }
                .izin-table .ant-pro-table-list-toolbar {
                    padding: 14px 16px !important;
                    border-bottom: 1px solid ${G.border} !important;
                }
                .izin-table .ant-table-body::-webkit-scrollbar { height: 5px; }
                .izin-table .ant-table-body::-webkit-scrollbar-thumb {
                    background: rgba(79,70,229,0.18); border-radius: 3px;
                }
                /* PENDING row highlight */
                .izin-table .row-pending > td {
                    background: ${isDark ? "rgba(217,119,6,0.05)" : "rgba(217,119,6,0.025)"} !important;
                }
                .izin-table .row-pending:hover > td {
                    background: ${isDark ? "rgba(217,119,6,0.09)" : "rgba(217,119,6,0.05)"} !important;
                }
            `}</style>

            {/* ═══════════════════════════════════
                MASTHEAD
            ═══════════════════════════════════ */}
            <div style={{
                padding: "20px 24px",
                background: token.colorBgContainer,
                borderRadius: 16, boxShadow: G.shadow, border: G.cardBorder,
                position: "relative", overflow: "hidden",
                display: "flex", alignItems: "center",
                justifyContent: "space-between", flexWrap: "wrap", gap: 14,
            }}>
                {/* Indigo left accent */}
                <div style={{
                    position: "absolute", left: 0, top: 0, bottom: 0, width: 4,
                    background: IZN.primaryGrad,
                    borderRadius: "16px 0 0 16px",
                }} />
                <div style={{
                    position: "absolute", right: -35, top: -35,
                    width: 130, height: 130, borderRadius: "50%",
                    background: isDark ? "rgba(79,70,229,0.05)" : "rgba(79,70,229,0.04)",
                    pointerEvents: "none",
                }} />

                <div style={{ display: "flex", alignItems: "center", gap: 14, paddingLeft: 10 }}>
                    <div style={{
                        width: 50, height: 50, borderRadius: 13,
                        background: IZN.primaryGrad,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 22, color: "#fff",
                        boxShadow: "0 6px 20px rgba(79,70,229,0.38)",
                    }}>
                        <FileProtectOutlined />
                    </div>
                    <div>
                        <div style={{
                            fontSize: 20, fontWeight: 900, color: token.colorText,
                            letterSpacing: "-0.5px", lineHeight: 1.2,
                        }}>
                            Monitoring Perizinan Santri
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 11, color: token.colorTextSecondary }}>
                                Manajemen & Persetujuan Izin
                            </span>
                            <span style={{
                                fontSize: 10, padding: "2px 9px", borderRadius: 20,
                                background: G.bg, border: `1px solid ${G.border}`,
                                color: G.text, fontWeight: 800,
                            }}>
                                ✦ {formatHijri(new Date())}
                            </span>
                            {stats.pending > 0 && (
                                <span style={{
                                    fontSize: 10, padding: "2px 9px", borderRadius: 20,
                                    background: STATUS_MAP.PENDING.bg,
                                    border: `1px solid ${STATUS_MAP.PENDING.border}`,
                                    color: STATUS_MAP.PENDING.color, fontWeight: 800,
                                    animation: "none",
                                }}>
                                    ⚡ {stats.pending} menunggu persetujuan
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <Space size={8}>
                    <Button
                        icon={<SyncOutlined spin={tableQueryResult.isFetching} />}
                        onClick={() => tableQueryResult.refetch()}
                        style={{ border: G.cardBorder, borderRadius: 9, height: 38, color: token.colorTextSecondary }}
                    >
                        Refresh
                    </Button>
                    <Button
                        icon={<DownloadOutlined />}
                        onClick={() => { setExportMode("global"); setIsExportOpen(true); }}
                        style={{
                            borderRadius: 9, fontWeight: 700, height: 38,
                            border: `1.5px solid ${IZN.primaryBdr}`,
                            color: IZN.primary, background: IZN.primaryBg,
                        }}
                    >
                        Export Laporan
                    </Button>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => push("/perizinan/create")}
                        style={{
                            background: IZN.primaryGrad,
                            border: "none", borderRadius: 9, fontWeight: 700, height: 38,
                            boxShadow: "0 4px 14px rgba(79,70,229,0.35)",
                        }}
                    >
                        Buat Izin
                    </Button>
                </Space>
            </div>

            {/* ═══════════════════════════════════
                KPI CARDS (clickable filter)
            ═══════════════════════════════════ */}
            <Row gutter={[14, 14]}>
                {/* Total */}
                <Col xs={24} sm={12} xl={5}>
                    <KpiCard
                        label="Total Pengajuan"
                        value={<span style={{ fontSize: 36 }}>{stats.total}</span>}
                        sub={`${stats.thisMonth} pengajuan bulan ini`}
                        color={isDark ? "#F59E0B" : "#B45309"}
                        gradient={G.gradient}
                        icon={<BarChartOutlined />}
                    />
                </Col>

                {/* Status cards — clickable */}
                {(["PENDING", "APPROVED", "REJECTED", "KEMBALI"] as StatusKey[]).map((k) => {
                    const s = STATUS_MAP[k];
                    const cnt = k === "PENDING" ? stats.pending : k === "APPROVED" ? stats.approved : k === "REJECTED" ? stats.rejected : stats.kembali;
                    const sub = k === "PENDING" ? "Menunggu keputusan" : k === "APPROVED" ? "Sedang di luar pesantren" : k === "REJECTED" ? "Pengajuan ditolak" : "Telah kembali";
                    return (
                        <Col xs={24} sm={12} xl={4} key={k}>
                            <KpiCard
                                label={s.label}
                                value={<span style={{ fontSize: 36 }}>{cnt}</span>}
                                sub={sub}
                                color={s.color}
                                gradient={s.gradient}
                                icon={s.icon}
                                onClick={() => setFilterStatus(filterStatus === k ? null : k)}
                                active={filterStatus === k}
                            />
                        </Col>
                    );
                })}
            </Row>

            {/* ═══════════════════════════════════
                FREQUENT + JENIS INFO + FILTER
            ═══════════════════════════════════ */}
            <Row gutter={[14, 14]}>
                {/* Santri sering izin */}
                <Col xs={24} lg={7}>
                    <Card
                        bordered={false}
                        bodyStyle={{ padding: "18px 20px" }}
                        style={{
                            background: token.colorBgContainer, borderRadius: 16,
                            boxShadow: G.shadow, border: G.cardBorder,
                            position: "relative", overflow: "hidden", height: "100%",
                        }}
                    >
                        <div style={{
                            position: "absolute", top: 0, left: 0, right: 0, height: 3,
                            background: IZN.primaryGrad,
                        }} />
                        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
                            <div style={{
                                width: 30, height: 30, borderRadius: 8,
                                background: IZN.primaryBg, border: `1px solid ${IZN.primaryBdr}`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 14, color: IZN.primary,
                            }}>
                                <TeamOutlined />
                            </div>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 800, color: token.colorText }}>
                                    Sering Izin
                                </div>
                                <div style={{ fontSize: 10, color: token.colorTextTertiary }}>
                                    Santri dengan izin terbanyak
                                </div>
                            </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                            {stats.topSantri.length === 0 ? (
                                <div style={{ textAlign: "center", color: token.colorTextTertiary, fontSize: 12, padding: "16px 0" }}>
                                    Belum ada data
                                </div>
                            ) : stats.topSantri.map(([nis, data], idx) => (
                                <div key={nis} style={{
                                    display: "flex", alignItems: "center", gap: 10,
                                    padding: "10px 12px", borderRadius: 10,
                                    background: idx === 0 ? IZN.primaryBg : token.colorFillAlter,
                                    border: `1px solid ${idx === 0 ? IZN.primaryBdr : token.colorBorderSecondary}`,
                                }}>
                                    <div style={{
                                        width: 26, height: 26, borderRadius: "50%",
                                        background: idx === 0 ? IZN.primaryGrad
                                            : idx === 1 ? G.gradient
                                                : `linear-gradient(135deg,#6B7280,#9CA3AF)`,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 11, fontWeight: 900, color: "#fff", flexShrink: 0,
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
                                    </div>
                                    <div style={{
                                        fontFamily: "ui-monospace,monospace",
                                        fontWeight: 900, fontSize: 16,
                                        color: idx === 0 ? IZN.primary : token.colorText,
                                    }}>
                                        {data.count}
                                        <span style={{ fontSize: 9, color: token.colorTextTertiary, marginLeft: 2 }}>×</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <Divider style={{ margin: "14px 0 12px", borderColor: token.colorBorderSecondary }} />

                        {/* Jenis izin mini distribution */}
                        <div style={{
                            fontSize: 9, fontWeight: 800, letterSpacing: "1.2px",
                            textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 10,
                        }}>
                            Distribusi Jenis Izin
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {stats.topJenis.slice(0, 3).map(([jenis, count]) => {
                                const pct = Math.round((count / stats.total) * 100);
                                return (
                                    <div key={jenis}>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                                            <span style={{
                                                fontSize: 11, fontWeight: 600, color: token.colorText,
                                                maxWidth: "72%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                            }}>
                                                {jenis}
                                            </span>
                                            <span style={{ fontSize: 10, fontWeight: 800, color: IZN.primary, fontFamily: "monospace" }}>
                                                {count}×
                                            </span>
                                        </div>
                                        <Progress
                                            percent={pct} showInfo={false}
                                            strokeColor={IZN.primaryGrad}
                                            trailColor={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}
                                            strokeWidth={5} style={{ margin: 0 }}
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        <Divider style={{ margin: "14px 0 12px", borderColor: token.colorBorderSecondary }} />
                        <Button
                            block
                            icon={<FileExcelOutlined />}
                            onClick={() => { setExportMode("personal"); setIsExportOpen(true); }}
                            style={{
                                border: `1.5px solid ${IZN.primaryBdr}`,
                                color: IZN.primary, background: IZN.primaryBg,
                                borderRadius: 9, fontWeight: 700, height: 36,
                            }}
                        >
                            Laporan Personal Santri
                        </Button>
                    </Card>
                </Col>

                {/* Filter Panel */}
                <Col xs={24} lg={17}>
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
                                {hasFilter && (
                                    <span style={{
                                        fontSize: 10, padding: "1px 8px", borderRadius: 10,
                                        background: IZN.primaryBg, border: `1px solid ${IZN.primaryBdr}`,
                                        color: IZN.primary, fontWeight: 800,
                                    }}>
                                        Aktif
                                    </span>
                                )}
                            </div>
                            {hasFilter && (
                                <Button
                                    size="small" onClick={clearFilters}
                                    style={{
                                        fontSize: 11, height: 26, borderRadius: 6,
                                        border: `1px solid ${G.border}`, color: token.colorTextSecondary,
                                    }}
                                >
                                    Hapus Semua Filter
                                </Button>
                            )}
                        </div>

                        <Row gutter={[12, 12]}>
                            {[
                                {
                                    label: "Kelas",
                                    node: (
                                        <Select
                                            allowClear placeholder="Semua Kelas"
                                            value={filterKelas} onChange={setFilterKelas}
                                            style={{ width: "100%" }}
                                            options={[1, 2, 3].map((k) => ({ label: `Kelas ${k}`, value: `${k}` }))}
                                        />
                                    ),
                                    span: 6,
                                },
                                {
                                    label: "Takhasus",
                                    node: (
                                        <Select
                                            allowClear placeholder="Semua"
                                            value={filterJurusan} onChange={setFilterJurusan}
                                            style={{ width: "100%" }}
                                            options={[
                                                { label: "Tahfidz", value: "TAHFIDZ" },
                                                { label: "Kitab",   value: "KITAB"   },
                                            ]}
                                        />
                                    ),
                                    span: 6,
                                },
                                {
                                    label: "Status",
                                    node: (
                                        <Select
                                            allowClear placeholder="Semua Status"
                                            value={filterStatus} onChange={(v) => setFilterStatus(v as StatusKey)}
                                            style={{ width: "100%" }}
                                            options={Object.entries(STATUS_MAP).map(([k, v]) => ({
                                                label: v.label, value: k,
                                            }))}
                                        />
                                    ),
                                    span: 6,
                                },
                                {
                                    label: "Jenis Izin",
                                    node: (
                                        <Select
                                            allowClear placeholder="Semua Jenis"
                                            value={filterJenis} onChange={setFilterJenis}
                                            style={{ width: "100%" }}
                                            options={jenisOptions}
                                        />
                                    ),
                                    span: 6,
                                },
                            ].map((f) => (
                                <Col key={f.label} xs={12} sm={f.span as any}>
                                    <div style={{
                                        fontSize: 9, fontWeight: 800, letterSpacing: "1px",
                                        textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 5,
                                    }}>
                                        {f.label}
                                    </div>
                                    {f.node}
                                </Col>
                            ))}

                            <Col xs={24}>
                                <div style={{
                                    fontSize: 9, fontWeight: 800, letterSpacing: "1px",
                                    textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 5,
                                }}>
                                    Rentang Tanggal Pengajuan
                                </div>
                                <RangePicker
                                    value={filterDateRange}
                                    onChange={(d) => setFilterDateRange(d as any)}
                                    style={{ width: "100%" }} format="DD MMM YYYY" allowClear
                                    presets={[
                                        { label: "Minggu Ini",       value: [dayjs().startOf("week"), dayjs().endOf("week")] },
                                        { label: "Bulan Ini",        value: [dayjs().startOf("month"), dayjs().endOf("month")] },
                                        { label: "Bulan Lalu",       value: [dayjs().subtract(1, "month").startOf("month"), dayjs().subtract(1, "month").endOf("month")] },
                                        { label: "3 Bulan Terakhir", value: [dayjs().subtract(3, "month"), dayjs()] },
                                    ]}
                                />
                            </Col>
                        </Row>

                        {/* Active filter tags */}
                        {hasFilter && (
                            <div style={{
                                marginTop: 14, paddingTop: 12,
                                borderTop: `1px solid ${token.colorBorderSecondary}`,
                                display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                            }}>
                                <span style={{ fontSize: 10, color: token.colorTextTertiary, fontWeight: 700 }}>
                                    Menampilkan:
                                </span>
                                <span style={{ fontSize: 11, fontWeight: 800, color: IZN.primary }}>
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
                                        color="blue" style={{ borderRadius: 6, fontSize: 10, fontWeight: 700 }}>
                                        {filterJurusan}
                                    </Tag>
                                )}
                                {filterStatus && (
                                    <Tag
                                        closable onClose={() => setFilterStatus(null)}
                                        style={{
                                            borderRadius: 6, fontSize: 10, fontWeight: 700,
                                            background: STATUS_MAP[filterStatus].bg,
                                            color: STATUS_MAP[filterStatus].color,
                                            border: `1px solid ${STATUS_MAP[filterStatus].border}`,
                                        }}
                                    >
                                        {STATUS_MAP[filterStatus].label}
                                    </Tag>
                                )}
                                {filterJenis && (
                                    <Tag closable onClose={() => setFilterJenis(null)}
                                        color="geekblue" style={{ borderRadius: 6, fontSize: 10, fontWeight: 700 }}>
                                        {filterJenis}
                                    </Tag>
                                )}
                                {filterDateRange && (
                                    <Tag closable onClose={() => setFilterDateRange(null)}
                                        style={{ borderRadius: 6, fontSize: 10, fontWeight: 700 }}>
                                        {filterDateRange[0].format("DD MMM")} – {filterDateRange[1].format("DD MMM YYYY")}
                                    </Tag>
                                )}
                            </div>
                        )}

                        {/* Quick summary grid */}
                        <div style={{
                            marginTop: 16, paddingTop: 14,
                            borderTop: `1px solid ${token.colorBorderSecondary}`,
                            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10,
                        }}>
                            {[
                                { label: "Total",   value: stats.total,   color: isDark ? "#F59E0B" : "#B45309" },
                                { label: "Pending", value: stats.pending,  color: STATUS_MAP.PENDING.color },
                                { label: "Aktif di Luar", value: stats.aktif,   color: STATUS_MAP.APPROVED.color },
                                { label: "Bulan Ini", value: stats.thisMonth, color: IZN.primary },
                            ].map((s) => (
                                <div key={s.label} style={{
                                    textAlign: "center", padding: "10px 6px", borderRadius: 10,
                                    background: token.colorFillAlter,
                                    border: `1px solid ${token.colorBorderSecondary}`,
                                }}>
                                    <div style={{
                                        fontFamily: "ui-monospace,monospace",
                                        fontWeight: 900, fontSize: 22, color: s.color, lineHeight: 1,
                                    }}>
                                        {s.value}
                                    </div>
                                    <div style={{
                                        fontSize: 9, fontWeight: 800, color: token.colorTextTertiary,
                                        letterSpacing: "0.8px", textTransform: "uppercase", marginTop: 5,
                                    }}>
                                        {s.label}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </Col>
            </Row>

            {/* ═══════════════════════════════════
                DATA TABLE
            ═══════════════════════════════════ */}
            <div style={{
                background: token.colorBgContainer,
                borderRadius: 16, overflow: "hidden",
                boxShadow: G.shadow, border: G.cardBorder,
            }}>
                <ProTable<IPerizinanSantri>
                    {...finalTableProps}
                    columns={columns}
                    rowKey="id"
                    search={false}
                    className="izin-table"
                    scroll={{ x: 1150 }}
                    rowClassName={(record) =>
                        record.status === "PENDING" ? "row-pending" : ""
                    }
                    headerTitle={
                        <Space size={10} align="center">
                            <div style={{
                                width: 34, height: 34, borderRadius: 9,
                                background: IZN.primaryGrad,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 15, color: "#fff",
                            }}>
                                <FileProtectOutlined />
                            </div>
                            <div>
                                <div style={{
                                    fontSize: 14, fontWeight: 800,
                                    color: token.colorText, letterSpacing: "-0.3px",
                                }}>
                                    Data Perizinan Santri
                                    {filterStatus && (
                                        <span style={{
                                            marginLeft: 8, fontSize: 11, padding: "1px 9px", borderRadius: 10,
                                            background: STATUS_MAP[filterStatus].bg,
                                            color: STATUS_MAP[filterStatus].color,
                                            border: `1px solid ${STATUS_MAP[filterStatus].border}`,
                                            fontWeight: 800, verticalAlign: "middle",
                                        }}>
                                            {STATUS_MAP[filterStatus].label}
                                        </span>
                                    )}
                                </div>
                                <div style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 1 }}>
                                    {filteredData.length} record · {formatHijri(new Date())}
                                </div>
                            </div>
                        </Space>
                    }
                    toolBarRender={() => [
                        <Button
                            key="personal"
                            icon={<FileExcelOutlined />}
                            onClick={() => { setExportMode("personal"); setIsExportOpen(true); }}
                            style={{
                                borderRadius: 8, fontWeight: 700,
                                border: `1.5px solid ${IZN.primaryBdr}`,
                                color: IZN.primary, background: IZN.primaryBg,
                            }}
                        >
                            Laporan Personal
                        </Button>,
                        <Button
                            key="export"
                            icon={<DownloadOutlined />}
                            onClick={() => { setExportMode("global"); setIsExportOpen(true); }}
                            style={{ borderRadius: 8, fontWeight: 700 }}
                        >
                            Export Global
                        </Button>,
                        <Button
                            key="create"
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => push("/perizinan/create")}
                            style={{
                                background: IZN.primaryGrad,
                                border: "none", borderRadius: 8, fontWeight: 700,
                                boxShadow: "0 3px 10px rgba(79,70,229,0.32)",
                            }}
                        >
                            Buat Izin
                        </Button>,
                    ]}
                    cardProps={{ bodyStyle: { padding: 0 } }}
                    tableStyle={{ padding: 0 }}
                    pagination={{
                        ...finalTableProps.pagination,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (total, range) =>
                            `${range[0]}-${range[1]} dari ${total} pengajuan`,
                    }}
                />
            </div>

            {/* ═══════════════════════════════════
                MODAL EXPORT
            ═══════════════════════════════════ */}
            <Modal
                title={null}
                open={isExportOpen}
                onCancel={() => setIsExportOpen(false)}
                footer={
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                        <Button onClick={() => setIsExportOpen(false)} style={{ borderRadius: 9 }}>
                            Batal
                        </Button>
                        <Button
                            loading={exportLoading}
                            icon={<DownloadOutlined />}
                            onClick={handleExport}
                            disabled={exportMode === "personal" && !selectedNIS}
                            style={{
                                background: IZN.primaryGrad, border: "none", color: "#fff",
                                borderRadius: 9, fontWeight: 800,
                                boxShadow: "0 4px 14px rgba(79,70,229,0.30)",
                                opacity: exportMode === "personal" && !selectedNIS ? 0.5 : 1,
                            }}
                        >
                            Download Excel
                        </Button>
                    </div>
                }
                width={460}
                centered
                styles={{ content: { padding: 0, borderRadius: 20, overflow: "hidden" } }}
            >
                {/* Indigo header */}
                <div style={{
                    background: IZN.primaryGrad,
                    padding: "22px 28px 20px", position: "relative", overflow: "hidden",
                }}>
                    <div style={{
                        position: "absolute", right: -15, top: -15,
                        width: 90, height: 90, borderRadius: "50%",
                        background: "rgba(255,255,255,0.10)",
                    }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: 11,
                            background: "rgba(255,255,255,0.18)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 18, color: "#fff",
                        }}>
                            <FileExcelOutlined />
                        </div>
                        <div>
                            <div style={{ fontSize: 17, fontWeight: 900, color: "#fff", letterSpacing: "-0.3px" }}>
                                Export Laporan Perizinan
                            </div>
                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>
                                Format Excel · Pesantren Al-Hasanah
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ padding: "22px 28px 28px", background: token.colorBgContainer }}>
                    {/* Mode selector */}
                    <div style={{ marginBottom: 20 }}>
                        <div style={{
                            fontSize: 10, fontWeight: 800, letterSpacing: "1.2px",
                            textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 10,
                        }}>
                            Jenis Laporan
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            {[
                                { val: "global"   as const, label: "Rekap Global",    sub: "Semua data perizinan santri", icon: <TeamOutlined /> },
                                { val: "personal" as const, label: "Laporan Personal", sub: "Riwayat satu santri",         icon: <UserOutlined /> },
                            ].map((opt) => {
                                const active = exportMode === opt.val;
                                return (
                                    <button
                                        key={opt.val}
                                        onClick={() => setExportMode(opt.val)}
                                        style={{
                                            padding: "14px 16px", borderRadius: 12, cursor: "pointer",
                                            textAlign: "left", outline: "none",
                                            transition: "all 0.18s ease",
                                            border: `2px solid ${active ? IZN.primary : token.colorBorder}`,
                                            background: active ? IZN.primaryBg : "transparent",
                                            boxShadow: active ? `0 4px 14px ${IZN.primary}18` : "none",
                                        }}
                                    >
                                        <div style={{ fontSize: 20, marginBottom: 8, color: active ? IZN.primary : token.colorTextTertiary }}>
                                            {opt.icon}
                                        </div>
                                        <div style={{ fontWeight: 800, fontSize: 13, color: token.colorText, marginBottom: 3 }}>
                                            {opt.label}
                                        </div>
                                        <div style={{ fontSize: 11, color: token.colorTextTertiary }}>
                                            {opt.sub}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {exportMode === "personal" && (
                        <div style={{ marginBottom: 16 }}>
                            <div style={{
                                fontSize: 10, fontWeight: 800, letterSpacing: "1px",
                                textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 6,
                            }}>
                                Pilih Santri
                            </div>
                            <Select
                                {...santriSelectProps}
                                showSearch
                                placeholder="Cari nama atau NIS santri..."
                                style={{ width: "100%" }}
                                filterOption={false}
                                onChange={(val) => setSelectedNIS(val as unknown as string)}
                                suffixIcon={<UserOutlined style={{ color: IZN.primary }} />}
                            />
                        </div>
                    )}

                    <div style={{
                        marginTop: 12, padding: "10px 14px", borderRadius: 10,
                        background: IZN.primaryBg, border: `1px solid ${IZN.primaryBdr}`,
                        fontSize: 11, color: IZN.primary, fontWeight: 500,
                    }}>
                        <FileProtectOutlined style={{ marginRight: 6 }} />
                        File Excel menggunakan kop surat resmi Pesantren Al-Hasanah dengan highlight status otomatis.
                    </div>
                </div>
            </Modal>
        </div>
    );
};
