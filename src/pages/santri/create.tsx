import React, { useState } from "react";
import { useForm } from "@refinedev/antd";
import { useNavigation } from "@refinedev/core";
import {
    Form, Input, Select, DatePicker, Card, Button, Typography,
    Row, Col, Upload, message, theme, Avatar, Divider, Space, Alert, InputNumber
} from "antd";
import { 
    SaveOutlined, CloseOutlined, LoadingOutlined, 
    UserOutlined, CameraOutlined, MailOutlined, LockOutlined, 
    NumberOutlined, PhoneOutlined, HomeOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";
import { supabaseClient } from "../../utility/supabaseClient";

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

export const SantriCreate = () => {
    const { token } = theme.useToken();
    const { list } = useNavigation();
    
    // --- STATES ---
    const [loadingUpload, setLoadingUpload] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [fileList, setFileList] = useState<any[]>([]);

    const { formProps, form } = useForm();

    // --- LOGIKA UTAMA (MENGGUNAKAN EDGE FUNCTION ANDA) ---
    const customOnFinish = async (values: any) => {
        setSubmitting(true);
        let finalFotoUrl = null;

        try {
            // 1. UPLOAD FOTO (Wajib di Frontend karena File Object ada di sini)
            if (fileList.length > 0) {
                setLoadingUpload(true);
                const file = fileList[0].originFileObj || fileList[0];

                if (!file) throw new Error("File foto rusak/tidak terbaca.");

                const fileExt = file.name ? file.name.split('.').pop() : 'jpg';
                const fileName = `santri/${values.nis}_${dayjs().valueOf()}.${fileExt}`;

                const { error: uploadError } = await supabaseClient.storage
                    .from('images')
                    .upload(fileName, file, { cacheControl: '3600', upsert: true });

                if (uploadError) throw new Error("Gagal upload foto: " + uploadError.message);

                const { data: urlData } = supabaseClient.storage
                    .from('images')
                    .getPublicUrl(fileName);
                
                finalFotoUrl = urlData.publicUrl;
                setLoadingUpload(false);
            }

            // 2. PERSIAPAN PAYLOAD
            // Kita harus menyusun data persis seperti yang diminta Edge Function Anda:
            // { emailWali, passwordWali, namaWali, noHpWali, dataSantri }
            
            const payload = {
                emailWali: values.email_wali,
                passwordWali: values.password_wali,
                namaWali: values.nama_wali,
                noHpWali: values.no_kontak_wali,
                dataSantri: {
                    nis: values.nis,
                    nik: values.nik,
                    nama: values.nama,
                    kelas: values.kelas,
                    jurusan: values.jurusan,
                    status_santri: values.status_santri,
                    status_spp: values.status_spp,
                    pembimbing: values.pembimbing,
                    hafalan_kitab: values.hafalan_kitab,
                    total_hafalan: values.total_hafalan ? String(values.total_hafalan) : null,
                    tempat_lahir: values.tempat_lahir,
                    tanggal_lahir: values.tanggal_lahir ? values.tanggal_lahir.format('YYYY-MM-DD') : null,
                    jenis_kelamin: values.jenis_kelamin,
                    anak_ke: values.anak_ke ? String(values.anak_ke) : null,
                    ayah: values.ayah,
                    ibu: values.ibu,
                    no_kontak_wali: values.no_kontak_wali, // Redundan tapi untuk data santri
                    alamat_lengkap: values.alamat_lengkap,
                    foto_url: finalFotoUrl
                }
            };

            // 3. PANGGIL EDGE FUNCTION 'create-user-wali'
            const { data, error } = await supabaseClient.functions.invoke('create-user-wali', {
                body: payload
            });

            if (error) {
                // Parsing error message dari Edge Function
                const errorBody = await error.context?.json(); 
                throw new Error(errorBody?.error || error.message || "Gagal menghubungi server.");
            }

            // Jika sukses
            message.success("Berhasil! Akun Wali & Data Santri telah dibuat.");
            list("santri");

        } catch (error: any) {
            console.error(error);
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
            reader.addEventListener('load', () => setImageUrl(reader.result as string));
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
        <div style={{ padding: '24px', paddingBottom: '100px' }}>
            {/* HEADER */}
            <Row justify="space-between" align="middle" style={{ marginBottom: '24px' }}>
                <Col>
                    <Title level={3} style={{ margin: 0 }}>Registrasi Santri Baru</Title>
                    <Text style={{ color: token.colorTextSecondary }}>Input data santri & buat akun aplikasi wali otomatis.</Text>
                </Col>
                <Col>
                    <Space>
                        <Button icon={<CloseOutlined />} onClick={() => list("santri")} disabled={submitting}>
                            Batal
                        </Button>
                        <Button 
                            type="primary" 
                            icon={<SaveOutlined />} 
                            loading={submitting}
                            onClick={() => form.submit()} 
                        >
                            Simpan Data
                        </Button>
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
                    jurusan: "KITAB"
                }}
            >
                <Row gutter={[24, 24]}>
                    
                    {/* --- KOLOM KIRI: FOTO & AKADEMIK --- */}
                    <Col xs={24} lg={8}>
                        {/* FOTO */}
                        <Card bordered={false} style={{ textAlign: 'center', marginBottom: 24, boxShadow: token.boxShadowTertiary }}>
                            <Form.Item style={{ marginBottom: 0 }}>
                                <Upload
                                    name="avatar"
                                    listType="picture-card"
                                    className="avatar-uploader"
                                    showUploadList={false}
                                    beforeUpload={() => false}
                                    onChange={handleUploadChange}
                                    style={{ 
                                        width: 150, height: 150, borderRadius: '50%', overflow: 'hidden',
                                        border: `2px dashed ${token.colorBorderSecondary}`, backgroundColor: token.colorBgContainerDisabled
                                    }}
                                >
                                    {imageUrl ? <Avatar src={imageUrl} size={140} shape="circle" /> : uploadButton}
                                </Upload>
                            </Form.Item>
                            <Text type="secondary" style={{ fontSize: 12 }}>Format: JPG/PNG, Max 2MB</Text>
                        </Card>

                        {/* DATA AKADEMIK */}
                        <Card title="Informasi Akademik" bordered={false} style={{ boxShadow: token.boxShadowTertiary }}>
                            <Form.Item label="Nomor Induk Santri (NIS)" name="nis" rules={[{ required: true, message: "NIS Wajib diisi" }]}>
                                <Input prefix={<NumberOutlined style={{ color: token.colorTextQuaternary }} />} placeholder="Contoh: 2024001" />
                            </Form.Item>
                            
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item label="Kelas" name="kelas" rules={[{ required: true }]}>
                                        <Select placeholder="Pilih Kelas">
                                            <Option value="1">1</Option>
                                            <Option value="2">2</Option>
                                            <Option value="3">3</Option>
                                           
                                        </Select>
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item label="Takhasus" name="jurusan" rules={[{ required: true }]}>
                                        <Select>
                                            <Option value="KITAB">Kitab</Option>
                                            <Option value="TAHFIDZ">Tahfidz</Option>
                                        </Select>
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item label="Status Santri" name="status_santri">
                                        <Select>
                                            <Option value="AKTIF">Aktif</Option>
                                            <Option value="LULUS">Lulus</Option>
                                            <Option value="KELUAR">Keluar</Option>
                                        </Select>
                                    </Form.Item>
                                </Col>
                                
                            </Row>

                            <Form.Item label="Ustadz Pembimbing" name="pembimbing">
                                <Input prefix={<UserOutlined style={{ color: token.colorTextQuaternary }} />} placeholder="Nama Musyrif" />
                            </Form.Item>

                            <Divider dashed style={{ margin: '12px 0' }} />
                            
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item label="Hafalan (Juz)" name="total_hafalan">
                                        <InputNumber min={0} max={30} style={{ width: '100%' }} placeholder="0" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item label="Kitab Selesai" name="hafalan_kitab">
                                        <Input placeholder="Nama Kitab" />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </Card>
                    </Col>

                    {/* --- KOLOM KANAN: PRIBADI & WALI --- */}
                    <Col xs={24} lg={16}>
                        {/* DATA PRIBADI */}
                        <Card title="Data Pribadi Santri" bordered={false} style={{ marginBottom: 24, boxShadow: token.boxShadowTertiary }}>
                            <Row gutter={16}>
                                <Col xs={24} md={16}>
                                    <Form.Item label="Nama Lengkap" name="nama" rules={[{ required: true }]}>
                                        <Input placeholder="Sesuai Ijazah / Akta" style={{ fontWeight: 500 }} />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} md={8}>
                                    <Form.Item label="NIK (KTP/KK)" name="nik">
                                        <Input placeholder="16 Digit NIK" maxLength={16} />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Row gutter={16}>
                                <Col xs={24} md={8}>
                                    <Form.Item label="Tempat Lahir" name="tempat_lahir"><Input /></Form.Item>
                                </Col>
                                <Col xs={24} md={8}>
                                    <Form.Item label="Tanggal Lahir" name="tanggal_lahir"><DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" /></Form.Item>
                                </Col>
                                <Col xs={12} md={4}>
                                     <Form.Item label="Gender" name="jenis_kelamin">
                                        <Select><Option value="L">Laki</Option><Option value="P">Pr</Option></Select>
                                    </Form.Item>
                                </Col>
                                <Col xs={12} md={4}>
                                     <Form.Item label="Anak Ke" name="anak_ke">
                                        <InputNumber min={1} style={{ width: '100%' }} />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Row gutter={16}>
                                <Col xs={24} md={12}>
                                    <Form.Item label="Nama Ayah" name="ayah"><Input /></Form.Item>
                                </Col>
                                <Col xs={24} md={12}>
                                    <Form.Item label="Nama Ibu" name="ibu"><Input /></Form.Item>
                                </Col>
                            </Row>

                            <Form.Item label="Alamat Lengkap" name="alamat_lengkap">
                                <TextArea rows={2} placeholder="Jalan, RT/RW, Desa, Kecamatan, Kab/Kota" />
                            </Form.Item>
                        </Card>

                        {/* AKUN WALI (LOGIN) */}
                        <Card 
                            title={<Space><UserOutlined /><span>Registrasi Akun Wali Santri</span></Space>} 
                            bordered={false} 
                            style={{ boxShadow: token.boxShadowTertiary, border: `1px solid ${token.colorPrimaryBorder}` }}
                            headStyle={{ backgroundColor: token.colorFillAlter, borderBottom: `1px solid ${token.colorBorderSecondary}` }}
                        >
                            <Alert 
                                message="Akun ini akan digunakan Wali Santri untuk login di Aplikasi Android." 
                                type="info" 
                                showIcon 
                                style={{ marginBottom: 24 }} 
                            />
                            
                             <Row gutter={16}>
                                <Col xs={24} md={12}>
                                    <Form.Item label="Nama Wali (Penanggung Jawab)" name="nama_wali" rules={[{ required: true }]}>
                                        <Input placeholder="Nama Ayah/Ibu/Wali" />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} md={12}>
                                     <Form.Item label="No. HP / WhatsApp" name="no_kontak_wali" rules={[{ required: true }]}>
                                        <Input prefix={<PhoneOutlined style={{ color: token.colorTextQuaternary }} />} placeholder="0812xxxx" style={{ width: '100%' }} />
                                    </Form.Item>
                                </Col>
                             </Row>
                             
                             <div style={{ background: token.colorBgLayout, padding: '16px', borderRadius: '8px' }}>
                                 <Text strong style={{ display: 'block', marginBottom: 12 }}>Kredensial Login Aplikasi:</Text>
                                 <Row gutter={16}>
                                    <Col xs={24} md={12}>
                                        <Form.Item 
                                            label="Email Login" 
                                            name="email_wali" 
                                            rules={[
                                                { required: true, message: "Wajib diisi" },
                                                { type: 'email', message: "Format email salah" }
                                            ]}
                                        >
                                            <Input prefix={<MailOutlined />} placeholder="email@contoh.com" />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <Form.Item 
                                            label="Password" 
                                            name="password_wali" 
                                            rules={[
                                                { required: true, message: "Wajib diisi" },
                                                { min: 6, message: "Minimal 6 karakter" }
                                            ]}
                                        >
                                            <Input.Password prefix={<LockOutlined />} placeholder="Min. 6 Karakter" />
                                        </Form.Item>
                                    </Col>
                                 </Row>
                             </div>
                        </Card>
                    </Col>
                </Row>
            </Form>

            <style>{`
                .avatar-uploader > .ant-upload {
                    width: 150px !important; height: 150px !important; border-radius: 50% !important;
                    padding: 0 !important; margin: 0 auto !important; display: flex !important;
                    justify-content: center; align-items: center;
                    border: 2px dashed ${token.colorBorderSecondary} !important;
                    background: ${token.colorBgContainerDisabled} !important;
                    transition: border-color 0.3s;
                }
                .avatar-uploader > .ant-upload:hover { border-color: ${token.colorPrimary} !important; }
            `}</style>
        </div>
    );
};