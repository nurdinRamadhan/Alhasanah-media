import React from "react";
import { Edit, useForm } from "@refinedev/antd";
import { Form, Input, DatePicker, Radio, Card, Row, Col, Alert, Select } from "antd";
import dayjs from "dayjs";
import { IPerizinanSantri } from "../../types";

export const PerizinanEdit = () => {
    const { formProps, saveButtonProps, queryResult } = useForm<IPerizinanSantri>();
    const record = queryResult?.data?.data;

    return (
        <Edit saveButtonProps={saveButtonProps} title="Edit Data Perizinan">
            <Form 
                {...formProps} 
                layout="vertical"
                initialValues={{
                    ...formProps.initialValues,
                    tanggal: formProps.initialValues?.tanggal ? dayjs(formProps.initialValues.tanggal) : "",
                    tanggal_kembali: formProps.initialValues?.tanggal_kembali ? dayjs(formProps.initialValues.tanggal_kembali) : "",
                }}
            >
                {/* Info Santri (Read Only) */}
                <Alert 
                    message={`Mengedit Izin: ${record?.santri?.nama || '...'}`}
                    type="info" 
                    showIcon 
                    className="mb-6"
                />

                <Row gutter={24}>
                    <Col xs={24} md={12}>
                        <Card title="Waktu & Jadwal" bordered={false} className="shadow-sm">
                            <Form.Item 
                                label="Tanggal Kembali (Rencana)" 
                                name="tanggal_kembali" 
                                rules={[{ required: true }]}
                                getValueProps={(value) => ({ value: value ? dayjs(value) : "" })}
                            >
                                <DatePicker style={{ width: "100%" }} format="DD MMMM YYYY" />
                            </Form.Item>

                            <Form.Item label="Status Izin" name="status">
                                <Select options={[
                                    { label: 'Menunggu (Pending)', value: 'PENDING' },
                                    { label: 'Disetujui (Approved)', value: 'APPROVED' },
                                    { label: 'Ditolak (Rejected)', value: 'REJECTED' },
                                    { label: 'Sudah Kembali', value: 'KEMBALI' },
                                ]} />
                            </Form.Item>
                        </Card>
                    </Col>
                    
                    <Col xs={24} md={12}>
                        <Card title="Detail Izin" bordered={false} className="shadow-sm">
                            <Form.Item label="Jenis Izin" name="jenis_izin">
                                <Radio.Group buttonStyle="solid">
                                    <Radio.Button value="SAKIT">Sakit</Radio.Button>
                                    <Radio.Button value="PULANG">Pulang</Radio.Button>
                                    <Radio.Button value="KELUAR">Keluar</Radio.Button>
                                </Radio.Group>
                            </Form.Item>

                            <Form.Item label="Keterangan / Alasan" name="keterangan" rules={[{ required: true }]}>
                                <Input.TextArea rows={4} />
                            </Form.Item>
                        </Card>
                    </Col>
                </Row>
            </Form>
        </Edit>
    );
};