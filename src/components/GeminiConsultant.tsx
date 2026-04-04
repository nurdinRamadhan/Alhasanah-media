import React, { useState, useRef, useCallback, useEffect } from "react";
import {
    FloatButton, Modal, Typography, Button, Spin, Avatar, Space, message, Input, Tooltip, Tag
} from "antd";
import {
    RadarChartOutlined, MedicineBoxOutlined, SafetyCertificateOutlined,
    WalletOutlined, UserSwitchOutlined, BookOutlined,
    ReloadOutlined, CrownOutlined, StarFilled, CloseOutlined,
    MessageOutlined, SendOutlined, ThunderboltOutlined
} from "@ant-design/icons";
import { useList } from "@refinedev/core";
import dayjs from "dayjs";
import ReactMarkdown from "react-markdown";
import { supabaseClient } from "../utility/supabaseClient";

const { Title, Text } = Typography;
const { TextArea } = Input;

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
type TopicKey = "KESEHATAN" | "PELANGGARAN" | "KEUANGAN" | "ADMIN" | "TAHFIDZ" | "BEBAS";

interface CacheEntry {
    answer: string;
    savedAt: number; // epoch ms
}

// Cache TTL: 30 menit
const CACHE_TTL_MS = 30 * 60 * 1000;

// Kecepatan typewriter: ms per karakter
const TYPEWRITER_SPEED_MS = 7;

// ─────────────────────────────────────────────────────────────
// HOOK: TYPEWRITER
// ─────────────────────────────────────────────────────────────
function useTypewriter() {
    const [displayed, setDisplayed] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const rafRef = useRef<number | null>(null);
    const indexRef = useRef(0);
    const fullTextRef = useRef("");
    const lastTimeRef = useRef(0);

    const stop = useCallback(() => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        setIsTyping(false);
    }, []);

    const skipToEnd = useCallback(() => {
        stop();
        setDisplayed(fullTextRef.current);
    }, [stop]);

    const setInstant = useCallback((text: string) => {
        stop();
        fullTextRef.current = text;
        setDisplayed(text);
    }, [stop]);

    const startTyping = useCallback((text: string, onDone?: () => void) => {
        stop();
        setDisplayed("");
        fullTextRef.current = text;
        indexRef.current = 0;
        setIsTyping(true);

        const tick = (timestamp: number) => {
            if (timestamp - lastTimeRef.current >= TYPEWRITER_SPEED_MS) {
                lastTimeRef.current = timestamp;
                // Tulis beberapa karakter sekaligus supaya lebih cepat di teks panjang
                const chunkSize = 3;
                const end = Math.min(indexRef.current + chunkSize, text.length);
                setDisplayed(text.slice(0, end));
                indexRef.current = end;

                if (indexRef.current >= text.length) {
                    setIsTyping(false);
                    onDone?.();
                    return;
                }
            }
            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
    }, [stop]);

    // Cleanup saat unmount
    useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

    return { displayed, isTyping, startTyping, setInstant, skipToEnd };
}

// ─────────────────────────────────────────────────────────────
// COMPONENT UTAMA
// ─────────────────────────────────────────────────────────────
export const GeminiConsultant = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedTopic, setSelectedTopic] = useState<TopicKey | "">("");
    const [freeInput, setFreeInput] = useState("");
    const contentEndRef = useRef<HTMLDivElement>(null);

    // Cache disimpan di ref agar tidak trigger re-render
    const cacheRef = useRef<Record<string, CacheEntry>>({});

    const { displayed, isTyping, startTyping, setInstant, skipToEnd } = useTypewriter();

    // ─── Auto-scroll ke bawah saat teks muncul ───────────────
    useEffect(() => {
        if (isTyping) contentEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [displayed, isTyping]);

    // ─────────────────────────────────────────────────────────
    // DATA FETCHING  (lazy: hanya saat modal terbuka)
    // ─────────────────────────────────────────────────────────
    const weekStart  = dayjs().startOf("week").toISOString();
    const monthStart = dayjs().startOf("month").format("YYYY-MM-DD");

    const { data: dataSakit } = useList({
        resource: "kesehatan_santri",
        pagination: { mode: "off" },
        filters: [{ field: "created_at", operator: "gte", value: weekStart }],
        queryOptions: { enabled: isOpen },
    });

    const { data: dataPelanggaran } = useList({
        resource: "pelanggaran_santri",
        pagination: { mode: "off" },
        filters: [{ field: "created_at", operator: "gte", value: weekStart }],
        queryOptions: { enabled: isOpen },
    });

    const { data: dataPengeluaran } = useList({
        resource: "pengeluaran",
        pagination: { mode: "off" },
        filters: [{ field: "tanggal_pengeluaran", operator: "gte", value: monthStart }],
        queryOptions: { enabled: isOpen },
    });

    // ✅ FIX: filter ke bulan ini saja (sebelumnya load SEMUA data tanpa filter)
    const { data: dataTagihan } = useList({
        resource: "tagihan_santri",
        pagination: { mode: "off" },
        filters: [{ field: "created_at", operator: "gte", value: monthStart }],
        queryOptions: { enabled: isOpen },
    });

    const { data: dataAudit } = useList({
        resource: "audit_logs",
        pagination: { pageSize: 20 },
        sorters: [{ field: "created_at", order: "desc" }],
        queryOptions: { enabled: isOpen },
    });

    const { data: dataSantri } = useList({
        resource: "santri",
        pagination: { mode: "off" },
        meta: { select: "*" },
        queryOptions: { enabled: isOpen },
    });

    // ─────────────────────────────────────────────────────────
    // CACHE HELPERS
    // ─────────────────────────────────────────────────────────
    const cacheKey = (topic: string) => {
        // Slot per 30 menit — topic + floor(now / TTL)
        return `${topic}_${Math.floor(Date.now() / CACHE_TTL_MS)}`;
    };

    const readCache = (topic: string): string | null => {
        const entry = cacheRef.current[cacheKey(topic)];
        if (!entry) return null;
        if (Date.now() - entry.savedAt > CACHE_TTL_MS) {
            delete cacheRef.current[cacheKey(topic)];
            return null;
        }
        return entry.answer;
    };

    const writeCache = (topic: string, answer: string) => {
        cacheRef.current[cacheKey(topic)] = { answer, savedAt: Date.now() };
    };

    const burstCache = (topic: string) => {
        delete cacheRef.current[cacheKey(topic)];
    };

    const hasCached = (topic: string) => !!readCache(topic);

    // ─────────────────────────────────────────────────────────
    // BUILD PROMPT PER TOPIK
    // ─────────────────────────────────────────────────────────
    const buildPrompt = (topic: TopicKey, customQuestion?: string): string => {
        let contextData = "";
        let instruction = "";

        switch (topic) {
            // ── KESEHATAN ──────────────────────────────────────
            case "KESEHATAN": {
                const list = dataSakit?.data
                    .map((d: any) => `- ${d.santri?.nama ?? "?"}: ${d.keluhan ?? d.keterangan ?? "-"}`)
                    .join("\n") || "Nihil";
                contextData = `Total Sakit Minggu Ini: ${dataSakit?.total ?? 0}\nDetail:\n${list}`;
                instruction =
                    "Analisa tren penyakit santri minggu ini. Apakah ada indikasi wabah menular? " +
                    "Apakah ada penyakit kategori bahaya? " +
                    "Berikan saran medis preventif yang konkret dan actionable.";
                break;
            }

            // ── PELANGGARAN ────────────────────────────────────
            case "PELANGGARAN": {
                const all = dataSantri?.data ?? [];
                const sorted = [...all].sort(
                    (a: any, b: any) => (Number(b.poin) || 0) - (Number(a.poin) || 0)
                );
                const topViolators = sorted
                    .slice(0, 3)
                    .map((s: any) => `- ${s.nama} (${s.kelas ?? "-"}): ${s.poin ?? 0} Poin`)
                    .join("\n") || "Alhamdulillah, tidak ada pelanggaran berat.";
                const cleanSantri =
                    sorted.length > 3
                        ? sorted
                              .slice(-3)
                              .reverse()
                              .map((s: any) => `- ${s.nama} (${s.kelas ?? "-"}): ${s.poin ?? 0} Poin`)
                              .join("\n")
                        : "Data tidak cukup.";
                contextData =
                    `⚠️ PERLU PERHATIAN KHUSUS (Poin Tertinggi):\n${topViolators}\n\n` +
                    `🛡️ SANTRI TELADAN (Poin Terendah):\n${cleanSantri}`;
                instruction =
                    "Sebagai Qism Amn: evaluasi tren kedisiplinan secara keseluruhan. " +
                    "Sarankan pendekatan personal (tabayyun) untuk santri bermasalah, bukan hanya hukuman. " +
                    "Berikan apresiasi bagi yang tertib. Akhiri dengan nasehat tegas namun mengayomi.";
                break;
            }

            // ── KEUANGAN ───────────────────────────────────────
            case "KEUANGAN": {
                const totalKeluar =
                    dataPengeluaran?.data.reduce((a: number, b: any) => a + Number(b.nominal), 0) ?? 0;
                const totalMasuk =
                    dataTagihan?.data
                        .filter((t: any) => t.status === "LUNAS")
                        .reduce((a: number, b: any) => a + Number(b.nominal_tagihan), 0) ?? 0;
                const cats: Record<string, number> = {};
                dataPengeluaran?.data.forEach((d: any) => {
                    cats[d.kategori ?? "Lain-lain"] = (cats[d.kategori ?? "Lain-lain"] || 0) + Number(d.nominal);
                });
                const fmt = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
                contextData =
                    `Pemasukan Lunas Bulan Ini : ${fmt(totalMasuk)}\n` +
                    `Total Pengeluaran          : ${fmt(totalKeluar)}\n` +
                    `Saldo Bersih               : ${fmt(totalMasuk - totalKeluar)}\n` +
                    `Rincian per Kategori       : ${JSON.stringify(cats, null, 2)}`;
                instruction =
                    "Analisa arus kas bulan ini: apakah surplus atau defisit? " +
                    "Identifikasi kategori pengeluaran terbesar. " +
                    "Berikan 2–3 saran efisiensi yang konkret dan realistis untuk bulan depan.";
                break;
            }

            // ── ADMIN ──────────────────────────────────────────
            case "ADMIN": {
                const logs =
                    dataAudit?.data
                        .map((d: any) => `- [${dayjs(d.created_at).format("DD/MM HH:mm")}] ${d.user_name} → ${d.action} (${d.resource})`)
                        .join("\n") || "Tidak ada log.";
                contextData = `Log Aktivitas Admin Terbaru (20 entri):\n${logs}`;
                instruction =
                    "Audit kinerja admin: siapa yang paling aktif? " +
                    "Apakah ada pola mencurigakan (akses di luar jam kerja, penghapusan massal, akses berulang ke data sensitif)? " +
                    "Berikan penilaian singkat kinerja tim.";
                break;
            }

            // ── TAHFIDZ ────────────────────────────────────────
            case "TAHFIDZ": {
                const all = dataSantri?.data ?? [];
                const sorted = [...all].sort(
                    (a: any, b: any) => (Number(b.total_hafalan) || 0) - (Number(a.total_hafalan) || 0)
                );
                const top = sorted
                    .slice(0, 3)
                    .map((s: any) => `- ${s.nama} (${s.kelas ?? "-"}): ${s.total_hafalan ?? 0} Juz`)
                    .join("\n") || "Belum ada data hafalan.";
                const low =
                    sorted.length > 3
                        ? sorted
                              .slice(-3)
                              .reverse()
                              .map((s: any) => `- ${s.nama} (${s.kelas ?? "-"}): ${s.total_hafalan ?? 0} Juz`)
                              .join("\n")
                        : "Semua santri berprogres baik.";
                contextData = `🏆 MUMTAZ (Hafalan Terbanyak):\n${top}\n\n⚠️ PERLU BIMBINGAN:\n${low}`;
                instruction =
                    "Sebagai Musyrif Tahfidz Utama: " +
                    "1) Apresiasi (Barakallah) santri Mumtaz dan jadikan mereka Qudwah. " +
                    "2) Tawarkan solusi konkret untuk santri tertinggal (Talqin privat, pendekatan personal). " +
                    "3) Ingatkan pentingnya Muraja'ah agar hafalan tidak luntur. " +
                    "4) Akhiri dengan satu ayat motivasi yang relevan.";
                break;
            }

            // ── BEBAS ──────────────────────────────────────────
            case "BEBAS": {
                contextData =
                    `Total Santri Aktif : ${dataSantri?.total ?? "-"}\n` +
                    `Sakit Minggu Ini   : ${dataSakit?.total ?? "-"}\n` +
                    `Bulan             : ${dayjs().format("MMMM YYYY")}`;
                instruction = customQuestion ?? "";
                break;
            }
        }

        return `
Anda adalah Konsultan Eksekutif Pesantren Al-Hasanah (Al-Hasanah AI Enterprise System).
Tanggal & waktu sekarang: ${dayjs().format("dddd, DD MMMM YYYY — HH:mm")}.

═══ DATA REAL-TIME PESANTREN ═══
${contextData}

═══ TUGAS / PERTANYAAN ═══
${instruction}

═══ PANDUAN OUTPUT ═══
- Bahasa Indonesia formal, takzim kepada Kyai dan Pengurus
- Format Markdown rapi: gunakan ## heading, **bold**, dan bullet list
- Fokus, padat, tidak bertele-tele — maksimal 350 kata
- Akhiri setiap topik dengan satu rekomendasi tindakan paling prioritas
        `.trim();
    };

    // ─────────────────────────────────────────────────────────
    // MAIN: PANGGIL GEMINI
    // ─────────────────────────────────────────────────────────
    const consultGemini = async (topic: TopicKey, customQuestion?: string) => {
        setSelectedTopic(topic);
        skipToEnd(); // Hentikan typewriter sebelumnya jika masih jalan

        // ── Cek cache (kecuali mode BEBAS) ───────────────────
        if (topic !== "BEBAS") {
            const cached = readCache(topic);
            if (cached) {
                startTyping(cached);
                return;
            }
        }

        setLoading(true);
        setInstant("");

        const fullPrompt = buildPrompt(topic, customQuestion);

        try {
            const { data, error } = await supabaseClient.functions.invoke("gemini-consultant", {
                body: { prompt: fullPrompt },
            });

            if (error) {
                const detail = await error.context?.json().catch(() => null);
                const errMsg = detail?.detail ?? "Gagal menganalisa. Silakan coba lagi.";
                message.error(`AI Error: ${errMsg}`);
                setInstant(`⚠️ **Gagal menganalisa.**\n\n_Pesan: ${errMsg}_`);
                return;
            }

            const answer: string = data?.answer ?? "Maaf, tidak ada jawaban.";

            // Simpan ke cache
            if (topic !== "BEBAS") writeCache(topic, answer);

            // Mulai animasi typewriter
            setLoading(false);
            startTyping(answer);
            return; // agar finally tidak dobel setLoading(false)
        } catch (err: any) {
            message.error("Koneksi ke server AI gagal.");
            setInstant("⚠️ **Koneksi Terputus.**\n\nGagal menghubungi server AI. Periksa koneksi internet Anda.");
        } finally {
            setLoading(false);
        }
    };

    // ─────────────────────────────────────────────────────────
    // HANDLER BEBAS CHAT
    // ─────────────────────────────────────────────────────────
    const handleSendFree = () => {
        const q = freeInput.trim();
        if (!q || loading || isTyping) return;
        consultGemini("BEBAS", q);
        setFreeInput("");
    };

    // ─────────────────────────────────────────────────────────
    // MENU CONFIG
    // ─────────────────────────────────────────────────────────
    const menuItems: {
        key: TopicKey;
        label: string;
        sub: string;
        icon: React.ReactNode;
        color: string;
    }[] = [
        { key: "KESEHATAN",   label: "Analisa Kesehatan", sub: "التدقيق الطبي",         icon: <MedicineBoxOutlined />,      color: "#f87171" },
        { key: "PELANGGARAN", label: "Cek Kedisiplinan",  sub: "تحليل السلوك",           icon: <SafetyCertificateOutlined />, color: "#fb923c" },
        { key: "KEUANGAN",    label: "Audit Keuangan",    sub: "الاستراتيجية المالية",   icon: <WalletOutlined />,            color: "#4ade80" },
        { key: "ADMIN",       label: "Aktivitas Admin",   sub: "أداء الفريق",             icon: <UserSwitchOutlined />,        color: "#60a5fa" },
        { key: "TAHFIDZ",     label: "Hafalan Santri",    sub: "التقدم الأكاديمي",       icon: <BookOutlined />,              color: "#c084fc" },
        { key: "BEBAS",       label: "Konsultasi Bebas",  sub: "استشارة مفتوحة",         icon: <MessageOutlined />,           color: "#2dd4bf" },
    ];

    const activeMenu = menuItems.find((i) => i.key === selectedTopic);

    // ─────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────
    return (
        <>
            {/* ── Float Button Trigger ── */}
            <FloatButton
                icon={<RadarChartOutlined style={{ fontSize: 22, color: "#fff" }} />}
                style={{
                    right: 24, bottom: 100,
                    width: 60, height: 60,
                    backgroundColor: "#7e22ce",
                    boxShadow: "0 0 0 4px rgba(126,34,206,0.25), 0 8px 24px rgba(0,0,0,0.4)",
                }}
                type="primary"
                tooltip="AI Executive Consultant"
                onClick={() => setIsOpen(true)}
            />

            {/* ── Main Modal ── */}
            <Modal
                open={isOpen}
                onCancel={() => { setIsOpen(false); skipToEnd(); }}
                footer={null}
                width={1160}
                centered
                styles={{
                    body: { height: "680px", padding: 0, overflow: "hidden" },
                    mask: { backdropFilter: "blur(10px)", backgroundColor: "rgba(0,0,0,0.65)" },
                }}
                modalRender={(modal) => (
                    <div className="agc-modal-wrap">{modal}</div>
                )}
                closeIcon={<CloseOutlined style={{ color: "#64748b", fontSize: 16 }} />}
                title={
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <Avatar
                            size={44}
                            style={{
                                background: "linear-gradient(135deg, #7e22ce 0%, #2563eb 100%)",
                                border: "2px solid rgba(255,255,255,0.15)",
                                flexShrink: 0,
                            }}
                            icon={<CrownOutlined />}
                        />
                        <div>
                            <Text strong style={{ fontSize: 17, color: "#f8fafc", display: "block", lineHeight: 1.25 }}>
                                AL-HASANAH COMMAND CENTER
                            </Text>
                            <span style={{ fontSize: 10, color: "#a78bfa", letterSpacing: "2.5px" }}>
                                EXECUTIVE AI ANALYTICS · v2.1
                            </span>
                        </div>
                    </div>
                }
            >
                <div style={{ display: "flex", height: "100%", background: "#0c1120" }}>

                    {/* ══════════════ SIDEBAR ══════════════ */}
                    <div className="agc-sidebar">
                        <p className="agc-sidebar-label">STRATEGIC PILLARS</p>
                        <Space direction="vertical" style={{ width: "100%" }} size={8}>
                            {menuItems.map((item) => {
                                const isActive  = selectedTopic === item.key;
                                const cached    = item.key !== "BEBAS" && hasCached(item.key);
                                return (
                                    <div
                                        key={item.key}
                                        className={`agc-menu-item ${isActive ? "agc-menu-item--active" : ""}`}
                                        onClick={() => consultGemini(item.key)}
                                    >
                                        {/* Icon */}
                                        <div
                                            className="agc-menu-icon"
                                            style={{
                                                color: item.color,
                                                background: isActive
                                                    ? `${item.color}18`
                                                    : "rgba(255,255,255,0.04)",
                                                boxShadow: isActive ? `0 0 0 1px ${item.color}40` : "none",
                                            }}
                                        >
                                            {item.icon}
                                        </div>

                                        {/* Label */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div className="agc-menu-label" style={{ color: isActive ? "#f1f5f9" : "#94a3b8" }}>
                                                {item.label}
                                            </div>
                                            <div className="agc-menu-sub">{item.sub}</div>
                                        </div>

                                        {/* Cache indicator */}
                                        {cached && (
                                            <Tooltip title="Cache aktif (30 menit)" placement="right">
                                                <div className="agc-cache-dot" />
                                            </Tooltip>
                                        )}
                                    </div>
                                );
                            })}
                        </Space>
                    </div>

                    {/* ══════════════ CONTENT AREA ══════════════ */}
                    <div className="agc-content">

                        {/* Empty state */}
                        {!selectedTopic && (
                            <div className="agc-empty-state">
                                <Avatar
                                    size={90}
                                    icon={<StarFilled style={{ color: "#f59e0b" }} />}
                                    style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", marginBottom: 24 }}
                                />
                                <Title level={2} style={{ color: "#f1f5f9", fontWeight: 300, marginBottom: 8 }}>
                                    Siap Melayani, <strong>Pak Kyai</strong>
                                </Title>
                                <Text style={{ color: "#64748b", fontSize: 15, maxWidth: 360, textAlign: "center", lineHeight: 1.7 }}>
                                    Pilih modul analisa di sebelah kiri untuk mendapatkan insight strategis berbasis data realtime pesantren.
                                </Text>
                            </div>
                        )}

                        {/* Topic content */}
                        {selectedTopic && (
                            <>
                                {/* Topic Header */}
                                <div className="agc-topic-header">
                                    <div>
                                        <Title level={3} style={{ color: "#f1f5f9", margin: 0, fontSize: 20 }}>
                                            <span style={{ color: activeMenu?.color, marginRight: 6 }}>#</span>
                                            {activeMenu?.label}
                                        </Title>
                                        {selectedTopic !== "BEBAS" && hasCached(selectedTopic) && (
                                            <Tag
                                                color="success"
                                                style={{ marginTop: 4, fontSize: 10, letterSpacing: 1 }}
                                                icon={<ThunderboltOutlined />}
                                            >
                                                CACHE · {dayjs().format("HH:mm")}
                                            </Tag>
                                        )}
                                    </div>
                                    <Space>
                                        {isTyping && (
                                            <Button
                                                size="small"
                                                ghost
                                                onClick={skipToEnd}
                                                style={{ color: "#a78bfa", borderColor: "rgba(167,139,250,0.4)", fontSize: 12 }}
                                            >
                                                Skip ▶▶
                                            </Button>
                                        )}
                                        <Button
                                            ghost
                                            icon={<ReloadOutlined />}
                                            onClick={() => {
                                                if (selectedTopic !== "BEBAS") burstCache(selectedTopic);
                                                consultGemini(selectedTopic as TopicKey);
                                            }}
                                            disabled={loading || isTyping}
                                            style={{ borderColor: "rgba(255,255,255,0.2)", color: "#94a3b8" }}
                                        >
                                            Analisa Ulang
                                        </Button>
                                    </Space>
                                </div>

                                {/* Response Body */}
                                <div
                                    className="agc-response-body"
                                    onClick={() => isTyping && skipToEnd()}
                                    title={isTyping ? "Klik untuk langsung tampilkan semua" : undefined}
                                >
                                    {loading ? (
                                        <div className="agc-loading-state">
                                            <Spin size="large" />
                                            <p className="agc-loading-text agc-pulse">
                                                MENGHUBUNGI INTELIJEN GEMINI...
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="agc-markdown">
                                            <ReactMarkdown>{displayed}</ReactMarkdown>
                                            {isTyping && <span className="agc-cursor">▌</span>}
                                        </div>
                                    )}
                                    <div ref={contentEndRef} />
                                </div>

                                {/* Free Chat Input */}
                                {selectedTopic === "BEBAS" && (
                                    <div className="agc-free-input-area">
                                        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                                            <TextArea
                                                value={freeInput}
                                                onChange={(e) => setFreeInput(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" && !e.shiftKey) {
                                                        e.preventDefault();
                                                        handleSendFree();
                                                    }
                                                }}
                                                placeholder="Tanyakan apapun tentang pesantren… (Enter kirim · Shift+Enter baris baru)"
                                                autoSize={{ minRows: 2, maxRows: 5 }}
                                                disabled={loading || isTyping}
                                                className="agc-textarea"
                                            />
                                            <Button
                                                type="primary"
                                                icon={<SendOutlined />}
                                                onClick={handleSendFree}
                                                disabled={loading || isTyping || !freeInput.trim()}
                                                className="agc-send-btn"
                                            />
                                        </div>
                                        <Text style={{ color: "#334155", fontSize: 11, marginTop: 8, display: "block" }}>
                                            Mode bebas tidak menyimpan cache — setiap pertanyaan memanggil API secara langsung.
                                        </Text>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </Modal>

            {/* ══════════════ STYLES ══════════════ */}
            <style>{`
                /* ── Modal Shell ── */
                .agc-modal-wrap { border-radius: 20px; overflow: hidden; }
                .agc-modal-wrap .ant-modal-content {
                    background: rgba(12, 17, 32, 0.98) !important;
                    backdrop-filter: blur(24px) !important;
                    border: 1px solid rgba(255,255,255,0.08) !important;
                    box-shadow: 0 40px 80px -16px rgba(0,0,0,0.9) !important;
                    padding: 0 !important;
                    border-radius: 20px !important;
                }
                .agc-modal-wrap .ant-modal-header {
                    background: rgba(20, 28, 50, 0.7) !important;
                    border-bottom: 1px solid rgba(255,255,255,0.06) !important;
                    padding: 18px 24px !important;
                    margin: 0 !important;
                    backdrop-filter: blur(20px);
                }
                .ant-modal-close { top: 22px !important; right: 22px !important; }

                /* ── Sidebar ── */
                .agc-sidebar {
                    width: 280px;
                    flex-shrink: 0;
                    padding: 24px 18px;
                    background: rgba(20, 28, 50, 0.35);
                    border-right: 1px solid rgba(255,255,255,0.06);
                    overflow-y: auto;
                }
                .agc-sidebar-label {
                    color: #334155;
                    font-size: 10px;
                    font-weight: 700;
                    letter-spacing: 2px;
                    margin-bottom: 18px;
                    margin-top: 0;
                }

                /* ── Menu Items ── */
                .agc-menu-item {
                    padding: 12px 14px;
                    border-radius: 12px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    border: 1px solid transparent;
                    transition: all 0.2s ease;
                    user-select: none;
                }
                .agc-menu-item:hover {
                    background: rgba(255,255,255,0.04) !important;
                    transform: translateX(3px);
                }
                .agc-menu-item--active {
                    background: rgba(126, 34, 206, 0.12) !important;
                    border-color: rgba(126, 34, 206, 0.4) !important;
                }
                .agc-menu-icon {
                    width: 36px; height: 36px;
                    display: flex; align-items: center; justify-content: center;
                    border-radius: 9px;
                    font-size: 16px;
                    flex-shrink: 0;
                    transition: all 0.2s ease;
                }
                .agc-menu-label { font-size: 13px; font-weight: 600; line-height: 1.3; }
                .agc-menu-sub   { font-size: 11px; color: #3d4f6a; margin-top: 1px; }
                .agc-cache-dot  {
                    width: 7px; height: 7px;
                    border-radius: 50%;
                    background: #22c55e;
                    box-shadow: 0 0 6px #22c55e;
                    flex-shrink: 0;
                }

                /* ── Content Area ── */
                .agc-content {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    background: radial-gradient(ellipse at top right, rgba(37,99,235,0.07) 0%, transparent 55%), #0c1120;
                }

                /* ── Empty State ── */
                .agc-empty-state {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 40px;
                }

                /* ── Topic Header ── */
                .agc-topic-header {
                    padding: 24px 36px 18px;
                    border-bottom: 1px solid rgba(255,255,255,0.06);
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    flex-shrink: 0;
                }

                /* ── Response Body ── */
                .agc-response-body {
                    flex: 1;
                    overflow-y: auto;
                    padding: 28px 36px;
                    cursor: default;
                }
                .agc-response-body:has(.agc-cursor) { cursor: text; }

                /* ── Loading ── */
                .agc-loading-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 80px 0;
                    gap: 20px;
                }
                .agc-loading-text {
                    color: #a78bfa;
                    font-size: 13px;
                    letter-spacing: 2px;
                    margin: 0;
                }

                /* ── Markdown ── */
                .agc-markdown { color: #cbd5e1; font-size: 15px; line-height: 1.9; }
                .agc-markdown h1, .agc-markdown h2 { color: #f1f5f9; font-weight: 700; margin-top: 24px; }
                .agc-markdown h3 {
                    color: #e2e8f0; font-size: 1rem; font-weight: 600;
                    border-left: 3px solid #7e22ce; padding-left: 10px; margin-top: 20px;
                }
                .agc-markdown strong { color: #f8fafc; }
                .agc-markdown ul { padding-left: 22px; }
                .agc-markdown li { margin-bottom: 7px; }
                .agc-markdown p  { margin-bottom: 12px; }
                .agc-markdown blockquote {
                    border-left: 3px solid #7e22ce;
                    padding-left: 16px;
                    color: #94a3b8;
                    margin-left: 0;
                    font-style: italic;
                }

                /* ── Cursor ── */
                .agc-cursor {
                    color: #a78bfa;
                    font-weight: 700;
                    animation: agc-blink 1s step-end infinite;
                }
                @keyframes agc-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

                /* ── Free Input Area ── */
                .agc-free-input-area {
                    padding: 14px 36px 22px;
                    border-top: 1px solid rgba(255,255,255,0.06);
                    flex-shrink: 0;
                    background: rgba(0,0,0,0.15);
                }
                .agc-textarea {
                    background: rgba(255,255,255,0.05) !important;
                    border: 1px solid rgba(255,255,255,0.1) !important;
                    color: #e2e8f0 !important;
                    border-radius: 12px !important;
                    font-size: 14px !important;
                    resize: none;
                    transition: border-color 0.2s;
                }
                .agc-textarea:focus {
                    border-color: rgba(126,34,206,0.6) !important;
                    box-shadow: 0 0 0 2px rgba(126,34,206,0.15) !important;
                }
                .agc-textarea::placeholder { color: #334155 !important; }
                .agc-send-btn {
                    height: 52px !important;
                    width: 52px !important;
                    border-radius: 12px !important;
                    background: #7e22ce !important;
                    border: none !important;
                    flex-shrink: 0;
                    transition: background 0.2s, transform 0.1s !important;
                }
                .agc-send-btn:not(:disabled):hover {
                    background: #6d1fc7 !important;
                    transform: scale(1.05);
                }

                /* ── Pulse Animation ── */
                .agc-pulse { animation: agc-pulse 2s ease-in-out infinite; }
                @keyframes agc-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

                /* ── Scrollbar ── */
                .agc-sidebar::-webkit-scrollbar,
                .agc-response-body::-webkit-scrollbar { width: 3px; }
                .agc-sidebar::-webkit-scrollbar-thumb,
                .agc-response-body::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.1);
                    border-radius: 3px;
                }
                .agc-sidebar::-webkit-scrollbar-track,
                .agc-response-body::-webkit-scrollbar-track { background: transparent; }
            `}</style>
        </>
    );
};
