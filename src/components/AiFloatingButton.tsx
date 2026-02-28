import React, { useState, useEffect } from "react";
import { FloatButton, Typography, Spin, Button, Space, Popover, theme } from "antd";
import { 
    RobotOutlined, ReloadOutlined, BulbOutlined, 
    SafetyOutlined, MedicineBoxOutlined, WalletOutlined, 
    CheckCircleOutlined
} from "@ant-design/icons";
import { useList } from "@refinedev/core";
import dayjs from "dayjs";

const { Text } = Typography;
const { useToken } = theme;

export const AiFloatingButton = () => {
    const { token } = useToken();
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [insight, setInsight] = useState<any[]>([]);

    // --- SETUP FILTER WAKTU AUTOMATIS ---
    const startOfMonth = dayjs().startOf('month').format('YYYY-MM-DD');
    const startOfWeek = dayjs().startOf('week').format('YYYY-MM-DD'); // Minggu ini
    
    // 1. DATA KESEHATAN (MINGGU INI)
    const { data: dataSakit, refetch: refetchSakit } = useList({
        resource: "kesehatan_santri",
        filters: [{ field: "created_at", operator: "gte", value: startOfWeek }],
        pagination: { pageSize: 5 },
        sorters: [{ field: "created_at", order: "desc" }],
        queryOptions: { enabled: isOpen }
    });

    // 2. DATA PELANGGARAN (MINGGU INI)
    const { data: dataPelanggaran, refetch: refetchPelanggaran } = useList({
        resource: "pelanggaran_santri",
        filters: [{ field: "created_at", operator: "gte", value: startOfWeek }],
        pagination: { pageSize: 3 },
        sorters: [{ field: "created_at", order: "desc" }],
        queryOptions: { enabled: isOpen }
    });

    // 3. DATA PENGELUARAN (BULAN INI)
    const { data: dataPengeluaran, refetch: refetchPengeluaran } = useList({
        resource: "pengeluaran",
        filters: [{ field: "tanggal_pengeluaran", operator: "gte", value: startOfMonth }],
        pagination: { mode: "off" }, // Ambil semua data bulan ini untuk dihitung totalnya
        queryOptions: { enabled: isOpen }
    });

    const handleRefresh = () => {
        setLoading(true);
        refetchSakit();
        refetchPelanggaran();
        refetchPengeluaran();
        generateInsight();
    };

    const generateInsight = () => {
        setLoading(true);
        setTimeout(() => {
            const result = [];
            const jam = new Date().getHours();
            const sapaan = jam < 11 ? "Selamat Pagi" : (jam < 15 ? "Selamat Siang" : (jam < 18 ? "Selamat Sore" : "Selamat Malam"));

            // Intro
            result.push({
                type: 'intro',
                icon: <BulbOutlined style={{ color: '#eab308' }}/>,
                text: `${sapaan} Pak Kiai. Berikut laporan terkini:`
            });

            // Analisa Kesehatan (Mingguan)
            const jumlahSakit = dataSakit?.total || 0;
            if (jumlahSakit > 0) {
                const latest = dataSakit?.data[0];
                const info = latest?.keluhan || latest?.keterangan || "Sakit";
                result.push({
                    type: 'alert',
                    icon: <MedicineBoxOutlined style={{ color: '#ef4444' }}/>,
                    text: `KESEHATAN (Minggu Ini): Ada ${jumlahSakit} kasus baru. Terakhir: ${latest?.santri?.nama} (${info}).`
                });
            } else {
                result.push({
                    type: 'success',
                    icon: <CheckCircleOutlined style={{ color: '#22c55e' }}/>,
                    text: `KESEHATAN: Alhamdulillah, minggu ini belum ada catatan santri sakit berat.`
                });
            }

            // Analisa Keuangan (Bulanan)
            const totalKeluar = dataPengeluaran?.data?.reduce((acc:any, curr:any) => acc + Number(curr.nominal || 0), 0) || 0;
            if (totalKeluar > 0) {
                result.push({
                    type: 'info',
                    icon: <WalletOutlined style={{ color: '#3b82f6' }}/>,
                    text: `PENGELUARAN (Bulan Ini): Total operasional mencapai Rp ${totalKeluar.toLocaleString('id-ID')}.`
                });
            } else {
                 result.push({
                    type: 'info',
                    icon: <WalletOutlined style={{ color: '#3b82f6' }}/>,
                    text: `PENGELUARAN (Bulan Ini): Belum ada pengeluaran tercatat bulan ini.`
                });
            }

            // Analisa Pelanggaran (Mingguan)
            const jumlahPelanggaran = dataPelanggaran?.total || 0;
            if (jumlahPelanggaran > 0) {
                const latestP = dataPelanggaran?.data[0];
                const jenis = latestP?.jenis_pelanggaran || latestP?.pelanggaran || "Disiplin";
                result.push({
                    type: 'warning',
                    icon: <SafetyOutlined style={{ color: '#f97316' }}/>,
                    text: `DISIPLIN (Minggu Ini): Terdeteksi ${jumlahPelanggaran} pelanggaran baru. Kasus terbaru: "${jenis}".`
                });
            } else {
                result.push({
                    type: 'success',
                    icon: <CheckCircleOutlined style={{ color: '#22c55e' }}/>,
                    text: `DISIPLIN: Minggu ini kondisi aman, belum ada pelanggaran tercatat.`
                });
            }

            setInsight(result);
            setLoading(false);
        }, 1200);
    };

    useEffect(() => {
        if (isOpen) generateInsight();
    }, [isOpen, dataSakit, dataPelanggaran, dataPengeluaran]);

    const content = (
        <div style={{ width: 350, maxHeight: 450, overflowY: 'auto' }}>
            <div className="flex justify-between items-center mb-4 border-b pb-2">
                <Space>
                    <RobotOutlined style={{ fontSize: 20, color: token.colorPrimary }} />
                    <Text strong style={{ fontSize: 16 }}>Smart Insight</Text>
                </Space>
                <Button type="text" icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading} size="small"/>
            </div>

            {loading ? (
                <div className="text-center py-10">
                    <Spin tip="Menganalisa Data (Mingguan & Bulanan)..." />
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {insight.map((item, idx) => (
                        <div 
                            key={idx} 
                            style={{ 
                                background: token.colorBgContainer, 
                                border: `1px solid ${token.colorBorderSecondary}`,
                                borderRadius: 8,
                                padding: 12,
                                display: 'flex',
                                gap: 12,
                                alignItems: 'flex-start',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                            }}
                        >
                            <div style={{ fontSize: 18, marginTop: 2 }}>{item.icon}</div>
                            <Text style={{ fontSize: 13, lineHeight: 1.5 }}>
                                {item.text}
                            </Text>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <Popover
            content={content}
            title={null}
            trigger="click"
            open={isOpen}
            onOpenChange={setIsOpen}
            placement="topLeft"
            overlayInnerStyle={{ padding: 16, borderRadius: 12 }}
        >
            <FloatButton 
                type="primary" 
                icon={<RobotOutlined />} 
                style={{ width: 60, height: 60 }}
                tooltip="Tanya AI laporan sistem"
                badge={{ dot: true, color: 'green' }}
            />
        </Popover>
    );
};