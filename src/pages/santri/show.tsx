import React, { useRef } from "react";
import { useShow, useNavigation } from "@refinedev/core";
import { 
    Typography, Card, Row, Col, Avatar, Tag, Descriptions, 
    Button, Divider, Skeleton, theme, Tabs, Space, Badge, Tooltip
} from "antd";
import { 
    PrinterOutlined, ArrowLeftOutlined, UserOutlined, 
    WhatsAppOutlined, HomeOutlined, BookOutlined, 
    QrcodeOutlined, EnvironmentOutlined, SafetyCertificateOutlined,
    TeamOutlined, MailOutlined, StarFilled, TrophyOutlined
} from "@ant-design/icons";
import { QRCodeCanvas } from "qrcode.react";
import dayjs from "dayjs";
import "dayjs/locale/id"; 
import { useReactToPrint } from "react-to-print";

const { Title, Text } = Typography;
const { useToken } = theme;

dayjs.locale('id');

export const SantriShow = () => {
    const { token } = useToken();
    const { list } = useNavigation();

    // 1. FETCH DATA DENGAN JOIN (Relasi ke Profiles)
    const { queryResult } = useShow({
        meta: {
            // Syntax Supabase untuk Join: ambil semua kolom santri, 
            // dan ambil data profiles berdasarkan foreign key wali_id
            select: "*, profiles:wali_id(*)" 
        }
    });
    
    const { data, isLoading } = queryResult;
    const record = data?.data;

    // Ref untuk area cetak kartu
    const componentRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: `Kartu_Santri_${record?.nama || 'Print'}`,
    });

    if (isLoading || !record) {
        return <Card><Skeleton active paragraph={{ rows: 10 }} /></Card>;
    }

    // Data Wali diambil dari relasi profiles (jika ada)
    const waliData = record.profiles || {};

    // --- TAB ITEMS (Updated sesuai Types.tsx) ---
    const items = [
        {
            key: '1',
            label: <span><UserOutlined /> Data Diri</span>,
            children: (
                <Descriptions column={{ xs: 1, sm: 2 }} layout="vertical" bordered size="small">
                    <Descriptions.Item label="Nama Lengkap"><b>{record.nama}</b></Descriptions.Item>
                    <Descriptions.Item label="NIS / NIK">
                        <div>{record.nis}</div>
                        <Text type="secondary" style={{ fontSize: 11 }}>NIK: {record.nik || '-'}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Tempat, Tanggal Lahir">
                        {record.tempat_lahir}, {dayjs(record.tanggal_lahir).format("DD MMMM YYYY")}
                    </Descriptions.Item>
                    <Descriptions.Item label="Jenis Kelamin">
                        {record.jenis_kelamin === 'L' ? <Tag color="blue">Laki-laki</Tag> : <Tag color="magenta">Perempuan</Tag>}
                    </Descriptions.Item>
                    <Descriptions.Item label="Anak Ke-">{record.anak_ke || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Alamat Lengkap" span={2}>
                        <Space align="start">
                            <EnvironmentOutlined style={{ color: token.colorError }} /> 
                            {record.alamat_lengkap || "-"}
                        </Space>
                    </Descriptions.Item>
                </Descriptions>
            ),
        },
        {
            key: '2',
            label: <span><BookOutlined /> Takhasus</span>,
            children: (
                <Descriptions column={{ xs: 1, sm: 2 }} layout="vertical" bordered size="small">
                    <Descriptions.Item label="Kelas & Jurusan">
                        <Space>
                            <Tag color="geekblue">{record.kelas}</Tag>
                            <Tag color="purple">{record.jurusan}</Tag>
                        </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="Status Santri">
                        <Badge status={record.status_santri === 'AKTIF' ? 'success' : 'error'} text={record.status_santri} />
                    </Descriptions.Item>
                    <Descriptions.Item label="Ustadz Pembimbing">
                        <UserOutlined /> {record.pembimbing || "Belum ditentukan"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Tanggal Masuk">
                        {dayjs(record.created_at).format("DD MMMM YYYY")}
                    </Descriptions.Item>
                    
                    {/* BAGIAN TAHFIDZ & KITAB */}
                    <Descriptions.Item label="Capaian Hafalan (Juz)" span={2}>
                        <Card size="small" style={{ background: token.colorBgLayout, borderColor: token.colorBorderSecondary }}>
                            <Row gutter={16} align="middle">
                                <Col span={12} style={{ textAlign: 'center', borderRight: `1px solid ${token.colorBorderSecondary}` }}>
                                    <StatisticItem 
                                        icon={<TrophyOutlined style={{ color: '#faad14' }} />} 
                                        label="Total Hafalan" 
                                        value={`${record.total_hafalan || 0} Juz`} 
                                    />
                                </Col>
                                <Col span={12} style={{ textAlign: 'center' }}>
                                    <StatisticItem 
                                        icon={<BookOutlined style={{ color: token.colorPrimary }} />} 
                                        label="Kitab Selesai" 
                                        value={record.hafalan_kitab || "-"} 
                                    />
                                </Col>
                            </Row>
                        </Card>
                    </Descriptions.Item>
                </Descriptions>
            ),
        },
        {
            key: '3',
            label: <span><TeamOutlined /> Wali santri</span>,
            children: (
                <Descriptions column={1} layout="horizontal" bordered size="small">
                    <Descriptions.Item label="Nama Ayah Kandung">{record.ayah || "-"}</Descriptions.Item>
                    <Descriptions.Item label="Nama Ibu Kandung">{record.ibu || "-"}</Descriptions.Item>
                    
                    {/* DATA WALI DARI TABEL PROFILES */}
                    <Descriptions.Item label="Wali Santri (Akun)">
                        <Space direction="vertical" size={0}>
                            <Text strong>{waliData.full_name || "-"}</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                <MailOutlined /> {waliData.email}
                            </Text>
                        </Space>
                    </Descriptions.Item>
                    
                    <Descriptions.Item label="Kontak Wali">
                        <Space split={<Divider type="vertical" />}>
                            {/* Prioritas ambil dari Profile, kalau kosong ambil dari tabel Santri */}
                            {(waliData.no_hp || record.no_kontak_wali) ? (
                                <Button 
                                    type="link" 
                                    icon={<WhatsAppOutlined />} 
                                    href={`https://wa.me/${(waliData.no_hp || record.no_kontak_wali)?.replace(/^0/, '62')}`}
                                    target="_blank"
                                    style={{ padding: 0, height: 'auto' }}
                                >
                                    Chat WhatsApp
                                </Button>
                            ) : "-"}
                            <Text>{waliData.no_hp || record.no_kontak_wali || "-"}</Text>
                        </Space>
                    </Descriptions.Item>
                </Descriptions>
            ),
        },
    ];

    return (
        <div style={{ paddingBottom: 50 }}>
            {/* --- HEADER ACTIONS --- */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Button icon={<ArrowLeftOutlined />} onClick={() => list("santri")}>
                    Kembali
                </Button>
                <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>
                    Cetak Kartu ID
                </Button>
            </div>

            {/* --- LAYOUT UTAMA --- */}
            <Row gutter={[24, 24]}>
                
                {/* KOLOM KIRI: PROFILE CARD */}
                <Col xs={24} md={8} lg={7}>
                    <Card 
                        hoverable
                        style={{ textAlign: 'center', overflow: 'hidden', borderRadius: 12 }}
                        bodyStyle={{ padding: 0 }}
                    >
                        {/* Gradient Cover */}
                        <div style={{ 
                            height: 130, 
                            background: `linear-gradient(135deg, ${token.colorPrimary}, #3b82f6)`,
                            position: 'relative'
                        }}>
                            <div style={{ 
                                position: 'absolute', bottom: -55, left: '50%', 
                                transform: 'translateX(-50%)', 
                                padding: 4, background: token.colorBgContainer, borderRadius: '50%' 
                            }}>
                                <Avatar 
                                    size={110} 
                                    src={record.foto_url} 
                                    icon={<UserOutlined />}
                                    style={{ border: `2px solid ${token.colorBgContainer}` }}
                                />
                            </div>
                        </div>

                        <div style={{ marginTop: 60, padding: '0 24px 24px 24px' }}>
                            <Title level={4} style={{ margin: 0 }}>{record.nama}</Title>
                            <Text type="secondary">{record.nis}</Text>
                            
                            <div style={{ margin: '16px 0' }}>
                                <Tag color={record.status_santri === 'AKTIF' ? 'green' : 'red'} style={{ padding: '4px 12px', fontSize: 12 }}>
                                    {record.status_santri}
                                </Tag>
                            </div>

                            <Card type="inner" size="small" style={{ background: token.colorBgLayout, borderRadius: 8 }}>
                                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                                    <Text type="secondary" style={{ fontSize: 10, letterSpacing: 1 }}>DIGITAL ID</Text>
                                    <div style={{ background: '#fff', padding: 10, borderRadius: 8, display: 'inline-block' }}>
                                        <QRCodeCanvas value={`SANTRI:${record.nis}`} size={130} />
                                    </div>
                                    <Text style={{ fontSize: 12, fontWeight: 'bold', fontFamily: 'monospace' }}>{record.nis}</Text>
                                </Space>
                            </Card>
                        </div>
                    </Card>
                </Col>

                {/* KOLOM KANAN: DETAIL TABS */}
                <Col xs={24} md={16} lg={17}>
                    <Card style={{ borderRadius: 12 }}>
                        <Tabs defaultActiveKey="1" items={items} type="card" />
                    </Card>
                </Col>
            </Row>

            {/* --- AREA KHUSUS CETAK (ID CARD) --- */}
            <div style={{ display: 'none' }}>
                <div ref={componentRef} style={{ padding: '0 10mm', fontFamily: 'Times New Roman, serif', color: '#000' }}>
                    
                    {/* 1. KOP SURAT */}
                    <div style={{ textAlign: 'center', borderBottom: '3px double #000', paddingBottom: '10px', marginBottom: '20px' }}>
                        <h2 style={{ margin: 0, fontSize: '18pt', fontWeight: 'bold', textTransform: 'uppercase' }}>PONDOK PESANTREN AL-HASANAH</h2>
                        <div style={{ fontSize: '11pt', fontStyle: 'italic' }}>
                            Jalan Raya Cibeuti, Km. 3 Rt. 01, Rw. 01, Kel. Cibeuti, Kec. Kawalu Tasikmalaya - Jawa Barat
                        </div>
                        <div style={{ fontSize: '10pt' }}>Telp: (021) 1234567 | Email: admin@alhasanah.id | Instagram: Al-hasanah cibeuti</div>
                    </div>

                    {/* 2. JUDUL DOKUMEN */}
                    <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                        <h3 style={{ margin: 0, fontSize: '16pt', fontWeight: 'bold', textDecoration: 'underline' }}>BIODATA SANTRI</h3>
                        <div style={{ fontSize: '12pt' }}>Nomor Induk Santri: {record.nis}</div>
                    </div>

                    {/* 3. FOTO & INFO UTAMA */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <div style={{ flex: 1 }}>
                            {/* Data akan diisi tabel dibawah */}
                        </div>
                        <div style={{ width: '30mm', height: '40mm', border: '1px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {record.foto_url ? 
                                <img src={record.foto_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : 
                                <span style={{ fontSize: '9pt', color: '#666' }}>3x4</span>
                            }
                        </div>
                    </div>

                    {/* 4. TABEL DATA */}
                    <div style={{ fontSize: '12pt', lineHeight: '1.6' }}>
                        {/* A. DATA PRIBADI */}
                        <div style={{ fontWeight: 'bold', marginBottom: '5px', backgroundColor: '#eee', padding: '2px 5px', borderBottom: '1px solid #999' }}>A. DATA PRIBADI</div>
                        <table style={{ width: '100%', marginBottom: '15px' }}>
                            <tbody>
                                <tr><td width="35%">Nama Lengkap</td><td width="2%">:</td><td><b>{record.nama}</b></td></tr>
                                <tr><td>NIK</td><td>:</td><td>{record.nik || '-'}</td></tr>
                                <tr><td>Tempat, Tanggal Lahir</td><td>:</td><td>{record.tempat_lahir ? `${record.tempat_lahir}, ` : ''} {dayjs(record.tanggal_lahir).format('DD MMMM YYYY')}</td></tr>
                                <tr><td>Jenis Kelamin</td><td>:</td><td>{record.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</td></tr>
                                <tr><td>Anak Ke-</td><td>:</td><td>{record.anak_ke || '-'}</td></tr>
                                <tr><td>Alamat Lengkap</td><td>:</td><td>{record.alamat_lengkap || '-'}</td></tr>
                            </tbody>
                        </table>

                        {/* B. DATA AKADEMIK */}
                        <div style={{ fontWeight: 'bold', marginBottom: '5px', backgroundColor: '#eee', padding: '2px 5px', borderBottom: '1px solid #999' }}>B. DATA AKADEMIK & PESANTREN</div>
                        <table style={{ width: '100%', marginBottom: '15px' }}>
                            <tbody>
                                <tr><td width="35%">Tingkat / Kelas</td><td width="2%">:</td><td>{record.kelas}</td></tr>
                                <tr><td>Takhasus</td><td>:</td><td>{record.jurusan}</td></tr>
                                <tr><td>Status Santri</td><td>:</td><td>{record.status_santri}</td></tr>
                                <tr><td>Tanggal Masuk</td><td>:</td><td>{dayjs(record.created_at).format('DD MMMM YYYY')}</td></tr>
                                <tr><td>Pembimbing</td><td>:</td><td>{record.pembimbing || '-'}</td></tr>
                                <tr><td>Capaian Hafalan</td><td>:</td><td>{record.total_hafalan || '0'} Juz</td></tr>
                                <tr><td>Kitab yang Diselesaikan</td><td>:</td><td>{record.hafalan_kitab || '-'}</td></tr>
                            </tbody>
                        </table>

                        {/* C. DATA KELUARGA */}
                        <div style={{ fontWeight: 'bold', marginBottom: '5px', backgroundColor: '#eee', padding: '2px 5px', borderBottom: '1px solid #999' }}>C. DATA KELUARGA / WALI</div>
                        <table style={{ width: '100%', marginBottom: '15px' }}>
                            <tbody>
                                <tr><td width="35%">Nama Ayah Kandung</td><td width="2%">:</td><td>{record.ayah || '-'}</td></tr>
                                <tr><td>Nama Ibu Kandung</td><td>:</td><td>{record.ibu || '-'}</td></tr>
                                <tr><td>Nama Wali (Penanggung Jawab)</td><td>:</td><td>{waliData.full_name || '-'}</td></tr>
                                <tr><td>No. Kontak Wali</td><td>:</td><td>{waliData.no_hp || record.no_kontak_wali || '-'}</td></tr>
                                <tr><td>Email Akun Wali</td><td>:</td><td>{waliData.email || '-'}</td></tr>
                            </tbody>
                        </table>
                    </div>

                    {/* 5. TANDA TANGAN & QR */}
                    <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ marginBottom: '10px' }}>
                                <QRCodeCanvas value={`VALIDASI_SANTRI:${record.nis}:${record.nama}`} size={90} />
                            </div>
                            <div style={{ fontSize: '9pt' }}>Scan untuk validasi data</div>
                        </div>

                        <div style={{ textAlign: 'center', width: '250px' }}>
                            <div style={{ marginBottom: '70px' }}>
                                Kab. Barokah, {dayjs().format('DD MMMM YYYY')} <br/>
                                Pengasuh / Kepala Bagian,
                            </div>
                            <div style={{ fontWeight: 'bold', textDecoration: 'underline' }}>KH. Anton, Lc.</div>
                            <div>NIP. 19283746 1 001</div>
                        </div>
                    </div>

                    {/* 6. FOOTER CETAK */}
                    <div style={{ position: 'fixed', bottom: 10, left: 20, right: 0, fontSize: '8pt', color: '#888', fontStyle: 'italic' }}>
                        Dicetak otomatis oleh Sistem Informasi Pesantren Al-Hasanah pada {dayjs().format('DD/MM/YYYY HH:mm')}
                    </div>

                </div>
            </div>
        </div>
    );
};

// Komponen Kecil untuk Statistik
const StatisticItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | number }) => (
    <div>
        <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
        <div style={{ fontSize: 11, color: '#888' }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 'bold' }}>{value}</div>
    </div>
);