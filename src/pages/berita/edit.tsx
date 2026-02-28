import React, { useState, useEffect } from "react";
import { Edit, useForm } from "@refinedev/antd";
import { Form, Input, Select, DatePicker, Card, Row, Col, Switch, Upload, message } from "antd";
import { PictureOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { supabaseClient } from "../../utility/supabaseClient";

export const BeritaEdit = () => {
    const { formProps, saveButtonProps, queryResult, form } = useForm();
    const record = queryResult?.data?.data;
    
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (record?.thumbnail_url) {
            setImageUrl(record.thumbnail_url);
        }
    }, [record]);

    const handleUpload = async (options: any) => {
        const { file, onSuccess, onError } = options;
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;
        setUploading(true);
        try {
            const { error: uploadError } = await supabaseClient.storage.from('berita-images').upload(filePath, file);
            if (uploadError) throw uploadError;
            const { data } = supabaseClient.storage.from('berita-images').getPublicUrl(filePath);
            setImageUrl(data.publicUrl);
            form.setFieldValue("thumbnail_url", data.publicUrl);
            onSuccess("Ok");
        } catch (error: any) {
            message.error("Gagal upload: " + error.message);
            onError({ error });
        } finally {
            setUploading(false);
        }
    };

    return (
        <Edit saveButtonProps={saveButtonProps} title="Edit Berita">
            <Form 
                {...formProps} 
                layout="vertical"
                initialValues={{
                    ...formProps.initialValues,
                    tanggal_publish: formProps.initialValues?.tanggal_publish ? dayjs(formProps.initialValues.tanggal_publish) : "",
                }}
            >
                <Form.Item name="thumbnail_url" hidden><Input /></Form.Item>

                <Row gutter={24}>
                    <Col xs={24} md={16}>
                        <Card title="Konten" bordered={false} className="shadow-sm">
                            <Form.Item label="Judul" name="judul" rules={[{ required: true }]}><Input size="large" className="font-bold"/></Form.Item>
                            <Form.Item label="Slug" name="slug" rules={[{ required: true }]}><Input /></Form.Item>
                            <Form.Item label="Ringkasan" name="ringkasan" rules={[{ required: true }]}><Input.TextArea rows={2} showCount maxLength={200} /></Form.Item>
                            <Form.Item label="Konten" name="konten" rules={[{ required: true }]}><Input.TextArea rows={12} /></Form.Item>
                        </Card>
                    </Col>
                    <Col xs={24} md={8}>
                        <Card title="Media" bordered={false} className="shadow-sm">
                            <Form.Item label="Thumbnail">
                                <Upload customRequest={handleUpload} showUploadList={false} accept="image/*">
                                    <div className="w-full h-40 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 bg-gray-50">
                                        {imageUrl ? <img src={imageUrl} className="w-full h-full object-cover rounded-lg" /> : (uploading ? "Uploading..." : <PictureOutlined className="text-2xl"/>)}
                                    </div>
                                </Upload>
                            </Form.Item>
                            <Form.Item label="Kategori" name="kategori"><Select options={[{label:'Pengumuman',value:'PENGUMUMAN'},{label:'Kegiatan',value:'KEGIATAN'},{label:'Prestasi',value:'PRESTASI'},{label:'Kajian',value:'KAJIAN'}]} /></Form.Item>
                            <Form.Item label="Status" name="status"><Select options={[{label:'Published',value:'PUBLISHED'},{label:'Draft',value:'DRAFT'},{label:'Archived',value:'ARCHIVED'}]} /></Form.Item>
                            <Form.Item label="Tanggal Publish" name="tanggal_publish"><DatePicker showTime format="DD MMM YYYY HH:mm" style={{width:'100%'}} /></Form.Item>
                            <div className="bg-yellow-50 p-4 rounded border border-yellow-200">
                                <Form.Item name="is_featured" valuePropName="checked" noStyle><Switch /></Form.Item>
                                <span className="ml-2 font-semibold text-yellow-700">Headline?</span>
                            </div>
                        </Card>
                    </Col>
                </Row>
            </Form>
        </Edit>
    );
};