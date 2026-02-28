import React, { useState } from "react";
import { Create, useForm } from "@refinedev/antd";
import { Form, Input, Select, DatePicker, Card, Row, Col, Switch, Upload, message, Button, Image } from "antd";
import { UploadOutlined, PictureOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { supabaseClient } from "../../utility/supabaseClient";
import { useGetIdentity } from "@refinedev/core";

export const BeritaCreate = () => {
    const { formProps, saveButtonProps, form } = useForm();
    const { data: user } = useGetIdentity<{ id: string }>();
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    // Auto Slug Generator
    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const title = e.target.value;
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        form.setFieldValue("slug", slug);
    };

    // Upload Handler to Supabase Storage
    const handleUpload = async (options: any) => {
        const { file, onSuccess, onError } = options;
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        setUploading(true);
        try {
            const { error: uploadError } = await supabaseClient.storage
                .from('berita-images')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Get Public URL
            const { data } = supabaseClient.storage.from('berita-images').getPublicUrl(filePath);
            
            setImageUrl(data.publicUrl);
            form.setFieldValue("thumbnail_url", data.publicUrl);
            onSuccess("Ok");
            message.success("Gambar berhasil diupload");
        } catch (error: any) {
            message.error("Gagal upload: " + error.message);
            onError({ error });
        } finally {
            setUploading(false);
        }
    };

    return (
        <Create saveButtonProps={saveButtonProps} title="Tulis Berita / Pengumuman Baru">
            <Form 
                {...formProps} 
                layout="vertical"
                initialValues={{
                    tanggal_publish: dayjs(),
                    status: 'PUBLISHED',
                    is_featured: false,
                    penulis_id: user?.id
                }}
            >
                {/* Hidden Fields */}
                <Form.Item name="penulis_id" hidden><Input /></Form.Item>
                <Form.Item name="thumbnail_url" hidden><Input /></Form.Item>

                <Row gutter={24}>
                    <Col xs={24} md={16}>
                        <Card title="Konten Utama" bordered={false} className="shadow-sm mb-6">
                            <Form.Item 
                                label="Judul Berita" 
                                name="judul" 
                                rules={[{ required: true }]}
                            >
                                <Input placeholder="Contoh: Pengajian Akbar Bulan Ramadhan" onChange={handleTitleChange} size="large" className="font-bold" />
                            </Form.Item>

                            <Form.Item 
                                label="Slug (URL Friendly)" 
                                name="slug" 
                                rules={[{ required: true }]}
                                help="Otomatis terisi dari judul. Digunakan untuk link share."
                            >
                                <Input prefix="alhasanah.com/news/" className="text-gray-500" />
                            </Form.Item>

                            <Form.Item 
                                label="Ringkasan (Excerpt)" 
                                name="ringkasan" 
                                rules={[{ required: true, max: 200 }]}
                                help="Muncul di daftar berita (maks 200 karakter)"
                            >
                                <Input.TextArea rows={2} showCount maxLength={200} />
                            </Form.Item>

                            <Form.Item 
                                label="Isi Konten Lengkap" 
                                name="konten" 
                                rules={[{ required: true }]}
                            >
                                <Input.TextArea rows={12} placeholder="Tulis isi berita di sini..." />
                            </Form.Item>
                        </Card>
                    </Col>

                    <Col xs={24} md={8}>
                        <Card title="Media & Pengaturan" bordered={false} className="shadow-sm mb-6">
                            <Form.Item label="Gambar Utama (Thumbnail)">
                                <Upload 
                                    customRequest={handleUpload} 
                                    showUploadList={false}
                                    accept="image/*"
                                >
                                    <div className="w-full h-40 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 bg-gray-50 transition-colors">
                                        {imageUrl ? (
                                            <img src={imageUrl} alt="Thumbnail" className="w-full h-full object-cover rounded-lg" />
                                        ) : (
                                            <div className="text-center text-gray-400">
                                                {uploading ? "Uploading..." : <><PictureOutlined className="text-2xl"/><br/>Klik untuk Upload</>}
                                            </div>
                                        )}
                                    </div>
                                </Upload>
                            </Form.Item>

                            <Form.Item label="Kategori" name="kategori" rules={[{ required: true }]}>
                                <Select options={[
                                    { label: 'Pengumuman', value: 'PENGUMUMAN' },
                                    { label: 'Kegiatan Santri', value: 'KEGIATAN' },
                                    { label: 'Prestasi', value: 'PRESTASI' },
                                    { label: 'Kajian / Artikel', value: 'KAJIAN' },
                                ]} />
                            </Form.Item>

                            <Form.Item label="Status Publikasi" name="status">
                                <Select options={[
                                    { label: 'Tayang (Published)', value: 'PUBLISHED' },
                                    { label: 'Draft (Simpan Dulu)', value: 'DRAFT' },
                                ]} />
                            </Form.Item>

                            <Form.Item label="Tanggal Publish" name="tanggal_publish">
                                <DatePicker showTime format="DD MMM YYYY HH:mm" style={{width:'100%'}} />
                            </Form.Item>

                            <div className="bg-yellow-50 p-4 rounded border border-yellow-200">
                                <Form.Item name="is_featured" valuePropName="checked" noStyle>
                                    <Switch />
                                </Form.Item>
                                <span className="ml-2 font-semibold text-yellow-700">Jadikan Headline?</span>
                                <p className="text-xs text-yellow-600 mt-1">Berita akan muncul di slider paling atas aplikasi Android.</p>
                            </div>
                        </Card>
                    </Col>
                </Row>
            </Form>
        </Create>
    );
};