import React, { useEffect, useState, useRef, useMemo } from "react";
import { useTable, useSelect } from "@refinedev/antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import {
    Space, Button, Typography, Tooltip, Avatar, Modal, Form,
    Select, InputNumber, Input, message, DatePicker, Card, Row, Col,
    QRCode, theme, Progress, Drawer,
} from "antd";
import {
    PlusOutlined, CreditCardOutlined, DownloadOutlined,
    UsergroupAddOutlined, CheckCircleOutlined, WalletOutlined,
    EditOutlined, PrinterOutlined, ShopOutlined, CalendarOutlined,
    FilterOutlined, FileExcelOutlined, TeamOutlined,
    ThunderboltOutlined, DeleteOutlined, BarChartOutlined,
    ClockCircleOutlined, ExclamationCircleOutlined,
} from "@ant-design/icons";
import { IRefJenisPembayaran, ITagihanSantri, ISantri, IPembayaranTagihan, StatusTagihan, IUserIdentity } from "../../types";
import { useNavigation, useDelete, useGetIdentity } from "@refinedev/core";
import { formatHijri, formatMasehi } from "../../utility/dateHelper";
import { santriAlias } from "../../utility/privacy";
import { buildSpecialRateMap, loadSpecialRates, resolveNominalWithSpecialRate } from "../../utility/paymentRates";
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

const formatPaymentPeriod = (value: dayjs.Dayjs) => value.format("MMMM YYYY");

type TagihanSantriGroup = {
    key: string;
    santri_nis: string;
    santri?: ISantri;
    tagihan: ITagihanSantri[];
    total_nominal: number;
    total_dibayar: number;
    total_sisa: number;
    total_tagihan: number;
    jumlah_belum: number;
    jumlah_cicilan: number;
    jumlah_lunas: number;
    status: StatusTagihan;
};

// ─────────────────────────────────────────────
//  COMPONENT
// ─────────────────────────────────────────────
export const TagihanList = () => {
    const { token } = theme.useToken();
    const { push } = useNavigation();
    const { mutate: deleteMutate } = useDelete();

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
    const [filterStatus, setFilterStatus] = useState<StatusTagihan | null>(null);
    const [filterGender, setFilterGender] = useState<string | null>(null);

    // ── RBAC Scoping ──────────────────────────
    const { data: user } = useGetIdentity<IUserIdentity>();

    const scope = useMemo(() => {
        if (!user) return { restricted: false, lockedGender: null as string | null, lockedJurusan: null as string | null };
        if (["super_admin", "rois", "dewan"].includes(user.role)) return { restricted: false, lockedGender: null, lockedJurusan: null };
        if (user.scopeGender === 'P') return { restricted: true, lockedGender: 'P', lockedJurusan: 'ALL' };
        if (user.scopeGender === 'L') return { restricted: true, lockedGender: 'L', lockedJurusan: user.scopeJurusan };
        return { restricted: false, lockedGender: null, lockedJurusan: null };
    }, [user]);

    useEffect(() => {
        if (scope.restricted) {
            if (scope.lockedGender) setFilterGender(scope.lockedGender);
            if (scope.lockedJurusan && scope.lockedJurusan !== 'ALL') {
                setFilterJurusan(scope.lockedJurusan);
            } else {
                setFilterJurusan(null);
            }
        }
    }, [scope]);

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
        meta: { select: "*, santri!inner(nama, nis, kelas, jurusan, wali_id, jenis_kelamin)" },
        sorters: { initial: [{ field: "created_at", order: "desc" }] },
        pagination: { mode: "client", pageSize: 50 },
    });

    // ── Client-Side Filtering ────────────────
    const filteredData =
        tableQueryResult?.data?.data.filter((item) => {
            let pass = true;
            if (filterKelas && item.santri?.kelas !== filterKelas) pass = false;
            if (filterJurusan && item.santri?.jurusan !== filterJurusan) pass = false;
            if (filterStatus && item.status !== filterStatus) pass = false;
            if (filterGender && item.santri?.jenis_kelamin !== filterGender) pass = false;
            return pass;
        }) || [];

    const groupedData = Array.from(
        filteredData.reduce((map, item) => {
            const key = item.santri_nis || item.santri?.nis || item.id;
            const current = map.get(key) || {
                key,
                santri_nis: key,
                santri: item.santri,
                tagihan: [],
                total_nominal: 0,
                total_dibayar: 0,
                total_sisa: 0,
                total_tagihan: 0,
                jumlah_belum: 0,
                jumlah_cicilan: 0,
                jumlah_lunas: 0,
                status: "LUNAS" as StatusTagihan,
            };

            const nominal = Number(item.nominal_tagihan || 0);
            const sisa = Number(item.sisa_tagihan || 0);
            current.tagihan.push(item);
            current.total_nominal += nominal;
            current.total_sisa += sisa;
            current.total_dibayar += Math.max(nominal - sisa, 0);
            current.total_tagihan += 1;
            if (item.status === "BELUM") current.jumlah_belum += 1;
            if (item.status === "CICILAN") current.jumlah_cicilan += 1;
            if (item.status === "LUNAS") current.jumlah_lunas += 1;
            current.status = current.jumlah_belum > 0
                ? "BELUM"
                : current.jumlah_cicilan > 0
                    ? "CICILAN"
                    : "LUNAS";
            map.set(key, current);
            return map;
        }, new Map<string, TagihanSantriGroup>()).values()
    ).sort((a, b) => {
        const latestA = Math.max(...a.tagihan.map((item) => dayjs(item.created_at).valueOf()));
        const latestB = Math.max(...b.tagihan.map((item) => dayjs(item.created_at).valueOf()));
        return latestB - latestA;
    });

    const finalTableProps = {
        dataSource: groupedData,
        loading: tableQueryResult.isLoading || tableQueryResult.isFetching,
        pagination: {
            ...(typeof tableProps.pagination === "object" ? tableProps.pagination : {}),
            total: groupedData.length,
            pageSize: typeof tableProps.pagination === "object" ? tableProps.pagination.pageSize || 50 : 50,
        },
        scroll: { x: 980 },
    };

    // ── Modal States ─────────────────────────
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isReceiptOpen, setIsReceiptOpen] = useState(false);
    const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);

    // ── Logic States ─────────────────────────
    const [selectedTagihan, setSelectedTagihan] = useState<ITagihanSantri | null>(null);
    const [selectedGroup, setSelectedGroup] = useState<TagihanSantriGroup | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isLoadingExport, setIsLoadingExport] = useState(false);
    const [paymentRefs, setPaymentRefs] = useState<IRefJenisPembayaran[]>([]);
    const [isLoadingPaymentRefs, setIsLoadingPaymentRefs] = useState(false);
    const [paymentHistory, setPaymentHistory] = useState<IPembayaranTagihan[]>([]);
    const [isLoadingPaymentHistory, setIsLoadingPaymentHistory] = useState(false);
    const receiptRef = useRef(null);
    const [formBulk] = Form.useForm();
    const [formPay] = Form.useForm();

    const loadPaymentRefs = async () => {
        setIsLoadingPaymentRefs(true);
        try {
            const { data, error } = await supabaseClient
                .from("ref_jenis_pembayaran")
                .select("*")
                .eq("is_aktif", true)
                .order("id", { ascending: true });

            if (error) throw error;
            setPaymentRefs((data || []) as IRefJenisPembayaran[]);
        } catch (err: any) {
            message.error(`Gagal memuat master pembayaran: ${err.message}`);
        } finally {
            setIsLoadingPaymentRefs(false);
        }
    };

    useEffect(() => {
        loadPaymentRefs();
    }, []);

    const openBulkGenerateModal = () => {
        const monthlyRefs = paymentRefs
            .filter((item) => item.tipe === "bulanan")
            .map((item) => item.id);

        formBulk.setFieldsValue({
            kelas: ["1", "2", "3"],
            payment_ref_ids: monthlyRefs,
            gender: scope.lockedGender || undefined,
            jurusan: scope.lockedJurusan === 'ALL' ? 'ALL' : (scope.lockedJurusan || undefined),
            periode: dayjs(),
            jatuh_tempo: dayjs().endOf("month"),
        });
        setIsBulkModalOpen(true);
    };

    const loadPaymentHistory = async (tagihanId: string) => {
        setIsLoadingPaymentHistory(true);
        try {
            const { data, error } = await supabaseClient
                .from("pembayaran_tagihan")
                .select("*, transaksi:transaksi_id(id, metode_pembayaran, status_transaksi, status, midtrans_order_id)")
                .eq("tagihan_id", tagihanId)
                .order("paid_at", { ascending: false, nullsFirst: false })
                .order("created_at", { ascending: false });

            if (error) throw error;
            setPaymentHistory((data || []) as IPembayaranTagihan[]);
        } catch (err: any) {
            message.error(`Gagal memuat riwayat cicilan: ${err.message}`);
        } finally {
            setIsLoadingPaymentHistory(false);
        }
    };

    const openPaymentModal = (record: ITagihanSantri) => {
        setSelectedTagihan(record);
        setPaymentHistory([]);
        formPay.setFieldsValue({
            amount: Number(record.sisa_tagihan || 0),
            metode_pembayaran: "cash",
            keterangan: "",
        });
        setIsPayModalOpen(true);
        loadPaymentHistory(record.id);
    };

    const openDetailDrawer = (group: TagihanSantriGroup) => {
        setSelectedGroup(group);
        setIsDetailDrawerOpen(true);
    };

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
        meta: { select: "nama, nis, kelas, jurusan, status_santri" },
        filters: [{ field: "status_santri", operator: "eq", value: "AKTIF" }],
        onSearch: (value) => [
            { field: "nama", operator: "contains", value },
            { field: "nis", operator: "contains", value },
        ],
    });

    // ── Statistics ───────────────────────────
    const totalData = filteredData.length;
    const totalLunas = filteredData.filter((i) => i.status === "LUNAS").length;
    const totalBelum = filteredData.filter((i) => i.status === "BELUM").length;
    const totalCicilan = filteredData.filter((i) => i.status === "CICILAN").length;
    const totalNominal = filteredData.reduce((acc, curr) => acc + Number(curr.nominal_tagihan), 0);
    const totalTunggakan = filteredData.reduce(
        (acc, curr) => acc + (curr.status !== "LUNAS" ? Number(curr.sisa_tagihan) : 0),
        0
    );
    const totalTerpenuhi = filteredData.reduce(
        (acc, curr) => acc + Math.max(Number(curr.nominal_tagihan || 0) - Number(curr.sisa_tagihan || 0), 0),
        0
    );
    const persentaseLunas = totalData > 0 ? Math.round((totalLunas / totalData) * 100) : 0;
    const paymentRefById = new Map(paymentRefs.map((ref) => [Number(ref.id), ref]));
    const paymentTypeSummary = filteredData.reduce((summary, item) => {
        const ref = paymentRefById.get(Number(item.jenis_pembayaran_id));
        const labelSource = `${ref?.nama_pembayaran || ""} ${item.deskripsi_tagihan || ""}`.toLowerCase();
        const key = labelSource.includes("spp") || labelSource.includes("syahriah")
            ? "spp"
            : labelSource.includes("listrik")
                ? "listrik"
                : labelSource.includes("kas")
                    ? "kas"
                    : "lainnya";
        const current = summary[key];
        const nominal = Number(item.nominal_tagihan || 0);
        const sisa = Number(item.sisa_tagihan || 0);
        current.total += nominal;
        current.paid += Math.max(nominal - sisa, 0);
        current.remaining += item.status !== "LUNAS" ? sisa : 0;
        current.count += 1;
        if (item.status === "BELUM") current.belum += 1;
        if (item.status === "CICILAN") current.cicilan += 1;
        if (item.status === "LUNAS") current.lunas += 1;
        return summary;
    }, {
        spp: { label: "SPP", total: 0, paid: 0, remaining: 0, count: 0, belum: 0, cicilan: 0, lunas: 0, color: "#B45309", icon: <WalletOutlined /> },
        listrik: { label: "Listrik", total: 0, paid: 0, remaining: 0, count: 0, belum: 0, cicilan: 0, lunas: 0, color: "#2563EB", icon: <ThunderboltOutlined /> },
        kas: { label: "Kas", total: 0, paid: 0, remaining: 0, count: 0, belum: 0, cicilan: 0, lunas: 0, color: "#059669", icon: <ShopOutlined /> },
        lainnya: { label: "Lainnya", total: 0, paid: 0, remaining: 0, count: 0, belum: 0, cicilan: 0, lunas: 0, color: "#7C3AED", icon: <BarChartOutlined /> },
    });
    const paymentTypeSummaryRows = Object.values(paymentTypeSummary);

    // ══════════════════════════════════════════
    //  LOGIC 1 — BAYAR TUNAI
    // ══════════════════════════════════════════
    const handleCashPayment = async () => {
        if (!selectedTagihan) return;
        setIsProcessing(true);
        try {
            const values = await formPay.validateFields();
            const remaining = Number(selectedTagihan.sisa_tagihan || 0);
            let amount = Number(values.amount || 0);
            if (amount <= 0) throw new Error("Nominal pembayaran harus lebih dari 0.");
            if (amount > remaining) {
                amount = remaining;
                formPay.setFieldValue("amount", remaining);
                message.info("Nominal pembayaran disesuaikan otomatis ke sisa tagihan.");
            }

            const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
            if (sessionError) throw sessionError;
            const accessToken = sessionData.session?.access_token;
            if (!accessToken) throw new Error("Sesi admin tidak ditemukan. Silakan login ulang.");

            const { error } = await supabaseClient.functions.invoke("tagihan-payment-record", {
                headers: { Authorization: `Bearer ${accessToken}` },
                body: {
                    tagihan_id: selectedTagihan.id,
                    amount,
                    metode_pembayaran: values.metode_pembayaran || "cash",
                    keterangan: values.keterangan?.trim() || `Pembayaran manual ${selectedTagihan.deskripsi_tagihan}`,
                },
            });

            if (error) throw error;
            message.success(amount >= Number(selectedTagihan.sisa_tagihan || 0) ? "Tagihan lunas." : "Cicilan berhasil dicatat.");
            tableQueryResult.refetch();
            await loadPaymentHistory(selectedTagihan.id);
            setIsPayModalOpen(false);
            setIsDetailDrawerOpen(false);

            if (amount >= Number(selectedTagihan.sisa_tagihan || 0)) {
                handlePrintReceipt({ ...selectedTagihan, status: "LUNAS", sisa_tagihan: 0 });
            }
        } catch (err: any) {
            message.error(err.message || "Gagal memproses pembayaran manual.");
        } finally {
            setIsProcessing(false);
        }
    };

    // ══════════════════════════════════════════
    //  LOGIC 2 — BAYAR MIDTRANS
    // ══════════════════════════════════════════
    const handleMidtransPayment = async () => {
        if (!selectedTagihan) return;
        try {
            const values = await formPay.validateFields();
            const remaining = Number(selectedTagihan.sisa_tagihan || 0);
            let amount = Number(values.amount || 0);
            if (amount <= 0) throw new Error("Nominal pembayaran harus lebih dari 0.");
            if (amount > remaining) {
                amount = remaining;
                formPay.setFieldValue("amount", remaining);
                message.info("Nominal pembayaran disesuaikan otomatis ke sisa tagihan.");
            }

            message.loading("Membuka Payment Gateway...", 1);
            const { data, error } = await supabaseClient.functions.invoke("midtrans-snap", {
                body: {
                    order_id: selectedTagihan.id,
                    gross_amount: amount,
                    santri_nis: selectedTagihan.santri_nis,
                    wali_id: selectedTagihan.santri?.wali_id,
                    customer_details: {
                        first_name: selectedTagihan?.santri?.nama || santriAlias(selectedTagihan?.santri?.nis),
                        email: "admin@alhasanah.com",
                        phone: "08123456789",
                    },
                    item_details: [
                        {
                            id: selectedTagihan.id,
                            price: amount,
                            quantity: 1,
                            name: `${amount < Number(selectedTagihan.sisa_tagihan || 0) ? "Cicilan " : ""}${selectedTagihan.deskripsi_tagihan}`.substring(0, 50),
                        },
                    ],
                },
            });
            if (error) throw error;
            if (!data.token) throw new Error("Gagal mendapatkan token");
            // @ts-expect-error Snap.js is injected globally by the Midtrans script.
            window.snap.pay(data.token, {
                onSuccess: () => {
                    message.success("Pembayaran Berhasil!");
                    setIsPayModalOpen(false);
                    setIsDetailDrawerOpen(false);
                    tableQueryResult.refetch();
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
            const selectedRefIds = (values.payment_ref_ids || []).map((id: number | string) => Number(id));
            const selectedRefs = paymentRefs.filter((ref) => selectedRefIds.includes(Number(ref.id)));
            const invalidRefs = selectedRefs.filter((ref) => Number(ref.nominal_default || 0) <= 0);

            if (!selectedRefs.length) {
                throw new Error("Pilih minimal satu jenis pembayaran.");
            }
            if (invalidRefs.length) {
                throw new Error(
                    `Nominal default belum valid untuk: ${invalidRefs
                        .map((ref) => ref.nama_pembayaran)
                        .join(", ")}. Perbarui dulu di Master Pembayaran.`
                );
            }

            const targetKelas = Array.isArray(values.kelas) ? values.kelas : [values.kelas].filter(Boolean);

            let santriQuery = supabaseClient
                .from("santri")
                .select("nis, kelas")
                .in("kelas", targetKelas)
                .eq("status_santri", "AKTIF");

            if (values.gender && values.gender !== 'ALL') {
                santriQuery = santriQuery.eq("jenis_kelamin", values.gender);
            }
            if (values.jurusan && values.jurusan !== 'ALL') {
                santriQuery = santriQuery.eq("jurusan", values.jurusan);
            }

            const { data: santris, error } = await santriQuery;

            if (error || !santris?.length)
                throw new Error("Tidak ada santri aktif di kelas target.");

            const periode = values.periode ? dayjs(values.periode) : dayjs();
            const periodLabel = formatPaymentPeriod(periode);
            const periodStart = periode.startOf("month").toISOString();
            const periodEnd = periode.endOf("month").toISOString();
            const santriNisList = santris.map((s) => s.nis);
            const specialRates = await loadSpecialRates(santriNisList, selectedRefIds);
            const specialRateMap = buildSpecialRateMap(specialRates);

            const { data: existingRows, error: existingError } = await supabaseClient
                .from("tagihan_santri")
                .select("santri_nis, jenis_pembayaran_id")
                .in("santri_nis", santriNisList)
                .in("jenis_pembayaran_id", selectedRefIds)
                .gte("created_at", periodStart)
                .lte("created_at", periodEnd);

            if (existingError) throw existingError;

            const existingKey = new Set(
                (existingRows || []).map((row) => `${row.santri_nis}:${row.jenis_pembayaran_id}`)
            );

            const batchData = santris.flatMap((s) =>
                selectedRefs
                    .filter((ref) => !existingKey.has(`${s.nis}:${ref.id}`))
                    .map((ref) => {
                        const nominal = resolveNominalWithSpecialRate(
                            specialRateMap,
                            s.nis,
                            Number(ref.id),
                            Number(ref.nominal_default),
                        );

                        return {
                            santri_nis: s.nis,
                            deskripsi_tagihan: `${ref.nama_pembayaran} ${periodLabel}`,
                            nominal_tagihan: nominal,
                            sisa_tagihan: nominal,
                            tanggal_jatuh_tempo: values.jatuh_tempo.toISOString(),
                            status: "BELUM",
                            jenis_pembayaran_id: ref.id,
                        };
                    })
            );

            if (!batchData.length) {
                throw new Error("Semua tagihan untuk kombinasi kelas, periode, dan jenis pembayaran ini sudah dibuat.");
            }

            const { error: insertErr } = await supabaseClient
                .from("tagihan_santri")
                .insert(batchData);
            if (insertErr) throw insertErr;

            const skipped = santris.length * selectedRefs.length - batchData.length;
            message.success({
                content: `Sukses membuat ${batchData.length} tagihan untuk ${santris.length} santri${skipped > 0 ? `, ${skipped} dilewati karena sudah ada` : ""}.`,
                key: "bulk",
            });
            tableQueryResult.refetch();
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
                        (item.santri?.nama || santriAlias(item.santri?.nis))?.toUpperCase(),
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
                    .select("nama, nis, kelas, jurusan")
                    .eq("nis", selectedSantriNIS)
                    .single();
                if (!santri) throw new Error("Data santri tidak ditemukan.");
                const { data: logs } = await supabaseClient
                    .from("tagihan_santri")
                    .select("*")
                    .eq("santri_nis", selectedSantriNIS)
                    .gte("created_at", startDate)
                    .lte("created_at", endDate)
                    .order("created_at", { ascending: true });

                const worksheet = workbook.addWorksheet(`Kartu Syahriah - ${santri.nama || santriAlias(santri.nis)}`);
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
                worksheet.addRow([`NAMA : ${(santri.nama || santriAlias(santri.nis)).toUpperCase()}`]);
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
                    `Kartu_Syahriah_${(santri.nama || santriAlias(santri.nis)).replace(/\s+/g, "_")}_${dayjs().format("YYYY")}.xlsx`
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
        doc.text((record.santri?.nama || santriAlias(record.santri?.nis))?.toUpperCase() || "-", 10, 50);
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
            `Struk_Bayar_${(record.santri?.nama || santriAlias(record.santri?.nis))?.replace(/\s+/g, "_")}_${dayjs().format("DDMMYY")}.pdf`
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
    const renderStatusBadge = (status: StatusTagihan) => {
        const isLunas = status === "LUNAS";
        const isCicilan = status === "CICILAN";
        return (
            <span style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "5px 14px", borderRadius: 20,
                fontSize: 11, fontWeight: 800, letterSpacing: "0.6px",
                background: isLunas
                    ? "rgba(16,185,129,0.10)"
                    : isCicilan
                        ? "rgba(245,158,11,0.12)"
                        : "rgba(239,68,68,0.08)",
                color: isLunas ? "#059669" : isCicilan ? "#B45309" : "#DC2626",
                border: `1.5px solid ${isLunas ? "rgba(16,185,129,0.28)" : isCicilan ? "rgba(245,158,11,0.30)" : "rgba(239,68,68,0.22)"}`,
            }}>
                {isLunas ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
                {status}
            </span>
        );
    };

    const tagihanColumns: ProColumns<ITagihanSantri>[] = [
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
                            {record.santri?.nama || santriAlias(record.santri?.nis)}
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
            render: (_, r) => renderStatusBadge(r.status),
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
                                onClick={() => openPaymentModal(record)}
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

    const groupColumns: ProColumns<TagihanSantriGroup>[] = [
        {
            title: "SANTRI",
            dataIndex: "santri_nis",
            width: 300,
            fixed: "left",
            render: (_, record) => (
                <Space size={12} align="center">
                    <Avatar
                        src={record.santri?.foto_url}
                        size={48}
                        icon={<UsergroupAddOutlined />}
                        style={{
                            background: G.bg,
                            border: `2px solid ${G.border}`,
                            color: G.text,
                            flexShrink: 0,
                        }}
                    />
                    <div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: token.colorText, lineHeight: 1.25 }}>
                            {record.santri?.nama || santriAlias(record.santri_nis)}
                        </div>
                        <Space size={5} style={{ marginTop: 6 }}>
                            <span style={{
                                fontSize: 10, padding: "1px 8px", borderRadius: 4,
                                background: token.colorFillAlter,
                                border: `1px solid ${token.colorBorderSecondary}`,
                                color: token.colorTextSecondary, fontWeight: 700,
                            }}>
                                NIS {record.santri_nis}
                            </span>
                            <span style={{
                                fontSize: 10, padding: "1px 8px", borderRadius: 4,
                                background: token.colorFillAlter,
                                border: `1px solid ${token.colorBorderSecondary}`,
                                color: token.colorTextSecondary, fontWeight: 700,
                            }}>
                                Kelas {record.santri?.kelas}
                            </span>
                            <span style={{
                                fontSize: 10, padding: "1px 8px", borderRadius: 4,
                                background: "rgba(6,182,212,0.08)",
                                border: "1px solid rgba(6,182,212,0.22)",
                                color: "#0891B2", fontWeight: 700,
                            }}>
                                {record.santri?.jurusan}
                            </span>
                        </Space>
                    </div>
                </Space>
            ),
        },
        {
            title: "RINGKASAN TAGIHAN",
            dataIndex: "total_tagihan",
            width: 220,
            render: (_, record) => (
                <Space size={6} wrap>
                    <span style={{ fontSize: 11, fontWeight: 800, color: token.colorText }}>
                        {record.total_tagihan} tagihan
                    </span>
                    <span style={{ fontSize: 11, color: "#DC2626", fontWeight: 700 }}>
                        {record.jumlah_belum} belum
                    </span>
                    <span style={{ fontSize: 11, color: "#B45309", fontWeight: 700 }}>
                        {record.jumlah_cicilan} cicilan
                    </span>
                    <span style={{ fontSize: 11, color: "#059669", fontWeight: 700 }}>
                        {record.jumlah_lunas} lunas
                    </span>
                </Space>
            ),
        },
        {
            title: "NOMINAL",
            dataIndex: "total_nominal",
            width: 240,
            align: "right",
            render: (_, record) => (
                <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "ui-monospace, 'Courier New', monospace", fontWeight: 900, fontSize: 15 }}>
                        {formatRupiah(record.total_nominal)}
                    </div>
                    <div style={{ fontSize: 11, color: "#059669", fontWeight: 700, marginTop: 3 }}>
                        Dibayar: {formatRupiah(record.total_dibayar)}
                    </div>
                    {record.total_sisa > 0 && (
                        <div style={{ fontSize: 11, color: "#DC2626", fontWeight: 700, marginTop: 2 }}>
                            Sisa: {formatRupiah(record.total_sisa)}
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
            render: (_, record) => renderStatusBadge(record.status),
        },
        {
            title: "AKSI",
            valueType: "option",
            width: 140,
            fixed: "right",
            render: (_, record) => (
                <Button
                    type="primary"
                    size="small"
                    icon={<WalletOutlined />}
                    onClick={() => openDetailDrawer(record)}
                    style={{
                        background: G.gradient,
                        border: "none",
                        fontWeight: 800,
                        borderRadius: 8,
                    }}
                >
                    Detail
                </Button>
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
                        onClick={openBulkGenerateModal}
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
                        sub={`${totalLunas} lunas · ${totalCicilan} cicilan`}
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
                        sub={`${totalBelum} tagihan belum lunas`}
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

            <Card
                bordered={false}
                bodyStyle={{ padding: "18px 20px" }}
                style={{
                    background: token.colorBgContainer,
                    borderRadius: 16,
                    boxShadow: G.shadow,
                    border: G.cardBorder,
                    overflow: "hidden",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                    <div>
                        <div style={{
                            fontSize: 10,
                            fontWeight: 900,
                            letterSpacing: "1.2px",
                            textTransform: "uppercase",
                            color: G.text,
                        }}>
                            Komposisi Jenis Tagihan
                        </div>
                        <div style={{ fontSize: 12, color: token.colorTextSecondary, marginTop: 3 }}>
                            Pelacakan nominal terpenuhi dan sisa berdasarkan master pembayaran
                        </div>
                    </div>
                    <div style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: token.colorTextSecondary,
                        background: token.colorFillQuaternary,
                        border: `1px solid ${token.colorBorderSecondary}`,
                        borderRadius: 999,
                        padding: "5px 10px",
                    }}>
                        {filterMonth.format("MMMM YYYY")}
                    </div>
                </div>

                <Row gutter={[12, 12]}>
                    {paymentTypeSummaryRows.map((item) => {
                        const progress = item.total > 0 ? Math.round((item.paid / item.total) * 100) : 0;
                        return (
                            <Col key={item.label} xs={24} sm={12} xl={6}>
                                <div style={{
                                    border: `1px solid ${token.colorBorderSecondary}`,
                                    borderRadius: 13,
                                    padding: "13px 14px",
                                    background: token.colorFillQuaternary,
                                    height: "100%",
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                                            <div style={{
                                                width: 30,
                                                height: 30,
                                                borderRadius: 8,
                                                background: `${item.color}18`,
                                                border: `1px solid ${item.color}30`,
                                                color: item.color,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                flexShrink: 0,
                                            }}>
                                                {item.icon}
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: 13, fontWeight: 900, color: token.colorText, lineHeight: 1.1 }}>
                                                    {item.label}
                                                </div>
                                                <div style={{ fontSize: 10, color: token.colorTextTertiary, marginTop: 2 }}>
                                                    {item.count} dokumen
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 16, fontWeight: 900, color: item.color }}>
                                            {progress}%
                                        </div>
                                    </div>

                                    <Progress
                                        percent={progress}
                                        showInfo={false}
                                        strokeColor={item.color}
                                        trailColor={isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}
                                        size="small"
                                        style={{ marginBottom: 10 }}
                                    />

                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                        <div>
                                            <div style={{ fontSize: 9, color: token.colorTextTertiary, textTransform: "uppercase", fontWeight: 800 }}>
                                                Terpenuhi
                                            </div>
                                            <div style={{ fontSize: 12, color: "#059669", fontWeight: 900 }}>
                                                {formatRupiah(item.paid)}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: "right" }}>
                                            <div style={{ fontSize: 9, color: token.colorTextTertiary, textTransform: "uppercase", fontWeight: 800 }}>
                                                Sisa
                                            </div>
                                            <div style={{ fontSize: 12, color: item.remaining > 0 ? "#DC2626" : "#059669", fontWeight: 900 }}>
                                                {formatRupiah(item.remaining)}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ marginTop: 9, fontSize: 10, color: token.colorTextSecondary }}>
                                        {item.lunas} lunas · {item.cicilan} cicilan · {item.belum} belum
                                    </div>
                                </div>
                            </Col>
                        );
                    })}
                </Row>
            </Card>

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
                                value={filterJurusan}
                                disabled={scope.restricted}
                                options={[
                                    { label: "Tahfidz", value: "TAHFIDZ" },
                                    { label: "Kitab", value: "KITAB" },
                                ]}
                                onChange={(val) => setFilterJurusan(val as string | null)}
                            />
                        </div>
                        <div style={{ minWidth: 155 }}>
                            <div style={{
                                fontSize: 9, fontWeight: 800, letterSpacing: "1px",
                                textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 5,
                            }}>
                                Gender
                            </div>
                            <Select
                                allowClear placeholder="Semua Gender"
                                style={{ width: "100%" }}
                                value={filterGender}
                                disabled={scope.restricted}
                                options={[
                                    { label: "Laki-laki", value: "L" },
                                    { label: "Perempuan", value: "P" },
                                ]}
                                onChange={(val) => setFilterGender(val as string | null)}
                            />
                        </div>
                        <div style={{ minWidth: 155 }}>
                            <div style={{
                                fontSize: 9, fontWeight: 800, letterSpacing: "1px",
                                textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 5,
                            }}>
                                Status
                            </div>
                            <Select
                                allowClear
                                placeholder="Semua Status"
                                style={{ width: "100%" }}
                                value={filterStatus}
                                options={[
                                    { label: "Belum", value: "BELUM" },
                                    { label: "Cicilan", value: "CICILAN" },
                                    { label: "Lunas", value: "LUNAS" },
                                ]}
                                onChange={(value) => setFilterStatus((value as StatusTagihan | undefined) || null)}
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
                <ProTable<TagihanSantriGroup>
                    {...finalTableProps}
                    columns={groupColumns}
                    rowKey="key"
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
                            `${range[0]}-${range[1]} dari ${total} santri`,
                    }}
                />
            </div>

            <Drawer
                title={null}
                open={isDetailDrawerOpen}
                onClose={() => setIsDetailDrawerOpen(false)}
                width={920}
                styles={{ body: { padding: 0 } }}
            >
                {selectedGroup && (
                    <div style={{ minHeight: "100%", background: token.colorBgLayout }}>
                        <div style={{
                            background: G.gradient,
                            padding: "24px 28px",
                            color: "#fff",
                        }}>
                            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "1.5px", opacity: 0.75, marginBottom: 6 }}>
                                Detail Tagihan Santri
                            </div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                                <Space size={12} align="center">
                                    <Avatar
                                        src={selectedGroup.santri?.foto_url}
                                        size={48}
                                        icon={<UsergroupAddOutlined />}
                                        style={{ background: "rgba(255,255,255,0.18)", color: "#fff" }}
                                    />
                                    <div>
                                        <div style={{ fontSize: 20, fontWeight: 900 }}>
                                            {selectedGroup.santri?.nama || santriAlias(selectedGroup.santri_nis)}
                                        </div>
                                        <div style={{ fontSize: 12, opacity: 0.82, marginTop: 3 }}>
                                            NIS {selectedGroup.santri_nis} · Kelas {selectedGroup.santri?.kelas} · {selectedGroup.santri?.jurusan}
                                        </div>
                                    </div>
                                </Space>
                                {renderStatusBadge(selectedGroup.status)}
                            </div>
                        </div>

                        <div style={{ padding: 22 }}>
                            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                                <Col xs={24} md={8}>
                                    <Card bordered={false} style={{ borderRadius: 12, boxShadow: G.shadow }}>
                                        <Text type="secondary">Total Tagihan</Text>
                                        <div style={{ fontSize: 20, fontWeight: 900, marginTop: 6 }}>
                                            {formatRupiah(selectedGroup.total_nominal)}
                                        </div>
                                    </Card>
                                </Col>
                                <Col xs={24} md={8}>
                                    <Card bordered={false} style={{ borderRadius: 12, boxShadow: G.shadow }}>
                                        <Text type="secondary">Sudah Dibayar</Text>
                                        <div style={{ fontSize: 20, fontWeight: 900, color: "#059669", marginTop: 6 }}>
                                            {formatRupiah(selectedGroup.total_dibayar)}
                                        </div>
                                    </Card>
                                </Col>
                                <Col xs={24} md={8}>
                                    <Card bordered={false} style={{ borderRadius: 12, boxShadow: G.shadow }}>
                                        <Text type="secondary">Sisa Tagihan</Text>
                                        <div style={{ fontSize: 20, fontWeight: 900, color: selectedGroup.total_sisa > 0 ? "#DC2626" : "#059669", marginTop: 6 }}>
                                            {formatRupiah(selectedGroup.total_sisa)}
                                        </div>
                                    </Card>
                                </Col>
                            </Row>

                            <ProTable<ITagihanSantri>
                                dataSource={selectedGroup.tagihan}
                                columns={tagihanColumns.filter((column) => column.title !== "SANTRI")}
                                rowKey="id"
                                search={false}
                                options={false}
                                pagination={false}
                                scroll={{ x: 860 }}
                                cardProps={{ bodyStyle: { padding: 0 } }}
                                tableStyle={{ padding: 0 }}
                            />
                        </div>
                    </div>
                )}
            </Drawer>

            {/* ══════════════════════════════════════
                MODAL: METODE PEMBAYARAN
            ══════════════════════════════════════ */}
            <Modal
                title={null}
                open={isPayModalOpen}
                onCancel={() => setIsPayModalOpen(false)}
                footer={null}
                width={720}
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
                        {selectedTagihan?.santri?.nama || santriAlias(selectedTagihan?.santri?.nis)}
                        {" · "}
                        <span style={{ fontFamily: "monospace", fontWeight: 700 }}>
                            {formatRupiah(selectedTagihan?.sisa_tagihan || 0)}
                        </span>
                    </div>
                </div>

                <div style={{ padding: "22px 24px 26px", background: token.colorBgContainer }}>
                    <Row gutter={[16, 16]}>
                        <Col xs={24} lg={11}>
                            <div style={{
                                border: `1px solid ${G.border}`,
                                borderRadius: 14,
                                padding: 16,
                                background: G.bg,
                                marginBottom: 14,
                            }}>
                                <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "1px", textTransform: "uppercase", color: G.text, marginBottom: 10 }}>
                                    Ringkasan Tagihan
                                </div>
                                {[
                                    ["Nominal", selectedTagihan?.nominal_tagihan || 0],
                                    ["Sudah Dibayar", Math.max(Number(selectedTagihan?.nominal_tagihan || 0) - Number(selectedTagihan?.sisa_tagihan || 0), 0)],
                                    ["Sisa", selectedTagihan?.sisa_tagihan || 0],
                                ].map(([label, value]) => (
                                    <div key={String(label)} style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                                        <Text type="secondary">{label}</Text>
                                        <Text strong>{formatRupiah(Number(value))}</Text>
                                    </div>
                                ))}
                                <Progress
                                    percent={
                                        selectedTagihan?.nominal_tagihan
                                            ? Math.round(((Number(selectedTagihan.nominal_tagihan) - Number(selectedTagihan.sisa_tagihan || 0)) / Number(selectedTagihan.nominal_tagihan)) * 100)
                                            : 0
                                    }
                                    strokeColor={G.gradient}
                                    showInfo={false}
                                />
                            </div>

                            <div style={{
                                border: `1px solid ${token.colorBorderSecondary}`,
                                borderRadius: 14,
                                maxHeight: 260,
                                overflowY: "auto",
                                padding: 12,
                            }}>
                                <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "1px", textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 10 }}>
                                    Riwayat Cicilan
                                </div>
                                {isLoadingPaymentHistory ? (
                                    <Text type="secondary">Memuat riwayat...</Text>
                                ) : paymentHistory.length ? (
                                    <Space direction="vertical" size={8} style={{ width: "100%" }}>
                                        {paymentHistory.map((payment) => (
                                            <div
                                                key={payment.id}
                                                style={{
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    gap: 12,
                                                    padding: "9px 10px",
                                                    borderRadius: 10,
                                                    background: token.colorFillQuaternary,
                                                }}
                                            >
                                                <div style={{ minWidth: 0 }}>
                                                    <Text strong style={{ display: "block" }}>{formatRupiah(payment.amount)}</Text>
                                                    <Text type="secondary" style={{ fontSize: 11 }}>
                                                        {payment.source === "midtrans" ? "Midtrans" : "Manual"} · {payment.metode_pembayaran}
                                                    </Text>
                                                </div>
                                                <Text type="secondary" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                                                    {payment.paid_at ? dayjs(payment.paid_at).format("DD MMM HH:mm") : "-"}
                                                </Text>
                                            </div>
                                        ))}
                                    </Space>
                                ) : (
                                    <Text type="secondary">Belum ada cicilan yang tercatat.</Text>
                                )}
                            </div>
                        </Col>

                        <Col xs={24} lg={13}>
                            <Form form={formPay} layout="vertical">
                                <Form.Item
                                    label="Nominal Pembayaran"
                                    name="amount"
                                    rules={[
                                        { required: true, message: "Nominal pembayaran wajib diisi" },
                                        {
                                            validator: (_, value) => {
                                                const amount = Number(value || 0);
                                                const max = Number(selectedTagihan?.sisa_tagihan || 0);
                                                if (amount <= 0) return Promise.reject(new Error("Nominal harus lebih dari 0"));
                                                if (amount > max) {
                                                    formPay.setFieldValue("amount", max);
                                                    message.info("Nominal pembayaran disesuaikan otomatis ke sisa tagihan.");
                                                }
                                                return Promise.resolve();
                                            },
                                        },
                                    ]}
                                >
                                    <InputNumber<number>
                                        min={1}
                                        max={Number(selectedTagihan?.sisa_tagihan || 0)}
                                        precision={0}
                                        style={{ width: "100%" }}
                                        formatter={(value) => `Rp ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
                                        parser={(value) => Number((value || "").replace(/[^\d]/g, ""))}
                                    />
                                </Form.Item>

                                <Form.Item label="Metode Manual" name="metode_pembayaran">
                                    <Select
                                        options={[
                                            { label: "Tunai / Cash", value: "cash" },
                                            { label: "Transfer Bank", value: "transfer" },
                                            { label: "QRIS Manual", value: "qris_manual" },
                                            { label: "Lainnya", value: "lainnya" },
                                        ]}
                                    />
                                </Form.Item>

                                <Form.Item label="Keterangan" name="keterangan">
                                    <Input.TextArea rows={3} placeholder="Contoh: cicilan pertama SPP bulan ini" />
                                </Form.Item>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                    <Button
                                        className="pay-card-cash"
                                        icon={<ShopOutlined />}
                                        loading={isProcessing}
                                        onClick={handleCashPayment}
                                        style={{
                                            height: 46,
                                            borderRadius: 11,
                                            fontWeight: 800,
                                            border: `1.5px solid ${G.border}`,
                                            color: G.text,
                                            background: G.bg,
                                        }}
                                    >
                                        Catat Manual
                                    </Button>
                                    <Button
                                        className="pay-card-qris"
                                        icon={<CreditCardOutlined />}
                                        onClick={handleMidtransPayment}
                                        style={{
                                            height: 46,
                                            borderRadius: 11,
                                            fontWeight: 800,
                                            border: "1.5px solid rgba(6,182,212,0.30)",
                                            color: "#0891B2",
                                            background: "rgba(6,182,212,0.06)",
                                        }}
                                    >
                                        Midtrans
                                    </Button>
                                </div>
                            </Form>

                            <div style={{
                                marginTop: 14,
                                fontSize: 11,
                                color: token.colorTextTertiary,
                                lineHeight: 1.5,
                            }}>
                                Jika nominal sama dengan sisa tagihan, status otomatis menjadi LUNAS. Jika lebih kecil, status menjadi CICILAN.
                            </div>
                        </Col>
                    </Row>
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
                                Buat SPP, listrik, kas, dan item bulanan lain dari master pembayaran
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ padding: "24px 28px 28px", background: token.colorBgContainer }}>
                    <Form form={formBulk} layout="vertical" onFinish={handleBulkCreate}>
                        <Form.Item
                            name="kelas"
                            label={
                                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.7px", textTransform: "uppercase", color: token.colorTextSecondary }}>
                                    Target Kelas
                                </span>
                            }
                            rules={[{ required: true, message: "Pilih minimal satu kelas target" }]}
                        >
                            <Select
                                mode="multiple"
                                placeholder="Pilih kelas"
                                options={[1, 2, 3].map((k) => ({ label: `Kelas ${k}`, value: `${k}` }))}
                            />
                        </Form.Item>

                        <Row gutter={12}>
                            <Col span={12}>
                                <Form.Item
                                    name="gender"
                                    label={
                                        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.7px", textTransform: "uppercase", color: token.colorTextSecondary }}>
                                            Target Gender
                                        </span>
                                    }
                                >
                                    <Select
                                        disabled={scope.restricted}
                                        allowClear
                                        placeholder="Semua Gender"
                                        options={[
                                            { label: "👦 Laki-laki", value: "L" },
                                            { label: "👧 Perempuan", value: "P" },
                                            { label: "🌐 Global",    value: "ALL" },
                                        ]}
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    name="jurusan"
                                    label={
                                        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.7px", textTransform: "uppercase", color: token.colorTextSecondary }}>
                                            Target Takhasus
                                        </span>
                                    }
                                >
                                    <Select
                                        disabled={scope.restricted && (scope.lockedGender === 'P' || (scope.lockedJurusan !== null && scope.lockedJurusan !== 'ALL'))}
                                        allowClear
                                        placeholder="Semua Takhasus"
                                        options={[
                                            { label: "📖 Tahfidz",  value: "TAHFIDZ" },
                                            { label: "📚 Kitab",    value: "KITAB" },
                                            { label: "🌐 Global",   value: "ALL" },
                                        ]}
                                    />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Form.Item
                            name="payment_ref_ids"
                            label={
                                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.7px", textTransform: "uppercase", color: token.colorTextSecondary }}>
                                    Jenis Pembayaran
                                </span>
                            }
                            rules={[{ required: true, message: "Pilih minimal satu jenis pembayaran" }]}
                        >
                            <Select
                                mode="multiple"
                                loading={isLoadingPaymentRefs}
                                placeholder="Pilih SPP, listrik, kas, dan item lain"
                                optionLabelProp="label"
                                options={paymentRefs.map((ref) => ({
                                    label: ref.nama_pembayaran,
                                    value: ref.id,
                                    disabled: Number(ref.nominal_default || 0) <= 0,
                                }))}
                            />
                        </Form.Item>

                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                            gap: 8,
                            marginTop: -8,
                            marginBottom: 18,
                        }}>
                            {paymentRefs.map((ref) => (
                                <div
                                    key={ref.id}
                                    style={{
                                        border: `1px solid ${token.colorBorderSecondary}`,
                                        borderRadius: 10,
                                        padding: "10px 12px",
                                        background: Number(ref.nominal_default || 0) > 0 ? token.colorFillQuaternary : "rgba(239,68,68,0.06)",
                                    }}
                                >
                                    <div style={{ fontSize: 12, fontWeight: 800, color: token.colorText }}>
                                        {ref.nama_pembayaran}
                                    </div>
                                    <div style={{ fontSize: 11, color: token.colorTextSecondary, marginTop: 3 }}>
                                        {formatRupiah(Number(ref.nominal_default || 0))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <Row gutter={12}>
                            <Col xs={24} md={12}>
                                <Form.Item
                                    name="periode"
                                    label={
                                        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.7px", textTransform: "uppercase", color: token.colorTextSecondary }}>
                                            Periode Tagihan
                                        </span>
                                    }
                                    rules={[{ required: true, message: "Pilih periode tagihan" }]}
                                >
                                    <DatePicker picker="month" style={{ width: "100%" }} format="MMMM YYYY" />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={12}>
                                <Form.Item
                                    name="jatuh_tempo"
                                    label={
                                        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.7px", textTransform: "uppercase", color: token.colorTextSecondary }}>
                                            Jatuh Tempo
                                        </span>
                                    }
                                    rules={[{ required: true, message: "Pilih jatuh tempo" }]}
                                >
                                    <DatePicker style={{ width: "100%" }} format="DD MMM YYYY" />
                                </Form.Item>
                            </Col>
                        </Row>

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
                                            {selectedTagihan?.santri?.nama || santriAlias(selectedTagihan?.santri?.nis)}
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
