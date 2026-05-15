import React, { useState, useEffect, useRef } from "react";
import type { RefineThemedLayoutV2HeaderProps } from "@refinedev/antd";
import { useGetIdentity, useLogout } from "@refinedev/core";
import {
    Layout as AntdLayout,
    Avatar,
    Typography,
    theme,
    Tooltip,
    Dropdown,
    MenuProps,
    Badge,
} from "antd";
import {
    LogoutOutlined,
    UserOutlined,
    InfoCircleOutlined,
    BulbOutlined,
    MoonOutlined,
    SettingOutlined,
    DashboardOutlined,
    SafetyCertificateOutlined,
    CaretDownOutlined,
    MenuFoldOutlined,
} from "@ant-design/icons";
import { motion, AnimatePresence } from "framer-motion";
import { useColorMode } from "../../contexts/color-mode";
import { IProfile } from "../../types";
import { formatHijri, formatMasehi } from "../../utility/dateHelper";

const { Text } = Typography;
const { useToken } = theme;

// ─────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────
const GOLD        = "#C9A84C";
const GOLD_BRIGHT = "#FFB700";
const GOLD_LIGHT  = "#FDE68A";
const GOLD_DEEP   = "#8B6914";
const GOLD_DARK   = "#5C430A";
const SUCCESS     = "#059669";
const DANGER      = "#DC2626";

// ─────────────────────────────────────────────────────
// LIVE CLOCK — ticks every second
// ─────────────────────────────────────────────────────
const LiveClock: React.FC<{ isDark: boolean }> = ({ isDark }) => {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");

    return (
        <div style={{
            display: "flex", alignItems: "baseline", gap: 1,
            fontFamily: "'DM Mono', monospace", fontWeight: 700,
            color: isDark ? GOLD_BRIGHT : GOLD_DEEP,
        }}>
            <span style={{ fontSize: 15, letterSpacing: "-0.02em" }}>{hh}:{mm}</span>
            <span style={{ fontSize: 11, opacity: 0.55, letterSpacing: "0" }}>:{ss}</span>
        </div>
    );
};

// ─────────────────────────────────────────────────────
// THEME TOGGLE BUTTON — premium pill
// ─────────────────────────────────────────────────────
const ThemeToggle: React.FC<{
    isDark: boolean;
    onToggle: () => void;
}> = ({ isDark, onToggle }) => (
    <Tooltip
        title={isDark ? "Beralih ke Mode Terang" : "Beralih ke Mode Gelap"}
        placement="bottom"
    >
        <button
            onClick={onToggle}
            style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "0 14px", height: 36, borderRadius: 99,
                border: `1px solid ${isDark ? "rgba(201,168,76,0.22)" : "rgba(201,168,76,0.28)"}`,
                background: isDark
                    ? "linear-gradient(135deg, rgba(255,183,0,0.08) 0%, rgba(255,183,0,0.04) 100%)"
                    : "linear-gradient(135deg, rgba(201,168,76,0.10) 0%, rgba(255,183,0,0.06) 100%)",
                cursor: "pointer",
                transition: "all 0.25s cubic-bezier(0.22,1,0.36,1)",
                boxShadow: isDark
                    ? `0 2px 12px rgba(255,183,0,0.10), inset 0 1px 0 rgba(255,255,255,0.03)`
                    : `0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.80)`,
                flexShrink: 0,
            }}
            aria-label="Toggle theme"
        >
            {/* Track */}
            <div style={{
                width: 30, height: 16, borderRadius: 99, position: "relative",
                background: isDark
                    ? `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})`
                    : "rgba(0,0,0,0.12)",
                transition: "background 0.3s",
                flexShrink: 0,
            }}>
                <motion.div
                    layout
                    transition={{ type: "spring", stiffness: 700, damping: 35 }}
                    style={{
                        position: "absolute", top: 2,
                        left: isDark ? "calc(100% - 14px)" : 2,
                        width: 12, height: 12, borderRadius: "50%",
                        background: isDark ? GOLD_BRIGHT : "#FFFFFF",
                        boxShadow: isDark ? `0 0 6px ${GOLD_BRIGHT}80` : "0 1px 4px rgba(0,0,0,0.2)",
                    }}
                />
            </div>

            {/* Icon + Label */}
            <AnimatePresence mode="wait" initial={false}>
                <motion.span
                    key={isDark ? "dark" : "light"}
                    initial={{ opacity: 0, scale: 0.7, rotate: -30 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.7, rotate: 30 }}
                    transition={{ duration: 0.25 }}
                    style={{
                        fontSize: 14,
                        lineHeight: 1,
                        color: isDark ? GOLD_BRIGHT : GOLD_DEEP,
                        flexShrink: 0,
                    }}
                >
                    {isDark ? <MoonOutlined /> : <BulbOutlined />}
                </motion.span>
            </AnimatePresence>

            <span style={{
                fontSize: 10, fontWeight: 800, letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: isDark ? GOLD_BRIGHT : GOLD_DEEP,
                fontFamily: "'Syne', sans-serif",
            }}>
                {isDark ? "Dark" : "Light"}
            </span>
        </button>
    </Tooltip>
);

// ─────────────────────────────────────────────────────
// DATE PANEL — Hijri + Masehi
// ─────────────────────────────────────────────────────
const DatePanel: React.FC<{ isDark: boolean }> = ({ isDark }) => {
    const hijri  = formatHijri(new Date());
    const masehi = formatMasehi(new Date());

    return (
        <Tooltip
            title={
                <div style={{ padding: "4px 0", maxWidth: 240 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4, color: GOLD_BRIGHT }}>
                        Catatan Penanggalan
                    </div>
                    <div style={{ fontSize: 11, lineHeight: 1.6, opacity: 0.8 }}>
                        Penanggalan Hijriah berdasarkan perhitungan hisab sistem.
                        Mungkin terdapat selisih ±1 hari dengan ketetapan resmi rukyat.
                    </div>
                </div>
            }
            placement="bottomRight"
            color={isDark ? "#141424" : "#FFFFFF"}
            overlayInnerStyle={{
                borderRadius: 12,
                border: `1px solid ${isDark ? "rgba(201,168,76,0.14)" : "rgba(0,0,0,0.06)"}`,
                padding: "10px 14px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.20)",
            }}
        >
            <div
                style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "0 14px", height: 36, borderRadius: 12, cursor: "help",
                    border: `1px solid ${isDark ? "rgba(201,168,76,0.12)" : "rgba(201,168,76,0.18)"}`,
                    background: isDark
                        ? "rgba(255,183,0,0.04)"
                        : "rgba(201,168,76,0.05)",
                    transition: "all 0.2s",
                }}
            >
                {/* Hijri */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                    <span style={{
                        fontFamily: "'DM Mono', monospace",
                        fontWeight: 700, fontSize: 12, lineHeight: 1,
                        color: isDark ? GOLD_BRIGHT : GOLD_DEEP,
                        letterSpacing: "-0.01em",
                    }}>
                        {hijri}
                    </span>
                    <span style={{
                        fontSize: 8, fontWeight: 700, letterSpacing: "0.12em",
                        textTransform: "uppercase", marginTop: 2, lineHeight: 1,
                        color: isDark ? "rgba(255,183,0,0.40)" : "rgba(139,105,20,0.50)",
                        fontFamily: "'DM Sans', sans-serif",
                    }}>
                        HIJRIAH
                    </span>
                </div>

                {/* Divider */}
                <div style={{
                    width: 1, height: 22,
                    background: isDark ? "rgba(201,168,76,0.18)" : "rgba(201,168,76,0.25)",
                }} />

                {/* Live Clock */}
                <div style={{ minWidth: 50, display: "flex", justifyContent: "center" }}>
                    <LiveClock isDark={isDark} />
                </div>

                {/* Divider */}
                <div style={{
                    width: 1, height: 22,
                    background: isDark ? "rgba(201,168,76,0.18)" : "rgba(201,168,76,0.25)",
                }} />

                {/* Masehi */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                    <span style={{
                        fontFamily: "'DM Mono', monospace",
                        fontWeight: 600, fontSize: 11, lineHeight: 1,
                        color: isDark ? "rgba(240,237,229,0.70)" : "rgba(10,8,5,0.55)",
                        letterSpacing: "-0.01em",
                    }}>
                        {masehi}
                    </span>
                    <span style={{
                        fontSize: 8, fontWeight: 700, letterSpacing: "0.12em",
                        textTransform: "uppercase", marginTop: 2, lineHeight: 1,
                        color: isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.28)",
                        fontFamily: "'DM Sans', sans-serif",
                    }}>
                        MASEHI
                    </span>
                </div>

                {/* Info icon */}
                <InfoCircleOutlined style={{
                    fontSize: 10,
                    color: isDark ? "rgba(201,168,76,0.35)" : "rgba(139,105,20,0.45)",
                    flexShrink: 0,
                }} />
            </div>
        </Tooltip>
    );
};

// ─────────────────────────────────────────────────────
// USER DROPDOWN MENU
// ─────────────────────────────────────────────────────
const UserMenu: React.FC<{
    user: IProfile | undefined;
    isDark: boolean;
    logout: () => void;
}> = ({ user, isDark, logout }) => {
    const initials = (user?.full_name || user?.email || "A")
        .split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

    const menuItems: MenuProps["items"] = [
        {
            key: "profile-info",
            label: (
                <div style={{
                    padding: "12px 4px 10px",
                    borderBottom: `1px solid ${isDark ? "rgba(201,168,76,0.10)" : "rgba(201,168,76,0.14)"}`,
                    cursor: "default",
                    pointerEvents: "none",
                }}>
                    <div style={{
                        fontFamily: "'Syne', sans-serif", fontWeight: 800,
                        fontSize: 14, letterSpacing: "-0.02em",
                        color: isDark ? "#F0EDE5" : "#0A0805",
                    }}>
                        {user?.full_name || "Administrator"}
                    </div>
                    <div style={{
                        fontSize: 11, marginTop: 3,
                        color: isDark ? "#5C5248" : "#9E9080",
                        fontFamily: "'DM Mono', monospace",
                    }}>
                        {user?.email || "admin@alhasanah.id"}
                    </div>
                    {/* Role badge */}
                    <div style={{
                        marginTop: 8, display: "inline-flex",
                        alignItems: "center", gap: 5,
                        padding: "3px 10px", borderRadius: 99,
                        background: `linear-gradient(135deg, ${GOLD}18, ${GOLD_BRIGHT}12)`,
                        border: `1px solid ${GOLD}28`,
                        fontSize: 9, fontWeight: 800, letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: isDark ? GOLD_BRIGHT : GOLD_DEEP,
                        fontFamily: "'Syne', sans-serif",
                    }}>
                        <SafetyCertificateOutlined />
                        {user?.role || "Pengurus"}
                    </div>
                </div>
            ),
            disabled: true,
        },
        { type: "divider" },
        {
            key: "dashboard",
            icon: <DashboardOutlined style={{ color: isDark ? "#9E9080" : "#6B5F50" }} />,
            label: <span style={{ fontSize: 13, fontWeight: 500 }}>Dashboard Utama</span>,
        },
        {
            key: "settings",
            icon: <SettingOutlined style={{ color: isDark ? "#9E9080" : "#6B5F50" }} />,
            label: <span style={{ fontSize: 13, fontWeight: 500 }}>Pengaturan Akun</span>,
        },
        { type: "divider" },
        {
            key: "logout",
            icon: <LogoutOutlined style={{ color: DANGER }} />,
            label: (
                <span style={{ color: DANGER, fontWeight: 700, fontSize: 13 }}>
                    Keluar dari Sistem
                </span>
            ),
            onClick: () => logout(),
        },
    ];

    return (
        <Dropdown
            menu={{ items: menuItems }}
            trigger={["click"]}
            placement="bottomRight"
            overlayStyle={{ minWidth: 240 }}
            dropdownRender={menu => (
                <div style={{
                    borderRadius: 16, overflow: "hidden",
                    border: `1px solid ${isDark ? "rgba(201,168,76,0.12)" : "rgba(201,168,76,0.16)"}`,
                    background: isDark ? "#0F0F1A" : "#FFFFFF",
                    boxShadow: isDark
                        ? "0 20px 60px rgba(0,0,0,0.70)"
                        : "0 16px 48px rgba(0,0,0,0.14)",
                    padding: "4px 8px 8px",
                }}>
                    {menu}
                </div>
            )}
        >
            <button
                style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "4px 4px 4px 4px", height: 44, borderRadius: 12,
                    border: `1px solid ${isDark ? "rgba(201,168,76,0.14)" : "rgba(201,168,76,0.18)"}`,
                    background: isDark
                        ? "rgba(255,255,255,0.02)"
                        : "rgba(201,168,76,0.04)",
                    cursor: "pointer",
                    transition: "all 0.2s cubic-bezier(0.22,1,0.36,1)",
                    paddingLeft: 6, paddingRight: 12,
                }}
                aria-label="User menu"
            >
                {/* Avatar */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                    <Avatar
                        size={34}
                        src={user?.foto_url}
                        style={{
                            background: `linear-gradient(135deg, ${GOLD_DARK}, ${GOLD})`,
                            border: `2px solid ${GOLD}50`,
                            boxShadow: isDark ? `0 0 14px ${GOLD}25` : `0 2px 8px ${GOLD}30`,
                            fontSize: 12, fontWeight: 800,
                            fontFamily: "'Syne', sans-serif",
                            color: "#000",
                            display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                        icon={!user?.foto_url ? undefined : <UserOutlined />}
                    >
                        {!user?.foto_url && initials}
                    </Avatar>
                    {/* Online indicator */}
                    <div style={{
                        position: "absolute", bottom: 0, right: 0,
                        width: 8, height: 8, borderRadius: "50%",
                        background: SUCCESS,
                        border: `1.5px solid ${isDark ? "#0F0F1A" : "#FFFFFF"}`,
                        boxShadow: `0 0 4px ${SUCCESS}`,
                    }} />
                </div>

                {/* User info — hidden on xs */}
                <div
                    className="hidden sm:flex"
                    style={{ flexDirection: "column", alignItems: "flex-start", gap: 1 }}
                >
                    <span style={{
                        fontFamily: "'Syne', sans-serif", fontWeight: 700,
                        fontSize: 13, letterSpacing: "-0.01em",
                        color: isDark ? "#F0EDE5" : "#0A0805",
                        whiteSpace: "nowrap", maxWidth: 120,
                        overflow: "hidden", textOverflow: "ellipsis",
                        lineHeight: 1.2,
                    }}>
                        {user?.full_name || user?.email || "Administrator"}
                    </span>
                    <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: isDark ? "rgba(201,168,76,0.55)" : GOLD_DEEP,
                        fontFamily: "'DM Sans', sans-serif",
                        lineHeight: 1,
                    }}>
                        {user?.role || "Pengurus"}
                    </span>
                </div>

                {/* Chevron */}
                <CaretDownOutlined style={{
                    fontSize: 10,
                    color: isDark ? "rgba(201,168,76,0.45)" : GOLD_DEEP,
                    flexShrink: 0,
                    transition: "transform 0.2s",
                }} />
            </button>
        </Dropdown>
    );
};

// ─────────────────────────────────────────────────────
// SYSTEM STATUS DOT
// ─────────────────────────────────────────────────────
const SystemStatus: React.FC<{ isDark: boolean }> = ({ isDark }) => (
    <Tooltip title="Sistem aktif dan berjalan normal" placement="bottom">
        <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "0 12px", height: 32, borderRadius: 99,
            background: isDark ? "rgba(5,150,105,0.08)" : "rgba(5,150,105,0.07)",
            border: "1px solid rgba(5,150,105,0.20)",
            cursor: "default", flexShrink: 0,
        }}>
            <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "#10B981",
                boxShadow: "0 0 6px rgba(16,185,129,0.7)",
                animation: "dotPulse 2s ease-in-out infinite",
                flexShrink: 0,
            }} />
            <span style={{
                fontSize: 9, fontWeight: 800, letterSpacing: "0.12em",
                textTransform: "uppercase", color: "#10B981",
                fontFamily: "'Syne', sans-serif",
            }}>
                Online
            </span>
        </div>
    </Tooltip>
);

// ─────────────────────────────────────────────────────
// MAIN HEADER COMPONENT
// ─────────────────────────────────────────────────────
export const Header: React.FC<RefineThemedLayoutV2HeaderProps> = ({ sticky }) => {
    const { token } = useToken();
    const { data: user } = useGetIdentity<IProfile>();
    const { mutate: logout } = useLogout();
    const { mode, setMode } = useColorMode();
    const isDark = mode === "dark";

    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handler = () => setScrolled(window.scrollY > 8);
        window.addEventListener("scroll", handler, { passive: true });
        return () => window.removeEventListener("scroll", handler);
    }, []);

    const toggleMode = () => setMode(isDark ? "light" : "dark");

    return (
        <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            style={{
                position: sticky ? "sticky" : "relative",
                top: 0,
                zIndex: 999,
                width: "100%",
            }}
        >
            <AntdLayout.Header
                style={{
                    /* ── Glass / frosted effect ── */
                    backgroundColor: isDark
                        ? scrolled ? "rgba(9,9,15,0.92)" : "rgba(9,9,15,0.98)"
                        : scrolled ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.98)",
                    backdropFilter: "blur(20px) saturate(180%)",
                    WebkitBackdropFilter: "blur(20px) saturate(180%)",

                    borderBottom: `1px solid ${isDark
                        ? "rgba(201,168,76,0.09)"
                        : "rgba(201,168,76,0.14)"}`,
                    boxShadow: scrolled
                        ? isDark
                            ? "0 4px 32px rgba(0,0,0,0.55), 0 1px 0 rgba(201,168,76,0.07)"
                            : "0 4px 24px rgba(0,0,0,0.07), 0 1px 0 rgba(201,168,76,0.10)"
                        : "none",

                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0 24px",
                    height: 64,
                    transition: "background-color 0.3s, box-shadow 0.3s",
                }}
            >
                {/* ════════════════════════
                    LEFT — Brand Identity
                ════════════════════════ */}
                <motion.div
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
                    style={{ display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}
                >
                    {/* Pesantren name */}
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{
                            fontFamily: "'Syne', sans-serif",
                            fontWeight: 800,
                            fontSize: "clamp(13px, 2vw, 16px)",
                            letterSpacing: "-0.02em",
                            lineHeight: 1.1,
                            whiteSpace: "nowrap",
                            background: isDark
                                ? `linear-gradient(90deg, ${GOLD_LIGHT} 0%, ${GOLD_BRIGHT} 40%, ${GOLD} 70%, ${GOLD_LIGHT} 100%)`
                                : `linear-gradient(90deg, ${GOLD_DARK} 0%, ${GOLD_DEEP} 35%, ${GOLD} 65%, ${GOLD_DARK} 100%)`,
                            backgroundSize: "200% auto",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            backgroundClip: "text",
                            animation: "goldShimmer 6s linear infinite",
                        }}>
                            Pondok Pesantren Al-Hasanah
                        </span>
                    </div>

                    {/* Sub info row */}
                    <div
                        className="hidden sm:flex"
                        style={{ 
                            alignItems: "center", 
                            gap: 8, 
                            marginTop: 2,
                            maxWidth: "clamp(200px, 40vw, 600px)", // Prevents it from pushing too far
                            overflow: "hidden"
                        }}
                    >
                        <span style={{
                            width: 3, height: 3, borderRadius: "50%",
                            background: isDark ? GOLD_BRIGHT : GOLD_DEEP,
                            flexShrink: 0, opacity: 0.7,
                        }} />
                        <span style={{
                            fontSize: 10, fontWeight: 600,
                            color: isDark ? "rgba(255,183,0,0.45)" : "rgba(139,105,20,0.60)",
                            fontFamily: "'DM Sans', sans-serif",
                            whiteSpace: "nowrap", 
                            letterSpacing: "0.01em",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "block"
                        }}>
                            Jl. Raya Cibeuti No.13, Cibeuti, Kec. Kawalu, Kab. Tasikmalaya • Jawa Barat
                        </span>
                    </div>
                </motion.div>

                {/* ════════════════════════
                    RIGHT — Controls
                ════════════════════════ */}
                <motion.div
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.12 }}
                    style={{
                        display: "flex", alignItems: "center",
                        gap: window.innerWidth < 640 ? 8 : 10,
                        flexShrink: 0,
                    }}
                >
                    {/* ── Date Panel ── */}
                    <div className="hidden md:block">
                        <DatePanel isDark={isDark} />
                    </div>

                    {/* ── Vertical Divider ── */}
                    <div
                        className="hidden sm:block"
                        style={{
                            width: 1, height: 28,
                            background: isDark ? "rgba(201,168,76,0.10)" : "rgba(201,168,76,0.18)",
                            flexShrink: 0,
                        }}
                    />

                    {/* ── System Status ── */}
                    <div className="hidden lg:block">
                        <SystemStatus isDark={isDark} />
                    </div>

                    {/* ── Theme Toggle ── */}
                    <ThemeToggle isDark={isDark} onToggle={toggleMode} />

                    {/* ── Vertical Divider ── */}
                    <div style={{
                        width: 1, height: 28,
                        background: isDark ? "rgba(201,168,76,0.10)" : "rgba(201,168,76,0.18)",
                        flexShrink: 0,
                    }} />

                    {/* ── User Menu ── */}
                    <UserMenu user={user} isDark={isDark} logout={logout} />
                </motion.div>
            </AntdLayout.Header>
        </motion.div>
    );
};
