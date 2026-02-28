import React from "react";
import { Create, useForm, useSelect } from "@refinedev/antd";
import { Form, Input, Select, DatePicker, Radio, Card, Row, Col } from "antd";
import dayjs from "dayjs";
import { ISantri, IProfile } from "../../types";
import { useGetIdentity } from "@refinedev/core";

export const PerizinanCreate = () => {
    const { formProps, saveButtonProps } = useForm();
    const { data: user } = useGetIdentity<IProfile>();

    const { selectProps: santriSelectProps } = useSelect<ISantri>({
        resource: "santri",
        optionLabel: "nama",
        optionValue: "nis",
        onSearch: (value) => [
            { field: "nama", operator: "contains", value },
            { field: "nis", operator: "contains", value },
        ],
    });

    return (
        <Create saveButtonProps={saveButtonProps} title="Formulir Perizinan Keluar">
            <Form 
                {...formProps} 
                layout="vertical"
                initialValues={{
                    tanggal: dayjs(), // Tanggal pengajuan
                    status: "PENDING",
                    dicatat_oleh_id: user?.id
                }}
            >
                {/* Hidden Fields */}
                <Form.Item name="dicatat_oleh_id" hidden><Input /></Form.Item>
                <Form.Item name="status" hidden><Input /></Form.Item>
                <Form.Item name="tanggal" hidden><DatePicker /></Form.Item>

                <Row gutter={24}>
                    <Col xs={24} md={12}>
                        <Card title="Data Pemohon" bordered={false} className="shadow-sm">
                            <Form.Item 
                                label="Nama Santri" 
                                name="santri_nis" 
                                rules={[{ required: true, message: "Pilih santri" }]}
                            >
                                <Select 
                                    {...santriSelectProps} 
                                    showSearch 
                                    placeholder="Cari Santri..."
                                    filterOption={false}
                                    notFoundContent="Santri tidak ditemukan"
                                />
                            </Form.Item>

                            <Form.Item 
                                label="Rencana Tanggal Kembali" 
                                name="tanggal_kembali" 
                                rules={[{ required: true, message: "Kapan santri akan kembali?" }]}
                                getValueProps={(value) => ({ value: value ? dayjs(value) : "" })}
                            >
                                <DatePicker 
                                    style={{ width: "100%" }} 
                                    format="DD MMMM YYYY" 
                                    disabledDate={(current) => current && current < dayjs().endOf('day')}
                                />
                            </Form.Item>
                        </Card>
                    </Col>
                    <Col xs={24} md={12}>
                        <Card title="Detail Izin" bordered={false} className="shadow-sm">
                            <Form.Item label="Jenis Izin" name="jenis_izin" rules={[{ required: true }]}>
                                <Radio.Group buttonStyle="solid">
                                    <Radio.Button value="SAKIT">Sakit (Pulang)</Radio.Button>
                                    <Radio.Button value="PULANG">Pulang (Libur)</Radio.Button>
                                    <Radio.Button value="KELUAR">Keluar Sebentar</Radio.Button>
                                </Radio.Group>
                            </Form.Item>

                            <Form.Item 
                                label="Keterangan / Alasan" 
                                name="keterangan" 
                                rules={[{ required: true, message: "Alasan wajib diisi" }]}
                            >
                                <Input.TextArea rows={4} placeholder="Contoh: Orang tua sakit keras, atau check-up dokter gigi" />
                            </Form.Item>
                        </Card>
                    </Col>
                </Row>
            </Form>
        </Create>
    );
};