import React from "react";
import { useOne } from "@refinedev/core";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import { Typography, Card, Row, Col, Avatar, Tag, Button, Statistic, Divider, Spin, Space } from "antd";
import {
    ReadOutlined,
    HistoryOutlined,
    DownloadOutlined,
    ArrowLeftOutlined
} from "@ant-design/icons";
import { ISantri } from "../../types";
import { useNavigate, useParams } from "react-router-dom";
import { formatDualDate } from "../../utility/dateHelper";
import { supabaseClient } from "../../utility/supabaseClient";
import { santriAlias } from "../../utility/privacy";

const { Title, Text } = Typography;

type HafalanRow = {
    id: number;
    tanggal: string | null;
    surat: string | null;
    ayat_awal: number | null;
    ayat_akhir: number | null;
    juz: number | null;
    total_hafalan: number | null;
    status: string | null;
    predikat: string | null;
    catatan: string | null;
};

type HafalanSummary = {
    total_count: number;
    latest: HafalanRow | null;
};

const formatAyat = (item: HafalanRow) => {
    if (item.ayat_awal && item.ayat_akhir) return `Ayat ${item.ayat_awal} - ${item.ayat_akhir}`;
    return "-";
};

export const HafalanShow = () => {
    const { id } = useParams(); // Ini adalah NIS santri karena route kita /hafalan/show/:nis
    const navigate = useNavigate();

    // 1. Ambil Data Santri
    const { data: santriData, isLoading: santriLoading } = useOne<ISantri>({
        resource: "santri",
        id: id as string,
        meta: { idColumnName: "nis", select: "nama, nis, kelas, jurusan, jenis_kelamin, status_santri, total_hafalan, foto_url" } // Penting karena PK kita NIS
    });

    const [summary, setSummary] = React.useState<HafalanSummary>({
        total_count: 0,
        latest: null,
    });

    React.useEffect(() => {
        if(id) {
            supabaseClient
                .from('hafalan_tahfidz')
                .select('id,tanggal,surat,ayat_awal,ayat_akhir,juz,total_hafalan,status,predikat,catatan', { count: 'exact' })
                .eq('santri_nis', id)
                .order('tanggal', { ascending: false })
                .order('id', { ascending: false })
                .range(0, 0)
                .then(({ data, count }) => {
                    setSummary({
                        total_count: count || 0,
                        latest: (data?.[0] as HafalanRow | undefined) || null,
                    });
                });
        }
    }, [id]);

    const record = santriData?.data;

    if (santriLoading || !record) return <div className="p-8"><Spin /></div>;

    const columns: ProColumns<HafalanRow>[] = [
        {
            title: "Tanggal",
            dataIndex: "tanggal",
            width: 180,
            render: (_, item) => (
                <Text className="text-xs text-gray-500">{item.tanggal ? formatDualDate(item.tanggal) : "-"}</Text>
            ),
        },
        {
            title: "Surat",
            dataIndex: "surat",
            render: (_, item) => <Text strong>{item.surat || "-"}</Text>,
        },
        {
            title: "Ayat",
            key: "ayat",
            width: 140,
            render: (_, item) => formatAyat(item),
        },
        {
            title: "Juz",
            dataIndex: "juz",
            width: 80,
            render: (_, item) => item.juz ? <Tag color="cyan">Juz {item.juz}</Tag> : "-",
        },
        {
            title: "Total",
            dataIndex: "total_hafalan",
            width: 90,
            render: (_, item) => item.total_hafalan !== null && item.total_hafalan !== undefined ? `${item.total_hafalan} Juz` : "-",
        },
        {
            title: "Predikat",
            dataIndex: "predikat",
            width: 110,
            render: (_, item) => (
                <Tag color={item.predikat === "MUMTAZ" ? "success" : item.predikat === "KURANG" ? "error" : "processing"}>
                    {item.predikat || "-"}
                </Tag>
            ),
        },
        {
            title: "Catatan",
            dataIndex: "catatan",
            width: 220,
            render: (_, item) => (
                <Text type="secondary" ellipsis={{ tooltip: item.catatan || "-" }}>
                    {item.catatan || "-"}
                </Text>
            ),
        },
    ];

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
                        <Title level={3} style={{ margin: 0 }}>{record.nama || santriAlias(record.nis)}</Title>
                        <Text type="secondary">{record.nis} | {record.kelas}</Text>
                        
                        <Divider />
                        
                        <Row gutter={16}>
                            <Col span={12}>
        <Statistic
            title="Total Setoran"
            value={summary.total_count}
            prefix={<HistoryOutlined />}
            valueStyle={{ fontSize: 20 }}
        />
    </Col>
                        <Col span={12}>
                            {/* LOGIKA DIPERBAIKI: Menampilkan Posisi Terakhir, bukan Progress Bar */}
                            <Statistic
                                title="Posisi Saat Ini"
                                value={summary.latest?.juz ? `Juz ${summary.latest.juz}` : "-"}
                                prefix={<ReadOutlined className="text-emerald-500"/>}
                                valueStyle={{ fontSize: 20, color: '#059669' }}
                            />
                            <Text type="secondary" style={{ fontSize: 10 }}>
                                {summary.latest?.surat
                                    ? `${summary.latest.surat} (${formatAyat(summary.latest)})`
                                    : "Belum ada setoran"}
                            </Text>
                        </Col>
                        </Row>
                    </Card>
                </Col>

                {/* TIMELINE HAFALAN */}
                <Col xs={24} md={16}>
                    <ProTable<HafalanRow>
                        columns={columns}
                        rowKey="id"
                        search={false}
                        options={{ density: true, reload: true }}
                        headerTitle={
                            <Space>
                                <ReadOutlined />
                                <Text strong>Riwayat Setoran (Ziyadah)</Text>
                            </Space>
                        }
                        request={async (params) => {
                            const current = params.current || 1;
                            const pageSize = params.pageSize || 20;
                            const from = (current - 1) * pageSize;
                            const to = from + pageSize - 1;

                            const { data, error, count } = await supabaseClient
                                .from("hafalan_tahfidz")
                                .select("id,tanggal,surat,ayat_awal,ayat_akhir,juz,total_hafalan,status,predikat,catatan", { count: "exact" })
                                .eq("santri_nis", id)
                                .order("tanggal", { ascending: false })
                                .order("id", { ascending: false })
                                .range(from, to);

                            if (error) return { data: [], success: false, total: 0 };

                            return {
                                data: (data || []) as HafalanRow[],
                                success: true,
                                total: count || 0,
                            };
                        }}
                        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
                        className="shadow-sm rounded-xl"
                    />
                </Col>
            </Row>
        </div>
    );
};
