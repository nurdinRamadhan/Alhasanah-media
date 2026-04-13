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
    BookOutlined,
    ArrowLeftOutlined,
    RocketOutlined
} from "@ant-design/icons";
import { message, Typography, Button, Space } from "antd";
import { supabaseClient } from "../../utility/supabaseClient";
import { useNavigation, useGetIdentity } from "@refinedev/core";
import { logActivity } from "../../utility/logger";
import { IUserIdentity } from "../../types";

const { Title, Text } = Typography;

interface AdminFormValues {
    email: string;
    password: string;
    fullName: string;
    role: string;
    aksesGender: string;
    aksesJurusan: string;
}

export const CreateAdminPage = () => {
    const [loading, setLoading] = useState(false);
    const { push } = useNavigation();
    const { data: user } = useGetIdentity<IUserIdentity>();
    const [form] = ProForm.useForm();

    const handleFinish = async (values: AdminFormValues) => {
        setLoading(true);
        try {
            // Panggil Edge Function
            const { data, error } = await supabaseClient.functions.invoke('create-admin-account', {
                body: values
            });

            if (error || (data && !data.success)) {
                throw new Error(error?.message || data?.error || "Gagal membuat akun");
            }

            // CATAT LOG AKTIVITAS
            await logActivity({
                user,
                action: 'CREATE',
                resource: 'profiles',
                details: { 
                    new_admin_name: values.fullName,
                    new_admin_email: values.email,
                    assigned_role: values.role
                }
            });

            message.success("Akun Admin berhasil dibuat!");
            form.resetFields();
            
            // Redirect ke list setelah sukses
            setTimeout(() => {
                push("/admin-management");
            }, 1500);
        } catch (err: Error | unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Gagal membuat akun';
            message.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full min-h-screen p-4 md:p-8 bg-[#f8fafc] dark:bg-[#050505] transition-colors duration-300">
            {/* Header & Back Button */}
            <div className="max-w-5xl mx-auto mb-8 flex items-center justify-between">
                <Space direction="vertical" size={0}>
                    <Button 
                        type="text" 
                        icon={<ArrowLeftOutlined />} 
                        onClick={() => push("/admin-management")}
                        className="mb-2 -ml-2 text-gray-500 hover:text-indigo-600 dark:text-gray-400"
                    >
                        Kembali ke Daftar
                    </Button>
                    <Title level={2} style={{ margin: 0, letterSpacing: '-1px' }} className="dark:text-white">
                        Registrasi <span className="text-indigo-600">Admin</span>
                    </Title>
                </Space>
                <div className="hidden md:flex w-12 h-12 rounded-2xl bg-white dark:bg-[#141414] shadow-sm border border-gray-100 dark:border-gray-800 items-center justify-center">
                    <RocketOutlined className="text-indigo-500 text-xl" />
                </div>
            </div>

            <ProCard
                gutter={[0, 0]}
                className="max-w-5xl mx-auto shadow-2xl shadow-indigo-100 dark:shadow-none rounded-3xl overflow-hidden border-0 dark:bg-[#0d0d0d] dark:border dark:border-gray-800"
            >
                <div className="flex flex-col md:flex-row min-h-[600px]">
                    
                    {/* SIDEBAR INFO (Visual Kiri) */}
                    <div className="md:w-2/5 bg-gradient-to-br from-indigo-600 to-purple-700 p-8 md:p-10 flex flex-col justify-between text-white">
                        <div>
                            <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 border border-white/30">
                                <SafetyCertificateOutlined className="text-white text-2xl" />
                            </div>
                            <Title level={3} className="!text-white !mb-4">Role Based Access Control</Title>
                            <Text className="text-indigo-100 block mb-8 text-sm leading-relaxed">
                                Sistem ini menggunakan RBAC (Role-Based Access Control) untuk memastikan keamanan data santri dan operasional pesantren.
                            </Text>
                            
                            <div className="space-y-4">
                                <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10">
                                    <Text strong className="text-white block mb-1 text-xs uppercase tracking-wider">Super Admin</Text>
                                    <Text className="text-indigo-100 text-xs">Akses penuh ke konfigurasi sistem dan manajemen pengguna.</Text>
                                </div>
                                <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10">
                                    <Text strong className="text-white block mb-1 text-xs uppercase tracking-wider">Staff Operasional</Text>
                                    <Text className="text-indigo-100 text-xs">Akses terbatas berdasarkan gender (Putra/Putri) dan jurusan.</Text>
                                </div>
                            </div>
                        </div>

                        <div className="mt-12 pt-6 border-t border-white/10">
                            <Text className="text-[11px] text-indigo-200 italic">
                                *Setiap aktivitas admin akan dicatat dalam sistem audit log untuk keperluan keamanan.
                            </Text>
                        </div>
                    </div>

                    {/* FORM AREA (Kanan) */}
                    <div className="md:w-3/5 p-8 md:p-12 dark:bg-[#0d0d0d]">
                        <ProForm
                            form={form}
                            onFinish={handleFinish}
                            submitter={{
                                render: (props) => (
                                    <Button 
                                        type="primary" 
                                        size="large" 
                                        loading={loading}
                                        onClick={() => props.form?.submit()}
                                        className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 border-0 shadow-lg shadow-indigo-200 dark:shadow-none font-bold mt-4"
                                    >
                                        {loading ? 'Mendaftarkan Akun...' : 'Konfirmasi & Buat Akun'}
                                    </Button>
                                )
                            }}
                            layout="vertical"
                            requiredMark={false}
                        >
                            <Space direction="vertical" size={24} className="w-full">
                                
                                <section>
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-1 h-5 bg-indigo-600 rounded-full" />
                                        <Text strong className="text-gray-400 uppercase text-[10px] tracking-widest">Kredensial Login</Text>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <ProFormText
                                            name="email"
                                            label="Email Institusi"
                                            placeholder="ustadz@alhasanah.id"
                                            fieldProps={{ 
                                                prefix: <MailOutlined className="text-gray-400" />,
                                                className: "rounded-xl h-11 dark:bg-[#141414] dark:border-gray-800"
                                            }}
                                            rules={[
                                                { required: true, message: 'Email wajib diisi' },
                                                { type: 'email', message: 'Format email tidak valid' }
                                            ]}
                                        />
                                        <ProFormText.Password
                                            name="password"
                                            label="Password Awal"
                                            placeholder="Min. 6 karakter"
                                            fieldProps={{ 
                                                prefix: <LockOutlined className="text-gray-400" />,
                                                className: "rounded-xl h-11 dark:bg-[#141414] dark:border-gray-800"
                                            }}
                                            rules={[{ required: true, min: 6, message: 'Password minimal 6 karakter' }]}
                                        />
                                    </div>
                                </section>

                                <section>
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-1 h-5 bg-indigo-600 rounded-full" />
                                        <Text strong className="text-gray-400 uppercase text-[10px] tracking-widest">Identitas Pengurus</Text>
                                    </div>
                                    <ProFormText
                                        name="fullName"
                                        label="Nama Lengkap & Gelar"
                                        placeholder="Contoh: Ust. Ahmad Fauzi, M.Pd."
                                        fieldProps={{ 
                                            prefix: <UserOutlined className="text-gray-400" />,
                                            className: "rounded-xl h-11 dark:bg-[#141414] dark:border-gray-800"
                                        }}
                                        rules={[{ required: true, message: 'Nama lengkap wajib diisi' }]}
                                    />
                                </section>

                                <section>
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-1 h-5 bg-indigo-600 rounded-full" />
                                        <Text strong className="text-gray-400 uppercase text-[10px] tracking-widest">Otoritas & Batasan</Text>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4">
                                        <ProFormSelect
                                            name="role"
                                            label="Jabatan Struktural"
                                            placeholder="Pilih Role"
                                            options={[
                                                { label: 'Super Admin', value: 'super_admin' },
                                                { label: 'Rois / Kepala', value: 'rois' },
                                                { label: 'Bendahara', value: 'bendahara' },
                                                { label: 'Kesantrian', value: 'kesantrian' },
                                                { label: 'Dewan Guru', value: 'dewan' },
                                            ]}
                                            fieldProps={{ 
                                                prefix: <SafetyCertificateOutlined className="text-gray-400" />,
                                                className: "rounded-xl h-11 dark:bg-[#141414] dark:border-gray-800"
                                            }}
                                            rules={[{ required: true }]}
                                        />
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                            <ProFormSelect
                                                name="aksesGender"
                                                label="Filter Gender"
                                                initialValue="ALL"
                                                options={[
                                                    { label: 'Seluruh Santri', value: 'ALL' },
                                                    { label: 'Khusus Putra', value: 'L' },
                                                    { label: 'Khusus Putri', value: 'P' },
                                                ]}
                                                fieldProps={{ 
                                                    prefix: <ManOutlined className="text-gray-400" />,
                                                    className: "rounded-xl h-11 dark:bg-[#141414] dark:border-gray-800"
                                                }}
                                            />

                                            <ProFormSelect
                                                name="aksesJurusan"
                                                label="Filter Akademik"
                                                initialValue="ALL"
                                                options={[
                                                    { label: 'Semua Takhasus', value: 'ALL' },
                                                    { label: 'Tahfidz', value: 'TAHFIDZ' },
                                                    { label: 'Kitab', value: 'KITAB' },
                                                ]}
                                                fieldProps={{ 
                                                    prefix: <BookOutlined className="text-gray-400" />,
                                                    className: "rounded-xl h-11 dark:bg-[#141414] dark:border-gray-800"
                                                }}
                                            />
                                        </div>
                                    </div>
                                </section>
                            </Space>
                        </ProForm>
                    </div>
                </div>
            </ProCard>
        </div>
    );
};