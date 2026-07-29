import React from "react";
import { useGetIdentity } from "@refinedev/core";
import { logActivity } from "../../utility/logger";
import { Edit, useForm, useSelect } from "@refinedev/antd";
import { Form, Input, Select, DatePicker, InputNumber, Card, Row, Col, Alert, Typography } from "antd";
import { ITagihanSantri, ISantri } from "../../types";
import dayjs from "dayjs";

const { Text } = Typography;

export const TagihanEdit = () => {
        const { data: user } = useGetIdentity();
const { formProps, saveButtonProps, queryResult } = useForm<ITagihanSantri>({
        onMutationSuccess: (data) => {
            logActivity({
                user,
                action: "UPDATE",
                resource: "tagihan_santri",
                record_id: data.data.id.toString(),
                details: data.data
            });
        }
    });
    const tagihanData = queryResult?.data?.data;

    return (
        <Edit saveButtonProps={saveButtonProps} title="Edit Tagihan">
             <Alert 
                message="Keterbatasan Edit" 
                description="Nominal dan sisa tagihan tidak dapat diubah manual dari halaman ini. Nominal ditentukan oleh master pembayaran atau tarif khusus santri saat generate. Sisa tagihan dihitung otomatis dari pembayaran yang tercatat."
                type="info" 
                showIcon 
                className="mb-4"
            />

            <Form 
                {...formProps} 
                layout="vertical"
                initialValues={{
                    ...formProps.initialValues,
                    tanggal_jatuh_tempo: formProps.initialValues?.tanggal_jatuh_tempo ? dayjs(formProps.initialValues.tanggal_jatuh_tempo) : "",
                }}
            >
                <Row gutter={24}>
                    <Col xs={24} md={12}>
                        <Card title="Info Tagihan" bordered={false} className="shadow-sm">
                            <Form.Item label="Deskripsi" name="deskripsi_tagihan" rules={[{ required: true }]}>
                                <Input />
                            </Form.Item>
                            
                            <Form.Item label="Nominal (Rp)">
                                <InputNumber 
                                    style={{ width: "100%" }} 
                                    value={tagihanData?.nominal_tagihan || 0}
                                    disabled
                                    formatter={(value) => `Rp ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                                />
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                    Ditentukan oleh master pembayaran / tarif khusus saat generate massal
                                </Text>
                            </Form.Item>

                            <Form.Item label="Sisa Tagihan (Rp)">
                                <InputNumber 
                                    style={{ width: "100%" }} 
                                    value={tagihanData?.sisa_tagihan || 0}
                                    disabled
                                    formatter={(value) => `Rp ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                                />
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                    Dihitung otomatis dari nominal - total pembayaran tercatat
                                </Text>
                            </Form.Item>
                        </Card>
                    </Col>
                    <Col xs={24} md={12}>
                        <Card title="Status & Waktu" bordered={false} className="shadow-sm">
                            <Form.Item 
                                label="Jatuh Tempo" 
                                name="tanggal_jatuh_tempo"
                                rules={[{ required: true }]}
                                getValueProps={(value) => ({ value: value ? dayjs(value) : "" })}
                            >
                                <DatePicker style={{ width: "100%" }} format="DD MMMM YYYY" />
                            </Form.Item>

                            <Form.Item 
                                label="Status Pembayaran" 
                                name="status"
                                help="Status LUNAS hanya bisa diatur oleh sistem jika ada pembayaran record yang lengkap"
                            >
                                <Select options={[
                                    { label: "Belum Lunas", value: "BELUM" },
                                    { label: "Cicilan", value: "CICILAN" },
                                    { label: "Lunas (via pembayaran)", value: "LUNAS", disabled: true },
                                ]} />
                            </Form.Item>
                        </Card>
                    </Col>
                </Row>
            </Form>
        </Edit>
    );
};