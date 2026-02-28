import React, { useState } from "react";
import { useTable, useSelect } from "@refinedev/antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import { Tag, Space, Button, Typography, Tooltip, message, Modal, Select, Avatar, Card } from "antd";
import { 
    PlusOutlined, 
    MedicineBoxOutlined, 
    DeleteOutlined, 
    EditOutlined, 
    DownloadOutlined,
    UserOutlined,
    FileExcelOutlined,
    CalendarOutlined
} from "@ant-design/icons";
import { IKesehatanSantri, ISantri } from "../../types";
import { useNavigation, useDelete } from "@refinedev/core";
import dayjs from "dayjs";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { supabaseClient } from "../../utility/supabaseClient";

const { Text, Title } = Typography;

export const KesehatanList = () => {
    // 1. Data Fetching
    const { tableProps } = useTable<IKesehatanSantri>({
        resource: "kesehatan_santri",
        syncWithLocation: true,
        meta: { select: "*, santri(nama, nis, kelas, jurusan, foto_url)" },
        sorters: { initial: [{ field: "tanggal", order: "desc" }] },
        pagination: { pageSize: 10 }
    });

    const { create, edit, push } = useNavigation();
    const { mutate: deleteMutate } = useDelete();

    // State Modal Export Personal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedSantriNis, setSelectedSantriNis] = useState<string | null>(null);

    // Hook Cari Santri untuk Modal
    const { selectProps: santriSelectProps } = useSelect<ISantri>({
        resource: "santri",
        optionLabel: "nama",
        optionValue: "nis",
        onSearch: (value) => [
            { field: "nama", operator: "contains", value },
            { field: "nis", operator: "contains", value },
        ],
    });

    // --- FITUR EXPORT (Sama seperti sebelumnya) ---
    const exportMedicalRecord = async () => {
        if(!selectedSantriNis) return;
        const { data: santri } = await supabaseClient.from('santri').select('*').eq('nis', selectedSantriNis).single();
        const { data: history } = await supabaseClient.from('kesehatan_santri').select('*').eq('santri_nis', selectedSantriNis).order('tanggal', { ascending: false });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(`Medis - ${santri.nama}`);
        
        // Setup Header Excel
        worksheet.mergeCells('A1:E1');
        worksheet.getCell('A1').value = "REKAM JEJAK KESEHATAN SANTRI";
        worksheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FFDC2626' } };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        worksheet.getCell('A3').value = "Nama"; worksheet.getCell('B3').value = `: ${santri.nama}`;
        worksheet.getCell('A4').value = "NIS"; worksheet.getCell('B4').value = `: ${santri.nis}`;
        worksheet.getCell('A5').value = "Kelas"; worksheet.getCell('B5').value = `: ${santri.kelas} (${santri.jurusan})`;

        worksheet.getRow(7).values = ['Tanggal', 'Keluhan', 'Tindakan', 'Catatan', 'Petugas'];
        const headerRow = worksheet.getRow(7);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } };

        if(history) {
            history.forEach((item: any) => {
                worksheet.addRow([dayjs(item.tanggal).format('DD MMM YYYY'), item.keluhan, item.tindakan, item.catatan || '-', '-']);
            });
        }
        worksheet.columns.forEach(col => { col.width = 25; });
        
        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Rekam_Medis_${santri.nama}.xlsx`);
        setIsModalOpen(false);
        message.success("Rekam medis berhasil diunduh.");
    };

    const exportBulk = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Laporan UKS');
        worksheet.columns = [
            { header: 'Tanggal', key: 'tgl', width: 15 },
            { header: 'Nama Santri', key: 'nama', width: 25 },
            { header: 'Keluhan', key: 'keluhan', width: 30 },
            { header: 'Tindakan', key: 'tindakan', width: 30 },
            { header: 'Catatan', key: 'catatan', width: 30 },
        ];
        const { data } = await supabaseClient.from('kesehatan_santri').select('*, santri(nama)').order('tanggal', { ascending: false });
        if(data) {
            data.forEach((item: any) => worksheet.addRow({
                tgl: dayjs(item.tanggal).format('YYYY-MM-DD'),
                nama: item.santri?.nama,
                keluhan: item.keluhan,
                tindakan: item.tindakan,
                catatan: item.catatan
            }));
        }
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } };
        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Laporan_UKS_All.xlsx`);
    };

    // --- DEFINISI KOLOM TABLE (REVISED) ---
    const columns: ProColumns<IKesehatanSantri>[] = [
        {
            title: '#',
            valueType: 'index',
            width: 48,
            align: 'center',
            fixed: 'left',
        },
        {
            title: "Tanggal Periksa",
            dataIndex: "tanggal",
            valueType: "date",
            width: 140,
            sorter: true,
            render: (_, r) => (
                <div className="flex items-center gap-2 text-gray-600">
                    <CalendarOutlined />
                    <Text>{dayjs(r.tanggal).format("DD MMM YYYY")}</Text>
                </div>
            ),
        },
        {
            title: "Pasien (Santri)",
            dataIndex: "santri_nis",
            width: 250,
            render: (_, record) => (
                <div className="flex items-start gap-3">
                    {/* AVATAR FIX: Menggunakan component Avatar AntD agar ukuran terkunci */}
                    <Avatar 
                        shape="square" 
                        size={48} 
                        src={record.santri?.foto_url} 
                        icon={<UserOutlined />}
                        className="bg-gray-100 border border-gray-200 flex-shrink-0"
                    />
                    <div className="flex flex-col justify-center">
                        <Text strong className="text-base leading-tight">
                            {record.santri?.nama || "Tanpa Nama"}
                        </Text>
                        <Text type="secondary" className="text-xs">
                            NIS: {record.santri?.nis || "-"}
                        </Text>
                    </div>
                </div>
            ),
        },
        // KOLOM BARU: KELAS & JURUSAN
        {
            title: "Kelas / Asrama",
            key: "kelas",
            width: 150,
            render: (_, record) => (
                <div className="flex flex-col gap-1">
                    <Tag color="blue" className="w-fit m-0">
                        {record.santri?.kelas || "?"} - {record.santri?.jurusan || "?"}
                    </Tag>
                </div>
            )
        },
        {
            title: "Diagnosa & Keluhan",
            dataIndex: "keluhan",
            width: 200,
            render: (_, r) => (
                <div className="flex flex-col">
                    <Text strong className="text-red-600">
                        {r.keluhan}
                    </Text>
                    {r.catatan && (
                        <Text type="secondary" className="text-xs italic mt-1" ellipsis={{ tooltip: r.catatan }}>
                            Note: "{r.catatan}"
                        </Text>
                    )}
                </div>
            )
        },
        {
            title: "Penanganan",
            dataIndex: "tindakan",
            width: 200,
            render: (_, r) => (
                <Tag icon={<MedicineBoxOutlined />} color="success" className="px-2 py-1 text-sm">
                    {r.tindakan}
                </Tag>
            )
        },
        {
            title: "Aksi",
            valueType: "option",
            width: 80,
            fixed: "right",
            align: "center",
            render: (_, record) => [
                <div key="action-group" className="flex gap-1 justify-center">
                    <Tooltip title="Edit">
                        <Button 
                            type="text" 
                            size="small" 
                            icon={<EditOutlined />} 
                            className="text-amber-500 hover:bg-amber-50"
                            onClick={() => edit("kesehatan_santri", record.id)} 
                        />
                    </Tooltip>
                    <Tooltip title="Hapus">
                        <Button 
                            type="text" 
                            size="small" 
                            danger 
                            icon={<DeleteOutlined />} 
                            onClick={() => {
                                if(confirm("Hapus data medis ini?")) deleteMutate({ resource: "kesehatan_santri", id: record.id });
                            }} 
                        />
                    </Tooltip>
                </div>
            ]
        }
    ];

    return (
        <>
            <ProTable<IKesehatanSantri>
                {...tableProps}
                columns={columns}
                rowKey="id"
                // HEADER ELEGAN
                headerTitle={
                    <div className="flex items-center gap-3 py-2">
                        <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center border border-red-100">
                            <MedicineBoxOutlined className="text-red-600 text-xl" />
                        </div>
                        <div className="flex flex-col">
                            <Title level={4} style={{ margin: 0 }}>Data Kesehatan (UKS)</Title>
                            <Text type="secondary" style={{ fontSize: 12 }}>Monitoring & Rekam Medis Santri</Text>
                        </div>
                    </div>
                }
                // TOOLBAR BUTTONS
                toolBarRender={() => [
                    <Button key="personal" icon={<UserOutlined />} onClick={() => setIsModalOpen(true)}>
                        Cetak Personal
                    </Button>,
                    <Button key="export" icon={<DownloadOutlined />} onClick={exportBulk}>
                        Laporan Bulanan
                    </Button>,
                    <Button 
                        key="create" 
                        type="primary" 
                        icon={<PlusOutlined />} 
                        onClick={() => push("/kesehatan/create")}
                        style={{ backgroundColor: '#dc2626' }} // Tailwind Red-600
                        className="shadow-sm hover:opacity-90"
                    >
                        Catat Sakit
                    </Button>
                ]}
                // STYLING TABLE
                options={{ 
                    density: false, 
                    fullScreen: true, 
                    reload: true,
                    setting: true
                }}
                search={{
                    labelWidth: 'auto',
                    defaultCollapsed: false,
                    className: "mb-4 p-4 bg-white rounded-xl shadow-sm border border-gray-100"
                }}
                pagination={{
                    defaultPageSize: 10,
                    showSizeChanger: true,
                    className: "px-4 pb-4"
                }}
                cardBordered={false}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
                tableAlertRender={false}
                scroll={{ x: 1000 }} // Agar responsif di layar kecil
            />

            {/* MODAL PRINT (Tidak berubah logic, hanya styling sedikit) */}
            <Modal
                title={
                    <Space>
                        <FileExcelOutlined className="text-green-600"/>
                        <span>Cetak Rekam Medis Personal</span>
                    </Space>
                }
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                footer={[
                    <Button key="back" onClick={() => setIsModalOpen(false)}>Batal</Button>,
                    <Button 
                        key="submit" 
                        type="primary" 
                        danger 
                        icon={<DownloadOutlined />} 
                        onClick={exportMedicalRecord} 
                        disabled={!selectedSantriNis}
                    >
                        Download Excel
                    </Button>,
                ]}
                centered
            >
                <div className="py-6 px-2">
                    <p className="mb-3 text-gray-500">Silakan cari santri berdasarkan Nama atau NIS:</p>
                    <Select
                        {...santriSelectProps}
                        showSearch
                        size="large"
                        placeholder="Ketik Nama Santri..."
                        style={{ width: '100%' }}
                        onChange={(value) => setSelectedSantriNis(value as unknown as string)}
                        filterOption={false}
                        suffixIcon={<UserOutlined className="text-gray-400"/>}
                    />
                </div>
            </Modal>
        </>
    );
};