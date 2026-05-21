import React from "react";
import { useTable, useSelect } from "@refinedev/antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import { 
    Tag, Space, Button, Typography, Avatar, Card, Row, Col, 
    Statistic, List, Skeleton, Modal, Form, Select, Input, 
    DatePicker, Divider, InputNumber, Tooltip
} from "antd";
import { 
    TrophyOutlined, 
    PlusOutlined, 
    UserOutlined, 
    BookOutlined, 
    FireOutlined,
    SafetyCertificateOutlined,
    LineChartOutlined,
    EditOutlined,
    LinkOutlined
} from "@ant-design/icons";
import { IPrestasiSantri, ISantri } from "../../types";
import { useCreate, useGetIdentity, useList, useUpdate } from "@refinedev/core";
import dayjs from "dayjs";
import { santriAlias } from "../../utility/privacy";
import { supabaseClient } from "../../utility/supabaseClient";

const { Text, Title } = Typography;

const PRESTASI_KATEGORI_OPTIONS = [
    { label: "Tahfidz", value: "TAHFIDZ", color: "gold" },
    { label: "Kitab", value: "KITAB", color: "blue" },
    { label: "Khatam", value: "KHATAM", color: "green" },
    { label: "Akademik", value: "AKADEMIK", color: "cyan" },
    { label: "Lomba", value: "LOMBA", color: "purple" },
    { label: "Akhlak", value: "AKHLAK", color: "lime" },
    { label: "Olahraga", value: "OLAHRAGA", color: "volcano" },
    { label: "Seni", value: "SENI", color: "magenta" },
    { label: "Umum", value: "UMUM", color: "geekblue" },
    { label: "Lainnya", value: "LAINNYA", color: "default" },
] as const;

const sensitivePattern =
    /(nik|kk|nis|wali|ayah|ibu|alamat|no hp|nomor hp|rekening|\b\d{10,}\b|https?:\/\/|www\.)/i;

const publicTextRules = (required = true) => [
    ...(required ? [{ required: true, message: "Wajib diisi" }] : []),
    {
        validator: (_: unknown, value?: string) => {
            if (value && sensitivePattern.test(value)) {
                return Promise.reject(
                    new Error("Teks publik tidak boleh memuat data sensitif.")
                );
            }
            return Promise.resolve();
        },
    },
];

type PrestasiFormValues = {
    santri_nis: string;
    kategori: IPrestasiSantri["kategori"];
    judul_prestasi: string;
    keterangan?: string;
    tanggal_prestasi: dayjs.Dayjs;
    poin_prestasi?: number;
    sertifikat_url?: string;
};

type TopTahfidzRow = Pick<ISantri, "nis" | "nama" | "kelas" | "jurusan" | "foto_url"> & {
    total_hafalan: number;
    last_setoran: string | null;
    setoran_count: number;
};

export const PrestasiList = () => {
    const { data: user } = useGetIdentity<{ id: string }>();
    const { mutate: createMutate } = useCreate();
    const { mutate: updateMutate } = useUpdate();
    
    // --- 1. DATA OTOMATIS: HALL OF FAME ---
    const [topTahfidz, setTopTahfidz] = React.useState<TopTahfidzRow[]>([]);
    const [loadingTahfidz, setLoadingTahfidz] = React.useState(true);

    React.useEffect(() => {
        let isMounted = true;

        const loadTopTahfidz = async () => {
            setLoadingTahfidz(true);
            const { data, error } = await supabaseClient.rpc("get_admin_top_tahfidz_santri", {
                p_limit: 10,
            });

            if (!isMounted) return;
            if (error) {
                console.error("Gagal memuat top tahfidz:", error);
                setTopTahfidz([]);
            } else {
                setTopTahfidz((data || []) as TopTahfidzRow[]);
            }
            setLoadingTahfidz(false);
        };

        loadTopTahfidz();

        return () => {
            isMounted = false;
        };
    }, []);

    // Mengambil santri dengan progres Kitab (untuk gambaran umum)
    const { data: topKitab, isLoading: loadingKitab } = useList<ISantri>({
        resource: "santri",
        pagination: { pageSize: 5 },
        filters: [
            { field: "hafalan_kitab", operator: "null", value: false },
            { field: "status_santri", operator: "eq", value: "AKTIF" }
        ]
    });

    // --- 2. DATA MANUAL: TABEL PRESTASI ---
    const { tableProps, tableQueryResult } = useTable<IPrestasiSantri>({
        resource: "prestasi_santri",
        syncWithLocation: true,
        meta: { select: "*, santri(nama, nis, kelas, jurusan, foto_url)" },
        sorters: { initial: [{ field: "tanggal_prestasi", order: "desc" }] }
    });

    // --- 3. MODAL LOGIC ---
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [editingRecord, setEditingRecord] = React.useState<IPrestasiSantri | null>(null);
    const [form] = Form.useForm();

    const { selectProps: santriSelectProps } = useSelect<ISantri>({
        resource: "santri",
        optionLabel: "nama",
        optionValue: "nis",
        meta: { select: "nama, nis, kelas, jurusan, status_santri" },
        filters: [{ field: "status_santri", operator: "eq", value: "AKTIF" }],
    });

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingRecord(null);
        form.resetFields();
    };

    const openCreateModal = () => {
        setEditingRecord(null);
        form.setFieldsValue({
            tanggal_prestasi: dayjs(),
            poin_prestasi: 0,
        });
        setIsModalOpen(true);
    };

    const openEditModal = (record: IPrestasiSantri) => {
        setEditingRecord(record);
        form.setFieldsValue({
            santri_nis: record.santri_nis,
            kategori: record.kategori,
            judul_prestasi: record.judul_prestasi,
            keterangan: record.keterangan ?? undefined,
            tanggal_prestasi: record.tanggal_prestasi ? dayjs(record.tanggal_prestasi) : dayjs(),
            poin_prestasi: record.poin_prestasi ?? 0,
            sertifikat_url: record.sertifikat_url ?? undefined,
        });
        setIsModalOpen(true);
    };

    const buildPayload = (values: PrestasiFormValues) => ({
        santri_nis: values.santri_nis,
        kategori: values.kategori,
        judul_prestasi: values.judul_prestasi.trim(),
        keterangan: values.keterangan?.trim() || null,
        tanggal_prestasi: values.tanggal_prestasi.format("YYYY-MM-DD"),
        poin_prestasi: values.poin_prestasi ?? 0,
        sertifikat_url: values.sertifikat_url?.trim() || null,
    });

    const handleSubmitPrestasi = (values: PrestasiFormValues) => {
        const payload = buildPayload(values);

        if (editingRecord) {
            updateMutate({
                resource: "prestasi_santri",
                id: editingRecord.id,
                values: payload,
                successNotification: {
                    message: "Prestasi berhasil diperbarui.",
                    type: "success"
                }
            }, {
                onSuccess: () => {
                    closeModal();
                    tableQueryResult.refetch();
                }
            });
            return;
        }

        createMutate({
            resource: "prestasi_santri",
            values: {
                ...payload,
                dicatat_oleh_id: user?.id ?? null,
            },
            successNotification: {
                message: "Prestasi berhasil dicatat.",
                type: "success"
            }
        }, {
            onSuccess: () => {
                closeModal();
                tableQueryResult.refetch();
            }
        });
    };

    const columns: ProColumns<IPrestasiSantri>[] = [
        {
            title: "Santri",
            dataIndex: "santri",
            hideInSearch: true,
            render: (_, record) => (
                <Space>
                    <Avatar src={record.santri?.foto_url} icon={<UserOutlined />} />
                    <div className="flex flex-col">
                        <Text strong>{record.santri?.nama || santriAlias(record.santri?.nis)}</Text>
                        <Text type="secondary" style={{ fontSize: 10 }}>
                            {record.santri?.kelas ? `Kelas ${record.santri.kelas}` : "Kelas -"} - {record.santri?.jurusan || "-"} - NIS {record.santri?.nis}
                        </Text>
                    </div>
                </Space>
            )
        },
        {
            title: "Kategori",
            dataIndex: "kategori",
            valueType: "select",
            fieldProps: {
                options: PRESTASI_KATEGORI_OPTIONS.map(({ label, value }) => ({ label, value })),
            },
            render: (val) => {
                const meta = PRESTASI_KATEGORI_OPTIONS.find((item) => item.value === val);
                return <Tag color={meta?.color || "default"}>{meta?.label || String(val)}</Tag>;
            }
        },
        {
            title: "Judul Prestasi",
            dataIndex: "judul_prestasi",
            ellipsis: true,
            render: (val) => <Text strong className="text-emerald-700">{val}</Text>
        },
        {
            title: "Tanggal",
            dataIndex: "tanggal_prestasi",
            valueType: "date",
            render: (val) => dayjs(val as string).format("DD MMM YYYY")
        },
        {
            title: "Poin",
            dataIndex: "poin_prestasi",
            width: 90,
            align: "right",
            search: false,
            render: (val) => <Text strong>{Number(val ?? 0)}</Text>
        },
        {
            title: "Keterangan",
            dataIndex: "keterangan",
            search: false,
            ellipsis: true
        },
        {
            title: "Sertifikat",
            dataIndex: "sertifikat_url",
            width: 120,
            search: false,
            render: (val) => val
                ? <Tag icon={<SafetyCertificateOutlined />} color="green">Ada</Tag>
                : <Tag color="default">Tidak Ada</Tag>
        },
        {
            title: "Aksi",
            valueType: "option",
            width: 90,
            render: (_, record) => [
                <Tooltip title="Edit prestasi" key="edit">
                    <Button
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => openEditModal(record)}
                    />
                </Tooltip>
            ]
        }
    ];

    return (
        <div className="space-y-6 pb-20">
            {/* --- HEADER --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <Title level={3} style={{ margin: 0 }}><TrophyOutlined className="text-amber-500" /> Prestasi & Hall of Fame</Title>
                    <Text type="secondary">Apresiasi untuk santri-santri terbaik Al-Hasanah</Text>
                </div>
                <Button 
                    type="primary" 
                    icon={<PlusOutlined />} 
                    onClick={openCreateModal}
                    className="bg-amber-500 hover:bg-amber-400 border-0"
                >
                    Catat Prestasi Manual
                </Button>
            </div>

            {/* --- ROW 1: HALL OF FAME (AUTOMATED) --- */}
            <Row gutter={[24, 24]}>
                <Col xs={24} lg={16}>
                    <Card 
                        title={<Space><FireOutlined className="text-orange-500" /><span>Top 10 Hafalan Al-Quran (Tahfidz)</span></Space>}
                        className="shadow-sm border-0"
                        bodyStyle={{ padding: 0 }}
                    >
                        <List
                            loading={loadingTahfidz}
                            dataSource={topTahfidz}
                            renderItem={(item, index) => (
                                <List.Item className="px-6 hover:bg-amber-50/50 transition-colors">
                                    <List.Item.Meta
                                        avatar={
                                            <Space size="middle">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${index < 3 ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                                    {index + 1}
                                                </div>
                                                <Avatar src={item.foto_url} icon={<UserOutlined />} />
                                            </Space>
                                        }
                                        title={<Text strong>{item.nama}</Text>}
                                        description={`Kelas ${item.kelas} - ${item.jurusan}`}
                                    />
                                    <div className="text-right">
                                        <div style={{ color: '#b45309', fontWeight: 800, fontSize: 18 }}>{Number(item.total_hafalan || 0)} <small>Juz</small></div>
                                        <Text type="secondary" style={{ fontSize: 10 }}>
                                            {item.last_setoran ? `Update ${dayjs(item.last_setoran).format("DD MMM YYYY")}` : "Capaian Akumulatif"}
                                        </Text>
                                    </div>
                                </List.Item>
                            )}
                        />
                    </Card>
                </Col>
                <Col xs={24} lg={8}>
                    <div className="space-y-6">
                        <Card 
                            title={<Space><BookOutlined className="text-blue-500" /><span>Capaian Kitab Terbanyak</span></Space>}
                            className="shadow-sm border-0"
                        >
                            <Skeleton loading={loadingKitab} active>
                                {topKitab?.data.map((item) => (
                                    <div key={item.nis} className="flex items-center justify-between mb-4 last:mb-0">
                                        <Space>
                                            <Avatar size="small" src={item.foto_url} icon={<UserOutlined />} />
                                            <Text strong style={{ fontSize: 13 }}>{item.nama}</Text>
                                        </Space>
                                        <Tag color="blue">{item.hafalan_kitab || '-'}</Tag>
                                    </div>
                                ))}
                            </Skeleton>
                        </Card>

                        <Card className="bg-gradient-to-br from-emerald-600 to-emerald-800 text-white border-0 shadow-lg">
                            <Statistic 
                                title={<span className="text-white/80">Total Khataman Tahun Ini</span>} 
                                value={tableQueryResult?.data?.data.filter(p => p.kategori === 'KHATAM').length || 0}
                                valueStyle={{ color: 'white', fontWeight: 900, fontSize: 32 }}
                                prefix={<SafetyCertificateOutlined />}
                                suffix="Santri"
                            />
                            <Divider className="border-white/10 my-3" />
                            <div className="text-xs text-white/60">Target: 50 Santri Khatam 30 Juz</div>
                        </Card>
                    </div>
                </Col>
            </Row>

            {/* --- ROW 2: MANAJEMEN PRESTASI (MANUAL) --- */}
            <Card className="shadow-sm border-0">
                <ProTable<IPrestasiSantri>
                    {...tableProps}
                    columns={columns}
                    rowKey="id"
                    search={{
                        labelWidth: "auto",
                        defaultCollapsed: false,
                    }}
                    headerTitle={
                        <Space>
                            <LineChartOutlined className="text-amber-500" />
                            <Text strong>Log Prestasi Manual & Khusus (Qubra, Lomba, dll)</Text>
                        </Space>
                    }
                />
            </Card>

            {/* --- MODAL CREATE --- */}
            <Modal
                title={<Space><TrophyOutlined /> {editingRecord ? "Edit Prestasi" : "Catat Prestasi Baru"}</Space>}
                open={isModalOpen}
                onCancel={closeModal}
                onOk={() => form.submit()}
                centered
                destroyOnHidden
            >
                <Form form={form} layout="vertical" onFinish={handleSubmitPrestasi} className="mt-4">
                    <Form.Item name="santri_nis" label="Pilih Santri" rules={[{ required: true, message: "Santri wajib dipilih" }]}>
                        <Select {...santriSelectProps} showSearch placeholder="Cari nama santri..." />
                    </Form.Item>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="kategori" label="Kategori" rules={[{ required: true, message: "Kategori wajib dipilih" }]}>
                                <Select options={PRESTASI_KATEGORI_OPTIONS.map(({ label, value }) => ({ label, value }))} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="tanggal_prestasi" label="Tanggal" rules={[{ required: true, message: "Tanggal wajib diisi" }]}>
                                <DatePicker className="w-full" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="judul_prestasi" label="Judul Prestasi (Contoh: Khatam Imrity, Juara 1 MQK)" rules={publicTextRules(true)}>
                        <Input placeholder="Tulis nama prestasi..." />
                    </Form.Item>
                    <Form.Item name="keterangan" label="Keterangan Tambahan" rules={publicTextRules(false)}>
                        <Input.TextArea
                            rows={3}
                            maxLength={300}
                            showCount
                            placeholder="Detail singkat yang aman tampil di Android publik..."
                        />
                    </Form.Item>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="poin_prestasi" label="Poin Prestasi">
                                <InputNumber min={0} precision={0} className="w-full" placeholder="0" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                name="sertifikat_url"
                                label="URL Sertifikat Internal"
                                rules={[{ type: "url", warningOnly: true, message: "Gunakan URL valid jika diisi" }]}
                            >
                                <Input prefix={<LinkOutlined />} placeholder="Opsional, tidak tampil di publik" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        Judul dan keterangan tampil di Android publik. Jangan isi NIS, nomor HP, alamat, data wali/orang tua, NIK/KK, rekening, atau link sertifikat.
                    </Text>
                </Form>
            </Modal>
        </div>
    );
};
