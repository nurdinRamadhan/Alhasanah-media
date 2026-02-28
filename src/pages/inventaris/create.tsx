import React from "react";
import { Create, useForm, useSelect } from "@refinedev/antd";
import { Form, Input, Select, DatePicker, Card, Row, Col, InputNumber, Divider } from "antd";
import dayjs from "dayjs";
import { IInventaris, IKategoriBarang, ILokasiAset } from "../../types";
import { useGetIdentity } from "@refinedev/core";
import { IProfile } from "../../types";

export const InventarisCreate = () => {
    const { formProps, saveButtonProps } = useForm();
    const { data: user } = useGetIdentity<IProfile>();

    const { selectProps: kategoriProps } = useSelect<IKategoriBarang>({
        resource: "kategori_barang",
        optionLabel: "nama_kategori",
        optionValue: "id",
    });

    const { selectProps: lokasiProps } = useSelect<ILokasiAset>({
        resource: "lokasi_aset",
        optionLabel: "nama_lokasi",
        optionValue: "id",
    });

    return (
        <Create saveButtonProps={saveButtonProps} title="Registrasi Aset Baru">
            <Form 
                {...formProps} 
                layout="vertical"
                initialValues={{
                    tanggal_perolehan: dayjs(),
                    dicatat_oleh_id: user?.id,
                    kondisi: "BAIK",
                    jumlah: 1,
                    satuan: "Unit",
                    sumber_dana: "YAYASAN"
                }}
            >
                <Form.Item name="dicatat_oleh_id" hidden><Input /></Form.Item>

                <Row gutter={24}>
                    <Col xs={24} md={14}>
                        <Card title="Detail Barang" bordered={false} className="shadow-sm mb-6">
                            <Form.Item 
                                label="Kode Barang (Inventory ID)" 
                                name="kode_barang" 
                                rules={[{ required: true }]}
                                help="Format saran: KATEGORI-TAHUN-NOURUT (Contoh: ELK-2026-055)"
                            >
                                <Input placeholder="ELK-2026-XXX" style={{ fontFamily: 'monospace', fontWeight: 'bold' }} />
                            </Form.Item>

                            <Form.Item label="Nama Barang" name="nama_barang" rules={[{ required: true }]}>
                                <Input placeholder="Contoh: Laptop Asus Vivobook" />
                            </Form.Item>

                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item label="Kategori" name="kategori_id" rules={[{ required: true }]}>
                                        <Select {...kategoriProps} placeholder="Pilih Kategori" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item label="Lokasi Penempatan" name="lokasi_id" rules={[{ required: true }]}>
                                        <Select {...lokasiProps} placeholder="Pilih Ruangan" />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Form.Item label="Spesifikasi / Deskripsi" name="spesifikasi">
                                <Input.TextArea rows={3} placeholder="Warna, Serial Number, Spesifikasi Teknis..." />
                            </Form.Item>
                        </Card>
                    </Col>

                    <Col xs={24} md={10}>
                        <Card title="Nilai & Sumber" bordered={false} className="shadow-sm mb-6">
                            <Form.Item label="Sumber Dana" name="sumber_dana" rules={[{ required: true }]}>
                                <Select options={[
                                    { label: "Yayasan (Mandiri)", value: "YAYASAN" },
                                    { label: "Dana BOS / Pemerintah", value: "BOS" },
                                    { label: "Wakaf Umat", value: "WAKAF" },
                                    { label: "Hibah / Sumbangan", value: "HIBAH" },
                                ]} />
                            </Form.Item>

                            <Form.Item 
                                label="Tanggal Perolehan" 
                                name="tanggal_perolehan" 
                                rules={[{ required: true }]}
                                getValueProps={(v) => ({ value: v ? dayjs(v) : "" })}
                            >
                                <DatePicker style={{ width: '100%' }} format="DD MMMM YYYY" />
                            </Form.Item>

                            <Divider />

                            <Form.Item 
                                label="Harga Perolehan (Rp)" 
                                name="harga_perolehan" 
                                rules={[{ required: true }]}
                                help="Masukkan harga total pembelian"
                            >
                                <InputNumber 
                                    style={{ width: '100%' }} 
                                    formatter={value => `Rp ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                                    parser={value => value!.replace(/\Rp\s?|(\.*)/g, '')}
                                />
                            </Form.Item>

                             <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item label="Jumlah" name="jumlah" rules={[{ required: true }]}>
                                        <InputNumber min={1} style={{ width: '100%' }} />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item label="Satuan" name="satuan">
                                        <Input placeholder="Unit/Pcs" />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Form.Item label="Kondisi Awal" name="kondisi">
                                <Select options={[
                                    { label: "Baik", value: "BAIK" },
                                    { label: "Rusak Ringan", value: "RUSAK_RINGAN" },
                                ]} />
                            </Form.Item>
                        </Card>
                    </Col>
                </Row>
            </Form>
        </Create>
    );
};