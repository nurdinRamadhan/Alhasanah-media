import React, { useState, useMemo } from "react";
import { useTable } from "@refinedev/antd";
import { ProTable } from "@ant-design/pro-components";
import type { ProColumns } from "@ant-design/pro-components";
import {
    Tag, Typography, Avatar, Card, Space, Button, Select,
    DatePicker, theme, Row, Col, Statistic, Progress, Tooltip,
    Badge, Modal,
} from "antd";
import { motion } from "framer-motion";
import {
    SafetyCertificateOutlined, UserOutlined, ClockCircleOutlined,
    FilterOutlined, EyeOutlined, ClearOutlined, CalendarOutlined,
    EditOutlined, DeleteOutlined, LoginOutlined, PlusCircleOutlined,
    LockOutlined, DatabaseOutlined, BarChartOutlined, TeamOutlined,
    WarningOutlined, CheckCircleOutlined, ThunderboltOutlined,
    FileTextOutlined, DownloadOutlined, InfoCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
dayjs.extend(isBetween);
import "dayjs/locale/id";
import { IAuditLog } from "../../types";
import { formatHijri, formatMasehi } from "../../utility/dateHelper";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

dayjs.locale("id");
const { Text }       = Typography;
const { RangePicker} = DatePicker;
const { useToken }   = theme;

// ═══════════════════════════════════════════════════════════════
// 🎨  BRAND TOKENS
// ═══════════════════════════════════════════════════════════════
const GOLD       = "#D4A017";
const GOLD_LIGHT = "#F0C040";
const GOLD_DARK  = "#9A7A00";
const G          = (o: number) => `rgba(212,160,23,${o})`;

const C = {
    create  : { base:"#22C55E", light:"#F0FDF4", dark:"rgba(34,197,94,0.12)",   border:"rgba(34,197,94,0.28)",  glow:"rgba(34,197,94,0.3)"   },
    update  : { base:"#F59E0B", light:"#FFFBEB", dark:"rgba(245,158,11,0.12)",  border:"rgba(245,158,11,0.28)", glow:"rgba(245,158,11,0.3)"  },
    delete  : { base:"#EF4444", light:"#FFF1F2", dark:"rgba(239,68,68,0.12)",   border:"rgba(239,68,68,0.28)",  glow:"rgba(239,68,68,0.3)"   },
    login   : { base:"#8B5CF6", light:"#F5F3FF", dark:"rgba(139,92,246,0.12)",  border:"rgba(139,92,246,0.28)", glow:"rgba(139,92,246,0.3)"  },
    read    : { base:"#3B82F6", light:"#EFF6FF", dark:"rgba(59,130,246,0.12)",  border:"rgba(59,130,246,0.28)", glow:"rgba(59,130,246,0.3)"  },
    logout  : { base:"#64748B", light:"#F8FAFC", dark:"rgba(100,116,139,0.12)", border:"rgba(100,116,139,0.28)",glow:"rgba(100,116,139,0.3)" },
} as const;

const ACTION_META: Record<string, {
    color: typeof C[keyof typeof C]; icon: React.ReactNode; label: string;
}> = {
    CREATE : { color: C.create, icon: <PlusCircleOutlined />, label: "CREATE"  },
    UPDATE : { color: C.update, icon: <EditOutlined />,       label: "UPDATE"  },
    DELETE : { color: C.delete, icon: <DeleteOutlined />,     label: "DELETE"  },
    LOGIN  : { color: C.login,  icon: <LoginOutlined />,      label: "LOGIN"   },
    LOGOUT : { color: C.logout, icon: <LockOutlined />,       label: "LOGOUT"  },
    READ   : { color: C.read,   icon: <EyeOutlined />,        label: "READ"    },
    EXPORT : { color: C.read,   icon: <DownloadOutlined />,   label: "EXPORT"  },
};
const getActionMeta = (action: string) =>
    ACTION_META[action?.toUpperCase()] ??
    { color: C.read, icon: <ThunderboltOutlined />, label: action };

// ── Resource-label cleanup ──
const cleanResource = (r: string) =>
    (r ?? "").replace(/_/g," ").replace(/\b\w/g, c => c.toUpperCase());

// ═══════════════════════════════════════════════════════════════
// 🎨  INJECTED PREMIUM CSS
// ═══════════════════════════════════════════════════════════════
const AUDIT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;900&family=Outfit:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

  .al-root { font-family:'Outfit','PingFang SC',system-ui,sans-serif; }

  @keyframes al-shimmer {
    0%   { background-position:-200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes al-pulse {
    0%,100% { box-shadow:0 0 0 0 rgba(139,92,246,0.4); }
    60%      { box-shadow:0 0 0 8px rgba(139,92,246,0); }
  }
  @keyframes al-float {
    0%,100% { transform:translateY(0); }
    50%      { transform:translateY(-4px); }
  }
  @keyframes al-blink {
    0%,100% { opacity:1; }
    50%      { opacity:0.3; }
  }

  .al-shimmer {
    background:linear-gradient(120deg,#9A7A00 0%,#D4A017 28%,#F5D060 50%,#D4A017 72%,#9A7A00 100%);
    background-size:200% auto;
    -webkit-background-clip:text;
    -webkit-text-fill-color:transparent;
    background-clip:text;
    animation:al-shimmer 5s linear infinite;
  }
  .al-float     { animation:al-float 3.8s ease-in-out infinite; }
  .al-kpi:hover { transform:translateY(-5px); }
  .al-kpi       { transition:transform .28s cubic-bezier(.4,0,.2,1),box-shadow .28s cubic-bezier(.4,0,.2,1); }

  /* live dot */
  .al-live { animation:al-blink 1.8s ease-in-out infinite; }

  /* ProTable gold header */
  .al-table .ant-table-thead > tr > th,
  .al-table .ant-table-thead > tr > td {
    background:linear-gradient(135deg,#9A7A00 0%,#C8970E 40%,#D4A017 70%,#B89010 100%) !important;
    color:#fff !important;
    font-family:'Outfit',sans-serif !important;
    font-weight:700 !important;
    font-size:10.5px !important;
    letter-spacing:.09em !important;
    text-transform:uppercase !important;
    border-bottom:none !important;
    padding-top:13px !important;
    padding-bottom:13px !important;
  }
  .al-table .ant-table-thead > tr > th::before { display:none !important; }
  .al-table .ant-table-tbody > tr > td {
    padding:13px 16px !important;
    border-bottom:1px solid rgba(212,160,23,.08) !important;
    vertical-align:middle !important;
    transition:background .14s ease;
  }
  .al-table .ant-table-tbody > tr:hover > td {
    background:rgba(212,160,23,.05) !important;
  }
  /* DELETE row — subtle red tint */
  .al-row-delete > td { background:rgba(239,68,68,.03) !important; }
  .al-row-delete:hover > td { background:rgba(239,68,68,.07) !important; }

  .al-table .ant-table-container { border-radius:0 0 14px 14px !important; overflow:hidden !important; }
  .al-table .ant-pro-table-list-toolbar { padding:14px 20px !important; }

  .al-mono { font-family:'DM Mono','Courier New',monospace !important; }
  .al-filter-label {
    font-size:10px; font-weight:700; text-transform:uppercase;
    letter-spacing:.08em; margin-bottom:5px; display:block;
  }

  ::-webkit-scrollbar { width:5px; height:5px; }
  ::-webkit-scrollbar-track  { background:transparent; }
  ::-webkit-scrollbar-thumb  { background:rgba(212,160,23,.3); border-radius:3px; }
  ::-webkit-scrollbar-thumb:hover { background:rgba(212,160,23,.65); }
`;

// ═══════════════════════════════════════════════════════════════
// 🚀  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export const AuditLogList: React.FC = () => {
    const { token } = useToken();

    const hexLum = (hex: string) => {
        const c = hex.replace("#","");
        if (c.length < 6) return 200;
        return .299*parseInt(c.slice(0,2),16)
             + .587*parseInt(c.slice(2,4),16)
             + .114*parseInt(c.slice(4,6),16);
    };
    const isDark = hexLum(token.colorBgContainer) < 128;

    // ── Table ────────────────────────────────────────────
    const { tableProps, tableQueryResult } = useTable<IAuditLog>({
        resource: "audit_logs",
        syncWithLocation: false,
        sorters: { initial: [{ field: "created_at", order: "desc" }] },
    });

    const rawData = tableQueryResult?.data?.data ?? [];

    // ── Filter State ─────────────────────────────────────
    const [dateRange,    setDateRange]    = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
        dayjs().startOf("month"), dayjs().endOf("month")
    ]);
    const [actionFilter, setActionFilter] = useState("all");
    const [roleFilter,   setRoleFilter]   = useState("all");
    const [searchUser,   setSearchUser]   = useState("");
    const [isExporting,  setIsExporting]  = useState(false);

    // ── Detail Modal ─────────────────────────────────────
    const [detailRecord, setDetailRecord] = useState<IAuditLog | null>(null);

    // ── Client filter ─────────────────────────────────────
    const filteredData = useMemo(() => {
        return rawData.filter(r => {
            const inRange = dayjs(r.created_at).isBetween(
                dateRange[0].startOf("day"),
                dateRange[1].endOf("day"),
                null, "[]"
            );
            if (!inRange) return false;
            if (actionFilter !== "all" && r.action?.toUpperCase() !== actionFilter) return false;
            if (roleFilter   !== "all" && r.user_role !== roleFilter)               return false;
            if (searchUser && !r.user_name?.toLowerCase().includes(searchUser.toLowerCase())) return false;
            return true;
        });
    }, [rawData, dateRange, actionFilter, roleFilter, searchUser]);

    // ── KPI ──────────────────────────────────────────────
    const kpi = useMemo(() => {
        const byAction = (a: string) => filteredData.filter(r => r.action?.toUpperCase() === a).length;
        const uniqueUsers = new Set(filteredData.map(r => r.user_name)).size;
        const deleteCount = byAction("DELETE");
        const todayCount  = filteredData.filter(r => dayjs(r.created_at).isSame(dayjs(),"day")).length;
        return {
            total:   filteredData.length,
            creates: byAction("CREATE"),
            updates: byAction("UPDATE"),
            deletes: deleteCount,
            logins:  byAction("LOGIN"),
            reads:   byAction("READ"),
            uniqueUsers,
            todayCount,
            dangerPct: filteredData.length > 0 ? Math.round((deleteCount / filteredData.length) * 100) : 0,
        };
    }, [filteredData]);

    const activeFilters = [
        actionFilter !== "all",
        roleFilter   !== "all",
        searchUser   !== "",
    ].filter(Boolean).length;

    // ── Export Excel ──────────────────────────────────────
    const handleExport = async () => {
        setIsExporting(true);
        const key = "al_export";
        try {
            const wb = new ExcelJS.Workbook();
            wb.creator = "Sistem Informasi Al-Hasanah";
            wb.created = new Date();

            const CGOLD    = "FFD4A017";
            const CGOLDBG  = "FFFDF6DC";
            const CGOLDDARK= "FF9A7A00";
            const CWHITE   = "FFFFFFFF";
            const CBLACK   = "FF111111";
            const CGREEN   = "FF22C55E";
            const CRED     = "FFEF4444";
            const CORANGE  = "FFF59E0B";
            const CPURPLE  = "FF8B5CF6";
            const CBLUE    = "FF3B82F6";
            const CSTRIPE  = "FFFFFBF0";

            const borderThin   = { style:"thin"   as const, color:{ argb:"FFE5E7EB" } };
            const borderMedium = { style:"medium"  as const, color:{ argb:CGOLD      } };
            const allThin  = { top:borderThin,   left:borderThin,   bottom:borderThin,   right:borderThin   };
            const allMed   = { top:borderMedium, left:borderMedium, bottom:borderMedium, right:borderMedium };

            const ws = wb.addWorksheet("Audit Trail Log", {
                properties: { tabColor: { argb: CGOLD } }
            });
            ws.views = [{ state:"frozen", ySplit:9, showGridLines:false }];

            // Kop surat
            ws.mergeCells("A1:I1");
            const t1 = ws.getCell("A1");
            t1.value     = "PONDOK PESANTREN AL-HASANAH";
            t1.font      = { name:"Arial", size:16, bold:true, color:{argb:CGOLDDARK} };
            t1.alignment = { horizontal:"center", vertical:"middle" };
            t1.fill      = { type:"pattern", pattern:"solid", fgColor:{argb:CGOLDBG} };
            ws.getRow(1).height = 32;

            ws.mergeCells("A2:I2");
            ws.getCell("A2").value     = "Jl. Raya Cibeuti No.13, Cibeuti, Kec. Kawalu, Tasikmalaya — Jawa Barat 46182";
            ws.getCell("A2").font      = { name:"Arial", size:9, italic:true, color:{argb:"FF555555"} };
            ws.getCell("A2").alignment = { horizontal:"center" };

            ws.mergeCells("A3:I3");
            ws.getCell("A3").fill = { type:"pattern", pattern:"solid", fgColor:{argb:CGOLD} };
            ws.getRow(3).height   = 4;

            ws.addRow([]);

            ws.mergeCells("A5:I5");
            ws.getCell("A5").value     = "LAPORAN AUDIT TRAIL & KEAMANAN SISTEM";
            ws.getCell("A5").font      = { name:"Arial", size:13, bold:true };
            ws.getCell("A5").alignment = { horizontal:"center" };

            ws.mergeCells("A6:I6");
            ws.getCell("A6").value = `Periode: ${dateRange[0].format("DD MMMM YYYY")} s/d ${dateRange[1].format("DD MMMM YYYY")}  |  Total: ${filteredData.length} aktivitas  |  Dicetak: ${dayjs().format("DD MMM YYYY HH:mm")}`;
            ws.getCell("A6").font      = { name:"Arial", size:9, color:{argb:"FF777777"} };
            ws.getCell("A6").alignment = { horizontal:"center" };

            ws.addRow([]);

            // Header
            const headers = ["NO","WAKTU","WAKTU HIJRIAH","AKTOR","ROLE","AKSI","TARGET RESOURCE","ID RECORD","DETAIL PERUBAHAN"];
            const hRow = ws.getRow(8);
            hRow.height = 26;
            headers.forEach((label, i) => {
                const cell = hRow.getCell(i+1);
                cell.value     = label;
                cell.font      = { name:"Arial", size:10, bold:true, color:{argb:CWHITE} };
                cell.fill      = { type:"pattern", pattern:"solid", fgColor:{argb:CGOLD} };
                cell.alignment = { vertical:"middle", horizontal:"center" };
                cell.border    = allMed;
            });

            // Action color map
            const actionArgb: Record<string,string> = {
                CREATE:"FF22C55E", UPDATE:"FFF59E0B", DELETE:"FFEF4444",
                LOGIN:"FF8B5CF6", LOGOUT:"FF64748B", READ:"FF3B82F6", EXPORT:"FF3B82F6",
            };

            filteredData.forEach((r, i) => {
                const row = ws.addRow([
                    i+1,
                    dayjs(r.created_at).format("DD/MM/YYYY HH:mm:ss"),
                    formatHijri(r.created_at),
                    r.user_name || "—",
                    r.user_role || "—",
                    r.action?.toUpperCase() || "—",
                    cleanResource(r.resource),
                    r.record_id !== "-" ? r.record_id : "—",
                    typeof r.details === "object"
                        ? JSON.stringify(r.details).substring(0, 120)
                        : String(r.details ?? "").substring(0, 120),
                ]);
                row.height = 20;

                row.eachCell((cell, ci) => {
                    cell.font      = { name:"Arial", size:9.5, color:{argb:CBLACK} };
                    cell.fill      = { type:"pattern", pattern:"solid", fgColor:{argb: i%2===0 ? CWHITE : CSTRIPE} };
                    cell.alignment = { vertical:"middle", horizontal:"left" };
                    cell.border    = allThin;
                    if ([1,6].includes(ci)) cell.alignment = { ...cell.alignment, horizontal:"center" };
                });

                // Action cell color
                const actionKey = r.action?.toUpperCase();
                if (actionKey && actionArgb[actionKey]) {
                    row.getCell(6).font = { name:"Arial", size:9.5, bold:true, color:{ argb: actionArgb[actionKey] } };
                }
                // DELETE row highlight
                if (actionKey === "DELETE") {
                    row.eachCell(cell => {
                        cell.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:"FFFFF1F2" } };
                    });
                }
            });

            // Footer
            const fRow = ws.addRow(["","","","","","","","TOTAL AKTIVITAS →", filteredData.length]);
            fRow.height = 26;
            fRow.getCell(8).font      = { name:"Arial", size:10, bold:true, color:{argb:CGOLDDARK} };
            fRow.getCell(8).alignment = { horizontal:"right" };
            fRow.getCell(9).font      = { name:"Courier New", size:12, bold:true, color:{argb:CGOLDDARK} };
            fRow.getCell(9).fill      = { type:"pattern", pattern:"solid", fgColor:{argb:CGOLDBG} };
            fRow.getCell(9).border    = allMed;

            ws.autoFilter = "A8:I8";
            [5,22,24,28,18,12,28,22,50].forEach((w,i) => { ws.getColumn(i+1).width = w; });

            const buf = await wb.xlsx.writeBuffer();
            saveAs(new Blob([buf]), `AuditTrail_AlHasanah_${dayjs().format("YYYYMMDD_HHmm")}.xlsx`);
        } catch(e: any) {
            console.error(e);
        } finally {
            setIsExporting(false);
        }
    };

    // ── Helper: avatar color per role ─────────────────────
    const roleAvatarColor = (role: string) => {
        const map: Record<string,string> = {
            admin:     GOLD_DARK,
            superadmin:"#8B5CF6",
            pengurus:  "#3B82F6",
            wali:      "#22C55E",
        };
        return map[role?.toLowerCase()] ?? "#64748B";
    };

    // ── COLUMNS ──────────────────────────────────────────
    const columns: ProColumns<IAuditLog>[] = [
        {
            title: "Waktu",
            dataIndex: "created_at",
            width: 165,
            fixed: "left",
            render: (val) => {
                const d = dayjs(val as string);
                const isToday = d.isSame(dayjs(), "day");
                return (
                    <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            {isToday && (
                                <div className="al-live" style={{
                                    width:6, height:6, borderRadius:"50%",
                                    background: C.create.base, flexShrink:0
                                }} />
                            )}
                            <Text style={{
                                fontWeight:700, fontSize:13, color:token.colorText,
                                display:"block", lineHeight:"1.2"
                            }}>
                                {d.format("DD MMM YYYY")}
                            </Text>
                        </div>
                        <Text className="al-mono" style={{
                            fontSize:11, color:token.colorTextSecondary,
                            display:"block", letterSpacing:"0.02em"
                        }}>
                            {d.format("HH:mm:ss")} WIB
                        </Text>
                        <Text style={{ fontSize:9.5, color:G(isDark?.7:.55) }}>
                            {formatHijri(val as string)}
                        </Text>
                    </div>
                );
            }
        },
        {
            title: "Aktor",
            dataIndex: "user_name",
            width: 200,
            render: (_, r) => (
                <Space size={10} align="center">
                    <Avatar
                        size={40}
                        icon={<UserOutlined />}
                        style={{
                            background: roleAvatarColor(r.user_role),
                            border:`2px solid ${roleAvatarColor(r.user_role)}55`,
                            flexShrink:0, fontSize:16,
                        }}
                    />
                    <div style={{ display:"flex", flexDirection:"column", gap:4, minWidth:0 }}>
                        <Text style={{
                            fontWeight:700, fontSize:13, color:token.colorText,
                            display:"block", lineHeight:"1.2",
                            whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"
                        }}>
                            {r.user_name || "—"}
                        </Text>
                        <Tag
                            icon={<TeamOutlined />}
                            style={{
                                background: isDark
                                    ? `${roleAvatarColor(r.user_role)}22`
                                    : `${roleAvatarColor(r.user_role)}15`,
                                color:   roleAvatarColor(r.user_role),
                                border: `1px solid ${roleAvatarColor(r.user_role)}44`,
                                borderRadius:6, fontSize:9.5, fontWeight:700,
                                padding:"0 7px", margin:0, letterSpacing:"0.04em",
                                textTransform:"uppercase",
                                display:"inline-flex", alignItems:"center", gap:4,
                            }}
                        >
                            {r.user_role || "user"}
                        </Tag>
                    </div>
                </Space>
            )
        },
        {
            title: "Aksi",
            dataIndex: "action",
            width: 115,
            align: "center",
            render: (val) => {
                const meta = getActionMeta(val as string);
                return (
                    <Tag
                        icon={meta.icon}
                        style={{
                            background: isDark ? meta.color.dark : meta.color.light,
                            color:       meta.color.base,
                            border:      `1px solid ${meta.color.border}`,
                            borderRadius:20, fontWeight:800, fontSize:10.5,
                            padding:"3px 11px",
                            display:"inline-flex", alignItems:"center", gap:4,
                            boxShadow:`0 2px 8px ${meta.color.glow}`,
                            letterSpacing:"0.04em",
                        }}
                    >
                        {meta.label}
                    </Tag>
                );
            }
        },
        {
            title: "Target Resource",
            dataIndex: "resource",
            width: 220,
            render: (val, r) => (
                <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <div style={{
                            width:3, height:32, borderRadius:2, flexShrink:0,
                            background:`linear-gradient(to bottom, ${GOLD_LIGHT}, ${GOLD_DARK})`
                        }} />
                        <div>
                            <Text style={{
                                fontWeight:700, fontSize:13, color:token.colorText,
                                display:"block", lineHeight:"1.2"
                            }}>
                                {cleanResource(val as string)}
                            </Text>
                            {r.record_id && r.record_id !== "-" && (
                                <Text className="al-mono" style={{
                                    fontSize:10, color:token.colorTextSecondary,
                                    marginTop:2, display:"block"
                                }}>
                                    #{String(r.record_id).substring(0, 16)}
                                    {String(r.record_id).length > 16 ? "…" : ""}
                                </Text>
                            )}
                        </div>
                    </div>
                </div>
            )
        },
        {
            title: "Detail Perubahan",
            dataIndex: "details",
            width: 260,
            render: (val, r) => {
                if (!val) return (
                    <Text style={{ color:token.colorTextDisabled, fontSize:12, fontStyle:"italic" }}>—</Text>
                );
                const str = typeof val === "object"
                    ? JSON.stringify(val)
                    : String(val);
                const preview = str.substring(0, 90) + (str.length > 90 ? "…" : "");
                return (
                    <div style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
                        <div style={{
                            flex:1,
                            background: isDark ? "rgba(255,255,255,0.04)" : token.colorBgTextHover,
                            border:`1px solid ${isDark?"rgba(255,255,255,0.08)":token.colorBorderSecondary}`,
                            borderRadius:8, padding:"7px 10px",
                            cursor:"pointer",
                        }}
                            onClick={() => setDetailRecord(r)}
                        >
                            <Text className="al-mono" style={{
                                fontSize:10, color:token.colorTextSecondary,
                                display:"block", lineHeight:1.6, wordBreak:"break-all"
                            }}>
                                {preview}
                            </Text>
                        </div>
                        {str.length > 90 && (
                            <Tooltip title="Lihat detail lengkap">
                                <Button
                                    type="text"
                                    size="small"
                                    icon={<EyeOutlined />}
                                    onClick={() => setDetailRecord(r)}
                                    style={{
                                        width:28, height:28, borderRadius:7, flexShrink:0,
                                        background:G(isDark?.15:.08),
                                        color:isDark?GOLD_LIGHT:GOLD_DARK,
                                        border:`1px solid ${G(isDark?.3:.2)}`,
                                        display:"flex", alignItems:"center", justifyContent:"center",
                                    }}
                                />
                            </Tooltip>
                        )}
                    </div>
                );
            }
        },
    ];

    // ── Design tokens ─────────────────────────────────────
    const cardBase: React.CSSProperties = {
        borderRadius:16,
        border:`1px solid ${G(isDark?.22:.13)}`,
        background:token.colorBgContainer,
    };

    const kpiDefs = [
        { key:"total",   label:"Total Aktivitas",  value:kpi.total,       color:{ base:isDark?GOLD_LIGHT:GOLD_DARK, light:"#FDF6DC", dark:G(.12), border:G(.28), glow:G(.28) }, icon:<BarChartOutlined />    },
        { key:"creates", label:"Insert / Create",  value:kpi.creates,     color:C.create, icon:<PlusCircleOutlined /> },
        { key:"updates", label:"Edit / Update",    value:kpi.updates,     color:C.update, icon:<EditOutlined />       },
        { key:"deletes", label:"Hapus / Delete",   value:kpi.deletes,     color:C.delete, icon:<DeleteOutlined />     },
        { key:"logins",  label:"Login Sesi",       value:kpi.logins,      color:C.login,  icon:<LoginOutlined />      },
        { key:"users",   label:"Pengguna Aktif",   value:kpi.uniqueUsers, color:C.read,   icon:<TeamOutlined />       },
    ];

    return (
        <div className="al-root" style={{ display:"flex", flexDirection:"column", gap:20, paddingBottom:80 }}>
            <style>{AUDIT_CSS}</style>

            {/* ╔══════════════════════════════════════════╗
                ║          HERO HEADER BANNER              ║
                ╚══════════════════════════════════════════╝ */}
            <motion.div
                initial={{ opacity:0, y:-18 }} animate={{ opacity:1, y:0 }}
                transition={{ duration:.48, ease:"easeOut" }}
                style={{
                    background: isDark
                        ? `linear-gradient(135deg,${G(.14)} 0%,${G(.06)} 50%,transparent 100%)`
                        : `linear-gradient(135deg,#F8F0D0 0%,#FFF9EE 55%,#FFFFFF 100%)`,
                    borderRadius:20, padding:"22px 28px",
                    border:`1px solid ${G(isDark?.3:.22)}`,
                    position:"relative", overflow:"hidden",
                }}
            >
                <div style={{ position:"absolute", top:-50, right:-50, width:230, height:230, borderRadius:"50%", background:`radial-gradient(circle,${G(.13)} 0%,transparent 70%)`, pointerEvents:"none" }} />
                <div style={{ position:"absolute", bottom:-30, left:180, width:160, height:160, borderRadius:"50%", background:`radial-gradient(circle,${G(.06)} 0%,transparent 70%)`, pointerEvents:"none" }} />

                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:16, position:"relative" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:18 }}>
                        <div className="al-float" style={{
                            width:60, height:60, borderRadius:18,
                            background:`linear-gradient(135deg,${GOLD},${GOLD_DARK})`,
                            display:"flex", alignItems:"center", justifyContent:"center",
                            boxShadow:`0 8px 26px ${G(.5)}`, flexShrink:0,
                        }}>
                            <SafetyCertificateOutlined style={{ color:"#fff", fontSize:26 }} />
                        </div>
                        <div>
                            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:5 }}>
                                <h1 className="al-shimmer" style={{
                                    fontFamily:"'Cinzel','Georgia',serif",
                                    fontSize:20, fontWeight:700, margin:0, letterSpacing:"0.03em"
                                }}>
                                    Audit Trail & Keamanan
                                </h1>
                                <Tag style={{
                                    background:`linear-gradient(135deg,${GOLD},${GOLD_DARK})`,
                                    color:"#fff", border:"none", borderRadius:7,
                                    fontWeight:700, fontSize:9.5, letterSpacing:"0.12em", padding:"1px 9px"
                                }}>READ-ONLY</Tag>
                                {kpi.todayCount > 0 && (
                                    <Tag style={{
                                        background:isDark?C.login.dark:C.login.light,
                                        color:C.login.base, border:`1px solid ${C.login.border}`,
                                        borderRadius:7, fontSize:9.5, fontWeight:700, padding:"1px 9px"
                                    }}>
                                        <span className="al-live" style={{ marginRight:5 }}>●</span>
                                        {kpi.todayCount} Aktivitas Hari Ini
                                    </Tag>
                                )}
                            </div>
                            <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                                <span style={{ fontSize:12, color:token.colorTextSecondary }}>
                                    <LockOutlined style={{ marginRight:5, color:GOLD }} />
                                    Log tidak dapat dimanipulasi
                                </span>
                                <span style={{ color:token.colorBorderSecondary }}>·</span>
                                <span style={{ fontSize:12, color:token.colorTextSecondary }}>
                                    <CalendarOutlined style={{ marginRight:5, color:GOLD }} />
                                    {formatHijri(new Date())}
                                </span>
                                <span style={{ color:token.colorBorderSecondary }}>·</span>
                                <span style={{ fontSize:12, color:token.colorTextSecondary }}>
                                    {formatMasehi(new Date())}
                                </span>
                            </div>
                        </div>
                    </div>
                    <Button
                        icon={<DownloadOutlined />}
                        loading={isExporting}
                        onClick={handleExport}
                        style={{
                            borderColor:`${C.create.base}55`, color:C.create.base,
                            borderRadius:11, height:40, fontWeight:600, fontSize:13,
                            background:isDark?C.create.dark:C.create.light,
                        }}
                    >
                        Export Excel
                    </Button>
                </div>
            </motion.div>

            {/* ╔══════════════════════════════════════════╗
                ║             KPI CARDS                    ║
                ╚══════════════════════════════════════════╝ */}
            <Row gutter={[14,14]}>
                {kpiDefs.map((k,i) => (
                    <Col xs={12} sm={8} lg={4} key={k.key}>
                        <motion.div
                            initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
                            transition={{ duration:.4, delay:i*.07, ease:"easeOut" }}
                        >
                            <Card
                                className="al-kpi"
                                bordered={false}
                                bodyStyle={{ padding:"14px 16px" }}
                                style={{
                                    background:isDark?k.color.dark:k.color.light,
                                    border:`1px solid ${k.color.border}`,
                                    borderRadius:14,
                                    boxShadow:`0 4px 18px ${k.color.glow}44`,
                                }}
                            >
                                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:6 }}>
                                    <div>
                                        <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:"0.08em", color:token.colorTextSecondary, textTransform:"uppercase", marginBottom:8 }}>
                                            {k.label}
                                        </div>
                                        <div className="al-mono" style={{ fontSize:28, fontWeight:900, color:k.color.base, lineHeight:1 }}>
                                            {k.value}
                                        </div>
                                    </div>
                                    <div style={{
                                        width:38, height:38, borderRadius:11, flexShrink:0,
                                        background:`${k.color.base}1E`,
                                        display:"flex", alignItems:"center", justifyContent:"center",
                                        fontSize:18, color:k.color.base,
                                    }}>
                                        {k.icon}
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    </Col>
                ))}
            </Row>

            {/* ── DELETE risk bar ── */}
            {kpi.deletes > 0 && (
                <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:.4 }}>
                    <Card bordered={false} bodyStyle={{ padding:"14px 20px" }} style={{
                        ...cardBase,
                        border:`1px solid ${C.delete.border}`,
                        background: isDark ? C.delete.dark : C.delete.light,
                    }}>
                        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                            <WarningOutlined style={{ color:C.delete.base, fontSize:20, flexShrink:0 }} />
                            <div style={{ flex:1 }}>
                                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                                    <Text style={{ fontSize:11.5, fontWeight:700, color:C.delete.base }}>
                                        Indikator Risiko — Aktivitas DELETE terdeteksi di periode ini
                                    </Text>
                                    <Text className="al-mono" style={{ fontSize:11.5, fontWeight:800, color:C.delete.base }}>
                                        {kpi.dangerPct}% dari total log
                                    </Text>
                                </div>
                                <Progress
                                    percent={kpi.dangerPct}
                                    showInfo={false}
                                    strokeColor={{ from:C.update.base, to:C.delete.base }}
                                    trailColor={isDark?"rgba(255,255,255,0.07)":"#FFE4E4"}
                                    strokeWidth={6}
                                    style={{ margin:0 }}
                                />
                            </div>
                            <Text className="al-mono" style={{ fontSize:20, fontWeight:900, color:C.delete.base, flexShrink:0 }}>
                                {kpi.deletes}
                            </Text>
                        </div>
                    </Card>
                </motion.div>
            )}

            {/* ╔══════════════════════════════════════════╗
                ║           PREMIUM FILTER BAR             ║
                ╚══════════════════════════════════════════╝ */}
            <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:.42 }}>
                <Card bordered={false} bodyStyle={{ padding:"16px 20px" }} style={{
                    ...cardBase,
                    background: isDark ? G(.04) : "rgba(255,249,232,0.9)",
                    backdropFilter:"blur(8px)",
                }}>
                    <div style={{ display:"flex", alignItems:"center", flexWrap:"wrap", gap:16 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:80 }}>
                            <div style={{ width:32, height:32, borderRadius:9, background:G(isDark?.2:.12), display:"flex", alignItems:"center", justifyContent:"center" }}>
                                <FilterOutlined style={{ color:GOLD, fontSize:14 }} />
                            </div>
                            <div>
                                <Text style={{ fontWeight:700, fontSize:13, color:token.colorText, display:"block", lineHeight:"1.2" }}>Filter</Text>
                                {activeFilters > 0 && <Badge count={activeFilters} style={{ backgroundColor:GOLD, fontSize:9 }} />}
                            </div>
                        </div>

                        <div style={{ minWidth:240 }}>
                            <span className="al-filter-label" style={{ color:isDark?GOLD_LIGHT:GOLD_DARK }}>Periode</span>
                            <RangePicker
                                value={dateRange}
                                onChange={d => d && setDateRange(d as [dayjs.Dayjs, dayjs.Dayjs])}
                                allowClear={false} format="DD MMM YYYY"
                                style={{ width:"100%", borderRadius:10, borderColor:G(.35) }}
                                suffixIcon={<CalendarOutlined style={{ color:GOLD }} />}
                                presets={[
                                    { label:"Hari Ini",   value:[dayjs(), dayjs()]                                                              },
                                    { label:"7 Hari",     value:[dayjs().subtract(6,"day"), dayjs()]                                            },
                                    { label:"Bulan Ini",  value:[dayjs().startOf("month"), dayjs().endOf("month")]                              },
                                    { label:"Bulan Lalu", value:[dayjs().subtract(1,"month").startOf("month"), dayjs().subtract(1,"month").endOf("month")] },
                                ]}
                            />
                        </div>

                        <div style={{ flex:1, display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:10 }}>
                            <div>
                                <span className="al-filter-label" style={{ color:isDark?GOLD_LIGHT:GOLD_DARK }}>Jenis Aksi</span>
                                <Select value={actionFilter} onChange={setActionFilter} style={{ width:"100%" }}
                                    options={[
                                        { label:"Semua Aksi",      value:"all"    },
                                        { label:"✅ Create",        value:"CREATE" },
                                        { label:"✏️ Update",        value:"UPDATE" },
                                        { label:"❌ Delete",        value:"DELETE" },
                                        { label:"🔐 Login",         value:"LOGIN"  },
                                        { label:"🔓 Logout",        value:"LOGOUT" },
                                        { label:"👁️ Read / Export", value:"READ"   },
                                    ]}
                                />
                            </div>
                            <div>
                                <span className="al-filter-label" style={{ color:isDark?GOLD_LIGHT:GOLD_DARK }}>Role User</span>
                                <Select value={roleFilter} onChange={setRoleFilter} style={{ width:"100%" }}
                                    options={[
                                        { label:"Semua Role", value:"all"        },
                                        { label:"👑 Admin",   value:"admin"      },
                                        { label:"🔱 Super",   value:"superadmin" },
                                        { label:"📋 Pengurus",value:"pengurus"   },
                                        { label:"👨‍👩‍👦 Wali",   value:"wali"       },
                                    ]}
                                />
                            </div>
                        </div>

                        {activeFilters > 0 && (
                            <Tooltip title="Reset semua filter">
                                <Button
                                    icon={<ClearOutlined />}
                                    onClick={() => { setActionFilter("all"); setRoleFilter("all"); setSearchUser(""); }}
                                    style={{
                                        borderRadius:10, borderColor:C.delete.border,
                                        color:C.delete.base,
                                        background:isDark?C.delete.dark:C.delete.light,
                                    }}
                                >
                                    Reset
                                </Button>
                            </Tooltip>
                        )}
                    </div>
                </Card>
            </motion.div>

            {/* ╔══════════════════════════════════════════╗
                ║           PREMIUM DATA TABLE             ║
                ╚══════════════════════════════════════════╝ */}
            <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ duration:.45, delay:.52 }}>
                <div style={{
                    borderRadius:16, overflow:"hidden",
                    border:`1px solid ${G(isDark?.2:.13)}`,
                    boxShadow:isDark
                        ?`0 10px 40px rgba(0,0,0,0.45),0 0 0 1px ${G(.1)}`
                        :`0 8px 32px ${G(.1)},0 2px 8px rgba(0,0,0,0.04)`
                }}>
                    <ProTable<IAuditLog>
                        {...tableProps}
                        dataSource={filteredData}
                        columns={columns}
                        rowKey="id"
                        search={false}
                        className="al-table"
                        scroll={{ x:1100 }}
                        tableStyle={{ padding:0 }}
                        rowClassName={(r) => r.action?.toUpperCase() === "DELETE" ? "al-row-delete" : ""}

                        headerTitle={
                            <Space size={12}>
                                <div style={{
                                    width:38, height:38, borderRadius:11,
                                    background:`linear-gradient(135deg,${GOLD},${GOLD_DARK})`,
                                    display:"flex", alignItems:"center", justifyContent:"center",
                                    boxShadow:`0 4px 14px ${G(.42)}`
                                }}>
                                    <FileTextOutlined style={{ color:"#fff", fontSize:17 }} />
                                </div>
                                <div>
                                    <div style={{ fontSize:15, fontWeight:700, color:token.colorText, fontFamily:"'Outfit',sans-serif" }}>
                                        Log Aktivitas Sistem
                                    </div>
                                    <div style={{ fontSize:10.5, color:GOLD, fontWeight:600, marginTop:1 }}>
                                        {filteredData.length} record · {kpi.uniqueUsers} pengguna aktif
                                    </div>
                                </div>
                            </Space>
                        }

                        toolBarRender={() => [
                            <Button
                                key="export"
                                icon={<DownloadOutlined />}
                                loading={isExporting}
                                onClick={handleExport}
                                style={{
                                    borderColor:`${C.create.base}55`, color:C.create.base,
                                    borderRadius:10, height:36, fontWeight:600, fontSize:12.5,
                                    background:isDark?C.create.dark:C.create.light,
                                }}
                            >
                                Export Excel
                            </Button>
                        ]}

                        options={{ density:true, fullScreen:true, setting:true, reload:true }}

                        pagination={{
                            defaultPageSize:20,
                            showSizeChanger:true,
                            showTotal:(total,range) => (
                                <span style={{ fontSize:12, color:token.colorTextSecondary }}>
                                    Menampilkan{" "}
                                    <strong style={{ color:isDark?GOLD_LIGHT:GOLD_DARK }}>{range[0]}–{range[1]}</strong>
                                    {" "}dari{" "}
                                    <strong style={{ color:token.colorText }}>{total}</strong> log
                                </span>
                            ),
                        }}
                    />
                </div>
            </motion.div>

            {/* ╔══════════════════════════════════════════╗
                ║        DETAIL MODAL — JSON VIEWER        ║
                ╚══════════════════════════════════════════╝ */}
            <Modal
                open={!!detailRecord}
                onCancel={() => setDetailRecord(null)}
                footer={null}
                width={580}
                centered
                styles={{ content:{ borderRadius:20, overflow:"hidden" } }}
                title={
                    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                        <div style={{
                            width:40, height:40, borderRadius:11,
                            background:`linear-gradient(135deg,${GOLD},${GOLD_DARK})`,
                            display:"flex", alignItems:"center", justifyContent:"center",
                            boxShadow:`0 4px 14px ${G(.4)}`
                        }}>
                            <InfoCircleOutlined style={{ color:"#fff", fontSize:18 }} />
                        </div>
                        <div>
                            <div style={{ fontWeight:700, fontSize:15, color:token.colorText }}>Detail Perubahan</div>
                            <div style={{ fontSize:11.5, color:token.colorTextSecondary, marginTop:2 }}>
                                {detailRecord?.user_name} · {detailRecord?.action} · {cleanResource(detailRecord?.resource ?? "")}
                            </div>
                        </div>
                    </div>
                }
            >
                {detailRecord && (
                    <div style={{ paddingTop:12 }}>
                        <div style={{
                            background:isDark?"rgba(255,255,255,0.04)":token.colorBgTextHover,
                            border:`1px solid ${token.colorBorderSecondary}`,
                            borderRadius:12, padding:"14px 16px",
                            maxHeight:360, overflowY:"auto"
                        }}>
                            <Text className="al-mono" style={{
                                fontSize:11.5, color:token.colorText,
                                display:"block", lineHeight:1.8, wordBreak:"break-all", whiteSpace:"pre-wrap"
                            }}>
                                {typeof detailRecord.details === "object"
                                    ? JSON.stringify(detailRecord.details, null, 2)
                                    : String(detailRecord.details ?? "—")
                                }
                            </Text>
                        </div>
                        <div style={{ marginTop:14, display:"flex", gap:10, flexWrap:"wrap" }}>
                            {[
                                { label:"Waktu",    value:dayjs(detailRecord.created_at).format("DD MMM YYYY · HH:mm:ss") },
                                { label:"Hijriah",  value:formatHijri(detailRecord.created_at) },
                                { label:"Record ID",value:detailRecord.record_id },
                            ].map(item => (
                                <div key={item.label} style={{
                                    background:G(isDark?.12:.07), border:`1px solid ${G(isDark?.25:.18)}`,
                                    borderRadius:9, padding:"7px 12px", flex:1, minWidth:140,
                                }}>
                                    <Text style={{ fontSize:9.5, fontWeight:700, color:isDark?GOLD_LIGHT:GOLD_DARK, textTransform:"uppercase", letterSpacing:"0.07em", display:"block" }}>
                                        {item.label}
                                    </Text>
                                    <Text className="al-mono" style={{ fontSize:12, color:token.colorText, display:"block", marginTop:2 }}>
                                        {item.value || "—"}
                                    </Text>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};
