import React, { useState } from "react";
import { useTable } from "@refinedev/antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import { Tag, Space, Button, Typography, Tooltip, Avatar, DatePicker, Input } from "antd";
import { 
    PlusOutlined, 
    BookOutlined, 
    EyeOutlined, 
    FileExcelOutlined,
    UserOutlined,
    SearchOutlined,
    CalendarOutlined
} from "@ant-design/icons";
import { IHafalanKitab, NAMA_KITAB_LIST } from "../../types";
import { useNavigation } from "@refinedev/core";
import { formatHijri, formatMasehi } from "../../utility/dateHelper";
import dayjs from "dayjs";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { supabaseClient } from "../../utility/supabaseClient";

const { Text } = Typography;
const { RangePicker } = DatePicker;

export const HafalanKitabList = () => {
    const { push } = useNavigation();

    /**
     * LOGIKA: Kita ingin menampilkan progress TERAKHIR tiap santri.
     * Karena Supabase/Postgres butuh query kompleks untuk 'DISTINCT ON', 
     * kita akan mengambil semua data yang terfilter, lalu di sisi client kita group.
     * (Untuk data pesantren < 10.000 records, client-side grouping masih sangat cepat)
     */
    const { tableProps, tableQueryResult, setFilters, filters } = useTable<IHafalanKitab>({
        resource: "hafalan_kitab",
        syncWithLocation: true,
        meta: { select: "*, santri(nama, nis, kelas, jurusan, foto_url)" },
        sorters: { initial: [{ field: "tanggal", order: "desc" }] },
        pagination: { pageSize: 1000 }, // Ambil banyak untuk keperluan grouping
    });

    // Proses Grouping di Client-Side untuk mendapatkan LATEST record per santri
    const rawData = tableQueryResult?.data?.data || [];
    const groupedDataMap = new Map<string, IHafalanKitab>();
    
    rawData.forEach(item => {
        if (!groupedDataMap.has(item.santri_nis)) {
            groupedDataMap.set(item.santri_nis, item);
        }
    });
    
    const displayData = Array.from(groupedDataMap.values());

    // --- LOGIKA EXPORT EXCEL ---
    const exportToExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Progress Hafalan Kitab');

        worksheet.columns = [
            { header: 'NIS', key: 'nis', width: 15 },
            { header: 'Nama Santri', key: 'nama', width: 30 },
            { header: 'Kitab Terakhir', key: 'kitab', width: 20 },
            { header: 'Materi Terakhir', key: 'materi', width: 25 },
            { header: 'Update Terakhir (M)', key: 'tgl_m', width: 20 },
            { header: 'Update Terakhir (H)', key: 'tgl_h', width: 25 },
        ];

        displayData.forEach((item: any) => {
            worksheet.addRow({
                nis: item.santri?.nis,
                nama: item.santri?.nama,
                kitab: item.nama_kitab,
                materi: item.bab_materi,
                tgl_m: formatMasehi(item.tanggal),
                tgl_h: formatHijri(item.tanggal)
            });
        });

        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Monitoring_Takhasus_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    };

    const columns: ProColumns<IHafalanKitab>[] = [
        {
            title: "Santri",
            dataIndex: "santri_nis",
            fixed: "left",
            render: (_, record) => (
                <div className="flex items-center gap-3">
                    <Avatar src={record.santri?.foto_url} icon={<UserOutlined />} className="border border-emerald-100" />
                    <div className="flex flex-col leading-tight">
                        <Text strong className="text-sm">{record.santri?.nama}</Text>
                        <Text type="secondary" className="text-[10px]">{record.santri?.nis} | {record.santri?.kelas}-{record.santri?.jurusan}</Text>
                    </div>
                </div>
            ),
            // Custom Search di Header Kolom
            filterDropdown: (props) => (
                <div style={{ padding: 8 }}>
                    <Input
                        placeholder="Cari Nama Santri..."
                        value={props.selectedKeys[0]}
                        onChange={e => props.setSelectedKeys(e.target.value ? [e.target.value] : [])}
                        onPressEnter={() => props.confirm()}
                        style={{ width: 188, marginBottom: 8, display: 'block' }}
                    />
                    <Button
                        type="primary"
                        onClick={() => props.confirm()}
                        icon={<SearchOutlined />}
                        size="small"
                        style={{ width: 90, marginRight: 8 }}
                    >
                        Cari
                    </Button>
                    <Button onClick={() => props.clearFilters?.()} size="small" style={{ width: 90 }}>
                        Reset
                    </Button>
                </div>
            ),
            filterIcon: (filtered) => <SearchOutlined style={{ color: filtered ? '#1890ff' : undefined }} />,
        },
        {
            title: "Progres Terakhir",
            key: "latest_progress",
            render: (_, r) => (
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <Tag color="blue" className="m-0 font-bold">{r.nama_kitab}</Tag>
                        <Text strong style={{ fontSize: 13 }}>{r.bab_materi}</Text>
                    </div>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                        {r.bait_awal ? `Bait ${r.bait_awal} - ${r.bait_akhir}` : `Halaman ${r.halaman_awal} - ${r.halaman_akhir}`}
                    </Text>
                </div>
            )
        },
        {
            title: "Update Terakhir",
            dataIndex: "tanggal",
            width: 180,
            render: (_, r) => (
                <div className="flex flex-col">
                    <Text strong className="text-xs">{formatMasehi(r.tanggal)}</Text>
                    <Text type="secondary" style={{ fontSize: 10, color: '#059669' }}>{formatHijri(r.tanggal)}</Text>
                </div>
            ),
            sorter: true,
        },
        {
            title: "Aksi",
            valueType: "option",
            width: 100,
            fixed: "right",
            render: (_, record) => [
                <Button 
                    key="view"
                    type="primary"
                    ghost
                    size="small"
                    icon={<EyeOutlined />} 
                    onClick={() => push(`/hafalan-kitab/show/${record.santri_nis}`)}
                >
                    Riwayat
                </Button>
            ]
        }
    ];

    return (
        <div className="space-y-4">
            {/* TOOLBAR FILTER KHUSUS */}
            <div className="bg-white dark:bg-[#141414] p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-gray-400 font-bold uppercase mb-1">Filter Range Tanggal</span>
                        <RangePicker 
                            onChange={(values) => {
                                if (values) {
                                    setFilters([
                                        { field: "tanggal", operator: "gte", value: values[0]?.toISOString() },
                                        { field: "tanggal", operator: "lte", value: values[1]?.toISOString() }
                                    ]);
                                } else {
                                    setFilters([], "replace");
                                }
                            }}
                        />
                    </div>
                </div>

                <Space>
                    <Button icon={<FileExcelOutlined />} onClick={exportToExcel}>Laporan Progress</Button>
                    <Button 
                        type="primary" 
                        icon={<PlusOutlined />} 
                        onClick={() => push("/hafalan-kitab/create")}
                        className="bg-emerald-600 hover:bg-emerald-500 border-0"
                    >
                        Input Setoran Baru
                    </Button>
                </Space>
            </div>

            <ProTable<IHafalanKitab>
                {...tableProps}
                dataSource={displayData} // Menggunakan data yang sudah di-group
                columns={columns}
                rowKey="santri_nis" // Key unik sekarang adalah NIS santri
                search={false} // Kita sudah pakai filter kustom di atas & di kolom
                headerTitle={
                    <Space>
                        <BookOutlined className="text-emerald-600 text-xl" />
                        <div className="flex flex-col">
                            <Text strong>Monitoring Takhasus Kitab</Text>
                            <Text type="secondary" style={{ fontSize: 10 }}>Menampilkan progress terbaru per santri</Text>
                        </div>
                    </Space>
                }
                options={{ density: true, fullScreen: true, reload: true }}
                pagination={{ defaultPageSize: 10 }}
                className="bg-white dark:bg-[#141414] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden"
            />
        </div>
    );
};
