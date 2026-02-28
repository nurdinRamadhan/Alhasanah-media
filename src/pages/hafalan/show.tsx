import React from "react";
import { useShow, useOne } from "@refinedev/core";
import { Typography, Card, Row, Col, Avatar, Timeline, Tag, Button, Statistic, Divider, Spin } from "antd";
import { 
    ReadOutlined, 
    TrophyOutlined, 
    HistoryOutlined, 
    DownloadOutlined, 
    ArrowLeftOutlined 
} from "@ant-design/icons";
import { ISantri } from "../../types";
import { useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import { supabaseClient } from "../../utility/supabaseClient";

const { Title, Text } = Typography;

export const HafalanShow = () => {
    const { id } = useParams(); // Ini adalah NIS santri karena route kita /hafalan/show/:nis
    const navigate = useNavigate();

    // 1. Ambil Data Santri
    const { data: santriData, isLoading: santriLoading } = useOne<ISantri>({
        resource: "santri",
        id: id as string,
        meta: { idColumnName: "nis" } // Penting karena PK kita NIS
    });

    // 2. Ambil Riwayat Hafalan (Manual Fetch agar bisa sort desc)
    const [riwayat, setRiwayat] = React.useState<any[]>([]);
    const [loadingRiwayat, setLoadingRiwayat] = React.useState(true);

    React.useEffect(() => {
        if(id) {
            supabaseClient
                .from('hafalan_tahfidz')
                .select('*')
                .eq('santri_nis', id)
                .order('tanggal', { ascending: false })
                .then(({ data }) => {
                    setRiwayat(data || []);
                    setLoadingRiwayat(false);
                });
        }
    }, [id]);

    const record = santriData?.data;

    if (santriLoading || !record) return <div className="p-8"><Spin /></div>;

    return (
        <div className="p-4 pb-20">
            {/* HEADER */}
            <div className="flex items-center justify-between mb-6">
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/hafalan')}>Kembali</Button>
                <Button type="primary" icon={<DownloadOutlined />} className="bg-emerald-600">Download Raport Tahfidz</Button>
            </div>

            <Row gutter={[24, 24]}>
                {/* INFO SANTRI */}
                <Col xs={24} md={8}>
                    <Card className="text-center shadow-sm rounded-xl border-emerald-100">
                        <Avatar size={100} src={record.foto_url} icon={<ReadOutlined />} className="bg-emerald-100 text-emerald-600 mb-4" />
                        <Title level={3} style={{ margin: 0 }}>{record.nama}</Title>
                        <Text type="secondary">{record.nis} | {record.kelas}</Text>
                        
                        <Divider />
                        
                        <Row gutter={16}>
                            <Col span={12}>
        <Statistic 
            title="Total Setoran" 
            value={riwayat.length} 
            prefix={<HistoryOutlined />} 
            valueStyle={{ fontSize: 20 }}
        />
    </Col>
                        <Col span={12}>
                            {/* LOGIKA DIPERBAIKI: Menampilkan Posisi Terakhir, bukan Progress Bar */}
                            <Statistic 
                                title="Posisi Saat Ini" 
                                value={riwayat[0]?.juz ? `Juz ${riwayat[0]?.juz}` : "-"} 
                                prefix={<ReadOutlined className="text-emerald-500"/>} 
                                valueStyle={{ fontSize: 20, color: '#059669' }}
                            />
                            <Text type="secondary" style={{ fontSize: 10 }}>
                                {riwayat[0]?.surat} (Ayat {riwayat[0]?.ayat_akhir})
                            </Text>
                        </Col>
                        </Row>
                    </Card>
                </Col>

                {/* TIMELINE HAFALAN */}
                <Col xs={24} md={16}>
                    <Card title="Riwayat Setoran (Ziyadah)" className="shadow-sm rounded-xl h-full" loading={loadingRiwayat}>
                        <Timeline mode="left" className="mt-4">
                            {riwayat.map((item) => (
                                <Timeline.Item 
                                    key={item.id} 
                                    color={item.predikat === 'MUMTAZ' ? 'green' : item.predikat === 'KURANG' ? 'red' : 'blue'}
                                    label={dayjs(item.tanggal).format("DD MMM YYYY")}
                                >
                                    <div className="flex flex-col pb-4">
                                        <div className="flex justify-between items-center">
                                            <Text strong className="text-lg text-emerald-800">{item.surat}</Text>
                                            <Tag color={item.predikat === 'MUMTAZ' ? 'success' : 'processing'}>{item.predikat}</Tag>
                                        </div>
                                        <Text>Ayat {item.ayat_awal} - {item.ayat_akhir}</Text>
                                        {item.catatan && (
                                            <div className="bg-gray-50 p-2 rounded mt-2 text-xs text-gray-500 italic border border-gray-100">
                                                "{item.catatan}"
                                            </div>
                                        )}
                                    </div>
                                </Timeline.Item>
                            ))}
                        </Timeline>
                        {riwayat.length === 0 && <Text type="secondary" className="text-center block">Belum ada data hafalan.</Text>}
                    </Card>
                </Col>
            </Row>
        </div>
    );
};