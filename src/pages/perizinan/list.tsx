import React, { useState } from "react";
import { useTable, useSelect } from "@refinedev/antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import { Tag, Space, Button, Typography, Tooltip, message, Select, Modal, Card } from "antd";
import { 
    PlusOutlined, 
    CheckCircleOutlined, 
    CloseCircleOutlined, 
    LoginOutlined,
    FileProtectOutlined,
    EditOutlined,
    DeleteOutlined,
    DownloadOutlined,
    UserOutlined,
    FileExcelOutlined
} from "@ant-design/icons";
import { IPerizinanSantri, ISantri } from "../../types";
import { useNavigation, useUpdate, useDelete } from "@refinedev/core";
import dayjs from "dayjs";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { supabaseClient } from "../../utility/supabaseClient";

const { Text } = Typography;

export const PerizinanList = () => {
    const { tableProps } = useTable<IPerizinanSantri>({
        resource: "perizinan_santri",
        syncWithLocation: true,
        meta: { select: "*, santri(nama, nis, kelas, jurusan, foto_url)" },
        sorters: { initial: [{ field: "created_at", order: "desc" }] }
    });

    // PERBAIKAN 1: Tambahkan 'push' ke dalam destructuring useNavigation
    const { create, edit, push } = useNavigation();
    const { mutate: updateMutate } = useUpdate();
    const { mutate: deleteMutate } = useDelete();

    // State untuk Modal Laporan Personal
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

    // --- 1. EXPORT SEMUA DATA (BULK) ---
    const exportToExcelBulk = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Rekap Perizinan');

        worksheet.columns = [
            { header: 'Tanggal', key: 'tgl', width: 15 },
            { header: 'Nama Santri', key: 'nama', width: 25 },
            { header: 'Kelas', key: 'kelas', width: 15 },
            { header: 'Jenis', key: 'jenis', width: 15 },
            { header: 'Alasan', key: 'alasan', width: 30 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Tgl Kembali', key: 'kembali', width: 15 },
        ];

        const { data } = await supabaseClient
            .from('perizinan_santri')
            .select('*, santri(nama, kelas, jurusan)')
            .order('created_at', { ascending: false });

        if(data) {
            data.forEach((item: any) => {
                worksheet.addRow({
                    tgl: dayjs(item.created_at).format('YYYY-MM-DD'),
                    nama: item.santri?.nama,
                    kelas: `${item.santri?.kelas} - ${item.santri?.jurusan}`,
                    jenis: item.jenis_izin,
                    alasan: item.keterangan,
                    status: item.status,
                    kembali: dayjs(item.tanggal_kembali).format('YYYY-MM-DD')
                });
            });
        }

        // Header Style
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Rekap_Semua_Izin_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    };

    // --- 2. EXPORT PERSONAL (LAPORAN KHUSUS) ---
    const exportPersonalReport = async () => {
        if(!selectedSantriNis) return;

        // Ambil Data Santri
        const { data: santri } = await supabaseClient
            .from('santri')
            .select('*')
            .eq('nis', selectedSantriNis)
            .single();

        // Ambil Riwayat Izin Santri Tersebut
        const { data: history } = await supabaseClient
            .from('perizinan_santri')
            .select('*')
            .eq('santri_nis', selectedSantriNis)
            .order('created_at', { ascending: false });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(`Laporan - ${santri.nama}`);

        // --- Header Laporan Personal ---
        worksheet.mergeCells('A1:E1');
        worksheet.getCell('A1').value = "LAPORAN RIWAYAT PERIZINAN SANTRI";
        worksheet.getCell('A1').font = { size: 16, bold: true };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        worksheet.getCell('A3').value = "Nama Santri"; worksheet.getCell('B3').value = `: ${santri.nama}`;
        worksheet.getCell('A4').value = "NIS"; worksheet.getCell('B4').value = `: ${santri.nis}`;
        worksheet.getCell('A5').value = "Kelas"; worksheet.getCell('B5').value = `: ${santri.kelas} (${santri.jurusan})`;

        worksheet.getRow(7).values = ['Tanggal Pengajuan', 'Jenis Izin', 'Alasan / Keterangan', 'Rencana Kembali', 'Status Akhir'];
        
        // Style Header Tabel
        const headerRow = worksheet.getRow(7);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } }; // Emerald
        
        // Isi Data
        if(history) {
            history.forEach((item: any, index) => {
                const row = worksheet.getRow(8 + index);
                row.values = [
                    dayjs(item.created_at).format('DD MMM YYYY'),
                    item.jenis_izin,
                    item.keterangan,
                    dayjs(item.tanggal_kembali).format('DD MMM YYYY'),
                    item.status
                ];
            });
        }

        // Auto Width Columns
        worksheet.columns.forEach(column => { column.width = 25; });
        worksheet.getColumn(3).width = 40; // Kolom Alasan lebih lebar

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Laporan_Izin_${santri.nama}.xlsx`);
        setIsModalOpen(false);
        message.success("Laporan personal berhasil diunduh.");
    };

    // --- UPDATE STATUS ---
    const handleUpdateStatus = (id: number, newStatus: string) => {
        const extraData = newStatus === 'APPROVED' ? { tanggal: dayjs().format('YYYY-MM-DD') } : {};
        updateMutate({
            resource: "perizinan_santri",
            id,
            values: { status: newStatus, ...extraData },
            successNotification: { message: `Status berhasil diubah menjadi ${newStatus}`, type: "success" }
        });
    };

    const columns: ProColumns<IPerizinanSantri>[] = [
        {
            title: "Tgl",
            dataIndex: "created_at",
            width: 90,
            render: (_, r) => dayjs(r.created_at).format("DD MMM"),
            sorter: true,
        },
        {
            title: "Santri",
            dataIndex: "santri_nis",
            width: 220,
            render: (_, record) => (
                <div className="flex items-center gap-2">
                    {record.santri?.foto_url ? (
                        <img src={record.santri.foto_url} className="w-8 h-8 rounded-full border border-gray-200"/>
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 border"><UserOutlined/></div>
                    )}
                    <div className="flex flex-col leading-tight">
                        <Text strong className="text-sm">{record.santri?.nama}</Text>
                        <Text type="secondary" className="text-xs">{record.santri?.kelas}-{record.santri?.jurusan}</Text>
                    </div>
                </div>
            ),
        },
        {
            title: "Jenis & Rencana",
            key: "info",
            width: 160,
            render: (_, r) => (
                <div className="flex flex-col gap-1">
                    <Tag>{r.jenis_izin}</Tag>
                    <span className="text-xs text-gray-500">
                        Kembali: <span className="text-red-600 font-medium">{dayjs(r.tanggal_kembali).format("DD MMM")}</span>
                    </span>
                </div>
            )
        },
        {
            title: "Keterangan",
            dataIndex: "keterangan",
            ellipsis: true,
        },
        {
            title: "Status",
            dataIndex: "status",
            valueEnum: {
                PENDING: { text: "Menunggu", status: "Warning" },
                APPROVED: { text: "Disetujui", status: "Success" },
                REJECTED: { text: "Ditolak", status: "Error" },
                KEMBALI: { text: "Kembali", status: "Default" },
            },
            width: 120,
            render: (_, r) => {
                let color = "orange";
                if(r.status === "APPROVED") color = "green";
                if(r.status === "REJECTED") color = "red";
                if(r.status === "KEMBALI") color = "blue";
                return <Tag color={color}>{r.status}</Tag>
            }
        },
        {
            title: "Aksi",
            valueType: "option",
            width: 150,
            fixed: "right",
            render: (_, record) => {
                // Tombol Approval (Hanya muncul jika Pending)
                if (record.status === 'PENDING') {
                    return (
                        <Space>
                            <Tooltip title="Setujui"><Button size="small" type="primary" shape="circle" icon={<CheckCircleOutlined />} className="bg-emerald-500" onClick={() => handleUpdateStatus(record.id, 'APPROVED')} /></Tooltip>
                            <Tooltip title="Tolak"><Button size="small" danger shape="circle" icon={<CloseCircleOutlined />} onClick={() => handleUpdateStatus(record.id, 'REJECTED')} /></Tooltip>
                            {/* Tombol Edit Tetap Ada */}
                            <Tooltip title="Edit"><Button size="small" icon={<EditOutlined />} onClick={() => edit("perizinan_santri", record.id)} /></Tooltip>
                        </Space>
                    );
                }
                // Tombol Kembali (Jika Approved)
                if (record.status === 'APPROVED') {
                    return (
                        <Tooltip title="Catat Kembali">
                            <Button size="small" icon={<LoginOutlined />} className="text-blue-600 border-blue-600" onClick={() => handleUpdateStatus(record.id, 'KEMBALI')}>Kembali</Button>
                        </Tooltip>
                    );
                }
                // Tombol Umum (Edit & Delete) untuk status lain
                return (
                    <Space>
                        <Tooltip title="Edit"><Button size="small" icon={<EditOutlined />} onClick={() => edit("perizinan_santri", record.id)} /></Tooltip>
                        <Tooltip title="Hapus">
                            <Button 
                                size="small" danger icon={<DeleteOutlined />} 
                                onClick={() => {
                                    if(confirm("Hapus data izin ini?")) deleteMutate({ resource: "perizinan_santri", id: record.id });
                                }} 
                            />
                        </Tooltip>
                    </Space>
                );
            }
        }
    ];

    // PERBAIKAN 2: Blok fungsi push() manual yang membuat error DARI SINI TELAH DIHAPUS

    return (
        <>
            <ProTable<IPerizinanSantri>
                {...tableProps}
                columns={columns}
                rowKey="id"
                headerTitle={
                    <Space>
                        <FileProtectOutlined className="text-blue-600 text-lg" />
                        <Text strong>Monitoring Perizinan</Text>
                    </Space>
                }
                toolBarRender={() => [
                    // TOMBOL LAPORAN PERSONAL
                    <Button 
                        key="personal" 
                        icon={<UserOutlined />} 
                        onClick={() => setIsModalOpen(true)}
                    >
                        Laporan Personal
                    </Button>,
                    // TOMBOL EXPORT BULK
                    <Button 
                        key="export" 
                        icon={<DownloadOutlined />} 
                        onClick={exportToExcelBulk}
                    >
                        Export Data
                    </Button>,
                    <Button 
                        key="create" 
                        type="primary" 
                        icon={<PlusOutlined />} 
                        onClick={() => push("/perizinan/create")}
                        className="bg-blue-600"
                    >
                        Buat Izin
                    </Button>
                ]}
                options={{ density: true, fullScreen: true, reload: true }}
                search={{ labelWidth: 'auto', layout: 'vertical' }}
                pagination={{ defaultPageSize: 10 }}
                className="bg-white dark:bg-[#141414] rounded-lg shadow-sm"
                scroll={{ x: 1000 }}
            />

            {/* MODAL PILIH SANTRI UNTUK LAPORAN */}
            <Modal
                title="Download Laporan Personal"
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                footer={[
                    <Button key="back" onClick={() => setIsModalOpen(false)}>Batal</Button>,
                    <Button 
                        key="submit" type="primary" 
                        icon={<FileExcelOutlined />} 
                        disabled={!selectedSantriNis}
                        onClick={exportPersonalReport}
                        className="bg-emerald-600"
                    >
                        Download Excel
                    </Button>,
                ]}
            >
                <div className="py-4">
                    <p className="mb-2 text-gray-500">Pilih santri untuk mencetak riwayat perizinan mereka:</p>
                    <Select
                        {...santriSelectProps}
                        showSearch
                        placeholder="Ketik Nama / NIS Santri..."
                        style={{ width: '100%' }}
                        onChange={(value) => setSelectedSantriNis(value as unknown as string)}
                        filterOption={false}
                    />
                </div>
            </Modal>
        </>
    );
};