import React, { useState, useRef } from "react";
import { useTable } from "@refinedev/antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import { 
    Tag, Space, Button, Typography, Tooltip, Avatar, Modal, Select, 
    Card, Row, Col, Statistic, Input, InputNumber, Form, DatePicker, message, Divider 
} from "antd";
import { 
    PlusOutlined, PrinterOutlined, UserOutlined, 
    ShopOutlined, EnvironmentOutlined, DownloadOutlined, DeleteOutlined,
    BankOutlined, PhoneOutlined
} from "@ant-design/icons";
import { useDelete, useCreate, useGetIdentity } from "@refinedev/core";
import dayjs from "dayjs";
import { useReactToPrint } from 'react-to-print';
import { QRCode } from "antd";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { IPesertaDiklat, IProfile } from "../../types";

const { Text, Title } = Typography;

// OPSI TAHUN HIJRIAH
const HIJRI_YEARS = [
    { label: '1447 H', value: 1447 },
    { label: '1448 H', value: 1448 },
    { label: '1449 H', value: 1449 },
    { label: '1450 H', value: 1450 },
    { label: '1451 H', value: 1451 },
    { label: '1452 H', value: 1452 },
    { label: '1453 H', value: 1453 },
    { label: '1454 H', value: 1454 },
    { label: '1455 H', value: 1455 },
    { label: '1456 H', value: 1456 },
    { label: '1457 H', value: 1457 },
];

export const DiklatList = () => {
    const { data: user } = useGetIdentity<IProfile>();
    const { mutate: deleteMutate } = useDelete();
    const { mutate: createMutate } = useCreate();

    // STATES
    const [filterTahun, setFilterTahun] = useState<number>(1447); 
    const [filterJenis, setFilterJenis] = useState<'MAULID'|'SYABAN'|'RAMADHAN'|'DZULHIJJAH'>('RAMADHAN');
    
    // MODAL & PRINT
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isPrintOpen, setIsPrintOpen] = useState(false);
    const [printData, setPrintData] = useState<IPesertaDiklat | null>(null);
    const componentRef = useRef(null);
    const [form] = Form.useForm();
    const [loadingExport, setLoadingExport] = useState(false);

    // PRINT ACTION
    const handlePrintAction = useReactToPrint({
        contentRef: componentRef,
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

    const totalPemasukan = tableQueryResult?.data?.data.reduce((acc, curr) => 
        acc + Number(curr.biaya_pendaftaran) + Number(curr.belanja_kitab_nominal), 0
    ) || 0;

    // --- LOGIC EXPORT EXCEL (REKAP KESELURUHAN) ---
    const handleExport = async () => {
        setLoadingExport(true);
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet(`Pasaran ${filterJenis}`);

            // Header
            worksheet.addRow(['REKAPITULASI PESERTA DIKLAT & PASARAN']);
            worksheet.addRow([`Program: ${filterJenis} ${filterTahun} H`]);
            worksheet.addRow([]);

            // Columns
            const headerRow = worksheet.addRow(['No', 'Nama Lengkap', 'Asal Pesantren', 'Alamat', 'No HP', 'Biaya Daftar', 'Belanja Kitab', 'Total Bayar']);
            headerRow.font = { bold: true };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }; // Light Green

            let grandTotal = 0;
            tableQueryResult?.data?.data.forEach((item, index) => {
                const total = Number(item.biaya_pendaftaran) + Number(item.belanja_kitab_nominal);
                grandTotal += total;
                worksheet.addRow([
                    index + 1,
                    item.nama_lengkap,
                    item.pesantren_asal,
                    item.alamat_lengkap,
                    item.no_telepon,
                    item.biaya_pendaftaran,
                    item.belanja_kitab_nominal,
                    total
                ]);
            });

            worksheet.addRow([]);
            const footerRow = worksheet.addRow(['', '', '', '', '', '', 'GRAND TOTAL', grandTotal]);
            footerRow.font = { bold: true };
            
            // Formatting Width
            worksheet.getColumn(2).width = 30;
            worksheet.getColumn(3).width = 25;
            worksheet.getColumn(4).width = 40;

            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `Data_Peserta_${filterJenis}_${filterTahun}H.xlsx`);
            message.success("Data berhasil diekspor");
        } catch (e) {
            message.error("Gagal ekspor data");
        } finally {
            setLoadingExport(false);
        }
    };

    const handleSubmit = async (values: any) => {
        try {
            await createMutate({
                resource: "peserta_diklat",
                values: {
                    ...values,
                    tahun_diklat: filterTahun,
                    jenis_diklat: filterJenis, 
                    dicatat_oleh: user?.full_name || "Admin",
                    tanggal_lahir: values.tanggal_lahir ? values.tanggal_lahir.format('YYYY-MM-DD') : null
                }
            });
            message.success("Peserta diklat berhasil didaftarkan");
            setIsModalOpen(false);
            form.resetFields();
            tableQueryResult.refetch();
        } catch (error) {
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
            width: 300,
            render: (_, r) => (
                <div className="flex items-start gap-3 py-1">
                    <Avatar shape="square" size="large" style={{ backgroundColor: '#059669' }} icon={<UserOutlined />} />
                    <div className="flex flex-col">
                        <Text strong className="text-base text-gray-800">{r.nama_lengkap}</Text>
                        <Space size={4} className="mt-1">
                            <Tag color="blue" className="m-0 border-0 rounded-sm">
                                <BankOutlined className="mr-1"/> {r.pesantren_asal}
                            </Tag>
                        </Space>
                    </div>
                </div>
            )
        },
        {
            title: "Kontak & Alamat",
            dataIndex: "alamat_lengkap",
            width: 200,
            render: (val, r) => (
                <div className="flex gap-2">
                    <Tooltip title={val || "Alamat tidak diisi"} placement="topLeft" color="blue">
                        <Button size="small" icon={<EnvironmentOutlined />} className="text-gray-500">Alamat</Button>
                    </Tooltip>
                    {r.no_telepon ? (
                         <Tooltip title={r.no_telepon}>
                            <Button size="small" icon={<PhoneOutlined />} className="text-green-600">Telp</Button>
                        </Tooltip>
                    ) : <span className="text-xs text-gray-300">-</span>}
                </div>
            )
        },
        {
            title: "Pendaftaran",
            dataIndex: "biaya_pendaftaran",
            valueType: "money",
            align: "right",
            width: 150
        },
        {
            title: "Belanja Kitab",
            dataIndex: "belanja_kitab_nominal",
            align: "right",
            width: 150,
            render: (val, r) => (
                <Tooltip title={r.rincian_belanja || "Tidak ada rincian"}>
                    <div className={`cursor-help ${Number(val) > 0 ? 'font-bold text-emerald-700' : 'text-gray-400'}`}>
                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(Number(val))}
                        {Number(val) > 0 && <ShopOutlined className="ml-2"/>}
                    </div>
                </Tooltip>
            )
        },
        {
            title: "Aksi",
            valueType: "option",
            fixed: "right",
            width: 120,
            render: (_, record) => [
                <Tooltip title="Cetak Kartu Peserta">
                    <Button size="small" icon={<PrinterOutlined />} onClick={() => handlePrint(record)} className="text-blue-600 border-blue-200 bg-blue-50"/>
                </Tooltip>,
                <Tooltip title="Hapus">
                    <Button danger size="small" icon={<DeleteOutlined />} onClick={() => {
                        if(confirm("Hapus peserta ini?")) deleteMutate({ resource: "peserta_diklat", id: record.id });
                    }} />
                </Tooltip>
            ]
        }
    ];

    return (
        <div className="pb-20">
            {/* 1. HEADER & SUMMARY */}
            <Row gutter={24} className="mb-6">
                <Col span={16}>
                    <Title level={3} style={{margin:0}}>Diklat Pasaran Al-Hasanah</Title>
                    <Text type="secondary">Data Pesantren Luar (Non-Mukimin)</Text>
                    <div className="mt-4 flex gap-4">
                        <Select value={filterTahun} onChange={setFilterTahun} style={{width: 140}} options={HIJRI_YEARS} />
                        <Select 
                            value={filterJenis} onChange={setFilterJenis} style={{width: 200}} 
                            options={[
                                {label: '🌟 Pasaran Maulid', value: 'MAULID'},
                                {label: '📜 Pasaran Syaban', value: 'SYABAN'},
                                {label: '🌙 Pasaran Ramadhan', value: 'RAMADHAN'},
                                {label: '🕋 Pasaran Dzulhijjah', value: 'DZULHIJJAH'},
                            ]}
                        />
                    </div>
                </Col>
                <Col span={8}>
                    <Card size="small" className="bg-emerald-50 border-emerald-200">
                        <Statistic 
                            title={`Pemasukan ${filterJenis} ${filterTahun} H`} 
                            value={totalPemasukan} 
                            prefix="Rp" 
                            valueStyle={{ color: '#047857', fontWeight: 'bold' }}
                        />
                        <div className="text-xs text-emerald-600 mt-1"></div>
                    </Card>
                </Col>
            </Row>

            {/* 2. TABLE */}
            <ProTable<IPesertaDiklat>
                {...tableProps}
                columns={columns}
                rowKey="id"
                headerTitle={`Data Peserta (${tableQueryResult?.data?.total || 0})`}
                search={false}
                toolBarRender={() => [
                    <Button key="export" icon={<DownloadOutlined />} onClick={handleExport} loading={loadingExport}>
                        Export Data
                    </Button>,
                    <Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
                        Daftar Baru
                    </Button>
                ]}
                className="shadow-sm rounded-lg"
            />

            {/* 3. MODAL PENDAFTARAN (Tetap Sama) */}
            <Modal
                title={`Pendaftaran ${filterJenis} ${filterTahun} H`}
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                onOk={() => form.submit()}
                width={700}
                centered
            >
                <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ biaya_pendaftaran: 50000, belanja_kitab_nominal: 0 }}>
                    <div className="bg-blue-50 p-4 rounded-lg mb-4 border border-blue-100">
                        <Text strong className="text-blue-700">Data Diri Peserta diklat</Text>
                        <Row gutter={16} className="mt-2">
                            <Col span={12}>
                                <Form.Item name="nama_lengkap" label="Nama Lengkap" rules={[{required:true}]}><Input /></Form.Item>
                                <Form.Item name="pesantren_asal" label="Asal Pesantren" rules={[{required:true}]}><Input /></Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="tempat_lahir" label="Tempat Lahir"><Input /></Form.Item>
                                <Form.Item name="tanggal_lahir" label="Tanggal Lahir"><DatePicker style={{width:'100%'}}/></Form.Item>
                            </Col>
                            <Col span={24}>
                                <Form.Item name="alamat_lengkap" label="Alamat Rumah"><Input.TextArea rows={2}/></Form.Item>
                                <Form.Item name="no_telepon" label="No. Telepon / WA"><Input /></Form.Item>
                            </Col>
                        </Row>
                    </div>

                    <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                        <div className="flex justify-between">
                            <Text strong className="text-emerald-700"><ShopOutlined/> Administrasi & Koperasi</Text>
                            <Tag color="green">PEMASUKAN</Tag>
                        </div>
                        <Row gutter={16} className="mt-2">
                            <Col span={12}>
                             <Form.Item name="biaya_pendaftaran" label="Biaya Pendaftaran">
                            <InputNumber 
                                style={{width:'100%'}} 
                                addonBefore="Rp"
                                formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                                parser={(value) => value?.replace(/\./g, "") as any}
                                placeholder="0"
                                min={0}
                               />
                           </Form.Item>
                            </Col>
                            <Col span={12}>
                             <Form.Item name="belanja_kitab_nominal" label="Total Belanja Kitab & Alat">
                            <InputNumber 
                                style={{width:'100%'}} 
                                addonBefore="Rp"
                                formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                                parser={(value) => value?.replace(/\./g, '') as any}
                                placeholder="0"
                                min={0}
                            />
                        </Form.Item>
                            </Col>
                            <Col span={24}>
                                <Form.Item name="rincian_belanja" label="Rincian Barang (Opsional)"><Input.TextArea placeholder="Catat barang yang dibeli..." /></Form.Item>
                            </Col>
                        </Row>
                    </div>
                </Form>
            </Modal>

            {/* 4. MODAL PRINT PDF - ENTERPRISE LAYOUT FIX */}
            <Modal
                title="Cetak Kartu Peserta"
                open={isPrintOpen}
                onCancel={() => setIsPrintOpen(false)}
                footer={[
                    <Button key="close" onClick={() => setIsPrintOpen(false)}>Tutup</Button>,
                    <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={handlePrintAction}>Cetak PDF</Button>
                ]}
                width={650}
                centered
            >
                <div className="p-8 bg-white" ref={componentRef}>
                    <style>{`
                        @media print { 
                            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } 
                            .card-container { border: 2px solid #000; padding: 20px; position: relative; }
                            .header-table { border-bottom: 2px solid #000; width: 100%; margin-bottom: 20px; }
                        }
                    `}</style>
                    
                    <div style={{ border: '2px solid #333', padding: '25px', position: 'relative', background: '#fff' }}>
                        
                        {/* 1. HEADER: TABLE LAYOUT AGAR RAPI */}
                        <table style={{ width: '100%', borderBottom: '3px double #000', paddingBottom: '10px', marginBottom: '20px' }}>
                            <tbody>
                                <tr>
                                    <td style={{ width: '80px', verticalAlign: 'middle' }}>
                                        {/* Logo Placeholder */}
                                        <div style={{ width: '70px', height: '70px', background: '#059669', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '24px' }}>AH</div>
                                    </td>
                                    <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                        <div style={{ fontSize: '14px', fontWeight: 'bold', letterSpacing: '2px' }}>PANITIA PELAKSANA</div>
                                        <div style={{ fontSize: '18px', fontWeight: '900', textTransform: 'uppercase', color: '#000' }}>PASARAN {filterJenis} {filterTahun} H</div>
                                        <div style={{ fontSize: '16px', fontWeight: 'bold' }}>PONDOK PESANTREN AL-HASANAH</div>
                                        <div style={{ fontSize: '10px', fontStyle: 'italic' }}>Jl. Raya Cibeuti No.13, Kec. Kawalu, Tasikmalaya - Jawa Barat</div>
                                    </td>
                                    <td style={{ width: '80px' }}></td> 
                                </tr>
                            </tbody>
                        </table>

                        {/* 2. BODY: FOTO & DATA */}
                        <div style={{ textAlign: 'center', marginBottom: '20px', fontWeight: 'bold', textDecoration: 'underline', fontSize: '16px' }}>KARTU TANDA PESERTA</div>

                        <table style={{ width: '100%' }}>
                            <tbody>
                                <tr>
                                    {/* FOTO AREA */}
                                    <td style={{ width: '30%', verticalAlign: 'top', paddingRight: '15px' }}>
                                        <div style={{ width: '120px', height: '150px', border: '1px solid #999', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                                            <span style={{ color: '#999', fontSize: '10px' }}>FOTO 3x4</span>
                                        </div>
                                    </td>

                                    {/* DATA AREA */}
                                    <td style={{ width: '70%', verticalAlign: 'top' }}>
                                        <table style={{ width: '100%', fontSize: '14px', lineHeight: '1.8' }}>
                                            <tbody>
                                                <tr>
                                                    <td style={{ width: '120px', fontWeight: 'bold' }}>Nama Lengkap</td>
                                                    <td>: {printData?.nama_lengkap?.toUpperCase()}</td>
                                                </tr>
                                                <tr>
                                                    <td style={{ fontWeight: 'bold' }}>Asal Pesantren</td>
                                                    <td>: {printData?.pesantren_asal}</td>
                                                </tr>
                                                <tr>
                                                    <td style={{ fontWeight: 'bold' }}>TTL</td>
                                                    <td>: {printData?.tempat_lahir}, {printData?.tanggal_lahir ? dayjs(printData.tanggal_lahir).format('DD MMM YYYY') : '-'}</td>
                                                </tr>
                                                <tr>
                                                    <td style={{ fontWeight: 'bold', verticalAlign: 'top' }}>Alamat</td>
                                                    <td>: {printData?.alamat_lengkap}</td>
                                                </tr>
                                                <tr>
                                                    <td style={{ fontWeight: 'bold' }}>ID Registrasi</td>
                                                    <td>: <b>#{printData?.id.toString().padStart(4, '0')}</b></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        {/* 3. PERNYATAAN */}
                        <div style={{ marginTop: '25px', border: '1px solid #ccc', padding: '10px', fontSize: '11px', fontStyle: 'italic', background: '#f9fafb', borderRadius: '4px' }}>
                            "Saya berjanji akan mengikuti kegiatan diklat ini dengan sungguh-sungguh dan mentaati tata tertib Pesantren Al-Hasanah."
                        </div>

                        {/* 4. FOOTER: TTD & QR */}
                        <table style={{ width: '100%', marginTop: '30px' }}>
                            <tbody>
                                <tr>
                                    <td style={{ textAlign: 'center', width: '30%' }}>
                                        <QRCode value={`AH-DIKLAT-${printData?.id}`} size={70} bordered={false} />
                                        <div style={{ fontSize: '9px', marginTop: '5px' }}>Scan Validasi</div>
                                    </td>
                                    <td style={{ width: '30%' }}></td>
                                    <td style={{ textAlign: 'center', width: '40%' }}>
                                        <div style={{ fontSize: '12px' }}>Tasikmalaya, {dayjs().format('DD MMMM YYYY')}</div>
                                        <div style={{ fontSize: '12px', marginBottom: '60px' }}>Panitia Pelaksana,</div>
                                        <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto' }}></div>
                                        <div style={{ fontSize: '12px', fontWeight: 'bold', marginTop: '5px' }}>Mengetahui</div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                    </div>
                    {/* CUT LINE */}
                    <div style={{ borderTop: '1px dashed #999', marginTop: '30px', paddingTop: '10px', textAlign: 'center', fontSize: '10px', color: '#666' }}>
                        Potong di sini  (Arsip)
                    </div>
                </div>
            </Modal>
        </div>
    );
};