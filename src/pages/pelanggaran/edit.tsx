import React from "react";
import { Edit, useForm } from "@refinedev/antd";
import { Form, Input, DatePicker, InputNumber, Row, Col, Radio, Card, Alert } from "antd";
import dayjs from "dayjs";
import { IPelanggaranSantri } from "../../types";

export const PelanggaranEdit = () => {
    const { formProps, saveButtonProps, queryResult } = useForm<IPelanggaranSantri>();
    const record = queryResult?.data?.data;

    return (
        <Edit saveButtonProps={saveButtonProps} title="Revisi Data Pelanggaran">
            <Form 
                {...formProps} 
                layout="vertical"
                initialValues={{
                    ...formProps.initialValues,
                    tanggal: formProps.initialValues?.tanggal ? dayjs(formProps.initialValues.tanggal) : "",
                }}
            >
                <Alert 
                    message="Perhatian"
                    description="Mengubah data ini akan otomatis menghitung ulang total poin santri."
                    type="warning"
                    showIcon
                    className="mb-6"
                />

                <Row gutter={24}>
                    <Col xs={24} md={12}>
                        <Card title="Identitas Pelanggar" bordered={false} className="shadow-sm mb-6">
                            {/* Santri tidak bisa diubah saat edit untuk menjaga integritas */}
                            <Form.Item label="Nama Santri" help="Santri tidak dapat diubah. Hapus dan buat baru jika salah orang.">
                                <Input value={record?.santri?.nama} disabled className="bg-gray-100 text-gray-800" />
                            </Form.Item>

                            <Form.Item 
                                label="Tanggal Kejadian" 
                                name="tanggal" 
                                rules={[{ required: true }]}
                                getValueProps={(value) => ({ value: value ? dayjs(value) : "" })}
                            >
                                <DatePicker style={{ width: "100%" }} format="DD MMMM YYYY" />
                            </Form.Item>
                        </Card>
                    </Col>

                    <Col xs={24} md={12}>
                        <Card title="Detail Koreksi" bordered={false} className="shadow-sm mb-6">
                            <Form.Item label="Jenis Pelanggaran" name="jenis_pelanggaran">
                                <Radio.Group buttonStyle="solid">
                                    <Radio.Button value="RINGAN">Ringan</Radio.Button>
                                    <Radio.Button value="SEDANG">Sedang</Radio.Button>
                                    <Radio.Button value="BERAT">Berat</Radio.Button>
                                </Radio.Group>
                            </Form.Item>

                            <Form.Item label="Poin Hukuman (Revisi)" name="poin" rules={[{ required: true }]}>
                                <InputNumber min={1} max={100} style={{ width: "100%" }} />
                            </Form.Item>

                            <Form.Item label="Bentuk Hukuman / Tindakan" name="hukuman" rules={[{ required: true }]}>
                                <Input />
                            </Form.Item>

                            <Form.Item label="Catatan / Kronologi" name="catatan">
                                <Input.TextArea rows={4} />
                            </Form.Item>
                        </Card>
                    </Col>
                </Row>
            </Form>
        </Edit>
    );
};