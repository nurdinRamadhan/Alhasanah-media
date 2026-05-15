import { useEffect, useMemo, useState } from "react";
import { Edit } from "@refinedev/antd";
import { useNavigation } from "@refinedev/core";
import { useParams } from "react-router-dom";
import { Button, Col, DatePicker, Divider, Form, Input, InputNumber, Row, Select, Spin, Switch, message } from "antd";
import dayjs from "dayjs";
import { supabaseClient } from "../../utility/supabaseClient";
import { normalizeSantriEmisExtra, validateEmisPreflight } from "../../utility/emisMapping";
import { IndonesiaLocationFields } from "../../components/santri/IndonesiaLocationFields";
import { EmisExtraFields } from "../../components/santri/EmisExtraFields";
import {
    EDUCATION_OPTIONS,
    INCOME_OPTIONS,
    JOB_OPTIONS,
    PARENT_STATUS_OPTIONS,
    CITIZENSHIP_OPTIONS,
    RELIGION_OPTIONS,
    SPECIAL_NEEDS_OPTIONS,
    WALI_RELATIONSHIP_OPTIONS,
    kkRules,
    nikRules,
    nisnRules,
    nspRules,
    personNameRules,
    phoneRules,
} from "../../components/santri/emisOptions";

const text = (value: unknown) => (value === undefined || value === null ? undefined : String(value));

export const SantriEdit = () => {
    const { id } = useParams();
    const { show, list } = useNavigation();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const nis = useMemo(() => decodeURIComponent(id || ""), [id]);

    useEffect(() => {
        let active = true;
        if (!nis) return;

        const loadSecureDetail = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabaseClient.rpc("get_santri_detail_secure", {
                    p_nis: nis,
                    p_reason: "admin_panel_edit_load",
                });
                if (!active) return;
                if (error) throw error;
                const normalizedExtra = normalizeSantriEmisExtra(data?.emis_extra || {}, {
                    status_mukim: data?.status_mukim,
                    jurusan: data?.jurusan,
                    jarak_rumah_km: data?.jarak_rumah_km,
                });

                form.setFieldsValue({
                    ...data,
                    tanggal_lahir: data?.tanggal_lahir ? dayjs(data.tanggal_lahir) : null,
                    tanggal_masuk: data?.tanggal_masuk ? dayjs(data.tanggal_masuk) : null,
                    tanggal_lulus_keluar: data?.tanggal_lulus_keluar ? dayjs(data.tanggal_lulus_keluar) : null,
                    penerima_pip: Boolean(data?.penerima_pip),
                    penerima_beasiswa: Boolean(data?.penerima_beasiswa),
                    anak_ke: data?.anak_ke ? Number(data.anak_ke) : null,
                    geocode_status: data?.geocode_status || "PENDING",
                    emis_extra_fields: {
                        jenis_pendaftaran: "01",
                        transportasi: data?.status_mukim === "MUKIM" ? "01" : undefined,
                        ...normalizedExtra,
                    },
                });
            } catch (error: any) {
                message.error(error.message || "Gagal memuat data santri.");
            } finally {
                if (active) setLoading(false);
            }
        };

        void loadSecureDetail();

        return () => {
            active = false;
        };
    }, [form, nis]);

    const handleFinish = async (values: any) => {
        setSaving(true);
        try {
            const payload = {
                ...values,
                tanggal_lahir: values.tanggal_lahir ? values.tanggal_lahir.format("YYYY-MM-DD") : null,
                tanggal_masuk: values.tanggal_masuk ? values.tanggal_masuk.format("YYYY-MM-DD") : null,
                tanggal_lulus_keluar: values.tanggal_lulus_keluar ? values.tanggal_lulus_keluar.format("YYYY-MM-DD") : null,
                anak_ke: values.anak_ke ? String(values.anak_ke) : null,
                emis_extra: normalizeSantriEmisExtra(values.emis_extra_fields, {
                    status_mukim: values.status_mukim,
                    jurusan: values.jurusan,
                    jarak_rumah_km: values.jarak_rumah_km,
                }),
                nis: undefined,
                province_id: undefined,
                regency_id: undefined,
                village_id: undefined,
                kecamatan_nama: undefined,
                emis_extra_fields: undefined,
            };

            const preflightErrors = validateEmisPreflight({ ...values, ...payload });
            if (preflightErrors.length > 0) {
                throw new Error(`Validasi EMIS belum lengkap: ${preflightErrors.join(" ")}`);
            }

            const { error } = await supabaseClient.rpc("update_santri_secure", {
                p_nis: nis,
                p_payload: payload,
                p_reason: "admin_panel_edit_save",
            });

            if (error) throw error;
            message.success("Data santri dan kolom EMIS berhasil diperbarui.");
            show("santri", nis);
        } catch (error: any) {
            message.error(error.message || "Gagal menyimpan data santri.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Edit
            title="Edit Data Santri EMIS"
            saveButtonProps={{ loading: saving, onClick: () => form.submit() }}
            headerButtons={({ defaultButtons }) => (
                <>
                    {defaultButtons}
                    <Button onClick={() => list("santri")}>Kembali</Button>
                </>
            )}
        >
            <Spin spinning={loading}>
                <Form form={form} layout="vertical" onFinish={handleFinish}>
                    <Divider orientation="left">Identitas Utama</Divider>
                    <Row gutter={16}>
                        <Col xs={24} md={8}>
                            <Form.Item label="NIS" name="nis">
                                <Input disabled />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                            <Form.Item label="NSP" name="nsp" rules={nspRules}>
                                <Input placeholder="Nomor Statistik Pesantren" maxLength={12} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                            <Form.Item label="NISN" name="nisn" rules={nisnRules}>
                                <Input placeholder="NISN" maxLength={10} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                            <Form.Item label="No. KK" name="no_kk" rules={kkRules}>
                                <Input maxLength={16} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={16}>
                            <Form.Item label="Nama Lengkap" name="nama" rules={[{ required: true }]}>
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                            <Form.Item label="NIK" name="nik" rules={nikRules}>
                                <Input maxLength={16} />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col xs={24} md={8}>
                            <Form.Item label="Jenis Kelamin" name="jenis_kelamin">
                                <Select options={[{ label: "Laki-laki", value: "L" }, { label: "Perempuan", value: "P" }]} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                            <Form.Item label="Tempat Lahir" name="tempat_lahir">
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                            <Form.Item label="Tanggal Lahir" name="tanggal_lahir">
                                <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                            <Form.Item label="Agama" name="agama">
                                <Select disabled options={RELIGION_OPTIONS.filter((item) => item.value === "01")} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                            <Form.Item label="Kewarganegaraan" name="kewarganegaraan">
                                <Select options={CITIZENSHIP_OPTIONS} />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Divider orientation="left">Akademik Pesantren</Divider>
                    <Row gutter={16}>
                        <Col xs={24} md={6}>
                            <Form.Item label="Kelas" name="kelas">
                                <Select options={[1, 2, 3].map((n) => ({ label: `Kelas ${n}`, value: text(n) }))} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={6}>
                            <Form.Item label="Program" name="jurusan">
                                <Select options={[{ label: "Kitab", value: "KITAB" }, { label: "Tahfidz", value: "TAHFIDZ" }]} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={6}>
                            <Form.Item label="Status Santri" name="status_santri">
                                <Select options={["AKTIF", "LULUS", "KELUAR", "ALUMNI"].map((value) => ({ label: value, value }))} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={6}>
                            <Form.Item label="Status Mukim" name="status_mukim">
                                <Select allowClear options={[{ label: "Mukim", value: "MUKIM" }, { label: "Tidak Mukim", value: "TIDAK_MUKIM" }]} />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col xs={24} md={8}>
                            <Form.Item label="Tahun Masuk" name="tahun_masuk">
                                <InputNumber style={{ width: "100%" }} min={1900} max={2100} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                            <Form.Item label="Tanggal Masuk" name="tanggal_masuk">
                                <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                            <Form.Item label="Kebutuhan Khusus" name="kebutuhan_khusus">
                                <Select showSearch optionFilterProp="label" options={SPECIAL_NEEDS_OPTIONS} />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Divider orientation="left">Alamat EMIS</Divider>
                    <IndonesiaLocationFields form={form} />

                    <Divider orientation="left">Orang Tua dan Wali</Divider>
                    <Row gutter={16}>
                        <Col xs={24} md={8}><Form.Item label="Nama Ayah" name="ayah" rules={personNameRules}><Input /></Form.Item></Col>
                        <Col xs={24} md={8}><Form.Item label="NIK Ayah" name="nik_ayah" rules={nikRules}><Input maxLength={16} /></Form.Item></Col>
                        <Col xs={24} md={8}>
                            <Form.Item label="Status Ayah" name="status_ayah">
                                <Select allowClear options={PARENT_STATUS_OPTIONS} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={8}><Form.Item label="Pendidikan Ayah" name="pendidikan_ayah"><Select allowClear options={EDUCATION_OPTIONS} /></Form.Item></Col>
                        <Col xs={24} md={8}><Form.Item label="Pekerjaan Ayah" name="pekerjaan_ayah"><Select allowClear options={JOB_OPTIONS} /></Form.Item></Col>
                        <Col xs={24} md={8}><Form.Item label="Penghasilan Ayah" name="penghasilan_ayah"><Select allowClear options={INCOME_OPTIONS} /></Form.Item></Col>
                    </Row>
                    <Row gutter={16}>
                        <Col xs={24} md={8}><Form.Item label="Nama Ibu" name="ibu" rules={personNameRules}><Input /></Form.Item></Col>
                        <Col xs={24} md={8}><Form.Item label="NIK Ibu" name="nik_ibu" rules={nikRules}><Input maxLength={16} /></Form.Item></Col>
                        <Col xs={24} md={8}><Form.Item label="Status Ibu" name="status_ibu"><Select allowClear options={PARENT_STATUS_OPTIONS} /></Form.Item></Col>
                        <Col xs={24} md={8}><Form.Item label="Pendidikan Ibu" name="pendidikan_ibu"><Select allowClear options={EDUCATION_OPTIONS} /></Form.Item></Col>
                        <Col xs={24} md={8}><Form.Item label="Pekerjaan Ibu" name="pekerjaan_ibu"><Select allowClear options={JOB_OPTIONS} /></Form.Item></Col>
                        <Col xs={24} md={8}><Form.Item label="Penghasilan Ibu" name="penghasilan_ibu"><Select allowClear options={INCOME_OPTIONS} /></Form.Item></Col>
                    </Row>
                    <Row gutter={16}>
                        <Col xs={24} md={8}><Form.Item label="Nama Wali" name="nama_wali" rules={personNameRules}><Input /></Form.Item></Col>
                        <Col xs={24} md={8}><Form.Item label="NIK Wali" name="nik_wali" rules={nikRules}><Input maxLength={16} /></Form.Item></Col>
                        <Col xs={24} md={8}><Form.Item label="Hubungan Wali" name="hubungan_wali"><Select allowClear options={WALI_RELATIONSHIP_OPTIONS} /></Form.Item></Col>
                        <Col xs={24} md={8}><Form.Item label="No. Kontak Wali" name="no_kontak_wali" rules={phoneRules}><Input /></Form.Item></Col>
                        <Col xs={24} md={8}><Form.Item label="Pendidikan Wali" name="pendidikan_wali"><Select allowClear options={EDUCATION_OPTIONS} /></Form.Item></Col>
                        <Col xs={24} md={8}><Form.Item label="Pekerjaan Wali" name="pekerjaan_wali"><Select allowClear options={JOB_OPTIONS} /></Form.Item></Col>
                        <Col xs={24} md={8}><Form.Item label="Penghasilan Wali" name="penghasilan_wali"><Select allowClear options={INCOME_OPTIONS} /></Form.Item></Col>
                    </Row>

                    <Divider orientation="left">Bantuan</Divider>
                    <Row gutter={16}>
                        <Col xs={24} md={6}>
                            <Form.Item label="Penerima PIP" name="penerima_pip" valuePropName="checked">
                                <Switch />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={10}>
                            <Form.Item label="No. KIP" name="no_kip">
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                            <Form.Item label="Penerima Beasiswa" name="penerima_beasiswa" valuePropName="checked">
                                <Switch />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item label="Jenis Beasiswa" name="jenis_beasiswa">
                                <Input />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Divider orientation="left">Data Tambahan EMIS</Divider>
                    <EmisExtraFields />
                </Form>
            </Spin>
        </Edit>
    );
};
