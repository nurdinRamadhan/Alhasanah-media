import React from "react";
import { useTable, useSelect } from "@refinedev/antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import { Tag, Space, Button, Typography, Tooltip, Avatar, Statistic, Card, Row, Col } from "antd";
import { 
    PlusOutlined, 
    BarcodeOutlined, 
    DownloadOutlined, 
    BankOutlined,
    QrcodeOutlined,
    EyeOutlined,
    EditOutlined,
    DeleteOutlined
} from "@ant-design/icons";
import { IInventaris, IKategoriBarang, ILokasiAset } from "../../types";
import { useNavigation, useDelete } from "@refinedev/core";
import dayjs from "dayjs";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const { Text } = Typography;

export const InventarisList = () => {
    const { tableProps, tableQueryResult } = useTable<IInventaris>({
        resource: "inventaris",
        syncWithLocation: true,
        meta: { select: "*, kategori:kategori_barang(nama_kategori), lokasi:lokasi_aset(nama_lokasi)" },
        sorters: { initial: [{ field: "created_at", order: "desc" }] }
    });

    const { create, edit, show } = useNavigation();
    const { mutate: deleteMutate } = useDelete();

    // Hitung Total Aset (Simple Client Side Calculation for Demo)
    const allData = tableQueryResult?.data?.data || [];
    const totalNilaiAset = allData.reduce((acc, curr) => acc + Number(curr.harga_perolehan), 0);
    const totalBarang = allData.reduce((acc, curr) => acc + curr.jumlah, 0);
    const totalRusak = allData.filter(i => i.kondisi.includes('RUSAK')).length;

    // --- FITUR EXPORT LAPORAN ASET ---
    const exportExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Data Aset');

        worksheet.columns = [
            { header: 'Kode Barang', key: 'kode', width: 15 },
            { header: 'Nama Barang', key: 'nama', width: 25 },
            { header: 'Kategori', key: 'kategori', width: 15 },
            { header: 'Lokasi', key: 'lokasi', width: 20 },
            { header: 'Kondisi', key: 'kondisi', width: 15 },
            { header: 'Sumber Dana', key: 'sumber', width: 15 },
            { header: 'Tgl Perolehan', key: 'tgl', width: 15 },
            { header: 'Harga (Rp)', key: 'harga', width: 15 },
        ];

        allData.forEach((item) => {
            worksheet.addRow({
                kode: item.kode_barang,
                nama: item.nama_barang,
                kategori: item.kategori?.nama_kategori,
                lokasi: item.lokasi?.nama_lokasi,
                kondisi: item.kondisi,
                sumber: item.sumber_dana,
                tgl: dayjs(item.tanggal_perolehan).format('DD/MM/YYYY'),
                harga: item.harga_perolehan
            });
        });

        // Style Header
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } }; // Biru Corporate

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Laporan_Aset_AlHasanah_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    };

    const columns: ProColumns<IInventaris>[] = [
        {
            title: "Aset",
            dataIndex: "nama_barang",
            width: 250,
            fixed: "left",
            render: (_, record) => (
                <div className="flex items-center gap-3">
                    <Avatar 
                        shape="square" 
                        size={48} 
                        src={record.foto_url} 
                        icon={<BankOutlined />}
                        className="bg-blue-50 text-blue-600 border border-blue-100 rounded-lg"
                    />
                    <div className="flex flex-col">
                        <Text strong className="text-[14px]">{record.nama_barang}</Text>
                        <Space size={4}>
                            <Tag bordered={false} className="m-0 text-[10px] bg-gray-100 font-mono">{record.kode_barang}</Tag>
                            <Tag color="cyan" className="m-0 text-[10px]">{record.kategori?.nama_kategori}</Tag>
                        </Space>
                    </div>
                </div>
            ),
        },
        {
            title: "Lokasi & Kondisi",
            key: "status",
            width: 200,
            render: (_, r) => (
                <div className="flex flex-col gap-1">
                    <Text type="secondary" className="text-xs">{r.lokasi?.nama_lokasi || 'Tidak Diketahui'}</Text>
                    <div>
                        {r.kondisi === 'BAIK' && <Tag color="success">Baik</Tag>}
                        {r.kondisi === 'RUSAK_RINGAN' && <Tag color="warning">Rusak Ringan</Tag>}
                        {r.kondisi === 'RUSAK_BERAT' && <Tag color="error">Rusak Berat</Tag>}
                        {r.kondisi === 'HILANG' && <Tag color="default">Hilang</Tag>}
                    </div>
                </div>
            )
        },
        {
            title: "Nilai & Sumber",
            dataIndex: "harga_perolehan",
            width: 200,
            render: (_, r) => (
                <div className="flex flex-col">
                    <Text strong className="text-emerald-600">
                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(r.harga_perolehan)}
                    </Text>
                    <Space>
                        <Tag color="geekblue" bordered={false} className="text-[10px]">{r.sumber_dana}</Tag>
                        <span className="text-xs text-gray-400">{dayjs(r.tanggal_perolehan).format('YYYY')}</span>
                    </Space>
                </div>
            )
        },
        {
            title: "Aksi",
            valueType: "option",
            width: 140,
            fixed: "right",
            render: (_, record) => [
                <Tooltip title="Lihat Label Aset" key="view">
                    <Button 
                        size="small" type="text" icon={<QrcodeOutlined />} 
                        className="text-blue-600 hover:bg-blue-50"
                        onClick={() => show("inventaris", record.id)} 
                    />
                </Tooltip>,
                <Tooltip title="Edit" key="edit">
                    <Button 
                        size="small" type="text" icon={<EditOutlined />} 
                        onClick={() => edit("inventaris", record.id)} 
                    />
                </Tooltip>,
                <Tooltip title="Hapus" key="delete">
                    <Button 
                        size="small" type="text" danger icon={<DeleteOutlined />} 
                        onClick={() => {
                            if(confirm("Hapus aset ini?")) deleteMutate({ resource: "inventaris", id: record.id });
                        }} 
                    />
                </Tooltip>
            ]
        }
    ];

    return (
        <div className="flex flex-col gap-4">
            {/* --- DASHBOARD RINGKASAN ASET --- */}
            <Row gutter={16}>
                <Col span={8}>
                    <Card bordered={false} className="shadow-sm border-b-4 border-blue-500">
                        <Statistic 
                            title="Total Nilai Aset" 
                            value={totalNilaiAset} 
                            precision={0} 
                            prefix="Rp" 
                            valueStyle={{ color: '#2563eb', fontWeight: 'bold' }} 
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card bordered={false} className="shadow-sm border-b-4 border-emerald-500">
                        <Statistic 
                            title="Total Unit Barang" 
                            value={totalBarang} 
                            suffix="Unit"
                            prefix={<BankOutlined />}
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card bordered={false} className="shadow-sm border-b-4 border-red-500">
                        <Statistic 
                            title="Aset Rusak / Perlu Perbaikan" 
                            value={totalRusak} 
                            valueStyle={{ color: '#dc2626' }}
                            suffix="Item"
                        />
                    </Card>
                </Col>
            </Row>

            <ProTable<IInventaris>
                {...tableProps}
                columns={columns}
                rowKey="id"
                headerTitle={
                    <Space>
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg border border-blue-100 dark:border-blue-800">
                            <BarcodeOutlined className="text-blue-600 text-lg" />
                        </div>
                        <div className="flex flex-col">
                            <Text strong className="text-base">Manajemen Aset</Text>
                            <Text type="secondary" className="text-xs">Database inventaris pesantren</Text>
                        </div>
                    </Space>
                }
                toolBarRender={() => [
                    <Button key="export" icon={<DownloadOutlined />} onClick={exportExcel}>
                        Laporan Aset
                    </Button>,
                    <Button 
                        key="create" 
                        type="primary" 
                        icon={<PlusOutlined />} 
                        onClick={() => create("inventaris")}
                        className="bg-blue-600 hover:bg-blue-500 border-0"
                    >
                        Tambah Aset
                    </Button>
                ]}
                options={{ density: true, fullScreen: true, reload: true }}
                search={{ labelWidth: 'auto', layout: 'vertical' }}
                pagination={{ defaultPageSize: 10 }}
                className="bg-white dark:bg-[#141414] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800"
            />
        </div>
    );
};