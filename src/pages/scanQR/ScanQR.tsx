import React, { useState, useEffect } from "react";
import { 
    Card, Typography, Row, Col, Space, Tag, Avatar, 
    Descriptions, Spin, message, Segmented, Button, Divider, theme 
} from "antd";
import { 
    ScanOutlined, UserOutlined, WalletOutlined, 
    CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined,
    IdcardOutlined, BookOutlined, HomeOutlined
} from "@ant-design/icons";
import { Scanner } from '@yudiel/react-qr-scanner';
import { supabaseClient } from "../../utility/supabaseClient";

const { Title, Text } = Typography;

export const ScanQR = () => {
    const { token } = theme.useToken();
    
    // States
    const [mode, setMode] = useState<'info' | 'spp'>('info');
    const [scanning, setScanning] = useState(true);
    const [loadingData, setLoadingData] = useState(false);
    const [scannedData, setScannedData] = useState<any>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Fungsi untuk mengambil data dari Supabase berdasarkan NIS
    const fetchSantriData = async (nis: string) => {
        setLoadingData(true);
        setErrorMsg(null);
        try {
            // Asumsi tabel bernama 'santri' dan QR Code berisi NIS
            const { data, error } = await supabaseClient
                .from('santri')
                .select('*')
                .eq('nis', nis)
                .single();

            if (error || !data) {
                throw new Error("Data santri tidak ditemukan untuk QR Code ini.");
            }

            setScannedData(data);
            message.success(`Berhasil memuat data: ${data.nama}`);
        } catch (err: any) {
            setErrorMsg(err.message);
            message.error(err.message);
        } finally {
            setLoadingData(false);
        }
    };

    // Handler ketika QR Code berhasil dibaca
    const handleDecode = (text: string) => {
        if (text) {
            setScanning(false); // Matikan kamera sementara
            fetchSantriData(text);
        }
    };

    // Reset Scanner
    const handleReset = () => {
        setScannedData(null);
        setErrorMsg(null);
        setScanning(true);
    };

    return (
        <div style={{ padding: '24px', minHeight: '80vh' }}>
            {/* HEADER FUTURISTIK */}
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <div className="glow-icon">
                    <ScanOutlined style={{ fontSize: '48px', color: token.colorPrimary }} />
                </div>
                <Title level={2} style={{ marginTop: '16px', letterSpacing: '1px', fontWeight: 800 }}>
                    SISTEM IDENTIFIKASI SANTRI
                </Title>
                <Text type="secondary" style={{ fontSize: '16px' }}>
                    Arahkan QR Code ke kamera untuk memindai data secara otomatis.
                </Text>
            </div>

            <Row gutter={[32, 32]} justify="center">
                {/* --- KOLOM KIRI: SCANNER --- */}
                <Col xs={24} lg={10}>
                    <Card 
                        bordered={false} 
                        className="glass-card"
                        style={{ borderRadius: '24px', overflow: 'hidden', boxShadow: token.boxShadowSecondary }}
                    >
                        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                            <Segmented
                                size="large"
                                value={mode}
                                onChange={(value) => setMode(value as 'info' | 'spp')}
                                options={[
                                    { label: 'Informasi Santri', value: 'info', icon: <UserOutlined /> },
                                    { label: 'Status Syahriah', value: 'spp', icon: <WalletOutlined /> },
                                ]}
                                style={{ padding: '4px', background: token.colorFillAlter }}
                            />
                        </div>

                        <div className="scanner-container">
                            {scanning ? (
                                <>
                                    <div className="scanner-overlay">
                                        <div className="scanner-laser"></div>
                                        <div className="corner top-left"></div>
                                        <div className="corner top-right"></div>
                                        <div className="corner bottom-left"></div>
                                        <div className="corner bottom-right"></div>
                                    </div>
                                    <Scanner
                                        onScan={(result) => result[0]?.rawValue && handleDecode(result[0].rawValue)}
                                        onError={(error: unknown) => console.log(error)}
                                        scanDelay={1000}
                                    />
                                </>
                            ) : (
                                <div className="scanner-standby">
                                    <CheckCircleOutlined style={{ fontSize: '64px', color: token.colorSuccess, marginBottom: '16px' }} />
                                    <Title level={4}>Scan Berhasil</Title>
                                    <Button type="primary" size="large" icon={<ReloadOutlined />} onClick={handleReset} style={{ borderRadius: '50px', marginTop: '16px' }}>
                                        Scan Ulang
                                    </Button>
                                </div>
                            )}
                        </div>
                    </Card>
                </Col>

                {/* --- KOLOM KANAN: HASIL SCAN --- */}
                <Col xs={24} lg={14}>
                    <Spin spinning={loadingData} tip="Mengenkripsi & Mengambil Data...">
                        {scannedData ? (
                            <Card 
                                bordered={false} 
                                className="glass-card result-card-animate"
                                style={{ borderRadius: '24px', minHeight: '100%', boxShadow: token.boxShadowSecondary }}
                            >
                                {/* KOP HASIL */}
                                <Row align="middle" gutter={24} style={{ marginBottom: '24px' }}>
                                    <Col>
                                        <Avatar 
                                            src={scannedData.foto_url} 
                                            size={100} 
                                            icon={<UserOutlined />} 
                                            style={{ border: `4px solid ${token.colorPrimary}`, boxShadow: `0 0 20px ${token.colorPrimary}40` }}
                                        />
                                    </Col>
                                    <Col flex="auto">
                                        <Title level={3} style={{ margin: 0 }}>{scannedData.nama}</Title>
                                        <Space size={[0, 8]} wrap style={{ marginTop: '8px' }}>
                                            <Tag color="blue" icon={<IdcardOutlined />}>NIS: {scannedData.nis}</Tag>
                                            <Tag color="cyan" icon={<BookOutlined />}>{scannedData.kelas} - {scannedData.jurusan}</Tag>
                                            <Tag color={scannedData.status_santri === 'AKTIF' ? 'success' : 'error'}>
                                                STATUS: {scannedData.status_santri}
                                            </Tag>
                                        </Space>
                                    </Col>
                                </Row>

                                <Divider style={{ borderColor: token.colorBorderSecondary }} />

                                {/* KONTEN BERDASARKAN MODE */}
                                {mode === 'info' ? (
                                    <Descriptions 
                                        title={<span style={{ color: token.colorPrimary }}><UserOutlined /> Profil Takhasus & Pribadi</span>} 
                                        column={{ xs: 1, sm: 2 }} 
                                        layout="vertical"
                                        bordered
                                        size="middle"
                                        labelStyle={{ fontWeight: 600, color: token.colorTextSecondary }}
                                    >
                                        <Descriptions.Item label="NIK">{scannedData.nik || '-'}</Descriptions.Item>
                                        <Descriptions.Item label="Tempat, Tgl Lahir">{scannedData.tempat_lahir}, {scannedData.tanggal_lahir}</Descriptions.Item>
                                        <Descriptions.Item label="Pembimbing / Musyrif">{scannedData.pembimbing || '-'}</Descriptions.Item>
                                        <Descriptions.Item label="Total Hafalan">{scannedData.total_hafalan ? `${scannedData.total_hafalan} Juz` : '-'}</Descriptions.Item>
                                        <Descriptions.Item label="Nama Wali (Ayah/Ibu)">{scannedData.ayah} / {scannedData.ibu}</Descriptions.Item>
                                        <Descriptions.Item label="Kontak Wali">{scannedData.no_kontak_wali}</Descriptions.Item>
                                        <Descriptions.Item label="Alamat Lengkap" span={2}><HomeOutlined /> {scannedData.alamat_lengkap}</Descriptions.Item>
                                    </Descriptions>
                                ) : (
                                    <div className="spp-container">
                                        <Title level={4} style={{ color: token.colorPrimary, marginBottom: '24px' }}>
                                            <WalletOutlined /> Status Pembayaran Syahriah
                                        </Title>
                                        
                                        {/* LOGIKA CONTOH SPP - Sesuaikan dengan database Anda */}
                                        <Card type="inner" style={{ background: scannedData.status_spp_lunas ? '#f6ffed' : '#fff2f0', borderColor: scannedData.status_spp_lunas ? '#b7eb8f' : '#ffccc7' }}>
                                            <Row justify="space-between" align="middle">
                                                <Col>
                                                    <Text strong style={{ fontSize: '18px' }}>Bulan Berjalan (Contoh)</Text>
                                                    <br/>
                                                    <Text type="secondary">Tipe: {scannedData.status_spp || 'Reguler'}</Text>
                                                </Col>
                                                <Col>
                                                    {scannedData.status_spp === 'BEASISWA' ? (
                                                        <Tag color="gold" style={{ padding: '8px 16px', fontSize: '16px' }}>BEASISWA LUNAS</Tag>
                                                    ) : (
                                                        <Tag color="error" icon={<CloseCircleOutlined />} style={{ padding: '8px 16px', fontSize: '16px' }}>
                                                            BELUM LUNAS
                                                        </Tag>
                                                    )}
                                                </Col>
                                            </Row>
                                        </Card>
                                        <div style={{ marginTop: '24px', textAlign: 'center' }}>
                                            <Button type="primary" ghost size="large" style={{ borderRadius: '8px' }}>Lihat Riwayat Lengkap Pembayaran</Button>
                                        </div>
                                    </div>
                                )}
                            </Card>
                        ) : (
                            <Card 
                                bordered={false} 
                                className="glass-card"
                                style={{ 
                                    borderRadius: '24px', minHeight: '400px', 
                                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                                    border: `1px dashed ${token.colorBorder}`
                                }}
                            >
                                <div style={{ textAlign: 'center', color: token.colorTextTertiary }}>
                                    {errorMsg ? (
                                        <>
                                            <CloseCircleOutlined style={{ fontSize: '48px', color: token.colorError, marginBottom: '16px' }} />
                                            <Title level={4} type="danger">{errorMsg}</Title>
                                            <Button onClick={handleReset} style={{ marginTop: '16px' }}>Coba Lagi</Button>
                                        </>
                                    ) : (
                                        <>
                                            <ScanOutlined style={{ fontSize: '64px', opacity: 0.2, marginBottom: '16px' }} />
                                            <Title level={4} style={{ color: token.colorTextTertiary }}>Menunggu Hasil Scan...</Title>
                                        </>
                                    )}
                                </div>
                            </Card>
                        )}
                    </Spin>
                </Col>
            </Row>

            {/* --- CSS UNTUK ANIMASI FUTURISTIK & GLASSMORPHISM --- */}
            <style>{`
                /* Glassmorphism Cards */
                .glass-card {
                    background: rgba(255, 255, 255, 0.6) !important;
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.4);
                }

                /* Glowing Icon di Header */
                .glow-icon {
                    display: inline-block;
                    padding: 24px;
                    border-radius: 50%;
                    background: rgba(22, 119, 255, 0.1);
                    box-shadow: 0 0 30px rgba(22, 119, 255, 0.3);
                    animation: pulse 2s infinite;
                }

                @keyframes pulse {
                    0% { box-shadow: 0 0 20px rgba(22, 119, 255, 0.2); }
                    50% { box-shadow: 0 0 40px rgba(22, 119, 255, 0.5); }
                    100% { box-shadow: 0 0 20px rgba(22, 119, 255, 0.2); }
                }

                /* Container Scanner */
                .scanner-container {
                    position: relative;
                    border-radius: 16px;
                    overflow: hidden;
                    background: #000;
                    aspect-ratio: 1; /* Memastikan bentuk kotak */
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    box-shadow: inset 0 0 50px rgba(0,0,0,0.8);
                }

                /* Overlay UI Futuristik di atas Kamera */
                .scanner-overlay {
                    position: absolute;
                    top: 10%; left: 10%; right: 10%; bottom: 10%;
                    z-index: 10;
                    pointer-events: none;
                }

                /* Garis Laser Scanning */
                .scanner-laser {
                    width: 100%;
                    height: 3px;
                    background: #00ffcc;
                    box-shadow: 0 0 15px #00ffcc, 0 0 30px #00ffcc;
                    position: absolute;
                    top: 0;
                    animation: scan-laser 2.5s infinite linear;
                }

                @keyframes scan-laser {
                    0% { top: 0; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 100%; opacity: 0; }
                }

                /* Sudut-sudut bidikan (Targeting Brackets) */
                .corner {
                    position: absolute;
                    width: 40px;
                    height: 40px;
                    border-color: #1677ff;
                    border-style: solid;
                    transition: all 0.3s ease;
                }
                .top-left { top: 0; left: 0; border-width: 4px 0 0 4px; border-top-left-radius: 8px; }
                .top-right { top: 0; right: 0; border-width: 4px 4px 0 0; border-top-right-radius: 8px; }
                .bottom-left { bottom: 0; left: 0; border-width: 0 0 4px 4px; border-bottom-left-radius: 8px; }
                .bottom-right { bottom: 0; right: 0; border-width: 0 4px 4px 0; border-bottom-right-radius: 8px; }

                /* Efek standby saat scan selesai */
                .scanner-standby {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.8);
                    z-index: 20;
                }

                /* Animasi munculnya kartu hasil */
                .result-card-animate {
                    animation: slideUp 0.5s ease-out forwards;
                }

                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};