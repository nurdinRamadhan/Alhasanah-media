import React, { useState } from "react";
import { 
    FloatButton, Modal, Typography, Button, Spin, Avatar, Space, message 
} from "antd";
import { 
    RadarChartOutlined, MedicineBoxOutlined, SafetyCertificateOutlined, 
    WalletOutlined, UserSwitchOutlined, BookOutlined, 
    ReloadOutlined, CrownOutlined, StarFilled, CloseOutlined
} from "@ant-design/icons";
import { useList } from "@refinedev/core";
import dayjs from "dayjs";
import ReactMarkdown from "react-markdown";
import { supabaseClient } from "../utility/supabaseClient";

const { Title, Text } = Typography;

export const GeminiConsultant = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [aiResponse, setAiResponse] = useState<string>("");
    const [selectedTopic, setSelectedTopic] = useState<string>("");

    // =========================================================================
    // 1. DATA GATHERING (LOGIC ASLI - TETAP OPTIMAL)
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

    // C. Keuangan (Bulan Ini)
    const { data: dataPengeluaran } = useList({
        resource: "pengeluaran",
        pagination: { mode: "off" },
        filters: [{ field: "tanggal_pengeluaran", operator: "gte", value: dayjs().startOf('month').format('YYYY-MM-DD') }],
        queryOptions: { enabled: isOpen }
    });
    
    // D. Pemasukan/Tagihan
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

    // =========================================================================
    // 2. THE CONSULTANT BRAIN (LOGIC ASLI)
    // =========================================================================
    const consultGemini = async (topic: string) => {
        setSelectedTopic(topic);
        setLoading(true);
        setAiResponse("");

        // PERSIAPAN DATA BERDASARKAN TOPIK
        let contextData = "";
        let promptInstruction = "";

        switch (topic) {
            case "KESEHATAN":
                const sakitList = dataSakit?.data.map(d => `- ${d.santri?.nama}: ${d.keluhan || d.keterangan}`).join("\n") || "Nihil";
                contextData = `Total Sakit Minggu Ini: ${dataSakit?.total}\nDetail:\n${sakitList}`;
                promptInstruction = "Analisa tren penyakit santri minggu ini. Apakah ada indikasi wabah menular? Berikan saran medis preventif.";
                break;

            case "PELANGGARAN":
                const langgarList = dataPelanggaran?.data.map(d => `- ${d.jenis_pelanggaran || d.pelanggaran} (${d.poin || '-'} Poin)`).join("\n") || "Nihil";
                contextData = `Total Pelanggaran: ${dataPelanggaran?.total}\nDetail:\n${langgarList}`;
                promptInstruction = "Analisa moral dan kedisiplinan santri. Apa pelanggaran terbanyak? Berikan saran pendekatan psikologis atau religius.";
                break;

            case "KEUANGAN":
                const totalKeluar = dataPengeluaran?.data.reduce((a:any, b:any) => a + Number(b.nominal), 0) || 0;
                const totalMasuk = dataTagihan?.data.filter(t => t.status === 'LUNAS').reduce((a, b) => a + Number(b.nominal_tagihan), 0) || 0;
                // Grouping Pengeluaran
                const cats: any = {};
                dataPengeluaran?.data.forEach((d:any) => {
                    cats[d.kategori] = (cats[d.kategori] || 0) + Number(d.nominal);
                });
                contextData = `Pemasukan (Lunas): Rp ${totalMasuk}\nPengeluaran: Rp ${totalKeluar}\nRincian Pengeluaran: ${JSON.stringify(cats)}`;
                promptInstruction = "Analisa arus kas bulan ini. Apakah surplus/defisit? Kemana uang paling banyak habis? Berikan saran efisiensi.";
                break;

            case "ADMIN":
                const logs = dataAudit?.data.map(d => `- ${d.user_name} melakukan ${d.action} pada ${d.resource}`).join("\n");
                contextData = `Log Aktivitas Terakhir:\n${logs}`;
                promptInstruction = "Audit kinerja admin. Siapa yang paling aktif? Apakah ada aktivitas mencurigakan? Berikan penilaian kinerja tim.";
                break;
            
            case "TAHFIDZ":
                contextData = "Data Tahfidz Simulasi: Santri A (30 Juz), Santri B (2 Juz), Santri C (Absen 5x).";
                promptInstruction = "Analisa progres hafalan. Siapa top performa? Siapa yang sering bolos setoran? Berikan saran motivasi.";
                break;
        }

        // RAKIT PROMPT LENGKAP
        const fullPrompt = `
            Anda adalah Konsultan Ahli Pesantren Al-Hasanah (AI Enterprise System).
            DATA FAKTA REAL-TIME: ${contextData}
            PERTANYAAN/TUGAS: ${promptInstruction}
            INSTRUKSI OUTPUT: Gunakan bahasa Indonesia yang formal, takzim kepada Kyai, strategis, dan solutif. Gunakan format Markdown yang rapi.
        `;

        try {
            const { data, error } = await supabaseClient.functions.invoke('gemini-consultant', {
                body: { prompt: fullPrompt }
            });

            if (error) {
                const errorDetail = await error.context?.json();
                console.error("Detailed Function Error:", errorDetail);
                message.error(`AI Error: ${errorDetail?.detail || "Gagal analisa"}`);
                setAiResponse(`⚠️ *Gagal menganalisa.* \n\nPesan Error: ${errorDetail?.detail || "Silakan coba lagi beberapa saat lagi."}`);
            } else {
                setAiResponse(data.answer);
            }
        } catch (err) {
            console.error("Critical Error:", err);
            message.error("Koneksi ke server AI gagal");
            setAiResponse("⚠️ *Koneksi Terputus.* Gagal menghubungi server.");
        } finally {
            setLoading(false);
        }
    };

    // =========================================================================
    // 3. UI CONFIGURATION (ELEGANT DARK THEME)
    // =========================================================================
    
    const menuItems = [
        { key: 'KESEHATAN', label: 'Analisa Kesehatan', sub: 'Medical Audit', icon: <MedicineBoxOutlined />, color: '#ff4d4f' },
        { key: 'PELANGGARAN', label: 'Cek Kedisiplinan', sub: 'Behavior Analysis', icon: <SafetyCertificateOutlined />, color: '#ffa940' },
        { key: 'KEUANGAN', label: 'Audit Keuangan', sub: 'Financial Strategy', icon: <WalletOutlined />, color: '#73d13d' },
        { key: 'ADMIN', label: 'Aktivitas Admin', sub: 'Team Performance', icon: <UserSwitchOutlined />, color: '#40a9ff' },
        { key: 'TAHFIDZ', label: 'Hafalan Santri', sub: 'Academic Progress', icon: <BookOutlined />, color: '#b37feb' },
    ];

    return (
        <>
            <FloatButton 
                icon={<RadarChartOutlined style={{ fontSize: 24, color: '#fff' }} />} 
                style={{ 
                    right: 24, bottom: 100, 
                    width: 64, height: 64, 
                    backgroundColor: '#7e22ce', // Purple theme
                    boxShadow: '0 0 20px rgba(126, 34, 206, 0.6)'
                }}
                type="primary"
                tooltip="AI Executive Consultant"
                onClick={() => setIsOpen(true)}
            />

            <Modal
                open={isOpen}
                onCancel={() => setIsOpen(false)}
                footer={null}
                width={1150}
                centered
                styles={{ 
                    body: { height: '650px', padding: 0, overflow: 'hidden' },
                    mask: { backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.6)' }
                }}
                modalRender={(modal) => (
                    <div className="dark-glass-modal" style={{ borderRadius: '24px', overflow: 'hidden' }}>
                        {modal}
                    </div>
                )}
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', color: '#fff' }}>
                        <Avatar 
                            size={42}
                            style={{ background: 'linear-gradient(135deg, #7e22ce, #3b82f6)', border: '2px solid rgba(255,255,255,0.2)' }} 
                            icon={<CrownOutlined />} 
                        />
                        <div>
                            <Text strong style={{ fontSize: 18, color: '#fff', display: 'block', lineHeight: 1.2 }}>AL-HASANAH COMMAND CENTER</Text>
                            <span style={{ fontSize: 10, color: '#a78bfa', letterSpacing: '2px', textTransform: 'uppercase' }}>Executive AI Analytics 2.0</span>
                        </div>
                    </div>
                }
                closeIcon={<CloseOutlined style={{ color: '#94a3b8', fontSize: 18 }} />}
            >
                <div style={{ display: 'flex', height: '100%', background: '#0f172a' }}>
                    
                    {/* --- SIDEBAR MENU --- */}
                    <div style={{ width: '340px', padding: '24px', background: 'rgba(30, 41, 59, 0.4)', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
                        <Text strong style={{ color: '#64748b', fontSize: 11, marginBottom: '20px', display: 'block', letterSpacing: '1.5px', fontWeight: 700 }}>
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
                                        gap: '16px',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        background: selectedTopic === item.key ? 'rgba(126, 34, 206, 0.15)' : 'transparent',
                                        border: `1px solid ${selectedTopic === item.key ? 'rgba(126, 34, 206, 0.5)' : 'transparent'}`
                                    }}
                                >
                                    <div style={{ 
                                        fontSize: '20px', 
                                        color: item.color,
                                        background: selectedTopic === item.key ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.05)',
                                        padding: '10px',
                                        borderRadius: '12px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        {item.icon}
                                    </div>
                                    <div>
                                        <div style={{ color: selectedTopic === item.key ? '#fff' : '#cbd5e1', fontWeight: 600, fontSize: 15 }}>
                                            {item.label}
                                        </div>
                                        <div style={{ color: '#64748b', fontSize: 11 }}>{item.sub}</div>
                                    </div>
                                </div>
                            ))}
                        </Space>
                    </div>

                    {/* --- CONTENT AREA --- */}
                    <div style={{ flex: 1, padding: '40px', overflowY: 'auto', background: 'radial-gradient(circle at top right, rgba(59, 130, 246, 0.1), transparent 40%), #0f172a' }}>
                        {!selectedTopic ? (
                            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                                <Avatar size={100} style={{ background: 'rgba(255,255,255,0.03)', marginBottom: '24px', border: '1px solid rgba(255,255,255,0.1)' }} icon={<StarFilled style={{ color: '#f59e0b' }} />} />
                                <Title level={2} style={{ color: '#fff', marginBottom: '8px', fontWeight: 300 }}>Siap Melayani, <span style={{fontWeight: 700}}>Pak Kyai</span></Title>
                                <Text style={{ color: '#94a3b8', fontSize: 16, maxWidth: '400px' }}>Silakan pilih modul analisa di sebelah kiri untuk mendapatkan insight strategis berbasis data realtime.</Text>
                            </div>
                        ) : (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '20px' }}>
                                    <Title level={2} style={{ color: '#fff', margin: 0 }}>
                                        <span style={{ color: menuItems.find(i => i.key === selectedTopic)?.color }}>#</span> {menuItems.find(i => i.key === selectedTopic)?.label}
                                    </Title>
                                    <Button 
                                        ghost 
                                        icon={<ReloadOutlined />} 
                                        onClick={() => consultGemini(selectedTopic)}
                                        style={{ borderColor: 'rgba(255,255,255,0.3)', color: '#cbd5e1' }}
                                    >
                                        Analisa Ulang
                                    </Button>
                                </div>
                                
                                {loading ? (
                                    <div style={{ padding: '80px 0', textAlign: 'center' }}>
                                        <Spin size="large" />
                                        <div style={{ marginTop: '24px', color: '#a78bfa', fontSize: 16, letterSpacing: '1px' }} className="animate-pulse">
                                            MENGHUBUNGI INTELIJEN GEMINI...
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
                /* Modal Styling Override */
                .dark-glass-modal .ant-modal-content {
                    background: rgba(15, 23, 42, 0.95) !important;
                    backdrop-filter: blur(20px) !important;
                    border: 1px solid rgba(255,255,255,0.1) !important;
                    box-shadow: 0 50px 100px -20px rgba(0, 0, 0, 0.8) !important;
                    padding: 0 !important;
                }
                .dark-glass-modal .ant-modal-header {
                    background: rgba(30, 41, 59, 0.5) !important;
                    border-bottom: 1px solid rgba(255,255,255,0.05) !important;
                    padding: 20px 24px !important;
                    margin: 0 !important;
                }
                .ant-modal-close {
                    top: 25px !important;
                    right: 25px !important;
                }

                /* Menu Hover Effects */
                .menu-item:hover {
                    background: rgba(255,255,255,0.05) !important;
                    transform: translateX(5px);
                }

                /* Markdown Content Styling */
                .ai-markdown-content h1, .ai-markdown-content h2, .ai-markdown-content h3 { 
                    color: #fff; 
                    margin-top: 24px; 
                    font-weight: 700;
                }
                .ai-markdown-content h3 {
                    font-size: 1.1rem;
                    color: #e2e8f0;
                    border-left: 4px solid #7e22ce;
                    padding-left: 12px;
                }
                .ai-markdown-content strong {
                    color: #f8fafc;
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