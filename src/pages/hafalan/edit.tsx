import React from "react";
import { useGetIdentity } from "@refinedev/core";
import { logActivity } from "../../utility/logger";
import { Edit, useForm } from "@refinedev/antd";
import { Form, Input, Select, DatePicker, Card, Row, Col, InputNumber, Radio, Alert } from "antd";
import dayjs from "dayjs";
import { IHafalanTahfidz } from "../../types";
import { DATA_SURAT, getJuzFromSurat } from "../../utility/quran-data";

export const HafalanEdit = () => {
        const { data: user } = useGetIdentity();
const { formProps, saveButtonProps, queryResult } = useForm<IHafalanTahfidz>({
        onMutationSuccess: (data) => {
            logActivity({
                user,
                action: "UPDATE",
                resource: "hafalan",
                record_id: data.data.id.toString(),
                details: data.data
            });
        }
    });
    const record = queryResult?.data?.data;

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
                                <InputNumber disabled style={{ width: '100%' }} />
                            </Form.Item>
                        </Card>
                    </Col>
                    <Col xs={24} md={12}>
                        <Card title="Detail Hafalan" bordered={false} className="shadow-sm">
                            <Form.Item label="Surat" name="surat">
                                <Select 
                                    showSearch
                                    options={DATA_SURAT.map(s => ({ label: s.nama, value: s.nama }))}
                                    onChange={(value) => {
                                        const ayatAwal = formProps.form?.getFieldValue("ayat_awal");
                                        const juz = getJuzFromSurat(value, ayatAwal);
                                        if (juz) formProps.form?.setFieldsValue({ juz });
                                    }}
                                />
                            </Form.Item>
                            <Row gutter={16}>
                                <Col span={12}><Form.Item label="Ayat Awal" name="ayat_awal"><InputNumber style={{width: '100%'}} onChange={(val) => {
                                    const surat = formProps.form?.getFieldValue("surat");
                                    if (surat && val) {
                                        const juz = getJuzFromSurat(surat, val);
                                        if (juz) formProps.form?.setFieldsValue({ juz });
                                    }
                                }} /></Form.Item></Col>
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