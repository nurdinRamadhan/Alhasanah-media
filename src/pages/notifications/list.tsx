import React from "react";
import { useTable, useSelect } from "@refinedev/antd";
import { useList, useNavigation } from "@refinedev/core";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import { Tag, Typography, Space, Avatar, Select, theme, Button, Modal, Form, Input, Radio, message } from "antd";
import { 
    BellOutlined, 
    CheckCircleOutlined, 
    ClockCircleOutlined, 
    CloseCircleOutlined,
    UserOutlined,
    NotificationOutlined,
    PlusOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";
import { ISantri } from "../../types";
import { supabaseClient } from "../../utility/supabaseClient";

const { Text } = Typography;
const { TextArea } = Input;

export const NotificationList = () => {
    const { token } = theme.useToken();
    const [isBroadcastModalOpen, setIsBroadcastModalOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [broadcastForm] = Form.useForm();
    const { push } = useNavigation();

    // 1. Fetching data antrean notifikasi
    const { tableProps, tableQueryResult } = useTable({
        resource: "notification_queue",
        sorters: {
            initial: [{ field: "created_at", order: "desc" }],
        },
        onSearch: (params: any) => {
            const filters: any[] = [];
            if (params.created_at) {
                filters.push(
                    { field: "created_at", operator: "gte", value: params.created_at[0] },
                    { field: "created_at", operator: "lte", value: params.created_at[1] }
                );
            }
            if (params.user_id) filters.push({ field: "user_id", operator: "eq", value: params.user_id });
            if (params.status) filters.push({ field: "status", operator: "eq", value: params.status });
            return filters;
        },
    });

    // Handle Broadcast Masal via RPC
    const handleBroadcast = async (values: any) => {
        setIsSubmitting(true);
        try {
            const { data, error } = await supabaseClient.rpc('broadcast_notification_v3', {
                p_title: values.title,
                p_body: values.body,
                p_target_kelas: values.target,
                p_source: 'broadcast_admin'
            });

            if (error) throw error;

            message.success(`Berhasil membuat ${data[0]?.inserted_count || 0} antrean notifikasi.`);
            setIsBroadcastModalOpen(false);
            broadcastForm.resetFields();
            tableQueryResult.refetch();
        } catch (err: any) {
            message.error("Gagal melakukan broadcast: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // 2. Fetch data santri untuk filter & mapping nama santri
    const { selectProps: santriSelectProps } = useSelect<ISantri>({
        resource: "santri",
        optionLabel: "nama",
        optionValue: "wali_id",
        pagination: { pageSize: 500 }
    });

    // 3. Fetch data profiles (Wali) secara terpisah untuk mapping ID ke Nama
    const { data: profilesData } = useList<any>({
        resource: "profiles",
        pagination: { pageSize: 1000 },
    });

    const columns: ProColumns<any>[] = [
        {
            title: "Waktu Kirim",
            dataIndex: "created_at",
            valueType: "dateTime",
            width: 150,
            sorter: true,
            render: (_, record) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <Text strong style={{ fontSize: 13 }}>
                        {dayjs(record.created_at).format("DD/MM/YYYY")}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        Jam {dayjs(record.created_at).format("HH:mm")}
                    </Text>
                </div>
            ),
            search: {
                transform: (value) => {
                    return {
                        created_at: [
                            dayjs(value[0]).startOf('day').toISOString(),
                            dayjs(value[1]).endOf('day').toISOString()
                        ]
                    };
                }
            }
        },
        {
            title: "Penerima (Wali & Santri)",
            dataIndex: "user_id",
            width: 220,
            renderFormItem: () => (
                <Select 
                    {...santriSelectProps} 
                    showSearch 
                    allowClear
                    placeholder="Cari Santri..." 
                />
            ),
            render: (_, record) => {
                const profile = profilesData?.data?.find(p => p.id === record.user_id);
                const santri = santriSelectProps.options?.find(o => o.value === record.user_id);
                
                return (
                    <div className="flex flex-col">
                        <Space size={4}>
                            <UserOutlined className="text-blue-500" style={{ fontSize: 12 }} />
                            <Text strong style={{ fontSize: 13 }}>
                                {profile?.full_name || "Memuat..."}
                            </Text>
                        </Space>
                        <Text type="secondary" style={{ fontSize: 11, marginLeft: 16 }}>
                            Santri: {santri?.label || "Umum/Lainnya"}
                        </Text>
                    </div>
                );
            }
        },
        {
            title: "Konten Notifikasi",
            dataIndex: "title",
            hideInSearch: true,
            render: (_, record) => (
                <div className="flex flex-col py-1">
                    <Text strong style={{ fontSize: 14, marginBottom: 6 }}>
                        {record.title}
                    </Text>
                    <div style={{ 
                        backgroundColor: token.colorFillAlter, 
                        padding: "10px 14px", 
                        borderRadius: "8px",
                        border: `1px solid ${token.colorBorderSecondary}`,
                        fontSize: 13,
                        lineHeight: "1.6",
                        whiteSpace: "pre-wrap",
                        color: token.colorTextDescription
                    }}>
                        {record.body}
                    </div>
                </div>
            )
        },
        {
            title: "Status",
            dataIndex: "status",
            width: 130,
            valueEnum: {
                pending: { text: "Menunggu", status: "Default" },
                sent: { text: "Terkirim", status: "Success" },
                failed: { text: "Gagal", status: "Error" },
            },
            render: (_, record) => {
                const status = record.status;
                let color = "default";
                let icon = <ClockCircleOutlined />;
                let label = "Menunggu";
                
                if (status === "sent") {
                    color = "success";
                    icon = <CheckCircleOutlined />;
                    label = "Terkirim";
                } else if (status === "failed") {
                    color = "error";
                    icon = <CloseCircleOutlined />;
                    label = "Gagal";
                }

                return (
                    <Tag icon={icon} color={color} style={{ borderRadius: 12, padding: "2px 12px" }}>
                        {label}
                    </Tag>
                );
            }
        },
        {
            title: "Sumber",
            dataIndex: "source_table",
            width: 100,
            hideInSearch: true,
            render: (val) => (
                <Tag color="cyan" bordered={false} style={{ fontSize: 10, textTransform: 'uppercase' }}>
                    {val || "manual"}
                </Tag>
            )
        }
    ];

    return (
        <>
            <ProTable
                {...tableProps}
                columns={columns}
                rowKey="id"
                search={{
                    labelWidth: "auto",
                    defaultCollapsed: false,
                    searchText: "Filter",
                    resetText: "Reset",
                }}
                headerTitle={
                    <Space>
                        <BellOutlined style={{ color: "#1890ff" }} />
                        <Text strong>Manajemen Antrean Notifikasi</Text>
                    </Space>
                }
                toolBarRender={() => [
                    <Button 
                        key="create" 
                        type="primary" 
                        icon={<PlusOutlined />} 
                        onClick={() => push("/notifications/create")}
                    >
                        Kirim Notifikasi
                    </Button>,
                    <Button 
                        key="broadcast" 
                        type="default" 
                        danger
                        icon={<NotificationOutlined />} 
                        onClick={() => setIsBroadcastModalOpen(true)}
                    >
                        Broadcast Masal
                    </Button>
                ]}
                options={{
                    density: true,
                    fullScreen: true,
                    reload: true,
                }}
                pagination={{
                    defaultPageSize: 10,
                    showSizeChanger: true,
                }}
                className="bg-white rounded-lg shadow-sm"
            />

            <Modal
                title={
                    <Space>
                        <NotificationOutlined className="text-red-500" />
                        <span>Kirim Notifikasi Masal (Broadcast)</span>
                    </Space>
                }
                open={isBroadcastModalOpen}
                onCancel={() => setIsBroadcastModalOpen(false)}
                onOk={() => broadcastForm.submit()}
                confirmLoading={isSubmitting}
                okText="Kirim Sekarang"
                cancelText="Batal"
                centered
            >
                <Form
                    form={broadcastForm}
                    layout="vertical"
                    onFinish={handleBroadcast}
                    initialValues={{ target: 'ALL' }}
                >
                    <Form.Item
                        name="target"
                        label="Target Penerima"
                        rules={[{ required: true }]}
                    >
                        <Radio.Group buttonStyle="solid">
                            <Radio.Group buttonStyle="solid">
                                <Radio.Button value="ALL">Semua Wali</Radio.Button>
                                <Radio.Button value="1">Kelas 1</Radio.Button>
                                <Radio.Button value="2">Kelas 2</Radio.Button>
                                <Radio.Button value="3">Kelas 3</Radio.Button>
                            </Radio.Group>
                        </Radio.Group>
                    </Form.Item>

                    <Form.Item
                        name="title"
                        label="Judul Notifikasi"
                        rules={[{ required: true, message: "Judul wajib diisi" }]}
                    >
                        <Input placeholder="Contoh: Pengumuman Libur Ramadhan" />
                    </Form.Item>

                    <Form.Item
                        name="body"
                        label="Isi Pesan"
                        rules={[{ required: true, message: "Pesan wajib diisi" }]}
                    >
                        <TextArea 
                            rows={4} 
                            placeholder="Tulis pesan yang akan diterima oleh semua wali..." 
                        />
                    </Form.Item>
                    
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        *Notifikasi akan masuk ke antrean dan dikirim secara bertahap oleh sistem.
                    </Text>
                </Form>
            </Modal>
        </>
    );
};
