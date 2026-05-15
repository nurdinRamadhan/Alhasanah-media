import React, { useState, useMemo } from "react";
import { useTable } from "@refinedev/antd";
import { logActivity } from "../../utility/logger";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import {
    Tag, Space, Button, Typography, Tooltip, Avatar, Modal, Form,
    Select, InputNumber, Input, message, DatePicker, Row, Col,
    Upload, Image, theme, Divider, ConfigProvider, Card
} from "antd";
import {
    PlusOutlined, DeleteOutlined, EditOutlined,
    ExportOutlined, UploadOutlined, FileTextOutlined,
    ShoppingCartOutlined, UserOutlined,
    CalendarOutlined, FilterOutlined, WalletOutlined,
    ArrowDownOutlined, FireOutlined, BarChartOutlined,
    CheckCircleOutlined, ClockCircleOutlined, CrownOutlined,
    FileExcelOutlined, FilePdfOutlined, PieChartOutlined,
    ThunderboltOutlined
} from "@ant-design/icons";
import { useNavigation, useDelete, useCreate, useUpdate, useGetIdentity } from "@refinedev/core";
import { useColorMode } from "../../contexts/color-mode";
import dayjs from "dayjs";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { supabaseClient } from "../../utility/supabaseClient";
import { IPengeluaran, IProfile } from "../../types";
import { formatHijri, formatMasehi } from "../../utility/dateHelper";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { motion, AnimatePresence } from "framer-motion";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
    ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";

const { Text, Title } = Typography;
const { useToken } = theme;

// ═══════════════════════════════════
// KATEGORI CONFIG
// ═══════════════════════════════════
const KATEGORI_LIST = ["OPERASIONAL", "DAPUR", "PEMBANGUNAN", "KEGIATAN", "LAINNYA"] as const;

const KATEGORI_META: Record<string, { color: string; antColor: string; icon: string }> = {
    OPERASIONAL:  { color: "#4EA8F8", antColor: "blue",   icon: "⚙️" },
    DAPUR:        { color: "#F09840", antColor: "orange",  icon: "🍽️" },
    PEMBANGUNAN:  { color: "#B07CF0", antColor: "purple",  icon: "🏗️" },
    KEGIATAN:     { color: "#3DC97A", antColor: "cyan",    icon: "🎯" },
    LAINNYA:      { color: "#D4AF37", antColor: "gold",    icon: "📋" },
};

const IDR = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

// ═══════════════════════════════════
// CUSTOM RECHARTS TOOLTIP
// ═══════════════════════════════════
const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: "var(--pgl-bg-card)",
            border: "1px solid var(--pgl-border-strong)",
            borderRadius: "12px",
            padding: "12px 16px",
            boxShadow: "var(--pgl-shadow-hover)",
            backdropFilter: "blur(8px)",
        }}>
            <div style={{ 
                fontSize: "10px", 
                fontWeight: 800, 
                color: "var(--pgl-text-muted)", 
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "4px"
            }}>{label}</div>
            <div style={{ 
                fontSize: "14px", 
                fontWeight: 800, 
                color: "var(--pgl-gold-bright)",
                fontFamily: "'DM Mono', monospace"
            }}>{IDR(payload[0].value)}</div>
        </div>
    );
};

// ═══════════════════════════════════
// STAT CARD
// ═══════════════════════════════════
interface StatCardProps {
    title: string; arabic?: string; value: string;
    sub?: string; icon: React.ReactNode; accent: string;
    delay?: number;
}
const StatCard: React.FC<StatCardProps> = ({ title, arabic, value, sub, icon, accent, delay = 0 }) => (
    <motion.div
        className="pgl-stat-card"
        style={{ "--pgl-accent": accent } as any}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, type: "spring", stiffness: 300, damping: 28 }}
        whileHover={{ y: -3 }}
    >
        <div className="pgl-stat-icon-wrap">{icon}</div>
        <div className="pgl-stat-body">
            <div className="pgl-stat-title">{title}</div>
            {arabic && <div className="pgl-stat-arabic">{arabic}</div>}
            <div className="pgl-stat-value">{value}</div>
            {sub && <div className="pgl-stat-sub">{sub}</div>}
        </div>
        <div className="pgl-stat-bar" />
    </motion.div>
);

// ═══════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════
export const PengeluaranList = () => {
    const { token } = useToken();
    const { data: user } = useGetIdentity<IProfile>();
    const { mutate: createMutate } = useCreate();
    const { mutate: updateMutate } = useUpdate();
    const { mutate: deleteMutate } = useDelete();

    const { mode } = useColorMode();
    const isDark = mode === "dark";

    // ── Gold Shell System (Mirrored from Kesehatan) ──────────
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

    // ── Stat Card Component (Premium Style) ──────────────────
    const PremiumStatCard = ({ title, arabic, value, sub, icon, accent, delay = 0 }: StatCardProps) => (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.5 }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            style={{ height: "100%" }}
        >
            <Card
                bordered={false}
                bodyStyle={{ padding: "20px" }}
                style={{
                    background: token.colorBgContainer,
                    borderRadius: 16,
                    height: "100%",
                    boxShadow: G.shadow,
                    border: G.cardBorder,
                    position: "relative",
                    overflow: "hidden"
                }}
            >
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${accent}, transparent)` }} />
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.2px", textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 8 }}>
                            {title}
                        </div>
                        <div style={{ fontSize: 26, fontWeight: 900, color: token.colorText, letterSpacing: "-1px", lineHeight: 1.2 }}>
                            {value}
                        </div>
                        {arabic && <div style={{ fontSize: 11, color: G.text, direction: "rtl", marginTop: 4, fontWeight: 600 }}>{arabic}</div>}
                        {sub && <div style={{ fontSize: 11, color: token.colorTextSecondary, marginTop: 8, fontWeight: 500 }}>{sub}</div>}
                    </div>
                    
                    <div style={{ 
                        width: 44, height: 44, borderRadius: 12, 
                        background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                        border: G.cardBorder,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 20, color: accent,
                        boxShadow: `0 4px 12px ${accent}20`
                    }}>
                        {icon}
                    </div>
                </div>
            </Card>
        </motion.div>
    );

    // ── States ────────────────────────────────────────────────
    const [filterMonth,    setFilterMonth]    = useState<dayjs.Dayjs>(dayjs());
    const [filterKategori, setFilterKategori] = useState<string | null>(null);
    const [isModalOpen,    setIsModalOpen]    = useState(false);
    const [modalMode,      setModalMode]      = useState<"CREATE" | "EDIT">("CREATE");
    const [editingItem,    setEditingItem]    = useState<IPengeluaran | null>(null);
    const [form]                              = Form.useForm();
    const [uploading,      setUploading]      = useState(false);
    const [buktiUrl,       setBuktiUrl]       = useState<string | null>(null);
    const [deleteConfirm,  setDeleteConfirm]  = useState<number | null>(null);

    // ── Table Data ────────────────────────────────────────────
    const { tableProps, tableQueryResult } = useTable<IPengeluaran>({
        resource: "pengeluaran",
        syncWithLocation: false,
        filters: {
            permanent: [
                { field: "tanggal_pengeluaran", operator: "gte", value: filterMonth.startOf("month").format("YYYY-MM-DD") },
                { field: "tanggal_pengeluaran", operator: "lte", value: filterMonth.endOf("month").format("YYYY-MM-DD") }
            ]
        },
        sorters: { initial: [{ field: "tanggal_pengeluaran", order: "desc" }] }
    });

    const filteredData = (tableQueryResult?.data?.data ?? []).filter(item =>
        !filterKategori || item.kategori === filterKategori
    );

    const finalTableProps = {
        ...tableProps,
        dataSource: filteredData,
        pagination: { ...tableProps.pagination, total: filteredData.length, pageSize: 10 }
    };

    // ── Statistik ─────────────────────────────────────────────
    const totalBulanIni  = filteredData.reduce((a, c) => a + Number(c.nominal), 0);
    const totalHariIni   = filteredData.filter(i => dayjs(i.tanggal_pengeluaran).isSame(dayjs(), "day")).reduce((a, c) => a + Number(c.nominal), 0);
    const jumlahTransaksi = filteredData.length;
    const rataPerTransaksi = jumlahTransaksi > 0 ? totalBulanIni / jumlahTransaksi : 0;
    const transaksiTerbesar = filteredData.reduce((max, c) => Number(c.nominal) > max ? Number(c.nominal) : max, 0);

    // ── Chart Data ────────────────────────────────────────────
    const dailyChartData = useMemo(() => {
        const map: Record<string, number> = {};
        filteredData.forEach(d => {
            const key = dayjs(d.tanggal_pengeluaran).format("DD");
            map[key] = (map[key] || 0) + Number(d.nominal);
        });
        return Object.entries(map)
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([day, total]) => ({ day: `${day}/${filterMonth.format("MM")}`, total }));
    }, [filteredData, filterMonth]);

    const pieChartData = useMemo(() => {
        const map: Record<string, number> = {};
        filteredData.forEach(d => {
            map[d.kategori as string] = (map[d.kategori as string] || 0) + Number(d.nominal);
        });
        return Object.entries(map).map(([name, value]) => ({ name, value }));
    }, [filteredData]);

    // ── Handlers ──────────────────────────────────────────────
    const handleOpenCreate = () => {
        setModalMode("CREATE"); setEditingItem(null); setBuktiUrl(null);
        form.resetFields();
        form.setFieldsValue({ tanggal_pengeluaran: dayjs(), kategori: "OPERASIONAL", dicatat_oleh_nama: user?.full_name || user?.email });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (record: IPengeluaran) => {
        setModalMode("EDIT"); setEditingItem(record); setBuktiUrl(record.bukti_url ?? null);
        form.setFieldsValue({ ...record, tanggal_pengeluaran: dayjs(record.tanggal_pengeluaran) });
        setIsModalOpen(true);
    };

    const handleUpload = async (options: any) => {
        const { file, onSuccess, onError } = options;
        const fileExt = file.name.split(".").pop();
        const fileName = `nota-${Date.now()}.${fileExt}`;
        setUploading(true);
        try {
            const { error } = await supabaseClient.storage.from("pengeluaran-bukti").upload(fileName, file);
            if (error) throw error;
            const { data } = supabaseClient.storage.from("pengeluaran-bukti").getPublicUrl(fileName);
            setBuktiUrl(data.publicUrl);
            onSuccess("Ok");
            message.success("Bukti berhasil diupload");
        } catch (err: any) {
            message.error("Gagal upload: " + err.message);
            onError({ error: err });
        } finally { setUploading(false); }
    };

    const handleSubmit = async (values: any) => {
        const payload = {
            ...values,
            nominal: Number(values.nominal),
            tanggal_pengeluaran: values.tanggal_pengeluaran ? dayjs(values.tanggal_pengeluaran).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"),
            bukti_url: buktiUrl || null,
            ...(modalMode === "CREATE" && { dicatat_oleh_id: user?.id, dicatat_oleh_nama: user?.full_name || user?.email })
        };
        try {
            if (modalMode === "CREATE") {
                // 1. Catat ke Tabel Pengeluaran
                await createMutate({ resource: "pengeluaran", values: payload });

                // 2. Catat ke Jurnal Umum (Transaksi Keuangan)
                await createMutate({
                    resource: "transaksi_keuangan",
                    values: {
                        jumlah: payload.nominal,
                        tanggal_transaksi: payload.tanggal_pengeluaran + "T12:00:00Z", // Gunakan jam tengah hari agar aman di timezone
                        status_transaksi: "settlement",
                        metode_pembayaran: "cash", // Pengeluaran diasumsikan cash/transfer manual
                        jenis_transaksi: "keluar",
                        admin_pencatat_id: user?.id,
                        keterangan: `[PENGELUARAN] ${payload.judul}: ${payload.keterangan || ""}`
                    }
                });

                logActivity({ user, action: "CREATE", resource: "pengeluaran", record_id: "-", details: { judul: String(payload.judul), nominal: Number(payload.nominal), kategori: String(payload.kategori) } });
                message.success("Pengeluaran berhasil dicatat");
            } else {
                await updateMutate({ resource: "pengeluaran", id: editingItem!.id, values: payload });
                logActivity({ user, action: "UPDATE", resource: "pengeluaran", record_id: String(editingItem!.id), details: { judul_baru: String(payload.judul), nominal_baru: Number(payload.nominal) } });
                message.success("Data berhasil diperbarui");
            }
            setIsModalOpen(false);
            tableQueryResult.refetch();
        } catch (err) { console.error(err); message.error("Terjadi kesalahan"); }
    };

    const handleDelete = (id: number) => {
        deleteMutate({ resource: "pengeluaran", id });
        setDeleteConfirm(null);
        message.success("Data dihapus");
    };

    // ── Export Excel (Enhanced Professional) ─────────────────
    const handleExportExcel = async () => {
        const instansi = {
            nama: "PONDOK PESANTREN AL-HASANAH",
            alamat: "Jl. Raya Cibeuti No.13, Cibeuti, Kec. Kawalu, Tasikmalaya, Jawa Barat 46182",
            kontak: "Telp: 0812-XXXX-XXXX | Email: info@alhasanah.com",
        };

        const workbook = new ExcelJS.Workbook();
        workbook.creator = "Al-Hasanah Management System";
        workbook.created = new Date();

        const ws = workbook.addWorksheet("Laporan Kas Keluar", {
            pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 }
        });

        // ── KOP SURAT ──────────────────────────────────────────
        ws.mergeCells("A1:H1");
        ws.getCell("A1").value = instansi.nama;
        ws.getCell("A1").font = { name: "Calibri", size: 18, bold: true, color: { argb: "FF92400E" } };
        ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
        ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF8E7" } };
        ws.getRow(1).height = 32;

        ws.mergeCells("A2:H2");
        ws.getCell("A2").value = instansi.alamat;
        ws.getCell("A2").font = { name: "Calibri", size: 9, color: { argb: "FF78716C" } };
        ws.getCell("A2").alignment = { horizontal: "center" };
        ws.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF8E7" } };

        ws.mergeCells("A3:H3");
        ws.getCell("A3").value = instansi.kontak;
        ws.getCell("A3").font = { name: "Calibri", size: 9, color: { argb: "FF78716C" } };
        ws.getCell("A3").alignment = { horizontal: "center" };
        ws.getCell("A3").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF8E7" } };

        // ── GARIS PEMISAH ──────────────────────────────────────
        ws.mergeCells("A4:H4");
        ws.getCell("A4").border = { bottom: { style: "medium", color: { argb: "FFB45309" } } };
        ws.getRow(4).height = 6;

        // ── JUDUL LAPORAN ──────────────────────────────────────
        ws.mergeCells("A5:H5");
        ws.getCell("A5").value = `REKAPITULASI KAS KELUAR — ${filterMonth.format("MMMM YYYY").toUpperCase()}`;
        ws.getCell("A5").font = { name: "Calibri", size: 13, bold: true, color: { argb: "FF1C1917" } };
        ws.getCell("A5").alignment = { horizontal: "center", vertical: "middle" };
        ws.getRow(5).height = 24;

        // ── RANGKUMAN STATISTIK ────────────────────────────────
        ws.addRow([]);
        const summaryRow1 = ws.addRow([
            "Total Pengeluaran", "", IDR(totalBulanIni),
            "", "Jumlah Transaksi", "", String(jumlahTransaksi) + " transaksi", ""
        ]);
        summaryRow1.getCell(1).font = { bold: true, color: { argb: "FF92400E" } };
        summaryRow1.getCell(3).font = { bold: true, size: 12, color: { argb: "FFDC2626" } };
        summaryRow1.getCell(5).font = { bold: true, color: { argb: "FF92400E" } };
        summaryRow1.getCell(7).font = { bold: true, size: 12, color: { argb: "FF1D4ED8" } };

        const summaryRow2 = ws.addRow([
            "Rata-rata/Transaksi", "", IDR(rataPerTransaksi),
            "", "Transaksi Terbesar", "", IDR(transaksiTerbesar), ""
        ]);
        summaryRow2.getCell(1).font = { bold: true, color: { argb: "FF92400E" } };
        summaryRow2.getCell(3).font = { bold: true, color: { argb: "FF78716C" } };
        summaryRow2.getCell(5).font = { bold: true, color: { argb: "FF92400E" } };
        summaryRow2.getCell(7).font = { bold: true, color: { argb: "FF78716C" } };
        ws.addRow([]);

        // ── REKAPITULASI PER KATEGORI ──────────────────────────
        const katMap: Record<string, number> = {};
        filteredData.forEach(d => { katMap[d.kategori as string] = (katMap[d.kategori as string] || 0) + Number(d.nominal); });
        const katSummaryRow = ws.addRow(["KATEGORI", "", "TOTAL", "", "% DARI KESELURUHAN", "", "", ""]);
        katSummaryRow.eachCell(cell => { cell.font = { bold: true, color: { argb: "FFFFFFFF" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB45309" } }; });
        Object.entries(katMap).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
            const pct = totalBulanIni > 0 ? ((v / totalBulanIni) * 100).toFixed(1) + "%" : "0%";
            const r   = ws.addRow([k, "", IDR(v), "", pct, "", "", ""]);
            r.getCell(1).font = { bold: true };
            r.getCell(3).font = { color: { argb: "FFDC2626" } };
        });
        ws.addRow([]);

        // ── HEADER TABEL UTAMA ─────────────────────────────────
        const headerRow = ws.addRow(["NO", "TANGGAL (M)", "TANGGAL (H)", "JUDUL PENGELUARAN", "KATEGORI", "NOMINAL (Rp)", "PENCATAT", "KETERANGAN"]);
        headerRow.height = 22;
        headerRow.eachCell((cell) => {
            cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB45309" } };
            cell.font   = { name: "Calibri", size: 10, color: { argb: "FFFFFFFF" }, bold: true };
            cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
            cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "medium" }, right: { style: "thin" } };
        });

        // ── DATA ROWS ──────────────────────────────────────────
        filteredData.forEach((item, idx) => {
            const row = ws.addRow([
                idx + 1,
                dayjs(item.tanggal_pengeluaran).format("DD/MM/YYYY"),
                formatHijri(item.tanggal_pengeluaran),
                item.judul?.toUpperCase(),
                item.kategori,
                Number(item.nominal),
                item.dicatat_oleh_nama,
                item.keterangan || "-"
            ]);
            const isEven = idx % 2 !== 0;
            row.eachCell((cell) => {
                if (isEven) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF8E7" } };
                cell.border = { top: { style: "thin", color: { argb: "FFE7E5E4" } }, left: { style: "thin", color: { argb: "FFE7E5E4" } }, bottom: { style: "thin", color: { argb: "FFE7E5E4" } }, right: { style: "thin", color: { argb: "FFE7E5E4" } } };
            });
            row.getCell(1).alignment = { horizontal: "center" };
            row.getCell(2).alignment = { horizontal: "center" };
            row.getCell(3).alignment = { horizontal: "center" };
            row.getCell(6).numFmt    = "#,##0";
            row.getCell(6).alignment = { horizontal: "right" };
            row.getCell(6).font      = { bold: true, color: { argb: "FFDC2626" } };
        });

        // ── BARIS TOTAL ────────────────────────────────────────
        const totalRow = ws.addRow(["", "", "", "TOTAL KESELURUHAN", "", totalBulanIni, "", ""]);
        totalRow.height = 20;
        totalRow.eachCell((cell) => {
            cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3C4" } };
            cell.font   = { bold: true, size: 11, color: { argb: "FF92400E" } };
            cell.border = { top: { style: "medium" }, bottom: { style: "medium" } };
        });
        totalRow.getCell(4).alignment = { horizontal: "center" };
        totalRow.getCell(6).numFmt    = "#,##0";
        totalRow.getCell(6).font      = { bold: true, size: 12, color: { argb: "FFDC2626" } };
        totalRow.getCell(6).alignment = { horizontal: "right" };

        // ── FOOTER ─────────────────────────────────────────────
        ws.addRow([]);
        const footerRow = ws.addRow(["", "", "", "", "", "", `Dicetak: ${dayjs().format("DD/MM/YYYY HH:mm")}`, ""]);
        footerRow.getCell(7).font = { italic: true, color: { argb: "FF78716C" } };

        // ── COLUMN WIDTHS & FILTER ─────────────────────────────
        ws.autoFilter    = `A${headerRow.number}:H${headerRow.number}`;
        ws.views         = [{ state: "frozen", ySplit: headerRow.number }];
        [6, 14, 16, 38, 16, 20, 20, 38].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

        // ── SECOND SHEET: CHART DATA ───────────────────────────
        const wsChart = workbook.addWorksheet("Distribusi Kategori");
        wsChart.mergeCells("A1:C1");
        wsChart.getCell("A1").value = "DISTRIBUSI PENGELUARAN PER KATEGORI";
        wsChart.getCell("A1").font  = { bold: true, size: 13 };
        wsChart.addRow(["KATEGORI", "TOTAL (Rp)", "PERSENTASE"]);
        wsChart.getRow(2).font = { bold: true };
        Object.entries(katMap).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
            wsChart.addRow([k, v, totalBulanIni > 0 ? ((v / totalBulanIni) * 100).toFixed(2) + "%" : "0%"]);
        });
        wsChart.getColumn(2).numFmt = "#,##0";
        wsChart.getColumn(1).width  = 20;
        wsChart.getColumn(2).width  = 22;
        wsChart.getColumn(3).width  = 18;

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Laporan_Pengeluaran_${filterMonth.format("YYYY_MM")}.xlsx`);
        message.success("✅ Laporan Excel berhasil diunduh");
    };

    // ── Export PDF ────────────────────────────────────────────
    const handleExportPdf = () => {
        const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
        doc.setFillColor(180, 83, 9);
        doc.rect(0, 0, 210, 40, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.setTextColor(255, 255, 255);
        doc.text("AL-HASANAH", 105, 17, { align: "center" });
        doc.setFontSize(9); doc.setFont("helvetica", "normal");
        doc.text("BUKTI KAS KELUAR — OFFICIAL VOUCHER", 105, 25, { align: "center" });
        doc.text(`Periode: ${filterMonth.format("MMMM YYYY")}`, 105, 31, { align: "center" });

        let y = 50;
        doc.setTextColor(0, 0, 0); doc.setFontSize(14); doc.setFont("helvetica", "bold");
        doc.text("REKAPITULASI PENGELUARAN BULANAN", 15, y); y += 8;
        doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 100);
        doc.text(`Total: ${IDR(totalBulanIni)} · ${jumlahTransaksi} Transaksi`, 15, y); y += 8;

        autoTable(doc, {
            startY: y,
            head: [["TANGGAL", "JUDUL PENGELUARAN", "KATEGORI", "NOMINAL"]],
            body: filteredData.map(i => [
                dayjs(i.tanggal_pengeluaran).format("DD/MM/YYYY"),
                i.judul,
                i.kategori,
                IDR(Number(i.nominal))
            ]),
            theme: "striped",
            headStyles: { fillColor: [180, 83, 9], textColor: 255, fontStyle: "bold", fontSize: 9 },
            styles: { fontSize: 8, cellPadding: 3 },
            alternateRowStyles: { fillColor: [255, 248, 231] },
            foot: [["", "", "TOTAL", IDR(totalBulanIni)]],
            footStyles: { fillColor: [255, 243, 196], textColor: [146, 64, 14], fontStyle: "bold", fontSize: 10 }
        });
        doc.save(`Voucher_Pengeluaran_${filterMonth.format("MMMM_YYYY")}.pdf`);
        message.success("✅ PDF berhasil diunduh");
    };

    // ── Columns ───────────────────────────────────────────────
    const columns: ProColumns<IPengeluaran>[] = [
        {
            title: "Tanggal", dataIndex: "tanggal_pengeluaran", width: 120,
            render: (val) => (
                <div className="pgl-date-cell">
                    <div className="pgl-date-main">{dayjs(val as string).format("DD MMM YYYY")}</div>
                    <div className="pgl-date-sub">{formatHijri(val as string)}</div>
                </div>
            ),
            sorter: (a, b) => dayjs(a.tanggal_pengeluaran).unix() - dayjs(b.tanggal_pengeluaran).unix()
        },
        {
            title: "Detail Pengeluaran", dataIndex: "judul",
            render: (_, r) => (
                <div className="pgl-detail-cell">
                    <Text strong className="pgl-detail-title">{r.judul}</Text>
                    {r.keterangan && <Text type="secondary" className="pgl-detail-sub">{r.keterangan}</Text>}
                </div>
            )
        },
        {
            title: "Kategori", dataIndex: "kategori", width: 140,
            render: (val: any) => {
                const meta = KATEGORI_META[val as string] || { color: "#999", antColor: "default", icon: "📌" };
                return (
                    <div className="pgl-kategori-badge" style={{ "--kat-color": meta.color } as any}>
                        <span>{meta.icon}</span>
                        <span>{String(val || "-")}</span>
                    </div>
                );
            }
        },
        {
            title: "Nominal", dataIndex: "nominal", width: 165, align: "right",
            render: (val) => (
                <div className="pgl-nominal-cell">
                    <ArrowDownOutlined className="pgl-nominal-icon" />
                    <span className="pgl-nominal-value">{IDR(Number(val) || 0)}</span>
                </div>
            ),
            sorter: (a, b) => Number(a.nominal) - Number(b.nominal)
        },
        {
            title: "Bukti", dataIndex: "bukti_url", width: 72, align: "center",
            render: (val) => typeof val === "string" && val ? (
                <Image src={val} width={36} height={36} style={{ borderRadius: 8, objectFit: "cover", border: "1px solid var(--pgl-border)" }} />
            ) : <span className="pgl-no-bukti">—</span>
        },
        {
            title: "Pencatat", dataIndex: "dicatat_oleh_nama", width: 140,
            render: (val) => (
                <div className="pgl-pencatat-cell">
                    <Avatar size={28} className="pgl-pencatat-avatar">
                        {typeof val === "string" && val.length > 0 ? val[0].toUpperCase() : <UserOutlined />}
                    </Avatar>
                    <span className="pgl-pencatat-name">{typeof val === "string" ? val.split(" ")[0] : "-"}</span>
                </div>
            )
        },
        {
            title: "Aksi", valueType: "option", width: 90, align: "center",
            render: (_, record) => (
                <Space size={2}>
                    <Tooltip title="Edit Data">
                        <Button size="small" type="text" className="pgl-action-btn pgl-edit-btn" icon={<EditOutlined />} onClick={() => handleOpenEdit(record)} />
                    </Tooltip>
                    <Tooltip title="Hapus Data">
                        <Button size="small" type="text" danger className="pgl-action-btn" icon={<DeleteOutlined />}
                            onClick={() => setDeleteConfirm(record.id as number)} />
                    </Tooltip>
                </Space>
            )
        }
    ];

    // ══════════════════════════════════════════════════════════
    // RENDER
    // ══════════════════════════════════════════════════════════
    return (
        <div className={`pgl-root ${isDark ? "pgl-dark" : "pgl-light"}`} style={{ padding: "0 4px" }}>

            {/* ════ PAGE HEADER (Kesehatan Style) ════ */}
            <div style={{
                padding: "20px 24px",
                background: token.colorBgContainer,
                borderRadius: 16, boxShadow: G.shadow, border: G.cardBorder,
                position: "relative", overflow: "hidden",
                display: "flex", alignItems: "center",
                justifyContent: "space-between", flexWrap: "wrap", gap: 14,
                marginBottom: 20
            }}>
                <div style={{
                    position: "absolute", left: 0, top: 0, bottom: 0, width: 4,
                    background: G.gradient, borderRadius: "16px 0 0 16px",
                }} />
                
                <div style={{ display: "flex", alignItems: "center", gap: 14, paddingLeft: 10 }}>
                    <div style={{
                        width: 50, height: 50, borderRadius: 13,
                        background: G.gradient,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 22, color: "#fff",
                        boxShadow: "0 6px 20px rgba(180,83,9,0.38)",
                    }}>
                        <WalletOutlined />
                    </div>
                    <div>
                        <div style={{
                            fontSize: 20, fontWeight: 900, color: token.colorText,
                            letterSpacing: "-0.5px", lineHeight: 1.2,
                        }}>
                            Manajemen Kas Keluar
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 11, color: token.colorTextSecondary }}>
                                Pencatatan & Monitoring Pengeluaran
                            </span>
                            <span style={{
                                fontSize: 10, padding: "2px 9px", borderRadius: 20,
                                background: G.bg, border: `1px solid ${G.border}`,
                                color: G.text, fontWeight: 800,
                            }}>
                                ✦ {filterMonth.format("MMMM YYYY")}
                            </span>
                        </div>
                    </div>
                </div>

                <Space size={8}>
                    <Button 
                        icon={<FilePdfOutlined />} 
                        onClick={handleExportPdf}
                        style={{ border: G.cardBorder, borderRadius: 9, height: 38, color: token.colorTextSecondary }}
                    >
                        PDF
                    </Button>
                    <Button 
                        icon={<FileExcelOutlined />} 
                        onClick={handleExportExcel}
                        style={{ border: G.cardBorder, borderRadius: 9, height: 38, color: token.colorTextSecondary }}
                    >
                        Excel
                    </Button>
                    <Button 
                        type="primary"
                        icon={<PlusOutlined />} 
                        onClick={handleOpenCreate}
                        style={{
                            background: G.gradient,
                            border: "none", borderRadius: 9, fontWeight: 700, height: 38,
                            boxShadow: "0 4px 14px rgba(180,83,9,0.35)",
                        }}
                    >
                        Catat Pengeluaran
                    </Button>
                </Space>
            </div>

            {/* ════ STAT CARDS (Premium) ════ */}
            <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                <Col xs={24} sm={12} xl={6}>
                    <PremiumStatCard title="Total Keluar" arabic="إجمالي المصروفات" value={IDR(totalBulanIni)}
                        sub={filterMonth.format("MMMM YYYY")}
                        icon={<WalletOutlined />} accent="#E8685A" delay={0} />
                </Col>
                <Col xs={24} sm={12} xl={6}>
                    <PremiumStatCard title="Keluar Hari Ini" arabic="مصروف اليوم" value={IDR(totalHariIni)}
                        sub={dayjs().format("dddd, DD MMM")}
                        icon={<ClockCircleOutlined />} accent="#F09840" delay={0.06} />
                </Col>
                <Col xs={24} sm={12} xl={6}>
                    <PremiumStatCard title="Jumlah Transaksi" arabic="عدد المعاملات" value={`${jumlahTransaksi} Trp`}
                        sub={`Rata-rata ${IDR(rataPerTransaksi)}/trx`}
                        icon={<BarChartOutlined />} accent="#4EA8F8" delay={0.12} />
                </Col>
                <Col xs={24} sm={12} xl={6}>
                    <PremiumStatCard title="Terbesar" arabic="أكبر مبلغ" value={IDR(transaksiTerbesar)}
                        sub="Transaksi terbesar bulan ini"
                        icon={<FireOutlined />} accent="#B07CF0" delay={0.18} />
                </Col>
            </Row>

            {/* ════ CHARTS ROW (Executive Style) ════ */}
            <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                {/* Tren Harian */}
                <Col xs={24} xl={15}>
                    <motion.div
                        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
                        style={{ height: "100%" }}
                    >
                        <Card
                            bordered={false}
                            bodyStyle={{ padding: "20px" }}
                            style={{
                                background: token.colorBgContainer, borderRadius: 16,
                                boxShadow: G.shadow, border: G.cardBorder,
                                position: "relative", overflow: "hidden", height: "100%"
                            }}
                        >
                            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: G.gradient }} />
                            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
                                <div style={{
                                    width: 30, height: 30, borderRadius: 8,
                                    background: G.bg, border: `1px solid ${G.border}`,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 14, color: G.text,
                                }}>
                                    <BarChartOutlined />
                                </div>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: "var(--pgl-text-primary)" }}>
                                        Tren Pengeluaran Harian
                                    </div>
                                    <div style={{ fontSize: 10, color: "var(--pgl-text-secondary)" }}>
                                        تحليل الإنفاق اليومي · {filterMonth.format("MMMM YYYY")}
                                    </div>
                                </div>
                            </div>
                            
                            <div style={{ height: 260 }}>
                                {dailyChartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={dailyChartData} barSize={24} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="pglBarGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%"   stopColor="var(--pgl-gold-bright)" stopOpacity={1} />
                                                    <stop offset="100%" stopColor="var(--pgl-gold)"        stopOpacity={0.8} />
                                                </linearGradient>
                                                <filter id="barShadow" x="-20%" y="-20%" width="140%" height="140%">
                                                    <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" />
                                                    <feOffset dx="0" dy="2" result="offsetblur" />
                                                    <feComponentTransfer>
                                                        <feFuncA type="linear" slope="0.2" />
                                                    </feComponentTransfer>
                                                    <feMerge>
                                                        <feMergeNode />
                                                        <feMergeNode in="SourceGraphic" />
                                                    </feMerge>
                                                </filter>
                                            </defs>
                                            <CartesianGrid 
                                                strokeDasharray="4 4" 
                                                stroke="var(--pgl-border)" 
                                                vertical={false} 
                                                opacity={isDark ? 0.3 : 0.6}
                                            />
                                            <XAxis 
                                                dataKey="day" 
                                                tick={{ fill: "var(--pgl-text-primary)", fontSize: 11, fontWeight: 600, fontFamily: "'DM Mono', monospace" }} 
                                                axisLine={{ stroke: "var(--pgl-border-strong)", strokeWidth: 1 }} 
                                                tickLine={false}
                                                dy={10}
                                            />
                                            <YAxis 
                                                tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}jt` : `${v / 1000}rb`} 
                                                tick={{ fill: "var(--pgl-text-primary)", fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono', monospace" }} 
                                                axisLine={{ stroke: "var(--pgl-border-strong)", strokeWidth: 1 }} 
                                                tickLine={false}
                                                width={65}
                                            />
                                            <ReTooltip 
                                                content={<CustomBarTooltip />} 
                                                cursor={{ fill: "var(--pgl-gold-bg)", opacity: 0.4 }} 
                                                animationDuration={300}
                                            />
                                            <Bar 
                                                dataKey="total" 
                                                fill="url(#pglBarGrad)" 
                                                radius={[6, 6, 2, 2]}
                                                filter="url(#barShadow)"
                                                animationBegin={300}
                                                animationDuration={1200}
                                                animationEasing="ease-out"
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="pgl-chart-empty">
                                        <BarChartOutlined style={{ fontSize: 32, opacity: 0.2, marginBottom: 8 }} />
                                        <div>Belum ada data pengeluaran untuk periode ini</div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </motion.div>
                </Col>

                {/* Distribusi Kategori */}
                <Col xs={24} xl={9}>
                    <motion.div
                        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
                        style={{ height: "100%" }}
                    >
                        <Card
                            bordered={false}
                            bodyStyle={{ padding: "20px" }}
                            style={{
                                background: token.colorBgContainer, borderRadius: 16,
                                boxShadow: G.shadow, border: G.cardBorder,
                                position: "relative", overflow: "hidden", height: "100%"
                            }}
                        >
                            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: G.gradient }} />
                            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
                                <div style={{
                                    width: 30, height: 30, borderRadius: 8,
                                    background: G.bg, border: `1px solid ${G.border}`,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 14, color: G.text,
                                }}>
                                    <PieChartOutlined />
                                </div>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: "var(--pgl-text-primary)" }}>
                                        Distribusi Kategori
                                    </div>
                                    <div style={{ fontSize: 10, color: "var(--pgl-text-secondary)" }}>
                                        توزيع الإنفاق حسب الفئة
                                    </div>
                                </div>
                            </div>
                            {pieChartData.length > 0 ? (
                                <div style={{ height: 220 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={pieChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                                                paddingAngle={3} dataKey="value">
                                                {pieChartData.map((entry, i) => (
                                                    <Cell key={i} fill={KATEGORI_META[entry.name]?.color ?? "#999"} opacity={0.9} />
                                                ))}
                                            </Pie>
                                            <ReTooltip formatter={(v: any) => IDR(Number(v))} contentStyle={{ borderRadius: 12, border: "1px solid var(--pgl-border-strong)", background: "var(--pgl-bg-card)", color: "var(--pgl-text-primary)", fontSize: 12, boxShadow: "var(--pgl-shadow)" }} />
                                            <Legend iconType="circle" iconSize={9}
                                                formatter={(val) => <span style={{ color: "var(--pgl-text-secondary)", fontSize: 11, fontWeight: 600 }}>{val}</span>} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="pgl-chart-empty">Belum ada data</div>
                            )}
                        </Card>
                    </motion.div>
                </Col>
            </Row>

            {/* ════ FILTER BAR (Kesehatan Style) ════ */}
            <Card
                bordered={false}
                bodyStyle={{ padding: "18px 20px" }}
                style={{
                    background: token.colorBgContainer, borderRadius: 16,
                    boxShadow: G.shadow, border: G.cardBorder,
                    position: "relative", overflow: "hidden",
                    marginBottom: 16
                }}
            >
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: G.gradient }} />

                <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16,
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
                            Filter & Periode
                        </span>
                        {(filterKategori || !filterMonth.isSame(dayjs(), "month")) && (
                            <span style={{
                                fontSize: 10, padding: "2px 9px", borderRadius: 10,
                                background: G.bg, border: `1px solid ${G.border}`,
                                color: G.text, fontWeight: 800,
                            }}>
                                Aktif
                            </span>
                        )}
                    </div>
                    {(filterKategori || !filterMonth.isSame(dayjs(), "month")) && (
                        <Button
                            size="small" 
                            onClick={() => { setFilterKategori(null); setFilterMonth(dayjs()); }}
                            style={{
                                fontSize: 11, height: 26, borderRadius: 6,
                                border: `1px solid ${G.border}`, color: token.colorTextSecondary,
                            }}
                        >
                            Reset Filter
                        </Button>
                    )}
                </div>

                <Row gutter={[12, 12]} align="bottom">
                    <Col xs={24} sm={8} lg={6}>
                        <div style={{
                            fontSize: 9, fontWeight: 800, letterSpacing: "1px",
                            textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 5,
                        }}>
                            Pilih Bulan
                        </div>
                        <DatePicker.MonthPicker
                            value={filterMonth}
                            onChange={val => setFilterMonth(val || dayjs())}
                            allowClear={false}
                            style={{ width: "100%" }}
                            className="pgl-datepicker"
                            suffixIcon={<CalendarOutlined style={{ color: G.text }} />}
                        />
                    </Col>
                    <Col xs={24} sm={8} lg={6}>
                        <div style={{
                            fontSize: 9, fontWeight: 800, letterSpacing: "1px",
                            textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 5,
                        }}>
                            Kategori
                        </div>
                        <Select
                            placeholder="Semua Kategori"
                            allowClear
                            style={{ width: "100%" }}
                            className="pgl-select"
                            options={KATEGORI_LIST.map(k => ({
                                label: <span>{KATEGORI_META[k]?.icon} {k}</span>,
                                value: k
                            }))}
                            onChange={setFilterKategori}
                            value={filterKategori}
                        />
                    </Col>
                    <Col xs={24} sm={8} lg={12} style={{ textAlign: "right" }}>
                        <div style={{
                            fontSize: 11, fontWeight: 600, color: token.colorTextSecondary,
                            background: G.bg, padding: "8px 14px", borderRadius: 10,
                            display: "inline-block", border: `1px solid ${G.border}`
                        }}>
                            <ThunderboltOutlined style={{ color: G.text, marginRight: 6 }} />
                            {filteredData.length} Transaksi ditemukan pada periode ini
                        </div>
                    </Col>
                </Row>
            </Card>

            {/* ════ TABEL (Kesehatan Style) ════ */}
            <div style={{
                background: token.colorBgContainer,
                borderRadius: 16, overflow: "hidden",
                boxShadow: G.shadow, border: G.cardBorder,
                marginBottom: 40
            }}>
                <ProTable<IPengeluaran>
                    {...finalTableProps}
                    columns={columns}
                    rowKey="id"
                    search={false}
                    className="pgl-protable"
                    scroll={{ x: 1050 }}
                    headerTitle={
                        <Space size={10} align="center">
                            <div style={{
                                width: 34, height: 34, borderRadius: 9,
                                background: G.gradient,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 15, color: "#fff",
                            }}>
                                <ShoppingCartOutlined />
                            </div>
                            <div>
                                <div style={{
                                    fontSize: 14, fontWeight: 800,
                                    color: token.colorText, letterSpacing: "-0.3px",
                                }}>
                                    Rekapitulasi Pengeluaran
                                </div>
                                <div style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 1 }}>
                                    {filteredData.length} transaksi · {filterMonth.format("MMMM YYYY")}
                                </div>
                            </div>
                        </Space>
                    }
                    toolBarRender={() => [
                        <Button 
                            key="pdf"
                            icon={<FilePdfOutlined />} 
                            onClick={handleExportPdf}
                            style={{ border: G.cardBorder, borderRadius: 9, height: 36, color: token.colorTextSecondary }}
                        >
                            Cetak PDF
                        </Button>,
                        <Button 
                            key="excel"
                            icon={<FileExcelOutlined />} 
                            onClick={handleExportExcel}
                            style={{ border: G.cardBorder, borderRadius: 9, height: 36, color: token.colorTextSecondary }}
                        >
                            Excel
                        </Button>,
                        <Button 
                            key="create"
                            type="primary"
                            icon={<PlusOutlined />} 
                            onClick={handleOpenCreate}
                            style={{
                                background: G.gradient,
                                border: "none", borderRadius: 9, fontWeight: 700, height: 36,
                                boxShadow: "0 4px 14px rgba(180,83,9,0.35)",
                            }}
                        >
                            Catat
                        </Button>,
                    ]}
                    summary={() => (
                        <ProTable.Summary.Row style={{ background: G.bg }}>
                            <ProTable.Summary.Cell index={0} colSpan={3}>
                                <Text strong style={{ fontFamily: "'Cinzel', serif", fontSize: 12, color: G.text, letterSpacing: "0.5px" }}>
                                    TOTAL KESELURUHAN
                                </Text>
                            </ProTable.Summary.Cell>
                            <ProTable.Summary.Cell index={3} />
                            <ProTable.Summary.Cell index={4} align="right">
                                <Text strong style={{ fontSize: 15, fontWeight: 700, color: "var(--pgl-red)", fontVariantNumeric: "tabular-nums" }}>
                                    {IDR(totalBulanIni)}
                                </Text>
                            </ProTable.Summary.Cell>
                            <ProTable.Summary.Cell index={5} colSpan={3} />
                        </ProTable.Summary.Row>
                    )}
                />
            </div>

            {/* ════ MODAL HAPUS ════ */}
            <Modal
                open={deleteConfirm !== null}
                onCancel={() => setDeleteConfirm(null)}
                onOk={() => handleDelete(deleteConfirm!)}
                okText="Ya, Hapus" cancelText="Batal"
                okButtonProps={{ danger: true }}
                title="Konfirmasi Hapus Data"
                centered width={400}>
                <p>Data pengeluaran ini akan dihapus permanen. Lanjutkan?</p>
            </Modal>

            {/* ════ MODAL CREATE / EDIT ════ */}
            <Modal
                title={null}
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                footer={null}
                centered
                width={620}
                className="pgl-modal"
                destroyOnClose
            >
                {/* Modal Header Custom */}
                <div className="pgl-modal-header">
                    <div className="pgl-modal-icon">
                        {modalMode === "CREATE" ? <PlusOutlined /> : <EditOutlined />}
                    </div>
                    <div>
                        <div className="pgl-modal-title">
                            {modalMode === "CREATE" ? "Catat Pengeluaran Baru" : "Edit Data Pengeluaran"}
                        </div>
                        <div className="pgl-modal-sub">
                            {modalMode === "CREATE" ? "تسجيل مصروف جديد" : "تعديل بيانات المصروف"}
                        </div>
                    </div>
                </div>

                <Form form={form} layout="vertical" onFinish={handleSubmit} className="pgl-form">
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item label="Tanggal" name="tanggal_pengeluaran" rules={[{ required: true, message: "Wajib diisi" }]}>
                                <DatePicker style={{ width: "100%" }} format="DD MMM YYYY" className="pgl-form-input" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Kategori" name="kategori" rules={[{ required: true, message: "Wajib dipilih" }]}>
                                <Select className="pgl-form-input"
                                    options={KATEGORI_LIST.map(k => ({
                                        label: <span>{KATEGORI_META[k]?.icon} {k}</span>,
                                        value: k
                                    }))} />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item label="Judul Pengeluaran" name="judul" rules={[{ required: true, message: "Wajib diisi" }]}>
                        <Input className="pgl-form-input" placeholder="Contoh: Belanja Sayur Mingguan" />
                    </Form.Item>

                    <Form.Item label="Nominal (Rp)" name="nominal" rules={[{ required: true, message: "Nominal wajib diisi" }]}>
                        <InputNumber
                            style={{ width: "100%" }}
                            className="pgl-form-input pgl-nominal-input"
                            size="large"
                            formatter={v => `Rp ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
                            parser={v => v?.replace(/\Rp\s?|(\.*)/g, "") as unknown as number}
                            placeholder="0"
                        />
                    </Form.Item>

                    <Form.Item label="Keterangan Detail" name="keterangan">
                        <Input.TextArea rows={2} className="pgl-form-input" placeholder="Keterangan tambahan (opsional)" />
                    </Form.Item>

                    <Form.Item label="Dicatat Oleh" name="dicatat_oleh_nama">
                        <Input disabled className="pgl-form-input pgl-input-disabled" prefix={<UserOutlined />} />
                    </Form.Item>

                    <Form.Item label="Upload Bukti / Nota">
                        <div className="pgl-upload-area">
                            <Upload customRequest={handleUpload} showUploadList={false} accept="image/*">
                                <Button icon={<UploadOutlined />} loading={uploading} className="pgl-upload-btn">
                                    {uploading ? "Mengupload..." : "Pilih Foto Nota"}
                                </Button>
                            </Upload>
                            <AnimatePresence>
                                {buktiUrl && (
                                    <motion.div className="pgl-bukti-preview"
                                        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                                        <Image src={buktiUrl} height={80} style={{ borderRadius: 8, objectFit: "cover" }} />
                                        <div className="pgl-bukti-ok"><CheckCircleOutlined /> Bukti Terupload</div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </Form.Item>

                    <div className="pgl-modal-footer">
                        <Button onClick={() => setIsModalOpen(false)} className="pgl-btn-cancel">Batal</Button>
                        <Button htmlType="submit" className="pgl-btn-submit" icon={modalMode === "CREATE" ? <PlusOutlined /> : <CheckCircleOutlined />}>
                            {modalMode === "CREATE" ? "Simpan Pengeluaran" : "Simpan Perubahan"}
                        </Button>
                    </div>
                </Form>
            </Modal>

            {/* ════════════════════════════════════════════════════════
                STYLES — Tambahkan ke index.css atau biarkan di sini
            ════════════════════════════════════════════════════════ */}
            <style>{`
                /* ════ IMPORT FONT ════ */
                @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap');

                /* ════ DARK / LIGHT VARIABLES ════ */
                .pgl-light {
                    --pgl-bg:            #F8F6EE;
                    --pgl-bg-card:       #FFFFFF;
                    --pgl-bg-card-alt:   #FEFCF3;
                    --pgl-border:        rgba(180,130,0,0.14);
                    --pgl-border-strong: rgba(180,130,0,0.35);
                    --pgl-gold:          #8A6000;
                    --pgl-gold-bright:   #C9A227;
                    --pgl-gold-bg:       rgba(180,130,0,0.07);
                    --pgl-gold-glow:     rgba(180,130,0,0.15);
                    --pgl-text-primary:  #1A1208;
                    --pgl-text-secondary:#7A6040;
                    --pgl-text-muted:    #B0966A;
                    --pgl-shadow:        0 2px 20px rgba(0,0,0,0.07);
                    --pgl-shadow-hover:  0 8px 32px rgba(0,0,0,0.12);
                    --pgl-red:           #DC2626;
                    --pgl-stat-bg:       #FFFFFF;
                }
                .pgl-dark {
                    --pgl-bg:            var(--surface-base);
                    --pgl-bg-card:       var(--surface-card);
                    --pgl-bg-card-alt:   var(--surface-sunken);
                    --pgl-border:        var(--border-subtle);
                    --pgl-border-strong: var(--border-default);
                    --pgl-gold:          var(--gold-primary);
                    --pgl-gold-bright:   var(--gold-bright);
                    --pgl-gold-bg:       rgba(201,168,76,0.06);
                    --pgl-gold-glow:     rgba(201,168,76,0.15);
                    --pgl-text-primary:  var(--text-primary);
                    --pgl-text-secondary:var(--text-secondary);
                    --pgl-text-muted:    var(--text-tertiary);
                    --pgl-shadow:        var(--shadow-lg);
                    --pgl-shadow-hover:  var(--shadow-xl);
                    --pgl-red:           var(--danger);
                    --pgl-stat-bg:       var(--surface-card);
                }

                /* ════ ROOT ════ */
                .pgl-root {
                    font-family: 'DM Sans', sans-serif;
                    background: transparent;
                    min-height: 100vh;
                    padding-bottom: 60px;
                }

                /* ════ PAGE HEADER ════ */
                .pgl-page-header {
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 24px 0 20px;
                    border-bottom: 1px solid var(--pgl-border);
                    margin-bottom: 24px; gap: 16px; flex-wrap: wrap;
                }
                .pgl-page-header-left { display: flex; align-items: center; gap: 16px; }
                .pgl-page-icon {
                    width: 52px; height: 52px; border-radius: 14px; flex-shrink: 0;
                    background: linear-gradient(135deg, #8A6800, #C9A227 45%, #F5C840 80%, #C9A227);
                    display: flex; align-items: center; justify-content: center;
                    font-size: 22px; color: #07071A;
                    box-shadow: 0 0 24px var(--pgl-gold-glow), 0 4px 14px rgba(0,0,0,0.25);
                }
                .pgl-page-title {
                    font-family: 'Cinzel', serif; font-size: 20px; font-weight: 700;
                    color: var(--pgl-text-primary); margin: 0; letter-spacing: 0.5px;
                }
                .pgl-page-arabic {
                    font-size: 11px; color: var(--pgl-text-secondary); margin: 3px 0 0;
                    direction: rtl; text-align: right;
                }
                .pgl-page-header-right { display: flex; gap: 9px; flex-wrap: wrap; }

                /* ════ BUTTONS ════ */
                .pgl-btn-primary {
                    background: linear-gradient(135deg, #8A6800, #C9A227 50%, #F5C840) !important;
                    border: none !important; color: #07071A !important; font-weight: 700 !important;
                    height: 38px !important; padding: 0 18px !important; border-radius: 10px !important;
                    box-shadow: 0 4px 14px rgba(212,175,55,0.4) !important;
                    font-family: 'DM Sans', sans-serif !important;
                    transition: all 0.2s !important;
                }
                .pgl-btn-primary:hover { box-shadow: 0 6px 20px rgba(212,175,55,0.55) !important; transform: translateY(-1px); }
                .pgl-btn-secondary {
                    background: var(--pgl-gold-bg) !important; border: 1px solid var(--pgl-border-strong) !important;
                    color: var(--pgl-gold) !important; font-weight: 600 !important;
                    height: 38px !important; border-radius: 10px !important;
                    font-family: 'DM Sans', sans-serif !important;
                }
                .pgl-btn-secondary:hover { background: var(--pgl-gold-bg) !important; border-color: var(--pgl-gold) !important; }

                /* ════ STAT CARDS ════ */
                .pgl-stats-row { margin-bottom: 20px; }
                .pgl-stat-card {
                    background: var(--pgl-stat-bg); border: 1px solid var(--pgl-border);
                    border-radius: 16px; padding: 20px 18px 20px 20px;
                    display: flex; align-items: flex-start; gap: 14px;
                    position: relative; overflow: hidden; cursor: default;
                    box-shadow: var(--pgl-shadow);
                    transition: box-shadow 0.25s, transform 0.25s;
                }
                .pgl-stat-card:hover { box-shadow: var(--pgl-shadow-hover); }
                .pgl-stat-icon-wrap {
                    width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
                    background: color-mix(in srgb, var(--pgl-accent) 12%, transparent);
                    border: 1px solid color-mix(in srgb, var(--pgl-accent) 28%, transparent);
                    display: flex; align-items: center; justify-content: center;
                    font-size: 19px; color: var(--pgl-accent);
                }
                .pgl-stat-body { flex: 1; min-width: 0; }
                .pgl-stat-title { font-size: 11.5px; font-weight: 600; color: var(--pgl-text-secondary); letter-spacing: 0.4px; text-transform: uppercase; }
                .pgl-stat-arabic { font-size: 10px; color: var(--pgl-text-muted); direction: rtl; }
                .pgl-stat-value {
                    font-size: 18px; font-weight: 700; color: var(--pgl-text-primary);
                    margin: 5px 0 4px; line-height: 1.2;
                    font-variant-numeric: tabular-nums;
                }
                .pgl-stat-sub { font-size: 11px; color: var(--pgl-text-muted); }
                .pgl-stat-bar {
                    position: absolute; bottom: 0; left: 0; right: 0; height: 3px;
                    background: linear-gradient(90deg, var(--pgl-accent), color-mix(in srgb, var(--pgl-accent) 40%, transparent));
                    opacity: 0.7;
                }

                /* ════ CHARTS ════ */
                .pgl-charts-row { margin-bottom: 20px; }
                .pgl-chart-card {
                    background: var(--pgl-bg-card); border: 1px solid var(--pgl-border);
                    border-radius: 16px; padding: 20px; height: 100%;
                    box-shadow: var(--pgl-shadow);
                }
                .pgl-chart-header { margin-bottom: 16px; }
                .pgl-chart-title  { font-size: 14px; font-weight: 700; color: var(--pgl-text-primary); }
                .pgl-chart-sub    { font-size: 10.5px; color: var(--pgl-text-secondary); margin-top: 2px; }
                .pgl-chart-empty  { height: 200px; display: flex; align-items: center; justify-content: center; color: var(--pgl-text-muted); font-size: 13px; }
                .pgl-chart-tooltip {
                    background: var(--pgl-bg-card) !important; border: 1px solid var(--pgl-border-strong) !important;
                    border-radius: 10px; padding: 9px 14px;
                    box-shadow: 0 6px 24px rgba(0,0,0,0.2);
                }
                .pgl-tooltip-label { font-size: 11px; color: var(--pgl-text-secondary); margin-bottom: 3px; }
                .pgl-tooltip-value { font-size: 13px; font-weight: 700; color: var(--pgl-gold); }

                /* ════ FILTER BAR ════ */
                .pgl-filter-bar {
                    background: var(--pgl-bg-card); border: 1px solid var(--pgl-border);
                    border-radius: 12px; padding: 12px 18px; margin-bottom: 16px;
                    display: flex; align-items: center; justify-content: space-between;
                    gap: 12px; flex-wrap: wrap;
                    box-shadow: var(--pgl-shadow);
                }
                .pgl-filter-left  { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
                .pgl-filter-right { display: flex; align-items: center; gap: 10px; }
                .pgl-filter-label { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: var(--pgl-text-secondary); }
                .pgl-result-count { font-size: 12px; color: var(--pgl-text-muted); }
                .pgl-clear-btn    { background: transparent !important; border: 1px solid var(--pgl-border) !important; color: var(--pgl-text-secondary) !important; font-size: 11px !important; border-radius: 8px !important; }
                .pgl-datepicker, .pgl-select { font-family: 'DM Sans', sans-serif !important; }

                /* ════ TABLE ════ */
                .pgl-table-wrap {
                    background: var(--pgl-bg-card); 
                    border: 1px solid var(--pgl-border-strong);
                    border-radius: 16px; overflow: hidden;
                    box-shadow: var(--pgl-shadow);
                }
                .pgl-protable .ant-pro-table-list-toolbar { 
                    padding: 14px 20px !important; 
                    border-bottom: 1px solid var(--pgl-border-strong); 
                    background: var(--pgl-bg-card) !important;
                }
                .pgl-table-header-icon { color: var(--pgl-gold) !important; font-size: 18px; }
                .pgl-table-header-text { font-size: 15px; font-weight: 700; color: var(--pgl-text-primary); font-family: 'DM Sans', sans-serif; }
                .pgl-table-period { font-size: 11px; color: var(--pgl-text-secondary); background: var(--pgl-gold-bg); border: 1px solid var(--pgl-border); padding: 2px 9px; border-radius: 10px; }

                /* Table cell styles */
                .ant-table-thead > tr > th {
                    border-bottom: 1px solid var(--pgl-border-strong) !important;
                }
                .ant-table-tbody > tr > td {
                    border-bottom: 1px solid var(--pgl-border) !important;
                }
                .pgl-date-cell     { display: flex; flex-direction: column; gap: 1px; }
                .pgl-date-main     { font-size: 12.5px; font-weight: 500; color: var(--pgl-text-primary); }
                .pgl-date-sub      { font-size: 10px; color: var(--pgl-text-muted); direction: rtl; text-align: left; }
                .pgl-detail-cell   { display: flex; flex-direction: column; gap: 2px; }
                .pgl-detail-title  { font-size: 13.5px; color: var(--pgl-text-primary) !important; }
                .pgl-detail-sub    { font-size: 11px; color: var(--pgl-text-secondary) !important; }
                .pgl-kategori-badge {
                    display: inline-flex; align-items: center; gap: 5px;
                    padding: 4px 10px; border-radius: 20px; font-size: 11.5px; font-weight: 600;
                    background: color-mix(in srgb, var(--kat-color) 10%, transparent);
                    border: 1px solid color-mix(in srgb, var(--kat-color) 25%, transparent);
                    color: var(--kat-color);
                }
                .pgl-nominal-cell { display: flex; align-items: center; gap: 6px; justify-content: flex-end; }
                .pgl-nominal-icon { color: var(--pgl-red); font-size: 11px; }
                .pgl-nominal-value { font-size: 14px; font-weight: 700; color: var(--pgl-red); font-variant-numeric: tabular-nums; font-family: 'DM Mono', monospace, 'DM Sans', sans-serif; }
                .pgl-no-bukti      { color: var(--pgl-text-muted); }
                .pgl-pencatat-cell { display: flex; align-items: center; gap: 7px; }
                .pgl-pencatat-avatar { background: linear-gradient(135deg, #8A6800, #C9A227) !important; font-size: 12px !important; }
                .pgl-pencatat-name   { font-size: 12px; color: var(--pgl-text-secondary); }
                .pgl-action-btn    { border-radius: 7px !important; }
                .pgl-edit-btn:hover { color: #3B82F6 !important; background: rgba(59,130,246,0.08) !important; }
                .pgl-summary-row   { background: var(--pgl-gold-bg) !important; }
                .pgl-summary-label { font-family: 'Cinzel', serif; font-size: 12px; color: var(--pgl-gold); letter-spacing: 0.5px; }
                .pgl-summary-value { font-size: 15px; font-weight: 700; color: var(--pgl-red); font-variant-numeric: tabular-nums; }

                /* ════ MODAL ════ */
                .pgl-modal .ant-modal-content { border-radius: 18px !important; padding: 0 !important; overflow: hidden; border: 1px solid var(--pgl-border) !important; background: var(--pgl-bg-card) !important; }
                .pgl-modal-header {
                    padding: 22px 24px 18px;
                    display: flex; align-items: center; gap: 14px;
                    border-bottom: 1px solid var(--pgl-border);
                    background: var(--pgl-gold-bg);
                    position: relative;
                }
                .pgl-modal-header::before {
                    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
                    background: linear-gradient(90deg, transparent, #8A6800 15%, #C9A227 40%, #F5C840 60%, #C9A227 80%, transparent);
                }
                .pgl-modal-icon {
                    width: 42px; height: 42px; border-radius: 11px; flex-shrink: 0;
                    background: linear-gradient(135deg, #8A6800, #F5C840);
                    display: flex; align-items: center; justify-content: center;
                    font-size: 18px; color: #07071A;
                    box-shadow: 0 4px 14px rgba(212,175,55,0.4);
                }
                .pgl-modal-title { font-family: 'Cinzel', serif; font-size: 15px; font-weight: 700; color: var(--pgl-text-primary); }
                .pgl-modal-sub   { font-size: 10.5px; color: var(--pgl-text-secondary); margin-top: 2px; direction: rtl; }

                /* Form */
                .pgl-form { padding: 20px 24px; }
                .pgl-form .ant-form-item-label > label { font-size: 12px; font-weight: 600; color: var(--pgl-text-secondary); }
                .pgl-form-input { border-radius: 9px !important; font-family: 'DM Sans', sans-serif !important; }
                .pgl-nominal-input .ant-input-number-input { font-size: 16px !important; font-weight: 700 !important; color: var(--pgl-red) !important; }
                .pgl-input-disabled { opacity: 0.7 !important; }

                /* Upload */
                .pgl-upload-area { display: flex; align-items: flex-start; gap: 14px; flex-wrap: wrap; }
                .pgl-upload-btn  { border-radius: 9px !important; border: 1px dashed var(--pgl-border-strong) !important; color: var(--pgl-text-secondary) !important; background: var(--pgl-gold-bg) !important; }
                .pgl-bukti-preview { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
                .pgl-bukti-ok    { font-size: 11px; color: #3DC97A; display: flex; align-items: center; gap: 4px; }

                /* Modal Footer */
                .pgl-modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 24px; border-top: 1px solid var(--pgl-border); margin: 0 -24px -20px; }
                .pgl-btn-cancel   { border-radius: 9px !important; border-color: var(--pgl-border) !important; color: var(--pgl-text-secondary) !important; }
                .pgl-btn-submit   {
                    background: linear-gradient(135deg, #8A6800, #C9A227 50%, #F5C840) !important;
                    border: none !important; color: #07071A !important; font-weight: 700 !important;
                    border-radius: 9px !important; box-shadow: 0 4px 14px rgba(212,175,55,0.4) !important;
                }
                .pgl-btn-submit:hover { box-shadow: 0 6px 20px rgba(212,175,55,0.55) !important; }

                /* ════ ANTD DARK OVERRIDES ════ */
                .pgl-dark .ant-table { background: var(--pgl-bg-card) !important; }
                .pgl-dark .ant-table-thead > tr > th { background: var(--pgl-bg-card-alt) !important; color: var(--pgl-text-secondary) !important; border-color: var(--pgl-border-strong) !important; }
                .pgl-dark .ant-table-tbody > tr > td { border-color: var(--pgl-border) !important; }
                .pgl-dark .ant-table-tbody > tr:hover > td { background: var(--pgl-gold-bg) !important; }
                .pgl-dark .ant-pagination .ant-pagination-item-active { border-color: var(--pgl-gold) !important; }
                .pgl-dark .ant-pagination .ant-pagination-item-active a { color: var(--pgl-gold) !important; }
                .pgl-dark .ant-select-selector { background: var(--pgl-bg-card) !important; border-color: var(--pgl-border) !important; }
                .pgl-dark .ant-input { background: var(--pgl-bg-card) !important; border-color: var(--pgl-border) !important; color: var(--pgl-text-primary) !important; }
                .pgl-dark .ant-picker { background: var(--pgl-bg-card) !important; border-color: var(--pgl-border) !important; }
                .pgl-dark .ant-input-number { background: var(--pgl-bg-card) !important; border-color: var(--pgl-border) !important; }
                .pgl-dark .ant-modal-content { background: var(--pgl-bg-card) !important; }
                .pgl-dark .ant-pro-table-list-toolbar { background: var(--pgl-bg-card) !important; }
            `}</style>
        </div>
    );
};
