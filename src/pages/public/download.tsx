import React, { useEffect, useState } from "react";
import { motion, useInView } from "framer-motion";
import { QRCodeCanvas } from "qrcode.react";

const GOLD        = "#C9A84C";
const GOLD_LIGHT  = "#FDE68A";
const GOLD_BRIGHT = "#FFB700";
const GOLD_DEEP   = "#8B6914";

const DOWNLOAD_CONFIG = {
  version: "v1.1.1",
  downloadUrl:
    "https://github.com/nurdinRamadhan/aplikasi-android/releases/download/v1.1.1/AlhasanahMedia-v1.1.1.apk",
  releaseDate: "28 Juli 2026",
  apkSize: "~20 MB",
  qrValue:
    "https://github.com/nurdinRamadhan/aplikasi-android/releases/download/v1.1.1/AlhasanahMedia-v1.1.1.apk",
  contact: { whatsapp: "62882000979741", email: "nurdincrs123@gmail.com" },
};

const ISLAMIC_SVG = `url("data:image/svg+xml,%3Csvg width='140' height='140' viewBox='0 0 140 140' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='rgba(201%2C168%2C76%2C0.06)' stroke-width='0.7'%3E%3Cpolygon points='70%2C12 128%2C41 128%2C99 70%2C128 12%2C99 12%2C41'/%3E%3Cpolygon points='70%2C28 110%2C49 110%2C91 70%2C112 30%2C91 30%2C49'/%3E%3Cline x1='70' y1='12' x2='70' y2='28'/%3E%3Cline x1='128' y1='41' x2='110' y2='49'/%3E%3Cline x1='128' y1='99' x2='110' y2='91'/%3E%3Cline x1='70' y1='128' x2='70' y2='112'/%3E%3Cline x1='12' y1='99' x2='30' y2='91'/%3E%3Cline x1='12' y1='41' x2='30' y2='49'/%3E%3C/g%3E%3C/svg%3E")`;

/* ── SVG ICONS ── */

const AndroidIcon: React.FC<{ color: string; size?: number }> = ({
  color,
  size = 22,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C13.85 1.23 12.95 1 12 1c-.96 0-1.86.23-2.66.63L7.85.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31C6.97 3.26 6 5.01 6 7h12c0-1.99-.97-3.75-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z" />
  </svg>
);

const DownloadIcon: React.FC<{ color: string; size?: number }> = ({
  color,
  size = 20,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const CheckIcon: React.FC<{ color: string; size?: number }> = ({
  color,
  size = 14,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ShieldIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

const StarIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const CloudSyncIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    <polyline points="12 13 12 17" />
    <polyline points="9 15 12 12 15 15" />
  </svg>
);

const WifiOffIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="1" y1="1" x2="23" y2="23" />
    <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
    <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
    <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
    <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
    <line x1="12" y1="20" x2="12.01" y2="20" />
  </svg>
);

const BookIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <line x1="8" y1="7" x2="16" y2="7" />
    <line x1="8" y1="11" x2="13" y2="11" />
  </svg>
);

const WalletIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M22 10H2" />
    <circle cx="17" cy="14" r="1.5" fill={color} />
  </svg>
);

const BellIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const NewspaperIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
    <line x1="10" y1="6" x2="18" y2="6" />
    <line x1="10" y1="10" x2="18" y2="10" />
    <line x1="10" y1="14" x2="14" y2="14" />
  </svg>
);

const CalendarIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const AttendanceIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <polyline points="16 11 18 13 22 9" />
  </svg>
);

const MoreIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
  </svg>
);

const WhatsAppIcon: React.FC<{ color: string; size?: number }> = ({
  color,
  size = 20,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const EmailIcon: React.FC<{ color: string; size?: number }> = ({
  color,
  size = 20,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const MapPinIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

/* ── PHONE MOCKUP ── */

const PhoneMockup: React.FC<{
  src: string;
  alt: string;
  isDark: boolean;
}> = ({ src, alt, isDark }) => (
  <motion.div
    initial={{ opacity: 0, y: 40, rotateY: -5 }}
    animate={{ opacity: 1, y: 0, rotateY: 0 }}
    transition={{ delay: 0.2, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    style={{ perspective: "1000px" }}
  >
    <motion.div
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      style={{
        width: 240,
        height: 480,
        borderRadius: 36,
        border: `3px solid ${
          isDark ? "rgba(201,168,76,0.3)" : "rgba(201,168,76,0.4)"
        }`,
        overflow: "hidden",
        position: "relative",
        boxShadow: isDark
          ? `0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(201,168,76,0.1), inset 0 0 0 1px rgba(201,168,76,0.1)`
          : `0 20px 60px rgba(0,0,0,0.15), 0 0 40px rgba(201,168,76,0.08), inset 0 0 0 1px rgba(201,168,76,0.15)`,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: 100,
          height: 24,
          borderRadius: "0 0 16px 16px",
          background: isDark ? "#000" : "#1a1a1a",
          zIndex: 10,
        }}
      />
      <img
        src={src}
        alt={alt}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "top",
          display: "block",
        }}
      />
    </motion.div>
  </motion.div>
);

/* ── FLOATING SHAPE ── */

const FloatingShape: React.FC<{
  type: "hexagon" | "diamond";
  size: number;
  top: string;
  left: string;
  delay?: number;
  isDark: boolean;
}> = ({ type, size, top, left, delay = 0, isDark }) => {
  const shapeStyle: React.CSSProperties = {
    position: "absolute",
    top,
    left,
    width: size,
    height: size,
    pointerEvents: "none",
    zIndex: 1,
  };

  const color = isDark
    ? "rgba(201,168,76,0.06)"
    : "rgba(201,168,76,0.08)";

  if (type === "hexagon") {
    return (
      <motion.div
        style={shapeStyle}
        animate={{ rotate: 360, y: [0, -10, 0] }}
        transition={{
          rotate: { duration: 40, repeat: Infinity, ease: "linear" },
          y: {
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
            delay,
          },
        }}
      >
        <svg viewBox="0 0 100 100" width={size} height={size}>
          <polygon
            points="50,2 93,25 93,75 50,98 7,75 7,25"
            fill="none"
            stroke={color}
            strokeWidth="1.5"
          />
        </svg>
      </motion.div>
    );
  }

  return (
    <motion.div
      style={shapeStyle}
      animate={{ rotate: [0, 90, 0], y: [0, -8, 0] }}
      transition={{
        rotate: { duration: 30, repeat: Infinity, ease: "linear" },
        y: {
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut",
          delay,
        },
      }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <rect
          x="15"
          y="15"
          width="70"
          height="70"
          rx="4"
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          transform="rotate(45 50 50)"
        />
      </svg>
    </motion.div>
  );
};

/* ── SECTION WRAPPER ── */

const Section: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      style={style}
    >
      {children}
    </motion.div>
  );
};

/* ── MAIN COMPONENT ── */

export const DownloadPage: React.FC = () => {
  const [isDark, setIsDark] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mqDark = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mqDark.matches);
    const handleDark = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mqDark.addEventListener("change", handleDark);

    const mqMobile = window.matchMedia("(max-width: 768px)");
    setIsMobile(mqMobile.matches);
    const handleMobile = (e: MediaQueryListEvent) =>
      setIsMobile(e.matches);
    mqMobile.addEventListener("change", handleMobile);

    return () => {
      mqDark.removeEventListener("change", handleDark);
      mqMobile.removeEventListener("change", handleMobile);
    };
  }, []);

  const bg = isDark ? "#08070D" : "#F7F4EE";
  const cardBg = isDark ? "rgba(15,15,26,0.95)" : "rgba(255,255,255,0.95)";
  const border = isDark ? "rgba(201,168,76,0.16)" : "rgba(201,168,76,0.28)";
  const text = isDark ? "#F0EDE5" : "#0A0805";
  const textSub = isDark ? "#9E9080" : "#6B5F50";
  const textMut = isDark ? "#5C5248" : "#9E9080";
  const divider = isDark
    ? "rgba(201,168,76,0.08)"
    : "rgba(201,168,76,0.12)";

  const features = [
    {
      icon: <BookIcon color={GOLD_BRIGHT} />,
      title: "Monitoring Hafalan & Murojaah",
      desc: "Pantau progres hafalan Al-Qur'an santri secara real-time, lengkap dengan riwayat murojaah.",
    },
    {
      icon: <WalletIcon color={GOLD_BRIGHT} />,
      title: "Informasi Tagihan & Pembayaran",
      desc: "Lihat detail tagihan, riwayat pembayaran, dan status keuangan santri kapan saja.",
    },
    {
      icon: <BellIcon color={GOLD_BRIGHT} />,
      title: "Notifikasi Penting",
      desc: "Terima pengumuman dan info penting dari pesantren langsung di perangkat Anda.",
    },
    {
      icon: <NewspaperIcon color={GOLD_BRIGHT} />,
      title: "Berita & Pengumuman Pesantren",
      desc: "Akses berita terkini dan pengumuman resmi dari Pondok Pesantren Al-Hasanah.",
    },
    {
      icon: <CalendarIcon color={GOLD_BRIGHT} />,
      title: "Jadwal Kegiatan Harian",
      desc: "Lihat jadwal kegiatan harian santri, mulai dari sholat berjamaah hingga jam belajar.",
    },
    {
      icon: <AttendanceIcon color={GOLD_BRIGHT} />,
      title: "Absensi Santri",
      desc: "Informasi kehadiran santri yang transparan dan mudah diakses oleh wali santri.",
    },
  ];

  const trustBadges = [
    {
      icon: <StarIcon color={GOLD_BRIGHT} />,
      label: "Resmi dari Pesantren",
    },
    {
      icon: <ShieldIcon color={GOLD_BRIGHT} />,
      label: "Privasi Terjaga",
    },
    {
      icon: <CloudSyncIcon color={GOLD_BRIGHT} />,
      label: "Sinkron Otomatis",
    },
    {
      icon: <WifiOffIcon color={GOLD_BRIGHT} />,
      label: "Dapat Digunakan Offline",
    },
  ];

  const steps = [
    {
      num: "1",
      text: "Tekan tombol \"Unduh Versi Terbaru\" di atas untuk mengunduh file APK.",
    },
    {
      num: "2",
      text: "Buka file APK yang sudah terunduh. Jika muncul peringatan, pilih \"Lanjutkan\".",
    },
    {
      num: "3",
      text: "Aktifkan opsi \"Izinkan instal dari sumber tidak dikenal\" di pengaturan HP Anda.",
    },
    {
      num: "4",
      text: "Ikuti langkah instalasi hingga selesai. Aplikasi siap digunakan!",
    },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: bg,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ═══════ HERO SECTION ═══════ */}
      <div
        style={{
          position: "relative",
          background: isDark
            ? "linear-gradient(180deg, #08070D 0%, #0F0F1A 40%, #141424 100%)"
            : "linear-gradient(180deg, #F7F4EE 0%, #FFFDF5 40%, #FFFFFF 100%)",
          backgroundImage: ISLAMIC_SVG,
          backgroundSize: "140px 140px",
          overflow: "hidden",
        }}
      >
        {/* Floating shapes — only 2 subtle ones */}
        <FloatingShape
          type="hexagon"
          size={80}
          top="15%"
          left="5%"
          isDark={isDark}
          delay={0}
        />
        <FloatingShape
          type="diamond"
          size={60}
          top="25%"
          left="88%"
          isDark={isDark}
          delay={1}
        />

        {/* Ambient glow */}
        <div
          style={{
            position: "absolute",
            top: "-20%",
            left: "30%",
            width: 600,
            height: 500,
            background: `radial-gradient(circle, ${GOLD}12 0%, transparent 70%)`,
            pointerEvents: "none",
          }}
        />

        {/* Hero content */}
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: isMobile ? "60px 20px 40px" : "80px 40px 60px",
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: "center",
            gap: isMobile ? 40 : 60,
            position: "relative",
            zIndex: 10,
          }}
        >
          {/* Left: Text content */}
          <div
            style={{
              flex: 1,
              textAlign: isMobile ? "center" : "left",
              minWidth: 0,
            }}
          >
            {/* Logo */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              style={{
                display: "inline-block",
                marginBottom: 24,
                position: "relative",
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  background: `linear-gradient(135deg, ${GOLD}25, ${GOLD_BRIGHT}15)`,
                  border: `1.5px solid ${GOLD}45`,
                  borderRadius: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: isDark
                    ? `0 0 32px ${GOLD}20`
                    : `0 8px 24px ${GOLD}18`,
                }}
              >
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 32 32"
                  fill="none"
                  style={{
                    filter: `drop-shadow(0 0 6px ${GOLD_BRIGHT}60)`,
                  }}
                >
                  <path
                    d="M16 3C11.029 3 7 7.029 7 12V14H25V12C25 7.029 20.971 3 16 3Z"
                    fill={isDark ? GOLD_BRIGHT : GOLD_DEEP}
                    opacity="0.95"
                  />
                  <rect
                    x="5"
                    y="10"
                    width="3"
                    height="11"
                    rx="1.5"
                    fill={isDark ? GOLD_BRIGHT : GOLD_DEEP}
                    opacity="0.7"
                  />
                  <path
                    d="M5.5 10 L8 10 L6.5 7 Z"
                    fill={isDark ? GOLD_BRIGHT : GOLD_DEEP}
                    opacity="0.85"
                  />
                  <rect
                    x="24"
                    y="10"
                    width="3"
                    height="11"
                    rx="1.5"
                    fill={isDark ? GOLD_BRIGHT : GOLD_DEEP}
                    opacity="0.7"
                  />
                  <path
                    d="M24 10 L26.5 10 L25.5 7 Z"
                    fill={isDark ? GOLD_BRIGHT : GOLD_DEEP}
                    opacity="0.85"
                  />
                  <rect
                    x="9"
                    y="14"
                    width="14"
                    height="9"
                    rx="2"
                    fill={isDark ? GOLD_BRIGHT : GOLD_DEEP}
                    opacity="0.85"
                  />
                  <path
                    d="M13.5 23V18.5C13.5 17.12 14.62 16 16 16C17.38 16 18.5 17.12 18.5 18.5V23"
                    stroke="black"
                    strokeWidth="1.2"
                    opacity="0.30"
                  />
                  <circle
                    cx="12"
                    cy="17.5"
                    r="1.2"
                    fill="black"
                    opacity="0.25"
                  />
                  <circle
                    cx="20"
                    cy="17.5"
                    r="1.2"
                    fill="black"
                    opacity="0.25"
                  />
                  <rect
                    x="4"
                    y="23"
                    width="24"
                    height="2"
                    rx="1"
                    fill={isDark ? GOLD_BRIGHT : GOLD_DEEP}
                    opacity="0.5"
                  />
                  <path
                    d="M16 5.5C17.2 5.5 18.3 6 19 6.9C18.3 6.5 17.5 6.3 16.6 6.4C14.8 6.6 13.4 8 13.3 9.8C13.2 8.9 13.4 8 13.9 7.2C14.5 6.2 15.2 5.5 16 5.5Z"
                    fill="white"
                    opacity="0.55"
                  />
                  <path
                    d="M21.5 5L21.9 6.2L23.1 6.2L22.1 7L22.5 8.2L21.5 7.5L20.5 8.2L20.9 7L19.9 6.2L21.1 6.2Z"
                    fill="#FDE68A"
                    opacity="0.80"
                  />
                </svg>
              </div>
            </motion.div>

            {/* Title */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.5 }}
            >
              <h1
                style={{
                  margin: 0,
                  fontFamily: "'Cormorant Garamond', 'Syne', serif",
                  fontSize: isMobile ? 36 : 48,
                  fontWeight: 700,
                  background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_BRIGHT} 55%, ${GOLD_LIGHT} 100%)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.1,
                }}
              >
                Al-Hasanah Media
              </h1>
              <div
                style={{
                  fontSize: isMobile ? 13 : 14,
                  fontWeight: 500,
                  color: textSub,
                  marginTop: 10,
                  lineHeight: 1.6,
                  letterSpacing: "0.3px",
                }}
              >
                Aplikasi resmi layanan santri dan wali santri.
              </div>
              <div
                style={{
                  fontSize: isMobile ? 12 : 13,
                  color: textMut,
                  marginTop: 6,
                  lineHeight: 1.5,
                  fontStyle: "italic",
                }}
              >
                Dirancang untuk akses informasi yang lebih rapi, cepat, dan
                mudah dipahami.
              </div>
            </motion.div>

            {/* Version badges */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.5 }}
              style={{
                display: "flex",
                justifyContent: isMobile ? "center" : "flex-start",
                gap: 8,
                marginTop: 24,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "6px 14px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  background: `linear-gradient(135deg, ${GOLD}18, ${GOLD_BRIGHT}12)`,
                  border: `1px solid ${GOLD}35`,
                  color: isDark ? GOLD_BRIGHT : GOLD_DEEP,
                }}
              >
                <AndroidIcon
                  color={isDark ? GOLD_BRIGHT : GOLD_DEEP}
                  size={16}
                />
                {DOWNLOAD_CONFIG.version}
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "6px 12px",
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 700,
                  background: isDark
                    ? "rgba(5,150,105,0.15)"
                    : "rgba(5,150,105,0.08)",
                  border: "1px solid rgba(5,150,105,0.3)",
                  color: "#059669",
                }}
              >
                <CheckIcon color="#059669" /> Stable
              </span>
            </motion.div>

            {/* Download button */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.5 }}
              style={{
                marginTop: 32,
                display: "flex",
                justifyContent: isMobile ? "center" : "flex-start",
              }}
            >
              <motion.a
                href={DOWNLOAD_CONFIG.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  padding: "16px 36px",
                  borderRadius: 16,
                  background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_BRIGHT} 100%)`,
                  border: "none",
                  color: "#000",
                  fontWeight: 800,
                  fontSize: 16,
                  boxShadow: `0 12px 32px ${GOLD}40`,
                  cursor: "pointer",
                  textDecoration: "none",
                  transition: "box-shadow 0.2s",
                }}
              >
                <DownloadIcon color="#000" size={22} />
                Unduh Versi Terbaru
              </motion.a>
            </motion.div>

            {/* QR Code + info */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.5 }}
              style={{
                marginTop: 28,
                display: "flex",
                alignItems: "center",
                gap: 16,
                justifyContent: isMobile ? "center" : "flex-start",
              }}
            >
              <div
                style={{
                  padding: 10,
                  borderRadius: 12,
                  background: "#fff",
                  boxShadow: `0 4px 12px rgba(0,0,0,0.08), 0 0 0 1px ${divider}`,
                  flexShrink: 0,
                }}
              >
                <QRCodeCanvas
                  value={DOWNLOAD_CONFIG.qrValue}
                  size={72}
                  bgColor="#ffffff"
                  fgColor={GOLD_DEEP}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <div style={{ fontSize: 11, color: textMut, lineHeight: 1.7 }}>
                <div style={{ fontWeight: 600, color: textSub, marginBottom: 2 }}>
                  Scan QR Code
                </div>
                <div>Unduh langsung dari HP Anda</div>
              </div>
            </motion.div>
          </div>

          {/* Right: single phone mockup */}
          {!isMobile && (
            <div
              style={{
                display: "flex",
                gap: 20,
                flexShrink: 0,
                perspective: "1000px",
              }}
            >
              <PhoneMockup
                src="/referensi/ui-light.jpeg"
                alt="Al-Hasanah Media - Light Mode"
                isDark={false}
              />
              <PhoneMockup
                src="/referensi/ui-dark.jpeg"
                alt="Al-Hasanah Media - Dark Mode"
                isDark={true}
              />
            </div>
          )}

          {/* Mobile: single phone mockup */}
          {isMobile && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <PhoneMockup
                src={isDark ? "/referensi/ui-dark.jpeg" : "/referensi/ui-light.jpeg"}
                alt="Al-Hasanah Media"
                isDark={isDark}
              />
            </div>
          )}
        </div>
      </div>

      {/* ═══════ RELEASE INFO ═══════ */}
      <Section
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: isMobile ? "40px 20px" : "50px 40px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
            gap: 16,
          }}
        >
          {[
            {
              label: "Versi",
              value: DOWNLOAD_CONFIG.version,
              icon: <AndroidIcon color={GOLD_BRIGHT} size={18} />,
            },
            {
              label: "Status",
              value: "Stable",
              icon: <CheckIcon color="#059669" size={16} />,
            },
            {
              label: "Rilis",
              value: DOWNLOAD_CONFIG.releaseDate,
              icon: (
                <CalendarIcon color={GOLD_BRIGHT} />
              ),
            },
            {
              label: "Ukuran",
              value: DOWNLOAD_CONFIG.apkSize,
              icon: (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={GOLD_BRIGHT}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              ),
            },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                padding: "20px 12px",
                borderRadius: 16,
                background: cardBg,
                border: `1px solid ${divider}`,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: `linear-gradient(135deg, ${GOLD}15, ${GOLD_BRIGHT}10)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {item.icon}
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: textMut,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                {item.label}
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: text,
                }}
              >
                {item.value}
              </div>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* Divider */}
      <div
        style={{ maxWidth: 900, margin: "0 auto", padding: "0 40px" }}
      >
        <div style={{ height: 1, background: divider }} />
      </div>

      {/* ═══════ TRUST BADGES ═══════ */}
      <Section
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: isMobile ? "40px 20px" : "50px 40px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile
              ? "repeat(2, 1fr)"
              : "repeat(4, 1fr)",
            gap: 16,
          }}
        >
          {trustBadges.map((badge, i) => (
            <motion.div
              key={badge.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
                padding: "20px 12px",
                borderRadius: 16,
                background: cardBg,
                border: `1px solid ${divider}`,
                transition: "border-color 0.2s, box-shadow 0.2s",
                cursor: "default",
              }}
              onMouseEnter={(e) => {
                (
                  e.currentTarget as HTMLDivElement
                ).style.borderColor = `${GOLD}40`;
                (e.currentTarget as HTMLDivElement).style.boxShadow =
                  `0 4px 20px ${GOLD}15`;
              }}
              onMouseLeave={(e) => {
                (
                  e.currentTarget as HTMLDivElement
                ).style.borderColor = divider;
                (e.currentTarget as HTMLDivElement).style.boxShadow =
                  "none";
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: `linear-gradient(135deg, ${GOLD}15, ${GOLD_BRIGHT}10)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {badge.icon}
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: textSub,
                  textAlign: "center",
                }}
              >
                {badge.label}
              </span>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* Divider */}
      <div
        style={{ maxWidth: 900, margin: "0 auto", padding: "0 40px" }}
      >
        <div style={{ height: 1, background: divider }} />
      </div>

      {/* ═══════ FEATURE CARDS ═══════ */}
      <Section
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: isMobile ? "40px 20px" : "50px 40px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h2
            style={{
              margin: 0,
              fontSize: isMobile ? 22 : 26,
              fontWeight: 700,
              color: text,
              fontFamily: "'Cormorant Garamond', 'Syne', serif",
            }}
          >
            Fitur Yang Tersedia
          </h2>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: textSub }}>
            Kemudahan yang tersedia untuk wali santri
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
            gap: 16,
          }}
        >
          {features.map((feat, i) => (
            <motion.div
              key={feat.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              style={{
                display: "flex",
                gap: 16,
                alignItems: "flex-start",
                padding: "20px",
                borderRadius: 16,
                background: cardBg,
                border: `1px solid ${divider}`,
                transition:
                  "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
                cursor: "default",
              }}
              onMouseEnter={(e) => {
                (
                  e.currentTarget as HTMLDivElement
                ).style.borderColor = `${GOLD}40`;
                (e.currentTarget as HTMLDivElement).style.boxShadow =
                  `0 8px 24px ${GOLD}12`;
                (e.currentTarget as HTMLDivElement).style.transform =
                  "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                (
                  e.currentTarget as HTMLDivElement
                ).style.borderColor = divider;
                (e.currentTarget as HTMLDivElement).style.boxShadow =
                  "none";
                (e.currentTarget as HTMLDivElement).style.transform =
                  "translateY(0)";
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  flexShrink: 0,
                  background: `linear-gradient(135deg, ${GOLD}18, ${GOLD_BRIGHT}10)`,
                  border: `1px solid ${GOLD}25`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {feat.icon}
              </div>
              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: text,
                    marginBottom: 4,
                  }}
                >
                  {feat.title}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: textSub,
                    lineHeight: 1.6,
                  }}
                >
                  {feat.desc}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* "dan masih banyak fitur lainnya." */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5, duration: 0.5 }}
          style={{
            textAlign: "center",
            marginTop: 28,
            padding: "16px 24px",
            borderRadius: 12,
            background: `linear-gradient(135deg, ${GOLD}08, ${GOLD_BRIGHT}05)`,
            border: `1px dashed ${GOLD}25`,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: isDark ? GOLD_BRIGHT : GOLD_DEEP,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <MoreIcon color={isDark ? GOLD_BRIGHT : GOLD_DEEP} />
            dan masih banyak fitur lainnya.
          </span>
        </motion.div>
      </Section>

      {/* Divider */}
      <div
        style={{ maxWidth: 900, margin: "0 auto", padding: "0 40px" }}
      >
        <div style={{ height: 1, background: divider }} />
      </div>

      {/* ═══════ PANDUAN INSTALASI ═══════ */}
      <Section
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: isMobile ? "40px 20px" : "50px 40px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h2
            style={{
              margin: 0,
              fontSize: isMobile ? 22 : 26,
              fontWeight: 700,
              color: text,
              fontFamily: "'Cormorant Garamond', 'Syne', serif",
            }}
          >
            Panduan Instalasi
          </h2>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: textSub }}>
            Empat langkah mudah untuk memulai
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile
              ? "1fr"
              : "repeat(4, 1fr)",
            gap: 20,
          }}
        >
          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.5 }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_BRIGHT} 100%)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  fontWeight: 800,
                  color: "#000",
                  boxShadow: `0 6px 20px ${GOLD}35`,
                }}
              >
                {step.num}
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: text,
                  lineHeight: 1.5,
                  maxWidth: 200,
                }}
              >
                {step.text}
              </div>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* Divider */}
      <div
        style={{ maxWidth: 900, margin: "0 auto", padding: "0 40px" }}
      >
        <div style={{ height: 1, background: divider }} />
      </div>

      {/* ═══════ KONTAK BANTUAN ═══════ */}
      <Section
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: isMobile ? "40px 20px" : "50px 40px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h2
            style={{
              margin: 0,
              fontSize: isMobile ? 22 : 26,
              fontWeight: 700,
              color: text,
              fontFamily: "'Cormorant Garamond', 'Syne', serif",
            }}
          >
            Kontak Bantuan
          </h2>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: textSub }}>
            Hubungi kami jika mengalami kendala
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
            gap: 16,
          }}
        >
          {/* WhatsApp */}
          <motion.a
            href={`https://wa.me/${DOWNLOAD_CONFIG.contact.whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.5 }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "24px",
              borderRadius: 16,
              background: cardBg,
              border: `1px solid ${divider}`,
              textDecoration: "none",
              transition: "border-color 0.2s, box-shadow 0.2s",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              (
                e.currentTarget as HTMLAnchorElement
              ).style.borderColor = "#25D366";
              (e.currentTarget as HTMLAnchorElement).style.boxShadow =
                "0 4px 20px rgba(37,211,102,0.15)";
            }}
            onMouseLeave={(e) => {
              (
                e.currentTarget as HTMLAnchorElement
              ).style.borderColor = divider;
              (e.currentTarget as HTMLAnchorElement).style.boxShadow =
                "none";
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: "rgba(37,211,102,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <WhatsAppIcon color="#25D366" size={24} />
            </div>
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: text,
                  marginBottom: 2,
                }}
              >
                WhatsApp
              </div>
              <div style={{ fontSize: 12, color: textSub }}>
                Chat kami untuk bantuan cepat
              </div>
            </div>
          </motion.a>

          {/* Email */}
          <motion.a
            href={`mailto:${DOWNLOAD_CONFIG.contact.email}`}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.5 }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "24px",
              borderRadius: 16,
              background: cardBg,
              border: `1px solid ${divider}`,
              textDecoration: "none",
              transition: "border-color 0.2s, box-shadow 0.2s",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              (
                e.currentTarget as HTMLAnchorElement
              ).style.borderColor = GOLD;
              (e.currentTarget as HTMLAnchorElement).style.boxShadow =
                `0 4px 20px ${GOLD}15`;
            }}
            onMouseLeave={(e) => {
              (
                e.currentTarget as HTMLAnchorElement
              ).style.borderColor = divider;
              (e.currentTarget as HTMLAnchorElement).style.boxShadow =
                "none";
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: `linear-gradient(135deg, ${GOLD}15, ${GOLD_BRIGHT}10)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <EmailIcon color={GOLD_BRIGHT} size={24} />
            </div>
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: text,
                  marginBottom: 2,
                }}
              >
                Email
              </div>
              <div style={{ fontSize: 12, color: textSub }}>
                {DOWNLOAD_CONFIG.contact.email}
              </div>
            </div>
          </motion.a>
        </div>
      </Section>

      {/* ═══════ FOOTER ═══════ */}
      <footer
        style={{
          borderTop: `1px solid ${divider}`,
          padding: isMobile ? "32px 20px" : "40px 40px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <span
            style={{
              color: isDark ? GOLD_BRIGHT : GOLD_DEEP,
              fontSize: 10,
            }}
          >
            &#9670;
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "1.5px",
              color: isDark ? GOLD_BRIGHT : GOLD_DEEP,
              textTransform: "uppercase",
            }}
          >
            Pondok Pesantren Al-Hasanah
          </span>
          <span
            style={{
              color: isDark ? GOLD_BRIGHT : GOLD_DEEP,
              fontSize: 10,
            }}
          >
            &#9670;
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            marginBottom: 8,
          }}
        >
          <MapPinIcon color={textMut} />
          <span style={{ fontSize: 11, color: textMut, lineHeight: 1.8 }}>
            Jl. Raya Cibeuti No.13, Kawalu, Tasikmalaya, Jawa Barat 46182
          </span>
        </div>
        <div
          style={{
            fontSize: 10,
            color: textMut,
            marginTop: 8,
            opacity: 0.7,
          }}
        >
          &copy; {new Date().getFullYear()} Al-Hasanah Media. All rights
          reserved.
        </div>
      </footer>

      {/* ═══════ STICKY DOWNLOAD BAR (MOBILE) ═══════ */}
      {isMobile && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "12px 20px",
            background: isDark
              ? "rgba(8,7,13,0.95)"
              : "rgba(247,244,238,0.95)",
            borderTop: `1px solid ${divider}`,
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <motion.a
            href={DOWNLOAD_CONFIG.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            whileTap={{ scale: 0.97 }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              padding: "14px 0",
              borderRadius: 14,
              background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_BRIGHT} 100%)`,
              border: "none",
              color: "#000",
              fontWeight: 800,
              fontSize: 15,
              boxShadow: `0 8px 24px ${GOLD}40`,
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            <DownloadIcon color="#000" size={20} />
            Unduh {DOWNLOAD_CONFIG.version}
          </motion.a>
        </div>
      )}

      {/* Bottom padding for mobile sticky bar */}
      {isMobile && <div style={{ height: 80 }} />}
    </div>
  );
};

export default DownloadPage;
