import React from "react";
import { Create, useForm, useSelect } from "@refinedev/antd";
import { Form, Input, Select, Card, Typography, Space, Alert } from "antd";
import { BellOutlined, UserOutlined } from "@ant-design/icons";

const { TextArea } = Input;

export const NotificationCreate = () => {
    const { formProps, saveButtonProps } = useForm({
        resource: "notification_queue",
        redirect: "list",
    });

    // Mengambil data Santri
    // Kita hapus filter nnull yang menyebabkan error tipe data UUID vs Boolean
    const { selectProps: santriSelectProps } = useSelect({
        resource: "santri",
        optionLabel: "nama", 
        optionValue: "wali_id", // ID Wali yang akan menerima notifikasi
        onSearch: (value) => [
            { field: "nama", operator: "contains", value },
        ],
        sorters: [
            { field: "nama", order: "asc" }
        ],
        pagination: { pageSize: 100 }
    });

    return (
        <Create 
            saveButtonProps={saveButtonProps}
            title={
                <Space>
                    <BellOutlined />
                    <span>Kirim Notifikasi Manual</span>
                </Space>
            }
        >
            <Alert
                message="Info"
                description="Notifikasi ini akan dikirimkan ke aplikasi mobile Wali Santri."
                type="info"
                showIcon
                style={{ marginBottom: "24px" }}
            />
            <Form 
                {...formProps} 
                layout="vertical"
                initialValues={{
                    status: "pending",
                    source_table: "manual_admin",
                    data: { type: "manual" }
                }}
            >
                <Card title="Penerima" size="small" style={{ marginBottom: "24px" }}>
                    <Form.Item
                        label="Pilih Santri (Penerima adalah Wali)"
                        name="user_id"
                        rules={[{ required: true, message: "Harap pilih santri" }]}
                        tooltip="Pilih santri untuk mengirim notifikasi ke walinya"
                    >
                        <Select 
                            {...santriSelectProps}
                            showSearch
                            placeholder="Ketik nama santri..."
                            suffixIcon={<UserOutlined />}
                            filterOption={false}
                        />
                    </Form.Item>
                </Card>

                <Card title="Isi Notifikasi" size="small">
                    <Form.Item
                        label="Judul Notifikasi"
                        name="title"
                        rules={[{ required: true, message: "Judul wajib diisi" }]}
                    >
                        <Input placeholder="Contoh: Pengumuman Libur" />
                    </Form.Item>

                    <Form.Item
                        label="Pesan"
                        name="body"
                        rules={[{ required: true, message: "Pesan wajib diisi" }]}
                    >
                        <TextArea 
                            rows={4} 
                            placeholder="Tulis pesan..." 
                        />
                    </Form.Item>

                    {/* Hidden fields */}
                    <Form.Item name="status" hidden><Input /></Form.Item>
                    <Form.Item name="source_table" hidden><Input /></Form.Item>
                    <Form.Item name="data" hidden><Input /></Form.Item>
                </Card>
            </Form>
        </Create>
    );
};
