import React, { useRef, useState, useEffect } from "react";
import { useOne, useNavigation } from "@refinedev/core";
import { Typography, Card, Row, Col, Avatar, Timeline, Tag, Button, Statistic, Divider, Spin, Space } from "antd";
import { 
    ReadOutlined, 
    ArrowLeftOutlined, 
    PrinterOutlined,
    BookOutlined,
    UserOutlined,
    CheckCircleOutlined
} from "@ant-design/icons";
import { ISantri, IHafalanKitab } from "../../types";
import { useParams } from "react-router-dom";
import dayjs from "dayjs";
import { formatDualDate, formatHijri, formatMasehi } from "../../utility/dateHelper";
import { supabaseClient } from "../../utility/supabaseClient";
import { useReactToPrint } from "react-to-print";

const { Title, Text } = Typography;

export const HafalanKitabShow = () => {
    const { id } = useParams(); 
    const { list } = useNavigation();
    const printRef = useRef(null);

    const { data: santriData, isLoading: santriLoading } = useOne<ISantri>({
        resource: "santri",
        id: id as string,
        meta: { idColumnName: "nis" }
    });

    const [riwayat, setRiwayat] = useState<IHafalanKitab[]>([]);
    const [loadingRiwayat, setLoadingRiwayat] = useState(true);

    useEffect(() => {
        if(id) {
            const fetchRiwayat = async () => {
                const { data } = await supabaseClient
                    .from('hafalan_kitab')
                    .select('*')
                    .eq('santri_nis', id)
                    .order('tanggal', { ascending: false });
                setRiwayat(data || []);
                setLoadingRiwayat(false);
            };
            fetchRiwayat();
        }
    }, [id]);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
    });

    if (santriLoading || loadingRiwayat) return <div className="p-20 text-center"><Spin size="large" /></div>;
    const santri = santriData?.data;

    // Statistik Sederhana
    const totalSetoran = riwayat.length;
    const lulusSetoran = riwayat.filter(r => r.status === 'LULUS').length;

    return (
        <div className="p-4">
            <div className="flex items-center justify-between mb-6">
                <Button icon={<ArrowLeftOutlined />} onClick={() => list("hafalan_kitab")}>Kembali</Button>
                <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>Cetak Raport Takhasus</Button>
            </div>

            <Row gutter={[24, 24]}>
                <Col xs={24} md={8}>
                    <Card className="text-center shadow-sm rounded-xl border-emerald-100">
                        <Avatar size={100} src={santri?.foto_url} icon={<UserOutlined />} className="bg-emerald-50 text-emerald-600 mb-4 border-2 border-emerald-200" />
                        <Title level={3} style={{ margin: 0 }}>{santri?.nama}</Title>
                        <Text type="secondary" className="block mb-4">{santri?.nis} | Kelas {santri?.kelas} - {santri?.jurusan}</Text>
                        
                        <Divider />
                        
                        <Row gutter={16}>
                            <Col span={12}>
                                <Statistic title="Total Setoran" value={totalSetoran} />
                            </Col>
                            <Col span={12}>
                                <Statistic title="Lulus" value={lulusSetoran} valueStyle={{ color: '#10b981' }} />
                            </Col>
                        </Row>
                    </Card>
                </Col>

                <Col xs={24} md={16}>
                    <Card title={<Space><BookOutlined className="text-emerald-600"/> Riwayat Hafalan Kitab</Space>} className="shadow-sm rounded-xl">
                        <Timeline mode="left" className="mt-6">
                            {riwayat.map((item) => (
                                <Timeline.Item 
                                    key={item.id} 
                                    color={item.status === 'LULUS' ? 'green' : 'orange'}
                                    label={<div className="text-[10px] text-gray-500 leading-tight">{formatDualDate(item.tanggal)}</div>}
                                >
                                    <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <Tag color="blue" className="font-bold">{item.nama_kitab}</Tag>
                                                <Text strong className="block mt-1">{item.bab_materi}</Text>
                                            </div>
                                            <Tag color={item.predikat === 'MUMTAZ' ? 'success' : 'default'}>{item.predikat}</Tag>
                                        </div>
                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                            {item.bait_awal ? `Bait: ${item.bait_awal} - ${item.bait_akhir}` : `Halaman: ${item.halaman_awal} - ${item.halaman_akhir}`}
                                        </Text>
                                        {item.catatan && (
                                            <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/10 rounded text-[11px] text-amber-700 italic border-l-2 border-amber-400">
                                                "{item.catatan}"
                                            </div>
                                        )}
                                    </div>
                                </Timeline.Item>
                            ))}
                        </Timeline>
                        {riwayat.length === 0 && <div className="text-center py-10 text-gray-400 italic">Belum ada riwayat setoran kitab.</div>}
                    </Card>
                </Col>
            </Row>

            {/* --- AREA CETAK (HIDDEN IN UI) --- */}
            <div style={{ display: 'none' }}>
                <div ref={printRef} className="p-10 text-black">
                    <div className="text-center mb-10 border-b-2 border-black pb-4">
                        <Title level={2} style={{ margin: 0 }}>RAPORT HAFALAN KITAB (TAKHASUS)</Title>
                        <Text strong>PESANTREN AL-HASANAH</Text>
                    </div>

                    <Row className="mb-6">
                        <Col span={12}>
                            <table className="w-full">
                                <tr><td>Nama Santri</td><td>:</td><td>{santri?.nama}</td></tr>
                                <tr><td>NIS</td><td>:</td><td>{santri?.nis}</td></tr>
                            </table>
                        </Col>
                        <Col span={12}>
                            <table className="w-full">
                                <tr><td>Kelas</td><td>:</td><td>{santri?.kelas}</td></tr>
                                <tr><td>Jurusan</td><td>:</td><td>{santri?.jurusan}</td></tr>
                            </table>
                        </Col>
                    </Row>

                    <table className="w-full border-collapse border border-black mb-10">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border border-black p-2">No</th>
                                <th className="border border-black p-2">Tanggal</th>
                                <th className="border border-black p-2">Nama Kitab</th>
                                <th className="border border-black p-2">Materi / Bab</th>
                                <th className="border border-black p-2">Cakupan</th>
                                <th className="border border-black p-2">Hasil</th>
                            </tr>
                        </thead>
                        <tbody>
                            {riwayat.map((r, i) => (
                                <tr key={r.id}>
                                    <td className="border border-black p-2 text-center">{i+1}</td>
                                    <td className="border border-black p-2">{formatMasehi(r.tanggal)}</td>
                                    <td className="border border-black p-2">{r.nama_kitab}</td>
                                    <td className="border border-black p-2">{r.bab_materi}</td>
                                    <td className="border border-black p-2 text-center">{r.bait_awal ? `Bait ${r.bait_awal}-${r.bait_akhir}` : `Hal ${r.halaman_awal}-${r.halaman_akhir}`}</td>
                                    <td className="border border-black p-2 text-center">{r.predikat}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="flex justify-end mt-20">
                        <div className="text-center w-64">
                            <Text>Tasikmalaya, {formatMasehi(new Date())}</Text><br/>
                            <Text strong>{formatHijri(new Date())}</Text><br/><br/><br/><br/>
                            <Text strong underline>Ustadz Pembimbing</Text>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
