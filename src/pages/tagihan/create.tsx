import React from "react";
import { Create, useForm, useSelect } from "@refinedev/antd";
import { Form, Input, Select, DatePicker, InputNumber, Card, Row, Col, Divider } from "antd";
import { ITagihanSantri, ISantri } from "../../types";
import dayjs from "dayjs";
import { useGetIdentity } from "@refinedev/core";

export const TagihanCreate = () => {
    const { formProps, saveButtonProps, form } = useForm<ITagihanSantri>();

    const { selectProps: santriSelectProps } = useSelect<ISantri>({
        resource: "santri",
        optionLabel: "nama",
        optionValue: "nis",
        filters: [{ field: "status_santri", operator: "eq", value: "AKTIF" }],
        onSearch: (value) => [{ field: "nama", operator: "contains", value }],
    });

    const handleNominalChange = (value: number | null) => {
        form.setFieldValue("sisa_tagihan", value);
    };

    return (
        <Create saveButtonProps={saveButtonProps} title="Buat Tagihan Personal">
            <Form 
                {...formProps} 
                layout="vertical"
                initialValues={{
                    tanggal_jatuh_tempo: dayjs().add(1, 'month'),
                    status: 'BELUM',
                }}
            >
                <Row gutter={24}>
                    <Col xs={24} md={12}>
                        <Card title="Target Tagihan" bordered={false} className="shadow-sm">
                            <Form.Item 
                                label="Pilih Santri" 
                                name="santri_nis" 
                                rules={[{ required: true, message: "Wajib pilih santri" }]}
                                help="Tagihan akan ditujukan ke wali santri ini"
                            >
                                <Select 
                                    {...santriSelectProps} 
                                    showSearch
                                    placeholder="Cari Santri..."
                                />
                            </Form.Item>

                            <Form.Item 
                                label="Deskripsi Tagihan" 
                                name="deskripsi_tagihan" 
                                rules={[{ required: true }]}
                                help="Contoh: Uang Gedung, Seragam, atau Infaq Pembangunan"
                            >
                                <Input placeholder="Masukkan keterangan tagihan" />
                            </Form.Item>

                             <Form.Item label="Jenis Pembayaran" name="jenis_pembayaran_id" hidden>
                                <Input /> 
                                {/* Jika Anda punya tabel master jenis_pembayaran, bisa pakai Select disini */}
                            </Form.Item>
                        </Card>
                    </Col>

                    <Col xs={24} md={12}>
                        <Card title="Rincian Biaya" bordered={false} className="shadow-sm">
                            <Form.Item 
                                label="Nominal Tagihan (Rp)" 
                                name="nominal_tagihan" 
                                rules={[{ required: true }]}
                            >
                                <InputNumber 
                                    style={{ width: "100%", fontSize: 16, fontWeight: 'bold' }} 
                                    formatter={(value) => `Rp ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                                    parser={(value) => value?.replace(/\Rp\s?|(\.*)/g, '') as unknown as number}
                                    onChange={handleNominalChange}
                                    placeholder="0"
                                />
                            </Form.Item>

                            {/* Hidden Sisa Tagihan */}
                            <Form.Item name="sisa_tagihan" hidden><InputNumber /></Form.Item>

                            <Form.Item 
                                label="Jatuh Tempo" 
                                name="tanggal_jatuh_tempo"
                                rules={[{ required: true }]}
                                getValueProps={(value) => ({ value: value ? dayjs(value) : "" })}
                            >
                                <DatePicker style={{ width: "100%" }} format="DD MMMM YYYY" />
                            </Form.Item>

                            <Form.Item label="Status Awal" name="status">
                                <Select options={[
                                    { label: "Belum Lunas", value: "BELUM" },
                                    { label: "Lunas (Manual)", value: "LUNAS" },
                                ]} />
                            </Form.Item>
                        </Card>
                    </Col>
                </Row>
            </Form>
        </Create>
    );
};