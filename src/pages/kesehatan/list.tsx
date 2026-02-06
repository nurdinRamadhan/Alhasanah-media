import React, { useState } from "react";
import { useTable, useSelect } from "@refinedev/antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import { Tag, Space, Button, Typography, Tooltip, message, Modal, Select } from "antd";
import { 
    PlusOutlined, 
    MedicineBoxOutlined, 
    DeleteOutlined, 
    EditOutlined, 
    DownloadOutlined,
    HeartOutlined,
    ExperimentOutlined,
    UserOutlined,
    FileExcelOutlined
} from "@ant-design/icons";
import { IKesehatanSantri, ISantri } from "../../types";
import { useNavigation, useDelete } from "@refinedev/core";
import dayjs from "dayjs";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { supabaseClient } from "../../utility/supabaseClient";

const { Text, Paragraph } = Typography;

export const KesehatanList = () => {
    const { tableProps } = useTable<IKesehatanSantri>({
        resource: "kesehatan_santri",
        syncWithLocation: true,
        meta: { select: "*, santri(nama, nis, kelas, jurusan, foto_url)" },
        sorters: { initial: [{ field: "tanggal", order: "desc" }] }
    });

    const { create, edit, push } = useNavigation();
    const { mutate: deleteMutate } = useDelete();

    // State Modal Export Personal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedSantriNis, setSelectedSantriNis] = useState<string | null>(null);

    // Hook Cari Santri
    const { selectProps: santriSelectProps } = useSelect<ISantri>({
        resource: "santri",
        optionLabel: "nama",
        optionValue: "nis",
        onSearch: (value) => [
            { field: "nama", operator: "contains", value },
            { field: "nis", operator: "contains", value },
        ],
    });

    // --- 1. EXPORT REKAM MEDIS PERSONAL (ENTERPRISE FEATURE) ---
    const exportMedicalRecord = async () => {
        if(!selectedSantriNis) return;

        const { data: santri } = await supabaseClient
            .from('santri').select('*').eq('nis', selectedSantriNis).single();

        const { data: history } = await supabaseClient
            .from('kesehatan_santri')
            .select('*')
            .eq('santri_nis', selectedSantriNis)
            .order('tanggal', { ascending: false });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(`Medis - ${santri.nama}`);

        // Header Dokumen
        worksheet.mergeCells('A1:E1');
        worksheet.getCell('A1').value = "REKAM JEJAK KESEHATAN SANTRI";
        worksheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FFDC2626' } }; // Merah Medis
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        worksheet.getCell('A3').value = "Nama Santri"; worksheet.getCell('B3').value = `: ${santri.nama}`;
        worksheet.getCell('A4').value = "NIS"; worksheet.getCell('B4').value = `: ${santri.nis}`;
        worksheet.getCell('A5').value = "Kelas"; worksheet.getCell('B5').value = `: ${santri.kelas} (${santri.jurusan})`;

        // Header Tabel
        worksheet.getRow(7).values = ['Tanggal Periksa', 'Keluhan / Gejala', 'Tindakan / Obat', 'Catatan Medis', 'Petugas'];
        const headerRow = worksheet.getRow(7);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } }; // Merah

        if(history) {
            history.forEach((item: any) => {
                worksheet.addRow([
                    dayjs(item.tanggal).format('DD MMM YYYY'),
                    item.keluhan,
                    item.tindakan,
                    item.catatan || '-',
                    '-'
                ]);
            });
        }

        worksheet.columns.forEach(col => { col.width = 25; });
        worksheet.getColumn(2).width = 35; // Keluhan
        worksheet.getColumn(3).width = 35; // Tindakan

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Rekam_Medis_${santri.nama}.xlsx`);
        setIsModalOpen(false);
        message.success("Rekam medis berhasil diunduh.");
    };

    // --- 2. EXPORT BULK (LAPORAN UKS) ---
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

    const columns: ProColumns<IKesehatanSantri>[] = [
        {
            title: "Tanggal",
            dataIndex: "tanggal",
            valueType: "date",
            width: 100,
            render: (_, r) => dayjs(r.tanggal).format("DD MMM"),
            sorter: true,
        },
        {
            title: "Pasien (Santri)",
            dataIndex: "santri_nis",
            width: 220,
            render: (_, record) => (
                <div className="flex items-center gap-2">
                    {record.santri?.foto_url ? (
                        <img src={record.santri.foto_url} className="w-8 h-8 rounded-full border border-gray-200 object-cover"/>
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 border border-gray-200">
                            <UserOutlined />
                        </div>
                    )}
                    <div className="flex flex-col leading-tight">
                        <Text strong className="text-sm">{record.santri?.nama}</Text>
                        <Text type="secondary" className="text-xs">{record.santri?.kelas}-{record.santri?.jurusan}</Text>
                    </div>
                </div>
            ),
        },
        {
            title: "Keluhan & Diagnosa",
            dataIndex: "keluhan",
            render: (_, r) => (
                <div className="flex flex-col">
                    <Text strong className="text-red-700 dark:text-red-400">{r.keluhan}</Text>
                </div>
            )
        },
        {
            title: "Tindakan / Penanganan",
            dataIndex: "tindakan",
            render: (_, r) => (
                <div className="flex items-start gap-2 text-emerald-700 dark:text-emerald-400">
                    <MedicineBoxOutlined className="mt-1" />
                    <Text>{r.tindakan}</Text>
                </div>
            )
        },
        {
            title: "Catatan",
            dataIndex: "catatan",
            hideInSearch: true,
            ellipsis: true,
            width: 200,
        },
        {
            title: "Aksi",
            valueType: "option",
            width: 100,
            fixed: "right",
            render: (_, record) => [
                <Tooltip title="Edit Data" key="edit">
                    <Button 
                        type="text" size="small" icon={<EditOutlined />} 
                        className="text-amber-600 hover:bg-amber-50"
                        onClick={() => edit("kesehatan_santri", record.id)} 
                    />
                </Tooltip>,
                <Tooltip title="Hapus Data" key="delete">
                    <Button 
                        type="text" size="small" danger icon={<DeleteOutlined />} 
                        className="hover:bg-red-50"
                        onClick={() => {
                            if(confirm("Hapus data medis ini?")) deleteMutate({ resource: "kesehatan_santri", id: record.id });
                        }} 
                    />
                </Tooltip>
            ]
        }
    ];

    return (
        <>
            <ProTable<IKesehatanSantri>
                {...tableProps}
                columns={columns}
                rowKey="id"
                headerTitle={
                    <Space>
                        <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded-lg border border-red-100 dark:border-red-800">
                            <MedicineBoxOutlined className="text-red-600 text-lg" />
                        </div>
                        <div className="flex flex-col">
                            <Text strong className="text-base">Rekam Medis (UKS)</Text>
                            <Text type="secondary" className="text-xs">Monitoring kesehatan santri</Text>
                        </div>
                    </Space>
                }
                toolBarRender={() => [
                    <Button key="personal" icon={<UserOutlined />} onClick={() => setIsModalOpen(true)}>
                        Riwayat Personal
                    </Button>,
                    <Button key="export" icon={<DownloadOutlined />} onClick={exportBulk}>
                        Export Data
                    </Button>,
                    <Button 
                        key="create" type="primary" icon={<PlusOutlined />} 
                        onClick={() => push("/kesehatan/create")}
                        className="bg-red-600 hover:bg-red-500 shadow-sm border-0"
                    >
                        Catat Sakit
                    </Button>
                ]}
                options={{ density: true, fullScreen: true, reload: true }}
                search={{ labelWidth: 'auto', layout: 'vertical' }}
                pagination={{ defaultPageSize: 10 }}
                className="bg-white dark:bg-[#141414] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800"
            />

            {/* MODAL DOWNLOAD PERSONAL */}
            <Modal
                title="Cetak Rekam Medis Santri"
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                footer={[
                    <Button key="back" onClick={() => setIsModalOpen(false)}>Batal</Button>,
                    <Button key="submit" type="primary" danger icon={<FileExcelOutlined />} onClick={exportMedicalRecord} disabled={!selectedSantriNis}>
                        Download Excel
                    </Button>,
                ]}
            >
                <div className="py-4">
                    <p className="mb-2 text-gray-500">Pilih santri untuk melihat riwayat penyakit:</p>
                    <Select
                        {...santriSelectProps}
                        showSearch
                        placeholder="Cari Nama Santri..."
                        style={{ width: '100%' }}
                        onChange={(value) => setSelectedSantriNis(value as unknown as string)}
                        filterOption={false}
                    />
                </div>
            </Modal>
        </>
    );
};