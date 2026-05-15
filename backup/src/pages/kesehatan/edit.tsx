import React from "react";
import { Edit, useForm } from "@refinedev/antd";
import { Form, Input, DatePicker, Card, Row, Col, Alert } from "antd";
import dayjs from "dayjs";
import { IKesehatanSantri } from "../../types";

export const KesehatanEdit = () => {
    const { formProps, saveButtonProps, queryResult } = useForm<IKesehatanSantri>();
    const record = queryResult?.data?.data;

    return (
        <Edit saveButtonProps={saveButtonProps} title="Update Data Medis">
            <Form 
                {...formProps} 
                layout="vertical"
                initialValues={{
                    ...formProps.initialValues,
                    tanggal: formProps.initialValues?.tanggal ? dayjs(formProps.initialValues.tanggal) : "",
                }}
            >
                <Alert message={`Santri: ${record?.santri?.nama || '...'}`} type="error" showIcon className="mb-6 bg-red-50 border-red-200 text-red-800" />

                <Row gutter={24}>
                    <Col xs={24} md={12}>
                        <Card title="Waktu Periksa" bordered={false} className="shadow-sm">
                            <Form.Item 
                                label="Tanggal" 
                                name="tanggal" 
                                rules={[{ required: true }]}
                                getValueProps={(value) => ({ value: value ? dayjs(value) : "" })}
                            >
                                <DatePicker style={{ width: "100%" }} format="DD MMMM YYYY" />
                            </Form.Item>
                        </Card>
                    </Col>
                    <Col xs={24} md={12}>
                        <Card title="Diagnosa" bordered={false} className="shadow-sm">
                            <Form.Item label="Keluhan" name="keluhan" rules={[{ required: true }]}>
                                <Input />
                            </Form.Item>
                            <Form.Item label="Tindakan" name="tindakan" rules={[{ required: true }]}>
                                <Input.TextArea rows={3} />
                            </Form.Item>
                            <Form.Item label="Catatan" name="catatan">
                                <Input.TextArea rows={2} />
                            </Form.Item>
                        </Card>
                    </Col>
                </Row>
            </Form>
        </Edit>
    );
};