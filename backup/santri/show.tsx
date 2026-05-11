import React, { useRef } from "react";
import { useShow, useNavigation } from "@refinedev/core";
import {
    Typography, Card, Row, Col, Avatar, Tag, Button,
    Skeleton, theme, Space, Tooltip, Divider, Progress,
} from "antd";
import { motion, Variants } from "framer-motion";
import {
    PrinterOutlined, ArrowLeftOutlined, UserOutlined,
    WhatsAppOutlined, HomeOutlined, BookOutlined,
    QrcodeOutlined, EnvironmentOutlined, TeamOutlined,
    MailOutlined, TrophyOutlined, ManOutlined, WomanOutlined,
    PhoneOutlined, IdcardOutlined, StarOutlined, EditOutlined,
    SafetyCertificateOutlined, CalendarOutlined,
    CheckCircleOutlined, ClockCircleOutlined,
    BankOutlined, NumberOutlined, CrownOutlined,
    AimOutlined, RocketOutlined,
} from "@ant-design/icons";
import { QRCodeCanvas } from "qrcode.react";
import dayjs from "dayjs";
import "dayjs/locale/id";
import { useReactToPrint } from "react-to-print";
import { formatHijri, formatMasehi } from "../../utility/dateHelper";

const { Text, Title } = Typography;
const { useToken } = theme;

dayjs.locale("id");

// ═══════════════════════════════════════════════════════════════
// DESIGN TOKENS — Konsisten dengan App.tsx & index.css
// ═══════════════════════════════════════════════════════════════
const GOLD         = "#C9A84C";
const GOLD_BRIGHT  = "#FFB700";
const GOLD_LIGHT   = "#FDE68A";
const GOLD_DEEP    = "#8B6914";
const GOLD_DARK    = "#5C430A";
const SUCCESS      = "#059669";
const DANGER       = "#DC2626";
const INFO         = "#2563EB";
const PURPLE       = "#7C3AED";
const G            = (o: number) => `rgba(201,168,76,${o})`;

// ═══════════════════════════════════════════════════════════════
// ANIMATION VARIANTS
// ═══════════════════════════════════════════════════════════════
const fadeUp: Variants = {
    hidden:  { opacity: 0, y: 20 },
    visible: (i = 0) => ({
        opacity: 1, y: 0,
        transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: i * 0.07 },
    }),
};
const fadeLeft: Variants = {
    hidden:  { opacity: 0, x: -20 },
    visible: (i = 0) => ({
        opacity: 1, x: 0,
        transition: { duration: 0.48, ease: [0.22, 1, 0.36, 1], delay: i * 0.07 },
    }),
};
const fadeRight: Variants = {
    hidden:  { opacity: 0, x: 20 },
    visible: (i = 0) => ({
        opacity: 1, x: 0,
        transition: { duration: 0.48, ease: [0.22, 1, 0.36, 1], delay: i * 0.07 },
    }),
};
const stagger: Variants = { visible: { transition: { staggerChildren: 0.07 } } };

// ═══════════════════════════════════════════════════════════════
// HELPER: INFO ROW
// ✅ FIX: Menggunakan token.colorText / colorTextSecondary
//        bukan hardcoded '#222' yang invisible di dark mode
// ═══════════════════════════════════════════════════════════════
const InfoRow: React.FC<{
    label: string;
    value: React.ReactNode;
    icon?: React.ReactNode;
    mono?: boolean;
    isDark: boolean;
    token: ReturnType<typeof useToken>["token"];
}> = ({ label, value, icon, mono = false, isDark, token: tk }) => (
    <div
        style={{
            display: "grid",
            gridTemplateColumns: "148px 1fr",
            gap: 8,
            padding: "9px 10px",
            alignItems: "start",
            borderRadius: 8,
            transition: "background 0.18s",
            cursor: "default",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = G(isDark ? 0.07 : 0.05))}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
        <div style={{
            display: "flex", alignItems: "center", gap: 6,
            fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: isDark ? G(0.80) : GOLD_DEEP,
            fontFamily: "'DM Sans', sans-serif",
            paddingTop: 1,
        }}>
            {icon && <span style={{ fontSize: 11, opacity: 0.8, flexShrink: 0 }}>{icon}</span>}
            {label}
        </div>
        <div style={{
            fontSize: 13.5,
            // ✅ FIX: token.colorText — reaktif dark/light, tidak hardcoded
            color: tk.colorText,
            fontFamily: mono ? "'DM Mono', monospace" : undefined,
            fontWeight: 500,
            lineHeight: 1.5,
        }}>
            {value !== undefined && value !== null && value !== ""
                ? value
                : <span style={{ color: tk.colorTextTertiary, fontStyle: "italic", fontSize: 12 }}>—</span>
            }
        </div>
    </div>
);

// ═══════════════════════════════════════════════════════════════
// SECTION HEADER
// ═══════════════════════════════════════════════════════════════
const SectionHeader: React.FC<{
    icon: React.ReactNode;
    title: string;
    isDark: boolean;
    subtitle?: string;
}> = ({ icon, title, isDark, subtitle }) => (
    <div style={{
        display: "flex", alignItems: "center", gap: 12,
        marginBottom: 16, paddingBottom: 12,
        borderBottom: `1px solid ${G(isDark ? 0.14 : 0.10)}`,
    }}>
        <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: `linear-gradient(135deg, ${G(0.20)}, ${G(0.35)})`,
            border: `1px solid ${G(0.25)}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, color: GOLD_BRIGHT,
            boxShadow: `0 3px 12px ${G(0.22)}`,
        }}>
            {icon}
        </div>
        <div>
            <div style={{
                fontFamily: "'Syne', sans-serif",
                fontWeight: 800, fontSize: 14,
                letterSpacing: "-0.01em",
                color: isDark ? "#F0EDE5" : "#0A0805",
                lineHeight: 1.2,
            }}>
                {title}
            </div>
            {subtitle && (
                <div style={{ fontSize: 11, color: isDark ? "#5C5248" : "#9E9080", marginTop: 2 }}>
                    {subtitle}
                </div>
            )}
        </div>
        <div style={{
            flex: 1, height: 1, marginLeft: 4,
            background: `linear-gradient(90deg, ${G(0.25)} 0%, transparent 100%)`,
        }} />
    </div>
);

// ═══════════════════════════════════════════════════════════════
// METRIC BOX
// ═══════════════════════════════════════════════════════════════
const MetricBox: React.FC<{
    icon: React.ReactNode; label: string; value: React.ReactNode;
    color: string; isDark: boolean;
}> = ({ icon, label, value, color, isDark }) => (
    <div style={{
        flex: 1,
        background: isDark ? `${color}12` : `${color}0D`,
        borderRadius: 14, padding: "14px 12px",
        border: `1px solid ${color}28`,
        display: "flex", flexDirection: "column",
        alignItems: "center", gap: 6, textAlign: "center",
        transition: "all 0.25s cubic-bezier(0.22,1,0.36,1)",
    }}>
        <div style={{
            width: 38, height: 38, borderRadius: 11,
            background: `${color}18`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, color,
        }}>
            {icon}
        </div>
        <div style={{
            fontSize: 9, fontWeight: 800, color,
            letterSpacing: "0.10em", textTransform: "uppercase",
            fontFamily: "'Syne', sans-serif",
        }}>
            {label}
        </div>
        <div style={{
            fontSize: 22, fontWeight: 800, color,
            fontFamily: "'Syne', sans-serif",
            letterSpacing: "-0.03em", lineHeight: 1,
        }}>
            {value}
        </div>
    </div>
);

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export const SantriShow = () => {
    const { token } = useToken();
    const { list, edit } = useNavigation();

    // ── Dark mode detection ──────────────────────────────────
    const bg   = token.colorBgContainer;
    const isDark = (() => {
        const c = bg.replace("#", "");
        if (c.length < 6) return false;
        const lum = 0.299 * parseInt(c.slice(0,2),16)
                  + 0.587 * parseInt(c.slice(2,4),16)
                  + 0.114 * parseInt(c.slice(4,6),16);
        return lum < 128;
    })();

    // ── Fetch ────────────────────────────────────────────────
    const { queryResult } = useShow({ meta: { select: "*, profiles:wali_id(*)" } });
    const { data, isLoading } = queryResult;
    const record = data?.data;

    // ── Print ────────────────────────────────────────────────
    const componentRef = useRef<HTMLDivElement>(null);
    const handlePrint  = useReactToPrint({
        contentRef:    componentRef,
        documentTitle: `Biodata_Santri_${record?.nama || "Print"}`,
    });

    // ── Loading ──────────────────────────────────────────────
    if (isLoading || !record) {
        return (
            <Card bordered={false} style={{
                borderRadius: 20,
                border: `1px solid ${G(0.14)}`,
                background: token.colorBgContainer,
            }}>
                <Skeleton avatar={{ size: 110 }} active paragraph={{ rows: 10 }} />
            </Card>
        );
    }

    // ── Computed values ──────────────────────────────────────
    const waliData     = record.profiles || {};
    const isMale       = record.jenis_kelamin === "L";
    const isAktif      = record.status_santri === "AKTIF";
    const waPhone      = (waliData.no_hp || record.no_kontak_wali)?.replace(/^0/, "62");
    const hafalanJuz   = Number(record.total_hafalan || 0);
    const hafalanPct   = Math.min(Math.round((hafalanJuz / 30) * 100), 100);

    const STATUS_MAP: Record<string, { label: string; color: string; bg: string; border: string }> = {
        AKTIF:  { label: "Aktif",  color: SUCCESS, bg: `${SUCCESS}18`, border: `${SUCCESS}35` },
        LULUS:  { label: "Lulus",  color: INFO,    bg: `${INFO}18`,    border: `${INFO}35` },
        KELUAR: { label: "Keluar", color: DANGER,  bg: `${DANGER}18`, border: `${DANGER}35` },
        ALUMNI: { label: "Alumni", color: GOLD_BRIGHT, bg: G(0.14), border: G(0.30) },
    };
    const statusCfg = STATUS_MAP[record.status_santri] ?? STATUS_MAP.AKTIF;

    // ── Shared card style ────────────────────────────────────
    const cardStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
        borderRadius: 20,
        border: `1px solid ${G(isDark ? 0.12 : 0.13)}`,
        background: token.colorBgContainer,
        boxShadow: isDark
            ? `0 6px 28px rgba(0,0,0,0.38), 0 0 0 1px ${G(0.07)}`
            : `0 4px 20px ${G(0.08)}, 0 2px 6px rgba(0,0,0,0.04)`,
        ...extra,
    });

    // ════════════════════════════════════════════════════════
    return (
        <motion.div
            initial="hidden" animate="visible" variants={stagger}
            style={{ display: "flex", flexDirection: "column", gap: 20, paddingBottom: 80 }}
        >

            {/* ══════════════════════════════════════════════
                ACTION BAR
            ══════════════════════════════════════════════ */}
            <motion.div variants={fadeUp} style={{
                display: "flex", alignItems: "center",
                justifyContent: "space-between", flexWrap: "wrap", gap: 12,
                paddingBottom: 20,
                borderBottom: `1px solid ${G(isDark ? 0.10 : 0.12)}`,
            }}>
                {/* Left */}
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <button
                        onClick={() => list("santri")}
                        style={{
                            display: "flex", alignItems: "center", gap: 7,
                            padding: "0 16px", height: 38, borderRadius: 11,
                            border: `1px solid ${G(isDark ? 0.22 : 0.28)}`,
                            background: G(isDark ? 0.07 : 0.05),
                            color: isDark ? GOLD_LIGHT : GOLD_DEEP,
                            cursor: "pointer", fontSize: 13, fontWeight: 700,
                            transition: "all 0.2s",
                            fontFamily: "'DM Sans', sans-serif",
                        }}
                    >
                        <ArrowLeftOutlined style={{ fontSize: 13 }} />
                        Kembali
                    </button>

                    {/* Breadcrumb */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, color: token.colorTextTertiary }}>Data Santri</span>
                        <span style={{ fontSize: 11, color: token.colorTextTertiary }}>/</span>
                        <span style={{
                            fontSize: 11, fontWeight: 700,
                            color: isDark ? GOLD_BRIGHT : GOLD_DEEP,
                        }}>
                            {record.nama}
                        </span>
                    </div>
                </div>

                {/* Right */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                        onClick={() => edit("santri", record.nis)}
                        style={{
                            display: "flex", alignItems: "center", gap: 7,
                            padding: "0 16px", height: 38, borderRadius: 11,
                            border: `1px solid rgba(37,99,235,0.28)`,
                            background: isDark ? "rgba(37,99,235,0.08)" : "rgba(37,99,235,0.05)",
                            color: INFO, cursor: "pointer", fontSize: 13, fontWeight: 700,
                            transition: "all 0.2s",
                            fontFamily: "'DM Sans', sans-serif",
                        }}
                    >
                        <EditOutlined />
                        Edit Data
                    </button>

                    <button
                        onClick={handlePrint}
                        style={{
                            display: "flex", alignItems: "center", gap: 7,
                            padding: "0 20px", height: 38, borderRadius: 11, border: "none",
                            background: `linear-gradient(135deg, ${GOLD}, ${GOLD_BRIGHT})`,
                            color: "#000", cursor: "pointer", fontSize: 13, fontWeight: 800,
                            boxShadow: `0 4px 18px ${G(0.42)}`,
                            transition: "all 0.2s",
                            fontFamily: "'DM Sans', sans-serif",
                        }}
                    >
                        <PrinterOutlined />
                        Cetak Biodata
                    </button>
                </div>
            </motion.div>

            {/* ══════════════════════════════════════════════
                MAIN LAYOUT
            ══════════════════════════════════════════════ */}
            <Row gutter={[20, 20]}>

                {/* ── LEFT COLUMN ── */}
                <Col xs={24} md={8} lg={7}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                        {/* ── PROFILE CARD ── */}
                        <motion.div custom={0} variants={fadeLeft}>
                            <Card bordered={false} bodyStyle={{ padding: 0 }}
                                style={{ ...cardStyle(), overflow: "hidden" }}>

                                {/* Cover Banner */}
                                <div style={{
                                    height: 96,
                                    background: isDark
                                        ? `linear-gradient(135deg, ${G(0.28)} 0%, ${G(0.10)} 60%, transparent 100%)`
                                        : `linear-gradient(135deg, #F8F0D0 0%, #FFF2B8 50%, #FDF6DC 100%)`,
                                    position: "relative", overflow: "hidden",
                                }}>
                                    {/* Geo rings */}
                                    <div style={{
                                        position: "absolute", top: -24, right: -24,
                                        width: 130, height: 130, borderRadius: "50%",
                                        border: `1.5px solid ${G(isDark ? 0.25 : 0.18)}`,
                                    }} />
                                    <div style={{
                                        position: "absolute", top: -8, right: -8,
                                        width: 80, height: 80, borderRadius: "50%",
                                        border: `1px solid ${G(isDark ? 0.15 : 0.12)}`,
                                    }} />
                                    {/* Gold scan line */}
                                    <div style={{
                                        position: "absolute", inset: 0,
                                        background: `linear-gradient(105deg, transparent 40%, ${G(0.08)} 60%, transparent 80%)`,
                                        animation: "scanLine 3.5s linear infinite",
                                        pointerEvents: "none",
                                    }} />
                                    {/* Institution label */}
                                    <div style={{
                                        position: "absolute", top: 10, left: 12,
                                        display: "flex", alignItems: "center", gap: 5,
                                    }}>
                                        <BankOutlined style={{ color: isDark ? GOLD_LIGHT : GOLD_DEEP, fontSize: 11 }} />
                                        <span style={{
                                            fontSize: 9, fontWeight: 800,
                                            color: isDark ? GOLD_LIGHT : GOLD_DEEP,
                                            letterSpacing: "0.12em", textTransform: "uppercase",
                                            fontFamily: "'Syne', sans-serif",
                                        }}>
                                            Al-Hasanah
                                        </span>
                                    </div>
                                    {/* Gender badge */}
                                    <div style={{
                                        position: "absolute", top: 10, right: 12,
                                        background: isMale ? "rgba(2,132,199,0.14)" : "rgba(219,39,119,0.12)",
                                        border: `1px solid ${isMale ? "rgba(2,132,199,0.28)" : "rgba(219,39,119,0.22)"}`,
                                        borderRadius: 99, padding: "2px 10px",
                                        display: "flex", alignItems: "center", gap: 4,
                                    }}>
                                        {isMale
                                            ? <ManOutlined style={{ color: "#0284c7", fontSize: 10 }} />
                                            : <WomanOutlined style={{ color: "#db2777", fontSize: 10 }} />}
                                        <span style={{
                                            fontSize: 9.5, fontWeight: 700,
                                            color: isMale ? "#0284c7" : "#db2777",
                                        }}>
                                            {isMale ? "Laki-laki" : "Perempuan"}
                                        </span>
                                    </div>
                                </div>

                                {/* ✅ FIX: Avatar TIDAK menggunakan position:absolute overflow
                                    Sebagai gantinya pakai margin-top negatif pada wrapper
                                    sehingga foto tidak terpotong */}
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                    {/* Avatar wrapper dengan margin-top negatif */}
                                    <div style={{
                                        marginTop: -48,
                                        padding: 4,
                                        background: token.colorBgContainer,
                                        borderRadius: "50%",
                                        boxShadow: `0 0 0 3px ${G(0.35)}, 0 4px 20px rgba(0,0,0,0.18)`,
                                        // ✅ FIX: overflow visible agar foto tidak terpotong
                                        overflow: "visible",
                                        flexShrink: 0,
                                    }}>
                                        <Avatar
                                            size={100}
                                            src={record.foto_url}
                                            icon={!record.foto_url ? <UserOutlined /> : undefined}
                                            style={{
                                                display: "block",
                                                border: `3px solid ${token.colorBgContainer}`,
                                                background: isMale
                                                    ? (isDark ? "rgba(2,132,199,0.20)" : "#e0f2fe")
                                                    : (isDark ? "rgba(219,39,119,0.16)" : "#fce7f3"),
                                                color: isMale ? "#0284c7" : "#db2777",
                                                fontSize: 38,
                                                // ✅ FIX: objectFit cover agar foto proporsional
                                                objectFit: "cover",
                                            }}
                                        />
                                    </div>

                                    {/* Profile info */}
                                    <div style={{ padding: "14px 20px 20px", textAlign: "center", width: "100%" }}>
                                        <h2 style={{
                                            fontFamily: "'Syne', sans-serif",
                                            fontSize: 16.5, fontWeight: 800, margin: "0 0 3px",
                                            color: token.colorText, letterSpacing: "-0.02em", lineHeight: 1.3,
                                        }}>
                                            {record.nama}
                                        </h2>
                                        <div style={{
                                            fontFamily: "'DM Mono', monospace",
                                            fontSize: 12, fontWeight: 600,
                                            color: isDark ? GOLD_BRIGHT : GOLD_DEEP,
                                            letterSpacing: "0.14em", marginBottom: 12,
                                        }}>
                                            {record.nis}
                                        </div>

                                        {/* Status badge */}
                                        <div style={{
                                            display: "inline-flex", alignItems: "center", gap: 5,
                                            padding: "5px 16px", borderRadius: 99,
                                            background: statusCfg.bg,
                                            border: `1px solid ${statusCfg.border}`,
                                            marginBottom: 18,
                                        }}>
                                            {isAktif && <CheckCircleOutlined style={{ fontSize: 11, color: statusCfg.color }} />}
                                            <span style={{
                                                fontSize: 11, fontWeight: 800,
                                                color: statusCfg.color, letterSpacing: "0.08em",
                                                fontFamily: "'Syne', sans-serif",
                                            }}>
                                                {statusCfg.label}
                                            </span>
                                        </div>

                                        <Divider style={{ margin: "0 0 14px", borderColor: G(isDark ? 0.14 : 0.10) }} />

                                        {/* ✅ FIX: Quick stats — Kelas / Takhasus / Status dalam grid
                                            Tidak menggunakan overflow hidden yang memotong */}
                                        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                                            {/* Kelas */}
                                            <div style={{
                                                flex: 1,
                                                background: G(isDark ? 0.10 : 0.07),
                                                borderRadius: 12, padding: "10px 6px",
                                                border: `1px solid ${G(isDark ? 0.20 : 0.14)}`,
                                            }}>
                                                <div style={{ fontSize: 8.5, fontWeight: 800, textTransform: "uppercase",
                                                    letterSpacing: "0.08em", marginBottom: 4,
                                                    color: isDark ? G(0.75) : GOLD_DEEP }}>Kelas</div>
                                                <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1,
                                                    fontFamily: "'Syne', sans-serif",
                                                    color: isDark ? GOLD_BRIGHT : GOLD_DEEP }}>
                                                    {record.kelas}
                                                </div>
                                            </div>

                                            {/* Takhasus */}
                                            <div style={{
                                                flex: 1.5,
                                                background: record.jurusan === "TAHFIDZ"
                                                    ? (isDark ? "rgba(99,102,241,0.12)" : "#EEF2FF")
                                                    : G(isDark ? 0.10 : 0.07),
                                                borderRadius: 12, padding: "10px 8px",
                                                border: `1px solid ${record.jurusan === "TAHFIDZ" ? "rgba(99,102,241,0.22)" : G(isDark ? 0.20 : 0.14)}`,
                                            }}>
                                                <div style={{ fontSize: 8.5, fontWeight: 800, textTransform: "uppercase",
                                                    letterSpacing: "0.08em", marginBottom: 4,
                                                    color: record.jurusan === "TAHFIDZ" ? "#6366f1" : (isDark ? G(0.75) : GOLD_DEEP) }}>
                                                    Takhasus
                                                </div>
                                                <div style={{ fontSize: 12, fontWeight: 800, lineHeight: 1.2,
                                                    color: record.jurusan === "TAHFIDZ" ? "#6366f1" : (isDark ? GOLD_BRIGHT : GOLD_DEEP) }}>
                                                    {record.jurusan}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Tanggal masuk */}
                                        <div style={{
                                            display: "flex", alignItems: "center", gap: 6,
                                            justifyContent: "center", fontSize: 11,
                                            color: token.colorTextSecondary,
                                        }}>
                                            <CalendarOutlined style={{ color: GOLD, fontSize: 11 }} />
                                            Masuk: {dayjs(record.created_at).format("DD MMMM YYYY")}
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>

                        {/* ── QR DIGITAL ID ── */}
                        <motion.div custom={1} variants={fadeLeft}>
                            <Card bordered={false} bodyStyle={{ padding: 20 }}
                                style={{
                                    ...cardStyle(),
                                    background: isDark
                                        ? `linear-gradient(160deg, ${G(0.09)} 0%, transparent 100%)`
                                        : `linear-gradient(160deg, #FFFBF0 0%, #FFFFFF 100%)`,
                                }}>
                                {/* Card header */}
                                <div style={{ display: "flex", justifyContent: "space-between",
                                    alignItems: "center", marginBottom: 16 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <div style={{
                                            width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                                            background: `linear-gradient(135deg, ${G(0.25)}, ${G(0.45)})`,
                                            border: `1px solid ${G(0.30)}`,
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            color: GOLD_BRIGHT, fontSize: 13,
                                        }}>
                                            <QrcodeOutlined />
                                        </div>
                                        <span style={{ fontSize: 11, fontWeight: 800,
                                            color: isDark ? GOLD_BRIGHT : GOLD_DEEP,
                                            letterSpacing: "0.10em", textTransform: "uppercase",
                                            fontFamily: "'Syne', sans-serif" }}>
                                            Digital ID
                                        </span>
                                    </div>
                                    <div style={{
                                        fontSize: 9, fontWeight: 800, letterSpacing: "0.06em",
                                        color: isAktif ? SUCCESS : token.colorTextTertiary,
                                        background: isAktif ? `${SUCCESS}14` : "transparent",
                                        border: `1px solid ${isAktif ? `${SUCCESS}28` : "transparent"}`,
                                        borderRadius: 99, padding: "2px 10px",
                                    }}>
                                        {isAktif ? "● VALID" : "○ INAKTIF"}
                                    </div>
                                </div>

                                {/* ✅ FIX: QR fgColor SELALU #000000
                                    Gold QR tidak readable oleh scanner apapun.
                                    bgColor SELALU putih murni. */}
                                <div style={{ textAlign: "center" }}>
                                    <div style={{
                                        display: "inline-block",
                                        background: "#FFFFFF",
                                        padding: 12, borderRadius: 14,
                                        border: `1.5px solid ${G(0.28)}`,
                                        boxShadow: `0 4px 20px ${G(0.16)}, 0 0 0 6px ${isDark ? G(0.05) : G(0.04)}`,
                                        marginBottom: 12,
                                    }}>
                                        <QRCodeCanvas
                                            value={`SANTRI:${record.nis}:${record.nama}`}
                                            size={144}
                                            fgColor="#000000"   // ✅ FIX: Hitam murni — selalu scannable
                                            bgColor="#FFFFFF"   // ✅ FIX: Putih murni
                                            level="H"           // ✅ FIX: Level H untuk error correction terbaik
                                        />
                                    </div>

                                    <div style={{
                                        fontFamily: "'DM Mono', monospace",
                                        fontSize: 14, fontWeight: 700, letterSpacing: "0.16em",
                                        color: isDark ? GOLD_BRIGHT : GOLD_DEEP, marginBottom: 4,
                                    }}>
                                        {record.nis}
                                    </div>
                                    <div style={{ fontSize: 10.5, color: token.colorTextSecondary }}>
                                        Scan untuk verifikasi identitas santri
                                    </div>
                                </div>

                                {/* Safety badge */}
                                <div style={{
                                    marginTop: 14, padding: "8px 12px", borderRadius: 10,
                                    background: G(isDark ? 0.07 : 0.05),
                                    border: `1px solid ${G(isDark ? 0.16 : 0.12)}`,
                                    display: "flex", alignItems: "center", gap: 7,
                                }}>
                                    <SafetyCertificateOutlined style={{ color: GOLD_BRIGHT, fontSize: 14, flexShrink: 0 }} />
                                    <span style={{ fontSize: 10.5, color: token.colorTextSecondary, lineHeight: 1.4 }}>
                                        Disertifikasi oleh{" "}
                                        <strong style={{ color: isDark ? GOLD_BRIGHT : GOLD_DEEP }}>
                                            Sistem Informasi Al-Hasanah
                                        </strong>
                                    </span>
                                </div>
                            </Card>
                        </motion.div>

                        {/* ── CONTACT CARD ── */}
                        {(waPhone || waliData.email) && (
                            <motion.div custom={2} variants={fadeLeft}>
                                <Card bordered={false} bodyStyle={{ padding: "18px 20px" }}
                                    style={cardStyle()}>
                                    <SectionHeader icon={<PhoneOutlined />} title="Kontak Wali" isDark={isDark} />
                                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                        {waPhone && (
                                            <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noreferrer"
                                                style={{ textDecoration: "none" }}>
                                                <div style={{
                                                    display: "flex", alignItems: "center", gap: 10,
                                                    padding: "11px 14px", borderRadius: 12,
                                                    background: "rgba(37,211,102,0.08)",
                                                    border: "1px solid rgba(37,211,102,0.22)",
                                                    transition: "all 0.2s",
                                                    cursor: "pointer",
                                                }}>
                                                    <div style={{
                                                        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                                                        background: "linear-gradient(135deg,#25D366,#128C7E)",
                                                        display: "flex", alignItems: "center", justifyContent: "center",
                                                    }}>
                                                        <WhatsAppOutlined style={{ color: "#fff", fontSize: 16 }} />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 9.5, fontWeight: 800, color: "#128C7E",
                                                            letterSpacing: "0.07em", textTransform: "uppercase" }}>WhatsApp</div>
                                                        <div style={{ fontFamily: "'DM Mono', monospace",
                                                            fontSize: 13, fontWeight: 600,
                                                            // ✅ FIX: token.colorText bukan hardcoded '#222'
                                                            color: token.colorText }}>
                                                            {waliData.no_hp || record.no_kontak_wali}
                                                        </div>
                                                    </div>
                                                </div>
                                            </a>
                                        )}
                                        {waliData.email && (
                                            <div style={{
                                                display: "flex", alignItems: "center", gap: 10,
                                                padding: "11px 14px", borderRadius: 12,
                                                background: isDark ? "rgba(37,99,235,0.08)" : "#EFF6FF",
                                                border: "1px solid rgba(37,99,235,0.20)",
                                            }}>
                                                <div style={{
                                                    width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                                                    background: "linear-gradient(135deg,#3B82F6,#2563EB)",
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                }}>
                                                    <MailOutlined style={{ color: "#fff", fontSize: 15 }} />
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 9.5, fontWeight: 800, color: "#2563EB",
                                                        letterSpacing: "0.07em", textTransform: "uppercase" }}>Email</div>
                                                    <div style={{ fontSize: 12.5, fontWeight: 600, color: token.colorText }}>
                                                        {waliData.email}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            </motion.div>
                        )}
                    </div>
                </Col>

                {/* ── RIGHT COLUMN ── */}
                <Col xs={24} md={16} lg={17}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                        {/* KPI METRICS ROW */}
                        <motion.div custom={0} variants={fadeRight}>
                            <div style={{ display: "flex", gap: 14 }}>
                                <MetricBox icon={<BookOutlined />} label="Hafalan"
                                    value={`${hafalanJuz} Juz`} color={GOLD_BRIGHT} isDark={isDark} />
                                <MetricBox icon={<TrophyOutlined />} label="Progress"
                                    value={`${hafalanPct}%`} color={SUCCESS} isDark={isDark} />
                                <MetricBox icon={<AimOutlined />} label="Kelas"
                                    value={record.kelas} color={INFO} isDark={isDark} />
                                <MetricBox icon={<RocketOutlined />} label="Takhasus"
                                    value={record.jurusan || "—"} color={PURPLE} isDark={isDark} />
                            </div>
                        </motion.div>

                        {/* SECTION 1: DATA DIRI */}
                        <motion.div custom={1} variants={fadeRight}>
                            <Card bordered={false} bodyStyle={{ padding: "22px 24px" }} style={cardStyle()}>
                                <SectionHeader icon={<IdcardOutlined />} title="Data Pribadi"
                                    subtitle="Informasi kependudukan & identitas resmi" isDark={isDark} />
                                <Row gutter={[0,0]}>
                                    <Col xs={24} md={12}>
                                        <InfoRow isDark={isDark} token={token} label="Nama Lengkap" icon={<UserOutlined />}
                                            value={<strong style={{ fontSize: 14, color: token.colorText }}>{record.nama}</strong>} />
                                        <InfoRow isDark={isDark} token={token} label="NIS" icon={<NumberOutlined />} mono value={record.nis} />
                                        <InfoRow isDark={isDark} token={token} label="NIK" mono value={record.nik} />
                                        <InfoRow isDark={isDark} token={token} label="Jenis Kelamin"
                                            value={
                                                <div style={{
                                                    display: "inline-flex", alignItems: "center", gap: 5,
                                                    padding: "3px 12px", borderRadius: 99,
                                                    background: isMale ? "rgba(2,132,199,0.12)" : "rgba(219,39,119,0.10)",
                                                    border: `1px solid ${isMale ? "rgba(2,132,199,0.28)" : "rgba(219,39,119,0.22)"}`,
                                                    fontSize: 11, fontWeight: 700,
                                                    color: isMale ? "#0284c7" : "#db2777",
                                                }}>
                                                    {isMale ? <ManOutlined style={{ fontSize: 10 }} /> : <WomanOutlined style={{ fontSize: 10 }} />}
                                                    {isMale ? "Laki-laki" : "Perempuan"}
                                                </div>
                                            }
                                        />
                                        <InfoRow isDark={isDark} token={token} label="Anak Ke-"
                                            value={record.anak_ke ? `Anak ke-${record.anak_ke}` : undefined} />
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <InfoRow isDark={isDark} token={token} label="Tempat Lahir" icon={<EnvironmentOutlined />} value={record.tempat_lahir} />
                                        <InfoRow isDark={isDark} token={token} label="Tanggal Lahir" icon={<CalendarOutlined />}
                                            value={record.tanggal_lahir ? (
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                                                        {formatMasehi(record.tanggal_lahir)}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: GOLD_BRIGHT, fontWeight: 600, marginTop: 2 }}>
                                                        {formatHijri(record.tanggal_lahir)}
                                                    </div>
                                                </div>
                                            ) : undefined}
                                        />
                                        <InfoRow isDark={isDark} token={token} label="Alamat" icon={<HomeOutlined />}
                                            value={record.alamat_lengkap} />
                                        <InfoRow isDark={isDark} token={token} label="Pembimbing" icon={<StarOutlined />}
                                            value={record.pembimbing} />
                                    </Col>
                                </Row>
                            </Card>
                        </motion.div>

                        {/* SECTION 2: HAFALAN */}
                        <motion.div custom={2} variants={fadeRight}>
                            <Card bordered={false} bodyStyle={{ padding: "22px 24px" }} style={cardStyle()}>
                                <SectionHeader icon={<BookOutlined />} title="Capaian Tahfidz"
                                    subtitle="Progress hafalan Al-Qur'an & Kitab" isDark={isDark} />
                                <Row gutter={[24, 0]}>
                                    <Col xs={24} md={12}>
                                        <InfoRow isDark={isDark} token={token} label="Hafalan Qur'an" icon={<TrophyOutlined />}
                                            value={<strong style={{ color: GOLD_BRIGHT, fontFamily: "'DM Mono', monospace", fontSize: 15 }}>{hafalanJuz} Juz</strong>} />
                                        <InfoRow isDark={isDark} token={token} label="Kitab Selesai" icon={<BookOutlined />}
                                            value={record.hafalan_kitab} />
                                        <InfoRow isDark={isDark} token={token} label="Jurusan" icon={<AimOutlined />}
                                            value={record.jurusan} />
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <div style={{ padding: "12px 10px" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between",
                                                alignItems: "center", marginBottom: 8 }}>
                                                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                                                    letterSpacing: "0.07em", color: isDark ? G(0.75) : GOLD_DEEP }}>
                                                    Progress Hafalan
                                                </span>
                                                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 800, color: GOLD_BRIGHT }}>
                                                    {hafalanPct}%
                                                </span>
                                            </div>
                                            <Progress
                                                percent={hafalanPct} showInfo={false}
                                                strokeColor={{ from: GOLD_LIGHT, to: GOLD_DEEP }}
                                                trailColor={isDark ? "rgba(255,255,255,0.07)" : "#F3E9C0"}
                                                strokeWidth={8}
                                                style={{ margin: 0 }}
                                            />
                                            <div style={{ fontSize: 10.5, color: token.colorTextSecondary, marginTop: 6 }}>
                                                {hafalanJuz} dari 30 Juz Al-Qur'an
                                            </div>
                                        </div>
                                    </Col>
                                </Row>
                            </Card>
                        </motion.div>

                        {/* SECTION 3: WALI */}
                        <motion.div custom={3} variants={fadeRight}>
                            <Card bordered={false} bodyStyle={{ padding: "22px 24px" }} style={cardStyle()}>
                                <SectionHeader icon={<TeamOutlined />} title="Data Orang Tua & Wali"
                                    subtitle="Informasi keluarga dan wali penanggung jawab" isDark={isDark} />
                                <Row gutter={[0,0]}>
                                    <Col xs={24} md={12}>
                                        <InfoRow isDark={isDark} token={token} label="Ayah Kandung" icon={<UserOutlined />} value={record.ayah} />
                                        <InfoRow isDark={isDark} token={token} label="Ibu Kandung" icon={<UserOutlined />} value={record.ibu} />
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <InfoRow isDark={isDark} token={token} label="Wali (Akun)"
                                            value={waliData.full_name ? (
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: 13.5, color: token.colorText }}>
                                                        {waliData.full_name}
                                                    </div>
                                                    {waliData.email && (
                                                        <div style={{ fontSize: 11.5, color: token.colorTextSecondary, marginTop: 2 }}>
                                                            <MailOutlined style={{ marginRight: 4 }} />{waliData.email}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : undefined}
                                        />
                                        <InfoRow isDark={isDark} token={token} label="No. Kontak" mono value={waliData.no_hp || record.no_kontak_wali} />
                                    </Col>
                                </Row>
                            </Card>
                        </motion.div>

                    </div>
                </Col>
            </Row>

            {/* ══════════════════════════════════════════════
                PRINT DOCUMENT — HIDDEN
                ✅ FULLY REDESIGNED: Corporate World-Class PDF
            ══════════════════════════════════════════════ */}
            <div style={{ display: "none" }}>
                <div
                    ref={componentRef}
                    style={{
                        width: "210mm", minHeight: "297mm",
                        padding: "0 0 12mm 0",
                        fontFamily: "'Arial', 'Helvetica', sans-serif",
                        color: "#111827",
                        backgroundColor: "#FFFFFF",
                        position: "relative",
                        boxSizing: "border-box",
                    }}
                >
                    {/* ═══════════════════════════════════════════
                        1. KOP SURAT — WORLD CLASS CORPORATE HEADER
                    ═══════════════════════════════════════════ */}
                    <div style={{ position: "relative" }}>
                        {/* Gold top strip full width */}
                        <div style={{
                            height: "6mm",
                            background: "linear-gradient(90deg, #5C430A 0%, #C9A84C 35%, #FFB700 65%, #C9A84C 85%, #5C430A 100%)",
                        }} />

                        {/* Header content area */}
                        <div style={{
                            padding: "8mm 18mm 7mm 18mm",
                            background: "#FFFFFF",
                            borderBottom: "3px double #C9A84C",
                            display: "flex",
                            alignItems: "center",
                            gap: "14px",
                        }}>
                            {/* Logo area */}
                            <div style={{
                                width: "22mm", height: "22mm", flexShrink: 0,
                                border: "2px solid #C9A84C",
                                borderRadius: "4mm",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                background: "linear-gradient(135deg, #5C430A 0%, #3D2800 100%)",
                                boxShadow: "0 2px 8px rgba(201,168,76,0.30)",
                            }}>
                                {/* Islamic arch SVG mark */}
                                <svg width="42" height="42" viewBox="0 0 32 32" fill="none">
                                    <path d="M16 3C11 3 7 7 7 12V14H25V12C25 7 21 3 16 3Z" fill="#FFB700" opacity="0.95"/>
                                    <rect x="5" y="10" width="3" height="11" rx="1.5" fill="#FFB700" opacity="0.7"/>
                                    <path d="M5.5 10 L8 10 L6.5 7 Z" fill="#FFB700" opacity="0.85"/>
                                    <rect x="24" y="10" width="3" height="11" rx="1.5" fill="#FFB700" opacity="0.7"/>
                                    <path d="M24 10 L26.5 10 L25.5 7 Z" fill="#FFB700" opacity="0.85"/>
                                    <rect x="9" y="14" width="14" height="9" rx="2" fill="#FFB700" opacity="0.85"/>
                                    <rect x="4" y="23" width="24" height="2" rx="1" fill="#FFB700" opacity="0.5"/>
                                    <path d="M21.5 5L21.9 6.2L23.1 6.2L22.1 7L22.5 8.2L21.5 7.5L20.5 8.2L20.9 7L19.9 6.2L21.1 6.2Z" fill="#FDE68A" opacity="0.85"/>
                                </svg>
                            </div>

                            {/* Institutional info */}
                            <div style={{ flex: 1 }}>
                                <div style={{
                                    fontSize: "17pt", fontWeight: "900",
                                    letterSpacing: "0.04em", color: "#5C430A",
                                    marginBottom: "3px", lineHeight: 1.1,
                                    textTransform: "uppercase",
                                }}>
                                    PONDOK PESANTREN AL-HASANAH
                                </div>
                                <div style={{
                                    fontSize: "8.5pt", fontWeight: "700",
                                    color: "#C9A84C", letterSpacing: "0.15em",
                                    textTransform: "uppercase", marginBottom: "5px",
                                }}>
                                    Cibeuti · Kawalu · Kota Tasikmalaya · Jawa Barat
                                </div>
                                {/* Thin gold divider */}
                                <div style={{ height: "1px", background: "linear-gradient(90deg, #C9A84C, rgba(201,168,76,0.15))", width: "80%", marginBottom: "5px" }} />
                                <div style={{ fontSize: "8pt", color: "#6B5F50", lineHeight: 1.6 }}>
                                    Jl. Raya Cibeuti Km.3 Rt.01/01, Kel. Cibeuti, Kec. Kawalu, Tasikmalaya 46182
                                    &nbsp;&nbsp;|&nbsp;&nbsp;
                                    Telp: (0265) 1234567
                                    &nbsp;&nbsp;|&nbsp;&nbsp;
                                    Email: admin@alhasanah.id
                                    &nbsp;&nbsp;|&nbsp;&nbsp;
                                    alhasanah.id
                                </div>
                            </div>

                            {/* Document number badge */}
                            <div style={{
                                display: "flex", flexDirection: "column",
                                alignItems: "center", justifyContent: "center",
                                border: "1.5px solid #C9A84C",
                                borderRadius: "3mm", padding: "5px 12px",
                                flexShrink: 0,
                                background: "linear-gradient(135deg, #FFFBF0 0%, #FFF8E8 100%)",
                            }}>
                                <div style={{ fontSize: "6.5pt", fontWeight: "800", color: "#8B6914",
                                    letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "3px" }}>
                                    NOMOR DOKUMEN
                                </div>
                                <div style={{ fontSize: "10pt", fontWeight: "900",
                                    fontFamily: "'Courier New', monospace", color: "#111827", letterSpacing: "0.05em" }}>
                                    SAN-{record.nis}
                                </div>
                                <div style={{ fontSize: "6pt", color: "#9E9080", marginTop: "2px",
                                    fontFamily: "monospace" }}>
                                    {dayjs().format("YYYY")}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ═══════════════════════════════════════════
                        2. DOCUMENT TITLE BANNER
                    ═══════════════════════════════════════════ */}
                    <div style={{
                        margin: "6mm 18mm",
                        background: "linear-gradient(135deg, #5C430A 0%, #8B6914 50%, #C9A84C 100%)",
                        borderRadius: "3mm",
                        padding: "7px 24px",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        boxShadow: "0 3px 12px rgba(201,168,76,0.28)",
                    }}>
                        <div>
                            <div style={{ fontSize: "13.5pt", fontWeight: "900",
                                letterSpacing: "0.10em", color: "#FFFFFF", textTransform: "uppercase" }}>
                                BIODATA SANTRI
                            </div>
                            <div style={{ fontSize: "8pt", color: "rgba(255,255,255,0.65)",
                                letterSpacing: "0.08em", marginTop: "2px" }}>
                                Dokumen Resmi Sistem Informasi Al-Hasanah
                            </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: "8pt", color: "rgba(255,255,255,0.55)",
                                letterSpacing: "0.06em", textTransform: "uppercase" }}>
                                Nomor Induk Santri
                            </div>
                            <div style={{ fontSize: "13pt", fontWeight: "900",
                                fontFamily: "'Courier New', monospace",
                                color: "#FFB700", letterSpacing: "0.10em" }}>
                                {record.nis}
                            </div>
                        </div>
                    </div>

                    {/* ═══════════════════════════════════════════
                        3. MAIN CONTENT
                    ═══════════════════════════════════════════ */}
                    <div style={{ padding: "0 18mm" }}>

                        {/* Layout: Data tables + Photo column */}
                        <div style={{ display: "flex", gap: "16px", marginBottom: "12px" }}>

                            {/* ── Left: Data table ── */}
                            <div style={{ flex: 1 }}>
                                {/* Section A */}
                                <div style={{
                                    background: "linear-gradient(90deg, #FDF6DC, #FFFBF0)",
                                    borderLeft: "4px solid #C9A84C",
                                    padding: "4px 10px",
                                    fontWeight: "800", fontSize: "8.5pt",
                                    color: "#5C430A", marginBottom: "7px",
                                    letterSpacing: "0.08em", textTransform: "uppercase",
                                    borderRadius: "0 3px 3px 0",
                                }}>
                                    A. DATA PRIBADI
                                </div>
                                <table style={{ width: "100%", fontSize: "9.5pt", borderCollapse: "collapse" }}>
                                    <tbody>
                                        {[
                                            ["Nama Lengkap",  <strong key="n" style={{ fontSize: "10.5pt" }}>{record.nama}</strong>],
                                            ["NIK",           <span key="nik" style={{ fontFamily: "Courier New", letterSpacing: "0.08em" }}>{record.nik || "—"}</span>],
                                            ["Tempat Lahir",  record.tempat_lahir || "—"],
                                            ["Tanggal Lahir",
                                                record.tanggal_lahir
                                                    ? <span key="tgl">
                                                        {formatMasehi(record.tanggal_lahir)}
                                                        <span style={{ color: "#C9A84C", marginLeft: 6, fontStyle: "italic" }}>
                                                            / {formatHijri(record.tanggal_lahir)}
                                                        </span>
                                                      </span>
                                                    : "—"
                                            ],
                                            ["Jenis Kelamin",  isMale ? "Laki-laki" : "Perempuan"],
                                            ["Anak Ke-",       record.anak_ke ? `Anak ke-${record.anak_ke}` : "—"],
                                            ["Alamat Lengkap", record.alamat_lengkap || "—"],
                                        ].map(([lbl, val], idx) => (
                                            <tr key={idx} style={{
                                                borderBottom: "1px solid #F0EDE5",
                                                background: idx % 2 === 0 ? "transparent" : "#FAFAF8",
                                            }}>
                                                <td style={{ width: "128px", padding: "5px 6px",
                                                    color: "#6B5F50", verticalAlign: "top", fontWeight: "600" }}>
                                                    {lbl as string}
                                                </td>
                                                <td style={{ width: "8px", padding: "5px 0",
                                                    color: "#C9A84C", verticalAlign: "top", fontWeight: "700" }}>:</td>
                                                <td style={{ padding: "5px 6px", verticalAlign: "top", lineHeight: "1.4" }}>
                                                    {val as React.ReactNode}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* ── Right: Photo + NIS
                                ✅ FIX: Foto menggunakan object-fit: cover + dimensions tepat
                                        tidak terpotong seperti versi lama ── */}
                            <div style={{ width: "36mm", flexShrink: 0, textAlign: "center" }}>
                                <div style={{
                                    fontSize: "6.5pt", fontWeight: "700", color: "#8B6914",
                                    letterSpacing: "0.10em", textTransform: "uppercase",
                                    marginBottom: "4px",
                                }}>
                                    FOTO SANTRI
                                </div>
                                <div style={{
                                    width: "33mm", height: "44mm",
                                    border: "2px solid #C9A84C",
                                    borderRadius: "3mm",
                                    overflow: "hidden",
                                    margin: "0 auto",
                                    background: "#F9F6EF",
                                    boxShadow: "0 2px 10px rgba(201,168,76,0.22)",
                                }}>
                                    {record.foto_url ? (
                                        <img
                                            src={record.foto_url}
                                            style={{
                                                width: "100%",
                                                height: "100%",
                                                // ✅ FIX: object-fit cover + position top
                                                //    agar wajah tidak terpotong
                                                objectFit: "cover",
                                                objectPosition: "top center",
                                                display: "block",
                                            }}
                                            alt="Foto Santri"
                                        />
                                    ) : (
                                        <div style={{ width: "100%", height: "100%",
                                            display: "flex", flexDirection: "column",
                                            alignItems: "center", justifyContent: "center",
                                            color: "#C4B89E", gap: "4px" }}>
                                            <div style={{ fontSize: "22pt", opacity: 0.3 }}>👤</div>
                                            <span style={{ fontSize: "7pt", color: "#C4B89E" }}>3 × 4</span>
                                        </div>
                                    )}
                                </div>
                                {/* NIS under photo */}
                                <div style={{
                                    marginTop: "5px",
                                    fontFamily: "Courier New, monospace",
                                    fontSize: "8pt", fontWeight: "800",
                                    color: "#8B6914", letterSpacing: "0.06em",
                                }}>
                                    {record.nis}
                                </div>
                                {/* Status pill */}
                                <div style={{
                                    marginTop: "4px",
                                    display: "inline-block",
                                    padding: "2px 10px", borderRadius: "99px",
                                    background: isAktif ? "#D1FAE5" : "#FEE2E2",
                                    border: `1px solid ${isAktif ? "#059669" : "#DC2626"}`,
                                    fontSize: "7pt", fontWeight: "800",
                                    color: isAktif ? "#059669" : "#DC2626",
                                    letterSpacing: "0.08em",
                                }}>
                                    {record.status_santri}
                                </div>
                            </div>
                        </div>

                        {/* ── Section B: Akademik ── */}
                        <div style={{ marginBottom: "11px" }}>
                            <div style={{
                                background: "linear-gradient(90deg, #FDF6DC, #FFFBF0)",
                                borderLeft: "4px solid #C9A84C",
                                padding: "4px 10px",
                                fontWeight: "800", fontSize: "8.5pt",
                                color: "#5C430A", marginBottom: "7px",
                                letterSpacing: "0.08em", textTransform: "uppercase",
                                borderRadius: "0 3px 3px 0",
                            }}>
                                B. DATA AKADEMIK &amp; PESANTREN
                            </div>
                            <table style={{ width: "100%", fontSize: "9.5pt", borderCollapse: "collapse" }}>
                                <tbody>
                                    {([
                                        [["Kelas",         record.kelas],              ["Takhasus/Jurusan", record.jurusan]],
                                        [["Status Santri", record.status_santri],      ["Tanggal Masuk", dayjs(record.created_at).format("DD MMMM YYYY")]],
                                        [["Pembimbing",    record.pembimbing || "—"],  null],
                                        [["Capaian Hafalan", `${hafalanJuz} Juz (${hafalanPct}%)`], ["Kitab Selesai", record.hafalan_kitab || "—"]],
                                    ] as Array<[string,string|number][]>).map((rowPairs, ri) => (
                                        <tr key={ri} style={{
                                            borderBottom: "1px dashed #E5DDD0",
                                            background: ri % 2 === 0 ? "transparent" : "#FAFAF8",
                                        }}>
                                            {rowPairs.map((pair, pi) => pair ? (
                                                <React.Fragment key={pi}>
                                                    <td style={{ width: "130px", padding: "5px 6px",
                                                        color: "#6B5F50", verticalAlign: "top", fontWeight: "600" }}>
                                                        {pair[0]}
                                                    </td>
                                                    <td style={{ width: "8px", color: "#C9A84C", fontWeight: "700", verticalAlign: "top" }}>:</td>
                                                    <td style={{ padding: "5px 6px", verticalAlign: "top",
                                                        fontWeight: ri === 3 && pi === 0 ? "800" : "normal",
                                                        color: ri === 3 && pi === 0 ? "#8B6914" : "#111827" }}>
                                                        {String(pair[1])}
                                                    </td>
                                                </React.Fragment>
                                            ) : <td key={pi} colSpan={3} />)}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* ── Section C: Keluarga ── */}
                        <div style={{ marginBottom: "18px" }}>
                            <div style={{
                                background: "linear-gradient(90deg, #FDF6DC, #FFFBF0)",
                                borderLeft: "4px solid #C9A84C",
                                padding: "4px 10px",
                                fontWeight: "800", fontSize: "8.5pt",
                                color: "#5C430A", marginBottom: "7px",
                                letterSpacing: "0.08em", textTransform: "uppercase",
                                borderRadius: "0 3px 3px 0",
                            }}>
                                C. DATA KELUARGA / WALI
                            </div>
                            <table style={{ width: "100%", fontSize: "9.5pt", borderCollapse: "collapse" }}>
                                <tbody>
                                    {[
                                        ["Nama Ayah Kandung",      record.ayah || "—"],
                                        ["Nama Ibu Kandung",       record.ibu || "—"],
                                        ["Wali Penanggung Jawab",  <strong key="w">{waliData.full_name || "—"}</strong>],
                                        ["No. Kontak / WhatsApp",  waliData.no_hp || record.no_kontak_wali || "—"],
                                        ["Email Akun Wali",        waliData.email || "—"],
                                    ].map(([lbl, val], idx) => (
                                        <tr key={idx} style={{
                                            borderBottom: "1px solid #F0EDE5",
                                            background: idx % 2 === 0 ? "transparent" : "#FAFAF8",
                                        }}>
                                            <td style={{ width: "180px", padding: "5px 6px",
                                                color: "#6B5F50", fontWeight: "600" }}>{lbl as string}</td>
                                            <td style={{ width: "8px", color: "#C9A84C", fontWeight: "700" }}>:</td>
                                            <td style={{ padding: "5px 6px" }}>{val as React.ReactNode}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* ═══════════════════════════════════════════
                            QR + TANDA TANGAN
                        ═══════════════════════════════════════════ */}
                        <div style={{
                            display: "flex", justifyContent: "space-between",
                            alignItems: "flex-end", marginTop: "14px",
                            paddingTop: "14px",
                            borderTop: "1px solid #E5DDD0",
                        }}>
                            {/* QR block */}
                            <div style={{ textAlign: "center" }}>
                                <div style={{
                                    border: "1.5px solid #C9A84C",
                                    borderRadius: "4mm", padding: "6px",
                                    display: "inline-block",
                                    background: "#FFFFFF",
                                    boxShadow: "0 2px 10px rgba(201,168,76,0.18)",
                                }}>
                                    {/* ✅ FIX: fgColor hitam, bgColor putih — scannable */}
                                    <QRCodeCanvas
                                        value={`VALIDASI:${record.nis}:${record.nama}`}
                                        size={82}
                                        fgColor="#000000"
                                        bgColor="#FFFFFF"
                                        level="H"
                                    />
                                </div>
                                <div style={{ fontSize: "7pt", color: "#6B5F50",
                                    marginTop: "4px", fontWeight: "700" }}>
                                    Scan Validasi Digital
                                </div>
                                <div style={{ fontSize: "6.5pt", fontFamily: "Courier New, monospace",
                                    color: "#C9A84C", marginTop: "1px" }}>
                                    SAN-{record.nis}
                                </div>
                            </div>

                            {/* Spacer */}
                            <div style={{ flex: 1, margin: "0 20px", height: "1px",
                                background: "linear-gradient(90deg, transparent, #E5DDD0, transparent)" }} />

                            {/* Tanda tangan */}
                            <div style={{ textAlign: "center", width: "200px" }}>
                                <div style={{ fontSize: "9pt", color: "#444444",
                                    marginBottom: "52px", lineHeight: "1.7" }}>
                                    Tasikmalaya, {formatMasehi(new Date())}<br />
                                    <strong style={{ color: "#8B6914" }}>{formatHijri(new Date())}</strong><br />
                                    Pengasuh / Kepala Bagian,
                                </div>
                                <div style={{
                                    borderBottom: "1.5px solid #374151", marginBottom: "4px",
                                }} />
                                <div style={{ fontWeight: "800", fontSize: "10.5pt", color: "#111827" }}>
                                    KH. Anton, Lc.
                                </div>
                                <div style={{ fontSize: "8pt", color: "#6B5F50" }}>
                                    NIP. 19283746 1 001
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ═══════════════════════════════════════════
                        FOOTER — Corporate style
                    ═══════════════════════════════════════════ */}
                    <div style={{
                        position: "absolute", bottom: 0,
                        left: 0, right: 0,
                    }}>
                        {/* Gold bottom strip */}
                        <div style={{
                            height: "1.5mm",
                            background: "linear-gradient(90deg, #5C430A, #C9A84C, #FFB700, #C9A84C, #5C430A)",
                            marginBottom: "4mm",
                        }} />
                        <div style={{
                            padding: "0 18mm 4mm",
                            display: "flex", justifyContent: "space-between", alignItems: "flex-end",
                        }}>
                            <div style={{ fontSize: "7pt", color: "#9E9080", fontStyle: "italic" }}>
                                * Dokumen ini diterbitkan secara resmi oleh Sistem Informasi Manajemen
                                Pondok Pesantren Al-Hasanah. Dokumen sah tanpa tanda tangan basah
                                jika QR Code tervalidasi oleh sistem.
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "10mm" }}>
                                <div style={{ fontSize: "7.5pt", fontWeight: "800",
                                    color: "#8B6914", letterSpacing: "0.06em" }}>
                                    AL-HASANAH DIGITAL ECOSYSTEM
                                </div>
                                <div style={{ fontSize: "6.5pt", fontFamily: "Courier New, monospace",
                                    color: "#C4B89E", marginTop: "1px" }}>
                                    Cetak: {dayjs().format("DD/MM/YYYY HH:mm")}
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

        </motion.div>
    );
};
