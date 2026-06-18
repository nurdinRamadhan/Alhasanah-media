import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useTable } from "@refinedev/antd";
import { ProTable } from "@ant-design/pro-components";
import type { ProColumns } from "@ant-design/pro-components";
import {
    Typography, Button, Tag, Space, Card, Row, Col,
    Select, DatePicker, Tooltip, Avatar, Divider, Progress,
    theme, message, Badge, Empty, Skeleton,
} from "antd";
import { motion, Variants } from "framer-motion";
import {
    RiseOutlined, FallOutlined, SwapOutlined, DollarOutlined,
    FilterOutlined, DownloadOutlined, HeartOutlined,
    CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined,
    BankOutlined, WalletOutlined, CreditCardOutlined, UserOutlined,
    AuditOutlined, SafetyCertificateOutlined, ThunderboltOutlined,
    BarChartOutlined, CalendarOutlined, LockOutlined,
    GlobalOutlined, TeamOutlined, ClearOutlined, LineChartOutlined,
    PieChartOutlined, ArrowUpOutlined, ArrowDownOutlined,
    FundOutlined, RocketOutlined,
} from "@ant-design/icons";
import { useNavigation } from "@refinedev/core";
import { ITransaksiKeuangan } from "../../types";
import dayjs from "dayjs";
import "dayjs/locale/id";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { formatHijri, formatMasehi } from "../../utility/dateHelper";
import { santriAlias } from "../../utility/privacy";
import { supabaseClient } from "../../utility/supabaseClient";
import {
    ComposedChart, Bar, Line, Area, AreaChart,
    XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
    ResponsiveContainer, PieChart, Pie, Cell, Legend,
    BarChart,
} from "recharts";

dayjs.locale("id");

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;
const { useToken } = theme;

// ─── Design Tokens ────────────────────────────────────────────────────────────
const GOLD        = "#C9A84C";
const GOLD_BRIGHT = "#FFB700";
const GOLD_DARK   = "#9A7A00";
const G           = (o: number) => `rgba(201,168,76,${o})`;

const SUCCESS = "#059669";
const DANGER  = "#DC2626";
const WARNING = "#D97706";
const INFO    = "#2563EB";
const PURPLE  = "#7C3AED";
const TEAL    = "#0D9488";

const STATUS_COLOR = {
    success: { base: SUCCESS, bg: "rgba(5,150,105,0.12)",  border: "rgba(5,150,105,0.28)"  },
    warning: { base: WARNING, bg: "rgba(217,119,6,0.12)",  border: "rgba(217,119,6,0.28)"  },
    danger:  { base: DANGER,  bg: "rgba(220,38,38,0.12)",  border: "rgba(220,38,38,0.28)"  },
    info:    { base: INFO,    bg: "rgba(37,99,235,0.12)",   border: "rgba(37,99,235,0.28)"  },
    purple:  { base: PURPLE,  bg: "rgba(124,58,237,0.12)", border: "rgba(124,58,237,0.28)" },
    teal:    { base: TEAL,    bg: "rgba(13,148,136,0.12)", border: "rgba(13,148,136,0.28)" },
};

const METODE_COLORS: Record<string, string> = {
    cash: GOLD_BRIGHT, qris: TEAL, bank_transfer: INFO, transfer: INFO,
    midtrans: PURPLE, gopay: SUCCESS,
};

const PIE_PALETTE = [GOLD_BRIGHT, INFO, TEAL, SUCCESS, PURPLE, DANGER];

// ─── CSS Injection ────────────────────────────────────────────────────────────
const LEDGER_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Mono:wght@400;500;700&display=swap');
  .gl-root { font-family:'Inter','PingFang SC',system-ui,sans-serif; }
  .gl-mono { font-family:'DM Mono','Courier New',monospace !important; }
  .gl-table .ant-table-thead > tr > th,
  .gl-table .ant-table-thead > tr > td {
    background: linear-gradient(135deg,#9A7A00 0%,#C8970E 40%,${GOLD} 70%,#B89010 100%) !important;
    color:#fff !important; font-weight:700 !important; font-size:10.5px !important;
    letter-spacing:.09em !important; text-transform:uppercase !important;
    border-bottom:none !important; padding-top:13px !important; padding-bottom:13px !important;
  }
  .gl-table .ant-table-thead > tr > th::before { display:none !important; }
  .gl-table .ant-table-tbody > tr > td {
    padding:13px 16px !important; vertical-align:middle !important; transition:background .14s ease;
    border-bottom:1px solid rgba(201,168,76,.08) !important;
  }
  .gl-table .ant-table-tbody > tr:hover > td { background:rgba(201,168,76,.05) !important; }
  .gl-table .ant-table-summary > tr > td {
    padding:14px 16px !important; border-top:2px solid rgba(201,168,76,.3) !important;
  }
  .gl-table .ant-table-container { border-radius:0 0 14px 14px !important; overflow:hidden !important; }
  ::-webkit-scrollbar { width:5px; height:5px; }
  ::-webkit-scrollbar-track  { background:transparent; }
  ::-webkit-scrollbar-thumb  { background:${G(.3)}; border-radius:3px; }
  ::-webkit-scrollbar-thumb:hover { background:${G(.6)}; }
  @media print {
    body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .gl-no-print { display:none !important; }
  }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fCurrency = (n: number) =>
    new Intl.NumberFormat("id-ID", { style:"currency", currency:"IDR", minimumFractionDigits:0 }).format(n);
const fCompact = (n: number) => {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} M`;
    if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)} Jt`;
    if (n >= 1_000)         return `${(n / 1_000).toFixed(0)} Rb`;
    return String(n);
};
const isSuccess = (s: string) => s === "settlement" || s === "success";
const isPending = (s: string) => s === "pending";
const isFailed  = (s: string) => ["expire","failure","cancel","failed"].includes(s);

const statusMeta = (s: string) => {
    if (isSuccess(s)) return { label:"SUKSES",   c: STATUS_COLOR.success, icon: <CheckCircleOutlined /> };
    if (isPending(s)) return { label:"MENUNGGU", c: STATUS_COLOR.warning, icon: <ClockCircleOutlined /> };
    if (isFailed(s))  return { label:"GAGAL",    c: STATUS_COLOR.danger,  icon: <CloseCircleOutlined /> };
    return               { label:"DIPROSES", c: STATUS_COLOR.info,    icon: <ClockCircleOutlined /> };
};
const metodeMeta = (m: string) => {
    const map: Record<string, { icon: React.ReactNode; label: string }> = {
        cash       : { icon:<WalletOutlined />,     label:"CASH"      },
        qris       : { icon:<CreditCardOutlined />, label:"QRIS"      },
        transfer   : { icon:<BankOutlined />,       label:"TRANSFER"  },
        midtrans   : { icon:<GlobalOutlined />,     label:"MIDTRANS"  },
        gopay      : { icon:<CreditCardOutlined />, label:"GOPAY"     },
        bank_transfer: { icon:<BankOutlined />,     label:"TRANSFER"  },
    };
    return map[m?.toLowerCase()] ?? { icon:<WalletOutlined />, label:(m||"CASH").toUpperCase() };
};
const metodeKey = (m: string | null | undefined): string => {
    const v = (m ?? "").toLowerCase();
    if (["tunai","cash"].includes(v)) return "cash";
    if (v === "qris") return "qris";
    if (["transfer","bank_transfer"].includes(v)) return "bank_transfer";
    if (v === "midtrans") return "midtrans";
    if (v === "gopay") return "gopay";
    return v || "cash";
};

// ─── Motion ───────────────────────────────────────────────────────────────────
const fadeUp: Variants = {
    hidden:  { opacity:0, y:22 },
    visible: (i=0) => ({
        opacity:1, y:0,
        transition:{ duration:.52, ease:[0.22,1,0.36,1], delay: i * .07 },
    }),
};
const stagger = { visible:{ transition:{ staggerChildren:.07 } } };

// ─── Animated Counter ─────────────────────────────────────────────────────────
const AnimatedValue: React.FC<{ value:number; formatter?:(v:number)=>string }> = ({ value, formatter }) => {
    const [d, setD] = useState(0);
    const prev = useRef(0);
    useEffect(() => {
        const start = prev.current; const t0 = performance.now();
        const tick = (now: number) => {
            const p = Math.min((now-t0)/850, 1);
            const e = 1 - Math.pow(1-p, 3);
            setD(Math.round(start + (value-start)*e));
            if (p < 1) requestAnimationFrame(tick); else prev.current = value;
        };
        requestAnimationFrame(tick);
    }, [value]);
    return <>{formatter ? formatter(d) : d.toLocaleString("id-ID")}</>;
};

// ─── Premium Tooltip ──────────────────────────────────────────────────────────
const PremiumTooltip = ({ active, payload, label, token:tk }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background:tk.colorBgElevated, border:`1px solid ${tk.colorBorderSecondary}`,
            borderRadius:14, padding:"12px 16px", minWidth:200,
            boxShadow:"0 24px 60px rgba(0,0,0,0.35)", backdropFilter:"blur(20px)",
        }}>
            <p style={{ margin:"0 0 10px", fontWeight:700, fontSize:11,
                letterSpacing:"0.1em", textTransform:"uppercase", color:GOLD_BRIGHT }}>
                {label}
            </p>
            {payload.map((e:any, i:number) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                    <span style={{ width:8, height:8, borderRadius:2, background:e.color, flexShrink:0 }} />
                    <span style={{ fontSize:12, color:tk.colorTextSecondary, flex:1 }}>{e.name}</span>
                    <span style={{ fontWeight:700, fontSize:12, fontFamily:"'DM Mono',monospace", color:tk.colorText }}>
                        {typeof e.value === "number" && e.value > 1000 ? fCurrency(e.value) : e.value?.toLocaleString("id-ID")}
                    </span>
                </div>
            ))}
        </div>
    );
};

// ─── KPI Card (Dashboard-matched) ────────────────────────────────────────────
const KpiCard: React.FC<{
    label:string; value:number; icon:React.ReactNode; color:string;
    subtext?:string; formatter?:(v:number)=>string;
    isDark:boolean; token:any; delay?:number;
}> = ({ label, value, icon, color, subtext, formatter, isDark, token:tk, delay=0 }) => (
    <motion.div variants={fadeUp} custom={delay} whileHover={{ y:-5, transition:{ duration:.18 } }}
        style={{ height:"100%", cursor:"default" }}>
        <div style={{
            borderRadius:20, padding:"22px 20px 18px", height:"100%",
            background:tk.colorBgContainer,
            border:`1px solid ${isDark ? color+"22" : color+"28"}`,
            position:"relative", overflow:"hidden",
            boxShadow: isDark
                ? `0 4px 28px rgba(0,0,0,0.45), inset 0 1px 0 ${color}12`
                : `0 2px 16px rgba(0,0,0,0.06), inset 0 1px 0 ${color}18`,
        }}>
            <div style={{ position:"absolute", bottom:-40, right:-40, width:130, height:130,
                borderRadius:"50%", pointerEvents:"none",
                background:`radial-gradient(circle, ${color}18 0%, transparent 65%)` }} />
            <div style={{ position:"absolute", top:0, left:"15%", right:"15%", height:2,
                background:`linear-gradient(90deg, transparent, ${color}70, transparent)` }} />
            <div style={{ width:46, height:46, borderRadius:14, marginBottom:18,
                background:`linear-gradient(135deg, ${color}20 0%, ${color}38 100%)`,
                border:`1px solid ${color}30`,
                display:"flex", alignItems:"center", justifyContent:"center",
                color, fontSize:20, boxShadow:`0 4px 14px ${color}22` }}>
                {icon}
            </div>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase",
                color:isDark?"rgba(255,255,255,0.38)":"rgba(0,0,0,0.38)", marginBottom:6 }}>
                {label}
            </div>
            <div style={{ fontFamily:"'DM Mono',monospace", fontWeight:800,
                fontSize: formatter ? 19 : 28,
                letterSpacing:"-0.04em", lineHeight:1.1, color:tk.colorText }}>
                {formatter && <span style={{ fontSize:12, fontWeight:600,
                    color:isDark?"rgba(255,255,255,0.4)":"rgba(0,0,0,0.4)", marginRight:3 }}>Rp</span>}
                <AnimatedValue value={value} formatter={formatter ? fCompact : undefined} />
            </div>
            {subtext && (
                <div style={{ fontSize:11, marginTop:8,
                    color:isDark?"rgba(255,255,255,0.38)":"rgba(0,0,0,0.38)" }}>
                    {subtext}
                </div>
            )}
        </div>
    </motion.div>
);

// ─── Section Header ───────────────────────────────────────────────────────────
const SectionHeader = ({ icon, title, subtitle, action }: {
    icon:React.ReactNode; title:string; subtitle?:string; action?:React.ReactNode;
}) => (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, gap:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, flex:1, minWidth:0 }}>
            <div style={{
                width:40, height:40, borderRadius:12, flexShrink:0,
                background:`linear-gradient(135deg, ${GOLD}20 0%, ${GOLD_BRIGHT}15 100%)`,
                border:`1px solid ${GOLD}28`,
                display:"flex", alignItems:"center", justifyContent:"center",
                color:GOLD_BRIGHT, fontSize:17,
            }}>{icon}</div>
            <div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:16, letterSpacing:"-0.03em" }}>
                    {title}
                </div>
                {subtitle && <div style={{ fontSize:12, color:"rgba(128,128,128,0.75)", marginTop:2 }}>{subtitle}</div>}
            </div>
            <div style={{ flex:1, height:1, marginLeft:10,
                background:`linear-gradient(90deg, ${GOLD}28 0%, transparent 80%)` }} />
        </div>
        {action && <div style={{ flexShrink:0 }}>{action}</div>}
    </div>
);

// ─── Pie label ────────────────────────────────────────────────────────────────
const renderPieLabel = ({ cx,cy,midAngle,innerRadius,outerRadius,percent }: any) => {
    if (percent < 0.07) return null;
    const R = Math.PI/180;
    const r = innerRadius + (outerRadius-innerRadius)*0.52;
    return (
        <text x={cx+r*Math.cos(-midAngle*R)} y={cy+r*Math.sin(-midAngle*R)}
            fill="#fff" textAnchor="middle" dominantBaseline="central"
            style={{ fontSize:10, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>
            {`${(percent*100).toFixed(0)}%`}
        </text>
    );
};

// ─── Audit Insight Badge ──────────────────────────────────────────────────────
const InsightBadge: React.FC<{ icon:React.ReactNode; label:string; value:string; color:string; isDark:boolean }> = ({
    icon, label, value, color, isDark,
}) => (
    <div style={{
        display:"flex", alignItems:"center", gap:10, padding:"12px 16px",
        borderRadius:14, flex:1, minWidth:160,
        background: isDark ? `${color}0e` : `${color}08`,
        border:`1px solid ${color}25`,
    }}>
        <div style={{
            width:32, height:32, borderRadius:9, flexShrink:0,
            background:`${color}20`, border:`1px solid ${color}28`,
            display:"flex", alignItems:"center", justifyContent:"center",
            color, fontSize:14,
        }}>{icon}</div>
        <div>
            <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color, marginBottom:2 }}>
                {label}
            </div>
            <div style={{ fontFamily:"'DM Mono',monospace", fontWeight:800, fontSize:13, color }}>
                {value}
            </div>
        </div>
    </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export const TransaksiList: React.FC = () => {
    const { token } = useToken();
    const { create } = useNavigation();

    const hexLum = (hex: string) => {
        const c = hex.replace("#","");
        if (c.length < 6) return 200;
        return .299*parseInt(c.slice(0,2),16) + .587*parseInt(c.slice(2,4),16) + .114*parseInt(c.slice(4,6),16);
    };
    const isDark = hexLum(token.colorBgContainer) < 128;
    const TICK = { fontSize:10, fill:token.colorTextTertiary as string };

    // ── Filter State ──────────────────────────────────────────────────────────
    const [dateRange,      setDateRange]      = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().startOf("month"), dayjs().endOf("month")]);
    const [jenisFilter,    setJenisFilter]    = useState<string>("all");
    const [statusFilter,   setStatusFilter]   = useState<string>("all");
    const [metodeFilter,   setMetodeFilter]   = useState<string>("all");
    const [kategoriFilter, setKategoriFilter] = useState<string>("all");
    const [genderFilter,   setGenderFilter]   = useState<string>("all");
    const [jurusanFilter,  setJurusanFilter]  = useState<string>("all");
    const [chartMode,      setChartMode]      = useState<"area"|"bar"|"combo">("combo");
    const [isExporting,    setIsExporting]    = useState(false);

    // ── Table ─────────────────────────────────────────────────────────────────
    const { tableProps, tableQueryResult } = useTable<ITransaksiKeuangan>({
        resource: "transaksi_keuangan",
        syncWithLocation: false,
        meta: { select:"*, wali:wali_id(full_name, no_hp), admin:admin_pencatat_id(full_name), santri:santri_nis(nama, nis, kelas, jurusan)" },
        filters: { permanent: [
            { field:"tanggal_transaksi", operator:"gte", value:dateRange[0].startOf("day").toISOString() },
            { field:"tanggal_transaksi", operator:"lte", value:dateRange[1].endOf("day").toISOString()   },
        ]},
        sorters: { initial:[{ field:"tanggal_transaksi", order:"desc" }] },
    });

    const rawData = tableQueryResult?.data?.data ?? [];
    const isLoading = tableQueryResult?.isLoading || tableQueryResult?.isFetching;

    const filteredData = useMemo(() => rawData.filter(r => {
        if (jenisFilter !== "all" && r.jenis_transaksi !== jenisFilter) return false;
        if (statusFilter !== "all") {
            if (statusFilter === "sukses"  && !isSuccess(r.status_transaksi)) return false;
            if (statusFilter === "pending" && !isPending(r.status_transaksi)) return false;
            if (statusFilter === "gagal"   && !isFailed(r.status_transaksi))  return false;
        }
        if (metodeFilter  !== "all" && metodeKey(r.metode_pembayaran) !== metodeFilter) return false;
        if (kategoriFilter !== "all" && (r.kategori ?? "") !== kategoriFilter) return false;
        if (genderFilter  !== "all" && (r.scope_gender  ?? "") !== genderFilter  && (r.scope_gender  ?? "") !== "ALL") return false;
        if (jurusanFilter !== "all" && (r.scope_jurusan ?? "") !== jurusanFilter && (r.scope_jurusan ?? "") !== "ALL") return false;
        return true;
    }), [rawData, jenisFilter, statusFilter, metodeFilter, kategoriFilter, genderFilter, jurusanFilter]);

    // ── KPI Calculations ──────────────────────────────────────────────────────
    const kpi = useMemo(() => {
        const sukses   = filteredData.filter(r => isSuccess(r.status_transaksi));
        const pending  = filteredData.filter(r => isPending(r.status_transaksi));
        const gagal    = filteredData.filter(r => isFailed(r.status_transaksi));
        const totalMasuk  = sukses.filter(r => r.jenis_transaksi === "masuk").reduce((s,r) => s+Number(r.jumlah), 0);
        const totalKeluar = sukses.filter(r => r.jenis_transaksi === "keluar").reduce((s,r) => s+Number(r.jumlah), 0);
        const netSaldo    = totalMasuk - totalKeluar;
        const infaqTotal  = sukses.filter(r => r.jenis_transaksi==="masuk" && r.kategori==="donasi").reduce((s,r) => s+Number(r.jumlah), 0);
        const tagihanTotal = totalMasuk - infaqTotal;
        const rataRata    = sukses.length > 0 ? Math.round(totalMasuk / sukses.length) : 0;
        const digitalTotal = sukses.filter(r => metodeKey(r.metode_pembayaran) !== "cash").reduce((s,r) => s+Number(r.jumlah), 0);
        const cashTotal    = sukses.filter(r => metodeKey(r.metode_pembayaran) === "cash").reduce((s,r) => s+Number(r.jumlah), 0);
        const digitalPct   = totalMasuk > 0 ? Math.round((digitalTotal/totalMasuk)*100) : 0;
        const successRate  = filteredData.length > 0 ? Math.round((sukses.length/filteredData.length)*100) : 0;
        const pendingValue = pending.reduce((s,r) => s+Number(r.jumlah), 0);
        const gagalValue   = gagal.reduce((s,r) => s+Number(r.jumlah), 0);
        return {
            totalMasuk, totalKeluar, netSaldo, infaqTotal, tagihanTotal, rataRata,
            digitalTotal, cashTotal, digitalPct, successRate,
            pendingValue, gagalValue,
            sukses:sukses.length, pending:pending.length, gagal:gagal.length, total:filteredData.length,
        };
    }, [filteredData]);

    const activeFilters = [jenisFilter,statusFilter,metodeFilter,kategoriFilter,genderFilter,jurusanFilter].filter(f=>f!=="all").length;
    const resetFilters = () => {
        setJenisFilter("all"); setStatusFilter("all"); setMetodeFilter("all");
        setKategoriFilter("all"); setGenderFilter("all"); setJurusanFilter("all");
    };

    // ── Chart Data ────────────────────────────────────────────────────────────
    // 1. Daily cashflow with running balance
    const dailyData = useMemo(() => {
        const map: Record<string, { masuk:number; keluar:number; date:string; sort:number }> = {};
        filteredData.filter(r => isSuccess(r.status_transaksi)).forEach(r => {
            const d = dayjs(r.tanggal_transaksi);
            const key = d.format("DD/MM");
            if (!map[key]) map[key] = { masuk:0, keluar:0, date:key, sort:d.valueOf() };
            if (r.jenis_transaksi==="masuk")  map[key].masuk  += Number(r.jumlah);
            else                              map[key].keluar += Number(r.jumlah);
        });
        let running = 0;
        return Object.values(map)
            .sort((a,b) => a.sort-b.sort)
            .map(d => { running += d.masuk - d.keluar; return { ...d, balance:running }; });
    }, [filteredData]);

    // 2. Payment method distribution
    const methodData = useMemo(() => {
        const map: Record<string, number> = {};
        filteredData.filter(r => isSuccess(r.status_transaksi) && r.jenis_transaksi==="masuk").forEach(r => {
            const k = metodeKey(r.metode_pembayaran);
            map[k] = (map[k]||0) + Number(r.jumlah);
        });
        return Object.entries(map).map(([name, value]) => ({
            name: name.toUpperCase(), value,
            color: METODE_COLORS[name] || GOLD_BRIGHT,
        }));
    }, [filteredData]);

    // 3. Status pipeline (count)
    const statusPipeData = [
        { name:"Sukses",   value:kpi.sukses,  color:SUCCESS, amount:kpi.totalMasuk },
        { name:"Pending",  value:kpi.pending, color:WARNING, amount:kpi.pendingValue },
        { name:"Gagal",    value:kpi.gagal,   color:DANGER,  amount:kpi.gagalValue  },
    ];

    // 4. Infaq vs Tagihan
    const infaqPieData = [
        { name:"Tagihan", value:kpi.tagihanTotal },
        { name:"Infaq/Wakaf", value:kpi.infaqTotal },
    ];
    const infaqPieColors = [GOLD_BRIGHT, PURPLE];

    // 5. Daily masuk-only trend for infaq context
    const categoryTrend = useMemo(() => {
        const map: Record<string, { tagihan:number; donasi:number; sort:number }> = {};
        filteredData.filter(r => isSuccess(r.status_transaksi) && r.jenis_transaksi==="masuk").forEach(r => {
            const d = dayjs(r.tanggal_transaksi);
            const key = d.format("DD/MM");
            if (!map[key]) map[key] = { tagihan:0, donasi:0, sort:d.valueOf() };
            if (r.kategori==="donasi") map[key].donasi += Number(r.jumlah);
            else                       map[key].tagihan += Number(r.jumlah);
        });
        return Object.entries(map).sort((a,b) => a[1].sort-b[1].sort).map(([date,v]) => ({ date, ...v }));
    }, [filteredData]);

    // Table summary
    const pageSuccessMasuk  = filteredData.filter(r=>isSuccess(r.status_transaksi)&&r.jenis_transaksi==="masuk").reduce((s,r)=>s+Number(r.jumlah),0);
    const pageSuccessKeluar = filteredData.filter(r=>isSuccess(r.status_transaksi)&&r.jenis_transaksi==="keluar").reduce((s,r)=>s+Number(r.jumlah),0);

    // ── Export Excel ──────────────────────────────────────────────────────────
    const handleExportExcel = useCallback(async () => {
        setIsExporting(true);
        const key = "gl_export";
        message.loading({ content:"Menyiapkan Laporan Keuangan...", key, duration:0 });
        try {
            const wb  = new ExcelJS.Workbook();
            wb.creator = "Sistem Al-Hasanah";
            wb.created = new Date();
            const rows = rawData;
            const C = { gold:"FFBE9A3A", goldDark:"FF9A7A00", goldBg:"FFFFF8E6",
                        green:"FF16A34A", red:"FFDC2626", white:"FFFFFFFF" };

            const headerFill = (argb: string): ExcelJS.Fill =>
                ({ type:"pattern", pattern:"solid", fgColor:{ argb } } as ExcelJS.Fill);

            const allBordersMed: Partial<ExcelJS.Borders> = {
                top:{ style:"medium",color:{argb:C.goldDark} }, bottom:{ style:"medium",color:{argb:C.goldDark} },
                left:{ style:"medium",color:{argb:C.goldDark} }, right:{ style:"medium",color:{argb:C.goldDark} },
            };

            const addKop = (ws: ExcelJS.Worksheet, cols: number, title: string, sub: string) => {
                ws.mergeCells(1,1,1,cols); const r1 = ws.getRow(1);
                r1.getCell(1).value = "PESANTREN AL-HASANAH";
                r1.getCell(1).font  = { name:"Arial",size:14,bold:true,color:{argb:C.goldDark} };
                r1.getCell(1).alignment = { horizontal:"center" };
                ws.mergeCells(2,1,2,cols); const r2 = ws.getRow(2);
                r2.getCell(1).value = title;
                r2.getCell(1).font  = { name:"Arial",size:11,bold:true,color:{argb:C.gold} };
                r2.getCell(1).alignment = { horizontal:"center" };
                ws.mergeCells(3,1,3,cols); const r3 = ws.getRow(3);
                r3.getCell(1).value = sub;
                r3.getCell(1).font  = { name:"Arial",size:9,italic:true,color:{argb:C.goldDark} };
                r3.getCell(1).alignment = { horizontal:"center" };
                [1,2,3].forEach(i => { ws.getRow(i).height=18; ws.getRow(i).getCell(1).fill=headerFill(C.goldBg); });
                ws.addRow([]);
            };
            const setHeaderRow = (ws: ExcelJS.Worksheet, headers: string[], rowNum: number) => {
                ws.getRow(rowNum).values = headers;
                ws.getRow(rowNum).height = 20;
                ws.getRow(rowNum).eachCell(c => {
                    c.font = { name:"Arial",size:10,bold:true,color:{argb:C.white} };
                    c.fill = headerFill(C.goldDark);
                    c.alignment = { horizontal:"center",vertical:"middle" };
                    c.border = allBordersMed;
                });
            };
            const setCellStyle = (c: ExcelJS.Cell, alt: boolean) => {
                c.fill = headerFill(alt ? C.goldBg : C.white);
                c.border = { bottom:{ style:"thin",color:{argb:"FFE8D5A0"} } };
            };

            // Sheet 1 — Summary
            const ws1 = wb.addWorksheet("📊 Ringkasan", { properties:{ tabColor:{ argb:"FF"+GOLD_DARK.replace("#","") } } });
            ws1.views = [{ showGridLines:false }];
            addKop(ws1, 4, "RINGKASAN BUKU BESAR KEUANGAN", `${dateRange[0].format("DD MMM YYYY")} s.d. ${dateRange[1].format("DD MMM YYYY")}`);
            setHeaderRow(ws1, ["METRIK","NILAI","METRIK","NILAI"], 5);
            const summaryPairs = [
                ["Kas Masuk (Sukses)", kpi.totalMasuk, "Kas Keluar", kpi.totalKeluar],
                ["Net Saldo", kpi.netSaldo, "Total Transaksi", kpi.total],
                ["Tagihan", kpi.tagihanTotal, "Infaq/Wakaf", kpi.infaqTotal],
                ["Digital", kpi.digitalTotal, "Cash", kpi.cashTotal],
                ["Sukses", kpi.sukses, "Pending", kpi.pending],
                ["Rate Sukses", `${kpi.successRate}%`, "Digital%", `${kpi.digitalPct}%`],
            ];
            summaryPairs.forEach((p, i) => {
                const row = ws1.addRow(p); row.height = 20;
                row.eachCell(c => { setCellStyle(c, i%2===0); c.alignment = { vertical:"middle" }; });
                [2,4].forEach(ci => {
                    if (typeof row.getCell(ci).value === "number") {
                        row.getCell(ci).numFmt = "#,##0";
                        row.getCell(ci).font = { name:"Courier New",size:10,bold:true,
                            color:{ argb: (row.getCell(ci).value as number) < 0 ? C.red : C.green } };
                    }
                });
            });
            [28,20,28,20].forEach((w,i) => { ws1.getColumn(i+1).width = w; });

            // Sheet 2 — Jurnal Lengkap
            const ws2 = wb.addWorksheet("📋 Jurnal Lengkap", { properties:{ tabColor:{ argb:"FF"+INFO.replace("#","") } } });
            ws2.views = [{ showGridLines:false }];
            addKop(ws2, 10, "JURNAL TRANSAKSI KEUANGAN", `${dateRange[0].format("DD MMMM YYYY")} s.d. ${dateRange[1].format("DD MMMM YYYY")}`);
            setHeaderRow(ws2, ["NO","TANGGAL","WAKTU","JENIS","SUBJEK / SANTRI","WALI","URAIAN","KATEGORI","METODE","NOMINAL","STATUS"], 8);
            rows.forEach((r, i) => {
                const row = ws2.addRow([
                    i+1,
                    dayjs(r.tanggal_transaksi).format("DD/MM/YYYY"),
                    dayjs(r.tanggal_transaksi).format("HH:mm"),
                    r.jenis_transaksi?.toUpperCase(),
                    r.santri?.nama || "Umum/Masyarakat",
                    r.wali?.full_name || "-",
                    r.keterangan || "-",
                    r.kategori || "-",
                    (r.metode_pembayaran || "CASH").toUpperCase(),
                    Number(r.jumlah),
                    isSuccess(r.status_transaksi) ? "SUKSES" : isPending(r.status_transaksi) ? "PENDING" : "GAGAL",
                ]);
                row.height = 22;
                row.eachCell(c => setCellStyle(c, i%2===0));
                row.getCell(10).numFmt = "#,##0";
                const isMasuk = r.jenis_transaksi === "masuk";
                row.getCell(10).font = { name:"Courier New",size:10,bold:true,
                    color:{ argb: isSuccess(r.status_transaksi) ? (isMasuk?C.green:C.red) : "FF999999" } };
            });
            const footMasuk  = rows.filter(r=>isSuccess(r.status_transaksi)&&r.jenis_transaksi==="masuk").reduce((s,r)=>s+Number(r.jumlah),0);
            const footKeluar = rows.filter(r=>isSuccess(r.status_transaksi)&&r.jenis_transaksi==="keluar").reduce((s,r)=>s+Number(r.jumlah),0);
            [["TOTAL KAS MASUK",footMasuk,C.green],["TOTAL KAS KELUAR",footKeluar,C.red],["NET SALDO",footMasuk-footKeluar,(footMasuk-footKeluar)>=0?C.green:C.red]]
                .forEach(([label,val,color]) => {
                    const fr = ws2.addRow(["","","","","","","","","",val as number,String(label)]);
                    fr.height = 24;
                    fr.getCell(11).font = { name:"Arial",size:10,bold:true,color:{argb:C.goldDark} };
                    fr.getCell(10).numFmt = "#,##0";
                    fr.getCell(10).font = { name:"Courier New",size:11,bold:true,color:{argb:color as string} };
                    fr.getCell(10).fill = headerFill(C.goldBg);
                    fr.getCell(10).border = allBordersMed;
                });
            [5,14,8,10,30,24,34,14,12,18,12].forEach((w,i) => { ws2.getColumn(i+1).width=w; });
            ws2.autoFilter = "A8:K8";

            // Sheet 3 — Infaq
            const infaqRows = rows.filter(r => r.jenis_transaksi==="masuk" && isSuccess(r.status_transaksi) && r.kategori==="donasi");
            if (infaqRows.length > 0) {
                const ws3 = wb.addWorksheet("❤️ Infaq & Wakaf", { properties:{ tabColor:{ argb:"FF7C3AED" } } });
                ws3.views = [{ showGridLines:false }];
                addKop(ws3, 6, "LAPORAN INFAQ, WAKAF & SHADAQAH", `${dateRange[0].format("DD MMM YYYY")} s/d ${dateRange[1].format("DD MMM YYYY")}`);
                setHeaderRow(ws3, ["NO","TANGGAL","PEMBERI / WALI","URAIAN","METODE","NOMINAL"], 8);
                let totalInfaq = 0;
                infaqRows.forEach((r,i) => {
                    totalInfaq += Number(r.jumlah);
                    const row = ws3.addRow([i+1, dayjs(r.tanggal_transaksi).format("DD MMM YYYY HH:mm"),
                        r.wali?.full_name || r.santri?.nama || "Donatur Umum",
                        r.keterangan || "-", (r.metode_pembayaran||"CASH").toUpperCase(), Number(r.jumlah)]);
                    row.height=22; row.eachCell(c => setCellStyle(c, i%2===0));
                    row.getCell(6).numFmt="#,##0";
                    row.getCell(6).font={ name:"Courier New",size:10,bold:true,color:{argb:C.green} };
                });
                const ft = ws3.addRow(["","","","","TOTAL INFAQ/WAKAF",totalInfaq]);
                ft.height=26; ft.getCell(5).font={ name:"Arial",size:11,bold:true,color:{argb:C.goldDark} };
                ft.getCell(5).alignment={ horizontal:"right" };
                ft.getCell(6).numFmt="#,##0"; ft.getCell(6).font={ name:"Courier New",size:12,bold:true,color:{argb:C.green} };
                ft.getCell(6).fill=headerFill(C.goldBg); ft.getCell(6).border=allBordersMed;
                [5,24,32,40,14,20].forEach((w,i) => { ws3.getColumn(i+1).width=w; });
            }

            const buf = await wb.xlsx.writeBuffer();
            saveAs(new Blob([buf]), `BukuBesar_AlHasanah_${dateRange[0].format("DDMMYY")}-${dateRange[1].format("DDMMYY")}.xlsx`);
            message.success({ content:"Laporan Keuangan berhasil diunduh!", key, duration:3 });
        } catch (err: any) {
            message.error({ content:`Gagal export: ${err.message}`, key });
        } finally { setIsExporting(false); }
    }, [rawData, dateRange]);

    // ── Columns ───────────────────────────────────────────────────────────────
    const columns: ProColumns<ITransaksiKeuangan>[] = [
        {
            title:"Waktu & Pencatat", dataIndex:"tanggal_transaksi", width:170, fixed:"left",
            render: (_,r) => (
                <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                    <Text style={{ fontWeight:700, fontSize:13, color:token.colorText, lineHeight:"1.2" }}>
                        {dayjs(r.tanggal_transaksi).format("DD MMM YYYY")}
                    </Text>
                    <Text className="gl-mono" style={{ fontSize:11, color:token.colorTextSecondary }}>
                        {dayjs(r.tanggal_transaksi).format("HH:mm")} WIB
                    </Text>
                    <div style={{ marginTop:3 }}>
                        {r.admin?.full_name ? (
                            <Tag icon={<UserOutlined />} style={{
                                background: isDark ? STATUS_COLOR.info.bg : "#EFF6FF",
                                color:INFO, border:`1px solid ${STATUS_COLOR.info.border}`,
                                borderRadius:6, fontSize:9.5, fontWeight:700, padding:"0 6px", margin:0
                            }}>{r.admin.full_name}</Tag>
                        ) : (
                            <Tag icon={<ThunderboltOutlined />} style={{
                                background: isDark ? STATUS_COLOR.teal.bg : "#F0FDFA",
                                color:TEAL, border:`1px solid ${STATUS_COLOR.teal.border}`,
                                borderRadius:6, fontSize:9.5, fontWeight:700, padding:"0 6px", margin:0
                            }}>SISTEM AUTO</Tag>
                        )}
                    </div>
                </div>
            ),
        },
        {
            title:"Jenis", dataIndex:"jenis_transaksi", width:92, align:"center",
            render: (val) => {
                const im = val === "masuk";
                return (
                    <Tag icon={im ? <RiseOutlined /> : <FallOutlined />} style={{
                        background: im ? (isDark?STATUS_COLOR.success.bg:"#F0FDF4") : (isDark?STATUS_COLOR.danger.bg:"#FFF1F2"),
                        color: im ? SUCCESS : DANGER,
                        border:`1px solid ${im?STATUS_COLOR.success.border:STATUS_COLOR.danger.border}`,
                        borderRadius:20, fontWeight:800, fontSize:10.5, padding:"3px 10px",
                        display:"inline-flex", alignItems:"center", gap:4,
                    }}>{im?"MASUK":"KELUAR"}</Tag>
                );
            },
        },
        {
            title:"Subjek Transaksi", key:"subjek", width:240,
            render: (_,r) => (
                <Space size={10} align="start">
                    <Avatar size={38} icon={r.santri ? <TeamOutlined /> : <HeartOutlined />} style={{
                        flexShrink:0,
                        background: r.santri ? (isDark?G(.18):"#FDF6DC") : (isDark?STATUS_COLOR.purple.bg:"#F5F3FF"),
                        color: r.santri ? (isDark?"#F0C040":GOLD_DARK) : PURPLE,
                        border:`2px solid ${r.santri?G(.3):STATUS_COLOR.purple.border}`,
                    }} />
                    <div style={{ display:"flex", flexDirection:"column", gap:3, minWidth:0 }}>
                        {r.santri ? (
                            <>
                                <Text style={{ fontWeight:700, fontSize:13, color:token.colorText, lineHeight:"1.2" }}>
                                    {r.santri.nama}
                                </Text>
                                <Tag style={{
                                    background:G(isDark?.18:.08), color:isDark?"#F0C040":GOLD_DARK,
                                    border:`1px solid ${G(.25)}`, borderRadius:5,
                                    fontSize:9.5, fontWeight:700, padding:"0 6px", margin:0, display:"inline"
                                }}>Kelas {r.santri.kelas}</Tag>
                            </>
                        ) : (
                            <Text style={{ fontSize:12.5, color:token.colorTextSecondary, fontStyle:"italic" }}>
                                Umum / Masyarakat
                            </Text>
                        )}
                        {r.wali?.full_name && (
                            <Text style={{ fontSize:10.5, color:token.colorTextSecondary }}>
                                Wali: {r.wali.full_name}
                            </Text>
                        )}
                    </div>
                </Space>
            ),
        },
        {
            title:"Uraian & Audit", dataIndex:"keterangan", width:230,
            render: (val, r) => (
                <div>
                    <div style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
                        <div style={{ width:3, minHeight:28, borderRadius:2, flexShrink:0,
                            background:`linear-gradient(to bottom, ${GOLD_BRIGHT}, ${GOLD_DARK})` }} />
                        <Text style={{ fontSize:12.5, color:token.colorText, lineHeight:1.5 }}>
                            {val||"—"}
                        </Text>
                    </div>
                    {r.midtrans_order_id && (
                        <div style={{ marginTop:6, padding:"3px 8px",
                            background:isDark?"rgba(255,255,255,0.04)":"#F8FAFC",
                            border:`1px solid ${isDark?"rgba(255,255,255,0.08)":"#E2E8F0"}`,
                            borderRadius:5, display:"flex", alignItems:"center", gap:5 }}>
                            <LockOutlined style={{ fontSize:9, color:TEAL }} />
                            <Text className="gl-mono" style={{ fontSize:9.5, color:token.colorTextSecondary }}>
                                {r.midtrans_order_id}
                            </Text>
                        </div>
                    )}
                </div>
            ),
        },
        {
            title:"Metode", dataIndex:"metode_pembayaran", width:120, align:"center",
            render: (val) => {
                const meta = metodeMeta(String(val??"cash"));
                return (
                    <div style={{ display:"inline-flex", alignItems:"center", gap:6,
                        background:isDark?"rgba(255,255,255,0.05)":token.colorBgTextHover,
                        border:`1px solid ${isDark?"rgba(255,255,255,0.1)":token.colorBorderSecondary}`,
                        borderRadius:8, padding:"4px 10px" }}>
                        <span style={{ color:token.colorTextSecondary, fontSize:12 }}>{meta.icon}</span>
                        <Text className="gl-mono" style={{ fontSize:10.5, fontWeight:700, color:token.colorText, letterSpacing:"0.04em" }}>
                            {meta.label}
                        </Text>
                    </div>
                );
            },
        },
        {
            title:"Nominal", dataIndex:"jumlah", width:175, align:"right",
            render: (val, r) => {
                const im = r.jenis_transaksi === "masuk";
                const ok = isSuccess(r.status_transaksi);
                return (
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:3 }}>
                        <Text className="gl-mono" style={{ fontWeight:800, fontSize:14.5,
                            color: ok ? (im?SUCCESS:DANGER) : token.colorTextSecondary }}>
                            {im?"+":"−"}{fCurrency(Number(val))}
                        </Text>
                        {!ok && <Text style={{ fontSize:9.5, color:token.colorTextSecondary }}>(belum terkonfirmasi)</Text>}
                    </div>
                );
            },
        },
        {
            title:"Status", dataIndex:"status_transaksi", width:120, align:"center", fixed:"right",
            render: (val) => {
                const meta = statusMeta(String(val??""));
                return (
                    <Tag icon={meta.icon} style={{
                        background: isDark ? meta.c.bg : meta.c.bg,
                        color:meta.c.base, border:`1px solid ${meta.c.border}`,
                        borderRadius:20, fontWeight:800, fontSize:10.5,
                        padding:"3px 12px", display:"inline-flex", alignItems:"center", gap:5,
                    }}>{meta.label}</Tag>
                );
            },
        },
    ];

    const cardBase: React.CSSProperties = {
        borderRadius:20, border:`1px solid ${G(isDark?.18:.13)}`,
        background:token.colorBgContainer,
        boxShadow: isDark ? "0 8px 40px rgba(0,0,0,0.3)" : "0 4px 20px rgba(0,0,0,0.05)",
    };

    // ═════════════════════════════════════════════════════════════════════
    return (
        <motion.div
            className="gl-root"
            initial="hidden" animate="visible" variants={stagger}
            style={{ display:"flex", flexDirection:"column", gap:24, paddingBottom:80 }}
        >
            <style>{LEDGER_CSS}</style>

            {/* ── PAGE HEADER ──────────────────────────────────────────────── */}
            <motion.div variants={fadeUp} style={{
                display:"flex", flexWrap:"wrap", justifyContent:"space-between",
                alignItems:"flex-end", gap:16,
                paddingBottom:28,
                borderBottom:`1px solid ${G(isDark?.15:.18)}`,
            }}>
                <div>
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                        <div style={{
                            width:52, height:52, borderRadius:16, flexShrink:0,
                            background:`linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})`,
                            display:"flex", alignItems:"center", justifyContent:"center",
                            boxShadow:`0 8px 26px ${G(.5)}`, fontSize:24, color:"#fff",
                        }}><AuditOutlined /></div>
                        <div>
                            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                                <h1 style={{
                                    fontFamily:"'Syne',sans-serif", fontSize:24, fontWeight:800,
                                    margin:0, letterSpacing:"-0.04em", color:token.colorText, lineHeight:1.1,
                                }}>Buku Besar{" "}
                                    <motion.span
                                        animate={{ backgroundPosition:["0% center","200% center"] }}
                                        transition={{ duration:4, repeat:Infinity, ease:"linear" }}
                                        style={{
                                            background:`linear-gradient(120deg, ${GOLD_DARK}, ${GOLD_BRIGHT}, #FFE680, ${GOLD})`,
                                            WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
                                            backgroundSize:"250% auto", display:"inline-block",
                                        }}>Keuangan</motion.span>
                                </h1>
                            </div>
                            <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                                <Tag style={{ background:`linear-gradient(135deg,${GOLD},${GOLD_DARK})`,
                                    color:"#fff", border:"none", borderRadius:7,
                                    fontWeight:700, fontSize:9.5, letterSpacing:"0.12em", padding:"2px 10px" }}>
                                    AUDIT LOCKED
                                </Tag>
                                <Tag icon={<CheckCircleOutlined />} style={{
                                    background: isDark ? STATUS_COLOR.success.bg : "#F0FDF4",
                                    color:SUCCESS, border:`1px solid ${STATUS_COLOR.success.border}`,
                                    borderRadius:7, fontSize:9.5, fontWeight:700, padding:"2px 9px"
                                }}>GENERAL LEDGER</Tag>
                                <span style={{ fontSize:12, color:token.colorTextSecondary }}>
                                    <CalendarOutlined style={{ marginRight:5, color:GOLD }} />
                                    {formatHijri(new Date())} · {formatMasehi(new Date())}
                                </span>
                                <span style={{ fontSize:12, color:token.colorTextSecondary }}>
                                    <LockOutlined style={{ marginRight:4, color:SUCCESS }} />
                                    Data tidak dapat dimanipulasi
                                </span>
                            </div>
                        </div>
                    </div>

                    <div style={{ fontSize:13, color:token.colorTextSecondary, marginTop:4 }}>
                        {dateRange[0].format("DD MMM YYYY")} — {dateRange[1].format("DD MMM YYYY")}
                        <span style={{ margin:"0 8px", color:token.colorBorderSecondary }}>·</span>
                        <span style={{ color:GOLD_BRIGHT, fontWeight:600 }}>{filteredData.length} transaksi</span>
                        {activeFilters > 0 && (
                            <span style={{ marginLeft:10, padding:"2px 8px", borderRadius:6, fontSize:11,
                                background:G(.12), color:GOLD_BRIGHT, fontWeight:700, border:`1px solid ${G(.3)}` }}>
                                {activeFilters} filter aktif
                            </span>
                        )}
                    </div>
                </div>

                <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                    <Button icon={<HeartOutlined />} onClick={() => create("transaksi_keuangan")}
                        style={{
                            borderColor:`${PURPLE}55`, color:PURPLE, borderRadius:12, height:40,
                            fontWeight:600, fontSize:13,
                            background: isDark ? STATUS_COLOR.purple.bg : "#F5F3FF",
                        }}>
                        Input Infaq / Wakaf
                    </Button>
                    <motion.div whileHover={{ scale:1.03 }} whileTap={{ scale:.97 }}>
                        <Button icon={<DownloadOutlined />} loading={isExporting} onClick={handleExportExcel}
                            style={{
                                background:`linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)`,
                                border:"none", borderRadius:12, height:40,
                                fontWeight:700, fontSize:13, color:"#fff",
                                boxShadow:`0 6px 20px ${G(.45)}`,
                            }}>
                            Export Buku Besar
                        </Button>
                    </motion.div>
                </div>
            </motion.div>

            {/* ── KPI STRIP ROW 1 ──────────────────────────────────────────── */}
            <motion.div variants={stagger}>
                <Row gutter={[14,14]}>
                    {[
                        { label:"Kas Masuk Sukses", value:kpi.totalMasuk, icon:<RiseOutlined />,
                          color:SUCCESS, formatter:fCompact, subtext:`${kpi.sukses} trx sukses` },
                        { label:"Kas Keluar Sukses", value:kpi.totalKeluar, icon:<FallOutlined />,
                          color:DANGER,  formatter:fCompact, subtext:"transaksi keluar" },
                        { label:"Net Saldo",         value:kpi.netSaldo,   icon:<SwapOutlined />,
                          color:kpi.netSaldo>=0?SUCCESS:DANGER, formatter:fCompact,
                          subtext:kpi.netSaldo>=0?"Posisi Surplus":"Posisi Defisit" },
                        { label:"Total Transaksi",   value:kpi.total,      icon:<BarChartOutlined />,
                          color:INFO, subtext:`${kpi.sukses} sukses · ${kpi.pending} pending` },
                        { label:"Rata / Trx",         value:kpi.rataRata,  icon:<DollarOutlined />,
                          color:GOLD_BRIGHT, formatter:fCompact, subtext:"per transaksi masuk sukses" },
                        { label:"Tingkat Sukses",     value:kpi.successRate, icon:<SafetyCertificateOutlined />,
                          color:TEAL,
                          subtext:`${kpi.gagal} gagal · ${kpi.pending} pending` },
                        { label:"Infaq & Wakaf",      value:kpi.infaqTotal, icon:<HeartOutlined />,
                          color:PURPLE, formatter:fCompact, subtext:`Tagihan: ${fCompact(kpi.tagihanTotal)}` },
                        { label:"Transaksi Digital",  value:kpi.digitalTotal, icon:<CreditCardOutlined />,
                          color:INFO, formatter:fCompact, subtext:`${kpi.digitalPct}% dari total masuk` },
                    ].map((k, i) => (
                        <Col key={k.label} xs={12} sm={8} lg={6}>
                            <KpiCard {...k} isDark={isDark} token={token} delay={i} />
                        </Col>
                    ))}
                </Row>
            </motion.div>

            {/* ── AUDIT INSIGHT STRIP ──────────────────────────────────────── */}
            <motion.div variants={fadeUp} custom={2}>
                <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
                    <InsightBadge icon={<CheckCircleOutlined />} label="Sukses Rate"
                        value={`${kpi.successRate}%`} color={SUCCESS} isDark={isDark} />
                    <InsightBadge icon={<ClockCircleOutlined />} label="Nilai Pending"
                        value={fCompact(kpi.pendingValue)} color={WARNING} isDark={isDark} />
                    <InsightBadge icon={<CloseCircleOutlined />} label="Nilai Gagal"
                        value={fCompact(kpi.gagalValue)} color={DANGER} isDark={isDark} />
                    <InsightBadge icon={<FundOutlined />} label="Running Balance"
                        value={fCompact(kpi.netSaldo)} color={kpi.netSaldo>=0?TEAL:DANGER} isDark={isDark} />
                    <InsightBadge icon={<HeartOutlined />} label="Porsi Infaq"
                        value={kpi.totalMasuk>0 ? `${((kpi.infaqTotal/kpi.totalMasuk)*100).toFixed(1)}%` : "0%"}
                        color={PURPLE} isDark={isDark} />
                    <InsightBadge icon={<CreditCardOutlined />} label="Digital %"
                        value={`${kpi.digitalPct}%`} color={INFO} isDark={isDark} />
                </div>
            </motion.div>

            {/* ── ANALYTICS SECTION ────────────────────────────────────────── */}
            <motion.div variants={fadeUp} custom={3}>
                <SectionHeader
                    icon={<BarChartOutlined />}
                    title="Analitik Audit Keuangan"
                    subtitle="Visualisasi arus kas harian, distribusi metode, pipeline status & komposisi pendapatan"
                />

                {/* Row 1: Daily Cashflow + Running Balance (full width) */}
                <Card bordered={false} style={{ ...cardBase, marginBottom:16 }} bodyStyle={{ padding:"24px 28px 20px" }}>
                    <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"space-between",
                        alignItems:"center", gap:14, marginBottom:20 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                            <div style={{
                                width:42, height:42, borderRadius:13,
                                background:`linear-gradient(135deg, ${GOLD}20, ${GOLD_BRIGHT}15)`,
                                border:`1px solid ${GOLD}28`, flexShrink:0,
                                display:"flex", alignItems:"center", justifyContent:"center",
                                color:GOLD_BRIGHT, fontSize:18,
                            }}><LineChartOutlined /></div>
                            <div>
                                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:16, letterSpacing:"-0.02em" }}>
                                    Arus Kas Harian + Running Balance
                                </div>
                                <div style={{ fontSize:12, color:token.colorTextSecondary }}>
                                    Masuk (hijau) · Keluar (merah) · Saldo Berjalan (garis kuning) · {filteredData.length} trx
                                </div>
                            </div>
                        </div>
                    </div>
                    <div style={{ width:"100%", height:300 }}>
                        {isLoading ? <Skeleton active paragraph={{ rows:7 }} /> :
                        dailyData.length === 0 ? (
                            <Empty description="Belum ada transaksi sukses" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                        ) : (
                            <ResponsiveContainer>
                                <ComposedChart data={dailyData} barGap={2} barCategoryGap="28%">
                                    <defs>
                                        <linearGradient id="masukGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%"   stopColor={SUCCESS} stopOpacity={0.85}/>
                                            <stop offset="100%" stopColor={SUCCESS} stopOpacity={0.35}/>
                                        </linearGradient>
                                        <linearGradient id="keluarGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%"   stopColor={DANGER}  stopOpacity={0.85}/>
                                            <stop offset="100%" stopColor={DANGER}  stopOpacity={0.35}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.07} />
                                    <XAxis dataKey="date" tick={TICK} axisLine={false} tickLine={false}
                                        interval={Math.max(0, Math.floor(dailyData.length/8))} />
                                    <YAxis yAxisId="left" tickFormatter={v=>`${v/1000}k`}
                                        tick={TICK} axisLine={false} tickLine={false} width={52} />
                                    <YAxis yAxisId="right" orientation="right"
                                        tickFormatter={v=>`${v/1000}k`}
                                        tick={{ fontSize:10, fill:GOLD_BRIGHT }} axisLine={false} tickLine={false} width={52} />
                                    <ReTooltip content={<PremiumTooltip token={token} />}
                                        cursor={{ fill:isDark?"rgba(255,255,255,0.025)":"rgba(0,0,0,0.025)" }} />
                                    <Bar yAxisId="left" dataKey="masuk"   name="Kas Masuk"   fill="url(#masukGrad)"  radius={[4,4,0,0]} maxBarSize={22} />
                                    <Bar yAxisId="left" dataKey="keluar"  name="Kas Keluar"  fill="url(#keluarGrad)" radius={[4,4,0,0]} maxBarSize={22} />
                                    <Line yAxisId="right" type="monotone" dataKey="balance" name="Saldo Berjalan"
                                        stroke={GOLD_BRIGHT} strokeWidth={2.5} dot={false}
                                        activeDot={{ r:5, fill:GOLD_BRIGHT, stroke:token.colorBgContainer, strokeWidth:2 }} />
                                    <Legend iconSize={8} formatter={v =>
                                        <span style={{ fontSize:11, color:token.colorTextSecondary }}>{v}</span>} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </Card>

                {/* Row 2: 3 charts side-by-side */}
                <Row gutter={[16,16]}>
                    {/* Metode Pembayaran Donut */}
                    <Col xs={24} md={8}>
                        <Card bordered={false} style={cardBase} bodyStyle={{ padding:"22px 24px" }}>
                            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:14,
                                letterSpacing:"-0.02em", marginBottom:4 }}>Metode Pembayaran</div>
                            <div style={{ fontSize:11, color:token.colorTextSecondary, marginBottom:16 }}>
                                Distribusi nominal kas masuk sukses
                            </div>
                            {isLoading ? <Skeleton active paragraph={{ rows:5 }} /> :
                            methodData.length === 0 ? (
                                <Empty description="Belum ada data" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding:"20px 0" }} />
                            ) : (
                                <>
                                    <div style={{ width:"100%", height:185 }}>
                                        <ResponsiveContainer>
                                            <PieChart>
                                                <Pie data={methodData} innerRadius={48} outerRadius={72}
                                                    paddingAngle={3} dataKey="value" label={renderPieLabel}>
                                                    {methodData.map((d,i) => (
                                                        <Cell key={i} fill={d.color||PIE_PALETTE[i%PIE_PALETTE.length]} stroke="transparent" />
                                                    ))}
                                                </Pie>
                                                <ReTooltip
                                                    formatter={(v:any) => [fCurrency(Number(v)), "Nominal"]}
                                                    contentStyle={{ background:token.colorBgElevated,
                                                        border:`1px solid ${token.colorBorderSecondary}`, borderRadius:12, fontSize:12 }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div>
                                        {methodData.map((d, i) => {
                                            const total = methodData.reduce((a,c) => a+c.value, 0);
                                            const pct = total > 0 ? ((d.value/total)*100).toFixed(1) : "0";
                                            return (
                                                <div key={i} style={{ display:"flex", alignItems:"center",
                                                    justifyContent:"space-between", padding:"5px 0",
                                                    borderBottom:`1px solid ${isDark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.04)"}` }}>
                                                    <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                                                        <span style={{ width:7, height:7, borderRadius:"50%",
                                                            background:d.color||PIE_PALETTE[i%PIE_PALETTE.length], flexShrink:0 }} />
                                                        <span style={{ fontSize:11, fontWeight:600, color:token.colorTextSecondary }}>{d.name}</span>
                                                    </div>
                                                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                                                        <span style={{ fontSize:10, fontWeight:700, color:d.color||PIE_PALETTE[i%PIE_PALETTE.length] }}>{pct}%</span>
                                                        <span style={{ fontFamily:"'DM Mono',monospace", fontWeight:700, fontSize:11, color:token.colorText }}>
                                                            {fCompact(d.value)}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </Card>
                    </Col>

                    {/* Status Pipeline */}
                    <Col xs={24} md={8}>
                        <Card bordered={false} style={cardBase} bodyStyle={{ padding:"22px 24px" }}>
                            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:14,
                                letterSpacing:"-0.02em", marginBottom:4 }}>Pipeline Status Transaksi</div>
                            <div style={{ fontSize:11, color:token.colorTextSecondary, marginBottom:16 }}>
                                Volume & nilai per status transaksi
                            </div>
                            {isLoading ? <Skeleton active paragraph={{ rows:5 }} /> : (
                                <>
                                    {statusPipeData.map(s => {
                                        const pct = kpi.total > 0 ? (s.value/kpi.total)*100 : 0;
                                        return (
                                            <div key={s.name} style={{ marginBottom:20 }}>
                                                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8, alignItems:"center" }}>
                                                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                                        <span style={{ width:9, height:9, borderRadius:"50%",
                                                            background:s.color, flexShrink:0,
                                                            boxShadow:`0 0 6px ${s.color}` }} />
                                                        <span style={{ fontWeight:700, fontSize:13, color:s.color }}>
                                                            {s.name}
                                                        </span>
                                                    </div>
                                                    <div style={{ textAlign:"right" }}>
                                                        <div style={{ fontFamily:"'DM Mono',monospace", fontWeight:800, fontSize:18,
                                                            color:s.color, lineHeight:1 }}>
                                                            {s.value}
                                                        </div>
                                                        <div style={{ fontSize:10, color:token.colorTextTertiary }}>
                                                            {fCompact(s.amount)}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ height:8, borderRadius:99, background:isDark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.07)", overflow:"hidden" }}>
                                                    <motion.div
                                                        initial={{ width:0 }}
                                                        animate={{ width:`${pct}%` }}
                                                        transition={{ duration:1.0, ease:[0.22,1,0.36,1], delay:0.3 }}
                                                        style={{ height:"100%", borderRadius:99,
                                                            background:`linear-gradient(90deg, ${s.color}CC, ${s.color})`,
                                                            boxShadow:`0 0 8px ${s.color}50` }}
                                                    />
                                                </div>
                                                <div style={{ fontSize:10, color:token.colorTextTertiary, marginTop:4 }}>
                                                    {pct.toFixed(1)}% dari total transaksi
                                                </div>
                                            </div>
                                        );
                                    })}

                                    <Divider style={{ borderColor:G(.15), margin:"8px 0 12px" }} />
                                    <div style={{ display:"flex", gap:8 }}>
                                        {[
                                            { label:"Cash", val:kpi.cashTotal, color:GOLD_BRIGHT },
                                            { label:"Digital", val:kpi.digitalTotal, color:INFO },
                                        ].map(m => (
                                            <div key={m.label} style={{ flex:1, padding:"8px 10px", borderRadius:10,
                                                background:isDark?`${m.color}0e`:`${m.color}08`,
                                                border:`1px solid ${m.color}25` }}>
                                                <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.1em",
                                                    textTransform:"uppercase", color:m.color, marginBottom:3 }}>{m.label}</div>
                                                <div style={{ fontFamily:"'DM Mono',monospace", fontWeight:800,
                                                    fontSize:13, color:m.color }}>{fCompact(m.val)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </Card>
                    </Col>

                    {/* Infaq vs Tagihan */}
                    <Col xs={24} md={8}>
                        <Card bordered={false} style={cardBase} bodyStyle={{ padding:"22px 24px" }}>
                            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:14,
                                letterSpacing:"-0.02em", marginBottom:4 }}>Komposisi Pemasukan</div>
                            <div style={{ fontSize:11, color:token.colorTextSecondary, marginBottom:16 }}>
                                Split Tagihan vs Infaq/Wakaf
                            </div>
                            {isLoading ? <Skeleton active paragraph={{ rows:5 }} /> : (
                                <>
                                    <div style={{ width:"100%", height:185 }}>
                                        <ResponsiveContainer>
                                            <PieChart>
                                                <Pie data={infaqPieData} innerRadius={48} outerRadius={72}
                                                    paddingAngle={4} dataKey="value" label={renderPieLabel}>
                                                    {infaqPieData.map((_,i) => (
                                                        <Cell key={i} fill={infaqPieColors[i]} stroke="transparent" />
                                                    ))}
                                                </Pie>
                                                <ReTooltip
                                                    formatter={(v:any) => [fCurrency(Number(v)), "Nominal"]}
                                                    contentStyle={{ background:token.colorBgElevated,
                                                        border:`1px solid ${token.colorBorderSecondary}`, borderRadius:12, fontSize:12 }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    {infaqPieData.map((d,i) => {
                                        const total = infaqPieData.reduce((a,c) => a+c.value,0);
                                        const pct = total>0 ? ((d.value/total)*100).toFixed(1):"0";
                                        const c = infaqPieColors[i];
                                        return (
                                            <div key={d.name} style={{ marginBottom:12 }}>
                                                <div style={{ display:"flex", justifyContent:"space-between",
                                                    marginBottom:5, alignItems:"center" }}>
                                                    <span style={{ display:"flex", alignItems:"center", gap:7, fontSize:12, fontWeight:600, color:token.colorTextSecondary }}>
                                                        <span style={{ width:8, height:8, borderRadius:"50%", background:c, flexShrink:0 }} />
                                                        {d.name}
                                                    </span>
                                                    <div style={{ textAlign:"right" }}>
                                                        <span style={{ fontSize:10, fontWeight:700, color:c, marginRight:6 }}>{pct}%</span>
                                                        <span style={{ fontFamily:"'DM Mono',monospace", fontWeight:700, fontSize:12, color:token.colorText }}>
                                                            {fCompact(d.value)}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div style={{ height:6, borderRadius:99, background:isDark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.07)", overflow:"hidden" }}>
                                                    <motion.div
                                                        initial={{ width:0 }}
                                                        animate={{ width:`${pct}%` }}
                                                        transition={{ duration:1.0, ease:[0.22,1,0.36,1], delay:0.4+i*0.1 }}
                                                        style={{ height:"100%", borderRadius:99,
                                                            background:`linear-gradient(90deg, ${c}CC, ${c})` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}

                                    <Divider style={{ borderColor:G(.15), margin:"10px 0 14px" }} />
                                    <div style={{ padding:"10px 14px", borderRadius:12,
                                        background:isDark?`${GOLD}0e`:`${GOLD}08`,
                                        border:`1px solid ${GOLD}25` }}>
                                        <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.1em",
                                            textTransform:"uppercase", color:GOLD_BRIGHT, marginBottom:4 }}>
                                            Total Kas Masuk Sukses
                                        </div>
                                        <div style={{ fontFamily:"'DM Mono',monospace", fontWeight:800,
                                            fontSize:18, color:GOLD_BRIGHT, letterSpacing:"-0.03em" }}>
                                            {fCurrency(kpi.totalMasuk)}
                                        </div>
                                    </div>
                                </>
                            )}
                        </Card>
                    </Col>
                </Row>

                {/* Row 3: Kategori Trend (full width) */}
                {categoryTrend.length > 1 && (
                    <Card bordered={false} style={{ ...cardBase, marginTop:16 }} bodyStyle={{ padding:"22px 28px 20px" }}>
                        <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:14,
                            letterSpacing:"-0.02em", marginBottom:4 }}>Tren Tagihan vs Infaq/Wakaf Harian</div>
                        <div style={{ fontSize:11, color:token.colorTextSecondary, marginBottom:20 }}>
                            Komposisi pemasukan harian — Tagihan (emas) · Infaq/Wakaf (ungu)
                        </div>
                        <div style={{ width:"100%", height:220 }}>
                            <ResponsiveContainer>
                                <AreaChart data={categoryTrend}>
                                    <defs>
                                        <linearGradient id="tagihanG" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%"   stopColor={GOLD_BRIGHT} stopOpacity={0.45}/>
                                            <stop offset="100%" stopColor={GOLD_BRIGHT} stopOpacity={0.02}/>
                                        </linearGradient>
                                        <linearGradient id="donasiG" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%"   stopColor={PURPLE} stopOpacity={0.38}/>
                                            <stop offset="100%" stopColor={PURPLE} stopOpacity={0.02}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.07} />
                                    <XAxis dataKey="date" tick={TICK} axisLine={false} tickLine={false}
                                        interval={Math.max(0,Math.floor(categoryTrend.length/8))} />
                                    <YAxis tickFormatter={v=>`${v/1000}k`} tick={TICK} axisLine={false} tickLine={false} width={48} />
                                    <ReTooltip content={<PremiumTooltip token={token} />} />
                                    <Area type="monotone" dataKey="tagihan" name="Tagihan"
                                        stroke={GOLD_BRIGHT} fill="url(#tagihanG)" strokeWidth={2} />
                                    <Area type="monotone" dataKey="donasi" name="Infaq/Wakaf"
                                        stroke={PURPLE} fill="url(#donasiG)" strokeWidth={2} />
                                    <Legend iconSize={8} formatter={v =>
                                        <span style={{ fontSize:11, color:token.colorTextSecondary }}>{v}</span>} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                )}
            </motion.div>

            {/* ── FILTER PANEL ──────────────────────────────────────────────── */}
            <motion.div variants={fadeUp} custom={4}>
                <SectionHeader
                    icon={<FilterOutlined />}
                    title="Filter & Pencarian"
                    subtitle="Gunakan filter untuk audit detail transaksi"
                    action={activeFilters > 0 ? (
                        <Tooltip title="Reset semua filter">
                            <Button icon={<ClearOutlined />} onClick={resetFilters} size="small"
                                style={{ borderRadius:10, borderColor:DANGER+"55",
                                    color:DANGER, fontSize:12, fontWeight:600,
                                    background:isDark?STATUS_COLOR.danger.bg:"#FFF1F2" }}>
                                Reset ({activeFilters})
                            </Button>
                        </Tooltip>
                    ) : undefined}
                />
                <Card bordered={false} style={{ ...cardBase, marginBottom:0 }}
                    bodyStyle={{ padding:"18px 22px" }}>
                    <Row gutter={[14,14]} align="middle">
                        <Col xs={24} sm={12} lg={7}>
                            <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.12em",
                                textTransform:"uppercase", color:GOLD, marginBottom:7 }}>PERIODE TRANSAKSI</div>
                            <RangePicker
                                value={dateRange}
                                onChange={d => d && setDateRange(d as [dayjs.Dayjs,dayjs.Dayjs])}
                                allowClear={false} format="DD MMM YYYY"
                                style={{ width:"100%", borderRadius:10, borderColor:G(.35) }}
                                suffixIcon={<CalendarOutlined style={{ color:GOLD }} />}
                                presets={[
                                    { label:"Bulan Ini",  value:[dayjs().startOf("month"), dayjs().endOf("month")] },
                                    { label:"Bulan Lalu", value:[dayjs().subtract(1,"month").startOf("month"), dayjs().subtract(1,"month").endOf("month")] },
                                    { label:"7 Hari",     value:[dayjs().subtract(6,"day"), dayjs()] },
                                    { label:"30 Hari",    value:[dayjs().subtract(29,"day"), dayjs()] },
                                    { label:"Tahun Ini",  value:[dayjs().startOf("year"), dayjs().endOf("year")] },
                                ]}
                            />
                        </Col>
                        <Col xs={24} sm={12} lg={17}>
                            <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.12em",
                                textTransform:"uppercase", color:GOLD, marginBottom:7 }}>FILTER LANJUTAN</div>
                            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:10 }}>
                                {[
                                    { label:"Jenis", val:jenisFilter, set:setJenisFilter, opts:[
                                        { label:"Semua Jenis",  value:"all"    },
                                        { label:"💹 Kas Masuk",  value:"masuk"  },
                                        { label:"💸 Kas Keluar", value:"keluar" },
                                    ]},
                                    { label:"Status", val:statusFilter, set:setStatusFilter, opts:[
                                        { label:"Semua Status", value:"all"    },
                                        { label:"✅ Sukses",     value:"sukses" },
                                        { label:"⏳ Pending",    value:"pending"},
                                        { label:"❌ Gagal",      value:"gagal"  },
                                    ]},
                                    { label:"Metode", val:metodeFilter, set:setMetodeFilter, opts:[
                                        { label:"Semua Metode",  value:"all"         },
                                        { label:"💵 Cash",        value:"cash"        },
                                        { label:"📱 QRIS",        value:"qris"        },
                                        { label:"🏦 Transfer",    value:"bank_transfer"},
                                        { label:"🌐 Midtrans",    value:"midtrans"    },
                                    ]},
                                    { label:"Kategori", val:kategoriFilter, set:setKategoriFilter, opts:[
                                        { label:"Semua Kategori", value:"all"    },
                                        { label:"📋 Tagihan",     value:"tagihan"},
                                        { label:"❤️ Donasi",      value:"donasi" },
                                    ]},
                                    { label:"Gender", val:genderFilter, set:setGenderFilter, opts:[
                                        { label:"Semua",     value:"all" },
                                        { label:"👦 Putra",  value:"L"   },
                                        { label:"👧 Putri",  value:"P"   },
                                        { label:"🌐 Global", value:"ALL" },
                                    ]},
                                    { label:"Takhasus", val:jurusanFilter, set:setJurusanFilter, opts:[
                                        { label:"Semua",     value:"all"     },
                                        { label:"📖 Tahfidz", value:"TAHFIDZ" },
                                        { label:"📚 Kitab",   value:"KITAB"   },
                                        { label:"🌐 Global",  value:"ALL"     },
                                    ]},
                                ].map(f => (
                                    <div key={f.label}>
                                        <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.08em",
                                            textTransform:"uppercase", color:isDark?"rgba(255,255,255,0.4)":"rgba(0,0,0,0.4)",
                                            marginBottom:5 }}>{f.label}</div>
                                        <Select value={f.val} onChange={f.set} style={{ width:"100%" }}
                                            options={f.opts}
                                            styles={{ popup:{ root:{ borderRadius:12 } } }} />
                                    </div>
                                ))}
                            </div>
                        </Col>
                    </Row>
                </Card>
            </motion.div>

            {/* ── TABLE ─────────────────────────────────────────────────────── */}
            <motion.div variants={fadeUp} custom={5}>
                <SectionHeader
                    icon={<AuditOutlined />}
                    title="Jurnal Transaksi"
                    subtitle={`${filteredData.length} record · ${dateRange[0].format("DD MMM")} – ${dateRange[1].format("DD MMM YYYY")}`}
                />
                <div style={{
                    borderRadius:16, overflow:"hidden",
                    border:`1px solid ${G(isDark?.2:.13)}`,
                    boxShadow: isDark
                        ? `0 10px 40px rgba(0,0,0,0.45), 0 0 0 1px ${G(.1)}`
                        : `0 8px 32px ${G(.1)}, 0 2px 8px rgba(0,0,0,0.04)`,
                }}>
                    <ProTable<ITransaksiKeuangan>
                        {...tableProps}
                        dataSource={filteredData}
                        columns={columns}
                        rowKey="id"
                        search={false}
                        className="gl-table"
                        scroll={{ x:1280 }}
                        tableStyle={{ padding:0 }}
                        headerTitle={
                            <Space size={12}>
                                <div style={{
                                    width:36, height:36, borderRadius:11,
                                    background:`linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})`,
                                    display:"flex", alignItems:"center", justifyContent:"center",
                                    boxShadow:`0 4px 14px ${G(.42)}`,
                                }}>
                                    <AuditOutlined style={{ color:"#fff", fontSize:16 }} />
                                </div>
                                <div>
                                    <div style={{ fontSize:14, fontWeight:700, color:token.colorText }}>
                                        Jurnal Lengkap
                                    </div>
                                    <div style={{ fontSize:10, color:GOLD, fontWeight:600, marginTop:1 }}>
                                        {filteredData.length} record · {dateRange[0].format("DD MMM")} – {dateRange[1].format("DD MMM YYYY")}
                                    </div>
                                </div>
                            </Space>
                        }
                        toolBarRender={() => [
                            <Button key="export" icon={<DownloadOutlined />} loading={isExporting}
                                onClick={handleExportExcel}
                                style={{ borderColor:`${SUCCESS}55`, color:SUCCESS, borderRadius:10,
                                    height:36, fontWeight:600, fontSize:12.5,
                                    background:isDark?STATUS_COLOR.success.bg:"#F0FDF4" }}>
                                Export Excel
                            </Button>,
                            <Button key="infaq" icon={<HeartOutlined />} onClick={() => create("transaksi_keuangan")}
                                style={{ background:`linear-gradient(135deg,${GOLD},${GOLD_DARK})`,
                                    border:"none", borderRadius:10, height:36,
                                    fontWeight:700, fontSize:12.5, color:"#fff",
                                    boxShadow:`0 4px 14px ${G(.45)}` }}>
                                Input Infaq
                            </Button>,
                        ]}
                        summary={() => (
                            <ProTable.Summary fixed="bottom">
                                <ProTable.Summary.Row style={{ background:isDark?G(.1):"#FFFBF0" }}>
                                    <ProTable.Summary.Cell index={0} colSpan={5}>
                                        <div style={{ display:"flex", alignItems:"center", gap:10, paddingLeft:8 }}>
                                            <SafetyCertificateOutlined style={{ color:GOLD, fontSize:14 }} />
                                            <Text style={{ fontWeight:800, fontSize:12.5, color:token.colorText }}>
                                                REKAPITULASI HALAMAN (TRANSAKSI SUKSES)
                                            </Text>
                                        </div>
                                    </ProTable.Summary.Cell>
                                    <ProTable.Summary.Cell index={5}>
                                        <div style={{ textAlign:"right", paddingRight:8 }}>
                                            <div className="gl-mono" style={{ fontWeight:900, fontSize:14, color:SUCCESS }}>
                                                +{fCurrency(pageSuccessMasuk)}
                                            </div>
                                            {pageSuccessKeluar > 0 && (
                                                <div className="gl-mono" style={{ fontWeight:700, fontSize:12, color:DANGER }}>
                                                    −{fCurrency(pageSuccessKeluar)}
                                                </div>
                                            )}
                                            <div className="gl-mono" style={{ fontWeight:900, fontSize:13,
                                                color:(pageSuccessMasuk-pageSuccessKeluar)>=0?TEAL:DANGER,
                                                borderTop:`1px dashed ${G(.3)}`, marginTop:3, paddingTop:3 }}>
                                                NET: {fCurrency(pageSuccessMasuk-pageSuccessKeluar)}
                                            </div>
                                        </div>
                                    </ProTable.Summary.Cell>
                                    <ProTable.Summary.Cell index={6} />
                                </ProTable.Summary.Row>
                            </ProTable.Summary>
                        )}
                        pagination={{
                            defaultPageSize:15, showSizeChanger:true,
                            showTotal:(total, range) => (
                                <span style={{ fontSize:12, color:token.colorTextSecondary }}>
                                    Menampilkan{" "}
                                    <strong style={{ color:isDark?"#F0C040":GOLD_DARK }}>{range[0]}–{range[1]}</strong>
                                    {" "}dari{" "}
                                    <strong style={{ color:token.colorText }}>{total}</strong> transaksi
                                </span>
                            ),
                        }}
                        options={{ density:true, fullScreen:true, setting:true, reload:true }}
                    />
                </div>
            </motion.div>
        </motion.div>
    );
};
