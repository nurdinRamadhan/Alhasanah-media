import React, { useState } from "react";
import { useTable } from "@refinedev/antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import { Tag, Space, Button, Typography, Avatar, Modal, message, Tabs, Tooltip } from "antd";
import { 
    CheckCircleOutlined, 
    StopOutlined, 
    UserOutlined, 
    PhoneOutlined,
    GlobalOutlined,
    FileExcelOutlined
} from "@ant-design/icons";
import { IAlumniData, IProfile } from "../../types";
import { useUpdate } from "@refinedev/core";
import { formatHijri, formatDualDate } from "../../utility/dateHelper";
import dayjs from "dayjs";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { supabaseClient } from "../../utility/supabaseClient";

const { Text } = Typography;

export const AlumniList = () => {
    const [activeTab, setActiveTab] = useState<string>("pending");
    
    // Logic: Kita filter berdasarkan profiles.is_active
    const { tableProps, tableQueryResult, setFilters } = useTable<IAlumniData>({
        resource: "alumni_data",
        syncWithLocation: true,
        meta: { select: "*, profiles(*)" },
        filters: {
            initial: [
                { field: "profiles.is_active", operator: "eq", value: false }
            ]
        },
        sorters: { initial: [{ field: "created_at", order: "desc" }] }
    });

    const { mutate: updateProfile } = useUpdate();

    // --- HANDLE VERIFIKASI ---
    const handleVerify = (id: string, name: string) => {
        Modal.confirm({
            title: 'Konfirmasi Verifikasi',
            content: `Apakah Anda yakin ingin memverifikasi akun alumni "${name}"? Setelah aktif, yang bersangkutan bisa login ke Forum Alumni.`,
            okText: 'Verifikasi Sekarang',
            okButtonProps: { className: 'bg-emerald-600' },
            onOk: () => {
                updateProfile({
                    resource: "profiles",
                    id,
                    values: { is_active: true },
                    successNotification: { message: "Alumni Berhasil Diverifikasi!", type: "success" },
                });
            }
        });
    };

    // --- HANDLE NON-AKTIFKAN ---
    const handleDeactivate = (id: string) => {
        updateProfile({
            resource: "profiles",
            id,
            values: { is_active: false },
            successNotification: { message: "Akun telah dinonaktifkan.", type: "warning" },
        });
    };

    const exportExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Database Alumni');
        worksheet.columns = [
            { header: 'Nama Lengkap', key: 'nama', width: 30 },
            { header: 'Angkatan (Lulus)', key: 'lulus', width: 15 },
            { header: 'WhatsApp', key: 'wa', width: 15 },
            { header: 'Profesi', key: 'profesi', width: 20 },
            { header: 'Instansi', key: 'instansi', width: 25 },
            { header: 'Status Akun', key: 'status', width: 15 },
        ];
        
        tableQueryResult.data?.data.forEach(item => {
            worksheet.addRow({
                nama: item.full_name,
                lulus: item.tahun_lulus,
                wa: item.no_wa,
                profesi: item.profesi_sekarang,
                instansi: item.instansi_kerja,
                status: item.profiles?.is_active ? 'AKTIF' : 'PENDING'
            });
        });

        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
        
        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Data_Alumni_Export_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    };

    const columns: ProColumns<IAlumniData>[] = [
        {
            title: "Data Pribadi",
            dataIndex: "full_name",
            render: (_, r) => (
                <div className="flex items-center gap-3">
                    <Avatar size="large" src={r.profiles?.foto_url} icon={<UserOutlined />} className="bg-blue-50 text-blue-600" />
                    <div className="flex flex-col">
                        <Text strong>{r.full_name}</Text>
                        <Text type="secondary" className="text-xs">{r.profiles?.email}</Text>
                        <Space className="mt-1">
                            <Tag bordered={false} className="m-0 bg-blue-100 text-blue-700 font-bold">Angkatan {r.tahun_lulus}</Tag>
                            <Tag icon={<PhoneOutlined />} bordered={false} className="m-0">{r.no_wa}</Tag>
                        </Space>
                    </div>
                </div>
            )
        },
        {
            title: "Karir & Lokasi",
            render: (_, r) => (
                <div className="flex flex-col">
                    <Text strong className="text-xs uppercase text-gray-400">Profesi:</Text>
                    <Text className="text-sm font-medium">{r.profesi_sekarang || '-'}</Text>
                    <Text type="secondary" className="text-[11px] italic">{r.instansi_kerja || '-'}</Text>
                    <div className="mt-2 text-[10px] text-gray-400">
                        📍 {r.alamat_domisili || 'Lokasi tidak diisi'}
                    </div>
                </div>
            )
        },
        {
            title: "Tgl Daftar",
            dataIndex: "created_at",
            width: 150,
            render: (val) => (
                <div className="flex flex-col">
                    <Text className="text-xs">{dayjs(val as string).format("DD MMM YYYY")}</Text>
                    <Text type="secondary" style={{ fontSize: 10 }}>{formatHijri(val as string)}</Text>
                </div>
            )
        },
        {
            title: "Verifikasi",
            dataIndex: ["profiles", "is_active"],
            width: 120,
            render: (val, r) => (
                val ? <Tag color="success" icon={<CheckCircleOutlined />}>Verified</Tag> 
                    : <Tag color="warning">Pending</Tag>
            )
        },
        {
            title: "Aksi",
            valueType: "option",
            width: 150,
            fixed: "right",
            render: (_, record) => [
                record.profiles?.is_active ? (
                    <Button 
                        key="ban" 
                        size="small" 
                        danger 
                        ghost 
                        icon={<StopOutlined />} 
                        onClick={() => handleDeactivate(record.id)}
                    >
                        Suspend
                    </Button>
                ) : (
                    <Button 
                        key="verify" 
                        size="small" 
                        type="primary" 
                        className="bg-emerald-600"
                        icon={<CheckCircleOutlined />} 
                        onClick={() => handleVerify(record.id, record.full_name)}
                    >
                        Verify
                    </Button>
                )
            ]
        }
    ];

    return (
        <div className="space-y-4">
            <div className="bg-white dark:bg-[#141414] p-2 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
                <Tabs 
                    activeKey={activeTab} 
                    onChange={(key) => {
                        setActiveTab(key);
                        setFilters([
                            { field: "profiles.is_active", operator: "eq", value: key === "active" }
                        ]);
                    }}
                    className="px-4"
                    items={[
                        { label: "Menunggu Verifikasi", key: "pending" },
                        { label: "Alumni Aktif", key: "active" },
                    ]}
                />
            </div>

            <ProTable<IAlumniData>
                {...tableProps}
                columns={columns}
                rowKey="id"
                headerTitle={
                    <Space>
                        <GlobalOutlined className="text-blue-600 text-xl" />
                        <div className="flex flex-col">
                            <Text strong>Manajemen Alumni</Text>
                            <Text type="secondary" style={{ fontSize: 10 }}>Verifikasi pendaftaran anggota baru</Text>
                        </div>
                    </Space>
                }
                toolBarRender={() => [
                    <Button key="export" icon={<FileExcelOutlined />} onClick={exportExcel}>Export Database</Button>
                ]}
                search={false}
                pagination={{ defaultPageSize: 10 }}
                className="bg-white dark:bg-[#141414] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800"
            />
        </div>
    );
};
