import React, { useState, useEffect } from "react";
import { 
    ProColumns, 
    EditableProTable 
} from "@ant-design/pro-components";
import { 
    Tabs, 
    Typography, 
    Tag, 
    Switch, 
    message, 
    Popconfirm,
    Spin,
    Empty,
    theme,
    Card,
    Space,
    Button
} from "antd";
import { 
    SettingOutlined, 
    BookOutlined,
} from "@ant-design/icons";
import { useTable } from "@refinedev/antd";
import { useUpdate, useDelete, useCreate } from "@refinedev/core";
import { supabaseClient } from "../../../utility/supabaseClient";
import { IConfigDiklat, IMasterKitab } from "../../../types";
import { useColorMode } from "../../../contexts/color-mode";

const { Title, Text } = Typography;
const { useToken } = theme;

export const MasterDataPage = () => {
    const { token } = useToken();
    const { mode } = useColorMode();
    const { mutateAsync: updateMutate } = useUpdate();
    const { mutateAsync: deleteMutate } = useDelete();
    const { mutateAsync: createMutate } = useCreate();

    const [allKitab, setAllKitab] = useState<IMasterKitab[]>([]);
    const [kitabLoading, setKitabLoading] = useState(false);

    // 1. CONFIG DIKLAT TABLE
    const { tableProps: configProps, tableQueryResult: configResult } = useTable<IConfigDiklat>({
        resource: "config_diklat",
        syncWithLocation: false,
        sorters: { initial: [{ field: "created_at", order: "desc" }] }
    });

    const fetchKitabManual = async () => {
        setAllKitab([]);
        setKitabLoading(true);
        try {
            const { data, error } = await supabaseClient
                .from("master_kitab")
                .select("*")
                .order("id", { ascending: true });
            
            if (error) throw error;
            setAllKitab(data || []);
        } catch (e: unknown) {
            console.error("Fetch Kitab Error:", e);
        } finally {
            setKitabLoading(false);
        }
    };

    useEffect(() => {
        fetchKitabManual();
    }, []);

    const handleToggleActive = async (id: number, currentStatus: boolean) => {
        const hide = message.loading("Memperbarui status...", 0);
        try {
            if (!currentStatus) {
                // Jika ingin mengaktifkan satu, matikan yang lain di database
                await supabaseClient
                    .from("config_diklat")
                    .update({ is_active: false })
                    .neq("id", id);
            }

            await updateMutate({
                resource: "config_diklat",
                id: id.toString(),
                values: { is_active: !currentStatus }
            });
            
            message.success("Status konfigurasi diperbarui");
            await configResult.refetch();
        } catch (e: unknown) {
            const err = e as Error;
            message.error("Gagal: " + err.message);
        } finally {
            hide();
        }
    };

    const configColumns: ProColumns<IConfigDiklat>[] = [
        { title: "Tahun Hijriah", dataIndex: "tahun_hijriah", valueType: "digit", formItemProps: { rules: [{ required: true }] } },
        { title: "Periode", dataIndex: "periode", valueType: "digit" },
        { title: "Uang Miftah", dataIndex: "uang_miftah", valueType: "money" },
        { title: "Listrik", dataIndex: "biaya_listrik", valueType: "money" },
        { title: "Kos Makan", dataIndex: "kos_makan", valueType: "money" },
        { title: "Tafaruqon", dataIndex: "tafaruqon", valueType: "money" },
        {
            title: "Status",
            dataIndex: "is_active",
            editable: false,
            render: (val, record) => (
                <Switch 
                    checked={!!val} 
                    onChange={() => handleToggleActive(record.id, !!val)}
                    checkedChildren="Aktif"
                    unCheckedChildren="Nonaktif"
                    style={{ backgroundColor: val ? (mode === 'dark' ? '#ffb700' : '#065f46') : undefined }}
                />
            )
        },
        {
            title: "Aksi",
            valueType: "option",
            render: (_text, record, _index, action) => [
                <a key="edit" style={{ color: mode === 'dark' ? '#ffb700' : '#065f46' }} onClick={() => action?.startEditable?.(record.id)}>Sunting</a>,
                <Popconfirm 
                    key="delete"
                    title="Hapus konfigurasi ini?" 
                    onConfirm={async () => {
                        await deleteMutate({ resource: "config_diklat", id: record.id.toString() });
                        await configResult.refetch();
                    }}
                >
                    <a className="text-red-500">Hapus</a>
                </Popconfirm>
            ]
        }
    ];

    const renderKitabTable = (jenis: string) => {
        const dataSource = allKitab.filter(k => k.jenis_diklat === jenis);
        
        if (dataSource.length === 0 && !kitabLoading) {
            return (
                <div style={{ padding: '40px', textAlign: 'center', backgroundColor: mode === 'dark' ? '#000' : '#f9fafb', borderRadius: '12px', border: '1px dashed rgba(128,128,128,0.2)' }}>
                    <Empty description={`Tidak ada data kitab ${jenis}`} />
                </div>
            );
        }

        return (
            <EditableProTable<IMasterKitab>
                rowKey="id"
                headerTitle={`Daftar Kitab ${jenis}`}
                columns={[
                    { title: "Nama Kitab", dataIndex: "nama_kitab", editable: false, width: "40%", render: (val) => <Text strong>{val}</Text> },
                    { title: "Harga Jual", dataIndex: "harga", valueType: "money", width: "30%" },
                    { 
                        title: "Status", 
                        dataIndex: "is_active", 
                        valueType: "switch",
                        render: (val) => (
                            <Tag color={val ? "success" : "default"} style={{ borderRadius: '4px', fontWeight: 700 }}>
                                {val ? "AKTIF" : "NONAKTIF"}
                            </Tag>
                        )
                    },
                    {
                        title: "Aksi",
                        valueType: "option",
                        render: (_text, record, _index, action) => [
                            <Button type="link" key="edit" style={{ padding: 0, color: mode === 'dark' ? '#ffb700' : '#065f46' }} onClick={() => action?.startEditable?.(record.id)}>Ubah Harga</Button>,
                        ]
                    }
                ]}
                value={dataSource}
                loading={kitabLoading}
                search={false}
                options={false}
                recordCreatorProps={false} 
                editable={{
                    type: "multiple",
                    onSave: async (key, row) => {
                        const cleanValues: Partial<IMasterKitab> = {
                            harga: row.harga,
                            is_active: row.is_active
                        };
                        await updateMutate({ 
                            resource: "master_kitab", 
                            id: key.toString(), 
                            values: cleanValues 
                        });
                        await fetchKitabManual();
                        message.success("Harga kitab diperbarui");
                    },
                }}
            />
        );
    };

    return (
        <div style={{ background: token.colorBgBase, minHeight: '100vh', padding: '24px' }}>
            <div className="mb-8 flex items-center gap-4">
                <div style={{ 
                    background: mode === 'dark' ? '#000' : '#065f46', 
                    padding: '12px', 
                    borderRadius: '12px',
                    boxShadow: mode === 'dark' ? '0 0 20px rgba(255, 183, 0, 0.2)' : 'none',
                    border: mode === 'dark' ? '1px solid #ffb70040' : 'none'
                }}>
                    <SettingOutlined style={{ fontSize: '24px', color: mode === 'dark' ? '#ffb700' : '#fff' }} />
                </div>
                <div>
                    <Title level={3} style={{ margin: 0, fontWeight: 900, letterSpacing: '-0.02em' }}>Master Data Diklat</Title>
                    <Text type="secondary">Konfigurasi tahun, biaya operasional, dan katalog kitab koperasi.</Text>
                </div>
            </div>

            <Card 
                bordered={false} 
                className="glass-card" 
                style={{ borderRadius: '24px', overflow: 'hidden' }}
                bodyStyle={{ padding: '24px' }}
            >
                <Tabs
                    defaultActiveKey="1"
                    type="line"
                    size="large"
                    items={[
                        {
                            key: "1",
                            label: <Space><SettingOutlined /><span>Konfigurasi Biaya</span></Space>,
                            children: (
                                <div className="mt-4">
                                    <EditableProTable<IConfigDiklat>
                                        headerTitle="Pengaturan Tahun & Administrasi"
                                        rowKey="id"
                                        dataSource={configProps.dataSource}
                                        loading={configProps.loading}
                                        columns={configColumns}
                                        search={false}
                                        options={false}
                                        recordCreatorProps={{
                                            newRecordType: "dataSource",
                                            record: () => ({ 
                                                id: Math.floor(Math.random() * 9999) + 10000, 
                                                is_active: false,
                                                tahun_hijriah: 1447,
                                                periode: 1,
                                                uang_miftah: 0,
                                                biaya_listrik: 0,
                                                kos_makan: 0,
                                                tafaruqon: 0
                                            } as IConfigDiklat),
                                            creatorButtonText: "Tambah Konfigurasi Baru",
                                            style: { marginTop: '16px', borderRadius: '8px' }
                                        }}
                                        editable={{
                                            type: "multiple",
                                            onSave: async (key, row) => {
                                                const cleanValues: Partial<IConfigDiklat> = {
                                                    tahun_hijriah: row.tahun_hijriah,
                                                    periode: row.periode,
                                                    uang_miftah: row.uang_miftah,
                                                    biaya_listrik: row.biaya_listrik,
                                                    kos_makan: row.kos_makan,
                                                    tafaruqon: row.tafaruqon,
                                                    is_active: row.is_active
                                                };
                                                
                                                try {
                                                    if (typeof key === 'number' && key >= 10000) { 
                                                        await createMutate({ 
                                                            resource: "config_diklat", 
                                                            values: cleanValues 
                                                        });
                                                        message.success("Konfigurasi baru ditambahkan");
                                                    } else {
                                                        await updateMutate({ 
                                                            resource: "config_diklat", 
                                                            id: key.toString(), 
                                                            values: cleanValues 
                                                        });
                                                        message.success("Konfigurasi diperbarui");
                                                    }
                                                    await configResult.refetch();
                                                } catch (e: unknown) {
                                                    const err = e as Error;
                                                    message.error("Gagal menyimpan: " + err.message);
                                                }
                                            },
                                        }}
                                    />
                                </div>
                            )
                        },
                        {
                            key: "2",
                            label: <Space><BookOutlined /><span>Katalog Kitab</span></Space>,
                            children: (
                                <div style={{ 
                                    marginTop: '24px', 
                                    backgroundColor: mode === 'dark' ? '#050505' : '#f8fafc',
                                    padding: '24px',
                                    borderRadius: '16px',
                                    border: `1px solid ${mode === 'dark' ? 'rgba(255,183,0,0.1)' : 'rgba(0,0,0,0.05)'}`
                                }}>
                                    {kitabLoading ? (
                                        <div className="flex flex-col items-center justify-center p-20 gap-4">
                                            <Spin size="large" />
                                            <Text type="secondary">Sinkronisasi database...</Text>
                                        </div>
                                    ) : (
                                        <Tabs
                                            tabPosition="left"
                                            items={[
                                                { label: "Pasaran Maulid", key: "MAULID", children: renderKitabTable("MAULID") },
                                                { label: "Pasaran Syaban", key: "SYABAN", children: renderKitabTable("SYABAN") },
                                                { label: "Pasaran Ramadhan", key: "RAMADHAN", children: renderKitabTable("RAMADHAN") },
                                                { label: "Pasaran Dzulhijjah", key: "DZULHIJJAH", children: renderKitabTable("DZULHIJJAH") },
                                            ]}
                                        />
                                    )}
                                </div>
                            )
                        }
                    ]}
                />
            </Card>
        </div>
    );
};