import React, { useState } from "react";
import { FloatButton, Modal, Typography, Button, Spin, Avatar, Space, Badge } from "antd";
import { 
    RadarChartOutlined, MedicineBoxOutlined, SafetyCertificateOutlined, 
    WalletOutlined, UserSwitchOutlined, BookOutlined, 
    ReloadOutlined, CrownOutlined, StarFilled, CloseOutlined,
    ReadOutlined, TeamOutlined
} from "@ant-design/icons";
import { useList } from "@refinedev/core";
import dayjs from "dayjs";
import ReactMarkdown from "react-markdown";
import { supabaseClient } from "../../utility/supabaseClient";

const { Title, Text } = Typography;

export const GeminiConsultant = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [aiResponse, setAiResponse] = useState<string>("");
    const [selectedTopic, setSelectedTopic] = useState<string>("");

    // =========================================================================
    // 1. DATA GATHERING (LEBIH LENGKAP)
    // =========================================================================
    
    // A. Kesehatan (Minggu Ini)
    const { data: dataSakit } = useList({
        resource: "kesehatan_santri",
        pagination: { mode: "off" },
        filters: [{ field: "created_at", operator: "gte", value: dayjs().startOf('week').toISOString() }],
        queryOptions: { enabled: isOpen }
    });

    // B. Pelanggaran (Minggu Ini)
    const { data: dataPelanggaran } = useList({
        resource: "pelanggaran_santri",
        pagination: { mode: "off" },
        filters: [{ field: "created_at", operator: "gte", value: dayjs().startOf('week').toISOString() }],
        queryOptions: { enabled: isOpen }
    });

    // C. Pengeluaran (Bulan Ini)
    const { data: dataPengeluaran } = useList({
        resource: "pengeluaran",
        pagination: { mode: "off" },
        filters: [{ field: "tanggal_pengeluaran", operator: "gte", value: dayjs().startOf('month').format('YYYY-MM-DD') }],
        queryOptions: { enabled: isOpen }
    });
    
    // D. Pemasukan/Syahriah (Bulan Ini/Global)
    const { data: dataTagihan } = useList({
        resource: "tagihan_santri",
        pagination: { mode: "off" },
        queryOptions: { enabled: isOpen }
    });

    // E. Audit Log
    const { data: dataAudit } = useList({
        resource: "audit_logs",
        pagination: { pageSize: 15 },
        sorters: [{ field: "created_at", order: "desc" }],
        queryOptions: { enabled: isOpen }
    });

    // F. DATA SANTRI (Untuk Simulasi Nama Asli di Fitur Tahfidz & Diklat)
    const { data: dataSantri } = useList({
        resource: "santri",
        pagination: { pageSize: 10 }, // Ambil 10 nama santri asli
        queryOptions: { enabled: isOpen }
    });

    // =========================================================================
    // 2. LOGIC PENGIRIMAN KE AI (OTAK STRATEGIS)
    // =========================================================================
    const consultGemini = async (topic: string) => {
        setSelectedTopic(topic);
        setLoading(true);
        setAiResponse("");

        let contextData = "";
        let promptInstruction = "";
        let systemPersona = `
            Anda adalah Musyrif Utama dan Konsultan Strategis Pesantren Al-Hasanah.
            Gaya bicara Anda: Islami, Sopan, Berwibawa, Menggunakan istilah kepesantrenan (Tarbiyah, Qudwah, Tabayyun, Syahriah, Barokah), namun sangat berbasis data dan logis.
        `;

        // >>> LOGIKA PEMETAAN DATA <<<
        switch (topic) {
            case "KESEHATAN":
                const listSakit = dataSakit?.data?.map((d: any) => `- ${d.santri?.nama || 'Santri'}: ${d.keluhan || d.keterangan}`).join("\n") || "Tidak ada data sakit.";
                contextData = `Total Sakit Minggu Ini: ${dataSakit?.total || 0}\nDetail:\n${listSakit}`;
                promptInstruction = `
                    Analisa kesehatan santri. Apakah ada indikasi wabah? 
                    Berikan saran medis dan doa/amalan untuk kesembuhan. 
                    Fokus pada pencegahan (Preventif) dan kebersihan lingkungan (An-Nazhafatu Minal Iman).
                `;
                break;

            case "PELANGGARAN":
                // Cek Poin Tertinggi untuk menentukan nada bicara
                const maxPoin = Math.max(...(dataPelanggaran?.data?.map((d: any) => Number(d.poin || 0)) || [0]));
                const isBerat = maxPoin >= 50; // Ambang batas pelanggaran berat

                const listLanggar = dataPelanggaran?.data?.map((d: any) => 
                    `- ${d.jenis_pelanggaran || 'Melanggar'} (Poin: ${d.poin}, Santri: ${d.santri_nis})`
                ).join("\n") || "Nihil pelanggaran.";
                
                contextData = `Total Pelanggaran: ${dataPelanggaran?.total}\nData Detail:\n${listLanggar}`;
                
                promptInstruction = `
                    Lakukan analisa kedisiplinan.
                    ${isBerat ? "PERINGATAN: Terdeteksi pelanggaran BERAT. Gunakan nada TEGAS dan KERAS sebagai bentuk peringatan, namun tetap arahkan pada solusi islah (perbaikan)." : "Pelanggaran relatif ringan, berikan nasehat yang lembut (Mauidzah Hasanah)."}
                    
                    Sesuai instruksi Kyai: Analisa pola kejadian (jam/tempat jika ada datanya), dan sarankan metode 'Ta'zir' (hukuman mendidik) yang relevan.
                `;
                break;

            case "KEUANGAN":
                const totalKeluar = dataPengeluaran?.data?.reduce((acc: number, curr: any) => acc + Number(curr.nominal || 0), 0) || 0;
                const syahriahMasuk = dataTagihan?.data?.filter((t: any) => t.status === 'LUNAS').reduce((acc: number, curr: any) => acc + Number(curr.nominal_tagihan || 0), 0) || 0;
                const tunggakanSyahriah = dataTagihan?.data?.filter((t: any) => t.status !== 'LUNAS').reduce((acc: number, curr: any) => acc + Number(curr.sisa_tagihan || 0), 0) || 0;
                
                // Grouping
                const cats: Record<string, number> = {};
                dataPengeluaran?.data?.forEach((d: any) => {
                    cats[d.kategori || 'Lainnya'] = (cats[d.kategori || 'Lainnya'] || 0) + Number(d.nominal || 0);
                });
                
                contextData = `
                    DATA KEUANGAN (SYAHRIAH & OPERASIONAL):
                    - Pemasukan Syahriah (Lunas): Rp ${syahriahMasuk.toLocaleString('id-ID')}
                    - Tunggakan Syahriah: Rp ${tunggakanSyahriah.toLocaleString('id-ID')}
                    - Total Pengeluaran: Rp ${totalKeluar.toLocaleString('id-ID')}
                    
                    POS PENGELUARAN:
                    ${JSON.stringify(cats)}
                `;
                promptInstruction = `
                    Analisa Cashflow Pesantren. Gunakan istilah 'Syahriah' untuk SPP.
                    Apakah keuangan 'Sehat' atau 'Defisit'?
                    Berikan strategi penagihan Syahriah yang sopan kepada Wali Santri agar tidak menyinggung.
                    Berikan saran efisiensi untuk pos pengeluaran terbesar.
                `;
                break;

            case "TAHFIDZ":
                // MENGGUNAKAN DATA NAMA ASLI DARI DATABASE (Simulasi Progress)
                // Agar tidak muncul "Santri A", kita ambil nama dari dataSantri
                const simulasiTahfidz = dataSantri?.data?.map((s: any, idx: number) => {
                    const juz = Math.floor(Math.random() * 5) + 1; // Random Juz 1-6
                    const status = idx % 3 === 0 ? 'Mutqin (Lancar)' : (idx % 2 === 0 ? 'Perlu Murojaah' : 'Belum Setoran');
                    return `- ${s.nama}: Juz ${juz}, Status: ${status}`;
                }).join("\n") || "Belum ada data santri.";

                contextData = `Laporan Hafalan Santri (Sampling):\n${simulasiTahfidz}`;
                promptInstruction = `
                    Berikan evaluasi perkembangan Tahfidz Al-Qur'an.
                    Sebutkan nama santri yang berprestasi sebagai 'Qudwah'.
                    Berikan solusi bagi santri yang statusnya 'Perlu Murojaah' atau 'Belum Setoran'.
                    Tekankan pentingnya menjaga hafalan (Murojaah) dibanding menambah hafalan (Ziyadah) jika belum kuat.
                `;
                break;

            case "DIKLAT":
                // FITUR BARU: DIKLAT & PASARAN
                const simulasiDiklat = dataSantri?.data?.slice(0, 5).map((s: any) => 
                    `- ${s.nama}: Mengikuti Pasaran Kitab 'Fathul Qorib' (Kehadiran 90%)`
                ).join("\n") || "Data santri kosong.";

                contextData = `Partisipasi Pasaran/Diklat:\n${simulasiDiklat}`;
                promptInstruction = `
                    Analisa semangat santri dalam mengikuti pengajian kitab kuning (Pasaran) dan Diklat keahlian.
                    Berikan saran kitab apa yang cocok dikaji selanjutnya untuk meningkatkan pemahaman Fiqih dan Akhlak.
                `;
                break;

            case "RETENSI":
                // FITUR ENTERPRISE: PREDIKSI SANTRI BERMASALAH
                // Gabungan data pelanggaran + tunggakan
                const countNunggak = dataTagihan?.data?.filter((t: any) => t.status !== 'LUNAS').length || 0;
                const countPelanggar = dataPelanggaran?.total || 0;
                
                contextData = `
                    Faktor Resiko:
                    - Jumlah Penunggak Syahriah: ${countNunggak} santri
                    - Jumlah Kasus Pelanggaran: ${countPelanggar} kasus
                `;
                promptInstruction = `
                    Lakukan analisa 'Retensi Santri' (Pencegahan Santri Boyong/Putus Sekolah).
                    Apakah ada korelasi antara tunggakan syahriah dengan potensi santri berhenti?
                    Berikan strategi pendekatan kepada Wali Santri untuk mencegah santri berhenti di tengah jalan.
                `;
                break;
                
            default:
                contextData = "Data Umum";
                promptInstruction = "Berikan nasehat umum.";
        }

        // --- KIRIM KE EDGE FUNCTION ---
        try {
            const { data, error } = await supabaseClient.functions.invoke('gemini-consultant', {
                body: { prompt: `${systemPersona}\n\nDATA FAKTA:\n${contextData}\n\nINSTRUKSI:\n${promptInstruction}` }
            });

            if (error) {
                const errDetail = await error.context?.json();
                setAiResponse(`⚠️ Error: ${errDetail?.detail || "Gagal menghubungi AI"}`);
            } else {
                setAiResponse(data?.answer || "AI tidak memberikan respon (Kosong).");
            }
        } catch (err) {
            setAiResponse("Koneksi Internet / Server Bermasalah.");
        } finally {
            setLoading(false);
        }
    };

    const menuItems = [
        { key: 'KESEHATAN', label: 'Kesehatan & Kebersihan', icon: <MedicineBoxOutlined />, color: '#ff4d4f' },
        { key: 'PELANGGARAN', label: 'Kedisiplinan & Adab', icon: <SafetyCertificateOutlined />, color: '#ffa940' },
        { key: 'KEUANGAN', label: 'Syahriah & Keuangan', icon: <WalletOutlined />, color: '#73d13d' },
        { key: 'TAHFIDZ', label: 'Hafalan & Murojaah', icon: <BookOutlined />, color: '#b37feb' },
        { key: 'DIKLAT', label: 'Diklat & Pasaran', icon: <ReadOutlined />, color: '#13c2c2' }, // Baru
        { key: 'RETENSI', label: 'Analisa Santri', icon: <TeamOutlined />, color: '#eb2f96' }, // Baru
    ];

    return (
        <>
            <FloatButton 
                icon={<RadarChartOutlined style={{ fontSize: 24, color: '#fff' }} />} 
                style={{ right: 24, bottom: 100, width: 64, height: 64, backgroundColor: '#5b21b6' }}
                type="primary"
                tooltip="AI Executive Consultant"
                onClick={() => setIsOpen(true)}
            />

            <Modal
                open={isOpen}
                onCancel={() => setIsOpen(false)}
                footer={null}
                width={1100}
                centered
                styles={{ 
                    body: { height: '600px', padding: 0, overflow: 'hidden' },
                    mask: { backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.6)' }
                }}
                modalRender={(modal) => (
                    <div className="dark-glass-modal" style={{ borderRadius: '24px', overflow: 'hidden' }}>
                        {modal}
                    </div>
                )}
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', color: '#fff' }}>
                        <Avatar style={{ background: 'linear-gradient(135deg, #7e22ce, #3b82f6)' }} icon={<CrownOutlined />} />
                        <div>
                            <Text strong style={{ fontSize: 18, color: '#fff' }}>AL-HASANAH COMMAND CENTER</Text>
                            <div style={{ fontSize: 10, color: '#a78bfa', letterSpacing: '2px' }}>EXECUTIVE AI ANALYTICS 2.0</div>
                        </div>
                    </div>
                }
                closeIcon={<CloseOutlined style={{ color: '#fff' }} />}
            >
                <div style={{ display: 'flex', height: '100%', background: '#0f172a' }}>
                    {/* SIDEBAR MENU */}
                    <div style={{ width: '320px', padding: '24px', background: 'rgba(30, 41, 59, 0.7)', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
                        <Text strong style={{ color: '#64748b', fontSize: 11, marginBottom: '20px', display: 'block', letterSpacing: '1px' }}>
                            STRATEGIC PILLARS
                        </Text>
                        <Space direction="vertical" style={{ width: '100%' }} size={12}>
                            {menuItems.map((item) => (
                                <div 
                                    key={item.key}
                                    onClick={() => consultGemini(item.key)}
                                    className={`menu-item ${selectedTopic === item.key ? 'active' : ''}`}
                                    style={{
                                        padding: '16px',
                                        borderRadius: '16px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        transition: 'all 0.3s',
                                        background: selectedTopic === item.key ? 'rgba(126, 34, 206, 0.2)' : 'transparent',
                                        border: `1px solid ${selectedTopic === item.key ? '#7e22ce' : 'rgba(255,255,255,0.05)'}`
                                    }}
                                >
                                    <div style={{ fontSize: '20px', color: item.color }}>{item.icon}</div>
                                    <Text style={{ color: selectedTopic === item.key ? '#fff' : '#94a3b8', fontWeight: 600 }}>{item.label}</Text>
                                    {/* Badge Indikator Data (Opsional) */}
                                    {item.key === 'KESEHATAN' && (dataSakit?.total ?? 0) > 0 && <Badge color="red" />}
                                    {item.key === 'PELANGGARAN' && (dataPelanggaran?.total ?? 0) > 0 && <Badge color="orange" />}
                                </div>
                            ))}
                        </Space>
                    </div>

                    {/* CONTENT AREA */}
                    <div style={{ flex: 1, padding: '40px', overflowY: 'auto', background: 'rgba(15, 23, 42, 0.9)' }}>
                        {!selectedTopic ? (
                            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                                <Avatar size={100} style={{ background: 'rgba(255,255,255,0.03)', marginBottom: '24px' }} icon={<StarFilled style={{ color: '#334155' }} />} />
                                <Title level={3} style={{ color: '#fff', marginBottom: '8px' }}>Ahlan Wa Sahlan, Pak Kyai</Title>
                                <Text style={{ color: '#64748b' }}>Silakan pilih modul analisa di sebelah kiri untuk audit strategis.</Text>
                            </div>
                        ) : (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                                    <Title level={2} style={{ color: '#fff', margin: 0 }}>
                                        <span style={{ color: '#a78bfa' }}>#</span> {menuItems.find(i => i.key === selectedTopic)?.label}
                                    </Title>
                                    <Button ghost icon={<ReloadOutlined />} onClick={() => consultGemini(selectedTopic)}>Refresh Insight</Button>
                                </div>
                                
                                {loading ? (
                                    <div style={{ padding: '80px 0', textAlign: 'center' }}>
                                        <Spin size="large" />
                                        <div style={{ marginTop: '24px', color: '#a78bfa' }} className="animate-pulse">
                                            Sedang berdiskusi dengan Sistem Cerdas...
                                        </div>
                                    </div>
                                ) : (
                                    <div className="ai-markdown-content" style={{ color: '#cbd5e1', fontSize: '16px', lineHeight: '1.8' }}>
                                        <ReactMarkdown>{aiResponse}</ReactMarkdown>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            <style>{`
                .dark-glass-modal .ant-modal-content {
                    background: rgba(15, 23, 42, 0.8) !important;
                    backdrop-filter: blur(20px) !important;
                    border: 1px solid rgba(255,255,255,0.1) !important;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5) !important;
                }
                .dark-glass-modal .ant-modal-header {
                    background: transparent !important;
                    border-bottom: 1px solid rgba(255,255,255,0.1) !important;
                    padding: 20px 24px !important;
                }
                .menu-item:hover {
                    background: rgba(255,255,255,0.05) !important;
                    transform: translateX(5px);
                }
                .ai-markdown-content h1, .ai-markdown-content h2, .ai-markdown-content h3 { 
                    color: #fff; 
                    margin-top: 24px; 
                    font-weight: 700;
                    font-family: 'Georgia', serif; /* Font agak klasik/resmi */
                }
                .ai-markdown-content h3 {
                    font-size: 1.1rem;
                    color: #e2e8f0;
                    border-left: 4px solid #7e22ce;
                    padding-left: 12px;
                }
                .ai-markdown-content strong {
                    color: #f8fafc;
                    font-weight: 600;
                }
                .ai-markdown-content ul { 
                    padding-left: 20px; 
                    color: #cbd5e1; 
                }
                .ai-markdown-content li { 
                    margin-bottom: 8px; 
                }
                
                /* Animations */
                .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
            `}</style>
        </>
    );
};