import React, { useState, useRef } from "react";
import { useTable, useSelect } from "@refinedev/antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import {
    Tag, Space, Button, Typography, Tooltip, Avatar, Modal, Form,
    Select, InputNumber, Input, message, DatePicker, Card, Row, Col,
    QRCode, theme, Progress, Divider,
} from "antd";
import {
    PlusOutlined, DollarOutlined, CreditCardOutlined, DownloadOutlined,
    UsergroupAddOutlined, CheckCircleOutlined, WalletOutlined,
    EditOutlined, PrinterOutlined, ShopOutlined, CalendarOutlined,
    BankOutlined, FilterOutlined, FileExcelOutlined, TeamOutlined,
    ThunderboltOutlined, DeleteOutlined, BarChartOutlined,
    ClockCircleOutlined, ExclamationCircleOutlined, RiseOutlined,
} from "@ant-design/icons";
import { ITagihanSantri, ISantri, IUserIdentity } from "../../types";
import { useNavigation, useDelete, useUpdate, useCreate, useGetIdentity } from "@refinedev/core";
import { formatHijri, formatMasehi } from "../../utility/dateHelper";
import dayjs from "dayjs";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { supabaseClient } from "../../utility/supabaseClient";
import { useReactToPrint } from "react-to-print";
import { jsPDF } from "jspdf";

const { Text } = Typography;
const { RangePicker } = DatePicker;

// ─────────────────────────────────────────────
//  UTILITIES
// ─────────────────────────────────────────────
const formatRupiah = (val: number) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(val);

// ─────────────────────────────────────────────
//  COMPONENT
// ─────────────────────────────────────────────
export const TagihanList = () => {
    const { token } = theme.useToken();
    const { push } = useNavigation();
    const { mutate: deleteMutate } = useDelete();
    const { mutate: updateMutate } = useUpdate();
    const { mutate: createTransaksi } = useCreate();
    const { data: user } = useGetIdentity<IUserIdentity>();

    // ── Dark Mode Detection ──────────────────
    const isDark = token.colorBgBase !== "#ffffff";

    // ── Gold Design System ───────────────────
    const G = {
        text: isDark ? "#F59E0B" : "#B45309",
        textSoft: isDark ? "rgba(245,158,11,0.85)" : "#92400E",
        bg: isDark ? "rgba(245,158,11,0.08)" : "rgba(212,160,23,0.06)",
        bgMid: isDark ? "rgba(245,158,11,0.14)" : "rgba(212,160,23,0.10)",
        border: isDark ? "rgba(245,158,11,0.18)" : "rgba(180,83,9,0.14)",
        borderStrong: isDark ? "rgba(245,158,11,0.35)" : "rgba(180,83,9,0.28)",
        gradient: "linear-gradient(135deg, #92400E 0%, #B45309 30%, #D4A017 65%, #F59E0B 100%)",
        gradientSoft: isDark
            ? "linear-gradient(135deg, rgba(146,64,14,0.35) 0%, rgba(245,158,11,0.18) 100%)"
            : "linear-gradient(135deg, rgba(180,83,9,0.10) 0%, rgba(245,158,11,0.05) 100%)",
        shadow: isDark
            ? "0 8px 32px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.05)"
            : "0 4px 24px rgba(0,0,0,0.07)",
        cardBorder: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.05)",
    };

    // ── Filter State ─────────────────────────
    const [filterMonth, setFilterMonth] = useState<dayjs.Dayjs>(dayjs());
    const [filterKelas, setFilterKelas] = useState<string | null>(null);
    const [filterJurusan, setFilterJurusan] = useState<string | null>(null);

    // ── Table Config ─────────────────────────
    const { tableProps, tableQueryResult } = useTable<ITagihanSantri>({
        resource: "tagihan_santri",
        syncWithLocation: false,
        liveMode: "auto",
        filters: {
            permanent: [
                {
                    field: "created_at",
                    operator: "gte",
                    value: filterMonth.startOf("month").toISOString(),
                },
                {
                    field: "created_at",
                    operator: "lte",
                    value: filterMonth.endOf("month").toISOString(),
                },
            ],
        },
        meta: { select: "*, santri!inner(nama, nis, kelas, jurusan, foto_url, wali_id)" },
        sorters: { initial: [{ field: "created_at", order: "desc" }] },
    });

    // ── Client-Side Filtering ────────────────
    const filteredData =
        tableQueryResult?.data?.data.filter((item) => {
            let pass = true;
            if (filterKelas && item.santri?.kelas !== filterKelas) pass = false;
            if (filterJurusan && item.santri?.jurusan !== filterJurusan) pass = false;
            return pass;
        }) || [];

    const finalTableProps = {
        ...tableProps,
        dataSource: filteredData,
        pagination: { ...tableProps.pagination, total: filteredData.length },
        scroll: { x: 1100 },
    };

    // ── Modal States ─────────────────────────
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isReceiptOpen, setIsReceiptOpen] = useState(false);

    // ── Logic States ─────────────────────────
    const [selectedTagihan, setSelectedTagihan] = useState<ITagihanSantri | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isLoadingExport, setIsLoadingExport] = useState(false);
    const receiptRef = useRef(null);
    const [formBulk] = Form.useForm();

    // ── Export States ────────────────────────
    const [exportType, setExportType] = useState<"GLOBAL" | "PERSONAL">("GLOBAL");
    const [exportDateRange, setExportDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>([
        dayjs().startOf("month"),
        dayjs().endOf("month"),
    ]);
    const [selectedSantriNIS, setSelectedSantriNIS] = useState<string | null>(null);

    const { selectProps: santriSelectProps } = useSelect<ISantri>({
        resource: "santri",
        optionLabel: "nama",
        optionValue: "nis",
        filters: [{ field: "status_santri", operator: "eq", value: "AKTIF" }],
        onSearch: (value) => [{ field: "nama", operator: "contains", value }],
    });

    // ── Statistics ───────────────────────────
    const totalData = filteredData.length;
    const totalLunas = filteredData.filter((i) => i.status === "LUNAS").length;
    const totalBelum = totalData - totalLunas;
    const totalNominal = filteredData.reduce((acc, curr) => acc + Number(curr.nominal_tagihan), 0);
    const totalTunggakan = filteredData.reduce(
        (acc, curr) => acc + (curr.status === "BELUM" ? Number(curr.sisa_tagihan) : 0),
        0
    );
    const totalTerpenuhi = filteredData.reduce(
        (acc, curr) => acc + (curr.status === "LUNAS" ? Number(curr.nominal_tagihan) : 0),
        0
    );
    const persentaseLunas = totalData > 0 ? Math.round((totalLunas / totalData) * 100) : 0;

    // ══════════════════════════════════════════
    //  LOGIC 1 — BAYAR TUNAI
    // ══════════════════════════════════════════
    const handleCashPayment = () => {
        if (!selectedTagihan) return;
        setIsProcessing(true);

        // Update Status Tagihan (Sinkronisasi ke Transaksi Keuangan ditangani Trigger DB v2.0)
        updateMutate(
            {
                resource: "tagihan_santri",
                id: selectedTagihan.id,
                values: { status: "LUNAS", sisa_tagihan: 0 },
                successNotification: {
                    message: "Pembayaran Tunai Berhasil",
                    description: `Tagihan atas nama ${selectedTagihan.santri?.nama} telah lunas.`,
                    type: "success",
                },
            },
            {
                onSuccess: () => {
                    setIsProcessing(false);
                    setIsPayModalOpen(false);
                    const updatedRec = { ...selectedTagihan, status: "LUNAS" as const, sisa_tagihan: 0 };
                    handlePrintReceipt(updatedRec);
                },
                onError: () => {
                    setIsProcessing(false);
                    message.error("Gagal memproses pembayaran tunai.");
                },
            }
        );
    };

    // ══════════════════════════════════════════
    //  LOGIC 2 — BAYAR MIDTRANS
    // ══════════════════════════════════════════
    const handleMidtransPayment = async () => {
        if (!selectedTagihan) return;
        try {
            message.loading("Membuka Payment Gateway...", 1);
            const { data, error } = await supabaseClient.functions.invoke("midtrans-snap", {
                body: {
                    order_id: selectedTagihan.id,
                    gross_amount: selectedTagihan.sisa_tagihan,
                    santri_nis: selectedTagihan.santri_nis,
                    wali_id: selectedTagihan.santri?.wali_id,
                    customer_details: {
                        first_name: selectedTagihan.santri?.nama,
                        email: "admin@alhasanah.com",
                        phone: "08123456789",
                    },
                    item_details: [
                        {
                            id: selectedTagihan.id,
                            price: selectedTagihan.sisa_tagihan,
                            quantity: 1,
                            name: selectedTagihan.deskripsi_tagihan.substring(0, 50),
                        },
                    ],
                },
            });
            if (error) throw error;
            if (!data.token) throw new Error("Gagal mendapatkan token");
            // @ts-ignore
            window.snap.pay(data.token, {
                onSuccess: () => {
                    message.success("Pembayaran Berhasil!");
                    setIsPayModalOpen(false);
                },
                onPending: () => {
                    message.warning("Menunggu Pembayaran...");
                    setIsPayModalOpen(false);
                },
                onError: () => message.error("Pembayaran Gagal!"),
                onClose: () => message.info("Popup ditutup"),
            });
        } catch (err: any) {
            message.error(err.message);
        }
    };

    // ══════════════════════════════════════════
    //  LOGIC 3 — GENERATE MASSAL
    // ══════════════════════════════════════════
    const handleBulkCreate = async (values: any) => {
        try {
            message.loading({ content: "Memproses tagihan massal...", key: "bulk" });
            const { data: santris, error } = await supabaseClient
                .from("santri")
                .select("nis")
                .eq("kelas", values.kelas)
                .eq("status_santri", "AKTIF");

            if (error || !santris?.length)
                throw new Error("Tidak ada santri aktif di kelas tersebut");

            const batchData = santris.map((s) => ({
                santri_nis: s.nis,
                deskripsi_tagihan: values.deskripsi,
                nominal_tagihan: values.nominal,
                sisa_tagihan: values.nominal,
                tanggal_jatuh_tempo: values.jatuh_tempo.toISOString(),
                status: "BELUM",
                jenis_pembayaran_id: 1,
            }));

            const { error: insertErr } = await supabaseClient
                .from("tagihan_santri")
                .insert(batchData);
            if (insertErr) throw insertErr;

            message.success({
                content: `Sukses membuat tagihan untuk ${santris.length} santri`,
                key: "bulk",
            });
            setIsBulkModalOpen(false);
        } catch (err: any) {
            message.error({ content: err.message, key: "bulk" });
        }
    };

    // ══════════════════════════════════════════
    //  LOGIC 4 — EXPORT EXCEL
    // ══════════════════════════════════════════
    const handleExport = async () => {
        if (!exportDateRange) {
            message.error("Pilih periode tanggal");
            return;
        }
        setIsLoadingExport(true);
        const instansi = {
            nama: "PONDOK PESANTREN AL-HASANAH",
            alamat:
                "Jl. Raya Cibeuti No.13, Cibeuti, Kec. Kawalu, Tasikmalaya, Jawa Barat 46182",
            kontak: "Telp: 0812-XXXX-XXXX | Email: info@alhasanah.com",
        };

        try {
            const startDate = exportDateRange[0].startOf("day").toISOString();
            const endDate = exportDateRange[1].endOf("day").toISOString();
            const workbook = new ExcelJS.Workbook();
            const dateStr = `${exportDateRange[0].format("DDMMYY")}_to_${exportDateRange[1].format("DDMMYY")}`;

            if (exportType === "GLOBAL") {
                const worksheet = workbook.addWorksheet("Rekap Keuangan Global");

                worksheet.mergeCells("A1:I1");
                const titleCell = worksheet.getCell("A1");
                titleCell.value = instansi.nama;
                titleCell.font = { size: 16, bold: true, color: { argb: "FFB45309" } };
                titleCell.alignment = { horizontal: "center" };

                worksheet.mergeCells("A2:I2");
                const addrCell = worksheet.getCell("A2");
                addrCell.value = instansi.alamat;
                addrCell.font = { size: 10, italic: true };
                addrCell.alignment = { horizontal: "center" };

                worksheet.addRow([]);
                worksheet
                    .addRow(["LAPORAN REKAPITULASI PEMBAYARAN SPP/TAGIHAN"])
                    .font = { bold: true };
                worksheet.addRow([
                    `Periode: ${exportDateRange[0].format("DD MMMM YYYY")} s/d ${exportDateRange[1].format("DD MMMM YYYY")}`,
                ]);
                if (filterKelas || filterJurusan) {
                    worksheet.addRow([
                        `Filter Terpasang: ${filterKelas ? "Kelas " + filterKelas : ""} ${filterJurusan ? "| " + filterJurusan : ""}`,
                    ]);
                }
                worksheet.addRow([]);

                const headerRow = worksheet.addRow([
                    "TANGGAL (M)",
                    "TANGGAL (H)",
                    "NIS",
                    "NAMA SANTRI",
                    "KELAS",
                    "TAKHAUSUS",
                    "URAIAN TAGIHAN",
                    "NOMINAL",
                    "STATUS",
                ]);
                headerRow.eachCell((cell) => {
                    cell.fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: "FFF59E0B" },
                    };
                    cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
                    cell.alignment = { horizontal: "center", vertical: "middle" };
                    cell.border = {
                        top: { style: "thin" },
                        left: { style: "thin" },
                        bottom: { style: "thin" },
                        right: { style: "thin" },
                    };
                });

                let query = supabaseClient
                    .from("tagihan_santri")
                    .select("*, santri!inner(nama, nis, kelas, jurusan)")
                    .gte("created_at", startDate)
                    .lte("created_at", endDate);

                if (filterKelas) query = query.eq("santri.kelas", filterKelas);
                if (filterJurusan) query = query.eq("santri.jurusan", filterJurusan);

                const { data: logs, error } = await query.order("created_at", {
                    ascending: false,
                });
                if (error) throw error;

                let totalNominalExport = 0;
                logs?.forEach((item, index) => {
                    totalNominalExport += Number(item.nominal_tagihan);
                    const row = worksheet.addRow([
                        formatMasehi(item.created_at),
                        formatHijri(item.created_at),
                        item.santri?.nis,
                        item.santri?.nama?.toUpperCase(),
                        item.santri?.kelas,
                        item.santri?.jurusan,
                        item.deskripsi_tagihan,
                        Number(item.nominal_tagihan),
                        item.status,
                    ]);
                    row.eachCell((cell) => {
                        cell.border = {
                            top: { style: "thin", color: { argb: "FFE5E7EB" } },
                            left: { style: "thin", color: { argb: "FFE5E7EB" } },
                            bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
                            right: { style: "thin", color: { argb: "FFE5E7EB" } },
                        };
                        if (index % 2 !== 0)
                            cell.fill = {
                                type: "pattern",
                                pattern: "solid",
                                fgColor: { argb: "FFFDF6E3" },
                            };
                    });
                });

                const footerRow = worksheet.addRow([
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "TOTAL KESELURUHAN",
                    totalNominalExport,
                    "",
                ]);
                footerRow.font = { bold: true };
                worksheet.getCell(`H${footerRow.number}`).numFmt = "#,##0";
                worksheet.autoFilter = "A7:I7";
                worksheet.views = [{ state: "frozen", ySplit: 7 }];
                [15, 20, 12, 30, 10, 15, 30, 15, 12].forEach((w, i) => {
                    worksheet.getColumn(i + 1).width = w;
                });

                const buffer = await workbook.xlsx.writeBuffer();
                saveAs(new Blob([buffer]), `Rekap_Keuangan_Global_${dateStr}.xlsx`);
            } else {
                if (!selectedSantriNIS) throw new Error("Pilih santri terlebih dahulu");
                const { data: santri } = await supabaseClient
                    .from("santri")
                    .select("*")
                    .eq("nis", selectedSantriNIS)
                    .single();
                const { data: logs } = await supabaseClient
                    .from("tagihan_santri")
                    .select("*")
                    .eq("santri_nis", selectedSantriNIS)
                    .gte("created_at", startDate)
                    .lte("created_at", endDate)
                    .order("created_at", { ascending: true });

                const worksheet = workbook.addWorksheet(`Kartu Syahriah - ${santri.nama}`);
                worksheet.mergeCells("A1:G1");
                worksheet.getCell("A1").value = instansi.nama;
                worksheet.getCell("A1").font = {
                    size: 16,
                    bold: true,
                    color: { argb: "FFB45309" },
                };
                worksheet.getCell("A1").alignment = { horizontal: "center" };
                worksheet.addRow([]);
                worksheet
                    .addRow(["KARTU KONTROL PEMBAYARAN SYAHRIAH (KARTU SPP)"])
                    .font = { bold: true };
                worksheet.addRow([`NAMA : ${santri.nama.toUpperCase()}`]);
                worksheet.addRow([`NIS  : ${santri.nis}`]);
                worksheet.addRow([`KELAS: ${santri.kelas} (${santri.jurusan})`]);
                worksheet.addRow([]);

                const headerRow = worksheet.addRow([
                    "TANGGAL (M)",
                    "TANGGAL (H)",
                    "URAIAN / BULAN",
                    "NOMINAL",
                    "DIBAYAR",
                    "SISA",
                    "STATUS",
                ]);
                headerRow.eachCell((cell) => {
                    cell.fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: "FFF59E0B" },
                    };
                    cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
                    cell.alignment = { horizontal: "center" };
                    cell.border = {
                        top: { style: "thin" },
                        left: { style: "thin" },
                        bottom: { style: "thin" },
                        right: { style: "thin" },
                    };
                });

                logs?.forEach((item) => {
                    const dibayar =
                        item.status === "LUNAS"
                            ? item.nominal_tagihan
                            : Number(item.nominal_tagihan) - Number(item.sisa_tagihan);
                    worksheet
                        .addRow([
                            formatMasehi(item.created_at),
                            formatHijri(item.created_at),
                            item.deskripsi_tagihan,
                            Number(item.nominal_tagihan),
                            dibayar,
                            Number(item.sisa_tagihan),
                            item.status,
                        ])
                        .eachCell((cell) => {
                            cell.border = {
                                top: { style: "thin", color: { argb: "FFE5E7EB" } },
                                left: { style: "thin", color: { argb: "FFE5E7EB" } },
                                bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
                                right: { style: "thin", color: { argb: "FFE5E7EB" } },
                            };
                        });
                });

                worksheet.columns.forEach((col) => { col.width = 22; });
                worksheet.getColumn(3).width = 35;
                [4, 5, 6].forEach((col) => {
                    worksheet.getColumn(col).numFmt = "#,##0";
                });

                const buffer = await workbook.xlsx.writeBuffer();
                saveAs(
                    new Blob([buffer]),
                    `Kartu_Syahriah_${santri.nama.replace(/\s+/g, "_")}_${dayjs().format("YYYY")}.xlsx`
                );
            }

            message.success("Laporan berhasil diunduh");
            setIsExportModalOpen(false);
        } catch (err: any) {
            message.error("Gagal Export: " + err.message);
        } finally {
            setIsLoadingExport(false);
        }
    };

    // ══════════════════════════════════════════
    //  LOGIC 5 — PDF RECEIPT
    // ══════════════════════════════════════════
    const downloadReceiptPdf = async (record: ITagihanSantri) => {
        const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a5" });
        const gold: [number, number, number] = [180, 83, 9];
        const emerald: [number, number, number] = [4, 120, 87];

        doc.setFillColor(249, 250, 251);
        doc.rect(0, 0, 148, 40, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(...gold);
        doc.text("AL-HASANAH", 10, 15);
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.setFont("helvetica", "normal");
        doc.text("Jl. Raya Cibeuti No.13, Cibeuti, Kec. Kawalu", 10, 22);
        doc.text("Tasikmalaya, Jawa Barat 46182 | Telp: 0812-XXXX-XXXX", 10, 26);
        doc.setFontSize(14);
        doc.setTextColor(150, 150, 150);
        doc.setFont("helvetica", "bold");
        doc.text("BUKTI BAYAR", 138, 15, { align: "right" });
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.text(`#INV-${record.id.substring(0, 8).toUpperCase()}`, 138, 22, { align: "right" });
        doc.setDrawColor(...emerald);
        doc.setLineWidth(0.8);
        doc.line(10, 35, 138, 35);
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text("DITERIMA DARI:", 10, 45);
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.text(record.santri?.nama?.toUpperCase() || "-", 10, 50);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`NIS: ${record.santri?.nis || "-"}`, 10, 55);
        doc.text(`Kelas: ${record.santri?.kelas || "-"} (${record.santri?.jurusan || "-"})`, 10, 60);
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text("TANGGAL BAYAR:", 138, 45, { align: "right" });
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.text(formatMasehi(new Date()), 138, 50, { align: "right" });
        doc.text(formatHijri(new Date()), 138, 55, { align: "right" });
        doc.setFillColor(243, 244, 246);
        doc.rect(10, 70, 128, 8, "F");
        doc.setFontSize(9);
        doc.text("URAIAN PEMBAYARAN", 12, 75);
        doc.text("NOMINAL", 136, 75, { align: "right" });
        doc.line(10, 78, 138, 78);
        doc.setFont("helvetica", "normal");
        doc.text(record.deskripsi_tagihan, 12, 85);
        doc.setFont("courier", "bold");
        doc.text(
            `Rp ${new Intl.NumberFormat("id-ID").format(record.nominal_tagihan)}`,
            136,
            85,
            { align: "right" }
        );
        doc.line(10, 92, 138, 92);
        doc.setFillColor(236, 253, 245);
        doc.rect(80, 95, 58, 15, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...emerald);
        doc.text("TOTAL LUNAS", 85, 101);
        doc.setFontSize(12);
        doc.text(
            `Rp ${new Intl.NumberFormat("id-ID").format(record.nominal_tagihan)}`,
            135,
            101,
            { align: "right" }
        );
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text("Scan untuk validasi digital", 15, 140);
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text("Bendahara,", 110, 115);
        doc.line(100, 135, 130, 135);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text("Bag. Administrasi", 100, 139);
        doc.setFontSize(7);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(150, 150, 150);
        doc.text(
            "* Bukti bayar ini sah dan dihasilkan secara otomatis oleh Al-Hasanah Digital Ecosystem.",
            74,
            145,
            { align: "center" }
        );
        doc.save(
            `Struk_Bayar_${record.santri?.nama?.replace(/\s+/g, "_")}_${dayjs().format("DDMMYY")}.pdf`
        );
    };

    const handlePrint = useReactToPrint({ contentRef: receiptRef });

    const handlePrintReceipt = (record: ITagihanSantri) => {
        const recordToPrint =
            record.sisa_tagihan === 0
                ? { ...record, status: "LUNAS" as const }
                : record;
        setSelectedTagihan(recordToPrint);
        setIsReceiptOpen(true);
    };

    // ══════════════════════════════════════════
    //  TABLE COLUMNS
    // ══════════════════════════════════════════
    const columns: ProColumns<ITagihanSantri>[] = [
        {
            title: "TANGGAL",
            dataIndex: "created_at",
            width: 155,
            fixed: "left",
            render: (_, r) => (
                <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: token.colorText, letterSpacing: "-0.2px" }}>
                        {dayjs(r.created_at).format("DD MMM YYYY")}
                    </div>
                    <div style={{ fontSize: 11, color: G.text, fontWeight: 600, marginTop: 3 }}>
                        {formatHijri(r.created_at)}
                    </div>
                </div>
            ),
        },
        {
            title: "SANTRI",
            dataIndex: "santri_nis",
            width: 265,
            render: (_, record) => (
                <Space size={12} align="center">
                    <Avatar
                        src={record.santri?.foto_url}
                        size={46}
                        icon={<UsergroupAddOutlined />}
                        style={{
                            background: G.bg,
                            border: `2px solid ${G.border}`,
                            color: G.text,
                            flexShrink: 0,
                        }}
                    />
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: token.colorText, lineHeight: 1.25 }}>
                            {record.santri?.nama}
                        </div>
                        <Space size={5} style={{ marginTop: 5 }}>
                            <span style={{
                                fontSize: 10, padding: "1px 8px", borderRadius: 4,
                                background: token.colorFillAlter,
                                border: `1px solid ${token.colorBorderSecondary}`,
                                color: token.colorTextSecondary, fontWeight: 600,
                            }}>
                                Kelas {record.santri?.kelas}
                            </span>
                            <span style={{
                                fontSize: 10, padding: "1px 8px", borderRadius: 4,
                                background: "rgba(6,182,212,0.08)",
                                border: "1px solid rgba(6,182,212,0.22)",
                                color: "#0891B2", fontWeight: 600,
                            }}>
                                {record.santri?.jurusan}
                            </span>
                        </Space>
                    </div>
                </Space>
            ),
        },
        {
            title: "URAIAN TAGIHAN",
            dataIndex: "deskripsi_tagihan",
            width: 230,
            render: (val) => (
                <span style={{ fontSize: 13, fontWeight: 500, color: token.colorText }}>
                    {val as string}
                </span>
            ),
        },
        {
            title: "NOMINAL",
            dataIndex: "nominal_tagihan",
            width: 190,
            align: "right",
            render: (_, r) => (
                <div style={{ textAlign: "right" }}>
                    <div style={{
                        fontFamily: "ui-monospace, 'Courier New', monospace",
                        fontWeight: 800, fontSize: 15,
                        color: token.colorText, letterSpacing: "-0.5px",
                    }}>
                        {formatRupiah(r.nominal_tagihan)}
                    </div>
                    {r.status !== "LUNAS" && r.sisa_tagihan > 0 && (
                        <div style={{ fontSize: 11, color: "#EF4444", fontWeight: 600, marginTop: 3 }}>
                            Sisa: {new Intl.NumberFormat("id-ID").format(r.sisa_tagihan)}
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: "STATUS",
            dataIndex: "status",
            width: 135,
            align: "center",
            render: (_, r) => {
                const isLunas = r.status === "LUNAS";
                return (
                    <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "5px 14px", borderRadius: 20,
                        fontSize: 11, fontWeight: 800, letterSpacing: "0.6px",
                        background: isLunas ? "rgba(16,185,129,0.10)" : "rgba(239,68,68,0.08)",
                        color: isLunas ? "#059669" : "#DC2626",
                        border: `1.5px solid ${isLunas ? "rgba(16,185,129,0.28)" : "rgba(239,68,68,0.22)"}`,
                    }}>
                        {isLunas ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
                        {r.status}
                    </span>
                );
            },
        },
        {
            title: "AKSI",
            valueType: "option",
            width: 165,
            fixed: "right",
            render: (_, record) => (
                <Space size={6}>
                    {record.status !== "LUNAS" ? (
                        <Tooltip title="Proses Pembayaran">
                            <Button
                                type="primary"
                                size="small"
                                icon={<WalletOutlined />}
                                style={{
                                    background: G.gradient,
                                    border: "none",
                                    fontWeight: 700,
                                    fontSize: 12,
                                    borderRadius: 7,
                                    boxShadow: "0 3px 10px rgba(180,83,9,0.28)",
                                    height: 30,
                                }}
                                onClick={() => { setSelectedTagihan(record); setIsPayModalOpen(true); }}
                            >
                                Bayar
                            </Button>
                        </Tooltip>
                    ) : (
                        <Tooltip title="Cetak Bukti Pembayaran">
                            <Button
                                size="small"
                                icon={<PrinterOutlined />}
                                style={{
                                    border: "1.5px solid rgba(16,185,129,0.35)",
                                    color: "#059669",
                                    background: "rgba(16,185,129,0.07)",
                                    borderRadius: 7,
                                    fontWeight: 700,
                                    fontSize: 12,
                                    height: 30,
                                }}
                                onClick={() => handlePrintReceipt(record)}
                            >
                                Struk
                            </Button>
                        </Tooltip>
                    )}
                    {record.status !== "LUNAS" && (
                        <>
                            <Tooltip title="Edit Tagihan">
                                <Button
                                    size="small"
                                    icon={<EditOutlined />}
                                    style={{
                                        borderRadius: 7,
                                        border: `1.5px solid ${G.border}`,
                                        color: G.text, background: G.bg,
                                        width: 30, height: 30,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                    }}
                                    onClick={() => push(`/tagihan/edit/${record.id}`)}
                                />
                            </Tooltip>
                            <Tooltip title="Hapus Tagihan">
                                <Button
                                    size="small"
                                    danger
                                    icon={<DeleteOutlined />}
                                    style={{
                                        borderRadius: 7,
                                        width: 30, height: 30,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                    }}
                                    onClick={() => {
                                        if (confirm("Hapus tagihan ini? Tindakan tidak dapat dibatalkan."))
                                            deleteMutate({ resource: "tagihan_santri", id: record.id });
                                    }}
                                />
                            </Tooltip>
                        </>
                    )}
                </Space>
            ),
        },
    ];

    // ══════════════════════════════════════════
    //  SUB-COMPONENT: KPI STAT CARD
    // ══════════════════════════════════════════
    const KpiCard = ({
        label, value, sub, color, gradient, icon,
    }: {
        label: string; value: React.ReactNode; sub?: string;
        color: string; gradient: string; icon: React.ReactNode;
    }) => (
        <Card
            bordered={false}
            bodyStyle={{ padding: "20px 22px 18px" }}
            style={{
                background: token.colorBgContainer,
                borderRadius: 16,
                overflow: "hidden",
                position: "relative",
                boxShadow: G.shadow,
                border: G.cardBorder,
            }}
        >
            <div style={{
                position: "absolute", top: 0, left: 0, right: 0,
                height: 3, background: gradient,
            }} />
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ flex: 1 }}>
                    <div style={{
                        fontSize: 10, fontWeight: 800, letterSpacing: "1.2px",
                        textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 10,
                    }}>
                        {label}
                    </div>
                    <div style={{
                        fontSize: 24, fontWeight: 900, color,
                        lineHeight: 1, letterSpacing: "-1px", marginBottom: 8,
                    }}>
                        {value}
                    </div>
                    {sub && (
                        <div style={{ fontSize: 12, color: token.colorTextSecondary, fontWeight: 500 }}>
                            {sub}
                        </div>
                    )}
                </div>
                <div style={{
                    width: 50, height: 50, borderRadius: 13, background: gradient,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 20, color: "#fff", flexShrink: 0, marginLeft: 14,
                    boxShadow: `0 6px 16px ${color}35`,
                }}>
                    {icon}
                </div>
            </div>
        </Card>
    );

    // ══════════════════════════════════════════
    //  RENDER
    // ══════════════════════════════════════════
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingBottom: 80 }}>

            {/* ── Premium CSS Injection ── */}
            <style>{`
                /* Table head premium gold style */
                .alhasanah-table .ant-table-thead .ant-table-cell {
                    background: ${isDark ? "rgba(245,158,11,0.09)" : "rgba(212,160,23,0.07)"} !important;
                    font-size: 10px !important;
                    font-weight: 800 !important;
                    letter-spacing: 1.1px !important;
                    text-transform: uppercase !important;
                    color: ${G.text} !important;
                    border-bottom: 2px solid ${G.borderStrong} !important;
                    padding: 12px 14px !important;
                }
                /* Row hover gold shimmer */
                .alhasanah-table .ant-table-row:hover .ant-table-cell {
                    background: ${isDark ? "rgba(245,158,11,0.04)" : "rgba(212,160,23,0.035)"} !important;
                }
                /* Cell transitions */
                .alhasanah-table .ant-table-cell {
                    transition: background 0.18s ease !important;
                    border-bottom: 1px solid ${token.colorBorderSecondary} !important;
                    padding: 14px !important;
                }
                /* ProTable toolbar spacing */
                .alhasanah-table .ant-pro-table-list-toolbar {
                    padding: 14px 16px !important;
                    border-bottom: 1px solid ${G.border} !important;
                }
                /* Pay card hover */
                .pay-card-cash:hover  { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(180,83,9,0.20) !important; border-color: ${G.borderStrong} !important; }
                .pay-card-qris:hover  { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(6,182,212,0.18) !important; border-color: rgba(6,182,212,0.45) !important; }
                .pay-card-cash, .pay-card-qris { transition: all 0.22s cubic-bezier(.4,0,.2,1); }
                /* Scrollbar */
                .alhasanah-table .ant-table-body::-webkit-scrollbar { height: 6px; }
                .alhasanah-table .ant-table-body::-webkit-scrollbar-track { background: transparent; }
                .alhasanah-table .ant-table-body::-webkit-scrollbar-thumb { background: ${G.border}; border-radius: 3px; }
            `}</style>

            {/* ══════════════════════════════════════
                MASTHEAD
            ══════════════════════════════════════ */}
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                flexWrap: "wrap", gap: 12,
                padding: "20px 24px",
                background: token.colorBgContainer,
                borderRadius: 16, boxShadow: G.shadow, border: G.cardBorder,
                position: "relative", overflow: "hidden",
            }}>
                {/* Left accent */}
                <div style={{
                    position: "absolute", left: 0, top: 0, bottom: 0, width: 4,
                    background: G.gradient, borderRadius: "16px 0 0 16px",
                }} />
                {/* Decorative diagonal */}
                <div style={{
                    position: "absolute", right: -30, top: -30,
                    width: 120, height: 120, borderRadius: "50%",
                    background: G.gradientSoft, pointerEvents: "none",
                }} />

                <div style={{ display: "flex", alignItems: "center", gap: 14, paddingLeft: 10 }}>
                    <div style={{
                        width: 48, height: 48, borderRadius: 12,
                        background: G.gradient,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 22, color: "#fff",
                        boxShadow: "0 6px 18px rgba(180,83,9,0.38)",
                    }}>
                        <WalletOutlined />
                    </div>
                    <div>
                        <div style={{
                            fontSize: 20, fontWeight: 900, color: token.colorText,
                            letterSpacing: "-0.5px", lineHeight: 1.2,
                        }}>
                            Manajemen Tagihan Santri
                        </div>
                        <div style={{ fontSize: 12, color: token.colorTextSecondary, marginTop: 3 }}>
                            <span style={{ color: G.text, fontWeight: 700 }}>
                                {formatHijri(new Date())}
                            </span>
                            {" · "}
                            {dayjs().format("dddd, DD MMMM YYYY")}
                        </div>
                    </div>
                </div>

                <Space size={8}>
                    <Button
                        icon={<ThunderboltOutlined />}
                        onClick={() => setIsBulkModalOpen(true)}
                        style={{
                            border: `1.5px solid ${G.border}`,
                            color: G.text, background: G.bg,
                            borderRadius: 9, fontWeight: 700, height: 38,
                        }}
                    >
                        Generate Massal
                    </Button>
                    <Button
                        icon={<FileExcelOutlined />}
                        onClick={() => setIsExportModalOpen(true)}
                        style={{
                            borderRadius: 9, fontWeight: 700, height: 38,
                            border: "1.5px solid rgba(16,185,129,0.28)",
                            color: "#059669", background: "rgba(16,185,129,0.07)",
                        }}
                    >
                        Laporan
                    </Button>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => push("/tagihan/create")}
                        style={{
                            background: G.gradient, border: "none",
                            borderRadius: 9, fontWeight: 700, height: 38,
                            boxShadow: "0 4px 14px rgba(180,83,9,0.32)",
                        }}
                    >
                        Buat Tagihan
                    </Button>
                </Space>
            </div>

            {/* ══════════════════════════════════════
                KPI STATISTICS
            ══════════════════════════════════════ */}
            <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} xl={6}>
                    <KpiCard
                        label="Total Tagihan Bulan Ini"
                        value={
                            <span style={{ fontSize: 20 }}>
                                {formatRupiah(totalNominal)}
                            </span>
                        }
                        sub={`${totalData} dokumen tagihan aktif`}
                        color={isDark ? "#F59E0B" : "#B45309"}
                        gradient={G.gradient}
                        icon={<BarChartOutlined />}
                    />
                </Col>
                <Col xs={24} sm={12} xl={6}>
                    <KpiCard
                        label="Total Terpenuhi"
                        value={
                            <span style={{ fontSize: 20 }}>
                                {formatRupiah(totalTerpenuhi)}
                            </span>
                        }
                        sub={`${totalLunas} santri telah lunas`}
                        color="#059669"
                        gradient="linear-gradient(135deg, #065F46 0%, #059669 55%, #10B981 100%)"
                        icon={<CheckCircleOutlined />}
                    />
                </Col>
                <Col xs={24} sm={12} xl={6}>
                    <KpiCard
                        label="Total Tunggakan"
                        value={
                            <span style={{ fontSize: 20 }}>
                                {formatRupiah(totalTunggakan)}
                            </span>
                        }
                        sub={`${totalBelum} santri belum lunas`}
                        color="#DC2626"
                        gradient="linear-gradient(135deg, #7F1D1D 0%, #DC2626 55%, #F87171 100%)"
                        icon={<ExclamationCircleOutlined />}
                    />
                </Col>
                <Col xs={24} sm={12} xl={6}>
                    {/* Compliance Rate Card */}
                    <Card
                        bordered={false}
                        bodyStyle={{ padding: "20px 22px 18px" }}
                        style={{
                            background: token.colorBgContainer,
                            borderRadius: 16, overflow: "hidden",
                            position: "relative",
                            boxShadow: G.shadow, border: G.cardBorder,
                        }}
                    >
                        <div style={{
                            position: "absolute", top: 0, left: 0, right: 0,
                            height: 3, background: G.gradient,
                        }} />
                        <div style={{
                            fontSize: 10, fontWeight: 800, letterSpacing: "1.2px",
                            textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 10,
                        }}>
                            Tingkat Kepatuhan
                        </div>
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
                            <span style={{
                                fontSize: 36, fontWeight: 900,
                                color: isDark ? "#F59E0B" : "#B45309",
                                letterSpacing: "-2px", lineHeight: 1,
                            }}>
                                {persentaseLunas}
                                <span style={{ fontSize: 20, fontWeight: 700 }}>%</span>
                            </span>
                            <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 12, color: "#059669", fontWeight: 700 }}>
                                    ✓ {totalLunas} Lunas
                                </div>
                                <div style={{ fontSize: 12, color: "#DC2626", fontWeight: 700 }}>
                                    ⏱ {totalBelum} Pending
                                </div>
                            </div>
                        </div>
                        <Progress
                            percent={persentaseLunas}
                            showInfo={false}
                            strokeColor={G.gradient}
                            trailColor={isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)"}
                            strokeWidth={10}
                            style={{ margin: 0 }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* ══════════════════════════════════════
                FILTER BAR
            ══════════════════════════════════════ */}
            <Card
                bordered={false}
                bodyStyle={{ padding: "16px 20px" }}
                style={{
                    background: token.colorBgContainer,
                    borderRadius: 16, boxShadow: G.shadow,
                    border: `1px solid ${G.border}`,
                    position: "relative", overflow: "hidden",
                }}
            >
                <div style={{
                    position: "absolute", top: 0, left: 0, right: 0,
                    height: 2, background: G.gradient,
                }} />
                <div style={{
                    display: "flex", alignItems: "center",
                    gap: 16, flexWrap: "wrap",
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
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
                            Filter
                        </span>
                    </div>

                    <div style={{
                        width: 1, height: 32,
                        background: G.border,
                    }} />

                    <div style={{ display: "flex", flex: 1, gap: 12, flexWrap: "wrap" }}>
                        <div style={{ minWidth: 175 }}>
                            <div style={{
                                fontSize: 9, fontWeight: 800, letterSpacing: "1px",
                                textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 5,
                            }}>
                                Periode
                            </div>
                            <DatePicker.MonthPicker
                                value={filterMonth}
                                onChange={(val) => setFilterMonth(val || dayjs())}
                                allowClear={false}
                                style={{ width: "100%" }}
                                suffixIcon={<CalendarOutlined style={{ color: G.text }} />}
                            />
                        </div>
                        <div style={{ minWidth: 155 }}>
                            <div style={{
                                fontSize: 9, fontWeight: 800, letterSpacing: "1px",
                                textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 5,
                            }}>
                                Kelas
                            </div>
                            <Select
                                allowClear placeholder="Semua Kelas"
                                style={{ width: "100%" }}
                                options={[1, 2, 3].map((k) => ({ label: `Kelas ${k}`, value: `${k}` }))}
                                onChange={setFilterKelas}
                            />
                        </div>
                        <div style={{ minWidth: 155 }}>
                            <div style={{
                                fontSize: 9, fontWeight: 800, letterSpacing: "1px",
                                textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 5,
                            }}>
                                Takhasus
                            </div>
                            <Select
                                allowClear placeholder="Semua Takhasus"
                                style={{ width: "100%" }}
                                options={[
                                    { label: "Tahfidz", value: "TAHFIDZ" },
                                    { label: "Kitab", value: "KITAB" },
                                ]}
                                onChange={setFilterJurusan}
                            />
                        </div>
                    </div>

                    <div style={{ marginLeft: "auto" }}>
                        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "transparent", marginBottom: 5 }}>
                            _
                        </div>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => push("/tagihan/create")}
                            style={{
                                background: G.gradient, border: "none",
                                borderRadius: 9, fontWeight: 700,
                                boxShadow: "0 4px 12px rgba(180,83,9,0.28)",
                            }}
                        >
                            Buat Tagihan
                        </Button>
                    </div>
                </div>
            </Card>

            {/* ══════════════════════════════════════
                DATA TABLE
            ══════════════════════════════════════ */}
            <div style={{
                background: token.colorBgContainer,
                borderRadius: 16, overflow: "hidden",
                boxShadow: G.shadow, border: G.cardBorder,
            }}>
                <ProTable<ITagihanSantri>
                    {...finalTableProps}
                    columns={columns}
                    rowKey="id"
                    search={false}
                    className="alhasanah-table"
                    headerTitle={
                        <Space size={10} align="center">
                            <div style={{
                                width: 36, height: 36, borderRadius: 9,
                                background: G.gradient,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 17, color: "#fff",
                            }}>
                                <WalletOutlined />
                            </div>
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: token.colorText, letterSpacing: "-0.3px" }}>
                                    Data Tagihan Santri
                                </div>
                                <div style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 1 }}>
                                    {filterMonth.format("MMMM YYYY")}
                                    {" · "}
                                    Diperbarui: {formatHijri(new Date())}
                                </div>
                            </div>
                        </Space>
                    }
                    toolBarRender={() => [
                        <Button
                            key="bulk"
                            icon={<ThunderboltOutlined />}
                            onClick={() => setIsBulkModalOpen(true)}
                            style={{
                                border: `1.5px solid ${G.border}`,
                                color: G.text, background: G.bg,
                                borderRadius: 8, fontWeight: 700,
                            }}
                        >
                            Generate Massal
                        </Button>,
                        <Button
                            key="export"
                            icon={<DownloadOutlined />}
                            onClick={() => setIsExportModalOpen(true)}
                            style={{ borderRadius: 8, fontWeight: 700 }}
                        >
                            Export
                        </Button>,
                    ]}
                    cardProps={{ bodyStyle: { padding: 0 } }}
                    tableStyle={{ padding: 0 }}
                    pagination={{
                        ...finalTableProps.pagination,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (total, range) =>
                            `${range[0]}-${range[1]} dari ${total} tagihan`,
                    }}
                />
            </div>

            {/* ══════════════════════════════════════
                MODAL: METODE PEMBAYARAN
            ══════════════════════════════════════ */}
            <Modal
                title={null}
                open={isPayModalOpen}
                onCancel={() => setIsPayModalOpen(false)}
                footer={null}
                width={490}
                centered
                styles={{ content: { padding: 0, borderRadius: 20, overflow: "hidden" } }}
            >
                {/* Modal Gold Header */}
                <div style={{
                    background: G.gradient,
                    padding: "24px 28px 22px",
                    position: "relative", overflow: "hidden",
                }}>
                    <div style={{
                        position: "absolute", right: -20, top: -20,
                        width: 100, height: 100, borderRadius: "50%",
                        background: "rgba(255,255,255,0.10)",
                    }} />
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", letterSpacing: "2px", textTransform: "uppercase", marginBottom: 6 }}>
                        Proses Pembayaran
                    </div>
                    <div style={{ fontSize: 19, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px" }}>
                        Pilih Metode Pembayaran
                    </div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.82)", marginTop: 5, fontWeight: 500 }}>
                        {selectedTagihan?.santri?.nama}
                        {" · "}
                        <span style={{ fontFamily: "monospace", fontWeight: 700 }}>
                            {formatRupiah(selectedTagihan?.sisa_tagihan || 0)}
                        </span>
                    </div>
                </div>

                <div style={{ padding: "22px 24px 26px", background: token.colorBgContainer }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                        {/* Tunai */}
                        <button
                            className="pay-card-cash"
                            onClick={handleCashPayment}
                            disabled={isProcessing}
                            style={{
                                display: "flex", flexDirection: "column", alignItems: "center",
                                padding: "26px 18px", borderRadius: 16,
                                border: `2px solid ${G.border}`,
                                cursor: "pointer", background: G.bg,
                                boxShadow: `0 4px 14px rgba(180,83,9,0.07)`,
                                outline: "none",
                            }}
                        >
                            <div style={{
                                width: 58, height: 58, background: G.gradient,
                                borderRadius: 15, marginBottom: 14,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 26, color: "#fff",
                                boxShadow: "0 6px 20px rgba(180,83,9,0.32)",
                            }}>
                                <ShopOutlined />
                            </div>
                            <div style={{ fontWeight: 800, fontSize: 15, color: token.colorText, marginBottom: 5 }}>
                                Tunai (Cash)
                            </div>
                            <div style={{ fontSize: 11, color: token.colorTextTertiary, textAlign: "center" }}>
                                Bayar langsung di tempat
                            </div>
                        </button>

                        {/* QRIS / Midtrans */}
                        <button
                            className="pay-card-qris"
                            onClick={handleMidtransPayment}
                            style={{
                                display: "flex", flexDirection: "column", alignItems: "center",
                                padding: "26px 18px", borderRadius: 16,
                                border: "2px solid rgba(6,182,212,0.22)",
                                cursor: "pointer", background: "rgba(6,182,212,0.05)",
                                boxShadow: "0 4px 14px rgba(6,182,212,0.05)",
                                outline: "none",
                            }}
                        >
                            <div style={{
                                width: 58, height: 58,
                                background: "linear-gradient(135deg, #0891B2 0%, #06B6D4 55%, #22D3EE 100%)",
                                borderRadius: 15, marginBottom: 14,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 26, color: "#fff",
                                boxShadow: "0 6px 20px rgba(6,182,212,0.32)",
                            }}>
                                <CreditCardOutlined />
                            </div>
                            <div style={{ fontWeight: 800, fontSize: 15, color: token.colorText, marginBottom: 5 }}>
                                QRIS / Transfer
                            </div>
                            <div style={{ fontSize: 11, color: token.colorTextTertiary, textAlign: "center" }}>
                                Otomatis via Midtrans
                            </div>
                        </button>
                    </div>
                    <div style={{
                        textAlign: "center", marginTop: 16,
                        fontSize: 11, color: token.colorTextTertiary, fontStyle: "italic",
                    }}>
                        Struk digital tercetak otomatis setelah transaksi berhasil
                    </div>
                </div>
            </Modal>

            {/* ══════════════════════════════════════
                MODAL: GENERATE MASSAL
            ══════════════════════════════════════ */}
            <Modal
                title={null}
                open={isBulkModalOpen}
                onCancel={() => setIsBulkModalOpen(false)}
                footer={null}
                width={460}
                centered
                styles={{ content: { padding: 0, borderRadius: 20, overflow: "hidden" } }}
            >
                <div style={{ background: G.gradient, padding: "22px 28px 20px", position: "relative", overflow: "hidden" }}>
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
                            <ThunderboltOutlined />
                        </div>
                        <div>
                            <div style={{ fontSize: 17, fontWeight: 900, color: "#fff", letterSpacing: "-0.3px" }}>
                                Generate Tagihan Massal
                            </div>
                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>
                                Buat tagihan serentak untuk satu kelas
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ padding: "24px 28px 28px", background: token.colorBgContainer }}>
                    <Form form={formBulk} layout="vertical" onFinish={handleBulkCreate}>
                        {[
                            {
                                name: "kelas",
                                label: "Target Kelas",
                                node: (
                                    <Select
                                        placeholder="Pilih Kelas"
                                        options={[1, 2, 3].map((k) => ({ label: `Kelas ${k}`, value: `${k}` }))}
                                    />
                                ),
                                rules: [{ required: true, message: "Pilih kelas target" }],
                            },
                            {
                                name: "deskripsi",
                                label: "Deskripsi Tagihan",
                                initialValue: `SPP ${dayjs().format("MMMM YYYY")}`,
                                node: <Input placeholder="contoh: SPP Januari 2025" />,
                                rules: [{ required: true }],
                            },
                            {
                                name: "nominal",
                                label: "Nominal (Rp)",
                                initialValue: 500000,
                                node: (
                                    <InputNumber
                                        style={{ width: "100%" }}
                                        formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                                        parser={(v) => v!.replace(/,*/g, "") as unknown as number}
                                    />
                                ),
                                rules: [{ required: true }],
                            },
                            {
                                name: "jatuh_tempo",
                                label: "Jatuh Tempo",
                                initialValue: dayjs().endOf("month"),
                                node: <DatePicker style={{ width: "100%" }} format="DD MMM YYYY" />,
                                rules: [{ required: true }],
                            },
                        ].map((f) => (
                            <Form.Item
                                key={f.name}
                                name={f.name}
                                label={
                                    <span style={{
                                        fontSize: 11, fontWeight: 800,
                                        letterSpacing: "0.7px", textTransform: "uppercase",
                                        color: token.colorTextSecondary,
                                    }}>
                                        {f.label}
                                    </span>
                                }
                                initialValue={f.initialValue}
                                rules={f.rules as any}
                            >
                                {f.node}
                            </Form.Item>
                        ))}
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                            <Button onClick={() => setIsBulkModalOpen(false)} style={{ borderRadius: 9, fontWeight: 600 }}>
                                Batal
                            </Button>
                            <Button
                                type="primary"
                                htmlType="submit"
                                style={{
                                    background: G.gradient, border: "none",
                                    borderRadius: 9, fontWeight: 800,
                                    boxShadow: "0 4px 14px rgba(180,83,9,0.30)",
                                }}
                            >
                                Generate Tagihan
                            </Button>
                        </div>
                    </Form>
                </div>
            </Modal>

            {/* ══════════════════════════════════════
                MODAL: EXPORT / LAPORAN
            ══════════════════════════════════════ */}
            <Modal
                title={null}
                open={isExportModalOpen}
                onCancel={() => setIsExportModalOpen(false)}
                footer={null}
                width={510}
                centered
                styles={{ content: { padding: 0, borderRadius: 20, overflow: "hidden" } }}
            >
                <div style={{
                    background: "linear-gradient(135deg, #065F46 0%, #059669 55%, #10B981 100%)",
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
                                Unduh Laporan Keuangan
                            </div>
                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>
                                Format Excel · Pesantren Al-Hasanah
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ padding: "24px 28px 28px", background: token.colorBgContainer }}>
                    {/* Tipe Laporan */}
                    <div style={{ marginBottom: 20 }}>
                        <div style={{
                            fontSize: 10, fontWeight: 800, letterSpacing: "1.2px",
                            textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 10,
                        }}>
                            Tipe Laporan
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            {[
                                {
                                    val: "GLOBAL",
                                    label: "Rekap Global",
                                    sub: "Semua santri dalam rentang tanggal",
                                    icon: <TeamOutlined />,
                                    active: exportType === "GLOBAL",
                                },
                                {
                                    val: "PERSONAL",
                                    label: "Kartu Syahriah",
                                    sub: "Riwayat tagihan per santri",
                                    icon: <UsergroupAddOutlined />,
                                    active: exportType === "PERSONAL",
                                },
                            ].map((opt) => (
                                <button
                                    key={opt.val}
                                    onClick={() => setExportType(opt.val as any)}
                                    style={{
                                        padding: "14px 16px", borderRadius: 12, cursor: "pointer",
                                        textAlign: "left", outline: "none",
                                        transition: "all 0.18s ease",
                                        border: `2px solid ${opt.active ? "#059669" : token.colorBorder}`,
                                        background: opt.active ? "rgba(5,150,105,0.09)" : "transparent",
                                        boxShadow: opt.active ? "0 4px 14px rgba(5,150,105,0.12)" : "none",
                                    }}
                                >
                                    <div style={{
                                        fontSize: 20, marginBottom: 8,
                                        color: opt.active ? "#059669" : token.colorTextTertiary,
                                    }}>
                                        {opt.icon}
                                    </div>
                                    <div style={{ fontWeight: 800, fontSize: 13, color: token.colorText, marginBottom: 3 }}>
                                        {opt.label}
                                    </div>
                                    <div style={{ fontSize: 11, color: token.colorTextTertiary }}>
                                        {opt.sub}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Filter Global */}
                    {exportType === "GLOBAL" && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 6 }}>
                                    Filter Kelas
                                </div>
                                <Select
                                    allowClear placeholder="Semua"
                                    style={{ width: "100%" }}
                                    options={[1, 2, 3, 4, 5, 6].map((k) => ({ label: `Kelas ${k}`, value: `${k}` }))}
                                    onChange={setFilterKelas}
                                />
                            </div>
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 6 }}>
                                    Filter Takhasus
                                </div>
                                <Select
                                    allowClear placeholder="Semua"
                                    style={{ width: "100%" }}
                                    options={[
                                        { label: "Tahfidz", value: "TAHFIDZ" },
                                        { label: "Kitab", value: "KITAB" },
                                    ]}
                                    onChange={setFilterJurusan}
                                />
                            </div>
                        </div>
                    )}

                    {/* Filter Personal */}
                    {exportType === "PERSONAL" && (
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 6 }}>
                                Pilih Santri
                            </div>
                            <Select
                                {...santriSelectProps}
                                showSearch
                                placeholder="Cari nama santri..."
                                style={{ width: "100%" }}
                                onChange={(val) => setSelectedSantriNIS(val as unknown as string)}
                            />
                        </div>
                    )}

                    {/* Periode */}
                    <div style={{ marginBottom: 22 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 6 }}>
                            Periode Laporan
                        </div>
                        <RangePicker
                            value={exportDateRange}
                            onChange={(dates) => setExportDateRange(dates as any)}
                            style={{ width: "100%" }}
                            format="DD MMM YYYY"
                        />
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                        <Button
                            onClick={() => setIsExportModalOpen(false)}
                            style={{ borderRadius: 9, fontWeight: 600 }}
                        >
                            Batal
                        </Button>
                        <Button
                            loading={isLoadingExport}
                            icon={<DownloadOutlined />}
                            onClick={handleExport}
                            style={{
                                background: "linear-gradient(135deg, #065F46 0%, #059669 100%)",
                                border: "none", color: "#fff",
                                borderRadius: 9, fontWeight: 800,
                                boxShadow: "0 4px 14px rgba(5,150,105,0.30)",
                            }}
                        >
                            Download Excel
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* ══════════════════════════════════════
                MODAL: STRUK / INVOICE
            ══════════════════════════════════════ */}
            <Modal
                title={null}
                open={isReceiptOpen}
                onCancel={() => setIsReceiptOpen(false)}
                footer={
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: "4px 0 0" }}>
                        <Button
                            onClick={() => setIsReceiptOpen(false)}
                            style={{ borderRadius: 9 }}
                        >
                            Tutup
                        </Button>
                        <Button
                            icon={<DownloadOutlined />}
                            onClick={() => selectedTagihan && downloadReceiptPdf(selectedTagihan)}
                            style={{
                                border: "1.5px solid rgba(5,150,105,0.35)",
                                color: "#059669", background: "rgba(5,150,105,0.07)",
                                borderRadius: 9, fontWeight: 700,
                            }}
                        >
                            Simpan PDF
                        </Button>
                        <Button
                            type="primary"
                            icon={<PrinterOutlined />}
                            onClick={handlePrint}
                            style={{
                                background: G.gradient, border: "none",
                                borderRadius: 9, fontWeight: 800,
                                boxShadow: "0 4px 14px rgba(180,83,9,0.30)",
                            }}
                        >
                            Print Desktop
                        </Button>
                    </div>
                }
                width={680}
                centered
                styles={{ content: { borderRadius: 20, overflow: "hidden" } }}
            >
                {/* ── INVOICE BODY (always white for print) ── */}
                <div
                    ref={receiptRef}
                    style={{
                        background: "#FFFFFF",
                        padding: "0",
                        fontFamily: "'Georgia', 'Times New Roman', serif",
                    }}
                >
                    <style>{`
                        @media print {
                            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                            .no-print { display: none; }
                        }
                    `}</style>

                    {/* ── Gold Letterhead ── */}
                    <div style={{
                        background: "linear-gradient(135deg, #92400E 0%, #B45309 30%, #D4A017 65%, #F59E0B 100%)",
                        padding: "26px 32px 24px",
                        position: "relative", overflow: "hidden",
                    }}>
                        {/* Geometric decoration */}
                        <div style={{
                            position: "absolute", right: 36, top: "50%",
                            width: 72, height: 72,
                            border: "2px solid rgba(255,255,255,0.18)",
                            transform: "translateY(-50%) rotate(45deg)",
                            borderRadius: 6,
                        }} />
                        <div style={{
                            position: "absolute", right: 50, top: "50%",
                            width: 50, height: 50,
                            border: "1.5px solid rgba(255,255,255,0.12)",
                            transform: "translateY(-50%) rotate(45deg)",
                            borderRadius: 4,
                        }} />

                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <tbody>
                                <tr>
                                    <td style={{ verticalAlign: "top" }}>
                                        <div style={{
                                            fontSize: 24, fontWeight: 900, color: "#FFFFFF",
                                            letterSpacing: "3px", fontFamily: "Georgia, serif",
                                        }}>
                                            AL-HASANAH
                                        </div>
                                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.80)", marginTop: 4, fontFamily: "Arial, sans-serif" }}>
                                            Aang KH. Lili Syamsul Romli
                                        </div>
                                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", marginTop: 3, fontFamily: "Arial, sans-serif" }}>
                                            Jl. Raya Cibeuti No.13, Kawalu · Tasikmalaya 46182
                                        </div>
                                    </td>
                                    <td style={{ textAlign: "right", verticalAlign: "top" }}>
                                        <div style={{
                                            fontSize: 10, color: "rgba(255,255,255,0.70)",
                                            letterSpacing: "3px", textTransform: "uppercase",
                                            marginBottom: 5, fontFamily: "Arial, sans-serif",
                                        }}>
                                            BUKTI PEMBAYARAN
                                        </div>
                                        <div style={{
                                            fontFamily: "'Courier New', monospace",
                                            fontSize: 16, fontWeight: 900, color: "#FFFFFF", letterSpacing: "1.5px",
                                        }}>
                                            #{selectedTagihan?.id.substring(0, 8).toUpperCase()}
                                        </div>
                                        <div style={{
                                            display: "inline-block", marginTop: 8,
                                            background: "rgba(255,255,255,0.18)",
                                            border: "1.5px solid rgba(255,255,255,0.55)",
                                            color: "#FFFFFF", fontSize: 10, fontWeight: 900,
                                            padding: "3px 14px", borderRadius: 20,
                                            letterSpacing: "2.5px", fontFamily: "Arial, sans-serif",
                                        }}>
                                            ✓ LUNAS
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* ── Info Santri ── */}
                    <div style={{ padding: "24px 32px 0" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <tbody>
                                <tr>
                                    <td style={{ width: "50%", verticalAlign: "top", paddingRight: 20 }}>
                                        <div style={{
                                            fontSize: 9, textTransform: "uppercase", letterSpacing: "1.8px",
                                            fontWeight: 800, color: "#9CA3AF", marginBottom: 8,
                                            fontFamily: "Arial, sans-serif",
                                        }}>
                                            Diterima Dari
                                        </div>
                                        <div style={{ fontSize: 18, fontWeight: 900, color: "#111827", marginBottom: 4 }}>
                                            {selectedTagihan?.santri?.nama}
                                        </div>
                                        <div style={{
                                            fontSize: 12, color: "#4B5563",
                                            fontFamily: "'Courier New', monospace", marginBottom: 8,
                                        }}>
                                            NIS: {selectedTagihan?.santri?.nis}
                                        </div>
                                        <div style={{ display: "flex", gap: 6 }}>
                                            <span style={{
                                                fontSize: 10, padding: "2px 9px", borderRadius: 4,
                                                background: "#F3F4F6", color: "#374151",
                                                fontFamily: "Arial, sans-serif", fontWeight: 700,
                                            }}>
                                                Kelas {selectedTagihan?.santri?.kelas}
                                            </span>
                                            <span style={{
                                                fontSize: 10, padding: "2px 9px", borderRadius: 4,
                                                background: "#EFF6FF", color: "#1D4ED8",
                                                fontFamily: "Arial, sans-serif", fontWeight: 700,
                                            }}>
                                                {selectedTagihan?.santri?.jurusan}
                                            </span>
                                        </div>
                                    </td>
                                    <td style={{ width: "50%", verticalAlign: "top", textAlign: "right" }}>
                                        <div style={{
                                            fontSize: 9, textTransform: "uppercase", letterSpacing: "1.8px",
                                            fontWeight: 800, color: "#9CA3AF", marginBottom: 8,
                                            fontFamily: "Arial, sans-serif",
                                        }}>
                                            Tanggal Pembayaran
                                        </div>
                                        <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>
                                            {formatMasehi(new Date())}
                                        </div>
                                        <div style={{
                                            fontSize: 13, color: "#B45309", fontWeight: 700,
                                            marginTop: 3, fontFamily: "Georgia, serif",
                                        }}>
                                            {formatHijri(new Date())}
                                        </div>
                                        <div style={{
                                            fontSize: 11, color: "#9CA3AF", marginTop: 3,
                                            fontFamily: "Arial, sans-serif",
                                        }}>
                                            {dayjs().format("HH:mm")} WIB
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* ── Gold Divider ── */}
                    <div style={{ padding: "18px 32px 0" }}>
                        <div style={{
                            height: 1,
                            background: "linear-gradient(90deg, transparent 0%, #D4A017 25%, #F59E0B 50%, #D4A017 75%, transparent 100%)",
                            opacity: 0.5,
                        }} />
                    </div>

                    {/* ── Rincian Tagihan ── */}
                    <div style={{ padding: "20px 32px 0" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr>
                                    <th style={{
                                        textAlign: "left", padding: "10px 14px",
                                        background: "linear-gradient(135deg, #FEF3C7, #FDE68A)",
                                        fontSize: 9, color: "#92400E", fontWeight: 900,
                                        letterSpacing: "1.8px", textTransform: "uppercase",
                                        borderBottom: "2px solid #F59E0B",
                                        fontFamily: "Arial, sans-serif",
                                    }}>
                                        Deskripsi Tagihan
                                    </th>
                                    <th style={{
                                        textAlign: "right", padding: "10px 14px",
                                        background: "linear-gradient(135deg, #FEF3C7, #FDE68A)",
                                        fontSize: 9, color: "#92400E", fontWeight: 900,
                                        letterSpacing: "1.8px", textTransform: "uppercase",
                                        borderBottom: "2px solid #F59E0B",
                                        fontFamily: "Arial, sans-serif",
                                    }}>
                                        Jumlah
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style={{
                                        padding: "16px 14px", fontSize: 14,
                                        color: "#1F2937", borderBottom: "1px solid #F3F4F6",
                                    }}>
                                        {selectedTagihan?.deskripsi_tagihan}
                                    </td>
                                    <td style={{
                                        padding: "16px 14px", textAlign: "right",
                                        fontFamily: "'Courier New', monospace",
                                        fontSize: 14, fontWeight: 800, color: "#1F2937",
                                        borderBottom: "1px solid #F3F4F6",
                                    }}>
                                        {formatRupiah(selectedTagihan?.nominal_tagihan || 0)}
                                    </td>
                                </tr>
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td style={{
                                        padding: "14px",
                                        textAlign: "right", fontWeight: 900,
                                        color: "#374151", fontSize: 12,
                                        fontFamily: "Arial, sans-serif",
                                        letterSpacing: "0.8px", background: "#F9FAFB",
                                    }}>
                                        TOTAL DIBAYAR
                                    </td>
                                    <td style={{
                                        padding: "14px", textAlign: "right",
                                        fontFamily: "'Courier New', monospace",
                                        fontSize: 22, fontWeight: 900, color: "#059669",
                                        background: "#F0FDF4",
                                        borderTop: "2px solid #6EE7B7",
                                    }}>
                                        {formatRupiah(selectedTagihan?.nominal_tagihan || 0)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* ── Footer: QR + Signature ── */}
                    <div style={{ padding: "24px 32px 0" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <tbody>
                                <tr>
                                    <td style={{ width: "30%", textAlign: "center", verticalAlign: "bottom" }}>
                                        <QRCode
                                            value={`INV:${selectedTagihan?.id}`}
                                            size={76}
                                            bordered={false}
                                            style={{ display: "block", margin: "0 auto" }}
                                        />
                                        <div style={{
                                            fontSize: 9, color: "#9CA3AF", marginTop: 6,
                                            fontFamily: "Arial, sans-serif",
                                        }}>
                                            Scan Untuk Validasi
                                        </div>
                                    </td>
                                    <td style={{ width: "40%" }} />
                                    <td style={{ width: "30%", textAlign: "center", verticalAlign: "bottom" }}>
                                        <div style={{
                                            fontSize: 11, color: "#6B7280", marginBottom: 52,
                                            fontFamily: "Arial, sans-serif",
                                        }}>
                                            Administrasi Pesantren
                                        </div>
                                        <div style={{ borderBottom: "1.5px solid #D1D5DB", width: "100%" }} />
                                        <div style={{
                                            fontSize: 11, fontWeight: 800, marginTop: 6, color: "#374151",
                                            fontFamily: "Arial, sans-serif",
                                        }}>
                                            ( Bendahara Pesantren )
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* ── Footer Note ── */}
                    <div style={{
                        margin: "22px 32px 28px",
                        padding: "10px 16px",
                        background: "linear-gradient(135deg, #FFFBEB, #FEF3C7)",
                        border: "1px solid rgba(245,158,11,0.28)",
                        borderRadius: 8, textAlign: "center",
                        fontSize: 9, color: "#92400E", fontStyle: "italic",
                        fontFamily: "Arial, sans-serif",
                    }}>
                        Dokumen ini adalah bukti pembayaran yang sah dari Sistem Informasi Pesantren Al-Hasanah.
                        Harap disimpan sebagai arsip pembayaran Anda.
                    </div>
                </div>
            </Modal>
        </div>
    );
};
