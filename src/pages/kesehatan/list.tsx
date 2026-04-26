import React, { useState } from "react";
import { logActivity } from "../../utility/logger";
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
import { useNavigation, useDelete , useGetIdentity} from "@refinedev/core";
import { formatDualDate, formatHijri, formatMasehi } from "../../utility/dateHelper";
import dayjs from "dayjs";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { supabaseClient } from "../../utility/supabaseClient";

const { Text, Title } = Typography;

export const KesehatanList = () => {
    // 1. Data Fetching
        const { data: user } = useGetIdentity();
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

    // --- FITUR EXPORT (GOLD THEME) ---
    const exportMedicalRecord = async () => {
        if(!selectedSantriNis) return;
        const instansi = {
            nama: "PONDOK PESANTREN AL-HASANAH",
            alamat: "Jl. Raya Cibeuti No.13, Cibeuti, Kec. Kawalu, Tasikmalaya, Jawa Barat 46182",
        };

        const { data: santri } = await supabaseClient.from('santri').select('*').eq('nis', selectedSantriNis).single();
        const { data: history } = await supabaseClient.from('kesehatan_santri').select('*').eq('santri_nis', selectedSantriNis).order('tanggal', { ascending: false });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(`Medis - ${santri.nama}`);
        
        // 1. HEADER - KOP SURAT
        worksheet.mergeCells('A1:F1');
        worksheet.getCell('A1').value = instansi.nama;
        worksheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FFB45309' } };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A2:F2');
        worksheet.getCell('A2').value = instansi.alamat;
        worksheet.getCell('A2').alignment = { horizontal: 'center' };

        worksheet.addRow([]);
        worksheet.addRow(["REKAM JEJAK KESEHATAN SANTRI (UKS)"]).font = { bold: true };
        worksheet.addRow([`NAMA: ${santri.nama.toUpperCase()}`]);
        worksheet.addRow([`NIS: ${santri.nis}`]);
        worksheet.addRow([]);

        // 2. HEADER TABEL
        const headerRow = worksheet.addRow(['TANGGAL (M)', 'TANGGAL (H)', 'KELUHAN / DIAGNOSA', 'TINDAKAN / PENANGANAN', 'CATATAN', 'PETUGAS']);
        headerRow.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };
            cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        });

        if(history) {
            history.forEach((item: any, index) => {
                const row = worksheet.addRow([
                    formatMasehi(item.tanggal), 
                    formatHijri(item.tanggal), 
                    item.keluhan, 
                    item.tindakan, 
                    item.catatan || '-', 
                    '-'
                ]);
                row.eachCell(cell => {
                    cell.border = { top: {style:'thin', color:{argb:'FFE5E7EB'}}, left: {style:'thin', color:{argb:'FFE5E7EB'}}, bottom: {style:'thin', color:{argb:'FFE5E7EB'}}, right: {style:'thin', color:{argb:'FFE5E7EB'}} };
                    if (index % 2 !== 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF6E3' } };
                });
            });
        }
        [20, 25, 30, 30, 35, 15].forEach((w, i) => { worksheet.getColumn(i+1).width = w; });
        
        const buffer = await workbook.xlsx.writeBuffer();
        const dateStr = new Date().toISOString().split('T')[0];
        saveAs(new Blob([buffer]), `Rekam_Medis_Santri_${santri.nama.replace(/\s+/g, '_')}_${dateStr}.xlsx`);
        setIsModalOpen(false);
        message.success("Rekam medis berhasil diunduh.");
    };

    const exportBulk = async () => {
        const instansi = {
            nama: "PONDOK PESANTREN AL-HASANAH",
            alamat: "Jl. Raya Cibeuti No.13, Cibeuti, Kec. Kawalu, Tasikmalaya, Jawa Barat 46182",
            kontak: "Telp: 0812-XXXX-XXXX | Email: info@alhasanah.com",
        };

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Laporan UKS');

        // HEADER KOP SURAT
        worksheet.mergeCells('A1:G1');
        worksheet.getCell('A1').value = instansi.nama;
        worksheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FFB45309' } };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A2:G2');
        worksheet.getCell('A2').value = instansi.alamat;
        worksheet.getCell('A2').alignment = { horizontal: 'center' };

        worksheet.addRow([]);
        worksheet.addRow([`LAPORAN BULANAN UNIT KESEHATAN SANTRI - ${new Date().toLocaleDateString('id-ID')}`]).font = { bold: true };
        worksheet.addRow([]);

        const headerRow = worksheet.addRow([
            'NO',
            'TANGGAL (M)', 
            'TANGGAL (H)', 
            'NAMA SANTRI', 
            'KELAS', 
            'KELUHAN', 
            'TINDAKAN', 
            'CATATAN'
        ]);

        headerRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };
            cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
            cell.alignment = { horizontal: 'center' };
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        });

        const { data } = await supabaseClient.from('kesehatan_santri').select('*, santri(nama, kelas, jurusan)').order('tanggal', { ascending: false });
        if(data) {
            data.forEach((item: any, index) => {
                const row = worksheet.addRow([
                    index + 1,
                    formatMasehi(item.tanggal),
                    formatHijri(item.tanggal),
                    item.santri?.nama?.toUpperCase(),
                    `${item.santri?.kelas} - ${item.santri?.jurusan}`,
                    item.keluhan,
                    item.tindakan,
                    item.catatan || '-'
                ]);
                row.eachCell(cell => {
                    cell.border = { top: {style:'thin', color:{argb:'FFE5E7EB'}}, left: {style:'thin', color:{argb:'FFE5E7EB'}}, bottom: {style:'thin', color:{argb:'FFE5E7EB'}}, right: {style:'thin', color:{argb:'FFE5E7EB'}} };
                    if (index % 2 !== 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF6E3' } };
                });
            });
        }

        worksheet.autoFilter = 'A7:H7';
        [5, 20, 25, 30, 15, 30, 30, 35].forEach((w, i) => { worksheet.getColumn(i+1).width = w; });

        const buffer = await workbook.xlsx.writeBuffer();
        const dateStr = new Date().toISOString().split('T')[0];
        saveAs(new Blob([buffer]), `Laporan_Bulanan_UKS_Grup_${dateStr}.xlsx`);
        message.success("Laporan bulanan UKS berhasil diunduh.");
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
            width: 160,
            sorter: true,
            render: (_, r) => (
                <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2 text-gray-800 dark:text-gray-100 font-medium">
                        <CalendarOutlined className="text-red-500" />
                        <Text>{dayjs(r.tanggal).format("DD MMM YYYY")}</Text>
                    </div>
                    <Text type="secondary" style={{ fontSize: 11, paddingLeft: 22 }}>
                        {formatHijri(r.tanggal)}
                    </Text>
                </div>
            ),
        },
        {
            title: "Pasien (Santri)",
            dataIndex: "santri_nis",
            width: 250,
            render: (_, record) => (
                <div className="flex items-center gap-3 py-1">
                    <Avatar 
                        shape="circle" 
                        size={44} 
                        src={record.santri?.foto_url} 
                        icon={<UserOutlined />}
                        className="bg-gray-100 border border-gray-200 flex-shrink-0"
                    />
                    <div className="flex flex-col gap-y-0.5 overflow-hidden">
                        <Text strong className="text-[14px] leading-snug text-gray-900 dark:text-gray-100 block truncate">
                            {record.santri?.nama || "Tanpa Nama"}
                        </Text>
                        <Tag bordered={false} className="m-0 text-[10px] w-fit px-1.5 py-0 bg-gray-50 dark:bg-gray-800 dark:text-gray-400">
                            NIS: {record.santri?.nis || "-"}
                        </Tag>
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
            width: 250,
            render: (_, r) => (
                <Space direction="vertical" size={4} className="py-1">
                    <Text strong className="text-red-600 leading-tight block">
                        {r.keluhan}
                    </Text>
                    {r.catatan && (
                        <div className="flex flex-col border-l-2 border-gray-200 pl-2 mt-1">
                            <span className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Catatan:</span>
                            <Text type="secondary" className="text-xs italic leading-snug">
                                {r.catatan}
                            </Text>
                        </div>
                    )}
                </Space>
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
                                if(confirm("Hapus data medis ini?")) deleteMutate({
                                    resource: "kesehatan_santri",
                                    id: record.id,
                                }, {
                                    onSuccess: () => {
                                        logActivity({
                                            user,
                                            action: "DELETE",
                                            resource: "kesehatan_santri",
                                            record_id: record.id.toString(),
                                            details: { id: record.id }
                                        });
                                    }
                                });
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
                            <Text type="secondary" style={{ fontSize: 12 }}>Monitoring per {formatHijri(new Date())}</Text>
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