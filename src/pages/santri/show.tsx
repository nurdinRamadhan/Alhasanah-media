import React from "react";
import { useShow } from "@refinedev/core";
import { 
    Typography, 
    Card, 
    Row, 
    Col, 
    Avatar, 
    Tag, 
    Descriptions, 
    Button, 
    Divider, 
    Skeleton, 
    theme,
    Badge,
    Space,
    Watermark
} from "antd";
import { 
    UserOutlined, 
    PrinterOutlined, 
    ArrowLeftOutlined,
    HomeOutlined,
    ReadOutlined,
    PhoneOutlined,
    EnvironmentOutlined,
    QrcodeOutlined,
    IdcardOutlined
} from "@ant-design/icons";
import { QRCodeCanvas } from "qrcode.react";
import dayjs from "dayjs";
import "dayjs/locale/id"; 
import { ISantri } from "../../types";
import { useNavigate } from "react-router-dom";

const { Title, Text } = Typography;
const { useToken } = theme;

dayjs.locale('id');

export const SantriShow = () => {
    const { queryResult } = useShow<ISantri>();
    const { data, isLoading } = queryResult;
    const record = data?.data;
    const { token } = useToken();
    const navigate = useNavigate();

    if (isLoading || !record) {
        return <div className="p-6"><Skeleton active avatar paragraph={{ rows: 6 }} /></div>;
    }

    // Data QR Code (Lebih Ringkas agar QR tidak terlalu padat)
    const qrData = JSON.stringify({
        nis: record.nis,
        nama: record.nama,
        url: `https://app.pesantren.com/verify/${record.nis}` // Contoh URL verifikasi
    });

    return (
        <div className="santri-detail-container pb-10">
            
            {/* =========================================================
                TAMPILAN MONITOR / LAYAR (Modern Card UI)
               ========================================================= */}
            <div className="screen-view no-print">
                {/* Header Navigasi */}
                <div className="flex items-center justify-between mb-6">
                    <Button 
                        icon={<ArrowLeftOutlined />} 
                        onClick={() => navigate('/santri')}
                        type="text"
                    >
                        Kembali
                    </Button>
                    <Button 
                        type="primary"
                        icon={<PrinterOutlined />} 
                        onClick={() => window.print()}
                        style={{ backgroundColor: token.colorPrimary }}
                    >
                        Cetak Biodata
                    </Button>
                </div>

                <Row gutter={[24, 24]}>
                    {/* KOLOM KIRI: Foto & Status */}
                    <Col xs={24} md={8} lg={6}>
                        <Card 
                            hoverable
                            style={{ 
                                borderRadius: 12, 
                                overflow: 'hidden',
                                border: `1px solid ${token.colorBorderSecondary}`,
                            }}
                            bodyStyle={{ padding: 0 }}
                        >
                            <div style={{ 
                                height: 140, 
                                background: `linear-gradient(135deg, ${token.colorPrimary} 0%, #047857 100%)`,
                                position: 'relative'
                            }}>
                                <div className="absolute -bottom-12 left-0 right-0 flex justify-center">
                                    <Avatar 
                                        size={120} 
                                        icon={<UserOutlined />}
                                        src={record.foto_url}
                                        style={{ 
                                            backgroundColor: token.colorBgContainer,
                                            color: token.colorPrimary,
                                            border: `5px solid ${token.colorBgContainer}`
                                        }}
                                    />
                                </div>
                            </div>
                            
                            <div className="mt-14 px-6 pb-6 text-center">
                                <Title level={4} style={{ marginBottom: 4 }}>{record.nama}</Title>
                                <Tag color="gold" style={{ fontSize: 14, padding: '4px 10px' }}>NIS: {record.nis}</Tag>
                                
                                <Divider style={{ margin: '16px 0' }} />
                                
                                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg">
                                    <div className="flex justify-between items-center mb-2">
                                        <Text type="secondary">Status</Text>
                                        <Badge status={record.status_santri === 'AKTIF' ? 'success' : 'default'} text={record.status_santri} />
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <Text type="secondary">Kelas</Text>
                                        <Text strong>{record.kelas} ({record.jurusan})</Text>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </Col>

                    {/* KOLOM KANAN: Detail Data */}
                    <Col xs={24} md={16} lg={18}>
                        <Card 
                            title={<Space><ReadOutlined style={{ color: token.colorPrimary }} /> Data Lengkap Santri</Space>}
                            bordered={false}
                            style={{ borderRadius: 12 }}
                        >
                            <Descriptions bordered column={{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}>
                                <Descriptions.Item label="NIS">{record.nis}</Descriptions.Item>
                                <Descriptions.Item label="NIK">{record.nik || '-'}</Descriptions.Item>
                                <Descriptions.Item label="Tempat Lahir">{record.tempat_lahir || '-'}</Descriptions.Item>
                                <Descriptions.Item label="Tanggal Lahir">
                                    {record.tanggal_lahir ? dayjs(record.tanggal_lahir).format('DD MMMM YYYY') : '-'}
                                </Descriptions.Item>
                                <Descriptions.Item label="Jenis Kelamin">
                                    {record.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                                </Descriptions.Item>
                                <Descriptions.Item label="Anak Ke">{record.anak_ke || '-'}</Descriptions.Item>
                                <Descriptions.Item label="Pembimbing">{record.pembimbing || '-'}</Descriptions.Item>
                                <Descriptions.Item label="Hafalan">{record.hafalan_kitab || '-'}</Descriptions.Item>
                            </Descriptions>

                            <Divider orientation="left" style={{ marginTop: 32 }}>
                                <Space><HomeOutlined /> Keluarga & Wali</Space>
                            </Divider>

                            <Descriptions bordered column={1}>
                                <Descriptions.Item label="Nama Ayah">{record.ayah || '-'}</Descriptions.Item>
                                <Descriptions.Item label="Nama Ibu">{record.ibu || '-'}</Descriptions.Item>
                                <Descriptions.Item label="Kontak Wali">{record.no_kontak_wali || '-'}</Descriptions.Item>
                                <Descriptions.Item label="Alamat">{record.alamat_lengkap || '-'}</Descriptions.Item>
                            </Descriptions>
                        </Card>
                    </Col>
                </Row>
            </div>


            {/* =========================================================
                TAMPILAN CETAK / PRINT (Layout Biodata A4 Resmi)
               ========================================================= */}
            <div className="print-view">
                <Watermark content="AL-HASANAH" font={{ color: 'rgba(0,0,0,0.03)', fontSize: 60 }} gap={[100, 100]}>
                    <div className="a4-container">
                        
                        {/* 1. KOP SURAT */}
                        <div className="kop-surat">
                            <div className="logo-area">
                                {/* Placeholder Logo */}
                                <div className="logo-circle">AH</div>
                            </div>
                            <div className="kop-text">
                                <h1>PONDOK PESANTREN AL-HASANAH</h1>
                                <p className="alamat">Jl. Raya Cibeuti No.13, Cibeuti, Kec. Kawalu, Kab. Tasikmalaya, Jawa Barat 46182, Indonesia</p>
                                <p className="kontak">Telp: (022) 1234567 | Email: admin@alhasanah.com | Web: alhasanah.com</p>
                            </div>
                        </div>
                        <div className="garis-kop"></div>

                        {/* 2. JUDUL DOKUMEN */}
                        <div className="doc-title">
                            <h2>BIODATA SANTRI</h2>
                            <p>Nomor Induk: {record.nis}</p>
                        </div>

                        {/* 3. LAYOUT UTAMA (FOTO + DATA) */}
                        <div className="main-content-grid">
                            
                            {/* KANAN: Area Foto & QR (Dipindah ke Kanan agar tidak terpotong margin kiri) */}
                            <div className="media-section">
                                <div className="photo-frame">
                                    {record.foto_url ? (
                                        <img src={record.foto_url} alt="Foto" />
                                    ) : (
                                        <div className="no-photo">FOTO 3x4</div>
                                    )}
                                </div>
                                <div className="qr-frame">
                                    <QRCodeCanvas value={qrData} size={110} />
                                    <span>SCAN VALIDASI</span>
                                </div>
                            </div>

                            {/* KIRI: Tabel Data (Lebih Lebar) */}
                            <div className="data-section">
                                {/* A. DATA PRIBADI */}
                                <div className="section-header">A. DATA PRIBADI</div>
                                <table className="print-table">
                                    <tbody>
                                        <tr>
                                            <td width="140">Nama Lengkap</td>
                                            <td width="10">:</td>
                                            <td><strong>{record.nama}</strong></td>
                                        </tr>
                                        <tr>
                                            <td>NIS / NIK</td>
                                            <td>:</td>
                                            <td>{record.nis} / {record.nik || '-'}</td>
                                        </tr>
                                        <tr>
                                            <td>Tempat, Tgl Lahir</td>
                                            <td>:</td>
                                            <td>{record.tempat_lahir}, {record.tanggal_lahir ? dayjs(record.tanggal_lahir).format('DD MMMM YYYY') : '-'}</td>
                                        </tr>
                                        <tr>
                                            <td>Jenis Kelamin</td>
                                            <td>:</td>
                                            <td>{record.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</td>
                                        </tr>
                                        <tr>
                                            <td>Anak Ke-</td>
                                            <td>:</td>
                                            <td>{record.anak_ke || '-'}</td>
                                        </tr>
                                    </tbody>
                                </table>

                                {/* B. DATA AKADEMIK */}
                                <div className="section-header">B. DATA TAKHASUS</div>
                                <table className="print-table">
                                    <tbody>
                                        <tr>
                                            <td width="140">Takhasus</td>
                                            <td width="10">:</td>
                                            <td>{record.jurusan}</td>
                                        </tr>
                                        <tr>
                                            <td>Kelas Saat Ini</td>
                                            <td>:</td>
                                            <td>Kelas {record.kelas} ({record.status_santri})</td>
                                        </tr>
                                        <tr>
                                            <td>Pembimbing</td>
                                            <td>:</td>
                                            <td>{record.pembimbing || '-'}</td>
                                        </tr>
                                        <tr>
                                            <td>Capaian Hafalan</td>
                                            <td>:</td>
                                            <td>{record.hafalan_kitab || '-'}</td>
                                        </tr>
                                    </tbody>
                                </table>

                                {/* C. DATA WALI */}
                                <div className="section-header">C. DATA KELUARGA</div>
                                <table className="print-table">
                                    <tbody>
                                        <tr>
                                            <td width="140">Nama Ayah</td>
                                            <td width="10">:</td>
                                            <td>{record.ayah || '-'}</td>
                                        </tr>
                                        <tr>
                                            <td>Nama Ibu</td>
                                            <td>:</td>
                                            <td>{record.ibu || '-'}</td>
                                        </tr>
                                        <tr>
                                            <td>No. Kontak Wali</td>
                                            <td>:</td>
                                            <td>{record.no_kontak_wali || '-'}</td>
                                        </tr>
                                        <tr>
                                            <td>Alamat Rumah</td>
                                            <td>:</td>
                                            <td>{record.alamat_lengkap || '-'}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* 4. TANDA TANGAN */}
                        <div className="signature-area">
                            <div className="ttd-box right">
                                <p>Bandung, {dayjs().format('DD MMMM YYYY')}</p>
                                <p>Kepala Pesantren,</p>
                                <div className="sign-space"></div>
                                <p className="name">KH. Anton Tontowi</p>
                                <p className="nip">NIP. 19800101 202301 1 001</p>
                            </div>
                        </div>

                        {/* Footer Halus */}
                        <div className="print-footer-note">
                            Dicetak melalui Sistem Informasi Manajemen Pesantren Al-Hasanah pada {dayjs().format('DD/MM/YYYY HH:mm')}
                        </div>
                    </div>
                </Watermark>
            </div>

            {/* --- CSS KHUSUS CETAK (A4 PRECISE) --- */}
            <style>{`
                /* Sembunyikan Print View di Layar */
                .print-view { display: none; }

                @media print {
                    @page { 
                        size: A4 portrait; 
                        margin: 1.5cm; /* Margin aman agar tidak terpotong printer */
                    }
                    
                    /* Reset UI Browser */
                    body { 
                        background: white !important; 
                        margin: 0 !important; 
                        padding: 0 !important;
                        -webkit-print-color-adjust: exact; /* Paksa cetak warna background */
                    }

                    /* Sembunyikan Elemen UI */
                    .no-print, 
                    .ant-layout-sider, 
                    .ant-layout-header,
                    .ant-drawer,
                    header, aside, nav { 
                        display: none !important; 
                    }

                    /* Tampilkan Area Cetak */
                    .print-view { 
                        display: block !important; 
                        font-family: 'Times New Roman', Times, serif;
                        color: #000;
                        width: 100%;
                    }

                    /* --- STYLING KOP SURAT --- */
                    .header-kop { display: flex; align-items: center; border-bottom: 3px double #000; padding-bottom: 10px; margin-bottom: 20px; }
                    .logo-area { width: 80px; text-align: center; }
                    .logo-circle { 
                        width: 60px; height: 60px; background: #059669; color: white; 
                        border-radius: 50%; display: flex; align-items: center; 
                        justify-content: center; font-weight: bold; font-size: 20px;
                        print-color-adjust: exact; 
                    }
                    .kop-text { flex: 1; text-align: center; }
                    .kop-text h1 { margin: 0; font-size: 18px; font-weight: bold; text-transform: uppercase; }
                    .kop-text .alamat { margin: 2px 0; font-size: 11px; }
                    .kop-text .kontak { margin: 0; font-size: 11px; font-style: italic; }

                    /* --- STYLING JUDUL --- */
                    .doc-title { text-align: center; margin-bottom: 25px; }
                    .doc-title h2 { margin: 0; font-size: 16px; text-decoration: underline; text-transform: uppercase; }
                    .doc-title p { margin: 2px 0; font-size: 12px; }

                    /* --- GRID CONTENT (FOTO + DATA) --- */
                    .main-content-grid { 
                        display: flex; 
                        gap: 20px; 
                        align-items: flex-start; 
                    }
                    
                    /* Kanan: Media (Foto/QR) - Ukuran Fixed */
                    .media-section { 
                        width: 120px; /* Lebar pas untuk foto 3x4 + margin */
                        flex-shrink: 0; 
                        order: 2; /* Taruh di kanan */
                        text-align: center;
                    }
                    .photo-frame { 
                        width: 3cm; 
                        height: 4cm; 
                        border: 1px solid #000; 
                        margin-bottom: 15px; 
                        display: flex; 
                        align-items: center; 
                        justify-content: center;
                        overflow: hidden;
                    }
                    .photo-frame img { width: 100%; height: 100%; object-fit: cover; }
                    .no-photo { font-size: 10px; color: #666; }
                    
                    .qr-frame { border: 1px dashed #666; padding: 5px; }
                    .qr-frame span { font-size: 9px; display: block; margin-top: 2px; }

                    /* Kiri: Data Table - Flex Grow */
                    .data-section { 
                        flex: 1; 
                        order: 1; /* Taruh di kiri */
                    }
                    .section-header { 
                        font-weight: bold; 
                        font-size: 12px; 
                        background-color: #eee; 
                        padding: 3px 5px; 
                        margin-top: 10px; 
                        border-bottom: 1px solid #999;
                        print-color-adjust: exact;
                    }
                    .section-header:first-child { margin-top: 0; }
                    
                    .print-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 10px; }
                    .print-table td { padding: 4px 2px; vertical-align: top; }
                    
                    /* --- TANDA TANGAN --- */
                    .signature-area { margin-top: 40px; display: flex; justify-content: flex-end; }
                    .ttd-box { width: 220px; text-align: center; font-size: 12px; }
                    .sign-space { height: 70px; }
                    .ttd-box .name { font-weight: bold; text-decoration: underline; margin: 0; }
                    .ttd-box .nip { margin: 0; }

                    /* --- FOOTER --- */
                    .print-footer-note { 
                        position: fixed; 
                        bottom: 0; left: 0; 
                        font-size: 9px; 
                        color: #666; 
                        border-top: 1px solid #ccc; 
                        width: 100%; 
                        padding-top: 5px; 
                    }
                }
            `}</style>
        </div>
    );
};