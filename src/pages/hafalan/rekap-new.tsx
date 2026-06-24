// rekap.tsx — Tahfidz Command Control Center
// World-class redesign: unified scrollable dashboard, no fragmented tabs
import React, { useState, useMemo, useEffect, useRef } from "react";
import {
    Row, Col, DatePicker, Typography, Tag, Space, Button, theme, Card,
    Table, Segmented, message, Divider, Select, Modal, Checkbox, Progress,
    Avatar, Tooltip, Empty, Skeleton,
} from "antd";
import { motion, Variants } from "framer-motion";
import {
    DownloadOutlined, TeamOutlined, BookOutlined, SyncOutlined,
    CheckCircleFilled, CloseCircleOutlined, RiseOutlined,
    CalendarOutlined, BarChartOutlined, FileExcelOutlined,
    FireOutlined, TrophyOutlined, ReadOutlined, GlobalOutlined,
    FilterOutlined, LineChartOutlined,
} from "@ant-design/icons";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip as ReTooltip, ResponsiveContainer, Cell,
    PieChart, Pie, Legend, AreaChart, Area, ComposedChart, Line,
} from "recharts";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
dayjs.extend(isoWeek);
import { supabaseClient } from "../../utility/supabaseClient";
import { formatHijri, formatMasehi, HIJRI_MONTHS } from "../../utility/dateHelper";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { santriAlias } from "../../utility/privacy";
import hijriConverter from "hijri-converter";
import { resolveHijri, useHijriCorrection } from "../../hooks/useHijriCorrection";
import { useGetIdentity } from "@refinedev/core";

const getCurrentHijri = () => {
    const n = new Date();
    return hijriConverter.toHijri(n.getFullYear(), n.getMonth() + 1, n.getDate());
};

const { RangePicker } = DatePicker;
const { useToken } = theme;

// ─── Design Tokens ────────────────────────────────────────────────────────────
const GOLD        = "#C9A84C";
const GOLD_BRIGHT = "#FFB700";
const GOLD_DARK   = "#9A7A00";
const G           = (o: number) => `rgba(201,168,76,${o})`;
const EMERALD     = "#059669";
const EMERALD_LT  = "#10B981";
const DANGER      = "#DC2626";
const WARNING     = "#D97706";
const INFO        = "#2563EB";
const PURPLE      = "#7C3AED";
const TEAL        = "#0D9488";

const STATUS_CFG: Record<string, { label: string; color: string }> = {
    HADIR:   { label: "Hadir",   color: EMERALD  },
    SAKIT:   { label: "Sakit",   color: WARNING  },
    GHAIB:   { label: "Ghaib",   color: DANGER   },
    SEKOLAH: { label: "Sekolah", color: INFO     },
    PULANG:  { label: "Pulang",  color: PURPLE   },
};
const HARI_LABEL: Record<number, { short: string }> = {
    1: { short: "Sab" }, 2: { short: "Ahd" }, 3: { short: "Sen" },
    4: { short: "Sel" }, 5: { short: "Rab" },
};
const DAYS_INDO = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
const STATUS_CODE: Record<string, string> = {
    HADIR:"H", SAKIT:"S", IZIN:"I", SEKOLAH:"Sk", GHAIB:"GH", PULANG:"P",
};
const STATUS_FILLS: Record<string, string> = {
    HADIR:"FFD1FAE5", SAKIT:"FFFEF3C7", IZIN:"FFDBEAFE",
    SEKOLAH:"FFE0E7FF", GHAIB:"FFFEE2E2", PULANG:"FFFFEDD5",
};

// ─── Motion ───────────────────────────────────────────────────────────────────
const fadeUp: Variants = {
    hidden:  { opacity:0, y:22 },
    visible: (i=0) => ({
        opacity:1, y:0,
        transition:{ duration:.52, ease:[0.22,1,0.36,1], delay:i*.07 },
    }),
};
const stagger = { visible:{ transition:{ staggerChildren:.07 } } };

// ─── Animated Counter ─────────────────────────────────────────────────────────
const AnimatedValue: React.FC<{ value:number; formatter?:(v:number)=>string }> = ({ value, formatter }) => {
    const [d,setD] = useState(0);
    const prev = useRef(0);
    useEffect(() => {
        const start=prev.current; const t0=performance.now();
        const tick=(now:number)=>{
            const p=Math.min((now-t0)/850,1); const e=1-Math.pow(1-p,3);
            setD(Math.round(start+(value-start)*e));
            if(p<1) requestAnimationFrame(tick); else prev.current=value;
        };
        requestAnimationFrame(tick);
    },[value]);
    return <>{formatter?formatter(d):d.toLocaleString("id-ID")}</>;
};

// ─── Premium Tooltip ──────────────────────────────────────────────────────────
const PremiumTooltip=({active,payload,label,token:tk}:any)=>{
    if(!active||!payload?.length) return null;
    return (
        <div style={{background:tk.colorBgElevated,border:`1px solid ${tk.colorBorderSecondary}`,
            borderRadius:14,padding:"12px 16px",minWidth:185,
            boxShadow:"0 24px 60px rgba(0,0,0,0.35)",backdropFilter:"blur(20px)"}}>
            <p style={{margin:"0 0 10px",fontWeight:700,fontSize:11,
                letterSpacing:"0.1em",textTransform:"uppercase",color:GOLD_BRIGHT}}>{label}</p>
            {payload.map((e:any,i:number)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                    <span style={{width:8,height:8,borderRadius:2,background:e.color,flexShrink:0}}/>
                    <span style={{fontSize:12,color:tk.colorTextSecondary,flex:1}}>{e.name}</span>
                    <span style={{fontWeight:700,fontSize:12,fontFamily:"'DM Mono',monospace",color:tk.colorText}}>
                        {e.value?.toLocaleString("id-ID")}
                    </span>
                </div>
            ))}
        </div>
    );
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard: React.FC<{
    label:string; value:number; icon:React.ReactNode; color:string;
    subtext?:string; formatter?:(v:number)=>string;
    isDark:boolean; token:any; delay?:number; loading?:boolean;
}> = ({label,value,icon,color,subtext,formatter,isDark,token:tk,delay=0,loading})=>(
    <motion.div variants={fadeUp} custom={delay}
        whileHover={{y:-5,transition:{duration:.18}}} style={{height:"100%",cursor:"default"}}>
        <div style={{
            borderRadius:20,padding:"22px 20px 18px",height:"100%",
            background:tk.colorBgContainer,
            border:`1px solid ${isDark?color+"22":color+"28"}`,
            position:"relative",overflow:"hidden",
            boxShadow:isDark
                ?`0 4px 28px rgba(0,0,0,0.45),inset 0 1px 0 ${color}12`
                :`0 2px 16px rgba(0,0,0,0.06),inset 0 1px 0 ${color}18`,
        }}>
            <div style={{position:"absolute",bottom:-40,right:-40,width:130,height:130,
                borderRadius:"50%",pointerEvents:"none",
                background:`radial-gradient(circle,${color}18 0%,transparent 65%)`}}/>
            <div style={{position:"absolute",top:0,left:"15%",right:"15%",height:2,
                background:`linear-gradient(90deg,transparent,${color}70,transparent)`}}/>
            <div style={{width:46,height:46,borderRadius:14,marginBottom:18,
                background:`linear-gradient(135deg,${color}20 0%,${color}38 100%)`,
                border:`1px solid ${color}30`,
                display:"flex",alignItems:"center",justifyContent:"center",
                color,fontSize:20,boxShadow:`0 4px 14px ${color}22`}}>{icon}</div>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",
                color:isDark?"rgba(255,255,255,0.38)":"rgba(0,0,0,0.38)",marginBottom:6}}>{label}</div>
            {loading ? (
                <div style={{height:36,background:isDark?"rgba(255,255,255,0.07)":"rgba(0,0,0,0.06)",
                    borderRadius:8}}/>
            ):(
                <div style={{fontFamily:"'DM Mono',monospace",fontWeight:800,
                    fontSize:formatter?20:28,letterSpacing:"-0.04em",lineHeight:1.1,color:tk.colorText}}>
                    <AnimatedValue value={value} formatter={formatter}/>
                </div>
            )}
            {subtext&&<div style={{fontSize:11,marginTop:8,color:isDark?"rgba(255,255,255,0.38)":"rgba(0,0,0,0.38)"}}>{subtext}</div>}
        </div>
    </motion.div>
);

// ─── Section Header ───────────────────────────────────────────────────────────
const SectionHeader=({icon,title,subtitle,action}:{
    icon:React.ReactNode;title:string;subtitle?:string;action?:React.ReactNode;
})=>(
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,gap:12}}>
        <div style={{display:"flex",alignItems:"center",gap:12,flex:1,minWidth:0}}>
            <div style={{width:40,height:40,borderRadius:12,flexShrink:0,
                background:`linear-gradient(135deg,${GOLD}20 0%,${GOLD_BRIGHT}15 100%)`,
                border:`1px solid ${GOLD}28`,
                display:"flex",alignItems:"center",justifyContent:"center",
                color:GOLD_BRIGHT,fontSize:17}}>{icon}</div>
            <div>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:16,letterSpacing:"-0.03em"}}>{title}</div>
                {subtitle&&<div style={{fontSize:12,color:"rgba(128,128,128,0.75)",marginTop:2}}>{subtitle}</div>}
            </div>
            <div style={{flex:1,height:1,marginLeft:10,
                background:`linear-gradient(90deg,${GOLD}28 0%,transparent 80%)`}}/>
        </div>
        {action&&<div style={{flexShrink:0}}>{action}</div>}
    </div>
);

// ─── Score Ring ───────────────────────────────────────────────────────────────
const ScoreRing:React.FC<{score:number;color:string;size?:number;label?:string}>=({
    score,color,size=80,label="HADIR"
})=>{
    const r=30; const circ=2*Math.PI*r; const clamped=Math.max(0,Math.min(100,score));
    return (
        <svg width={size} height={size} viewBox="0 0 80 80">
            <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(128,128,128,0.12)" strokeWidth="5"/>
            <motion.circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="5"
                strokeLinecap="round" strokeDasharray={circ}
                initial={{strokeDashoffset:circ}}
                animate={{strokeDashoffset:circ*(1-clamped/100)}}
                transition={{duration:1.4,ease:[0.22,1,0.36,1],delay:0.4}}
                style={{transform:"rotate(-90deg)",transformOrigin:"40px 40px"}}/>
            <text x="40" y="36" textAnchor="middle" fill={color}
                style={{fontSize:17,fontWeight:800,fontFamily:"'DM Mono',monospace"}}>{clamped}%</text>
            <text x="40" y="52" textAnchor="middle" fill="rgba(128,128,128,0.6)"
                style={{fontSize:7.5,fontFamily:"'Syne',sans-serif",fontWeight:700,letterSpacing:"0.08em"}}>{label}</text>
        </svg>
    );
};

// ─── Stat Badge ───────────────────────────────────────────────────────────────
const StatBadge:React.FC<{icon:React.ReactNode;label:string;value:string;color:string;isDark:boolean}>=({
    icon,label,value,color,isDark
})=>(
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",
        borderRadius:12,flex:1,minWidth:140,
        background:isDark?`${color}0e`:`${color}08`,border:`1px solid ${color}25`}}>
        <div style={{width:30,height:30,borderRadius:8,flexShrink:0,
            background:`${color}20`,border:`1px solid ${color}28`,
            display:"flex",alignItems:"center",justifyContent:"center",
            color,fontSize:13}}>{icon}</div>
        <div>
            <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color,marginBottom:2}}>{label}</div>
            <div style={{fontFamily:"'DM Mono',monospace",fontWeight:800,fontSize:13,color}}>{value}</div>
        </div>
    </div>
);

// ─── Pie Label ────────────────────────────────────────────────────────────────
const renderPieLabel=({cx,cy,midAngle,innerRadius,outerRadius,percent}:any)=>{
    if(percent<0.07) return null;
    const R=Math.PI/180; const r=innerRadius+(outerRadius-innerRadius)*0.55;
    return (
        <text x={cx+r*Math.cos(-midAngle*R)} y={cy+r*Math.sin(-midAngle*R)}
            fill="#fff" textAnchor="middle" dominantBaseline="central"
            style={{fontSize:10,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>
            {`${(percent*100).toFixed(0)}%`}
        </text>
    );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const hexLum=(hex:string):number=>{
    const c=hex.replace("#",""); if(c.length<6) return 200;
    return .299*parseInt(c.slice(0,2),16)+.587*parseInt(c.slice(2,4),16)+.114*parseInt(c.slice(4,6),16);
};
const colLetter=(n:number):string=>{
    let s=""; while(n>0){const m=(n-1)%26; s=String.fromCharCode(65+m)+s; n=Math.floor((n-1)/26);} return s;
};
const getWeekDates=(tahun:number,bulan:number,mingguKe:number):{tanggal:string;hariKe:number;sesiKe:number}[]=>{
    const g=hijriConverter.toGregorian(tahun,bulan,1);
    const firstOfMonth=new Date(g.gy,g.gm-1,g.gd);
    const fDow=firstOfMonth.getDay();
    const backSat=new Date(firstOfMonth); backSat.setDate(firstOfMonth.getDate()-((fDow-6+7)%7));
    let inMonth=0;
    for(let i=0;i<5;i++){const d=new Date(backSat);d.setDate(backSat.getDate()+i);const h=hijriConverter.toHijri(d.getFullYear(),d.getMonth()+1,d.getDate());if(h.hy===tahun&&h.hm===bulan)inMonth++;}
    const wStart=new Date(firstOfMonth);
    if(inMonth<=1){const dn=(6-fDow+7)%7;wStart.setDate(firstOfMonth.getDate()+dn);}
    else{wStart.setDate(firstOfMonth.getDate()-((fDow-6+7)%7));}
    const sat=new Date(wStart);sat.setDate(wStart.getDate()+(mingguKe-1)*7);
    return Array.from({length:5},(_,i)=>{const d=new Date(sat);d.setDate(sat.getDate()+i);return{tanggal:dayjs(d).format("YYYY-MM-DD"),hariKe:i+1,sesiKe:1};});
};
const fetchRekapData=async(monthStart:string,monthEnd:string)=>{
    const[absensi,hafalan,murojaah,santri]=await Promise.all([
        supabaseClient.from("tahfidz_absensi").select("santri_nis,status,setoran,created_at,tahfidz_sesi!inner(tanggal,kegiatan_id,sesi)").gte("tahfidz_sesi.tanggal",monthStart).lte("tahfidz_sesi.tanggal",monthEnd).order("created_at",{ascending:false}),
        supabaseClient.from("hafalan_tahfidz").select("santri_nis,juz,predikat,status_setoran,created_at").gte("created_at",monthStart).lte("created_at",monthEnd),
        supabaseClient.from("murojaah_tahfidz").select("santri_nis,predikat,status_setoran,created_at").gte("created_at",monthStart).lte("created_at",monthEnd),
        supabaseClient.from("santri").select("nis,nama,kelas,total_hafalan").eq("jurusan","TAHFIDZ").eq("status_santri","AKTIF"),
    ]);
    return{absensi:absensi.data||[],hafalan:hafalan.data||[],murojaah:murojaah.data||[],santri:santri.data||[],errors:[absensi.error,hafalan.error,murojaah.error,santri.error].filter(Boolean)};
};
// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT — State + Data Fetching + Export Functions
// ═══════════════════════════════════════════════════════════════════════════════
export const HafalanRekap = () => {
    const { token } = useToken();
    const isDark = hexLum(token.colorBgContainer) < 128;
    const TICK = { fontSize:10, fill:token.colorTextTertiary as string };

    const KEGIATAN_INFO: Record<string, { label:string; icon:string }> = {
        HAFALAN:    { label:"Hafalan",           icon:"📖" },
        ISTIGHOSAH: { label:"Istighosah",        icon:"🤲" },
        NGAOS_AANG: { label:"Ngaos Aang",        icon:"📚" },
        TILAWAH:    { label:"Tilawah/Kaligrafi", icon:"🕌" },
        TAWASUL:    { label:"Tawasul",           icon:"🙏" },
        MHQ:        { label:"MHQ",               icon:"🏆" },
        MUHADHOROH: { label:"Muhadhoroh",        icon:"🎤" },
    };

    // ── Core state ────────────────────────────────────────────────────────────
    const [loading,      setLoading]      = useState(true);
    const [dateRange, setDateRange]       = useState<[dayjs.Dayjs,dayjs.Dayjs]>([dayjs().startOf("month"),dayjs().endOf("month")]);
    const [rawData,  setRawData]          = useState<{absensi:any[];hafalan:any[];murojaah:any[];santri:any[]}>({absensi:[],hafalan:[],murojaah:[],santri:[]});
    const [statsViewMode, setStatsViewMode] = useState<string>("mingguan");

    // ── Mingguan stats state ──────────────────────────────────────────────────
    const [statsData, setStatsData] = useState<{
        periodLabels:{key:string;label:string}[];
        periodStats:Record<string,Record<string,number>>;
        kegiatanStats:{kegiatan:string;label:string;hadir:number;total:number}[];
        totalSesi:number;totalAbsensi:number;totalHadir:number;
    }>({periodLabels:[],periodStats:{},kegiatanStats:[],totalSesi:0,totalAbsensi:0,totalHadir:0});
    const [statsLoading, setStatsLoading] = useState(false);

    // ── Ngaji stats state ─────────────────────────────────────────────────────
    const [ngajiStatsData, setNgajiStatsData] = useState<{
        periodLabels:{key:string;label:string}[];
        periodStats:Record<string,Record<string,number>>;
        totalSantri:number;totalSesi:number;totalAbsensi:number;totalHadir:number;
    }>({periodLabels:[],periodStats:{},totalSantri:0,totalSesi:0,totalAbsensi:0,totalHadir:0});
    const [ngajiStatsLoading, setNgajiStatsLoading] = useState(false);
    const [ngajiStatsTahun, setNgajiStatsTahun] = useState<number>(getCurrentHijri().hy);
    const [ngajiStatsBulan, setNgajiStatsBulan] = useState<number>(getCurrentHijri().hm);

    // ── Export modal state ────────────────────────────────────────────────────
    const [exportLoading,      setExportLoading]      = useState(false);
    const [expMingguanOpen,    setExpMingguanOpen]    = useState(false);
    const [expMingguanLoading, setExpMingguanLoading] = useState(false);
    const [expMingguanTahun,   setExpMingguanTahun]   = useState<number>(1448);
    const [expMingguanBulan,   setExpMingguanBulan]   = useState<number>(1);
    const [expNgajiOpen,       setExpNgajiOpen]       = useState(false);
    const [expNgajiWeeks,      setExpNgajiWeeks]      = useState<number[]>([1]);
    const [expNgajiLoading,    setExpNgajiLoading]    = useState(false);
    const [expNgajiTahun,      setExpNgajiTahun]      = useState(getCurrentHijri().hy);
    const [expNgajiBulan,      setExpNgajiBulan]      = useState(getCurrentHijri().hm);
    const [expSantriOpen,      setExpSantriOpen]      = useState(false);
    const [expSantriLoading,   setExpSantriLoading]   = useState(false);
    const [expSantriNis,       setExpSantriNis]       = useState<string|null>(null);
    const [expSantriSetoran,   setExpSantriSetoran]   = useState<[dayjs.Dayjs,dayjs.Dayjs]|null>([dayjs().startOf("month"),dayjs()]);
    const [expSantriMurojaah,  setExpSantriMurojaah]  = useState<[dayjs.Dayjs,dayjs.Dayjs]|null>([dayjs().startOf("month"),dayjs()]);
    const [expSantriTahun,     setExpSantriTahun]     = useState<number>(1448);
    const [expSantriBulan,     setExpSantriBulan]     = useState<number>(1);
    const [expSantriNgajiTahun,setExpSantriNgajiTahun]= useState<number>(getCurrentHijri().hy);
    const [expSantriNgajiBulan,setExpSantriNgajiBulan]= useState<number>(getCurrentHijri().hm);
    const [santriListExport,   setSantriListExport]   = useState<any[]>([]);

    const { data: identity } = useGetIdentity<any>();
    useHijriCorrection();

    // ── Load santri for export ────────────────────────────────────────────────
    useEffect(() => {
        supabaseClient.from("santri").select("nis,nama").eq("jurusan","TAHFIDZ").eq("status_santri","AKTIF").order("nama")
            .then(({data}) => setSantriListExport(data||[]));
    }, []);

    // ── Fetch main data ───────────────────────────────────────────────────────
    const fetchData = async () => {
        setLoading(true);
        const result = await fetchRekapData(dateRange[0].format("YYYY-MM-DD"),dateRange[1].format("YYYY-MM-DD"));
        if(result.errors.length>0) message.error("Gagal memuat data");
        setRawData(result); setLoading(false);
    };
    useEffect(() => { fetchData(); }, [dateRange]);

    // ── Fetch mingguan stats ──────────────────────────────────────────────────
    const fetchMingguanStats = async () => {
        setStatsLoading(true);
        try {
            const start=dateRange[0].format("YYYY-MM-DD"); const end=dateRange[1].format("YYYY-MM-DD");
            const{data:sesiList}=await supabaseClient.from("mingguan_sesi").select("id,kegiatan_id,tanggal,bulan_hijriah,minggu_ke,tahun_hijriah").gte("tanggal",start).lte("tanggal",end).order("tanggal",{ascending:true});
            if(!sesiList?.length){setStatsData({periodLabels:[],periodStats:{},kegiatanStats:[],totalSesi:0,totalAbsensi:0,totalHadir:0});setStatsLoading(false);return;}
            const sesiIds=sesiList.map((s:any)=>s.id);
            const{data:absensiData}=await supabaseClient.from("mingguan_absensi").select("sesi_id,status").in("sesi_id",sesiIds);
            const absensiList=absensiData||[];
            const byPeriod:Record<string,{sesiIds:Set<string>;label:string}>={};
            const kegiatanTotals:Record<string,{hadir:number;total:number}>={};
            sesiList.forEach((sesi:any)=>{
                const date=dayjs(sesi.tanggal);
                const pk=statsViewMode==="mingguan"?`${date.isoWeekYear()}-W${String(date.isoWeek()).padStart(2,"0")}`:date.format("YYYY-MM");
                const pl=statsViewMode==="mingguan"?`W${date.isoWeek()}`:date.format("MMM YY");
                if(!byPeriod[pk]) byPeriod[pk]={sesiIds:new Set(),label:pl};
                byPeriod[pk].sesiIds.add(sesi.id);
                if(!kegiatanTotals[sesi.kegiatan_id]) kegiatanTotals[sesi.kegiatan_id]={hadir:0,total:0};
                kegiatanTotals[sesi.kegiatan_id].total++;
            });
            absensiList.forEach((a:any)=>{
                const sesi=sesiList.find((s:any)=>s.id===a.sesi_id);
                if(a.status==="HADIR"&&sesi&&kegiatanTotals[sesi.kegiatan_id]) kegiatanTotals[sesi.kegiatan_id].hadir++;
            });
            const periodStats:Record<string,Record<string,number>>={};
            absensiList.forEach((a:any)=>{
                const sesi=sesiList.find((s:any)=>s.id===a.sesi_id); if(!sesi) return;
                const date=dayjs(sesi.tanggal);
                const pk=statsViewMode==="mingguan"?`${date.isoWeekYear()}-W${String(date.isoWeek()).padStart(2,"0")}`:date.format("YYYY-MM");
                if(!periodStats[pk]) periodStats[pk]={HADIR:0,SAKIT:0,IZIN:0,SEKOLAH:0,GHAIB:0,PULANG:0,total:0};
                periodStats[pk][a.status]=(periodStats[pk][a.status]||0)+1; periodStats[pk].total++;
            });
            const kegiatanStats=Object.entries(KEGIATAN_INFO).map(([k,info])=>{const d=kegiatanTotals[k]||{hadir:0,total:0};return{kegiatan:k,label:info.label,hadir:d.hadir,total:d.total};}).filter(d=>d.total>0);
            setStatsData({periodLabels:Object.keys(byPeriod).sort().map(k=>({key:k,label:byPeriod[k].label})),periodStats,kegiatanStats,totalSesi:sesiList.length,totalAbsensi:absensiList.length,totalHadir:absensiList.filter((a:any)=>a.status==="HADIR").length});
        }catch{/*silent*/}finally{setStatsLoading(false);}
    };
    useEffect(()=>{fetchMingguanStats();},[dateRange,statsViewMode]);

    // ── Fetch ngaji stats ─────────────────────────────────────────────────────
    const fetchNgajiStats = async () => {
        setNgajiStatsLoading(true);
        try {
            const allWeeks=[1,2,3,4,5].map(mg=>getWeekDates(ngajiStatsTahun,ngajiStatsBulan,mg));
            const allDates=[...new Set(allWeeks.flatMap(w=>w.map(d=>d.tanggal)))].sort();
            if(!allDates.length){setNgajiStatsData({periodLabels:[],periodStats:{},totalSantri:0,totalSesi:0,totalAbsensi:0,totalHadir:0});setNgajiStatsLoading(false);return;}
            const{data:sesiList}=await supabaseClient.from("ngaji_sesi").select("id,tanggal,hari_ke,sesi_ke").eq("kegiatan_id","NGAJI").in("tanggal",allDates).order("tanggal",{ascending:true});
            if(!sesiList?.length){setNgajiStatsData({periodLabels:[],periodStats:{},totalSantri:0,totalSesi:0,totalAbsensi:0,totalHadir:0});setNgajiStatsLoading(false);return;}
            const existingDates=[...new Set(sesiList.map((s:any)=>s.tanggal))].sort();
            const orClauses=existingDates.map((t:string)=>{const h=resolveHijri(t);return`and(tahun_hijriah.eq.${h.hy},bulan_hijriah_number.eq.${h.hm},hari_hijriah.eq.${h.hd},sesi_ke.eq.1)`;});
            const{data:absensiData}=await supabaseClient.from("ngaji_absensi").select("tahun_hijriah,bulan_hijriah_number,hari_hijriah,sesi_ke,santri_nis,status").or(orClauses.join(","));
            const absensiList=absensiData||[];
            const santriSet=new Set<string>(); absensiList.forEach((a:any)=>santriSet.add(a.santri_nis));
            const byPeriod:Record<string,{dates:Set<string>;label:string}>={};
            sesiList.forEach((sesi:any)=>{const date=dayjs(sesi.tanggal);const pk=`${date.isoWeekYear()}-W${String(date.isoWeek()).padStart(2,"0")}`;if(!byPeriod[pk])byPeriod[pk]={dates:new Set(),label:`W${date.isoWeek()}`};byPeriod[pk].dates.add(sesi.tanggal);});
            const periodStats:Record<string,Record<string,number>>={};
            absensiList.forEach((a:any)=>{
                const h={hy:a.tahun_hijriah,hm:a.bulan_hijriah_number,hd:a.hari_hijriah};
                const matchingSesi=sesiList.find((s:any)=>{const sh=resolveHijri(s.tanggal);return sh.hy===h.hy&&sh.hm===h.hm&&sh.hd===h.hd;});
                if(!matchingSesi) return;
                const date=dayjs(matchingSesi.tanggal); const pk=`${date.isoWeekYear()}-W${String(date.isoWeek()).padStart(2,"0")}`;
                if(!periodStats[pk]) periodStats[pk]={HADIR:0,SAKIT:0,IZIN:0,PULANG:0,GHAIB:0,total:0};
                periodStats[pk][a.status]=(periodStats[pk][a.status]||0)+1; periodStats[pk].total++;
            });
            setNgajiStatsData({periodLabels:Object.keys(byPeriod).sort().map(k=>({key:k,label:byPeriod[k].label})),periodStats,totalSantri:santriSet.size,totalSesi:sesiList.length,totalAbsensi:absensiList.length,totalHadir:absensiList.filter((a:any)=>a.status==="HADIR").length});
        }finally{setNgajiStatsLoading(false);}
    };
    useEffect(()=>{fetchNgajiStats();},[ngajiStatsTahun,ngajiStatsBulan]);

    // ── Computed summaries ────────────────────────────────────────────────────
    const summaries = useMemo(()=>{
        const{absensi,hafalan,murojaah,santri}=rawData;
        const santriMap=new Map(santri.map((s:any)=>[s.nis,s]));
        const statusCount:Record<string,number>={};
        const dailyStatus:Record<string,Record<string,number>>={};
        let totalSetoran=0,totalHadir=0;
        absensi.forEach((a:any)=>{
            const s=a.status; statusCount[s]=(statusCount[s]||0)+1;
            if(s==="HADIR") totalHadir++;
            if(a.setoran) totalSetoran++;
            const tgl=a.tahfidz_sesi?.tanggal?.slice(0,10);
            if(tgl){if(!dailyStatus[tgl])dailyStatus[tgl]={};dailyStatus[tgl][s]=(dailyStatus[tgl][s]||0)+1;}
        });
        const perSantri:Record<string,any>={};
        absensi.forEach((a:any)=>{
            const nis=a.santri_nis;
            if(!perSantri[nis]){const s=santriMap.get(nis)||{};perSantri[nis]={nis,nama:s.nama||santriAlias(nis),kelas:s.kelas||"-",hadir:0,sakit:0,goib:0,sekolah:0,pulang:0,setoran:0,ziyadah:0,murojaah:0,lancar:0,mengulang:0};}
            if(a.status==="HADIR")perSantri[nis].hadir++;
            else if(a.status==="SAKIT")perSantri[nis].sakit++;
            else if(a.status==="GHAIB")perSantri[nis].goib++;
            else if(a.status==="SEKOLAH")perSantri[nis].sekolah++;
            else if(a.status==="PULANG")perSantri[nis].pulang++;
            if(a.setoran)perSantri[nis].setoran++;
        });
        hafalan.forEach((h:any)=>{if(perSantri[h.santri_nis]){perSantri[h.santri_nis].ziyadah++;if(h.status_setoran==="LANCAR")perSantri[h.santri_nis].lancar++;else if(h.status_setoran==="MENGULANG")perSantri[h.santri_nis].mengulang++;}});
        murojaah.forEach((m:any)=>{if(perSantri[m.santri_nis]){perSantri[m.santri_nis].murojaah++;if(m.status_setoran==="LANCAR")perSantri[m.santri_nis].lancar++;else if(m.status_setoran==="MENGULANG")perSantri[m.santri_nis].mengulang++;}});
        const sortedDays=Object.keys(dailyStatus).sort();
        const dailyChart=sortedDays.map(tgl=>({tanggal:dayjs(tgl).format("DD/MM"),...dailyStatus[tgl],total:Object.values(dailyStatus[tgl]).reduce((a:number,b:any)=>a+Number(b),0)}));
        const pieData=Object.entries(STATUS_CFG).map(([key,cfg])=>({name:cfg.label,value:statusCount[key]||0,color:cfg.color})).filter(d=>d.value>0);
        const hadirRate=absensi.length>0?Math.round((totalHadir/absensi.length)*100):0;
        const totalLancar=hafalan.filter((h:any)=>h.status_setoran==="LANCAR").length+murojaah.filter((m:any)=>m.status_setoran==="LANCAR").length;
        const totalMengulang=hafalan.filter((h:any)=>h.status_setoran==="MENGULANG").length+murojaah.filter((m:any)=>m.status_setoran==="MENGULANG").length;
        return{totalAbsensi:absensi.length,totalHadir,totalSetoran,totalZiyadah:hafalan.length,totalMurojaah:murojaah.length,santriCount:santri.length,hadirRate,totalLancar,totalMengulang,perSantri:Object.values(perSantri),dailyChart,pieData,statusCount};
    },[rawData]);

    const petaData = useMemo(()=>{
        const{santri}=rawData;
        const santriList=santri.filter((s:any)=>s.nis).sort((a:any,b:any)=>(a.nama||"").localeCompare(b.nama||""));
        const JUZ=30;
        const rows=santriList.map((s:any)=>{
            const total=Math.min(Math.max(0,parseInt(String(s.total_hafalan||""),10)||0),JUZ);
            const row:Record<string,any>={nis:s.nis,nama:s.nama||santriAlias(s.nis),total};
            for(let j=1;j<=JUZ;j++) row[j]=j<=total;
            return row;
        });
        return{juzTotal:JUZ,rows};
    },[rawData]);

    const cardBase: React.CSSProperties={
        borderRadius:20,background:token.colorBgContainer,
        border:`1px solid ${isDark?G(.16):G(.18)}`,
        boxShadow:isDark?"0 8px 40px rgba(0,0,0,0.3)":"0 4px 20px rgba(0,0,0,0.05)",
    };
    // ════════════════════════════════════════════════════════════════════════
    // EXPORT HANDLERS
    // ════════════════════════════════════════════════════════════════════════

    const handleExport = async () => {
        setExportLoading(true);
        try {
            const wb=new ExcelJS.Workbook();
            const startStr=dateRange[0].format("DD MMM YYYY"); const endStr=dateRange[1].format("DD MMM YYYY");
            const ws1=wb.addWorksheet("Rekap Global");
            ws1.mergeCells("A1:K1"); ws1.getCell("A1").value=`REKAP ABSENSI TAHFIDZ (${startStr} - ${endStr})`;
            ws1.getCell("A1").font={size:14,bold:true,color:{argb:"FFFFFFFF"}};
            ws1.getCell("A1").fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFC9A84C"}};
            ws1.getCell("A1").alignment={horizontal:"center"};
            ws1.getRow(3).values=["Tanggal","Kegiatan","Sesi","Status Terbanyak","Total","Hadir","Sakit","Ghaib","Sekolah","Pulang","Setoran"];
            ws1.getRow(3).font={bold:true};
            const byDate:Record<string,any>={};
            rawData.absensi.forEach((a:any)=>{const tgl=a.tahfidz_sesi?.tanggal?.slice(0,10);if(!tgl)return;if(!byDate[tgl])byDate[tgl]={total:0,hadir:0,sakit:0,goib:0,sekolah:0,pulang:0,setoran:0};byDate[tgl].total++;byDate[tgl][a.status.toLowerCase()]=(byDate[tgl][a.status.toLowerCase()]||0)+1;if(a.setoran)byDate[tgl].setoran++;});
            Object.entries(byDate).sort(([a],[b])=>a.localeCompare(b)).forEach(([tgl,d])=>{ws1.addRow([tgl,"ZIYADAH/MUROJAAH","PAGI/SIANG","-",(d as any).total,(d as any).hadir||0,(d as any).sakit||0,(d as any).goib||0,(d as any).sekolah||0,(d as any).pulang||0,(d as any).setoran||0]);});
            const ws2=wb.addWorksheet("Per Santri");
            ws2.mergeCells("A1:M1"); ws2.getCell("A1").value=`REKAP PER SANTRI (${startStr} - ${endStr})`;
            ws2.getCell("A1").font={size:14,bold:true,color:{argb:"FFFFFFFF"}};
            ws2.getCell("A1").fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF7C3AED"}};
            ws2.getCell("A1").alignment={horizontal:"center"};
            ws2.getRow(3).values=["NIS","Nama","Kelas","Hadir","Sakit","Ghaib","Sekolah","Pulang","Setoran","Ziyadah","Murojaah","Lancar","Mengulang"];
            ws2.getRow(3).font={bold:true};
            summaries.perSantri.forEach((s:any)=>ws2.addRow([s.nis,s.nama,s.kelas,s.hadir,s.sakit,s.goib,s.sekolah,s.pulang,s.setoran,s.ziyadah,s.murojaah,s.lancar,s.mengulang]));
            ws2.columns=[{width:15},{width:25},{width:10},{width:8},{width:8},{width:8},{width:10},{width:10},{width:10},{width:10},{width:10},{width:10},{width:12}];
            const buffer=await wb.xlsx.writeBuffer();
            saveAs(new Blob([buffer]),`Rekap_Tahfidz_${dateRange[0].format("YYYYMM")}.xlsx`);
            message.success("Rekap global berhasil diunduh");
        }catch(err:any){message.error("Gagal export: "+err.message);}
        finally{setExportLoading(false);}
    };

    const handleExportMingguan = async () => {
        setExpMingguanLoading(true);
        try {
            const bulanLabel=HIJRI_MONTHS[expMingguanBulan-1];
            const{data:santri,error:santriErr}=await supabaseClient.from("santri").select("nis,nama,kelas,total_hafalan").eq("jurusan","TAHFIDZ").eq("status_santri","AKTIF").order("kelas",{ascending:true}).order("nama",{ascending:true});
            if(santriErr){message.error("Gagal load santri: "+santriErr.message);setExpMingguanLoading(false);return;}
            const santriList=santri||[];
            const{data:joinData,error}=await supabaseClient.from("mingguan_absensi").select("sesi_id,santri_nis,status,nilai_hafalan,mingguan_sesi!inner(kegiatan_id,minggu_ke)").eq("mingguan_sesi.bulan_hijriah",bulanLabel).eq("mingguan_sesi.tahun_hijriah",expMingguanTahun);
            if(error){message.error("Gagal mengambil data: "+error.message);setExpMingguanLoading(false);return;}
            const absByKey:Record<string,Record<string,Record<string,any>>>={};
            (joinData||[]).forEach((a:any)=>{const si=a.mingguan_sesi;const wk=si?.minggu_ke;const kid=si?.kegiatan_id;if(!wk||!kid||wk>4)return;if(!absByKey[wk])absByKey[wk]={};if(!absByKey[wk][kid])absByKey[wk][kid]={};absByKey[wk][kid][a.santri_nis]={status:a.status,nilai_hafalan:a.nilai_hafalan};});
            const KEGIATAN_MINGGUAN:Record<number,string[]>={1:["ISTIGHOSAH","NGAOS_AANG","TILAWAH","TAWASUL"],2:["NGAOS_AANG","TILAWAH","TAWASUL","MUHADHOROH"],3:["NGAOS_AANG","TILAWAH","TAWASUL","MHQ"],4:["NGAOS_AANG","TILAWAH","TAWASUL","MHQ"]};
            const orderedCols:{kegiatan_id:string;minggu_ke:number}[]=[];
            for(let wk=1;wk<=4;wk++){(KEGIATAN_MINGGUAN[wk]||[]).forEach(kid=>orderedCols.push({kegiatan_id:kid,minggu_ke:wk}));}
            const totalCols=4+orderedCols.length;
            const wb2=new ExcelJS.Workbook(); const ws=wb2.addWorksheet("Absensi Mingguan"); ws.views=[{showGridLines:false}];
            ws.mergeCells(`A1:${colLetter(totalCols)}1`);
            ws.getCell("A1").value=`ABSENSI KEGIATAN MINGGUAN TAHFIDZ — ${bulanLabel} ${expMingguanTahun} H`;
            ws.getCell("A1").font={size:14,bold:true,color:{argb:"FFFFFFFF"}};
            ws.getCell("A1").fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFC9A84C"}};
            ws.getCell("A1").alignment={horizontal:"center"}; ws.getRow(1).height=24;
            const hVals:any[]=["","","",""];
            let prevWk=0;
            orderedCols.forEach(o=>{if(o.minggu_ke!==prevWk){hVals.push(`MINGGU ${o.minggu_ke}`);prevWk=o.minggu_ke;}else hVals.push(null);});
            ws.getRow(2).values=hVals;
            let cCursor=5; let wkStart=5; let curWk=orderedCols[0]?.minggu_ke;
            orderedCols.forEach((o,idx)=>{if(o.minggu_ke!==curWk){ws.mergeCells(2,wkStart,2,cCursor-1);wkStart=cCursor;curWk=o.minggu_ke;}if(idx===orderedCols.length-1)ws.mergeCells(2,wkStart,2,cCursor);cCursor++;});
            ws.getRow(2).height=18;
            ws.getRow(2).eachCell(c=>{c.font={bold:true,color:{argb:"FFFFFFFF"}};c.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF9A7A00"}};c.alignment={horizontal:"center",vertical:"middle"};});
            ws.getRow(3).values=["No","NIS","Nama","Kelas",...orderedCols.map(o=>KEGIATAN_INFO[o.kegiatan_id]?.icon+" "+(KEGIATAN_INFO[o.kegiatan_id]?.label?.substring(0,8)||o.kegiatan_id))];
            ws.getRow(3).font={bold:true,size:9}; ws.getRow(3).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFF3F4F6"}};
            ws.getRow(3).height=28; ws.getRow(3).alignment={horizontal:"center",wrapText:true};
            ws.columns=[{width:5},{width:14},{width:26},{width:8},...orderedCols.map(()=>({width:10}))];
            santriList.forEach((s:any,idx:number)=>{
                const row:Record<string,any>={no:idx+1,nis:s.nis,nama:s.nama,kelas:s.kelas};
                orderedCols.forEach((o,oi)=>{const abs=absByKey[o.minggu_ke]?.[o.kegiatan_id]?.[s.nis];row[`col_${oi}`]=STATUS_CODE[abs?.status]||abs?.status||"-";});
                ws.addRow(row);
                const dataRow=ws.getRow(ws.rowCount);
                orderedCols.forEach((o,oi)=>{const abs=absByKey[o.minggu_ke]?.[o.kegiatan_id]?.[s.nis];if(abs?.status){const fill=STATUS_FILLS[abs.status];if(fill)dataRow.getCell(5+oi).fill={type:"pattern",pattern:"solid",fgColor:{argb:fill}};}});
            });
            ws.autoFilter={from:"A3",to:`${colLetter(totalCols)}3`}; ws.views=[{state:"frozen",ySplit:3}];
            const buf=await wb2.xlsx.writeBuffer();
            saveAs(new Blob([buf]),`Absensi_Mingguan_${bulanLabel}_${expMingguanTahun}H.xlsx`);
            message.success("Export mingguan berhasil"); setExpMingguanOpen(false);
        }catch(err:any){message.error("Gagal export: "+err.message);}
        finally{setExpMingguanLoading(false);}
    };

    const handleExportNgaji = async () => {
        if(expNgajiLoading) return;
        setExpNgajiLoading(true); setExpNgajiOpen(false);
        try {
            const bulanLabel=HIJRI_MONTHS[expNgajiBulan-1];
            const{data:santri}=await supabaseClient.from("santri").select("nis,nama,kelas,total_hafalan").eq("jurusan","TAHFIDZ").eq("status_santri","AKTIF").order("kelas",{ascending:true}).order("nama",{ascending:true});
            const santriListData=santri||[];
            const weeksData=expNgajiWeeks.map(mg=>({mingguKe:mg,dates:getWeekDates(expNgajiTahun,expNgajiBulan,mg)}));
            const allTanggals=[...new Set(weeksData.flatMap(w=>w.dates.map(d=>d.tanggal)))].sort();
            const tglMulai=allTanggals[0]; const tglAkhir=allTanggals[allTanggals.length-1];
            const{data:existingSesi}=await supabaseClient.from("ngaji_sesi").select("id,hari_ke,sesi_ke,tanggal").eq("kegiatan_id","NGAJI").gte("tanggal",tglMulai).lte("tanggal",tglAkhir);
            const existingSesiSet=new Set((existingSesi||[]).map((s:any)=>`${s.tanggal}_${s.hari_ke}_${s.sesi_ke}`));
            const toCreate:any[]=[];
            for(const week of weeksData){for(const wd of week.dates){const key=`${wd.tanggal}_${wd.hariKe}_${wd.sesiKe}`;if(!existingSesiSet.has(key))toCreate.push({kegiatan_id:"NGAJI",bulan_hijriah:bulanLabel,tahun_hijriah:expNgajiTahun,bulan_hijriah_number:expNgajiBulan,minggu_ke:week.mingguKe,tanggal:wd.tanggal,hari_ke:wd.hariKe,sesi_ke:wd.sesiKe,created_by:identity?.id});}}
            if(toCreate.length>0) await supabaseClient.from("ngaji_sesi").upsert(toCreate,{onConflict:"kegiatan_id,bulan_hijriah,tahun_hijriah,minggu_ke,hari_ke,sesi_ke"});
            const exportAbsensiGrid:Record<string,Record<string,{status:string|null}>>={};
            if(allTanggals.length>0){
                const orClauses=allTanggals.map(t=>{const h=resolveHijri(t);return`and(tahun_hijriah.eq.${h.hy},bulan_hijriah_number.eq.${h.hm},hari_hijriah.eq.${h.hd},sesi_ke.eq.1)`;});
                const{data:absData}=await supabaseClient.from("ngaji_absensi").select("tahun_hijriah,bulan_hijriah_number,hari_hijriah,sesi_ke,santri_nis,status").or(orClauses.join(","));
                (absData||[]).forEach((a:any)=>{if(!exportAbsensiGrid[a.santri_nis])exportAbsensiGrid[a.santri_nis]={};exportAbsensiGrid[a.santri_nis][`${a.tahun_hijriah}_${a.bulan_hijriah_number}_${a.hari_hijriah}_${a.sesi_ke}`]={status:a.status};});
            }
            const SC_NG:Record<string,string>={HADIR:"H",SAKIT:"S",IZIN:"I",PULANG:"P",GHAIB:"GH"};
            const SF_NG:Record<string,string>={HADIR:"FFD1FAE5",SAKIT:"FFFEF3C7",IZIN:"FFDBEAFE",GHAIB:"FFFEE2E2",PULANG:"FFFFEDD5"};
            const totalCols=3+allTanggals.length+5;
            const wbN=new ExcelJS.Workbook(); const wsN=wbN.addWorksheet("Absensi Ngaji"); wsN.views=[{showGridLines:false}];
            wsN.mergeCells(`A1:${colLetter(totalCols)}1`);
            wsN.getCell("A1").value=`ABSENSI NGAJI TAHFIDZ — ${bulanLabel} ${expNgajiTahun} H — MINGGU ${expNgajiWeeks.join(", ")}`;
            wsN.getCell("A1").font={size:13,bold:true,color:{argb:"FFFFFFFF"}};
            wsN.getCell("A1").fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF047857"}};
            wsN.getCell("A1").alignment={horizontal:"center"}; wsN.getRow(1).height=24;
            const headerRow:string[]=["NIS","Nama","Kelas"];
            allTanggals.forEach(t=>headerRow.push(`${HARI_LABEL[new Date(t+"T00:00:00").getDay()===6?1:new Date(t+"T00:00:00").getDay()]?.short||"?"}\n${dayjs(t).format("DD/MM")}`));
            headerRow.push("H","S","I","P","GH");
            wsN.getRow(2).values=headerRow; wsN.getRow(2).font={bold:true,size:9};
            wsN.getRow(2).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFF3F4F6"}};
            wsN.getRow(2).alignment={horizontal:"center",vertical:"middle",wrapText:true}; wsN.getRow(2).height=28;
            santriListData.forEach((s:any)=>{
                const row:any[]=[s.nis,s.nama,s.kelas];
                let cH=0,cS=0,cI=0,cP=0,cG=0;
                allTanggals.forEach(t=>{const h2=resolveHijri(t);const key=`${h2.hy}_${h2.hm}_${h2.hd}_1`;const status=exportAbsensiGrid[s.nis]?.[key]?.status||null;row.push(SC_NG[status||""]||status||"-");if(status==="HADIR")cH++;else if(status==="SAKIT")cS++;else if(status==="IZIN")cI++;else if(status==="PULANG")cP++;else if(status==="GHAIB")cG++;});
                row.push(cH||"",cS||"",cI||"",cP||"",cG||"");
                wsN.addRow(row);
                const dataRow=wsN.getRow(wsN.rowCount);
                allTanggals.forEach((t,ci)=>{const h3=resolveHijri(t);const key=`${h3.hy}_${h3.hm}_${h3.hd}_1`;const status=exportAbsensiGrid[s.nis]?.[key]?.status;if(status){const fill=SF_NG[status];if(fill)dataRow.getCell(4+ci).fill={type:"pattern",pattern:"solid",fgColor:{argb:fill}};}});
            });
            wsN.columns=[{width:14},{width:26},{width:8},...allTanggals.map(()=>({width:7})),...[7,7,7,7,7].map(w=>({width:w}))];
            wsN.autoFilter={from:"A2",to:`${colLetter(totalCols)}2`}; wsN.views=[{state:"frozen",ySplit:2,xSplit:3}];
            const bufN=await wbN.xlsx.writeBuffer();
            saveAs(new Blob([bufN]),`Absensi_Ngaji_${bulanLabel}_${expNgajiTahun}H_Minggu${expNgajiWeeks.join("")}.xlsx`);
            message.success("Export Ngaji berhasil");
        }catch(err:any){message.error("Gagal export Ngaji: "+err.message);}
        finally{setExpNgajiLoading(false);}
    };

    const handleExportSantri = async () => {
        if(!expSantriNis){message.error("Pilih santri terlebih dahulu");return;}
        setExpSantriLoading(true);
        try {
            const sRow=santriListExport.find(s=>s.nis===expSantriNis)||{nama:santriAlias(expSantriNis!),kelas:"-"};
            const namaSantri=(sRow as any).nama||santriAlias(expSantriNis!);
            const wb=new ExcelJS.Workbook();
            const applyHdr=(cell:any,fillColor:string)=>{cell.font={bold:true,color:{argb:"FFFFFFFF"}};cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:fillColor}};cell.alignment={horizontal:"center",vertical:"middle"};};
            const SF_ZY:Record<string,string>={HADIR:"FFD1FAE5",SAKIT:"FFFEF3C7",GHAIB:"FFFEE2E2",SEKOLAH:"FFDBEAFE",PULANG:"FFFFEDD5"};
            // Sheet 1 — Ziyadah
            const ws1=wb.addWorksheet("Setoran Hafalan");
            const setoranStart=expSantriSetoran?.[0].format("YYYY-MM-DD")||""; const setoranEnd=expSantriSetoran?.[1].format("YYYY-MM-DD")||"";
            const[absensiRes,profileRes]=await Promise.all([supabaseClient.from("tahfidz_absensi").select(`id,santri_nis,status,setoran,penyimak_id,tahfidz_sesi!inner(tanggal,sesi),hafalan_tahfidz(surat,ayat_awal,ayat_akhir,juz,predikat,status_setoran)`).gte("tahfidz_sesi.tanggal",setoranStart).lte("tahfidz_sesi.tanggal",setoranEnd).eq("tahfidz_sesi.kegiatan_id","ZIYADAH").eq("santri_nis",expSantriNis),supabaseClient.from("profiles").select("id,full_name")]);
            const absensiList=absensiRes.data||[]; const penyimakMap=new Map((profileRes.data||[]).map((p:any)=>[p.id,p.full_name]));
            const lookup=new Map<string,any>(); const allDates1=new Set<string>();
            for(const a of absensiList){const sd=a.tahfidz_sesi as any;const tgl=sd.tanggal;const sesi=sd.sesi;const key=`${tgl}::${sesi}::${expSantriNis}`;allDates1.add(tgl);const h=a.hafalan_tahfidz;const hasS=!!(a.setoran&&h);const materi=h?[((h as any).juz?`Juz ${(h as any).juz}`:""),((h as any).surat?`${(h as any).surat}${(h as any).ayat_awal?` (${(h as any).ayat_awal}-${(h as any).ayat_akhir})`:""}`:"")].filter(Boolean).join(" · "):"";lookup.set(key,{status:a.status,setoranLabel:a.status==="HADIR"?(hasS?"SETOR":"TIDAK SETOR"):"-",materi,penyimak:a.penyimak_id?(penyimakMap.get(a.penyimak_id)||""):"",predikat:(h as any)?.predikat||"-"});}
            const dates=[...allDates1].sort(); const totalCols1=16;
            ws1.mergeCells(`A1:${colLetter(totalCols1)}1`);
            ws1.getCell("A1").value=`LAPORAN SETORAN ZIYADAH — ${namaSantri} — ${expSantriSetoran![0].format("DD MMM")} s/d ${expSantriSetoran![1].format("DD MMM YYYY")} M  /  ${formatHijri(expSantriSetoran![0].toDate())} s/d ${formatHijri(expSantriSetoran![1].toDate())} H`;
            ws1.getCell("A1").font={size:13,bold:true,color:{argb:"FFFFFFFF"}};ws1.getCell("A1").fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF047857"}};ws1.getCell("A1").alignment={horizontal:"center"};ws1.getRow(1).height=22;
            ws1.mergeCells("A3:F3");ws1.getCell("A3").value="DATA SANTRI";applyHdr(ws1.getCell("A3"),"FF374151");
            ws1.mergeCells("G3:K3");ws1.getCell("G3").value="SESI PAGI";applyHdr(ws1.getCell("G3"),"FFD97706");
            ws1.mergeCells("L3:P3");ws1.getCell("L3").value="SESI SIANG";applyHdr(ws1.getCell("L3"),"FF2563EB");
            ws1.getRow(4).values=["NO","Hari, Tgl (M)","Tanggal (H)","NIS","Nama Santri","Kelas","Status","Setoran","Materi","Predikat","Penyimak","Status","Setoran","Materi","Predikat","Penyimak"];
            ws1.getRow(4).font={bold:true};ws1.getRow(4).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFF3F4F6"}};
            ws1.columns=[{key:"no",width:5},{key:"tglM",width:22},{key:"tglH",width:18},{key:"nis",width:13},{key:"nama",width:24},{key:"kelas",width:8},{key:"pagi_status",width:11},{key:"pagi_setoran",width:11},{key:"pagi_materi",width:26},{key:"pagi_predikat",width:13},{key:"pagi_penyimak",width:16},{key:"siang_status",width:11},{key:"siang_setoran",width:11},{key:"siang_materi",width:26},{key:"siang_predikat",width:13},{key:"siang_penyimak",width:16}];
            dates.forEach((tgl,idx)=>{const pagi=lookup.get(`${tgl}::PAGI::${expSantriNis}`);const siang=lookup.get(`${tgl}::SIANG::${expSantriNis}`);ws1.addRow({no:idx+1,tglM:`${DAYS_INDO[new Date(tgl).getDay()]}, ${formatMasehi(tgl)}`,tglH:formatHijri(new Date(tgl+"T00:00:00")),nis:expSantriNis,nama:namaSantri,kelas:(sRow as any).kelas||"-",pagi_status:pagi?.status||"-",pagi_setoran:pagi?.setoranLabel||"-",pagi_materi:pagi?.materi||"-",pagi_predikat:pagi?.predikat||"-",pagi_penyimak:pagi?.penyimak||"-",siang_status:siang?.status||"-",siang_setoran:siang?.setoranLabel||"-",siang_materi:siang?.materi||"-",siang_predikat:siang?.predikat||"-",siang_penyimak:siang?.penyimak||"-"});const row=ws1.getRow(ws1.rowCount);if(pagi?.status){const f=SF_ZY[pagi.status];if(f)row.getCell(7).fill={type:"pattern",pattern:"solid",fgColor:{argb:f}};}if(siang?.status){const f=SF_ZY[siang.status];if(f)row.getCell(12).fill={type:"pattern",pattern:"solid",fgColor:{argb:f}};}});
            ws1.autoFilter={from:"A4",to:`${colLetter(totalCols1)}4`};ws1.views=[{state:"frozen",ySplit:4}];
            // Sheet 2 — Murojaah
            const ws2=wb.addWorksheet("Murojaah");
            const muroStart=expSantriMurojaah?.[0].format("YYYY-MM-DD")||""; const muroEnd=expSantriMurojaah?.[1].format("YYYY-MM-DD")||"";
            const[sesiRes2,detailRes2,profRes2]=await Promise.all([supabaseClient.from("tahfidz_sesi").select("id,tanggal,sesi,tahfidz_absensi!inner(santri_nis,status,penyimak_id,penyimak:profiles!penyimak_id(full_name))").eq("kegiatan_id","MUROJAAH").gte("tanggal",muroStart).lte("tanggal",muroEnd).eq("tahfidz_absensi.santri_nis",expSantriNis),supabaseClient.from("murojaah_tahfidz").select("santri_nis,tanggal,jenis_murojaah,juz,surat,ayat_awal,ayat_akhir,halaman_awal,halaman_akhir,status_setoran,predikat").eq("santri_nis",expSantriNis).gte("tanggal",muroStart).lte("tanggal",muroEnd),supabaseClient.from("profiles").select("id,full_name")]);
            const profMap2=new Map((profRes2.data||[]).map((p:any)=>[p.id,p.full_name]));
            const fmtCakupan=(d:any):string=>{if(!d)return"-";if(d.surat){const a=d.ayat_awal&&d.ayat_akhir?` : ${d.ayat_awal}-${d.ayat_akhir}`:"";return`QS. ${d.surat}${a}`;}if(d.halaman_awal){const k=d.halaman_akhir?`-${d.halaman_akhir}`:"";return`Juz ${d.juz??"-"} Hal. ${d.halaman_awal}${k}`;}if(d.juz)return`Juz ${d.juz}`;return"-";};
            const detailMap2:Record<string,any>={};(detailRes2.data||[]).forEach((d:any)=>{detailMap2[`${d.santri_nis}_${dayjs(d.tanggal).format("YYYY-MM-DD")}`]=d;});
            const lookup2=new Map<string,any>(); const allDates2=new Set<string>();
            (sesiRes2.data||[]).forEach((sesi:any)=>{const tgl=dayjs(sesi.tanggal).format("YYYY-MM-DD");allDates2.add(tgl);(sesi.tahfidz_absensi||[]).forEach((a:any)=>{const key=`${tgl}::${sesi.sesi}::${expSantriNis}`;const detail=detailMap2[`${expSantriNis}_${tgl}`];lookup2.set(key,{status:a.status||"-",jenis:detail?.jenis_murojaah||"-",cakupan:fmtCakupan(detail),penyimak:a.penyimak?.full_name||profMap2.get(a.penyimak_id)||"-"});});});
            const dates2=[...allDates2].sort(); const tc2=14;
            ws2.mergeCells(`A1:${colLetter(tc2)}1`);ws2.getCell("A1").value=`LAPORAN MUROJAAH — ${namaSantri} — ${expSantriMurojaah![0].format("DD MMM")} s/d ${expSantriMurojaah![1].format("DD MMM YYYY")} M`;ws2.getCell("A1").font={size:13,bold:true,color:{argb:"FFFFFFFF"}};ws2.getCell("A1").fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF7E22CE"}};ws2.getCell("A1").alignment={horizontal:"center"};ws2.getRow(1).height=22;
            ws2.mergeCells("A3:F3");ws2.getCell("A3").value="DATA SANTRI";applyHdr(ws2.getCell("A3"),"FF374151");ws2.mergeCells("G3:J3");ws2.getCell("G3").value="SESI PAGI";applyHdr(ws2.getCell("G3"),"FFD97706");ws2.mergeCells("K3:N3");ws2.getCell("K3").value="SESI SIANG";applyHdr(ws2.getCell("K3"),"FF2563EB");
            ws2.getRow(4).values=["NO","Hari, Tgl (M)","Tanggal (H)","NIS","Nama Santri","Kelas","Status","Jenis","Cakupan","Penyimak","Status","Jenis","Cakupan","Penyimak"];ws2.getRow(4).font={bold:true};ws2.getRow(4).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFF3F4F6"}};
            ws2.columns=[{key:"no",width:5},{key:"tglM",width:22},{key:"tglH",width:18},{key:"nis",width:13},{key:"nama",width:24},{key:"kelas",width:8},{key:"pagi_status",width:11},{key:"pagi_jenis",width:11},{key:"pagi_cakupan",width:26},{key:"pagi_penyimak",width:16},{key:"siang_status",width:11},{key:"siang_jenis",width:11},{key:"siang_cakupan",width:26},{key:"siang_penyimak",width:16}];
            dates2.forEach((tgl,idx)=>{const p2=lookup2.get(`${tgl}::PAGI::${expSantriNis}`);const s2=lookup2.get(`${tgl}::SIANG::${expSantriNis}`);ws2.addRow({no:idx+1,tglM:`${DAYS_INDO[new Date(tgl).getDay()]}, ${formatMasehi(tgl)}`,tglH:formatHijri(new Date(tgl+"T00:00:00")),nis:expSantriNis,nama:namaSantri,kelas:(sRow as any).kelas||"-",pagi_status:p2?.status||"-",pagi_jenis:p2?.jenis||"-",pagi_cakupan:p2?.cakupan||"-",pagi_penyimak:p2?.penyimak||"-",siang_status:s2?.status||"-",siang_jenis:s2?.jenis||"-",siang_cakupan:s2?.cakupan||"-",siang_penyimak:s2?.penyimak||"-"});const row2=ws2.getRow(ws2.rowCount);if(p2?.status){const f=SF_ZY[p2.status];if(f)row2.getCell(7).fill={type:"pattern",pattern:"solid",fgColor:{argb:f}};}if(s2?.status){const f=SF_ZY[s2.status];if(f)row2.getCell(11).fill={type:"pattern",pattern:"solid",fgColor:{argb:f}};}});
            ws2.autoFilter={from:"A4",to:`${colLetter(tc2)}4`};ws2.views=[{state:"frozen",ySplit:4}];
            // Sheet 3 — Mingguan
            const ws3=wb.addWorksheet("Absensi Mingguan");
            ws3.mergeCells("A1:C1");ws3.getCell("A1").value=`ABSENSI MINGGUAN — ${namaSantri} — ${HIJRI_MONTHS[expSantriBulan-1]} ${expSantriTahun} H`;ws3.getCell("A1").font={size:13,bold:true,color:{argb:"FFFFFFFF"}};ws3.getCell("A1").fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFC9A84C"}};ws3.getCell("A1").alignment={horizontal:"center"};ws3.getRow(1).height=22;
            ws3.getRow(3).values=["No","Kegiatan","Status"];ws3.getRow(3).font={bold:true};ws3.getRow(3).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFF3F4F6"}};
            const{data:mingAbsensi}=await supabaseClient.from("mingguan_absensi").select("santri_nis,status,nilai_hafalan,mingguan_sesi!inner(kegiatan_id,minggu_ke,bulan_hijriah,tahun_hijriah)").eq("santri_nis",expSantriNis).eq("mingguan_sesi.bulan_hijriah",HIJRI_MONTHS[expSantriBulan-1]).eq("mingguan_sesi.tahun_hijriah",expSantriTahun);
            let ri3=0;(mingAbsensi||[]).forEach((a:any)=>{const si=a.mingguan_sesi;ws3.addRow([++ri3,`${KEGIATAN_INFO[si?.kegiatan_id]?.icon||""} ${KEGIATAN_INFO[si?.kegiatan_id]?.label||si?.kegiatan_id} (Minggu ${si?.minggu_ke})`,a.status||"-"]);const r3=ws3.getRow(ws3.rowCount);if(a.status){const fill=STATUS_FILLS[a.status];if(fill)r3.getCell(3).fill={type:"pattern",pattern:"solid",fgColor:{argb:fill}};}});
            ws3.columns=[{width:5},{width:36},{width:14}];
            // Sheet 4 — Ngaji
            const ws4=wb.addWorksheet("Absensi Ngaji");
            const allWeeksEx=[1,2,3,4,5].map(mg=>getWeekDates(expSantriNgajiTahun,expSantriNgajiBulan,mg));
            const allDatesNg=[...new Set(allWeeksEx.flatMap(w=>w.map(d=>d.tanggal)))].sort();
            const ngajiMap:Record<string,string>={};
            if(allDatesNg.length>0){const orNg=allDatesNg.map(t=>{const h=resolveHijri(t);return`and(tahun_hijriah.eq.${h.hy},bulan_hijriah_number.eq.${h.hm},hari_hijriah.eq.${h.hd},sesi_ke.eq.1)`;});const{data:absNg}=await supabaseClient.from("ngaji_absensi").select("tahun_hijriah,bulan_hijriah_number,hari_hijriah,sesi_ke,santri_nis,status").or(orNg.join(",")).eq("santri_nis",expSantriNis);(absNg||[]).forEach((a:any)=>{ngajiMap[`${a.tahun_hijriah}_${a.bulan_hijriah_number}_${a.hari_hijriah}_${a.sesi_ke}`]=a.status;});}
            const ngajiRows=allDatesNg.map(t=>{const h=resolveHijri(t);return{tanggal:t,h,status:ngajiMap[`${h.hy}_${h.hm}_${h.hd}_1`]||""};}).filter(r=>r.status);
            ws4.mergeCells("A1:E1");ws4.getCell("A1").value=`ABSENSI NGAJI — ${namaSantri} — ${HIJRI_MONTHS[expSantriNgajiBulan-1]} ${expSantriNgajiTahun} H`;ws4.getCell("A1").font={size:13,bold:true,color:{argb:"FFFFFFFF"}};ws4.getCell("A1").fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF16A34A"}};ws4.getCell("A1").alignment={horizontal:"center"};ws4.getRow(1).height=22;
            ws4.getRow(3).values=["No","Tanggal","Tanggal H","Hari","Status"];ws4.getRow(3).font={bold:true};ws4.getRow(3).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFF3F4F6"}};
            let cH4=0,cS4=0,cI4=0,cP4=0,cG4=0;
            ngajiRows.forEach((r,i)=>{if(r.status==="HADIR")cH4++;else if(r.status==="SAKIT")cS4++;else if(r.status==="IZIN")cI4++;else if(r.status==="PULANG")cP4++;else if(r.status==="GHAIB")cG4++;const rw4=ws4.addRow([i+1,dayjs(r.tanggal).format("DD MMM YYYY"),`${r.h.hm}/${r.h.hd}/${r.h.hy} H`,DAYS_INDO[new Date(r.tanggal+"T00:00:00").getDay()],STATUS_CODE[r.status]||r.status]);const fill4=STATUS_FILLS[r.status];if(fill4)rw4.getCell(5).fill={type:"pattern",pattern:"solid",fgColor:{argb:fill4}};});
            ws4.addRow([]);
            ws4.addRow(["","","TOTAL","",""]);
            [["Hadir",cH4],["Sakit",cS4],["Izin",cI4],["Pulang",cP4],["Ghaib",cG4]].forEach(([lbl,cnt])=>{
                ws4.addRow(["","",lbl,cnt||"",""]);
            });
            ws4.columns=[{width:5},{width:20},{width:20},{width:12},{width:10}];
            const buffer=await wb.xlsx.writeBuffer();
            saveAs(new Blob([buffer]),`Rekap_Santri_${expSantriNis}_${dayjs().format("YYYYMMDD")}.xlsx`);
            message.success("Export santri berhasil"); setExpSantriOpen(false);
        }catch(err:any){message.error("Gagal export santri: "+err.message);}
        finally{setExpSantriLoading(false);}
    };
    // ════════════════════════════════════════════════════════════════════════
    // RENDER
    // ════════════════════════════════════════════════════════════════════════
    const hadirRate = summaries.hadirRate;
    const ziyadahLancarRate = (summaries.totalZiyadah+summaries.totalMurojaah)>0
        ? Math.round((summaries.totalLancar/(summaries.totalZiyadah+summaries.totalMurojaah))*100) : 0;

    return (
        <motion.div initial="hidden" animate="visible" variants={stagger}
            style={{paddingBottom:80,display:"flex",flexDirection:"column",gap:28}}>

            {/* ── HERO HEADER ─────────────────────────────────────────────── */}
            <motion.div variants={fadeUp} style={{
                borderRadius:24,overflow:"hidden",position:"relative",
                background:isDark
                    ?`linear-gradient(135deg,#0a1a0a 0%,#0d1f12 30%,#1a1200 70%,#0a1a0a 100%)`
                    :`linear-gradient(135deg,#f0fff4 0%,#fefce8 50%,#fff7ed 100%)`,
                border:`1px solid ${G(isDark?.22:.28)}`,
                boxShadow:isDark?`0 20px 60px rgba(0,0,0,0.5),inset 0 1px 0 ${G(.15)}`:`0 8px 40px ${G(.15)}`,
                padding:"32px 36px",
            }}>
                <div style={{position:"absolute",top:-80,right:-80,width:320,height:320,borderRadius:"50%",opacity:.06,pointerEvents:"none",background:`radial-gradient(circle,${GOLD_BRIGHT} 0%,transparent 70%)`}}/>
                <div style={{position:"absolute",bottom:-60,left:-60,width:240,height:240,borderRadius:"50%",opacity:.05,pointerEvents:"none",background:`radial-gradient(circle,${EMERALD} 0%,transparent 70%)`}}/>

                <div style={{display:"flex",flexWrap:"wrap",justifyContent:"space-between",alignItems:"flex-end",gap:20,position:"relative",zIndex:1}}>
                    <div>
                        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                            <div style={{width:56,height:56,borderRadius:18,flexShrink:0,
                                background:`linear-gradient(135deg,${GOLD} 0%,${GOLD_DARK} 100%)`,
                                display:"flex",alignItems:"center",justifyContent:"center",
                                fontSize:26,boxShadow:`0 8px 24px ${G(.45)}`}}>📖</div>
                            <div>
                                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                                    <span style={{padding:"2px 12px",borderRadius:99,fontSize:9.5,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",background:`linear-gradient(135deg,${GOLD} 0%,${GOLD_DARK} 100%)`,color:"#fff",boxShadow:`0 2px 8px ${G(.3)}`}}>Tahfidz Al-Qur'an</span>
                                    <motion.span animate={{opacity:[1,.3,1],scale:[1,.85,1]}} transition={{duration:2.4,repeat:Infinity}} style={{width:7,height:7,borderRadius:"50%",display:"inline-block",background:EMERALD,boxShadow:`0 0 8px ${EMERALD}`}}/>
                                    <span style={{fontSize:11,fontWeight:600,color:EMERALD}}>Live</span>
                                </div>
                                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:26,letterSpacing:"-0.04em",lineHeight:1.1,color:token.colorText}}>
                                    Command Control{" "}
                                    <motion.span animate={{backgroundPosition:["0% center","200% center"]}} transition={{duration:4,repeat:Infinity,ease:"linear"}} style={{background:`linear-gradient(120deg,${GOLD_DARK},${GOLD_BRIGHT},#FFE680,${GOLD})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundSize:"250% auto",display:"inline-block"}}>Tahfidz</motion.span>
                                </div>
                            </div>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                            <span style={{fontSize:13,color:token.colorTextSecondary}}><CalendarOutlined style={{marginRight:5,color:GOLD}}/>{formatHijri(new Date())} · {formatMasehi(new Date())}</span>
                            <span style={{width:4,height:4,borderRadius:"50%",background:token.colorTextTertiary,flexShrink:0}}/>
                            <span style={{fontSize:13,color:token.colorTextSecondary}}>Pesantren Al-Hasanah</span>
                        </div>
                    </div>
                    <div style={{background:isDark?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.7)",border:`1px solid ${G(.3)}`,borderRadius:14,padding:"8px 14px",display:"flex",alignItems:"center",gap:8}}>
                        <FilterOutlined style={{color:GOLD,fontSize:13}}/>
                        <RangePicker value={dateRange} onChange={(d)=>{if(d?.[0]&&d?.[1])setDateRange([d[0],d[1]]);}} format="DD MMM YYYY" variant="borderless"
                            presets={[{label:"Bulan ini",value:[dayjs().startOf("month"),dayjs().endOf("month")]},{label:"Bulan lalu",value:[dayjs().subtract(1,"month").startOf("month"),dayjs().subtract(1,"month").endOf("month")]},{label:"7 Hari",value:[dayjs().subtract(6,"day"),dayjs()]},{label:"Semua",value:[dayjs("2020-01-01"),dayjs()]}]}
                            style={{fontWeight:700}}/>
                    </div>
                </div>

                {!loading&&(
                    <div style={{display:"flex",gap:12,marginTop:20,flexWrap:"wrap"}}>
                        {[
                            {icon:<CheckCircleFilled/>,label:"Tingkat Hadir",   value:`${hadirRate}%`,          color:EMERALD},
                            {icon:<BookOutlined/>,    label:"Setoran Lancar",  value:`${ziyadahLancarRate}%`,  color:GOLD_BRIGHT},
                            {icon:<TeamOutlined/>,    label:"Santri Aktif",    value:`${summaries.santriCount} santri`,color:INFO},
                            {icon:<SyncOutlined/>,    label:"Ziyadah+Murojaah",value:`${summaries.totalZiyadah+summaries.totalMurojaah}`,color:PURPLE},
                            {icon:<FireOutlined/>,    label:"Total Sesi",      value:`${summaries.totalAbsensi}`,color:WARNING},
                        ].map(b=><StatBadge key={b.label} {...b} isDark={isDark}/>)}
                    </div>
                )}
            </motion.div>

            {/* ── KPI STRIP ────────────────────────────────────────────────── */}
            <motion.div variants={stagger}>
                <Row gutter={[14,14]}>
                    {[
                        {label:"Santri Aktif",      value:summaries.santriCount,    icon:<TeamOutlined/>,       color:GOLD_BRIGHT},
                        {label:"Total Hadir",        value:summaries.totalHadir,     icon:<CheckCircleFilled/>,  color:EMERALD},
                        {label:"Total Absensi",      value:summaries.totalAbsensi,   icon:<CalendarOutlined/>,   color:INFO},
                        {label:"Tingkat Hadir",      value:hadirRate,                icon:<RiseOutlined/>,       color:hadirRate>=70?EMERALD:DANGER, formatter:(v:number)=>`${v}%`},
                        {label:"Setoran Ziyadah",    value:summaries.totalZiyadah,   icon:<BookOutlined/>,       color:PURPLE},
                        {label:"Setoran Murojaah",   value:summaries.totalMurojaah,  icon:<SyncOutlined/>,       color:TEAL},
                        {label:"Predikat Lancar",    value:summaries.totalLancar,    icon:<TrophyOutlined/>,     color:GOLD_BRIGHT},
                        {label:"Perlu Mengulang",    value:summaries.totalMengulang, icon:<CloseCircleOutlined/>,color:DANGER},
                    ].map((kpi,i)=>(
                        <Col key={kpi.label} xs={12} sm={8} lg={6}>
                            <KpiCard {...kpi} isDark={isDark} token={token} delay={i} loading={loading}/>
                        </Col>
                    ))}
                </Row>
            </motion.div>

            {/* ── SECTION 1: Absensi Harian + Distribusi ──────────────────── */}
            <motion.div variants={fadeUp} custom={2}>
                <SectionHeader icon={<BarChartOutlined/>} title="Arus Kehadiran Harian" subtitle="Distribusi absensi per hari & komposisi status kehadiran"/>
                <Row gutter={[16,16]}>
                    <Col xs={24} xl={16}>
                        <Card bordered={false} style={cardBase} bodyStyle={{padding:"22px 24px"}}>
                            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,marginBottom:4}}>Grafik Kehadiran Harian</div>
                            <div style={{fontSize:11,color:token.colorTextSecondary,marginBottom:20}}>{dateRange[0].format("DD MMM")} — {dateRange[1].format("DD MMM YYYY")}</div>
                            {loading?<Skeleton active paragraph={{rows:7}}/>:summaries.dailyChart.length===0?(
                                <Empty description="Belum ada data absensi" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{padding:"40px 0"}}/>
                            ):(
                                <div style={{width:"100%",height:300}}>
                                    <ResponsiveContainer>
                                        <BarChart data={summaries.dailyChart} barSize={13} barGap={1}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.07}/>
                                            <XAxis dataKey="tanggal" tick={TICK} axisLine={false} tickLine={false} interval={Math.max(0,Math.floor(summaries.dailyChart.length/9))}/>
                                            <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false}/>
                                            <ReTooltip content={<PremiumTooltip token={token}/>} cursor={{fill:isDark?"rgba(255,255,255,0.025)":"rgba(0,0,0,0.025)"}}/>
                                            {Object.entries(STATUS_CFG).map(([key,cfg])=>(
                                                <Bar key={key} dataKey={key} name={cfg.label} stackId="a" fill={cfg.color} radius={key==="PULANG"?[4,4,0,0]:[0,0,0,0]}/>
                                            ))}
                                            <Legend iconSize={8} formatter={v=><span style={{fontSize:11,color:token.colorTextSecondary}}>{v}</span>}/>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </Card>
                    </Col>
                    <Col xs={24} xl={8}>
                        <Card bordered={false} style={{...cardBase,height:"100%"}} bodyStyle={{padding:"22px 24px"}}>
                            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,marginBottom:4}}>Distribusi Status</div>
                            <div style={{fontSize:11,color:token.colorTextSecondary,marginBottom:14}}>Komposisi kehadiran periode ini</div>
                            {loading?<Skeleton active paragraph={{rows:7}}/>:(
                                <>
                                    <div style={{display:"flex",justifyContent:"center",marginBottom:8}}>
                                        <ScoreRing score={hadirRate} color={hadirRate>=70?EMERALD:DANGER} size={100}/>
                                    </div>
                                    {summaries.pieData.length===0?(<Empty description="Belum ada data" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{padding:"20px 0"}}/>):(
                                        <div style={{width:"100%",height:155}}>
                                            <ResponsiveContainer>
                                                <PieChart>
                                                    <Pie data={summaries.pieData} innerRadius={40} outerRadius={62} paddingAngle={3} dataKey="value" label={renderPieLabel}>
                                                        {summaries.pieData.map((d:any,i:number)=><Cell key={i} fill={d.color} stroke="transparent"/>)}
                                                    </Pie>
                                                    <ReTooltip contentStyle={{background:token.colorBgElevated,border:`1px solid ${token.colorBorderSecondary}`,borderRadius:12,fontSize:12}}/>
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}
                                    {summaries.pieData.map((d:any)=>(
                                        <div key={d.name} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${isDark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.04)"}`}}>
                                            <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{width:7,height:7,borderRadius:"50%",background:d.color,flexShrink:0}}/><span style={{fontSize:12,fontWeight:600,color:token.colorTextSecondary}}>{d.name}</span></div>
                                            <div style={{display:"flex",gap:8,alignItems:"center"}}>
                                                <span style={{fontSize:10,fontWeight:700,color:d.color}}>{summaries.totalAbsensi>0?`${((d.value/summaries.totalAbsensi)*100).toFixed(1)}%`:"0%"}</span>
                                                <span style={{fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:12,color:token.colorText}}>{d.value}</span>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}
                        </Card>
                    </Col>
                </Row>
            </motion.div>

            {/* ── SECTION 2: Analisis Setoran ──────────────────────────────── */}
            <motion.div variants={fadeUp} custom={3}>
                <SectionHeader icon={<ReadOutlined/>} title="Analisis Setoran Hafalan" subtitle="Kualitas ziyadah & murojaah — predikat lancar vs mengulang"/>
                <Row gutter={[16,16]}>
                    <Col xs={24} lg={14}>
                        <Card bordered={false} style={cardBase} bodyStyle={{padding:"22px 24px"}}>
                            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,marginBottom:16}}>Tren Kehadiran + Setoran Harian</div>
                            {loading?<Skeleton active paragraph={{rows:6}}/>:(
                                <div style={{width:"100%",height:260}}>
                                    <ResponsiveContainer>
                                        <ComposedChart data={summaries.dailyChart}>
                                            <defs>
                                                <linearGradient id="gTotalRkp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={GOLD_BRIGHT} stopOpacity={0.38}/><stop offset="100%" stopColor={GOLD_BRIGHT} stopOpacity={0.02}/></linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.07}/>
                                            <XAxis dataKey="tanggal" tick={TICK} axisLine={false} tickLine={false} interval={Math.max(0,Math.floor(summaries.dailyChart.length/8))}/>
                                            <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false}/>
                                            <ReTooltip content={<PremiumTooltip token={token}/>}/>
                                            <Area type="monotone" dataKey="total" name="Total" stroke={GOLD_BRIGHT} fill="url(#gTotalRkp)" strokeWidth={2}/>
                                            <Bar dataKey="HADIR" name="Hadir" fill={EMERALD} opacity={0.85} radius={[3,3,0,0]} maxBarSize={12}/>
                                            <Legend iconSize={8} formatter={v=><span style={{fontSize:11,color:token.colorTextSecondary}}>{v}</span>}/>
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </Card>
                    </Col>
                    <Col xs={24} lg={10}>
                        <Row gutter={[12,12]}>
                            {[{label:"Ziyadah",value:summaries.totalZiyadah,color:PURPLE,icon:"📖"},{label:"Murojaah",value:summaries.totalMurojaah,color:TEAL,icon:"🔄"}].map(s=>{
                                const rate=s.value>0?Math.round((summaries.totalLancar/s.value)*100):0;
                                return(
                                    <Col key={s.label} span={12}>
                                        <Card bordered={false} style={{...cardBase,height:"100%"}} bodyStyle={{padding:"18px 16px",textAlign:"center"}}>
                                            <div style={{fontSize:22,marginBottom:6}}>{s.icon}</div>
                                            <div style={{fontWeight:800,fontSize:13,marginBottom:10}}>{s.label}</div>
                                            <ScoreRing score={rate} color={s.color} size={76} label="LANCAR"/>
                                            <div style={{fontFamily:"'DM Mono',monospace",fontWeight:800,fontSize:22,color:s.color,marginTop:8}}>{loading?"—":s.value}</div>
                                            <div style={{fontSize:10,color:token.colorTextTertiary,marginTop:2}}>setoran</div>
                                        </Card>
                                    </Col>
                                );
                            })}
                            <Col span={24}>
                                <Card bordered={false} style={cardBase} bodyStyle={{padding:"16px 18px"}}>
                                    <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:GOLD_BRIGHT,marginBottom:12}}>Rekap Predikat</div>
                                    <Row gutter={8}>
                                        {[{label:"Lancar",value:summaries.totalLancar,color:EMERALD},{label:"Mengulang",value:summaries.totalMengulang,color:DANGER}].map(p=>(
                                            <Col key={p.label} span={12}>
                                                <div style={{padding:"10px 12px",borderRadius:12,background:isDark?`${p.color}0e`:`${p.color}08`,border:`1px solid ${p.color}25`,textAlign:"center"}}>
                                                    <div style={{fontFamily:"'DM Mono',monospace",fontWeight:800,fontSize:20,color:p.color}}>{loading?"—":p.value}</div>
                                                    <div style={{fontSize:10,fontWeight:700,color:p.color,letterSpacing:"0.08em",textTransform:"uppercase",marginTop:2}}>{p.label}</div>
                                                </div>
                                            </Col>
                                        ))}
                                    </Row>
                                </Card>
                            </Col>
                        </Row>
                    </Col>
                </Row>
            </motion.div>

            {/* ── SECTION 3: Statistik Mingguan ───────────────────────────── */}
            <motion.div variants={fadeUp} custom={4}>
                <SectionHeader icon={<BarChartOutlined/>} title="Statistik Kegiatan Mingguan" subtitle="Istighosah · Ngaos Aang · Tilawah · Tawasul · MHQ · Muhadhoroh"
                    action={<Segmented value={statsViewMode} onChange={v=>setStatsViewMode(v as string)} size="small" options={[{label:"Per Minggu",value:"mingguan"},{label:"Per Bulan",value:"bulanan"}]}/>}/>
                {statsLoading?<Card bordered={false} style={cardBase} bodyStyle={{padding:32}}><Skeleton active paragraph={{rows:8}}/></Card>:statsData.periodLabels.length===0?<Card bordered={false} style={cardBase} bodyStyle={{padding:40,textAlign:"center"}}><Empty description="Belum ada data kegiatan mingguan" image={Empty.PRESENTED_IMAGE_SIMPLE}/></Card>:(
                    <>
                        <Row gutter={[14,14]} style={{marginBottom:16}}>
                            {[
                                {label:"Total Sesi",value:statsData.totalSesi,color:PURPLE,icon:<CalendarOutlined/>},
                                {label:"Total Absensi",value:statsData.totalAbsensi,color:INFO,icon:<TeamOutlined/>},
                                {label:"Total Hadir",value:statsData.totalHadir,color:EMERALD,icon:<CheckCircleFilled/>},
                                {label:"Rata Hadir",value:statsData.totalAbsensi>0?+(statsData.totalHadir/statsData.totalAbsensi*100).toFixed(1):0,color:WARNING,icon:<RiseOutlined/>,formatter:(v:number)=>`${v}%`},
                            ].map((k,i)=><Col key={k.label} xs={12} sm={6}><KpiCard {...k} isDark={isDark} token={token} delay={i}/></Col>)}
                        </Row>
                        <Row gutter={[16,16]}>
                            <Col xs={24} lg={15}>
                                <Card bordered={false} style={cardBase} bodyStyle={{padding:"22px 24px"}}>
                                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,marginBottom:16}}>Tren Kehadiran per {statsViewMode==="mingguan"?"Minggu":"Bulan"}</div>
                                    <div style={{width:"100%",height:280}}>
                                        <ResponsiveContainer>
                                            <AreaChart data={statsData.periodLabels.map(p=>({periode:p.label,Total:statsData.periodStats[p.key]?.total||0,Hadir:statsData.periodStats[p.key]?.HADIR||0,Ghaib:statsData.periodStats[p.key]?.GHAIB||0}))}>
                                                <defs>
                                                    <linearGradient id="gHadirM" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={EMERALD} stopOpacity={0.35}/><stop offset="100%" stopColor={EMERALD} stopOpacity={0.02}/></linearGradient>
                                                    <linearGradient id="gTotalM" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={PURPLE} stopOpacity={0.22}/><stop offset="100%" stopColor={PURPLE} stopOpacity={0.01}/></linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.07}/>
                                                <XAxis dataKey="periode" tick={TICK} axisLine={false} tickLine={false}/>
                                                <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false}/>
                                                <ReTooltip content={<PremiumTooltip token={token}/>}/>
                                                <Area type="monotone" dataKey="Total" name="Total" stroke={PURPLE} fill="url(#gTotalM)" strokeWidth={2}/>
                                                <Area type="monotone" dataKey="Hadir" name="Hadir" stroke={EMERALD} fill="url(#gHadirM)" strokeWidth={2.5}/>
                                                <Legend iconSize={8} formatter={v=><span style={{fontSize:11,color:token.colorTextSecondary}}>{v}</span>}/>
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </Card>
                            </Col>
                            <Col xs={24} lg={9}>
                                <Card bordered={false} style={{...cardBase,height:"100%"}} bodyStyle={{padding:"22px 24px"}}>
                                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,marginBottom:16}}>Kehadiran per Kegiatan</div>
                                    <div style={{width:"100%",height:280}}>
                                        <ResponsiveContainer>
                                            <BarChart layout="vertical" data={statsData.kegiatanStats.map(d=>({name:KEGIATAN_INFO[d.kegiatan]?.icon+" "+d.label,hadir:d.hadir,total:d.total}))}>
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} strokeOpacity={0.07}/>
                                                <XAxis type="number" tick={TICK} axisLine={false} tickLine={false}/>
                                                <YAxis type="category" dataKey="name" tick={{fontSize:10,fill:token.colorTextSecondary as string}} width={108} axisLine={false} tickLine={false}/>
                                                <ReTooltip content={<PremiumTooltip token={token}/>} cursor={{fill:isDark?"rgba(255,255,255,0.025)":"rgba(0,0,0,0.025)"}}/>
                                                <Bar dataKey="total" name="Total" fill={isDark?"rgba(255,255,255,0.09)":"rgba(0,0,0,0.07)"} radius={[0,4,4,0]} maxBarSize={12}/>
                                                <Bar dataKey="hadir" name="Hadir" fill={EMERALD} radius={[0,4,4,0]} maxBarSize={12}/>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </Card>
                            </Col>
                        </Row>
                    </>
                )}
            </motion.div>

            {/* ── SECTION 4: Statistik Ngaji ───────────────────────────────── */}
            <motion.div variants={fadeUp} custom={5}>
                <SectionHeader icon={<GlobalOutlined/>} title="Statistik Absensi Ngaji" subtitle="Kegiatan ngaji harian berdasarkan kalender Hijriah"
                    action={<div style={{display:"flex",alignItems:"center",gap:8,background:isDark?"rgba(255,255,255,0.04)":G(.08),border:`1px solid ${G(.25)}`,borderRadius:12,padding:"6px 12px"}}>
                        <CalendarOutlined style={{color:GOLD,fontSize:12}}/>
                        <Select value={ngajiStatsTahun} onChange={setNgajiStatsTahun} variant="borderless" size="small" style={{width:90,fontWeight:700}} options={Array.from({length:5},(_,i)=>({label:`${1445+i} H`,value:1445+i}))}/>
                        <Select value={ngajiStatsBulan} onChange={setNgajiStatsBulan} variant="borderless" size="small" style={{width:120,fontWeight:700}} options={HIJRI_MONTHS.map((n,i)=>({label:n,value:i+1}))}/>
                    </div>}
                />
                {ngajiStatsLoading?<Card bordered={false} style={cardBase} bodyStyle={{padding:32}}><Skeleton active paragraph={{rows:7}}/></Card>:ngajiStatsData.periodLabels.length===0?<Card bordered={false} style={cardBase} bodyStyle={{padding:40,textAlign:"center"}}><Empty description="Belum ada data ngaji" image={Empty.PRESENTED_IMAGE_SIMPLE}/></Card>:(
                    <>
                        <Row gutter={[14,14]} style={{marginBottom:16}}>
                            {[
                                {label:"Santri Ngaji",value:ngajiStatsData.totalSantri,color:GOLD_BRIGHT,icon:<TeamOutlined/>},
                                {label:"Total Sesi",value:ngajiStatsData.totalSesi,color:INFO,icon:<CalendarOutlined/>},
                                {label:"Total Hadir",value:ngajiStatsData.totalHadir,color:EMERALD,icon:<CheckCircleFilled/>},
                                {label:"Rata Hadir",value:ngajiStatsData.totalAbsensi>0?+(ngajiStatsData.totalHadir/ngajiStatsData.totalAbsensi*100).toFixed(1):0,color:TEAL,icon:<RiseOutlined/>,formatter:(v:number)=>`${v}%`},
                            ].map((k,i)=><Col key={k.label} xs={12} sm={6}><KpiCard {...k} isDark={isDark} token={token} delay={i}/></Col>)}
                        </Row>
                        <Card bordered={false} style={cardBase} bodyStyle={{padding:"22px 24px"}}>
                            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,marginBottom:16}}>Tren Kehadiran Ngaji · {HIJRI_MONTHS[ngajiStatsBulan-1]} {ngajiStatsTahun} H</div>
                            <div style={{width:"100%",height:260}}>
                                <ResponsiveContainer>
                                    <AreaChart data={ngajiStatsData.periodLabels.map(p=>({periode:p.label,Hadir:ngajiStatsData.periodStats[p.key]?.HADIR||0,Ghaib:ngajiStatsData.periodStats[p.key]?.GHAIB||0,Total:ngajiStatsData.periodStats[p.key]?.total||0}))}>
                                        <defs>
                                            <linearGradient id="gNgH" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={TEAL} stopOpacity={0.38}/><stop offset="100%" stopColor={TEAL} stopOpacity={0.02}/></linearGradient>
                                            <linearGradient id="gNgT" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={GOLD_BRIGHT} stopOpacity={0.22}/><stop offset="100%" stopColor={GOLD_BRIGHT} stopOpacity={0.01}/></linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.07}/>
                                        <XAxis dataKey="periode" tick={TICK} axisLine={false} tickLine={false}/>
                                        <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false}/>
                                        <ReTooltip content={<PremiumTooltip token={token}/>}/>
                                        <Area type="monotone" dataKey="Total" name="Total" stroke={GOLD_BRIGHT} fill="url(#gNgT)" strokeWidth={2}/>
                                        <Area type="monotone" dataKey="Hadir" name="Hadir" stroke={TEAL} fill="url(#gNgH)" strokeWidth={2.5}/>
                                        <Line type="monotone" dataKey="Ghaib" name="Ghaib" stroke={DANGER} strokeWidth={1.5} dot={false} strokeDasharray="4 2"/>
                                        <Legend iconSize={8} formatter={v=><span style={{fontSize:11,color:token.colorTextSecondary}}>{v}</span>}/>
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </>
                )}
            </motion.div>

            {/* ── SECTION 5: Peta Hafalan Juz ─────────────────────────────── */}
            <motion.div variants={fadeUp} custom={6}>
                <SectionHeader icon={<TrophyOutlined/>} title="Peta Hafalan Al-Qur'an" subtitle="Visualisasi pencapaian 30 juz per santri — ✓ hijau = sudah hafal"/>
                <Card bordered={false} style={cardBase} bodyStyle={{padding:"24px 28px"}}>
                    {loading?<Skeleton active paragraph={{rows:10}}/>:petaData.rows.length===0?<Empty description="Belum ada data santri" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{padding:"40px 0"}}/>:(
                        <>
                            <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:20,flexWrap:"wrap"}}>
                                <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{width:14,height:14,borderRadius:3,background:`linear-gradient(135deg,${EMERALD} 0%,${EMERALD_LT} 100%)`,display:"inline-block"}}/><span style={{fontSize:11,color:token.colorTextSecondary}}>Sudah hafal</span></div>
                                <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{width:14,height:14,borderRadius:3,background:isDark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.07)",display:"inline-block"}}/><span style={{fontSize:11,color:token.colorTextSecondary}}>Belum</span></div>
                                <div style={{flex:1}}/>
                                <span style={{fontSize:11,color:token.colorTextSecondary}}>{petaData.rows.length} santri · 30 juz</span>
                            </div>
                            <div style={{overflowX:"auto"}}>
                                <table style={{width:"100%",borderCollapse:"separate",borderSpacing:"2px 3px"}}>
                                    <thead>
                                        <tr>
                                            <th style={{textAlign:"left",padding:"6px 10px",fontSize:10,fontWeight:700,color:token.colorTextSecondary,letterSpacing:"0.08em",minWidth:140,textTransform:"uppercase"}}>Nama Santri</th>
                                            <th style={{padding:"6px 6px",fontSize:9,fontWeight:700,color:GOLD_BRIGHT,textAlign:"center",minWidth:40,textTransform:"uppercase"}}>JUZ</th>
                                            {Array.from({length:petaData.juzTotal},(_,i)=>(
                                                <th key={i+1} style={{textAlign:"center",padding:"4px 1px",fontSize:8.5,fontWeight:700,color:GOLD,width:26,minWidth:24}}>{i+1}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {petaData.rows.map((row:any)=>{
                                            const pct=Math.round((row.total/petaData.juzTotal)*100);
                                            return(
                                                <tr key={row.nis}>
                                                    <td style={{padding:"5px 10px",fontSize:12,fontWeight:600,color:token.colorText,whiteSpace:"nowrap"}}>{row.nama}</td>
                                                    <td style={{padding:"5px 6px",textAlign:"center"}}>
                                                        <Tooltip title={`${row.total} Juz (${pct}%)`}>
                                                            <div style={{width:32,height:32,borderRadius:"50%",margin:"0 auto",background:`conic-gradient(${EMERALD} ${pct*3.6}deg,${isDark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.07)"} 0deg)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,color:token.colorText,fontFamily:"'DM Mono',monospace"}}>{row.total}</div>
                                                        </Tooltip>
                                                    </td>
                                                    {Array.from({length:petaData.juzTotal},(_,i)=>{
                                                        const done=row[i+1] as boolean;
                                                        return(
                                                            <td key={i+1} style={{padding:"3px 1px",textAlign:"center"}}>
                                                                <div style={{width:20,height:20,borderRadius:4,margin:"0 auto",background:done?`linear-gradient(135deg,${EMERALD} 0%,${EMERALD_LT} 100%)`:isDark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.06)",border:`1px solid ${done?EMERALD+"50":isDark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.06)"}`,boxShadow:done?`0 1px 4px ${EMERALD}35`:"none",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:done?"#fff":"transparent"}}>{done?"✓":""}</div>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </Card>
            </motion.div>

            {/* ── SECTION 6: Per Santri Table ──────────────────────────────── */}
            <motion.div variants={fadeUp} custom={7}>
                <SectionHeader icon={<TeamOutlined/>} title="Rekap Per Santri" subtitle="Detail kehadiran & setoran individual — sortable"/>
                <Card bordered={false} style={{...cardBase,overflow:"hidden"}} bodyStyle={{padding:0}}>
                    <Table dataSource={summaries.perSantri} rowKey="nis" loading={loading} size="middle" scroll={{x:900}}
                        pagination={{pageSize:15,showTotal:t=>`${t} santri`}}
                        columns={[
                            {title:"Santri",dataIndex:"nama",width:180,fixed:"left",render:(v,r:any)=>(
                                <div style={{display:"flex",alignItems:"center",gap:10}}>
                                    <Avatar size={34} style={{background:`linear-gradient(135deg,${GOLD}40,${GOLD_BRIGHT}60)`,color:isDark?"#fff":GOLD_DARK,fontSize:12,fontWeight:700,flexShrink:0}}>{String(v||"?").charAt(0).toUpperCase()}</Avatar>
                                    <div><div style={{fontWeight:700,fontSize:13}}>{v}</div><div style={{fontSize:10,color:token.colorTextTertiary}}>Kelas {r.kelas}</div></div>
                                </div>
                            )},
                            {title:"Hadir",dataIndex:"hadir",width:72,align:"center",sorter:(a:any,b:any)=>a.hadir-b.hadir,render:v=><Tag style={{background:`${EMERALD}18`,color:EMERALD,border:`1px solid ${EMERALD}30`,borderRadius:99,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{v}</Tag>},
                            {title:"Sakit",dataIndex:"sakit",width:68,align:"center",render:v=>v>0?<Tag style={{background:`${WARNING}18`,color:WARNING,border:`1px solid ${WARNING}30`,borderRadius:99,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{v}</Tag>:<span style={{color:token.colorTextTertiary}}>—</span>},
                            {title:"Ghaib",dataIndex:"goib",width:68,align:"center",render:v=>v>0?<Tag style={{background:`${DANGER}18`,color:DANGER,border:`1px solid ${DANGER}30`,borderRadius:99,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{v}</Tag>:<span style={{color:token.colorTextTertiary}}>—</span>},
                            {title:"% Hadir",dataIndex:"hadir",key:"pct",width:105,align:"center",sorter:(a:any,b:any)=>{const ta=a.hadir+a.sakit+a.goib+a.sekolah+a.pulang;const tb=b.hadir+b.sakit+b.goib+b.sekolah+b.pulang;return(ta?a.hadir/ta:0)-(tb?b.hadir/tb:0);},render:(_,r:any)=>{const total=r.hadir+r.sakit+r.goib+r.sekolah+r.pulang;const pct=total>0?Math.round((r.hadir/total)*100):0;return(<div><div style={{fontFamily:"'DM Mono',monospace",fontWeight:800,fontSize:13,color:pct>=70?EMERALD:DANGER,textAlign:"center"}}>{pct}%</div><Progress percent={pct} showInfo={false} size="small" strokeColor={pct>=70?EMERALD:DANGER} trailColor={isDark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.08)"} style={{margin:0}}/></div>);}},
                            {title:"Ziyadah",dataIndex:"ziyadah",width:85,align:"center",sorter:(a:any,b:any)=>a.ziyadah-b.ziyadah,render:v=><Tag style={{background:`${PURPLE}18`,color:PURPLE,border:`1px solid ${PURPLE}30`,borderRadius:99,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{v}</Tag>},
                            {title:"Murojaah",dataIndex:"murojaah",width:90,align:"center",sorter:(a:any,b:any)=>a.murojaah-b.murojaah,render:v=><Tag style={{background:`${TEAL}18`,color:TEAL,border:`1px solid ${TEAL}30`,borderRadius:99,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{v}</Tag>},
                            {title:"Lancar / Ulang",key:"predikat",width:130,align:"center",render:(_,r:any)=>(
                                <Space size={4}>
                                    <Tag style={{background:`${EMERALD}18`,color:EMERALD,border:`1px solid ${EMERALD}30`,borderRadius:99,fontFamily:"'DM Mono',monospace"}}>✓ {r.lancar}</Tag>
                                    <Tag style={{background:`${DANGER}18`,color:DANGER,border:`1px solid ${DANGER}30`,borderRadius:99,fontFamily:"'DM Mono',monospace"}}>↩ {r.mengulang}</Tag>
                                </Space>
                            )},
                        ]}
                    />
                </Card>
            </motion.div>

            {/* ── SECTION 7: Export Panel ──────────────────────────────────── */}
            <motion.div variants={fadeUp} custom={8}>
                <SectionHeader icon={<FileExcelOutlined/>} title="Export & Laporan" subtitle="Unduh laporan lengkap dalam format Excel terformat premium"/>
                <Row gutter={[14,14]}>
                    {[
                        {icon:"📊",title:"Rekap Global",desc:"Rekapitulasi lengkap absensi tahfidz + per santri dalam 2 sheet",color:GOLD_BRIGHT,tag:"2 Sheet",action:()=>handleExport(),loading:exportLoading},
                        {icon:"📅",title:"Absensi Mingguan",desc:"Semua kegiatan mingguan per bulan Hijriah (Istighosah, MHQ, dll)",color:PURPLE,tag:"Hijriah",action:()=>setExpMingguanOpen(true),loading:expMingguanLoading},
                        {icon:"🕌",title:"Absensi Ngaji",desc:"Grid absensi ngaji harian per santri dengan rekap status",color:EMERALD,tag:"Grid",action:()=>setExpNgajiOpen(true),loading:expNgajiLoading},
                        {icon:"👤",title:"Rekap Per Santri",desc:"Laporan individual: Ziyadah, Murojaah, Ngaji & Absensi Mingguan",color:INFO,tag:"4 Sheet",action:()=>setExpSantriOpen(true),loading:expSantriLoading},
                    ].map((item,i)=>(
                        <Col key={item.title} xs={24} sm={12} lg={6}>
                            <motion.div variants={fadeUp} custom={i} whileHover={{y:-4,transition:{duration:.18}}}>
                                <div style={{borderRadius:20,padding:"22px 20px",background:token.colorBgContainer,border:`1px solid ${isDark?item.color+"22":item.color+"28"}`,position:"relative",overflow:"hidden",boxShadow:isDark?`0 4px 24px rgba(0,0,0,0.4)`:`0 2px 16px rgba(0,0,0,0.06)`,cursor:"pointer"}} onClick={item.action}>
                                    <div style={{position:"absolute",top:0,left:"15%",right:"15%",height:2,background:`linear-gradient(90deg,transparent,${item.color}70,transparent)`}}/>
                                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                                        <div style={{fontSize:26}}>{item.icon}</div>
                                        <Tag style={{borderRadius:99,fontSize:9.5,fontWeight:700,background:`${item.color}18`,color:item.color,border:`1px solid ${item.color}30`}}>{item.tag}</Tag>
                                    </div>
                                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:15,marginBottom:6,letterSpacing:"-0.02em"}}>{item.title}</div>
                                    <div style={{fontSize:11.5,color:token.colorTextSecondary,marginBottom:18,lineHeight:1.5}}>{item.desc}</div>
                                    <Button loading={item.loading} icon={<DownloadOutlined/>} style={{width:"100%",borderRadius:12,fontWeight:700,background:isDark?`${item.color}18`:`${item.color}12`,border:`1px solid ${item.color}40`,color:item.color,height:38}}>
                                        Download
                                    </Button>
                                </div>
                            </motion.div>
                        </Col>
                    ))}
                </Row>
            </motion.div>

            {/* ── MODAL: Export Mingguan ───────────────────────────────────── */}
            <Modal open={expMingguanOpen} onCancel={()=>setExpMingguanOpen(false)} footer={null} centered width={400}
                styles={{content:{borderRadius:24,padding:0,overflow:"hidden",background:token.colorBgContainer,border:`1px solid ${isDark?PURPLE+"22":PURPLE+"28"}`,boxShadow:isDark?"0 32px 80px rgba(0,0,0,0.6)":"0 16px 60px rgba(0,0,0,0.15)"},header:{display:"none"},mask:{backdropFilter:"blur(6px)"}}}>
                <div style={{padding:"26px 28px 22px",background:isDark?`linear-gradient(135deg,${PURPLE}15,transparent)`:`linear-gradient(135deg,${PURPLE}08,transparent)`,borderBottom:`1px solid ${isDark?PURPLE+"20":PURPLE+"15"}`}}>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                        <div style={{width:44,height:44,borderRadius:14,background:`linear-gradient(135deg,${PURPLE},#9333EA)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>📅</div>
                        <div><div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:17}}>Export Absensi Mingguan</div><div style={{fontSize:12,color:token.colorTextSecondary}}>Kegiatan mingguan per bulan Hijriah</div></div>
                        <Button type="text" onClick={()=>setExpMingguanOpen(false)} style={{marginLeft:"auto",color:token.colorTextTertiary,borderRadius:10,width:34,height:34,fontSize:17}}>×</Button>
                    </div>
                </div>
                <div style={{padding:"22px 28px 28px",display:"flex",flexDirection:"column",gap:16}}>
                    <div><div style={{fontSize:9,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:GOLD,marginBottom:7}}>TAHUN HIJRIAH</div><Select value={expMingguanTahun} onChange={setExpMingguanTahun} style={{width:"100%",borderRadius:10}} options={Array.from({length:5},(_,i)=>({label:`${1445+i} H`,value:1445+i}))}/></div>
                    <div><div style={{fontSize:9,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:GOLD,marginBottom:7}}>BULAN HIJRIAH</div><Select value={expMingguanBulan} onChange={setExpMingguanBulan} style={{width:"100%",borderRadius:10}} options={HIJRI_MONTHS.map((name,i)=>({label:name,value:i+1}))}/></div>
                    <div style={{display:"flex",gap:10,paddingTop:4}}>
                        <Button onClick={()=>setExpMingguanOpen(false)} style={{borderRadius:10,flex:1}}>Batal</Button>
                        <Button loading={expMingguanLoading} onClick={handleExportMingguan} icon={<DownloadOutlined/>} style={{flex:2,borderRadius:10,fontWeight:700,background:`linear-gradient(135deg,${PURPLE},#9333EA)`,border:"none",color:"#fff"}}>Download Excel</Button>
                    </div>
                </div>
            </Modal>

            {/* ── MODAL: Export Ngaji ──────────────────────────────────────── */}
            <Modal open={expNgajiOpen} onCancel={()=>setExpNgajiOpen(false)} footer={null} centered width={420}
                styles={{content:{borderRadius:24,padding:0,overflow:"hidden",background:token.colorBgContainer,border:`1px solid ${isDark?EMERALD+"22":EMERALD+"28"}`,boxShadow:isDark?"0 32px 80px rgba(0,0,0,0.6)":"0 16px 60px rgba(0,0,0,0.15)"},header:{display:"none"},mask:{backdropFilter:"blur(6px)"}}}>
                <div style={{padding:"26px 28px 22px",background:isDark?`linear-gradient(135deg,${EMERALD}12,transparent)`:`linear-gradient(135deg,${EMERALD}08,transparent)`,borderBottom:`1px solid ${isDark?EMERALD+"20":EMERALD+"15"}`}}>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                        <div style={{width:44,height:44,borderRadius:14,background:`linear-gradient(135deg,${EMERALD},${EMERALD_LT})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🕌</div>
                        <div><div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:17}}>Export Absensi Ngaji</div><div style={{fontSize:12,color:token.colorTextSecondary}}>Grid ngaji per minggu Hijriah</div></div>
                        <Button type="text" onClick={()=>setExpNgajiOpen(false)} style={{marginLeft:"auto",color:token.colorTextTertiary,borderRadius:10,width:34,height:34,fontSize:17}}>×</Button>
                    </div>
                </div>
                <div style={{padding:"22px 28px 28px",display:"flex",flexDirection:"column",gap:14}}>
                    <Row gutter={12}>
                        <Col span={12}><div style={{fontSize:9,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:GOLD,marginBottom:7}}>TAHUN H</div><Select value={expNgajiTahun} onChange={setExpNgajiTahun} style={{width:"100%",borderRadius:10}} options={Array.from({length:5},(_,i)=>({label:`${1445+i} H`,value:1445+i}))}/></Col>
                        <Col span={12}><div style={{fontSize:9,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:GOLD,marginBottom:7}}>BULAN H</div><Select value={expNgajiBulan} onChange={setExpNgajiBulan} style={{width:"100%",borderRadius:10}} options={HIJRI_MONTHS.map((n,i)=>({label:n,value:i+1}))}/></Col>
                    </Row>
                    <div>
                        <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:GOLD,marginBottom:10}}>PILIH MINGGU</div>
                        <Checkbox.Group value={expNgajiWeeks} onChange={v=>setExpNgajiWeeks(v as number[])} options={[1,2,3,4,5].map(i=>({label:`Minggu ${i}`,value:i}))} style={{display:"flex",flexDirection:"column",gap:6}}/>
                        <div style={{display:"flex",gap:8,marginTop:10}}>
                            <Button size="small" style={{borderRadius:8,fontSize:11}} onClick={()=>setExpNgajiWeeks([1,2,3,4,5])}>Semua</Button>
                            <Button size="small" style={{borderRadius:8,fontSize:11}} onClick={()=>setExpNgajiWeeks([1])}>Reset</Button>
                        </div>
                    </div>
                    <div style={{display:"flex",gap:10,paddingTop:4}}>
                        <Button onClick={()=>setExpNgajiOpen(false)} style={{borderRadius:10,flex:1}}>Batal</Button>
                        <Button loading={expNgajiLoading} onClick={handleExportNgaji} icon={<DownloadOutlined/>} style={{flex:2,borderRadius:10,fontWeight:700,background:`linear-gradient(135deg,${EMERALD},${EMERALD_LT})`,border:"none",color:"#fff"}}>Download Excel</Button>
                    </div>
                </div>
            </Modal>

            {/* ── MODAL: Export Per Santri ─────────────────────────────────── */}
            <Modal open={expSantriOpen} onCancel={()=>setExpSantriOpen(false)} footer={null} centered width={560}
                styles={{content:{borderRadius:24,padding:0,overflow:"hidden",background:token.colorBgContainer,border:`1px solid ${isDark?INFO+"22":INFO+"28"}`,boxShadow:isDark?"0 32px 80px rgba(0,0,0,0.6)":"0 16px 60px rgba(0,0,0,0.15)"},header:{display:"none"},mask:{backdropFilter:"blur(6px)"}}}>
                <div style={{padding:"26px 32px 22px",background:isDark?`linear-gradient(135deg,${INFO}12,transparent)`:`linear-gradient(135deg,${INFO}08,transparent)`,borderBottom:`1px solid ${isDark?INFO+"20":INFO+"15"}`}}>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                        <div style={{width:44,height:44,borderRadius:14,background:`linear-gradient(135deg,${INFO},#3B82F6)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>👤</div>
                        <div><div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:17}}>Rekap Per Santri</div><div style={{fontSize:12,color:token.colorTextSecondary}}>4 sheet: Ziyadah · Murojaah · Mingguan · Ngaji</div></div>
                        <Button type="text" onClick={()=>setExpSantriOpen(false)} style={{marginLeft:"auto",color:token.colorTextTertiary,borderRadius:10,width:34,height:34,fontSize:17}}>×</Button>
                    </div>
                </div>
                <div style={{padding:"22px 32px 28px",display:"flex",flexDirection:"column",gap:14}}>
                    <div><div style={{fontSize:9,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:GOLD,marginBottom:7}}>PILIH SANTRI</div>
                        <Select value={expSantriNis} onChange={setExpSantriNis} placeholder="Cari nama santri..." showSearch style={{width:"100%",borderRadius:10}} filterOption={(i,o)=>(o?.label as string||"").toLowerCase().includes(i.toLowerCase())} options={santriListExport.map(s=>({label:`${s.nama} (${s.nis})`,value:s.nis}))}/>
                    </div>
                    <Divider style={{borderColor:isDark?GOLD+"18":GOLD+"22",margin:"4px 0 0"}}><span style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",color:GOLD}}>SETORAN ZIYADAH</span></Divider>
                    <div><div style={{fontSize:9,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:GOLD,marginBottom:7}}>RENTANG TANGGAL</div><RangePicker value={expSantriSetoran} onChange={(d:any)=>setExpSantriSetoran(d)} style={{width:"100%",borderRadius:10}} format="DD MMM YYYY"/></div>
                    <Divider style={{borderColor:isDark?GOLD+"18":GOLD+"22",margin:"4px 0 0"}}><span style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",color:GOLD}}>MUROJAAH</span></Divider>
                    <div><div style={{fontSize:9,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:GOLD,marginBottom:7}}>RENTANG TANGGAL</div><RangePicker value={expSantriMurojaah} onChange={(d:any)=>setExpSantriMurojaah(d)} style={{width:"100%",borderRadius:10}} format="DD MMM YYYY"/></div>
                    <Divider style={{borderColor:isDark?GOLD+"18":GOLD+"22",margin:"4px 0 0"}}><span style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",color:GOLD}}>ABSENSI MINGGUAN & NGAJI</span></Divider>
                    <Row gutter={12}>
                        {[{label:"Tahun Mingguan",val:expSantriTahun,set:setExpSantriTahun,isMonth:false},{label:"Bulan Mingguan",val:expSantriBulan,set:setExpSantriBulan,isMonth:true},{label:"Tahun Ngaji",val:expSantriNgajiTahun,set:setExpSantriNgajiTahun,isMonth:false},{label:"Bulan Ngaji",val:expSantriNgajiBulan,set:setExpSantriNgajiBulan,isMonth:true}].map((f,i)=>(
                            <Col key={i} span={12}>
                                <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:isDark?"rgba(255,255,255,0.4)":"rgba(0,0,0,0.4)",marginBottom:6}}>{f.label.toUpperCase()}</div>
                                <Select value={f.val} onChange={f.set} style={{width:"100%",borderRadius:10}} options={f.isMonth?HIJRI_MONTHS.map((n,j)=>({label:n,value:j+1})):Array.from({length:5},(_,j)=>({label:`${1445+j} H`,value:1445+j}))}/>
                            </Col>
                        ))}
                    </Row>
                    <div style={{display:"flex",gap:10,paddingTop:4}}>
                        <Button onClick={()=>setExpSantriOpen(false)} style={{borderRadius:10,flex:1}}>Batal</Button>
                        <Button loading={expSantriLoading} onClick={handleExportSantri} icon={<DownloadOutlined/>} style={{flex:2,borderRadius:10,fontWeight:700,background:`linear-gradient(135deg,${INFO},#3B82F6)`,border:"none",color:"#fff"}}>Download 4 Sheet</Button>
                    </div>
                </div>
            </Modal>

        </motion.div>
    );
}; // end HafalanRekap
