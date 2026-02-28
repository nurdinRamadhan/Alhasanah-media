import { Edit, useForm } from "@refinedev/antd";
import { Form, Input, Select, DatePicker, Row, Col } from "antd";
import dayjs from "dayjs";
import { ISantri } from "../../types";

export const SantriEdit = () => {
    // HAPUS queryResult dari sini agar tidak error
    const { formProps, saveButtonProps } = useForm<ISantri>();

    return (
        <Edit saveButtonProps={saveButtonProps}>
            <Form {...formProps} layout="vertical">
                 <Form.Item
                    label="NIS"
                    name="nis"
                    help="NIS tidak bisa diubah setelah dibuat."
                >
                    <Input disabled />
                </Form.Item>

                <Form.Item label="Nama Lengkap" name="nama" rules={[{ required: true }]}>
                    <Input />
                </Form.Item>

                <Row gutter={16}>
                    <Col span={8}>
                        <Form.Item label="Kelas" name="kelas">
                             <Select options={[
                                { label: "Kelas 1", value: "1" },
                                { label: "Kelas 2", value: "2" },
                                { label: "Kelas 3", value: "3" },
                            ]} />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item label="Takhasus" name="Takhasus">
                            <Select options={[
                                { label: "Kitab", value: "KITAB" },
                                { label: "Tahfidz", value: "TAHFIDZ" },
                            ]} />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item label="Status" name="status_santri">
                            <Select options={[
                                { label: "Aktif", value: "AKTIF" },
                                { label: "Lulus", value: "LULUS" },
                                { label: "Keluar", value: "KELUAR" },
                                { label: "Alumni", value: "ALUMNI" },
                            ]} />
                        </Form.Item>
                    </Col>
                </Row>

                {/* LOGIKA TANGGAL DIPINDAH KE SINI (getValueProps) */}
                <Form.Item 
                    label="Tanggal Lahir" 
                    name="tanggal_lahir"
                    getValueProps={(value) => ({
                        // Jika ada value dari DB (string), convert ke dayjs. Jika tidak, kosong.
                        value: value ? dayjs(value) : "",
                    })}
                >
                    <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                </Form.Item>

                <Form.Item label="Alamat Lengkap" name="alamat_lengkap">
                    <Input.TextArea rows={2} />
                </Form.Item>
                
                <Form.Item label="Nama Ayah" name="ayah">
                    <Input />
                </Form.Item>
            </Form>
        </Edit>
    );
};