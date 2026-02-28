import React from "react";
import { useOne } from "@refinedev/core";
import { Typography, Card, Row, Col, Avatar, Timeline, Tag, Button, Statistic, Spin, Space } from "antd";
import { ArrowLeftOutlined, SyncOutlined, BookOutlined } from "@ant-design/icons";
import { ISantri } from "../../types";
import { useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import { supabaseClient } from "../../utility/supabaseClient";

const { Title, Text } = Typography;

export const MurojaahShow = () => {
    const { id } = useParams(); 
    const navigate = useNavigate();

    const { data: santriData, isLoading } = useOne<ISantri>({
        resource: "santri",
        id: id as string,
        meta: { idColumnName: "nis" }
    });

    const [riwayat, setRiwayat] = React.useState<any[]>([]);
    
    React.useEffect(() => {
        if(id) {
            supabaseClient
                .from('murojaah_tahfidz')
                .select('*')
                .eq('santri_nis', id)
                .order('tanggal', { ascending: false })
                .then(({ data }) => setRiwayat(data || []));
        }
    }, [id]);

    if (isLoading || !santriData?.data) return <div className="p-8"><Spin /></div>;
    const record = santriData.data;

    return (
        <div className="p-4 pb-20">
            <div className="flex items-center justify-between mb-6">
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/murojaah')}>Kembali</Button>
            </div>

            <Row gutter={[24, 24]}>
                <Col xs={24} md={8}>
                    <Card className="text-center shadow-sm rounded-xl border-purple-100">
                        <Avatar size={100} src={record.foto_url} icon={<SyncOutlined />} className="bg-purple-100 text-purple-600 mb-4" />
                        <Title level={3} style={{ margin: 0 }}>{record.nama}</Title>
                        <Text type="secondary">{record.nis}</Text>
                        <div className="mt-6 flex justify-around">
                            <Statistic title="Total Murojaah" value={riwayat.length} valueStyle={{ fontSize: 18 }} />
                            <Statistic title="Pekan Ini" value={riwayat.filter(r => dayjs(r.tanggal).isAfter(dayjs().startOf('week'))).length} valueStyle={{ fontSize: 18, color: '#9333ea' }} />
                        </div>
                    </Card>
                </Col>

                <Col xs={24} md={16}>
                    <Card title="Log Murojaah" className="shadow-sm rounded-xl h-full">
                        <Timeline mode="left" className="mt-4">
                            {riwayat.map((item) => (
                                <Timeline.Item 
                                    key={item.id} 
                                    color={item.jenis_murojaah === 'SABAQ' ? 'blue' : 'purple'}
                                    label={dayjs(item.tanggal).format("DD MMM")}
                                >
                                    <div className="flex flex-col pb-4">
                                        <div className="flex justify-between items-center">
                                            <Space>
                                                <Tag color={item.jenis_murojaah === 'SABAQ' ? 'blue' : 'purple'}>{item.jenis_murojaah}</Tag>
                                                <Text strong>Juz {item.juz}</Text>
                                            </Space>
                                            <Tag color={item.predikat === 'MUMTAZ' ? 'success' : 'default'}>{item.predikat}</Tag>
                                        </div>
                                        <div className="mt-1 text-gray-600">
                                            {item.surat ? (
                                                <span>{item.surat} (Ayat {item.ayat_awal}-{item.ayat_akhir})</span>
                                            ) : (
                                                <span>Halaman {item.halaman_awal} - {item.halaman_akhir}</span>
                                            )}
                                        </div>
                                    </div>
                                </Timeline.Item>
                            ))}
                        </Timeline>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};