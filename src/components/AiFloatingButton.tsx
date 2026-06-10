import React, { useState, useEffect } from "react";
import { FloatButton, Typography, Spin, Button, Space, Popover, theme } from "antd";
import { 
    RobotOutlined, ReloadOutlined, BulbOutlined, 
    SafetyOutlined, MedicineBoxOutlined, WalletOutlined, 
    CheckCircleOutlined
} from "@ant-design/icons";
import { useList } from "@refinedev/core";
import dayjs from "dayjs";
import { santriAlias } from "../utility/privacy";

const { Text } = Typography;
const { useToken } = theme;

const SUCCESS_TRANSACTION_STATUSES = new Set(["success", "settlement", "capture", "paid", "posted"]);
const FAILED_TRANSACTION_STATUSES = new Set(["failed", "expire", "expired", "cancel", "deny", "failure"]);
const PENDING_TRANSACTION_STATUSES = new Set(["pending", "challenge"]);

const isSuccessTransaction = (trx: any) => {
    const status = String(trx?.status || "").toLowerCase();
    const statusTransaksi = String(trx?.status_transaksi || "").toLowerCase();
    if (FAILED_TRANSACTION_STATUSES.has(status) || FAILED_TRANSACTION_STATUSES.has(statusTransaksi)) return false;
    if (PENDING_TRANSACTION_STATUSES.has(status)) return false;
    return SUCCESS_TRANSACTION_STATUSES.has(status) || SUCCESS_TRANSACTION_STATUSES.has(statusTransaksi);
};

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
        meta: { select: "id,keluhan,keterangan,created_at,santri:santri_nis(nama,nis)" },
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

    const { data: dataTransaksi, refetch: refetchTransaksi } = useList({
        resource: "transaksi_keuangan",
        filters: [{ field: "tanggal_transaksi", operator: "gte", value: startOfMonth }],
        pagination: { mode: "off" },
        meta: { select: "id,jumlah,status,status_transaksi,jenis_transaksi,kategori,santri_nis,keterangan" },
        queryOptions: { enabled: isOpen }
    });

    const { data: dataTagihan, refetch: refetchTagihan } = useList({
        resource: "tagihan_santri",
        filters: [{ field: "created_at", operator: "gte", value: startOfMonth }],
        pagination: { mode: "off" },
        meta: { select: "id,status,nominal_tagihan,sisa_tagihan,deskripsi_tagihan" },
        queryOptions: { enabled: isOpen }
    });

    const handleRefresh = () => {
        setLoading(true);
        refetchSakit();
        refetchPelanggaran();
        refetchPengeluaran();
        refetchTransaksi();
        refetchTagihan();
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
                    text: `KESEHATAN (Minggu Ini): Ada ${jumlahSakit} kasus baru. Terakhir: ${latest?.santri?.nama || santriAlias(latest?.santri?.nis)} (${info}).`
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
            const totalMasuk = dataTransaksi?.data
                ?.filter((trx: any) => trx.jenis_transaksi === "masuk" && trx.kategori === "tagihan" && isSuccessTransaction(trx))
                .reduce((acc: any, trx: any) => acc + Number(trx.jumlah || 0), 0) || 0;
            const totalSisa = dataTagihan?.data
                ?.filter((tagihan: any) => tagihan.status !== "LUNAS")
                .reduce((acc: any, tagihan: any) => acc + Number(tagihan.sisa_tagihan || 0), 0) || 0;
            const jumlahCicilan = dataTagihan?.data?.filter((tagihan: any) => tagihan.status === "CICILAN").length || 0;
            result.push({
                type: totalMasuk >= totalKeluar ? 'success' : 'warning',
                icon: <WalletOutlined style={{ color: totalMasuk >= totalKeluar ? '#22c55e' : '#f97316' }}/>,
                text: `KEUANGAN (Bulan Ini): Kas masuk tagihan Rp ${totalMasuk.toLocaleString('id-ID')}, pengeluaran Rp ${totalKeluar.toLocaleString('id-ID')}, sisa piutang Rp ${totalSisa.toLocaleString('id-ID')}${jumlahCicilan ? ` dari ${jumlahCicilan} tagihan cicilan` : ""}.`
            });

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
    }, [isOpen, dataSakit, dataPelanggaran, dataPengeluaran, dataTransaksi, dataTagihan]);

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
                className="ai-pulse"
                style={{ width: 60, height: 60 }}
                tooltip="Tanya AI laporan sistem"
                badge={{ dot: true, color: 'green' }}
            />
        </Popover>
    );
};
