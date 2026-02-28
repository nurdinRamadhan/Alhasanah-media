import React from "react";
import { useNavigation } from "@refinedev/core";
import { useTable } from "@refinedev/antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import { 
    Tag, 
    Button, 
    Typography, 
    Avatar, 
    Space, 
    Popconfirm, 
    message, 
    Tooltip 
} from "antd";
import { 
    UserOutlined, 
    DeleteOutlined, 
    SafetyCertificateOutlined,
    ManOutlined,
    WomanOutlined,
    BookOutlined,
    ReadOutlined,
    UserAddOutlined,
    CheckCircleFilled
} from "@ant-design/icons";
import { supabaseClient } from "../../utility/supabaseClient";
import dayjs from "dayjs";
import { IProfile } from "../../types";

const { Text, Title } = Typography;

export const AdminList = () => {
    const { push } = useNavigation();
    
    // 1. Fetch Data dari tabel profiles
    const { tableProps, tableQueryResult } = useTable<IProfile, any>({
        resource: "profiles",
        syncWithLocation: true,
        sorters: { initial: [{ field: "created_at", order: "desc" }] },
        pagination: { pageSize: 10 }
    });

    // 2. Handle Delete User via Edge Function
    const handleDelete = async (userId: string) => {
        try {
            message.loading({ content: "Menghapus akses...", key: "deleteUser" });
            
            const { data, error } = await supabaseClient.functions.invoke('delete-admin-account', {
                body: { user_id: userId }
            });

            if (error || (data && !data.success)) {
                throw new Error(error?.message || "Gagal menghapus user");
            }

            message.success({ content: "User berhasil dihapus permanen", key: "deleteUser" });
            tableQueryResult.refetch(); // Refresh tabel
        } catch (err: any) {
            message.error({ content: err.message, key: "deleteUser" });
        }
    };

    // 3. Definisi Kolom
    const columns: ProColumns<IProfile>[] = [
        {
            title: '#',
            valueType: 'index',
            width: 48,
            align: 'center',
        },
        {
            title: "Pengguna",
            dataIndex: "full_name",
            width: 250,
            render: (_, record) => (
                <div className="flex items-center gap-3">
                    <Avatar 
                        size={40} 
                        src={record.foto_url} 
                        icon={<UserOutlined />}
                        className="bg-blue-50 text-blue-500 border border-blue-100"
                    />
                    <div className="flex flex-col">
                        <Text strong className="text-gray-800 dark:text-gray-200">
                            {record.full_name || "Tanpa Nama"}
                        </Text>
                        <Text type="secondary" className="text-xs">
                            {record.email || "No Email"}
                        </Text>
                    </div>
                </div>
            )
        },
        {
            title: "Jabatan (Role)",
            dataIndex: "role",
            width: 150,
            valueEnum: {
                super_admin: { text: 'Super Admin', status: 'Error' },
                rois: { text: 'Rois', status: 'Processing' },
                bendahara: { text: 'Bendahara', status: 'Warning' },
                kesantrian: { text: 'Kesantrian', status: 'Success' },
                dewan: { text: 'Dewan', status: 'Default' },
            },
            render: (_, record) => {
                const colors: Record<string, string> = {
                    super_admin: "volcano",
                    rois: "geekblue",
                    bendahara: "gold",
                    kesantrian: "cyan",
                    dewan: "green"
                };
                return (
                    <Tag color={colors[record.role]} className="uppercase font-semibold border-0 px-3 py-1 rounded-full">
                        {record.role.replace('_', ' ')}
                    </Tag>
                );
            }
        },
        {
            title: "Lingkup Akses",
            key: "scope",
            width: 200,
            render: (_, record) => (
                <Space direction="vertical" size={2}>
                    {/* Akses Gender */}
                    <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-400 w-12">Gender:</span>
                        {record.akses_gender === 'ALL' && <Tag bordered={false}>L & P</Tag>}
                        {record.akses_gender === 'L' && <Tag color="blue" icon={<ManOutlined />}>Putra</Tag>}
                        {record.akses_gender === 'P' && <Tag color="magenta" icon={<WomanOutlined />}>Putri</Tag>}
                    </div>
                    {/* Akses Jurusan */}
                    <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-400 w-12">Jurusan:</span>
                        {record.akses_jurusan === 'ALL' && <Tag bordered={false}>Semua</Tag>}
                        {record.akses_jurusan === 'TAHFIDZ' && <Tag color="purple" icon={<ReadOutlined />}>Tahfidz</Tag>}
                        {record.akses_jurusan === 'KITAB' && <Tag color="orange" icon={<BookOutlined />}>Kitab</Tag>}
                    </div>
                </Space>
            )
        },
        {
            title: "Status",
            dataIndex: "is_active",
            width: 100,
            render: (_, record) => (
                record.is_active ? 
                <Tag icon={<CheckCircleFilled />} color="success">Aktif</Tag> : 
                <Tag color="default">Non-Aktif</Tag>
            )
        },
        {
            title: "Bergabung",
            dataIndex: "created_at",
            valueType: "date",
            width: 120,
            render: (_, r: any) => <Text type="secondary" className="text-xs">{dayjs(r.created_at || new Date()).format("DD MMM YYYY")}</Text>
        },
        {
            title: "Aksi",
            valueType: "option",
            fixed: "right",
            width: 80,
            render: (_, record) => (
                record.role === 'super_admin' ? null : ( // Super Admin tidak bisa delete diri sendiri/sesama disini (opsional logic)
                    <Popconfirm
                        title="Hapus Akun Pengurus?"
                        description={`Anda yakin ingin menghapus akses ${record.full_name}?`}
                        onConfirm={() => handleDelete(record.id)}
                        okText="Ya, Hapus"
                        cancelText="Batal"
                        okButtonProps={{ danger: true }}
                    >
                        <Tooltip title="Hapus Akses Permanen">
                            <Button 
                                type="text" 
                                danger 
                                icon={<DeleteOutlined />} 
                            />
                        </Tooltip>
                    </Popconfirm>
                )
            )
        }
    ];

    return (
        <ProTable<IProfile>
            {...tableProps}
            columns={columns}
            rowKey="id"
            headerTitle={
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-100">
                        <SafetyCertificateOutlined className="text-indigo-600 text-xl" />
                    </div>
                    <div>
                        <Title level={4} style={{ margin: 0 }}>Manajemen Admin</Title>
                        <Text type="secondary" style={{ fontSize: 12 }}>Atur hak akses pengurus (RBAC)</Text>
                    </div>
                </div>
            }
            toolBarRender={() => [
                <Button 
                    key="create" 
                    type="primary" 
                    icon={<UserAddOutlined />} 
                    onClick={() => push("/admin-management/create")}
                    size="middle"
                    className="bg-indigo-600 hover:bg-indigo-500 shadow-sm"
                >
                    Tambah Admin Baru
                </Button>
            ]}
            options={{ density: false, fullScreen: true, reload: true, setting: true }}
            pagination={{
                showSizeChanger: true,
                defaultPageSize: 10
            }}
            search={{
                labelWidth: 'auto',
                filterType: 'light',
            }}
            cardBordered={false}
            className="bg-white dark:bg-[#141414] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800"
        />
    );
};