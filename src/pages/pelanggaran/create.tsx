import React from "react";
import { Create, useForm, useSelect } from "@refinedev/antd";
import { Form, Input, Select, DatePicker, InputNumber, Row, Col, Radio, Card } from "antd";
import dayjs from "dayjs";
import { ISantri, IProfile } from "../../types";
import { useGetIdentity } from "@refinedev/core";

export const PelanggaranCreate = () => {
    const { formProps, saveButtonProps } = useForm();
    const { data: user } = useGetIdentity<IProfile>();

    // Hook untuk mencari data santri (Searchable Select)
    const { selectProps: santriSelectProps } = useSelect<ISantri>({
        resource: "santri",
        optionLabel: "nama", // Yang tampil di dropdown
        optionValue: "nis",  // Yang disimpan ke database
        onSearch: (value) => [
            { field: "nama", operator: "contains", value },
            { field: "nis", operator: "contains", value }, // Bisa cari pakai NIS juga
        ],
    });

    return (
        <Create saveButtonProps={saveButtonProps} title="Catat Pelanggaran Baru">
            <Form 
                {...formProps} 
                layout="vertical"
                initialValues={{
                    tanggal: dayjs(),
                    poin: 5,
                    jenis_pelanggaran: "RINGAN",
                    dicatat_oleh_id: user?.id // Otomatis isi ID user login
                }}
            >
                {/* Hidden Field untuk ID Pencatat */}
                <Form.Item name="dicatat_oleh_id" hidden><Input /></Form.Item>

                <Row gutter={24}>
                    <Col xs={24} md={12}>
                        <Card title="Data Pelanggar" bordered={false} className="shadow-sm mb-6">
                            <Form.Item 
                                label="Nama Santri" 
                                name="santri_nis" 
                                rules={[{ required: true, message: "Pilih santri terlebih dahulu" }]}
                                help="Ketik nama atau NIS untuk mencari"
                            >
                                <Select 
                                    {...santriSelectProps} 
                                    showSearch
                                    placeholder="Cari Santri..."
                                    filterOption={false} // Matikan filter client-side, gunakan server-side search Refine
                                    notFoundContent="Santri tidak ditemukan"
                                />
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
                        <Card title="Detail Pelanggaran" bordered={false} className="shadow-sm mb-6">
                            <Form.Item label="Jenis Pelanggaran" name="jenis_pelanggaran">
                                <Radio.Group buttonStyle="solid">
                                    <Radio.Button value="RINGAN">Ringan</Radio.Button>
                                    <Radio.Button value="SEDANG">Sedang</Radio.Button>
                                    <Radio.Button value="BERAT">Berat</Radio.Button>
                                </Radio.Group>
                            </Form.Item>

                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item label="Poin Hukuman" name="poin" rules={[{ required: true }]}>
                                        <InputNumber min={1} max={100} style={{ width: "100%" }} />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <div className="pt-8 text-gray-500 text-xs">
                                        *Poin terakumulasi otomatis
                                    </div>
                                </Col>
                            </Row>

                            <Form.Item label="Bentuk Hukuman / Tindakan" name="hukuman" rules={[{ required: true }]}>
                                <Input placeholder="Contoh: Menghafal Surat Al-Mulk, Membersihkan Toilet" />
                            </Form.Item>

                            <Form.Item label="Catatan Tambahan (Kronologi)" name="catatan">
                                <Input.TextArea rows={3} placeholder="Jelaskan kronologi kejadian..." />
                            </Form.Item>
                        </Card>
                    </Col>
                </Row>
            </Form>
        </Create>
    );
};