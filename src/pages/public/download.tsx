import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

const GOLD        = "#C9A84C";
const GOLD_LIGHT  = "#FDE68A";
const GOLD_BRIGHT = "#FFB700";
const GOLD_DEEP   = "#8B6914";

const D_BG  = "#08070D";
const L_BG  = "#F7F4EE";

const DOWNLOAD_CONFIG = {
  version: "v1.0.9",
  downloadUrl: "https://github.com/nurdinRamadhan/aplikasi-android/releases/download/v1.0.9/AlhasanahMedia-v1.0.9.apk",
  minAndroid: "10.0+",
  releaseDate: "28 Juli 2025",
};

const ISLAMIC_SVG = `url("data:image/svg+xml,%3Csvg width='120' height='120' viewBox='0 0 120 120' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='rgba(201%2C168%2C76%2C0.07)' stroke-width='0.8'%3E%3Cpolygon points='60%2C10 110%2C35 110%2C85 60%2C110 10%2C85 10%2C35'/%3E%3Cpolygon points='60%2C25 95%2C42.5 95%2C77.5 60%2C95 25%2C77.5 25%2C42.5'/%3E%3Cline x1='60' y1='10' x2='60' y2='25'/%3E%3Cline x1='110' y1='35' x2='95' y2='42.5'/%3E%3Cline x1='110' y1='85' x2='95' y2='77.5'/%3E%3Cline x1='60' y1='110' x2='60' y2='95'/%3E%3Cline x1='10' y1='85' x2='25' y2='77.5'/%3E%3Cline x1='10' y1='35' x2='25' y2='42.5'/%3E%3C/g%3E%3C/svg%3E")`;

const AndroidIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill={color}>
    <path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C13.85 1.23 12.95 1 12 1c-.96 0-1.86.23-2.66.63L7.85.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31C6.97 3.26 6 5.01 6 7h12c0-1.99-.97-3.75-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z" />
  </svg>
);

const DownloadIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const CheckIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const DownloadPage: React.FC = () => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const bg      = isDark ? D_BG : L_BG;
  const cardBg  = isDark ? "rgba(15,15,26,0.97)" : "rgba(255,255,255,0.97)";
  const border  = isDark ? "rgba(201,168,76,0.16)" : "rgba(201,168,76,0.28)";
  const text    = isDark ? "#F0EDE5" : "#0A0805";
  const textSub = isDark ? "#9E9080" : "#6B5F50";
  const textMut = isDark ? "#5C5248" : "#9E9080";
  const divider = isDark ? "rgba(201,168,76,0.08)" : "rgba(201,168,76,0.12)";

  return (
    <div style={{
      minHeight: "100vh",
      background: bg,
      backgroundImage: `${ISLAMIC_SVG}, radial-gradient(ellipse 80% 55% at 50% -5%, ${GOLD}0E 0%, transparent 60%)`,
      backgroundSize: "120px 120px, cover",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px 16px", position: "relative", overflow: "hidden",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      {/* Ambient glow */}
      <div style={{
        position: "absolute", top: "10%", left: "8%",
        width: 500, height: 400,
        background: `radial-gradient(circle, ${GOLD}0C 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        style={{
          width: "100%", maxWidth: 460, position: "relative", zIndex: 10,
          background: cardBg, border: `1px solid ${border}`,
          borderRadius: 24, backdropFilter: "blur(30px)", WebkitBackdropFilter: "blur(30px)",
          boxShadow: isDark
            ? `0 48px 96px rgba(0,0,0,0.80), 0 0 0 1px rgba(201,168,76,0.07)`
            : `0 28px 72px rgba(0,0,0,0.12), 0 0 0 1px rgba(201,168,76,0.14)`,
          overflow: "hidden",
        }}
      >
        {/* Top gold accent */}
        <div style={{
          height: 3,
          background: `linear-gradient(90deg, transparent, ${GOLD} 30%, ${GOLD_BRIGHT} 50%, ${GOLD} 70%, transparent)`,
        }} />

        {/* Brand section */}
        <div style={{
          padding: "36px 44px 24px", textAlign: "center",
          background: isDark
            ? "linear-gradient(180deg, rgba(201,168,76,0.05) 0%, transparent 100%)"
            : "linear-gradient(180deg, rgba(201,168,76,0.04) 0%, transparent 100%)",
        }}>
          {/* Logo */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{ display: "inline-block", marginBottom: 22, position: "relative" }}
          >
            <div style={{
              width: 76, height: 76,
              background: `linear-gradient(135deg, ${GOLD}25, ${GOLD_BRIGHT}15)`,
              border: `1.5px solid ${GOLD}45`, borderRadius: 22,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: isDark ? `0 0 32px ${GOLD}25, 0 8px 24px rgba(0,0,0,0.30)` : `0 8px 24px ${GOLD}20`,
              position: "relative", overflow: "hidden",
            }}>
              <svg width="42" height="42" viewBox="0 0 32 32" fill="none"
                style={{ filter: `drop-shadow(0 0 6px ${GOLD_BRIGHT}80)` }}>
                <path d="M16 3C11.029 3 7 7.029 7 12V14H25V12C25 7.029 20.971 3 16 3Z"
                  fill={isDark ? GOLD_BRIGHT : GOLD_DEEP} opacity="0.95"/>
                <rect x="5" y="10" width="3" height="11" rx="1.5"
                  fill={isDark ? GOLD_BRIGHT : GOLD_DEEP} opacity="0.7"/>
                <path d="M5.5 10 L8 10 L6.5 7 Z"
                  fill={isDark ? GOLD_BRIGHT : GOLD_DEEP} opacity="0.85"/>
                <rect x="24" y="10" width="3" height="11" rx="1.5"
                  fill={isDark ? GOLD_BRIGHT : GOLD_DEEP} opacity="0.7"/>
                <path d="M24 10 L26.5 10 L25.5 7 Z"
                  fill={isDark ? GOLD_BRIGHT : GOLD_DEEP} opacity="0.85"/>
                <rect x="9" y="14" width="14" height="9" rx="2"
                  fill={isDark ? GOLD_BRIGHT : GOLD_DEEP} opacity="0.85"/>
                <path d="M13.5 23V18.5C13.5 17.12 14.62 16 16 16C17.38 16 18.5 17.12 18.5 18.5V23"
                  stroke="black" strokeWidth="1.2" opacity="0.30"/>
                <circle cx="12" cy="17.5" r="1.2" fill="black" opacity="0.25"/>
                <circle cx="20" cy="17.5" r="1.2" fill="black" opacity="0.25"/>
                <rect x="4" y="23" width="24" height="2" rx="1"
                  fill={isDark ? GOLD_BRIGHT : GOLD_DEEP} opacity="0.5"/>
                <path d="M16 5.5C17.2 5.5 18.3 6 19 6.9C18.3 6.5 17.5 6.3 16.6 6.4C14.8 6.6 13.4 8 13.3 9.8C13.2 8.9 13.4 8 13.9 7.2C14.5 6.2 15.2 5.5 16 5.5Z"
                  fill="white" opacity="0.55"/>
                <path d="M21.5 5L21.9 6.2L23.1 6.2L22.1 7L22.5 8.2L21.5 7.5L20.5 8.2L20.9 7L19.9 6.2L21.1 6.2Z"
                  fill="#FDE68A" opacity="0.80"/>
              </svg>
            </div>
            <div style={{
              position: "absolute", bottom: -6, right: -6,
              width: 24, height: 24,
              background: `linear-gradient(135deg, ${GOLD}, ${GOLD_BRIGHT})`,
              borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 4px 10px ${GOLD}60`, border: `2px solid ${cardBg}`,
            }}>
              <span style={{ fontSize: 11, color: "#000", fontWeight: 900, lineHeight: 1 }}>&#10022;</span>
            </div>
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22, duration: 0.4 }}
          >
            <h1 style={{
              margin: 0, fontFamily: "'Cormorant Garamond', 'Syne', serif",
              fontSize: 30, fontWeight: 700,
              background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_BRIGHT} 55%, ${GOLD_LIGHT} 100%)`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              backgroundClip: "text", letterSpacing: "-0.01em", lineHeight: 1.15,
            }}>
              Al-Hasanah Media
            </h1>
            <div style={{
              fontSize: 11, fontWeight: 500, color: textSub, marginTop: 8, lineHeight: 1.5,
            }}>
              Aplikasi resmi layanan santri dan wali santri
            </div>
          </motion.div>
        </div>

        <div style={{ height: 1, background: divider, margin: "0 36px" }} />

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.30, duration: 0.4 }}
          style={{ padding: "28px 44px 36px" }}
        >
          {/* Version badge */}
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700,
              background: `linear-gradient(135deg, ${GOLD}18, ${GOLD_BRIGHT}12)`,
              border: `1px solid ${GOLD}35`, color: isDark ? GOLD_BRIGHT : GOLD_DEEP,
            }}>
              <AndroidIcon color={isDark ? GOLD_BRIGHT : GOLD_DEEP} />
              {DOWNLOAD_CONFIG.version}
            </span>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700,
              background: isDark ? "rgba(5,150,105,0.15)" : "rgba(5,150,105,0.08)",
              border: "1px solid rgba(5,150,105,0.3)", color: "#059669",
            }}>
              <CheckIcon color="#059669" />
              Stable
            </span>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700,
              background: `linear-gradient(135deg, ${GOLD}12, ${GOLD_BRIGHT}08)`,
              border: `1px solid ${GOLD}25`, color: textMut,
            }}>
              Latest
            </span>
          </div>

          {/* Info rows */}
          <div style={{
            display: "flex", flexDirection: "column", gap: 10, marginBottom: 28,
          }}>
            {[
              { label: "Versi", value: DOWNLOAD_CONFIG.version },
              { label: "Rilis", value: DOWNLOAD_CONFIG.releaseDate },
              { label: "Android", value: `Minimum ${DOWNLOAD_CONFIG.minAndroid}` },
            ].map((item) => (
              <div key={item.label} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 16px", borderRadius: 12,
                background: isDark ? "rgba(201,168,76,0.04)" : "rgba(201,168,76,0.03)",
                border: `1px solid ${divider}`,
              }}>
                <span style={{ fontSize: 12, color: textMut, fontWeight: 500 }}>{item.label}</span>
                <span style={{ fontSize: 13, color: text, fontWeight: 600 }}>{item.value}</span>
              </div>
            ))}
          </div>

          {/* Download button */}
          <motion.a
            href={DOWNLOAD_CONFIG.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              width: "100%", height: 54, borderRadius: 14,
              background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_BRIGHT} 100%)`,
              border: "none", color: "#000", fontWeight: 800, fontSize: 15,
              boxShadow: `0 8px 24px ${GOLD}45`,
              cursor: "pointer", textDecoration: "none",
              transition: "box-shadow 0.2s",
            }}
          >
            <DownloadIcon color="#000" />
            Unduh Aplikasi
          </motion.a>

          {/* Install hint */}
          <div style={{
            marginTop: 20, padding: "14px 16px", borderRadius: 12,
            background: isDark ? "rgba(201,168,76,0.04)" : "rgba(201,168,76,0.03)",
            border: `1px solid ${divider}`,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: textMut, marginBottom: 6, letterSpacing: "0.5px", textTransform: "uppercase" }}>
              Cara Install
            </div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: textSub, lineHeight: 2 }}>
              <li>Download file APK</li>
              <li>Buka di HP Android</li>
              <li>Izinkan instal dari sumber tidak dikenal jika diminta</li>
              <li>Ikuti langkah instalasi</li>
            </ol>
          </div>
        </motion.div>

        {/* Footer */}
        <div style={{
          padding: "20px 44px", borderTop: `1px solid ${divider}`,
          textAlign: "center", fontSize: 10, color: textMut, letterSpacing: "0.3px", lineHeight: 2,
        }}>
          <span style={{ color: isDark ? GOLD_BRIGHT : GOLD_DEEP }}>&#9670;</span>
          {"  "}PONDOK PESANTREN AL-HASANAH{"  "}
          <span style={{ color: isDark ? GOLD_BRIGHT : GOLD_DEEP }}>&#9670;</span>
          <br />
          <span style={{ fontSize: 9 }}>Jl. Raya Cibeuti No.13 · Kawalu · Tasikmalaya, Jawa Barat 46182</span>
        </div>
      </motion.div>
    </div>
  );
};

export default DownloadPage;
