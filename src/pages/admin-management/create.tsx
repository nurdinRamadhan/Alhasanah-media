import React, { useState } from "react";
import { 
    ProForm, 
    ProFormText, 
    ProFormSelect,
    ProCard 
} from "@ant-design/pro-components";
import { 
    UserOutlined, 
    LockOutlined, 
    MailOutlined, 
    SafetyCertificateOutlined,
    ManOutlined,
    BookOutlined
} from "@ant-design/icons";
import { message, Typography, Divider, Alert } from "antd";
import { supabaseClient } from "../../utility/supabaseClient";
import { useNavigation } from "@refinedev/core";

const { Title, Text } = Typography;

export const CreateAdminPage = () => {
    const [loading, setLoading] = useState(false);
    const { list } = useNavigation();
    const [form] = ProForm.useForm();

    const handleFinish = async (values: any) => {
        setLoading(true);
        try {
            // Panggil Edge Function
            const { data, error } = await supabaseClient.functions.invoke('create-admin-account', {
                body: values
            });

            if (error || (data && !data.success)) {
                throw new Error(error?.message || data?.error || "Gagal membuat akun");
            }

            message.success("Akun Admin berhasil dibuat!");
            form.resetFields();
            // Opsional: Redirect ke list admin jika ada
            // list("profiles"); 
        } catch (err: any) {
            message.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full min-h-[80vh] flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-900 transition-colors">
            
            <ProCard
                gutter={[0, 16]}
                className="w-full max-w-4xl shadow-lg rounded-2xl border border-gray-100 dark:border-gray-800"
                style={{ margin: 'auto' }}
            >
                <div className="flex flex-col md:flex-row gap-8 p-4">
                    
                    {/* SIDEBAR INFO (Visual Kiri) */}
                    <div className="md:w-1/3 bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl flex flex-col justify-between">
                        <div>
                            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4 shadow-md">
                                <SafetyCertificateOutlined className="text-white text-2xl" />
                            </div>
                            <Title level={3} className="!mb-2 dark:text-white">Akses Manajemen</Title>
                            <Text type="secondary" className="dark:text-gray-400">
                                Buat akun pengurus baru dengan hak akses spesifik (RBAC).
                            </Text>
                            
                            <Divider />
                            
                            <div className="space-y-4">
                                <Alert 
                                    message="Super Admin" 
                                    description="Akses penuh ke seluruh sistem."
                                    type="error"
                                    showIcon
                                    className="border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800"
                                />
                                <Alert 
                                    message="Rois / Kesantrian" 
                                    description="Akses operasional santri & hafalan."
                                    type="info"
                                    showIcon
                                    className="border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800"
                                />
                                <Alert 
                                    message="Bendahara" 
                                    description="Akses keuangan dengan filter gender."
                                    type="warning"
                                    showIcon
                                    className="border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800"
                                />
                            </div>
                        </div>
                        <Text className="text-xs text-gray-400 mt-8">
                            *Password akan diset langsung dan terverifikasi otomatis.
                        </Text>
                    </div>

                    {/* FORM AREA (Kanan) */}
                    <div className="md:w-2/3">
                        <Title level={4} className="mb-6 dark:text-white">Form Registrasi Pengurus</Title>
                        
                        <ProForm
                            form={form}
                            onFinish={handleFinish}
                            submitter={{
                                searchConfig: {
                                    submitText: loading ? 'Memproses...' : 'Buat Akun',
                                },
                                submitButtonProps: {
                                    size: 'large',
                                    loading: loading,
                                    style: { width: '100%' }
                                },
                                resetButtonProps: {
                                    style: { display: 'none' }
                                }
                            }}
                            layout="vertical"
                        >
                            {/* SECTION 1: KREDENSIAL */}
                            <ProForm.Group title="Kredensial Login">
                                <ProFormText
                                    name="email"
                                    width="md"
                                    label="Email Pesantren"
                                    placeholder="nama@alhasanah.id"
                                    fieldProps={{ prefix: <MailOutlined /> }}
                                    rules={[
                                        { required: true, message: 'Email wajib diisi' },
                                        { type: 'email', message: 'Format email salah' }
                                    ]}
                                />
                                <ProFormText.Password
                                    name="password"
                                    width="md"
                                    label="Password Awal"
                                    placeholder="Minimal 6 karakter"
                                    fieldProps={{ prefix: <LockOutlined /> }}
                                    rules={[{ required: true, min: 6 }]}
                                />
                            </ProForm.Group>

                            <Divider />

                            {/* SECTION 2: PROFIL */}
                            <ProForm.Group title="Data Profil">
                                <ProFormText
                                    name="fullName"
                                    width="lg"
                                    label="Nama Lengkap"
                                    placeholder="Contoh: Ust. Abdullah, Lc."
                                    fieldProps={{ prefix: <UserOutlined /> }}
                                    rules={[{ required: true }]}
                                />
                            </ProForm.Group>

                            {/* SECTION 3: WEWENANG (RBAC) */}
                            <ProForm.Group title="Hak Akses (RBAC)">
                                <ProFormSelect
                                    name="role"
                                    width="sm"
                                    label="Jabatan (Role)"
                                    placeholder="Pilih Role"
                                    options={[
                                        { label: 'Super Admin (Pemilik)', value: 'super_admin' },
                                        { label: 'Rois (Kepala)', value: 'rois' },
                                        { label: 'Bendahara', value: 'bendahara' },
                                        { label: 'Kesantrian', value: 'kesantrian' },
                                        { label: 'Dewan / Guru', value: 'dewan' },
                                    ]}
                                    rules={[{ required: true }]}
                                    fieldProps={{ prefix: <SafetyCertificateOutlined /> }}
                                />
                                
                                <ProFormSelect
                                    name="aksesGender"
                                    width="xs"
                                    label="Akses Gender"
                                    tooltip="Membatasi data santri yang bisa dilihat"
                                    initialValue="ALL"
                                    options={[
                                        { label: 'Semua (L/P)', value: 'ALL' },
                                        { label: 'Putra (L) Only', value: 'L' },
                                        { label: 'Putri (P) Only', value: 'P' },
                                    ]}
                                    fieldProps={{ prefix: <ManOutlined /> }}
                                />

                                <ProFormSelect
                                    name="aksesJurusan"
                                    width="xs"
                                    label="Akses Jurusan"
                                    tooltip="Membatasi data akademik yang bisa dilihat"
                                    initialValue="ALL"
                                    options={[
                                        { label: 'Semua', value: 'ALL' },
                                        { label: 'Tahfidz', value: 'TAHFIDZ' },
                                        { label: 'Kitab', value: 'KITAB' },
                                    ]}
                                    fieldProps={{ prefix: <BookOutlined /> }}
                                />
                            </ProForm.Group>

                        </ProForm>
                    </div>
                </div>
            </ProCard>
        </div>
    );
};