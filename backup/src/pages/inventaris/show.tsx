import React, { useRef } from "react";
import { useShow, useNavigation } from "@refinedev/core";
import {
    Typography, Row, Col, Card, Skeleton,
    Divider, theme, Tooltip, Progress,
} from "antd";
import { motion } from "framer-motion";
import {
    ArrowLeftOutlined, PrinterOutlined, BankOutlined,
    BarcodeOutlined, EnvironmentOutlined, TagOutlined,
    DollarOutlined, CalendarOutlined, SafetyCertificateOutlined,
    CheckCircleOutlined, WarningOutlined, CloseCircleOutlined,
    QuestionCircleOutlined, EditOutlined, FilePdfOutlined,
    SyncOutlined, AppstoreOutlined, CrownOutlined,
    AimOutlined, FileProtectOutlined, InfoCircleOutlined,
    QrcodeOutlined, ShopOutlined, RocketOutlined,
} from "@ant-design/icons";
import { QRCodeCanvas } from "qrcode.react";
import { useReactToPrint } from "react-to-print";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import dayjs from "dayjs";
import "dayjs/locale/id";
import { IInventaris } from "../../types";
import { formatHijri, formatMasehi } from "../../utility/dateHelper";

dayjs.locale("id");

const { Title, Text } = Typography;
const { useToken } = theme;

// ═══════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════
const GOLD        = "#C9A84C";
const GOLD_BRIGHT = "#FFB700";
const GOLD_LIGHT  = "#FDE68A";
const GOLD_DEEP   = "#8B6914";
const GOLD_DARK   = "#5C430A";
const SUCCESS     = "#059669";
const DANGER      = "#DC2626";
const WARNING     = "#D97706";
const INFO        = "#2563EB";
const PURPLE      = "#7C3AED";
const G           = (o: number) => `rgba(201,168,76,${o})`;

// ═══════════════════════════════════════════════════════════════
// KONDISI CONFIG
// ═══════════════════════════════════════════════════════════════
const KONDISI_CFG = {
    BAIK:         { label:"Baik",        color:SUCCESS, bg:(d:boolean)=>d?`${SUCCESS}16`:"#F0FDF4", border:(d:boolean)=>d?`${SUCCESS}30`:`${SUCCESS}22`, icon:<CheckCircleOutlined />, pct:100 },
    RUSAK_RINGAN: { label:"Rusak Ringan",color:WARNING, bg:(d:boolean)=>d?`${WARNING}16`:"#FFFBEB", border:(d:boolean)=>d?`${WARNING}30`:`${WARNING}22`, icon:<WarningOutlined />,       pct:50  },
    RUSAK_BERAT:  { label:"Rusak Berat", color:DANGER,  bg:(d:boolean)=>d?`${DANGER}16`:"#FFF1F2",  border:(d:boolean)=>d?`${DANGER}30`:`${DANGER}22`,   icon:<CloseCircleOutlined />,   pct:20  },
    HILANG:       { label:"Hilang",      color:"#6B7280",bg:(d:boolean)=>d?"rgba(107,114,128,0.14)":"#F9FAFB",border:(d:boolean)=>d?"rgba(107,114,128,0.28)":"rgba(107,114,128,0.20)",icon:<QuestionCircleOutlined />, pct:0 },
} as const;
type KondisiKey = keyof typeof KONDISI_CFG;

// SUMBER DANA COLOR MAP
const SUMBER_COLOR: Record<string,string> = {
    WAKAF:"#C9A84C", INFAQ:SUCCESS, HIBAH:PURPLE, BELI:INFO, DONASI:"#0891B2",
};

// ═══════════════════════════════════════════════════════════════
// ANIMATION VARIANTS
// ═══════════════════════════════════════════════════════════════
const fadeUp: any = {
    hidden:  { opacity:0, y:18 },
    visible: (i=0) => ({
        opacity:1, y:0,
        transition:{ duration:0.48, ease:[0.22,1,0.36,1], delay:i*0.07 },
    }),
};
const fadeLeft: any = {
    hidden:  { opacity:0, x:-18 },
    visible: (i=0) => ({
        opacity:1, x:0,
        transition:{ duration:0.48, ease:[0.22,1,0.36,1], delay:i*0.07 },
    }),
};
const fadeRight: any = {
    hidden:  { opacity:0, x:18 },
    visible: (i=0) => ({
        opacity:1, x:0,
        transition:{ duration:0.48, ease:[0.22,1,0.36,1], delay:i*0.07 },
    }),
};
const stagger = { visible:{ transition:{ staggerChildren:0.07 } } };

// ═══════════════════════════════════════════════════════════════
// INFO ROW — dark mode safe
// ═══════════════════════════════════════════════════════════════
const InfoRow: React.FC<{
    label:string; value:React.ReactNode; icon?:React.ReactNode;
    mono?:boolean; isDark:boolean; token:ReturnType<typeof useToken>["token"];
    highlight?:boolean;
}> = ({ label, value, icon, mono=false, isDark, token:tk, highlight=false }) => (
    <div
        style={{
            display:"grid", gridTemplateColumns:"150px 1fr",
            gap:8, padding:"9px 10px", alignItems:"start", borderRadius:8,
            transition:"background 0.18s", cursor:"default",
            background: highlight ? G(isDark ? 0.10 : 0.06) : "transparent",
        }}
        onMouseEnter={e => {
            if (!highlight) e.currentTarget.style.background = G(isDark ? 0.07 : 0.05);
        }}
        onMouseLeave={e => {
            if (!highlight) e.currentTarget.style.background = "transparent";
        }}
    >
        <div style={{
            display:"flex", alignItems:"center", gap:6,
            fontSize:10.5, fontWeight:700, letterSpacing:"0.06em",
            textTransform:"uppercase",
            color: isDark ? G(0.80) : GOLD_DEEP,
            fontFamily:"'DM Sans', sans-serif", paddingTop:1,
        }}>
            {icon && <span style={{ fontSize:11, opacity:0.8, flexShrink:0 }}>{icon}</span>}
            {label}
        </div>
        <div style={{
            fontSize:13.5,
            color: tk.colorText,
            fontFamily: mono ? "'DM Mono', monospace" : undefined,
            fontWeight: highlight ? 700 : 500,
            lineHeight:1.5,
        }}>
            {value !== undefined && value !== null && value !== ""
                ? value
                : <span style={{ color:tk.colorTextTertiary, fontStyle:"italic", fontSize:12 }}>—</span>
            }
        </div>
    </div>
);

// ═══════════════════════════════════════════════════════════════
// SECTION HEADER
// ═══════════════════════════════════════════════════════════════
const SectionHeader: React.FC<{
    icon:React.ReactNode; title:string; isDark:boolean; subtitle?:string;
}> = ({ icon, title, isDark, subtitle }) => (
    <div style={{
        display:"flex", alignItems:"center", gap:12,
        marginBottom:16, paddingBottom:12,
        borderBottom:`1px solid ${G(isDark ? 0.14 : 0.10)}`,
    }}>
        <div style={{
            width:34, height:34, borderRadius:10, flexShrink:0,
            background:`linear-gradient(135deg, ${G(0.20)}, ${G(0.35)})`,
            border:`1px solid ${G(0.25)}`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:15, color:GOLD_BRIGHT,
            boxShadow:`0 3px 12px ${G(0.22)}`,
        }}>
            {icon}
        </div>
        <div>
            <div style={{
                fontFamily:"'Syne', sans-serif", fontWeight:800, fontSize:14,
                letterSpacing:"-0.01em",
                color: isDark ? "#F0EDE5" : "#0A0805", lineHeight:1.2,
            }}>{title}</div>
            {subtitle && (
                <div style={{ fontSize:11, color:isDark ? "#5C5248" : "#9E9080", marginTop:2 }}>
                    {subtitle}
                </div>
            )}
        </div>
        <div style={{
            flex:1, height:1, marginLeft:4,
            background:`linear-gradient(90deg, ${G(0.25)} 0%, transparent 100%)`,
        }} />
    </div>
);

// ═══════════════════════════════════════════════════════════════
// METRIC BOX
// ═══════════════════════════════════════════════════════════════
const MetricBox: React.FC<{
    icon:React.ReactNode; label:string; value:React.ReactNode;
    color:string; isDark:boolean; sub?:string;
}> = ({ icon, label, value, color, isDark, sub }) => (
    <div style={{
        flex:1,
        background: isDark ? `${color}10` : `${color}09`,
        borderRadius:16, padding:"16px 14px",
        border:`1px solid ${color}25`,
        display:"flex", flexDirection:"column", alignItems:"center",
        gap:6, textAlign:"center",
        transition:"all 0.25s cubic-bezier(0.22,1,0.36,1)",
    }}>
        <div style={{
            width:40, height:40, borderRadius:12,
            background:`${color}18`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:19, color,
        }}>
            {icon}
        </div>
        <div style={{
            fontSize:9, fontWeight:800, color,
            letterSpacing:"0.10em", textTransform:"uppercase",
            fontFamily:"'Syne', sans-serif",
        }}>
            {label}
        </div>
        <div style={{
            fontSize:18, fontWeight:800, color,
            fontFamily:"'Syne', sans-serif",
            letterSpacing:"-0.03em", lineHeight:1,
        }}>
            {value}
        </div>
        {sub && (
            <div style={{ fontSize:9.5, color, opacity:0.65, lineHeight:1.3 }}>
                {sub}
            </div>
        )}
    </div>
);

// ═══════════════════════════════════════════════════════════════
// FORMAT RUPIAH
// ═══════════════════════════════════════════════════════════════
const fmtFull = (v: number) =>
    new Intl.NumberFormat("id-ID",{ style:"currency", currency:"IDR", maximumFractionDigits:0 }).format(v);
const fmtShort = (v: number) => {
    if (v >= 1_000_000_000) return `Rp ${(v/1_000_000_000).toFixed(2)} M`;
    if (v >= 1_000_000)     return `Rp ${(v/1_000_000).toFixed(1)} Jt`;
    if (v >= 1_000)         return `Rp ${(v/1_000).toFixed(0)} Rb`;
    return `Rp ${v}`;
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export const InventarisShow = () => {
    const { token } = useToken();
    const { list, edit } = useNavigation();
    const bg     = token.colorBgContainer;
    const isDark = (() => {
        const c = bg.replace("#","");
        if (c.length < 6) return false;
        const lum = 0.299*parseInt(c.slice(0,2),16)
                  + 0.587*parseInt(c.slice(2,4),16)
                  + 0.114*parseInt(c.slice(4,6),16);
        return lum < 128;
    })();

    // ── Fetch ────────────────────────────────────────────────
    const { queryResult } = useShow<IInventaris>({
        meta: { select:"*, kategori:kategori_barang(nama_kategori), lokasi:lokasi_aset(nama_lokasi)" },
    });
    const { data, isLoading } = queryResult;
    const record = data?.data;

    // ── Print label ref ──────────────────────────────────────
    const labelRef = useRef<HTMLDivElement>(null);
    const handlePrintLabel = useReactToPrint({
        contentRef: labelRef,
        documentTitle: `Label_Aset_${record?.kode_barang || "Print"}`,
    });

    // ── Loading state ────────────────────────────────────────
    if (isLoading || !record) {
        return (
            <Card bordered={false} style={{
                borderRadius:20, border:`1px solid ${G(0.14)}`,
                background:token.colorBgContainer,
            }}>
                <Skeleton active avatar={{ size:80 }} paragraph={{ rows:12 }} />
            </Card>
        );
    }

    // ── Computed ─────────────────────────────────────────────
    const kondisiCfg   = KONDISI_CFG[record.kondisi as KondisiKey] ?? KONDISI_CFG.BAIK;
    const sumberColor  = SUMBER_COLOR[record.sumber_dana] ?? token.colorTextSecondary;
    const nilaiAsset   = Number(record.harga_perolehan || 0);
    const jumlahUnit   = Number(record.jumlah || 1);
    const nilaiTotal   = nilaiAsset * jumlahUnit;
    const qrValue      = JSON.stringify({
        id:     record.id,
        kode:   record.kode_barang,
        nama:   record.nama_barang,
        lokasi: record.lokasi?.nama_lokasi,
        kondisi:record.kondisi,
    });

    // ── Shared card style ────────────────────────────────────
    const cs = (extra?: React.CSSProperties): React.CSSProperties => ({
        borderRadius:20,
        border:`1px solid ${G(isDark ? 0.12 : 0.13)}`,
        background:token.colorBgContainer,
        boxShadow: isDark
            ? `0 6px 28px rgba(0,0,0,0.38), 0 0 0 1px ${G(0.07)}`
            : `0 4px 20px ${G(0.08)}, 0 2px 6px rgba(0,0,0,0.04)`,
        ...extra,
    });

    // ═══════════════════════════════════════════════════════════
    // EXPORT PDF — CORPORATE ASSET CARD
    // ═══════════════════════════════════════════════════════════
    const exportPdf = async () => {
        const key = "pdf_aset";
        try {
            const doc = new jsPDF({ orientation:"p", unit:"mm", format:"a4" }) as any;
            const W   = 210;
            const M   = 16;

            // ── HEADER BAND ───────────────────────────────────
            doc.setFillColor(92, 67, 10);
            doc.rect(0, 0, W, 30, "F");

            // Logo circle
            doc.setFillColor(201, 168, 76);
            doc.circle(M + 9, 15, 9, "F");
            doc.setFont("helvetica","bold");
            doc.setFontSize(8);
            doc.setTextColor(92, 67, 10);
            doc.text("AH", M + 6.5, 17.5);

            // Title
            doc.setFont("helvetica","bold");
            doc.setFontSize(15);
            doc.setTextColor(255,255,255);
            doc.text("PONDOK PESANTREN AL-HASANAH", W/2, 11, { align:"center" });

            doc.setFont("helvetica","normal");
            doc.setFontSize(8);
            doc.setTextColor(253,230,138);
            doc.text(
                "Jl. Raya Cibeuti Km.3, Kawalu, Kota Tasikmalaya  |  admin@alhasanah.id",
                W/2, 17, { align:"center" }
            );

            doc.setFontSize(7.5);
            doc.setTextColor(201,168,76);
            doc.text("KARTU INVENTARIS BARANG & ASET PESANTREN", W/2, 23, { align:"center" });

            // Gold accent line
            doc.setFillColor(201,168,76);
            doc.rect(0, 30, W, 2.5, "F");

            // ── DOCUMENT TITLE BANNER ─────────────────────────
            doc.setFillColor(201,168,76);
            doc.roundedRect(M, 36, W - M*2, 10, 2, 2, "F");
            doc.setFont("helvetica","bold");
            doc.setFontSize(10);
            doc.setTextColor(0,0,0);
            doc.text("KARTU DATA INVENTARIS ASET", W/2, 42.5, { align:"center" });

            // Doc number
            doc.setFont("helvetica","normal");
            doc.setFontSize(7);
            doc.setTextColor(92,67,10);
            doc.text(`No. Dokumen: INV-${record.kode_barang}`, M, 50);
            doc.text(`Dicetak: ${dayjs().format("DD MMMM YYYY, HH:mm")} WIB`, W - M, 50, { align:"right" });

            // ── MAIN CONTENT BOX ──────────────────────────────
            // Left side: data table
            // Right side: photo + QR

            const tblTop = 54;
            const photoW = 45;
            const tblW   = W - M*2 - photoW - 6;

            // Section A: Identitas Aset
            doc.setFillColor(253, 246, 220);
            doc.setDrawColor(201, 168, 76);
            doc.roundedRect(M, tblTop, tblW, 7, 1.5, 1.5, "F");
            doc.setFont("helvetica","bold");
            doc.setFontSize(8.5);
            doc.setTextColor(92, 67, 10);
            doc.text("A. IDENTITAS ASET", M + 4, tblTop + 4.8);

            // Table rows - identitas
            const rowsA = [
                ["Kode Barang",    record.kode_barang],
                ["Nama Barang",    record.nama_barang?.toUpperCase()],
                ["Kategori",       record.kategori?.nama_kategori || "—"],
                ["Lokasi Aset",    record.lokasi?.nama_lokasi || "—"],
                ["Spesifikasi",    record.spesifikasi || "—"],
                ["Jumlah Unit",    `${jumlahUnit} unit`],
            ];
            let y = tblTop + 9;
            doc.setFont("helvetica","normal");
            doc.setFontSize(9);
            rowsA.forEach(([lbl, val], i) => {
                if (i % 2 !== 0) {
                    doc.setFillColor(250, 248, 243);
                    doc.rect(M, y - 1.5, tblW, 6.5, "F");
                }
                doc.setFont("helvetica","normal");
                doc.setTextColor(107, 95, 80);
                doc.text(lbl, M + 2, y + 3);
                doc.setTextColor(17, 24, 39);
                doc.setFont("helvetica", i === 0 ? "bold" : "normal");
                doc.text(String(val), M + 40, y + 3);
                // Divider
                doc.setDrawColor(229, 221, 208);
                doc.setLineWidth(0.2);
                doc.line(M, y + 5, M + tblW, y + 5);
                y += 6.5;
            });

            // Section B: Keuangan
            y += 2;
            doc.setFillColor(253, 246, 220);
            doc.setDrawColor(201, 168, 76);
            doc.roundedRect(M, y, tblW, 7, 1.5, 1.5, "F");
            doc.setFont("helvetica","bold");
            doc.setFontSize(8.5);
            doc.setTextColor(92, 67, 10);
            doc.text("B. INFORMASI KEUANGAN & PENGADAAN", M + 4, y + 4.8);

            const rowsB = [
                ["Sumber Dana",       record.sumber_dana],
                ["Tgl Perolehan (M)", formatMasehi(record.tanggal_perolehan)],
                ["Tgl Perolehan (H)", formatHijri(record.tanggal_perolehan)],
                ["Harga Satuan",      fmtFull(nilaiAsset)],
                ["Jumlah Unit",       `${jumlahUnit} unit`],
                ["Total Nilai Aset",  fmtFull(nilaiTotal)],
            ];
            y += 9;
            doc.setFontSize(9);
            rowsB.forEach(([lbl, val], i) => {
                if (i % 2 !== 0) {
                    doc.setFillColor(250, 248, 243);
                    doc.rect(M, y - 1.5, tblW, 6.5, "F");
                }
                doc.setFont("helvetica","normal");
                doc.setTextColor(107, 95, 80);
                doc.text(lbl, M + 2, y + 3);
                // Highlight total
                if (i === 5) {
                    doc.setFont("helvetica","bold");
                    doc.setTextColor(92, 67, 10);
                } else {
                    doc.setFont("helvetica","normal");
                    doc.setTextColor(17, 24, 39);
                }
                doc.text(String(val), M + 40, y + 3);
                doc.setDrawColor(229, 221, 208);
                doc.setLineWidth(0.2);
                doc.line(M, y + 5, M + tblW, y + 5);
                y += 6.5;
            });

            // Section C: Kondisi
            y += 2;
            doc.setFillColor(253, 246, 220);
            doc.roundedRect(M, y, tblW, 7, 1.5, 1.5, "F");
            doc.setFont("helvetica","bold");
            doc.setFontSize(8.5);
            doc.setTextColor(92, 67, 10);
            doc.text("C. KONDISI & STATUS", M + 4, y + 4.8);

            y += 9;
            doc.setFont("helvetica","normal");
            doc.setFontSize(9);
            doc.setTextColor(107, 95, 80);
            doc.text("Kondisi Terakhir", M + 2, y + 3);

            // Kondisi badge
            const kClr: Record<KondisiKey, [number,number,number]> = {
                BAIK:         [5,150,105],
                RUSAK_RINGAN: [217,119,6],
                RUSAK_BERAT:  [220,38,38],
                HILANG:       [107,114,128],
            };
            const [r2,g2,b2] = kClr[record.kondisi as KondisiKey] || [107,114,128];
            doc.setFillColor(r2,g2,b2);
            doc.setTextColor(255,255,255);
            doc.setFont("helvetica","bold");
            doc.setFontSize(8);
            doc.roundedRect(M + 38, y - 0.5, 30, 5.5, 1.5, 1.5, "F");
            doc.text(record.kondisi.replace(/_/g," "), M + 53, y + 3.5, { align:"center" });
            y += 8;

            // Catatan
            doc.setFont("helvetica","normal");
            doc.setFontSize(9);
            doc.setTextColor(107, 95, 80);
            doc.text("Catatan:", M + 2, y + 3);
            doc.setTextColor(17,24,39);
            doc.text(record.keterangan || "—", M + 40, y + 3);
            y += 8;

            // ── RIGHT PANEL: Photo + QR ───────────────────────
            const panelX  = M + tblW + 6;
            const panelTop = tblTop;

            // Photo box
            doc.setFillColor(249,246,239);
            doc.setDrawColor(201,168,76);
            doc.setLineWidth(1.2);
            doc.roundedRect(panelX, panelTop, photoW, 52, 2, 2, "FD");

            doc.setFont("helvetica","bold");
            doc.setFontSize(6.5);
            doc.setTextColor(139,105,20);
            doc.text("FOTO ASET", panelX + photoW/2, panelTop + 5.5, { align:"center" });

            if (record.foto_url) {
                try {
                    doc.addImage(record.foto_url, "JPEG",
                        panelX + 2, panelTop + 8, photoW - 4, 40, undefined, "FAST");
                } catch {
                    doc.setFont("helvetica","normal");
                    doc.setFontSize(7);
                    doc.setTextColor(156,144,128);
                    doc.text("Foto tidak", panelX + photoW/2, panelTop + 27, { align:"center" });
                    doc.text("tersedia", panelX + photoW/2, panelTop + 33, { align:"center" });
                }
            } else {
                doc.setFont("helvetica","normal");
                doc.setFontSize(7);
                doc.setTextColor(156,144,128);
                doc.text("Foto tidak", panelX + photoW/2, panelTop + 27, { align:"center" });
                doc.text("tersedia", panelX + photoW/2, panelTop + 33, { align:"center" });
            }

            // ── QR CODE (from canvas) ─────────────────────────
            // We render QR via canvas element. Since jsPDF can't scan
            // a React component, we create a temp canvas.
            const canvas = document.createElement("canvas");
            canvas.width  = 120;
            canvas.height = 120;
            const qrCtx = canvas.getContext("2d");
            if (qrCtx) {
                // Draw white background
                qrCtx.fillStyle = "#FFFFFF";
                qrCtx.fillRect(0, 0, 120, 120);
            }

            // QR section below photo
            const qrTop = panelTop + 56;
            doc.setFillColor(255,255,255);
            doc.setDrawColor(201,168,76);
            doc.roundedRect(panelX, qrTop, photoW, photoW + 6, 2, 2, "FD");

            // Get QR canvas from DOM
            const qrCanvas = document.querySelector("canvas[data-pdf-qr]") as HTMLCanvasElement;
            if (qrCanvas) {
                const qrImg = qrCanvas.toDataURL("image/png");
                doc.addImage(qrImg, "PNG", panelX + 2, qrTop + 2, photoW - 4, photoW - 4);
            }

            doc.setFont("helvetica","bold");
            doc.setFontSize(6.5);
            doc.setTextColor(139,105,20);
            doc.text("SCAN VERIFIKASI", panelX + photoW/2, qrTop + photoW + 4, { align:"center" });

            // ── TANDA TANGAN ──────────────────────────────────
            const sigTop = y + 8;
            doc.setFont("helvetica","normal");
            doc.setFontSize(9);
            doc.setTextColor(107, 95, 80);
            doc.text(`Tasikmalaya, ${formatMasehi(new Date())}`, W - M, sigTop, { align:"right" });
            doc.text("Pihak Yang Menerima/Mencatat,", W - M, sigTop + 6, { align:"right" });

            doc.setFont("helvetica","bold");
            doc.setFontSize(9);
            doc.setTextColor(17,24,39);
            doc.text("___________________________", W - M, sigTop + 28, { align:"right" });
            doc.setFont("helvetica","normal");
            doc.setFontSize(8);
            doc.setTextColor(107,95,80);
            doc.text("Bag. Inventaris & Aset", W - M, sigTop + 34, { align:"right" });

            // ── FOOTER ───────────────────────────────────────
            const h = doc.internal.pageSize.height;
            doc.setFillColor(201,168,76);
            doc.rect(0, h - 8, W, 8, "F");
            doc.setFont("helvetica","bold");
            doc.setFontSize(6.5);
            doc.setTextColor(0,0,0);
            doc.text("AL-HASANAH DIGITAL ECOSYSTEM  ·  KARTU INVENTARIS RESMI", M, h - 3.5);
            doc.text(`${record.kode_barang}  ·  Cetak: ${dayjs().format("DD/MM/YYYY HH:mm")}`, W - M, h - 3.5, { align:"right" });

            doc.save(`Kartu_Aset_${record.kode_barang}_AlHasanah.pdf`);
        } catch (err:any) {
            console.error("PDF export error:", err);
        }
    };

    // ════════════════════════════════════════════════════════
    return (
        <motion.div
            initial="hidden" animate="visible" variants={stagger}
            style={{ display:"flex", flexDirection:"column", gap:20, paddingBottom:80 }}
        >

            {/* ══════════════════════════════════════════════
                ACTION BAR
            ══════════════════════════════════════════════ */}
            <motion.div variants={fadeUp} style={{
                display:"flex", alignItems:"center",
                justifyContent:"space-between", flexWrap:"wrap", gap:12,
                paddingBottom:20,
                borderBottom:`1px solid ${G(isDark ? 0.10 : 0.12)}`,
            }}>
                <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                    <button onClick={() => list("inventaris")}
                        style={{
                            display:"flex", alignItems:"center", gap:7,
                            padding:"0 16px", height:38, borderRadius:11,
                            border:`1px solid ${G(isDark ? 0.22 : 0.28)}`,
                            background:G(isDark ? 0.07 : 0.05),
                            color: isDark ? GOLD_LIGHT : GOLD_DEEP,
                            cursor:"pointer", fontSize:13, fontWeight:700,
                            transition:"all 0.2s", fontFamily:"'DM Sans', sans-serif",
                        }}>
                        <ArrowLeftOutlined style={{ fontSize:13 }} />
                        Kembali
                    </button>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ fontSize:11, color:token.colorTextTertiary }}>Inventaris</span>
                        <span style={{ fontSize:11, color:token.colorTextTertiary }}>/</span>
                        <span style={{ fontSize:11, fontWeight:700,
                            color: isDark ? GOLD_BRIGHT : GOLD_DEEP }}>
                            {record.kode_barang}
                        </span>
                    </div>
                </div>

                <div style={{ display:"flex", gap:10 }}>
                    <button onClick={() => edit("inventaris", record.id)}
                        style={{
                            display:"flex", alignItems:"center", gap:7,
                            padding:"0 16px", height:38, borderRadius:11,
                            border:`1px solid rgba(37,99,235,0.28)`,
                            background: isDark ? "rgba(37,99,235,0.08)" : "rgba(37,99,235,0.05)",
                            color:INFO, cursor:"pointer", fontSize:13, fontWeight:700,
                            transition:"all 0.2s", fontFamily:"'DM Sans', sans-serif",
                        }}>
                        <EditOutlined />
                        Edit Data
                    </button>
                    <button onClick={exportPdf}
                        style={{
                            display:"flex", alignItems:"center", gap:7,
                            padding:"0 16px", height:38, borderRadius:11,
                            border:`1px solid ${DANGER}28`,
                            background: isDark ? `${DANGER}08` : `${DANGER}06`,
                            color:DANGER, cursor:"pointer", fontSize:13, fontWeight:700,
                            transition:"all 0.2s", fontFamily:"'DM Sans', sans-serif",
                        }}>
                        <FilePdfOutlined />
                        Kartu Aset PDF
                    </button>
                    <button onClick={() => handlePrintLabel()}
                        style={{
                            display:"flex", alignItems:"center", gap:7,
                            padding:"0 20px", height:38, borderRadius:11, border:"none",
                            background:`linear-gradient(135deg, ${GOLD}, ${GOLD_BRIGHT})`,
                            color:"#000", cursor:"pointer", fontSize:13, fontWeight:800,
                            boxShadow:`0 4px 18px ${G(0.42)}`, transition:"all 0.2s",
                            fontFamily:"'DM Sans', sans-serif",
                        }}>
                        <PrinterOutlined />
                        Cetak Label
                    </button>
                </div>
            </motion.div>

            {/* ══════════════════════════════════════════════
                MAIN LAYOUT
            ══════════════════════════════════════════════ */}
            <Row gutter={[20, 20]}>

                {/* ── LEFT COLUMN ── */}
                <Col xs={24} md={8} lg={7}>
                    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

                        {/* ── ASSET PROFILE CARD ── */}
                        <motion.div custom={0} variants={fadeLeft}>
                            <Card bordered={false} bodyStyle={{ padding:0 }}
                                style={{ ...cs(), overflow:"hidden" }}>

                                {/* Cover banner */}
                                <div style={{
                                    height:100, position:"relative", overflow:"hidden",
                                    background: isDark
                                        ? `linear-gradient(135deg, ${G(0.30)}, ${G(0.12)} 60%, transparent)`
                                        : `linear-gradient(135deg, #F8F0D0, #FFF2B8 50%, #FDF6DC)`,
                                }}>
                                    <div style={{
                                        position:"absolute", top:-28, right:-28,
                                        width:140, height:140, borderRadius:"50%",
                                        border:`1.5px solid ${G(isDark ? 0.22 : 0.16)}`,
                                    }} />
                                    <div style={{
                                        position:"absolute", inset:0,
                                        background:`linear-gradient(105deg, transparent 40%, ${G(0.10)} 60%, transparent 80%)`,
                                        animation:"scanLine 3.5s linear infinite",
                                        pointerEvents:"none",
                                    }} />
                                    {/* Asset type badge */}
                                    <div style={{
                                        position:"absolute", top:10, left:12,
                                        display:"flex", alignItems:"center", gap:5,
                                    }}>
                                        <AppstoreOutlined style={{ color: isDark ? GOLD_LIGHT : GOLD_DEEP, fontSize:10 }} />
                                        <span style={{ fontSize:9, fontWeight:800,
                                            color: isDark ? GOLD_LIGHT : GOLD_DEEP,
                                            letterSpacing:"0.12em", textTransform:"uppercase",
                                            fontFamily:"'Syne', sans-serif" }}>
                                            {record.kategori?.nama_kategori || "Inventaris"}
                                        </span>
                                    </div>
                                    {/* Kondisi badge */}
                                    <div style={{
                                        position:"absolute", top:10, right:12,
                                        background: kondisiCfg.bg(isDark),
                                        border:`1px solid ${kondisiCfg.border(isDark)}`,
                                        borderRadius:99, padding:"2px 10px",
                                        display:"flex", alignItems:"center", gap:4,
                                    }}>
                                        <span style={{ fontSize:9, color:kondisiCfg.color }}>
                                            {kondisiCfg.icon}
                                        </span>
                                        <span style={{ fontSize:9, fontWeight:800,
                                            color:kondisiCfg.color,
                                            fontFamily:"'Syne', sans-serif",
                                            letterSpacing:"0.06em" }}>
                                            {kondisiCfg.label}
                                        </span>
                                    </div>
                                </div>

                                {/* Asset image */}
                                <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
                                    <div style={{
                                        marginTop:-44,
                                        padding:3,
                                        background:token.colorBgContainer,
                                        borderRadius:16,
                                        boxShadow:`0 0 0 3px ${G(0.35)}, 0 4px 20px rgba(0,0,0,0.18)`,
                                        overflow:"hidden",
                                        width:92, height:92, flexShrink:0,
                                    }}>
                                        {record.foto_url ? (
                                            <img src={record.foto_url}
                                                style={{ width:"100%", height:"100%",
                                                    objectFit:"cover", objectPosition:"center",
                                                    display:"block", borderRadius:13 }}
                                                alt={record.nama_barang}
                                            />
                                        ) : (
                                            <div style={{
                                                width:"100%", height:"100%", borderRadius:13,
                                                background: isDark ? G(0.14) : G(0.08),
                                                display:"flex", alignItems:"center",
                                                justifyContent:"center",
                                                fontSize:34, color: isDark ? G(0.55) : GOLD_DEEP,
                                            }}>
                                                <AppstoreOutlined />
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ padding:"14px 20px 20px", textAlign:"center", width:"100%" }}>
                                        <h2 style={{
                                            fontFamily:"'Syne', sans-serif", fontSize:15.5,
                                            fontWeight:800, margin:"0 0 4px",
                                            color:token.colorText, letterSpacing:"-0.02em",
                                            lineHeight:1.3,
                                        }}>
                                            {record.nama_barang}
                                        </h2>
                                        <div style={{
                                            fontFamily:"'DM Mono', monospace", fontSize:12,
                                            fontWeight:700, color: isDark ? GOLD_BRIGHT : GOLD_DEEP,
                                            letterSpacing:"0.14em", marginBottom:12,
                                        }}>
                                            {record.kode_barang}
                                        </div>

                                        <Divider style={{ margin:"0 0 14px",
                                            borderColor:G(isDark ? 0.14 : 0.10) }} />

                                        {/* Quick stats */}
                                        <div style={{ display:"flex", gap:8, marginBottom:14 }}>
                                            <div style={{
                                                flex:1, background:G(isDark ? 0.10 : 0.07),
                                                borderRadius:12, padding:"10px 6px",
                                                border:`1px solid ${G(isDark ? 0.20 : 0.14)}`,
                                            }}>
                                                <div style={{ fontSize:8.5, fontWeight:800,
                                                    textTransform:"uppercase", letterSpacing:"0.08em",
                                                    marginBottom:4,
                                                    color: isDark ? G(0.75) : GOLD_DEEP }}>Unit</div>
                                                <div style={{ fontSize:22, fontWeight:800,
                                                    lineHeight:1, fontFamily:"'Syne', sans-serif",
                                                    color: isDark ? GOLD_BRIGHT : GOLD_DEEP }}>
                                                    {jumlahUnit}
                                                </div>
                                            </div>
                                            <div style={{
                                                flex:1.6, background: kondisiCfg.bg(isDark),
                                                borderRadius:12, padding:"10px 8px",
                                                border:`1px solid ${kondisiCfg.border(isDark)}`,
                                            }}>
                                                <div style={{ fontSize:8.5, fontWeight:800,
                                                    textTransform:"uppercase", letterSpacing:"0.08em",
                                                    marginBottom:4, color:kondisiCfg.color }}>
                                                    Kondisi
                                                </div>
                                                <div style={{ fontSize:12, fontWeight:800,
                                                    color:kondisiCfg.color, display:"flex",
                                                    alignItems:"center", gap:4 }}>
                                                    {kondisiCfg.icon}
                                                    {kondisiCfg.label}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Kondisi health bar */}
                                        <div style={{ marginBottom:4 }}>
                                            <div style={{ display:"flex", justifyContent:"space-between",
                                                marginBottom:4 }}>
                                                <span style={{ fontSize:9.5, fontWeight:700,
                                                    color:isDark ? G(0.70) : GOLD_DEEP }}>
                                                    Indikator Kondisi
                                                </span>
                                                <span style={{ fontSize:9.5, fontWeight:800,
                                                    fontFamily:"'DM Mono', monospace",
                                                    color:kondisiCfg.color }}>
                                                    {kondisiCfg.pct}%
                                                </span>
                                            </div>
                                            <Progress
                                                percent={kondisiCfg.pct}
                                                showInfo={false}
                                                strokeColor={kondisiCfg.color}
                                                trailColor={isDark ? "rgba(255,255,255,0.07)" : "#F3E9C0"}
                                                strokeWidth={7}
                                                style={{ margin:0 }}
                                            />
                                        </div>

                                        {/* Tanggal perolehan */}
                                        <div style={{
                                            marginTop:12, display:"flex", alignItems:"center",
                                            gap:6, justifyContent:"center", fontSize:11,
                                            color:token.colorTextSecondary,
                                        }}>
                                            <CalendarOutlined style={{ color:GOLD, fontSize:11 }} />
                                            {formatMasehi(record.tanggal_perolehan)}
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>

                        {/* ── QR DIGITAL TAG ── */}
                        <motion.div custom={1} variants={fadeLeft}>
                            <Card bordered={false} bodyStyle={{ padding:20 }}
                                style={{ ...cs(),
                                    background: isDark
                                        ? `linear-gradient(160deg, ${G(0.09)} 0%, transparent 100%)`
                                        : `linear-gradient(160deg, #FFFBF0 0%, #FFFFFF 100%)`,
                                }}>
                                <div style={{ display:"flex", justifyContent:"space-between",
                                    alignItems:"center", marginBottom:16 }}>
                                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                        <div style={{
                                            width:30, height:30, borderRadius:9,
                                            background:`linear-gradient(135deg, ${G(0.25)}, ${G(0.45)})`,
                                            border:`1px solid ${G(0.30)}`,
                                            display:"flex", alignItems:"center", justifyContent:"center",
                                            color:GOLD_BRIGHT, fontSize:13,
                                        }}>
                                            <QrcodeOutlined />
                                        </div>
                                        <span style={{ fontSize:11, fontWeight:800,
                                            color: isDark ? GOLD_BRIGHT : GOLD_DEEP,
                                            letterSpacing:"0.10em", textTransform:"uppercase",
                                            fontFamily:"'Syne', sans-serif" }}>
                                            Digital Tag
                                        </span>
                                    </div>
                                    <div style={{
                                        fontSize:9, fontWeight:800, letterSpacing:"0.06em",
                                        color: SUCCESS,
                                        background:`${SUCCESS}14`,
                                        border:`1px solid ${SUCCESS}28`,
                                        borderRadius:99, padding:"2px 10px",
                                    }}>
                                        ● VALID
                                    </div>
                                </div>

                                <div style={{ textAlign:"center" }}>
                                    <div style={{
                                        display:"inline-block",
                                        background:"#FFFFFF",
                                        padding:10, borderRadius:14,
                                        border:`1.5px solid ${G(0.28)}`,
                                        boxShadow:`0 4px 20px ${G(0.16)}, 0 0 0 6px ${isDark ? G(0.05) : G(0.04)}`,
                                        marginBottom:12,
                                    }}>
                                        {/* ✅ QR hitam murni - selalu scannable */}
                                        <QRCodeCanvas
                                            data-pdf-qr
                                            value={qrValue}
                                            size={140}
                                            fgColor="#000000"
                                            bgColor="#FFFFFF"
                                            level="H"
                                        />
                                    </div>
                                    <div style={{
                                        fontFamily:"'DM Mono', monospace", fontSize:14,
                                        fontWeight:700, letterSpacing:"0.16em",
                                        color: isDark ? GOLD_BRIGHT : GOLD_DEEP, marginBottom:4,
                                    }}>
                                        {record.kode_barang}
                                    </div>
                                    <div style={{ fontSize:10.5, color:token.colorTextSecondary }}>
                                        Scan untuk verifikasi data aset
                                    </div>
                                </div>

                                <div style={{
                                    marginTop:14, padding:"8px 12px", borderRadius:10,
                                    background:G(isDark ? 0.07 : 0.05),
                                    border:`1px solid ${G(isDark ? 0.16 : 0.12)}`,
                                    display:"flex", alignItems:"center", gap:7,
                                }}>
                                    <SafetyCertificateOutlined style={{ color:GOLD_BRIGHT,
                                        fontSize:13, flexShrink:0 }} />
                                    <span style={{ fontSize:10.5, color:token.colorTextSecondary,
                                        lineHeight:1.4 }}>
                                        Disertifikasi oleh{" "}
                                        <strong style={{ color: isDark ? GOLD_BRIGHT : GOLD_DEEP }}>
                                            Sistem Informasi Al-Hasanah
                                        </strong>
                                    </span>
                                </div>
                            </Card>
                        </motion.div>
                    </div>
                </Col>

                {/* ── RIGHT COLUMN ── */}
                <Col xs={24} md={16} lg={17}>
                    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

                        {/* METRIC ROW */}
                        <motion.div custom={0} variants={fadeRight}>
                            <div style={{ display:"flex", gap:14 }}>
                                <MetricBox icon={<DollarOutlined />} label="Nilai Satuan"
                                    value={fmtShort(nilaiAsset)} color={GOLD_BRIGHT} isDark={isDark}
                                    sub={fmtFull(nilaiAsset)} />
                                <MetricBox icon={<ShopOutlined />} label="Total Nilai"
                                    value={fmtShort(nilaiTotal)} color={SUCCESS} isDark={isDark}
                                    sub={`${jumlahUnit} unit × ${fmtShort(nilaiAsset)}`} />
                                <MetricBox icon={<AimOutlined />} label="Unit"
                                    value={`${jumlahUnit} pcs`} color={INFO} isDark={isDark}
                                    sub="Jumlah barang" />
                                <MetricBox icon={kondisiCfg.icon} label="Kondisi"
                                    value={`${kondisiCfg.pct}%`} color={kondisiCfg.color} isDark={isDark}
                                    sub={kondisiCfg.label} />
                            </div>
                        </motion.div>

                        {/* SECTION 1: Identitas Aset */}
                        <motion.div custom={1} variants={fadeRight}>
                            <Card bordered={false} bodyStyle={{ padding:"22px 24px" }} style={cs()}>
                                <SectionHeader icon={<BarcodeOutlined />} title="Identitas Aset"
                                    subtitle="Kode, kategori dan spesifikasi teknis"
                                    isDark={isDark} />
                                <Row>
                                    <Col xs={24} md={12}>
                                        <InfoRow isDark={isDark} token={token}
                                            label="Kode Barang" icon={<TagOutlined />} mono
                                            highlight
                                            value={
                                                <span style={{ fontFamily:"'DM Mono', monospace",
                                                    fontWeight:800, fontSize:14,
                                                    color: isDark ? GOLD_BRIGHT : GOLD_DEEP }}>
                                                    {record.kode_barang}
                                                </span>
                                            }
                                        />
                                        <InfoRow isDark={isDark} token={token}
                                            label="Nama Barang" icon={<AppstoreOutlined />}
                                            value={<strong style={{ fontSize:14 }}>{record.nama_barang}</strong>} />
                                        <InfoRow isDark={isDark} token={token}
                                            label="Kategori" icon={<FileProtectOutlined />}
                                            value={
                                                <span style={{
                                                    padding:"2px 10px", borderRadius:99,
                                                    background: isDark ? "rgba(37,99,235,0.14)" : "#EFF6FF",
                                                    border:"1px solid rgba(37,99,235,0.22)",
                                                    color:INFO, fontSize:12, fontWeight:700,
                                                }}>
                                                    {record.kategori?.nama_kategori || "—"}
                                                </span>
                                            }
                                        />
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <InfoRow isDark={isDark} token={token}
                                            label="Lokasi Aset" icon={<EnvironmentOutlined />}
                                            value={record.lokasi?.nama_lokasi} />
                                        <InfoRow isDark={isDark} token={token}
                                            label="Jumlah Unit" icon={<ShopOutlined />}
                                            value={
                                                <span style={{
                                                    fontFamily:"'DM Mono', monospace",
                                                    fontWeight:800, fontSize:15,
                                                    color: isDark ? GOLD_BRIGHT : GOLD_DEEP,
                                                }}>
                                                    {jumlahUnit} unit
                                                </span>
                                            }
                                        />
                                        <InfoRow isDark={isDark} token={token}
                                            label="Spesifikasi" icon={<InfoCircleOutlined />}
                                            value={record.spesifikasi} />
                                    </Col>
                                </Row>
                            </Card>
                        </motion.div>

                        {/* SECTION 2: Keuangan & Pengadaan */}
                        <motion.div custom={2} variants={fadeRight}>
                            <Card bordered={false} bodyStyle={{ padding:"22px 24px" }} style={cs()}>
                                <SectionHeader icon={<DollarOutlined />} title="Keuangan & Pengadaan"
                                    subtitle="Sumber dana, tanggal dan nilai perolehan"
                                    isDark={isDark} />
                                <Row>
                                    <Col xs={24} md={12}>
                                        <InfoRow isDark={isDark} token={token}
                                            label="Sumber Dana" icon={<CrownOutlined />}
                                            value={
                                                <span style={{
                                                    padding:"3px 12px", borderRadius:99,
                                                    background:`${sumberColor}16`,
                                                    border:`1px solid ${sumberColor}28`,
                                                    color:sumberColor, fontSize:12, fontWeight:800,
                                                    fontFamily:"'Syne', sans-serif",
                                                }}>
                                                    {record.sumber_dana}
                                                </span>
                                            }
                                        />
                                        <InfoRow isDark={isDark} token={token}
                                            label="Tgl Perolehan" icon={<CalendarOutlined />}
                                            value={
                                                record.tanggal_perolehan ? (
                                                    <div>
                                                        <div style={{ fontWeight:600, fontSize:13 }}>
                                                            {formatMasehi(record.tanggal_perolehan)}
                                                        </div>
                                                        <div style={{ fontSize:11, color:GOLD_BRIGHT,
                                                            fontWeight:600, marginTop:2 }}>
                                                            {formatHijri(record.tanggal_perolehan)}
                                                        </div>
                                                    </div>
                                                ) : undefined
                                            }
                                        />
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <InfoRow isDark={isDark} token={token}
                                            label="Harga Satuan" icon={<DollarOutlined />}
                                            highlight
                                            value={
                                                <span style={{
                                                    fontFamily:"'Syne', sans-serif",
                                                    fontWeight:800, fontSize:15,
                                                    color: isDark ? GOLD_BRIGHT : GOLD_DEEP,
                                                }}>
                                                    {fmtFull(nilaiAsset)}
                                                </span>
                                            }
                                        />
                                        <InfoRow isDark={isDark} token={token}
                                            label="Total Nilai" icon={<RocketOutlined />}
                                            highlight
                                            value={
                                                <span style={{
                                                    fontFamily:"'Syne', sans-serif",
                                                    fontWeight:800, fontSize:15,
                                                    color: SUCCESS,
                                                }}>
                                                    {fmtFull(nilaiTotal)}
                                                </span>
                                            }
                                        />
                                    </Col>
                                </Row>
                            </Card>
                        </motion.div>

                        {/* SECTION 3: Kondisi & Catatan */}
                        <motion.div custom={3} variants={fadeRight}>
                            <Card bordered={false} bodyStyle={{ padding:"22px 24px" }} style={cs()}>
                                <SectionHeader icon={<SafetyCertificateOutlined />}
                                    title="Kondisi & Catatan"
                                    subtitle="Status fisik terkini dan keterangan tambahan"
                                    isDark={isDark} />
                                <Row>
                                    <Col xs={24} md={12}>
                                        <InfoRow isDark={isDark} token={token}
                                            label="Kondisi Fisik" icon={kondisiCfg.icon}
                                            value={
                                                <div style={{
                                                    display:"inline-flex", alignItems:"center", gap:6,
                                                    padding:"5px 16px", borderRadius:99,
                                                    background:kondisiCfg.bg(isDark),
                                                    border:`1px solid ${kondisiCfg.border(isDark)}`,
                                                }}>
                                                    <span style={{ color:kondisiCfg.color, fontSize:13 }}>
                                                        {kondisiCfg.icon}
                                                    </span>
                                                    <span style={{ fontWeight:800, fontFamily:"'Syne', sans-serif",
                                                        color:kondisiCfg.color, fontSize:12,
                                                        letterSpacing:"0.06em" }}>
                                                        {kondisiCfg.label}
                                                    </span>
                                                </div>
                                            }
                                        />
                                        <InfoRow isDark={isDark} token={token}
                                            label="Catatan" icon={<FileProtectOutlined />}
                                            value={record.keterangan} />
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <div style={{ padding:"12px 10px" }}>
                                            <div style={{ fontSize:11, fontWeight:700,
                                                textTransform:"uppercase", letterSpacing:"0.07em",
                                                color: isDark ? G(0.75) : GOLD_DEEP,
                                                marginBottom:8 }}>
                                                Indikator Kelayakan Aset
                                            </div>
                                            <Progress
                                                percent={kondisiCfg.pct}
                                                strokeColor={kondisiCfg.color}
                                                trailColor={isDark ? "rgba(255,255,255,0.07)" : "#F3E9C0"}
                                                strokeWidth={10}
                                                format={pct => (
                                                    <span style={{ fontFamily:"'DM Mono', monospace",
                                                        fontWeight:800, fontSize:12,
                                                        color:kondisiCfg.color }}>
                                                        {pct}%
                                                    </span>
                                                )}
                                            />
                                            <div style={{ fontSize:10.5, color:token.colorTextSecondary,
                                                marginTop:6 }}>
                                                Status: <strong style={{ color:kondisiCfg.color }}>
                                                    {kondisiCfg.label}
                                                </strong>
                                            </div>
                                        </div>
                                    </Col>
                                </Row>
                            </Card>
                        </motion.div>
                    </div>
                </Col>
            </Row>

            {/* ══════════════════════════════════════════════
                PRINT LABEL — HIDDEN
                Corporate-grade asset label for physical tagging
            ══════════════════════════════════════════════ */}
            <div style={{ display:"none" }}>
                <div ref={labelRef} style={{
                    width:"62mm", padding:0,
                    fontFamily:"'Arial', 'Helvetica', sans-serif",
                    background:"#FFFFFF", color:"#111827",
                }}>
                    {/* ── LABEL TOP HEADER ── */}
                    <div style={{
                        background:"#5C430A",
                        padding:"5px 8px 4px",
                        display:"flex", alignItems:"center", gap:6,
                    }}>
                        {/* Pesantren mark mini */}
                        <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
                            <path d="M16 3C11 3 7 7 7 12V14H25V12C25 7 21 3 16 3Z" fill="#FFB700" opacity="0.95"/>
                            <rect x="5" y="10" width="3" height="11" rx="1.5" fill="#FFB700" opacity="0.7"/>
                            <rect x="24" y="10" width="3" height="11" rx="1.5" fill="#FFB700" opacity="0.7"/>
                            <rect x="9" y="14" width="14" height="9" rx="2" fill="#FFB700" opacity="0.85"/>
                            <rect x="4" y="23" width="24" height="2" rx="1" fill="#FFB700" opacity="0.5"/>
                        </svg>
                        <div>
                            <div style={{ fontWeight:900, fontSize:"7.5pt",
                                color:"#FFB700", letterSpacing:"0.08em" }}>
                                AL-HASANAH
                            </div>
                            <div style={{ fontSize:"5.5pt", color:"rgba(255,183,0,0.55)",
                                letterSpacing:"0.10em" }}>
                                INVENTARIS ASET
                            </div>
                        </div>
                    </div>

                    {/* Gold accent */}
                    <div style={{ height:"1.5mm", background:"#C9A84C" }} />

                    {/* QR + Info side by side */}
                    <div style={{ display:"flex", padding:"5px 6px", gap:"5px" }}>
                        {/* QR */}
                        <div style={{
                            background:"#FFFFFF", padding:"3px",
                            border:"1px solid #C9A84C", borderRadius:"2mm",
                            display:"inline-block", flexShrink:0,
                        }}>
                            <QRCodeCanvas
                                value={qrValue}
                                size={72}
                                fgColor="#000000"
                                bgColor="#FFFFFF"
                                level="H"
                            />
                        </div>

                        {/* Text info */}
                        <div style={{ flex:1, paddingTop:"2px", minWidth:0 }}>
                            <div style={{ fontWeight:900, fontSize:"8pt",
                                color:"#111827", lineHeight:1.2, marginBottom:"3px",
                                wordBreak:"break-word" }}>
                                {record.nama_barang}
                            </div>
                            <div style={{ fontFamily:"Courier New, monospace",
                                fontSize:"7pt", fontWeight:700, color:"#8B6914",
                                letterSpacing:"0.06em", marginBottom:"4px" }}>
                                {record.kode_barang}
                            </div>
                            <div style={{ borderTop:"0.5px solid #E5DDD0", paddingTop:"3px" }}>
                                <div style={{ fontSize:"6.5pt", color:"#6B5F50", marginBottom:"2px" }}>
                                    📍 {record.lokasi?.nama_lokasi || "—"}
                                </div>
                                <div style={{ fontSize:"6.5pt", color:"#6B5F50", marginBottom:"2px" }}>
                                    📅 {dayjs(record.tanggal_perolehan).format("DD/MM/YYYY")}
                                </div>
                                <div style={{
                                    display:"inline-block",
                                    padding:"1px 6px", borderRadius:"99px",
                                    background: record.kondisi === "BAIK" ? "#D1FAE5" : "#FEF3C7",
                                    border:`0.5px solid ${record.kondisi === "BAIK" ? "#059669" : "#D97706"}`,
                                    fontSize:"6pt", fontWeight:700,
                                    color: record.kondisi === "BAIK" ? "#059669" : "#D97706",
                                }}>
                                    {record.kondisi.replace(/_/g," ")}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer strip */}
                    <div style={{
                        background:"#FDF6DC",
                        borderTop:"0.5px solid #E5DDD0",
                        padding:"3px 6px",
                        display:"flex", justifyContent:"space-between",
                        alignItems:"center",
                    }}>
                        <span style={{ fontSize:"5.5pt", color:"#9E9080",
                            fontStyle:"italic" }}>
                            *Tempel pada fisik barang
                        </span>
                        <span style={{ fontFamily:"Courier New, monospace",
                            fontSize:"5.5pt", color:"#C9A84C", fontWeight:700 }}>
                            INV-{record.kode_barang}
                        </span>
                    </div>
                </div>
            </div>

        </motion.div>
    );
};
