import React, { useMemo } from "react";
import { useList } from "@refinedev/core";
import { Card, Col, Row, Statistic, Typography, Skeleton, Alert } from "antd";
import { 
    UserOutlined, 
    ArrowUpOutlined, 
    WarningOutlined 
} from "@ant-design/icons";
import dayjs from "dayjs";

// Import tipe data agar kita yakin tidak salah ketik (Opsional, tapi good practice)
import { StatusSantri, StatusTransaksi, StatusTagihan } from "../../types";

const { Title } = Typography;

export const DashboardPage: React.FC = () => {
    
    // 1. Ambil Data Total Santri
    // FIX: Value harus "AKTIF" (Huruf Besar Semua sesuai types.ts)
    const { data: santriData, isLoading: isLoadingSantri, isError: isErrorSantri } = useList({
        resource: "santri",
        pagination: { mode: "off" },
        filters: [
            { field: "status_santri", operator: "eq", value: "AKTIF" } 
        ]
    });

    // 2. Ambil Data Transaksi Bulan Ini (Pemasukan)
    const startOfMonth = dayjs().startOf('month').toISOString();
    const endOfMonth = dayjs().endOf('month').toISOString();

    const { data: transaksiData, isLoading: isLoadingTransaksi } = useList({
        resource: "transaksi_keuangan",
        pagination: { mode: "off" },
        filters: [
            { field: "jenis_transaksi", operator: "eq", value: "masuk" },
            // Sesuai types.ts Anda: StatusTransaksi = 'settlement' (huruf kecil)
            { field: "status_transaksi", operator: "eq", value: "settlement" }, 
            { field: "tanggal_transaksi", operator: "gte", value: startOfMonth },
            { field: "tanggal_transaksi", operator: "lte", value: endOfMonth },
        ]
    });

    // 3. Ambil Data Tunggakan (Sisa Tagihan)
    const { data: tagihanData, isLoading: isLoadingTagihan } = useList({
        resource: "tagihan_santri",
        pagination: { mode: "off" },
        filters: [
            // Sesuai types.ts Anda: StatusTagihan = 'LUNAS' (huruf besar)
            { field: "status", operator: "ne", value: "LUNAS" } 
        ]
    });

    // --- LOGIC PERHITUNGAN ---
    
    const totalSantri = santriData?.total || santriData?.data?.length || 0;

    const totalPemasukan = useMemo(() => {
        return transaksiData?.data?.reduce((acc, curr) => acc + Number(curr.jumlah), 0) || 0;
    }, [transaksiData]);

    const totalTunggakan = useMemo(() => {
        return tagihanData?.data?.reduce((acc, curr) => acc + Number(curr.sisa_tagihan), 0) || 0;
    }, [tagihanData]);

    return (
        <div style={{ padding: "20px" }}>
            <Title level={3}>Dashboard Ringkasan</Title>
            
            {/* Tampilkan Alert jika masih ada masalah koneksi/enum */}
            {isErrorSantri && (
                <Alert 
                    message="Gagal memuat data Santri" 
                    description="Mohon cek koneksi database atau kesesuaian Enum 'AKTIF'."
                    type="error" 
                    showIcon 
                    style={{ marginBottom: 20 }} 
                />
            )}

            <Row gutter={[16, 16]}>
                
                {/* KARTU 1: TOTAL SANTRI */}
                <Col xs={24} sm={8}>
                    <Card bordered={false} style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                        {isLoadingSantri ? <Skeleton active paragraph={{ rows: 1 }} /> : (
                            <Statistic
                                title="Total Santri Aktif"
                                value={totalSantri}
                                prefix={<UserOutlined style={{ color: "#1890ff" }} />}
                                suffix="Orang"
                                valueStyle={{ color: "#1890ff" }}
                            />
                        )}
                    </Card>
                </Col>

                {/* KARTU 2: PEMASUKAN BULAN INI */}
                <Col xs={24} sm={8}>
                    <Card bordered={false} style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                         {isLoadingTransaksi ? <Skeleton active paragraph={{ rows: 1 }} /> : (
                            <Statistic
                                title={`Pemasukan ${dayjs().format("MMMM YYYY")}`}
                                value={totalPemasukan}
                                precision={0}
                                prefix={<ArrowUpOutlined style={{ color: "#3f8600" }} />}
                                suffix="IDR"
                                valueStyle={{ color: "#3f8600" }}
                                formatter={(value) => `Rp ${Number(value).toLocaleString('id-ID')}`}
                            />
                        )}
                    </Card>
                </Col>

                {/* KARTU 3: TOTAL TUNGGAKAN */}
                <Col xs={24} sm={8}>
                    <Card bordered={false} style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                         {isLoadingTagihan ? <Skeleton active paragraph={{ rows: 1 }} /> : (
                            <Statistic
                                title="Total Tunggakan SPP"
                                value={totalTunggakan}
                                precision={0}
                                prefix={<WarningOutlined style={{ color: "#cf1322" }} />}
                                suffix="IDR"
                                valueStyle={{ color: "#cf1322" }}
                                formatter={(value) => `Rp ${Number(value).toLocaleString('id-ID')}`}
                            />
                        )}
                    </Card>
                </Col>
            </Row>

            <div style={{ marginTop: "30px" }}>
                <Card title="Informasi Sistem" bordered={false}>
                    <p>Selamat datang di Panel Admin Pesantren. Data di atas mencakup transaksi bulan ini dan tagihan yang belum lunas.</p>
                </Card>
            </div>
        </div>
    );
};