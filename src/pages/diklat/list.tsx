import { useState, useRef, useEffect } from "react";
import { useTable } from "@refinedev/antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import {
    Tag, Space, Button, Typography, Tooltip, Avatar, Modal,
    Select, Card, Row, Col, InputNumber, message, Popconfirm, theme, Progress,
} from "antd";
import {
    PrinterOutlined, UserOutlined, DownloadOutlined, DeleteOutlined,
    BankOutlined, CheckCircleOutlined, RocketOutlined,
    SyncOutlined, ClockCircleOutlined, TeamOutlined,
    SafetyCertificateOutlined, CalendarOutlined,
    PhoneOutlined, IdcardOutlined,
} from "@ant-design/icons";
import { useDelete, useGetIdentity, useUpdate, useCreate } from "@refinedev/core";
import { useReactToPrint } from "react-to-print";
import { QRCode } from "antd";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import dayjs from "dayjs";
import { IPesertaDiklat, IProfile, IConfigDiklat, IUserIdentity } from "../../types";
import { supabaseClient } from "../../utility/supabaseClient";
import { useColorMode } from "../../contexts/color-mode";
import { formatHijri, formatMasehi } from "../../utility/dateHelper";

const { useToken } = theme;

// ─────────────────────────────────────────────
//  UTILS
// ─────────────────────────────────────────────
const formatRp = (val: number) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(val);

const JENIS_OPTIONS = [
    { label: "✦ Pasaran Maulid", value: "MAULID" },
    { label: "✦ Pasaran Syaban", value: "SYABAN" },
    { label: "✦ Pasaran Ramadhan", value: "RAMADHAN" },
    { label: "✦ Pasaran Dzulhijjah", value: "DZULHIJJAH" },
];

const formatDicatatOlehForPrint = (value?: string | null) => {
    if (!value || value.trim().toLowerCase() === "self registration") {
        return "Bag. Administrasi";
    }

    return value;
};

// ─────────────────────────────────────────────
//  COMPONENT
// ─────────────────────────────────────────────
export const DiklatList = () => {
    const { token } = useToken();
    const { mode } = useColorMode();
    const { data: user } = useGetIdentity<IUserIdentity>();
    const { mutate: deleteMutate } = useDelete();
    const { mutate: updateMutate } = useUpdate();
    const { mutate: createTransaksi } = useCreate();

    const isDark = mode === "dark";

    // ── Gold Design System ─────────────────────
    const G = {
        text: isDark ? "#F59E0B" : "#B45309",
        bg: isDark ? "rgba(245,158,11,0.08)" : "rgba(212,160,23,0.06)",
        border: isDark ? "rgba(245,158,11,0.18)" : "rgba(180,83,9,0.14)",
        borderStrong: isDark ? "rgba(245,158,11,0.35)" : "rgba(180,83,9,0.28)",
        gradient: "linear-gradient(135deg, #92400E 0%, #B45309 30%, #D4A017 65%, #F59E0B 100%)",
        gradientSoft: isDark
            ? "linear-gradient(135deg, rgba(146,64,14,0.35) 0%, rgba(245,158,11,0.18) 100%)"
            : "linear-gradient(135deg, rgba(180,83,9,0.10) 0%, rgba(245,158,11,0.05) 100%)",
        shadow: isDark
            ? "0 8px 32px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.05)"
            : "0 4px 24px rgba(0,0,0,0.07)",
        cardBorder: isDark
            ? "1px solid rgba(255,255,255,0.06)"
            : "1px solid rgba(0,0,0,0.05)",
    };

    // ── States ─────────────────────────────────
    const [activeConfig, setActiveConfig] = useState<IConfigDiklat | null>(null);
    const [filterTahun, setFilterTahun] = useState<number>(1447);
    const [filterJenis, setFilterJenis] = useState<"MAULID" | "SYABAN" | "RAMADHAN" | "DZULHIJJAH">("RAMADHAN");
    const [isPrintOpen, setIsPrintOpen] = useState(false);
    const [printData, setPrintData] = useState<IPesertaDiklat | null>(null);
    const [loadingExport, setLoadingExport] = useState(false);
    const componentRef = useRef(null);

    // ── Fetch Config ───────────────────────────
    useEffect(() => {
        (async () => {
            const { data } = await supabaseClient
                .from("config_diklat")
                .select("*")
                .eq("is_active", true)
                .single();
            if (data) {
                setActiveConfig(data as IConfigDiklat);
                setFilterTahun(data.tahun_hijriah);
            }
        })();
    }, []);

    useEffect(() => {
        if (!filterTahun) return;
        setActiveConfig(null);

        (async () => {
            const { data, error } = await supabaseClient
                .from("config_diklat")
                .select("*")
                .eq("tahun_hijriah", filterTahun)
                .order("is_active", { ascending: false })
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) {
                console.error("Fetch Config Diklat by year error:", error);
                setActiveConfig(null);
                return;
            }

            setActiveConfig((data || null) as IConfigDiklat | null);
        })();
    }, [filterTahun]);

    // ── Table ──────────────────────────────────
    const { tableProps, tableQueryResult } = useTable<IPesertaDiklat>({
        resource: "peserta_diklat",
        syncWithLocation: false,
        filters: {
            permanent: [
                { field: "tahun_diklat", operator: "eq", value: filterTahun },
                { field: "jenis_diklat", operator: "eq", value: filterJenis },
            ],
        },
        sorters: { initial: [{ field: "created_at", order: "desc" }] },
    });

    // ── Statistics ─────────────────────────────
    const allData = tableQueryResult?.data?.data || [];
    const stats = allData.reduce(
        (acc, curr) => ({
            administrasi: acc.administrasi + Number(curr.biaya_pendaftaran || 0),
            kitab: acc.kitab + Number(curr.belanja_kitab_nominal || 0),
            pending: acc.pending + (curr.status_pembayaran === "PENDING" ? 1 : 0),
            lunas: acc.lunas + (curr.status_pembayaran === "LUNAS" || curr.status_pembayaran === "SUCCESS" ? 1 : 0),
        }),
        { administrasi: 0, kitab: 0, pending: 0, lunas: 0 }
    );
    const grandTotal = stats.administrasi + stats.kitab;
    const totalPeserta = allData.length;
    const persentaseLunas = totalPeserta > 0 ? Math.round((stats.lunas / totalPeserta) * 100) : 0;

    // ── Confirm Payment ────────────────────────
    const handleConfirmPayment = (record: IPesertaDiklat) => {
        const total = Number(record.biaya_pendaftaran || 0) + Number(record.belanja_kitab_nominal || 0);
        
        // 1. Catat ke Jurnal Umum (Transaksi Keuangan)
        createTransaksi({
            resource: "transaksi_keuangan",
            values: {
                jumlah: total,
                tanggal_transaksi: dayjs().toISOString(),
                status_transaksi: "settlement",
                metode_pembayaran: "cash",
                jenis_transaksi: "masuk",
                admin_pencatat_id: user?.id || null,
                keterangan: `Pembayaran Diklat (${record.jenis_diklat} ${record.tahun_diklat}H): ${record.nama_lengkap}`
            }
        });

        // 2. Update Status Peserta
        updateMutate({
            resource: "peserta_diklat",
            id: record.id.toString(),
            values: { status_pembayaran: "LUNAS" },
            successNotification: () => ({ message: "Pembayaran berhasil dikonfirmasi.", type: "success" }),
        });
    };

    // ── Export Excel ───────────────────────────
    const handleExport = async () => {
        setLoadingExport(true);
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet(`Rekap Peserta ${filterJenis}`);

            worksheet.mergeCells("A1:J1");
            const t = worksheet.getCell("A1");
            t.value = "PONDOK PESANTREN AL-HASANAH";
            t.font = { name: "Arial", size: 16, bold: true, color: { argb: "FFB45309" } };
            t.alignment = { vertical: "middle", horizontal: "center" };

            worksheet.mergeCells("A2:J2");
            const a = worksheet.getCell("A2");
            a.value = "Jl. Raya Cibeuti No.13, Cibeuti, Kec. Kawalu, Tasikmalaya, Jawa Barat 46182";
            a.font = { name: "Arial", size: 10, italic: true };
            a.alignment = { vertical: "middle", horizontal: "center" };

            worksheet.addRow([]);
            worksheet.addRow([`REKAPITULASI PESERTA DIKLAT & PASARAN - ${filterJenis} ${filterTahun} H`]).font = { bold: true, size: 12 };
            worksheet.addRow([`Dicetak pada: ${dayjs().format("DD MMMM YYYY HH:mm")}`]).font = { italic: true, size: 9 };
            worksheet.addRow([]);

            const headerRow = worksheet.addRow(["NO", "NAMA LENGKAP", "ASAL PESANTREN", "STATUS BAYAR", "MIFTAH", "LISTRIK", "KONSUMSI", "TAFARUQON", "KOP. KITAB", "TOTAL BAYAR"]);
            headerRow.eachCell((cell) => {
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF59E0B" } };
                cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
                cell.alignment = { vertical: "middle", horizontal: "center" };
                cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
            });

            allData.forEach((item, index) => {
                const total = Number(item.biaya_pendaftaran) + Number(item.belanja_kitab_nominal);
                const row = worksheet.addRow([index + 1, item.nama_lengkap.toUpperCase(), item.pesantren_asal, item.status_pembayaran, Number(item.uang_miftah || 0), Number(item.biaya_listrik || 0), Number(item.kos_makan || 0), Number(item.tafaruqon || 0), Number(item.belanja_kitab_nominal || 0), total]);
                row.eachCell((cell, colNumber) => {
                    cell.border = { top: { style: "thin", color: { argb: "FFE5E7EB" } }, left: { style: "thin", color: { argb: "FFE5E7EB" } }, bottom: { style: "thin", color: { argb: "FFE5E7EB" } }, right: { style: "thin", color: { argb: "FFE5E7EB" } } };
                    if (index % 2 !== 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDF6E3" } };
                    if (colNumber >= 5) { cell.numFmt = "#,##0"; cell.alignment = { horizontal: "right" }; }
                });
            });

            worksheet.addRow([]);
            const gT = allData.reduce((acc, curr) => acc + Number(curr.biaya_pendaftaran) + Number(curr.belanja_kitab_nominal), 0);
            const footerRow = worksheet.addRow(["", "", "", "", "", "", "", "", "TOTAL KESELURUHAN", gT]);
            footerRow.font = { bold: true, size: 12 };
            footerRow.getCell(10).numFmt = "#,##0";
            [5, 35, 25, 15, 12, 12, 12, 12, 15, 18].forEach((w, i) => { worksheet.getColumn(i + 1).width = w; });
            worksheet.autoFilter = "A6:J6";
            worksheet.views = [{ state: "frozen", xSplit: 0, ySplit: 6 }];

            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `Rekap_Peserta_Diklat_${filterJenis}_${filterTahun}H_${new Date().toISOString().split("T")[0]}.xlsx`);
            message.success("Laporan Excel berhasil di-generate");
        } catch {
            message.error("Gagal mengekspor data ke Excel");
        } finally {
            setLoadingExport(false);
        }
    };

    const handlePrint = (record: IPesertaDiklat) => { setPrintData(record); setIsPrintOpen(true); };
    const handlePrintAction = useReactToPrint({ contentRef: componentRef, documentTitle: `Formulir_${printData?.nama_lengkap || "Peserta"}` });
    const printProgramYear = printData?.tahun_diklat ?? filterTahun;
    const printConfig = activeConfig?.tahun_hijriah === printProgramYear ? activeConfig : null;
    const printProgramTitle = `PROGRAM PASARAN ${printData?.jenis_diklat || filterJenis} ${printConfig?.tahun_hijriah ?? printProgramYear} H${printConfig?.periode ? ` PERIODE - ${printConfig.periode}` : ""}`;

    // ══════════════════════════════════════════
    //  COLUMNS
    // ══════════════════════════════════════════
    const columns: ProColumns<IPesertaDiklat>[] = [
        {
            title: "PESERTA",
            dataIndex: "nama_lengkap",
            width: 230,
            fixed: "left",
            render: (_, record) => (
                <Space size={12} align="center">
                    <Avatar size={44} icon={<UserOutlined />} style={{ background: G.bg, border: `2px solid ${G.border}`, color: G.text, flexShrink: 0 }} />
                    <div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: token.colorText, lineHeight: 1.25, letterSpacing: "-0.2px" }}>{record.nama_lengkap}</div>
                        <div style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}>
                            <PhoneOutlined style={{ fontSize: 10 }} />{record.no_telepon || "-"}
                        </div>
                    </div>
                </Space>
            ),
        },
        {
            title: "ASAL PESANTREN",
            dataIndex: "pesantren_asal",
            width: 210,
            render: (val) => (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(29,78,216,0.08)", border: "1px solid rgba(29,78,216,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <BankOutlined style={{ fontSize: 12, color: "#1D4ED8" }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: token.colorText }}>{val as string}</span>
                </div>
            ),
        },
        {
            title: "TGL. DAFTAR",
            dataIndex: "created_at",
            width: 150,
            render: (val) => (
                <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: token.colorText }}>{dayjs(val as string).format("DD MMM YYYY")}</div>
                    <div style={{ fontSize: 11, color: G.text, fontWeight: 600, marginTop: 3 }}>{formatHijri(val as string)}</div>
                </div>
            ),
        },
        {
            title: "STATUS",
            dataIndex: "status_pembayaran",
            width: 145,
            align: "center",
            render: (val) => {
                const ok = val === "LUNAS" || val === "SUCCESS";
                return (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 14px", borderRadius: 20, fontSize: 10, fontWeight: 900, letterSpacing: "0.8px", background: ok ? "rgba(16,185,129,0.10)" : "rgba(245,158,11,0.10)", color: ok ? "#059669" : "#B45309", border: `1.5px solid ${ok ? "rgba(16,185,129,0.28)" : "rgba(245,158,11,0.35)"}` }}>
                        {ok ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
                        {ok ? "LUNAS" : "PENDING"}
                    </span>
                );
            },
        },
        {
            title: "ADMINISTRASI",
            dataIndex: "biaya_pendaftaran",
            align: "right",
            width: 185,
            render: (val, r) => (
                <Tooltip title={<div style={{ padding: "6px 2px", fontSize: 12 }}>{[{ l: "Miftah", v: r.uang_miftah }, { l: "Listrik", v: r.biaya_listrik }, { l: "Konsumsi", v: r.kos_makan }, { l: "Tafaruqon", v: r.tafaruqon }].map(i => <div key={i.l} style={{ display: "flex", justifyContent: "space-between", gap: 24, marginBottom: 4 }}><span style={{ color: "rgba(255,255,255,0.7)" }}>{i.l}</span><span style={{ fontWeight: 700 }}>{new Intl.NumberFormat("id-ID").format(Number(i.v || 0))}</span></div>)}</div>} color="#1C1917">
                    <div style={{ textAlign: "right", cursor: "help" }}>
                        <div style={{ fontFamily: "ui-monospace, 'Courier New', monospace", fontWeight: 800, fontSize: 14, color: isDark ? "#F59E0B" : "#B45309" }}>{formatRp(Number(val))}</div>
                        <div style={{ fontSize: 9, color: token.colorTextTertiary, letterSpacing: "0.5px", marginTop: 3, textTransform: "uppercase" as const, fontWeight: 700 }}>Lihat Rincian ↑</div>
                    </div>
                </Tooltip>
            ),
        },
        {
            title: "KOP. KITAB",
            dataIndex: "belanja_kitab_nominal",
            align: "right",
            width: 155,
            render: (val, r) => (
                <Tooltip title={r.rincian_belanja || "—"} color="#1C1917">
                    <div style={{ textAlign: "right", cursor: "help" }}>
                        <div style={{ fontFamily: "ui-monospace, 'Courier New', monospace", fontWeight: 800, fontSize: 14, color: "#1D4ED8" }}>{formatRp(Number(val || 0))}</div>
                        {r.rincian_belanja && <div style={{ fontSize: 9, color: token.colorTextTertiary, letterSpacing: "0.5px", marginTop: 3, textTransform: "uppercase" as const, fontWeight: 700 }}>Lihat Item ↑</div>}
                    </div>
                </Tooltip>
            ),
        },
        {
            title: "TOTAL BAYAR",
            align: "right",
            width: 180,
            render: (_, r) => (
                <div style={{ fontFamily: "ui-monospace, 'Courier New', monospace", fontWeight: 900, fontSize: 15, color: token.colorText, letterSpacing: "-0.5px" }}>
                    {formatRp(Number(r.biaya_pendaftaran || 0) + Number(r.belanja_kitab_nominal || 0))}
                </div>
            ),
        },
        {
            title: "AKSI",
            valueType: "option",
            fixed: "right",
            width: 155,
            render: (_, record) => (
                <Space size={6}>
                    {record.status_pembayaran === "PENDING" && (
                        <Popconfirm
                            title="Konfirmasi Pembayaran"
                            description={<div style={{ maxWidth: 240, fontSize: 12 }}>Pastikan peserta sudah hadir dan telah melakukan pembayaran secara tunai.</div>}
                            onConfirm={() => handleConfirmPayment(record)}
                            okText="✓ Konfirmasi"
                            cancelText="Batal"
                            okButtonProps={{ style: { background: G.gradient, border: "none", color: "#fff", fontWeight: 700 } }}
                        >
                            <Tooltip title="Verifikasi Pembayaran">
                                <Button size="small" icon={<CheckCircleOutlined />} style={{ background: G.gradient, border: "none", color: "#fff", borderRadius: 7, fontWeight: 700, fontSize: 12, height: 30, boxShadow: "0 3px 10px rgba(180,83,9,0.28)" }}>Verifikasi</Button>
                            </Tooltip>
                        </Popconfirm>
                    )}
                    <Tooltip title="Cetak Formulir & Arsip">
                        <Button size="small" icon={<PrinterOutlined />} onClick={() => handlePrint(record)} style={{ border: `1.5px solid ${G.border}`, color: G.text, background: G.bg, borderRadius: 7, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center" }} />
                    </Tooltip>
                    <Popconfirm title="Hapus Peserta?" description="Tindakan ini tidak dapat dibatalkan." onConfirm={() => deleteMutate({ resource: "peserta_diklat", id: record.id.toString() })} okButtonProps={{ danger: true }} okText="Hapus" cancelText="Batal">
                        <Tooltip title="Hapus Data">
                            <Button danger size="small" icon={<DeleteOutlined />} style={{ borderRadius: 7, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center" }} />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    // ── KPI Card ───────────────────────────────
    const KpiCard = ({ label, value, sub, color, gradient, icon }: { label: string; value: React.ReactNode; sub?: string; color: string; gradient: string; icon: React.ReactNode }) => (
        <Card bordered={false} bodyStyle={{ padding: "20px 22px 18px" }} style={{ background: token.colorBgContainer, borderRadius: 16, overflow: "hidden", position: "relative", boxShadow: G.shadow, border: G.cardBorder }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: gradient }} />
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.2px", textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 10 }}>{label}</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1, letterSpacing: "-0.8px", marginBottom: 8 }}>{value}</div>
                    {sub && <div style={{ fontSize: 12, color: token.colorTextSecondary, fontWeight: 500 }}>{sub}</div>}
                </div>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#fff", flexShrink: 0, marginLeft: 14, boxShadow: `0 6px 16px ${color}35` }}>{icon}</div>
            </div>
        </Card>
    );

    // ══════════════════════════════════════════
    //  RENDER
    // ══════════════════════════════════════════
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingBottom: 80 }}>

            <style>{`
                .diklat-table .ant-table-thead .ant-table-cell {
                    background: ${isDark ? "rgba(245,158,11,0.09)" : "rgba(212,160,23,0.07)"} !important;
                    font-size: 10px !important; font-weight: 800 !important;
                    letter-spacing: 1.1px !important; text-transform: uppercase !important;
                    color: ${G.text} !important;
                    border-bottom: 2px solid ${G.borderStrong} !important;
                    padding: 12px 14px !important;
                }
                .diklat-table .ant-table-row:hover .ant-table-cell {
                    background: ${isDark ? "rgba(245,158,11,0.04)" : "rgba(212,160,23,0.035)"} !important;
                }
                .diklat-table .ant-table-cell {
                    transition: background 0.18s ease !important;
                    border-bottom: 1px solid ${token.colorBorderSecondary} !important;
                    padding: 14px !important;
                }
                .diklat-table .ant-pro-table-list-toolbar {
                    padding: 14px 16px !important;
                    border-bottom: 1px solid ${G.border} !important;
                }
                .diklat-table .ant-table-body::-webkit-scrollbar { height: 6px; }
                .diklat-table .ant-table-body::-webkit-scrollbar-thumb { background: ${G.border}; border-radius: 3px; }
            `}</style>

            {/* ══ MASTHEAD ══════════════════════════════ */}
            <div style={{ padding: "22px 26px", background: token.colorBgContainer, borderRadius: 16, boxShadow: G.shadow, border: G.cardBorder, position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: G.gradient, borderRadius: "16px 0 0 16px" }} />
                <div style={{ position: "absolute", right: -40, top: -40, width: 140, height: 140, borderRadius: "50%", background: G.gradientSoft, pointerEvents: "none" }} />

                <div style={{ display: "flex", alignItems: "center", gap: 16, paddingLeft: 10 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: G.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "#fff", boxShadow: "0 6px 20px rgba(180,83,9,0.38)" }}>
                        <RocketOutlined />
                    </div>
                    <div>
                        <div style={{ fontSize: 21, fontWeight: 900, color: token.colorText, letterSpacing: "-0.5px", lineHeight: 1.2 }}>
                            Diklat & Pasaran Al-Hasanah
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 5, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 11, color: token.colorTextSecondary, fontWeight: 500 }}>Panel Verifikasi Pendaftaran Peserta</span>
                            {activeConfig && (
                                <span style={{ fontSize: 10, padding: "2px 10px", borderRadius: 20, background: G.bg, border: `1px solid ${G.border}`, color: G.text, fontWeight: 800, letterSpacing: "0.5px" }}>
                                    ✦ Config {activeConfig.tahun_hijriah}H Aktif
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <Space size={8}>
                    <Button icon={<SyncOutlined spin={tableQueryResult.isFetching} />} onClick={() => tableQueryResult.refetch()} style={{ border: G.cardBorder, borderRadius: 9, height: 38, color: token.colorTextSecondary }}>
                        Refresh
                    </Button>
                    <Button icon={<DownloadOutlined />} loading={loadingExport} onClick={handleExport} style={{ borderRadius: 9, fontWeight: 700, height: 38, border: "1.5px solid rgba(16,185,129,0.28)", color: "#059669", background: "rgba(16,185,129,0.07)" }}>
                        Export Excel
                    </Button>
                </Space>
            </div>

            {/* ══ FILTER BAR ════════════════════════════ */}
            <Card bordered={false} bodyStyle={{ padding: "16px 20px" }} style={{ background: token.colorBgContainer, borderRadius: 16, boxShadow: G.shadow, border: `1px solid ${G.border}`, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: G.gradient }} />
                <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: G.bg, border: `1px solid ${G.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <CalendarOutlined style={{ color: G.text, fontSize: 14 }} />
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "1.2px", textTransform: "uppercase", color: G.text }}>Filter Periode</span>
                    </div>
                    <div style={{ width: 1, height: 32, background: G.border }} />
                    <div>
                        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 5 }}>Jenis Pasaran</div>
                        <Select value={filterJenis} onChange={setFilterJenis} style={{ width: 230 }} options={JENIS_OPTIONS} />
                    </div>
                    <div>
                        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 5 }}>Tahun Hijriah</div>
                        <InputNumber value={filterTahun} onChange={(v) => setFilterTahun(v as number)} addonAfter={<span style={{ color: G.text, fontWeight: 700, fontSize: 11 }}>H</span>} style={{ width: 120 }} />
                    </div>
                    <div style={{ marginLeft: "auto", padding: "8px 16px", borderRadius: 10, background: G.bg, border: `1px solid ${G.border}`, display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 0 3px rgba(16,185,129,0.20)" }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: token.colorTextSecondary }}>{totalPeserta} Peserta Terdaftar</span>
                    </div>
                </div>
            </Card>

            {/* ══ KPI CARDS ══════════════════════════════ */}
            <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} xl={6}>
                    <KpiCard label="Total Peserta" value={<span style={{ fontSize: 38 }}>{totalPeserta}</span>} sub={`Pasaran ${filterJenis} ${filterTahun}H`} color={isDark ? "#F59E0B" : "#B45309"} gradient={G.gradient} icon={<TeamOutlined />} />
                </Col>
                <Col xs={24} sm={12} xl={6}>
                    <KpiCard label="Terverifikasi / Lunas" value={<span style={{ fontSize: 38 }}>{stats.lunas}</span>} sub={`Dari ${totalPeserta} total pendaftar`} color="#059669" gradient="linear-gradient(135deg, #065F46 0%, #059669 55%, #10B981 100%)" icon={<SafetyCertificateOutlined />} />
                </Col>
                <Col xs={24} sm={12} xl={6}>
                    <KpiCard label="Menunggu Verifikasi" value={<span style={{ fontSize: 38 }}>{stats.pending}</span>} sub={stats.pending > 0 ? "Segera lakukan konfirmasi" : "Semua sudah terverifikasi"} color={stats.pending > 0 ? "#D97706" : "#059669"} gradient={stats.pending > 0 ? "linear-gradient(135deg, #78350F 0%, #D97706 55%, #F59E0B 100%)" : "linear-gradient(135deg, #065F46 0%, #059669 100%)"} icon={<ClockCircleOutlined />} />
                </Col>
                <Col xs={24} sm={12} xl={6}>
                    <Card bordered={false} bodyStyle={{ padding: "20px 22px 18px" }} style={{ background: token.colorBgContainer, borderRadius: 16, overflow: "hidden", position: "relative", boxShadow: G.shadow, border: G.cardBorder }}>
                        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: G.gradient }} />
                        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.2px", textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 10 }}>Grand Total Penerimaan</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: isDark ? "#F59E0B" : "#B45309", lineHeight: 1, letterSpacing: "-0.8px", marginBottom: 10 }}>{formatRp(grandTotal)}</div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                            <span style={{ fontSize: 11, color: token.colorTextTertiary }}>Kepatuhan {persentaseLunas}%</span>
                            <span style={{ fontSize: 11, color: "#059669", fontWeight: 700 }}>{stats.lunas}/{totalPeserta} Lunas</span>
                        </div>
                        <Progress percent={persentaseLunas} showInfo={false} strokeColor={G.gradient} trailColor={isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)"} strokeWidth={8} style={{ margin: 0 }} />
                    </Card>
                </Col>
            </Row>

            {/* ══ DATA TABLE ═════════════════════════════ */}
            <div style={{ background: token.colorBgContainer, borderRadius: 16, overflow: "hidden", boxShadow: G.shadow, border: G.cardBorder }}>
                <ProTable<IPesertaDiklat>
                    {...tableProps}
                    columns={columns}
                    rowKey="id"
                    search={false}
                    className="diklat-table"
                    scroll={{ x: 1300 }}
                    headerTitle={
                        <Space size={10} align="center">
                            <div style={{ width: 36, height: 36, borderRadius: 9, background: G.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, color: "#fff" }}>
                                <IdcardOutlined />
                            </div>
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: token.colorText, letterSpacing: "-0.3px" }}>Data Peserta Diklat</div>
                                <div style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 1 }}>
                                    {filterJenis} {filterTahun}H · Diperbarui: {formatHijri(new Date())}
                                </div>
                            </div>
                        </Space>
                    }
                    toolBarRender={() => [
                        <Button key="export" icon={<DownloadOutlined />} loading={loadingExport} onClick={handleExport} style={{ borderRadius: 8, fontWeight: 700 }}>Export</Button>,
                    ]}
                    cardProps={{ bodyStyle: { padding: 0 } }}
                    tableStyle={{ padding: 0 }}
                    pagination={{ ...tableProps.pagination, showSizeChanger: true, showQuickJumper: true, showTotal: (total, range) => `${range[0]}-${range[1]} dari ${total} peserta` }}
                />
            </div>

            {/* ══ MODAL PRINT ════════════════════════════ */}
            <Modal
                title={null}
                open={isPrintOpen}
                onCancel={() => setIsPrintOpen(false)}
                footer={
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                        <Button onClick={() => setIsPrintOpen(false)} style={{ borderRadius: 9 }}>Tutup</Button>
                        <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrintAction} style={{ background: G.gradient, border: "none", borderRadius: 9, fontWeight: 800, boxShadow: "0 4px 14px rgba(180,83,9,0.30)" }}>
                            Cetak Sekarang (A4)
                        </Button>
                    </div>
                }
                width={980}
                centered
                styles={{ content: { padding: 0, borderRadius: 20, overflow: "hidden" }, header: { display: "none" } }}
            >
                {/* Print Header Bar */}
                <div style={{ background: G.gradient, padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <PrinterOutlined style={{ fontSize: 18, color: "#fff" }} />
                        <span style={{ fontSize: 15, fontWeight: 800, color: "#fff", letterSpacing: "-0.3px" }}>Arsip Formulir Pendaftaran</span>
                    </div>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", fontFamily: "monospace", fontWeight: 700 }}>
                        #DIK-{printData?.qr_code_id?.slice(0, 8).toUpperCase()}
                    </span>
                </div>

                {/* Dark Preview Wrapper */}
                <div style={{ background: isDark ? "#0A0A0A" : "#374151", padding: "28px 20px", maxHeight: "80vh", overflowY: "auto", display: "flex", justifyContent: "center" }}>
                    {/* WHITE A4 */}
                    <div ref={componentRef} style={{ width: "21cm", minHeight: "29.7cm", background: "white", padding: "1cm 1.5cm", fontFamily: "'Inter', Arial, sans-serif", color: "#1F2937", position: "relative", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
                        {/* KOP SURAT */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "3px solid #111827", paddingBottom: "20px", marginBottom: "30px", position: "relative", minHeight: "100px" }}>
                            <img src="/logo.png" alt="Logo" style={{ width: "80px", height: "80px", objectFit: "contain", position: "absolute", left: 0 }} />
                            <div style={{ textAlign: "center", width: "100%", padding: "0 120px" }}>
                                <div style={{ fontSize: "20px", fontWeight: 900, color: "#B45309", lineHeight: 1.1, whiteSpace: "nowrap" }}>PONDOK PESANTREN AL-HASANAH</div>
                                <div style={{ fontSize: "12px", fontWeight: 700, color: "#4B5563", marginTop: "4px" }}>CIBEUTI - KAWALU - KOTA TASIKMALAYA - JAWA BARAT</div>
                                <div style={{ fontSize: "10px", color: "#6B7280", marginTop: "2px" }}>Jl. Raya Cibeuti No.13, Kec. Kawalu, Tasikmalaya 46182 | Telp: 0812-XXXX-XXXX</div>
                            </div>
                            <div style={{ textAlign: "right", position: "absolute", right: 0 }}>
                                <div style={{ fontSize: "10px", color: "#9CA3AF", fontWeight: 800 }}>NOMOR DOKUMEN</div>
                                <div style={{ fontSize: "15px", fontWeight: 800, fontFamily: "monospace" }}>#DIK-{printData?.qr_code_id?.slice(0, 8).toUpperCase()}</div>
                            </div>
                        </div>

                        {/* JUDUL */}
                        <div style={{ textAlign: "center", marginBottom: "30px" }}>
                            <div style={{ fontSize: "18px", fontWeight: 900, textDecoration: "underline", letterSpacing: "1px" }}>FORMULIR PENDAFTARAN & BUKTI PEMBAYARAN</div>
                            <div style={{ fontSize: "13px", fontWeight: 700, color: "#B45309", marginTop: "5px" }}>{printProgramTitle}</div>
                        </div>

                        {/* IDENTITAS */}
                        <div style={{ marginBottom: "30px" }}>
                            <div style={{ fontSize: "12px", fontWeight: 900, color: "white", backgroundColor: "#111827", padding: "6px 15px", borderRadius: "4px", marginBottom: "15px", display: "inline-block" }}>I. IDENTITAS PESERTA</div>
                            <table style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse" }}>
                                <tbody>
                                    {[
                                        { label: "Nama Lengkap", val: <strong style={{ fontSize: "15px" }}>{printData?.nama_lengkap?.toUpperCase()}</strong> },
                                        { label: "Tempat, Tanggal Lahir", val: `${printData?.tempat_lahir || "-"}, ${printData?.tanggal_lahir ? dayjs(printData.tanggal_lahir).format("DD MMMM YYYY") : "-"}` },
                                        { label: "No. WhatsApp / HP", val: printData?.no_telepon },
                                        { label: "Asal Pesantren", val: printData?.pesantren_asal },
                                        { label: "Nama Wali / Orang Tua", val: printData?.nama_wali },
                                        { label: "Pekerjaan Wali", val: printData?.pekerjaan_wali || "-" },
                                        { label: "Alamat Lengkap Rumah", val: printData?.alamat_lengkap },
                                    ].map((row) => (
                                        <tr key={row.label} style={{ borderBottom: "1px solid #F3F4F6" }}>
                                            <td style={{ width: "180px", padding: "8px 0", fontWeight: 600, verticalAlign: "top" }}>{row.label}</td>
                                            <td style={{ padding: "8px 0", lineHeight: 1.5 }}>: {row.val}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* PEMBAYARAN */}
                        <div style={{ marginBottom: "40px" }}>
                            <div style={{ fontSize: "12px", fontWeight: 900, color: "white", backgroundColor: "#111827", padding: "6px 15px", borderRadius: "4px", marginBottom: "15px", display: "inline-block" }}>II. RINCIAN PEMBAYARAN</div>
                            <div style={{ border: "2px solid #F3F4F6", borderRadius: "12px", overflow: "hidden" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                                    <thead>
                                        <tr style={{ backgroundColor: "#F9FAFB", borderBottom: "2px solid #F3F4F6" }}>
                                            <th style={{ textAlign: "left", padding: "12px 20px" }}>Deskripsi Pembayaran</th>
                                            <th style={{ textAlign: "right", padding: "12px 20px", width: "200px" }}>Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                                            <td style={{ padding: "12px 20px" }}>
                                                <div style={{ fontWeight: 700 }}>Administrasi & Akomodasi Pasaran</div>
                                                <div style={{ fontSize: "11px", color: "#6B7280", marginTop: "4px" }}>Miftah, Listrik, Konsumsi, dan Tafaruqon</div>
                                            </td>
                                            <td style={{ textAlign: "right", padding: "12px 20px", fontWeight: 700 }}>Rp {Number(printData?.biaya_pendaftaran || 0).toLocaleString()}</td>
                                        </tr>
                                        <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                                            <td style={{ padding: "12px 20px" }}>
                                                <div style={{ fontWeight: 700 }}>Pembelian Kitab Pasaran</div>
                                                <div style={{ fontSize: "11px", color: "#6B7280", marginTop: "4px" }}>Item: {printData?.rincian_belanja || "-"}</div>
                                            </td>
                                            <td style={{ textAlign: "right", padding: "12px 20px", fontWeight: 700 }}>Rp {Number(printData?.belanja_kitab_nominal || 0).toLocaleString()}</td>
                                        </tr>
                                        <tr style={{ backgroundColor: "#FFFBEB" }}>
                                            <td style={{ padding: "15px 20px", fontWeight: 900, color: "#B45309", fontSize: "14px" }}>TOTAL DIBAYARKAN (LUNAS)</td>
                                            <td style={{ textAlign: "right", padding: "15px 20px", fontWeight: 900, fontSize: "20px", color: "#111827" }}>
                                                Rp {(Number(printData?.biaya_pendaftaran || 0) + Number(printData?.belanja_kitab_nominal || 0)).toLocaleString()}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* SIGNATURE & QR */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: "30px", paddingBottom: "70px" }}>
                            <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: "11px", fontWeight: 700, marginBottom: "8px", color: "#4B5563" }}>VALIDASI SISTEM</div>
                                <div style={{ backgroundColor: "white", padding: "8px", borderRadius: "8px", display: "inline-block", border: "1px solid #F3F4F6" }}>
                                    <QRCode value={`VERIFIED_DIKLAT_${printData?.qr_code_id}`} size={95} bordered={false} bgColor="#ffffff" color="#000000" />
                                </div>
                                <div style={{ fontSize: "9px", color: "#9CA3AF", marginTop: "6px", fontWeight: 800, letterSpacing: "0.5px" }}>SCAN UNTUK VERIFIKASI</div>
                            </div>
                            <div style={{ display: "flex", gap: "60px" }}>
                                <div style={{ textAlign: "center", width: "170px" }}>
                                    <div style={{ fontSize: "12px", color: "#4B5563", marginBottom: "60px" }}>Peserta / Wali Santri,</div>
                                    <div style={{ fontWeight: 800, fontSize: "14px", borderBottom: "1.5px solid #111827", paddingBottom: "3px" }}>{printData?.nama_lengkap?.toUpperCase()}</div>
                                    <div style={{ fontSize: "10px", color: "#9CA3AF", marginTop: "4px" }}>Tanda tangan & Nama peserta </div>
                                </div>
                                <div style={{ textAlign: "center", width: "170px" }}>
                                    <div style={{ fontSize: "12px", color: "#4B5563", marginBottom: "10px" }}>Tasikmalaya, {dayjs().format("DD/MM/YYYY")}</div>
                                    <div style={{ fontSize: "12px", color: "#4B5563", marginBottom: "35px" }}>Panitia Pendaftaran,</div>
                                    <div style={{ fontWeight: 800, fontSize: "14px", borderBottom: "1.5px solid #111827", paddingBottom: "3px" }}>{formatDicatatOlehForPrint(printData?.dicatat_oleh)}</div>
                                    <div style={{ fontSize: "10px", color: "#9CA3AF", marginTop: "4px" }}>Stempel & Tanda Tangan</div>
                                </div>
                            </div>
                        </div>

                        {/* FOOTER */}
                        <div style={{ position: "absolute", bottom: "1cm", left: "1.5cm", right: "1.5cm" }}>
                            <div style={{ borderTop: "1px solid #E5E7EB", paddingTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                                <div style={{ width: "60%" }}>
                                    <div style={{ fontSize: "9px", color: "#9CA3AF", fontStyle: "italic", lineHeight: 1.4 }}>
                                        * Dokumen ini sah dan diterbitkan secara elektronik oleh sistem manajemen operasional pesantren sebagai bukti pendaftaran resmi.
                                    </div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                    <div style={{ fontSize: "10px", color: "#B45309", fontWeight: 800, letterSpacing: "0.5px" }}>BUKTI PENDAFTARAN RESMI PROGRAM DIKLAT</div>
                                    <div style={{ fontSize: "8px", color: "#D1D5DB", marginTop: "2px" }}>OFFICIAL VERIFIED ARCHIVE</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
