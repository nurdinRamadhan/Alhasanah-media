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
    InfoCircleOutlined,
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
        total: acc.total + Number(curr.biaya_pendaftaran) + Number(curr.belanja_kitab_nominal),
        miftah: acc.miftah + Number(curr.uang_miftah || 0),
        pending: acc.pending + (curr.status_pembayaran === 'PENDING' ? 1 : 0),
        success: acc.success + (curr.status_pembayaran === 'LUNAS' || curr.status_pembayaran === 'SUCCESS' ? 1 : 0)
    }), { total: 0, miftah: 0, pending: 0, success: 0 }) || { total: 0, miftah: 0, pending: 0, success: 0 };

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
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet(`Pasaran ${filterJenis}`);

            worksheet.addRow(['REKAPITULASI PESERTA DIKLAT & PASARAN']);
            worksheet.addRow([`Program: ${filterJenis} ${filterTahun} H`]);
            worksheet.addRow([]);

            const headerRow = worksheet.addRow(['No', 'Nama Lengkap', 'Asal Pesantren', 'Alamat', 'No HP', 'Status', 'Biaya Daftar', 'Belanja Kitab', 'Total Bayar']);
            headerRow.font = { bold: true };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }; 

            let grandTotal = 0;
            tableQueryResult?.data?.data.forEach((item, index) => {
                const total = Number(item.biaya_pendaftaran) + Number(item.belanja_kitab_nominal);
                grandTotal += total;
                worksheet.addRow([
                    index + 1, item.nama_lengkap, item.pesantren_asal, item.alamat_lengkap, item.no_telepon, item.status_pembayaran,
                    item.biaya_pendaftaran, item.belanja_kitab_nominal, total
                ]);
            });

            worksheet.addRow([]);
            const footerRow = worksheet.addRow(['', '', '', '', '', '', '', 'GRAND TOTAL', grandTotal]);
            footerRow.font = { bold: true };
            
            worksheet.getColumn(2).width = 30;
            worksheet.getColumn(3).width = 25;
            worksheet.getColumn(4).width = 40;

            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `Data_Peserta_${filterJenis}_${filterTahun}H.xlsx`);
            message.success("Data berhasil diekspor");
        } catch {
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
        alamat_lengkap: string;
        uang_miftah: number;
        biaya_listrik: number;
        kos_makan: number;
        tafaruqon: number;
        selected_kitab_ids: number[];
        tanggal_lahir?: dayjs.Dayjs;
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
                    alamat_lengkap: values.alamat_lengkap,
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
                    tanggal_lahir: values.tanggal_lahir ? values.tanggal_lahir.format('YYYY-MM-DD') : null
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
                            backgroundColor: mode === 'dark' ? '#000' : '#065f46', 
                            border: `2px solid ${mode === 'dark' ? '#ffb700' : '#fff'}`,
                            boxShadow: mode === 'dark' ? '0 0 10px rgba(255, 183, 0, 0.2)' : 'none'
                        }} 
                        icon={<UserOutlined />} 
                    />
                    <div className="flex flex-col">
                        <Text strong style={{ color: token.colorTextHeading, fontSize: '15px' }}>{r.nama_lengkap}</Text>
                        <Space size={4} className="mt-1" wrap>
                            <Tag style={{ 
                                backgroundColor: mode === 'dark' ? '#000' : '#f0fdf4', 
                                color: mode === 'dark' ? '#ffb700' : '#065f46',
                                border: `1px solid ${mode === 'dark' ? '#ffb70040' : '#065f4620'}`,
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
                        <Text strong style={{ color: mode === 'dark' ? '#ffb700' : '#065f46' }}>
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
                            <Button size="small" type="primary" icon={<CheckCircleOutlined />} style={{ backgroundColor: '#ffb700', color: '#000', border: 'none' }} />
                        </Tooltip>
                    </Popconfirm>
                ),
                <Tooltip title="Cetak Formulir & Bukti" key="print">
                    <Button size="small" icon={<PrinterOutlined />} onClick={() => handlePrint(record)} style={{ backgroundColor: mode === 'dark' ? '#111' : '#f0f9ff', color: '#3b82f6', border: '1px solid #3b82f640' }} />
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
                            background: mode === 'dark' ? '#000' : '#065f46', 
                            padding: '12px', 
                            borderRadius: '12px',
                            boxShadow: mode === 'dark' ? '0 0 20px rgba(255, 183, 0, 0.2)' : 'none',
                            border: mode === 'dark' ? '1px solid #ffb70040' : 'none'
                        }}>
                            <RocketOutlined style={{ fontSize: '24px', color: mode === 'dark' ? '#ffb700' : '#fff' }} />
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

                <div className="w-full lg:w-auto">
                    <Row gutter={16}>
                        <Col xs={24} sm={8}>
                            <Card className="glass-card" bodyStyle={{ padding: '16px' }}>
                                <Statistic 
                                    title={<Text style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: mode === 'dark' ? '#ffb700' : '#065f46' }}>Total Pendapatan</Text>} 
                                    value={stats.total} 
                                    prefix="Rp" 
                                    valueStyle={{ fontSize: '20px', fontWeight: '900', color: mode === 'dark' ? '#fff' : '#065f46' }}
                                />
                            </Card>
                        </Col>
                        <Col xs={12} sm={8}>
                            <Card className="glass-card" bodyStyle={{ padding: '16px' }}>
                                <Statistic 
                                    title={<Text style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: '#fbbf24' }}>Pending (Tunai)</Text>} 
                                    value={stats.pending} 
                                    suffix="Org" 
                                    valueStyle={{ fontSize: '20px', fontWeight: '900', color: '#fbbf24' }}
                                />
                            </Card>
                        </Col>
                        <Col xs={12} sm={8}>
                            <Card className="glass-card" bodyStyle={{ padding: '16px' }}>
                                <Statistic 
                                    title={<Text style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: '#10b981' }}>Lunas</Text>} 
                                    value={stats.success} 
                                    suffix="Org" 
                                    valueStyle={{ fontSize: '20px', fontWeight: '900', color: '#10b981' }}
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
                    border: mode === 'dark' ? '1px solid rgba(255,183,0,0.1)' : '1px solid rgba(0,0,0,0.05)',
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
                            <SafetyCertificateOutlined style={{ color: '#ffb700' }} />
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
                        }} style={{ backgroundColor: mode === 'dark' ? '#ffb700' : '#065f46', color: mode === 'dark' ? '#000' : '#fff', border: 'none', fontWeight: 700 }} className="rounded-lg">
                            Daftar Manual
                        </Button>
                    ]}
                    tableStyle={{ padding: '0 20px' }}
                />
            </Card>

            {/* 3. MODAL PENDAFTARAN */}
            <Modal
                title={<div className="font-bold text-lg"><PlusOutlined /> Pendaftaran Peserta Baru</div>}
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                onOk={() => form.submit()}
                width={850}
                centered
                okText="Simpan & LUNAS"
                okButtonProps={{ style: { backgroundColor: mode === 'dark' ? '#ffb700' : '#065f46', color: mode === 'dark' ? '#000' : '#fff', border: 'none' } }}
            >
                <Form form={form} layout="vertical" onFinish={handleSubmit} className="mt-4">
                    <Row gutter={24}>
                        <Col span={12}>
                            <Form.Item name="nama_lengkap" label="Nama Lengkap" rules={[{required:true}]}>
                                <Input placeholder="Nama lengkap peserta" size="large" />
                            </Form.Item>
                            <Form.Item name="pesantren_asal" label="Asal Pesantren" rules={[{required:true}]}>
                                <Input placeholder="Contoh: PP Al-Hasanah Cibeuti" size="large" />
                            </Form.Item>
                            <Form.Item name="no_telepon" label="No. Telepon / WhatsApp">
                                <Input placeholder="08xxxxxxxxxx" size="large" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                             <Form.Item name="nama_wali" label="Nama Wali / Orang Tua">
                                <Input placeholder="Nama penanggung jawab" size="large" />
                             </Form.Item>
                             <Form.Item name="alamat_lengkap" label="Alamat Lengkap">
                                <Input.TextArea rows={4} placeholder="Alamat asal rumah" />
                             </Form.Item>
                        </Col>
                    </Row>
                    
                    <div style={{ backgroundColor: mode === 'dark' ? '#111' : '#f0f9ff', padding: '20px', borderRadius: '16px', marginTop: '16px' }}>
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

                    <div className="mt-6 p-6 bg-black rounded-2xl flex justify-between items-center border border-yellow-500/20 shadow-2xl">
                        <div>
                            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Pembayaran Tunai</Text>
                            <div style={{ fontSize: '32px', fontWeight: 900, color: '#ffb700' }}>Rp {(totalPendaftaranDinamis + totalKitabDinamis).toLocaleString()}</div>
                        </div>
                        <CheckCircleOutlined style={{ fontSize: '40px', color: '#ffb700' }} />
                    </div>
                </Form>
            </Modal>

            {/* 4. MODAL PRINT PDF */}
            <Modal
                title="Kuitansi & Formulir Pendaftaran"
                open={isPrintOpen}
                onCancel={() => setIsPrintOpen(false)}
                footer={[
                    <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={handlePrintAction} style={{ backgroundColor: '#ffb700', color: '#000', border: 'none', borderRadius: '50px', padding: '0 30px' }}>Cetak Sekarang (A4)</Button>
                ]}
                width={850}
                centered
            >
                <div className="bg-gray-100 dark:bg-zinc-900 p-8 rounded-xl overflow-y-auto max-h-[70vh] flex justify-center">
                    <div ref={componentRef} style={{ width: '21cm', minHeight: '29.7cm', background: 'white', padding: '2cm', fontFamily: 'Times New Roman, serif', color: 'black', position: 'relative', boxShadow: '0 0 40px rgba(0,0,0,0.1)' }}>
                        {/* KOP SURAT */}
                        <div style={{ textAlign: 'center', borderBottom: '4px double black', paddingBottom: '15px', marginBottom: '30px' }}>
                             <div style={{ fontSize: '26px', fontWeight: 'bold' }}>PONDOK PESANTREN AL-HASANAH</div>
                             <div style={{ fontSize: '14px', letterSpacing: '1px' }}>CIBEUTI - KAWALU - KOTA TASIKMALAYA</div>
                             <div style={{ fontSize: '11px', color: '#555', marginTop: '5px' }}>Jl. Raya Cibeuti No.13, Kec. Kawalu, Tasikmalaya, Jawa Barat 46182</div>
                        </div>

                        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                            <div style={{ fontSize: '18px', fontWeight: 'bold', textDecoration: 'underline' }}>BUKTI PENDAFTARAN & PEMBAYARAN</div>
                            <div style={{ fontSize: '12px', marginTop: '5px' }}>Nomor: DIK/{printData?.qr_code_id?.slice(0,8).toUpperCase()}</div>
                        </div>

                        <table style={{ width: '100%', fontSize: '16px', lineHeight: '2.5', borderCollapse: 'collapse' }}>
                            <tbody>
                                <tr><td style={{ width: '220px' }}>Nama Peserta</td><td>: <span style={{ fontWeight: 'bold', fontSize: '18px' }}>{printData?.nama_lengkap?.toUpperCase()}</span></td></tr>
                                <tr><td>Asal Lembaga/Pesantren</td><td>: {printData?.pesantren_asal}</td></tr>
                                <tr><td>Alamat Asal</td><td>: {printData?.alamat_lengkap}</td></tr>
                                <tr><td>Program Pasaran</td><td>: {printData?.jenis_diklat} {printData?.tahun_diklat} H</td></tr>
                                <tr style={{ verticalAlign: 'top' }}><td>Item Kitab</td><td>: {printData?.rincian_belanja || '-'}</td></tr>
                                <tr><td>Status Administrasi</td><td>: <span style={{ color: 'green', fontWeight: 'bold' }}>LUNAS / TERKONFIRMASI</span></td></tr>
                                <tr style={{ borderTop: '2px solid #eee' }}>
                                    <td style={{ paddingTop: '20px' }}>TOTAL DIBAYARKAN</td>
                                    <td style={{ paddingTop: '20px' }}>: <span style={{ fontSize: '22px', fontWeight: 'bold' }}>Rp {(Number(printData?.biaya_pendaftaran || 0) + Number(printData?.belanja_kitab_nominal || 0)).toLocaleString()}</span></td>
                                </tr>
                            </tbody>
                        </table>

                        <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '12px', marginBottom: '10px' }}>Scan untuk Validasi</div>
                                <QRCode value={`DIKLAT:${printData?.qr_code_id}`} size={120} bordered={true} />
                            </div>
                            <div style={{ textAlign: 'center', width: '250px' }}>
                                Tasikmalaya, {dayjs().format('DD MMMM YYYY')}<br/>
                                Petugas Pendaftaran,<br/><br/><br/><br/><br/>
                                ( <b>{printData?.dicatat_oleh || 'Bag. Administrasi'}</b> )
                            </div>
                        </div>

                        <div style={{ position: 'absolute', bottom: '40px', right: '40px', fontSize: '10px', color: '#999', fontStyle: 'italic' }}>
                            Dicetak otomatis oleh Al-Hasanah Management System
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
