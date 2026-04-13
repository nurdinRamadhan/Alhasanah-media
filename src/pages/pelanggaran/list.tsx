import React from "react";
import { useTable } from "@refinedev/antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import { Tag, Space, Button, Typography, Tooltip, Avatar, Modal, message } from "antd";
import { 
    DownloadOutlined,
    PlusOutlined, 
    WarningOutlined, 
    DeleteOutlined, 
    EditOutlined, 
    ThunderboltOutlined,
    FileTextOutlined,
    UserOutlined,
    RestOutlined
} from "@ant-design/icons";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { supabaseClient } from "../../utility/supabaseClient";
import { IPelanggaranSantri } from "../../types";
import { useNavigation, useDelete } from "@refinedev/core";
import dayjs from "dayjs";
import "dayjs/locale/id";

const { Text, Paragraph } = Typography;

export const PelanggaranList = () => {
    const { tableProps } = useTable<IPelanggaranSantri>({
        resource: "pelanggaran_santri",
        syncWithLocation: true,
        meta: {
            select: "*, santri(nama, kelas, jurusan, foto_url)"
        },
        sorters: { initial: [{ field: "tanggal", order: "desc" }] }
    });

    const { create, edit } = useNavigation(); 
    const { mutate: deleteMutate } = useDelete();

    // --- LOGIKA EXPORT EXCEL ---
    const exportToExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Data Pelanggaran');

        worksheet.columns = [
            { header: 'Tanggal', key: 'tanggal', width: 15 },
            { header: 'NIS', key: 'nis', width: 15 },
            { header: 'Nama Santri', key: 'nama', width: 30 },
            { header: 'Kelas', key: 'kelas', width: 10 },
            { header: 'Jenis', key: 'jenis', width: 15 },
            { header: 'Poin', key: 'poin', width: 10 },
            { header: 'Hukuman', key: 'hukuman', width: 30 },
            { header: 'Catatan', key: 'catatan', width: 40 },
        ];

        const { data: allData } = await supabaseClient
            .from('pelanggaran_santri')
            .select('*, santri(nama, nis, kelas, jurusan)')
            .order('tanggal', { ascending: false });

        if (allData) {
            allData.forEach((item: any) => {
                worksheet.addRow({
                    tanggal: dayjs(item.tanggal).format('YYYY-MM-DD'),
                    nis: item.santri?.nis,
                    nama: item.santri?.nama,
                    kelas: `${item.santri?.kelas} - ${item.santri?.jurusan}`,
                    jenis: item.jenis_pelanggaran,
                    poin: item.poin,
                    hukuman: item.hukuman,
                    catatan: item.catatan
                });
            });
        }

        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } };

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Laporan_Pelanggaran_${dayjs().format('YYYY-MM-DD')}.xlsx`);
        message.success("Data pelanggaran berhasil diunduh.");
    };

    // --- LOGIKA RESET TAHUNAN ---
    const handleResetTahunan = () => {
        Modal.confirm({
            title: 'PEMULIHAN DATA PELANGGARAN',
            icon: <WarningOutlined style={{ color: 'red' }} />,
            content: (
                <div>
                    <p>Anda yakin ingin menghapus <b>SEMUA</b> riwayat pelanggaran?</p>
                    <p className="text-red-600 font-bold">Tindakan ini tidak dapat dibatalkan!</p>
                </div>
            ),
            okText: 'Ya, Hapus Semua',
            okType: 'danger',
            cancelText: 'Batal',
            onOk: async () => {
                try {
                    const { error } = await supabaseClient.rpc('reset_pelanggaran');
                    if (error) throw error;
                    message.success("Sistem poin berhasil di-reset.");
                    window.location.reload(); 
                } catch (err: any) {
                    message.error("Gagal mereset: " + err.message);
                }
            },
        });
    };

    const columns: ProColumns<IPelanggaranSantri>[] = [
        {
            title: "Tanggal",
            dataIndex: "tanggal",
            valueType: "date",
            width: 110,
            fixed: "left", 
            render: (_, record) => (
                <div className="flex flex-col">
                    <Text strong>{dayjs(record.tanggal).format("DD MMM")}</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(record.tanggal).format("YYYY")}</Text>
                </div>
            ),
            sorter: true,
        },
        {
            title: "Santri",
            dataIndex: "santri_nis",
            width: 250,
            render: (_, record) => (
                <div className="flex items-center gap-3 py-1">
                    <Avatar 
                        src={record.santri?.foto_url} 
                        size={40} 
                        icon={<UserOutlined />}
                        className="bg-gray-100 border border-gray-200 flex-shrink-0 shadow-sm"
                    />
                    <div className="flex flex-col gap-y-0.5 overflow-hidden">
                        <Text strong className="text-gray-900 dark:text-gray-100 text-[14px] leading-snug truncate block">
                            {record.santri?.nama || "-"}
                        </Text>
                        <div className="flex items-center gap-1.5">
                            <Tag bordered={false} className="m-0 text-[10px] px-1.5 py-0 bg-gray-50 dark:bg-gray-800 dark:text-gray-400 font-medium">
                                NIS: {record.santri_nis}
                            </Tag>
                            <Tag bordered={false} color="cyan" className="m-0 text-[10px] px-1.5 py-0 font-medium">
                                {record.santri?.kelas}-{record.santri?.jurusan}
                            </Tag>
                        </div>
                    </div>
                </div>
            ),
        },
        {
            title: "Kategori",
            dataIndex: "jenis_pelanggaran",
            width: 100,
            align: 'center',
            valueEnum: {
                RINGAN: { text: "Ringan", status: "Success" },
                SEDANG: { text: "Sedang", status: "Warning" },
                BERAT: { text: "Berat", status: "Error" },
            },
            render: (_, record) => {
                let color = "green";
                if (record.jenis_pelanggaran === "SEDANG") color = "orange";
                if (record.jenis_pelanggaran === "BERAT") color = "red";
                return <Tag color={color} className="font-semibold rounded-full px-2">{record.jenis_pelanggaran}</Tag>;
            }
        },
        {
            title: "Poin",
            dataIndex: "poin",
            width: 80,
            align: 'center',
            sorter: true,
            render: (_dom, record) => (
                <div className="flex flex-col items-center">
                    <span className={`text-lg font-bold ${record.poin > 50 ? 'text-red-600' : 'text-emerald-600'}`}>
                        +{record.poin}
                    </span>
                </div>
            ),
        },
        {
            title: "Tindakan / Hukuman",
            dataIndex: "hukuman",
            width: 200,
            hideInSearch: true,
            render: (_, record) => (
                <div className="flex items-start gap-2 text-rose-700 dark:text-rose-400">
                    <ThunderboltOutlined className="mt-1 opacity-60 flex-shrink-0" />
                    <Paragraph ellipsis={{ rows: 2, tooltip: true }} className="m-0 text-xs font-medium">
                        {record.hukuman}
                    </Paragraph>
                </div>
            )
        },
        {
            title: "Kronologi / Catatan",
            dataIndex: "catatan",
            width: 250, 
            hideInSearch: true,
            render: (_, record) => (
                <div className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
                    <FileTextOutlined className="mt-1 opacity-50 flex-shrink-0" />
                    <Paragraph ellipsis={{ rows: 2, tooltip: record.catatan }} className="m-0 text-xs leading-snug">
                        {record.catatan || "-"}
                    </Paragraph>
                </div>
            )
        },
        {
            title: "Aksi",
            valueType: "option",
            width: 100,
            fixed: "right",
            render: (_, record) => [
                <div className="flex gap-1" key="actions">
                    <Tooltip title="Edit Data">
                        <Button 
                            type="text" size="small" 
                            className="text-amber-600 hover:bg-amber-50"
                            icon={<EditOutlined />} onClick={() => edit("pelanggaran_santri", record.id)}
                        />
                    </Tooltip>
                    <Tooltip title="Hapus Data">
                        <Button 
                            type="text" size="small" 
                            className="text-red-600 hover:bg-red-50"
                            icon={<DeleteOutlined />} 
                            onClick={() => {
                                if(confirm("Hapus data pelanggaran ini?")) deleteMutate({ resource: "pelanggaran_santri", id: record.id });
                            }}
                        />
                    </Tooltip>
                </div>
            ]
        }
    ];

    return (
        <ProTable<IPelanggaranSantri>
            {...tableProps}
            columns={columns}
            rowKey="id"
            headerTitle={
                <Space>
                    <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded-lg border border-red-100 dark:border-red-800 flex items-center justify-center">
                        <WarningOutlined className="text-red-500 text-lg" />
                    </div>
                    <div className="flex flex-col">
                        <Text strong className="text-base">Buku Kedisiplinan</Text>
                        <Text type="secondary" className="text-xs">Monitoring pelanggaran & poin santri</Text>
                    </div>
                </Space>
            }
            toolBarRender={() => [
                <Button key="export" icon={<DownloadOutlined />} onClick={exportToExcel}>Unduh Laporan</Button>,
                <Button key="reset" danger icon={<RestOutlined />} onClick={handleResetTahunan} className="border-red-500">Reset</Button>,
                <Button key="create" type="primary" icon={<PlusOutlined />} onClick={() => create("pelanggaran_santri")} className="bg-emerald-600 border-0 shadow-md">Catat</Button>
            ]}
            options={{ density: false, fullScreen: true, reload: true, setting: true }}
            search={{ labelWidth: 'auto', layout: 'vertical', defaultCollapsed: false }}
            pagination={{ defaultPageSize: 10, showSizeChanger: true }}
            className="bg-white dark:bg-[#141414] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden"
            tableStyle={{ border: 'none' }}
            scroll={{ x: 1000 }} 
        />
    );
};