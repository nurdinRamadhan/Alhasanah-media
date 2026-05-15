/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  PORTAL INFORMASI — BERITA                                              ║
 * ║  Islamic Luxury Tech · KPI Board · Dual View · Premium UX              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useMemo } from "react";
import { useTable } from "@refinedev/antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import {
  Button, Tooltip, Image, Switch, Modal,
  Select, Input, Row, Col, Empty,
} from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  FileTextOutlined, StarOutlined, StarFilled, ClockCircleOutlined,
  EyeOutlined, FilterOutlined, AppstoreOutlined,
  UnorderedListOutlined, SearchOutlined, CalendarOutlined,
  CheckCircleFilled, MinusCircleFilled,
  ExclamationCircleOutlined, ReadOutlined, CrownOutlined,
} from "@ant-design/icons";
import { IBerita } from "../../types";
import { useNavigation, useDelete, useUpdate } from "@refinedev/core";
import { useColorMode } from "../../contexts/color-mode";
import dayjs from "dayjs";
import { formatHijri } from "../../utility/dateHelper";
import { motion, AnimatePresence } from "framer-motion";

// ── DESIGN TOKENS ─────────────────────────────────────────────────────────
const GOLD        = "#C9A84C";
const GOLD_LIGHT  = "#E8C96A";
const GOLD_BRIGHT = "#FFD166";
const GOLD_DEEP   = "#A07830";

const darkT = {
  bg: "#08070D", surface: "#0F0F1A", card: "#141424", cardHover: "#1A1A2E",
  border: "rgba(201,168,76,0.13)", borderAccent: "rgba(201,168,76,0.38)",
  accent: GOLD_BRIGHT,
  text: "#F0EDE5", textSub: "#9E9080", textMuted: "#5C5248",
  divider: "rgba(255,255,255,0.055)",
};
const lightT = {
  bg: "#F7F4EE", surface: "#FFFFFF", card: "#FFFFFF", cardHover: "#FFFDF5",
  border: "rgba(0,0,0,0.07)", borderAccent: "rgba(201,168,76,0.40)",
  accent: GOLD_DEEP,
  text: "#0A0805", textSub: "#6B5F50", textMuted: "#9E9080",
  divider: "rgba(0,0,0,0.06)",
};

const ISLAMIC_SVG = `url("data:image/svg+xml,%3Csvg width='120' height='120' viewBox='0 0 120 120' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='rgba(201%2C168%2C76%2C0.07)' stroke-width='0.8'%3E%3Cpolygon points='60%2C10 110%2C35 110%2C85 60%2C110 10%2C85 10%2C35'/%3E%3Cpolygon points='60%2C25 95%2C42.5 95%2C77.5 60%2C95 25%2C77.5 25%2C42.5'/%3E%3Cline x1='60' y1='10' x2='60' y2='25'/%3E%3Cline x1='110' y1='35' x2='95' y2='42.5'/%3E%3Cline x1='110' y1='85' x2='95' y2='77.5'/%3E%3Cline x1='60' y1='110' x2='60' y2='95'/%3E%3Cline x1='10' y1='85' x2='25' y2='77.5'/%3E%3Cline x1='10' y1='35' x2='25' y2='42.5'/%3E%3C/g%3E%3C/svg%3E")`;

// ── PAGE CSS ───────────────────────────────────────────────────────────────
const buildCSS = (mode: "light" | "dark") => {
  const t = mode === "dark" ? darkT : lightT;
  return `
.berita-table .ant-pro-card { background:transparent!important; }
.berita-table .ant-card-body { padding:0!important; }
.berita-table .ant-pro-table-list-toolbar {
  background:${t.card}!important; border-bottom:1px solid ${t.divider}!important;
  border-radius:20px 20px 0 0!important; padding:16px 20px!important;
}
.berita-table .ant-table { background:${t.card}!important; }
.berita-table .ant-table-thead>tr>th {
  background:${mode==="dark"?"rgba(201,168,76,.06)":"rgba(201,168,76,.05)"}!important;
  border-bottom:1px solid ${t.border}!important; color:${t.textSub}!important;
  font-size:10px!important; font-weight:800!important; letter-spacing:.8px!important; text-transform:uppercase!important;
}
.berita-table .ant-table-tbody>tr>td {
  background:${t.card}!important; border-bottom:1px solid ${t.divider}!important;
  transition:background .12s!important; vertical-align:top!important;
}
.berita-table .ant-table-tbody>tr:hover>td { background:${t.cardHover}!important; }
.berita-table .ant-table-pagination {
  padding:12px 20px!important; background:${t.card}!important;
  border-radius:0 0 20px 20px!important; border-top:1px solid ${t.divider}!important; margin:0!important;
}
.brt-card { transition:transform .22s cubic-bezier(.22,1,.36,1),box-shadow .22s,border-color .22s; }
.brt-card:hover { transform:translateY(-4px); border-color:${t.borderAccent}!important; box-shadow:0 14px 44px rgba(0,0,0,${mode==="dark"?".45":".10"})!important; }
.brt-filter .ant-select-selector,.brt-filter .ant-input-affix-wrapper {
  background:${t.card}!important; border-color:${t.border}!important; border-radius:10px!important;
}
.brt-filter .ant-select-selector:hover,.brt-filter .ant-input-affix-wrapper:hover { border-color:${t.borderAccent}!important; }
.brt-sw.ant-switch-checked { background:linear-gradient(90deg,${GOLD},${GOLD_BRIGHT})!important; }
.brt-stat { transition:transform .2s,box-shadow .2s,border-color .2s; }
.brt-stat:hover { transform:translateY(-3px); border-color:${t.borderAccent}!important; }
.brt-modal .ant-modal-content {
  background:${t.card}!important; border:1px solid ${t.border}!important;
  border-radius:20px!important; overflow:hidden!important; padding:0!important;
}
.brt-modal .ant-modal-body { padding:0!important; }
@keyframes brtFadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
.brt-in { animation:brtFadeUp .38s cubic-bezier(.22,1,.36,1) both; }
`;
};

// ── SUB-COMPONENTS ─────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color: string;
  delay?: number;
  mode: "light" | "dark";
}

const StatCard: React.FC<StatCardProps> = ({ label, value, sub, icon, color, delay=0, mode }) => {
  const t = mode==="dark" ? darkT : lightT;
  return (
    <motion.div className="brt-stat"
      initial={{opacity:0,y:16}} animate={{opacity:1,y:0}}
      transition={{duration:.38,delay,ease:[.22,1,.36,1]}}
      style={{
        background:t.card, border:`1px solid ${t.border}`,
        borderRadius:16, padding:"18px 20px",
        display:"flex", alignItems:"center", gap:14,
        boxShadow: mode==="dark"?"0 4px 20px rgba(0,0,0,.40)":"0 2px 10px rgba(0,0,0,.05)",
        position:"relative", overflow:"hidden",
      }}
    >
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,
        background:`linear-gradient(90deg,transparent,${color}70,transparent)`}} />
      <div style={{position:"absolute",top:-16,right:-16,width:80,height:80,
        background:`radial-gradient(circle,${color}16 0%,transparent 70%)`,pointerEvents:"none"}} />
      <div style={{width:44,height:44,flexShrink:0,display:"flex",alignItems:"center",
        justifyContent:"center",background:`${color}18`,border:`1px solid ${color}28`,borderRadius:12}}>
        <span style={{color,fontSize:18}}>{icon}</span>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:10,fontWeight:700,letterSpacing:".8px",textTransform:"uppercase",color:t.textMuted,marginBottom:4}}>{label}</div>
        <div style={{fontSize:"clamp(20px,2vw,26px)",fontWeight:800,color,lineHeight:1,fontVariantNumeric:"tabular-nums"}}>{value}</div>
        {sub && <div style={{fontSize:11,color:t.textMuted,marginTop:4}}>{sub}</div>}
      </div>
    </motion.div>
  );
};

const StatusBadge = ({ status }: { status: IBerita["status"] }) => {
  const map: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
    PUBLISHED:{ label:"TAYANG", color:"#34D399", bg:"rgba(52,211,153,.12)", border:"rgba(52,211,153,.28)", icon:<CheckCircleFilled /> },
    DRAFT:    { label:"DRAFT",  color:"#9E9080",  bg:"rgba(158,144,128,.10)",border:"rgba(158,144,128,.24)",icon:<MinusCircleFilled /> },
    ARCHIVED: { label:"ARSIP",  color:GOLD_BRIGHT,bg:"rgba(255,209,102,.10)",border:"rgba(255,209,102,.28)",icon:<ExclamationCircleOutlined /> },
  };
  const c = map[status] || map.DRAFT;
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:20,
      fontSize:10,fontWeight:800,letterSpacing:"1px",background:c.bg,color:c.color,border:`1px solid ${c.border}`}}>
      {c.icon} {c.label}
    </span>
  );
};

const KategoriTag = ({ kategori }: { kategori: string }) => {
  if (!kategori) return null;
  const colors: Record<string, { color: string; bg: string }> = {
    "Pengumuman":{ color:"#60A5FA",bg:"rgba(96,165,250,.12)" },
    "Kegiatan":  { color:"#A78BFA",bg:"rgba(167,139,250,.12)" },
    "Akademik":  { color:"#34D399",bg:"rgba(52,211,153,.12)" },
    "Kesehatan": { color:"#F87171",bg:"rgba(248,113,113,.12)" },
    "Prestasi":  { color:GOLD_BRIGHT,bg:"rgba(255,209,102,.12)" },
    "Umum":      { color:"#9E9080",bg:"rgba(158,144,128,.10)" },
  };
  const c = colors[kategori]||{ color:"#9E9080",bg:"rgba(158,144,128,.10)" };
  return (
    <span style={{display:"inline-flex",alignItems:"center",padding:"2px 9px",borderRadius:8,
      fontSize:10,fontWeight:700,letterSpacing:".5px",color:c.color,background:c.bg,border:`1px solid ${c.color}30`}}>
      {kategori}
    </span>
  );
};

const ThumbBox = ({ src, mode }: { src: string | null; mode: "light" | "dark" }) => {
  const t = mode==="dark"?darkT:lightT;
  return src ? (
    <div style={{width:130,borderRadius:10,overflow:"hidden",aspectRatio:"16/9",border:`1px solid ${t.border}`}}>
      <Image src={src} style={{width:"100%",height:"100%",objectFit:"cover"}} preview={{mask:<EyeOutlined/>}} />
    </div>
  ) : (
    <div style={{width:130,aspectRatio:"16/9",background:t.surface,border:`1px dashed ${t.border}`,
      borderRadius:10,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,color:t.textMuted}}>
      <FileTextOutlined style={{fontSize:20,opacity:.4}}/>
      <span style={{fontSize:9,fontWeight:600,opacity:.4}}>No Image</span>
    </div>
  );
};

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────
export const BeritaList = () => {
  const { mode } = useColorMode();
  const t = mode==="dark" ? darkT : lightT;

  const { tableProps, tableQueryResult } = useTable<IBerita>({
    resource:"berita", syncWithLocation:false,
    pagination:{mode:"off"},
    sorters:{initial:[{field:"tanggal_publish",order:"desc"}]},
  });

  const { push }            = useNavigation();
  const { mutate: delFn }   = useDelete();
  const { mutate: updFn }   = useUpdate();

  const [viewMode,  setViewMode]  = useState<"table" | "grid">("table");
  const [fStatus,   setFStatus]   = useState<IBerita["status"] | null>(null);
  const [fKategori, setFKategori] = useState<string | null>(null);
  const [fSearch,   setFSearch]   = useState("");
  const [preview,   setPreview]   = useState<IBerita | null>(null);
  const [page,      setPage]      = useState(1);
  const PAGE_SIZE = 12;

  const allData = tableQueryResult?.data?.data ?? [];

  const filteredData = useMemo(() =>
    allData.filter(i => {
      if (fStatus   && i.status   !== fStatus)   return false;
      if (fKategori && i.kategori !== fKategori) return false;
      if (fSearch   && !i.judul?.toLowerCase().includes(fSearch.toLowerCase())) return false;
      return true;
    }), [allData, fStatus, fKategori, fSearch]
  );

  const pagedData = useMemo(() =>
    filteredData.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE),
    [filteredData, page]
  );

  const totalAll       = allData.length;
  const totalPublished = allData.filter(i=>i.status==="PUBLISHED").length;
  const totalDraft     = allData.filter(i=>i.status==="DRAFT").length;
  const totalFeatured  = allData.filter(i=>i.is_featured).length;

  const kategoriOptions = useMemo(() => {
    const s = new Set(allData.map(i=>i.kategori).filter(Boolean));
    return Array.from(s).map(k=>({label:k,value:k}));
  }, [allData]);

  const handleToggleFeatured = (id: number, current: boolean) =>
    updFn({ resource:"berita",id:id.toString(), values:{is_featured:!current},
      successNotification:{message:current?"Dihapus dari Headline":"Dijadikan Headline",type:"success"} });

  const handleToggleStatus = (id: number, currentStatus: IBerita["status"]) => {
    const next = currentStatus==="PUBLISHED"?"DRAFT":"PUBLISHED";
    updFn({ resource:"berita",id:id.toString(), values:{status:next},
      successNotification:{message:`Status → ${next}`,type:"success"} });
  };

  const handleDelete = (record: IBerita) =>
    Modal.confirm({
      title:"Hapus Artikel?",
      icon:<ExclamationCircleOutlined style={{color:"#F87171"}}/>,
      content:<div style={{fontSize:13}}>Artikel <strong>"{record.judul}"</strong> akan dihapus permanen.</div>,
      okText:"Hapus", okType:"danger", cancelText:"Batal",
      onOk: ()=>delFn({resource:"berita",id:record.id}),
    });

  // TABLE COLUMNS
  const columns: ProColumns<IBerita>[] = [
    {
      title:"Thumbnail", dataIndex:"thumbnail_url", width:155, search:false,
      render:(val)=><ThumbBox src={typeof val==="string"&&val?val:null} mode={mode}/>,
    },
    {
      title:"Konten Artikel", dataIndex:"judul",
      render:(_, r)=>(
        <div style={{paddingRight:12,paddingTop:4}}>
          <div style={{fontWeight:700,fontSize:14,color:t.text,lineHeight:1.35,marginBottom:6,
            display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>
            {r.judul}
          </div>
          <div style={{fontSize:12,color:t.textSub,lineHeight:1.55,marginBottom:10,
            display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>
            {r.ringkasan||"Tidak ada ringkasan..."}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <KategoriTag kategori={r.kategori} />
            <span style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:t.textMuted,fontWeight:500}}>
              <CalendarOutlined style={{fontSize:10}}/>{dayjs(r.tanggal_publish).format("DD MMM YYYY")}
            </span>
            <span style={{fontSize:11,color:`${GOLD_DEEP}`,fontWeight:600}}>{formatHijri(r.tanggal_publish)}</span>
          </div>
        </div>
      ),
    },
    {
      title:"Visibilitas", dataIndex:"status", width:145, search:false,
      filters:[{text:"Tayang",value:"PUBLISHED"},{text:"Draft",value:"DRAFT"},{text:"Arsip",value:"ARCHIVED"}],
      onFilter:(val,r)=>r.status===val,
      render:(_, r)=>(
        <div style={{display:"flex",flexDirection:"column",gap:10,alignItems:"flex-start",paddingTop:4}}>
          <StatusBadge status={r.status}/>
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",
            background:mode==="dark"?"rgba(255,255,255,.04)":"rgba(0,0,0,.03)",
            border:`1px solid ${t.border}`,borderRadius:10}}>
            <Switch size="small" checked={r.status==="PUBLISHED"}
              onChange={()=>handleToggleStatus(r.id,r.status)}
              className="brt-sw"
              style={{background:r.status==="PUBLISHED"?undefined:"rgba(158,144,128,.30)"}}/>
            <span style={{fontSize:11,fontWeight:700,color:r.status==="PUBLISHED"?"#34D399":t.textMuted}}>
              {r.status==="PUBLISHED"?"Aktif":"Nonaktif"}
            </span>
          </div>
        </div>
      ),
    },
    {
      title:"Headline", dataIndex:"is_featured", width:90, align:"center", search:false,
      render:(val,r)=>(
        <Tooltip title={val?"Hapus dari Slider":"Jadikan Slider Utama"}>
          <motion.button whileHover={{scale:1.12}} whileTap={{scale:.92}}
            onClick={()=>handleToggleFeatured(r.id,Boolean(val))}
            style={{width:40,height:40,cursor:"pointer",borderRadius:12,
              display:"flex",alignItems:"center",justifyContent:"center",
              background:val?`linear-gradient(135deg,${GOLD}28,${GOLD_BRIGHT}18)`:mode==="dark"?"rgba(255,255,255,.05)":"rgba(0,0,0,.04)",
              border:val?`1px solid ${GOLD}45`:`1px solid ${t.border}`,
              boxShadow:val?`0 4px 12px ${GOLD}35`:"none",transition:"background .2s,box-shadow .2s"}}>
            {val?<StarFilled style={{fontSize:17,color:GOLD_BRIGHT}}/>:<StarOutlined style={{fontSize:17,color:t.textMuted}}/>}
          </motion.button>
        </Tooltip>
      ),
    },
    {
      title:"Aksi", valueType:"option", width:115, fixed:"right", align:"center",
      render:(_, record)=>(
        <div style={{display:"flex",gap:5,justifyContent:"center"}}>
          <Tooltip title="Preview"><Button size="small" type="text" icon={<EyeOutlined/>}
            onClick={()=>setPreview(record)}
            style={{borderRadius:8,color:t.textSub,background:mode==="dark"?"rgba(255,255,255,.05)":"rgba(0,0,0,.04)"}}/></Tooltip>
          <Tooltip title="Edit"><Button size="small" type="text" icon={<EditOutlined/>}
            onClick={()=>push(`/berita/edit/${record.id}`)}
            style={{borderRadius:8,color:"#60A5FA",background:"rgba(96,165,250,.09)"}}/></Tooltip>
          <Tooltip title="Hapus"><Button size="small" type="text" danger icon={<DeleteOutlined/>}
            onClick={()=>handleDelete(record)}
            style={{borderRadius:8,color:"#F87171",background:"rgba(248,113,113,.09)"}}/></Tooltip>
        </div>
      ),
    },
  ];

  // CARD GRID ITEM
  const ArticleCard = ({ item, idx }: { item: IBerita; idx: number }) => (
    <motion.div className="brt-card"
      initial={{opacity:0,y:16}} animate={{opacity:1,y:0}}
      transition={{duration:.35,delay:idx*.045,ease:[.22,1,.36,1]}}
      style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:18,
        overflow:"hidden",boxShadow:mode==="dark"?"0 4px 20px rgba(0,0,0,.40)":"0 2px 10px rgba(0,0,0,.05)",
        display:"flex",flexDirection:"column",height:"100%"}}>

      {/* Thumbnail */}
      <div style={{position:"relative",aspectRatio:"16/9",flexShrink:0,background:t.surface,overflow:"hidden"}}>
        {typeof item.thumbnail_url==="string" && item.thumbnail_url ? (
          <img src={item.thumbnail_url} alt={item.judul}
            style={{width:"100%",height:"100%",objectFit:"cover",display:"block",transition:"transform .4s"}}
            onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.06)"}}
            onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)"}}/>
        ) : (
          <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",
            background:mode==="dark"?"rgba(255,255,255,.03)":"rgba(0,0,0,.03)"}}>
            <FileTextOutlined style={{fontSize:36,color:t.textMuted,opacity:.35}}/>
          </div>
        )}
        <div style={{position:"absolute",top:10,left:10}}><StatusBadge status={item.status}/></div>
        {item.is_featured && (
          <div style={{position:"absolute",top:10,right:10,width:28,height:28,borderRadius:8,
            background:`linear-gradient(135deg,${GOLD},${GOLD_BRIGHT})`,
            display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 4px 10px ${GOLD}55`}}>
            <StarFilled style={{fontSize:13,color:"#000"}}/>
          </div>
        )}
      </div>

      <div style={{padding:"14px 16px",flex:1,display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
          <KategoriTag kategori={item.kategori} />
          <span style={{fontSize:10,color:t.textMuted,marginLeft:"auto"}}>{dayjs(item.tanggal_publish).format("DD MMM YYYY")}</span>
        </div>
        <div style={{fontWeight:700,fontSize:13,color:t.text,lineHeight:1.4,marginBottom:8,
          display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{item.judul}</div>
        <div style={{fontSize:11,color:t.textSub,lineHeight:1.5,flex:1,marginBottom:14,
          display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical",overflow:"hidden"}}>
          {item.ringkasan||"Tidak ada ringkasan..."}
        </div>
        <div style={{height:1,background:t.divider,marginBottom:12}}/>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <Switch size="small" checked={item.status==="PUBLISHED"}
              onChange={()=>handleToggleStatus(item.id,item.status)}
              className="brt-sw"
              style={{background:item.status==="PUBLISHED"?undefined:"rgba(158,144,128,.28)"}}/>
            <span style={{fontSize:10,fontWeight:700,color:item.status==="PUBLISHED"?"#34D399":t.textMuted}}>
              {item.status==="PUBLISHED"?"TAYANG":"DRAFT"}
            </span>
          </div>
          <div style={{display:"flex",gap:4}}>
            <Tooltip title="Preview"><Button size="small" type="text" icon={<EyeOutlined/>}
              style={{borderRadius:7,color:t.textSub}} onClick={()=>setPreview(item)}/></Tooltip>
            <Tooltip title="Edit"><Button size="small" type="text" icon={<EditOutlined/>}
              style={{borderRadius:7,color:"#60A5FA"}} onClick={()=>push(`/berita/edit/${item.id}`)}/></Tooltip>
            <Tooltip title="Hapus"><Button size="small" type="text" danger icon={<DeleteOutlined/>}
              style={{borderRadius:7,color:"#F87171"}} onClick={()=>handleDelete(item)}/></Tooltip>
          </div>
        </div>
      </div>
    </motion.div>
  );

  // ── RENDER ─────────────────────────────────────────────────────────────
  return (
    <div style={{background:t.bg,minHeight:"100vh",paddingBottom:80}}>
      <style>{buildCSS(mode)}</style>

      {/* HERO BANNER */}
      <div style={{
        background:mode==="dark"
          ?"linear-gradient(135deg,#0E0C07 0%,#151208 50%,#0A0E0C 100%)"
          :"linear-gradient(135deg,#2D2416 0%,#3D3020 50%,#241C10 100%)",
        backgroundImage:ISLAMIC_SVG, backgroundSize:"120px 120px",
        borderRadius:24, padding:"28px 32px", marginBottom:24,
        position:"relative", overflow:"hidden",
        border:`1px solid ${GOLD}18`,
        boxShadow:mode==="dark"
          ?`0 24px 60px rgba(0,0,0,.60),inset 0 1px 0 rgba(201,168,76,.13)`
          :"0 8px 32px rgba(0,0,0,.20)",
      }}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:2,
          background:`linear-gradient(90deg,transparent,${GOLD_BRIGHT},${GOLD},transparent)`,opacity:.8}}/>
        <div style={{position:"absolute",top:-40,right:"20%",width:300,height:200,
          background:`radial-gradient(ellipse,${GOLD}10 0%,transparent 70%)`,pointerEvents:"none"}}/>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
          flexWrap:"wrap",gap:16,position:"relative"}}>
          <div>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"3px",textTransform:"uppercase",
              background:`linear-gradient(90deg,${GOLD},${GOLD_BRIGHT})`,
              WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",marginBottom:6}}>
              ◆ Manajemen Konten ◆
            </div>
            <h1 style={{margin:0,fontSize:"clamp(20px,2.5vw,28px)",fontWeight:800,color:"#F5EDD8",lineHeight:1.2}}>
              Portal Informasi & Berita
            </h1>
            <p style={{margin:"6px 0 0",color:"rgba(245,237,216,.50)",fontSize:13}}>
              {totalAll} artikel tersimpan · {formatHijri(new Date())}
            </p>
          </div>
          <Button type="primary" size="large" icon={<PlusOutlined/>}
            onClick={()=>push("/berita/create")}
            style={{background:`linear-gradient(135deg,${GOLD},${GOLD_BRIGHT})`,
              border:"none",color:"#000",fontWeight:700,borderRadius:12,height:46,
              paddingInline:24,boxShadow:`0 6px 18px ${GOLD}50`}}>
            Tulis Artikel Baru
          </Button>
        </div>
      </div>

      {/* KPI STATS */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12,marginBottom:20}}>
        <StatCard label="Total Artikel"   value={totalAll}       sub="semua status"             icon={<ReadOutlined/>}          color="#60A5FA"  delay={0}   mode={mode}/>
        <StatCard label="Sedang Tayang"   value={totalPublished} sub={`${Math.round(totalPublished/Math.max(totalAll,1)*100)}% dari total`} icon={<CheckCircleFilled/>} color="#34D399" delay={.06} mode={mode}/>
        <StatCard label="Masih Draft"     value={totalDraft}     sub="belum dipublikasi"        icon={<MinusCircleFilled/>}     color="#9E9080"   delay={.12} mode={mode}/>
        <StatCard label="Headline Slider" value={totalFeatured}  sub="tampil di beranda utama"  icon={<CrownOutlined/>}         color={GOLD_BRIGHT} delay={.18} mode={mode}/>
      </div>

      {/* FILTER BAR */}
      <div className="brt-filter" style={{background:t.card,border:`1px solid ${t.border}`,
        borderRadius:16,padding:"14px 18px",marginBottom:16,
        display:"flex",alignItems:"flex-end",gap:14,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,alignSelf:"center"}}>
          <div style={{width:32,height:32,background:`linear-gradient(135deg,${GOLD}20,${GOLD_BRIGHT}14)`,
            border:`1px solid ${GOLD}28`,borderRadius:9,
            display:"flex",alignItems:"center",justifyContent:"center"}}>
            <FilterOutlined style={{color:t.accent,fontSize:13}}/>
          </div>
          <span style={{fontWeight:700,fontSize:13,color:t.textSub,whiteSpace:"nowrap"}}>Filter</span>
        </div>

        <div style={{flex:1,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>
          <div>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:".6px",textTransform:"uppercase",color:t.textMuted,marginBottom:5}}>Judul Artikel</div>
            <Input prefix={<SearchOutlined style={{color:t.textMuted,fontSize:13}}/>}
              placeholder="Cari judul..." value={fSearch}
              onChange={e=>{setFSearch(e.target.value);setPage(1);}}
              style={{borderRadius:10}}/>
          </div>
          <div>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:".6px",textTransform:"uppercase",color:t.textMuted,marginBottom:5}}>Status</div>
            <Select allowClear placeholder="Semua Status" style={{width:"100%"}} value={fStatus}
              onChange={v=>{setFStatus(v);setPage(1);}}
              options={[{label:"🟢 Tayang",value:"PUBLISHED"},{label:"⚪ Draft",value:"DRAFT"},{label:"🟡 Arsip",value:"ARCHIVED"}]}/>
          </div>
          <div>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:".6px",textTransform:"uppercase",color:t.textMuted,marginBottom:5}}>Kategori</div>
            <Select allowClear placeholder="Semua Kategori" style={{width:"100%"}} value={fKategori}
              onChange={v=>{setFKategori(v);setPage(1);}} options={kategoriOptions}/>
          </div>
        </div>

        {/* View toggle */}
        <div style={{display:"flex",gap:4,alignSelf:"flex-end",flexShrink:0}}>
          {[
            {key:"table" as const, icon:<UnorderedListOutlined/>, tip:"Tampilan Tabel"},
            {key:"grid" as const,  icon:<AppstoreOutlined/>,      tip:"Tampilan Grid"}
          ].map(v=>(
            <Tooltip key={v.key} title={v.tip}>
              <button onClick={()=>setViewMode(v.key)} style={{
                width:36,height:36,cursor:"pointer",borderRadius:10,fontSize:15,
                display:"flex",alignItems:"center",justifyContent:"center",
                background:viewMode===v.key?`${t.accent}18`:mode==="dark"?"rgba(255,255,255,.05)":"rgba(0,0,0,.04)",
                color:viewMode===v.key?t.accent:t.textMuted,
                border:`1px solid ${viewMode===v.key?t.borderAccent:t.border}`,transition:"all .15s"}}>
                {v.icon}
              </button>
            </Tooltip>
          ))}
        </div>

        {/* Active chips */}
        {(fStatus||fKategori||fSearch) && (
          <div style={{display:"flex",alignItems:"center",gap:6,alignSelf:"flex-end",flexWrap:"wrap"}}>
            <span style={{fontSize:10,color:t.textMuted}}>Aktif:</span>
            {fStatus   && <span style={{fontSize:10,color:"#34D399",background:"rgba(52,211,153,.10)",border:"1px solid rgba(52,211,153,.25)",borderRadius:8,padding:"2px 8px",fontWeight:700}}>{fStatus}</span>}
            {fKategori && <span style={{fontSize:10,color:"#60A5FA",background:"rgba(96,165,250,.10)",border:"1px solid rgba(96,165,250,.25)",borderRadius:8,padding:"2px 8px",fontWeight:700}}>{fKategori}</span>}
            {fSearch   && <span style={{fontSize:10,color:t.accent, background:`${t.accent}14`,       border:`1px solid ${t.accent}28`,         borderRadius:8,padding:"2px 8px",fontWeight:700}}>"{fSearch}"</span>}
            <button onClick={()=>{setFStatus(null);setFKategori(null);setFSearch("");setPage(1);}}
              style={{fontSize:10,fontWeight:700,color:"#F87171",background:"rgba(248,113,113,.10)",
                border:"1px solid rgba(248,113,113,.25)",borderRadius:8,padding:"2px 8px",cursor:"pointer"}}>
              Reset ✕
            </button>
          </div>
        )}
      </div>

      {/* CONTENT */}
      <AnimatePresence mode="wait">

        {/* TABLE VIEW */}
        {viewMode==="table" && (
          <motion.div key="table"
            initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
            exit={{opacity:0,y:-6}} transition={{duration:.28}}>
            <ProTable
              dataSource={filteredData}
              loading={tableQueryResult.isLoading}
              columns={columns}
              rowKey="id"
              search={false}
              options={false}
              className="berita-table"
              style={{borderRadius:20,overflow:"hidden",border:`1px solid ${t.border}`}}
              ghost
              scroll={{x:900}}
              pagination={{
                pageSize:10, showSizeChanger:true,
                showTotal:(total,range)=>(
                  <span style={{fontSize:12,color:t.textMuted,fontWeight:600}}>
                    {range[0]}–{range[1]} dari {total} artikel
                  </span>
                ),
              }}
              headerTitle={
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:36,height:36,background:`linear-gradient(135deg,${GOLD}20,${GOLD_BRIGHT}14)`,
                    border:`1px solid ${GOLD}25`,borderRadius:10,
                    display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <ReadOutlined style={{color:t.accent,fontSize:16}}/>
                  </div>
                  <div>
                    <div style={{fontWeight:800,fontSize:15,color:t.text}}>Daftar Artikel</div>
                    <div style={{fontSize:11,color:t.textMuted}}>
                      {filteredData.length} artikel{fStatus||fKategori||fSearch?" (difilter)":""}
                    </div>
                  </div>
                </div>
              }
              toolBarRender={()=>[]}
            />
          </motion.div>
        )}

        {/* GRID VIEW */}
        {viewMode==="grid" && (
          <motion.div key="grid"
            initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
            exit={{opacity:0,y:-6}} transition={{duration:.28}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:4,height:22,borderRadius:4,background:`linear-gradient(180deg,${GOLD},${GOLD_BRIGHT})`}}/>
                <span style={{fontWeight:700,fontSize:15,color:t.text}}>Tampilan Grid</span>
                <span style={{fontSize:10,fontWeight:700,color:t.accent,background:`${t.accent}14`,
                  border:`1px solid ${t.accent}28`,borderRadius:20,padding:"2px 9px"}}>
                  {filteredData.length} artikel
                </span>
              </div>
            </div>

            {filteredData.length===0 ? (
              <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:20,padding:"60px 0",
                display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12}}>
                <FileTextOutlined style={{fontSize:48,color:t.textMuted,opacity:.4}}/>
                <div style={{fontWeight:600,color:t.textSub}}>Tidak ada artikel ditemukan</div>
                <div style={{fontSize:12,color:t.textMuted}}>Coba ubah filter atau tulis artikel baru</div>
              </div>
            ) : (
              <>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",
                  gap:16,marginBottom:20}}>
                  {pagedData.map((item,idx)=><ArticleCard key={item.id} item={item} idx={idx}/>)}
                </div>
                {filteredData.length>PAGE_SIZE && (
                  <div style={{display:"flex",justifyContent:"center",gap:8,marginTop:4}}>
                    <Button disabled={page===1} onClick={()=>setPage(p=>p-1)}
                      style={{borderRadius:9,borderColor:t.border,color:t.textSub}}>← Sebelumnya</Button>
                    <span style={{display:"flex",alignItems:"center",gap:6,fontSize:12,
                      fontWeight:700,color:t.textSub,padding:"0 12px"}}>
                      Hal {page} / {Math.ceil(filteredData.length/PAGE_SIZE)}
                    </span>
                    <Button disabled={page>=Math.ceil(filteredData.length/PAGE_SIZE)} onClick={()=>setPage(p=>p+1)}
                      style={{borderRadius:9,borderColor:t.border,color:t.textSub}}>Berikutnya →</Button>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* PREVIEW MODAL */}
      <Modal
        open={!!preview} onCancel={()=>setPreview(null)}
        footer={
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",
            padding:"12px 20px",borderTop:`1px solid ${t.divider}`}}>
            <Button onClick={()=>setPreview(null)} style={{borderRadius:10}}>Tutup</Button>
            <Button type="primary" icon={<EditOutlined/>}
              onClick={()=>{push(`/berita/edit/${preview?.id}`);setPreview(null);}}
              style={{background:`linear-gradient(135deg,${GOLD},${GOLD_BRIGHT})`,
                border:"none",color:"#000",fontWeight:700,borderRadius:10}}>
              Edit Artikel
            </Button>
          </div>
        }
        centered width={640} className="brt-modal"
        styles={{
          content:{background:t.card,border:`1px solid ${t.border}`,borderRadius:20,padding:0,overflow:"hidden"},
          mask:{backdropFilter:"blur(5px)",background:"rgba(0,0,0,.55)"},
        }}
      >
        {preview && (
          <div>
            {typeof preview.thumbnail_url==="string" && preview.thumbnail_url && (
              <div style={{aspectRatio:"16/9",overflow:"hidden",borderRadius:"20px 20px 0 0",position:"relative"}}>
                <img src={preview.thumbnail_url} alt={preview.judul}
                  style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
                <div style={{position:"absolute",inset:0,
                  background:"linear-gradient(to bottom,transparent 40%,rgba(0,0,0,.55) 100%)"}}/>
                <div style={{position:"absolute",bottom:14,left:16,display:"flex",gap:8}}>
                  <StatusBadge status={preview.status}/>
                  {preview.is_featured && (
                    <span style={{display:"inline-flex",alignItems:"center",gap:4,
                      padding:"4px 10px",borderRadius:20,fontSize:10,fontWeight:800,
                      background:`linear-gradient(135deg,${GOLD}80,${GOLD_BRIGHT}80)`,color:"#000"}}>
                      <StarFilled/> HEADLINE
                    </span>
                  )}
                </div>
              </div>
            )}
            <div style={{padding:"20px 24px"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                <KategoriTag kategori={preview.kategori} />
                <span style={{fontSize:11,color:t.textMuted}}>
                  <CalendarOutlined style={{marginRight:4}}/>
                  {dayjs(preview.tanggal_publish).format("dddd, DD MMMM YYYY")}
                </span>
                <span style={{fontSize:11,color:GOLD_DEEP,fontWeight:600}}>{formatHijri(preview.tanggal_publish)}</span>
              </div>
              <h2 style={{margin:"0 0 10px",fontSize:20,fontWeight:800,color:t.text,lineHeight:1.3}}>
                {preview.judul}
              </h2>
              {preview.ringkasan && (
                <div style={{fontSize:13,color:t.textSub,lineHeight:1.65,padding:"12px 14px",
                  background:mode==="dark"?"rgba(201,168,76,.06)":"rgba(201,168,76,.05)",
                  border:`1px solid ${GOLD}20`,borderRadius:10,
                  borderLeft:`3px solid ${GOLD}60`,fontStyle:"italic"}}>
                  {preview.ringkasan}
                </div>
              )}
              <div style={{marginTop:16,padding:"12px 14px",background:t.surface,
                border:`1px solid ${t.border}`,borderRadius:12,
                display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <Switch size="small" checked={preview.status==="PUBLISHED"} className="brt-sw"
                    onChange={()=>{
                      handleToggleStatus(preview.id,preview.status);
                      setPreview(p=>p?{...p,status:p.status==="PUBLISHED"?"DRAFT":"PUBLISHED"}:null);
                    }}
                    style={{background:preview.status==="PUBLISHED"?undefined:"rgba(158,144,128,.30)"}}/>
                  <span style={{fontSize:12,fontWeight:700,color:preview.status==="PUBLISHED"?"#34D399":t.textMuted}}>
                    {preview.status==="PUBLISHED"?"Sedang Tayang":"Mode Draft"}
                  </span>
                </div>
                <button onClick={()=>{
                    handleToggleFeatured(preview.id,Boolean(preview.is_featured));
                    setPreview(p=>p?{...p,is_featured:!p.is_featured}:null);
                  }}
                  style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",
                    background:preview.is_featured?`linear-gradient(135deg,${GOLD}22,${GOLD_BRIGHT}14)`:"transparent",
                    border:`1px solid ${preview.is_featured?GOLD+"40":t.border}`,
                    borderRadius:8,cursor:"pointer",transition:"all .2s",
                    color:preview.is_featured?GOLD_BRIGHT:t.textMuted,
                    fontSize:12,fontWeight:700}}>
                  {preview.is_featured?<StarFilled/>:<StarOutlined/>}
                  {preview.is_featured?"Headline Aktif":"Jadikan Headline"}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
