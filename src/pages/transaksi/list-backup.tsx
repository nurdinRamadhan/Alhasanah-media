import React, { useState, useMemo, useCallback } from "react";
import { useTable } from "@refinedev/antd";
import { ProTable } from "@ant-design/pro-components";
import type { ProColumns } from "@ant-design/pro-components";
import {
    Typography, Button, Tag, Space, Card, Row, Col, Statistic,
    Select, DatePicker, Tooltip, Avatar, Divider, Progress,
    theme, message, Segmented, Badge, Modal, Empty,
} from "antd";
import { motion, AnimatePresence } from "framer-motion";
import {
    RiseOutlined, FallOutlined, SwapOutlined, DollarOutlined,
    FilterOutlined, DownloadOutlined, PlusOutlined, HeartOutlined,
    CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined,
    BankOutlined, WalletOutlined, CreditCardOutlined, UserOutlined,
    AuditOutlined, SafetyCertificateOutlined, ThunderboltOutlined,
    BarChartOutlined, CalendarOutlined, InfoCircleOutlined,
    ClearOutlined, LockOutlined, GlobalOutlined, TeamOutlined,
} from "@ant-design/icons";
import { useNavigation } from "@refinedev/core";
import { ITransaksiKeuangan } from "../../types";
import dayjs from "dayjs";
import "dayjs/locale/id";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { formatHijri, formatMasehi } from "../../utility/dateHelper";
import { santriAlias } from "../../utility/privacy";
import { supabaseClient } from "../../utility/supabaseClient";

dayjs.locale("id");

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;
const { useToken } = theme;

// ═══════════════════════════════════════════════════════════════════
// 🎨  DESIGN TOKENS — BRAND IDENTITY AL-HASANAH
//     Semua warna didefinisikan sekali di sini.
//     isDark menentukan varian yang dipakai, bukan hardcode per-komponen.
// ═══════════════════════════════════════════════════════════════════
const GOLD        = "#D4A017";
const GOLD_LIGHT  = "#F0C040";
const GOLD_DARK   = "#9A7A00";
const G           = (o: number) => `rgba(212,160,23,${o})`;   // gold alpha helper

// Warna semantik — satu definisi, pakai di semua komponen
const COLOR = {
    success : { base: "#22C55E", light: "#F0FDF4", dark: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.25)",  glow: "rgba(34,197,94,0.3)"  },
    danger  : { base: "#EF4444", light: "#FFF1F2", dark: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.25)",  glow: "rgba(239,68,68,0.3)"  },
    warning : { base: "#F59E0B", light: "#FFFBEB", dark: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.25)", glow: "rgba(245,158,11,0.3)" },
    info    : { base: "#3B82F6", light: "#EFF6FF", dark: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.25)", glow: "rgba(59,130,246,0.3)" },
    purple  : { base: "#8B5CF6", light: "#F5F3FF", dark: "rgba(139,92,246,0.12)",  border: "rgba(139,92,246,0.25)", glow: "rgba(139,92,246,0.3)" },
    teal    : { base: "#14B8A6", light: "#F0FDFA", dark: "rgba(20,184,166,0.12)",  border: "rgba(20,184,166,0.25)", glow: "rgba(20,184,166,0.3)" },
} as const;

// ═══════════════════════════════════════════════════════════════════
// 🎨  GLOBAL CSS INJECTION
// ═══════════════════════════════════════════════════════════════════
const LEDGER_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;900&family=Outfit:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

  .gl-root { font-family:'Outfit','PingFang SC',system-ui,sans-serif; }

  @keyframes gl-shimmer {
    0%   { background-position:-200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes gl-pulse-in {
    0%,100% { opacity:.6; transform:scale(1); }
    50%     { opacity:1;  transform:scale(1.06); }
  }
  @keyframes gl-enter {
    from { opacity:0; transform:translateY(10px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes gl-float {
    0%,100% { transform:translateY(0); }
    50%     { transform:translateY(-4px); }
  }

  .gl-shimmer-text {
    background:linear-gradient(120deg,#9A7A00 0%,#D4A017 28%,#F5D060 50%,#D4A017 72%,#9A7A00 100%);
    background-size:200% auto;
    -webkit-background-clip:text;
    -webkit-text-fill-color:transparent;
    background-clip:text;
    animation:gl-shimmer 5s linear infinite;
  }
  .gl-float { animation:gl-float 3.8s ease-in-out infinite; }
  .gl-kpi-card {
    transition:transform .28s cubic-bezier(.4,0,.2,1),
               box-shadow .28s cubic-bezier(.4,0,.2,1);
  }
  .gl-kpi-card:hover { transform:translateY(-5px); }

  /* ── ProTable gold header ── */
  .gl-table .ant-table-thead > tr > th,
  .gl-table .ant-table-thead > tr > td {
    background:linear-gradient(135deg,#9A7A00 0%,#C8970E 40%,#D4A017 70%,#B89010 100%) !important;
    color:#fff !important;
    font-family:'Outfit',sans-serif !important;
    font-weight:700 !important;
    font-size:10.5px !important;
    letter-spacing:.09em !important;
    text-transform:uppercase !important;
    border-bottom:none !important;
    padding-top:13px !important;
    padding-bottom:13px !important;
  }
  .gl-table .ant-table-thead > tr > th::before { display:none !important; }
  .gl-table .ant-table-tbody > tr > td {
    padding:13px 16px !important;
    border-bottom:1px solid rgba(212,160,23,.08) !important;
    vertical-align:middle !important;
    transition:background .14s ease;
  }
  .gl-table .ant-table-tbody > tr:hover > td {
    background:rgba(212,160,23,.05) !important;
  }
  /* Summary row */
  .gl-table .ant-table-summary > tr > td {
    padding:14px 16px !important;
    border-top:2px solid rgba(212,160,23,.3) !important;
  }
  .gl-table .ant-table-container { border-radius:0 0 14px 14px !important; overflow:hidden !important; }
  .gl-table .ant-pro-table-list-toolbar { padding:14px 20px !important; }

  /* ── Audit locked row ── */
  .gl-row-locked .ant-table-cell { opacity:.72 !important; }

  /* ── Filter panel ── */
  .gl-filter-label {
    font-size:10px; font-weight:700;
    text-transform:uppercase; letter-spacing:.08em;
    margin-bottom:5px; display:block;
  }

  /* ── Mono utility ── */
  .gl-mono { font-family:'DM Mono','Courier New',monospace !important; }

  /* ── Custom scrollbar ── */
  ::-webkit-scrollbar { width:5px; height:5px; }
  ::-webkit-scrollbar-track  { background:transparent; }
  ::-webkit-scrollbar-thumb  { background:rgba(212,160,23,.3); border-radius:3px; }
  ::-webkit-scrollbar-thumb:hover { background:rgba(212,160,23,.6); }

  @media print {
    body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .gl-no-print { display:none !important; }
  }
`;

// ═══════════════════════════════════════════════════════════════════
// 🔧  UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════
const fCurrency = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

const fCompact = (n: number) => {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} M`;
    if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)} Jt`;
    if (n >= 1_000)         return `${(n / 1_000).toFixed(0)} Rb`;
    return String(n);
};

const isSuccess = (s: string) => s === "settlement" || s === "success";
const isPending = (s: string) => s === "pending";
const isFailed  = (s: string) => ["expire","failure","cancel","failed"].includes(s);

const statusMeta = (s: string) => {
    if (isSuccess(s)) return { label: "SUKSES",   color: COLOR.success, icon: <CheckCircleOutlined /> };
    if (isPending(s)) return { label: "MENUNGGU", color: COLOR.warning, icon: <ClockCircleOutlined /> };
    if (isFailed(s))  return { label: "GAGAL",    color: COLOR.danger,  icon: <CloseCircleOutlined /> };
    return               { label: "DIPROSES", color: COLOR.info,    icon: <ClockCircleOutlined /> };
};

const metodeMeta = (m: string) => {
    const map: Record<string, { icon: React.ReactNode; label: string }> = {
        cash        : { icon: <WalletOutlined />,      label: "CASH"      },
        qris        : { icon: <CreditCardOutlined />,  label: "QRIS"      },
        transfer    : { icon: <BankOutlined />,        label: "TRANSFER"  },
        midtrans    : { icon: <GlobalOutlined />,      label: "MIDTRANS"  },
        gopay       : { icon: <CreditCardOutlined />,  label: "GOPAY"     },
        bank_transfer: { icon: <BankOutlined />,       label: "TRANSFER"  },
    };
    return map[m?.toLowerCase()] ?? { icon: <WalletOutlined />, label: (m || "CASH").toUpperCase() };
};

// ═══════════════════════════════════════════════════════════════════
// 🚀  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export const TransaksiList: React.FC = () => {
    const { token } = useToken();
    const { create } = useNavigation();

    // Dark mode detection
    const hexLum = (hex: string) => {
        const c = hex.replace("#","");
        if (c.length < 6) return 200;
        return .299*parseInt(c.slice(0,2),16) + .587*parseInt(c.slice(2,4),16) + .114*parseInt(c.slice(4,6),16);
    };
    const isDark = hexLum(token.colorBgContainer) < 128;

    // ── Filter State ──────────────────────────────────────
    const [dateRange,   setDateRange]   = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
        dayjs().startOf("month"), dayjs().endOf("month")
    ]);
    const [jenisFilter, setJenisFilter] = useState<string>("all");
    const [statusFilter,setStatusFilter]= useState<string>("all");
    const [metodeFilter,setMetodeFilter]= useState<string>("all");
    const [kategoriFilter, setKategoriFilter] = useState<string>("all");
    const [genderFilter, setGenderFilter] = useState<string>("all");
    const [jurusanFilter, setJurusanFilter] = useState<string>("all");
    const [isExporting, setIsExporting] = useState(false);

    // ── Table Data ────────────────────────────────────────
    const { tableProps, tableQueryResult } = useTable<ITransaksiKeuangan>({
        resource: "transaksi_keuangan",
        syncWithLocation: false,
        meta: {
            select: "*, wali:wali_id(full_name, no_hp), admin:admin_pencatat_id(full_name), santri:santri_nis(nama, nis, kelas, jurusan)"
        },
        filters: {
            permanent: [
                { field: "tanggal_transaksi", operator: "gte", value: dateRange[0].startOf("day").toISOString() },
                { field: "tanggal_transaksi", operator: "lte", value: dateRange[1].endOf("day").toISOString()   },
            ]
        },
        sorters: { initial: [{ field: "tanggal_transaksi", order: "desc" }] },
    });

    const rawData = tableQueryResult?.data?.data ?? [];

    // Normalize metode_pembayaran to canonical filter key
    const metodeKey = (m: string | null | undefined): string => {
        const v = (m ?? "").toLowerCase();
        if (["tunai", "cash"].includes(v)) return "cash";
        if (v === "qris") return "qris";
        if (["transfer", "bank_transfer"].includes(v)) return "bank_transfer";
        if (v === "midtrans") return "midtrans";
        if (v === "gopay") return "gopay";
        return v || "cash";
    };

    // ── Client-side multi-filter ──────────────────────────
    const filteredData = useMemo(() => {
        return rawData.filter(r => {
            if (jenisFilter  !== "all" && r.jenis_transaksi       !== jenisFilter)   return false;
            if (statusFilter !== "all") {
                if (statusFilter === "sukses"  && !isSuccess(r.status_transaksi)) return false;
                if (statusFilter === "pending" && !isPending(r.status_transaksi)) return false;
                if (statusFilter === "gagal"   && !isFailed(r.status_transaksi))  return false;
            }
            if (metodeFilter !== "all" && metodeKey(r.metode_pembayaran) !== metodeFilter) return false;
            if (kategoriFilter !== "all" && (r.kategori ?? "") !== kategoriFilter) return false;
            if (genderFilter !== "all" && (r.scope_gender ?? "") !== genderFilter && (r.scope_gender ?? "") !== "ALL") return false;
            if (jurusanFilter !== "all" && (r.scope_jurusan ?? "") !== jurusanFilter && (r.scope_jurusan ?? "") !== "ALL") return false;
            return true;
        });
    }, [rawData, jenisFilter, statusFilter, metodeFilter, kategoriFilter, genderFilter, jurusanFilter]);

    // ── KPI Calculations ─────────────────────────────────
    const kpi = useMemo(() => {
        const sukses   = filteredData.filter(r => isSuccess(r.status_transaksi));
        const pending  = filteredData.filter(r => isPending(r.status_transaksi));
        const gagal    = filteredData.filter(r => isFailed(r.status_transaksi));

        const totalMasuk  = sukses.filter(r => r.jenis_transaksi === "masuk").reduce((s,r) => s+Number(r.jumlah), 0);
        const totalKeluar = sukses.filter(r => r.jenis_transaksi === "keluar").reduce((s,r) => s+Number(r.jumlah), 0);
        const netSaldo    = totalMasuk - totalKeluar;

        const infaqTotal  = sukses
            .filter(r => r.jenis_transaksi === "masuk" && r.kategori === "donasi")
            .reduce((s,r) => s+Number(r.jumlah), 0);

        const tagihanTotal = totalMasuk - infaqTotal;
        const rataRata     = sukses.length > 0 ? Math.round(totalMasuk / sukses.length) : 0;

        const digitalTotal = sukses
            .filter(r => metodeKey(r.metode_pembayaran) !== "cash")
            .reduce((s,r) => s+Number(r.jumlah), 0);
        const cashTotal = sukses
            .filter(r => metodeKey(r.metode_pembayaran) === "cash")
            .reduce((s,r) => s+Number(r.jumlah), 0);

        const digitalPct = totalMasuk > 0 ? Math.round((digitalTotal/totalMasuk)*100) : 0;
        const successRate = filteredData.length > 0 ? Math.round((sukses.length/filteredData.length)*100) : 0;

        return {
            totalMasuk, totalKeluar, netSaldo,
            infaqTotal, tagihanTotal, rataRata,
            digitalTotal, cashTotal, digitalPct, successRate,
            sukses: sukses.length, pending: pending.length, gagal: gagal.length,
            total: filteredData.length,
        };
    }, [filteredData]);

    // Active filter count
    const activeFilters = [jenisFilter, statusFilter, metodeFilter, kategoriFilter, genderFilter, jurusanFilter].filter(f => f !== "all").length;

    const resetFilters = () => {
        setJenisFilter("all");
        setStatusFilter("all");
        setMetodeFilter("all");
        setKategoriFilter("all");
        setGenderFilter("all");
        setJurusanFilter("all");
    };

    // ═══════════════════════════════════════════════════════
    // EXPORT EXCEL — PREMIUM MULTI-SHEET
    // ═══════════════════════════════════════════════════════
    const handleExportExcel = useCallback(async () => {
        setIsExporting(true);
        const key = "gl_export";
        message.loading({ content: "Menyiapkan Laporan Keuangan...", key, duration: 0 });

        try {
            // Fetch full period data (tidak hanya page aktif)
            const { data: fullData, error } = await supabaseClient
                .from("transaksi_keuangan")
                .select("*, wali:wali_id(full_name), admin:admin_pencatat_id(full_name), santri:santri_nis(nama, nis, kelas)")
                .gte("tanggal_transaksi", dateRange[0].startOf("day").toISOString())
                .lte("tanggal_transaksi", dateRange[1].endOf("day").toISOString())
                .order("tanggal_transaksi", { ascending: false });

            if (error) throw error;
            const rows = fullData ?? [];

            const wb = new ExcelJS.Workbook();
            wb.creator  = "Sistem Informasi Al-Hasanah";
            wb.created  = new Date();

            // ── WARNA CONST (argb hex) ──
            const C = {
                gold    : "FFD4A017",
                goldDark: "FF9A7A00",
                goldBg  : "FFFDF6DC",
                white   : "FFFFFFFF",
                gray50  : "FFF9FAFB",
                gray100 : "FFF3F4F6",
                gray700 : "FF374151",
                green   : "FF22C55E",
                red     : "FFEF4444",
                orange  : "FFF59E0B",
                blue    : "FF3B82F6",
                black   : "FF111111",
                stripe  : "FFFFFBF0",
            };

            const borderThin   = { style: "thin"   as const, color: { argb: "FFE5E7EB" } };
            const borderMedium = { style: "medium"  as const, color: { argb: C.gold     } };
            const allBordersThin = { top:borderThin, left:borderThin, bottom:borderThin, right:borderThin };
            const allBordersMed  = { top:borderMedium, left:borderMedium, bottom:borderMedium, right:borderMedium };

            const headerFill = (bg: string): ExcelJS.FillPattern => ({
                type: "pattern", pattern: "solid", fgColor: { argb: bg }
            });

            const setHeaderRow = (ws: ExcelJS.Worksheet, cols: string[], rowNum: number) => {
                const row = ws.getRow(rowNum);
                cols.forEach((label, i) => {
                    const cell = row.getCell(i+1);
                    cell.value     = label;
                    cell.font      = { name:"Arial", size:10, bold:true, color:{argb:C.white} };
                    cell.fill      = headerFill(C.gold);
                    cell.alignment = { vertical:"middle", horizontal:"center", wrapText:false };
                    cell.border    = allBordersMed;
                });
                row.height = 28;
                return row;
            };

            const setCellStyle = (cell: ExcelJS.Cell, isEven: boolean, extra?: Partial<ExcelJS.Style>) => {
                cell.font      = { name:"Arial", size:9.5, color:{argb:C.black}, ...(extra?.font as any) };
                cell.fill      = headerFill(isEven ? C.white : C.stripe);
                cell.alignment = { vertical:"middle", horizontal:"left", wrapText:false, ...(extra?.alignment as any) };
                cell.border    = allBordersThin;
            };

            const addKop = (ws: ExcelJS.Worksheet, totalCols: number, title: string, sub: string) => {
                // Gold sidebar strip + kop
                ws.mergeCells(1,1,1,totalCols);
                const t = ws.getCell("A1");
                t.value     = "PONDOK PESANTREN AL-HASANAH";
                t.font      = { name:"Arial", size:16, bold:true, color:{argb:C.goldDark} };
                t.alignment = { horizontal:"center", vertical:"middle" };
                t.fill      = headerFill(C.goldBg);
                ws.getRow(1).height = 32;

                ws.mergeCells(2,1,2,totalCols);
                ws.getCell("A2").value     = "Jl. Raya Cibeuti No.13, Cibeuti, Kec. Kawalu, Tasikmalaya, Jawa Barat 46182";
                ws.getCell("A2").font      = { name:"Arial", size:9, italic:true, color:{argb:C.gray700} };
                ws.getCell("A2").alignment = { horizontal:"center" };

                ws.mergeCells(3,1,3,totalCols);
                ws.getCell("A3").fill = headerFill(C.gold);
                ws.getRow(3).height   = 4;

                ws.addRow([]);

                ws.mergeCells(5,1,5,totalCols);
                ws.getCell("A5").value     = title;
                ws.getCell("A5").font      = { name:"Arial", size:13, bold:true, color:{argb:C.black} };
                ws.getCell("A5").alignment = { horizontal:"center" };

                ws.mergeCells(6,1,6,totalCols);
                ws.getCell("A6").value     = sub;
                ws.getCell("A6").font      = { name:"Arial", size:9, color:{argb:C.gray700} };
                ws.getCell("A6").alignment = { horizontal:"center" };

                ws.addRow([]);
            };

            // ╔══════════════════════════════════╗
            // ║  SHEET 1 — RINGKASAN EKSEKUTIF   ║
            // ╚══════════════════════════════════╝
            const ws1 = wb.addWorksheet("📊 Ringkasan Eksekutif", {
                properties: { tabColor: { argb: C.gold } }
            });
            ws1.views = [{ showGridLines: false }];

            const totalSukses  = rows.filter(r=>isSuccess(r.status_transaksi));
            const totalMasukEx = totalSukses.filter(r=>r.jenis_transaksi==="masuk").reduce((s,r)=>s+Number(r.jumlah),0);
            const totalKeluarEx= totalSukses.filter(r=>r.jenis_transaksi==="keluar").reduce((s,r)=>s+Number(r.jumlah),0);
            const netEx        = totalMasukEx - totalKeluarEx;

            const kpiRows = [
                ["💰 Total Kas Masuk (Sukses)",   totalMasukEx, C.green],
                ["💸 Total Kas Keluar (Sukses)",  totalKeluarEx, C.red],
                ["📊 Net Saldo",                  netEx, netEx >= 0 ? C.green : C.red],
                ["🔢 Total Transaksi",             rows.length, C.blue],
                ["✅ Transaksi Sukses",             totalSukses.length, C.green],
                ["⏳ Transaksi Pending",            rows.filter(r=>isPending(r.status_transaksi)).length, C.orange],
                ["❌ Transaksi Gagal",              rows.filter(r=>isFailed(r.status_transaksi)).length, C.red],
                ["📈 Rata-rata per Transaksi",     totalSukses.length > 0 ? Math.round(totalMasukEx/totalSukses.length) : 0, C.blue],
                ["🏦 Digital Payments",             totalSukses.filter(r=>r.metode_pembayaran!=="cash").reduce((s,r)=>s+Number(r.jumlah),0), C.blue],
                ["💵 Cash Payments",               totalSukses.filter(r=>r.metode_pembayaran==="cash").reduce((s,r)=>s+Number(r.jumlah),0), C.gray700],
            ];

            addKop(ws1, 3, "RINGKASAN EKSEKUTIF KEUANGAN",
                `Periode: ${dateRange[0].format("DD MMMM YYYY")} s/d ${dateRange[1].format("DD MMMM YYYY")} | Dicetak: ${dayjs().format("DD MMM YYYY HH:mm")}`);

            setHeaderRow(ws1, ["INDIKATOR KINERJA KEUANGAN", "NILAI", ""], 8);
            kpiRows.forEach(([label, val, color], i) => {
                const row = ws1.addRow([label, val, ""]);
                row.height = 22;
                const c1 = row.getCell(1);
                const c2 = row.getCell(2);
                c1.font      = { name:"Arial", size:10, bold:true };
                c1.fill      = headerFill(i%2===0 ? C.white : C.stripe);
                c1.border    = allBordersThin;
                c1.alignment = { vertical:"middle" };
                c2.font      = { name:"Arial", size:11, bold:true, color:{argb:color as string} };
                c2.fill      = headerFill(i%2===0 ? C.white : C.stripe);
                c2.border    = allBordersThin;
                c2.alignment = { vertical:"middle", horizontal:"right" };
                if (typeof val === "number" && val > 999)
                    c2.numFmt = '"Rp "#,##0';
                ws1.getCell(`C${row.number}`).fill = headerFill(i%2===0 ? C.white : C.stripe);
            });

            ws1.getColumn(1).width = 42;
            ws1.getColumn(2).width = 28;
            ws1.getColumn(3).width = 10;

            // ╔══════════════════════════════════╗
            // ║  SHEET 2 — BUKU BESAR DETAIL     ║
            // ╚══════════════════════════════════╝
            const ws2 = wb.addWorksheet("📒 Buku Besar Detail", {
                properties: { tabColor: { argb: "FF3B82F6" } }
            });
            ws2.views = [{ state:"frozen", ySplit:9, showGridLines:false }];

            const cols2 = ["NO","TANGGAL MASEHI","TANGGAL HIJRIAH","JENIS","SUBJEK (SANTRI)","KELAS","WALI/PEMBAYAR","PENCATAT/SISTEM","URAIAN / KETERANGAN","METODE","NOMINAL","STATUS","ORDER ID MIDTRANS"];
            addKop(ws2, cols2.length, "BUKU BESAR TRANSAKSI KEUANGAN — LAPORAN DETAIL",
                `Periode: ${dateRange[0].format("DD MMMM YYYY")} s/d ${dateRange[1].format("DD MMMM YYYY")} | Total ${rows.length} Transaksi`);

            setHeaderRow(ws2, cols2, 8);

            let runningMasuk  = 0;
            let runningKeluar = 0;

            rows.forEach((r, i) => {
                const ok = isSuccess(r.status_transaksi);
                if (ok && r.jenis_transaksi === "masuk")  runningMasuk  += Number(r.jumlah);
                if (ok && r.jenis_transaksi === "keluar") runningKeluar += Number(r.jumlah);

                const row = ws2.addRow([
                    i+1,
                    dayjs(r.tanggal_transaksi).format("DD/MM/YYYY HH:mm"),
                    formatHijri(r.tanggal_transaksi),
                    r.jenis_transaksi === "masuk" ? "MASUK" : "KELUAR",
                    (r.santri?.nama || santriAlias(r.santri?.nis))?.toUpperCase() || "UMUM / MASYARAKAT",
                    r.santri?.kelas ? `Kelas ${r.santri.kelas}` : "-",
                    r.wali?.full_name || r.keterangan || "-",
                    r.admin?.full_name || "SISTEM (DIGITAL)",
                    r.keterangan || "-",
                    (r.metode_pembayaran || "CASH").toUpperCase(),
                    Number(r.jumlah),
                    isSuccess(r.status_transaksi) ? "SUKSES" :
                    isPending(r.status_transaksi) ? "PENDING" :
                    isFailed(r.status_transaksi)  ? "GAGAL"  : "DIPROSES",
                    r.midtrans_order_id || "-",
                ]);
                row.height = 20;

                row.eachCell((cell, ci) => {
                    setCellStyle(cell, i%2===0, {
                        alignment: { horizontal: [1,4,6,10,11,12].includes(ci) ? "center" : "left", vertical:"middle" } as any
                    });
                });

                // Tipe column color
                const typeCell = row.getCell(4);
                typeCell.font = { name:"Arial", size:9.5, bold:true,
                    color: { argb: r.jenis_transaksi==="masuk" ? C.green : C.red }
                };

                // Nominal column
                const nomCell = row.getCell(11);
                nomCell.numFmt = "#,##0";
                nomCell.font   = { name:"Courier New", size:10, bold:true,
                    color: { argb: r.jenis_transaksi==="masuk" ? C.green : C.red }
                };

                // Status column color
                const stCell = row.getCell(12);
                stCell.font = { name:"Arial", size:9.5, bold:true,
                    color: { argb: isSuccess(r.status_transaksi) ? C.green :
                                   isPending(r.status_transaksi) ? C.orange : C.red }
                };
            });

            // Footer summary row
            const footerRow = ws2.addRow([
                "", "", "", "", "", "", "", "", "",
                "TOTAL KAS MASUK (SUKSES) →",
                runningMasuk, "", ""
            ]);
            footerRow.height = 26;
            footerRow.getCell(10).font      = { name:"Arial", size:10, bold:true, color:{argb:C.goldDark} };
            footerRow.getCell(10).alignment = { horizontal:"right" };
            footerRow.getCell(11).font      = { name:"Courier New", size:11, bold:true, color:{argb:C.green} };
            footerRow.getCell(11).numFmt    = "#,##0";
            footerRow.getCell(11).fill      = headerFill(C.goldBg);

            const footerRow2 = ws2.addRow(["","","","","","","","","","TOTAL KAS KELUAR (SUKSES) →",runningKeluar,"",""]);
            footerRow2.height = 22;
            footerRow2.getCell(10).font      = { name:"Arial", size:10, bold:true, color:{argb:C.goldDark} };
            footerRow2.getCell(10).alignment = { horizontal:"right" };
            footerRow2.getCell(11).font      = { name:"Courier New", size:11, bold:true, color:{argb:C.red} };
            footerRow2.getCell(11).numFmt    = "#,##0";
            footerRow2.getCell(11).fill      = headerFill(C.goldBg);

            const netRow = ws2.addRow(["","","","","","","","","","NET SALDO →",runningMasuk-runningKeluar,"",""]);
            netRow.height = 26;
            netRow.getCell(10).font      = { name:"Arial", size:11, bold:true, color:{argb:C.goldDark} };
            netRow.getCell(10).alignment = { horizontal:"right" };
            const netColor = (runningMasuk-runningKeluar) >= 0 ? C.green : C.red;
            netRow.getCell(11).font      = { name:"Courier New", size:12, bold:true, color:{argb:netColor} };
            netRow.getCell(11).numFmt    = "#,##0";
            netRow.getCell(11).fill      = headerFill(C.goldBg);
            netRow.getCell(11).border    = allBordersMed;

            ws2.autoFilter = `A8:M8`;
            [5,22,22,10,32,10,28,22,38,14,18,12,28].forEach((w,i) => { ws2.getColumn(i+1).width = w; });

            // ╔══════════════════════════════════╗
            // ║  SHEET 3 — INFAQ & WAKAF         ║
            // ╚══════════════════════════════════╝
            const infaqRows = rows.filter(r =>
                r.jenis_transaksi==="masuk" &&
                isSuccess(r.status_transaksi) &&
                r.kategori === "donasi"
            );

            if (infaqRows.length > 0) {
                const ws3 = wb.addWorksheet("❤️ Infaq & Wakaf", {
                    properties: { tabColor: { argb:"FF8B5CF6" } }
                });
                ws3.views = [{ showGridLines:false }];
                addKop(ws3, 6, "LAPORAN INFAQ, WAKAF & SHADAQAH",
                    `Periode: ${dateRange[0].format("DD MMMM YYYY")} s/d ${dateRange[1].format("DD MMMM YYYY")}`);

                setHeaderRow(ws3, ["NO","TANGGAL","PEMBERI / WALI","URAIAN / JENIS INFAQ","METODE","NOMINAL"], 8);
                let totalInfaq = 0;
                infaqRows.forEach((r,i) => {
                    totalInfaq += Number(r.jumlah);
                    const row = ws3.addRow([
                        i+1,
                        dayjs(r.tanggal_transaksi).format("DD MMM YYYY HH:mm"),
                        r.wali?.full_name || r.santri?.nama || santriAlias(r.santri?.nis) || "Donatur Umum",
                        r.keterangan || "-",
                        (r.metode_pembayaran || "CASH").toUpperCase(),
                        Number(r.jumlah),
                    ]);
                    row.height = 22;
                    row.eachCell(cell => setCellStyle(cell, i%2===0));
                    row.getCell(6).numFmt = "#,##0";
                    row.getCell(6).font   = { name:"Courier New", size:10, bold:true, color:{argb:C.green} };
                });
                const footInfaq = ws3.addRow(["","","","","TOTAL INFAQ / WAKAF",totalInfaq]);
                footInfaq.height = 26;
                footInfaq.getCell(5).font      = { name:"Arial",size:11,bold:true,color:{argb:C.goldDark} };
                footInfaq.getCell(5).alignment = { horizontal:"right" };
                footInfaq.getCell(6).numFmt    = "#,##0";
                footInfaq.getCell(6).font      = { name:"Courier New",size:12,bold:true,color:{argb:C.green} };
                footInfaq.getCell(6).fill      = headerFill(C.goldBg);
                footInfaq.getCell(6).border    = allBordersMed;
                [5,24,32,40,14,20].forEach((w,i) => { ws3.getColumn(i+1).width = w; });
            }

            // ── SAVE ──
            const buf      = await wb.xlsx.writeBuffer();
            const dateStr  = `${dateRange[0].format("DDMMYY")}-${dateRange[1].format("DDMMYY")}`;
            saveAs(new Blob([buf]), `BukuBesar_AlHasanah_${dateStr}.xlsx`);
            message.success({ content:"Laporan Keuangan berhasil diunduh!", key, duration:3 });
        } catch (err: any) {
            message.error({ content:`Gagal export: ${err.message}`, key });
        } finally {
            setIsExporting(false);
        }
    }, [dateRange]);

    // ═══════════════════════════════════════════════════════
    // TABLE COLUMNS
    // ═══════════════════════════════════════════════════════
    const columns: ProColumns<ITransaksiKeuangan>[] = [
        {
            title: "Waktu & Pencatat",
            dataIndex: "tanggal_transaksi",
            width: 170,
            fixed: "left",
            render: (_, r) => {
                const isAdmin = !!r.admin?.full_name;
                return (
                    <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                        <Text style={{ fontWeight:700, fontSize:13, color:token.colorText, display:"block", lineHeight:"1.2" }}>
                            {dayjs(r.tanggal_transaksi).format("DD MMM YYYY")}
                        </Text>
                        <Text className="gl-mono" style={{ fontSize:11, color:token.colorTextSecondary, display:"block" }}>
                            {dayjs(r.tanggal_transaksi).format("HH:mm")} WIB
                        </Text>
                        <div style={{ marginTop:3 }}>
                            {isAdmin ? (
                                <Tag
                                    icon={<UserOutlined />}
                                    style={{
                                        background: isDark ? COLOR.info.dark : COLOR.info.light,
                                        color:COLOR.info.base, border:`1px solid ${COLOR.info.border}`,
                                        borderRadius:6, fontSize:9.5, fontWeight:700, padding:"0 6px", margin:0
                                    }}
                                >
                                    {r.admin!.full_name}
                                </Tag>
                            ) : (
                                <Tag
                                    icon={<ThunderboltOutlined />}
                                    style={{
                                        background: isDark ? COLOR.teal.dark : COLOR.teal.light,
                                        color:COLOR.teal.base, border:`1px solid ${COLOR.teal.border}`,
                                        borderRadius:6, fontSize:9.5, fontWeight:700, padding:"0 6px", margin:0
                                    }}
                                >
                                    SISTEM AUTO
                                </Tag>
                            )}
                        </div>
                    </div>
                );
            }
        },
        {
            title: "Jenis",
            dataIndex: "jenis_transaksi",
            width: 90,
            align: "center",
            render: (val) => {
                const isMasuk = val === "masuk";
                return (
                    <Tag
                        icon={isMasuk ? <RiseOutlined /> : <FallOutlined />}
                        style={{
                            background: isMasuk
                                ? (isDark ? COLOR.success.dark : COLOR.success.light)
                                : (isDark ? COLOR.danger.dark : COLOR.danger.light),
                            color:       isMasuk ? COLOR.success.base : COLOR.danger.base,
                            border:      `1px solid ${isMasuk ? COLOR.success.border : COLOR.danger.border}`,
                            borderRadius:20, fontWeight:800, fontSize:10.5,
                            padding:"3px 10px", display:"inline-flex", alignItems:"center", gap:4,
                            boxShadow:`0 2px 8px ${isMasuk ? COLOR.success.glow : COLOR.danger.glow}`
                        }}
                    >
                        {isMasuk ? "MASUK" : "KELUAR"}
                    </Tag>
                );
            }
        },
        {
            title: "Subjek Transaksi",
            key: "subjek",
            width: 250,
            render: (_, r) => {
                const hasSantri = !!r.santri;
                return (
                    <Space size={10} align="start">
                        <Avatar
                            size={40}
                            icon={hasSantri ? <TeamOutlined /> : <HeartOutlined />}
                            style={{
                                flexShrink:0,
                                background: hasSantri
                                    ? (isDark ? G(0.18) : "#FDF6DC")
                                    : (isDark ? COLOR.purple.dark : COLOR.purple.light),
                                color: hasSantri
                                    ? (isDark ? GOLD_LIGHT : GOLD_DARK)
                                    : COLOR.purple.base,
                                border: `2px solid ${hasSantri ? G(0.3) : COLOR.purple.border}`,
                            }}
                        />
                        <div style={{ display:"flex", flexDirection:"column", gap:3, minWidth:0 }}>
                            {hasSantri ? (
                                <>
                                    <Text style={{ fontWeight:700, fontSize:13, color:token.colorText, display:"block", lineHeight:"1.2" }}>
                                        {r.santri!.nama}
                                    </Text>
                                    <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                                        <Tag style={{
                                            background:G(isDark?.18:.08), color:isDark?GOLD_LIGHT:GOLD_DARK,
                                            border:`1px solid ${G(.25)}`, borderRadius:5,
                                            fontSize:9.5, fontWeight:700, padding:"0 6px", margin:0
                                        }}>
                                            Kelas {r.santri!.kelas}
                                        </Tag>
                                    </div>
                                </>
                            ) : (
                                <Text style={{ fontSize:12.5, color:token.colorTextSecondary, fontStyle:"italic" }}>
                                    Umum / Masyarakat
                                </Text>
                            )}
                            {r.wali?.full_name && (
                                <Text style={{ fontSize:10.5, color:token.colorTextSecondary }}>
                                    Wali: {r.wali.full_name}
                                </Text>
                            )}
                        </div>
                    </Space>
                );
            }
        },
        {
            title: "Uraian & Audit",
            dataIndex: "keterangan",
            width: 240,
            render: (val, r) => (
                <div>
                    <div style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
                        <div style={{
                            width:3, minHeight:30, borderRadius:2, flexShrink:0,
                            background:`linear-gradient(to bottom, ${GOLD_LIGHT}, ${GOLD_DARK})`
                        }} />
                        <Text style={{ fontSize:12.5, color:token.colorText, lineHeight:1.5 }}>
                            {val || "—"}
                        </Text>
                    </div>
                    {r.midtrans_order_id && (
                        <div style={{
                            marginTop:6, padding:"3px 8px",
                            background: isDark ? "rgba(255,255,255,0.04)" : "#F8FAFC",
                            border:`1px solid ${isDark?"rgba(255,255,255,0.08)":"#E2E8F0"}`,
                            borderRadius:5, display:"flex", alignItems:"center", gap:5
                        }}>
                            <LockOutlined style={{ fontSize:9, color:COLOR.teal.base }} />
                            <Text className="gl-mono" style={{ fontSize:9.5, color:token.colorTextSecondary }}>
                                {r.midtrans_order_id}
                            </Text>
                        </div>
                    )}
                </div>
            )
        },
        {
            title: "Metode",
            dataIndex: "metode_pembayaran",
            width: 120,
            align: "center",
            render: (val) => {
                const meta = metodeMeta(String(val ?? "cash"));
                return (
                    <div style={{
                        display:"inline-flex", alignItems:"center", gap:6,
                        background: isDark ? "rgba(255,255,255,0.05)" : token.colorBgTextHover,
                        border:`1px solid ${isDark?"rgba(255,255,255,0.1)":token.colorBorderSecondary}`,
                        borderRadius:8, padding:"4px 10px"
                    }}>
                        <span style={{ color:token.colorTextSecondary, fontSize:12 }}>{meta.icon}</span>
                        <Text className="gl-mono" style={{ fontSize:10.5, fontWeight:700, color:token.colorText, letterSpacing:"0.04em" }}>
                            {meta.label}
                        </Text>
                    </div>
                );
            }
        },
        {
            title: "Nominal",
            dataIndex: "jumlah",
            width: 170,
            align: "right",
            render: (val, r) => {
                const isMasuk = r.jenis_transaksi === "masuk";
                const isOk    = isSuccess(r.status_transaksi);
                return (
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:3 }}>
                        <Text
                            className="gl-mono"
                            style={{
                                fontWeight:800, fontSize:14.5,
                                color: isOk
                                    ? (isMasuk ? COLOR.success.base : COLOR.danger.base)
                                    : token.colorTextSecondary,
                                display:"block"
                            }}
                        >
                            {isMasuk ? "+" : "−"}{fCurrency(Number(val))}
                        </Text>
                        {!isOk && (
                            <Text style={{ fontSize:9.5, color:token.colorTextSecondary }}>
                                (belum terkonfirmasi)
                            </Text>
                        )}
                    </div>
                );
            }
        },
        {
            title: "Status",
            dataIndex: "status_transaksi",
            width: 120,
            align: "center",
            fixed: "right",
            render: (val) => {
                const meta = statusMeta(String(val ?? ""));
                return (
                    <Tag
                        icon={meta.icon}
                        style={{
                            background: isDark ? meta.color.dark : meta.color.light,
                            color:meta.color.base, border:`1px solid ${meta.color.border}`,
                            borderRadius:20, fontWeight:800, fontSize:10.5,
                            padding:"3px 12px", display:"inline-flex", alignItems:"center", gap:5,
                            boxShadow:`0 2px 8px ${meta.color.glow}`
                        }}
                    >
                        {meta.label}
                    </Tag>
                );
            }
        },
    ];

    // ═══════════════════════════════════════════════════════
    // DESIGN TOKENS
    // ═══════════════════════════════════════════════════════
    const cardBase: React.CSSProperties = {
        borderRadius:16,
        border:`1px solid ${G(isDark?.22:.13)}`,
        background:token.colorBgContainer,
    };

    const kpiDefs = [
        {
            key:"masuk", label:"Kas Masuk Sukses",
            value: fCompact(kpi.totalMasuk),
            sub: fCurrency(kpi.totalMasuk),
            icon:<RiseOutlined />, color:COLOR.success,
            trend:null, trendLabel:"",
        },
        {
            key:"net", label:"Net Saldo",
            value: fCompact(kpi.netSaldo),
            sub: fCurrency(kpi.netSaldo),
            icon:<SwapOutlined />, color: kpi.netSaldo >= 0 ? COLOR.success : COLOR.danger,
            trend:null, trendLabel:"",
        },
        {
            key:"trx", label:"Total Transaksi",
            value: kpi.total,
            sub: `${kpi.sukses} Sukses · ${kpi.pending} Pending`,
            icon:<BarChartOutlined />, color:COLOR.info,
            trend:null, trendLabel:"",
        },
        {
            key:"avg", label:"Rata-rata / Transaksi",
            value: fCompact(kpi.rataRata),
            sub: fCurrency(kpi.rataRata),
            icon:<DollarOutlined />, color:{ base:isDark?GOLD_LIGHT:GOLD_DARK, light:"#FDF6DC", dark:G(.12), border:G(.28), glow:G(.3) },
            trend:null, trendLabel:"",
        },
    ];

    // ── Table summary ──
    const pageSuccessMasuk  = filteredData.filter(r=>isSuccess(r.status_transaksi)&&r.jenis_transaksi==="masuk").reduce((s,r)=>s+Number(r.jumlah),0);
    const pageSuccessKeluar = filteredData.filter(r=>isSuccess(r.status_transaksi)&&r.jenis_transaksi==="keluar").reduce((s,r)=>s+Number(r.jumlah),0);

    return (
        <div className="gl-root" style={{ display:"flex", flexDirection:"column", gap:20, paddingBottom:80 }}>
            <style>{LEDGER_CSS}</style>

            {/* ╔══════════════════════════════════════════╗
                ║          HERO HEADER BANNER              ║
                ╚══════════════════════════════════════════╝ */}
            <motion.div
                initial={{ opacity:0, y:-18 }}
                animate={{ opacity:1, y:0 }}
                transition={{ duration:.48, ease:"easeOut" }}
                style={{
                    background: isDark
                        ? `linear-gradient(135deg, ${G(.14)} 0%, ${G(.06)} 50%, transparent 100%)`
                        : `linear-gradient(135deg, #F8F0D0 0%, #FFF9EE 55%, #FFFFFF 100%)`,
                    borderRadius:20, padding:"22px 28px",
                    border:`1px solid ${G(isDark?.3:.22)}`,
                    position:"relative", overflow:"hidden",
                }}
            >
                <div style={{ position:"absolute", top:-50, right:-50, width:230, height:230, borderRadius:"50%", background:`radial-gradient(circle, ${G(.13)} 0%, transparent 70%)`, pointerEvents:"none" }} />
                <div style={{ position:"absolute", bottom:-25, left:160, width:150, height:150, borderRadius:"50%", background:`radial-gradient(circle, ${G(.07)} 0%, transparent 70%)`, pointerEvents:"none" }} />

                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:16, position:"relative" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:18 }}>
                        <div className="gl-float" style={{
                            width:60, height:60, borderRadius:18,
                            background:`linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})`,
                            display:"flex", alignItems:"center", justifyContent:"center",
                            boxShadow:`0 8px 26px ${G(.5)}`, flexShrink:0,
                        }}>
                            <AuditOutlined style={{ color:"#fff", fontSize:26 }} />
                        </div>
                        <div>
                            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:5 }}>
                                <h1 className="gl-shimmer-text" style={{
                                    fontFamily:"'Cinzel','Georgia',serif",
                                    fontSize:20, fontWeight:700, margin:0, letterSpacing:"0.03em"
                                }}>
                                    Buku Besar Keuangan
                                </h1>
                                <Tag style={{
                                    background:`linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})`,
                                    color:"#fff", border:"none", borderRadius:7,
                                    fontWeight:700, fontSize:9.5, letterSpacing:"0.12em", padding:"1px 9px"
                                }}>AUDIT LOCKED</Tag>
                                <Tag style={{
                                    background: isDark ? COLOR.success.dark : COLOR.success.light,
                                    color:COLOR.success.base, border:`1px solid ${COLOR.success.border}`,
                                    borderRadius:7, fontSize:9.5, fontWeight:700, padding:"1px 9px"
                                }}>
                                    <SafetyCertificateOutlined style={{ marginRight:3 }} />GENERAL LEDGER
                                </Tag>
                            </div>
                            <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                                <span style={{ fontSize:12, color:token.colorTextSecondary }}>
                                    <CalendarOutlined style={{ marginRight:5, color:GOLD }} />
                                    {formatHijri(new Date())}
                                </span>
                                <span style={{ color:token.colorBorderSecondary }}>·</span>
                                <span style={{ fontSize:12, color:token.colorTextSecondary }}>
                                    {formatMasehi(new Date())}
                                </span>
                                <span style={{ color:token.colorBorderSecondary }}>·</span>
                                <span style={{ fontSize:12, color:token.colorTextSecondary }}>
                                    <LockOutlined style={{ marginRight:4, color:COLOR.success.base }} />
                                    Data tidak dapat dimanipulasi
                                </span>
                            </div>
                        </div>
                    </div>

                    <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                        <Button
                            icon={<HeartOutlined />}
                            onClick={() => create("transaksi_keuangan")}
                            style={{
                                borderColor:`${COLOR.purple.base}55`,
                                color:COLOR.purple.base,
                                borderRadius:11, height:40, fontWeight:600, fontSize:13,
                                background: isDark ? COLOR.purple.dark : COLOR.purple.light
                            }}
                        >
                            Input Infaq / Wakaf
                        </Button>
                        <Button
                            icon={<DownloadOutlined />}
                            loading={isExporting}
                            onClick={handleExportExcel}
                            style={{
                                borderColor:`${COLOR.success.base}55`,
                                color:COLOR.success.base,
                                borderRadius:11, height:40, fontWeight:600, fontSize:13,
                                background: isDark ? COLOR.success.dark : COLOR.success.light
                            }}
                        >
                            Export Excel
                        </Button>
                    </div>
                </div>
            </motion.div>

            {/* ╔══════════════════════════════════════════╗
                ║             KPI CARDS                    ║
                ╚══════════════════════════════════════════╝ */}
            <Row gutter={[16,16]}>
                {kpiDefs.map((kpi, i) => (
                    <Col xs={24} sm={12} lg={6} key={kpi.key}>
                        <motion.div
                            initial={{ opacity:0, y:22 }}
                            animate={{ opacity:1, y:0 }}
                            transition={{ duration:.42, delay:i*.09, ease:"easeOut" }}
                        >
                            <Card
                                className="gl-kpi-card"
                                bordered={false}
                                bodyStyle={{ padding:"18px 20px" }}
                                style={{
                                    background: isDark ? kpi.color.dark : kpi.color.light,
                                    border:`1px solid ${kpi.color.border}`,
                                    borderRadius:16,
                                    boxShadow:`0 4px 20px ${kpi.color.glow}44`
                                }}
                            >
                                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8 }}>
                                    <div style={{ flex:1, minWidth:0 }}>
                                        <div style={{
                                            fontSize:10.5, fontWeight:700, letterSpacing:"0.08em",
                                            color:token.colorTextSecondary, textTransform:"uppercase",
                                            marginBottom:10,
                                        }}>
                                            {kpi.label}
                                        </div>
                                        <div className="gl-mono" style={{
                                            fontSize:26, fontWeight:900, color:kpi.color.base,
                                            lineHeight:1, marginBottom:5
                                        }}>
                                            {kpi.value}
                                        </div>
                                        <div style={{ fontSize:11, color:token.colorTextSecondary }}>
                                            {kpi.sub}
                                        </div>
                                    </div>
                                    <div style={{
                                        width:46, height:46, borderRadius:13, flexShrink:0,
                                        background:`${kpi.color.base}22`,
                                        display:"flex", alignItems:"center", justifyContent:"center",
                                        fontSize:21, color:kpi.color.base,
                                    }}>
                                        {kpi.icon}
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    </Col>
                ))}
            </Row>

            {/* ╔══════════════════════════════════════════╗
                ║       SMART ANALYTICS MINI STRIP         ║
                ╚══════════════════════════════════════════╝ */}
            <motion.div
                initial={{ opacity:0, y:10 }}
                animate={{ opacity:1, y:0 }}
                transition={{ duration:.4, delay:.38 }}
            >
                <Row gutter={[14,14]}>
                    {/* Success Rate */}
                    <Col xs={24} sm={12} md={6}>
                        <Card bordered={false} bodyStyle={{ padding:"14px 18px" }} style={cardBase}>
                            <Text style={{ fontSize:10, fontWeight:700, color:token.colorTextSecondary, textTransform:"uppercase", letterSpacing:"0.07em", display:"block", marginBottom:8 }}>Tingkat Sukses</Text>
                            <Progress
                                percent={kpi.successRate}
                                strokeColor={{ from:COLOR.success.base, to:"#16A34A" }}
                                trailColor={isDark?"rgba(255,255,255,0.07)":"#E5E7EB"}
                                strokeWidth={8}
                                format={pct => <span className="gl-mono" style={{ fontSize:14, fontWeight:800, color:COLOR.success.base }}>{pct}%</span>}
                            />
                            <Text style={{ fontSize:10.5, color:token.colorTextSecondary, marginTop:4, display:"block" }}>
                                {kpi.sukses} sukses dari {kpi.total} transaksi
                            </Text>
                        </Card>
                    </Col>
                    {/* Pengeluaran */}
                    <Col xs={24} sm={12} md={6}>
                        <Card bordered={false} bodyStyle={{ padding:"14px 18px" }}
                            style={{ ...cardBase, border:`1px solid ${kpi.totalKeluar > 0 ? COLOR.danger.border : G(isDark?.22:.13)}` }}>
                            <Text style={{ fontSize:10, fontWeight:700, color:token.colorTextSecondary, textTransform:"uppercase", letterSpacing:"0.07em", display:"block", marginBottom:6 }}>
                                <FallOutlined style={{ marginRight:4, color:COLOR.danger.base }} />Pengeluaran
                            </Text>
                            <div className="gl-mono" style={{ fontSize:24, fontWeight:900, color:COLOR.danger.base, lineHeight:1, marginBottom:4 }}>
                                {fCurrency(kpi.totalKeluar)}
                            </div>
                            <Text style={{ fontSize:10.5, color:token.colorTextSecondary }}>
                                100% Tunai
                            </Text>
                        </Card>
                    </Col>
                    {/* Digital vs Cash */}
                    <Col xs={24} sm={12} md={6}>
                        <Card bordered={false} bodyStyle={{ padding:"14px 18px" }} style={cardBase}>
                            <Text style={{ fontSize:10, fontWeight:700, color:token.colorTextSecondary, textTransform:"uppercase", letterSpacing:"0.07em", display:"block", marginBottom:8 }}>Komposisi Metode</Text>
                            <Progress
                                percent={kpi.digitalPct}
                                strokeColor={{ from:COLOR.info.base, to:"#2563EB" }}
                                trailColor={isDark?"rgba(255,255,255,0.07)":"#E5E7EB"}
                                strokeWidth={8}
                                format={pct => <span className="gl-mono" style={{ fontSize:12, fontWeight:800, color:COLOR.info.base }}>{pct}%</span>}
                            />
                            <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                                <Text style={{ fontSize:10.5, color:COLOR.info.base, fontWeight:600 }}>● Digital {fCompact(kpi.digitalTotal)}</Text>
                                <Text style={{ fontSize:10.5, color:token.colorTextSecondary, fontWeight:600 }}>● Cash {fCompact(kpi.cashTotal)}</Text>
                            </div>
                        </Card>
                    </Col>
                    {/* Infaq portion */}
                    <Col xs={24} sm={12} md={6}>
                        <Card bordered={false} bodyStyle={{ padding:"14px 18px" }}
                            style={{ ...cardBase, border:`1px solid ${COLOR.purple.border}` }}>
                            <Text style={{ fontSize:10, fontWeight:700, color:token.colorTextSecondary, textTransform:"uppercase", letterSpacing:"0.07em", display:"block", marginBottom:6 }}>
                                <HeartOutlined style={{ marginRight:4, color:COLOR.purple.base }} />Infaq & Wakaf
                            </Text>
                            <div className="gl-mono" style={{ fontSize:22, fontWeight:900, color:COLOR.purple.base, lineHeight:1, marginBottom:4 }}>
                                {fCompact(kpi.infaqTotal)}
                            </div>
                            <Text style={{ fontSize:10.5, color:token.colorTextSecondary }}>
                                Tagihan: {fCompact(kpi.tagihanTotal)}
                            </Text>
                        </Card>
                    </Col>
                </Row>
            </motion.div>

            {/* ╔══════════════════════════════════════════╗
                ║           PREMIUM FILTER BAR             ║
                ╚══════════════════════════════════════════╝ */}
            <motion.div
                initial={{ opacity:0, y:10 }}
                animate={{ opacity:1, y:0 }}
                transition={{ duration:.4, delay:.46 }}
            >
                <Card bordered={false} bodyStyle={{ padding:"16px 20px" }} style={{
                    ...cardBase,
                    background: isDark ? G(.04) : "rgba(255,249,232,0.9)",
                    backdropFilter:"blur(8px)",
                }}>
                    <div style={{ display:"flex", alignItems:"center", flexWrap:"wrap", gap:16 }}>
                        {/* Filter icon */}
                        <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:80 }}>
                            <div style={{
                                width:32, height:32, borderRadius:9,
                                background:G(isDark?.2:.12),
                                display:"flex", alignItems:"center", justifyContent:"center"
                            }}>
                                <FilterOutlined style={{ color:GOLD, fontSize:14 }} />
                            </div>
                            <div>
                                <Text style={{ fontWeight:700, fontSize:13, color:token.colorText, display:"block", lineHeight:"1.2" }}>Filter</Text>
                                {activeFilters > 0 && (
                                    <Badge count={activeFilters} style={{ backgroundColor:GOLD, fontSize:9 }} />
                                )}
                            </div>
                        </div>

                        {/* Period */}
                        <div style={{ minWidth:240 }}>
                            <span className="gl-filter-label" style={{ color:isDark?GOLD_LIGHT:GOLD_DARK }}>Periode</span>
                            <RangePicker
                                value={dateRange}
                                onChange={(d) => d && setDateRange(d as [dayjs.Dayjs, dayjs.Dayjs])}
                                allowClear={false}
                                format="DD MMM YYYY"
                                style={{ width:"100%", borderRadius:10, borderColor:G(.35) }}
                                suffixIcon={<CalendarOutlined style={{ color:GOLD }} />}
                                presets={[
                                    { label:"Bulan Ini",  value:[dayjs().startOf("month"), dayjs().endOf("month")]  },
                                    { label:"Bulan Lalu", value:[dayjs().subtract(1,"month").startOf("month"), dayjs().subtract(1,"month").endOf("month")] },
                                    { label:"7 Hari",     value:[dayjs().subtract(6,"day"), dayjs()] },
                                    { label:"30 Hari",    value:[dayjs().subtract(29,"day"), dayjs()] },
                                    { label:"Tahun Ini",  value:[dayjs().startOf("year"), dayjs().endOf("year")] },
                                ]}
                            />
                        </div>

                        {/* Filters grid */}
                        <div style={{ flex:1, display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(135px,1fr))", gap:10 }}>
                            <div>
                                <span className="gl-filter-label" style={{ color:isDark?GOLD_LIGHT:GOLD_DARK }}>Jenis</span>
                                <Select value={jenisFilter} onChange={setJenisFilter} style={{ width:"100%" }}
                                    options={[
                                        { label:"Semua Jenis",  value:"all"    },
                                        { label:"💹 Kas Masuk",  value:"masuk"  },
                                        { label:"💸 Kas Keluar", value:"keluar" },
                                    ]}
                                />
                            </div>
                            <div>
                                <span className="gl-filter-label" style={{ color:isDark?GOLD_LIGHT:GOLD_DARK }}>Status</span>
                                <Select value={statusFilter} onChange={setStatusFilter} style={{ width:"100%" }}
                                    options={[
                                        { label:"Semua Status",  value:"all"     },
                                        { label:"✅ Sukses",      value:"sukses"  },
                                        { label:"⏳ Pending",     value:"pending" },
                                        { label:"❌ Gagal",       value:"gagal"   },
                                    ]}
                                />
                            </div>
                            <div>
                                <span className="gl-filter-label" style={{ color:isDark?GOLD_LIGHT:GOLD_DARK }}>Metode</span>
                                <Select value={metodeFilter} onChange={setMetodeFilter} style={{ width:"100%" }}
                                    options={[
                                        { label:"Semua Metode",  value:"all"          },
                                        { label:"💵 Cash",        value:"cash"         },
                                        { label:"📱 QRIS",        value:"qris"         },
                                        { label:"🏦 Transfer",    value:"bank_transfer" },
                                        { label:"🌐 Midtrans",    value:"midtrans"     },
                                    ]}
                                />
                            </div>
                            <div>
                                <span className="gl-filter-label" style={{ color:isDark?GOLD_LIGHT:GOLD_DARK }}>Kategori</span>
                                <Select value={kategoriFilter} onChange={setKategoriFilter} style={{ width:"100%" }}
                                    options={[
                                        { label:"Semua Kategori", value:"all"      },
                                        { label:"📋 Tagihan",     value:"tagihan"  },
                                        { label:"❤️ Donasi",      value:"donasi"   },
                                    ]}
                                />
                            </div>
                            <div>
                                <span className="gl-filter-label" style={{ color:isDark?GOLD_LIGHT:GOLD_DARK }}>Gender</span>
                                <Select value={genderFilter} onChange={setGenderFilter} style={{ width:"100%" }}
                                    options={[
                                        { label:"Semua Gender", value:"all" },
                                        { label:"👦 Laki-laki",  value:"L"  },
                                        { label:"👧 Perempuan",  value:"P"  },
                                        { label:"🌐 Global",     value:"ALL"},
                                    ]}
                                />
                            </div>
                            <div>
                                <span className="gl-filter-label" style={{ color:isDark?GOLD_LIGHT:GOLD_DARK }}>Takhasus</span>
                                <Select value={jurusanFilter} onChange={setJurusanFilter} style={{ width:"100%" }}
                                    options={[
                                        { label:"Semua Takhasus", value:"all"     },
                                        { label:"📖 Tahfidz",     value:"TAHFIDZ" },
                                        { label:"📚 Kitab",       value:"KITAB"   },
                                        { label:"🌐 Global",      value:"ALL"    },
                                    ]}
                                />
                            </div>
                        </div>

                        {activeFilters > 0 && (
                            <Tooltip title="Reset semua filter">
                                <Button
                                    icon={<ClearOutlined />}
                                    onClick={resetFilters}
                                    style={{ borderRadius:10, borderColor:COLOR.danger.border, color:COLOR.danger.base, background:isDark?COLOR.danger.dark:COLOR.danger.light }}
                                >
                                    Reset
                                </Button>
                            </Tooltip>
                        )}
                    </div>
                </Card>
            </motion.div>

            {/* ╔══════════════════════════════════════════╗
                ║           PREMIUM DATA TABLE             ║
                ╚══════════════════════════════════════════╝ */}
            <motion.div
                initial={{ opacity:0, y:16 }}
                animate={{ opacity:1, y:0 }}
                transition={{ duration:.45, delay:.55 }}
            >
                <div style={{
                    borderRadius:16, overflow:"hidden",
                    border:`1px solid ${G(isDark?.2:.13)}`,
                    boxShadow: isDark
                        ? `0 10px 40px rgba(0,0,0,0.45), 0 0 0 1px ${G(.1)}`
                        : `0 8px 32px ${G(.1)}, 0 2px 8px rgba(0,0,0,0.04)`
                }}>
                    <ProTable<ITransaksiKeuangan>
                        {...tableProps}
                        dataSource={filteredData}
                        columns={columns}
                        rowKey="id"
                        search={false}
                        className="gl-table"
                        scroll={{ x:1280 }}
                        tableStyle={{ padding:0 }}

                        headerTitle={
                            <Space size={12}>
                                <div style={{
                                    width:38, height:38, borderRadius:11,
                                    background:`linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})`,
                                    display:"flex", alignItems:"center", justifyContent:"center",
                                    boxShadow:`0 4px 14px ${G(.42)}`
                                }}>
                                    <AuditOutlined style={{ color:"#fff", fontSize:17 }} />
                                </div>
                                <div>
                                    <div style={{ fontSize:15, fontWeight:700, color:token.colorText, fontFamily:"'Outfit',sans-serif" }}>
                                        Jurnal Transaksi
                                    </div>
                                    <div style={{ fontSize:10.5, color:GOLD, fontWeight:600, marginTop:1 }}>
                                        {filteredData.length} record · {dateRange[0].format("DD MMM")} – {dateRange[1].format("DD MMM YYYY")}
                                    </div>
                                </div>
                            </Space>
                        }

                        toolBarRender={() => [
                            <Button
                                key="export"
                                icon={<DownloadOutlined />}
                                loading={isExporting}
                                onClick={handleExportExcel}
                                style={{
                                    borderColor:`${COLOR.success.base}55`, color:COLOR.success.base,
                                    borderRadius:10, height:36, fontWeight:600, fontSize:12.5,
                                    background: isDark ? COLOR.success.dark : COLOR.success.light
                                }}
                            >
                                Export Excel
                            </Button>,
                            <Button
                                key="infaq"
                                icon={<HeartOutlined />}
                                onClick={() => create("transaksi_keuangan")}
                                style={{
                                    background:`linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})`,
                                    border:"none", borderRadius:10, height:36,
                                    fontWeight:700, fontSize:12.5, color:"#fff",
                                    boxShadow:`0 4px 14px ${G(.45)}`
                                }}
                            >
                                Input Infaq
                            </Button>
                        ]}

                        summary={() => (
                            <ProTable.Summary fixed="bottom">
                                <ProTable.Summary.Row style={{
                                    background: isDark ? G(.1) : "#FFFBF0"
                                }}>
                                    <ProTable.Summary.Cell index={0} colSpan={5}>
                                        <div style={{ display:"flex", alignItems:"center", gap:10, paddingLeft:8 }}>
                                            <SafetyCertificateOutlined style={{ color:GOLD, fontSize:14 }} />
                                            <Text style={{ fontWeight:800, fontSize:12.5, color:token.colorText }}>
                                                REKAPITULASI HALAMAN (TRANSAKSI SUKSES)
                                            </Text>
                                        </div>
                                    </ProTable.Summary.Cell>
                                    <ProTable.Summary.Cell index={5}>
                                        <div style={{ textAlign:"right", paddingRight:8 }}>
                                            <div className="gl-mono" style={{ fontWeight:900, fontSize:14, color:COLOR.success.base }}>
                                                +{fCurrency(pageSuccessMasuk)}
                                            </div>
                                            {pageSuccessKeluar > 0 && (
                                                <div className="gl-mono" style={{ fontWeight:700, fontSize:12, color:COLOR.danger.base }}>
                                                    −{fCurrency(pageSuccessKeluar)}
                                                </div>
                                            )}
                                        </div>
                                    </ProTable.Summary.Cell>
                                    <ProTable.Summary.Cell index={6} />
                                </ProTable.Summary.Row>
                            </ProTable.Summary>
                        )}

                        pagination={{
                            defaultPageSize:15,
                            showSizeChanger:true,
                            showTotal:(total, range) => (
                                <span style={{ fontSize:12, color:token.colorTextSecondary }}>
                                    Menampilkan{" "}
                                    <strong style={{ color:isDark?GOLD_LIGHT:GOLD_DARK }}>{range[0]}–{range[1]}</strong>
                                    {" "}dari{" "}
                                    <strong style={{ color:token.colorText }}>{total}</strong> transaksi
                                </span>
                            ),
                        }}

                        options={{
                            density: true,
                            fullScreen: true,
                            setting: true,
                            reload: true,
                        }}
                    />
                </div>
            </motion.div>
        </div>
    );
};
