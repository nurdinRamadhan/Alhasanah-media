import React from "react";
import { Edit, useForm } from "@refinedev/antd";
import { Form, Input, Select, DatePicker, Card, Row, Col, InputNumber, Radio, Alert } from "antd";
import dayjs from "dayjs";
import { IHafalanTahfidz } from "../../types";
import { DATA_SURAT } from "../../utility/quran-data";

export const HafalanEdit = () => {
    const { formProps, saveButtonProps, queryResult } = useForm<IHafalanTahfidz>();
    const record = queryResult?.data?.data;

    // Generate Juz Options
    const juzOptions = Array.from({length: 30}, (_, i) => ({ label: `Juz ${i + 1}`, value: i + 1 }));

    return (
        <Edit saveButtonProps={saveButtonProps} title="Koreksi Data Hafalan">
            <Form 
                {...formProps} 
                layout="vertical"
                initialValues={{
                    ...formProps.initialValues,
                    tanggal: formProps.initialValues?.tanggal ? dayjs(formProps.initialValues.tanggal) : "",
                }}
            >
                <Alert message={`Mengedit Hafalan: ${record?.surat} (Ayat ${record?.ayat_awal}-${record?.ayat_akhir})`} type="info" className="mb-6" showIcon />

                <Row gutter={24}>
                    <Col xs={24} md={12}>
                        <Card title="Waktu & Posisi" bordered={false} className="shadow-sm">
                            <Form.Item label="Waktu Setoran" name="tanggal" rules={[{ required: true }]} getValueProps={(v) => ({ value: v ? dayjs(v) : "" })}>
                                <DatePicker showTime format="DD MMM YYYY HH:mm" style={{ width: '100%' }} />
                            </Form.Item>
                            <Form.Item label="Posisi Juz" name="juz">
                                <Select options={juzOptions} />
                            </Form.Item>
                        </Card>
                    </Col>
                    <Col xs={24} md={12}>
                        <Card title="Detail Hafalan" bordered={false} className="shadow-sm">
                            <Form.Item label="Surat" name="surat">
                                <Select 
                                    showSearch
                                    options={DATA_SURAT.map(s => ({ label: s.nama, value: s.nama }))}
                                />
                            </Form.Item>
                            <Row gutter={16}>
                                <Col span={12}><Form.Item label="Ayat Awal" name="ayat_awal"><InputNumber style={{width: '100%'}}/></Form.Item></Col>
                                <Col span={12}><Form.Item label="Ayat Akhir" name="ayat_akhir"><InputNumber style={{width: '100%'}}/></Form.Item></Col>
                            </Row>
                            <Form.Item label="Predikat" name="predikat">
                                <Radio.Group buttonStyle="solid">
                                    <Radio.Button value="MUMTAZ">Mumtaz</Radio.Button>
                                    <Radio.Button value="JAYYID">Jayyid</Radio.Button>
                                    <Radio.Button value="KURANG">Kurang</Radio.Button>
                                </Radio.Group>
                            </Form.Item>
                            <Form.Item label="Catatan" name="catatan"><Input.TextArea /></Form.Item>
                        </Card>
                    </Col>
                </Row>
            </Form>
        </Edit>
    );
};