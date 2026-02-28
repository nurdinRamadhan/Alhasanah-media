import React, { useState, useRef } from "react";
import { useTable } from "@refinedev/antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import { 
    Tag, Space, Button, Typography, Tooltip, Avatar, Modal, Select, 
    Card, Row, Col, Statistic, Input, InputNumber, Form, DatePicker, message
} from "antd";
import { 
    PlusOutlined, StarOutlined, PrinterOutlined, UserOutlined, 
    ShopOutlined, EnvironmentOutlined, DownloadOutlined, DeleteOutlined,
    BankOutlined, PhoneOutlined, SafetyCertificateOutlined, ClockCircleOutlined, 
    MoonOutlined, 
    CompassOutlined
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

    // Watch values untuk kalkulasi real-time
    const uangMiftah = Form.useWatch('uang_miftah', form) || 0;
    const biayaListrik = Form.useWatch('biaya_listrik', form) || 0;
    const kosMakan = Form.useWatch('kos_makan', form) || 0;
    const tafaruqon = Form.useWatch('tafaruqon', form) || 0;
    
    const totalPendaftaranDinamis = uangMiftah + biayaListrik + kosMakan + tafaruqon;

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

    const totalPemasukan = tableQueryResult?.data?.data.reduce((acc, curr) => 
        acc + Number(curr.biaya_pendaftaran) + Number(curr.belanja_kitab_nominal), 0
    ) || 0;

    const handleExport = async () => {
        setLoadingExport(true);
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet(`Pasaran ${filterJenis}`);

            worksheet.addRow(['REKAPITULASI PESERTA DIKLAT & PASARAN']);
            worksheet.addRow([`Program: ${filterJenis} ${filterTahun} H`]);
            worksheet.addRow([]);

            const headerRow = worksheet.addRow(['No', 'Nama Lengkap', 'Asal Pesantren', 'Alamat', 'No HP', 'Biaya Daftar', 'Belanja Kitab', 'Total Bayar']);
            headerRow.font = { bold: true };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }; 

            let grandTotal = 0;
            tableQueryResult?.data?.data.forEach((item, index) => {
                const total = Number(item.biaya_pendaftaran) + Number(item.belanja_kitab_nominal);
                grandTotal += total;
                worksheet.addRow([
                    index + 1, item.nama_lengkap, item.pesantren_asal, item.alamat_lengkap, item.no_telepon,
                    item.biaya_pendaftaran, item.belanja_kitab_nominal, total
                ]);
            });

            worksheet.addRow([]);
            const footerRow = worksheet.addRow(['', '', '', '', '', '', 'GRAND TOTAL', grandTotal]);
            footerRow.font = { bold: true };
            
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
            // Kalkulasi ulang untuk mapping ke field utama
            const totalBiayaPendaftaran = (values.uang_miftah || 0) + (values.biaya_listrik || 0) + (values.kos_makan || 0) + (values.tafaruqon || 0);

            await createMutate({
                resource: "peserta_diklat",
                values: {
                    ...values,
                    biaya_pendaftaran: totalBiayaPendaftaran, // Tetap disimpan di field lama demi kompatibilitas
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
                        <Button size="small" icon={<EnvironmentOutlined />} className="text-gray-500 hover:text-blue-500 transition-colors">Alamat</Button>
                    </Tooltip>
                    {r.no_telepon ? (
                         <Tooltip title={r.no_telepon}>
                            <Button size="small" icon={<PhoneOutlined />} className="text-emerald-600 border-emerald-100 bg-emerald-50">Telp</Button>
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
                <Tooltip title="Cetak Formulir Resmi">
                    <Button size="small" icon={<PrinterOutlined />} onClick={() => handlePrint(record)} className="text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-600 hover:text-white transition-all"/>
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
                    <Title level={3} style={{margin:0, fontWeight: 700}} className="text-gray-800 tracking-tight">Diklat Pasaran Al-Hasanah</Title>
                    <Text className="text-gray-500">Sistem Manajemen Data Pesantren Luar (Non-Mukimin)</Text>
                    <div className="mt-5 flex gap-4">
                        <Select 
                            value={filterTahun} onChange={setFilterTahun} 
                            style={{width: 140}} options={HIJRI_YEARS} 
                            className="shadow-sm"
                        />
                        <Select 
                            value={filterJenis} 
                            onChange={setFilterJenis} 
                            style={{ width: 220 }} 
                            className="shadow-sm hover:shadow-md transition-all duration-300 font-medium"
                            options={[
                                {
                                    label: (
                                        <Space>
                                            <StarOutlined className="text-amber-500" />
                                            <span>Pasaran Maulid</span>
                                        </Space>
                                    ),
                                    value: 'MAULID'
                                },
                                {
                                    label: (
                                        <Space>
                                            <ClockCircleOutlined className="text-blue-500" />
                                            <span>Pasaran Syaban</span>
                                        </Space>
                                    ),
                                    value: 'SYABAN'
                                },
                                {
                                    label: (
                                        <Space>
                                            <MoonOutlined className="text-indigo-600" />
                                            <span>Pasaran Ramadhan</span>
                                        </Space>
                                    ),
                                    value: 'RAMADHAN'
                                },
                                {
                                    label: (
                                        <Space>
                                            <CompassOutlined className="text-emerald-500" />
                                            <span>Pasaran Dzulhijjah</span>
                                        </Space>
                                    ),
                                    value: 'DZULHIJJAH'
                                },
                            ]}
                        />
                    </div>
                </Col>
                <Col span={8}>
                    <Card size="small" className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100 shadow-sm rounded-xl">
                        <Statistic 
                            title={<span className="text-emerald-700 font-medium">Total Pemasukan {filterJenis} {filterTahun} H</span>} 
                            value={totalPemasukan} 
                            prefix="Rp" 
                            valueStyle={{ color: '#047857', fontWeight: '800', fontSize: '28px' }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* 2. TABLE */}
            <ProTable<IPesertaDiklat>
                {...tableProps}
                columns={columns}
                rowKey="id"
                headerTitle={
                    <div className="flex items-center gap-2">
                        <SafetyCertificateOutlined className="text-emerald-600 text-xl" />
                        <span className="font-semibold text-gray-700">Data Peserta ({tableQueryResult?.data?.total || 0})</span>
                    </div>
                }
                search={false}
                toolBarRender={() => [
                    <Button key="export" icon={<DownloadOutlined />} onClick={handleExport} loading={loadingExport} className="border-gray-300">
                        Export Excel
                    </Button>,
                    <Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 shadow-md">
                        Daftar Baru
                    </Button>
                ]}
                className="shadow-sm rounded-2xl overflow-hidden border border-gray-100"
            />

            {/* 3. MODAL PENDAFTARAN - UPDATED BIAYA */}
            <Modal
                title={
                    <div className="flex items-center gap-2 border-b pb-3">
                        <PlusOutlined className="text-emerald-600" />
                        <span className="font-bold text-lg">Pendaftaran {filterJenis} {filterTahun} H</span>
                    </div>
                }
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                onOk={() => form.submit()}
                width={800}
                centered
                okText="Simpan Data"
                cancelText="Batal"
                okButtonProps={{ className: 'bg-emerald-600 hover:bg-emerald-700' }}
            >
                <Form form={form} layout="vertical" onFinish={handleSubmit} 
                    initialValues={{ 
                        uang_miftah: 110000, 
                        biaya_listrik: 50000, 
                        kos_makan: 460000, 
                        tafaruqon: 30000,
                        belanja_kitab_nominal: 0 
                    }}
                    className="mt-4"
                >
                    <div className="bg-slate-50 p-5 rounded-xl mb-5 border border-slate-200">
                        <Text strong className="text-slate-800 text-base mb-4 block"><UserOutlined/> Data Diri Peserta</Text>
                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item name="nama_lengkap" label="Nama Lengkap" rules={[{required:true}]}><Input placeholder="Masukkan nama sesuai KTP/KK" className="rounded-md" /></Form.Item>
                                <Form.Item name="pesantren_asal" label="Asal Pesantren" rules={[{required:true}]}><Input placeholder="Contoh: PP. Miftahul Huda" className="rounded-md" /></Form.Item>
                                <Form.Item name="alamat_pesantren" label="Alamat Pesantren"><Input.TextArea rows={3} placeholder="Tuliskan alamat pesantren asal secara detail..." className="rounded-md" /></Form.Item>
                                <Form.Item name="nama_wali" label="Nama Orang Tua / Wali"><Input placeholder="Nama Ayah / Wali" className="rounded-md" /></Form.Item>
                                <Form.Item name="pekerjaan_wali" label="Pekerjaan Orang Tua / Wali"><Input placeholder="Contoh: Wiraswasta" className="rounded-md" /></Form.Item>
                            </Col>
                            <Col span={12}>
                                <Row gutter={8}>
                                    <Col span={12}><Form.Item name="tempat_lahir" label="Tempat Lahir"><Input className="rounded-md" /></Form.Item></Col>
                                    <Col span={12}><Form.Item name="tanggal_lahir" label="Tanggal Lahir"><DatePicker style={{width:'100%'}} className="rounded-md" format="DD-MM-YYYY" /></Form.Item></Col>
                                </Row>
                                <Form.Item name="no_telepon" label="No. Telepon / WA"><Input placeholder="08xxxxxxxxx" className="rounded-md" /></Form.Item>
                                <Form.Item name="alamat_lengkap" label="Alamat Lengkap (Kp/Jalan, RT/RW, Desa, Kec, Kab/Kota)"><Input.TextArea rows={4} placeholder="Tuliskan alamat secara detail..." className="rounded-md" /></Form.Item>
                            </Col>
                        </Row>
                    </div>

                    <div className="bg-emerald-50/50 p-5 rounded-xl border border-emerald-100">
                        <div className="flex justify-between items-center mb-4 border-b border-emerald-200 pb-2">
                            <Text strong className="text-emerald-800 text-base"><ShopOutlined/> Administrasi & Koperasi</Text>
                            <Tag color="emerald" className="rounded-full px-3">Total Adm: Rp {new Intl.NumberFormat('id-ID').format(totalPendaftaranDinamis)}</Tag>
                        </div>
                        <Row gutter={16}>
                            {/* Rincian Pendaftaran yang dipecah */}
                            <Col span={6}>
                                <Form.Item name="uang_miftah" label="Uang Miftah">
                                    <InputNumber style={{width:'100%'}} addonBefore="Rp" formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} parser={(val) => val?.replace(/\./g, '') as any} min={0} />
                                </Form.Item>
                            </Col>
                            <Col span={6}>
                                <Form.Item name="biaya_listrik" label="Listrik">
                                    <InputNumber style={{width:'100%'}} addonBefore="Rp" formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} parser={(val) => val?.replace(/\./g, '') as any} min={0} />
                                </Form.Item>
                            </Col>
                            <Col span={6}>
                                <Form.Item name="kos_makan" label="Kos Makan">
                                    <InputNumber style={{width:'100%'}} addonBefore="Rp" formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} parser={(val) => val?.replace(/\./g, '') as any} min={0} />
                                </Form.Item>
                            </Col>
                            <Col span={6}>
                                <Form.Item name="tafaruqon" label="Tafaruqon">
                                    <InputNumber style={{width:'100%'}} addonBefore="Rp" formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} parser={(val) => val?.replace(/\./g, '') as any} min={0} />
                                </Form.Item>
                            </Col>
                        </Row>
                        
                        <div className="mt-2 pt-4 border-t border-emerald-100 border-dashed">
                            <Row gutter={16}>
                                <Col span={8}>
                                    <Form.Item name="belanja_kitab_nominal" label={<span className="font-semibold text-teal-800">Total Belanja Kitab & Alat</span>}>
                                        <InputNumber style={{width:'100%'}} addonBefore="Rp" formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} parser={(val) => val?.replace(/\./g, '') as any} min={0} className="border-teal-300" />
                                    </Form.Item>
                                </Col>
                                <Col span={16}>
                                    <Form.Item name="rincian_belanja" label="Rincian Barang (Opsional)"><Input placeholder="Contoh: Kitab Jurumiyah, Pulpen, Buku Tulis..." className="rounded-md" /></Form.Item>
                                </Col>
                            </Row>
                        </div>
                    </div>
                </Form>
            </Modal>

            {/* 4. MODAL PRINT PDF - DOKUMEN RESMI FORMAT */}
            <Modal
                title="Pratinjau Dokumen Formulir"
                open={isPrintOpen}
                onCancel={() => setIsPrintOpen(false)}
                footer={[
                    <Button key="close" onClick={() => setIsPrintOpen(false)} className="rounded-full px-6">Batal</Button>,
                    <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={handlePrintAction} className="bg-emerald-600 hover:bg-emerald-700 rounded-full px-6 shadow-md">Cetak Formulir A4</Button>
                ]}
                width={850}
                centered
            >
                {/* Kertas A4 Setup via CSS inline */}
                <div className="bg-gray-200 p-4 rounded-lg overflow-y-auto max-h-[70vh] flex justify-center">
                    <div ref={componentRef} style={{ width: '21cm', minHeight: '29.7cm', background: 'white', padding: '1.5cm', fontFamily: '"Times New Roman", Times, serif', color: 'black', position: 'relative', boxShadow: '0 0 10px rgba(0,0,0,0.1)' }}>
                        <style>{`
                            @media print { 
                                @page { size: 21cm 29.7cm; margin: 0; }
                                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; background: white; } 
                                .print-container { padding: 1.5cm; }
                            }
                        `}</style>

                        <div className="print-container">
                            {/* 1. KOP SURAT RESMI */}
                            <table style={{ width: '100%', borderBottom: '4px double black', paddingBottom: '10px', marginBottom: '20px' }}>
                                <tbody>
                                    <tr>
                                        <td style={{ width: '110px', verticalAlign: 'middle', textAlign: 'left' }}>
                                            <img src="https://sldobkbolvrahlnowrga.supabase.co/storage/v1/object/public/images/pesantren/logo.png" alt="Logo" style={{ width: '100px', height: 'auto' }} />
                                        </td>
                                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>YAYASAN PENDIDIKAN PONDOK PESANTREN</div>
                                            <div style={{ fontSize: '26px', fontWeight: '900', letterSpacing: '2px', color: '#047857', margin: '2px 0' }}>AL - HASANAH</div>
                                            <div style={{ fontSize: '12px' }}>Akta Notaris No. 40 Tanggal 21 Januari</div>
                                            <div style={{ fontSize: '11px', marginTop: '4px' }}>Sekretariat : Jl. Raya Cibeuti Km. 03 Kawalu Kota Tasikmalaya 46182</div>
                                        </td>
                                        <td style={{ width: '110px' }}></td> 
                                    </tr>
                                </tbody>
                            </table>

                            {/* 2. JUDUL DOKUMEN */}
                            <div style={{ textAlign: 'center', marginBottom: '25px', fontWeight: 'bold' }}>
                                <div style={{ textDecoration: 'underline', fontSize: '16px', textTransform: 'uppercase' }}>
                                    FORMULIR PENDAFTARAN PENGAJIAN INTENSIF PRIODE KE CLVI (156)
                                </div>
                                <div style={{ fontSize: '14px', marginTop: '3px' }}>
                                    01 {filterJenis} - 23 {filterJenis} {filterTahun} H.
                                </div>
                            </div>

                            {/* 3. GRID UTAMA (KIRI: DATA, KANAN: FOTO & QR) */}
                            <table style={{ width: '100%' }}>
                                <tbody>
                                    <tr>
                                        {/* KIRI: BIODATA */}
                                        <td style={{ width: '75%', verticalAlign: 'top', paddingRight: '20px' }}>
                                            <table style={{ width: '100%', fontSize: '13.5px', lineHeight: '2' }}>
                                                <tbody>
                                                    <tr>
                                                        <td style={{ width: '180px' }}>Nomor Pendaftaran</td>
                                                        <td>: <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>AH-{printData?.id.toString().padStart(5, '0')}</span></td>
                                                    </tr>
                                                    <tr>
                                                        <td>Tanggal Daftar</td>
                                                        <td>: {dayjs(printData?.created_at).format('DD MMMM YYYY')}</td>
                                                    </tr>
                                                    <tr>
                                                        <td>Nama Lengkap</td>
                                                        <td>: <b>{printData?.nama_lengkap?.toUpperCase()}</b></td>
                                                    </tr>
                                                    <tr>
                                                        <td>Asal Pesantren</td>
                                                        <td>: {printData?.pesantren_asal || '. . . . . . . . . . . . . . . . . . . . . . . .'}</td>
                                                    </tr>
                                                    <tr>
                                                        <td>Alamat Pesantren</td>
                                                        <td>: {printData?.alamat_pesantren || '. . . . . . . . . . . . . . . . . . . . . . . .'}</td>
                                                    </tr>
                                                    <tr>
                                                        <td>Tempat & Tanggal Lahir</td>
                                                        <td>: {printData?.tempat_lahir || '. . . . . . . . . . .'}, {printData?.tanggal_lahir ? dayjs(printData.tanggal_lahir).format('DD MMM YYYY') : '. . . . . . . . . . .'}</td>
                                                    </tr>
                                                    <tr>
                                                        <td style={{ verticalAlign: 'top' }}>Alamat Rumah</td>
                                                        <td style={{ lineHeight: '1.6', paddingTop: '6px' }}>
                                                            : {printData?.alamat_lengkap || 'No : . . . . Kampung : . . . . . . . . RT/RW . . . . / . . . . \nKel / Desa : . . . . . . . . . . . . . . . Kecamatan : . . . . . . . . . . . . . . \nKota / Kab : . . . . . . . . . . . . . . . '}
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td>Nama Orang tua / Wali</td>
                                                        <td>: {printData?.nama_wali || '. . . . . . . . . . . . . . . . . . . . . . . .'}</td>
                                                    </tr>
                                                    <tr>
                                                        <td>Pekerjaan Orang tua / Wali</td>
                                                        <td>: {printData?.pekerjaan_wali || '. . . . . . . . . . . . . . . . . . . . . . . .'}</td>
                                                    </tr>
                                                    <tr>
                                                        <td>No Tlp/Hp</td>
                                                        <td>: {printData?.no_telepon || '. . . . . . . . . . . . . . . . . . . . . . . .'}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </td>

                                        {/* KANAN: FOTO DAN QR CODE (Penempatan di bawah foto) */}
                                        <td style={{ width: '25%', verticalAlign: 'top', textAlign: 'center' }}>
                                            <div style={{ width: '3cm', height: '4cm', border: '1px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', marginBottom: '10px' }}>
                                                <span style={{ fontSize: '14px', color: '#555' }}>Photo<br/>3 x 4</span>
                                            </div>
                                            <div style={{ marginTop: '10px' }}>
                                                <QRCode value={`AH-VALID-${printData?.id}`} size={80} bordered={false} style={{ margin: '0 auto' }} />
                                                <div style={{ fontSize: '9px', marginTop: '2px', color: '#666' }}>Scan Validasi</div>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* 4. PERNYATAAN & PERSYARATAN */}
                            <div style={{ marginTop: '20px', fontSize: '13px', lineHeight: '1.6', textAlign: 'justify' }}>
                                <p style={{ textIndent: '30px', marginBottom: '15px' }}>
                                    Saya / Kami menyatakan Data diatas adalah benar dan menyetujui serta tunduk pada ketentuan dalam syarat - syarat umum pernyataan santri terlampir yang merupakan satu kesatuan dengan Formulir Pendaftaran ini maupun ketentuan lain yang berlaku dari waktu ke waktu di Ma'had Al - Hasanah.
                                </p>
                                
                                <p style={{ fontWeight: 'bold', marginBottom: '5px' }}>Persyaratan yang berlaku untuk masuk ke Ma'had Al - Hasanah sebagai berikut :</p>
                                <ol style={{ margin: '0', paddingLeft: '20px', marginBottom: '15px' }}>
                                    <li>Menyerahkan pas photo ukuran 3 x 4 sebanyak 2 lembar.</li>
                                    <li>Bersedia menta'ati segala peraturan Pesantren.</li>
                                    <li>Menandatangani surat pernyataan.</li>
                                    <li>Memenuhi / membayar biaya administrasi, antara lain :</li>
                                </ol>

                                {/* 5. RINCIAN BIAYA (Mirip format tabel / tabulasi) */}
                                <table style={{ width: '60%', marginLeft: '20px', fontSize: '13px', lineHeight: '1.8' }}>
                                    <tbody>
                                        <tr>
                                            <td style={{ width: '150px' }}>Uang Miftah</td>
                                            <td style={{ width: '20px' }}>: Rp.</td>
                                            <td style={{ textAlign: 'right' }}>110.000</td>
                                        </tr>
                                        <tr>
                                            <td>Listrik</td>
                                            <td>: Rp.</td>
                                            <td style={{ textAlign: 'right' }}>50.000</td>
                                        </tr>
                                        <tr>
                                            <td>kos makan</td>
                                            <td>: Rp.</td>
                                            <td style={{ textAlign: 'right' }}>460.000</td>
                                        </tr>
                                        <tr>
                                            <td>Tafaruqon</td>
                                            <td>: Rp.</td>
                                            <td style={{ textAlign: 'right', borderBottom: '1px solid black', paddingBottom: '2px' }}>30.000</td>
                                            <td style={{ paddingLeft: '5px' }}>+</td>
                                        </tr>
                                        <tr>
                                            <td style={{ fontWeight: 'bold' }}>Jumlah</td>
                                            <td style={{ fontWeight: 'bold' }}>: Rp.</td>
                                            <td style={{ fontWeight: 'bold', textAlign: 'right' }}>650.000</td>
                                        </tr>
                                    </tbody>
                                </table>
                                <div style={{ fontSize: '11px', fontStyle: 'italic', marginTop: '5px', marginLeft: '20px' }}>
                                    *kitab disediakan di kantor sekertariat
                                </div>
                            </div>

                            {/* 6. KOLOM TANDA TANGAN */}
                            <table style={{ width: '100%', marginTop: '40px', fontSize: '13px', textAlign: 'center' }}>
                                <tbody>
                                    <tr>
                                        <td style={{ width: '50%' }}>Pendaftar</td>
                                        <td style={{ width: '50%' }}>Penerima</td>
                                    </tr>
                                    <tr>
                                        <td style={{ height: '70px' }}></td>
                                        <td></td>
                                    </tr>
                                    <tr>
                                        <td>( <span style={{ textDecoration: 'underline' }}>{printData?.nama_lengkap || '. . . . . . . . . . . . . . . . .'}</span> )</td>
                                        <td>( . . . . . . . . . . . . . . . . . . . . . . )</td>
                                    </tr>
                                </tbody>
                            </table>
                            
                            <table style={{ width: '100%', marginTop: '30px', fontSize: '13px', textAlign: 'center' }}>
                                <tbody>
                                    <tr>
                                        <td>Mengetahui :</td>
                                    </tr>
                                    <tr>
                                        <td style={{ height: '70px' }}></td>
                                    </tr>
                                    <tr>
                                        <td>( . . . . . . . . . . . . . . . . . . . . . . )</td>
                                    </tr>
                                    <tr>
                                        <td>Pimpinan ponpes</td>
                                    </tr>
                                    <tr>
                                        <td style={{ fontSize: '11px', fontStyle: 'italic', paddingTop: '10px', textAlign: 'left' }}>*Di isi oleh panitia</td>
                                    </tr>
                                </tbody>
                            </table>

                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
};