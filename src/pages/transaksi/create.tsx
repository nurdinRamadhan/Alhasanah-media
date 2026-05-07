import React, { useState, useRef } from "react";
import { Create, useForm, useSelect } from "@refinedev/antd";
import {
    Form, Input, InputNumber, Select, DatePicker,
    Radio, Card, Typography, Row, Col, theme,
    Space, Tag, Divider, Tooltip, Alert,
} from "antd";
import { motion, AnimatePresence } from "framer-motion";
import {
    HeartOutlined, UserOutlined, GlobalOutlined,
    InfoCircleOutlined, WalletOutlined, BankOutlined,
    CreditCardOutlined, CalendarOutlined, LockOutlined,
    SafetyCertificateOutlined, CheckCircleOutlined,
    StarOutlined, DollarOutlined, TeamOutlined,
    EditOutlined, ThunderboltOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import "dayjs/locale/id";
import { ITransaksiKeuangan, ISantri, IUserIdentity } from "../../types";
import { useGetIdentity } from "@refinedev/core";
import { formatHijri } from "../../utility/dateHelper";

dayjs.locale("id");

const { Text, Title } = Typography;
const { useToken }    = theme;

// ═══════════════════════════════════════════════════════════════
// 🎨  BRAND TOKENS — identik dengan seluruh ekosistem
// ═══════════════════════════════════════════════════════════════
const GOLD       = "#D4A017";
const GOLD_LIGHT = "#F0C040";
const GOLD_DARK  = "#9A7A00";
const G          = (o: number) => `rgba(212,160,23,${o})`;

const C = {
    purple : { base:"#8B5CF6", light:"#F5F3FF", dark:"rgba(139,92,246,0.12)", border:"rgba(139,92,246,0.28)", glow:"rgba(139,92,246,0.3)" },
    blue   : { base:"#3B82F6", light:"#EFF6FF", dark:"rgba(59,130,246,0.12)",  border:"rgba(59,130,246,0.28)",  glow:"rgba(59,130,246,0.3)"  },
    green  : { base:"#22C55E", light:"#F0FDF4", dark:"rgba(34,197,94,0.12)",   border:"rgba(34,197,94,0.28)",   glow:"rgba(34,197,94,0.3)"   },
    red    : { base:"#EF4444", light:"#FFF1F2", dark:"rgba(239,68,68,0.12)",   border:"rgba(239,68,68,0.28)",   glow:"rgba(239,68,68,0.3)"   },
    amber  : { base:"#F59E0B", light:"#FFFBEB", dark:"rgba(245,158,11,0.12)",  border:"rgba(245,158,11,0.28)",  glow:"rgba(245,158,11,0.3)"  },
} as const;

// ═══════════════════════════════════════════════════════════════
// 🎨  INJECTED PREMIUM CSS
// ═══════════════════════════════════════════════════════════════
const CREATE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;900&family=Outfit:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

  .tc-root { font-family:'Outfit','PingFang SC',system-ui,sans-serif; }

  @keyframes tc-shimmer {
    0%   { background-position:-200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes tc-float {
    0%,100% { transform:translateY(0); }
    50%      { transform:translateY(-5px); }
  }
  @keyframes tc-glow-pulse {
    0%,100% { box-shadow:0 0 0 0 rgba(212,160,23,0.4); }
    60%      { box-shadow:0 0 0 10px rgba(212,160,23,0); }
  }
  @keyframes tc-bounce-in {
    0%   { opacity:0; transform:scale(.88) translateY(8px); }
    60%  { transform:scale(1.02) translateY(-2px); }
    100% { opacity:1; transform:scale(1) translateY(0); }
  }

  .tc-shimmer {
    background:linear-gradient(120deg,#9A7A00 0%,#D4A017 28%,#F5D060 50%,#D4A017 72%,#9A7A00 100%);
    background-size:200% auto;
    -webkit-background-clip:text; -webkit-text-fill-color:transparent;
    background-clip:text;
    animation:tc-shimmer 5s linear infinite;
  }
  .tc-float { animation:tc-float 3.8s ease-in-out infinite; }

  /* ── Form field premium ── */
  .tc-root .ant-input,
  .tc-root .ant-input-number,
  .tc-root .ant-input-number-input,
  .tc-root .ant-picker,
  .tc-root .ant-select-selector {
    border-radius: 11px !important;
    font-family:'Outfit',sans-serif !important;
    font-size:13.5px !important;
    transition:border-color .2s ease, box-shadow .2s ease !important;
  }
  .tc-root .ant-input:focus,
  .tc-root .ant-input-number:focus-within,
  .tc-root .ant-picker-focused,
  .tc-root .ant-select-focused .ant-select-selector {
    border-color:${GOLD} !important;
    box-shadow:0 0 0 3px ${G(.15)} !important;
  }
  .tc-root .ant-input:hover,
  .tc-root .ant-input-number:hover,
  .tc-root .ant-picker:hover,
  .tc-root .ant-select-selector:hover {
    border-color:${GOLD} !important;
  }
  .tc-root .ant-form-item-label > label {
    font-weight:700 !important;
    font-size:11px !important;
    text-transform:uppercase !important;
    letter-spacing:.07em !important;
  }
  .tc-root .ant-input-number-prefix {
    color:${GOLD_DARK};
    font-weight:700;
    font-size:13px;
    margin-right:4px;
  }

  /* ── Donor type card ── */
  .tc-donor-card {
    cursor:pointer;
    transition:all .26s cubic-bezier(.4,0,.2,1);
    border-radius:14px !important;
  }
  .tc-donor-card:hover { transform:translateY(-3px); }

  /* ── Kategori pill ── */
  .tc-kat-pill {
    cursor:pointer;
    transition:all .22s cubic-bezier(.4,0,.2,1);
    user-select:none;
  }
  .tc-kat-pill:hover { transform:scale(1.04); }

  /* ── Method card ── */
  .tc-method-card {
    cursor:pointer;
    border-radius:12px !important;
    transition:all .22s cubic-bezier(.4,0,.2,1) !important;
  }
  .tc-method-card:hover { transform:translateY(-2px); }

  /* ── Amount input large ── */
  .tc-amount-input .ant-input-number-input {
    font-family:'DM Mono','Courier New',monospace !important;
    font-size:22px !important;
    font-weight:800 !important;
    text-align:right !important;
    padding-right:16px !important;
  }

  /* ── Preview card ── */
  .tc-preview-glow {
    box-shadow:0 0 0 1px ${G(.25)},
               0 8px 32px ${G(.15)},
               0 2px 8px rgba(0,0,0,0.04);
  }

  ::-webkit-scrollbar { width:5px; }
  ::-webkit-scrollbar-track  { background:transparent; }
  ::-webkit-scrollbar-thumb  { background:${G(.35)}; border-radius:3px; }

  .tc-mono { font-family:'DM Mono','Courier New',monospace !important; }
`;

// ═══════════════════════════════════════════════════════════════
// 🔧  KATEGORI CONFIG
// ═══════════════════════════════════════════════════════════════
const KATEGORI = [
    { value:"INFAQ",   emoji:"💰", label:"Infaq",   color:C.amber,  desc:"Dana untuk operasional pesantren"  },
    { value:"WAKAF",   emoji:"🏛️", label:"Wakaf",   color:C.blue,   desc:"Aset/dana wakaf produktif"         },
    { value:"SHADAQAH",emoji:"🤝", label:"Shadaqah", color:C.green,  desc:"Sedekah jariyah umum"              },
    { value:"DONASI",  emoji:"🎁", label:"Donasi",  color:C.purple, desc:"Program donasi khusus pesantren"   },
] as const;

// ═══════════════════════════════════════════════════════════════
// 🔧  METODE CONFIG
// ═══════════════════════════════════════════════════════════════
const METODE = [
    { value:"cash",     icon:<WalletOutlined />,     label:"Tunai / Cash",   sub:"Diterima langsung",    color:C.green  },
    { value:"transfer", icon:<BankOutlined />,        label:"Transfer Bank",  sub:"Via rekening resmi",  color:C.blue   },
    { value:"digital",  icon:<CreditCardOutlined />,  label:"Digital / QRIS", sub:"E-wallet & QRIS",     color:C.purple },
] as const;

// ═══════════════════════════════════════════════════════════════
// 🚀  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export const TransaksiCreate: React.FC = () => {
    const { token } = useToken();
    const { data: user } = useGetIdentity<IUserIdentity>();

    // Dark mode detection
    const hexLum = (hex: string) => {
        const c = hex.replace("#","");
        if (c.length < 6) return 200;
        return .299*parseInt(c.slice(0,2),16)
             + .587*parseInt(c.slice(2,4),16)
             + .114*parseInt(c.slice(4,6),16);
    };
    const isDark = hexLum(token.colorBgContainer) < 128;

    // ── Local State ─────────────────────────────────────
    const [donorType,   setDonorType]   = useState<"SANTRI"|"UMUM">("UMUM");
    const [kategori,    setKategori]    = useState<string>("INFAQ");
    const [metode,      setMetode]      = useState<string>("cash");
    const [nominal,     setNominal]     = useState<number>(0);
    const [donorName,   setDonorName]   = useState<string>("");
    const [catatan,     setCatatan]     = useState<string>("");

    // ── Refine Form ─────────────────────────────────────
    const { formProps, saveButtonProps, onFinish } = useForm<ITransaksiKeuangan>({
        resource: "transaksi_keuangan",
        redirect: "list",
    });

    const { selectProps: santriSelectProps } = useSelect<ISantri>({
        resource: "santri",
        optionLabel: "nama",
        optionValue: "nis",
        filters: [{ field:"status_santri", operator:"eq", value:"AKTIF" }],
        onSearch: (v) => [{ field:"nama", operator:"contains", value:v }],
    });

    // ── Computed preview values ──────────────────────────
    const kategoriMeta = KATEGORI.find(k => k.value === kategori) ?? KATEGORI[0];
    const metodeMeta   = METODE.find(m => m.value === metode)     ?? METODE[0];
    const fCurrency    = (n: number) =>
        new Intl.NumberFormat("id-ID", { style:"currency", currency:"IDR", minimumFractionDigits:0 }).format(n);

    // ── Handle Submit ────────────────────────────────────
    const handleFinish = async (values: any) => {
        const keteranganFinal = donorType === "UMUM"
            ? `[${values.kategori_donasi}] dari ${values.nama_donatur_manual || "Hamba Allah"} - ${values.keterangan_donasi || ""}`.trimEnd()
            : `[${values.kategori_donasi}] dari Santri - ${values.keterangan_donasi || ""}`.trimEnd();

        const finalValues: Partial<ITransaksiKeuangan> = {
            santri_nis          : donorType === "SANTRI" ? values.santri_nis : undefined,
            jumlah              : values.jumlah,
            metode_pembayaran   : values.metode_pembayaran,
            tanggal_transaksi   : values.tanggal_transaksi
                                    ? values.tanggal_transaksi.toISOString()
                                    : new Date().toISOString(),
            keterangan          : keteranganFinal,
            jenis_transaksi     : "masuk",
            status_transaksi    : "settlement",
            status              : "success",
            admin_pencatat_id   : user?.id,
        };

        try {
            await onFinish(finalValues);
        } catch (error) {
            console.error(error);
        }
    };

    // ── Shared card style ────────────────────────────────
    const sectionCard: React.CSSProperties = {
        borderRadius:18,
        border:`1px solid ${G(isDark?.22:.14)}`,
        background:token.colorBgContainer,
        boxShadow:isDark
            ?`0 4px 20px rgba(0,0,0,0.3),0 0 0 1px ${G(.1)}`
            :`0 4px 20px ${G(.08)},0 2px 6px rgba(0,0,0,0.04)`,
        marginBottom:20,
        overflow:"hidden",
    };

    const sectionHeader = (
        icon: React.ReactNode,
        title: string,
        subtitle: string,
        step: number
    ) => (
        <div style={{
            display:"flex", alignItems:"center", gap:14,
            padding:"18px 24px",
            background:isDark
                ?`linear-gradient(135deg,${G(.15)} 0%,${G(.06)} 100%)`
                :`linear-gradient(135deg,#FDF6DC 0%,#FFFBF0 100%)`,
            borderBottom:`1px solid ${G(isDark?.18:.1)}`,
        }}>
            <div style={{
                width:42, height:42, borderRadius:13, flexShrink:0,
                background:`linear-gradient(135deg,${GOLD},${GOLD_DARK})`,
                display:"flex", alignItems:"center", justifyContent:"center",
                boxShadow:`0 4px 14px ${G(.45)}`,
                fontSize:18, color:"#fff",
            }}>
                {icon}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <Text style={{
                        fontSize:14, fontWeight:800, color:token.colorText,
                        display:"block", lineHeight:"1.2",
                        fontFamily:"'Outfit',sans-serif",
                    }}>
                        {title}
                    </Text>
                    <div style={{
                        width:22, height:22, borderRadius:"50%", flexShrink:0,
                        background:`linear-gradient(135deg,${GOLD},${GOLD_DARK})`,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:10, fontWeight:900, color:"#fff",
                    }}>
                        {step}
                    </div>
                </div>
                <Text style={{ fontSize:11.5, color:token.colorTextSecondary, marginTop:2, display:"block" }}>
                    {subtitle}
                </Text>
            </div>
        </div>
    );

    return (
        <div className="tc-root" style={{ maxWidth:860, margin:"0 auto", paddingBottom:80 }}>
            <style>{CREATE_CSS}</style>

            {/* ╔══════════════════════════════════════════╗
                ║          HERO PAGE HEADER                ║
                ╚══════════════════════════════════════════╝ */}
            <motion.div
                initial={{ opacity:0, y:-16 }}
                animate={{ opacity:1, y:0 }}
                transition={{ duration:.46, ease:"easeOut" }}
                style={{
                    background:isDark
                        ?`linear-gradient(135deg,${G(.16)} 0%,${G(.06)} 60%,transparent 100%)`
                        :`linear-gradient(135deg,#F8F0D0 0%,#FFF9EE 55%,#FFFFFF 100%)`,
                    borderRadius:20, padding:"22px 28px", marginBottom:24,
                    border:`1px solid ${G(isDark?.3:.22)}`,
                    position:"relative", overflow:"hidden",
                }}
            >
                {/* Orbs */}
                <div style={{ position:"absolute", top:-40, right:-40, width:200, height:200, borderRadius:"50%", background:`radial-gradient(circle,${G(.14)} 0%,transparent 70%)`, pointerEvents:"none" }} />

                <div style={{ display:"flex", alignItems:"center", gap:16, position:"relative" }}>
                    <div className="tc-float" style={{
                        width:58, height:58, borderRadius:17,
                        background:`linear-gradient(135deg,${GOLD},${GOLD_DARK})`,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        boxShadow:`0 8px 26px ${G(.5)}`, flexShrink:0,
                    }}>
                        <HeartOutlined style={{ color:"#fff", fontSize:25 }} />
                    </div>
                    <div>
                        <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:5 }}>
                            <h1 className="tc-shimmer" style={{
                                fontFamily:"'Cinzel','Georgia',serif",
                                fontSize:19, fontWeight:700, margin:0, letterSpacing:"0.03em",
                            }}>
                                Input Infaq / Wakaf / Shadaqah
                            </h1>
                            <Tag style={{
                                background:`linear-gradient(135deg,${GOLD},${GOLD_DARK})`,
                                color:"#fff", border:"none", borderRadius:7,
                                fontWeight:700, fontSize:9.5, letterSpacing:"0.12em", padding:"1px 9px"
                            }}>MANUAL ENTRY</Tag>
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                            <span style={{ fontSize:12, color:token.colorTextSecondary }}>
                                <LockOutlined style={{ marginRight:5, color:GOLD }} />
                                Tercatat langsung di Buku Besar · Audit Locked
                            </span>
                            <span style={{ color:token.colorBorderSecondary }}>·</span>
                            <span style={{ fontSize:12, color:token.colorTextSecondary }}>
                                <CalendarOutlined style={{ marginRight:5, color:GOLD }} />
                                {formatHijri(new Date())}
                            </span>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* ── FORM ── */}
            <Form
                {...formProps}
                layout="vertical"
                onFinish={handleFinish}
                initialValues={{
                    tanggal_transaksi : dayjs(),
                    metode_pembayaran : "cash",
                    kategori_donasi   : "INFAQ",
                }}
            >
                {/* ╔══════════════════════════════════════╗
                    ║  STEP 1 — KATEGORI DONASI            ║
                    ╚══════════════════════════════════════╝ */}
                <motion.div
                    initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }}
                    transition={{ duration:.44, delay:.08 }}
                >
                    <Card bordered={false} bodyStyle={{ padding:0 }} style={sectionCard}>
                        {sectionHeader(<StarOutlined />,"Jenis & Kategori Donasi","Pilih kategori penerimaan dana yang sesuai", 1)}

                        <div style={{ padding:"20px 24px" }}>
                            <Form.Item name="kategori_donasi" rules={[{ required:true }]} style={{ marginBottom:0 }}>
                                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))", gap:12 }}>
                                    {KATEGORI.map(k => {
                                        const active = kategori === k.value;
                                        return (
                                            <div
                                                key={k.value}
                                                className="tc-kat-pill"
                                                onClick={() => {
                                                    setKategori(k.value);
                                                    formProps.form?.setFieldValue("kategori_donasi", k.value);
                                                }}
                                                style={{
                                                    padding:"16px 14px",
                                                    borderRadius:13,
                                                    border:`2px solid ${active ? k.color.base : (isDark?"rgba(255,255,255,0.1)":token.colorBorderSecondary)}`,
                                                    background: active
                                                        ? (isDark ? k.color.dark : k.color.light)
                                                        : token.colorBgContainer,
                                                    boxShadow: active ? `0 4px 18px ${k.color.glow}` : "none",
                                                    display:"flex", flexDirection:"column", gap:8, alignItems:"center",
                                                    textAlign:"center", transition:"all .22s",
                                                    position:"relative",
                                                }}
                                            >
                                                {active && (
                                                    <div style={{
                                                        position:"absolute", top:8, right:8,
                                                        width:18, height:18, borderRadius:"50%",
                                                        background:k.color.base,
                                                        display:"flex", alignItems:"center", justifyContent:"center",
                                                    }}>
                                                        <CheckCircleOutlined style={{ color:"#fff", fontSize:10 }} />
                                                    </div>
                                                )}
                                                <span style={{ fontSize:28, lineHeight:1 }}>{k.emoji}</span>
                                                <Text style={{
                                                    fontWeight:800, fontSize:13, color:active?k.color.base:token.colorText,
                                                    display:"block", lineHeight:"1.2",
                                                }}>
                                                    {k.label}
                                                </Text>
                                                <Text style={{
                                                    fontSize:10.5, color:active?k.color.base:token.colorTextSecondary,
                                                    opacity:active?0.85:0.65, lineHeight:1.4,
                                                }}>
                                                    {k.desc}
                                                </Text>
                                            </div>
                                        );
                                    })}
                                </div>
                            </Form.Item>
                        </div>
                    </Card>
                </motion.div>

                {/* ╔══════════════════════════════════════╗
                    ║  STEP 2 — TIPE DONATUR               ║
                    ╚══════════════════════════════════════╝ */}
                <motion.div
                    initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }}
                    transition={{ duration:.44, delay:.16 }}
                >
                    <Card bordered={false} bodyStyle={{ padding:0 }} style={sectionCard}>
                        {sectionHeader(<TeamOutlined />,"Identitas Donatur","Pilih apakah donatur dari santri aktif atau masyarakat umum", 2)}

                        <div style={{ padding:"20px 24px" }}>
                            {/* Donor Type Toggle */}
                            <Form.Item label="Tipe Donatur" style={{ marginBottom:20 }}>
                                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                                    {[
                                        {
                                            type:"UMUM" as const,
                                            icon:<GlobalOutlined />,
                                            title:"Umum / Hamba Allah",
                                            sub:"Masyarakat, donatur luar, anonim",
                                            color:C.blue,
                                        },
                                        {
                                            type:"SANTRI" as const,
                                            icon:<UserOutlined />,
                                            title:"Dari Santri",
                                            sub:"Santri aktif yang tercatat di sistem",
                                            color:{ base:isDark?GOLD_LIGHT:GOLD_DARK, light:"#FDF6DC", dark:G(.14), border:G(.3), glow:G(.3) },
                                        },
                                    ].map(opt => {
                                        const active = donorType === opt.type;
                                        return (
                                            <div
                                                key={opt.type}
                                                className="tc-donor-card"
                                                onClick={() => setDonorType(opt.type)}
                                                style={{
                                                    padding:"18px 16px",
                                                    border:`2px solid ${active ? opt.color.base : (isDark?"rgba(255,255,255,0.1)":token.colorBorderSecondary)}`,
                                                    background: active ? (isDark?opt.color.dark:opt.color.light) : token.colorBgContainer,
                                                    boxShadow: active ? `0 4px 18px ${opt.color.glow}` : "none",
                                                    display:"flex", gap:14, alignItems:"center",
                                                    position:"relative",
                                                }}
                                            >
                                                <div style={{
                                                    width:46, height:46, borderRadius:13, flexShrink:0,
                                                    background: active ? `${opt.color.base}22` : (isDark?"rgba(255,255,255,0.06)":token.colorBgTextHover),
                                                    display:"flex", alignItems:"center", justifyContent:"center",
                                                    fontSize:21, color:active?opt.color.base:token.colorTextSecondary,
                                                }}>
                                                    {opt.icon}
                                                </div>
                                                <div style={{ minWidth:0 }}>
                                                    <Text style={{ fontWeight:800, fontSize:13.5, color:active?opt.color.base:token.colorText, display:"block", lineHeight:"1.2" }}>
                                                        {opt.title}
                                                    </Text>
                                                    <Text style={{ fontSize:11, color:token.colorTextSecondary, marginTop:3, display:"block" }}>
                                                        {opt.sub}
                                                    </Text>
                                                </div>
                                                {active && (
                                                    <div style={{
                                                        position:"absolute", top:10, right:10,
                                                        width:20, height:20, borderRadius:"50%",
                                                        background:opt.color.base,
                                                        display:"flex", alignItems:"center", justifyContent:"center",
                                                    }}>
                                                        <CheckCircleOutlined style={{ color:"#fff", fontSize:11 }} />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </Form.Item>

                            {/* Donor input — animated swap */}
                            <AnimatePresence mode="wait">
                                {donorType === "UMUM" ? (
                                    <motion.div
                                        key="umum"
                                        initial={{ opacity:0, x:-14 }}
                                        animate={{ opacity:1, x:0 }}
                                        exit={{ opacity:0, x:14 }}
                                        transition={{ duration:.26 }}
                                    >
                                        <Form.Item
                                            label="Nama Donatur"
                                            name="nama_donatur_manual"
                                            rules={[{ required:true, message:"Isi nama donatur (bisa 'Hamba Allah')" }]}
                                            style={{ marginBottom:0 }}
                                        >
                                            <Input
                                                prefix={<UserOutlined style={{ color:G(.6) }} />}
                                                placeholder='Contoh: Bpk. Ahmad / Hamba Allah / Keluarga Besar ...'
                                                onChange={e => setDonorName(e.target.value)}
                                                style={{ height:46, borderColor:G(.3) }}
                                                suffix={
                                                    <Tooltip title="Bisa gunakan 'Hamba Allah' jika donatur ingin anonim">
                                                        <InfoCircleOutlined style={{ color:token.colorTextSecondary }} />
                                                    </Tooltip>
                                                }
                                            />
                                        </Form.Item>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="santri"
                                        initial={{ opacity:0, x:14 }}
                                        animate={{ opacity:1, x:0 }}
                                        exit={{ opacity:0, x:-14 }}
                                        transition={{ duration:.26 }}
                                    >
                                        <Form.Item
                                            label="Pilih Santri"
                                            name="santri_nis"
                                            rules={[{ required:true, message:"Pilih santri terlebih dahulu" }]}
                                            style={{ marginBottom:0 }}
                                        >
                                            <Select
                                                {...santriSelectProps}
                                                showSearch
                                                placeholder="Cari nama santri aktif..."
                                                style={{ height:46 }}
                                                onChange={(_, opt: any) => setDonorName(opt?.label ?? "")}
                                            />
                                        </Form.Item>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </Card>
                </motion.div>

                {/* ╔══════════════════════════════════════╗
                    ║  STEP 3 — NOMINAL & TRANSAKSI        ║
                    ╚══════════════════════════════════════╝ */}
                <motion.div
                    initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }}
                    transition={{ duration:.44, delay:.24 }}
                >
                    <Card bordered={false} bodyStyle={{ padding:0 }} style={sectionCard}>
                        {sectionHeader(<DollarOutlined />,"Nominal & Detail Transaksi","Masukkan jumlah, metode, dan waktu penerimaan dana", 3)}

                        <div style={{ padding:"20px 24px" }}>
                            {/* NOMINAL — large input */}
                            <Form.Item
                                label="Nominal Donasi"
                                name="jumlah"
                                rules={[{ required:true, message:"Masukkan nominal donasi" }]}
                                style={{ marginBottom:24 }}
                            >
                                <InputNumber
                                    className="tc-amount-input"
                                    style={{
                                        width:"100%", height:68,
                                        borderRadius:14,
                                        borderColor:G(.3),
                                        background:isDark?G(.06):"#FFFBF0",
                                    }}
                                    prefix={
                                        <span style={{
                                            fontSize:15, fontWeight:900,
                                            color:isDark?GOLD_LIGHT:GOLD_DARK,
                                            fontFamily:"'DM Mono',monospace",
                                            letterSpacing:".02em",
                                        }}>
                                            Rp
                                        </span>
                                    }
                                    formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
                                    parser={v => v!.replace(/\./g,"") as any}
                                    placeholder="0"
                                    min={0}
                                    onChange={v => setNominal(Number(v ?? 0))}
                                />
                            </Form.Item>

                            {/* Quick amount presets */}
                            <div style={{ marginBottom:24 }}>
                                <Text style={{ fontSize:10.5, fontWeight:700, color:token.colorTextSecondary, textTransform:"uppercase", letterSpacing:"0.07em", display:"block", marginBottom:10 }}>
                                    Nominal Cepat
                                </Text>
                                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                                    {[10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000].map(amt => (
                                        <button
                                            key={amt}
                                            type="button"
                                            onClick={() => {
                                                setNominal(amt);
                                                formProps.form?.setFieldValue("jumlah", amt);
                                            }}
                                            style={{
                                                padding:"5px 12px", borderRadius:9,
                                                border:`1px solid ${nominal===amt ? GOLD : G(.25)}`,
                                                background: nominal===amt
                                                    ? `linear-gradient(135deg,${GOLD},${GOLD_DARK})`
                                                    : G(isDark?.1:.06),
                                                color: nominal===amt ? "#fff" : (isDark?GOLD_LIGHT:GOLD_DARK),
                                                fontFamily:"'DM Mono',monospace",
                                                fontSize:12, fontWeight:700, cursor:"pointer",
                                                transition:"all .18s ease",
                                                boxShadow: nominal===amt ? `0 3px 10px ${G(.35)}` : "none",
                                            }}
                                        >
                                            {new Intl.NumberFormat("id-ID",{notation:"compact",compactDisplay:"short"}).format(amt)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <Row gutter={[16,0]}>
                                {/* METODE */}
                                <Col xs={24} md={14}>
                                    <Form.Item
                                        label="Metode Penerimaan"
                                        name="metode_pembayaran"
                                        rules={[{ required:true }]}
                                        style={{ marginBottom:0 }}
                                    >
                                        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
                                            {METODE.map(m => {
                                                const active = metode === m.value;
                                                return (
                                                    <div
                                                        key={m.value}
                                                        className="tc-method-card"
                                                        onClick={() => {
                                                            setMetode(m.value);
                                                            formProps.form?.setFieldValue("metode_pembayaran", m.value);
                                                        }}
                                                        style={{
                                                            padding:"13px 10px",
                                                            border:`2px solid ${active?m.color.base:(isDark?"rgba(255,255,255,0.1)":token.colorBorderSecondary)}`,
                                                            background: active?(isDark?m.color.dark:m.color.light):token.colorBgContainer,
                                                            boxShadow: active?`0 4px 14px ${m.color.glow}`:"none",
                                                            display:"flex", flexDirection:"column",
                                                            alignItems:"center", gap:6, textAlign:"center",
                                                            transition:"all .22s",
                                                        }}
                                                    >
                                                        <div style={{
                                                            width:36, height:36, borderRadius:10,
                                                            background:active?`${m.color.base}22`:(isDark?"rgba(255,255,255,0.06)":token.colorBgTextHover),
                                                            display:"flex", alignItems:"center", justifyContent:"center",
                                                            fontSize:17, color:active?m.color.base:token.colorTextSecondary,
                                                        }}>
                                                            {m.icon}
                                                        </div>
                                                        <Text style={{ fontSize:11, fontWeight:700, color:active?m.color.base:token.colorText, lineHeight:1.2, display:"block" }}>
                                                            {m.label}
                                                        </Text>
                                                        <Text style={{ fontSize:9.5, color:token.colorTextSecondary, opacity:.75 }}>
                                                            {m.sub}
                                                        </Text>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </Form.Item>
                                </Col>

                                {/* TANGGAL */}
                                <Col xs={24} md={10}>
                                    <Form.Item
                                        label="Tanggal & Waktu Transaksi"
                                        name="tanggal_transaksi"
                                        rules={[{ required:true }]}
                                        style={{ marginBottom:0 }}
                                    >
                                        <DatePicker
                                            showTime
                                            format="DD MMM YYYY · HH:mm"
                                            style={{ width:"100%", height:46, borderColor:G(.3) }}
                                            suffixIcon={<CalendarOutlined style={{ color:GOLD }} />}
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </div>
                    </Card>
                </motion.div>

                {/* ╔══════════════════════════════════════╗
                    ║  STEP 4 — CATATAN                    ║
                    ╚══════════════════════════════════════╝ */}
                <motion.div
                    initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }}
                    transition={{ duration:.44, delay:.32 }}
                >
                    <Card bordered={false} bodyStyle={{ padding:0 }} style={sectionCard}>
                        {sectionHeader(<EditOutlined />,"Catatan Tambahan","Opsional — tambahkan keterangan peruntukan dana", 4)}

                        <div style={{ padding:"20px 24px" }}>
                            <Form.Item name="keterangan_donasi" style={{ marginBottom:0 }}>
                                <Input.TextArea
                                    placeholder="Contoh: Untuk pembangunan asrama putra, donasi rutin bulanan..."
                                    rows={4}
                                    maxLength={300}
                                    showCount
                                    onChange={e => setCatatan(e.target.value)}
                                    style={{
                                        borderRadius:12, fontSize:13.5,
                                        borderColor:G(.3), resize:"none",
                                    }}
                                />
                            </Form.Item>
                        </div>
                    </Card>
                </motion.div>

                {/* ╔══════════════════════════════════════╗
                    ║  LIVE PREVIEW CARD                   ║
                    ╚══════════════════════════════════════╝ */}
                <motion.div
                    initial={{ opacity:0, scale:.97 }} animate={{ opacity:1, scale:1 }}
                    transition={{ duration:.44, delay:.4 }}
                >
                    <Card
                        bordered={false}
                        bodyStyle={{ padding:"20px 24px" }}
                        className="tc-preview-glow"
                        style={{
                            borderRadius:18, marginBottom:20,
                            background:isDark
                                ?`linear-gradient(135deg,${G(.15)} 0%,${G(.06)} 100%)`
                                :`linear-gradient(135deg,#FFFBF0 0%,#FDF6DC 100%)`,
                            border:`1px solid ${G(isDark?.3:.25)}`,
                        }}
                    >
                        {/* Header */}
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                                <ThunderboltOutlined style={{ color:GOLD, fontSize:16 }} />
                                <Text style={{ fontWeight:800, fontSize:13, color:isDark?GOLD_LIGHT:GOLD_DARK, textTransform:"uppercase", letterSpacing:"0.08em" }}>
                                    Pratinjau Pencatatan
                                </Text>
                            </div>
                            <Tag style={{
                                background:`linear-gradient(135deg,${GOLD},${GOLD_DARK})`,
                                color:"#fff", border:"none", borderRadius:20,
                                fontWeight:700, fontSize:10, padding:"2px 10px",
                            }}>
                                REAL-TIME
                            </Tag>
                        </div>

                        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12 }}>
                            {[
                                { label:"Kategori",  value:`${kategoriMeta.emoji} ${kategoriMeta.label}`, color:kategoriMeta.color.base },
                                { label:"Donatur",   value:donorName || (donorType==="UMUM"?"(nama donatur)":"(pilih santri)"), color:token.colorText as string },
                                { label:"Metode",    value:metodeMeta.label,  color:metodeMeta.color.base },
                                { label:"Nominal",   value:nominal > 0 ? `Rp ${new Intl.NumberFormat("id-ID").format(nominal)}` : "—", color:C.green.base },
                            ].map(item => (
                                <div key={item.label} style={{
                                    background:isDark?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.7)",
                                    borderRadius:11, padding:"11px 13px",
                                    border:`1px solid ${G(isDark?.2:.15)}`,
                                    backdropFilter:"blur(6px)",
                                }}>
                                    <Text style={{ fontSize:9.5, fontWeight:700, color:isDark?GOLD_ALPHA(.7):GOLD_DARK, textTransform:"uppercase", letterSpacing:"0.08em", display:"block", marginBottom:5 }}>
                                        {item.label}
                                    </Text>
                                    <Text className="tc-mono" style={{ fontSize:13.5, fontWeight:800, color:item.color, display:"block", lineHeight:"1.2", wordBreak:"break-word" }}>
                                        {item.value}
                                    </Text>
                                </div>
                            ))}
                        </div>

                        {catatan && (
                            <div style={{ marginTop:12, padding:"10px 13px", borderRadius:10, background:G(isDark?.12:.08), border:`1px solid ${G(isDark?.2:.15)}` }}>
                                <Text style={{ fontSize:9.5, fontWeight:700, color:isDark?GOLD_ALPHA(.7):GOLD_DARK, textTransform:"uppercase", letterSpacing:"0.08em", display:"block", marginBottom:3 }}>
                                    Catatan
                                </Text>
                                <Text style={{ fontSize:12.5, color:token.colorText }}>{catatan}</Text>
                            </div>
                        )}
                    </Card>
                </motion.div>

                {/* ╔══════════════════════════════════════╗
                    ║  AUDIT NOTICE                        ║
                    ╚══════════════════════════════════════╝ */}
                <motion.div
                    initial={{ opacity:0 }} animate={{ opacity:1 }}
                    transition={{ duration:.4, delay:.46 }}
                >
                    <div style={{
                        display:"flex", alignItems:"flex-start", gap:14,
                        padding:"16px 20px", borderRadius:14, marginBottom:24,
                        background:isDark?C.amber.dark:C.amber.light,
                        border:`1px solid ${C.amber.border}`,
                    }}>
                        <SafetyCertificateOutlined style={{ color:C.amber.base, fontSize:22, flexShrink:0, marginTop:2 }} />
                        <div>
                            <Text style={{ fontWeight:800, fontSize:13, color:C.amber.base, display:"block", marginBottom:4 }}>
                                Perhatian — Audit Locked
                            </Text>
                            <Text style={{ fontSize:12, color:token.colorTextSecondary, lineHeight:1.65 }}>
                                Transaksi yang Anda simpan akan <strong>langsung tercatat sebagai Pendapatan Masuk</strong> di Buku Besar dan dicatat atas nama akun Anda (<strong>{user?.name || "Administrator"}</strong>).
                                Data ini bersifat <strong>permanen dan tidak dapat diubah</strong> demi menjaga integritas laporan keuangan. Pastikan seluruh informasi sudah benar sebelum menyimpan.
                            </Text>
                        </div>
                    </div>

                    {/* SUBMIT BUTTON */}
                    <div style={{ display:"flex", justifyContent:"flex-end", gap:12 }}>
                        <button
                            type="button"
                            onClick={() => window.history.back()}
                            style={{
                                padding:"0 24px", height:48, borderRadius:13,
                                border:`1px solid ${token.colorBorderSecondary}`,
                                background:token.colorBgContainer,
                                cursor:"pointer", fontSize:14, fontWeight:600,
                                color:token.colorTextSecondary,
                                fontFamily:"'Outfit',sans-serif",
                                transition:"all .2s ease",
                            }}
                        >
                            Batal
                        </button>
                        <button
                            {...(saveButtonProps as any)}
                            type="submit"
                            style={{
                                padding:"0 36px", height:48, borderRadius:13,
                                background:`linear-gradient(135deg,${GOLD},${GOLD_DARK})`,
                                border:"none", cursor:"pointer",
                                fontSize:14, fontWeight:800, color:"#fff",
                                fontFamily:"'Outfit',sans-serif",
                                boxShadow:`0 6px 22px ${G(.5)}`,
                                letterSpacing:"0.02em",
                                transition:"all .22s ease",
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform="translateY(-2px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow=`0 10px 30px ${G(.6)}`; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform="translateY(0)"; (e.currentTarget as HTMLButtonElement).style.boxShadow=`0 6px 22px ${G(.5)}`; }}
                        >
                            <HeartOutlined style={{ marginRight:8 }} />
                            Simpan & Catat ke Buku Besar
                        </button>
                    </div>
                </motion.div>
            </Form>
        </div>
    );
};

// helper agar bisa dipakai di preview
const GOLD_ALPHA = G;
