import React, { useState } from "react";
import {
    List,
    useTable,
    EditButton,
    DeleteButton,
    CreateButton,
} from "@refinedev/antd";
import {
    Table,
    Space,
    Tag,
    Button,
    Drawer,
    Form,
    Input,
    Select,
    Typography,
    Tabs,
    Tooltip,
} from "antd";
import { PlusOutlined, FormOutlined, DatabaseOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import "../../../styles/arabic.css";

const { Text } = Typography;

export const WeeklyTestList: React.FC = () => {
    const navigate = useNavigate();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [form] = Form.useForm();

    // Table untuk Bank Soal
    const { tableProps: bankTableProps } = useTable({
        resource: "question_bank",
        syncWithLocation: true,
    });

    // Table untuk Daftar Ulangan (Status Draft/Final)
    const { tableProps: testTableProps } = useTable({
        resource: "weekly_tests",
        filters: {
            initial: [
                {
                    field: "status",
                    operator: "ne",
                    value: "selesai",
                },
            ],
        },
    });

    const bankSoalContent = (
        <List
            title="Koleksi Bank Soal"
            headerButtons={
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                        form.resetFields();
                        setIsDrawerOpen(true);
                    }}
                >
                    Tambah Soal ke Bank
                </Button>
            }
        >
            <Table {...bankTableProps} rowKey="id">
                <Table.Column
                    dataIndex="kitab"
                    title="Kitab"
                    render={(value: string) => (
                        <Tag color="blue">{value.toUpperCase()}</Tag>
                    )}
                />
                <Table.Column dataIndex="bab" title="Bab" />
                <Table.Column
                    dataIndex="konten_soal"
                    title="Konten Soal"
                    render={(value: string) => (
                        <div className="arabic-text" style={{ fontSize: 16, textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 300 }}>
                            {value}
                        </div>
                    )}
                />
                <Table.Column
                    dataIndex="is_ever_used"
                    title="Status"
                    render={(value: boolean) => (
                        value ? <Tag color="orange">TERPAKAI</Tag> : <Tag color="default">READY</Tag>
                    )}
                />
                <Table.Column
                    title="Aksi"
                    render={(_, record: any) => (
                        <Space>
                            <EditButton hideText size="small" recordItemId={record.id} />
                            <DeleteButton hideText size="small" recordItemId={record.id} />
                        </Space>
                    )}
                />
            </Table>
        </List>
    );

    const daftarUlanganContent = (
        <List
            title="Rencana Ulangan Aktif"
            headerButtons={
                <Button
                    type="primary"
                    icon={<FormOutlined />}
                    onClick={() => navigate("/ulangan/create")}
                    style={{ background: '#10b981', borderColor: '#10b981' }}
                >
                    Buat Ulangan Baru
                </Button>
            }
        >
            <Table {...testTableProps} rowKey="id">
                <Table.Column dataIndex="judul" title="Judul Ulangan" />
                <Table.Column dataIndex="tanggal_pelaksanaan" title="Rencana Tanggal" />
                <Table.Column 
                    dataIndex="status" 
                    title="Status" 
                    render={(value) => <Tag color={value === 'final' ? 'blue' : 'default'}>{value.toUpperCase()}</Tag>}
                />
                <Table.Column
                    title="Aksi"
                    render={(_, record: any) => (
                        <Space>
                            <EditButton hideText size="small" recordItemId={record.id} resource="weekly_tests" />
                            <DeleteButton hideText size="small" recordItemId={record.id} resource="weekly_tests" />
                        </Space>
                    )}
                />
            </Table>
        </List>
    );

    const items = [
        {
            key: '1',
            label: <span><DatabaseOutlined /> Bank Soal</span>,
            children: bankSoalContent,
        },
        {
            key: '2',
            label: <span><FormOutlined /> Daftar Rencana Ulangan</span>,
            children: daftarUlanganContent,
        },
    ];

    return (
        <>
            <Tabs defaultActiveKey="1" items={items} type="card" style={{ marginTop: 10 }} />

            <Drawer
                title="Tambah Soal Baru"
                width={500}
                onClose={() => setIsDrawerOpen(false)}
                open={isDrawerOpen}
                extra={
                    <Space>
                        <Button onClick={() => setIsDrawerOpen(false)}>Batal</Button>
                        <Button onClick={() => form.submit()} type="primary">Simpan</Button>
                    </Space>
                }
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={(values) => {
                        // Logika create question_bank
                        setIsDrawerOpen(false);
                    }}
                >
                    <Form.Item name="kitab" label="Kitab" rules={[{ required: true }]}>
                        <Select placeholder="Pilih Kitab">
                            <Select.Option value="alfiyah">Alfiyah</Select.Option>
                            <Select.Option value="nadzmul_maqshud">Nadzmul Maqshud</Select.Option>
                            <Select.Option value="kailani">Kailani</Select.Option>
                        </Select>
                    </Form.Item>
                    <Form.Item name="bab" label="Bab" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="konten_soal" label="Teks Soal (Arab)" rules={[{ required: true }]}>
                        <Input.TextArea rows={6} className="arabic-input-textarea" />
                    </Form.Item>
                    <Form.Item name="tingkat_kesulitan" label="Kesulitan" initialValue="sedang">
                        <Select>
                            <Select.Option value="mudah">Mudah</Select.Option>
                            <Select.Option value="sedang">Sedang</Select.Option>
                            <Select.Option value="sulit">Sulit</Select.Option>
                        </Select>
                    </Form.Item>
                </Form>
            </Drawer>
        </>
    );
};
