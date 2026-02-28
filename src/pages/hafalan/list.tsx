import React from "react";
import { useTable } from "@refinedev/antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import { Tag, Space, Button, Typography, Tooltip, Avatar, Select } from "antd";
import { 
    PlusOutlined, 
    ReadOutlined, 
    UserOutlined, 
    EyeOutlined, 
    DownloadOutlined,
    BookOutlined,
    SafetyCertificateOutlined
} from "@ant-design/icons";
import { ISantri } from "../../types";
import { useNavigation } from "@refinedev/core";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const { Text } = Typography;

export const HafalanList = () => {
    // 1. Fetch Data Santri
    const { tableProps, tableQueryResult } = useTable<ISantri>({
        resource: "santri",
        syncWithLocation: true,
        // Kita sorting berdasarkan Kelas dulu biar rapi
        sorters: { initial: [{ field: "kelas", order: "asc" }] },
    });

    const { push } = useNavigation();

    // --- FITUR EXPORT ---
    const exportProgres = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Progres Tahfidz');

        worksheet.columns = [
            { header: 'NIS', key: 'nis', width: 15 },
            { header: 'Nama Santri', key: 'nama', width: 30 },
            { header: 'Kelas', key: 'kelas', width: 10 },
            { header: 'Jurusan', key: 'jurusan', width: 15 },
            { header: 'Pembimbing', key: 'guru', width: 25 },
            { header: 'Total Hafalan', key: 'total', width: 20 },
            { header: 'Capaian Terakhir', key: 'capaian', width: 30 },
        ];

        const data = tableQueryResult?.data?.data || [];
        
        data.forEach((item) => {
            worksheet.addRow({
                nis: item.nis,
                nama: item.nama,
                kelas: item.kelas,
                jurusan: item.jurusan,
                guru: item.pembimbing,
                total: item.total_hafalan || '0',
                capaian: item.hafalan_kitab || '-' 
            });
        });

        // Styling Header Hijau Emerald
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Monitoring_Tahfidz_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const columns: ProColumns<ISantri>[] = [
        {
            title: "Santri",
            dataIndex: "nama",
            width: 250,
            fixed: "left",
            render: (_, record) => (
                <div className="flex items-center gap-3">
                    <Avatar 
                        src={record.foto_url} 
                        size={42}
                        icon={<UserOutlined />}
                        className="border border-emerald-100 bg-emerald-50 text-emerald-600"
                    />
                    <div className="flex flex-col">
                        <Text strong className="text-gray-800 dark:text-gray-100 text-[14px]">
                            {record.nama}
                        </Text>
                        <Space size={4} className="mt-0.5">
                            <Tag bordered={false} className="m-0 text-[10px] bg-gray-100 text-gray-500 font-mono">
                                {record.nis}
                            </Tag>
                        </Space>
                    </div>
                </div>
            ),
        },
        {
            title: "Kelas",
            dataIndex: "kelas",
            width: 100,
            filters: true,
            onFilter: true, // Client side filtering
            valueEnum: {
                "1": { text: "Kelas 1" },
                "2": { text: "Kelas 2" },
                "3": { text: "Kelas 3" },
            },
            render: (_, r) => <Tag color="cyan">{r.kelas}</Tag>
        },
        {
            title: "Jurusan",
            dataIndex: "jurusan",
            width: 120,
            filters: true,
            onFilter: true,
            // Default filter bisa diset di sini jika mau
            valueEnum: {
                TAHFIDZ: { text: "Tahfidz", status: "Success" },
                KITAB: { text: "Kitab", status: "Warning" },
            },
        },
        {
            title: "Pembimbing",
            dataIndex: "pembimbing",
            width: 180,
            copyable: true,
            ellipsis: true,
            render: (_dom, record) => (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <SafetyCertificateOutlined />
                    <span>{record.pembimbing || "-"}</span>
                </div>
            )
        },
        {
            title: "Capaian Hafalan",
            key: "progres",
            width: 250,
            render: (_, record) => (
                <div className="flex flex-col gap-2 p-1">
                    {/* Baris 1: Total Hafalan (Juz) */}
                    <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded">
                        <span className="text-xs text-emerald-600 font-medium">Total</span>
                        <Tag color="gold" className="m-0 font-bold border-0">
                            {record.total_hafalan ? `${record.total_hafalan}` : "0 Juz"}
                        </Tag>
                    </div>

                    {/* Baris 2: Posisi Terakhir (Surat/Ayat) */}
                    <div className="flex items-start gap-2">
                        <BookOutlined className="mt-1 text-gray-400" />
                        <div className="flex flex-col">
                            <span className="text-[10px] text-gray-400 uppercase tracking-wide">Terakhir</span>
                            <Text strong className="text-[13px] text-gray-700 dark:text-gray-300 leading-tight">
                                {record.hafalan_kitab || "-"}
                            </Text>
                        </div>
                    </div>
                </div>
            )
        },
        {
            title: "Aksi",
            valueType: "option",
            width: 140,
            fixed: "right",
            render: (_, record) => [
                <Tooltip title="Input Setoran" key="add">
                    <Button 
                        type="primary" ghost 
                        size="small" 
                        icon={<PlusOutlined />} 
                        className="border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                        onClick={() => push(`/hafalan/create?nis=${record.nis}`)} 
                    />
                </Tooltip>,
                <Tooltip title="Lihat Riwayat" key="view">
                    <Button 
                        size="small" 
                        icon={<EyeOutlined />} 
                        onClick={() => push(`/hafalan/show/${record.nis}`)} 
                    >
                        Detail
                    </Button>
                </Tooltip>
            ]
        }
    ];

    return (
        <ProTable<ISantri>
            {...tableProps}
            columns={columns}
            rowKey="nis"
            headerTitle={
                <Space>
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded-lg border border-emerald-100 dark:border-emerald-800">
                        <ReadOutlined className="text-emerald-600 text-lg" />
                    </div>
                    <div className="flex flex-col">
                        <Text strong className="text-base">Monitoring Tahfidz</Text>
                        <Text type="secondary" className="text-xs">Data hafalan santri terbaru</Text>
                    </div>
                </Space>
            }
            toolBarRender={() => [
                <Button key="export" icon={<DownloadOutlined />} onClick={exportProgres}>
                    Export Data (Excel)
                </Button>,
                <Button 
                    key="create" 
                    type="primary" 
                    icon={<PlusOutlined />} 
                    onClick={() => push("/hafalan/create")}
                    className="bg-emerald-600 hover:bg-emerald-500 border-0"
                >
                    Setoran Baru
                </Button>
            ]}
            options={{ density: true, fullScreen: true, reload: true }}
            search={{ 
                labelWidth: 'auto', 
                layout: 'vertical',
                defaultCollapsed: false // Biar filter nama langsung kelihatan
            }}
            pagination={{ defaultPageSize: 10, showSizeChanger: true }}
            className="bg-white dark:bg-[#141414] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800"
        />
    );
};