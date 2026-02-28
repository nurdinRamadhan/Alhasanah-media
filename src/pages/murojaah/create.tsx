import React, { useState } from "react";
import { Create, useForm, useSelect } from "@refinedev/antd";
import { Form, Input, Select, DatePicker, Card, Row, Col, InputNumber, Radio, Divider, Segmented } from "antd";
import dayjs from "dayjs";
import { ISantri, IProfile } from "../../types";
import { useGetIdentity } from "@refinedev/core";
import { DATA_SURAT } from "../../utility/quran-data";

export const MurojaahCreate = () => {
    const { formProps, saveButtonProps } = useForm();
    const { data: user } = useGetIdentity<IProfile>();
    const [inputType, setInputType] = useState<'SURAT' | 'HALAMAN'>('SURAT');

    const { selectProps: santriSelectProps } = useSelect<ISantri>({
        resource: "santri",
        optionLabel: "nama",
        optionValue: "nis",
        filters: [{ field: "jurusan", operator: "eq", value: "TAHFIDZ" }],
        onSearch: (value) => [{ field: "nama", operator: "contains", value }],
    });

    const juzOptions = Array.from({length: 30}, (_, i) => ({ label: `Juz ${i + 1}`, value: i + 1 }));

    return (
        <Create saveButtonProps={saveButtonProps} title="Catat Murojaah">
            <Form 
                {...formProps} 
                layout="vertical"
                initialValues={{
                    tanggal: dayjs(),
                    dicatat_oleh_id: user?.id,
                    jenis_murojaah: "SABAQ", // Default Sabaq (Murojaah Baru)
                    predikat: "MUMTAZ",
                }}
            >
                <Form.Item name="dicatat_oleh_id" hidden><Input /></Form.Item>

                <Row gutter={24}>
                    <Col xs={24} md={10}>
                        <Card title="Identitas & Jenis" bordered={false} className="shadow-sm mb-6">
                            <Form.Item label="Nama Santri" name="santri_nis" rules={[{ required: true }]}>
                                <Select {...santriSelectProps} showSearch placeholder="Cari Santri..." />
                            </Form.Item>

                            <Form.Item label="Waktu" name="tanggal" rules={[{ required: true }]} getValueProps={(v) => ({ value: v ? dayjs(v) : "" })}>
                                <DatePicker showTime format="DD MMM YYYY HH:mm" style={{ width: '100%' }} />
                            </Form.Item>

                            <Form.Item label="Jenis Murojaah" name="jenis_murojaah" help="Sabaq: Hafalan Baru | Manzil: Hafalan Lama">
                                <Radio.Group buttonStyle="solid" className="w-full">
                                    <Radio.Button value="SABAQ" className="w-1/2 text-center">SABAQ</Radio.Button>
                                    <Radio.Button value="MANZIL" className="w-1/2 text-center">MANZIL</Radio.Button>
                                </Radio.Group>
                            </Form.Item>
                        </Card>
                    </Col>

                    <Col xs={24} md={14}>
                        <Card title="Capaian Pengulangan" bordered={false} className="shadow-sm mb-6">
                            <Form.Item label="Target Juz" name="juz" rules={[{ required: true }]}>
                                <Select options={juzOptions} placeholder="Pilih Juz" />
                            </Form.Item>

                            <Divider dashed>Detail Cakupan</Divider>
                            
                            {/* Pilihan Metode Input: Surat vs Halaman */}
                            <div className="mb-4 flex justify-center">
                                <Segmented 
                                    options={[
                                        { label: 'Per Surat', value: 'SURAT' },
                                        { label: 'Per Halaman', value: 'HALAMAN' }
                                    ]}
                                    value={inputType}
                                    onChange={(val) => setInputType(val as any)}
                                />
                            </div>

                            {inputType === 'SURAT' ? (
                                <>
                                    <Form.Item label="Nama Surat" name="surat">
                                        <Select 
                                            showSearch
                                            options={DATA_SURAT.map(s => ({ label: s.nama, value: s.nama }))}
                                            placeholder="Pilih Surat..."
                                        />
                                    </Form.Item>
                                    <Row gutter={16}>
                                        <Col span={12}><Form.Item label="Ayat Awal" name="ayat_awal"><InputNumber style={{width: '100%'}}/></Form.Item></Col>
                                        <Col span={12}><Form.Item label="Ayat Akhir" name="ayat_akhir"><InputNumber style={{width: '100%'}}/></Form.Item></Col>
                                    </Row>
                                </>
                            ) : (
                                <Row gutter={16}>
                                    <Col span={12}>
                                        <Form.Item label="Halaman Awal (1-604)" name="halaman_awal">
                                            <InputNumber min={1} max={604} style={{width: '100%'}} placeholder="Hal..." />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item label="Halaman Akhir" name="halaman_akhir">
                                            <InputNumber min={1} max={604} style={{width: '100%'}} placeholder="Hal..." />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            )}

                            <Divider dashed />

                            <Form.Item label="Kelancaran (Predikat)" name="predikat">
                                <Radio.Group buttonStyle="solid" className="w-full">
                                    <Radio.Button value="MUMTAZ" className="w-1/3 text-center">Mumtaz</Radio.Button>
                                    <Radio.Button value="JAYYID" className="w-1/3 text-center">Jayyid</Radio.Button>
                                    <Radio.Button value="KURANG" className="w-1/3 text-center">Kurang</Radio.Button>
                                </Radio.Group>
                            </Form.Item>

                            <Form.Item label="Catatan" name="catatan">
                                <Input.TextArea rows={2} />
                            </Form.Item>
                        </Card>
                    </Col>
                </Row>
            </Form>
        </Create>
    );
};