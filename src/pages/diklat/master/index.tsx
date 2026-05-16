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
import { useUpdate } from "@refinedev/core";
import { supabaseClient } from "../../../utility/supabaseClient";
import { IConfigDiklat, IMasterKitab } from "../../../types";
import { useColorMode } from "../../../contexts/color-mode";

const { Title, Text } = Typography;
const { useToken } = theme;

const toNumberOrNull = (value: number | string | null | undefined) => {
    if (value === "" || value === null || value === undefined) return null;
    return Number(value);
};

const getTotalPutra = (record: Partial<IConfigDiklat>) =>
    Number(record.uang_miftah || 0) +
    Number(record.biaya_listrik || 0) +
    Number(record.kos_makan || 0) +
    Number(record.tafaruqon || 0);

const getTotalPutri = (record: Partial<IConfigDiklat>) =>
    Number(record.uang_miftah_putri ?? record.uang_miftah ?? 0) +
    Number(record.biaya_listrik_putri ?? record.biaya_listrik ?? 0) +
    Number(record.kos_makan_putri ?? record.kos_makan ?? 0) +
    Number(record.tafaruqon_putri ?? record.tafaruqon ?? 0);

const formatNumber = (value: number) => new Intl.NumberFormat("id-ID").format(value);

export const MasterDataPage = () => {
    const { token } = useToken();
    const { mode } = useColorMode();
    const { mutateAsync: updateMutate } = useUpdate();

    const [allConfig, setAllConfig] = useState<IConfigDiklat[]>([]);
    const [configLoading, setConfigLoading] = useState(false);
    const [allKitab, setAllKitab] = useState<IMasterKitab[]>([]);
    const [kitabLoading, setKitabLoading] = useState(false);

    const fetchConfigManual = async () => {
        setConfigLoading(true);
        try {
            const { data, error } = await supabaseClient
                .from("config_diklat")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            setAllConfig((data || []) as IConfigDiklat[]);
        } catch (e: unknown) {
            const err = e as Error;
            console.error("Fetch Config Diklat Error:", err);
            message.error("Gagal memuat konfigurasi Diklat: " + (err.message || "Terjadi kesalahan"));
        } finally {
            setConfigLoading(false);
        }
    };

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
        fetchConfigManual();
        fetchKitabManual();
    }, []);

    const handleToggleActive = async (id: number, currentStatus: boolean) => {
        const nextStatus = !currentStatus;
        const hide = message.loading("Memperbarui status...", 0);
        
        try {
            // 1. Jika kita mengaktifkan (nextStatus = true), matikan yang lain dulu
            if (nextStatus === true) {
                const { error: deactivateError } = await supabaseClient
                    .from("config_diklat")
                    .update({ is_active: false })
                    .neq("id", id);
                
                if (deactivateError) throw deactivateError;
            }

            // 2. Update baris yang dipilih menggunakan ID asli (integer)
            const { error: updateError } = await supabaseClient
                .from("config_diklat")
                .update({ is_active: nextStatus })
                .eq("id", id);

            if (updateError) throw updateError;
            
            message.success(`Konfigurasi tahun ${nextStatus ? 'diaktifkan' : 'dinonaktifkan'}`);
            
            // 3. Refresh data tabel
            await fetchConfigManual();
        } catch (e: unknown) {
            const err = e as any;
            console.error("Update Status Error:", err);
            message.error("Gagal memperbarui database: " + (err.message || "Terjadi kesalahan"));
        } finally {
            hide();
        }
    };

    const configColumns: ProColumns<IConfigDiklat>[] = [
        { title: "Tahun Hijriah", dataIndex: "tahun_hijriah", valueType: "digit", fixed: "left", width: 130, formItemProps: { rules: [{ required: true }] } },
        { title: "Periode", dataIndex: "periode", valueType: "digit", width: 100 },
        { title: "Miftah Putra", dataIndex: "uang_miftah", valueType: "money", width: 150 },
        { title: "Listrik Putra", dataIndex: "biaya_listrik", valueType: "money", width: 150 },
        { title: "Kos Makan Putra", dataIndex: "kos_makan", valueType: "money", width: 165 },
        { title: "Tafaruqon Putra", dataIndex: "tafaruqon", valueType: "money", width: 155 },
        {
            title: "Total Putra",
            editable: false,
            width: 145,
            render: (_, record) => <Text strong>{formatNumber(getTotalPutra(record))}</Text>,
        },
        { title: "Miftah Putri", dataIndex: "uang_miftah_putri", valueType: "money", width: 150 },
        { title: "Listrik Putri", dataIndex: "biaya_listrik_putri", valueType: "money", width: 150 },
        { title: "Kos Makan Putri", dataIndex: "kos_makan_putri", valueType: "money", width: 165 },
        { title: "Tafaruqon Putri", dataIndex: "tafaruqon_putri", valueType: "money", width: 155 },
        {
            title: "Total Putri",
            editable: false,
            width: 145,
            render: (_, record) => (
                <div>
                    <Text strong>{formatNumber(getTotalPutri(record))}</Text>
                    {[
                        record.uang_miftah_putri,
                        record.biaya_listrik_putri,
                        record.kos_makan_putri,
                        record.tafaruqon_putri
                    ].some((value) => value === null || value === undefined) && (
                        <div><Text type="secondary" style={{ fontSize: 11 }}>fallback putra</Text></div>
                    )}
                </div>
            ),
        },
        {
            title: "Status",
            dataIndex: "is_active",
            editable: false,
            width: 130,
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
            width: 140,
            render: (_text, record, _index, action) => [
                <a key="edit" style={{ color: mode === 'dark' ? '#ffb700' : '#065f46' }} onClick={() => action?.startEditable?.(record.id)}>Sunting</a>,
                <Popconfirm 
                    key="delete"
                    title="Hapus konfigurasi ini?" 
                    onConfirm={async () => {
                        const { error } = await supabaseClient
                            .from("config_diklat")
                            .delete()
                            .eq("id", record.id);

                        if (error) {
                            message.error("Gagal menghapus konfigurasi: " + error.message);
                            return;
                        }

                        message.success("Konfigurasi dihapus");
                        await fetchConfigManual();
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
                    { title: "Nama Kitab", dataIndex: "nama_kitab", width: 220, formItemProps: { rules: [{ required: true }] }, render: (val) => <Text strong>{val}</Text> },
                    { title: "Harga Jual", dataIndex: "harga", valueType: "money", width: 150 },
                    {
                        title: "Gender",
                        dataIndex: "jenis_kelamin",
                        valueType: "select",
                        width: 135,
                        valueEnum: {
                            ALL: { text: "Semua" },
                            L: { text: "Putra" },
                            P: { text: "Putri" },
                        },
                        render: (_, record) => {
                            const value = record.jenis_kelamin || "ALL";
                            const color = value === "P" ? "magenta" : value === "L" ? "blue" : "default";
                            const label = value === "P" ? "PUTRI" : value === "L" ? "PUTRA" : "SEMUA";
                            return <Tag color={color} style={{ borderRadius: 4, fontWeight: 700 }}>{label}</Tag>;
                        }
                    },
                    {
                        title: "Kategori",
                        dataIndex: "kategori",
                        valueType: "select",
                        width: 160,
                        valueEnum: {
                            KITAB: { text: "Kitab" },
                            PERLENGKAPAN: { text: "Perlengkapan" },
                            BUKU: { text: "Buku" },
                        },
                    },
                    {
                        title: "Wajib",
                        dataIndex: "is_wajib",
                        valueType: "switch",
                        width: 110,
                        render: (val) => (
                            <Tag color={val ? "processing" : "default"} style={{ borderRadius: 4, fontWeight: 700 }}>
                                {val ? "WAJIB" : "OPSIONAL"}
                            </Tag>
                        )
                    },
                    { 
                        title: "Status", 
                        dataIndex: "is_active", 
                        valueType: "switch",
                        width: 120,
                        render: (val) => (
                            <Tag color={val ? "success" : "default"} style={{ borderRadius: '4px', fontWeight: 700 }}>
                                {val ? "AKTIF" : "NONAKTIF"}
                            </Tag>
                        )
                    },
                    {
                        title: "Aksi",
                        valueType: "option",
                        width: 120,
                        render: (_text, record, _index, action) => [
                            <Button type="link" key="edit" style={{ padding: 0, color: mode === 'dark' ? '#ffb700' : '#065f46' }} onClick={() => action?.startEditable?.(record.id)}>Sunting</Button>,
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
                            nama_kitab: row.nama_kitab,
                            harga: row.harga,
                            jenis_kelamin: row.jenis_kelamin || "ALL",
                            kategori: row.kategori || "KITAB",
                            is_wajib: !!row.is_wajib,
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
                                        value={allConfig}
                                        onChange={(data) => setAllConfig(data as IConfigDiklat[])}
                                        loading={configLoading}
                                        columns={configColumns}
                                        search={false}
                                        options={false}
                                        scroll={{ x: 1750 }}
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
                                                tafaruqon: 0,
                                                uang_miftah_putri: null,
                                                biaya_listrik_putri: null,
                                                kos_makan_putri: null,
                                                tafaruqon_putri: null
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
                                                    uang_miftah_putri: toNumberOrNull(row.uang_miftah_putri),
                                                    biaya_listrik_putri: toNumberOrNull(row.biaya_listrik_putri),
                                                    kos_makan_putri: toNumberOrNull(row.kos_makan_putri),
                                                    tafaruqon_putri: toNumberOrNull(row.tafaruqon_putri),
                                                    is_active: row.is_active
                                                };
                                                
                                                try {
                                                    const numericKey = Number(key);
                                                    const isNewRecord = numericKey >= 10000 && !row.created_at;

                                                    if (isNewRecord) { 
                                                        const { error } = await supabaseClient
                                                            .from("config_diklat")
                                                            .insert(cleanValues);

                                                        if (error) throw error;
                                                        message.success("Konfigurasi baru ditambahkan");
                                                    } else {
                                                        const { error } = await supabaseClient
                                                            .from("config_diklat")
                                                            .update(cleanValues)
                                                            .eq("id", numericKey);

                                                        if (error) throw error;
                                                        message.success("Konfigurasi diperbarui");
                                                    }
                                                    await fetchConfigManual();
                                                } catch (e: unknown) {
                                                    const err = e as Error;
                                                    message.error("Gagal menyimpan: " + err.message);
                                                }
                                            },
                                        }}
                                    />
                                    <Text type="secondary" style={{ display: "block", marginTop: 12 }}>
                                        Jika salah satu biaya putri dikosongkan, sistem pendaftaran memakai nilai putra untuk komponen tersebut.
                                    </Text>
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
