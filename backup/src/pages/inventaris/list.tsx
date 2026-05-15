import React, { useState, useMemo, useCallback } from "react";
import { useTable } from "@refinedev/antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import {
    Typography, Tooltip, Avatar, Card, Row, Col,
    message, Popconfirm, Select, Input, theme,
    Progress, Divider, Badge,
} from "antd";
import { motion, AnimatePresence, Variants } from "framer-motion";
import {
    PlusOutlined, BarcodeOutlined, DownloadOutlined,
    AppstoreOutlined, QrcodeOutlined, EyeOutlined,
    EditOutlined, DeleteOutlined, CheckCircleOutlined,
    WarningOutlined, CloseCircleOutlined, QuestionCircleOutlined,
    FilterOutlined, ReloadOutlined, FilePdfOutlined,
    FileExcelOutlined, SyncOutlined, CloseSquareOutlined,
    SafetyCertificateOutlined, DollarOutlined, ShopOutlined,
    AimOutlined, EnvironmentOutlined, CalendarOutlined,
    TrophyOutlined, RocketOutlined, SearchOutlined,
    CloseCircleFilled,
} from "@ant-design/icons";
import { useNavigation, useDelete, CrudFilters } from "@refinedev/core";
import { formatHijri, formatMasehi } from "../../utility/dateHelper";
import { IInventaris } from "../../types";
import dayjs from "dayjs";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { jsPDF } from "jspdf";
import "jspdf-autotable";

const { Text } = Typography;
const { useToken } = theme;

// ═══════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════
const GOLD        = "#C9A84C";
const GOLD_BRIGHT = "#FFB700";
const GOLD_LIGHT  = "#FDE68A";
const GOLD_DEEP   = "#8B6914";
const GOLD_DARK   = "#5C430A";
const SUCCESS     = "#059669";
const DANGER      = "#DC2626";
const WARNING     = "#D97706";
const INFO        = "#2563EB";
const PURPLE      = "#7C3AED";
const G           = (o: number) => `rgba(201,168,76,${o})`;

// ═══════════════════════════════════════════════════════════════
// KONDISI CONFIG
// ═══════════════════════════════════════════════════════════════
const KONDISI_CFG = {
    BAIK: {
        label: "Baik", short: "BAIK",
        color: SUCCESS,
        bg: (d: boolean) => d ? `${SUCCESS}14` : "#F0FDF4",
        border: (d: boolean) => d ? `${SUCCESS}28` : `${SUCCESS}20`,
        icon: <CheckCircleOutlined />,
        hex: "#059669",
    },
    RUSAK_RINGAN: {
        label: "Rusak Ringan", short: "R.RINGAN",
        color: WARNING,
        bg: (d: boolean) => d ? `${WARNING}14` : "#FFFBEB",
        border: (d: boolean) => d ? `${WARNING}28` : `${WARNING}20`,
        icon: <WarningOutlined />,
        hex: "#D97706",
    },
    RUSAK_BERAT: {
        label: "Rusak Berat", short: "R.BERAT",
        color: DANGER,
        bg: (d: boolean) => d ? `${DANGER}14` : "#FFF1F2",
        border: (d: boolean) => d ? `${DANGER}28` : `${DANGER}20`,
        icon: <CloseCircleOutlined />,
        hex: "#DC2626",
    },
    HILANG: {
        label: "Hilang", short: "HILANG",
        color: "#6B7280",
        bg: (d: boolean) => d ? "rgba(107,114,128,0.14)" : "#F9FAFB",
        border: (d: boolean) => d ? "rgba(107,114,128,0.28)" : "rgba(107,114,128,0.20)",
        icon: <QuestionCircleOutlined />,
        hex: "#6B7280",
    },
} as const;

type KondisiKey = keyof typeof KONDISI_CFG;

// ═══════════════════════════════════════════════════════════════
// SUMBER DANA COLOR MAP
// ═══════════════════════════════════════════════════════════════
const SUMBER_COLOR: Record<string, string> = {
    WAKAF:   GOLD,
    INFAQ:   SUCCESS,
    HIBAH:   PURPLE,
    BELI:    INFO,
    DONASI:  "#0891B2",
};

// ═══════════════════════════════════════════════════════════════
// ANIMATION VARIANTS
// ═══════════════════════════════════════════════════════════════
const fadeUp: Variants = {
    hidden:  { opacity: 0, y: 15 },
    visible: (i = 0) => ({
        opacity: 1, y: 0,
        transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: i * 0.05 },
    }),
};

const stagger = { visible: { transition: { staggerChildren: 0.07 } } };

// ═══════════════════════════════════════════════════════════════
// FILTER STATE
// ═══════════════════════════════════════════════════════════════
interface FilterState {
    nama:     string;
    kondisi:  string | undefined;
    sumber:   string | undefined;
}
const EMPTY_FILTER: FilterState = { nama: "", kondisi: undefined, sumber: undefined };

// ═══════════════════════════════════════════════════════════════
// KPI CARD COMPONENT
// ═══════════════════════════════════════════════════════════════
interface KPIProps {
    title: string;
    value: React.ReactNode;
    sub?: string;
    icon: React.ReactNode;
    color: string;
    index: number;
    isDark: boolean;
    progress?: number;
    active?: boolean;
    onClick?: () => void;
    badge?: React.ReactNode;
}

const KPICard: React.FC<KPIProps> = ({
    title, value, sub, icon, color, index, isDark,
    progress, active, onClick, badge,
}) => (
    <motion.div custom={index} variants={fadeUp} style={{ height: "100%" }}>
        <div
            onClick={onClick}
            style={{
                borderRadius: 20,
                border: active
                    ? `1.5px solid ${color}`
                    : `1px solid ${isDark ? G(0.10) : G(0.14)}`,
                background: isDark ? "#0F0F1A" : "#FFFFFF",
                padding: "20px 22px",
                height: "100%",
                position: "relative",
                overflow: "hidden",
                cursor: onClick ? "pointer" : "default",
                transition: "all 0.25s cubic-bezier(0.22,1,0.36,1)",
                boxShadow: active
                    ? `0 6px 28px ${color}30, 0 0 0 1px ${color}20`
                    : isDark ? "0 4px 24px rgba(0,0,0,0.42)" : "0 2px 16px rgba(0,0,0,0.05)",
                transform: active ? "translateY(-2px)" : undefined,
            }}
        >
            {/* Gold top accent */}
            <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 2,
                background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
                opacity: active ? 1 : 0.6,
            }} />
            {/* Glow */}
            <div style={{
                position: "absolute", bottom: -24, right: -24,
                width: 110, height: 110, borderRadius: "50%",
                background: `radial-gradient(circle, ${color}18 0%, transparent 70%)`,
                pointerEvents: "none",
            }} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontSize: 9.5, fontWeight: 800, letterSpacing: "0.12em",
                        textTransform: "uppercase", color: isDark ? "#5C5248" : "#9E9080",
                        fontFamily: "'Syne', sans-serif", marginBottom: 10,
                    }}>
                        {title}
                    </div>
                    <div style={{
                        fontFamily: "'Syne', sans-serif", fontWeight: 800,
                        fontSize: 26, letterSpacing: "-0.04em", lineHeight: 1,
                        color: isDark ? "#F0EDE5" : "#0A0805",
                    }}>
                        {value}
                    </div>
                    {sub && (
                        <div style={{
                            marginTop: 8, fontSize: 10.5, fontWeight: 600,
                            color, display: "flex", alignItems: "center", gap: 5,
                        }}>
                            {sub}
                        </div>
                    )}
                    {badge && <div style={{ marginTop: 8 }}>{badge}</div>}
                </div>
                <div style={{
                    width: 44, height: 44, borderRadius: 13, flexShrink: 0,
                    background: `${color}18`, border: `1px solid ${color}28`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color, fontSize: 20, boxShadow: `0 4px 14px ${color}20`,
                }}>
                    {icon}
                </div>
            </div>

            {/* Progress bar */}
            {progress !== undefined && (
                <div style={{ marginTop: 14 }}>
                    <div style={{ height: 4, borderRadius: 99,
                        background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                        overflow: "hidden" }}>
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.9, ease: [0.22,1,0.36,1], delay: index * 0.07 + 0.3 }}
                            style={{
                                height: "100%", borderRadius: 99,
                                background: `linear-gradient(90deg, ${color}, ${color}88)`,
                            }}
                        />
                    </div>
                    <div style={{ fontSize: 9.5, color: isDark ? "#5C5248" : "#9E9080",
                        marginTop: 4, textAlign: "right" }}>
                        {progress.toFixed(0)}%
                    </div>
                </div>
            )}
        </div>
    </motion.div>
);

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export const InventarisList = () => {
    const { token } = useToken();
    const bg     = token.colorBgContainer;
    const isDark = (() => {
        const c = bg.replace("#","");
        if (c.length < 6) return false;
        const lum = 0.299*parseInt(c.slice(0,2),16)
                  + 0.587*parseInt(c.slice(2,4),16)
                  + 0.114*parseInt(c.slice(4,6),16);
        return lum < 128;
    })();

    const { create, edit, show } = useNavigation();
    const { mutate: deleteMutate } = useDelete();

    // ── Filter state ─────────────────────────────────────────
    const [filters, setFilters]           = useState<FilterState>(EMPTY_FILTER);
    const [pendingFilters, setPending]    = useState<FilterState>(EMPTY_FILTER);
    const [isExportingXlsx, setXlsx]      = useState(false);
    const [isExportingPdf, setPdf]        = useState(false);

    // ── Build CrudFilters ────────────────────────────────────
    const buildCrud = useCallback((f: FilterState): CrudFilters => {
        const out: CrudFilters = [];
        if (f.nama?.trim())
            out.push({ field: "nama_barang", operator: "contains", value: f.nama.trim() });
        if (f.kondisi)
            out.push({ field: "kondisi", operator: "eq", value: f.kondisi });
        if (f.sumber)
            out.push({ field: "sumber_dana", operator: "eq", value: f.sumber });
        return out;
    }, []);

    // ── useTable ─────────────────────────────────────────────
    const { tableProps, tableQueryResult, setFilters: setTableFilters } = useTable<IInventaris>({
        resource: "inventaris",
        syncWithLocation: false,
        meta: { select: "*, kategori:kategori_barang(nama_kategori), lokasi:lokasi_aset(nama_lokasi)" },
        sorters: { initial: [{ field: "created_at", order: "desc" }] },
        filters: { initial: [] },
        pagination: { pageSize: 12 },
    });

    const allData    = tableQueryResult?.data?.data   || [];
    const totalCount = tableQueryResult?.data?.total  || 0;
    const isFetching = tableQueryResult?.isFetching   || false;

    // ── Smart KPIs ───────────────────────────────────────────
    const kpiData = useMemo(() => {
        const nilaiTotal   = allData.reduce((a, c) => a + Number(c.harga_perolehan || 0), 0);
        const unitTotal    = allData.reduce((a, c) => a + Number(c.jumlah || 1), 0);
        const baikCount    = allData.filter(i => i.kondisi === "BAIK").length;
        const rusakCount   = allData.filter(i => i.kondisi?.includes("RUSAK")).length;
        const hilangCount  = allData.filter(i => i.kondisi === "HILANG").length;
        const nilaiRusak   = allData
            .filter(i => i.kondisi?.includes("RUSAK"))
            .reduce((a, c) => a + Number(c.harga_perolehan || 0), 0);
        const tahunIni     = allData.filter(i => dayjs(i.tanggal_perolehan).year() === dayjs().year()).length;
        const baikPct      = allData.length > 0 ? (baikCount / allData.length) * 100 : 0;
        const rusakPct     = allData.length > 0 ? (rusakCount / allData.length) * 100 : 0;

        const byKondisi = {
            BAIK:         baikCount,
            RUSAK_RINGAN: allData.filter(i => i.kondisi === "RUSAK_RINGAN").length,
            RUSAK_BERAT:  allData.filter(i => i.kondisi === "RUSAK_BERAT").length,
            HILANG:       hilangCount,
        };

        return {
            nilaiTotal, unitTotal, baikCount, rusakCount, hilangCount,
            nilaiRusak, tahunIni, baikPct, rusakPct, byKondisi,
        };
    }, [allData]);

    // ── Filter handlers ──────────────────────────────────────
    const applyFilters = useCallback(() => {
        setFilters(pendingFilters);
        setTableFilters(buildCrud(pendingFilters), "replace");
    }, [pendingFilters, buildCrud, setTableFilters]);

    const resetFilters = useCallback(() => {
        setPending(EMPTY_FILTER);
        setFilters(EMPTY_FILTER);
        setTableFilters([], "replace");
    }, [setTableFilters]);

    const quickKondisiFilter = useCallback((kondisi: string | undefined) => {
        const next = { ...EMPTY_FILTER, kondisi };
        setPending(next); setFilters(next);
        setTableFilters(buildCrud(next), "replace");
    }, [buildCrud, setTableFilters]);

    const activeCount = [filters.nama, filters.kondisi, filters.sumber].filter(Boolean).length;

    // ── Format nilai ─────────────────────────────────────────
    const fmtRupiah = (v: number) => {
        if (v >= 1_000_000_000) return `Rp ${(v/1_000_000_000).toFixed(2)} M`;
        if (v >= 1_000_000)     return `Rp ${(v/1_000_000).toFixed(1)} Jt`;
        if (v >= 1_000)         return `Rp ${(v/1_000).toFixed(0)} Rb`;
        return `Rp ${v}`;
    };
    const fmtFull = (v: number) =>
        new Intl.NumberFormat("id-ID", { style:"currency", currency:"IDR", maximumFractionDigits:0 }).format(v);

    // ═══════════════════════════════════════════════════════════
    // EXPORT EXCEL — CORPORATE WORLD CLASS
    // ═══════════════════════════════════════════════════════════
    const exportExcel = async () => {
        setXlsx(true);
        const key = "xlsx_export";
        message.loading({ content: "Menyiapkan laporan Excel...", key, duration: 0 });
        try {
            const wb = new ExcelJS.Workbook();
            wb.creator  = "Sistem Informasi Al-Hasanah";
            wb.created  = new Date();
            wb.modified = new Date();

            // ── Sheet 1: Data Lengkap ──────────────────────────
            const ws = wb.addWorksheet("Data Inventaris", {
                properties: { tabColor: { argb: "FFC9A84C" } },
                pageSetup:  { paperSize: 9, orientation: "landscape", fitToPage: true },
                headerFooter: {
                    oddHeader: "&C&B&16PONDOK PESANTREN AL-HASANAH",
                    oddFooter: "&LDicetak: &D &T&RHal. &P dari &N",
                },
            });

            // Column widths
            [6, 18, 34, 18, 20, 15, 14, 16, 22, 22, 10].forEach((w, i) => {
                ws.getColumn(i + 1).width = w;
            });

            // KOP SURAT
            ws.mergeCells("A1:K1");
            Object.assign(ws.getCell("A1"), {
                value: "PONDOK PESANTREN AL-HASANAH",
                font:      { name:"Arial", size:18, bold:true, color:{ argb:"FF5C430A" } },
                alignment: { vertical:"middle", horizontal:"center" },
                fill:      { type:"pattern", pattern:"solid", fgColor:{ argb:"FFFDF6DC" } },
            });
            ws.getRow(1).height = 38;

            ws.mergeCells("A2:K2");
            Object.assign(ws.getCell("A2"), {
                value: "Jl. Raya Cibeuti Km.3 Rt.01/01, Kel. Cibeuti, Kec. Kawalu, Tasikmalaya 46182",
                font:      { name:"Arial", size:9.5, italic:true, color:{ argb:"FF6B5F50" } },
                alignment: { vertical:"middle", horizontal:"center" },
                fill:      { type:"pattern", pattern:"solid", fgColor:{ argb:"FFFDF6DC" } },
            });
            ws.getRow(2).height = 16;

            ws.mergeCells("A3:K3");
            Object.assign(ws.getCell("A3"), {
                value: "Telp: (0265) 1234567  |  Email: admin@alhasanah.id  |  alhasanah.id",
                font:      { name:"Arial", size:8.5, color:{ argb:"FF9E9080" } },
                alignment: { vertical:"middle", horizontal:"center" },
                fill:      { type:"pattern", pattern:"solid", fgColor:{ argb:"FFFDF6DC" } },
            });
            ws.getRow(3).height = 14;

            // Gold separator
            ws.mergeCells("A4:K4");
            ws.getCell("A4").fill = { type:"pattern", pattern:"solid", fgColor:{ argb:"FFC9A84C" } };
            ws.getRow(4).height  = 4;

            ws.addRow([]);
            ws.mergeCells("A6:K6");
            const filterDesc = [
                filters.kondisi ? `Kondisi: ${filters.kondisi.replace("_"," ")}` : "",
                filters.sumber  ? `Sumber: ${filters.sumber}` : "",
                filters.nama    ? `Nama: "${filters.nama}"` : "",
            ].filter(Boolean).join(" | ");

            Object.assign(ws.getCell("A6"), {
                value: `LAPORAN INVENTARIS & ASET  —  ${filterDesc || "SEMUA DATA"}  —  Per ${dayjs().format("DD MMMM YYYY").toUpperCase()}`,
                font: { name:"Arial", size:11, bold:true, color:{ argb:"FF111827" } },
                alignment: { vertical:"middle", horizontal:"left" },
            });
            ws.getRow(6).height = 22;

            // Summary row
            ws.mergeCells("A7:K7");
            Object.assign(ws.getCell("A7"), {
                value: `Total Item: ${allData.length}  |  Total Unit: ${kpiData.unitTotal}  |  Nilai Aset: ${fmtFull(kpiData.nilaiTotal)}  |  Kondisi Baik: ${kpiData.baikCount}  |  Perlu Perbaikan: ${kpiData.rusakCount}`,
                font:  { name:"Arial", size:9, color:{ argb:"FF9E9080" } },
                alignment: { vertical:"middle", horizontal:"left" },
            });
            ws.getRow(7).height = 14;
            ws.addRow([]);

            // Header
            const hdr = ws.addRow([
                "NO", "KODE BARANG", "NAMA BARANG / ASET", "KATEGORI", "LOKASI",
                "KONDISI", "SUMBER DANA", "TGL PEROLEHAN (M)", "TGL PEROLEHAN (H)",
                "HARGA PEROLEHAN (Rp)", "JML",
            ]);
            hdr.height = 28;
            hdr.eachCell(cell => {
                cell.fill      = { type:"pattern", pattern:"solid", fgColor:{ argb:"FFC9A84C" } };
                cell.font      = { name:"Arial", color:{ argb:"FF000000" }, bold:true, size:9.5 };
                cell.alignment = { vertical:"middle", horizontal:"center", wrapText:false };
                cell.border    = {
                    top:    { style:"medium", color:{ argb:"FF8B6914" } },
                    left:   { style:"thin",   color:{ argb:"FF8B6914" } },
                    bottom: { style:"medium", color:{ argb:"FF8B6914" } },
                    right:  { style:"thin",   color:{ argb:"FF8B6914" } },
                };
            });

            const kondisiArgb: Record<string, string> = {
                BAIK:         "FF059669",
                RUSAK_RINGAN: "FFD97706",
                RUSAK_BERAT:  "FFDC2626",
                HILANG:       "FF6B7280",
            };

            allData.forEach((item, idx) => {
                const isEven = idx % 2 === 0;
                const row = ws.addRow([
                    idx + 1,
                    item.kode_barang,
                    item.nama_barang?.toUpperCase(),
                    item.kategori?.nama_kategori || "—",
                    item.lokasi?.nama_lokasi     || "—",
                    item.kondisi.replace(/_/g," "),
                    item.sumber_dana,
                    formatMasehi(item.tanggal_perolehan),
                    formatHijri(item.tanggal_perolehan),
                    Number(item.harga_perolehan),
                    Number(item.jumlah || 1),
                ]);
                row.height = 20;
                row.eachCell((cell, col) => {
                    cell.font      = { name:"Arial", size:9.5 };
                    cell.alignment = { vertical:"middle", horizontal:"left" };
                    cell.border    = {
                        top:    { style:"hair", color:{ argb:"FFE5DDD0" } },
                        left:   { style:"hair", color:{ argb:"FFE5DDD0" } },
                        bottom: { style:"hair", color:{ argb:"FFE5DDD0" } },
                        right:  { style:"hair", color:{ argb:"FFE5DDD0" } },
                    };
                    if (!isEven)
                        cell.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:"FFFFF9F0" } };
                    if ([1,11].includes(col))
                        cell.alignment = { ...cell.alignment, horizontal:"center" };
                    if (col === 10) {
                        cell.numFmt    = "#,##0";
                        cell.alignment = { ...cell.alignment, horizontal:"right" };
                    }
                    if (col === 6) {
                        const argb = kondisiArgb[item.kondisi];
                        if (argb) cell.font = { ...cell.font, bold:true, color:{ argb } };
                    }
                });
            });

            // Grand total footer
            ws.addRow([]);
            const tot = ws.addRow([
                "","","","","","","","",
                "TOTAL NILAI ASET :",
                kpiData.nilaiTotal,
                kpiData.unitTotal,
            ]);
            tot.font = { name:"Arial", size:10, bold:true };
            tot.getCell(9).alignment  = { horizontal:"right" };
            tot.getCell(10).numFmt    = "#,##0";
            tot.getCell(10).font      = { name:"Arial", size:11, bold:true, color:{ argb:"FFC9A84C" } };
            tot.getCell(11).alignment = { horizontal:"center" };
            tot.getCell(11).font      = { name:"Arial", size:10, bold:true, color:{ argb:"FFC9A84C" } };

            ws.addRow([]);
            const printRow = ws.addRow(["","","","","","","","",
                "Dicetak:", dayjs().format("DD MMMM YYYY, HH:mm") + " WIB", "" ]);
            printRow.font = { name:"Arial", size:8.5, italic:true, color:{ argb:"FF9E9080" } };

            ws.autoFilter = "A9:K9";
            ws.views      = [{ state:"frozen", ySplit:9 }];
            ws.pageSetup.printArea = `A1:K${9 + allData.length + 4}`;

            // ── Sheet 2: Ringkasan Kondisi ─────────────────────
            const ws2 = wb.addWorksheet("Ringkasan Kondisi", {
                properties: { tabColor: { argb: "FF059669" } },
            });
            ws2.getColumn(1).width = 25;
            ws2.getColumn(2).width = 15;
            ws2.getColumn(3).width = 22;
            ws2.getColumn(4).width = 16;

            ws2.mergeCells("A1:D1");
            Object.assign(ws2.getCell("A1"), {
                value: "RINGKASAN KONDISI ASET", font:{ bold:true, size:14, color:{ argb:"FF5C430A" } },
                alignment:{ horizontal:"center" },
                fill:{ type:"pattern", pattern:"solid", fgColor:{ argb:"FFFDF6DC" } },
            });
            ws2.getRow(1).height = 28;

            ws2.addRow([]);
            const hdr2 = ws2.addRow(["KONDISI","JUMLAH ITEM","NILAI ASET","% DARI TOTAL"]);
            hdr2.eachCell(cell => {
                cell.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:"FFC9A84C" } };
                cell.font = { bold:true, color:{ argb:"FF000000" }, name:"Arial" };
                cell.alignment = { horizontal:"center", vertical:"middle" };
            });
            hdr2.height = 22;

            const kondisiRows = [
                { k:"BAIK",         clr:"FF059669" },
                { k:"RUSAK_RINGAN", clr:"FFD97706" },
                { k:"RUSAK_BERAT",  clr:"FFDC2626" },
                { k:"HILANG",       clr:"FF6B7280" },
            ];
            kondisiRows.forEach(({ k, clr }) => {
                const items = allData.filter(i => i.kondisi === k);
                const nilai = items.reduce((a,c) => a + Number(c.harga_perolehan||0), 0);
                const pct   = allData.length > 0 ? ((items.length / allData.length) * 100).toFixed(1) : "0.0";
                const row   = ws2.addRow([k.replace(/_/g," "), items.length, nilai, `${pct}%`]);
                row.getCell(1).font = { bold:true, color:{ argb: clr } };
                row.getCell(3).numFmt = "#,##0";
                row.height = 18;
            });

            const buf    = await wb.xlsx.writeBuffer();
            const sfx    = activeCount > 0 ? `_${[filters.kondisi,filters.sumber].filter(Boolean).join("_")}` : "";
            saveAs(new Blob([buf]), `Inventaris_AlHasanah${sfx}_${dayjs().format("YYYYMMDD")}.xlsx`);
            message.success({ content: `✅ Laporan Excel berhasil diunduh!`, key, duration: 3 });
        } catch (err: any) {
            message.error({ content: `Gagal export: ${err.message}`, key });
        } finally {
            setXlsx(false);
        }
    };

    // ═══════════════════════════════════════════════════════════
    // EXPORT PDF — CORPORATE CATALOG
    // ═══════════════════════════════════════════════════════════
    const exportPdf = async () => {
        setPdf(true);
        const key = "pdf_export";
        message.loading({ content: "Menyiapkan katalog PDF...", key, duration: 0 });
        try {
            const doc = new jsPDF({ orientation:"l", unit:"mm", format:"a4" }) as any;
            const W   = 297; // A4 landscape width
            const M   = 14;  // margin

            // ── KOP SURAT ─────────────────────────────────────
            // Gold header band
            doc.setFillColor(92, 67, 10);
            doc.rect(0, 0, W, 28, "F");

            // Gold accent line
            doc.setFillColor(201, 168, 76);
            doc.rect(0, 28, W, 2, "F");

            // Logo placeholder circle
            doc.setFillColor(201, 168, 76);
            doc.circle(M + 10, 14, 10, "F");
            doc.setFillColor(92, 67, 10);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(255, 183, 0);
            doc.text("AH", M + 7.5, 17);

            // Institution text
            doc.setFont("helvetica", "bold");
            doc.setFontSize(16);
            doc.setTextColor(255, 255, 255);
            doc.text("PONDOK PESANTREN AL-HASANAH", W / 2, 11, { align:"center" });

            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(253, 230, 138);
            doc.text("Jl. Raya Cibeuti Km.3, Kawalu, Kota Tasikmalaya, Jawa Barat 46182  |  admin@alhasanah.id", W / 2, 18, { align:"center" });

            doc.setFontSize(8);
            doc.setTextColor(201, 168, 76);
            doc.text("LAPORAN INVENTARIS & ASET RESMI LEMBAGA", W / 2, 24, { align:"center" });

            // Doc number top right
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7);
            doc.setTextColor(201, 168, 76);
            doc.text(`INV-${dayjs().format("YYYYMMDD")}`, W - M, 8, { align:"right" });

            // ── DOCUMENT TITLE BANNER ─────────────────────────
            doc.setFillColor(201, 168, 76);
            doc.roundedRect(M, 34, W - M * 2, 10, 2, 2, "F");
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
            doc.text("KATALOG INVENTARIS & ASET PESANTREN", W / 2, 40.5, { align:"center" });

            // Filter info
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(92, 67, 10);
            const filterStr = activeCount > 0
                ? `Filter: ${[filters.kondisi, filters.sumber, filters.nama ? `"${filters.nama}"` : ""].filter(Boolean).join(" | ")}`
                : "Menampilkan semua data inventaris";
            doc.text(`${filterStr}  |  Dicetak: ${dayjs().format("DD MMMM YYYY, HH:mm")} WIB`, M, 48);
            doc.text(`Total Item: ${allData.length}  |  Nilai Aset: ${fmtFull(kpiData.nilaiTotal)}`, W - M, 48, { align:"right" });

            // ── TABLE ─────────────────────────────────────────
            doc.autoTable({
                startY:  52,
                margin:  { left: M, right: M },
                head: [["NO","KODE","NAMA BARANG","KATEGORI","LOKASI","KONDISI","SUMBER","TGL PEROLEHAN","NILAI ASET","JML"]],
                body: allData.map((item, i) => [
                    i + 1,
                    item.kode_barang,
                    item.nama_barang?.toUpperCase(),
                    item.kategori?.nama_kategori || "—",
                    item.lokasi?.nama_lokasi || "—",
                    item.kondisi.replace(/_/g," "),
                    item.sumber_dana,
                    formatMasehi(item.tanggal_perolehan),
                    fmtRupiah(Number(item.harga_perolehan)),
                    Number(item.jumlah || 1),
                ]),
                theme: "grid",
                headStyles: {
                    fillColor:   [92, 67, 10],
                    textColor:   255,
                    fontStyle:   "bold",
                    fontSize:    8,
                    cellPadding: 3,
                },
                bodyStyles: { fontSize: 7.5, cellPadding: 2.5 },
                alternateRowStyles: { fillColor: [253, 249, 240] },
                columnStyles: {
                    0:  { halign:"center", cellWidth: 8  },
                    1:  { cellWidth: 22 },
                    2:  { cellWidth: 50 },
                    3:  { cellWidth: 26 },
                    4:  { cellWidth: 26 },
                    5:  { cellWidth: 22,  halign:"center" },
                    6:  { cellWidth: 18 },
                    7:  { cellWidth: 24 },
                    8:  { cellWidth: 28,  halign:"right" },
                    9:  { cellWidth: 10,  halign:"center" },
                },
                willDrawCell: (data: any) => {
                    if (data.section === "body" && data.column.index === 5) {
                        const kondisi = data.cell.text?.[0] || "";
                        if (kondisi.includes("RUSAK BERAT"))       data.cell.styles.textColor = [220, 38, 38];
                        else if (kondisi.includes("RUSAK RINGAN")) data.cell.styles.textColor = [217, 119, 6];
                        else if (kondisi === "BAIK")               data.cell.styles.textColor = [5, 150, 105];
                        else                                        data.cell.styles.textColor = [107, 114, 128];
                        data.cell.styles.fontStyle = "bold";
                    }
                },
                // Footer row
                didParseCell: (data: any) => {
                    if (data.section === "foot") {
                        data.cell.styles.fillColor = [253, 246, 220];
                        data.cell.styles.fontStyle = "bold";
                        data.cell.styles.textColor = [92, 67, 10];
                    }
                },
                foot: [["","","","","","","","TOTAL NILAI ASET",
                    fmtFull(kpiData.nilaiTotal), kpiData.unitTotal]],
                showFoot: "lastPage",
            });

            // ── FOOTER on each page ───────────────────────────
            const pageCount = doc.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                const h = doc.internal.pageSize.height;
                doc.setFillColor(201, 168, 76);
                doc.rect(0, h - 7, W, 7, "F");
                doc.setFont("helvetica", "bold");
                doc.setFontSize(6.5);
                doc.setTextColor(0, 0, 0);
                doc.text("AL-HASANAH DIGITAL ECOSYSTEM  ·  OFFICIAL VERIFIED DOCUMENT",
                    M, h - 3);
                doc.text(`Halaman ${i} dari ${pageCount}  ·  ${dayjs().format("DD/MM/YYYY HH:mm")}`,
                    W - M, h - 3, { align:"right" });
            }

            doc.save(`Katalog_Aset_AlHasanah_${dayjs().format("YYYYMMDD")}.pdf`);
            message.success({ content:"✅ Katalog PDF berhasil diunduh!", key, duration:3 });
        } catch (err: any) {
            message.error({ content: `Gagal export PDF: ${err.message}`, key });
        } finally {
            setPdf(false);
        }
    };

    // ── Shared card style ────────────────────────────────────
    const cs = (extra?: React.CSSProperties): React.CSSProperties => ({
        borderRadius: 20,
        border: `1px solid ${isDark ? G(0.10) : G(0.14)}`,
        background: token.colorBgContainer,
        boxShadow: isDark ? "0 4px 24px rgba(0,0,0,0.42)" : "0 2px 16px rgba(0,0,0,0.05)",
        ...extra,
    });

    // ═══════════════════════════════════════════════════════════
    // TABLE COLUMNS
    // ═══════════════════════════════════════════════════════════
    const columns: ProColumns<IInventaris>[] = [
        {
            title: "#",
            valueType: "indexBorder",
            width: 52,
            fixed: "left",
            align: "center",
        },
        {
            title: "Aset & Identitas",
            dataIndex: "nama_barang",
            width: 280,
            fixed: "left",
            search: false,
            render: (_, record) => (
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    {/* Asset thumbnail */}
                    <div style={{
                        width: 50, height: 50, borderRadius: 13, flexShrink: 0,
                        overflow: "hidden",
                        border: `1.5px solid ${G(isDark ? 0.22 : 0.16)}`,
                        background: isDark ? G(0.08) : G(0.06),
                        display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                        {record.foto_url ? (
                            <img src={record.foto_url}
                                style={{ width:"100%", height:"100%",
                                    objectFit:"cover", display:"block" }}
                                alt={record.nama_barang} />
                        ) : (
                            <AppstoreOutlined style={{ fontSize:22,
                                color: isDark ? G(0.60) : GOLD_DEEP }} />
                        )}
                    </div>

                    <div style={{ flex:1, minWidth:0 }}>
                        <div style={{
                            fontSize: 13.5, fontWeight: 700, lineHeight: 1.25,
                            color: token.colorText,
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            maxWidth: 175,
                        }}>
                            {record.nama_barang}
                        </div>
                        <div style={{ display:"flex", gap:5, marginTop:5, flexWrap:"nowrap" }}>
                            <span style={{
                                fontFamily:"'DM Mono', monospace", fontSize:9.5, fontWeight:700,
                                background: G(isDark ? 0.14 : 0.08),
                                color: isDark ? GOLD_BRIGHT : GOLD_DEEP,
                                padding: "1px 7px", borderRadius:5,
                                border: `1px solid ${G(isDark ? 0.25 : 0.16)}`,
                                whiteSpace:"nowrap",
                            }}>
                                {record.kode_barang}
                            </span>
                            {record.kategori?.nama_kategori && (
                                <span style={{
                                    fontSize:9.5, fontWeight:600, padding:"1px 7px",
                                    borderRadius:5, background: isDark ? "rgba(37,99,235,0.12)" : "#EFF6FF",
                                    border: "1px solid rgba(37,99,235,0.18)",
                                    color: INFO, whiteSpace:"nowrap",
                                }}>
                                    {record.kategori.nama_kategori}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            ),
        },
        {
            title: "Lokasi",
            key: "lokasi",
            width: 165,
            search: false,
            render: (_, r) => (
                <div style={{ display:"flex", alignItems:"flex-start", gap:7 }}>
                    <EnvironmentOutlined style={{
                        color: isDark ? G(0.65) : GOLD_DEEP,
                        fontSize: 13, marginTop: 2, flexShrink:0,
                    }} />
                    <div>
                        <div style={{ fontSize:13, fontWeight:600, color:token.colorText,
                            lineHeight:1.3 }}>
                            {r.lokasi?.nama_lokasi || "—"}
                        </div>
                        <div style={{ fontSize:10, color:token.colorTextTertiary, marginTop:3 }}>
                            <CalendarOutlined style={{ marginRight:4 }} />
                            {r.tanggal_perolehan
                                ? dayjs(r.tanggal_perolehan).format("MMM YYYY")
                                : "—"}
                        </div>
                    </div>
                </div>
            ),
        },
        {
            title: "Kondisi",
            dataIndex: "kondisi",
            width: 140,
            align: "center",
            search: false,
            render: (_, r) => {
                const cfg = KONDISI_CFG[r.kondisi as KondisiKey];
                if (!cfg) return <span>{r.kondisi}</span>;
                return (
                    <div style={{
                        display:"inline-flex", alignItems:"center", gap:5,
                        padding:"4px 12px", borderRadius:99,
                        background: cfg.bg(isDark),
                        border: `1px solid ${cfg.border(isDark)}`,
                    }}>
                        <span style={{ fontSize:10, color:cfg.color }}>{cfg.icon}</span>
                        <span style={{
                            fontSize:10, fontWeight:800, letterSpacing:"0.06em",
                            color: cfg.color, fontFamily:"'Syne', sans-serif",
                        }}>
                            {cfg.short}
                        </span>
                    </div>
                );
            },
        },
        {
            title: "Nilai Aset",
            dataIndex: "harga_perolehan",
            width: 175,
            align: "right",
            search: false,
            sorter: true,
            render: (_, r) => {
                const sClr = SUMBER_COLOR[r.sumber_dana] || token.colorTextSecondary;
                return (
                    <div style={{ display:"flex", flexDirection:"column",
                        alignItems:"flex-end", gap:4 }}>
                        <span style={{
                            fontFamily:"'Syne', sans-serif", fontWeight:800,
                            fontSize:14, letterSpacing:"-0.02em",
                            color: isDark ? "#F0EDE5" : "#0A0805",
                        }}>
                            {fmtRupiah(Number(r.harga_perolehan))}
                        </span>
                        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                            <span style={{
                                fontSize:9, fontWeight:700, padding:"1px 7px",
                                borderRadius:5,
                                background: `${sClr}18`,
                                border: `1px solid ${sClr}28`,
                                color: sClr,
                            }}>
                                {r.sumber_dana}
                            </span>
                            {r.jumlah && Number(r.jumlah) > 1 && (
                                <span style={{
                                    fontSize:9, fontWeight:700, padding:"1px 7px",
                                    borderRadius:5,
                                    background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
                                    color: token.colorTextSecondary,
                                }}>
                                    ×{r.jumlah}
                                </span>
                            )}
                        </div>
                    </div>
                );
            },
        },
        {
            title: "Aksi",
            valueType: "option",
            width: 108,
            fixed: "right",
            render: (_, record) => (
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                    <Tooltip title="Label & QR Aset">
                        <button onClick={() => show("inventaris", record.id)}
                            style={{
                                width:30, height:30, borderRadius:8, border:"none",
                                cursor:"pointer", display:"flex", alignItems:"center",
                                justifyContent:"center", fontSize:13,
                                background: G(isDark ? 0.14 : 0.08),
                                color: isDark ? GOLD_BRIGHT : GOLD_DEEP,
                                transition:"all 0.2s",
                            }}>
                            <QrcodeOutlined />
                        </button>
                    </Tooltip>
                    <Tooltip title="Edit Data Aset">
                        <button onClick={() => edit("inventaris", record.id)}
                            style={{
                                width:30, height:30, borderRadius:8, border:"none",
                                cursor:"pointer", display:"flex", alignItems:"center",
                                justifyContent:"center", fontSize:13,
                                background: isDark ? "rgba(37,99,235,0.12)" : "rgba(37,99,235,0.07)",
                                color: INFO, transition:"all 0.2s",
                            }}>
                            <EditOutlined />
                        </button>
                    </Tooltip>
                    <Popconfirm
                        title={
                            <div>
                                <div style={{ fontWeight:700, marginBottom:3 }}>Hapus aset ini?</div>
                                <div style={{ fontSize:11, color:token.colorTextSecondary }}>
                                    {record.nama_barang}
                                </div>
                            </div>
                        }
                        onConfirm={() => deleteMutate({ resource:"inventaris", id:record.id })}
                        okText="Hapus"
                        cancelText="Batal"
                        okButtonProps={{ danger:true, style:{ fontWeight:700 } }}
                    >
                        <Tooltip title="Hapus">
                            <button style={{
                                width:30, height:30, borderRadius:8, border:"none",
                                cursor:"pointer", display:"flex", alignItems:"center",
                                justifyContent:"center", fontSize:13,
                                background: `${DANGER}12`,
                                color: DANGER, transition:"all 0.2s",
                            }}>
                                <DeleteOutlined />
                            </button>
                        </Tooltip>
                    </Popconfirm>
                </div>
            ),
        },
    ];

    // ════════════════════════════════════════════════════════
    return (
        <motion.div
            initial="hidden" animate="visible" variants={stagger}
            style={{ display:"flex", flexDirection:"column", gap:22, paddingBottom:60 }}
        >

            {/* ══════════════════════════════════════════════
                PAGE HEADER
            ══════════════════════════════════════════════ */}
            <motion.div variants={fadeUp} style={{
                display:"flex", flexWrap:"wrap", justifyContent:"space-between",
                alignItems:"flex-end", gap:16, paddingBottom:24,
                borderBottom:`1px solid ${isDark ? G(0.10) : G(0.14)}`,
            }}>
                <div>
                    <div style={{
                        display:"flex", alignItems:"center", gap:8, marginBottom:6,
                        fontSize:10, fontWeight:800, letterSpacing:"0.14em",
                        textTransform:"uppercase", color:GOLD, fontFamily:"'Syne', sans-serif",
                    }}>
                        <span style={{ width:6, height:6, borderRadius:"50%", background:GOLD_BRIGHT,
                            display:"inline-block", animation:"dotPulse 2s ease-in-out infinite" }} />
                        Manajemen Aset Pesantren
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                        <div style={{
                            width:52, height:52, borderRadius:16, flexShrink:0,
                            background:`linear-gradient(135deg, ${G(0.22)}, ${G(0.38)})`,
                            border:`1px solid ${G(0.30)}`,
                            display:"flex", alignItems:"center", justifyContent:"center",
                            color:GOLD_BRIGHT, fontSize:22, boxShadow:`0 6px 20px ${G(0.25)}`,
                        }}>
                            <BarcodeOutlined />
                        </div>
                        <div>
                            <h1 style={{
                                margin:0, fontFamily:"'Syne', sans-serif", fontWeight:800,
                                fontSize:"clamp(20px,3vw,26px)", letterSpacing:"-0.03em",
                                color:token.colorText, lineHeight:1.2,
                            }}>
                                Inventaris{" "}
                                <span style={{
                                    background:`linear-gradient(90deg, ${GOLD_DEEP}, ${GOLD_BRIGHT}, ${GOLD})`,
                                    backgroundSize:"200% auto", WebkitBackgroundClip:"text",
                                    WebkitTextFillColor:"transparent", backgroundClip:"text",
                                    animation:"goldShimmer 5s linear infinite",
                                }}>Aset</span>
                            </h1>
                            <span style={{ fontSize:12.5, color:token.colorTextSecondary }}>
                                Lacak, kelola &amp; audit seluruh aset pesantren
                            </span>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                    <button onClick={exportPdf} disabled={isExportingPdf}
                        style={{
                            display:"flex", alignItems:"center", gap:7,
                            padding:"0 15px", height:38, borderRadius:10,
                            border:`1px solid ${DANGER}28`,
                            background: isDark ? `${DANGER}08` : `${DANGER}06`,
                            color:DANGER, cursor:"pointer", fontSize:12.5, fontWeight:700,
                            transition:"all 0.2s", fontFamily:"'DM Sans', sans-serif",
                        }}>
                        {isExportingPdf ? <SyncOutlined spin /> : <FilePdfOutlined />}
                        Katalog PDF
                    </button>
                    <button onClick={exportExcel} disabled={isExportingXlsx}
                        style={{
                            display:"flex", alignItems:"center", gap:7,
                            padding:"0 15px", height:38, borderRadius:10,
                            border:`1px solid ${SUCCESS}28`,
                            background: isDark ? `${SUCCESS}08` : `${SUCCESS}06`,
                            color:SUCCESS, cursor:"pointer", fontSize:12.5, fontWeight:700,
                            transition:"all 0.2s", fontFamily:"'DM Sans', sans-serif",
                        }}>
                        {isExportingXlsx ? <SyncOutlined spin /> : <FileExcelOutlined />}
                        Laporan Excel
                    </button>
                    <button onClick={() => create("inventaris")}
                        style={{
                            display:"flex", alignItems:"center", gap:7,
                            padding:"0 20px", height:38, borderRadius:10, border:"none",
                            background:`linear-gradient(135deg, ${GOLD}, ${GOLD_BRIGHT})`,
                            color:"#000", cursor:"pointer", fontSize:12.5, fontWeight:800,
                            boxShadow:`0 4px 16px ${G(0.40)}`, transition:"all 0.2s",
                            fontFamily:"'DM Sans', sans-serif",
                        }}>
                        <PlusOutlined />
                        Tambah Aset
                    </button>
                </div>
            </motion.div>

            {/* ══════════════════════════════════════════════
                SMART KPI CARDS — 5 cards
            ══════════════════════════════════════════════ */}
            <Row gutter={[18, 18]}>
                {[
                    {
                        title: "Total Nilai Aset",
                        value: fmtRupiah(kpiData.nilaiTotal),
                        icon:  <DollarOutlined />,
                        color: GOLD_BRIGHT,
                        sub:   `${allData.length} item terdaftar`,
                        idx:   0,
                    },
                    {
                        title: "Total Unit Barang",
                        value: kpiData.unitTotal,
                        icon:  <ShopOutlined />,
                        color: INFO,
                        sub:   `Dari ${allData.length} jenis aset`,
                        progress: Math.min((kpiData.unitTotal / (kpiData.unitTotal + 50)) * 100, 100),
                        idx:   1,
                    },
                    {
                        title: "Kondisi Baik",
                        value: kpiData.baikCount,
                        icon:  <CheckCircleOutlined />,
                        color: SUCCESS,
                        sub:   `${kpiData.baikPct.toFixed(0)}% dari total aset`,
                        progress: kpiData.baikPct,
                        active: filters.kondisi === "BAIK",
                        onClick: () => quickKondisiFilter(filters.kondisi === "BAIK" ? undefined : "BAIK"),
                        idx:   2,
                    },
                    {
                        title: "Perlu Perbaikan",
                        value: kpiData.rusakCount,
                        icon:  <WarningOutlined />,
                        color: WARNING,
                        sub:   `Nilai: ${fmtRupiah(kpiData.nilaiRusak)}`,
                        progress: kpiData.rusakPct,
                        active: filters.kondisi === "RUSAK_RINGAN" || filters.kondisi === "RUSAK_BERAT",
                        onClick: () => quickKondisiFilter(
                            (filters.kondisi === "RUSAK_RINGAN" || filters.kondisi === "RUSAK_BERAT")
                                ? undefined : "RUSAK_RINGAN"
                        ),
                        idx:   3,
                    },
                    {
                        title: "Aset Tahun Ini",
                        value: kpiData.tahunIni,
                        icon:  <RocketOutlined />,
                        color: PURPLE,
                        sub:   `Pengadaan ${dayjs().year()}`,
                        badge: (
                            <span style={{
                                padding:"2px 10px", borderRadius:99,
                                background:`${PURPLE}14`, border:`1px solid ${PURPLE}25`,
                                fontSize:9.5, fontWeight:700, color:PURPLE,
                            }}>
                                ◆ TERBARU
                            </span>
                        ),
                        idx: 4,
                    },
                ].map(k => (
                    <Col key={k.title} xs={24} sm={12} xl={k.idx < 2 ? 7 : k.idx === 4 ? 3 : 5}
                        style={{ flex: k.idx < 2 ? undefined : undefined }}>
                        <KPICard {...k} index={k.idx} isDark={isDark} />
                    </Col>
                ))}
            </Row>

            {/* ══════════════════════════════════════════════
                KONDISI BREAKDOWN BAR
            ══════════════════════════════════════════════ */}
            <motion.div variants={fadeUp} custom={5}>
                <div style={{ ...cs(), padding:"18px 24px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                        <SafetyCertificateOutlined style={{ color:GOLD_BRIGHT, fontSize:15 }} />
                        <span style={{ fontFamily:"'Syne', sans-serif", fontWeight:800,
                            fontSize:13, color:token.colorText }}>
                            Distribusi Kondisi Aset
                        </span>
                        <div style={{ flex:1, height:1, marginLeft:4,
                            background:`linear-gradient(90deg, ${G(0.25)}, transparent)` }} />
                        <span style={{ fontSize:11, color:token.colorTextTertiary }}>
                            {allData.length} item total
                        </span>
                    </div>

                    {/* Stacked progress bar */}
                    <div style={{ height:10, borderRadius:99, overflow:"hidden",
                        display:"flex", marginBottom:12,
                        background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" }}>
                        {Object.entries(kpiData.byKondisi).map(([k, count]) => {
                            const cfg = KONDISI_CFG[k as KondisiKey];
                            const pct = allData.length > 0 ? (count / allData.length) * 100 : 0;
                            return pct > 0 ? (
                                <motion.div key={k}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${pct}%` }}
                                    transition={{ duration: 0.9, ease:[0.22,1,0.36,1], delay: 0.5 }}
                                    style={{ height:"100%", background: cfg.color }}
                                />
                            ) : null;
                        })}
                    </div>

                    {/* Legend */}
                    <div style={{ display:"flex", flexWrap:"wrap", gap:16 }}>
                        {Object.entries(kpiData.byKondisi).map(([k, count]) => {
                            const cfg = KONDISI_CFG[k as KondisiKey];
                            const pct = allData.length > 0 ? ((count / allData.length) * 100).toFixed(0) : "0";
                            return (
                                <div key={k} style={{ display:"flex", alignItems:"center", gap:6 }}>
                                    <div style={{ width:10, height:10, borderRadius:3,
                                        background:cfg.color, flexShrink:0 }} />
                                    <span style={{ fontSize:11, fontWeight:600,
                                        color:token.colorTextSecondary }}>
                                        {cfg.label}
                                    </span>
                                    <span style={{ fontFamily:"'DM Mono', monospace",
                                        fontSize:11, fontWeight:800, color:cfg.color }}>
                                        {count} ({pct}%)
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </motion.div>

            {/* ══════════════════════════════════════════════
                FILTER BAR
            ══════════════════════════════════════════════ */}
            <motion.div variants={fadeUp} custom={6}>
                <div style={{ ...cs(), padding:"18px 24px" }}>
                    <div style={{ display:"flex", alignItems:"center",
                        justifyContent:"space-between", marginBottom:14 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <FilterOutlined style={{ color:GOLD_BRIGHT, fontSize:13 }} />
                            <span style={{ fontFamily:"'Syne', sans-serif", fontWeight:800,
                                fontSize:13, color:token.colorText }}>
                                Filter Aset
                            </span>
                            {activeCount > 0 && (
                                <span style={{
                                    padding:"1px 8px", borderRadius:99,
                                    background:`linear-gradient(135deg, ${GOLD}, ${GOLD_BRIGHT})`,
                                    fontSize:10, fontWeight:800, color:"#000",
                                }}>
                                    {activeCount} aktif
                                </span>
                            )}
                        </div>
                        {activeCount > 0 && (
                            <button onClick={resetFilters}
                                style={{
                                    display:"flex", alignItems:"center", gap:5,
                                    padding:"0 12px", height:28, borderRadius:8,
                                    border:`1px solid ${DANGER}28`, background:`${DANGER}08`,
                                    color:DANGER, cursor:"pointer", fontSize:11, fontWeight:700,
                                    transition:"all 0.2s", fontFamily:"'DM Sans', sans-serif",
                                }}>
                                <CloseCircleFilled style={{ fontSize:10 }} />
                                Reset
                            </button>
                        )}
                    </div>

                    <div style={{ display:"grid",
                        gridTemplateColumns:"repeat(auto-fit, minmax(190px, 1fr))",
                        gap:12, marginBottom:14 }}>

                        {/* Nama */}
                        <div>
                            <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:"0.08em",
                                textTransform:"uppercase", color:token.colorTextTertiary,
                                marginBottom:5, fontFamily:"'Syne', sans-serif" }}>
                                Cari Nama Aset
                            </div>
                            <Input
                                prefix={<SearchOutlined style={{ color:G(0.5), fontSize:12 }} />}
                                placeholder="Nama atau kata kunci..."
                                value={pendingFilters.nama}
                                onChange={e => setPending(p => ({ ...p, nama:e.target.value }))}
                                onPressEnter={applyFilters}
                                allowClear
                                onClear={() => {
                                    setPending(p => ({ ...p, nama:"" }));
                                    const next = { ...filters, nama:"" };
                                    setFilters(next);
                                    setTableFilters(buildCrud(next), "replace");
                                }}
                                style={{ borderRadius:10, height:38 }}
                            />
                        </div>

                        {/* Kondisi */}
                        <div>
                            <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:"0.08em",
                                textTransform:"uppercase", color:token.colorTextTertiary,
                                marginBottom:5, fontFamily:"'Syne', sans-serif" }}>
                                Kondisi
                            </div>
                            <Select
                                style={{ width:"100%", height:38 }}
                                placeholder="Semua Kondisi"
                                allowClear
                                value={pendingFilters.kondisi}
                                options={[
                                    { label:"✅ Baik",         value:"BAIK"         },
                                    { label:"⚠️ Rusak Ringan", value:"RUSAK_RINGAN" },
                                    { label:"🔴 Rusak Berat",  value:"RUSAK_BERAT"  },
                                    { label:"❓ Hilang",        value:"HILANG"       },
                                ]}
                                onChange={v => setPending(p => ({ ...p, kondisi:v }))}
                                onClear={() => {
                                    setPending(p => ({ ...p, kondisi:undefined }));
                                    const next = { ...filters, kondisi:undefined };
                                    setFilters(next); setTableFilters(buildCrud(next), "replace");
                                }}
                            />
                        </div>

                        {/* Sumber Dana */}
                        <div>
                            <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:"0.08em",
                                textTransform:"uppercase", color:token.colorTextTertiary,
                                marginBottom:5, fontFamily:"'Syne', sans-serif" }}>
                                Sumber Dana
                            </div>
                            <Select
                                style={{ width:"100%", height:38 }}
                                placeholder="Semua Sumber"
                                allowClear
                                value={pendingFilters.sumber}
                                options={["WAKAF","INFAQ","HIBAH","BELI","DONASI"].map(s => ({
                                    label:s, value:s,
                                }))}
                                onChange={v => setPending(p => ({ ...p, sumber:v }))}
                                onClear={() => {
                                    setPending(p => ({ ...p, sumber:undefined }));
                                    const next = { ...filters, sumber:undefined };
                                    setFilters(next); setTableFilters(buildCrud(next), "replace");
                                }}
                            />
                        </div>
                    </div>

                    {/* Active pills + Apply */}
                    <div style={{ display:"flex", alignItems:"center",
                        justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
                        <div style={{ display:"flex", flexWrap:"wrap", gap:7, flex:1 }}>
                            {filters.kondisi && (() => {
                                const cfg = KONDISI_CFG[filters.kondisi as KondisiKey];
                                return (
                                    <div style={{
                                        display:"flex", alignItems:"center", gap:5,
                                        padding:"3px 10px", borderRadius:99,
                                        background: cfg.bg(isDark), border:`1px solid ${cfg.border(isDark)}`,
                                        fontSize:11, fontWeight:700, color:cfg.color,
                                    }}>
                                        {cfg.icon} {cfg.label}
                                        <CloseCircleFilled
                                            style={{ fontSize:10, cursor:"pointer", opacity:0.7 }}
                                            onClick={() => {
                                                setPending(p => ({ ...p, kondisi:undefined }));
                                                const next = { ...filters, kondisi:undefined };
                                                setFilters(next); setTableFilters(buildCrud(next), "replace");
                                            }}
                                        />
                                    </div>
                                );
                            })()}
                            {filters.sumber && (
                                <div style={{
                                    display:"flex", alignItems:"center", gap:5,
                                    padding:"3px 10px", borderRadius:99,
                                    background: `${SUMBER_COLOR[filters.sumber] || INFO}14`,
                                    border:`1px solid ${SUMBER_COLOR[filters.sumber] || INFO}28`,
                                    fontSize:11, fontWeight:700,
                                    color: SUMBER_COLOR[filters.sumber] || INFO,
                                }}>
                                    <DollarOutlined style={{ fontSize:10 }} />
                                    {filters.sumber}
                                </div>
                            )}
                            {filters.nama && (
                                <div style={{
                                    display:"flex", alignItems:"center", gap:5,
                                    padding:"3px 10px", borderRadius:99,
                                    background: G(isDark ? 0.12 : 0.08),
                                    border:`1px solid ${G(isDark ? 0.22 : 0.16)}`,
                                    fontSize:11, fontWeight:700,
                                    color: isDark ? GOLD_BRIGHT : GOLD_DEEP,
                                }}>
                                    <SearchOutlined style={{ fontSize:10 }} />
                                    "{filters.nama}"
                                </div>
                            )}
                            {activeCount === 0 && (
                                <span style={{ fontSize:11, color:token.colorTextTertiary,
                                    fontStyle:"italic" }}>
                                    Tidak ada filter aktif
                                </span>
                            )}
                        </div>

                        <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                            <button onClick={() => tableQueryResult.refetch()}
                                style={{
                                    width:36, height:36, borderRadius:10,
                                    border:`1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                                    background:"transparent", cursor:"pointer",
                                    color:token.colorTextSecondary, fontSize:14,
                                    display:"flex", alignItems:"center", justifyContent:"center",
                                    transition:"all 0.2s",
                                }}>
                                <ReloadOutlined spin={isFetching} />
                            </button>
                            <button onClick={applyFilters}
                                style={{
                                    display:"flex", alignItems:"center", gap:7,
                                    padding:"0 20px", height:36, borderRadius:10, border:"none",
                                    background:`linear-gradient(135deg, ${GOLD}, ${GOLD_BRIGHT})`,
                                    color:"#000", cursor:"pointer", fontSize:12.5, fontWeight:800,
                                    boxShadow:`0 4px 14px ${G(0.38)}`, transition:"all 0.2s",
                                    fontFamily:"'DM Sans', sans-serif",
                                }}>
                                <SearchOutlined />
                                Terapkan
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* ══════════════════════════════════════════════
                DATA TABLE
            ══════════════════════════════════════════════ */}
            <motion.div variants={fadeUp} custom={7}>
                <div style={{
                    borderRadius:20, overflow:"hidden",
                    border:`1px solid ${isDark ? G(0.10) : G(0.13)}`,
                    boxShadow: isDark ? "0 10px 40px rgba(0,0,0,0.45)" : `0 8px 32px ${G(0.08)}`,
                }}>
                    <ProTable<IInventaris>
                        {...tableProps}
                        columns={columns}
                        rowKey="id"
                        search={false}
                        scroll={{ x: 1060 }}
                        headerTitle={
                            <div style={{ display:"flex", alignItems:"center", gap:10, padding:"4px 0" }}>
                                <div style={{
                                    width:36, height:36, borderRadius:10,
                                    background:`linear-gradient(135deg, ${G(0.22)}, ${G(0.38)})`,
                                    border:`1px solid ${G(0.28)}`,
                                    display:"flex", alignItems:"center", justifyContent:"center",
                                    color:GOLD_BRIGHT, fontSize:15,
                                }}>
                                    <BarcodeOutlined />
                                </div>
                                <div>
                                    <div style={{ fontFamily:"'Syne', sans-serif", fontWeight:800,
                                        fontSize:15, letterSpacing:"-0.02em", color:token.colorText }}>
                                        Direktori Aset
                                    </div>
                                    <div style={{ fontSize:11, color:token.colorTextTertiary, marginTop:1 }}>
                                        {isFetching ? "Memuat..." : `${totalCount.toLocaleString("id-ID")} aset terdaftar${activeCount > 0 ? " (difilter)" : ""}`}
                                    </div>
                                </div>
                                {activeCount > 0 && (
                                    <div style={{
                                        padding:"3px 10px", borderRadius:99,
                                        background: G(0.12), border:`1px solid ${G(0.22)}`,
                                        fontSize:10, fontWeight:700, color:GOLD_BRIGHT,
                                        display:"flex", alignItems:"center", gap:5,
                                    }}>
                                        <FilterOutlined style={{ fontSize:9 }} />
                                        {activeCount} filter
                                    </div>
                                )}
                            </div>
                        }
                        toolBarRender={() => [
                            <button key="pdf" onClick={exportPdf} disabled={isExportingPdf}
                                style={{
                                    display:"flex", alignItems:"center", gap:6,
                                    padding:"0 14px", height:34, borderRadius:9,
                                    border:`1px solid ${DANGER}25`,
                                    background: isDark ? `${DANGER}08` : `${DANGER}05`,
                                    color:DANGER, cursor:"pointer", fontSize:12, fontWeight:700,
                                    transition:"all 0.2s", fontFamily:"'DM Sans', sans-serif",
                                }}>
                                {isExportingPdf ? <SyncOutlined spin /> : <FilePdfOutlined />}
                                PDF
                            </button>,
                            <button key="xlsx" onClick={exportExcel} disabled={isExportingXlsx}
                                style={{
                                    display:"flex", alignItems:"center", gap:6,
                                    padding:"0 14px", height:34, borderRadius:9,
                                    border:`1px solid ${SUCCESS}25`,
                                    background: isDark ? `${SUCCESS}08` : `${SUCCESS}05`,
                                    color:SUCCESS, cursor:"pointer", fontSize:12, fontWeight:700,
                                    transition:"all 0.2s", fontFamily:"'DM Sans', sans-serif",
                                }}>
                                {isExportingXlsx ? <SyncOutlined spin /> : <FileExcelOutlined />}
                                Excel
                            </button>,
                            <button key="add" onClick={() => create("inventaris")}
                                style={{
                                    display:"flex", alignItems:"center", gap:6,
                                    padding:"0 16px", height:34, borderRadius:9, border:"none",
                                    background:`linear-gradient(135deg, ${GOLD}, ${GOLD_BRIGHT})`,
                                    color:"#000", cursor:"pointer", fontSize:12, fontWeight:800,
                                    boxShadow:`0 3px 12px ${G(0.38)}`, transition:"all 0.2s",
                                    fontFamily:"'DM Sans', sans-serif",
                                }}>
                                <PlusOutlined />
                                Tambah
                            </button>,
                        ]}
                        options={{
                            density:    true,
                            fullScreen: true,
                            setting:    true,
                            reload:     () => tableQueryResult.refetch(),
                        }}
                        pagination={{
                            defaultPageSize: 12,
                            pageSizeOptions: [12, 24, 50, 100],
                            showSizeChanger: true,
                            showTotal: (total, range) => (
                                <span style={{ fontSize:12, color:token.colorTextSecondary }}>
                                    <strong style={{ color: isDark ? GOLD_BRIGHT : GOLD_DEEP }}>
                                        {range[0]}–{range[1]}
                                    </strong>
                                    {" "}dari{" "}
                                    <strong style={{ color:token.colorText }}>{total}</strong> aset
                                </span>
                            ),
                            style: { padding:"12px 20px" },
                        }}
                        rowClassName={(_, i) => i % 2 !== 0
                            ? isDark ? "dark-row-odd" : "light-row-odd"
                            : ""}
                        cardBordered={false}
                    />
                </div>
            </motion.div>
        </motion.div>
    );
};
