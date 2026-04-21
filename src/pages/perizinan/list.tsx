import React, { useState } from "react";
import { logActivity } from "../../utility/logger";
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
import { useNavigation, useUpdate, useDelete , useGetIdentity} from "@refinedev/core";
import { formatDualDate, formatHijri, formatMasehi } from "../../utility/dateHelper";
import dayjs from "dayjs";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { supabaseClient } from "../../utility/supabaseClient";

const { Text } = Typography;

export const PerizinanList = () => {
        const { data: user } = useGetIdentity();
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

    // --- 1. EXPORT SEMUA DATA (BULK - GOLD THEME) ---
    const exportToExcelBulk = async () => {
        const instansi = {
            nama: "PONDOK PESANTREN AL-HASANAH",
            alamat: "Jl. Raya Cibeuti No.13, Cibeuti, Kec. Kawalu, Tasikmalaya, Jawa Barat 46182",
            kontak: "Telp: 0812-XXXX-XXXX | Email: info@alhasanah.com",
        };

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Rekap Perizinan');

        // HEADER KOP SURAT
        worksheet.mergeCells('A1:I1');
        worksheet.getCell('A1').value = instansi.nama;
        worksheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FFB45309' } };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A2:I2');
        worksheet.getCell('A2').value = instansi.alamat;
        worksheet.getCell('A2').alignment = { horizontal: 'center' };

        worksheet.addRow([]);
        worksheet.addRow([`REKAPITULASI PERIZINAN SANTRI - ${new Date().toLocaleDateString('id-ID')}`]).font = { bold: true };
        worksheet.addRow([]);

        const headerRow = worksheet.addRow([
            'TGL PENGAJUAN (M)', 
            'TGL PENGAJUAN (H)', 
            'NAMA SANTRI', 
            'KELAS', 
            'JENIS IZIN', 
            'ALASAN', 
            'STATUS', 
            'TGL KEMBALI (M)', 
            'TGL KEMBALI (H)'
        ]);

        headerRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };
            cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
            cell.alignment = { horizontal: 'center' };
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        });

        const { data } = await supabaseClient
            .from('perizinan_santri')
            .select('*, santri(nama, kelas, jurusan)')
            .order('created_at', { ascending: false });

        if(data) {
            data.forEach((item: any, index) => {
                const row = worksheet.addRow([
                    formatMasehi(item.created_at),
                    formatHijri(item.created_at),
                    item.santri?.nama?.toUpperCase(),
                    `${item.santri?.kelas} - ${item.santri?.jurusan}`,
                    item.jenis_izin,
                    item.keterangan,
                    item.status,
                    formatMasehi(item.tanggal_kembali),
                    formatHijri(item.tanggal_kembali)
                ]);
                row.eachCell((cell) => {
                    cell.border = { top: {style:'thin', color:{argb:'FFE5E7EB'}}, left: {style:'thin', color:{argb:'FFE5E7EB'}}, bottom: {style:'thin', color:{argb:'FFE5E7EB'}}, right: {style:'thin', color:{argb:'FFE5E7EB'}} };
                    if (index % 2 !== 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF6E3' } };
                });
            });
        }

        worksheet.autoFilter = 'A7:I7';
        [20, 25, 25, 15, 15, 30, 12, 20, 25].forEach((w, i) => { worksheet.getColumn(i+1).width = w; });

        const buffer = await workbook.xlsx.writeBuffer();
        const dateStr = new Date().toISOString().split('T')[0];
        saveAs(new Blob([buffer]), `Rekap_Perizinan_Santri_Bulk_${dateStr}.xlsx`);
    };

    // --- 2. EXPORT PERSONAL (GOLD THEME) ---
    const exportPersonalReport = async () => {
        if(!selectedSantriNis) return;
        const instansi = {
            nama: "PONDOK PESANTREN AL-HASANAH",
            alamat: "Jl. Raya Cibeuti No.13, Cibeuti, Kec. Kawalu, Tasikmalaya, Jawa Barat 46182",
        };

        const { data: santri } = await supabaseClient.from('santri').select('*').eq('nis', selectedSantriNis).single();
        const { data: history } = await supabaseClient.from('perizinan_santri').select('*').eq('santri_nis', selectedSantriNis).order('created_at', { ascending: false });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(`Riwayat - ${santri.nama}`);

        worksheet.mergeCells('A1:G1');
        worksheet.getCell('A1').value = instansi.nama;
        worksheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FFB45309' } };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        worksheet.getCell('A3').value = "LAPORAN RIWAYAT PERIZINAN SANTRI";
        worksheet.getCell('A3').font = { bold: true };
        worksheet.getCell('A5').value = "NAMA"; worksheet.getCell('B5').value = `: ${santri.nama.toUpperCase()}`;
        worksheet.getCell('A6').value = "NIS"; worksheet.getCell('B6').value = `: ${santri.nis}`;

        const headerRow = worksheet.getRow(8);
        headerRow.values = ['TGL PENGAJUAN (M)', 'TGL PENGAJUAN (H)', 'JENIS IZIN', 'KETERANGAN', 'RENCANA KEMBALI (M)', 'RENCANA KEMBALI (H)', 'STATUS'];
        headerRow.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };
            cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        });
        
        if(history) {
            history.forEach((item: any, index) => {
                worksheet.addRow([
                    formatMasehi(item.created_at),
                    formatHijri(item.created_at),
                    item.jenis_izin,
                    item.keterangan,
                    formatMasehi(item.tanggal_kembali),
                    formatHijri(item.tanggal_kembali),
                    item.status
                ]).eachCell(cell => {
                    cell.border = { top: {style:'thin', color:{argb:'FFE5E7EB'}}, left: {style:'thin', color:{argb:'FFE5E7EB'}}, bottom: {style:'thin', color:{argb:'FFE5E7EB'}}, right: {style:'thin', color:{argb:'FFE5E7EB'}} };
                });
            });
        }

        worksheet.columns.forEach(column => { column.width = 22; });
        const buffer = await workbook.xlsx.writeBuffer();
        const dateStr = new Date().toISOString().split('T')[0];
        saveAs(new Blob([buffer]), `Riwayat_Perizinan_${santri.nama.replace(/\s+/g, '_')}_${dateStr}.xlsx`);
        setIsModalOpen(false);
    };

    // --- UPDATE STATUS ---
    const handleUpdateStatus = (id: number, newStatus: string) => {
        const extraData = newStatus === 'APPROVED' ? { tanggal: dayjs().format('YYYY-MM-DD') } : {};
        updateMutate({
            resource: "perizinan_santri",
            id,
            values: { status: newStatus, ...extraData },
            successNotification: { message: `Status berhasil diubah menjadi ${newStatus}`, type: "success" },
            onSuccess: (data) => {
                logActivity({
                    user,
                    action: "UPDATE",
                    resource: "perizinan_santri",
                    record_id: id.toString(),
                    details: { status: newStatus }
                });
            }
        });
    };

    const columns: ProColumns<IPerizinanSantri>[] = [
        {
            title: "Tgl",
            dataIndex: "created_at",
            width: 140,
            render: (_, r) => (
                <div className="flex flex-col">
                    <Text strong>{dayjs(r.created_at).format("DD MMM")}</Text>
                    <Text type="secondary" style={{ fontSize: 10 }}>{formatHijri(r.created_at)}</Text>
                </div>
            ),
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
            width: 180,
            render: (_, r) => (
                <div className="flex flex-col gap-1.5 py-1">
                    <Tag className="w-fit m-0 px-2 py-0.5 font-medium bg-gray-50 border-gray-200">
                        {r.jenis_izin}
                    </Tag>
                    <div className="flex flex-col leading-tight">
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Rencana Kembali:</span>
                        <span className="text-xs text-red-600 font-bold">
                            {dayjs(r.tanggal_kembali).format("DD MMM YYYY")}
                        </span>
                        <span className="text-[10px] text-red-500 font-medium">{formatHijri(r.tanggal_kembali)}</span>
                    </div>
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
                                    if(confirm("Hapus data izin ini?")) deleteMutate({
                                    resource: "perizinan_santri",
                                    id: record.id,
                                    onSuccess: () => {
                                        logActivity({
                                            user,
                                            action: "DELETE",
                                            resource: "perizinan_santri",
                                            record_id: record.id.toString(),
                                            details: { id: record.id }
                                        });
                                    }
                                });
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
                        <div className="flex flex-col">
                            <Text strong>Monitoring Perizinan</Text>
                            <Text type="secondary" style={{ fontSize: 10 }}>Hari ini: {formatHijri(new Date())}</Text>
                        </div>
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