import React from "react";
import { Edit, useForm, useSelect } from "@refinedev/antd";
import { Form, Input, Select, DatePicker, InputNumber, Card, Row, Col, Alert } from "antd";
import { ITagihanSantri, ISantri } from "../../types";
import dayjs from "dayjs";

export const TagihanEdit = () => {
    const { formProps, saveButtonProps, queryResult } = useForm<ITagihanSantri>();
    const tagihanData = queryResult?.data?.data;

    return (
        <Edit saveButtonProps={saveButtonProps} title="Edit Tagihan">
             <Alert 
                message="Perhatian" 
                description="Mengubah nominal tagihan yang sudah ada transaksi Midtrans dapat menyebabkan ketidakcocokan data." 
                type="warning" 
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
                            
                            <Form.Item label="Nominal (Rp)" name="nominal_tagihan" rules={[{ required: true }]}>
                                <InputNumber 
                                    style={{ width: "100%" }} 
                                    formatter={(value) => `Rp ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                                    parser={(value) => value?.replace(/\Rp\s?|(\.*)/g, '') as unknown as number}
                                />
                            </Form.Item>

                            {/* Untuk update sisa manual jika perlu */}
                            <Form.Item label="Sisa Tagihan" name="sisa_tagihan">
                                <InputNumber 
                                    style={{ width: "100%" }} 
                                    formatter={(value) => `Rp ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                                    parser={(value) => value?.replace(/\Rp\s?|(\.*)/g, '') as unknown as number}
                                />
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

                            <Form.Item label="Status Pembayaran" name="status">
                                <Select options={[
                                    { label: "Belum Lunas", value: "BELUM" },
                                    { label: "Lunas", value: "LUNAS" },
                                    { label: "Cicilan", value: "CICILAN" },
                                ]} />
                            </Form.Item>
                        </Card>
                    </Col>
                </Row>
            </Form>
        </Edit>
    );
};