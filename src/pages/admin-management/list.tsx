import React from "react";
import { useNavigation, useGetIdentity } from "@refinedev/core";
import { useTable } from "@refinedev/antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import { 
    Tag, 
    Button, 
    Typography, 
    Avatar, 
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
    UserAddOutlined
} from "@ant-design/icons";
import { supabaseClient } from "../../utility/supabaseClient";
import { logActivity } from "../../utility/logger";
import { IProfile, IUserIdentity } from "../../types";

const { Text, Title } = Typography;

export const AdminList = () => {
    const { push } = useNavigation();
    const { data: user } = useGetIdentity<IUserIdentity>();
    
    // 1. Fetch Data dari tabel profiles
    const { tableProps, tableQueryResult, setFilters } = useTable<IProfile>({
        resource: "profiles",
        syncWithLocation: true,
        sorters: { initial: [{ field: "created_at", order: "desc" }] },
        pagination: { pageSize: 10 }
    });

    // 2. Handle Delete User via Edge Function
    const handleDelete = async (record: IProfile) => {
        try {
            message.loading({ content: "Menghapus akses...", key: "deleteUser" });
            
            const { data, error } = await supabaseClient.functions.invoke('delete-admin-account', {
                body: { user_id: record.id }
            });

            if (error || (data && !data.success)) {
                throw new Error(error?.message || "Gagal menghapus user");
            }

            // CATAT LOG AKTIVITAS
            await logActivity({
                user,
                action: 'DELETE',
                resource: 'profiles',
                record_id: record.id,
                details: { 
                    deleted_user_name: record.full_name,
                    deleted_user_email: record.email,
                    deleted_user_role: record.role
                }
            });

            message.success({ content: "User berhasil dihapus permanen", key: "deleteUser" });
            tableQueryResult.refetch(); // Refresh tabel
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "Terjadi kesalahan yang tidak diketahui";
            message.error({ content: errorMessage, key: "deleteUser" });
        }
    };

    // 3. Definisi Kolom
    const columns: ProColumns<IProfile>[] = [
        {
            title: '#',
            valueType: 'index',
            width: 48,
            align: 'center',
            hideInSearch: true,
        },
        {
            title: "Pengguna",
            dataIndex: "full_name",
            width: 280,
            render: (_, record) => (
                <div className="flex items-center gap-4 py-1">
                    <Avatar 
                        size={44} 
                        src={record.foto_url} 
                        icon={<UserOutlined />}
                        className="bg-indigo-50 text-indigo-500 border-2 border-white dark:border-gray-800 shadow-sm shrink-0"
                    />
                    <div className="flex flex-col leading-tight overflow-hidden">
                        <Text strong className="text-gray-900 dark:text-gray-100 truncate block mb-0.5">
                            {record.full_name || "Tanpa Nama"}
                        </Text>
                        <Text type="secondary" className="text-[11px] opacity-70 truncate block">
                            {record.email || "No Email"}
                        </Text>
                    </div>
                </div>
            ),
            // Memungkinkan pencarian berdasarkan nama
            fieldProps: {
                placeholder: "Cari nama admin...",
            }
        },
        {
            title: "Jabatan",
            dataIndex: "role",
            width: 140,
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
                    <Tag 
                        color={colors[record.role]} 
                        className="font-bold border-0 px-3 py-0.5 rounded-md shadow-sm"
                        style={{ fontSize: '10px', letterSpacing: '0.5px', textTransform: 'uppercase' }}
                    >
                        {record.role.replace('_', ' ')}
                    </Tag>
                );
            }
        },
        {
            title: "Akses Gender",
            dataIndex: "akses_gender",
            width: 120,
            valueEnum: {
                ALL: { text: 'Semua (L & P)' },
                L: { text: 'Putra Only' },
                P: { text: 'Putri Only' },
            },
            render: (_, record) => {
                if (record.akses_gender === 'ALL') return <Tag bordered={false} className="dark:bg-gray-800 dark:text-gray-300">Semua</Tag>;
                return record.akses_gender === 'L' ? 
                    <Tag color="blue" icon={<ManOutlined />} className="rounded-md">Putra</Tag> : 
                    <Tag color="magenta" icon={<WomanOutlined />} className="rounded-md">Putri</Tag>;
            }
        },
        {
            title: "Akses takhasus",
            dataIndex: "akses_jurusan",
            width: 120,
            valueEnum: {
                ALL: { text: 'Semua Takhasus' },
                TAHFIDZ: { text: 'Tahfidz' },
                KITAB: { text: 'Kitab' },
            },
            render: (_, record) => {
                if (record.akses_jurusan === 'ALL') return <Tag bordered={false} className="dark:bg-gray-800 dark:text-gray-300">Semua</Tag>;
                return record.akses_jurusan === 'TAHFIDZ' ? 
                    <Tag color="purple" icon={<ReadOutlined />} className="rounded-md">Tahfidz</Tag> : 
                    <Tag color="orange" icon={<BookOutlined />} className="rounded-md">Kitab</Tag>;
            }
        },
        {
            title: "Status",
            dataIndex: "is_active",
            width: 100,
            valueEnum: {
                true: { text: 'Aktif', status: 'Success' },
                false: { text: 'Non-Aktif', status: 'Default' },
            },
            render: (_, record) => (
                <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${record.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                    <span className={`text-xs font-medium ${record.is_active ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}>
                        {record.is_active ? 'AKTIF' : 'NON-AKTIF'}
                    </span>
                </div>
            )
        },
        {
            title: "Aksi",
            valueType: "option",
            fixed: "right",
            width: 60,
            render: (_, record) => (
                record.role === 'super_admin' ? null : (
                    <Popconfirm
                        title="Hapus Akun Pengurus?"
                        description={`Anda yakin ingin menghapus akses ${record.full_name}?`}
                        onConfirm={() => handleDelete(record)}
                        okText="Ya, Hapus"
                        cancelText="Batal"
                        okButtonProps={{ danger: true }}
                    >
                        <Tooltip title="Hapus Akses Permanen">
                            <Button 
                                type="text" 
                                danger 
                                icon={<DeleteOutlined className="text-lg" />} 
                                className="hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
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
            // Sinkronisasi Filter ProTable ke Refine
            onSubmit={(params) => {
                const filters: Array<{ field: string; operator: "contains" | "eq"; value: string | boolean }> = [];
                if (params.full_name) {
                    filters.push({ field: "full_name", operator: "contains" as const, value: params.full_name });
                }
                if (params.role) {
                    filters.push({ field: "role", operator: "eq" as const, value: params.role });
                }
                if (params.akses_gender) {
                    filters.push({ field: "akses_gender", operator: "eq" as const, value: params.akses_gender });
                }
                if (params.akses_jurusan) {
                    filters.push({ field: "akses_jurusan", operator: "eq" as const, value: params.akses_jurusan });
                }
                if (params.is_active !== undefined) {
                    filters.push({ field: "is_active", operator: "eq" as const, value: params.is_active === 'true' });
                }
                setFilters(filters);
            }}
            onReset={() => setFilters([])}
            headerTitle={
                <div className="flex items-center gap-4 py-2">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none">
                        <SafetyCertificateOutlined className="text-white text-2xl" />
                    </div>
                    <div>
                        <Title level={4} style={{ margin: 0, letterSpacing: '-0.5px' }} className="dark:text-white">
                            Manajemen Admin
                        </Title>
                        <Text type="secondary" className="text-xs opacity-80">
                            Kelola hak akses dan kontrol profil pengurus sistem
                        </Text>
                    </div>
                </div>
            }
            toolBarRender={() => [
                <Button 
                    key="create" 
                    type="primary" 
                    icon={<UserAddOutlined />} 
                    onClick={() => push("/admin-management/create")}
                    size="large"
                    className="bg-indigo-600 hover:bg-indigo-500 shadow-md hover:shadow-indigo-200 dark:shadow-none border-0 h-11 px-6 rounded-xl font-semibold"
                >
                    Tambah Admin
                </Button>
            ]}
            options={{ 
                density: false, 
                fullScreen: true, 
                reload: true, 
                setting: true,
                search: false // Matikan search default ProTable karena kita pakai kolom filter
            }}
            pagination={{
                showSizeChanger: true,
                defaultPageSize: 10,
                className: "px-4"
            }}
            search={{
                labelWidth: 'auto',
                filterType: 'query', // Ubah ke query untuk tampilan lebih profesional
                className: "bg-gray-50/50 dark:bg-gray-900/50 p-6 rounded-xl border-b border-gray-100 dark:border-gray-800",
                span: 6,
                defaultCollapsed: false,
                collapseRender: false,
            }}
            cardBordered={false}
            className="admin-list-table overflow-hidden bg-white dark:bg-[#0d0d0d] rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800"
            tableClassName="dark:bg-[#0d0d0d]"
        />
    );
};