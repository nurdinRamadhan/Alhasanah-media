import React from "react";
import { Create, useForm, useSelect } from "@refinedev/antd";
import { Form, Input, Select, DatePicker, Card, Row, Col } from "antd";
import dayjs from "dayjs";
import { ISantri, IProfile } from "../../types";
import { useGetIdentity } from "@refinedev/core";

export const KesehatanCreate = () => {
    const { formProps, saveButtonProps } = useForm();
    const { data: user } = useGetIdentity<IProfile>();

    const { selectProps: santriSelectProps } = useSelect<ISantri>({
        resource: "santri",
        optionLabel: "nama",
        optionValue: "nis",
        onSearch: (value) => [{ field: "nama", operator: "contains", value }, { field: "nis", operator: "contains", value }],
    });

    return (
        <Create saveButtonProps={saveButtonProps} title="Catat Kunjungan UKS / Sakit">
            <Form 
                {...formProps} 
                layout="vertical"
                initialValues={{
                    tanggal: dayjs(),
                    dicatat_oleh_id: user?.id
                }}
            >
                <Form.Item name="dicatat_oleh_id" hidden><Input /></Form.Item>

                <Row gutter={24}>
                    <Col xs={24} md={12}>
                        <Card title="Data Pasien" bordered={false} className="shadow-sm mb-6">
                            <Form.Item 
                                label="Nama Santri" 
                                name="santri_nis" 
                                rules={[{ required: true, message: "Siapa yang sakit?" }]}
                            >
                                <Select 
                                    {...santriSelectProps} 
                                    showSearch 
                                    placeholder="Cari Santri..."
                                    filterOption={false}
                                />
                            </Form.Item>

                            <Form.Item 
                                label="Tanggal Periksa" 
                                name="tanggal" 
                                rules={[{ required: true }]}
                                getValueProps={(value) => ({ value: value ? dayjs(value) : "" })}
                            >
                                <DatePicker style={{ width: "100%" }} format="DD MMMM YYYY" />
                            </Form.Item>
                        </Card>
                    </Col>
                    <Col xs={24} md={12}>
                        <Card title="Diagnosa & Penanganan" bordered={false} className="shadow-sm mb-6">
                            <Form.Item 
                                label="Keluhan / Gejala" 
                                name="keluhan" 
                                rules={[{ required: true, message: "Keluhan wajib diisi" }]}
                                help="Contoh: Demam tinggi, Gatal-gatal di tangan, Pusing"
                            >
                                <Input placeholder="Apa yang dirasakan santri?" />
                            </Form.Item>

                            <Form.Item 
                                label="Tindakan / Obat yang Diberikan" 
                                name="tindakan" 
                                rules={[{ required: true }]}
                                help="Contoh: Paracetamol 500mg, Istirahat di kamar, Dirujuk ke RSUD"
                            >
                                <Input.TextArea rows={2} placeholder="Tindakan yang dilakukan..." />
                            </Form.Item>

                            <Form.Item label="Catatan Tambahan (Opsional)" name="catatan">
                                <Input.TextArea rows={2} placeholder="Keterangan lain..." />
                            </Form.Item>
                        </Card>
                    </Col>
                </Row>
            </Form>
        </Create>
    );
};