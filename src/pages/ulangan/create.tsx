import React, { useState } from "react";
import { Create, useStepsForm } from "@refinedev/antd";
import { useSelect, useCreateMany } from "@refinedev/core";
import {
    Form,
    Input,
    Select,
    DatePicker,
    InputNumber,
    Steps,
    Button,
    Space,
    Typography,
    Card,
    Divider,
    Transfer,
    message,
    Tag,
    Result,
} from "antd";
import { 
    ProjectOutlined, 
    BookOutlined, 
    CheckCircleOutlined,
    ArrowRightOutlined,
    ArrowLeftOutlined,
    SaveOutlined
} from "@ant-design/icons";
import "../../styles/arabic.css";

const { Title, Text } = Typography;

export const WeeklyTestCreate: React.FC = () => {
    const [targetKeys, setTargetKeys] = useState<string[]>([]);
    const { mutate: createTestQuestions } = useCreateMany();

    const {
        current,
        gotoStep,
        stepsProps,
        formProps,
        saveButtonProps,
    } = useStepsForm({
        resource: "weekly_tests",
        onFinish: async (values: any) => {
            if (targetKeys.length === 0) {
                message.error("Silakan pilih minimal satu soal!");
                return;
            }

            // 1. Simpan data weekly_tests (dilakukan otomatis oleh Refine)
            // Namun kita perlu menambahkan logika untuk tabel test_questions setelah sukses
            return values;
        },
        mutationOptions: {
            onSuccess: (data: any) => {
                const testId = data.data.id;
                
                // 2. Simpan relasi soal ke tabel test_questions
                const testQuestions = targetKeys.map((qId, index) => ({
                    test_id: testId,
                    question_id: qId,
                    nomor_urut: index + 1
                }));

                createTestQuestions({
                    resource: "test_questions",
                    values: testQuestions
                }, {
                    onSuccess: () => {
                        message.success("Ulangan dan daftar soal berhasil disimpan!");
                    }
                });
            }
        }
    });

    // Ambil data soal dari bank soal
    const { queryResult: questionQueryResult } = useSelect({
        resource: "question_bank",
        pagination: { mode: "off" }
    });

    const dataSource = (questionQueryResult?.data?.data || []).map((item: any) => ({
        key: item.id,
        title: item.bab,
        description: item.konten_soal,
        kitab: item.kitab,
        is_ever_used: item.is_ever_used,
    }));

    const stepItems = [
        { title: "Info", icon: <ProjectOutlined /> },
        { title: "Pilih Soal", icon: <BookOutlined /> },
        { title: "Finalisasi", icon: <CheckCircleOutlined /> },
    ];

    return (
        <Create
            title={<Title level={3}>Buat Ulangan Mingguan Baru</Title>}
            footerButtons={() => (
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '10px 0' }}>
                    <Button 
                        disabled={current === 0} 
                        onClick={() => gotoStep(current - 1)}
                        icon={<ArrowLeftOutlined />}
                    >
                        Sebelumnya
                    </Button>
                    
                    <Space>
                        {current < 2 ? (
                            <Button 
                                type="primary" 
                                onClick={() => {
                                    if (current === 1 && targetKeys.length === 0) {
                                        return message.warning("Pilih minimal satu soal sebelum lanjut!");
                                    }
                                    gotoStep(current + 1);
                                }}
                                icon={<ArrowRightOutlined />}
                            >
                                Lanjutkan
                            </Button>
                        ) : (
                            <Button 
                                {...saveButtonProps} 
                                type="primary" 
                                icon={<SaveOutlined />}
                                size="large"
                                style={{ background: '#10b981', borderColor: '#10b981' }}
                            >
                                Simpan Draft Ulangan
                            </Button>
                        )}
                    </Space>
                </div>
            )}
        >
            <Steps {...stepsProps} items={stepItems} style={{ marginBottom: 40, padding: '0 20px' }} />
            
            <Form {...formProps} layout="vertical">
                {/* STEP 1: INFO */}
                <div style={{ display: current === 0 ? 'block' : 'none' }}>
                    <Card bordered={false} className="step-card">
                        <Title level={4}>Informasi Pelaksanaan</Title>
                        <Divider />
                        <Form.Item label="Judul Ulangan" name="judul" rules={[{ required: true }]}>
                            <Input placeholder="Contoh: Ulangan Nahwu Alfiyah Pekan 1" size="large" />
                        </Form.Item>
                        <Space size="large" wrap>
                            <Form.Item label="Minggu Ke" name="minggu_ke" rules={[{ required: true }]}>
                                <InputNumber min={1} placeholder="1" />
                            </Form.Item>
                            <Form.Item label="Tahun Ajaran" name="tahun_ajaran" rules={[{ required: true }]}>
                                <Input placeholder="2025/2026" />
                            </Form.Item>
                            <Form.Item label="Tanggal" name="tanggal_pelaksanaan" rules={[{ required: true }]}>
                                <DatePicker />
                            </Form.Item>
                        </Space>
                        <Form.Item label="Mode" name="mode_pengerjaan" rules={[{ required: true }]}>
                            <Select placeholder="Pilih Mode" style={{ width: 200 }}>
                                <Select.Option value="individu">Individu</Select.Option>
                                <Select.Option value="kelompok">Kelompok</Select.Option>
                                <Select.Option value="campuran">Campuran</Select.Option>
                            </Select>
                        </Form.Item>
                    </Card>
                </div>

                {/* STEP 2: PILIH SOAL */}
                <div style={{ display: current === 1 ? 'block' : 'none' }}>
                    <Card bordered={false}>
                        <Title level={4}>Seleksi Bank Soal</Title>
                        <Text type="secondary">Pindahkan soal dari kiri ke kanan untuk disertakan dalam ulangan.</Text>
                        <Divider />
                        <Transfer
                            dataSource={dataSource}
                            titles={['Tersedia di Bank', 'Akan Diujikan']}
                            targetKeys={targetKeys}
                            onChange={setTargetKeys}
                            render={(item) => (
                                <div style={{ padding: '8px 0' }}>
                                    <Tag color="cyan">{item.kitab?.toUpperCase()}</Tag>
                                    <Text strong>{item.title}</Text>
                                    <div className="arabic-text" style={{ fontSize: 14, marginTop: 4 }}>
                                        {item.description?.substring(0, 60)}...
                                    </div>
                                </div>
                            )}
                            listStyle={{ width: '100%', height: 400 }}
                            showSearch
                        />
                    </Card>
                </div>

                {/* STEP 3: FINALISASI */}
                <div style={{ display: current === 2 ? 'block' : 'none' }}>
                    <Result
                        status="info"
                        title="Tinjau Ulang Draft Ulangan"
                        subTitle={`Anda telah memilih ${targetKeys.length} soal untuk diujikan pada ulangan ini.`}
                        extra={[
                            <Card key="summary" style={{ textAlign: 'left', maxWidth: 500, margin: '0 auto 20px auto' }}>
                                <Space direction="vertical">
                                    <Text>• Status: <Tag color="default">DRAFT (Belum Terkunci)</Tag></Text>
                                    <Text>• Target: Santri Kelas 2</Text>
                                    <Text>• Soal Terpilih: {targetKeys.length} Butir Soal</Text>
                                </Space>
                            </Card>
                        ]}
                    />
                </div>
            </Form>
        </Create>
    );
};
