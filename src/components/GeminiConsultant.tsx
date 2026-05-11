// ╔══════════════════════════════════════════════════════════════════════════╗
// ║   AL-HASANAH COMMAND CENTER  ·  AI Intelligence Suite  v3.0            ║
// ║   Dual Mode: Executive Analysis + Agentic Execution                    ║
// ║   Design: Islamic Art Deco Luxury · Dark/Light Adaptive                ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import React, {
  useState, useRef, useCallback, useEffect, useMemo,
} from "react";
import {
  Modal, Typography, Button, Spin, Avatar, Space,
  message as antMessage, Input, Tooltip, Tag, theme, Badge,
} from "antd";
import { motion, AnimatePresence } from "framer-motion";
import {
  RadarChartOutlined, MedicineBoxOutlined, SafetyCertificateOutlined,
  WalletOutlined, UserSwitchOutlined, BookOutlined, ReloadOutlined,
  CrownOutlined, CloseOutlined, MessageOutlined, SendOutlined,
  ThunderboltOutlined, RobotOutlined, CheckCircleFilled,
  CloseCircleFilled, ExclamationCircleFilled, UserOutlined,
  LoadingOutlined, StarFilled, InfoCircleOutlined, ClearOutlined,
} from "@ant-design/icons";
import { useList, useGetIdentity } from "@refinedev/core";
import { Routes, Route } from "react-router-dom";
import dayjs from "dayjs";
import ReactMarkdown from "react-markdown";
import { supabaseClient } from "../utility/supabaseClient";
import type { IUserIdentity, TGenderScope, TJurusanScope } from "../types";

const { Text } = Typography;
const { TextArea } = Input;

// ══════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════
type TopicKey = "KESEHATAN" | "PELANGGARAN" | "KEUANGAN" | "ADMIN" | "TAHFIDZ" | "BEBAS";
type AppMode  = "analysis" | "agent";

interface CacheEntry { answer: string; savedAt: number; }
interface Santri { nama: string; kelas?: string; poin?: number; total_hafalan?: number; }

interface ChatMessage {
  id:             string;
  role:           "user" | "assistant" | "system" | "action";
  content:        string;
  timestamp:      Date;
  actionData?: {
    toolName:      string;
    args:          Record<string, unknown>;
    actionSummary: string;
    aiPreMessage?: string | null;
  };
  actionStatus?:  "pending" | "approved" | "rejected" | "executing" | "success" | "failed";
  resultData?:    Record<string, unknown>;
}

interface GeminiConvMsg {
  role:  "user" | "model";
  parts: unknown[];
}

export interface GeminiConsultantProps {
  edgeFunctionUrl?: string;
  callerProfile?: {
    id: string;
    full_name: string;
    role: any;
    akses_gender: TGenderScope;
    akses_jurusan: TJurusanScope;
  } | null;
}

// ══════════════════════════════════════════════════════════════════════════
// DESIGN CONSTANTS
// ══════════════════════════════════════════════════════════════════════════
const GOLD = "#D4A030";
const GOLD_BRIGHT = "#F5C842";
const GOLD_GLOW   = "rgba(212,160,48,0.45)";
const CACHE_TTL_MS = 30 * 60 * 1000;

const MENU_ITEMS = [
  { key: "KESEHATAN"   as TopicKey, label: "Analisa Kesehatan", arabic: "التدقيق Medical", icon: <MedicineBoxOutlined />, color: "#F87171" },
  { key: "PELANGGARAN" as TopicKey, label: "Cek Kedisiplinan", arabic: "تحليل السلوك", icon: <SafetyCertificateOutlined />, color: "#FB923C" },
  { key: "KEUANGAN"    as TopicKey, label: "Audit Keuangan", arabic: "الاستراتيجية المالية", icon: <WalletOutlined />, color: "#4ADE80" },
  { key: "ADMIN"       as TopicKey, label: "Aktivitas Admin", arabic: "أداء الفريق", icon: <UserSwitchOutlined />, color: "#60A5FA" },
  { key: "TAHFIDZ"     as TopicKey, label: "Hafalan Santri", arabic: "التقدم الأكاديمي", icon: <BookOutlined />, color: "#C084FC" },
  { key: "BEBAS"       as TopicKey, label: "Konsultasi Bebas", arabic: "استشارة مفتوحة", icon: <MessageOutlined />, color: GOLD_BRIGHT },
];

const QUICK_CMDS = [
  { text: "Siapa santri yang belum bayar SPP bulan ini?",               icon: "📋" },
  { text: "Buat tagihan SPP 500rb untuk semua santri aktif kelas 2",   icon: "💰" },
  { text: "Rekap pelanggaran tertinggi minggu ini",                     icon: "⚠️" },
  { text: "Tampilkan progres hafalan terbaik santri tahfidz kelas 3",  icon: "📖" },
];

const ACTION_ICON: Record<string, string> = {
  generate_tagihan_massal:    "📋", generate_tagihan_individual: "🧾",
  update_status_tagihan:      "💰", update_status_santri:        "🔄",
  update_santri_data:         "✏️", insert_pelanggaran:          "⚠️",
  insert_pelanggaran_massal:  "⚠️", insert_kesehatan:            "🏥",
  insert_perizinan:           "🚪", insert_prestasi:             "🏆",
  insert_hafalan_tahfidz:     "📖", insert_hafalan_kitab:        "📚",
  insert_murojaah:            "🔁", insert_pengeluaran:          "💸",
  topup_dompet:               "💳", kirim_notifikasi:            "🔔",
};

// ══════════════════════════════════════════════════════════════════════════
// HOOK: TYPEWRITER (analysis mode)
// ══════════════════════════════════════════════════════════════════════════
function useTypewriter() {
  const [displayed, setDisplayed] = useState("");
  const [isTyping, setIsTyping]   = useState(false);
  const rafRef   = useRef<number | null>(null);
  const idxRef   = useRef(0);
  const fullRef  = useRef("");

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setIsTyping(false);
  }, []);

  const skipToEnd  = useCallback(() => { stop(); setDisplayed(fullRef.current); }, [stop]);
  const setInstant = useCallback((t: string) => { stop(); fullRef.current = t; setDisplayed(t); }, [stop]);

  const startTyping = useCallback((text: string) => {
    stop();
    setDisplayed("");
    fullRef.current = text;
    idxRef.current  = 0;
    setIsTyping(true);
    let last = 0;
    const tick = (ts: number) => {
      if (ts - last >= 6) {
        last = ts;
        const end = Math.min(idxRef.current + 4, text.length);
        setDisplayed(text.slice(0, end));
        idxRef.current = end;
        if (idxRef.current >= text.length) { setIsTyping(false); return; }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stop]);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);
  return { displayed, isTyping, startTyping, setInstant, skipToEnd };
}

// ══════════════════════════════════════════════════════════════════════════
// HELPER: nanoid-lite
// ══════════════════════════════════════════════════════════════════════════
const nid = () => Math.random().toString(36).slice(2, 10);

// ══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════
export const GeminiConsultant: React.FC<GeminiConsultantProps> = ({
  edgeFunctionUrl: propEdgeUrl,
  callerProfile: propCallerProfile
}) => {

  // ── App state ─────────────────────────────────────────────────────────
  const [isOpen,        setIsOpen]        = useState(false);
  const [mode,          setMode]          = useState<AppMode>("analysis");

  // Analysis state
  const [loading,       setLoading]       = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<TopicKey | "">("");
  const [freeInput,     setFreeInput]     = useState("");
  const cacheRef = useRef<Record<string, CacheEntry>>({});
  const { displayed, isTyping, startTyping, setInstant, skipToEnd } = useTypewriter();

  // Agent state
  const [chatMessages,  setChatMessages]  = useState<ChatMessage[]>([]);
  const [agentInput,    setAgentInput]    = useState("");
  const [agentLoading,  setAgentLoading]  = useState(false);
  const [geminiHistory, setGeminiHistory] = useState<GeminiConvMsg[]>([]);

  // Refs
  const analysisEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef     = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);

  // ── Identity (for agent callerProfile) ───────────────────────────────
  const { data: identity } = useGetIdentity<IUserIdentity>();
  const callerProfile = useMemo(() => {
    if (propCallerProfile) return propCallerProfile;
    return identity ? {
      id:           identity.id,
      full_name:    identity.name,
      role:         identity.role,
      akses_gender: identity.scopeGender,
      akses_jurusan: identity.scopeJurusan,
    } : null;
  }, [identity, propCallerProfile]);

  const edgeFunctionUrl = propEdgeUrl || `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gemini-consultant`;

  // ── Theme detection ────────────────────────────────────────────────────
  const { token } = theme.useToken();
  const isDark = useMemo(() => {
    const h = token.colorBgContainer.replace("#", "");
    const lum = parseInt(h.slice(0, 2), 16) * 0.299
              + parseInt(h.slice(2, 4), 16) * 0.587
              + parseInt(h.slice(4, 6), 16) * 0.114;
    return lum < 128;
  }, [token.colorBgContainer]);

  // ── Theme palette ──────────────────────────────────────────────────────
  const T = useMemo(() => isDark ? ({
    bg:            "#070B14",
    surface:       "#0C1422",
    surfaceAlt:    "#101C30",
    panel:         "#152030",
    border:        "rgba(212,160,48,0.10)",
    borderGold:    "rgba(212,160,48,0.38)",
    text:          "#EDE6D0",
    textSub:       "#9A8460",
    textDim:       "#3A3020",
    sidebarBg:     "rgba(7,11,20,0.98)",
    chatBg:        "#060912",
    userBubble:    "linear-gradient(140deg,#B88020 0%,#7A5010 100%)",
    aiBubbleBg:    "rgba(12,20,36,0.88)",
    aiBubbleBorder:"rgba(212,160,48,0.18)",
    inputBg:       "rgba(255,255,255,0.04)",
    inputBorder:   "rgba(212,160,48,0.22)",
    inputFocus:    "rgba(212,160,48,0.55)",
    headerBg:      "linear-gradient(135deg,#050912 0%,#0C1828 100%)",
    actionBg:      "rgba(8,14,26,0.97)",
    actionBorder:  "rgba(212,160,48,0.55)",
    systemBg:      "rgba(212,160,48,0.07)",
    scrollbar:     "rgba(212,160,48,0.14)",
    emptyGlow:     "radial-gradient(circle at 50% 40%,rgba(212,160,48,0.06) 0%,transparent 65%)",
    patternOpacity:"0.025",
  }) : ({
    bg:            "#FDFBF0",
    surface:       "#FFFFFF",
    surfaceAlt:    "#F8F3E5",
    panel:         "#F0EAD5",
    border:        "rgba(160,120,32,0.14)",
    borderGold:    "rgba(180,135,40,0.42)",
    text:          "#1A1205",
    textSub:       "#7A6030",
    textDim:       "#C0A860",
    sidebarBg:     "rgba(248,243,228,0.97)",
    chatBg:        "#FDFBF0",
    userBubble:    "linear-gradient(140deg,#C89020 0%,#9A6A10 100%)",
    aiBubbleBg:    "rgba(255,255,255,0.95)",
    aiBubbleBorder:"rgba(180,135,40,0.25)",
    inputBg:       "rgba(0,0,0,0.02)",
    inputBorder:   "rgba(160,120,32,0.28)",
    inputFocus:    "rgba(180,135,40,0.52)",
    headerBg:      "linear-gradient(135deg,#F0E9CE 0%,#E8DDB0 100%)",
    actionBg:      "rgba(255,252,240,0.98)",
    actionBorder:  "rgba(180,135,40,0.58)",
    systemBg:      "rgba(180,135,40,0.08)",
    scrollbar:     "rgba(180,135,40,0.22)",
    emptyGlow:     "radial-gradient(circle at 50% 40%,rgba(212,160,48,0.08) 0%,transparent 65%)",
    patternOpacity:"0.04",
  }), [isDark]);

  // ── Data fetching ──────────────────────────────────────────────────────
  const weekStart  = dayjs().startOf("week").toISOString();
  const monthStart = dayjs().startOf("month").format("YYYY-MM-DD");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: dataSakit }       = useList({ resource: "kesehatan_santri",   pagination: { mode: "off" }, filters: [{ field: "created_at",         operator: "gte", value: weekStart  }], queryOptions: { enabled: isOpen } });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: dataPelanggaran } = useList({ resource: "pelanggaran_santri", pagination: { mode: "off" }, filters: [{ field: "created_at",         operator: "gte", value: weekStart  }], queryOptions: { enabled: isOpen } });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: dataPengeluaran } = useList({ resource: "pengeluaran",        pagination: { mode: "off" }, filters: [{ field: "tanggal_pengeluaran", operator: "gte", value: monthStart }], queryOptions: { enabled: isOpen } });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: dataTagihan }     = useList({ resource: "tagihan_santri",     pagination: { mode: "off" }, filters: [{ field: "created_at",         operator: "gte", value: monthStart }], queryOptions: { enabled: isOpen } });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: dataAudit }       = useList({ resource: "audit_logs",         pagination: { pageSize: 20 }, sorters: [{ field: "created_at", order: "desc" }], queryOptions: { enabled: isOpen } });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: dataSantri }      = useList({ resource: "santri",             pagination: { mode: "off" }, meta: { select: "*" }, queryOptions: { enabled: isOpen } });

  // ── Scroll ─────────────────────────────────────────────────────────────
  useEffect(() => { if (isTyping) analysisEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [displayed, isTyping]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  // ── Cache ──────────────────────────────────────────────────────────────
  const cKey = (t: string) => `${t}_${Math.floor(Date.now() / CACHE_TTL_MS)}`;
  const readCache  = (t: string) => { const e = cacheRef.current[cKey(t)]; return (e && Date.now() - e.savedAt < CACHE_TTL_MS) ? e.answer : null; };
  const writeCache = (t: string, a: string) => { cacheRef.current[cKey(t)] = { answer: a, savedAt: Date.now() }; };
  const burstCache = (t: string) => { delete cacheRef.current[cKey(t)]; };
  const hasCached  = (t: string) => !!readCache(t);

  // ── Build Prompt ───────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buildPrompt = (topic: TopicKey, custom?: string): string => {
    const fmt = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
    let ctx = "", instr = "";
    switch (topic) {
      case "KESEHATAN": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const list = dataSakit?.data.map((d: any) => `- ${d.santri?.nama ?? "?"}: ${d.keluhan ?? "-"}`).join("\n") || "Nihil";
        ctx   = `Total Sakit Minggu Ini: ${dataSakit?.total ?? 0}\nDetail:\n${list}`;
        instr = "Analisa tren penyakit santri minggu ini. Apakah ada indikasi wabah? Identifikasi penyakit dominan dan berikan saran medis preventif yang konkret. Akhiri dengan satu rekomendasi aksi prioritas.";
        break;
      }
      case "PELANGGARAN": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const all    = [...(dataSantri?.data ?? [])] as Santri[];
        const sorted = all.sort((a, b) => (Number(b.poin) || 0) - (Number(a.poin) || 0));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const top    = sorted.slice(0, 3).map((s: any) => `- ${s.nama} (Kelas ${s.kelas ?? "-"}): ${s.poin ?? 0} Poin`).join("\n") || "Alhamdulillah, nihil.";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const clean  = sorted.length > 3 ? sorted.slice(-3).reverse().map((s: any) => `- ${s.nama} (Kelas ${s.kelas ?? "-"}): ${s.poin ?? 0} Poin`).join("\n") : "Semua santri disiplin.";
        ctx   = `⚠️ Perhatian Khusus:\n${top}\n\n🛡️ Santri Teladan:\n${clean}`;
        instr = "Evaluasi tren kedisiplinan. Sarankan pendekatan personal (tabayyun) untuk santri bermasalah, bukan hanya hukuman. Apresiasi yang tertib. Akhiri dengan nasehat tegas namun mengayomi.";
        break;
      }
      case "KEUANGAN": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const totalKeluar = dataPengeluaran?.data.reduce((a: number, b: any) => a + Number(b.nominal), 0) ?? 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const totalMasuk  = dataTagihan?.data.filter((t: any) => t.status === "LUNAS").reduce((a: number, b: any) => a + Number(b.nominal_tagihan), 0) ?? 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cats: Record<string, number> = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dataPengeluaran?.data.forEach((d: any) => { cats[d.kategori ?? "Lain"] = (cats[d.kategori ?? "Lain"] || 0) + Number(d.nominal); });
        ctx   = `Pemasukan (Lunas): ${fmt(totalMasuk)}\nPengeluaran: ${fmt(totalKeluar)}\nSaldo Bersih: ${fmt(totalMasuk - totalKeluar)}\nPer Kategori: ${JSON.stringify(cats)}`;
        instr = "Analisa arus kas: surplus atau defisit? Identifikasi pengeluaran terbesar. Berikan 2–3 saran efisiensi konkret untuk bulan depan. Sertakan peringatan jika kondisi keuangan mengkhawatirkan.";
        break;
      }
      case "ADMIN": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const logs = dataAudit?.data.map((d: any) => `- [${dayjs(d.created_at).format("DD/MM HH:mm")}] ${d.user_name} → ${d.action} (${d.resource})`).join("\n") || "Tidak ada log.";
        ctx   = `Log Aktivitas Admin Terbaru:\n${logs}`;
        instr = "Audit kinerja admin: siapa paling aktif? Adakah pola mencurigakan (akses di luar jam kerja, penghapusan massal)? Berikan penilaian singkat kinerja tim dan rekomendasi.";
        break;
      }
      case "TAHFIDZ": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const all    = [...(dataSantri?.data ?? [])] as Santri[];
        const sorted = all.sort((a, b) => (Number(b.total_hafalan) || 0) - (Number(a.total_hafalan) || 0));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const top    = sorted.slice(0, 3).map((s: any) => `- ${s.nama} (${s.kelas ?? "-"}): ${s.total_hafalan ?? 0} Juz`).join("\n");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const low    = sorted.slice(-3).reverse().map((s: any) => `- ${s.nama} (${s.kelas ?? "-"}): ${s.total_hafalan ?? 0} Juz`).join("\n");
        ctx   = `🏆 Mumtaz:\n${top}\n\n⚠️ Perlu Bimbingan:\n${low}`;
        instr = "Sebagai Musyrif Tahfidz: Apresiasi Mumtaz (Barakallah). Sarankan solusi konkret untuk santri tertinggal. Ingatkan pentingnya Muraja'ah. Akhiri dengan satu ayat motivasi.";
        break;
      }
      case "BEBAS": {
        ctx   = `Santri Aktif: ${dataSantri?.total ?? "-"} | Sakit Minggu Ini: ${dataSakit?.total ?? "-"} | Bulan: ${dayjs().format("MMMM YYYY")}`;
        instr = custom ?? "";
        break;
      }
    }
    return `Anda adalah Konsultan Eksekutif Pesantren Al-Hasanah (AI Enterprise System).
Tanggal: ${dayjs().format("dddd, DD MMMM YYYY — HH:mm")}

═══ DATA REAL-TIME ═══
${ctx}

═══ TUGAS ═══
${instr}

═══ FORMAT OUTPUT ═══
- Bahasa Indonesia formal, takzim kepada Kyai dan Pengurus
- Markdown rapi: gunakan ## heading, **bold**, dan bullet list
- Padat, maksimal 350 kata
- Akhiri dengan satu REKOMENDASI AKSI prioritas yang dibold`.trim();
  };

  // ── Analysis: call Gemini Consultant ─────────────────────────────────
  const consultGemini = async (topic: TopicKey, custom?: string) => {
    setSelectedTopic(topic);
    skipToEnd();
    if (topic !== "BEBAS") {
      const cached = readCache(topic);
      if (cached) { startTyping(cached); return; }
    }
    setLoading(true);
    setInstant("");
    try {
      const { data, error } = await supabaseClient.functions.invoke("gemini-consultant", {
        body: { prompt: buildPrompt(topic, custom) },
      });
      if (error) {
        const detail = await error.context?.json().catch(() => null);
        const msg    = detail?.detail ?? "Gagal menganalisa.";
        antMessage.error(`AI Error: ${msg}`);
        setInstant(`⚠️ **Gagal.**\n\n_${msg}_`);
        return;
      }
      const answer = data?.answer ?? "Tidak ada respons.";
      if (topic !== "BEBAS") writeCache(topic, answer);
      setLoading(false);
      startTyping(answer);
      return;
    } catch {
      antMessage.error("Koneksi AI gagal.");
      setInstant("⚠️ **Koneksi Terputus.** Periksa internet Anda.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendFree = () => {
    const q = freeInput.trim();
    if (!q || loading || isTyping) return;
    consultGemini("BEBAS", q);
    setFreeInput("");
  };

  // ── Agent: send message ───────────────────────────────────────────────
  const sendAgentMessage = async (text?: string) => {
    const msgText = (text ?? agentInput).trim();
    if (!msgText || agentLoading) return;
    if (!callerProfile) { antMessage.error("Profil pengguna tidak ditemukan."); return; }
    setAgentInput("");

    const userMsg: ChatMessage = { id: nid(), role: "user", content: msgText, timestamp: new Date() };
    setChatMessages(prev => [...prev, userMsg]);
    setAgentLoading(true);

    try {
      const { data, error } = await supabaseClient.functions.invoke("ai-agent", {
        body: { mode: "chat", userMessage: msgText, conversationHistory: geminiHistory, callerProfile },
      });
      if (error) throw new Error(error.message);

      if (data.type === "text") {
        setChatMessages(prev => [...prev, {
          id: nid(), role: "assistant", content: data.answer, timestamp: new Date(),
        }]);
        if (data.updatedHistory) setGeminiHistory(data.updatedHistory);

      } else if (data.type === "action_required") {
        setChatMessages(prev => [...prev, {
          id: nid(), role: "action", content: data.actionSummary ?? "",
          timestamp: new Date(), actionStatus: "pending",
          actionData: {
            toolName: data.toolName, args: data.args,
            actionSummary: data.actionSummary, aiPreMessage: data.aiPreMessage,
          },
        }]);
        if (data.updatedHistory) setGeminiHistory(data.updatedHistory);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Terjadi kesalahan.";
      antMessage.error(msg);
      setChatMessages(prev => [...prev, {
        id: nid(), role: "system", content: `❌ Error: ${msg}`, timestamp: new Date(),
      }]);
    } finally {
      setAgentLoading(false);
    }
  };

  const approveAction = async (msgId: string) => {
    const msg = chatMessages.find(m => m.id === msgId);
    if (!msg?.actionData || !callerProfile) return;

    setChatMessages(prev => prev.map(m => m.id === msgId ? { ...m, actionStatus: "executing" } : m));
    try {
      const { data, error } = await supabaseClient.functions.invoke("ai-agent", {
        body: { 
          mode: "execute", 
          actionToExecute: { toolName: msg.actionData.toolName, args: msg.actionData.args }, 
          callerProfile,
          conversationHistory: geminiHistory // Pass history for consistency
        },
      });
      if (error) throw new Error(error.message);
      
      const success = data?.success !== false;
      if (data.updatedHistory) setGeminiHistory(data.updatedHistory);

      setChatMessages(prev => prev.map(m =>
        m.id === msgId ? { ...m, actionStatus: success ? "success" : "failed", resultData: data } : m
      ));
      setChatMessages(prev => [...prev, {
        id: nid(), role: "system",
        content: success
          ? `✅ **Berhasil dieksekusi.** ${data.affected ? `${data.affected} data terpengaruh.` : ""} ${data.detail ?? ""}`
          : `❌ **Gagal:** ${data.error ?? "Unknown error"}`,
        timestamp: new Date(),
      }]);
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : "Eksekusi gagal.";
      setChatMessages(prev => prev.map(m => m.id === msgId ? { ...m, actionStatus: "failed" } : m));
      setChatMessages(prev => [...prev, { id: nid(), role: "system", content: `❌ ${errMsg}`, timestamp: new Date() }]);
    }
  };

  const rejectAction = async (msgId: string) => {
    const msg = chatMessages.find(m => m.id === msgId);
    if (!msg?.actionData || !callerProfile) return;
    setChatMessages(prev => prev.map(m => m.id === msgId ? { ...m, actionStatus: "rejected" } : m));
    setChatMessages(prev => [...prev, {
      id: nid(), role: "system", content: "🚫 Aksi dibatalkan dan dicatat di audit log.", timestamp: new Date(),
    }]);
    await supabaseClient.functions.invoke("ai-agent", {
      body: { mode: "rejected", actionToExecute: { toolName: msg.actionData.toolName, args: msg.actionData.args }, callerProfile },
    }).catch(() => null);
  };

  const clearChat = () => { setChatMessages([]); setGeminiHistory([]); };

  const activeMenu = MENU_ITEMS.find(i => i.key === selectedTopic);

  // ══════════════════════════════════════════════════════════════════════
  // RENDER HELPERS
  // ══════════════════════════════════════════════════════════════════════
  const renderChatBubble = (msg: ChatMessage) => {
    const isUser = msg.role === "user";
    const isAI   = msg.role === "assistant";
    const isSys  = msg.role === "system";
    const isAct  = msg.role === "action";

    if (isSys) return (
      <motion.div key={msg.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25 }}
        style={{ display: "flex", justifyContent: "center", margin: "6px 0" }}>
        <div style={{
          background: T.systemBg, border: `1px solid ${T.borderGold}`, borderRadius: 20,
          padding: "6px 16px", fontSize: 12, color: T.textSub, maxWidth: 520, textAlign: "center",
        }}>
          <ReactMarkdown>{msg.content}</ReactMarkdown>
        </div>
      </motion.div>
    );

    if (isAct) {
      const st  = msg.actionStatus ?? "pending";
      const ad  = msg.actionData;
      const isPending   = st === "pending";
      const isExecuting = st === "executing";
      const isDone      = ["success","failed","rejected","approved"].includes(st);

      return (
        <motion.div key={msg.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, type: "spring", stiffness: 220, damping: 25 }}
          style={{ display: "flex", justifyContent: "flex-start", padding: "8px 0" }}>
          <div style={{ maxWidth: 540, width: "100%" }}>
            {ad?.aiPreMessage && (
              <div style={{
                background: T.aiBubbleBg, border: `1px solid ${T.aiBubbleBorder}`,
                borderRadius: "18px 18px 4px 18px", padding: "12px 16px",
                marginBottom: 8, fontSize: 14, color: T.text, lineHeight: 1.7,
              }}>
                <Text style={{ color: T.text, fontSize: 14 }}>{ad.aiPreMessage}</Text>
              </div>
            )}
            {/* Action card */}
            <div style={{
              background: T.actionBg,
              border: `1.5px solid ${isPending ? T.actionBorder : isDark ? "rgba(80,80,80,0.4)" : "rgba(180,180,180,0.4)"}`,
              borderRadius: 16, overflow: "hidden",
              boxShadow: isPending ? `0 0 24px ${GOLD_GLOW}, 0 4px 20px rgba(0,0,0,0.3)` : "0 2px 12px rgba(0,0,0,0.15)",
              transition: "all 0.3s ease",
            }}>
              {/* Card header */}
              <div style={{
                padding: "12px 16px 10px",
                background: isPending
                  ? `linear-gradient(135deg, ${isDark ? "rgba(212,160,48,0.12)" : "rgba(212,160,48,0.08)"} 0%, transparent 100%)`
                  : "transparent",
                borderBottom: `1px solid ${T.border}`,
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{ fontSize: 22 }}>{ACTION_ICON[ad?.toolName ?? ""] ?? "⚡"}</span>
                <div style={{ flex: 1 }}>
                  <Text style={{ color: GOLD, fontSize: 11, letterSpacing: "1.5px", fontWeight: 700, display: "block", fontFamily: "'JetBrains Mono', monospace" }}>
                    KONFIRMASI AKSI AI
                  </Text>
                  <Text style={{ color: T.text, fontSize: 13, fontWeight: 600 }}>
                    {ad?.toolName?.replace(/_/g, " ").toUpperCase()}
                  </Text>
                </div>
                {isPending && (
                  <Tag style={{ background: "rgba(245,200,66,0.15)", border: "1px solid rgba(245,200,66,0.4)", color: GOLD_BRIGHT, fontSize: 10 }}>
                    MENUNGGU
                  </Tag>
                )}
                {st === "success" && <Tag color="success">BERHASIL</Tag>}
                {st === "failed"  && <Tag color="error">GAGAL</Tag>}
                {st === "rejected"&& <Tag color="default">DIBATALKAN</Tag>}
                {isExecuting      && <Tag icon={<LoadingOutlined />} color="processing">MENGEKSEKUSI</Tag>}
              </div>

              {/* Action summary */}
              <div style={{ padding: "12px 16px", fontSize: 13, color: T.text, lineHeight: 1.75 }}>
                <div className="al-action-markdown">
                  <ReactMarkdown>{ad?.actionSummary ?? msg.content}</ReactMarkdown>
                </div>
              </div>

              {/* Buttons */}
              {isPending && (
                <div style={{ padding: "10px 16px 14px", display: "flex", gap: 10, borderTop: `1px solid ${T.border}` }}>
                  <Button
                    onClick={() => approveAction(msg.id)}
                    style={{
                      flex: 1, height: 40, borderRadius: 10, fontWeight: 700, fontSize: 13,
                      background: "linear-gradient(135deg,#2D8A2D,#1A5C1A)",
                      border: "none", color: "#fff", letterSpacing: "0.5px",
                      boxShadow: "0 4px 14px rgba(45,138,45,0.4)",
                    }}
                    icon={<CheckCircleFilled />}
                  >
                    Setujui &amp; Eksekusi
                  </Button>
                  <Button
                    onClick={() => rejectAction(msg.id)}
                    style={{
                      flex: 1, height: 40, borderRadius: 10, fontWeight: 700, fontSize: 13,
                      background: isDark ? "rgba(180,40,40,0.15)" : "rgba(255,240,240,0.9)",
                      border: "1px solid rgba(180,40,40,0.4)", color: "#E05050",
                    }}
                    icon={<CloseCircleFilled />}
                  >
                    Tolak
                  </Button>
                </div>
              )}

              {isExecuting && (
                <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, borderTop: `1px solid ${T.border}` }}>
                  <LoadingOutlined style={{ color: GOLD, fontSize: 16 }} />
                  <Text style={{ color: T.textSub, fontSize: 13 }}>Mengeksekusi ke database...</Text>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div key={msg.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, type: "spring", stiffness: 240, damping: 28 }}
        style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", padding: "4px 0", gap: 10, alignItems: "flex-end" }}>
        {isAI && (
          <Avatar size={30} style={{ background: `linear-gradient(135deg, ${GOLD} 0%, #7A5010 100%)`, flexShrink: 0, border: `1.5px solid ${T.borderGold}` }}
            icon={<RobotOutlined style={{ fontSize: 14 }} />} />
        )}
        <div style={{
          maxWidth: 480, borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          padding: "11px 15px",
          background: isUser ? T.userBubble : T.aiBubbleBg,
          border: isUser ? "none" : `1px solid ${T.aiBubbleBorder}`,
          boxShadow: isUser ? `0 4px 18px rgba(180,120,16,0.4)` : `0 2px 12px rgba(0,0,0,0.15)`,
          color: isUser ? "#FFF8E0" : T.text,
          fontSize: 14, lineHeight: 1.75,
        }}>
          {isAI ? (
            <div className="al-md-body"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
          ) : (
            <Text style={{ color: "#FFF8E0", fontSize: 14 }}>{msg.content}</Text>
          )}
          <div style={{ fontSize: 10, marginTop: 5, textAlign: isUser ? "right" : "left", opacity: 0.5 }}>
            {dayjs(msg.timestamp).format("HH:mm")}
          </div>
        </div>
        {isUser && (
          <Avatar size={30} style={{ background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)", flexShrink: 0, border: `1.5px solid ${T.border}` }}
            icon={<UserOutlined style={{ color: T.textSub, fontSize: 14 }} />} />
        )}
      </motion.div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════
  return (
    <>
      {/* ── GOOGLE FONTS ─────────────────────────────────────────────── */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />

      {/* ── FLOAT BUTTON ─────────────────────────────────────────────── */}
      <div className="al-float-wrap" onClick={() => setIsOpen(true)}>
        <div className="al-float-ring al-float-ring--1" />
        <div className="al-float-ring al-float-ring--2" />
        <div className="al-float-btn">
          <CrownOutlined style={{ fontSize: 22, color: "#FFF8E0" }} />
        </div>
        <span className="al-float-label">AI</span>
      </div>

      {/* ── MAIN MODAL ───────────────────────────────────────────────── */}
      <Modal
        open={isOpen}
        onCancel={() => { setIsOpen(false); skipToEnd(); }}
        footer={null}
        width={1220}
        centered
        destroyOnClose={false}
        styles={{
          body:    { height: "740px", padding: 0, overflow: "hidden" },
          mask:    { backdropFilter: "blur(12px)", background: "rgba(0,0,0,0.7)" },
          content: { padding: 0, borderRadius: 20, overflow: "hidden", border: `1px solid ${T.borderGold}`, boxShadow: `0 0 80px ${GOLD_GLOW}, 0 40px 80px rgba(0,0,0,0.8)` },
          header:  { display: "none" },
        }}
        closable={false}
      >
        <div style={{ display: "flex", flexDirection: "column", height: "100%", background: T.bg, position: "relative", overflow: "hidden" }}>

          {/* Islamic geometric pattern overlay */}
          <div className="al-geo-pattern" style={{ opacity: T.patternOpacity }} />

          {/* ══ HEADER ════════════════════════════════════════════════ */}
          <div style={{
            background: T.headerBg,
            borderBottom: `1px solid ${T.borderGold}`,
            padding: "0 28px",
            height: 70, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            position: "relative", zIndex: 2,
          }}>
            {/* Left: Logo + Title */}
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 46, height: 46, borderRadius: 12,
                background: `linear-gradient(135deg, ${GOLD} 0%, #7A5010 100%)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 0 18px ${GOLD_GLOW}, 0 4px 12px rgba(0,0,0,0.4)`,
                border: `1.5px solid rgba(255,220,100,0.4)`, flexShrink: 0,
              }}>
                <CrownOutlined style={{ fontSize: 20, color: "#FFF8E0" }} />
              </div>
              <div>
                <div style={{ fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: 15, color: isDark ? "#EDE6D0" : "#3A2A08", letterSpacing: "2px", lineHeight: 1 }}>
                  AL-HASANAH
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: T.textSub, letterSpacing: "2.5px", marginTop: 3 }}>
                  COMMAND CENTER · v3.0
                </div>
              </div>
              {/* Gold separator */}
              <div style={{ width: 1, height: 32, background: T.borderGold, margin: "0 8px" }} />
              {/* Live status */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div className="al-live-dot" />
                <Text style={{ color: T.textSub, fontSize: 11, letterSpacing: "1px" }}>LIVE</Text>
              </div>
            </div>

            {/* Center: Mode Toggle */}
            <div className="al-mode-toggle" style={{ borderColor: T.borderGold, background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)" }}>
              {(["analysis", "agent"] as AppMode[]).map(m => (
                <button
                  key={m}
                  className={`al-mode-btn ${mode === m ? "al-mode-btn--active" : ""}`}
                  onClick={() => setMode(m)}
                  style={{
                    color: mode === m ? (isDark ? "#FFF8E0" : "#3A2A08") : T.textSub,
                    background: mode === m ? `linear-gradient(135deg,${GOLD} 0%,#9A6A10 100%)` : "transparent",
                    boxShadow: mode === m ? `0 2px 12px ${GOLD_GLOW}` : "none",
                  }}
                >
                  {m === "analysis" ? <><RadarChartOutlined /> Analisis</> : <><RobotOutlined /> AI Agent</>}
                </button>
              ))}
            </div>

            {/* Right: Meta + Close */}
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ textAlign: "right" }}>
                <Text style={{ color: T.textSub, fontSize: 11, display: "block", letterSpacing: "0.5px" }}>
                  {dayjs().format("DD MMMM YYYY")}
                </Text>
                {identity && (
                  <Text style={{ color: T.textDim, fontSize: 10, display: "block" }}>
                    {identity.name} · {identity.role}
                  </Text>
                )}
              </div>
              <button
                className="al-close-btn"
                onClick={() => { setIsOpen(false); skipToEnd(); }}
                style={{ borderColor: T.border, color: T.textSub }}
              >
                <CloseOutlined style={{ fontSize: 14 }} />
              </button>
            </div>
          </div>

          {/* ══ BODY ══════════════════════════════════════════════════ */}
          <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative", zIndex: 1 }}>
            <AnimatePresence mode="wait">

              {/* ── ANALYSIS MODE ─────────────────────────────────── */}
              {mode === "analysis" && (
                <motion.div key="analysis" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}
                  style={{ display: "flex", width: "100%", height: "100%" }}>

                  {/* Sidebar */}
                  <div style={{
                    width: 270, flexShrink: 0, background: T.sidebarBg,
                    borderRight: `1px solid ${T.borderGold}`, padding: "22px 14px",
                    overflowY: "auto", display: "flex", flexDirection: "column", gap: 6,
                  }}>
                    <div style={{ fontFamily: "'Cinzel', serif", fontSize: 9, letterSpacing: "3px", color: T.textSub, marginBottom: 14, paddingLeft: 4, paddingBottom: 10, borderBottom: `1px solid ${T.border}` }}>
                      STRATEGIC PILLARS
                    </div>
                    {MENU_ITEMS.map((item, i) => {
                      const isActive = selectedTopic === item.key;
                      const cached   = item.key !== "BEBAS" && hasCached(item.key);
                      return (
                        <motion.div key={item.key} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                          onClick={() => consultGemini(item.key)}
                          style={{
                            padding: "12px 14px", borderRadius: 12, cursor: "pointer",
                            display: "flex", alignItems: "center", gap: 12,
                            background: isActive ? `${item.color}14` : "transparent",
                            border: `1px solid ${isActive ? `${item.color}50` : "transparent"}`,
                            transition: "all 0.2s ease",
                          }}
                          whileHover={{ x: 3, background: isActive ? undefined : (isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)") }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div style={{
                            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 15, color: item.color,
                            background: isActive ? `${item.color}1A` : (isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"),
                            boxShadow: isActive ? `0 0 12px ${item.color}40` : "none",
                            transition: "all 0.2s",
                          }}>
                            {item.icon}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: isActive ? (isDark ? "#EDE6D0" : "#1A1205") : T.textSub, lineHeight: 1.3 }}>
                              {item.label}
                            </div>
                            <div style={{ fontSize: 11, color: T.textDim, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", marginTop: 1 }}>
                              {item.arabic}
                            </div>
                          </div>
                          {cached && (
                            <Tooltip title="Cache aktif · 30 menit" placement="right">
                              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e", flexShrink: 0 }} />
                            </Tooltip>
                          )}
                        </motion.div>
                      );
                    })}

                    {/* Bottom stats */}
                    <div style={{ marginTop: "auto", paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
                      {[
                        { label: "Santri Aktif",  val: dataSantri?.total ?? "–" },
                        { label: "Sakit Minggu",  val: dataSakit?.total  ?? "–" },
                        { label: "Tagihan Bulan", val: dataTagihan?.total ?? "–" },
                      ].map(s => (
                        <div key={s.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 4px" }}>
                          <Text style={{ color: T.textSub, fontSize: 11 }}>{s.label}</Text>
                          <Text style={{ color: GOLD, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{String(s.val)}</Text>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Analysis Content */}
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: T.bg }}>
                    {!selectedTopic ? (
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: T.emptyGlow }}>
                        <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}>
                          <div style={{
                            width: 90, height: 90, borderRadius: 22,
                            background: `linear-gradient(135deg, ${GOLD} 0%, #7A5010 100%)`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            boxShadow: `0 0 40px ${GOLD_GLOW}, 0 12px 30px rgba(0,0,0,0.4)`,
                          }}>
                            <StarFilled style={{ fontSize: 36, color: "#FFF8E0" }} />
                          </div>
                        </motion.div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 18, color: isDark ? "#EDE6D0" : "#2A1A05", letterSpacing: "1px", fontWeight: 600 }}>
                            Siap Melayani
                          </div>
                          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 14, color: T.textSub, marginTop: 6 }}>
                            Pilih modul analisa untuk insight strategis real-time
                          </div>
                          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 13, color: T.textDim, marginTop: 4 }}>
                            اختر وحدة التحليل للحصول على رؤى استراتيجية
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
                          {MENU_ITEMS.slice(0, 3).map(item => (
                            <motion.button key={item.key} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                              onClick={() => consultGemini(item.key)}
                              style={{
                                padding: "8px 16px", borderRadius: 20, border: `1px solid ${item.color}50`,
                                background: `${item.color}0D`, color: item.color, fontSize: 12,
                                cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 6,
                              }}>
                              {item.icon} {item.label}
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Topic Header */}
                        <div style={{
                          padding: "18px 28px 14px",
                          borderBottom: `1px solid ${T.border}`,
                          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                          flexShrink: 0,
                        }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span style={{ fontSize: 18, color: activeMenu?.color }}>{activeMenu?.icon}</span>
                              <span style={{ fontFamily: "'Cinzel', serif", fontSize: 16, fontWeight: 600, color: isDark ? "#EDE6D0" : "#1A1205", letterSpacing: "0.5px" }}>
                                {activeMenu?.label}
                              </span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 12, color: T.textSub }}>
                                {activeMenu?.arabic}
                              </span>
                              {selectedTopic !== "BEBAS" && hasCached(selectedTopic) && (
                                <Tag icon={<ThunderboltOutlined />} style={{ fontSize: 10, letterSpacing: "0.5px", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e" }}>
                                  CACHED · {dayjs().format("HH:mm")}
                                </Tag>
                              )}
                            </div>
                          </div>
                          <Space>
                            {isTyping && (
                              <Button size="small" ghost onClick={skipToEnd}
                                style={{ color: GOLD, borderColor: `${GOLD}60`, fontSize: 11 }}>
                                Skip ▶▶
                              </Button>
                            )}
                            <Button ghost icon={<ReloadOutlined />}
                              onClick={() => { if (selectedTopic !== "BEBAS") burstCache(selectedTopic); consultGemini(selectedTopic as TopicKey); }}
                              disabled={loading || isTyping}
                              style={{ borderColor: T.border, color: T.textSub, fontSize: 12 }}>
                              Analisa Ulang
                            </Button>
                          </Space>
                        </div>

                        {/* Response Body */}
                        <div className="al-response-body" style={{ background: T.bg }}
                          onClick={() => isTyping && skipToEnd()}
                          title={isTyping ? "Klik untuk tampilkan semua" : undefined}>
                          {loading ? (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 20 }}>
                              <div style={{ position: "relative" }}>
                                <Spin indicator={<LoadingOutlined style={{ fontSize: 36, color: GOLD }} />} />
                                <div className="al-spin-ring" />
                              </div>
                              <div style={{ fontFamily: "'JetBrains Mono', monospace", color: GOLD, fontSize: 12, letterSpacing: "3px" }} className="al-pulse">
                                MENGANALISA DATA . . .
                              </div>
                            </div>
                          ) : (
                            <div className="al-md-response">
                              <ReactMarkdown>{displayed}</ReactMarkdown>
                              {isTyping && <span className="al-cursor">▌</span>}
                            </div>
                          )}
                          <div ref={analysisEndRef} />
                        </div>

                        {/* Free input (only for BEBAS) */}
                        {selectedTopic === "BEBAS" && (
                          <div style={{ padding: "12px 28px 18px", borderTop: `1px solid ${T.border}`, background: isDark ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.02)", flexShrink: 0 }}>
                            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                              <TextArea value={freeInput} onChange={e => setFreeInput(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendFree(); } }}
                                placeholder="Tanyakan apapun tentang pesantren… (Enter kirim · Shift+Enter baris baru)"
                                autoSize={{ minRows: 2, maxRows: 5 }} disabled={loading || isTyping}
                                style={{ background: T.inputBg, border: `1px solid ${T.inputBorder}`, color: T.text, borderRadius: 12, fontSize: 13, resize: "none" }}
                              />
                              <Button type="primary" icon={<SendOutlined />} onClick={handleSendFree}
                                disabled={loading || isTyping || !freeInput.trim()}
                                style={{ height: 52, width: 52, borderRadius: 12, background: `linear-gradient(135deg,${GOLD} 0%,#7A5010 100%)`, border: "none", flexShrink: 0 }} />
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ── AGENT MODE ────────────────────────────────────── */}
              {mode === "agent" && (
                <motion.div key="agent" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.25 }}
                  style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: T.chatBg }}>

                  {/* Agent header bar */}
                  <div style={{
                    padding: "12px 24px", flexShrink: 0,
                    borderBottom: `1px solid ${T.border}`,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: isDark ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.6)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 9,
                        background: `linear-gradient(135deg,${GOLD} 0%,#7A5010 100%)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: `0 0 14px ${GOLD_GLOW}`,
                      }}>
                        <RobotOutlined style={{ fontSize: 16, color: "#FFF8E0" }} />
                      </div>
                      <div>
                        <Text style={{ color: isDark ? "#EDE6D0" : "#1A1205", fontSize: 13, fontWeight: 700, fontFamily: "'Cinzel', serif", letterSpacing: "0.5px" }}>
                          Agentic AI
                        </Text>
                        <div style={{ fontSize: 10, color: T.textSub, letterSpacing: "1px" }}>
                          HUMAN-IN-THE-LOOP · MULTI-STEP EXECUTION
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {chatMessages.length > 0 && (
                        <Tooltip title="Bersihkan percakapan">
                          <Button size="small" icon={<ClearOutlined />} ghost onClick={clearChat}
                            style={{ borderColor: T.border, color: T.textSub, fontSize: 11 }} />
                        </Tooltip>
                      )}
                      <Tag style={{ background: `${GOLD}14`, border: `1px solid ${GOLD}40`, color: GOLD, fontSize: 10, letterSpacing: "0.5px" }}>
                        <ExclamationCircleFilled style={{ marginRight: 4 }} />
                        Semua aksi butuh konfirmasi
                      </Tag>
                    </div>
                  </div>

                  {/* Chat messages area */}
                  <div className="al-chat-area" style={{ background: T.chatBg }}>
                    {chatMessages.length === 0 && (
                      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                        style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 20, padding: 32 }}>
                        <div style={{
                          width: 72, height: 72, borderRadius: 18,
                          background: `linear-gradient(135deg,${GOLD} 0%,#7A5010 100%)`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          boxShadow: `0 0 32px ${GOLD_GLOW}, 0 8px 24px rgba(0,0,0,0.3)`,
                        }}>
                          <RobotOutlined style={{ fontSize: 30, color: "#FFF8E0" }} />
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 16, fontWeight: 600, color: isDark ? "#EDE6D0" : "#1A1205", letterSpacing: "1px" }}>
                            Agent Siap Bertugas
                          </div>
                          <div style={{ fontSize: 13, color: T.textSub, marginTop: 6, maxWidth: 400, lineHeight: 1.6 }}>
                            Instruksikan dalam bahasa natural. Agent akan query, analisa, dan eksekusi — selalu dengan konfirmasi Anda terlebih dahulu.
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 480 }}>
                          <Text style={{ color: T.textDim, fontSize: 11, letterSpacing: "1.5px", marginBottom: 4 }}>CONTOH PERINTAH</Text>
                          {QUICK_CMDS.map((cmd, i) => (
                            <motion.button key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.07 }}
                              onClick={() => sendAgentMessage(cmd.text)}
                              whileHover={{ scale: 1.02, x: 4 }} whileTap={{ scale: 0.98 }}
                              style={{
                                padding: "11px 16px", borderRadius: 12, cursor: "pointer", textAlign: "left",
                                background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                                border: `1px solid ${T.borderGold}`, color: T.text, fontSize: 13,
                                display: "flex", alignItems: "center", gap: 10, transition: "all 0.2s",
                              }}>
                              <span style={{ fontSize: 18 }}>{cmd.icon}</span>
                              <span style={{ lineHeight: 1.4 }}>{cmd.text}</span>
                            </motion.button>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* Messages */}
                    <AnimatePresence>
                      {chatMessages.map(msg => renderChatBubble(msg))}
                    </AnimatePresence>

                    {/* Typing indicator */}
                    {agentLoading && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
                        <Avatar size={30} style={{ background: `linear-gradient(135deg,${GOLD} 0%,#7A5010 100%)`, border: `1.5px solid ${T.borderGold}` }}
                          icon={<RobotOutlined style={{ fontSize: 14 }} />} />
                        <div style={{ background: T.aiBubbleBg, border: `1px solid ${T.aiBubbleBorder}`, borderRadius: "18px 18px 18px 4px", padding: "12px 18px" }}>
                          <div className="al-typing-dots">
                            <span /><span /><span />
                          </div>
                        </div>
                      </motion.div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Input Area */}
                  <div style={{
                    padding: "14px 24px 18px", flexShrink: 0,
                    borderTop: `1px solid ${T.borderGold}`,
                    background: isDark ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.7)",
                    backdropFilter: "blur(12px)",
                  }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                      <div style={{ flex: 1, position: "relative" }}>
                        <TextArea
                          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                          value={agentInput}
                          onChange={e => setAgentInput(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAgentMessage(); } }}
                          placeholder="Instruksikan AI Agent… (Enter kirim · Shift+Enter baris baru)"
                          autoSize={{ minRows: 2, maxRows: 6 }}
                          disabled={agentLoading}
                          style={{
                            background: T.inputBg, color: T.text, fontSize: 14,
                            border: `1px solid ${T.inputBorder}`, borderRadius: 14,
                            resize: "none", transition: "border-color 0.2s, box-shadow 0.2s",
                          }}
                        />
                      </div>
                      <Button type="primary" icon={<SendOutlined style={{ fontSize: 16 }} />}
                        onClick={() => sendAgentMessage()}
                        loading={agentLoading}
                        disabled={!agentInput.trim() || agentLoading}
                        style={{
                          height: 52, width: 52, borderRadius: 14, flexShrink: 0,
                          background: agentInput.trim() ? `linear-gradient(135deg,${GOLD} 0%,#7A5010 100%)` : "transparent",
                          border: agentInput.trim() ? "none" : `1px solid ${T.border}`,
                          boxShadow: agentInput.trim() ? `0 4px 16px ${GOLD_GLOW}` : "none",
                          transition: "all 0.25s ease",
                        }}
                      />
                    </div>
                    <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                      <InfoCircleOutlined style={{ color: T.textDim, fontSize: 11 }} />
                      <Text style={{ color: T.textDim, fontSize: 10, letterSpacing: "0.3px" }}>
                        Agent tidak dapat menghapus data · Semua aksi terlog di audit_logs · Selalu butuh konfirmasi Anda
                      </Text>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </Modal>

      {/* ══ STYLES ════════════════════════════════════════════════════════ */}
      <style>{`
        @keyframes al-pulse-ring {
          0%   { transform: scale(1);   opacity: 0.8; }
          100% { transform: scale(2.2); opacity: 0;   }
        }
        @keyframes al-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes al-pulse  { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes al-live   { 0%,100%{opacity:1; transform:scale(1)} 50%{opacity:0.5; transform:scale(0.8)} }
        @keyframes al-spin   { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes al-dot    { 0%,80%,100%{transform:scale(0);opacity:0.3} 40%{transform:scale(1);opacity:1} }

        /* Float Button */
        .al-float-wrap {
          position:fixed; right:24px; bottom:100px; z-index:9999;
          cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:4px;
          user-select:none;
        }
        .al-float-btn {
          width:58px; height:58px; border-radius:16px; position:relative; z-index:2;
          background:linear-gradient(135deg,${GOLD} 0%,#7A5010 100%);
          display:flex; align-items:center; justify-content:center;
          box-shadow:0 0 0 3px rgba(212,160,48,0.3), 0 8px 24px rgba(0,0,0,0.5);
          transition:transform 0.2s, box-shadow 0.2s;
        }
        .al-float-wrap:hover .al-float-btn {
          transform:scale(1.08);
          box-shadow:0 0 0 4px rgba(212,160,48,0.5), 0 12px 32px rgba(0,0,0,0.5);
        }
        .al-float-ring {
          position:absolute; border-radius:16px; border:2px solid ${GOLD};
          top:0; left:0; width:58px; height:58px; animation:al-pulse-ring 2.4s ease-out infinite;
        }
        .al-float-ring--2 { animation-delay:1.2s; }
        .al-float-label {
          font-family:'JetBrains Mono',monospace; font-size:9px; letter-spacing:2px;
          color:${GOLD}; font-weight:600;
        }

        /* Live dot */
        .al-live-dot {
          width:7px; height:7px; border-radius:50%; background:#22c55e;
          box-shadow:0 0 6px #22c55e; animation:al-live 2s ease-in-out infinite;
        }

        /* Mode toggle */
        .al-mode-toggle {
          display:flex; border-radius:12px; padding:4px;
          border:1px solid; overflow:hidden;
        }
        .al-mode-btn {
          display:flex; align-items:center; gap:7px; padding:7px 18px;
          border:none; cursor:pointer; border-radius:9px; font-size:12px;
          font-family:'JetBrains Mono',monospace; font-weight:600; letter-spacing:"0.5px";
          transition:all 0.22s ease; white-space:nowrap;
        }
        .al-mode-btn--active { box-shadow:0 2px 12px rgba(212,160,48,0.4); }

        /* Close button */
        .al-close-btn {
          width:34px; height:34px; border-radius:9px; display:flex;
          align-items:center; justify-content:center;
          background:transparent; border:1px solid; cursor:pointer;
          transition:all 0.2s;
        }
        .al-close-btn:hover { opacity:0.7; }

        /* Geo pattern */
        .al-geo-pattern {
          position:absolute; inset:0; pointer-events:none; z-index:0;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cpath fill='none' stroke='%23D4A030' stroke-width='0.5' d='M40 0 L80 40 L40 80 L0 40 Z M40 10 L70 40 L40 70 L10 40 Z M40 20 L60 40 L40 60 L20 40 Z M0 0 L20 0 L0 20 Z M80 0 L80 20 L60 0 Z M0 80 L0 60 L20 80 Z M80 80 L60 80 L80 60 Z'/%3E%3C/svg%3E");
          background-repeat:repeat;
        }

        /* Scrollbars */
        .al-response-body::-webkit-scrollbar,
        .al-chat-area::-webkit-scrollbar { width:3px; }
        .al-response-body::-webkit-scrollbar-thumb,
        .al-chat-area::-webkit-scrollbar-thumb { background:rgba(212,160,48,0.2); border-radius:3px; }
        .al-response-body::-webkit-scrollbar-track,
        .al-chat-area::-webkit-scrollbar-track { background:transparent; }

        /* Response body */
        .al-response-body {
          flex:1; overflow-y:auto; padding:28px 32px; cursor:default;
        }

        /* Chat area */
        .al-chat-area {
          flex:1; overflow-y:auto; padding:20px 24px; display:flex; flex-direction:column; gap:6px;
        }

        /* Markdown - analysis */
        .al-md-response { font-size:14.5px; line-height:1.95; }
        .al-md-response h1,.al-md-response h2 { font-family:'Cinzel',serif; letter-spacing:0.5px; margin-top:22px; }
        .al-md-response h3 { border-left:3px solid ${GOLD}; padding-left:10px; margin-top:18px; font-size:15px; }
        .al-md-response strong { color:${GOLD}; }
        .al-md-response ul { padding-left:22px; }
        .al-md-response li { margin-bottom:6px; }
        .al-md-response p  { margin-bottom:12px; }
        .al-md-response blockquote { border-left:3px solid ${GOLD}; padding-left:14px; font-style:italic; margin-left:0; }
        .al-md-response code { font-family:'JetBrains Mono',monospace; font-size:12px; padding:2px 6px; border-radius:4px; background:rgba(212,160,48,0.1); }

        /* Markdown - chat bubbles & action cards */
        .al-md-body p,.al-action-markdown p { margin:0 0 6px; line-height:1.7; }
        .al-md-body p:last-child,.al-action-markdown p:last-child { margin-bottom:0; }
        .al-action-markdown strong { color:${GOLD}; font-weight:700; }
        .al-action-markdown code { font-family:'JetBrains Mono',monospace; font-size:11.5px; padding:1px 5px; border-radius:3px; background:rgba(212,160,48,0.12); color:${GOLD_BRIGHT}; }
        .al-action-markdown ul,.al-action-markdown ol { padding-left:18px; margin:4px 0; }
        .al-action-markdown li { margin-bottom:4px; font-size:13px; }

        /* Cursor */
        .al-cursor { color:${GOLD}; font-weight:700; animation:al-blink 1s step-end infinite; }

        /* Pulse */
        .al-pulse { animation:al-pulse 1.8s ease-in-out infinite; }

        /* Spin ring */
        .al-spin-ring {
          position:absolute; inset:-10px; border-radius:50%;
          border:1px solid rgba(212,160,48,0.2); border-top-color:${GOLD};
          animation:al-spin 1.5s linear infinite;
        }

        /* Typing dots */
        .al-typing-dots { display:flex; gap:4px; align-items:center; height:16px; }
        .al-typing-dots span {
          width:7px; height:7px; border-radius:50%; background:${GOLD};
          display:inline-block; animation:al-dot 1.4s ease-in-out infinite;
        }
        .al-typing-dots span:nth-child(2) { animation-delay:0.2s; }
        .al-typing-dots span:nth-child(3) { animation-delay:0.4s; }

        /* Antd textarea override */
        .ant-input:focus,.ant-input-affix-wrapper:focus,.ant-input-focused {
          border-color:${GOLD} !important;
          box-shadow:0 0 0 2px rgba(212,160,48,0.2) !important;
        }
      `}</style>
    </>
  );
};

// ══════════════════════════════════════════════════════════════════════════
// AUXILIARY EXPORTS (from original file, preserved)
// ══════════════════════════════════════════════════════════════════════════
export const DiklatList = () => (
  <div><h2>Daftar Diklat</h2><ul><li>Daftar Diklat</li></ul></div>
);
export const MasterDataPage = () => (
  <div><h2>Data Master</h2><ul><li>Data Master</li></ul></div>
);
export const DiklatRoutes = () => (
  <Routes>
    <Route path="/diklat"        element={<DiklatList />} />
    <Route path="/diklat/master" element={<MasterDataPage />} />
  </Routes>
);
