/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  SISTEM SCANNER TERPADU — PREMIUM EDITION                              ║
 * ║  Islamic Luxury Tech × Cyberpunk Fusion                                ║
 * ║                                                                         ║
 * ║  New Features v2:                                                       ║
 * ║  · Web Audio API — synthetic beep/buzz feedback                        ║
 * ║  · Vibration API — haptic on mobile                                    ║
 * ║  · Scan History Panel — last 10 scans, re-viewable                     ║
 * ║  · Manual NIS input fallback                                            ║
 * ║  · Session stats counter (success / fail)                              ║
 * ║  · Anti double-scan debounce (2s)                                      ║
 * ║  · Fullscreen scanner mode                                              ║
 * ║  · Gold animated corner brackets (contract on success)                 ║
 * ║  · Premium result cards — photo ring, SPP timeline                     ║
 * ║  · Full dark/light mode (no hardcoded colors)                          ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Typography, Avatar, Spin, Button, 
  Input, message, Modal,
} from "antd";
import {
  ScanOutlined, UserOutlined, WalletOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined,
  IdcardOutlined, BookOutlined, 
  SafetyCertificateOutlined, CalendarOutlined,
  DollarCircleOutlined, 
  ClockCircleOutlined, HistoryOutlined,
  FullscreenOutlined, FullscreenExitOutlined, KeyOutlined,
  
  CopyOutlined, CheckOutlined,
} from "@ant-design/icons";
import { Scanner } from "@yudiel/react-qr-scanner";
import { supabaseClient } from "../../utility/supabaseClient";
import { santriAlias } from "../../utility/privacy";
import { ISantri, IPesertaDiklat } from "../../types";
import { useColorMode } from "../../contexts/color-mode";
import { motion, AnimatePresence } from "framer-motion";
import dayjs from "dayjs";

const { Title, Text } = Typography;

// ── DESIGN TOKENS ─────────────────────────────────────────────────────────
const GOLD        = "#C9A84C";
const GOLD_LIGHT  = "#E8C96A";
const GOLD_BRIGHT = "#FFD166";
const GOLD_DEEP   = "#A07830";
const CYAN        = "#00FFD1";
const CYAN_DIM    = "#00B89C";

const darkT = {
  bg: "#08070D", surface: "#0F0F1A", card: "#141424", cardHover: "#1A1A2E",
  border: "rgba(201,168,76,0.14)", borderAccent: "rgba(201,168,76,0.40)",
  accent: GOLD_BRIGHT,
  text: "#F0EDE5", textSub: "#9E9080", textMuted: "#5C5248",
  divider: "rgba(255,255,255,0.06)",
};
const lightT = {
  bg: "#F7F4EE", surface: "#FFFFFF", card: "#FFFFFF", cardHover: "#FFFDF5",
  border: "rgba(0,0,0,0.08)", borderAccent: "rgba(201,168,76,0.45)",
  accent: GOLD_DEEP,
  text: "#0A0805", textSub: "#6B5F50", textMuted: "#9E9080",
  divider: "rgba(0,0,0,0.06)",
};

// ── HELPERS ───────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("id-ID", { style:"currency", currency:"IDR", maximumFractionDigits:0 }).format(n);

/** Web Audio API — synthetic beep */
const playBeep = (type: "success" | "error") => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    if (type === "success") {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.22);
    } else {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.35);
    }
  } catch {
    // Silently fail if Web Audio API is not available
  }
};

/** Vibration API */
const vibrate = (pattern: number | number[]) => {
  try { navigator.vibrate?.(pattern); } catch {
    // Silently fail if Vibration API is not available
  }
};

/** Copy to clipboard */
const copyText = async (text: string) => {
  try { await navigator.clipboard.writeText(text); message.success("Disalin!"); } catch {
    // Silently fail if clipboard write is not available
  }
};

// ── TYPES ─────────────────────────────────────────────────────────────────
type ScanMode = "santri" | "diklat" | "tagihan";
type ScanState = "idle" | "scanning" | "loading" | "success" | "error";
interface HistoryEntry {
  id: string;
  rawValue: string;
  mode: ScanMode;
  name: string;
  timestamp: Date;
  success: boolean;
  data?: ISantri | IPesertaDiklat | any | null;
  tagihan?: any[];
}

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────
export const ScanQR: React.FC = () => {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkT : lightT;
  const isDark = mode === "dark";

  // ── STATE ────────────────────────────────────────────────────────────
  const [scanMode,    setScanMode]    = useState<ScanMode>("santri");
  const [viewTab,     setViewTab]     = useState<"info" | "spp">("info");
  const [scanState,   setScanState]   = useState<ScanState>("idle");
  const [santriData,  setSantriData]  = useState<ISantri | null>(null);
  const [diklatData,  setDiklatData]  = useState<IPesertaDiklat | null>(null);
  const [invoiceData, setInvoiceData] = useState<any | null>(null);
  const [tagihanData, setTagihanData] = useState<any[]>([]);
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);
  const [history,     setHistory]     = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showManual,  setShowManual]  = useState(false);
  const [manualNIS,   setManualNIS]   = useState("");
  const [sessionOK,   setSessionOK]   = useState(0);
  const [sessionFail, setSessionFail] = useState(0);
  const [copiedField, setCopiedField] = useState<string | null>(null);
//error 1 pada bagian ini tepat pada bagian useRef
  const lastScannedRef  = useRef<string>("");
  const debounceRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scannerWrapRef  = useRef<HTMLDivElement>(null);

  // ── AUDIO FEEDBACK ───────────────────────────────────────────────────
  const feedback = (type: "success" | "error") => {
    playBeep(type);
    vibrate(type === "success" ? [80, 40, 80] : [200, 100, 200, 100, 200]);
  };

  // ── COPY HELPER ──────────────────────────────────────────────────────
  const handleCopy = (key: string, val: string) => {
    copyText(val);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // ── FETCH SANTRI ─────────────────────────────────────────────────────
  const fetchSantri = useCallback(async (nis: string) => {
    setScanState("loading");
    setErrorMsg(null);
    setSantriData(null); setDiklatData(null); setInvoiceData(null); setTagihanData([]);

    try {
      const [{ data: santri, error: e1 }, { data: tagihan }] = await Promise.all([
        supabaseClient.rpc("get_santri_detail_secure", {
          p_nis: nis,
          p_audit_reason: "Admin QR scan detail santri",
        }).single(),
        supabaseClient.from("tagihan_santri").select("*")
          .eq("santri_nis", nis).order("tanggal_jatuh_tempo", { ascending:false }).limit(5),
      ]);
      if (e1 || !santri) throw new Error(`NIS ${nis} tidak ditemukan dalam database.`);
      const santriRecord = santri as ISantri;

      setSantriData(santriRecord);
      setTagihanData(tagihan || []);
      setScanState("success");
      feedback("success");
      setSessionOK(n => n + 1);

      // Add to history
      const entry: HistoryEntry = {
        id: Date.now().toString(),
        rawValue: nis,
        mode: "santri" as ScanMode,
        name: santriRecord.nama || santriAlias(santriRecord.nis),
        timestamp: new Date(),
        success: true,
        data: santriRecord,
        tagihan: tagihan || [],
      };
      setHistory(h => [entry, ...h].slice(0, 10));
    } catch (err: any) {
      setErrorMsg(err.message);
      setScanState("error");
      feedback("error");
      setSessionFail(n => n + 1);
      setHistory(h => [{
        id: Date.now().toString(), rawValue: nis, mode: "santri" as ScanMode,
        name: `NIS: ${nis}`, timestamp: new Date(), success: false,
      }, ...h].slice(0, 10));
    }
  }, []);

  // ── FETCH DIKLAT ─────────────────────────────────────────────────────
  const fetchDiklat = useCallback(async (qrId: string) => {
    setScanState("loading");
    setErrorMsg(null);
    setSantriData(null); setDiklatData(null); setInvoiceData(null); setTagihanData([]);

    try {
      const { data, error } = await supabaseClient
        .from("peserta_diklat").select("*").eq("qr_code_id", qrId).single();
      if (error || !data) throw new Error("Data peserta diklat tidak ditemukan.");

      setDiklatData(data as IPesertaDiklat);
      setScanState("success");
      feedback("success");
      setSessionOK(n => n + 1);

      setHistory(h => [{
        id: Date.now().toString(), rawValue: qrId, mode: "diklat" as ScanMode,
        name: data.nama_lengkap, timestamp: new Date(), success: true,
        data: data as IPesertaDiklat,
      }, ...h].slice(0, 10));
    } catch (err: any) {
      setErrorMsg(err.message);
      setScanState("error");
      feedback("error");
      setSessionFail(n => n + 1);
    }
  }, []);

  // ── FETCH TAGIHAN ────────────────────────────────────────────────────
  const fetchTagihan = useCallback(async (id: string) => {
    setScanState("loading");
    setErrorMsg(null);
    setSantriData(null); setDiklatData(null); setInvoiceData(null); setTagihanData([]);

    try {
      const { data, error } = await supabaseClient
        .from("tagihan_santri")
        .select("*, santri(nama, nis, kelas, jurusan, foto_url)")
        .eq("id", id)
        .single();
      
      if (error || !data) throw new Error("Tagihan / Invoice tidak ditemukan.");

      setInvoiceData(data);
      setScanState("success");
      feedback("success");
      setSessionOK(n => n + 1);

      setHistory(h => [{
        id: Date.now().toString(), rawValue: id, mode: "tagihan" as ScanMode,
        name: `#INV-${id.substring(0,8).toUpperCase()} (${data.santri?.nama || santriAlias(data.santri?.nis) || "Unknown"})`,
        timestamp: new Date(), success: true,
        data: data,
      }, ...h].slice(0, 10));
    } catch (err: any) {
      setErrorMsg(err.message);
      setScanState("error");
      feedback("error");
      setSessionFail(n => n + 1);
    }
  }, []);

  // ── DECODE HANDLER ───────────────────────────────────────────────────
  const handleDecode = useCallback((raw: string) => {
    if (!raw?.trim()) return;
    const text = raw.trim();

    // Anti double-scan
    if (text === lastScannedRef.current) return;
    lastScannedRef.current = text;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { lastScannedRef.current = ""; }, 2500);

    const upper = text.toUpperCase();

    // 1. Explicit Detection via Prefixes (High Priority)
    
    // Check for INVOICE prefix
    if (upper.startsWith("INV:")) {
      const invId = text.slice(4).trim();
      setScanMode("tagihan");
      fetchTagihan(invId);
      return;
    }

    // Check for DIKLAT prefixes
    if (upper.startsWith("DIKLAT:") || upper.startsWith("VERIFIED_DIKLAT_")) {
      const qrId = upper.startsWith("DIKLAT:") 
        ? text.slice(7).trim() 
        : text.slice(16).trim();
      
      setScanMode("diklat");
      fetchDiklat(qrId);
      return;
    }

    // Check for SANTRI prefixes
    if (upper.startsWith("SANTRI:") || upper.startsWith("VALIDASI:")) {
      let nis = "";
      if (upper.startsWith("SANTRI:")) {
        nis = text.slice(7).trim();
      } else {
        // Handle format VALIDASI:NIS:NAMA or VALIDASI:NIS
        const parts = text.split(":");
        // parts[0] is "VALIDASI", parts[1] is NIS
        nis = parts[1]?.trim() || "";
      }
      
      if (nis) {
        setScanMode("santri");
        fetchSantri(nis);
      } else {
        setErrorMsg("Format QR Santri tidak valid.");
        setScanState("error");
      }
      return;
    }

    // 2. Fallback to current mode if no prefix found
    if (scanMode === "diklat") {
      fetchDiklat(text);
    } else if (scanMode === "tagihan") {
      fetchTagihan(text);
    } else {
      fetchSantri(text);
    }
  }, [scanMode, fetchSantri, fetchDiklat, fetchTagihan]);

  const handleReset = () => {
    setScanState("idle");
    setSantriData(null); setDiklatData(null); setInvoiceData(null);
    setTagihanData([]); setErrorMsg(null);
    lastScannedRef.current = "";
    setManualNIS("");
    setShowManual(false);
  };

  const handleManualSubmit = () => {
    if (!manualNIS.trim()) return;
    setShowManual(false);
    handleDecode(manualNIS.trim());
  };

  const restoreFromHistory = (entry: HistoryEntry) => {
    setShowHistory(false);
    if (!entry.success || !entry.data) return;
    if (entry.mode === "santri") {
      setSantriData(entry.data as ISantri);
      setTagihanData(entry.tagihan || []);
      setDiklatData(null); setInvoiceData(null);
      setScanMode("santri");
    } else if (entry.mode === "diklat") {
      setDiklatData(entry.data as IPesertaDiklat);
      setSantriData(null); setInvoiceData(null);
      setScanMode("diklat");
    } else {
      setInvoiceData(entry.data);
      setSantriData(null); setDiklatData(null);
      setScanMode("tagihan");
    }
    setScanState("success");
    setErrorMsg(null);
  };

  // Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement && scannerWrapRef.current) {
      scannerWrapRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const isScanning = scanState === "idle" || scanState === "scanning";

  // ── CSS ───────────────────────────────────────────────────────────────
  const css = `
@keyframes laserSweep {
  0%   { top:0%;    opacity:0; }
  8%   { opacity:1; }
  92%  { opacity:1; }
  100% { top:100%;  opacity:0; }
}
@keyframes cornerPulse {
  0%,100% { opacity:1; }
  50%      { opacity:0.55; }
}
@keyframes goldRing {
  0%   { transform:scale(0.92); opacity:0.6; }
  50%  { transform:scale(1.05); opacity:1;   }
  100% { transform:scale(0.92); opacity:0.6; }
}
@keyframes scanGrid {
  from { background-position: 0 0; }
  to   { background-position: 0 40px; }
}
@keyframes glitch {
  0%,95%,100% { clip-path:none; transform:none; }
  96%  { clip-path:polygon(0 30%,100% 30%,100% 50%,0 50%); transform:translate(-2px,0); }
  97%  { clip-path:polygon(0 60%,100% 60%,100% 80%,0 80%); transform:translate(2px,0);  }
  98%  { clip-path:none; transform:none; }
}
@keyframes fadeDot {
  0%,100% { opacity:1; } 50% { opacity:0.2; }
}
@keyframes successBurst {
  0%   { transform:scale(0.7); opacity:1; }
  60%  { transform:scale(1.15); opacity:1; }
  100% { transform:scale(1); opacity:1; }
}

/* SCANNER CONTAINER */
.sqr-wrap {
  position:relative;
  border-radius:20px;
  overflow:hidden;
  background:#000;
  aspect-ratio:1;
  box-shadow: 0 0 0 1px rgba(201,168,76,0.18), 0 24px 60px rgba(0,0,0,0.7);
}

/* Cyberpunk grid overlay */
.sqr-grid {
  position:absolute; inset:0; pointer-events:none; z-index:2;
  background-image:
    linear-gradient(rgba(201,168,76,0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(201,168,76,0.05) 1px, transparent 1px);
  background-size: 40px 40px;
  animation: scanGrid 3s linear infinite;
}

/* Laser sweep */
.sqr-laser {
  position:absolute; left:0; right:0; height:2px; z-index:5;
  background: linear-gradient(90deg, transparent, ${CYAN}, ${CYAN_DIM}, ${CYAN}, transparent);
  box-shadow: 0 0 8px ${CYAN}, 0 0 20px ${CYAN}90, 0 0 40px ${CYAN}50;
  animation: laserSweep 2.4s ease-in-out infinite;
}

/* Corner brackets */
.sqr-corner {
  position:absolute; width:36px; height:36px;
  border-style:solid; border-color:${GOLD_BRIGHT};
  transition: all 0.35s cubic-bezier(0.22,1,0.36,1);
  animation: cornerPulse 2.5s ease-in-out infinite;
}
.sqr-corner.success {
  border-color: ${CYAN};
  width:22px; height:22px;
  box-shadow: 0 0 14px ${CYAN}80;
  animation: none;
}
.sqr-tl { top:14px; left:14px; border-width:3px 0 0 3px; border-radius:6px 0 0 0; }
.sqr-tr { top:14px; right:14px; border-width:3px 3px 0 0; border-radius:0 6px 0 0; }
.sqr-bl { bottom:14px; left:14px; border-width:0 0 3px 3px; border-radius:0 0 0 6px; }
.sqr-br { bottom:14px; right:14px; border-width:0 3px 3px 0; border-radius:0 0 6px 0; }

/* Center crosshair */
.sqr-cross {
  position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
  width:18px; height:18px; z-index:4; pointer-events:none;
}
.sqr-cross::before,.sqr-cross::after {
  content:''; position:absolute; background:${GOLD_BRIGHT}80; border-radius:2px;
}
.sqr-cross::before { width:1px; height:100%; left:50%; transform:translateX(-50%); }
.sqr-cross::after  { width:100%; height:1px; top:50%; transform:translateY(-50%); }

/* Scanner lib override */
.sqr-wrap video, .sqr-wrap svg { width:100%!important; height:100%!important; object-fit:cover!important; }

/* Status bar at bottom of scanner */
.sqr-statusbar {
  position:absolute; bottom:0; left:0; right:0; z-index:6;
  background:linear-gradient(to top, rgba(0,0,0,0.82), transparent);
  padding:20px 16px 14px;
  display:flex; align-items:center; justify-content:space-between;
}

/* Result avatar ring */
.sqr-avatar-ring {
  padding:4px;
  background:conic-gradient(from 0deg, ${GOLD}, ${GOLD_BRIGHT}, ${GOLD_LIGHT}, ${GOLD});
  border-radius:50%;
  animation:goldRing 2.8s ease-in-out infinite;
}

/* Glitch heading */
.sqr-glitch { animation:glitch 8s infinite; }

/* Scanning dots */
.sqr-dot1,.sqr-dot2,.sqr-dot3 { display:inline-block; animation:fadeDot 1.2s infinite; }
.sqr-dot2 { animation-delay:.3s; }
.sqr-dot3 { animation-delay:.6s; }

/* SPP timeline */
.sqr-spp-item { transition:background 0.15s, border-color 0.15s; }
.sqr-spp-item:hover { border-color:${GOLD}45!important; }

/* Scrollbar */
.sqr-scroll::-webkit-scrollbar { width:3px; }
.sqr-scroll::-webkit-scrollbar-thumb { background:rgba(201,168,76,0.28); border-radius:4px; }

/* Info row */
.sqr-info-row { transition:background 0.12s; border-radius:10px; }
.sqr-info-row:hover { background:${isDark?"rgba(201,168,76,0.06)":"rgba(201,168,76,0.05)"}; }
`;

  // ── SECTION BUILDERS ─────────────────────────────────────────────────

  /* Mode pill */
  const ModePill = ({ value, label, icon, active, color }: {
    value: ScanMode; label: string; icon: React.ReactNode; active: boolean; color: string;
  }) => (
    <button
      onClick={() => { setScanMode(value); handleReset(); }}
      style={{
        flex:1, height:42, cursor:"pointer",
        borderRadius:11,
        background: active
          ? `linear-gradient(135deg, ${color}22, ${color}14)`
          : "transparent",
        border: active ? `1.5px solid ${color}45` : `1.5px solid transparent`,
        color: active ? color : t.textMuted,
        fontWeight:700, fontSize:12, letterSpacing:"0.4px",
        display:"flex", alignItems:"center", justifyContent:"center", gap:7,
        transition:"all 0.2s", boxShadow: active ? `0 0 16px ${color}20` : "none",
      }}
    >
      <span style={{fontSize:15}}>{icon}</span>
      {label}
    </button>
  );

  /* Info row */
  const InfoRow = ({ label, value, copyKey }: { label:string; value?:string|null; copyKey?:string }) => {
    if (!value) return null;
    return (
      <div className="sqr-info-row" style={{
        display:"flex", alignItems:"flex-start", gap:10, padding:"9px 10px",
        marginBottom:2,
      }}>
        <div style={{
          fontSize:10, fontWeight:800, letterSpacing:"0.7px", textTransform:"uppercase",
          color:t.textMuted, minWidth:110, flexShrink:0, paddingTop:1,
        }}>{label}</div>
        <div style={{ flex:1, fontSize:13, color:t.text, fontWeight:500, lineHeight:1.45 }}>
          {value}
        </div>
        {copyKey && (
          <button onClick={() => handleCopy(copyKey, value)} style={{
            border:"none", background:"transparent", cursor:"pointer",
            color: copiedField===copyKey ? "#34D399" : t.textMuted,
            padding:4, borderRadius:6, transition:"color .15s", flexShrink:0,
          }}>
            {copiedField===copyKey ? <CheckOutlined style={{fontSize:11}}/> : <CopyOutlined style={{fontSize:11}}/>}
          </button>
        )}
      </div>
    );
  };

  /* SPP Timeline item */
  const SppItem = ({ tagihan }: { tagihan: any }) => {
    const isLunas   = tagihan.status === "LUNAS";
    const isCicilan = tagihan.status === "CICILAN";
    const color     = isLunas ? "#34D399" : isCicilan ? GOLD_BRIGHT : "#F87171";
    return (
      <div className="sqr-spp-item" style={{
        background: isDark
          ? `${color}0C`
          : `${color}08`,
        border:`1px solid ${color}28`,
        borderRadius:12, padding:"12px 16px", marginBottom:10,
        display:"flex", alignItems:"center", justifyContent:"space-between", gap:12,
      }}>
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontWeight:700, fontSize:13, color:t.text, marginBottom:4}}>
            {tagihan.deskripsi_tagihan || "Tagihan SPP"}
          </div>
          <div style={{fontSize:11, color:t.textMuted}}>
            Jatuh tempo: {tagihan.tanggal_jatuh_tempo
              ? dayjs(tagihan.tanggal_jatuh_tempo).format("DD MMM YYYY")
              : "-"}
          </div>
        </div>
        <div style={{textAlign:"right", flexShrink:0}}>
          <div style={{fontFamily:"monospace", fontWeight:800, fontSize:14, color, marginBottom:4}}>
            {fmt(tagihan.nominal_tagihan || 0)}
          </div>
          <span style={{
            display:"inline-flex", alignItems:"center", gap:4,
            fontSize:10, fontWeight:800, letterSpacing:"0.8px",
            padding:"3px 9px", borderRadius:20,
            background:`${color}18`, color, border:`1px solid ${color}35`,
          }}>
            {isLunas ? <CheckCircleOutlined/> : isCicilan ? <ClockCircleOutlined/> : <CloseCircleOutlined/>}
            {isLunas ? "LUNAS" : isCicilan ? `Sisa ${fmt(tagihan.sisa_tagihan||0)}` : "BELUM"}
          </span>
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════
  return (
    <div style={{ background:t.bg, minHeight:"100vh", paddingBottom:80 }}>
      <style>{css}</style>

      {/* ── HERO HEADER ─────────────────────────────────────────── */}
      <div style={{
        background: isDark
          ? "linear-gradient(135deg, #0C0A04 0%, #14120A 50%, #060A08 100%)"
          : "linear-gradient(135deg, #1C1610 0%, #2A2015 50%, #161008 100%)",
        borderRadius:24, padding:"28px 32px", marginBottom:24, position:"relative",
        overflow:"hidden", border:`1px solid ${GOLD}16`,
        boxShadow: isDark
          ? `0 24px 60px rgba(0,0,0,0.65), inset 0 1px 0 ${GOLD}12`
          : "0 8px 32px rgba(0,0,0,0.2)",
      }}>
        {/* Gold top line */}
        <div style={{position:"absolute",top:0,left:0,right:0,height:2,
          background:`linear-gradient(90deg,transparent,${GOLD_BRIGHT},${GOLD},transparent)`,opacity:.85}}/>
        {/* Cyber grid bg */}
        <div style={{position:"absolute",inset:0,
          backgroundImage:`linear-gradient(rgba(201,168,76,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(201,168,76,0.04) 1px,transparent 1px)`,
          backgroundSize:"48px 48px",pointerEvents:"none"}}/>
        {/* Glow */}
        <div style={{position:"absolute",top:-60,left:"50%",transform:"translateX(-50%)",
          width:400,height:200,
          background:`radial-gradient(ellipse,${CYAN}10 0%,transparent 70%)`,pointerEvents:"none"}}/>

        <div style={{position:"relative",display:"flex",alignItems:"center",
          justifyContent:"space-between",flexWrap:"wrap",gap:16}}>
          {/* Title */}
          <div>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"4px",textTransform:"uppercase",
              color:GOLD, marginBottom:6}}>
              ◆ SISTEM IDENTIFIKASI TERPADU ◆
            </div>
            <h1 className="sqr-glitch" style={{
              margin:0, fontFamily:"monospace",
              fontSize:"clamp(18px,2.5vw,26px)", fontWeight:800,
              color:"#F5EDD8", letterSpacing:"2px", lineHeight:1.2,
            }}>
              QR SCANNER PANEL
            </h1>
            <p style={{margin:"6px 0 0",color:"rgba(245,237,216,0.45)",fontSize:12,fontFamily:"monospace",letterSpacing:"1px"}}>
              SANTRI · DIKLAT · VERIFIKASI INSTAN
            </p>
          </div>

          {/* Session Stats */}
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            {[
              {label:"BERHASIL", val:sessionOK,   color:"#34D399"},
              {label:"GAGAL",    val:sessionFail, color:"#F87171"},
              {label:"TOTAL",    val:sessionOK+sessionFail, color:GOLD_BRIGHT},
            ].map(stat=>(
              <div key={stat.label} style={{
                background:`${stat.color}12`,border:`1px solid ${stat.color}28`,
                borderRadius:12,padding:"8px 14px",textAlign:"center",minWidth:72,
              }}>
                <div style={{fontSize:18,fontWeight:800,color:stat.color,lineHeight:1,fontFamily:"monospace"}}>{stat.val}</div>
                <div style={{fontSize:9,fontWeight:700,letterSpacing:"1px",color:"rgba(245,237,216,0.45)",marginTop:3}}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── MAIN LAYOUT ─────────────────────────────────────────── */}
      <div style={{
        display:"grid",
        gridTemplateColumns:"clamp(280px,35%,420px) 1fr",
        gap:20,
        alignItems:"start",
      }}>
        {/* ────────────────────────────────────────────────────────
            LEFT: SCANNER PANEL
        ──────────────────────────────────────────────────────── */}
        <div>
          {/* Mode switcher */}
          <div style={{
            background:t.card, border:`1px solid ${t.border}`,
            borderRadius:14, padding:8, marginBottom:14,
            display:"flex", gap:6,
          }}>
            <ModePill value="santri" label="DATA SANTRI" icon={<UserOutlined/>}   active={scanMode==="santri"} color={GOLD_BRIGHT}/>
            <ModePill value="diklat" label="DIKLAT / PASARAN" icon={<SafetyCertificateOutlined/>} active={scanMode==="diklat"} color={CYAN}/>
            <ModePill value="tagihan" label="TAGIHAN / INV" icon={<WalletOutlined/>} active={scanMode==="tagihan"} color="#F59E0B"/>
          </div>

          {/* Scanner box */}
          <div ref={scannerWrapRef} className="sqr-wrap" style={{marginBottom:12}}>
            {/* Cyber grid */}
            <div className="sqr-grid"/>

            {isScanning ? (
              <>
                {/* Laser */}
                <div className="sqr-laser"/>
                {/* Crosshair */}
                <div className="sqr-cross"/>
                {/* Corners */}
                {["sqr-tl","sqr-tr","sqr-bl","sqr-br"].map(c=>(
                  <div key={c} className={`sqr-corner ${c}`}/>
                ))}
                {/* Actual scanner */}
                <div style={{position:"absolute",inset:0,zIndex:1}}>
                  <Scanner
                    onScan={r => r[0]?.rawValue && handleDecode(r[0].rawValue)}
                    onError={e => console.warn(e)}
                    scanDelay={800}
                    allowMultiple={false}
                    components={{ torch:true }}
                    styles={{ container:{width:"100%",height:"100%"}, video:{width:"100%",height:"100%",objectFit:"cover"} }}
                  />
                </div>
                {/* Status bar */}
                <div className="sqr-statusbar">
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{
                      width:7,height:7,borderRadius:"50%",background:CYAN,
                      boxShadow:`0 0 8px ${CYAN}`,flexShrink:0,
                    }}/>
                    <span style={{fontFamily:"monospace",fontSize:11,color:"rgba(255,255,255,0.7)",letterSpacing:"1px"}}>
                      SCANNING
                      <span className="sqr-dot1">.</span>
                      <span className="sqr-dot2">.</span>
                      <span className="sqr-dot3">.</span>
                    </span>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    {/* Manual input btn */}
                    <button onClick={()=>setShowManual(v=>!v)} style={{
                      background:"rgba(201,168,76,0.15)",border:`1px solid ${GOLD}35`,
                      borderRadius:8,padding:"4px 10px",cursor:"pointer",
                      color:GOLD_BRIGHT,fontSize:11,fontWeight:700,
                    }}>
                      <KeyOutlined/> Manual
                    </button>
                    {/* Fullscreen btn */}
                    <button onClick={toggleFullscreen} style={{
                      background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)",
                      borderRadius:8,padding:"4px 8px",cursor:"pointer",color:"rgba(255,255,255,0.7)",fontSize:13,
                    }}>
                      {isFullscreen ? <FullscreenExitOutlined/> : <FullscreenOutlined/>}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* Standby / Success / Error / Loading overlay */
              <div style={{
                position:"absolute",inset:0,zIndex:10,
                display:"flex",flexDirection:"column",
                alignItems:"center",justifyContent:"center",
                background:"rgba(0,0,0,0.88)",
              }}>
                {scanState==="loading" && (
                  <>
                    <div style={{
                      width:64,height:64,borderRadius:16,
                      background:`linear-gradient(135deg,${GOLD}18,${CYAN}10)`,
                      border:`2px solid ${GOLD}35`,
                      display:"flex",alignItems:"center",justifyContent:"center",marginBottom:16,
                      boxShadow:`0 0 30px ${GOLD}25`,
                    }}>
                      <Spin size="large"/>
                    </div>
                    <div style={{fontFamily:"monospace",color:GOLD_BRIGHT,fontSize:12,letterSpacing:"2px"}}>
                      MENGAMBIL DATA<span className="sqr-dot1">.</span><span className="sqr-dot2">.</span><span className="sqr-dot3">.</span>
                    </div>
                  </>
                )}

                {scanState==="success" && (
                  <motion.div
                    initial={{scale:0.6,opacity:0}}
                    animate={{scale:1,opacity:1}}
                    transition={{duration:0.45,ease:[0.22,1,0.36,1]}}
                    style={{textAlign:"center"}}
                  >
                    <div style={{
                      width:80,height:80,borderRadius:"50%",
                      background:`linear-gradient(135deg,${CYAN}25,${CYAN}10)`,
                      border:`2px solid ${CYAN}70`,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      margin:"0 auto 14px",
                      boxShadow:`0 0 40px ${CYAN}40`,
                    }}>
                      <CheckCircleOutlined style={{fontSize:38,color:CYAN}}/>
                    </div>
                    <div style={{fontFamily:"monospace",color:CYAN,fontSize:13,fontWeight:700,letterSpacing:"2px",marginBottom:16}}>
                      IDENTIFIKASI BERHASIL
                    </div>
                    <button onClick={handleReset} style={{
                      background:`linear-gradient(135deg,${GOLD},${GOLD_BRIGHT})`,
                      border:"none",borderRadius:50,padding:"10px 24px",
                      color:"#000",fontWeight:800,fontSize:13,cursor:"pointer",
                      boxShadow:`0 6px 20px ${GOLD}50`,letterSpacing:"0.5px",
                    }}>
                      <ReloadOutlined/> SCAN BARU
                    </button>
                  </motion.div>
                )}

                {scanState==="error" && (
                  <motion.div
                    initial={{scale:0.7,opacity:0}}
                    animate={{scale:1,opacity:1}}
                    transition={{duration:0.35}}
                    style={{textAlign:"center",padding:"0 24px"}}
                  >
                    <div style={{
                      width:72,height:72,borderRadius:"50%",
                      background:"rgba(248,113,113,0.12)",border:"2px solid rgba(248,113,113,0.35)",
                      display:"flex",alignItems:"center",justifyContent:"center",
                      margin:"0 auto 14px",boxShadow:"0 0 30px rgba(248,113,113,0.25)",
                    }}>
                      <CloseCircleOutlined style={{fontSize:34,color:"#F87171"}}/>
                    </div>
                    <div style={{fontFamily:"monospace",color:"#F87171",fontSize:11,letterSpacing:"1.5px",marginBottom:8}}>
                      DATA TIDAK DITEMUKAN
                    </div>
                    <div style={{color:"rgba(255,255,255,0.45)",fontSize:11,marginBottom:16,lineHeight:1.5}}>
                      {errorMsg}
                    </div>
                    <button onClick={handleReset} style={{
                      background:"rgba(248,113,113,0.12)",border:"1px solid rgba(248,113,113,0.35)",
                      borderRadius:50,padding:"9px 22px",color:"#F87171",
                      fontWeight:700,fontSize:12,cursor:"pointer",letterSpacing:"0.5px",
                    }}>
                      <ReloadOutlined/> COBA LAGI
                    </button>
                  </motion.div>
                )}
              </div>
            )}
          </div>

          {/* Manual NIS input */}
          <AnimatePresence>
            {showManual && (
              <motion.div
                initial={{opacity:0,height:0}}
                animate={{opacity:1,height:"auto"}}
                exit={{opacity:0,height:0}}
                style={{overflow:"hidden",marginBottom:12}}
              >
                <div style={{
                  background:t.card,border:`1px solid ${GOLD}30`,
                  borderRadius:14,padding:"14px 16px",
                }}>
                  <div style={{fontSize:11,fontWeight:700,color:t.textMuted,
                    letterSpacing:"1px",textTransform:"uppercase",marginBottom:10}}>
                    Input Manual NIS / QR ID
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <Input
                      value={manualNIS}
                      onChange={e=>setManualNIS(e.target.value)}
                      onPressEnter={handleManualSubmit}
                      placeholder={scanMode==="santri"?"Ketik NIS santri...":"Ketik QR ID diklat..."}
                      style={{borderRadius:10,fontFamily:"monospace",flex:1}}
                      autoFocus
                    />
                    <Button type="primary"
                      onClick={handleManualSubmit}
                      disabled={!manualNIS.trim()}
                      style={{
                        background:`linear-gradient(135deg,${GOLD},${GOLD_BRIGHT})`,
                        border:"none",color:"#000",fontWeight:700,borderRadius:10,
                      }}>
                      Cari
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Scan History button */}
          <button
            onClick={()=>setShowHistory(true)}
            disabled={history.length===0}
            style={{
              width:"100%",padding:"10px 16px",
              background:t.card,border:`1px solid ${t.border}`,
              borderRadius:12,cursor:history.length?'pointer':'not-allowed',
              opacity:history.length?1:0.5,
              display:"flex",alignItems:"center",justifyContent:"space-between",
              transition:"border-color .15s",
            }}
            onMouseEnter={e=>{if(history.length)(e.currentTarget as any).style.borderColor=t.borderAccent}}
            onMouseLeave={e=>{(e.currentTarget as any).style.borderColor=t.border}}
          >
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <HistoryOutlined style={{color:t.accent,fontSize:14}}/>
              <span style={{fontSize:12,fontWeight:700,color:t.textSub}}>Riwayat Scan Sesi Ini</span>
            </div>
            <div style={{
              fontSize:10,fontWeight:800,color:t.accent,
              background:`${t.accent}16`,border:`1px solid ${t.accent}28`,
              borderRadius:20,padding:"2px 8px",
            }}>{history.length}</div>
          </button>
        </div>

        {/* ────────────────────────────────────────────────────────
            RIGHT: RESULT PANEL
        ──────────────────────────────────────────────────────── */}
        <div>
          <AnimatePresence mode="wait">

            {/* ── IDLE / EMPTY ── */}
            {(!santriData && !diklatData && !invoiceData && scanState!=="loading") && (
              <motion.div key="empty"
                initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
                exit={{opacity:0,y:-8}} transition={{duration:.3}}
              >
                <div style={{
                  background:t.card, border:`1px dashed ${t.border}`,
                  borderRadius:20, minHeight:400,
                  display:"flex",flexDirection:"column",
                  alignItems:"center",justifyContent:"center",
                  padding:"40px 24px",
                }}>
                  {/* Big scan icon */}
                  <div style={{
                    width:100,height:100,borderRadius:28,marginBottom:20,
                    background: isDark?"rgba(201,168,76,0.06)":"rgba(201,168,76,0.05)",
                    border:`1px solid ${GOLD}20`,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    boxShadow:`0 0 40px ${GOLD}12`,
                  }}>
                    <ScanOutlined style={{fontSize:46,color:`${t.accent}60`}}/>
                  </div>
                  <div style={{fontFamily:"monospace",fontSize:14,fontWeight:700,
                    color:t.textSub,letterSpacing:"2px",marginBottom:8}}>
                    MENUNGGU SCAN
                  </div>
                  <div style={{fontSize:12,color:t.textMuted,textAlign:"center",maxWidth:280,lineHeight:1.6}}>
                    {scanState==="error"
                      ? <span style={{color:"#F87171"}}>{errorMsg}</span>
                      : "Arahkan QR Code santri atau kartu diklat ke kamera, atau gunakan input manual."}
                  </div>

                  {/* QR format hints */}
                  <div style={{
                    marginTop:24,display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center",
                  }}>
                    {[
                      {prefix:"SANTRI:",  color:GOLD_BRIGHT, label:"NIS / Kartu Santri"},
                      {prefix:"DIKLAT:",  color:CYAN,        label:"Kartu Diklat/Pasaran"},
                      {prefix:"INV:",     color:"#F59E0B",   label:"Validasi Tagihan"},
                    ].map(f=>(
                      <div key={f.prefix} style={{
                        padding:"6px 12px",borderRadius:10,fontSize:11,fontWeight:700,
                        background:`${f.color}10`,border:`1px solid ${f.color}25`,color:f.color,
                      }}>
                        <code style={{background:"transparent"}}>{f.prefix}</code> {f.label}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── LOADING SKELETON ── */}
            {scanState==="loading" && (
              <motion.div key="loading"
                initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
                <div style={{
                  background:t.card,border:`1px solid ${t.border}`,borderRadius:20,padding:28,
                }}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16,minHeight:300}}>
                    <div style={{
                      width:72,height:72,borderRadius:18,
                      background:`linear-gradient(135deg,${GOLD}18,${CYAN}10)`,
                      border:`2px solid ${GOLD}35`,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      boxShadow:`0 0 30px ${GOLD}22`,
                    }}>
                      <Spin size="large"/>
                    </div>
                    <div style={{fontFamily:"monospace",color:t.accent,fontSize:12,letterSpacing:"2px"}}>
                      MENGAMBIL DATA<span className="sqr-dot1">.</span><span className="sqr-dot2">.</span><span className="sqr-dot3">.</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── SANTRI RESULT ── */}
            {santriData && (scanState==="success") && (
              <motion.div key="santri-result"
                initial={{opacity:0,y:20,scale:0.97}}
                animate={{opacity:1,y:0,scale:1}}
                exit={{opacity:0,y:-10}}
                transition={{duration:.45,ease:[.22,1,.36,1]}}
              >
                <div style={{
                  background:t.card,border:`1px solid ${t.border}`,
                  borderRadius:20,overflow:"hidden",
                }}>
                  {/* Card header — identity */}
                  <div style={{
                    background: isDark
                      ?"linear-gradient(135deg,#0E0C07 0%,#161208 100%)"
                      :"linear-gradient(135deg,#2A1F0E 0%,#3A2C18 100%)",
                    padding:"24px 28px",
                    position:"relative",overflow:"hidden",
                  }}>
                    {/* Subtle grid */}
                    <div style={{position:"absolute",inset:0,
                      backgroundImage:`linear-gradient(rgba(201,168,76,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(201,168,76,0.05) 1px,transparent 1px)`,
                      backgroundSize:"32px 32px",pointerEvents:"none"}}/>
                    <div style={{position:"relative",display:"flex",alignItems:"center",gap:20}}>
                      {/* Avatar with gold ring */}
                      <div className="sqr-avatar-ring" style={{flexShrink:0}}>
                        <Avatar
                          src={santriData.foto_url}
                          size={88}
                          icon={<UserOutlined/>}
                          style={{
                            border:"3px solid #0E0C07",
                            background: isDark?"#1C1810":"#F0EDE5",
                            display:"block",
                          }}
                        />
                      </div>
                      {/* Name + tags */}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:11,color:GOLD,fontWeight:700,letterSpacing:"2px",
                          textTransform:"uppercase",marginBottom:6}}>
                          DATA SANTRI TERIDENTIFIKASI
                        </div>
                        <h2 style={{
                          margin:"0 0 10px",fontSize:"clamp(16px,2vw,22px)",
                          fontWeight:800,color:"#F5EDD8",lineHeight:1.2,
                        }}>
                          {santriData.nama || santriAlias(santriData.nis)}
                        </h2>
                        <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                          {[
                            {label:`NIS: ${santriData.nis}`,color:"#60A5FA",icon:<IdcardOutlined/>},
                            {label:`Kelas ${santriData.kelas}`,color:GOLD_BRIGHT,icon:<BookOutlined/>},
                            {label:santriData.jurusan,color:"#A78BFA",icon:null},
                            {
                              label:santriData.status_santri||"AKTIF",
                              color:santriData.status_santri==="AKTIF"?"#34D399":"#F87171",
                              icon: santriData.status_santri==="AKTIF" ? <CheckCircleOutlined/> : <CloseCircleOutlined/>
                            },
                          ].filter(x=>x.label&&x.label!=="null").map((tag,i)=>(
                            <span key={i} style={{
                              display:"inline-flex",alignItems:"center",gap:4,
                              padding:"3px 10px",borderRadius:20,
                              fontSize:10,fontWeight:800,letterSpacing:"0.6px",
                              background:`${tag.color}18`,color:tag.color,border:`1px solid ${tag.color}30`,
                            }}>
                              {tag.icon}{tag.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tab switcher: INFO / SPP */}
                  <div style={{
                    display:"flex",borderBottom:`1px solid ${t.divider}`,
                    background:t.surface,
                  }}>
                    {[{key:"info",label:"Profil & Identitas",icon:<UserOutlined/>},
                      {key:"spp", label:"Status Syahriah", icon:<WalletOutlined/>}].map(tb=>(
                      <button key={tb.key}
                        onClick={()=>setViewTab(tb.key as any)}
                        style={{
                          flex:1,padding:"13px 16px",border:"none",cursor:"pointer",
                          background:"transparent",
                          color:viewTab===tb.key?t.accent:t.textMuted,
                          fontWeight:700,fontSize:12,letterSpacing:"0.3px",
                          borderBottom: viewTab===tb.key?`2px solid ${t.accent}`:"2px solid transparent",
                          transition:"all .15s",
                          display:"flex",alignItems:"center",justifyContent:"center",gap:6,
                        }}>
                        <span style={{fontSize:14}}>{tb.icon}</span>{tb.label}
                      </button>
                    ))}
                  </div>

                  {/* Tab content */}
                  <div className="sqr-scroll" style={{maxHeight:460,overflowY:"auto",padding:"16px 20px"}}>

                    {/* ── INFO TAB ── */}
                    {viewTab==="info" && (
                      <div>
                        <div style={{
                          fontSize:10,fontWeight:800,letterSpacing:"1.5px",textTransform:"uppercase",
                          color:t.textMuted,marginBottom:12,
                          display:"flex",alignItems:"center",gap:8,
                        }}>
                          <div style={{flex:1,height:"1px",background:t.divider}}/>
                          IDENTITAS PRIBADI
                          <div style={{flex:1,height:"1px",background:t.divider}}/>
                        </div>
                        <InfoRow label="NIS"           value={santriData.nis}           copyKey="nis"/>
                        <InfoRow label="NIK"           value={santriData.nik}           copyKey="nik"/>
                        <InfoRow label="TTL"           value={`${santriData.tempat_lahir}, ${santriData.tanggal_lahir}`}/>
                        <InfoRow label="Pembimbing"    value={santriData.pembimbing}/>
                        <InfoRow label="Total Hafalan" value={santriData.total_hafalan ? `${santriData.total_hafalan} Juz` : null}/>

                        <div style={{
                          fontSize:10,fontWeight:800,letterSpacing:"1.5px",textTransform:"uppercase",
                          color:t.textMuted,margin:"16px 0 12px",
                          display:"flex",alignItems:"center",gap:8,
                        }}>
                          <div style={{flex:1,height:"1px",background:t.divider}}/>
                          DATA KELUARGA & WALI
                          <div style={{flex:1,height:"1px",background:t.divider}}/>
                        </div>
                        <InfoRow label="Ayah"        value={santriData.ayah}/>
                        <InfoRow label="Ibu"         value={santriData.ibu}/>
                        <InfoRow label="Kontak Wali" value={santriData.no_kontak_wali}  copyKey="wali_phone"/>
                        <InfoRow label="Alamat"      value={santriData.alamat_lengkap}/>
                      </div>
                    )}

                    {/* ── SPP TAB ── */}
                    {viewTab==="spp" && (
                      <div>
                        {/* SPP summary */}
                        {tagihanData.length > 0 && (() => {
                          const lunasCount = tagihanData.filter(t=>t.status==="LUNAS").length;
                          const totalTagihan = tagihanData.reduce((a,c)=>a+Number(c.nominal_tagihan||0),0);
                          const totalLunas   = tagihanData.filter(t=>t.status==="LUNAS").reduce((a,c)=>a+Number(c.nominal_tagihan||0),0);
                          const pct = Math.round((totalLunas/Math.max(totalTagihan,1))*100);
                          return (
                            <div style={{
                              background: isDark?"rgba(201,168,76,0.07)":"rgba(201,168,76,0.05)",
                              border:`1px solid ${GOLD}22`,borderRadius:14,
                              padding:"14px 16px",marginBottom:16,
                            }}>
                              <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                                <div>
                                  <div style={{fontSize:10,fontWeight:700,color:t.textMuted,letterSpacing:".8px",textTransform:"uppercase",marginBottom:4}}>Ringkasan SPP</div>
                                  <div style={{fontSize:18,fontWeight:800,color:GOLD_BRIGHT,fontFamily:"monospace"}}>{pct}% Lunas</div>
                                </div>
                                <div style={{textAlign:"right"}}>
                                  <div style={{fontSize:10,color:t.textMuted}}>Lunas</div>
                                  <div style={{fontWeight:800,color:"#34D399",fontSize:15,fontFamily:"monospace"}}>{fmt(totalLunas)}</div>
                                  <div style={{fontSize:10,color:t.textMuted,marginTop:2}}>dari {fmt(totalTagihan)}</div>
                                </div>
                              </div>
                              {/* Progress bar */}
                              <div style={{height:5,borderRadius:100,background:isDark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.07)",overflow:"hidden"}}>
                                <motion.div
                                  initial={{width:0}} animate={{width:`${pct}%`}}
                                  transition={{duration:.8,ease:[.22,1,.36,1]}}
                                  style={{height:"100%",background:`linear-gradient(90deg,${GOLD},${GOLD_BRIGHT})`,borderRadius:100}}
                                />
                              </div>
                            </div>
                          );
                        })()}

                        {tagihanData.length > 0 ? (
                          tagihanData.map(tagihan => <SppItem key={tagihan.id} tagihan={tagihan}/>)
                        ) : (
                          <div style={{textAlign:"center",padding:"40px 0",color:t.textMuted}}>
                            <WalletOutlined style={{fontSize:36,opacity:.35,display:"block",marginBottom:10}}/>
                            Tidak ada data tagihan tercatat.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── DIKLAT RESULT ── */}
            {diklatData && (scanState==="success") && (
              <motion.div key="diklat-result"
                initial={{opacity:0,y:20,scale:.97}}
                animate={{opacity:1,y:0,scale:1}}
                exit={{opacity:0,y:-10}}
                transition={{duration:.45,ease:[.22,1,.36,1]}}
              >
                <div style={{
                  background:t.card,border:`1px solid ${t.border}`,
                  borderRadius:20,overflow:"hidden",
                }}>
                  {/* Header */}
                  <div style={{
                    background:`linear-gradient(135deg, #060E0D 0%, #0C1A18 100%)`,
                    padding:"24px 28px",position:"relative",overflow:"hidden",
                  }}>
                    <div style={{position:"absolute",inset:0,
                      backgroundImage:`linear-gradient(rgba(0,255,209,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,209,0.04) 1px,transparent 1px)`,
                      backgroundSize:"32px 32px",pointerEvents:"none"}}/>
                    <div style={{position:"relative",display:"flex",alignItems:"center",gap:20}}>
                      <div style={{
                        width:88,height:88,borderRadius:"50%",flexShrink:0,
                        background:`linear-gradient(135deg,${CYAN}22,${CYAN_DIM}14)`,
                        border:`2px solid ${CYAN}45`,
                        display:"flex",alignItems:"center",justifyContent:"center",
                        boxShadow:`0 0 30px ${CYAN}25`,
                      }}>
                        <SafetyCertificateOutlined style={{fontSize:40,color:CYAN}}/>
                      </div>
                      <div>
                        <div style={{fontSize:10,color:CYAN_DIM,fontWeight:700,letterSpacing:"2px",textTransform:"uppercase",marginBottom:6}}>
                          PESERTA DIKLAT TERIDENTIFIKASI
                        </div>
                        <h2 style={{margin:"0 0 10px",fontSize:"clamp(16px,2vw,22px)",fontWeight:800,color:"#F5EDD8",lineHeight:1.2}}>
                          {diklatData.nama_lengkap}
                        </h2>
                        <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                          <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 10px",borderRadius:20,
                            fontSize:10,fontWeight:800,background:`${CYAN}14`,color:CYAN,border:`1px solid ${CYAN}30`}}>
                            <CalendarOutlined/> {diklatData.jenis_diklat} {diklatData.tahun_diklat}H
                          </span>
                          <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 10px",borderRadius:20,
                            fontSize:10,fontWeight:800,
                            background:diklatData.status_pembayaran==="LUNAS"?"rgba(52,211,153,.14)":"rgba(255,209,102,.14)",
                            color:diklatData.status_pembayaran==="LUNAS"?"#34D399":GOLD_BRIGHT,
                            border:`1px solid ${diklatData.status_pembayaran==="LUNAS"?"#34D39930":GOLD_BRIGHT+"30"}`}}>
                            <DollarCircleOutlined/> {diklatData.status_pembayaran}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Detail grid */}
                  <div className="sqr-scroll" style={{maxHeight:480,overflowY:"auto",padding:"20px 24px"}}>
                    {/* Financials summary */}
                    <div style={{
                      display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20,
                    }}>
                      {[
                        {label:"Biaya Pendaftaran",val:diklatData.biaya_pendaftaran,color:"#34D399"},
                        {label:"Belanja Kitab",    val:diklatData.belanja_kitab_nominal,color:GOLD_BRIGHT},
                      ].map(f=>(
                        <div key={f.label} style={{
                          background:`${f.color}0C`,border:`1px solid ${f.color}22`,
                          borderRadius:12,padding:"12px 14px",
                        }}>
                          <div style={{fontSize:10,fontWeight:700,color:t.textMuted,marginBottom:4,letterSpacing:".6px",textTransform:"uppercase"}}>{f.label}</div>
                          <div style={{fontFamily:"monospace",fontWeight:800,fontSize:16,color:f.color}}>{fmt(f.val||0)}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{
                      fontSize:10,fontWeight:800,letterSpacing:"1.5px",textTransform:"uppercase",
                      color:t.textMuted,marginBottom:12,
                      display:"flex",alignItems:"center",gap:8,
                    }}>
                      <div style={{flex:1,height:"1px",background:t.divider}}/>
                      DATA PRIBADI & KELUARGA
                      <div style={{flex:1,height:"1px",background:t.divider}}/>
                    </div>
                    <InfoRow label="TTL"              value={`${diklatData.tempat_lahir}, ${diklatData.tanggal_lahir}`}/>
                    <InfoRow label="No. Telepon"      value={diklatData.no_telepon} copyKey="diklat_phone"/>
                    <InfoRow label="Pesantren Asal"   value={diklatData.pesantren_asal}/>
                    <InfoRow label="Nama Wali"        value={`${diklatData.nama_wali} (${diklatData.pekerjaan_wali})`}/>
                    <InfoRow label="Alamat"           value={diklatData.alamat_lengkap}/>

                    {diklatData.rincian_belanja && (
                      <div style={{
                        marginTop:14,padding:"12px 14px",
                        background: isDark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.02)",
                        border:`1px solid ${t.border}`,borderRadius:10,
                        fontStyle:"italic",fontSize:12,color:t.textSub,lineHeight:1.6,
                      }}>
                        <div style={{fontSize:9,fontWeight:800,letterSpacing:"1px",textTransform:"uppercase",
                          color:t.textMuted,marginBottom:6}}>Rincian Belanja</div>
                        {diklatData.rincian_belanja}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── TAGIHAN / INVOICE RESULT ── */}
            {invoiceData && (scanState==="success") && (
              <motion.div key="tagihan-result"
                initial={{opacity:0,y:20,scale:.97}}
                animate={{opacity:1,y:0,scale:1}}
                exit={{opacity:0,y:-10}}
                transition={{duration:.45,ease:[.22,1,.36,1]}}
              >
                <div style={{
                  background:t.card,border:`1px solid ${t.border}`,
                  borderRadius:20,overflow:"hidden",
                }}>
                  {/* Header - Invoice Style */}
                  <div style={{
                    background: invoiceData.status === "LUNAS" 
                      ? "linear-gradient(135deg, #064E3B 0%, #065F46 100%)" 
                      : "linear-gradient(135deg, #78350F 0%, #92400E 100%)",
                    padding:"24px 28px",position:"relative",overflow:"hidden",
                  }}>
                    {/* Invoice background pattern */}
                    <div style={{position:"absolute",right:-20,top:-20,width:120,height:120,borderRadius:"50%",background:"rgba(255,255,255,0.05)"}}/>
                    
                    <div style={{position:"relative",display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
                      <div>
                        <div style={{fontSize:11,color:GOLD_LIGHT,fontWeight:700,letterSpacing:"2px",textTransform:"uppercase",marginBottom:6}}>
                          VALIDASI TAGIHAN DIGITAL
                        </div>
                        <h2 style={{margin:"0 0 4px",fontSize:22,fontWeight:900,color:"#fff"}}>
                          #INV-{invoiceData.id.substring(0,8).toUpperCase()}
                        </h2>
                        <div style={{fontSize:12,color:"rgba(255,255,255,0.7)",fontWeight:600}}>
                          {dayjs(invoiceData.created_at).format("DD MMMM YYYY")}
                        </div>
                      </div>
                      <div style={{
                        padding:"6px 16px",borderRadius:12,
                        background: invoiceData.status === "LUNAS" ? "#34D399" : "#FBBF24",
                        color:"#000",fontWeight:900,fontSize:12,letterSpacing:"1px",
                        boxShadow:"0 4px 12px rgba(0,0,0,0.2)",
                      }}>
                        {invoiceData.status}
                      </div>
                    </div>
                  </div>

                  <div className="sqr-scroll" style={{maxHeight:480,overflowY:"auto",padding:"24px"}}>
                    {/* Student Info in Invoice */}
                    <div style={{
                      display:"flex",alignItems:"center",gap:14,
                      background: isDark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.02)",
                      padding:"16px",borderRadius:16,marginBottom:20,border:`1px solid ${t.border}`,
                    }}>
                      <Avatar src={invoiceData.santri?.foto_url} size={54} icon={<UserOutlined/>} style={{border:`2px solid ${GOLD}40`,background:t.surface}}/>
                      <div>
                        <div style={{fontSize:10,fontWeight:800,color:t.textMuted,letterSpacing:".5px",textTransform:"uppercase"}}>PEMBAYAR (SANTRI)</div>
                        <div style={{fontSize:15,fontWeight:800,color:t.text}}>{invoiceData.santri?.nama || santriAlias(invoiceData.santri?.nis) || "Unknown"}</div>
                        <div style={{fontSize:12,color:t.textSub}}>NIS: {invoiceData.santri_nis} · Kelas {invoiceData.santri?.kelas}</div>
                      </div>
                    </div>

                    {/* Details */}
                    <div style={{marginBottom:24}}>
                      <div style={{fontSize:10,fontWeight:800,color:t.textMuted,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
                        <div style={{flex:1,height:"1px",background:t.divider}}/>
                        RINCIAN PEMBAYARAN
                        <div style={{flex:1,height:"1px",background:t.divider}}/>
                      </div>
                      
                      <div style={{padding:"0 4px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>
                          <span style={{color:t.textSub,fontSize:13}}>{invoiceData.deskripsi_tagihan}</span>
                          <span style={{color:t.text,fontWeight:700,fontSize:14,fontFamily:"monospace"}}>{fmt(invoiceData.nominal_tagihan)}</span>
                        </div>
                        
                        <div style={{height:"1px",background:t.divider,marginBottom:14}}/>
                        
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <span style={{color:t.text,fontWeight:800,fontSize:12}}>TOTAL TAGIHAN</span>
                          <span style={{color:t.accent,fontWeight:900,fontSize:20,fontFamily:"monospace"}}>{fmt(invoiceData.nominal_tagihan)}</span>
                        </div>
                        
                        {invoiceData.status !== "LUNAS" && (
                           <div style={{
                             marginTop:16,padding:"10px 14px",borderRadius:10,
                             background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.2)",
                             display:"flex",justifyContent:"space-between",alignItems:"center"
                           }}>
                             <span style={{color:"#F87171",fontSize:11,fontWeight:700}}>SISA TUNGGAKAN</span>
                             <span style={{color:"#F87171",fontWeight:800,fontSize:14,fontFamily:"monospace"}}>{fmt(invoiceData.sisa_tagihan)}</span>
                           </div>
                        )}
                      </div>
                    </div>

                    {/* Footer note */}
                    <div style={{textAlign:"center",padding:"16px",background:`${t.accent}08`,borderRadius:12,border:`1px dashed ${t.accent}30`}}>
                       <div style={{fontSize:11,color:t.accent,fontWeight:700,marginBottom:4}}>Validasi Berhasil</div>
                       <div style={{fontSize:10,color:t.textMuted}}>Dokumen ini sah dan diverifikasi oleh sistem internal Al-Hasanah.</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* ── HISTORY MODAL ────────────────────────────────────────── */}
      <Modal
        open={showHistory}
        onCancel={()=>setShowHistory(false)}
        footer={null}
        centered
        width={460}
        title={null}
        styles={{
          content:{
            background:t.card,border:`1px solid ${t.border}`,
            borderRadius:20,padding:0,overflow:"hidden",
          },
          mask:{backdropFilter:"blur(5px)",background:"rgba(0,0,0,0.55)"},
        }}
      >
        {/* Modal header */}
        <div style={{
          padding:"18px 22px",borderBottom:`1px solid ${t.divider}`,
          background: isDark?"rgba(201,168,76,0.05)":"rgba(201,168,76,0.04)",
          display:"flex",alignItems:"center",justifyContent:"space-between",
        }}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{
              width:34,height:34,borderRadius:9,
              background:`linear-gradient(135deg,${GOLD},${GOLD_BRIGHT})`,
              display:"flex",alignItems:"center",justifyContent:"center",
            }}>
              <HistoryOutlined style={{color:"#000",fontSize:15}}/>
            </div>
            <div>
              <div style={{fontWeight:800,fontSize:14,color:t.text}}>Riwayat Sesi Ini</div>
              <div style={{fontSize:11,color:t.textMuted}}>{history.length} scan tercatat</div>
            </div>
          </div>
          <Button
            size="small" type="text" danger
            onClick={()=>{setHistory([]);setShowHistory(false);}}
            icon={<CloseCircleOutlined/>}
            style={{color:"#F87171",borderRadius:8}}
          >
            Hapus Semua
          </Button>
        </div>

        {/* History list */}
        <div className="sqr-scroll" style={{maxHeight:420,overflowY:"auto",padding:"12px 16px"}}>
          {history.map((entry,i)=>(
            <motion.div key={entry.id}
              initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}}
              transition={{delay:i*0.04}}
            >
              <button
                onClick={()=>entry.success && restoreFromHistory(entry)}
                disabled={!entry.success}
                style={{
                  width:"100%",background:"transparent",border:"none",cursor:entry.success?"pointer":"default",
                  display:"flex",alignItems:"center",gap:12,padding:"10px 10px",borderRadius:12,
                  marginBottom:4,transition:"background .15s",textAlign:"left",
                  opacity:entry.success?1:0.6,
                }}
                onMouseEnter={e=>{if(entry.success)(e.currentTarget as any).style.background=isDark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.03)"}}
                onMouseLeave={e=>{(e.currentTarget as any).style.background="transparent"}}
              >
                {/* Status dot */}
                <div style={{
                  width:34,height:34,flexShrink:0,borderRadius:10,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  background:entry.success?"rgba(52,211,153,0.12)":"rgba(248,113,113,0.10)",
                  border:`1px solid ${entry.success?"rgba(52,211,153,0.25)":"rgba(248,113,113,0.22)"}`,
                }}>
                  {entry.mode==="santri"
                    ? <UserOutlined style={{color:entry.success?"#34D399":"#F87171",fontSize:15}}/>
                    : <SafetyCertificateOutlined style={{color:entry.success?"#34D399":"#F87171",fontSize:15}}/>
                  }
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:13,color:t.text,
                    overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {entry.name}
                  </div>
                  <div style={{fontSize:10,color:t.textMuted,marginTop:2}}>
                    {dayjs(entry.timestamp).format("HH:mm:ss")} · {entry.mode==="santri"?"Data Santri":"Diklat"} · <code style={{fontSize:10,background:"transparent"}}>{entry.rawValue}</code>
                  </div>
                </div>
                {entry.success && (
                  <div style={{fontSize:10,fontWeight:700,color:t.accent,
                    background:`${t.accent}14`,border:`1px solid ${t.accent}25`,
                    borderRadius:8,padding:"2px 8px",flexShrink:0}}>
                    Lihat
                  </div>
                )}
              </button>
            </motion.div>
          ))}
        </div>
      </Modal>
    </div>
  );
};
