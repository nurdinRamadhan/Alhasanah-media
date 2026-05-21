import React from "react";
import { useOne } from "@refinedev/core";
import { Typography, Card, Row, Col, Avatar, Tag, Button, Statistic, Spin, Space } from "antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import { ArrowLeftOutlined, SyncOutlined, BookOutlined } from "@ant-design/icons";
import { ISantri } from "../../types";
import { useNavigate, useParams } from "react-router-dom";
import { supabaseClient } from "../../utility/supabaseClient";
import { formatDualDate } from "../../utility/dateHelper";
import { santriAlias } from "../../utility/privacy";

const { Title, Text } = Typography;

type MurojaahRow = {
    id: number;
    tanggal: string | null;
    jenis_murojaah: "SABAQ" | "MANZIL" | null;
    juz: number | null;
    surat: string | null;
    ayat_awal: number | null;
    ayat_akhir: number | null;
    halaman_awal: number | null;
    halaman_akhir: number | null;
    predikat: string | null;
    catatan: string | null;
};

type MurojaahSummary = {
    total_count: number;
    week_count: number;
    month_count: number;
};

const formatCoverage = (item: MurojaahRow) => {
    if (item.surat) {
        return `${item.surat}${item.ayat_awal && item.ayat_akhir ? ` (Ayat ${item.ayat_awal}-${item.ayat_akhir})` : ""}`;
    }
    if (item.halaman_awal && item.halaman_akhir) {
        return `Halaman ${item.halaman_awal} - ${item.halaman_akhir}`;
    }
    return item.juz ? `Juz ${item.juz}` : "-";
};

export const MurojaahShow = () => {
    const { id } = useParams(); 
    const navigate = useNavigate();

    const { data: santriData, isLoading } = useOne<ISantri>({
        resource: "santri",
        id: id as string,
        meta: { idColumnName: "nis", select: "nama, nis, kelas, jurusan, jenis_kelamin, status_santri, foto_url" }
    });

    const [summary, setSummary] = React.useState<MurojaahSummary>({
        total_count: 0,
        week_count: 0,
        month_count: 0,
    });

    React.useEffect(() => {
        if(id) {
            supabaseClient
                .rpc("get_admin_murojaah_summaries", { p_santri_nis: [id] })
                .then(({ data }) => {
                    const row = data?.[0];
                    if (row) {
                        setSummary({
                            total_count: Number(row.total_count || 0),
                            week_count: Number(row.week_count || 0),
                            month_count: Number(row.month_count || 0),
                        });
                    }
                });
        }
    }, [id]);

    if (isLoading || !santriData?.data) return <div className="p-8"><Spin /></div>;
    const record = santriData.data;

    const columns: ProColumns<MurojaahRow>[] = [
        {
            title: "Tanggal",
            dataIndex: "tanggal",
            width: 180,
            render: (_, item) => (
                <Text className="text-xs text-gray-500">{item.tanggal ? formatDualDate(item.tanggal) : "-"}</Text>
            ),
        },
        {
            title: "Jenis",
            dataIndex: "jenis_murojaah",
            width: 90,
            render: (_, item) => (
                <Tag color={item.jenis_murojaah === "SABAQ" ? "blue" : "purple"}>{item.jenis_murojaah || "-"}</Tag>
            ),
        },
        {
            title: "Juz",
            dataIndex: "juz",
            width: 80,
            render: (_, item) => item.juz ? <Text strong>Juz {item.juz}</Text> : "-",
        },
        {
            title: "Cakupan",
            key: "coverage",
            render: (_, item) => (
                <Text ellipsis={{ tooltip: formatCoverage(item) }}>{formatCoverage(item)}</Text>
            ),
        },
        {
            title: "Predikat",
            dataIndex: "predikat",
            width: 110,
            render: (_, item) => <Tag color={item.predikat === "MUMTAZ" ? "success" : "default"}>{item.predikat || "-"}</Tag>,
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
            <div className="flex items-center justify-between mb-6">
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/murojaah')}>Kembali</Button>
            </div>

            <Row gutter={[24, 24]}>
                <Col xs={24} md={8}>
                    <Card className="text-center shadow-sm rounded-xl border-purple-100">
                        <Avatar size={100} src={record.foto_url} icon={<SyncOutlined />} className="bg-purple-100 text-purple-600 mb-4" />
                        <Title level={3} style={{ margin: 0 }}>{record.nama || santriAlias(record.nis)}</Title>
                        <Text type="secondary">{record.nis}</Text>
                        <div className="mt-6 flex justify-around">
                            <Statistic title="Total Murojaah" value={summary.total_count} valueStyle={{ fontSize: 18 }} />
                            <Statistic title="Pekan Ini" value={summary.week_count} valueStyle={{ fontSize: 18, color: '#9333ea' }} />
                            <Statistic title="Bulan Ini" value={summary.month_count} valueStyle={{ fontSize: 18, color: '#2563eb' }} />
                        </div>
                    </Card>
                </Col>

                <Col xs={24} md={16}>
                    <ProTable<MurojaahRow>
                        columns={columns}
                        rowKey="id"
                        search={false}
                        options={{ density: true, reload: true }}
                        headerTitle={
                            <Space>
                                <BookOutlined />
                                <Text strong>Log Murojaah</Text>
                            </Space>
                        }
                        request={async (params) => {
                            const current = params.current || 1;
                            const pageSize = params.pageSize || 20;
                            const from = (current - 1) * pageSize;
                            const to = from + pageSize - 1;

                            const { data, error, count } = await supabaseClient
                                .from("murojaah_tahfidz")
                                .select("id,tanggal,jenis_murojaah,juz,surat,ayat_awal,ayat_akhir,halaman_awal,halaman_akhir,predikat,catatan", { count: "exact" })
                                .eq("santri_nis", id)
                                .order("tanggal", { ascending: false })
                                .order("id", { ascending: false })
                                .range(from, to);

                            if (error) {
                                return { data: [], success: false, total: 0 };
                            }

                            return {
                                data: (data || []) as MurojaahRow[],
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
