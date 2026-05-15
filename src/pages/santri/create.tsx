import React, { useState } from "react";
import { useForm } from "@refinedev/antd";
import { useGetIdentity, useNavigation } from "@refinedev/core";
import {
    Alert, Avatar, Button, Card, Col, DatePicker, Divider, Form, Input, InputNumber,
    Row, Select, Space, Switch, Typography, Upload, message, theme,
} from "antd";
import {
    CameraOutlined, CloseOutlined, LoadingOutlined, LockOutlined, MailOutlined,
    NumberOutlined, PhoneOutlined, SaveOutlined, UserOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { supabaseClient } from "../../utility/supabaseClient";
import { logActivity } from "../../utility/logger";
import { IUserIdentity } from "../../types";
import { formatHijri } from "../../utility/dateHelper";
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

const { Title, Text } = Typography;

const asDate = (value: any) => value ? value.format("YYYY-MM-DD") : null;
const asString = (value: any) => value === undefined || value === null || value === "" ? null : String(value);
const ACCOUNT_OWNER_OPTIONS = [
    { label: "Ayah", value: "AYAH" },
    { label: "Ibu", value: "IBU" },
    { label: "Wali Lain", value: "WALI_LAIN" },
];

export const SantriCreate = () => {
    const { token } = theme.useToken();
    const { list } = useNavigation();
    const { data: user } = useGetIdentity<IUserIdentity>();
    const [loadingUpload, setLoadingUpload] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [fileList, setFileList] = useState<any[]>([]);

    const { formProps, form } = useForm();
    const selectedBirthDate = Form.useWatch("tanggal_lahir", form);
    const accountOwner = Form.useWatch("penanggung_jawab_aplikasi", form) || "AYAH";

    const customOnFinish = async (values: any) => {
        setSubmitting(true);
        let finalFotoUrl = null;

        try {
            if (fileList.length > 0) {
                setLoadingUpload(true);
                const file = fileList[0].originFileObj || fileList[0];
                if (!file) throw new Error("File foto rusak/tidak terbaca.");

                const formData = new FormData();
                formData.append("nis", values.nis);
                formData.append("file", file);

                const { data: uploadData, error: uploadError } = await supabaseClient.functions.invoke("upload-santri-photo", {
                    body: formData,
                });

                if (uploadError) {
                    const errorBody = await uploadError.context?.json();
                    throw new Error("Gagal upload foto: " + (errorBody?.error || uploadError.message));
                }

                finalFotoUrl = uploadData.publicUrl;
                setLoadingUpload(false);
            }

            const emisExtra = normalizeSantriEmisExtra(values.emis_extra_fields, {
                status_mukim: values.status_mukim,
                jurusan: values.jurusan,
                jarak_rumah_km: values.jarak_rumah_km,
            });
            const hasAddressForGeocode = values.alamat_lengkap || values.desa_kelurahan || values.kabupaten_kota || values.provinsi;
            const effectiveWali = values.penanggung_jawab_aplikasi === "IBU"
                ? {
                    nama_wali: values.ibu,
                    nik_wali: values.nik_ibu,
                    hubungan_wali: null,
                    hubungan_wali_label: "Ibu Kandung",
                    pendidikan_wali: values.pendidikan_ibu,
                    pekerjaan_wali: values.pekerjaan_ibu,
                    penghasilan_wali: values.penghasilan_ibu,
                }
                : values.penanggung_jawab_aplikasi === "WALI_LAIN"
                    ? {
                        nama_wali: values.nama_wali,
                        nik_wali: values.nik_wali,
                        hubungan_wali: values.hubungan_wali,
                        hubungan_wali_label: values.hubungan_wali,
                        pendidikan_wali: values.pendidikan_wali,
                        pekerjaan_wali: values.pekerjaan_wali,
                        penghasilan_wali: values.penghasilan_wali,
                    }
                    : {
                        nama_wali: values.ayah,
                        nik_wali: values.nik_ayah,
                        hubungan_wali: null,
                        hubungan_wali_label: "Ayah Kandung",
                        pendidikan_wali: values.pendidikan_ayah,
                        pekerjaan_wali: values.pekerjaan_ayah,
                        penghasilan_wali: values.penghasilan_ayah,
                    };

            if (!effectiveWali.nama_wali) {
                throw new Error("Nama penanggung jawab aplikasi wajib diisi.");
            }

            const dataSantri = {
                nis: values.nis,
                nsp: values.nsp,
                nisn: values.nisn,
                no_kk: values.no_kk,
                nik: values.nik,
                nama: values.nama,
                kelas: values.kelas,
                jurusan: values.jurusan,
                jenis_kelamin: values.jenis_kelamin,
                status_santri: values.status_santri,
                status_spp: values.status_spp,
                status_mukim: values.status_mukim,
                agama: values.agama,
                kewarganegaraan: values.kewarganegaraan,
                pembimbing: values.pembimbing,
                hafalan_kitab: values.hafalan_kitab,
                total_hafalan: asString(values.total_hafalan),
                anak_ke: asString(values.anak_ke),
                tempat_lahir: values.tempat_lahir,
                tanggal_lahir: asDate(values.tanggal_lahir),
                tahun_masuk: values.tahun_masuk,
                tanggal_masuk: asDate(values.tanggal_masuk),
                kebutuhan_khusus: values.kebutuhan_khusus,
                alamat_lengkap: values.alamat_lengkap,
                rt: values.rt,
                rw: values.rw,
                desa_kelurahan: values.desa_kelurahan,
                kecamatan_id: values.kecamatan_id,
                kabupaten_kota: values.kabupaten_kota,
                provinsi: values.provinsi,
                kode_pos: values.kode_pos,
                jarak_rumah_km: values.jarak_rumah_km,
                latitude: values.latitude,
                longitude: values.longitude,
                geocode_status: values.geocode_status || (hasAddressForGeocode ? "PENDING" : null),
                geocode_provider: values.geocode_provider,
                geocode_confidence: values.geocode_confidence,
                ayah: values.ayah,
                nik_ayah: values.nik_ayah,
                status_ayah: values.status_ayah,
                pendidikan_ayah: values.pendidikan_ayah,
                pekerjaan_ayah: values.pekerjaan_ayah,
                penghasilan_ayah: values.penghasilan_ayah,
                ibu: values.ibu,
                nik_ibu: values.nik_ibu,
                status_ibu: values.status_ibu,
                pendidikan_ibu: values.pendidikan_ibu,
                pekerjaan_ibu: values.pekerjaan_ibu,
                penghasilan_ibu: values.penghasilan_ibu,
                nama_wali: effectiveWali.nama_wali,
                nik_wali: effectiveWali.nik_wali,
                hubungan_wali: effectiveWali.hubungan_wali_label || effectiveWali.hubungan_wali,
                no_kontak_wali: values.no_kontak_wali,
                pendidikan_wali: effectiveWali.pendidikan_wali,
                pekerjaan_wali: effectiveWali.pekerjaan_wali,
                penghasilan_wali: effectiveWali.penghasilan_wali,
                penerima_pip: Boolean(values.penerima_pip),
                no_kip: values.no_kip,
                penerima_beasiswa: Boolean(values.penerima_beasiswa),
                jenis_beasiswa: values.jenis_beasiswa,
                foto_url: finalFotoUrl,
                emis_extra: emisExtra,
            };

            const preflightErrors = validateEmisPreflight(dataSantri);
            if (preflightErrors.length > 0) {
                throw new Error(`Validasi EMIS belum lengkap: ${preflightErrors.join(" ")}`);
            }

            const { error } = await supabaseClient.functions.invoke("create-user-wali", {
                body: {
                    emailWali: values.email_wali,
                    passwordWali: values.password_wali,
                    namaWali: effectiveWali.nama_wali,
                    noHpWali: values.no_kontak_wali,
                    dataSantri,
                },
            });

            if (error) {
                const errorBody = await error.context?.json();
                throw new Error(errorBody?.error || error.message || "Gagal menghubungi server.");
            }

            await logActivity({
                user,
                action: "CREATE",
                resource: "santri",
                record_id: values.nis,
                details: { nis: values.nis, kelas: values.kelas, jurusan: values.jurusan },
            });

            message.success("Berhasil! Akun Wali & Data EMIS santri telah dibuat.");
            list("santri");
        } catch (error: any) {
            message.error(error.message || "Terjadi kesalahan sistem.");
            setLoadingUpload(false);
        } finally {
            setSubmitting(false);
        }
    };

    const handleUploadChange = (info: any) => {
        setFileList([info.file]);
        if (info.file.originFileObj) {
            const reader = new FileReader();
            reader.addEventListener("load", () => setImageUrl(reader.result as string));
            reader.readAsDataURL(info.file.originFileObj);
        }
    };

    const uploadButton = (
        <div style={{ color: token.colorTextSecondary }}>
            {loadingUpload ? <LoadingOutlined /> : <CameraOutlined style={{ fontSize: 24, marginBottom: 8 }} />}
            <div style={{ marginTop: 8 }}>Upload Foto</div>
        </div>
    );

    return (
        <div style={{ padding: 24, paddingBottom: 100 }}>
            <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
                <Col>
                    <Title level={3} style={{ margin: 0 }}>Registrasi Santri Baru EMIS</Title>
                    <Text style={{ color: token.colorTextSecondary }}>Input data santri standar EMIS Pesantren dan buat akun wali otomatis.</Text>
                </Col>
                <Col>
                    <Space>
                        <Button icon={<CloseOutlined />} onClick={() => list("santri")} disabled={submitting}>Batal</Button>
                        <Button type="primary" icon={<SaveOutlined />} loading={submitting} onClick={() => form.submit()}>Simpan Data</Button>
                    </Space>
                </Col>
            </Row>

            <Form
                {...formProps}
                form={form}
                layout="vertical"
                onFinish={customOnFinish}
                initialValues={{
                    status_santri: "AKTIF",
                    jenis_kelamin: "L",
                    status_spp: "REGULER",
                    jurusan: "KITAB",
                    agama: "01",
                    kewarganegaraan: "WNI",
                    kebutuhan_khusus: "01",
                    status_mukim: "MUKIM",
                    tahun_masuk: new Date().getFullYear(),
                    geocode_status: "PENDING",
                    penerima_pip: false,
                    penerima_beasiswa: false,
                    penanggung_jawab_aplikasi: "AYAH",
                    emis_extra_fields: {
                        jenis_pendaftaran: "01",
                        tinggal_bersama: "4",
                        transportasi: "01",
                    },
                }}
            >
                <Row gutter={[24, 24]}>
                    <Col xs={24} lg={8}>
                        <Card bordered={false} style={{ textAlign: "center", marginBottom: 24, boxShadow: token.boxShadowTertiary }}>
                            <Form.Item style={{ marginBottom: 0 }}>
                                <Upload name="avatar" listType="picture-card" className="avatar-uploader" showUploadList={false} beforeUpload={() => false} onChange={handleUploadChange}>
                                    {imageUrl ? <Avatar src={imageUrl} size={140} shape="circle" /> : uploadButton}
                                </Upload>
                            </Form.Item>
                            <Text type="secondary" style={{ fontSize: 12 }}>Format: JPG/PNG, Max 2MB</Text>
                        </Card>

                        <Card title="Informasi Pesantren" bordered={false} style={{ boxShadow: token.boxShadowTertiary }}>
                            <Form.Item label="Nomor Induk Santri (NIS)" name="nis" rules={[{ required: true, message: "NIS wajib diisi" }]}>
                                <Input prefix={<NumberOutlined style={{ color: token.colorTextQuaternary }} />} />
                            </Form.Item>
                            <Form.Item label="NSP" name="nsp" rules={nspRules}><Input maxLength={12} placeholder="Nomor Statistik Pesantren" /></Form.Item>
                            <Form.Item label="NISN" name="nisn" rules={nisnRules}><Input maxLength={10} /></Form.Item>
                            <Form.Item label="No. KK" name="no_kk" rules={kkRules}><Input maxLength={16} /></Form.Item>
                            <Row gutter={16}>
                                <Col span={12}><Form.Item label="Kelas" name="kelas" rules={[{ required: true }]}><Select options={[1, 2, 3].map((n) => ({ label: `Kelas ${n}`, value: String(n) }))} /></Form.Item></Col>
                                <Col span={12}><Form.Item label="Program" name="jurusan" rules={[{ required: true }]}><Select options={[{ label: "Kitab", value: "KITAB" }, { label: "Tahfidz", value: "TAHFIDZ" }]} /></Form.Item></Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={12}><Form.Item label="Status Santri" name="status_santri"><Select options={["AKTIF", "LULUS", "KELUAR", "ALUMNI"].map((value) => ({ label: value, value }))} /></Form.Item></Col>
                                <Col span={12}><Form.Item label="Status Mukim" name="status_mukim"><Select options={[{ label: "Mukim", value: "MUKIM" }, { label: "Tidak Mukim", value: "TIDAK_MUKIM" }]} /></Form.Item></Col>
                            </Row>
                            <Form.Item label="Ustadz Pembimbing" name="pembimbing"><Input prefix={<UserOutlined style={{ color: token.colorTextQuaternary }} />} /></Form.Item>
                            <Row gutter={16}>
                                <Col span={12}><Form.Item label="Tahun Masuk" name="tahun_masuk"><InputNumber min={1900} max={2100} style={{ width: "100%" }} /></Form.Item></Col>
                                <Col span={12}><Form.Item label="Tanggal Masuk" name="tanggal_masuk"><DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" /></Form.Item></Col>
                            </Row>
                            <Row gutter={16}>
                                <Col span={12}><Form.Item label="Hafalan (Juz)" name="total_hafalan"><InputNumber min={0} max={30} style={{ width: "100%" }} /></Form.Item></Col>
                                <Col span={12}><Form.Item label="Kitab Selesai" name="hafalan_kitab"><Input /></Form.Item></Col>
                            </Row>
                        </Card>
                    </Col>

                    <Col xs={24} lg={16}>
                        <Card title="Identitas Pribadi" bordered={false} style={{ marginBottom: 24, boxShadow: token.boxShadowTertiary }}>
                            <Row gutter={16}>
                                <Col xs={24} md={16}><Form.Item label="Nama Lengkap" name="nama" rules={[{ required: true }]}><Input /></Form.Item></Col>
                                <Col xs={24} md={8}><Form.Item label="NIK" name="nik" rules={nikRules}><Input maxLength={16} /></Form.Item></Col>
                            </Row>
                            <Row gutter={16}>
                                <Col xs={24} md={8}><Form.Item label="Tempat Lahir" name="tempat_lahir"><Input /></Form.Item></Col>
                                <Col xs={24} md={8}>
                                    <Form.Item label="Tanggal Lahir" name="tanggal_lahir" help={selectedBirthDate && <Text type="success" style={{ fontSize: 11 }}>Hijriah: <b>{formatHijri(selectedBirthDate)}</b></Text>}>
                                        <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
                                    </Form.Item>
                                </Col>
                                <Col xs={12} md={4}><Form.Item label="Gender" name="jenis_kelamin"><Select options={[{ label: "Laki-laki", value: "L" }, { label: "Perempuan", value: "P" }]} /></Form.Item></Col>
                                <Col xs={12} md={4}><Form.Item label="Anak Ke" name="anak_ke"><InputNumber min={1} style={{ width: "100%" }} /></Form.Item></Col>
                            </Row>
                            <Row gutter={16}>
                                <Col xs={12} md={6}><Form.Item label="Agama" name="agama"><Select disabled options={RELIGION_OPTIONS.filter((item) => item.value === "01")} /></Form.Item></Col>
                                <Col xs={12} md={6}><Form.Item label="Kewarganegaraan" name="kewarganegaraan"><Select options={CITIZENSHIP_OPTIONS} /></Form.Item></Col>
                                <Col xs={24} md={12}><Form.Item label="Kebutuhan Khusus" name="kebutuhan_khusus"><Select showSearch optionFilterProp="label" options={SPECIAL_NEEDS_OPTIONS} /></Form.Item></Col>
                            </Row>
                        </Card>

                        <Card title="Alamat dan Geocode" bordered={false} style={{ marginBottom: 24, boxShadow: token.boxShadowTertiary }}>
                            <IndonesiaLocationFields form={form} />
                        </Card>

                        <Card title="Orang Tua dan Wali" bordered={false} style={{ marginBottom: 24, boxShadow: token.boxShadowTertiary }}>
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
                            <Divider dashed />
                            <Form.Item label="Penanggung Jawab Aplikasi" name="penanggung_jawab_aplikasi" rules={[{ required: true }]}>
                                <Select options={ACCOUNT_OWNER_OPTIONS} />
                            </Form.Item>
                            {accountOwner !== "WALI_LAIN" && (
                                <Alert
                                    type="info"
                                    showIcon
                                    style={{ marginBottom: 16 }}
                                    message={accountOwner === "IBU" ? "Akun aplikasi akan memakai data ibu." : "Akun aplikasi akan memakai data ayah."}
                                    description="Data wali EMIS tidak dipaksa diisi terpisah. Nomor HP, email, dan password tetap wajib untuk akun Android."
                                />
                            )}
                            {accountOwner === "WALI_LAIN" && (
                            <Row gutter={16}>
                                <Col xs={24} md={8}><Form.Item label="Nama Wali" name="nama_wali" rules={[{ required: true }, ...personNameRules]}><Input /></Form.Item></Col>
                                <Col xs={24} md={8}><Form.Item label="NIK Wali" name="nik_wali" rules={nikRules}><Input maxLength={16} /></Form.Item></Col>
                                <Col xs={24} md={8}><Form.Item label="Hubungan Wali" name="hubungan_wali"><Select allowClear options={WALI_RELATIONSHIP_OPTIONS} /></Form.Item></Col>
                                <Col xs={24} md={8}><Form.Item label="Pendidikan Wali" name="pendidikan_wali"><Select allowClear options={EDUCATION_OPTIONS} /></Form.Item></Col>
                                <Col xs={24} md={8}><Form.Item label="Pekerjaan Wali" name="pekerjaan_wali"><Select allowClear options={JOB_OPTIONS} /></Form.Item></Col>
                                <Col xs={24} md={8}><Form.Item label="Penghasilan Wali" name="penghasilan_wali"><Select allowClear options={INCOME_OPTIONS} /></Form.Item></Col>
                            </Row>
                            )}
                        </Card>

                        <Card title="Bantuan dan Data Tambahan" bordered={false} style={{ marginBottom: 24, boxShadow: token.boxShadowTertiary }}>
                            <Row gutter={16}>
                                <Col xs={24} md={6}><Form.Item label="Penerima PIP" name="penerima_pip" valuePropName="checked"><Switch /></Form.Item></Col>
                                <Col xs={24} md={10}><Form.Item label="No. KIP" name="no_kip"><Input /></Form.Item></Col>
                                <Col xs={24} md={8}><Form.Item label="Penerima Beasiswa" name="penerima_beasiswa" valuePropName="checked"><Switch /></Form.Item></Col>
                                <Col xs={24} md={12}><Form.Item label="Jenis Beasiswa" name="jenis_beasiswa"><Input /></Form.Item></Col>
                                <Col xs={24}><EmisExtraFields /></Col>
                            </Row>
                        </Card>

                        <Card title={<Space><UserOutlined /><span>Registrasi Akun Wali Santri</span></Space>} bordered={false} style={{ boxShadow: token.boxShadowTertiary, border: `1px solid ${token.colorPrimaryBorder}` }}>
                            <Alert message="Akun ini digunakan penanggung jawab santri untuk login di aplikasi Android." type="info" showIcon style={{ marginBottom: 24 }} />
                            <Row gutter={16}>
                                <Col xs={24} md={8}><Form.Item label="No. HP / WhatsApp" name="no_kontak_wali" rules={[{ required: true }, ...phoneRules]}><Input prefix={<PhoneOutlined />} /></Form.Item></Col>
                                <Col xs={24} md={8}><Form.Item label="Email Login" name="email_wali" rules={[{ required: true }, { type: "email" }]}><Input prefix={<MailOutlined />} /></Form.Item></Col>
                                <Col xs={24} md={8}><Form.Item label="Password" name="password_wali" rules={[{ required: true }, { min: 6 }]}><Input.Password prefix={<LockOutlined />} /></Form.Item></Col>
                            </Row>
                        </Card>
                    </Col>
                </Row>
            </Form>
        </div>
    );
};
