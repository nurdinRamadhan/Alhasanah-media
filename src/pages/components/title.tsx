import React, { useEffect, useState } from "react";
import { theme } from "antd";
import { motion, AnimatePresence } from "framer-motion";
import { useColorMode } from "../../contexts/color-mode";

const { useToken } = theme;

// ─────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────
const GOLD        = "#C9A84C";
const GOLD_BRIGHT = "#FFB700";
const GOLD_LIGHT  = "#FDE68A";
const GOLD_DEEP   = "#8B6914";
const GOLD_DARK   = "#5C430A";

// ─────────────────────────────────────────────────────
// PESANTREN LOGO MARK — Custom SVG
// Islamic arch + minaret silhouette
// ─────────────────────────────────────────────────────
const PesantrenMark: React.FC<{ size?: number; color?: string; glow?: boolean }> = ({
    size = 32,
    color = GOLD_BRIGHT,
    glow = false,
}) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
            filter: glow
                ? `drop-shadow(0 0 6px ${color}90) drop-shadow(0 0 12px ${color}40)`
                : undefined,
            flexShrink: 0,
        }}
    >
        {/* Arch / Dome */}
        <path
            d="M16 3C11.029 3 7 7.029 7 12V14H25V12C25 7.029 20.971 3 16 3Z"
            fill={color}
            opacity={0.95}
        />
        {/* Left minaret */}
        <rect x="5" y="10" width="3" height="11" rx="1.5" fill={color} opacity={0.7} />
        <path d="M5.5 10 L8 10 L6.5 7 Z" fill={color} opacity={0.85} />
        {/* Right minaret */}
        <rect x="24" y="10" width="3" height="11" rx="1.5" fill={color} opacity={0.7} />
        <path d="M24 10 L26.5 10 L25.5 7 Z" fill={color} opacity={0.85} />
        {/* Main body */}
        <rect x="9" y="14" width="14" height="9" rx="2" fill={color} opacity={0.85} />
        {/* Door arch */}
        <path
            d="M13.5 23V18.5C13.5 17.12 14.62 16 16 16C17.38 16 18.5 17.12 18.5 18.5V23"
            stroke="black"
            strokeWidth="1.2"
            opacity={0.30}
        />
        {/* Windows */}
        <circle cx="12" cy="17.5" r="1.2" fill="black" opacity={0.25} />
        <circle cx="20" cy="17.5" r="1.2" fill="black" opacity={0.25} />
        {/* Ground line */}
        <rect x="4" y="23" width="24" height="2" rx="1" fill={color} opacity={0.5} />
        {/* Crescent on dome */}
        <path
            d="M16 5.5C17.2 5.5 18.3 6.0 19 6.9C18.3 6.5 17.5 6.3 16.6 6.4C14.8 6.6 13.4 8.0 13.3 9.8C13.2 8.9 13.4 8.0 13.9 7.2C14.5 6.2 15.2 5.5 16 5.5Z"
            fill="#FFFFFF"
            opacity={0.6}
        />
        {/* Star accent */}
        <path
            d="M21.5 5L21.9 6.2L23.1 6.2L22.1 7L22.5 8.2L21.5 7.5L20.5 8.2L20.9 7L19.9 6.2L21.1 6.2Z"
            fill={GOLD_LIGHT}
            opacity={0.80}
        />
    </svg>
);

// ─────────────────────────────────────────────────────
// EXPANDED BRAND WORDMARK
// ─────────────────────────────────────────────────────
const BrandWordmark: React.FC<{ isDark: boolean }> = ({ isDark }) => (
    <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -8, transition: { duration: 0.15 } }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
        style={{ display: "flex", flexDirection: "column", lineHeight: 1, minWidth: 0 }}
    >
        {/* AL-HASANAH — shimmer text */}
        <span
            style={{
                fontFamily: "'Syne', sans-serif",
                fontWeight: 800,
                fontSize: 13, // Reduced from 14
                letterSpacing: "0.08em", // Reduced from 0.10em
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                background: isDark
                    ? `linear-gradient(90deg, ${GOLD_LIGHT} 0%, ${GOLD_BRIGHT} 40%, ${GOLD} 70%, ${GOLD_LIGHT} 100%)`
                    : `linear-gradient(90deg, ${GOLD_DEEP} 0%, ${GOLD} 40%, ${GOLD_BRIGHT} 70%, ${GOLD_DEEP} 100%)`,
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                animation: "goldShimmer 5s linear infinite",
            }}
        >
            AL-HASANAH
        </span>

        {/* Tagline row */}
        <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 1 }}>
            {/* Ornamental dot */}
            <span style={{
                width: 3, height: 3, borderRadius: "50%",
                background: GOLD_BRIGHT, flexShrink: 0,
                boxShadow: `0 0 3px ${GOLD_BRIGHT}`,
            }} />
            <span style={{
                fontSize: 7.5, // Reduced from 8
                fontWeight: 800,
                letterSpacing: "0.12em", // Reduced from 0.15em
                textTransform: "uppercase",
                color: isDark ? "rgba(255,183,0,0.55)" : "rgba(139,105,20,0.70)",
                fontFamily: "'DM Sans', sans-serif",
                whiteSpace: "nowrap",
            }}>
                MANAGEMENT SYSTEM
            </span>
            <span style={{
                width: 3, height: 3, borderRadius: "50%",
                background: GOLD_BRIGHT, flexShrink: 0,
                boxShadow: `0 0 3px ${GOLD_BRIGHT}`,
            }} />
        </div>
    </motion.div>
);

// ─────────────────────────────────────────────────────
// COLLAPSED BADGE — compact version
// ─────────────────────────────────────────────────────
const CollapsedBadge: React.FC<{ isDark: boolean }> = ({ isDark }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.12 } }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        style={{
            width: 40, height: 40, borderRadius: 13,
            background: isDark
                ? "linear-gradient(135deg, #0D0D1A 0%, #111128 100%)"
                : `linear-gradient(135deg, ${GOLD_DARK} 0%, #3D2800 100%)`,
            border: `1.5px solid ${GOLD}45`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: isDark
                ? `0 0 20px ${GOLD}20, inset 0 1px 0 rgba(255,255,255,0.05)`
                : `0 4px 16px ${GOLD}30, inset 0 1px 0 rgba(255,255,255,0.15)`,
            position: "relative", overflow: "hidden",
        }}
    >
        {/* Inner shimmer */}
        <div style={{
            position: "absolute", inset: 0,
            background: `linear-gradient(105deg, transparent 40%, rgba(201,168,76,0.10) 60%, transparent 80%)`,
            pointerEvents: "none",
        }} />
        <PesantrenMark size={22} color={GOLD_BRIGHT} glow={isDark} />
    </motion.div>
);

// ─────────────────────────────────────────────────────
// MAIN TITLE COMPONENT
// ─────────────────────────────────────────────────────
export const Title: React.FC<{ collapsed: boolean }> = ({ collapsed }) => {
    const { mode } = useColorMode();
    const isDark = mode === "dark";

    // Shimmer tick for subtle animation
    const [tick, setTick] = useState(false);
    useEffect(() => {
        const id = setInterval(() => setTick(t => !t), 3500);
        return () => clearInterval(id);
    }, []);

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 64,
                width: "100%",
                minWidth: "100%", // Added for stability
                boxSizing: "border-box", // Added for stability
                overflow: "hidden",
                padding: 0,
                position: "relative",
                background: isDark
                    ? "linear-gradient(180deg, rgba(13,13,26,0.98) 0%, rgba(8,8,15,0.95) 100%)"
                    : "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(247,244,238,0.95) 100%)",
                borderBottom: `1px solid ${isDark ? "rgba(201,168,76,0.10)" : "rgba(201,168,76,0.14)"}`,
            }}
        >
            {/* Top gold line */}
            <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 2,
                background: `linear-gradient(90deg, transparent 0%, ${GOLD} 30%, ${GOLD_BRIGHT} 70%, transparent 100%)`,
                opacity: 0.7,
            }} />

            {/* Ambient radial glow */}
            <div style={{
                position: "absolute", top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: 120, height: 120,
                background: `radial-gradient(circle, ${GOLD}14 0%, transparent 70%)`,
                pointerEvents: "none",
                transition: "all 0.3s cubic-bezier(0.22,1,0.36,1)",
            }} />

            {/* ── EXPANDED STATE ── */}
            <AnimatePresence mode="wait" initial={false}>
                {!collapsed ? (
                    <motion.div
                        key="expanded"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: { duration: 0.15 } }}
                        transition={{ duration: 0.3 }}
                        style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", justifyContent: "center", minWidth: 0 }}
                    >
                        {/* Logo container */}
                        <div style={{
                            width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                            background: isDark
                                ? "linear-gradient(135deg, #0D0D1A 0%, #111128 100%)"
                                : `linear-gradient(135deg, ${GOLD_DARK} 0%, #3D2800 100%)`,
                            border: `1.5px solid ${GOLD}45`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            boxShadow: isDark
                                ? `0 0 20px ${GOLD}15, inset 0 1px 0 rgba(255,255,255,0.05)`
                                : `0 4px 12px ${GOLD}25, inset 0 1px 0 rgba(255,255,255,0.15)`,
                            position: "relative", overflow: "hidden",
                        }}>
                            {/* Shimmer scan line */}
                            <div style={{
                                position: "absolute", top: 0, left: "-100%", right: 0,
                                height: "100%",
                                background: "linear-gradient(90deg, transparent, rgba(255,183,0,0.12), transparent)",
                                animation: "scanLine 3.5s linear infinite",
                                pointerEvents: "none",
                            }} />
                            <PesantrenMark size={24} color={GOLD_BRIGHT} glow={isDark} />
                        </div>

                        {/* Wordmark */}
                        <BrandWordmark isDark={isDark} />

                        {/* Version badge — removed/hidden if tight or simplified */}
                    </motion.div>
                ) : (
                    /* ── COLLAPSED STATE ── */
                    <motion.div key="collapsed">
                        <CollapsedBadge isDark={isDark} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
