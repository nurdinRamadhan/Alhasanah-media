import { useState, useRef, useEffect } from "react";
import { useTable } from "@refinedev/antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import { 
    Tag, Space, Button, Typography, Tooltip, Avatar, Modal, Select, 
    Card, Row, Col, Statistic, InputNumber, Form, message, Popconfirm, Input, theme} from "antd";
import { 
    PlusOutlined, PrinterOutlined, UserOutlined, 
    ShopOutlined, DownloadOutlined, DeleteOutlined,
    BankOutlined, SafetyCertificateOutlined, 
    CheckCircleOutlined,
    RocketOutlined,
    WalletOutlined,
    SyncOutlined
} from "@ant-design/icons";
import { useDelete, useCreate, useGetIdentity, useUpdate } from "@refinedev/core";
import { useReactToPrint } from 'react-to-print';
import { QRCode } from "antd";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import dayjs from 'dayjs';
import { IPesertaDiklat, IProfile, IConfigDiklat, IMasterKitab } from "../../types";
import { supabaseClient } from "../../utility/supabaseClient";
import { useColorMode } from "../../contexts/color-mode";
import { formatHijri, formatMasehi } from "../../utility/dateHelper";

const { Text, Title } = Typography;
const { useToken } = theme;

export const DiklatList = () => {
    const { token } = useToken();
    const { mode } = useColorMode();
    const { data: user } = useGetIdentity<IProfile>();
    const { mutate: deleteMutate } = useDelete();
    const { mutate: createMutate } = useCreate();
    const { mutate: updateMutate } = useUpdate();

    // STATES
    const [activeConfig, setActiveConfig] = useState<IConfigDiklat | null>(null);
    const [filterTahun, setFilterTahun] = useState<number>(1447); 
    const [filterJenis, setFilterJenis] = useState<'MAULID'|'SYABAN'|'RAMADHAN'|'DZULHIJJAH'>('RAMADHAN');
    const [masterKitab, setMasterKitab] = useState<IMasterKitab[]>([]);
    
    // MODAL & PRINT
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isPrintOpen, setIsPrintOpen] = useState(false);
    const [printData, setPrintData] = useState<IPesertaDiklat | null>(null);
    const componentRef = useRef(null);
    const [form] = Form.useForm();
    const [loadingExport, setLoadingExport] = useState(false);

    // FETCH CONFIG & KITAB
    useEffect(() => {
        const fetchData = async () => {
            // Fetch Config
            const { data: configData } = await supabaseClient
                .from("config_diklat")
                .select("*")
                .eq("is_active", true)
                .single();
            if (configData) {
                setActiveConfig(configData as IConfigDiklat);
                setFilterTahun(configData.tahun_hijriah);
            }

            // Fetch Master Kitab
            const { data: kitabData } = await supabaseClient
                .from("master_kitab")
                .select("*")
                .eq("is_active", true);
            if (kitabData) {
                setMasterKitab(kitabData as IMasterKitab[]);
            }
        };
        fetchData();
    }, []);

    // Watch values untuk kalkulasi real-time
    const formValues = Form.useWatch([], form);
    
    const calculateTotals = () => {
        const miftah = formValues?.uang_miftah || 0;
        const listrik = formValues?.biaya_listrik || 0;
        const makan = formValues?.kos_makan || 0;
        const tafaruqon = formValues?.tafaruqon || 0;
        const pendaftaran = miftah + listrik + makan + tafaruqon;

        const kitabIds = formValues?.selected_kitab_ids || [];
        const selectedKitabs = masterKitab.filter(k => kitabIds.includes(k.id));
        const kitabNominal = selectedKitabs.reduce((acc, k) => acc + k.harga, 0);

        return { pendaftaran, kitabNominal, selectedKitabs };
    };

    const { pendaftaran: totalPendaftaranDinamis, kitabNominal: totalKitabDinamis, selectedKitabs } = calculateTotals();

    // PRINT ACTION
    const handlePrintAction = useReactToPrint({
        contentRef: componentRef,
        documentTitle: `Formulir_${printData?.nama_lengkap || 'Peserta'}`,
    });

    // TABLE DATA
    const { tableProps, tableQueryResult } = useTable<IPesertaDiklat>({
        resource: "peserta_diklat",
        syncWithLocation: false,
        filters: {
            permanent: [
                { field: "tahun_diklat", operator: "eq", value: filterTahun },
                { field: "jenis_diklat", operator: "eq", value: filterJenis },
            ]
        },
        sorters: { initial: [{ field: "created_at", order: "desc" }] }
    });

    const stats = tableQueryResult?.data?.data.reduce((acc, curr) => ({
        administrasi: acc.administrasi + Number(curr.biaya_pendaftaran || 0),
        kitab: acc.kitab + Number(curr.belanja_kitab_nominal || 0),
        pending: acc.pending + (curr.status_pembayaran === 'PENDING' ? 1 : 0),
        success: acc.success + (curr.status_pembayaran === 'LUNAS' || curr.status_pembayaran === 'SUCCESS' ? 1 : 0)
    }), { administrasi: 0, kitab: 0, pending: 0, success: 0 }) || { administrasi: 0, kitab: 0, pending: 0, success: 0 };

    const grandTotal = stats.administrasi + stats.kitab;

    const handleConfirmPayment = (id: number) => {
        updateMutate({
            resource: "peserta_diklat",
            id: id.toString(),
            values: { status_pembayaran: "LUNAS" },
            successNotification: () => ({
                message: "Pembayaran dikonfirmasi. Peserta sekarang berstatus LUNAS.",
                type: "success"
            })
        });
    };

    const handleExport = async () => {
        setLoadingExport(true);
        const instansi = {
            nama: "PONDOK PESANTREN AL-HASANAH",
            alamat: "Jl. Raya Cibeuti No.13, Cibeuti, Kec. Kawalu, Tasikmalaya, Jawa Barat 46182",
            kontak: "Telp: 0812-XXXX-XXXX | Email: info@alhasanah.com",
        };

        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet(`Pasaran ${filterJenis}`);

            // 1. HEADER - KOP SURAT
            worksheet.mergeCells('A1:I1');
            const titleCell = worksheet.getCell('A1');
            titleCell.value = instansi.nama;
            titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFB45309' } };
            titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

            worksheet.mergeCells('A2:I2');
            const addrCell = worksheet.getCell('A2');
            addrCell.value = instansi.alamat;
            addrCell.font = { name: 'Arial', size: 10, italic: true };
            addrCell.alignment = { vertical: 'middle', horizontal: 'center' };

            worksheet.addRow([]); // Spacer
            worksheet.addRow([`REKAPITULASI PESERTA DIKLAT & PASARAN - ${filterJenis} ${filterTahun} H`]).font = { bold: true };
            worksheet.addRow([]); // Spacer

            // 2. HEADER TABEL
            const headerRow = worksheet.addRow([
                'NO', 
                'NAMA LENGKAP', 
                'ASAL PESANTREN', 
                'ALAMAT ASAL', 
                'NO. TELEPON', 
                'STATUS BAYAR', 
                'BIAYA DAFTAR', 
                'BELANJA KITAB', 
                'TOTAL BAYAR'
            ]);

            headerRow.eachCell((cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };
                cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
            });

            // 3. ISI DATA
            let grandTotal = 0;
            const data = tableQueryResult?.data?.data || [];
            data.forEach((item, index) => {
                const total = Number(item.biaya_pendaftaran) + Number(item.belanja_kitab_nominal);
                grandTotal += total;
                const row = worksheet.addRow([
                    index + 1, 
                    item.nama_lengkap.toUpperCase(), 
                    item.pesantren_asal, 
                    item.alamat_lengkap || '-', 
                    item.no_telepon || '-', 
                    item.status_pembayaran,
                    Number(item.biaya_pendaftaran), 
                    Number(item.belanja_kitab_nominal), 
                    total
                ]);

                row.eachCell((cell) => {
                    cell.border = { top: {style:'thin', color:{argb:'FFE5E7EB'}}, left: {style:'thin', color:{argb:'FFE5E7EB'}}, bottom: {style:'thin', color:{argb:'FFE5E7EB'}}, right: {style:'thin', color:{argb:'FFE5E7EB'}} };
                    if (index % 2 !== 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF6E3' } };
                });
            });

            // 4. FOOTER - TOTAL
            worksheet.addRow([]);
            const footerRow = worksheet.addRow(['', '', '', '', '', '', '', 'GRAND TOTAL', grandTotal]);
            footerRow.font = { bold: true };
            footerRow.getCell(9).numFmt = '#,##0';

            // 5. STYLING COLUMNS
            [5, 30, 25, 35, 15, 15, 15, 15, 18].forEach((w, i) => {
                worksheet.getColumn(i + 1).width = w;
                if(i >= 6) worksheet.getColumn(i+1).numFmt = '#,##0';
            });

            worksheet.autoFilter = 'A6:I6';
            worksheet.views = [{ state: 'frozen', ySplit: 6 }];

            const buffer = await workbook.xlsx.writeBuffer();
            const dateStr = new Date().toISOString().split('T')[0];
            saveAs(new Blob([buffer]), `Rekap_Peserta_Pasaran_${filterJenis}_${filterTahun}H_${dateStr}.xlsx`);
            message.success("Data berhasil diekspor");
        } catch (error) {
            console.error(error);
            message.error("Gagal ekspor data");
        } finally {
            setLoadingExport(false);
        }
    };

    const handleSubmit = async (values: {
        nama_lengkap: string;
        pesantren_asal: string;
        no_telepon: string;
        nama_wali: string;
        pekerjaan_wali: string;
        alamat_lengkap: string;
        uang_miftah: number;
        biaya_listrik: number;
        kos_makan: number;
        tafaruqon: number;
        selected_kitab_ids: number[];
        tanggal_lahir?: dayjs.Dayjs;
        tempat_lahir: string;
    }) => {
        try {
            const { pendaftaran, kitabNominal, selectedKitabs } = calculateTotals();
            const rincianKitab = selectedKitabs.map(k => k.nama_kitab).join(", ");

            await createMutate({
                resource: "peserta_diklat",
                values: {
                    nama_lengkap: values.nama_lengkap,
                    pesantren_asal: values.pesantren_asal,
                    no_telepon: values.no_telepon,
                    nama_wali: values.nama_wali,
                    pekerjaan_wali: values.pekerjaan_wali,
                    alamat_lengkap: values.alamat_lengkap,
                    tempat_lahir: values.tempat_lahir,
                    tanggal_lahir: values.tanggal_lahir ? values.tanggal_lahir.format('YYYY-MM-DD') : null,
                    uang_miftah: values.uang_miftah,
                    biaya_listrik: values.biaya_listrik,
                    kos_makan: values.kos_makan,
                    tafaruqon: values.tafaruqon,
                    biaya_pendaftaran: pendaftaran,
                    belanja_kitab_nominal: kitabNominal,
                    rincian_belanja: rincianKitab,
                    tahun_diklat: filterTahun,
                    jenis_diklat: filterJenis, 
                    dicatat_oleh: user?.full_name || "Admin",
                    status_pembayaran: "LUNAS", 
                    qr_code_id: crypto.randomUUID(), 
                }
            });
            message.success("Peserta diklat berhasil didaftarkan");
            setIsModalOpen(false);
            form.resetFields();
            tableQueryResult.refetch();
        } catch {
            message.error("Gagal menyimpan data");
        }
    };

    const handlePrint = (record: IPesertaDiklat) => {
        setPrintData(record);
        setIsPrintOpen(true);
    };

    const columns: ProColumns<IPesertaDiklat>[] = [
        {
            title: "Data Peserta Diklat",
            dataIndex: "nama_lengkap",
            width: 280,
            render: (_, r) => (
                <div className="flex items-start gap-3 py-2">
                    <Avatar 
                        shape="circle" 
                        size={44} 
                        style={{ 
                            backgroundColor: mode === 'dark' ? '#000' : '#fef3c7', 
                            border: `2px solid ${mode === 'dark' ? '#ffb700' : '#f59e0b'}`,
                            boxShadow: mode === 'dark' ? '0 0 10px rgba(255, 183, 0, 0.2)' : 'none'
                        }} 
                        icon={<UserOutlined style={{ color: mode === 'dark' ? '#ffb700' : '#b45309' }} />} 
                    />
                    <div className="flex flex-col">
                        <Text strong style={{ color: token.colorTextHeading, fontSize: '15px' }}>{r.nama_lengkap}</Text>
                        <Space size={4} className="mt-1" wrap>
                            <Tag style={{ 
                                backgroundColor: mode === 'dark' ? '#000' : '#fffbeb', 
                                color: mode === 'dark' ? '#ffb700' : '#b45309',
                                border: `1px solid ${mode === 'dark' ? '#ffb70040' : '#f59e0b20'}`,
                                fontSize: '10px',
                                fontWeight: 700
                            }}>
                                <BankOutlined className="mr-1"/> {r.pesantren_asal}
                            </Tag>
                            {r.status_pembayaran === 'PENDING' ? (
                                <Tag color="warning" style={{ fontWeight: 800, fontSize: '10px' }}>PENDING</Tag>
                            ) : (
                                <Tag color="success" style={{ fontWeight: 800, fontSize: '10px' }}>LUNAS</Tag>
                            )}
                        </Space>
                    </div>
                </div>
            )
        },
        {
            title: "Administrasi",
            dataIndex: "biaya_pendaftaran",
            align: "right",
            width: 160,
            render: (val, r) => (
                <Tooltip title={
                    <div className="p-2 text-xs">
                        <div className="flex justify-between gap-6 mb-1"><span>Uang Miftah:</span> <span className="font-mono">Rp {new Intl.NumberFormat('id-ID').format(r.uang_miftah || 0)}</span></div>
                        <div className="flex justify-between gap-6 mb-1"><span>Listrik:</span> <span className="font-mono">Rp {new Intl.NumberFormat('id-ID').format(r.biaya_listrik || 0)}</span></div>
                        <div className="flex justify-between gap-6 mb-1"><span>Kos Makan:</span> <span className="font-mono">Rp {new Intl.NumberFormat('id-ID').format(r.kos_makan || 0)}</span></div>
                        <div className="flex justify-between gap-6"><span>Tafaruqon:</span> <span className="font-mono">Rp {new Intl.NumberFormat('id-ID').format(r.tafaruqon || 0)}</span></div>
                    </div>
                }>
                    <div className="cursor-help flex flex-col items-end">
                        <Text strong style={{ color: mode === 'dark' ? '#ffb700' : '#b45309' }}>
                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(val))}
                        </Text>
                        <Text type="secondary" style={{ fontSize: '10px' }}>Klik rincian</Text>
                    </div>
                </Tooltip>
            )
        },
        {
            title: "Koperasi Kitab",
            dataIndex: "belanja_kitab_nominal",
            align: "right",
            width: 160,
            render: (val, r) => (
                <Tooltip title={r.rincian_belanja || "Tidak ada rincian belanja"}>
                    <div className="cursor-help flex flex-col items-end">
                        <Text strong style={{ color: Number(val) > 0 ? (mode === 'dark' ? '#ffb700' : '#1d4ed8') : 'rgba(128,128,128,0.5)' }}>
                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(val))}
                        </Text>
                        {Number(val) > 0 && <Text style={{ fontSize: '9px', color: '#3b82f6' }}><ShopOutlined /> Ada Kitab</Text>}
                    </div>
                </Tooltip>
            )
        },
        {
            title: "Aksi",
            valueType: "option",
            fixed: "right",
            width: 150,
            render: (_, record) => [
                record.status_pembayaran === 'PENDING' && (
                    <Popconfirm 
                        title="Konfirmasi Pembayaran" 
                        description="Pastikan peserta sudah datang dan membayar tunai di tempat."
                        key="confirm" 
                        onConfirm={() => handleConfirmPayment(record.id)}
                    >
                        <Tooltip title="Konfirmasi Bayar & Check-in">
                            <Button size="small" type="primary" icon={<CheckCircleOutlined />} style={{ backgroundColor: '#f59e0b', color: '#000', border: 'none' }} />
                        </Tooltip>
                    </Popconfirm>
                ),
                <Tooltip title="Cetak Formulir & Bukti" key="print">
                    <Button size="small" icon={<PrinterOutlined />} onClick={() => handlePrint(record)} style={{ backgroundColor: mode === 'dark' ? '#111' : '#fffbeb', color: '#f59e0b', border: '1px solid #f59e0b40' }} />
                </Tooltip>,
                <Tooltip title="Hapus Data" key="delete">
                    <Popconfirm title="Hapus peserta ini?" onConfirm={() => deleteMutate({ resource: "peserta_diklat", id: record.id.toString() })}>
                         <Button danger size="small" icon={<DeleteOutlined />} style={{ backgroundColor: mode === 'dark' ? '#000' : '#fff' }} />
                    </Popconfirm>
                </Tooltip>
            ]
        }
    ];

    const currentKitabOptions = masterKitab
        .filter(k => k.jenis_diklat === filterJenis)
        .map(k => ({ label: `${k.nama_kitab} (Rp ${k.harga.toLocaleString()})`, value: k.id }));

    return (
        <div style={{ background: token.colorBgBase, minHeight: '100vh', padding: '24px' }}>
            {/* 1. HEADER & SUMMARY */}
            <div className="mb-8 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div>
                    <Space align="center" size="middle">
                        <div style={{ 
                            background: mode === 'dark' ? '#000' : '#f59e0b', 
                            padding: '12px', 
                            borderRadius: '12px',
                            boxShadow: mode === 'dark' ? '0 0 20px rgba(245, 158, 11, 0.2)' : 'none',
                            border: mode === 'dark' ? '1px solid #f59e0b40' : 'none'
                        }}>
                            <RocketOutlined style={{ fontSize: '24px', color: mode === 'dark' ? '#f59e0b' : '#fff' }} />
                        </div>
                        <div>
                            <Title level={3} style={{ margin: 0, fontWeight: 900, letterSpacing: '-0.02em' }}>Diklat Pasaran Al-Hasanah</Title>
                            <Text type="secondary">Pendaftaran & Rekapitulasi Pembayaran Peserta Pasaran</Text>
                        </div>
                    </Space>
                    
                    <div className="mt-6 flex gap-3">
                         <Select 
                            value={filterJenis} 
                            onChange={setFilterJenis} 
                            style={{ width: 220 }} 
                            options={[
                                { label: 'Pasaran Maulid', value: 'MAULID' },
                                { label: 'Pasaran Syaban', value: 'SYABAN' },
                                { label: 'Pasaran Ramadhan', value: 'RAMADHAN' },
                                { label: 'Pasaran Dzulhijjah', value: 'DZULHIJJAH' },
                            ]}
                        />
                        <InputNumber 
                            value={filterTahun} 
                            onChange={(v) => setFilterTahun(v as number)} 
                            className="w-28" 
                            addonAfter="H" 
                        />
                        <Button icon={<SyncOutlined spin={tableQueryResult.isFetching} />} onClick={() => tableQueryResult.refetch()} />
                    </div>
                </div>

                <div className="w-full lg:w-auto flex-1">
                    <Row gutter={[16, 16]}>
                        <Col xs={12} sm={6}>
                            <Card className="glass-card" bodyStyle={{ padding: '12px 16px' }}>
                                <Statistic 
                                    title={<Text style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: '#b45309' }}>Pendapatan Diklat</Text>} 
                                    value={stats.administrasi} 
                                    prefix="Rp" 
                                    valueStyle={{ fontSize: '18px', fontWeight: '900', color: mode === 'dark' ? '#fff' : '#b45309' }}
                                />
                            </Card>
                        </Col>
                        <Col xs={12} sm={6}>
                            <Card className="glass-card" bodyStyle={{ padding: '12px 16px' }}>
                                <Statistic 
                                    title={<Text style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: '#1d4ed8' }}>Koperasi Kitab</Text>} 
                                    value={stats.kitab} 
                                    prefix="Rp" 
                                    valueStyle={{ fontSize: '18px', fontWeight: '900', color: mode === 'dark' ? '#fff' : '#1d4ed8' }}
                                />
                            </Card>
                        </Col>
                        <Col xs={12} sm={6}>
                            <Card className="glass-card" bodyStyle={{ padding: '12px 16px', border: '1px solid #f59e0b' }}>
                                <Statistic 
                                    title={<Text style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: '#f59e0b' }}>Grand Total</Text>} 
                                    value={grandTotal} 
                                    prefix="Rp" 
                                    valueStyle={{ fontSize: '18px', fontWeight: '900', color: mode === 'dark' ? '#fff' : '#b45309' }}
                                />
                            </Card>
                        </Col>
                        <Col xs={12} sm={6}>
                            <Card className="glass-card" bodyStyle={{ padding: '12px 16px' }}>
                                <Statistic 
                                    title={<Text style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: '#10b981' }}>Total Lunas</Text>} 
                                    value={stats.success} 
                                    suffix="Org" 
                                    valueStyle={{ fontSize: '18px', fontWeight: '900', color: '#10b981' }}
                                />
                            </Card>
                        </Col>
                    </Row>
                </div>
            </div>

            {/* 2. TABLE */}
            <Card 
                bordered={false} 
                style={{ 
                    borderRadius: '20px', 
                    backgroundColor: mode === 'dark' ? '#0a0a0a' : '#fff',
                    border: mode === 'dark' ? '1px solid rgba(245,158,11,0.1)' : '1px solid rgba(0,0,0,0.05)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
                }}
                bodyStyle={{ padding: 0 }}
            >
                <ProTable<IPesertaDiklat>
                    {...tableProps}
                    columns={columns}
                    rowKey="id"
                    headerTitle={
                        <Space>
                            <SafetyCertificateOutlined style={{ color: '#f59e0b' }} />
                            <Text strong style={{ fontSize: '16px' }}>Daftar Mufasirin ({tableQueryResult?.data?.total || 0})</Text>
                        </Space>
                    }
                    search={false}
                    toolBarRender={() => [
                        <Button key="export" icon={<DownloadOutlined />} onClick={handleExport} loading={loadingExport} className="rounded-lg">
                            Ekspor Data
                        </Button>,
                        <Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => {
                            if (activeConfig) {
                                form.setFieldsValue({
                                    uang_miftah: activeConfig.uang_miftah,
                                    biaya_listrik: activeConfig.biaya_listrik,
                                    kos_makan: activeConfig.kos_makan,
                                    tafaruqon: activeConfig.tafaruqon,
                                    selected_kitab_ids: []
                                });
                            }
                            setIsModalOpen(true);
                        }} style={{ backgroundColor: '#f59e0b', color: '#000', border: 'none', fontWeight: 700 }} className="rounded-lg">
                            Daftar Manual
                        </Button>
                    ]}
                    tableStyle={{ padding: '0 20px' }}
                />
            </Card>

            {/* 3. MODAL PENDAFTARAN (REVISED FORM) */}
            <Modal
                title={<div className="font-bold text-lg"><PlusOutlined /> Pendaftaran Peserta Baru</div>}
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                onOk={() => form.submit()}
                width={900}
                centered
                okText="Simpan & LUNAS"
                okButtonProps={{ style: { backgroundColor: '#f59e0b', color: '#000', border: 'none' } }}
            >
                <Form form={form} layout="vertical" onFinish={handleSubmit} className="mt-4">
                    <Row gutter={24}>
                        <Col span={12}>
                            <Title level={5} style={{ marginBottom: '16px', color: '#b45309', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px' }}>Identitas Santri</Title>
                            <Form.Item name="nama_lengkap" label="Nama Lengkap" rules={[{required:true}]}>
                                <Input placeholder="Nama lengkap sesuai KTP/KK" size="large" />
                            </Form.Item>
                            <Row gutter={12}>
                                <Col span={10}>
                                    <Form.Item name="tempat_lahir" label="Tempat Lahir" rules={[{required:true}]}>
                                        <Input placeholder="Kota/Kab" size="large" />
                                    </Form.Item>
                                </Col>
                                <Col span={14}>
                                    <Form.Item name="tanggal_lahir" label="Tanggal Lahir" rules={[{required:true}]}>
                                        <Input type="date" className="w-full h-10 px-3 rounded-lg border border-black/10" />
                                    </Form.Item>
                                </Col>
                            </Row>
                            <Form.Item name="pesantren_asal" label="Asal Pesantren" rules={[{required:true}]}>
                                <Input placeholder="Contoh: PP Al-Hasanah Cibeuti" size="large" />
                            </Form.Item>
                            <Form.Item name="no_telepon" label="No. WhatsApp / HP" rules={[{required:true}]}>
                                <Input placeholder="08xxxxxxxxxx" size="large" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                             <Title level={5} style={{ marginBottom: '16px', color: '#b45309', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px' }}>Data Wali & Alamat</Title>
                             <Form.Item name="nama_wali" label="Nama Wali / Orang Tua" rules={[{required:true}]}>
                                <Input placeholder="Nama penanggung jawab" size="large" />
                             </Form.Item>
                             <Form.Item name="pekerjaan_wali" label="Pekerjaan Wali" rules={[{required:true}]}>
                                <Input placeholder="Contoh: Wiraswasta / Guru" size="large" />
                             </Form.Item>
                             <Form.Item name="alamat_lengkap" label="Alamat Lengkap Rumah" rules={[{required:true}]}>
                                <Input.TextArea rows={4} placeholder="Alamat asal lengkap (Dusun, RT/RW, Kec, Kota)" />
                             </Form.Item>
                        </Col>
                    </Row>
                    
                    <div style={{ backgroundColor: mode === 'dark' ? '#111' : '#fef3c730', padding: '20px', borderRadius: '16px', marginTop: '16px', border: '1px solid #fef3c7' }}>
                         <div className="flex justify-between items-center mb-4">
                            <Text strong><ShopOutlined /> Pembelian Kitab Pasaran</Text>
                            <Tag color="blue" style={{ fontWeight: 800 }}>Total: Rp {totalKitabDinamis.toLocaleString()}</Tag>
                        </div>
                        <Form.Item name="selected_kitab_ids" noStyle>
                            <Select
                                mode="multiple"
                                style={{ width: '100%' }}
                                placeholder="Pilih kitab dari koperasi..."
                                options={currentKitabOptions}
                                size="large"
                                optionFilterProp="label"
                            />
                        </Form.Item>
                        {selectedKitabs.length > 0 && (
                            <div className="mt-2 text-xs opacity-60">
                                Item: {selectedKitabs.map(k => k.nama_kitab).join(", ")}
                            </div>
                        )}
                    </div>

                    <div style={{ backgroundColor: mode === 'dark' ? '#0a0a0a' : '#f0fdf4', padding: '20px', borderRadius: '16px', marginTop: '16px' }}>
                        <div className="flex justify-between items-center mb-4">
                            <Text strong><WalletOutlined /> Administrasi & Akomodasi</Text>
                            <Tag color="success" style={{ fontWeight: 800 }}>Subtotal: Rp {totalPendaftaranDinamis.toLocaleString()}</Tag>
                        </div>
                        <Row gutter={16}>
                            <Col span={6}><Form.Item name="uang_miftah" label="Miftah"><InputNumber style={{width:'100%'}} prefix="Rp" formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={v => v!.replace(/\$\s?|(,*)/g, '')} /></Form.Item></Col>
                            <Col span={6}><Form.Item name="biaya_listrik" label="Listrik"><InputNumber style={{width:'100%'}} prefix="Rp" formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={v => v!.replace(/\$\s?|(,*)/g, '')} /></Form.Item></Col>
                            <Col span={6}><Form.Item name="kos_makan" label="Konsumsi"><InputNumber style={{width:'100%'}} prefix="Rp" formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={v => v!.replace(/\$\s?|(,*)/g, '')} /></Form.Item></Col>
                            <Col span={6}><Form.Item name="tafaruqon" label="Tafaruqon"><InputNumber style={{width:'100%'}} prefix="Rp" formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={v => v!.replace(/\$\s?|(,*)/g, '')} /></Form.Item></Col>
                        </Row>
                    </div>

                    <div className="mt-6 p-6 bg-zinc-900 rounded-2xl flex justify-between items-center border border-yellow-500/20 shadow-2xl">
                        <div>
                            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Pembayaran Tunai</Text>
                            <div style={{ fontSize: '32px', fontWeight: 900, color: '#f59e0b' }}>Rp {(totalPendaftaranDinamis + totalKitabDinamis).toLocaleString()}</div>
                        </div>
                        <CheckCircleOutlined style={{ fontSize: '40px', color: '#f59e0b' }} />
                    </div>
                </Form>
            </Modal>

            {/* 4. MODAL PRINT PDF (FULL PROFESSIONAL REDESIGN) */}
            <Modal
                title={<Space><PrinterOutlined /> Cetak Arsip Pendaftaran</Space>}
                open={isPrintOpen}
                onCancel={() => setIsPrintOpen(false)}
                footer={[
                    <Button 
                        key="print" 
                        type="primary" 
                        icon={<PrinterOutlined />} 
                        onClick={handlePrintAction} 
                        style={{ backgroundColor: '#f59e0b', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 700 }}
                    >
                        Cetak Sekarang (A4)
                    </Button>
                ]}
                width={950}
                centered
            >
                <div className="bg-zinc-800 p-8 rounded-2xl overflow-y-auto max-h-[80vh] flex justify-center">
                    <div ref={componentRef} style={{ 
                        width: '21cm', 
                        minHeight: '29.7cm', 
                        background: 'white', 
                        padding: '1cm 1.5cm', 
                        fontFamily: "'Inter', sans-serif", 
                        color: '#1f2937', 
                        position: 'relative'
                    }}>
                        {/* HEADER WITH LOGO */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '3px solid #111827', paddingBottom: '20px', marginBottom: '30px', position: 'relative', minHeight: '100px' }}>
                             <img src="/logo.png" alt="Logo" style={{ width: '80px', height: '80px', objectFit: 'contain', position: 'absolute', left: 0 }} />
                             <div style={{ textAlign: 'center', width: '100%', padding: '0 120px' }}>
                                 <div style={{ fontSize: '20px', fontWeight: 900, color: '#b45309', lineHeight: 1.1, whiteSpace: 'nowrap' }}>PONDOK PESANTREN AL-HASANAH</div>
                                 <div style={{ fontSize: '12px', fontWeight: 700, color: '#4b5563', marginTop: '4px' }}>CIBEUTI - KAWALU - KOTA TASIKMALAYA - JAWA BARAT</div>
                                 <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>Jl. Raya Cibeuti No.13, Kec. Kawalu, Tasikmalaya, Jawa Barat 46182 | Telp: 0812-XXXX-XXXX</div>
                             </div>
                             <div style={{ textAlign: 'right', position: 'absolute', right: 0 }}>
                                 <div style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 800 }}>NOMOR DOKUMEN</div>
                                 <div style={{ fontSize: '15px', fontWeight: 800, fontFamily: 'monospace' }}>#DIK-{printData?.qr_code_id?.slice(0,8).toUpperCase()}</div>
                             </div>
                        </div>

                        {/* SUBTITLE */}
                        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                            <div style={{ fontSize: '18px', fontWeight: 900, textDecoration: 'underline', letterSpacing: '1px' }}>FORMULIR PENDAFTARAN & BUKTI PEMBAYARAN</div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#b45309', marginTop: '5px' }}>PROGRAM PASARAN {printData?.jenis_diklat} {printData?.tahun_diklat} H</div>
                        </div>

                        {/* SECTION: DATA PERSONAL */}
                        <div style={{ marginBottom: '30px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 900, color: 'white', backgroundColor: '#111827', padding: '6px 15px', borderRadius: '4px', marginBottom: '15px', display: 'inline-block' }}>I. IDENTITAS PESERTA</div>
                            <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                                <tbody>
                                    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ width: '180px', padding: '8px 0', fontWeight: 600 }}>Nama Lengkap</td>
                                        <td style={{ padding: '8px 0', fontWeight: 800, fontSize: '15px' }}>: {printData?.nama_lengkap?.toUpperCase()}</td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '8px 0', fontWeight: 600 }}>Tempat, Tanggal Lahir</td>
                                        <td style={{ padding: '8px 0' }}>: {printData?.tempat_lahir || '-'}, {printData?.tanggal_lahir ? dayjs(printData.tanggal_lahir).format('DD MMMM YYYY') : '-'}</td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '8px 0', fontWeight: 600 }}>No. WhatsApp / HP</td>
                                        <td style={{ padding: '8px 0' }}>: {printData?.no_telepon}</td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '8px 0', fontWeight: 600 }}>Asal Pesantren</td>
                                        <td style={{ padding: '8px 0' }}>: {printData?.pesantren_asal}</td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '8px 0', fontWeight: 600 }}>Nama Wali / Orang Tua</td>
                                        <td style={{ padding: '8px 0' }}>: {printData?.nama_wali}</td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '8px 0', fontWeight: 600 }}>Pekerjaan Wali</td>
                                        <td style={{ padding: '8px 0' }}>: {printData?.pekerjaan_wali || '-'}</td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '8px 0', fontWeight: 600, verticalAlign: 'top' }}>Alamat Lengkap Rumah</td>
                                        <td style={{ padding: '8px 0', lineHeight: 1.5 }}>: {printData?.alamat_lengkap}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* SECTION: RINCIAN BIAYA */}
                        <div style={{ marginBottom: '40px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 900, color: 'white', backgroundColor: '#111827', padding: '6px 15px', borderRadius: '4px', marginBottom: '15px', display: 'inline-block' }}>II. RINCIAN PEMBAYARAN</div>
                            <div style={{ border: '2px solid #f3f4f6', borderRadius: '12px', overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #f3f4f6' }}>
                                            <th style={{ textAlign: 'left', padding: '12px 20px' }}>Deskripsi Pembayaran</th>
                                            <th style={{ textAlign: 'right', padding: '12px 20px', width: '200px' }}>Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '12px 20px' }}>
                                                <div style={{ fontWeight: 700 }}>Administrasi & Akomodasi Pasaran</div>
                                                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Miftah, Listrik, Konsumsi, dan Tafaruqon</div>
                                            </td>
                                            <td style={{ textAlign: 'right', padding: '12px 20px', fontWeight: 700 }}>Rp {Number(printData?.biaya_pendaftaran || 0).toLocaleString()}</td>
                                        </tr>
                                        <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '12px 20px' }}>
                                                <div style={{ fontWeight: 700 }}>Pembelian Kitab Pasaran</div>
                                                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Item: {printData?.rincian_belanja || '-'}</div>
                                            </td>
                                            <td style={{ textAlign: 'right', padding: '12px 20px', fontWeight: 700 }}>Rp {Number(printData?.belanja_kitab_nominal || 0).toLocaleString()}</td>
                                        </tr>
                                        <tr style={{ backgroundColor: '#fffbeb' }}>
                                            <td style={{ padding: '15px 20px', fontWeight: 900, color: '#b45309', fontSize: '14px' }}>TOTAL DIBAYARKAN (LUNAS)</td>
                                            <td style={{ textAlign: 'right', padding: '15px 20px', fontWeight: 900, fontSize: '20px', color: '#111827' }}>
                                                Rp {(Number(printData?.biaya_pendaftaran || 0) + Number(printData?.belanja_kitab_nominal || 0)).toLocaleString()}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* SECTION: SIGNATURE */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '30px', paddingBottom: '70px' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '8px', color: '#4b5563' }}>VALIDASI SISTEM</div>
                                <div style={{ backgroundColor: 'white', padding: '8px', borderRadius: '8px', display: 'inline-block', border: '1px solid #f3f4f6' }}>
                                    <QRCode value={`VERIFIED_DIKLAT_${printData?.qr_code_id}`} size={95} bordered={false} bgColor="#ffffff" color="#000000" />
                                </div>
                                <div style={{ fontSize: '9px', color: '#9ca3af', marginTop: '6px', fontWeight: 800, letterSpacing: '0.5px' }}>SCAN UNTUK VERIFIKASI</div>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '60px' }}>
                                <div style={{ textAlign: 'center', width: '170px' }}>
                                    <div style={{ fontSize: '12px', color: '#4b5563', marginBottom: '60px' }}>Peserta / Wali Santri,</div>
                                    <div style={{ fontWeight: 800, fontSize: '14px', borderBottom: '1.5px solid #111827', paddingBottom: '3px' }}>{printData?.nama_lengkap?.toUpperCase()}</div>
                                    <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>Tanda Tangan & Nama Terang</div>
                                </div>
                                <div style={{ textAlign: 'center', width: '170px' }}>
                                    <div style={{ fontSize: '12px', color: '#4b5563', marginBottom: '10px' }}>Tasikmalaya, {dayjs().format('DD/MM/YYYY')}</div>
                                    <div style={{ fontSize: '12px', color: '#4b5563', marginBottom: '35px' }}>Panitia Pendaftaran,</div>
                                    <div style={{ fontWeight: 800, fontSize: '14px', borderBottom: '1.5px solid #111827', paddingBottom: '3px' }}>{printData?.dicatat_oleh || 'Bag. Administrasi'}</div>
                                    <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>Stempel & Tanda Tangan</div>
                                </div>
                            </div>
                        </div>

                        {/* FOOTER */}
                        <div style={{ position: 'absolute', bottom: '1cm', left: '1.5cm', right: '1.5cm' }}>
                             <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                 <div style={{ width: '60%' }}>
                                     <div style={{ fontSize: '9px', color: '#9ca3af', fontStyle: 'italic', lineHeight: 1.4 }}>
                                         * Dokumen ini sah dan diterbitkan secara elektronik oleh sistem manajemen operasional pesantren sebagai bukti pendaftaran resmi.
                                     </div>
                                 </div>
                                 <div style={{ textAlign: 'right' }}>
                                     <div style={{ fontSize: '10px', color: '#b45309', fontWeight: 800, letterSpacing: '0.5px' }}>AL-HASANAH DIGITAL ECOSYSTEM</div>
                                     <div style={{ fontSize: '8px', color: '#d1d5db', marginTop: '2px' }}>OFFICIAL VERIFIED ARCHIVE</div>
                                 </div>
                             </div>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
