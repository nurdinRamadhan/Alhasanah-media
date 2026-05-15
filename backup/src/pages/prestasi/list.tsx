import React, { useMemo } from "react";
import { useTable, useSelect } from "@refinedev/antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import { 
    Tag, Space, Button, Typography, Avatar, Card, Row, Col, 
    Statistic, List, Skeleton, Modal, Form, Select, Input, 
    DatePicker, message, Divider 
} from "antd";
import { 
    TrophyOutlined, 
    StarOutlined, 
    PlusOutlined, 
    UserOutlined, 
    BookOutlined, 
    FireOutlined,
    SafetyCertificateOutlined,
    LineChartOutlined
} from "@ant-design/icons";
import { IPrestasiSantri, ISantri } from "../../types";
import { useCreate, useGetIdentity, useList } from "@refinedev/core";
import dayjs from "dayjs";
import { formatHijri } from "../../utility/dateHelper";

const { Text, Title } = Typography;

export const PrestasiList = () => {
    const { data: user } = useGetIdentity<{ id: string }>();
    const { mutate: createMutate } = useCreate();
    
    // --- 1. DATA OTOMATIS: HALL OF FAME ---
    // Mengambil 10 besar santri berdasarkan total_hafalan (Juz)
    const { data: topTahfidz, isLoading: loadingTahfidz } = useList<ISantri>({
        resource: "santri",
        pagination: { pageSize: 10 },
        sorters: [{ field: "total_hafalan", order: "desc" }],
        filters: [{ field: "status_santri", operator: "eq", value: "AKTIF" }]
    });

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
    const [form] = Form.useForm();

    const { selectProps: santriSelectProps } = useSelect<ISantri>({
        resource: "santri",
        optionLabel: "nama",
        optionValue: "nis",
        filters: [{ field: "status_santri", operator: "eq", value: "AKTIF" }],
    });

    const handleCreatePrestasi = (values: any) => {
        createMutate({
            resource: "prestasi_santri",
            values: {
                ...values,
                tanggal_prestasi: values.tanggal_prestasi.format("YYYY-MM-DD"),
                dicatat_oleh_id: user?.id
            },
            successNotification: {
                message: "Prestasi berhasil dicatat!",
                type: "success"
            }
        }, {
            onSuccess: () => {
                setIsModalOpen(false);
                form.resetFields();
                tableQueryResult.refetch();
            }
        });
    };

    const columns: ProColumns<IPrestasiSantri>[] = [
        {
            title: "Santri",
            dataIndex: "santri",
            render: (_, record) => (
                <Space>
                    <Avatar src={record.santri?.foto_url} icon={<UserOutlined />} />
                    <div className="flex flex-col">
                        <Text strong>{record.santri?.nama}</Text>
                        <Text type="secondary" style={{ fontSize: 10 }}>{record.santri?.nis}</Text>
                    </div>
                </Space>
            )
        },
        {
            title: "Kategori",
            dataIndex: "kategori",
            render: (val) => {
                const colors: any = { TAHFIDZ: "gold", KITAB: "blue", KHATAM: "green", UMUM: "purple" };
                return <Tag color={colors[val as string] || "default"}>{String(val)}</Tag>;
            }
        },
        {
            title: "Judul Prestasi",
            dataIndex: "judul_prestasi",
            render: (val) => <Text strong className="text-emerald-700">{val}</Text>
        },
        {
            title: "Tanggal",
            dataIndex: "tanggal_prestasi",
            render: (val) => dayjs(val as string).format("DD MMM YYYY")
        },
        {
            title: "Keterangan",
            dataIndex: "keterangan",
            ellipsis: true
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
                    onClick={() => setIsModalOpen(true)}
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
                            dataSource={topTahfidz?.data}
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
                                        <div style={{ color: '#b45309', fontWeight: 800, fontSize: 18 }}>{item.total_hafalan || 0} <small>Juz</small></div>
                                        <Text type="secondary" style={{ fontSize: 10 }}>Capaian Akumulatif</Text>
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
                    search={false}
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
                title={<Space><TrophyOutlined /> Catat Prestasi Baru</Space>}
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                onOk={() => form.submit()}
                centered
            >
                <Form form={form} layout="vertical" onFinish={handleCreatePrestasi} className="mt-4">
                    <Form.Item name="santri_nis" label="Pilih Santri" rules={[{ required: true }]}>
                        <Select {...santriSelectProps} showSearch placeholder="Cari nama santri..." />
                    </Form.Item>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="kategori" label="Kategori" rules={[{ required: true }]}>
                                <Select options={[
                                    { label: "Hafalan (Tahfidz)", value: "TAHFIDZ" },
                                    { label: "Hafalan Kitab", value: "KITAB" },
                                    { label: "Khataman (Official)", value: "KHATAM" },
                                    { label: "Lomba / Umum", value: "UMUM" },
                                ]} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="tanggal_prestasi" label="Tanggal" initialValue={dayjs()} rules={[{ required: true }]}>
                                <DatePicker className="w-full" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="judul_prestasi" label="Judul Prestasi (Contoh: Khatam Imrity, Juara 1 MQK)" rules={[{ required: true }]}>
                        <Input placeholder="Tulis nama prestasi..." />
                    </Form.Item>
                    <Form.Item name="keterangan" label="Keterangan Tambahan">
                        <Input.TextArea rows={3} placeholder="Detail prestasi..." />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};
