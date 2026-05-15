import React, { useState, useEffect } from "react";
import { Create, useForm, useSelect } from "@refinedev/antd";
import { Form, Input, Select, DatePicker, Card, Row, Col, InputNumber, Radio, Divider, Typography, Space } from "antd";
import { BookOutlined, UserOutlined, CalendarOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { ISantri, IProfile, NAMA_KITAB_LIST } from "../../types";
import { useGetIdentity } from "@refinedev/core";
import { formatHijri } from "../../utility/dateHelper";
import { useLocation } from "react-router-dom";

const { Text, Title } = Typography;

export const HafalanKitabCreate = () => {
    const [form] = Form.useForm();
    const { formProps, saveButtonProps } = useForm({
        resource: "hafalan_kitab",
        redirect: "list"
    });
    
    const { data: user } = useGetIdentity<IProfile>();
    const location = useLocation();
    
    // Auto-fill NIS jika datang dari halaman detail santri
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const nis = params.get("nis");
        if (nis) {
            form.setFieldsValue({ santri_nis: nis });
        }
    }, [location, form]);

    const { selectProps: santriSelectProps } = useSelect<ISantri>({
        resource: "santri",
        optionLabel: "nama",
        optionValue: "nis",
        onSearch: (value) => [{ field: "nama", operator: "contains", value }],
    });

    const selectedDate = Form.useWatch("tanggal", form);
    const selectedKitab = Form.useWatch("nama_kitab", form);

    // Logic: Jika Alfiyah, Imrity, atau Maqshud -> Bait. Jika Jurumiah (Natsar) -> Halaman.
    const isNadhom = selectedKitab && ["Alfiyah", "Imrity", "Nadzmul Maqshud", "Sulam Munawraq"].includes(selectedKitab);

    return (
        <Create saveButtonProps={saveButtonProps} title="Input Hafalan Kitab (Takhasus)">
            <Form 
                {...formProps} 
                layout="vertical"
                initialValues={{
                    tanggal: dayjs(),
                    dicatat_oleh_id: user?.id,
                    status: "LULUS",
                    predikat: "MUMTAZ"
                }}
            >
                <Form.Item name="dicatat_oleh_id" hidden><Input /></Form.Item>

                <Row gutter={24}>
                    <Col xs={24} md={10}>
                        <Card title={<Space><UserOutlined/> Identitas Santri</Space>} bordered={false} className="shadow-sm mb-6">
                            <Form.Item label="Nama Santri" name="santri_nis" rules={[{ required: true }]}>
                                <Select {...santriSelectProps} showSearch placeholder="Cari Nama Santri..." />
                            </Form.Item>

                            <Form.Item 
                                label="Waktu Setoran" 
                                name="tanggal" 
                                rules={[{ required: true }]} 
                                getValueProps={(v) => ({ value: v ? dayjs(v) : "" })}
                                help={
                                    selectedDate && (
                                        <Text type="success" style={{ fontSize: 11 }}>
                                            Bertepatan: <b>{formatHijri(selectedDate)}</b>
                                        </Text>
                                    )
                                }
                            >
                                <DatePicker showTime format="DD MMM YYYY HH:mm" style={{ width: '100%' }} />
                            </Form.Item>
                        </Card>

                        <Card title={<Space><BookOutlined/> Materi Kitab</Space>} bordered={false} className="shadow-sm">
                            <Form.Item label="Pilih Kitab" name="nama_kitab" rules={[{ required: true }]}>
                                <Select placeholder="Pilih Kitab...">
                                    {NAMA_KITAB_LIST.map(k => <Select.Option key={k} value={k}>{k}</Select.Option>)}
                                </Select>
                            </Form.Item>

                            <Form.Item label="Bab / Judul Materi" name="bab_materi" rules={[{ required: true }]} help="Contoh: Bab I'rab, Bab Fa'il, dll.">
                                <Input placeholder="Input nama bab..." />
                            </Form.Item>

                            <Divider dashed />

                            {isNadhom ? (
                                <Row gutter={16}>
                                    <Col span={12}>
                                        <Form.Item label="Bait Awal" name="bait_awal" rules={[{ required: true }]}>
                                            <InputNumber min={1} style={{ width: '100%' }} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item label="Bait Akhir" name="bait_akhir" rules={[{ required: true }]}>
                                            <InputNumber min={1} style={{ width: '100%' }} />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            ) : (
                                <Row gutter={16}>
                                    <Col span={12}>
                                        <Form.Item label="Hal. Awal" name="halaman_awal" rules={[{ required: true }]}>
                                            <InputNumber min={1} style={{ width: '100%' }} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item label="Hal. Akhir" name="halaman_akhir" rules={[{ required: true }]}>
                                            <InputNumber min={1} style={{ width: '100%' }} />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            )}
                        </Card>
                    </Col>

                    <Col xs={24} md={14}>
                        <Card title="Hasil Setoran" bordered={false} className="shadow-sm h-full">
                            <Form.Item label="Kualitas Hafalan (Predikat)" name="predikat">
                                <Radio.Group buttonStyle="solid" className="w-full text-center">
                                    <Radio.Button value="MUMTAZ" className="w-1/3">Mumtaz</Radio.Button>
                                    <Radio.Button value="JAYYID" className="w-1/3">Jayyid</Radio.Button>
                                    <Radio.Button value="KURANG" className="w-1/3">Kurang</Radio.Button>
                                </Radio.Group>
                            </Form.Item>

                            <Form.Item label="Status Kelulusan" name="status">
                                <Radio.Group buttonStyle="solid" className="w-full text-center">
                                    <Radio.Button value="LULUS" className="w-1/2">Lulus (Lanjut)</Radio.Button>
                                    <Radio.Button value="MENGULANG" className="w-1/2">Mengulang</Radio.Button>
                                </Radio.Group>
                            </Form.Item>

                            <Form.Item label="Catatan Ustadz" name="catatan">
                                <Input.TextArea rows={6} placeholder="Tambahkan catatan jika ada kesalahan bait atau tajwid..." />
                            </Form.Item>
                        </Card>
                    </Col>
                </Row>
            </Form>
        </Create>
    );
};
