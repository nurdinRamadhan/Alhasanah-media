import React, { useState, useMemo } from "react";
import { useTable } from "@refinedev/antd";
import { logActivity } from "../../utility/logger";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import { 
    Tag, Space, Button, Typography, Tooltip, Avatar, Modal, Form, 
    Select, InputNumber, Input, message, DatePicker, Card, Row, Col, 
    Statistic, Upload, Image, theme 
} from "antd";
import { 
    PlusOutlined, DeleteOutlined, EditOutlined, 
    ExportOutlined, UploadOutlined, FileTextOutlined,
    BankOutlined, ShoppingCartOutlined, UserOutlined,
    CalendarOutlined, FilterOutlined, RiseOutlined
} from "@ant-design/icons";
import { useNavigation, useDelete, useCreate, useUpdate, useGetIdentity } from "@refinedev/core";
import dayjs from "dayjs";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { supabaseClient } from "../../utility/supabaseClient";
import { IPengeluaran, IProfile } from "../../types";

const { Text, Title } = Typography;
const { useToken } = theme;

export const PengeluaranList = () => {
    const { token } = useToken();
    const { data: user } = useGetIdentity<IProfile>(); // Ambil data user yang login
    const { mutate: createMutate } = useCreate();
    const { mutate: updateMutate } = useUpdate();
    const { mutate: deleteMutate } = useDelete();

    // --- STATES ---
    const [filterMonth, setFilterMonth] = useState<dayjs.Dayjs>(dayjs());
    const [filterKategori, setFilterKategori] = useState<string | null>(null);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'CREATE' | 'EDIT'>('CREATE');
    const [editingItem, setEditingItem] = useState<IPengeluaran | null>(null);
    const [form] = Form.useForm();
    const [uploading, setUploading] = useState(false);
    const [buktiUrl, setBuktiUrl] = useState<string | null>(null);

    // --- TABLE DATA ---
    const { tableProps, tableQueryResult } = useTable<IPengeluaran>({
        resource: "pengeluaran",
        syncWithLocation: false,
        filters: {
            permanent: [
                {
                    field: "tanggal_pengeluaran",
                    operator: "gte",
                    value: filterMonth.startOf('month').format('YYYY-MM-DD')
                },
                {
                    field: "tanggal_pengeluaran",
                    operator: "lte",
                    value: filterMonth.endOf('month').format('YYYY-MM-DD')
                }
            ]
        },
        sorters: { initial: [{ field: "tanggal_pengeluaran", order: "desc" }] }
    });

    // Client Side Filter (Kategori)
    const filteredData = tableQueryResult?.data?.data.filter(item => {
        if (filterKategori && item.kategori !== filterKategori) return false;
        return true;
    }) || [];

    const finalTableProps = {
        ...tableProps,
        dataSource: filteredData,
        pagination: { ...tableProps.pagination, total: filteredData.length }
    };

    // --- STATISTIK ---
    const totalBulanIni = filteredData.reduce((acc, curr) => acc + Number(curr.nominal), 0);
    const totalHariIni = filteredData
        .filter(i => dayjs(i.tanggal_pengeluaran).isSame(dayjs(), 'day'))
        .reduce((acc, curr) => acc + Number(curr.nominal), 0);

    // --- HANDLERS ---
    const handleOpenCreate = () => {
        setModalMode('CREATE');
        setEditingItem(null);
        setBuktiUrl(null);
        form.resetFields();
        form.setFieldsValue({ 
            tanggal_pengeluaran: dayjs(), 
            kategori: 'OPERASIONAL',
            dicatat_oleh_nama: user?.full_name || user?.email // Auto-fill User
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (record: IPengeluaran) => {
        setModalMode('EDIT');
        setEditingItem(record);
        setBuktiUrl(record.bukti_url);
        form.setFieldsValue({
            ...record,
            tanggal_pengeluaran: dayjs(record.tanggal_pengeluaran)
        });
        setIsModalOpen(true);
    };

    const handleUpload = async (options: any) => {
        const { file, onSuccess, onError } = options;
        const fileExt = file.name.split('.').pop();
        const fileName = `nota-${Date.now()}.${fileExt}`;
        setUploading(true);
        try {
            const { error } = await supabaseClient.storage.from('pengeluaran-bukti').upload(fileName, file);
            if (error) throw error;
            const { data } = supabaseClient.storage.from('pengeluaran-bukti').getPublicUrl(fileName);
            setBuktiUrl(data.publicUrl);
            onSuccess("Ok");
        } catch (err: any) {
            message.error("Gagal upload: " + err.message);
            onError({ error: err });
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (values: any) => {
        // 1. Siapkan Payload Bersih untuk Database
        const payload = {
            ...values,
            nominal: Number(values.nominal), // Pastikan angka
            tanggal_pengeluaran: values.tanggal_pengeluaran ? dayjs(values.tanggal_pengeluaran).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
            bukti_url: buktiUrl || null,
            ...(modalMode === 'CREATE' && {
                dicatat_oleh_id: user?.id,
                dicatat_oleh_nama: user?.full_name || user?.email
            })
        };

        try {
            if (modalMode === 'CREATE') {
                // Simpan DB
                await createMutate({ resource: "pengeluaran", values: payload });
                
                // Log (Kirim data spesifik saja, jangan object 'values' mentah)
                logActivity({
                    user: user,
                    action: 'CREATE',
                    resource: 'pengeluaran',
                    record_id: '-', 
                    details: { 
                        judul: String(payload.judul), 
                        nominal: Number(payload.nominal),
                        kategori: String(payload.kategori)
                    }
                });

                message.success("Pengeluaran berhasil dicatat");
            } else {
                // Update DB
                await updateMutate({ resource: "pengeluaran", id: editingItem!.id, values: payload });
                
                // Log
                logActivity({
                    user: user,
                    action: 'UPDATE',
                    resource: 'pengeluaran',
                    record_id: String(editingItem!.id),
                    details: { 
                        judul_baru: String(payload.judul),
                        nominal_baru: Number(payload.nominal)
                    }
                });

                message.success("Data diperbarui");
            }
            setIsModalOpen(false);
            tableQueryResult.refetch(); // Refresh tabel
        } catch (err) {
            console.error(err);
            message.error("Terjadi kesalahan");
        }
    };

    // --- EXPORT TO EXCEL ---
    const handleExportExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Laporan Pengeluaran');

        // Header Style
        worksheet.addRow(['LAPORAN PENGELUARAN PESANTREN']);
        worksheet.addRow([`Periode: ${filterMonth.format('MMMM YYYY')}`]);
        worksheet.addRow([]);
        
        const headerRow = worksheet.addRow(['Tanggal', 'Judul', 'Kategori', 'Nominal', 'Pencatat', 'Keterangan']);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } }; // Emerald Color

        let total = 0;
        filteredData.forEach(item => {
            worksheet.addRow([
                dayjs(item.tanggal_pengeluaran).format('DD/MM/YYYY'),
                item.judul,
                item.kategori,
                item.nominal,
                item.dicatat_oleh_nama,
                item.keterangan || '-'
            ]);
            total += Number(item.nominal);
        });

        // Footer Total
        worksheet.addRow([]);
        const totalRow = worksheet.addRow(['', '', 'TOTAL PENGELUARAN', total]);
        totalRow.font = { bold: true, size: 12 };
        totalRow.getCell(4).numFmt = '"Rp"#,##0.00';

        // Auto width
        worksheet.columns.forEach(column => { column.width = 20; });

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Pengeluaran_${filterMonth.format('YYYY-MM')}.xlsx`);
    };

    const columns: ProColumns<IPengeluaran>[] = [
        {
            title: "Tanggal",
            dataIndex: "tanggal_pengeluaran",
            width: 110,
            render: (val) => <span style={{color: token.colorTextSecondary}}>{dayjs(val as string).format("DD MMM YYYY")}</span>,
            sorter: (a, b) => dayjs(a.tanggal_pengeluaran as string).unix() - dayjs(b.tanggal_pengeluaran as string).unix()
        },
        {
            title: "Detail Pengeluaran",
            dataIndex: "judul",
            render: (_, r) => (
                <div className="flex flex-col">
                    <Text strong style={{ fontSize: 15 }}>{r.judul}</Text>
                    <Text type="secondary" className="text-xs">{r.keterangan}</Text>
                </div>
            )
        },
        {
            title: "Kategori",
            dataIndex: "kategori",
            width: 140,
            render: (val: any) => {
                const colors: Record<string, string> = { 
                    'OPERASIONAL': 'blue', 'LAINNYA': 'gold', 'DAPUR': 'orange', 
                    'PEMBANGUNAN': 'purple', 'KEGIATAN': 'cyan' 
                };
                return <Tag color={typeof val === 'string' && colors[val] ? colors[val] : 'default'}>{String(val || '-')}</Tag>
            }
        },
        {
            title: "Nominal",
            dataIndex: "nominal",
            width: 150,
            align: 'right',
            render: (val) => (
                <Text strong style={{ color: token.colorError, fontFamily: 'monospace', fontSize: 15 }}>
                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(Number(val) || 0)}
                </Text>
            )
        },
        {
            title: "Bukti",
            dataIndex: "bukti_url",
            width: 80,
            align: 'center',
            render: (val) => typeof val === 'string' && val ? (
                <Image src={val} width={35} height={35} className="rounded object-cover border" />
            ) : <Text type="secondary" className="text-xs">-</Text>
        },
        {
            title: "Pencatat",
            dataIndex: "dicatat_oleh_nama",
            width: 150,
            render: (val) => (
                <Space size={4}>
                    <Avatar size="small" style={{ backgroundColor: token.colorPrimary }}>
                        {typeof val === 'string' && val.length > 0 ? (val[0] as string).toUpperCase() : <UserOutlined />}
                    </Avatar>
                    <Text className="text-xs">
                        {typeof val === 'string' ? val.split(' ')[0] : (val !== null && val !== undefined ? String(val).split(' ')[0] : '')}
                    </Text>
                </Space>
            )
        },
        {
            title: "Aksi",
            valueType: "option",
            width: 100,
            render: (_, record) => (
              <Space>
                <Tooltip title="Edit">
                    <Button size="small" type="text" icon={<EditOutlined className="text-blue-500" />} onClick={() => handleOpenEdit(record)} key="edit" />
                </Tooltip>
                <Tooltip title="Hapus">
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} key="delete" onClick={() => {
                        if(confirm("Yakin hapus data ini?")) deleteMutate({ resource: "pengeluaran", id: record.id });
                    }} />
                </Tooltip>
              </Space>
            )
        }
    ];

    return (
        <div className="pb-20">
            {/* 1. STATISTIK HEADER */}
            <Row gutter={16} className="mb-6">
                <Col xs={24} sm={12}>
                    <Card bordered={false} style={{ borderLeft: `4px solid ${token.colorError}` }}>
                        <Statistic 
                            title={<span className="text-gray-500 font-semibold">Total Keluar (Bulan Ini)</span>}
                            value={totalBulanIni} 
                            prefix="Rp" precision={0} 
                            valueStyle={{ color: token.colorError, fontWeight: 'bold' }} 
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12}>
                    <Card bordered={false} style={{ borderLeft: `4px solid ${token.colorWarning}` }}>
                        <Statistic 
                            title={<span className="text-gray-500 font-semibold">Keluar Hari Ini</span>}
                            value={totalHariIni} 
                            prefix="Rp" precision={0} 
                            valueStyle={{ color: token.colorWarning, fontWeight: 'bold' }} 
                        />
                    </Card>
                </Col>
            </Row>

            {/* 2. FILTER & TOOLBAR */}
            <Card bodyStyle={{ padding: '12px 16px' }} className="mb-6 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <Space size="middle" className="overflow-x-auto w-full md:w-auto">
                        <div className="flex items-center gap-2 text-gray-500 font-semibold"><FilterOutlined /> Filter:</div>
                        <DatePicker.MonthPicker 
                            value={filterMonth} 
                            onChange={(val) => setFilterMonth(val || dayjs())} 
                            allowClear={false} 
                            suffixIcon={<CalendarOutlined style={{color: token.colorPrimary}}/>}
                        />
                        <Select 
                            placeholder="Semua Kategori" 
                            allowClear 
                            style={{ width: 160 }}
                            options={['OPERASIONAL', 'DAPUR', 'PEMBANGUNAN', 'KEGIATAN'].map(k => ({ label: k, value: k }))}
                            onChange={setFilterKategori}
                        />
                    </Space>
                    <Space>
                        <Button icon={<ExportOutlined />} onClick={handleExportExcel}>Export Excel</Button>
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate} danger>Catat Pengeluaran</Button>
                    </Space>
                </div>
            </Card>

            {/* 3. TABEL DATA */}
            <ProTable<IPengeluaran>
                {...finalTableProps}
                columns={columns}
                rowKey="id"
                search={false}
                headerTitle={<Space><ShoppingCartOutlined className="text-red-500 text-xl" /><span className="text-lg font-bold" style={{color: token.colorText}}>Rekapitulasi Pengeluaran</span></Space>}
                className="shadow-sm rounded-xl"
            />

            {/* 4. MODAL INPUT / EDIT */}
            <Modal
                title={modalMode === 'CREATE' ? "Catat Pengeluaran Baru" : "Edit Pengeluaran"}
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                onOk={() => form.submit()}
                centered
                width={600}
            >
                <Form form={form} layout="vertical" onFinish={handleSubmit} className="pt-4">
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item label="Tanggal" name="tanggal_pengeluaran" rules={[{ required: true }]}>
                                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Kategori" name="kategori" rules={[{ required: true }]}>
                                <Select options={['OPERASIONAL',  'DAPUR', 'PEMBANGUNAN', 'KEGIATAN', 'LAINNYA'].map(k => ({ label: k, value: k }))} />
                            </Form.Item>
                        </Col>
                    </Row>
                    
                    <Form.Item label="Judul Pengeluaran" name="judul" rules={[{ required: true }]}>
                        <Input placeholder="Contoh: Belanja Sayur Mingguan" />
                    </Form.Item>

                    <Form.Item label="Nominal (Rp)" name="nominal" rules={[{ required: true }]}>
                        <InputNumber 
                            style={{ width: '100%' }} 
                            formatter={value => `Rp ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                            parser={(value) => value?.replace(/\Rp\s?|(\.*)/g, '') as unknown as number}
                            size="large"
                            className="font-bold text-red-600"
                        />
                    </Form.Item>

                    <Form.Item label="Keterangan Detail (Opsional)" name="keterangan">
                        <Input.TextArea rows={2} />
                    </Form.Item>

                    {/* FIELD PENCATAT (READ ONLY) */}
                    <Form.Item label="Dicatat Oleh" name="dicatat_oleh_nama">
                        <Input disabled prefix={<UserOutlined />} className="bg-gray-50 text-gray-500" />
                    </Form.Item>

                    <Form.Item label="Upload Bukti / Nota">
                        <Upload customRequest={handleUpload} showUploadList={false} accept="image/*">
                            <Button icon={<UploadOutlined />} loading={uploading}>Upload Foto Nota</Button>
                        </Upload>
                        {buktiUrl && (
                            <div className="mt-2 border p-2 rounded inline-block">
                                <Image src={buktiUrl} height={80} />
                                <div className="text-xs text-green-600 mt-1"><FileTextOutlined/> Bukti Terupload</div>
                            </div>
                        )}
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};