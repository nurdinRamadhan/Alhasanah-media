import React from "react";
import { Create, useForm } from "@refinedev/antd";
import { Form, Input, Select, DatePicker, Divider, message, Row, Col, InputNumber } from "antd/lib";
import { supabaseClient } from "../../utility/supabaseClient";
import dayjs from "dayjs";

export const SantriCreate = () => {
    const { formProps, saveButtonProps, form } = useForm();

    const handleFinish = async (values: any) => {
        try {
            message.loading({ content: "Mendaftarkan Wali Santri...", key: "create_process" });

            // 1. Buat Akun Wali di Supabase Auth
            const { data: authData, error: authError } = await supabaseClient.auth.signUp({
                email: values.email_wali,
                password: values.password_wali,
                options: {
                    data: {
                        full_name: values.nama_wali,
                        role: "wali", 
                        no_hp: values.no_kontak, // Simpan no_hp juga di metadata user
                    },
                },
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error("Gagal membuat user wali");

            const waliId = authData.user.id;

            message.loading({ content: "Menyimpan Data Santri...", key: "create_process" });

            // 2. Siapkan Data Santri
            const finalValues = {
                ...values,
                wali_id: waliId,
                tanggal_lahir: values.tanggal_lahir ? dayjs(values.tanggal_lahir).format('YYYY-MM-DD') : null,
                // Pastikan angka tersimpan sebagai angka
                anak_ke: values.anak_ke ? Number(values.anak_ke) : null,
            };

            // Hapus field yang bukan kolom tabel santri
            delete finalValues.email_wali;
            delete finalValues.password_wali;
            delete finalValues.nama_wali;

            // Panggil onFinish bawaan Refine
            if (formProps.onFinish) {
                await formProps.onFinish(finalValues);
            }
            
            message.success({ content: "Santri & Wali berhasil didaftarkan!", key: "create_process" });

        } catch (error: any) {
            console.error(error);
            message.error({ content: `Gagal: ${error.message}`, key: "create_process" });
        }
    };

    return (
        <Create saveButtonProps={{ ...saveButtonProps, onClick: () => form.submit() }}>
            <Form 
                {...formProps} 
                layout="vertical" 
                onFinish={handleFinish}
            >
                {/* --- BAGIAN 1: AKUN WALI SANTRI --- */}
                <Divider orientation="left">Data Akun Wali</Divider>
                <Row gutter={16}>
                    <Col span={8}>
                        <Form.Item
                            label="Nama Wali"
                            name="nama_wali"
                            rules={[{ required: true, message: "Nama Wali wajib diisi" }]}
                        >
                            <Input placeholder="Nama Orang Tua" />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item
                            label="Email (Login)"
                            name="email_wali"
                            rules={[
                                { required: true, message: "Email wajib diisi" },
                                { type: "email", message: "Format email salah" }
                            ]}
                        >
                            <Input placeholder="contoh@gmail.com" />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item
                            label="Password"
                            name="password_wali"
                            rules={[{ required: true, min: 6 }]}
                        >
                            <Input.Password placeholder="Password Login" />
                        </Form.Item>
                    </Col>
                </Row>
                <Row gutter={16}>
                     <Col span={8}>
                        <Form.Item
                            label="No. WhatsApp / Kontak"
                            name="no_kontak_wali" // Masuk ke kolom no_kontak di tabel santri
                            rules={[{ required: true, message: "Nomor kontak wajib diisi" }]}
                        >
                            <Input placeholder="0812..." type="tel" />
                        </Form.Item>
                    </Col>
                </Row>

                {/* --- BAGIAN 2: IDENTITAS SANTRI --- */}
                <Divider orientation="left">Identitas Santri</Divider>
                <Row gutter={16}>
                    <Col span={8}>
                        <Form.Item
                            label="NIS"
                            name="nis"
                            rules={[{ required: true }]}
                        >
                            <Input placeholder="Nomor Induk Santri" />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item
                            label="NIK (Nomor Induk Kependudukan)"
                            name="nik"
                        >
                            <Input placeholder="16 Digit NIK" maxLength={16} />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item
                            label="Nama Lengkap Santri"
                            name="nama"
                            rules={[{ required: true }]}
                        >
                            <Input />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item label="Tempat Lahir" name="tempat_lahir">
                            <Input placeholder="Kota Kelahiran" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item label="Tanggal Lahir" name="tanggal_lahir" rules={[{ required: true }]}>
                            <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" placeholder="Pilih Tanggal" />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={8}>
                        <Form.Item label="Jenis Kelamin" name="jenis_kelamin" rules={[{ required: true }]}>
                            <Select
                                options={[
                                    { label: "Laki-laki", value: "L" },
                                    { label: "Perempuan", value: "P" },
                                ]}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item label="Anak Ke-" name="anak_ke">
                            <InputNumber style={{ width: "100%" }} min={1} />
                        </Form.Item>
                    </Col>
                     <Col span={8}>
                        <Form.Item label="Status Santri" name="status_santri" initialValue="AKTIF" rules={[{ required: true }]}>
                            <Select
                                options={[
                                    { label: "Aktif", value: "AKTIF" },
                                    { label: "Lulus", value: "LULUS" },
                                    { label: "Keluar", value: "KELUAR" },
                                    { label: "Alumni", value: "ALUMNI" },
                                ]}
                            />
                        </Form.Item>
                    </Col>
                </Row>

                {/* --- BAGIAN 3: AKADEMIK --- */}
                <Divider orientation="left">Data Akademik</Divider>
                <Row gutter={16}>
                    <Col span={8}>
                        <Form.Item label="Kelas" name="kelas" rules={[{ required: true }]}>
                            <Select
                                options={[
                                    { label: "Kelas 1", value: "1" },
                                    { label: "Kelas 2", value: "2" },
                                    { label: "Kelas 3", value: "3" },
                                ]}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item label="Jurusan" name="jurusan" rules={[{ required: true }]}>
                            <Select
                                options={[
                                    { label: "Kitab", value: "KITAB" },
                                    { label: "Tahfidz", value: "TAHFIDZ" },
                                ]}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item label="Pembimbing / Musyrif" name="pembimbing">
                            <Input placeholder="Nama Ustadz Pembimbing" />
                        </Form.Item>
                    </Col>
                </Row>

                {/* --- BAGIAN 4: KELUARGA --- */}
                <Divider orientation="left">Data Keluarga & Alamat</Divider>
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item label="Nama Ayah" name="ayah">
                            <Input />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item label="Nama Ibu" name="ibu">
                            <Input />
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item label="Alamat Lengkap" name="alamat_lengkap">
                    <Input.TextArea rows={2} />
                </Form.Item>

            </Form>
        </Create>
    );
};