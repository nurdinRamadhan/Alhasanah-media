import React, { useState, useRef } from "react";
import { useTable, useSelect } from "@refinedev/antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import { Tag, Space, Button, Typography, Tooltip, Avatar, Modal, Form, Select, InputNumber, Input, message, DatePicker, Card, Row, Col, Statistic, Divider, QRCode, Radio, theme } from "antd";
import { 
    PlusOutlined, DollarOutlined, CreditCardOutlined, DownloadOutlined, 
    UsergroupAddOutlined, CheckCircleOutlined, WalletOutlined, 
    EditOutlined, PrinterOutlined, ShopOutlined, CalendarOutlined,
    BankOutlined, FilterOutlined, FileExcelOutlined
} from "@ant-design/icons";
import { ITagihanSantri, ISantri } from "../../types";
import { useNavigation, useDelete, useUpdate } from "@refinedev/core";
import dayjs from "dayjs";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { supabaseClient } from "../../utility/supabaseClient";
import { useReactToPrint } from 'react-to-print';

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

export const TagihanList = () => {
    const { token } = theme.useToken();
    const { create, push } = useNavigation();
    const { mutate: deleteMutate } = useDelete();
    const { mutate: updateMutate } = useUpdate();

    // --- FILTER STATE ---
    const [filterMonth, setFilterMonth] = useState<dayjs.Dayjs>(dayjs());
    const [filterKelas, setFilterKelas] = useState<string | null>(null);
    const [filterJurusan, setFilterJurusan] = useState<string | null>(null);

    // --- TABLE CONFIG ---
    const { tableProps, tableQueryResult,  } = useTable<ITagihanSantri>({
        resource: "tagihan_santri",
        syncWithLocation: false,
        filters: {
            permanent: [
                {
                    field: "created_at",
                    operator: "gte",
                    value: filterMonth.startOf('month').toISOString()
                },
                {
                    field: "created_at",
                    operator: "lte",
                    value: filterMonth.endOf('month').toISOString()
                }
            ]
        },
        meta: { select: "*, santri!inner(nama, nis, kelas, jurusan, foto_url)" },
        sorters: { initial: [{ field: "created_at", order: "desc" }] }
    });

    // --- CLIENT SIDE FILTERING ---
    const filteredData = tableQueryResult?.data?.data.filter(item => {
        let pass = true;
        if (filterKelas && item.santri?.kelas !== filterKelas) pass = false;
        if (filterJurusan && item.santri?.jurusan !== filterJurusan) pass = false;
        return pass;
    }) || [];

    const finalTableProps = {
        ...tableProps,
        dataSource: filteredData,
        pagination: { ...tableProps.pagination, total: filteredData.length },
        // ENTERPRISE FIX: Aktifkan scroll horizontal
        scroll: { x: 1000 } // Angka ini memaksa tabel melebar, memicu scrollbar horizontal
    };

    // --- STATE MODALS ---
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isReceiptOpen, setIsReceiptOpen] = useState(false);
    
    // --- STATE LOGIC ---
    const [selectedTagihan, setSelectedTagihan] = useState<ITagihanSantri | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isLoadingExport, setIsLoadingExport] = useState(false);
    const receiptRef = useRef(null);
    const [formBulk] = Form.useForm();

    // --- STATE EXPORT ---
    const [exportType, setExportType] = useState<'GLOBAL' | 'PERSONAL'>('GLOBAL');
    const [exportDateRange, setExportDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>([dayjs().startOf('month'), dayjs().endOf('month')]);
    const [selectedSantriNIS, setSelectedSantriNIS] = useState<string | null>(null);

    // Hook Cari Santri (Untuk Export Personal)
    const { selectProps: santriSelectProps } = useSelect<ISantri>({
        resource: "santri",
        optionLabel: "nama",
        optionValue: "nis",
        filters: [{ field: "status_santri", operator: "eq", value: "AKTIF" }],
        onSearch: (value) => [{ field: "nama", operator: "contains", value }],
    });

    // --- STATISTIK ---
    const totalTunggakan = filteredData.reduce((acc, curr) => acc + (curr.status === 'BELUM' ? Number(curr.sisa_tagihan) : 0), 0);
    const totalLunas = filteredData.filter(i => i.status === 'LUNAS').length;

    // --- LOGIC 1: BAYAR TUNAI ---
    const handleCashPayment = () => {
        if(!selectedTagihan) return;
        setIsProcessing(true);
        updateMutate({
            resource: "tagihan_santri",
            id: selectedTagihan.id,
            values: { status: "LUNAS", sisa_tagihan: 0 },
            successNotification: { 
                message: "Pembayaran Tunai Berhasil", 
                description: `Tagihan atas nama ${selectedTagihan.santri?.nama} telah lunas.`,
                type: "success"
            },
        }, {
            onSuccess: () => {
                setIsProcessing(false);
                setIsPayModalOpen(false);
                // Update local state agar struk langsung bisa dicetak dengan status LUNAS
                const updatedRec = { ...selectedTagihan, status: 'LUNAS' as const, sisa_tagihan: 0 };
                handlePrintReceipt(updatedRec); 
            },
            onError: () => { 
                setIsProcessing(false); 
                message.error("Gagal memproses pembayaran tunai."); 
            }
        });
    };

    // --- LOGIC 2: BAYAR MIDTRANS ---
    const handleMidtransPayment = async () => {
        if(!selectedTagihan) return;
        try {
            message.loading("Membuka Payment Gateway...", 1);
            const { data, error } = await supabaseClient.functions.invoke('midtrans-snap', {
                body: {
                    order_id: selectedTagihan.id,
                    gross_amount: selectedTagihan.sisa_tagihan,
                    customer_details: {
                        first_name: selectedTagihan.santri?.nama,
                        email: "admin@alhasanah.com", phone: "08123456789"
                    },
                    item_details: [{
                        id: selectedTagihan.id, price: selectedTagihan.sisa_tagihan,
                        quantity: 1, name: selectedTagihan.deskripsi_tagihan.substring(0, 50)
                    }]
                }
            });

            if (error) throw error;
            if (!data.token) throw new Error("Gagal mendapatkan token");

            // @ts-ignore
            window.snap.pay(data.token, {
                onSuccess: function(){ message.success("Pembayaran Berhasil!"); setIsPayModalOpen(false); window.location.reload(); },
                onPending: function(){ message.warning("Menunggu Pembayaran..."); setIsPayModalOpen(false); },
                onError: function(){ message.error("Pembayaran Gagal!"); },
                onClose: function(){ message.info("Popup ditutup"); }
            });
        } catch (err: any) { message.error(err.message); }
    };

    // --- LOGIC 3: GENERATE MASSAL ---
    const handleBulkCreate = async (values: any) => {
        try {
            message.loading({ content: "Memproses tagihan massal...", key: 'bulk' });
            // Ambil Santri Aktif di Kelas Tersebut
            const { data: santris, error } = await supabaseClient
                .from('santri')
                .select('nis')
                .eq('kelas', values.kelas)
                .eq('status_santri', 'AKTIF');

            if(error || !santris?.length) throw new Error("Tidak ada santri aktif di kelas tersebut");

            const batchData = santris.map(s => ({
                santri_nis: s.nis,
                deskripsi_tagihan: values.deskripsi,
                nominal_tagihan: values.nominal,
                sisa_tagihan: values.nominal,
                tanggal_jatuh_tempo: values.jatuh_tempo.toISOString(),
                status: 'BELUM',
                jenis_pembayaran_id: 1 
            }));

            const { error: insertErr } = await supabaseClient.from('tagihan_santri').insert(batchData);
            if(insertErr) throw insertErr;

            message.success({ content: `Sukses membuat tagihan untuk ${santris.length} santri`, key: 'bulk' });
            setIsBulkModalOpen(false);
            window.location.reload();
        } catch (err: any) {
            message.error({ content: err.message, key: 'bulk' });
        }
    };

    // --- LOGIC 4: EXPORT EXCEL ---
    const handleExport = async () => {
        if (!exportDateRange) { message.error("Pilih periode tanggal"); return; }
        setIsLoadingExport(true);
        try {
            const startDate = exportDateRange[0].startOf('day').toISOString();
            const endDate = exportDateRange[1].endOf('day').toISOString();
            const wb = new ExcelJS.Workbook();

            if (exportType === 'GLOBAL') {
                const ws = wb.addWorksheet('Laporan Keuangan');
                const { data: logs, error } = await supabaseClient
                    .from('tagihan_santri')
                    .select('*, santri(nama, nis, kelas, jurusan)')
                    .gte('created_at', startDate).lte('created_at', endDate)
                    .order('created_at', { ascending: false });

                if (error) throw error;

                ws.addRow(['LAPORAN KEUANGAN PESANTREN']);
                ws.addRow([`Periode: ${exportDateRange[0].format('DD MMM')} - ${exportDateRange[1].format('DD MMM YYYY')}`]);
                ws.addRow([]);
                ws.getRow(4).values = ['Tanggal', 'Jatuh Tempo', 'NIS', 'Nama Santri', 'Kelas', 'Deskripsi', 'Nominal', 'Status'];
                ws.getRow(4).font = { bold: true };
                
                logs?.forEach(item => {
                    ws.addRow([
                        dayjs(item.created_at).format('DD/MM/YYYY'), dayjs(item.tanggal_jatuh_tempo).format('DD/MM/YYYY'),
                        item.santri_nis, item.santri?.nama, `${item.santri?.kelas}-${item.santri?.jurusan}`,
                        item.deskripsi_tagihan, item.nominal_tagihan, item.status
                    ]);
                });
            } else {
                if (!selectedSantriNIS) throw new Error("Pilih santri dulu");
                const { data: santri } = await supabaseClient.from('santri').select('*').eq('nis', selectedSantriNIS).single();
                const { data: logs } = await supabaseClient.from('tagihan_santri').select('*').eq('santri_nis', selectedSantriNIS).gte('created_at', startDate).lte('created_at', endDate);

                const ws = wb.addWorksheet(`SPP - ${santri.nama}`);
                ws.addRow(['KARTU PEMBAYARAN SANTRI']);
                ws.addRow([`Nama: ${santri.nama} | Kelas: ${santri.kelas}`]);
                ws.addRow([]);
                ws.getRow(4).values = ['Tanggal', 'Deskripsi', 'Nominal', 'Status', 'Sisa'];
                ws.getRow(4).font = { bold: true };
                logs?.forEach(item => {
                    ws.addRow([
                        dayjs(item.created_at).format('DD/MM/YYYY'), item.deskripsi_tagihan, item.nominal_tagihan, item.status, item.sisa_tagihan
                    ]);
                });
            }

            const buffer = await wb.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `Laporan_Keuangan_${dayjs().format('YYYYMMDD')}.xlsx`);
            message.success("Export Berhasil");
            setIsExportModalOpen(false);
        } catch (err: any) { message.error("Gagal Export: " + err.message); } 
        finally { setIsLoadingExport(false); }
    };

    const handlePrint = useReactToPrint({
        contentRef: receiptRef,
    });

    const handlePrintReceipt = (record: ITagihanSantri) => {
        // Pastikan status tampil LUNAS di struk jika baru saja dibayar
        const recordToPrint = record.sisa_tagihan === 0 ? {...record, status: 'LUNAS' as const} : record;
        setSelectedTagihan(recordToPrint);
        setIsReceiptOpen(true);
    };

    const columns: ProColumns<ITagihanSantri>[] = [
        {
            title: "Tanggal", 
            dataIndex: "created_at", 
            width: 100,
            fixed: "left", // Tanggal selalu terlihat di kiri
            render: (_, r) => dayjs(r.created_at).format("DD MMM")
        },
        {
            title: "Santri", dataIndex: "santri_nis", width: 250,
            render: (_, record) => (
                <div className="flex items-center gap-3">
                    <Avatar shape="square" src={record.santri?.foto_url} icon={<UsergroupAddOutlined />} className="bg-emerald-50 text-emerald-600 rounded-lg" />
                    <div className="flex flex-col leading-tight">
                        <Text strong className="text-gray-800">{record.santri?.nama}</Text>
                        <Space size={4} className="mt-1">
                            <Tag bordered={false} className="m-0 text-[10px] bg-gray-100">Kelas {record.santri?.kelas}</Tag>
                            <Tag bordered={false} color="cyan" className="m-0 text-[10px]">{record.santri?.jurusan}</Tag>
                        </Space>
                    </div>
                </div>
            ),
        },
        {
            title: "Keterangan", dataIndex: "deskripsi_tagihan", width: 250,
            render: (val) => <Text className="font-medium text-gray-700">{val}</Text>
        },
        {
            title: "Nominal", dataIndex: "nominal_tagihan", width: 150, align: 'right',
            render: (_, r) => (
                <div className="flex flex-col items-end">
                    <Text className="font-mono font-bold text-gray-800 text-[15px]">
                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(r.nominal_tagihan)}
                    </Text>
                    {r.status !== 'LUNAS' && (
                        <Text type="danger" className="text-[11px]">Sisa: {new Intl.NumberFormat('id-ID').format(r.sisa_tagihan)}</Text>
                    )}
                </div>
            )
        },
        {
            title: "Status", dataIndex: "status", width: 120, align: 'center',
            render: (_, r) => {
                const color = r.status === 'LUNAS' ? 'success' : 'error';
                return <Tag color={color} icon={r.status === 'LUNAS' ? <CheckCircleOutlined/> : <DollarOutlined/>} className="px-3 py-1 rounded-full">{r.status}</Tag>
            }
        },
        {
            title: "Aksi", valueType: "option", width: 140, fixed: "right",
            render: (_, record) => [
                <div className="flex gap-2 justify-end" key="actions">
                    {record.status !== 'LUNAS' ? (
                        <Tooltip title="Bayar Tagihan">
                            <Button type="primary" size="small" icon={<WalletOutlined />} className="bg-emerald-600 hover:bg-emerald-500 border-0 shadow-sm"
                                onClick={() => { setSelectedTagihan(record); setIsPayModalOpen(true); }}
                            >Bayar</Button>
                        </Tooltip>
                    ) : (
                        <Tooltip title="Cetak Bukti">
                            <Button size="small" icon={<PrinterOutlined />} onClick={() => handlePrintReceipt(record)}>Struk</Button>
                        </Tooltip>
                    )}
                    
                    {record.status !== 'LUNAS' && (
                        <>
                            <Tooltip title="Edit">
                                <Button size="small" icon={<EditOutlined className="text-amber-600"/>} onClick={() => push(`/tagihan/edit/${record.id}`)} />
                            </Tooltip>
                            <Tooltip title="Hapus">
                                <Button size="small" danger icon={<DollarOutlined />} onClick={() => {
                                    if(confirm("Hapus tagihan ini?")) deleteMutate({ resource: "tagihan_santri", id: record.id });
                                }} />
                            </Tooltip>
                        </>
                    )}
                </div>
            ]
        }
    ];

    return (
        <div className="flex flex-col gap-6 pb-20">
            {/* 1. STATISTIK BESAR */}
            <Row gutter={24}>
                <Col span={12}>
                    <Card bordered={false} className="shadow-sm rounded-xl bg-gradient-to-r from-red-50 to-white border-l-4 border-red-500">
                        <Statistic title={<span className="text-red-800 font-semibold">Total Tunggakan</span>} value={totalTunggakan} prefix="Rp" precision={0} valueStyle={{ color: '#dc2626', fontWeight: 'bold', fontSize: '28px' }} />
                    </Card>
                </Col>
                <Col span={12}>
                    <Card bordered={false} className="shadow-sm rounded-xl bg-gradient-to-r from-emerald-50 to-white border-l-4 border-emerald-500">
                        <Statistic title={<span className="text-emerald-800 font-semibold">Transaksi Lunas (Bulan Ini)</span>} value={totalLunas} suffix="Nota" prefix={<CheckCircleOutlined />} valueStyle={{ color: '#059669', fontWeight: 'bold', fontSize: '28px' }} />
                    </Card>
                </Col>
            </Row>

            {/* 2. FILTER BAR (RESPONSIVE) */}
            <Card bodyStyle={{ padding: '12px 16px' }}>
                {/* Gunakan 'flex-col' untuk mobile, 'md:flex-row' untuk laptop */}
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                    
                    {/* Label Filter */}
                    <div className="flex items-center gap-2 font-semibold min-w-[80px]" style={{ color: token.colorTextSecondary }}>
                        <FilterOutlined /> Filter :
                    </div>

                    {/* Input Filters - Grid 1 kolom di HP, 3 kolom di Laptop */}
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
                        <div>
                            {/* Label kecil di atas input */}
                            <Text type="secondary" className="text-[10px] uppercase font-bold mb-1 block">Periode</Text>
                            <DatePicker.MonthPicker 
                                value={filterMonth} 
                                onChange={(val) => setFilterMonth(val || dayjs())} 
                                allowClear={false} 
                                className="w-full" 
                                suffixIcon={<CalendarOutlined style={{color: token.colorPrimary}}/>} 
                            />
                        </div>
                        <div>
                            <Text type="secondary" className="text-[10px] uppercase font-bold mb-1 block">Kelas</Text>
                            <Select 
                                allowClear 
                                placeholder="Semua Kelas" 
                                className="w-full" 
                                options={[1,2,3].map(k => ({ label: `Kelas ${k}`, value: `${k}` }))} 
                                onChange={setFilterKelas} 
                            />
                        </div>
                        <div>
                            <Text type="secondary" className="text-[10px] uppercase font-bold mb-1 block">Takhasus</Text>
                            <Select 
                                allowClear 
                                placeholder="Semua Takhasus" 
                                className="w-full" 
                                options={[{label:'Tahfidz', value:'TAHFIDZ'}, {label:'Kitab', value:'KITAB'}]} 
                                onChange={setFilterJurusan} 
                            />
                        </div>
                    </div>

                    {/* Tombol Buat Tagihan - Full width di HP */}
                    <div className="w-full md:w-auto md:border-l md:pl-4" style={{ borderColor: token.colorBorderSecondary }}>
                         <Button 
                            type="primary" 
                            icon={<PlusOutlined />} 
                            onClick={() => push("/tagihan/create")} 
                            className="w-full md:w-auto h-10 shadow-md"
                        >
                            Buat Tagihan
                        </Button>
                    </div>
                </div>
            </Card>
            
            {/* 3. TABEL */}
            <ProTable<ITagihanSantri>
                {...finalTableProps}
                columns={columns}
                rowKey="id"
                search={false} 
                headerTitle={<Space><WalletOutlined className="text-emerald-600 text-xl" /><span className="text-lg font-bold text-gray-700">Data Tagihan</span></Space>}
                toolBarRender={() => [
                    <Button key="bulk" icon={<UsergroupAddOutlined />} onClick={() => setIsBulkModalOpen(true)} className="text-purple-600 border-purple-600">Generate Massal</Button>,
                    <Button key="export" icon={<DownloadOutlined />} onClick={() => setIsExportModalOpen(true)}>Export</Button>
                ]}
                className="bg-white shadow-sm rounded-xl border border-gray-100"
                tableStyle={{ padding: 0 }}
            />

            {/* MODAL PILIH PEMBAYARAN */}
            <Modal title={<div className="text-center font-bold text-lg mb-2">Pilih Metode Pembayaran</div>} open={isPayModalOpen} onCancel={() => setIsPayModalOpen(false)} footer={null} width={500} centered>
                <div className="grid grid-cols-2 gap-4 py-4">
                    <button onClick={handleCashPayment} disabled={isProcessing} className="group flex flex-col items-center justify-center p-6 border-2 border-gray-100 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition-all cursor-pointer bg-white">
                        <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"><ShopOutlined className="text-2xl text-emerald-600" /></div>
                        <div className="font-bold text-gray-700 group-hover:text-emerald-700">Tunai (Cash)</div>
                        <div className="text-xs text-gray-400 text-center mt-1">Bayar langsung di Tempat</div>
                    </button>
                    <button onClick={handleMidtransPayment} className="group flex flex-col items-center justify-center p-6 border-2 border-gray-100 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer bg-white">
                        <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"><CreditCardOutlined className="text-2xl text-blue-600" /></div>
                        <div className="font-bold text-gray-700 group-hover:text-blue-700">QRIS / Transfer</div>
                        <div className="text-xs text-gray-400 text-center mt-1">Otomatis via Midtrans</div>
                    </button>
                </div>
            </Modal>

            {/* MODAL GENERATE MASSAL (Fix: Sudah dihubungkan ke Button) */}
            <Modal title="Generate Tagihan Massal" open={isBulkModalOpen} onCancel={() => setIsBulkModalOpen(false)} footer={null}>
                <Form form={formBulk} layout="vertical" onFinish={handleBulkCreate}>
                    <Form.Item label="Target Kelas" name="kelas" rules={[{ required: true }]}>
                        <Select placeholder="Pilih Kelas" options={[1,2,3].map(k => ({ label:`Kelas ${k}`, value:`${k}` }))}/>
                    </Form.Item>
                    <Form.Item label="Deskripsi" name="deskripsi" initialValue={`SPP ${dayjs().format('MMMM YYYY')}`} rules={[{ required: true }]}><Input /></Form.Item>
                    <Form.Item label="Nominal (Rp)" name="nominal" initialValue={500000} rules={[{ required: true }]}><InputNumber style={{width:'100%'}}/></Form.Item>
                    <Form.Item label="Jatuh Tempo" name="jatuh_tempo" initialValue={dayjs().endOf('month')} rules={[{ required: true }]}><DatePicker style={{width:'100%'}} format="DD MMM YYYY"/></Form.Item>
                    <div className="flex justify-end gap-2 mt-4"><Button onClick={()=>setIsBulkModalOpen(false)}>Batal</Button><Button type="primary" htmlType="submit">Generate</Button></div>
                </Form>
            </Modal>

             {/* MODAL EXPORT (Fix: Sudah dihubungkan ke Button) */}
             <Modal title={<Space><FileExcelOutlined className="text-green-600"/> Laporan Keuangan</Space>} open={isExportModalOpen} onCancel={() => setIsExportModalOpen(false)} footer={[<Button key="back" onClick={() => setIsExportModalOpen(false)}>Batal</Button>, <Button key="submit" type="primary" loading={isLoadingExport} onClick={handleExport} className="bg-green-600">Download Excel</Button>]}>
                <div className="flex flex-col gap-4 py-2">
                    <Card size="small" className="bg-gray-50">
                        <Text strong className="mb-2 block">Tipe Laporan</Text>
                        <Radio.Group value={exportType} onChange={e => setExportType(e.target.value)} buttonStyle="solid" className="w-full">
                            <Radio.Button value="GLOBAL" className="w-1/2 text-center">Rekap Global</Radio.Button>
                            <Radio.Button value="PERSONAL" className="w-1/2 text-center">Personal (Kartu Syahriah)</Radio.Button>
                        </Radio.Group>
                    </Card>
                    {exportType === 'GLOBAL' && (<div className="grid grid-cols-2 gap-4"><div><Text className="text-xs font-semibold">Filter Kelas</Text><Select allowClear placeholder="Semua" style={{width:'100%'}} options={[1,2,3,4,5,6].map(k=>({label:`Kelas ${k}`,value:`${k}`}))} onChange={setFilterKelas}/></div><div><Text className="text-xs font-semibold">Filter Takhasus</Text><Select allowClear placeholder="Semua" style={{width:'100%'}} options={[{label:'Tahfidz',value:'TAHFIDZ'},{label:'Kitab',value:'KITAB'}]} onChange={setFilterJurusan}/></div></div>)}
                    {exportType === 'PERSONAL' && (<div><Text className="text-xs font-semibold">Pilih Santri</Text><Select {...santriSelectProps} showSearch placeholder="Cari Nama Santri..." style={{width:'100%'}} onChange={(val) => setSelectedSantriNIS(val as unknown as string)}/></div>)}
                    <div><Text className="text-xs font-semibold">Periode</Text><RangePicker value={exportDateRange} onChange={dates => setExportDateRange(dates as any)} style={{width:'100%'}} format="DD MMM YYYY"/></div>
                </div>
            </Modal>

            {/* MODAL CETAK STRUK */}
            <Modal title="Cetak Bukti Pembayaran" open={isReceiptOpen} onCancel={() => setIsReceiptOpen(false)} footer={[<Button key="close" onClick={() => setIsReceiptOpen(false)}>Tutup</Button>, <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>Cetak Sekarang</Button>]} width={650} centered>
                <div className="bg-white p-8" ref={receiptRef}>
                    <style>{`@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none; } }`}</style>
                    
                    {/* Header Table Layout */}
                    <table style={{width: '100%', borderBottom: '2px solid #047857', paddingBottom: '20px', marginBottom: '20px'}}>
                        <tbody>
                            <tr>
                                <td style={{verticalAlign: 'top'}}>
                                    <div style={{display:'flex', alignItems:'center', gap:'10px', color: '#047857', fontWeight: 'bold', fontSize: '24px'}}>
                                        <BankOutlined /> AL-HASANAH
                                    </div>
                                    <div style={{fontSize: '12px', color: '#666', marginTop: '5px'}}>
                                        Jl. Raya Cibeuti No.13, Cibeuti, Kec. Kawalu, Tasikmalaya, Jawa Barat 46182<br/>
                                        Telp: (022) 1234-5678
                                    </div>
                                </td>
                                <td style={{textAlign: 'right', verticalAlign: 'top'}}>
                                    <div style={{fontSize: '18px', fontWeight: 'bold', color: '#aaa'}}>INVOICE</div>
                                    <div style={{fontSize: '14px', fontFamily: 'monospace', fontWeight: 'bold'}}>#{selectedTagihan?.id.substring(0,8).toUpperCase()}</div>
                                    <div style={{marginTop: '5px', background: '#dcfce7', color: '#166534', display: 'inline-block', padding: '2px 10px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', border: '1px solid #166534'}}>
                                        LUNAS
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Info Penerima Table */}
                    <table style={{width: '100%', marginBottom: '30px'}}>
                        <tbody>
                            <tr>
                                <td style={{width: '50%', verticalAlign: 'top', paddingRight: '20px'}}>
                                    <div style={{fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold', color: '#666', marginBottom: '5px'}}>Diterima Dari:</div>
                                    <div style={{fontSize: '16px', fontWeight: 'bold'}}>{selectedTagihan?.santri?.nama}</div>
                                    <div style={{fontSize: '12px', color: '#333'}}>NIS: {selectedTagihan?.santri?.nis}</div>
                                    <div style={{fontSize: '12px', color: '#333'}}>Kelas: {selectedTagihan?.santri?.kelas} ({selectedTagihan?.santri?.jurusan})</div>
                                </td>
                                <td style={{width: '50%', verticalAlign: 'top', textAlign: 'right'}}>
                                    <div style={{fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold', color: '#666', marginBottom: '5px'}}>Tanggal Pembayaran:</div>
                                    <div style={{fontSize: '14px', fontWeight: 'bold'}}>{dayjs().format('DD MMMM YYYY')}</div>
                                    <div style={{fontSize: '12px', color: '#666'}}>{dayjs().format('HH:mm')} WIB</div>
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Rincian Table (Standard HTML Table for PDF Stability) */}
                    <table style={{width: '100%', borderCollapse: 'collapse', marginBottom: '30px'}}>
                        <thead>
                            <tr style={{background: '#f3f4f6'}}>
                                <th style={{textAlign: 'left', padding: '10px', fontSize: '12px', color: '#4b5563', borderBottom: '1px solid #e5e7eb'}}>DESKRIPSI TAGIHAN</th>
                                <th style={{textAlign: 'right', padding: '10px', fontSize: '12px', color: '#4b5563', borderBottom: '1px solid #e5e7eb'}}>JUMLAH</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style={{padding: '15px 10px', fontSize: '14px', borderBottom: '1px solid #f3f4f6'}}>{selectedTagihan?.deskripsi_tagihan}</td>
                                <td style={{padding: '15px 10px', fontSize: '14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', borderBottom: '1px solid #f3f4f6'}}>
                                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(selectedTagihan?.nominal_tagihan || 0)}
                                </td>
                            </tr>
                        </tbody>
                        <tfoot>
                            <tr>
                                <td style={{padding: '15px 10px', textAlign: 'right', fontWeight: 'bold', color: '#4b5563'}}>TOTAL BAYAR</td>
                                <td style={{padding: '15px 10px', textAlign: 'right', fontWeight: 'bold', fontSize: '18px', color: '#047857'}}>
                                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(selectedTagihan?.nominal_tagihan || 0)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>

                    {/* Footer / Validasi */}
                    <table style={{width: '100%', marginTop: '40px'}}>
                        <tbody>
                            <tr>
                                <td style={{textAlign: 'center', width: '30%'}}>
                                    <QRCode value={`INV:${selectedTagihan?.id}`} size={75} bordered={false} />
                                    <div style={{fontSize: '9px', color: '#999', marginTop: '9px'}}>Scan Validasi</div>
                                </td>
                                <td style={{width: '40%'}}></td>
                                <td style={{textAlign: 'center', width: '30%'}}>
                                    <div style={{fontSize: '11px', color: '#666', marginBottom: '50px'}}>Administrasi</div>
                                    <div style={{borderBottom: '1px solid #ccc', width: '100%'}}></div>
                                    <div style={{fontSize: '11px', fontWeight: 'bold', marginTop: '5px'}}>( Bendahara Pesantren )</div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    
                    <div style={{textAlign: 'center', marginTop: '40px', fontSize: '10px', color: '#999', fontStyle: 'italic'}}>
                        Dokumen ini adalah bukti pembayaran yang sah dari Sistem Informasi Pesantren Al-Hasanah.
                    </div>
                </div>
            </Modal>
        </div>
    );
};