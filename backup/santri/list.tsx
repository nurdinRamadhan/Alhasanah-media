import React, { useState, useMemo, useCallback, useRef } from "react";
import { useTable } from "@refinedev/antd";
import { ProTable } from "@ant-design/pro-components";
import type { ProColumns } from "@ant-design/pro-components";
import {
    Tag, Space, Avatar, Typography, Tooltip,
    theme, Card, Row, Col, Select, Input,
    message, Badge, Divider, Skeleton,
} from "antd";
import { motion, AnimatePresence, Variants } from "framer-motion";
import {
    UserOutlined, PlusOutlined, EyeOutlined,
    EditOutlined, ManOutlined, WomanOutlined,
    TeamOutlined, CheckCircleOutlined, LogoutOutlined,
    BookOutlined, StarOutlined, DatabaseOutlined,
    SearchOutlined, ReloadOutlined, FileExcelOutlined,
    FilterOutlined, SyncOutlined, CrownOutlined,
    AimOutlined, CloseCircleOutlined, RocketOutlined,
    TrophyOutlined,
} from "@ant-design/icons";
import { useNavigation, CrudFilters } from "@refinedev/core";
import { ISantri } from "../../types";
import { formatMasehi } from "../../utility/dateHelper";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import dayjs from "dayjs";

const { Text } = Typography;
const { useToken } = theme;

// ═══════════════════════════════════════════════════════════════
// DESIGN TOKENS — Konsisten dengan design system global
// ═══════════════════════════════════════════════════════════════
const GOLD        = "#C9A84C";
const GOLD_BRIGHT = "#FFB700";
const GOLD_LIGHT  = "#FDE68A";
const GOLD_DEEP   = "#8B6914";
const GOLD_DARK   = "#5C430A";
const SUCCESS     = "#059669";
const DANGER      = "#DC2626";
const INFO        = "#2563EB";
const PURPLE      = "#7C3AED";
const G           = (o: number) => `rgba(201,168,76,${o})`;

// ═══════════════════════════════════════════════════════════════
// STATUS CONFIG — Tanpa LULUS sesuai permintaan
// ═══════════════════════════════════════════════════════════════
const STATUS_CFG = {
    AKTIF:  {
        label: "Aktif", icon: <CheckCircleOutlined />,
        color: SUCCESS, bg: (d: boolean) => d ? `${SUCCESS}14` : "#F0FDF4",
        border: (d: boolean) => d ? `${SUCCESS}28` : `${SUCCESS}22`,
        gradient: `linear-gradient(135deg, #22c55e, #16a34a)`,
        glow: "rgba(34,197,94,0.35)",
    },
    KELUAR: {
        label: "Keluar", icon: <LogoutOutlined />,
        color: DANGER, bg: (d: boolean) => d ? `${DANGER}14` : "#FFF1F2",
        border: (d: boolean) => d ? `${DANGER}28` : `${DANGER}22`,
        gradient: `linear-gradient(135deg, #ef4444, #dc2626)`,
        glow: "rgba(239,68,68,0.35)",
    },
    ALUMNI: {
        label: "Alumni", icon: <StarOutlined />,
        color: GOLD_BRIGHT, bg: (d: boolean) => d ? G(0.12) : "#FDF6DC",
        border: (d: boolean) => d ? G(0.28) : G(0.22),
        gradient: `linear-gradient(135deg, ${GOLD}, ${GOLD_DEEP})`,
        glow: G(0.40),
    },
    LULUS: {
        label: "Lulus", icon: <TrophyOutlined />,
        color: INFO, bg: (d: boolean) => d ? `${INFO}14` : "#EFF6FF",
        border: (d: boolean) => d ? `${INFO}28` : `${INFO}22`,
        gradient: `linear-gradient(135deg, #3B82F6, #2563EB)`,
        glow: "rgba(59,130,246,0.35)",
    },
} as const;

// ═══════════════════════════════════════════════════════════════
// ANIMATION VARIANTS
// ═══════════════════════════════════════════════════════════════
const fadeUp: Variants = {
    hidden:  { opacity: 0, y: 18 },
    visible: (i = 0) => ({
        opacity: 1, y: 0,
        transition: { duration: 0.48, ease: [0.22, 1, 0.36, 1], delay: i * 0.07 },
    }),
};
const stagger: Variants = { visible: { transition: { staggerChildren: 0.07 } } };

// ═══════════════════════════════════════════════════════════════
// KELAS & JURUSAN OPTIONS
// ═══════════════════════════════════════════════════════════════
const KELAS_OPTIONS = [1,2,3].map(k => ({
    label: `Kelas ${k}`,
    value: String(k),
}));

const JURUSAN_OPTIONS = [
    { label: "📖 Tahfidz", value: "TAHFIDZ" },
    { label: "📚 Kitab",   value: "KITAB"   },
];

const STATUS_OPTIONS = [
    { label: "● Aktif",  value: "AKTIF"  },
    { label: "● Keluar", value: "KELUAR" },
    { label: "● Alumni", value: "ALUMNI" },
];

// ═══════════════════════════════════════════════════════════════
// KPI STAT CARD
// ═══════════════════════════════════════════════════════════════
interface StatCardProps {
    label: string;
    count: number;
    icon: React.ReactNode;
    color: string;
    total: number;
    isDark: boolean;
    index: number;
    active?: boolean;
    onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({
    label, count, icon, color, total, isDark, index, active, onClick,
}) => {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
        <motion.div custom={index} variants={fadeUp} style={{ height: "100%" }}>
            <div
                onClick={onClick}
                style={{
                    borderRadius: 20,
                    border: active
                        ? `1.5px solid ${color}`
                        : `1px solid ${isDark ? "rgba(201,168,76,0.10)" : "rgba(201,168,76,0.14)"}`,
                    background: isDark ? "#0F0F1A" : "#FFFFFF",
                    padding: "20px 22px",
                    height: "100%",
                    position: "relative",
                    overflow: "hidden",
                    cursor: onClick ? "pointer" : "default",
                    transition: "all 0.25s cubic-bezier(0.22,1,0.36,1)",
                    boxShadow: active
                        ? `0 6px 28px ${color}30, 0 0 0 1px ${color}20`
                        : isDark
                            ? "0 4px 24px rgba(0,0,0,0.42)"
                            : "0 2px 16px rgba(0,0,0,0.05)",
                    transform: active ? "translateY(-2px)" : undefined,
                }}
            >
                {/* Gold top bar */}
                <div style={{
                    position: "absolute", top: 0, left: 0, right: 0, height: 2,
                    background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
                    opacity: active ? 1 : 0.5,
                }} />

                {/* Radial glow */}
                <div style={{
                    position: "absolute", bottom: -24, right: -24,
                    width: 110, height: 110, borderRadius: "50%",
                    background: `radial-gradient(circle, ${color}18 0%, transparent 70%)`,
                    pointerEvents: "none",
                }} />

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                        <div style={{
                            fontSize: 9.5, fontWeight: 800, letterSpacing: "0.12em",
                            textTransform: "uppercase", color: isDark ? "#5C5248" : "#9E9080",
                            fontFamily: "'Syne', sans-serif", marginBottom: 10,
                        }}>
                            {label}
                        </div>
                        <div style={{
                            fontFamily: "'Syne', sans-serif", fontWeight: 800,
                            fontSize: 32, letterSpacing: "-0.04em", lineHeight: 1,
                            color: isDark ? "#F0EDE5" : "#0A0805",
                        }}>
                            {count.toLocaleString("id-ID")}
                        </div>
                        <div style={{
                            marginTop: 10, fontSize: 10.5, fontWeight: 700,
                            color, display: "flex", alignItems: "center", gap: 5,
                        }}>
                            {icon}
                            <span>{pct}% dari total</span>
                        </div>
                    </div>
                    <div style={{
                        width: 44, height: 44, borderRadius: 13, flexShrink: 0,
                        background: `${color}18`,
                        border: `1px solid ${color}28`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color, fontSize: 20,
                        boxShadow: `0 4px 14px ${color}20`,
                    }}>
                        {icon}
                    </div>
                </div>

                {/* Progress bar */}
                <div style={{
                    marginTop: 14, height: 4, borderRadius: 99,
                    background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                    overflow: "hidden",
                }}>
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.9, ease: [0.22,1,0.36,1], delay: index * 0.07 + 0.3 }}
                        style={{
                            height: "100%", borderRadius: 99,
                            background: `linear-gradient(90deg, ${color}, ${color}88)`,
                        }}
                    />
                </div>
            </div>
        </motion.div>
    );
};

// ═══════════════════════════════════════════════════════════════
// FILTER BAR COMPONENT — Custom premium, terhubung ke useTable
// ═══════════════════════════════════════════════════════════════
interface FilterState {
    nama:   string;
    kelas:  string | undefined;
    jurusan: string | undefined;
    status: string | undefined;
}

const EMPTY_FILTER: FilterState = { nama: "", kelas: undefined, jurusan: undefined, status: undefined };

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export const SantriList = () => {
    const { token } = useToken();
    const { create, show, edit } = useNavigation();

    // ── Dark mode ────────────────────────────────────────────
    const bg     = token.colorBgContainer;
    const isDark = (() => {
        const c = bg.replace("#", "");
        if (c.length < 6) return false;
        const lum = 0.299*parseInt(c.slice(0,2),16)
                  + 0.587*parseInt(c.slice(2,4),16)
                  + 0.114*parseInt(c.slice(4,6),16);
        return lum < 128;
    })();

    // ── Filter state (controlled, independent dari ProTable) ─
    const [filters, setFilters] = useState<FilterState>(EMPTY_FILTER);
    const [pendingFilters, setPendingFilters] = useState<FilterState>(EMPTY_FILTER);
    const [isExporting, setIsExporting] = useState(false);

    // ── Build CrudFilters dari state ─────────────────────────
    const buildCrudFilters = useCallback((f: FilterState): CrudFilters => {
        const result: CrudFilters = [];
        if (f.nama?.trim()) {
            result.push({ field: "nama", operator: "contains", value: f.nama.trim() });
        }
        if (f.kelas) {
            result.push({ field: "kelas", operator: "eq", value: f.kelas });
        }
        if (f.jurusan) {
            result.push({ field: "jurusan", operator: "eq", value: f.jurusan });
        }
        if (f.status) {
            result.push({ field: "status_santri", operator: "eq", value: f.status });
        }
        return result;
    }, []);

    // ── useTable terhubung ke filters state ──────────────────
    const { tableProps, tableQueryResult, setFilters: setTableFilters } = useTable<ISantri>({
        resource: "santri",
        syncWithLocation: false,
        sorters: { initial: [{ field: "created_at", order: "desc" }] },
        filters: {
            initial: buildCrudFilters(EMPTY_FILTER),
        },
        pagination: { pageSize: 10 },
    });

    const allData    = tableQueryResult?.data?.data    || [];
    const totalData  = tableQueryResult?.data?.total   || 0;
    const isFetching = tableQueryResult?.isFetching    || false;

    // ── Stats dari data halaman (approximate) ───────────────
    // Untuk stat akurat perlu fetch semua data. Kita gunakan total dari response
    const countByStatus = (s: string) => allData.filter(x => x.status_santri === s).length;
    const aktifCount    = countByStatus("AKTIF");
    const keluarCount   = countByStatus("KELUAR");
    const alumniCount   = countByStatus("ALUMNI");

    // ── Apply filter handler ─────────────────────────────────
    const applyFilters = useCallback(() => {
        setFilters(pendingFilters);
        setTableFilters(buildCrudFilters(pendingFilters), "replace");
    }, [pendingFilters, buildCrudFilters, setTableFilters]);

    const resetFilters = useCallback(() => {
        setPendingFilters(EMPTY_FILTER);
        setFilters(EMPTY_FILTER);
        setTableFilters([], "replace");
    }, [setTableFilters]);

    // ── Quick status filter ──────────────────────────────────
    const filterByStatus = useCallback((status: string | undefined) => {
        const next = { ...EMPTY_FILTER, status };
        setPendingFilters(next);
        setFilters(next);
        setTableFilters(buildCrudFilters(next), "replace");
    }, [buildCrudFilters, setTableFilters]);

    const activeFilterCount = [filters.nama, filters.kelas, filters.jurusan, filters.status]
        .filter(Boolean).length;

    // ═══════════════════════════════════════════════════════════
    // EXPORT EXCEL — WORLD CLASS CORPORATE
    // ═══════════════════════════════════════════════════════════
    const exportToExcel = async () => {
        setIsExporting(true);
        const key = "export_santri";
        message.loading({ content: "Menyiapkan laporan Excel...", key, duration: 0 });

        try {
            const rawData = tableQueryResult?.data?.data || [];

            const wb = new ExcelJS.Workbook();
            wb.creator  = "Sistem Informasi Al-Hasanah";
            wb.created  = new Date();
            wb.modified = new Date();

            const ws = wb.addWorksheet("Data Santri", {
                properties:  { tabColor: { argb: "FFC9A84C" } },
                pageSetup:   { paperSize: 9, orientation: "landscape", fitToPage: true },
                headerFooter: {
                    oddHeader:  "&C&B&16PONDOK PESANTREN AL-HASANAH",
                    oddFooter:  "&LDicetak: &D &T&RHal. &P dari &N",
                },
            });

            // ── Kolom width ───────────────────────────────────
            [4, 16, 38, 14, 30, 14, 10, 16].forEach((w, i) => {
                ws.getColumn(i + 1).width = w;
            });

            // ── 1. KOP SURAT ──────────────────────────────────
            ws.mergeCells("A1:H1");
            Object.assign(ws.getCell("A1"), {
                value: "PONDOK PESANTREN AL-HASANAH",
                font: { name: "Arial", size: 18, bold: true, color: { argb: "FF5C430A" } },
                alignment: { vertical: "middle", horizontal: "center" },
                fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDF6DC" } },
            });
            ws.getRow(1).height = 38;

            ws.mergeCells("A2:H2");
            Object.assign(ws.getCell("A2"), {
                value: "Jl. Raya Cibeuti Km.3 Rt.01/01, Kel. Cibeuti, Kec. Kawalu, Tasikmalaya 46182",
                font: { name: "Arial", size: 9.5, italic: true, color: { argb: "FF6B5F50" } },
                alignment: { vertical: "middle", horizontal: "center" },
                fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDF6DC" } },
            });
            ws.getRow(2).height = 18;

            ws.mergeCells("A3:H3");
            Object.assign(ws.getCell("A3"), {
                value: "Telp: (0265) 1234567  |  Email: admin@alhasanah.id  |  alhasanah.id",
                font: { name: "Arial", size: 8.5, color: { argb: "FF9E9080" } },
                alignment: { vertical: "middle", horizontal: "center" },
                fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDF6DC" } },
            });
            ws.getRow(3).height = 16;

            // Gold separator
            ws.mergeCells("A4:H4");
            ws.getCell("A4").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC9A84C" } };
            ws.getRow(4).height  = 4;

            // ── 2. JUDUL LAPORAN ──────────────────────────────
            ws.addRow([]);
            ws.mergeCells("A6:H6");
            const filterDesc = [
                filters.status  ? `Status: ${filters.status}` : "",
                filters.jurusan ? `Takhasus: ${filters.jurusan}` : "",
                filters.kelas   ? `Kelas: ${filters.kelas}` : "",
                filters.nama    ? `Nama: "${filters.nama}"` : "",
            ].filter(Boolean).join(" | ");

            Object.assign(ws.getCell("A6"), {
                value: `DATABASE SANTRI — ${filterDesc || "SEMUA DATA"} — Per ${dayjs().format("DD MMMM YYYY").toUpperCase()}`,
                font: { name: "Arial", size: 11, bold: true, color: { argb: "FF111827" } },
                alignment: { vertical: "middle", horizontal: "left" },
            });
            ws.getRow(6).height = 22;

            ws.mergeCells("A7:H7");
            Object.assign(ws.getCell("A7"), {
                value: `Total Data Diekspor: ${rawData.length} santri  |  Aktif: ${rawData.filter(d=>d.status_santri==="AKTIF").length}  |  Keluar: ${rawData.filter(d=>d.status_santri==="KELUAR").length}  |  Alumni: ${rawData.filter(d=>d.status_santri==="ALUMNI").length}`,
                font: { name: "Arial", size: 9, color: { argb: "FF9E9080" } },
                alignment: { vertical: "middle", horizontal: "left" },
            });
            ws.getRow(7).height = 16;

            ws.addRow([]);

            // ── 3. HEADER ─────────────────────────────────────
            const hdr = ws.addRow([
                "NO", "NIS", "NAMA LENGKAP", "GENDER",
                "TEMPAT, TANGGAL LAHIR", "TAKHASUS", "KELAS", "STATUS",
            ]);
            hdr.height = 28;
            hdr.eachCell(cell => {
                cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC9A84C" } };
                cell.font      = { name: "Arial", color: { argb: "FF000000" }, bold: true, size: 10 };
                cell.alignment = { vertical: "middle", horizontal: "center", wrapText: false };
                cell.border    = {
                    top:    { style: "medium", color: { argb: "FF8B6914" } },
                    left:   { style: "thin",   color: { argb: "FF8B6914" } },
                    bottom: { style: "medium", color: { argb: "FF8B6914" } },
                    right:  { style: "thin",   color: { argb: "FF8B6914" } },
                };
            });

            // ── 4. DATA ROWS ──────────────────────────────────
            const statusArgb: Record<string, string> = {
                AKTIF:  "FF059669",
                KELUAR: "FFDC2626",
                ALUMNI: "FFC9A84C",
                LULUS:  "FF2563EB",
            };

            rawData.forEach((item, idx) => {
                const isEven = idx % 2 === 0;
                const row    = ws.addRow([
                    idx + 1,
                    item.nis,
                    item.nama.toUpperCase(),
                    item.jenis_kelamin === "L" ? "LAKI-LAKI" : "PEREMPUAN",
                    `${item.tempat_lahir || "—"}, ${item.tanggal_lahir ? dayjs(item.tanggal_lahir).format("DD/MM/YYYY") : "—"}`,
                    item.jurusan || "—",
                    `${item.kelas}`,
                    item.status_santri,
                ]);
                row.height = 20;
                row.eachCell((cell, col) => {
                    cell.font      = { name: "Arial", size: 9.5 };
                    cell.alignment = { vertical: "middle", horizontal: "left" };
                    cell.border    = {
                        top:    { style: "hair", color: { argb: "FFE5DDD0" } },
                        left:   { style: "hair", color: { argb: "FFE5DDD0" } },
                        bottom: { style: "hair", color: { argb: "FFE5DDD0" } },
                        right:  { style: "hair", color: { argb: "FFE5DDD0" } },
                    };
                    if (!isEven) {
                        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF9F0" } };
                    }
                    if ([1,4,7].includes(col)) cell.alignment = { ...cell.alignment, horizontal: "center" };
                    if (col === 8) {
                        const argb = statusArgb[item.status_santri];
                        if (argb) cell.font = { ...cell.font, bold: true, color: { argb } };
                    }
                });
            });

            // ── 5. SUMMARY FOOTER ─────────────────────────────
            ws.addRow([]);
            const sumRow = ws.addRow([
                "", "", "", "", "", "",
                "TOTAL SANTRI :", rawData.length.toString(),
            ]);
            sumRow.font = { name: "Arial", size: 10, bold: true };
            sumRow.getCell(7).alignment = { horizontal: "right" };
            sumRow.getCell(8).font = { name: "Arial", size: 11, bold: true, color: { argb: "FFC9A84C" } };

            ws.addRow([]);
            const printRow = ws.addRow([
                "", "", "", "", "", "",
                "Dicetak:", `${dayjs().format("DD MMMM YYYY, HH:mm")} WIB`,
            ]);
            printRow.font = { name: "Arial", size: 8.5, italic: true, color: { argb: "FF9E9080" } };

            // ── 6. FINALIZE ───────────────────────────────────
            ws.autoFilter = "A9:H9";
            ws.views      = [{ state: "frozen", ySplit: 9 }];

            // Print area
            ws.pageSetup.printArea = `A1:H${9 + rawData.length + 4}`;

            const buffer  = await wb.xlsx.writeBuffer();
            const dateStr = dayjs().format("YYYY-MM-DD");
            const sfx     = activeFilterCount > 0 ? `_${[filters.status, filters.jurusan, filters.kelas].filter(Boolean).join("_")}` : "";
            saveAs(new Blob([buffer]), `Data_Santri_AlHasanah${sfx}_${dateStr}.xlsx`);

            message.success({ content: `✅ ${rawData.length} data berhasil diekspor!`, key, duration: 3 });
        } catch (err: any) {
            message.error({ content: `Gagal export: ${err.message}`, key });
        } finally {
            setIsExporting(false);
        }
    };

    // ── Shared card style ────────────────────────────────────
    const cardSt = (extra?: React.CSSProperties): React.CSSProperties => ({
        borderRadius: 20,
        border: `1px solid ${isDark ? "rgba(201,168,76,0.10)" : "rgba(201,168,76,0.14)"}`,
        background: token.colorBgContainer,
        boxShadow: isDark
            ? "0 4px 24px rgba(0,0,0,0.42)"
            : "0 2px 16px rgba(0,0,0,0.05)",
        ...extra,
    });

    // ═══════════════════════════════════════════════════════════
    // TABLE COLUMNS
    // ═══════════════════════════════════════════════════════════
    const columns: ProColumns<ISantri>[] = [
        {
            title: "#",
            valueType: "indexBorder",
            width: 52,
            fixed: "left",
            align: "center",
        },
        {
            title: "Identitas Santri",
            dataIndex: "nama",
            fixed: "left",
            width: 280,
            search: false,
            render: (_, record) => {
                const isMale = record.jenis_kelamin === "L";
                return (
                    <Space size={12}>
                        {/* Avatar */}
                        <div style={{ position: "relative", flexShrink: 0 }}>
                            <Avatar
                                size={46}
                                src={record.foto_url}
                                icon={!record.foto_url
                                    ? (isMale ? <ManOutlined /> : <WomanOutlined />)
                                    : undefined}
                                style={{
                                    backgroundColor: isMale
                                        ? (isDark ? "rgba(2,132,199,0.20)" : "#e0f2fe")
                                        : (isDark ? "rgba(219,39,119,0.16)" : "#fce7f3"),
                                    color: isMale ? "#0284c7" : "#db2777",
                                    fontSize: 19,
                                    boxShadow: isMale
                                        ? "0 0 0 2.5px #bae6fd"
                                        : "0 0 0 2.5px #fbcfe8",
                                    objectFit: "cover",
                                }}
                            />
                            {/* Online dot */}
                            {record.status_santri === "AKTIF" && (
                                <div style={{
                                    position: "absolute", bottom: 0, right: 0,
                                    width: 11, height: 11, borderRadius: "50%",
                                    background: SUCCESS,
                                    border: `2px solid ${token.colorBgContainer}`,
                                    boxShadow: `0 0 4px ${SUCCESS}`,
                                }} />
                            )}
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                            {/* Nama */}
                            <span style={{
                                fontSize: 13.5, fontWeight: 700,
                                color: token.colorText, lineHeight: 1.2,
                                whiteSpace: "nowrap", overflow: "hidden",
                                textOverflow: "ellipsis", maxWidth: 180,
                                fontFamily: "'DM Sans', sans-serif",
                            }}>
                                {record.nama}
                            </span>

                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                {/* NIS */}
                                <span style={{
                                    fontFamily: "'DM Mono', monospace",
                                    fontSize: 10, fontWeight: 600,
                                    background: G(isDark ? 0.14 : 0.08),
                                    color: isDark ? GOLD_BRIGHT : GOLD_DEEP,
                                    padding: "1px 7px", borderRadius: 5,
                                    border: `1px solid ${G(isDark ? 0.25 : 0.16)}`,
                                }}>
                                    {record.nis}
                                </span>
                                {/* Gender */}
                                <span style={{
                                    fontSize: 9.5, fontWeight: 700,
                                    color: isMale ? "#0284c7" : "#db2777",
                                    background: isMale ? "rgba(2,132,199,0.10)" : "rgba(219,39,119,0.08)",
                                    padding: "1px 6px", borderRadius: 4,
                                }}>
                                    {isMale ? "♂ L" : "♀ P"}
                                </span>
                            </div>
                        </div>
                    </Space>
                );
            },
        },
        {
            title: "Takhasus & Kelas",
            key: "takhasusKelas",
            width: 165,
            search: false,
            render: (_, record) => {
                const isTahfidz = record.jurusan === "TAHFIDZ";
                return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                        {/* Jurusan pill */}
                        <div style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            background: isTahfidz
                                ? (isDark ? "rgba(99,102,241,0.14)" : "#EEF2FF")
                                : (isDark ? G(0.12) : "#FDF6DC"),
                            border: `1px solid ${isTahfidz
                                ? (isDark ? "rgba(99,102,241,0.28)" : "rgba(99,102,241,0.22)")
                                : G(isDark ? 0.28 : 0.20)}`,
                            borderRadius: 99, padding: "3px 10px",
                            width: "fit-content",
                        }}>
                            {isTahfidz
                                ? <BookOutlined style={{ fontSize: 10, color: "#6366f1" }} />
                                : <StarOutlined  style={{ fontSize: 10, color: GOLD_BRIGHT }} />
                            }
                            <span style={{
                                fontSize: 11, fontWeight: 800,
                                color: isTahfidz ? "#6366f1" : (isDark ? GOLD_BRIGHT : GOLD_DEEP),
                                letterSpacing: "0.04em",
                                fontFamily: "'Syne', sans-serif",
                            }}>
                                {record.jurusan}
                            </span>
                        </div>

                        {/* Kelas badge */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 2 }}>
                            <div style={{
                                width: 22, height: 22, borderRadius: 7,
                                background: G(isDark ? 0.15 : 0.10),
                                border: `1px solid ${G(isDark ? 0.25 : 0.18)}`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 10.5, fontWeight: 900,
                                color: isDark ? GOLD_BRIGHT : GOLD_DEEP,
                                fontFamily: "'Syne', sans-serif",
                            }}>
                                {record.kelas}
                            </div>
                            <span style={{ fontSize: 11, color: token.colorTextSecondary }}>
                                Kelas {record.kelas}
                            </span>
                        </div>
                    </div>
                );
            },
        },
        {
            title: "Asal Daerah",
            dataIndex: "tempat_lahir",
            width: 155,
            search: false,
            render: (_, record) => (
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: token.colorText }}>
                        {record.tempat_lahir || "—"}
                    </span>
                    {record.tanggal_lahir && (
                        <span style={{ fontSize: 10.5, color: token.colorTextSecondary,
                            fontFamily: "'DM Mono', monospace" }}>
                            {dayjs(record.tanggal_lahir).format("DD MMM YYYY")}
                        </span>
                    )}
                </div>
            ),
        },
        {
            title: "Status",
            dataIndex: "status_santri",
            width: 110,
            align: "center",
            search: false,
            render: (_, record) => {
                const cfg = STATUS_CFG[record.status_santri as keyof typeof STATUS_CFG];
                if (!cfg) return <Tag>{record.status_santri}</Tag>;
                return (
                    <div style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "4px 12px", borderRadius: 99,
                        background: cfg.bg(isDark),
                        border: `1px solid ${cfg.border(isDark)}`,
                    }}>
                        <span style={{ fontSize: 10, color: cfg.color }}>{cfg.icon}</span>
                        <span style={{
                            fontSize: 10, fontWeight: 800, letterSpacing: "0.07em",
                            color: cfg.color, fontFamily: "'Syne', sans-serif",
                        }}>
                            {cfg.label}
                        </span>
                    </div>
                );
            },
        },
        {
            title: "Aksi",
            valueType: "option",
            key: "option",
            width: 100,
            fixed: "right",
            render: (_, record) => (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }} key="acts">
                    <Tooltip title="Lihat Detail">
                        <button
                            onClick={() => show("santri", record.nis)}
                            style={{
                                width: 30, height: 30, borderRadius: 8, border: "none",
                                cursor: "pointer", display: "flex", alignItems: "center",
                                justifyContent: "center", fontSize: 13,
                                background: G(isDark ? 0.14 : 0.08),
                                color: isDark ? GOLD_BRIGHT : GOLD_DEEP,
                                transition: "all 0.2s",
                            }}
                        >
                            <EyeOutlined />
                        </button>
                    </Tooltip>
                    <Tooltip title="Edit Data">
                        <button
                            onClick={() => edit("santri", record.nis)}
                            style={{
                                width: 30, height: 30, borderRadius: 8, border: "none",
                                cursor: "pointer", display: "flex", alignItems: "center",
                                justifyContent: "center", fontSize: 13,
                                background: isDark ? "rgba(37,99,235,0.12)" : "rgba(37,99,235,0.07)",
                                color: INFO, transition: "all 0.2s",
                            }}
                        >
                            <EditOutlined />
                        </button>
                    </Tooltip>
                </div>
            ),
        },
    ];

    // ════════════════════════════════════════════════════════
    return (
        <motion.div
            initial="hidden" animate="visible" variants={stagger}
            style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 60 }}
        >

            {/* ══════════════════════════════════════════════
                PAGE HEADER
            ══════════════════════════════════════════════ */}
            <motion.div variants={fadeUp} style={{
                display: "flex", flexWrap: "wrap", justifyContent: "space-between",
                alignItems: "flex-end", gap: 16,
                paddingBottom: 24,
                borderBottom: `1px solid ${isDark ? "rgba(201,168,76,0.10)" : "rgba(201,168,76,0.14)"}`,
            }}>
                <div>
                    {/* Eyebrow */}
                    <div style={{
                        display: "flex", alignItems: "center", gap: 8,
                        fontSize: 10, fontWeight: 800, letterSpacing: "0.14em",
                        textTransform: "uppercase", color: GOLD, marginBottom: 6,
                        fontFamily: "'Syne', sans-serif",
                    }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%",
                            background: GOLD_BRIGHT, display: "inline-block",
                            animation: "dotPulse 2s ease-in-out infinite" }} />
                        Sistem Manajemen Pesantren
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{
                            width: 50, height: 50, borderRadius: 15, flexShrink: 0,
                            background: `linear-gradient(135deg, ${G(0.22)}, ${G(0.38)})`,
                            border: `1px solid ${G(0.30)}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: GOLD_BRIGHT, fontSize: 22,
                            boxShadow: `0 6px 20px ${G(0.25)}`,
                        }}>
                            <TeamOutlined />
                        </div>
                        <div>
                            <h1 style={{
                                margin: 0, fontFamily: "'Syne', sans-serif", fontWeight: 800,
                                fontSize: "clamp(20px,3vw,26px)", letterSpacing: "-0.03em",
                                color: token.colorText, lineHeight: 1.2,
                            }}>
                                Data{" "}
                                <span style={{
                                    background: `linear-gradient(90deg, ${GOLD_DEEP}, ${GOLD_BRIGHT}, ${GOLD})`,
                                    backgroundSize: "200% auto",
                                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                                    backgroundClip: "text",
                                    animation: "goldShimmer 5s linear infinite",
                                }}>
                                    Santri
                                </span>
                            </h1>
                            <span style={{ fontSize: 12.5, color: token.colorTextSecondary }}>
                                Manajemen &amp; Direktori Seluruh Santri Al-Hasanah
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {/* Export */}
                    <button
                        onClick={exportToExcel}
                        disabled={isExporting}
                        style={{
                            display: "flex", alignItems: "center", gap: 7,
                            padding: "0 16px", height: 38, borderRadius: 10,
                            border: `1px solid rgba(5,150,105,0.28)`,
                            background: isDark ? "rgba(5,150,105,0.08)" : "rgba(5,150,105,0.06)",
                            color: SUCCESS, cursor: "pointer", fontSize: 12.5, fontWeight: 700,
                            transition: "all 0.2s", fontFamily: "'DM Sans', sans-serif",
                        }}
                    >
                        {isExporting
                            ? <SyncOutlined spin />
                            : <FileExcelOutlined />
                        }
                        Export Excel
                    </button>

                    {/* Tambah */}
                    <button
                        onClick={() => create("santri")}
                        style={{
                            display: "flex", alignItems: "center", gap: 7,
                            padding: "0 20px", height: 38, borderRadius: 10, border: "none",
                            background: `linear-gradient(135deg, ${GOLD}, ${GOLD_BRIGHT})`,
                            color: "#000", cursor: "pointer", fontSize: 12.5, fontWeight: 800,
                            boxShadow: `0 4px 16px ${G(0.40)}`,
                            transition: "all 0.2s", fontFamily: "'DM Sans', sans-serif",
                        }}
                    >
                        <PlusOutlined />
                        Tambah Santri
                    </button>
                </div>
            </motion.div>

            {/* ══════════════════════════════════════════════
                STAT CARDS — Tanpa LULUS sesuai permintaan
            ══════════════════════════════════════════════ */}
            <Row gutter={[20, 20]}>
                {[
                    {
                        label: "Total Santri",
                        count: totalData,
                        icon: <DatabaseOutlined />,
                        color: GOLD_BRIGHT,
                        idx: 0,
                        status: undefined,
                    },
                    {
                        label: "Santri Aktif",
                        count: aktifCount,
                        icon: <CheckCircleOutlined />,
                        color: SUCCESS,
                        idx: 1,
                        status: "AKTIF",
                    },
                    {
                        label: "Alumni",
                        count: alumniCount,
                        icon: <CrownOutlined />,
                        color: GOLD_BRIGHT,
                        idx: 2,
                        status: "ALUMNI",
                    },
                    {
                        label: "Keluar",
                        count: keluarCount,
                        icon: <LogoutOutlined />,
                        color: DANGER,
                        idx: 3,
                        status: "KELUAR",
                    },
                ].map(s => (
                    <Col key={s.label} xs={24} sm={12} xl={6}>
                        <StatCard
                            label={s.label}
                            count={s.count}
                            icon={s.icon}
                            color={s.color}
                            total={totalData}
                            isDark={isDark}
                            index={s.idx}
                            active={filters.status === s.status && s.status !== undefined}
                            onClick={s.status ? () => filterByStatus(
                                filters.status === s.status ? undefined : s.status
                            ) : undefined}
                        />
                    </Col>
                ))}
            </Row>

            {/* ══════════════════════════════════════════════
                FILTER BAR — Premium, Fully Controlled
            ══════════════════════════════════════════════ */}
            <motion.div variants={fadeUp} custom={4}>
                <div style={{
                    ...cardSt(),
                    padding: "20px 24px",
                }}>
                    {/* Filter header */}
                    <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        marginBottom: 16,
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <FilterOutlined style={{ color: GOLD_BRIGHT, fontSize: 14 }} />
                            <span style={{
                                fontFamily: "'Syne', sans-serif", fontWeight: 800,
                                fontSize: 13, letterSpacing: "-0.01em",
                                color: token.colorText,
                            }}>
                                Filter &amp; Pencarian
                            </span>
                            {activeFilterCount > 0 && (
                                <span style={{
                                    padding: "1px 8px", borderRadius: 99,
                                    background: `linear-gradient(135deg, ${GOLD}, ${GOLD_BRIGHT})`,
                                    fontSize: 10, fontWeight: 800, color: "#000",
                                }}>
                                    {activeFilterCount} aktif
                                </span>
                            )}
                        </div>

                        {/* Reset */}
                        {activeFilterCount > 0 && (
                            <button
                                onClick={resetFilters}
                                style={{
                                    display: "flex", alignItems: "center", gap: 5,
                                    padding: "0 12px", height: 30, borderRadius: 8,
                                    border: `1px solid ${DANGER}28`,
                                    background: `${DANGER}08`, color: DANGER,
                                    cursor: "pointer", fontSize: 11, fontWeight: 700,
                                    transition: "all 0.2s", fontFamily: "'DM Sans', sans-serif",
                                }}
                            >
                                <CloseCircleOutlined style={{ fontSize: 11 }} />
                                Reset Filter
                            </button>
                        )}
                    </div>

                    {/* Filter inputs grid */}
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                        gap: 12,
                        marginBottom: 16,
                    }}>
                        {/* Nama search */}
                        <div>
                            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
                                textTransform: "uppercase", color: token.colorTextTertiary,
                                marginBottom: 5, fontFamily: "'Syne', sans-serif" }}>
                                Cari Nama
                            </div>
                            <Input
                                prefix={<SearchOutlined style={{ color: G(0.5), fontSize: 13 }} />}
                                placeholder="Ketik nama santri..."
                                value={pendingFilters.nama}
                                onChange={e => setPendingFilters(p => ({ ...p, nama: e.target.value }))}
                                onPressEnter={applyFilters}
                                allowClear
                                onClear={() => {
                                    setPendingFilters(p => ({ ...p, nama: "" }));
                                    const next = { ...filters, nama: "" };
                                    setFilters(next);
                                    setTableFilters(buildCrudFilters(next), "replace");
                                }}
                                style={{ borderRadius: 10, height: 38 }}
                            />
                        </div>

                        {/* Kelas */}
                        <div>
                            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
                                textTransform: "uppercase", color: token.colorTextTertiary,
                                marginBottom: 5, fontFamily: "'Syne', sans-serif" }}>
                                Kelas
                            </div>
                            <Select
                                style={{ width: "100%", height: 38 }}
                                placeholder="Semua Kelas"
                                allowClear
                                value={pendingFilters.kelas}
                                options={KELAS_OPTIONS}
                                onChange={v => setPendingFilters(p => ({ ...p, kelas: v }))}
                                onClear={() => {
                                    setPendingFilters(p => ({ ...p, kelas: undefined }));
                                    const next = { ...filters, kelas: undefined };
                                    setFilters(next);
                                    setTableFilters(buildCrudFilters(next), "replace");
                                }}
                            />
                        </div>

                        {/* Takhasus / Jurusan */}
                        <div>
                            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
                                textTransform: "uppercase", color: token.colorTextTertiary,
                                marginBottom: 5, fontFamily: "'Syne', sans-serif" }}>
                                Takhasus
                            </div>
                            <Select
                                style={{ width: "100%", height: 38 }}
                                placeholder="Semua Takhasus"
                                allowClear
                                value={pendingFilters.jurusan}
                                options={JURUSAN_OPTIONS}
                                onChange={v => setPendingFilters(p => ({ ...p, jurusan: v }))}
                                onClear={() => {
                                    setPendingFilters(p => ({ ...p, jurusan: undefined }));
                                    const next = { ...filters, jurusan: undefined };
                                    setFilters(next);
                                    setTableFilters(buildCrudFilters(next), "replace");
                                }}
                            />
                        </div>

                        {/* Status */}
                        <div>
                            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
                                textTransform: "uppercase", color: token.colorTextTertiary,
                                marginBottom: 5, fontFamily: "'Syne', sans-serif" }}>
                                Status Santri
                            </div>
                            <Select
                                style={{ width: "100%", height: 38 }}
                                placeholder="Semua Status"
                                allowClear
                                value={pendingFilters.status}
                                options={STATUS_OPTIONS}
                                onChange={v => setPendingFilters(p => ({ ...p, status: v }))}
                                onClear={() => {
                                    setPendingFilters(p => ({ ...p, status: undefined }));
                                    const next = { ...filters, status: undefined };
                                    setFilters(next);
                                    setTableFilters(buildCrudFilters(next), "replace");
                                }}
                            />
                        </div>
                    </div>

                    {/* Apply button + active pills */}
                    <div style={{ display: "flex", alignItems: "center",
                        justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>

                        {/* Active filter pills */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, flex: 1 }}>
                            {filters.nama && (
                                <div style={{
                                    display: "flex", alignItems: "center", gap: 5,
                                    padding: "3px 10px", borderRadius: 99,
                                    background: G(isDark ? 0.14 : 0.08),
                                    border: `1px solid ${G(isDark ? 0.25 : 0.16)}`,
                                    fontSize: 11, fontWeight: 700, color: isDark ? GOLD_BRIGHT : GOLD_DEEP,
                                }}>
                                    <SearchOutlined style={{ fontSize: 10 }} />
                                    "{filters.nama}"
                                    <CloseCircleOutlined
                                        style={{ fontSize: 10, cursor: "pointer", opacity: 0.7 }}
                                        onClick={() => {
                                            setPendingFilters(p => ({ ...p, nama: "" }));
                                            const next = { ...filters, nama: "" };
                                            setFilters(next);
                                            setTableFilters(buildCrudFilters(next), "replace");
                                        }}
                                    />
                                </div>
                            )}
                            {filters.kelas && (
                                <div style={{
                                    display: "flex", alignItems: "center", gap: 5,
                                    padding: "3px 10px", borderRadius: 99,
                                    background: `${INFO}14`,
                                    border: `1px solid ${INFO}28`,
                                    fontSize: 11, fontWeight: 700, color: INFO,
                                }}>
                                    <AimOutlined style={{ fontSize: 10 }} />
                                    Kelas {filters.kelas}
                                </div>
                            )}
                            {filters.jurusan && (
                                <div style={{
                                    display: "flex", alignItems: "center", gap: 5,
                                    padding: "3px 10px", borderRadius: 99,
                                    background: filters.jurusan === "TAHFIDZ" ? "rgba(99,102,241,0.12)" : G(0.10),
                                    border: `1px solid ${filters.jurusan === "TAHFIDZ" ? "rgba(99,102,241,0.25)" : G(0.20)}`,
                                    fontSize: 11, fontWeight: 700,
                                    color: filters.jurusan === "TAHFIDZ" ? "#6366f1" : GOLD_BRIGHT,
                                }}>
                                    <BookOutlined style={{ fontSize: 10 }} />
                                    {filters.jurusan}
                                </div>
                            )}
                            {filters.status && (
                                <div style={{
                                    display: "flex", alignItems: "center", gap: 5,
                                    padding: "3px 10px", borderRadius: 99,
                                    background: STATUS_CFG[filters.status as keyof typeof STATUS_CFG]?.bg(isDark) || G(0.10),
                                    border: `1px solid ${STATUS_CFG[filters.status as keyof typeof STATUS_CFG]?.border(isDark) || G(0.20)}`,
                                    fontSize: 11, fontWeight: 700,
                                    color: STATUS_CFG[filters.status as keyof typeof STATUS_CFG]?.color || GOLD_BRIGHT,
                                }}>
                                    <CheckCircleOutlined style={{ fontSize: 10 }} />
                                    {filters.status}
                                </div>
                            )}

                            {activeFilterCount === 0 && (
                                <span style={{ fontSize: 11, color: token.colorTextTertiary, fontStyle: "italic" }}>
                                    Tidak ada filter aktif — menampilkan semua data
                                </span>
                            )}
                        </div>

                        {/* Apply & Reload */}
                        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                            <button
                                onClick={() => tableQueryResult.refetch()}
                                style={{
                                    width: 36, height: 36, borderRadius: 10,
                                    border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                                    background: "transparent", cursor: "pointer",
                                    color: token.colorTextSecondary, fontSize: 14,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    transition: "all 0.2s",
                                }}
                            >
                                <ReloadOutlined spin={isFetching} />
                            </button>

                            <button
                                onClick={applyFilters}
                                style={{
                                    display: "flex", alignItems: "center", gap: 7,
                                    padding: "0 20px", height: 36, borderRadius: 10, border: "none",
                                    background: `linear-gradient(135deg, ${GOLD}, ${GOLD_BRIGHT})`,
                                    color: "#000", cursor: "pointer", fontSize: 12.5, fontWeight: 800,
                                    boxShadow: `0 4px 14px ${G(0.38)}`,
                                    transition: "all 0.2s", fontFamily: "'DM Sans', sans-serif",
                                }}
                            >
                                <SearchOutlined />
                                Terapkan Filter
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* ══════════════════════════════════════════════
                DATA TABLE
            ══════════════════════════════════════════════ */}
            <motion.div variants={fadeUp} custom={5}>
                <div style={{
                    borderRadius: 20, overflow: "hidden",
                    border: `1px solid ${isDark ? "rgba(201,168,76,0.10)" : "rgba(201,168,76,0.13)"}`,
                    boxShadow: isDark
                        ? "0 10px 40px rgba(0,0,0,0.45)"
                        : `0 8px 32px ${G(0.08)}, 0 2px 8px rgba(0,0,0,0.04)`,
                }}>
                    <ProTable<ISantri>
                        {...tableProps}
                        columns={columns}
                        rowKey="nis"
                        search={false}
                        scroll={{ x: 1080 }}

                        /* ── Header title ── */
                        headerTitle={
                            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
                                <div style={{
                                    width: 36, height: 36, borderRadius: 10,
                                    background: `linear-gradient(135deg, ${G(0.22)}, ${G(0.38)})`,
                                    border: `1px solid ${G(0.28)}`,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    color: GOLD_BRIGHT, fontSize: 16,
                                }}>
                                    <TeamOutlined />
                                </div>
                                <div>
                                    <div style={{
                                        fontFamily: "'Syne', sans-serif", fontWeight: 800,
                                        fontSize: 15, letterSpacing: "-0.02em",
                                        color: token.colorText,
                                    }}>
                                        Direktori Santri
                                    </div>
                                    <div style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 1 }}>
                                        {isFetching
                                            ? "Memuat data..."
                                            : `${totalData.toLocaleString("id-ID")} santri${activeFilterCount > 0 ? " (difilter)" : " terdaftar"}`
                                        }
                                    </div>
                                </div>

                                {/* Filter indicator */}
                                {activeFilterCount > 0 && (
                                    <div style={{
                                        padding: "3px 10px", borderRadius: 99,
                                        background: G(0.12), border: `1px solid ${G(0.22)}`,
                                        fontSize: 10, fontWeight: 700, color: GOLD_BRIGHT,
                                        display: "flex", alignItems: "center", gap: 5,
                                    }}>
                                        <FilterOutlined style={{ fontSize: 9 }} />
                                        {activeFilterCount} filter aktif
                                    </div>
                                )}
                            </div>
                        }

                        /* ── Toolbar ── */
                        toolBarRender={() => [
                            <button
                                key="export"
                                onClick={exportToExcel}
                                disabled={isExporting}
                                style={{
                                    display: "flex", alignItems: "center", gap: 7,
                                    padding: "0 16px", height: 36, borderRadius: 10,
                                    border: `1px solid rgba(5,150,105,0.25)`,
                                    background: isDark ? "rgba(5,150,105,0.08)" : "rgba(5,150,105,0.05)",
                                    color: SUCCESS, cursor: "pointer", fontSize: 12, fontWeight: 700,
                                    transition: "all 0.2s", fontFamily: "'DM Sans', sans-serif",
                                }}
                            >
                                {isExporting ? <SyncOutlined spin /> : <FileExcelOutlined />}
                                Export
                            </button>,
                            <button
                                key="create"
                                onClick={() => create("santri")}
                                style={{
                                    display: "flex", alignItems: "center", gap: 7,
                                    padding: "0 18px", height: 36, borderRadius: 10, border: "none",
                                    background: `linear-gradient(135deg, ${GOLD}, ${GOLD_BRIGHT})`,
                                    color: "#000", cursor: "pointer", fontSize: 12, fontWeight: 800,
                                    boxShadow: `0 3px 12px ${G(0.38)}`,
                                    transition: "all 0.2s", fontFamily: "'DM Sans', sans-serif",
                                }}
                            >
                                <PlusOutlined />
                                Tambah
                            </button>,
                        ]}

                        /* ── Options ── */
                        options={{
                            density:    true,
                            fullScreen: true,
                            setting:    true,
                            reload:     () => tableQueryResult.refetch(),
                        }}

                        /* ── Pagination ── */
                        pagination={{
                            defaultPageSize: 10,
                            pageSizeOptions: [10, 20, 50, 100],
                            showSizeChanger: true,
                            showTotal: (total, range) => (
                                <span style={{ fontSize: 12, color: token.colorTextSecondary, fontWeight: 500 }}>
                                    Menampilkan{" "}
                                    <strong style={{ color: isDark ? GOLD_BRIGHT : GOLD_DEEP }}>
                                        {range[0]}–{range[1]}
                                    </strong>{" "}
                                    dari{" "}
                                    <strong style={{ color: token.colorText }}>{total}</strong>{" "}
                                    santri
                                </span>
                            ),
                            style: { padding: "12px 20px" },
                        }}

                        /* ── Table style ── */
                        tableStyle={{ padding: 0 }}
                        cardBordered={false}

                        /* ── Row class ── */
                        rowClassName={(_, i) => i % 2 !== 0
                            ? isDark ? "dark-row-odd" : "light-row-odd"
                            : ""}
                    />
                </div>
            </motion.div>
        </motion.div>
    );
};
