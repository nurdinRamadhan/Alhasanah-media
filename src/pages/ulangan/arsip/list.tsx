import React, { useState } from "react";
import {
    List,
    useTable,
    ShowButton,
    useModalForm,
} from "@refinedev/antd";
import { useList, useUpdate, useCreateMany, useGetIdentity } from "@refinedev/core";
import {
    Table,
    Space,
    Tag,
    Typography,
    Button,
    Tooltip,
    Modal,
    InputNumber,
    message,
    Spin,
    Form,
    Input,
} from "antd";
import { FilePdfOutlined, FileExcelOutlined, EditOutlined, SaveOutlined } from "@ant-design/icons";

const { Text } = Typography;

export const WeeklyTestArsip: React.FC = () => {
    const { data: identity } = useGetIdentity<any>();
    const { tableProps } = useTable({
        resource: "weekly_tests",
        initialSorter: [
            {
                field: "tanggal_pelaksanaan",
                order: "desc",
            },
        ],
    });

    const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);
    const [selectedTest, setSelectedTest] = useState<any>(null);
    const [grades, setGrades] = useState<Record<string, number>>({});

    // Ambil daftar santri kelas 2
    const { data: santriData, isLoading: santriLoading } = useList({
        resource: "santri",
        filters: [
            {
                field: "kelas",
                operator: "eq",
                value: "2",
            },
        ],
        pagination: { mode: "off" },
    });

    // Ambil data nilai yang sudah ada (jika ada)
    const { data: submissionData, refetch: refetchSubmissions } = useList({
        resource: "test_submissions",
        filters: [
            {
                field: "test_id",
                operator: "eq",
                value: selectedTest?.id,
            },
        ],
        queryOptions: {
            enabled: !!selectedTest,
        },
    });

    const { mutate: createSubmissions } = useCreateMany();
    const { mutate: updateTestStatus } = useUpdate();

    const openGradeModal = (record: any) => {
        setSelectedTest(record);
        setIsGradeModalOpen(true);
        
        // Initialize grades from existing submissions
        const existingGrades: Record<string, number> = {};
        submissionData?.data?.forEach((sub: any) => {
            if (sub.santri_nis) {
                existingGrades[sub.santri_nis] = sub.nilai;
            }
        });
        setGrades(existingGrades);
    };

    const handleSaveGrades = () => {
        const submissions = santriData?.data.map((s: any) => ({
            test_id: selectedTest.id,
            mode: "individu",
            santri_nis: s.nis,
            nilai: grades[s.nis] || 0,
            status_kehadiran: "hadir",
            dinilai_oleh: identity?.id,
        }));

        createSubmissions({
            resource: "test_submissions",
            values: submissions || [],
        }, {
            onSuccess: () => {
                message.success("Nilai berhasil disimpan!");
                updateTestStatus({
                    resource: "weekly_tests",
                    id: selectedTest.id,
                    values: { status: "selesai" },
                });
                setIsGradeModalOpen(false);
            },
        });
    };

    return (
        <List title="Arsip Ulangan & Nilai">
            <Table {...tableProps} rowKey="id">
                <Table.Column
                    dataIndex="minggu_ke"
                    title="Minggu"
                    render={(value: number) => <Text strong>W{value}</Text>}
                />
                <Table.Column dataIndex="judul" title="Judul" />
                <Table.Column dataIndex="tanggal_pelaksanaan" title="Tanggal" />
                <Table.Column
                    dataIndex="mode_pengerjaan"
                    title="Mode"
                    render={(value: string) => (
                        <Tag color={value === 'individu' ? 'blue' : 'purple'}>
                            {value?.toUpperCase()}
                        </Tag>
                    )}
                />
                <Table.Column
                    dataIndex="status"
                    title="Status"
                    render={(value: string) => {
                        let color = "default";
                        if (value === "final") color = "processing";
                        if (value === "selesai") color = "success";
                        return <Tag color={color}>{value?.toUpperCase()}</Tag>;
                    }}
                />
                <Table.Column
                    title="Aksi"
                    dataIndex="actions"
                    render={(_, record: any) => (
                        <Space>
                            <Tooltip title="Input / Edit Nilai">
                                <Button 
                                    size="small" 
                                    icon={<EditOutlined />} 
                                    disabled={record.status === 'draft'}
                                    onClick={() => openGradeModal(record)}
                                />
                            </Tooltip>
                            <Tooltip title="Cetak Soal (PDF)">
                                <Button 
                                    size="small" 
                                    icon={<FilePdfOutlined />} 
                                    danger 
                                />
                            </Tooltip>
                            <Tooltip title="Ekspor Nilai (Excel)">
                                <Button 
                                    size="small" 
                                    icon={<FileExcelOutlined />} 
                                    style={{ color: '#1d7044', borderColor: '#1d7044' }}
                                />
                            </Tooltip>
                            <ShowButton hideText size="small" recordItemId={record.id} />
                        </Space>
                    )}
                />
            </Table>

            <Modal
                title={`Input Nilai: ${selectedTest?.judul}`}
                open={isGradeModalOpen}
                onCancel={() => setIsGradeModalOpen(false)}
                onOk={handleSaveGrades}
                width={800}
                okText="Simpan & Selesaikan"
                cancelText="Batal"
            >
                {santriLoading ? (
                    <div style={{ textAlign: 'center', padding: '20px' }}><Spin /></div>
                ) : (
                    <Table 
                        dataSource={santriData?.data} 
                        rowKey="nis" 
                        pagination={{ pageSize: 10 }}
                        size="small"
                    >
                        <Table.Column title="NIS" dataIndex="nis" width={100} />
                        <Table.Column title="Nama Santri" dataIndex="nama" />
                        <Table.Column 
                            title="Nilai (0-100)" 
                            render={(_, record: any) => (
                                <InputNumber
                                    min={0}
                                    max={100}
                                    value={grades[record.nis]}
                                    onChange={(val) => setGrades(prev => ({ ...prev, [record.nis]: val || 0 }))}
                                    style={{ width: '100%' }}
                                />
                            )}
                            width={150}
                        />
                    </Table>
                )}
            </Modal>
        </List>
    );
};
