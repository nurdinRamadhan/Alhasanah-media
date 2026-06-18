import React, { useState, useMemo, useEffect, useRef } from "react";
import { useTable } from "@refinedev/antd";
import { logActivity } from "../../utility/logger";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import {
    Tag, Space, Button, Typography, Tooltip, Modal, Form,
    Select, InputNumber, Input, message, DatePicker, Row, Col,
    Upload, Image, theme, Divider, Card, Skeleton, Segmented, Empty,
} from "antd";
import {
    PlusOutlined, DeleteOutlined, EditOutlined,
    UploadOutlined, WalletOutlined, ArrowDownOutlined,
    FireOutlined, BarChartOutlined, ClockCircleOutlined,
    FileExcelOutlined, FilePdfOutlined, PieChartOutlined,
    FilterOutlined, TeamOutlined, ArrowUpOutlined,
    ThunderboltOutlined, HistoryOutlined, CheckCircleOutlined,
    ApartmentOutlined,
} from "@ant-design/icons";
import {
    useDelete, useCreate, useUpdate, useGetIdentity, CrudFilter,
} from "@refinedev/core";
import { useColorMode } from "../../contexts/color-mode";
import dayjs from "dayjs";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { supabaseClient } from "../../utility/supabaseClient";
import { IPengeluaran, IUserIdentity } from "../../types";
import { formatHijri } from "../../utility/dateHelper";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { motion, Variants, AnimatePresence } from "framer-motion";
import {
    AreaChart, Area, BarChart, Bar, ComposedChart, Line,
    XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
    ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

const { Text, Title } = Typography;
const { useToken } = theme;

// ─── Design Tokens (matches Dashboard) ────────────────────────────────────────
const GOLD        = "#C9A84C";
const GOLD_BRIGHT = "#FFB700";
const SUCCESS     = "#059669";
const DANGER      = "#DC2626";
const INFO        = "#2563EB";
const PURPLE      = "#7C3AED";
const AMBER       = "#D97706";

// ─── Data Config ──────────────────────────────────────────────────────────────
const KATEGORI_LIST = ["OPERASIONAL", "PENDIDIKAN", "SARANA", "KEGIATAN", "LAINNYA"] as const;

const KATEGORI_META: Record<string, { color: string; label: string; icon: string }> = {
    OPERASIONAL: { color: INFO,    label: "Operasional", icon: "⚙️" },
    PENDIDIKAN:  { color: PURPLE,  label: "Pendidikan",  icon: "📚" },
    SARANA:      { color: AMBER,   label: "Sarana",      icon: "🏗️" },
    KEGIATAN:    { color: SUCCESS, label: "Kegiatan",    icon: "🎯" },
    LAINNYA:     { color: GOLD,    label: "Lainnya",     icon: "📋" },
};

const SCOPE_LABEL: Record<string, { label: string; color: string }> = {
    "L-TAHFIDZ": { label: "Putra Tahfidz", color: INFO   },
    "L-KITAB":   { label: "Putra Kitab",   color: PURPLE },
    "P-ALL":     { label: "Putri",         color: "#EC4899" },
};

const PIE_PALETTE = [INFO, PURPLE, AMBER, SUCCESS, GOLD_BRIGHT];

const USER_SCOPE_LABEL = (u: IUserIdentity | undefined): string => {
    if (!u || ["super_admin", "rois", "dewan"].includes(u.role)) return "Semua Unit";
    if (u.scopeGender === "P") return "Putri";
    return `Putra ${u.scopeJurusan === "ALL" ? "" : u.scopeJurusan}`.trim() || "Putra";
};

const IDR = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

const fmtShort = (v: number) => {
    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}M`;
    if (v >= 1_000_000)     return `${(v / 1_000_000).toFixed(1)}Jt`;
    if (v >= 1_000)         return `${(v / 1_000).toFixed(0)}Rb`;
    return `${v}`;
};

// ─── Motion ───────────────────────────────────────────────────────────────────
const fadeUp: Variants = {
    hidden:  { opacity: 0, y: 22 },
    visible: (i = 0) => ({
        opacity: 1, y: 0,
        transition: { duration: 0.52, ease: [0.22, 1, 0.36, 1], delay: i * 0.07 },
    }),
};
const stagger = { visible: { transition: { staggerChildren: 0.07 } } };

// ─── Animated Counter ─────────────────────────────────────────────────────────
const AnimatedValue: React.FC<{ value: number; formatter?: (v: number) => string }> = ({ value, formatter }) => {
    const [displayed, setDisplayed] = useState(0);
    const prevRef = useRef(0);
    useEffect(() => {
        const start = prevRef.current;
        const startTime = performance.now();
        const update = (now: number) => {
            const t = Math.min((now - startTime) / 850, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            setDisplayed(Math.round(start + (value - start) * eased));
            if (t < 1) requestAnimationFrame(update);
            else prevRef.current = value;
        };
        requestAnimationFrame(update);
    }, [value]);
    return <>{formatter ? formatter(displayed) : displayed.toLocaleString("id-ID")}</>;
};

// ─── Premium Tooltip ──────────────────────────────────────────────────────────
const PremiumTooltip = ({ active, payload, label, token: tk }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: tk.colorBgElevated, border: `1px solid ${tk.colorBorderSecondary}`,
            borderRadius: 14, padding: "12px 16px", minWidth: 185,
            boxShadow: "0 24px 60px rgba(0,0,0,0.35)", backdropFilter: "blur(20px)",
        }}>
            <p style={{
                margin: "0 0 10px", fontWeight: 700, fontSize: 11,
                letterSpacing: "0.1em", textTransform: "uppercase", color: GOLD_BRIGHT,
            }}>{label}</p>
            {payload.map((e: any, i: number) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: e.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: tk.colorTextSecondary, flex: 1 }}>{e.name}</span>
                    <span style={{
                        fontWeight: 700, fontSize: 12, fontFamily: "'DM Mono', monospace",
                        color: tk.colorText,
                    }}>
                        {typeof e.value === "number" && e.value > 1000 ? IDR(e.value) : e.value.toLocaleString("id-ID")}
                    </span>
                </div>
            ))}
        </div>
    );
};

// ─── KPI Card (identical pattern to Dashboard) ────────────────────────────────
interface KpiCardProps {
    label: string; value: number; icon: React.ReactNode; color: string;
    subtext?: string; formatter?: (v: number) => string;
    isDark: boolean; token: any; delay?: number;
}
const KpiCard: React.FC<KpiCardProps> = ({
    label, value, icon, color, subtext, formatter, isDark, token: tk, delay = 0,
}) => (
    <motion.div variants={fadeUp} custom={delay} whileHover={{ y: -5, transition: { duration: 0.18 } }}
        style={{ height: "100%", cursor: "default" }}>
        <div style={{
            borderRadius: 20, padding: "22px 20px 18px", height: "100%",
            background: tk.colorBgContainer,
            border: `1px solid ${isDark ? color + "22" : color + "28"}`,
            position: "relative", overflow: "hidden",
            boxShadow: isDark
                ? `0 4px 28px rgba(0,0,0,0.45), inset 0 1px 0 ${color}12`
                : `0 2px 16px rgba(0,0,0,0.06), inset 0 1px 0 ${color}18`,
        }}>
            <div style={{
                position: "absolute", bottom: -40, right: -40, width: 130, height: 130,
                borderRadius: "50%", pointerEvents: "none",
                background: `radial-gradient(circle, ${color}18 0%, transparent 65%)`,
            }} />
            <div style={{
                position: "absolute", top: 0, left: "15%", right: "15%", height: 2,
                background: `linear-gradient(90deg, transparent, ${color}70, transparent)`,
            }} />
            <div style={{ marginBottom: 18 }}>
                <div style={{
                    width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                    background: `linear-gradient(135deg, ${color}20 0%, ${color}38 100%)`,
                    border: `1px solid ${color}30`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color, fontSize: 20, boxShadow: `0 4px 14px ${color}22`,
                }}>{icon}</div>
            </div>
            <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                color: isDark ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.38)", marginBottom: 6,
            }}>{label}</div>
            <div style={{
                fontFamily: "'DM Mono', monospace", fontWeight: 800,
                fontSize: formatter ? 20 : 28,
                letterSpacing: "-0.04em", lineHeight: 1.1, color: tk.colorText,
            }}>
                {formatter && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)", marginRight: 3 }}>
                        Rp
                    </span>
                )}
                <AnimatedValue value={value} formatter={formatter ? (v) => fmtShort(v) : undefined} />
            </div>
            {subtext && (
                <div style={{ fontSize: 11, marginTop: 8, color: isDark ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.38)" }}>
                    {subtext}
                </div>
            )}
        </div>
    </motion.div>
);

// ─── Section Header ───────────────────────────────────────────────────────────
const SectionHeader = ({ icon, title, subtitle, action }: {
    icon: React.ReactNode; title: string; subtitle?: string; action?: React.ReactNode;
}) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
            <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: `linear-gradient(135deg, ${GOLD}20 0%, ${GOLD_BRIGHT}15 100%)`,
                border: `1px solid ${GOLD}28`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: GOLD_BRIGHT, fontSize: 17,
            }}>{icon}</div>
            <div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 16, letterSpacing: "-0.03em" }}>
                    {title}
                </div>
                {subtitle && <div style={{ fontSize: 12, color: "rgba(128,128,128,0.75)", marginTop: 2 }}>{subtitle}</div>}
            </div>
            <div style={{
                flex: 1, height: 1, marginLeft: 10,
                background: `linear-gradient(90deg, ${GOLD}28 0%, transparent 80%)`,
            }} />
        </div>
        {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
);

// ─── Category Badge ───────────────────────────────────────────────────────────
const KategoriChip: React.FC<{ value: string }> = ({ value }) => {
    const meta = KATEGORI_META[value] || { color: GOLD, icon: "📌" };
    return (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 10px", borderRadius: 99, fontSize: 10, fontWeight: 700,
            letterSpacing: "0.05em", border: `1px solid ${meta.color}38`,
            background: meta.color + "18", color: meta.color,
        }}>
            <span>{meta.icon}</span>
            {value}
        </span>
    );
};

// ─── Scope Badge ──────────────────────────────────────────────────────────────
const ScopeBadge: React.FC<{ gender: string; jurusan?: string }> = ({ gender, jurusan }) => {
    const key = gender === "P" ? "P-ALL" : jurusan === "KITAB" ? "L-KITAB" : "L-TAHFIDZ";
    const cfg = SCOPE_LABEL[key] || { label: gender, color: GOLD };
    return (
        <span style={{
            display: "inline-flex", alignItems: "center",
            padding: "2px 8px", borderRadius: 99, fontSize: 9, fontWeight: 700,
            background: cfg.color + "18", color: cfg.color, border: `1px solid ${cfg.color}30`,
        }}>
            {cfg.label}
        </span>
    );
};

// ─── Pie Label ────────────────────────────────────────────────────────────────
const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.08) return null;
    const R = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.55;
    return (
        <text x={cx + r * Math.cos(-midAngle * R)} y={cy + r * Math.sin(-midAngle * R)}
            fill="#fff" textAnchor="middle" dominantBaseline="central"
            style={{ fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>
            {`${(percent * 100).toFixed(0)}%`}
        </text>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export const PengeluaranList = () => {
    const { token } = useToken();
    const { data: user }  = useGetIdentity<IUserIdentity>();
    const { mutate: createMutate } = useCreate();
    const { mutate: updateMutate } = useUpdate();
    const { mutate: deleteMutate } = useDelete();
    const { mode } = useColorMode();
    const isDark = mode === "dark";

    const TICK = { fontSize: 10, fill: token.colorTextTertiary as string };

    // ── RBAC ─────────────────────────────────────────────────────────────────
    const isDewan     = user?.role === "dewan";
    const isScopeFree = user?.role === "super_admin" || user?.role === "rois";

    const autoScope = useMemo(() => {
        if (!user || isScopeFree || isDewan) return null;
        if (user.scopeGender === "P") return "P-ALL";
        if (user.scopeGender === "L" && user.scopeJurusan === "TAHFIDZ") return "L-TAHFIDZ";
        if (user.scopeGender === "L" && user.scopeJurusan === "KITAB")   return "L-KITAB";
        return null;
    }, [user, isScopeFree, isDewan]);

    const jurisdictionFilters = useMemo((): CrudFilter[] => {
        if (!user || isScopeFree || isDewan) return [];
        const f: CrudFilter[] = [];
        if (user.scopeGender === "P") {
            f.push({ field: "scope_gender", operator: "eq", value: "P" });
        } else if (user.scopeGender === "L") {
            f.push({ field: "scope_gender", operator: "eq", value: "L" });
            if (user.scopeJurusan !== "ALL")
                f.push({ field: "scope_jurusan", operator: "eq", value: user.scopeJurusan });
        }
        return f;
    }, [user, isScopeFree, isDewan]);

    // ── States ────────────────────────────────────────────────────────────────
    const [filterMonth,    setFilterMonth]    = useState<dayjs.Dayjs>(dayjs());
    const [filterKategori, setFilterKategori] = useState<string | null>(null);
    const [filterScope,    setFilterScope]    = useState<string>(() => autoScope || "ALL");
    const [chartMode,      setChartMode]      = useState<"area" | "bar" | "combo">("area");
    const [isModalOpen,    setIsModalOpen]    = useState(false);
    const [modalMode,      setModalMode]      = useState<"CREATE" | "EDIT">("CREATE");
    const [editingItem,    setEditingItem]    = useState<IPengeluaran | any>(null);
    const [form]                              = Form.useForm();
    const [uploading,      setUploading]      = useState(false);
    const [buktiUrl,       setBuktiUrl]       = useState<string | null>(null);
    const [deleteConfirm,  setDeleteConfirm]  = useState<number | null>(null);

    const prevAutoScope = useRef(autoScope);
    useEffect(() => {
        if (autoScope && autoScope !== prevAutoScope.current) setFilterScope(autoScope);
        prevAutoScope.current = autoScope;
    }, [autoScope]);

    // ── Table Data ────────────────────────────────────────────────────────────
    const { tableProps, tableQueryResult } = useTable<IPengeluaran>({
        resource: "pengeluaran",
        syncWithLocation: false,
        permanentFilter: jurisdictionFilters,
        filters: {
            mode: "server",
            initial: [
                { field: "tanggal_pengeluaran", operator: "gte", value: filterMonth.startOf("month").format("YYYY-MM-DD") },
                { field: "tanggal_pengeluaran", operator: "lte", value: filterMonth.endOf("month").format("YYYY-MM-DD") },
            ],
        },
        sorters: { initial: [{ field: "tanggal_pengeluaran", order: "desc" }] },
    });

    const scopeMatch = (item: IPengeluaran): boolean => {
        if (filterScope === "ALL") return true;
        if (filterScope === "P-ALL")     return item.scope_gender === "P";
        if (filterScope === "L-TAHFIDZ") return item.scope_gender === "L" && item.scope_jurusan === "TAHFIDZ";
        if (filterScope === "L-KITAB")   return item.scope_gender === "L" && item.scope_jurusan === "KITAB";
        return true;
    };

    const filteredData = (tableQueryResult?.data?.data ?? []).filter(
        item => (!filterKategori || item.kategori === filterKategori) && scopeMatch(item)
    );

    const isLoading = tableQueryResult?.isLoading || tableQueryResult?.isFetching;

    // ── Statistik ─────────────────────────────────────────────────────────────
    const totalBulanIni     = filteredData.reduce((a, c) => a + Number(c.nominal), 0);
    const totalHariIni      = filteredData.filter(i => dayjs(i.tanggal_pengeluaran).isSame(dayjs(), "day")).reduce((a, c) => a + Number(c.nominal), 0);
    const jumlahTransaksi   = filteredData.length;
    const rataPerTransaksi  = jumlahTransaksi > 0 ? totalBulanIni / jumlahTransaksi : 0;
    const transaksiTerbesar = filteredData.reduce((mx, c) => Number(c.nominal) > mx ? Number(c.nominal) : mx, 0);

    // Kategori terbesar
    const kategoriMap = useMemo(() => {
        const m: Record<string, number> = {};
        filteredData.forEach(d => { m[d.kategori as string] = (m[d.kategori as string] || 0) + Number(d.nominal); });
        return m;
    }, [filteredData]);
    const topKategori = Object.entries(kategoriMap).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

    // ── Chart Data ────────────────────────────────────────────────────────────
    const dailyChartData = useMemo(() => {
        const daysInMonth = filterMonth.daysInMonth();
        const map: Record<string, number> = {};
        filteredData.forEach(d => {
            const key = dayjs(d.tanggal_pengeluaran).format("DD");
            map[key] = (map[key] || 0) + Number(d.nominal);
        });
        return Array.from({ length: daysInMonth }, (_, i) => {
            const key = String(i + 1).padStart(2, "0");
            return { day: `${key}/${filterMonth.format("MM")}`, total: map[key] || 0 };
        });
    }, [filteredData, filterMonth]);

    const pieChartData = useMemo(() =>
        Object.entries(kategoriMap).map(([name, value]) => ({ name, value })), [kategoriMap]
    );

    // Trend: compare with previous month (simple heuristic from available data)
    const prevMonthRef = useRef<number>(0);
    const trendPct = prevMonthRef.current > 0
        ? ((totalBulanIni - prevMonthRef.current) / prevMonthRef.current) * 100
        : 0;

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleOpenCreate = () => {
        setModalMode("CREATE"); setEditingItem(null); setBuktiUrl(null);
        form.resetFields();
        form.setFieldsValue({
            tanggal_pengeluaran: dayjs(),
            kategori: "OPERASIONAL",
            dicatat_oleh_nama: user?.name,
            scope_gender:  isScopeFree ? undefined : (user?.scopeGender === "ALL" ? "ALL" : user?.scopeGender),
            scope_jurusan: isScopeFree ? undefined : (user?.scopeGender === "P" ? "ALL" : (user?.scopeJurusan === "ALL" ? "ALL" : user?.scopeJurusan)),
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (record: IPengeluaran) => {
        setModalMode("EDIT"); setEditingItem(record); setBuktiUrl(record.bukti_url ?? null);
        form.setFieldsValue({ ...record, tanggal_pengeluaran: dayjs(record.tanggal_pengeluaran) });
        setIsModalOpen(true);
    };

    const handleUpload = async (options: any) => {
        const { file, onSuccess, onError } = options;
        const fileExt = file.name.split(".").pop();
        const fileName = `nota-${Date.now()}.${fileExt}`;
        setUploading(true);
        try {
            const { error } = await supabaseClient.storage.from("pengeluaran-bukti").upload(fileName, file);
            if (error) throw error;
            const { data } = supabaseClient.storage.from("pengeluaran-bukti").getPublicUrl(fileName);
            setBuktiUrl(data.publicUrl);
            onSuccess("Ok");
            message.success("Bukti berhasil diupload");
        } catch (err: any) {
            message.error("Gagal upload: " + err.message);
            onError({ error: err });
        } finally { setUploading(false); }
    };

    const handleSubmit = async (values: any) => {
        const payload = {
            ...values,
            nominal: Number(values.nominal),
            tanggal_pengeluaran: values.tanggal_pengeluaran
                ? dayjs(values.tanggal_pengeluaran).format("YYYY-MM-DD")
                : dayjs().format("YYYY-MM-DD"),
            bukti_url: buktiUrl || null,
            ...(modalMode === "CREATE" && { dicatat_oleh_id: user?.id, dicatat_oleh_nama: user?.name }),
        };
        try {
            if (modalMode === "CREATE") {
                await createMutate({ resource: "pengeluaran", values: payload });
                logActivity({ user, action: "CREATE", resource: "pengeluaran", record_id: "-", details: { judul: String(payload.judul), nominal: Number(payload.nominal), scope: `${payload.scope_gender}/${payload.scope_jurusan}` } });
                message.success("Pengeluaran berhasil dicatat");
            } else {
                await updateMutate({ resource: "pengeluaran", id: editingItem!.id, values: payload });
                logActivity({ user, action: "UPDATE", resource: "pengeluaran", record_id: String(editingItem!.id), details: { judul_baru: String(payload.judul), nominal_baru: Number(payload.nominal) } });
                message.success("Data berhasil diperbarui");
            }
            setIsModalOpen(false);
            tableQueryResult.refetch();
        } catch (err) {
            console.error(err);
            message.error("Terjadi kesalahan");
        }
    };

    const handleDelete = (id: number) => {
        deleteMutate({ resource: "pengeluaran", id });
        setDeleteConfirm(null);
        message.success("Data dihapus");
    };

    const handleExportExcel = async () => {
        if (!filteredData.length) return message.warning("Tidak ada data untuk diekspor");
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("Pengeluaran");
        ws.columns = [
            { header: "Tanggal",    key: "tanggal", width: 18 },
            { header: "Judul",      key: "judul",   width: 36 },
            { header: "Kategori",   key: "kat",     width: 16 },
            { header: "Scope",      key: "scope",   width: 18 },
            { header: "Nominal",    key: "nominal", width: 20 },
            { header: "Keterangan", key: "ket",     width: 30 },
        ];
        filteredData.forEach(d => ws.addRow({
            tanggal: dayjs(d.tanggal_pengeluaran).format("DD/MM/YYYY"),
            judul:   d.judul,
            kat:     d.kategori,
            scope:   d.scope_gender === "P" ? "Putri" : `Putra ${d.scope_jurusan}`,
            nominal: Number(d.nominal),
            ket:     d.keterangan || "",
        }));
        const buf = await wb.xlsx.writeBuffer();
        saveAs(new Blob([buf]), `Pengeluaran_${filterMonth.format("MMMM_YYYY")}.xlsx`);
    };

    // ── Card Style ────────────────────────────────────────────────────────────
    const cardStyle = {
        borderRadius: 22,
        background: token.colorBgContainer,
        border: `1px solid ${isDark ? GOLD + "14" : GOLD + "20"}`,
        boxShadow: isDark ? "0 8px 40px rgba(0,0,0,0.35)" : "0 4px 20px rgba(0,0,0,0.05)",
    };

    // ── Columns ───────────────────────────────────────────────────────────────
    const columns: ProColumns<IPengeluaran>[] = [
        {
            title: "Tanggal", dataIndex: "tanggal_pengeluaran", width: 130,
            render: (val) => (
                <div>
                    <div style={{ fontWeight: 700, fontSize: 13, fontFamily: "'DM Mono', monospace" }}>
                        {dayjs(val as string).format("DD MMM YYYY")}
                    </div>
                    <div style={{ fontSize: 10, color: token.colorTextTertiary, marginTop: 2 }}>
                        {formatHijri(val as string)}
                    </div>
                </div>
            ),
        },
        {
            title: "Detail Pengeluaran", dataIndex: "judul",
            render: (_, r) => (
                <div>
                    <Text strong style={{ fontSize: 13 }}>{r.judul}</Text>
                    {r.keterangan && (
                        <div style={{ fontSize: 11, color: token.colorTextSecondary, marginTop: 2, maxWidth: 280 }}>
                            {r.keterangan}
                        </div>
                    )}
                    <div style={{ display: "flex", gap: 5, marginTop: 5, flexWrap: "wrap" }}>
                        <ScopeBadge gender={r.scope_gender as string} jurusan={r.scope_jurusan as string} />
                    </div>
                </div>
            ),
        },
        {
            title: "Kategori", dataIndex: "kategori", width: 150,
            render: (val: any) => <KategoriChip value={val as string} />,
        },
        {
            title: "Nominal", dataIndex: "nominal", width: 175, align: "right",
            render: (val) => (
                <div style={{ textAlign: "right" }}>
                    <div style={{
                        fontFamily: "'DM Mono', monospace", fontWeight: 800, fontSize: 14,
                        color: DANGER, letterSpacing: "-0.03em",
                    }}>
                        {IDR(Number(val) || 0)}
                    </div>
                </div>
            ),
        },
        {
            title: "Bukti", dataIndex: "bukti_url", width: 70, align: "center",
            render: (val: any) => val ? (
                <Image src={String(val)} width={34} height={34}
                    style={{ borderRadius: 8, objectFit: "cover", border: `2px solid ${GOLD}30` }} />
            ) : (
                <span style={{ fontSize: 10, color: token.colorTextTertiary }}>—</span>
            ),
        },
        {
            title: "Aksi", valueType: "option", width: 88, align: "center",
            render: (_, record) => !isDewan ? (
                <Space size={4}>
                    <Tooltip title="Edit">
                        <Button size="small" type="text"
                            icon={<EditOutlined style={{ color: GOLD_BRIGHT }} />}
                            onClick={() => handleOpenEdit(record)}
                            style={{
                                width: 30, height: 30, borderRadius: 8,
                                background: isDark ? `${GOLD}12` : `${GOLD}10`,
                                border: `1px solid ${GOLD}22`,
                            }} />
                    </Tooltip>
                    <Tooltip title="Hapus">
                        <Button size="small" type="text" danger
                            icon={<DeleteOutlined style={{ color: DANGER }} />}
                            onClick={() => setDeleteConfirm(record.id as number)}
                            style={{
                                width: 30, height: 30, borderRadius: 8,
                                background: isDark ? `${DANGER}12` : `${DANGER}08`,
                                border: `1px solid ${DANGER}22`,
                            }} />
                    </Tooltip>
                </Space>
            ) : null,
        },
    ];

    // ═══════════════════════════════════════════════════════════════════════════
    return (
        <motion.div initial="hidden" animate="visible" variants={stagger} style={{ paddingBottom: 64 }}>

            {/* ── PAGE HEADER ──────────────────────────────────────────────────── */}
            <motion.div variants={fadeUp} style={{
                display: "flex", flexWrap: "wrap", justifyContent: "space-between",
                alignItems: "flex-end", gap: 16, marginBottom: 32,
                paddingBottom: 28,
                borderBottom: `1px solid ${isDark ? GOLD + "12" : GOLD + "18"}`,
            }}>
                <div>
                    <div style={{
                        display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
                        fontSize: 11, fontWeight: 700, letterSpacing: "0.14em",
                        textTransform: "uppercase", color: GOLD,
                        fontFamily: "'Syne', sans-serif",
                    }}>
                        <span style={{
                            width: 7, height: 7, borderRadius: "50%",
                            background: DANGER, boxShadow: `0 0 8px ${DANGER}`,
                            display: "inline-block",
                        }} />
                        Manajemen Keuangan · Kas Keluar
                    </div>

                    <Title level={2} style={{
                        margin: 0, fontFamily: "'Syne', sans-serif", fontWeight: 800,
                        letterSpacing: "-0.04em", lineHeight: 1.1, color: token.colorText,
                    }}>
                        <motion.span
                            animate={{ backgroundPosition: ["0% center", "200% center"] }}
                            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                            style={{
                                background: `linear-gradient(120deg, ${DANGER}, ${AMBER}, ${GOLD_BRIGHT}, ${DANGER})`,
                                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                                backgroundSize: "250% auto", display: "inline-block",
                            }}>
                            Pengeluaran
                        </motion.span>{" "}
                        <span style={{ WebkitTextFillColor: "unset" }}>Dana Unit</span>
                    </Title>

                    <div style={{ fontSize: 13, color: token.colorTextSecondary, marginTop: 6 }}>
                        {filterMonth.format("MMMM YYYY")} · {USER_SCOPE_LABEL(user)}
                        &nbsp;·&nbsp;
                        <span style={{ color: jumlahTransaksi > 0 ? GOLD_BRIGHT : token.colorTextTertiary, fontWeight: 600 }}>
                            {jumlahTransaksi} transaksi
                        </span>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <Button
                        icon={<FileExcelOutlined style={{ color: SUCCESS }} />}
                        onClick={handleExportExcel}
                        style={{
                            borderRadius: 12, fontWeight: 600, fontSize: 12,
                            background: isDark ? `${SUCCESS}12` : `${SUCCESS}0d`,
                            border: `1px solid ${SUCCESS}35`, color: SUCCESS,
                        }}>
                        Export Excel
                    </Button>
                    <Button
                        icon={<FilePdfOutlined style={{ color: DANGER }} />}
                        onClick={() => message.info("Feature coming soon")}
                        style={{
                            borderRadius: 12, fontWeight: 600, fontSize: 12,
                            background: isDark ? `${DANGER}12` : `${DANGER}0d`,
                            border: `1px solid ${DANGER}30`, color: DANGER,
                        }}>
                        PDF
                    </Button>
                    {!isDewan && (
                        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                            <Button
                                type="primary" icon={<PlusOutlined />}
                                onClick={handleOpenCreate}
                                style={{
                                    borderRadius: 12, fontWeight: 700, fontSize: 13, height: 38,
                                    background: `linear-gradient(135deg, ${AMBER} 0%, ${GOLD_BRIGHT} 100%)`,
                                    border: "none", color: "#1a1000",
                                    boxShadow: `0 6px 20px ${GOLD}40`,
                                }}>
                                Catat Pengeluaran
                            </Button>
                        </motion.div>
                    )}
                </div>
            </motion.div>

            {/* ── KPI STRIP ────────────────────────────────────────────────────── */}
            <motion.div variants={stagger} style={{ marginBottom: 32 }}>
                <Row gutter={[14, 14]}>
                    {[
                        {
                            label: "Total Pengeluaran", value: totalBulanIni, icon: <WalletOutlined />,
                            color: DANGER, formatter: fmtShort,
                            subtext: filterMonth.format("MMMM YYYY"),
                        },
                        {
                            label: "Keluar Hari Ini", value: totalHariIni, icon: <ClockCircleOutlined />,
                            color: AMBER, formatter: fmtShort,
                            subtext: dayjs().format("dddd, DD MMM"),
                        },
                        {
                            label: "Jumlah Transaksi", value: jumlahTransaksi, icon: <BarChartOutlined />,
                            color: INFO,
                            subtext: "Volume bulan ini",
                        },
                        {
                            label: "Rata / Transaksi", value: rataPerTransaksi, icon: <ThunderboltOutlined />,
                            color: PURPLE, formatter: fmtShort,
                            subtext: jumlahTransaksi > 0 ? `dari ${jumlahTransaksi} trx` : "Belum ada data",
                        },
                        {
                            label: "Nominal Terbesar", value: transaksiTerbesar, icon: <FireOutlined />,
                            color: GOLD_BRIGHT, formatter: fmtShort,
                            subtext: "Rekor transaksi",
                        },
                        {
                            label: "Kategori Teratas", value: 0, icon: <ApartmentOutlined />,
                            color: KATEGORI_META[topKategori]?.color || GOLD,
                            subtext: topKategori !== "—" ? `${topKategori} · ${fmtShort(kategoriMap[topKategori] || 0)}` : "Belum ada data",
                        },
                    ].map((kpi, i) => (
                        <Col key={kpi.label} xs={12} sm={8} lg={4}>
                            {/* Special card for Kategori Teratas (no animated number) */}
                            {kpi.label === "Kategori Teratas" ? (
                                <motion.div variants={fadeUp} custom={i}
                                    whileHover={{ y: -5, transition: { duration: 0.18 } }}
                                    style={{ height: "100%", cursor: "default" }}>
                                    <div style={{
                                        borderRadius: 20, padding: "22px 20px 18px", height: "100%",
                                        background: token.colorBgContainer,
                                        border: `1px solid ${isDark ? kpi.color + "22" : kpi.color + "28"}`,
                                        position: "relative", overflow: "hidden",
                                        boxShadow: isDark
                                            ? `0 4px 28px rgba(0,0,0,0.45), inset 0 1px 0 ${kpi.color}12`
                                            : `0 2px 16px rgba(0,0,0,0.06), inset 0 1px 0 ${kpi.color}18`,
                                    }}>
                                        <div style={{
                                            position: "absolute", bottom: -40, right: -40, width: 130, height: 130,
                                            borderRadius: "50%", pointerEvents: "none",
                                            background: `radial-gradient(circle, ${kpi.color}18 0%, transparent 65%)`,
                                        }} />
                                        <div style={{
                                            position: "absolute", top: 0, left: "15%", right: "15%", height: 2,
                                            background: `linear-gradient(90deg, transparent, ${kpi.color}70, transparent)`,
                                        }} />
                                        <div style={{
                                            width: 46, height: 46, borderRadius: 14, marginBottom: 18,
                                            background: `linear-gradient(135deg, ${kpi.color}20 0%, ${kpi.color}38 100%)`,
                                            border: `1px solid ${kpi.color}30`,
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            color: kpi.color, fontSize: 20,
                                            boxShadow: `0 4px 14px ${kpi.color}22`,
                                        }}>{kpi.icon}</div>
                                        <div style={{
                                            fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                                            textTransform: "uppercase",
                                            color: isDark ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.38)", marginBottom: 6,
                                        }}>{kpi.label}</div>
                                        <div style={{
                                            fontFamily: "'DM Mono', monospace", fontWeight: 800,
                                            fontSize: 16, letterSpacing: "-0.02em",
                                            lineHeight: 1.3, color: kpi.color,
                                        }}>{topKategori}</div>
                                        <div style={{ fontSize: 11, marginTop: 6, color: isDark ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.38)" }}>
                                            {kpi.subtext}
                                        </div>
                                    </div>
                                </motion.div>
                            ) : (
                                <KpiCard {...kpi} isDark={isDark} token={token} delay={i} />
                            )}
                        </Col>
                    ))}
                </Row>
            </motion.div>

            {/* ── CHARTS ───────────────────────────────────────────────────────── */}
            <motion.div variants={fadeUp} custom={2} style={{ marginBottom: 32 }}>
                <Card bordered={false} style={cardStyle} bodyStyle={{ padding: "26px 28px 20px" }}>
                    {/* Chart Header */}
                    <div style={{
                        display: "flex", flexWrap: "wrap", justifyContent: "space-between",
                        alignItems: "center", gap: 14, marginBottom: 20,
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{
                                width: 42, height: 42, borderRadius: 13, flexShrink: 0,
                                background: `linear-gradient(135deg, ${GOLD}20, ${GOLD_BRIGHT}15)`,
                                border: `1px solid ${GOLD}28`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                color: GOLD_BRIGHT, fontSize: 18,
                            }}><BarChartOutlined /></div>
                            <div>
                                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em" }}>
                                    Tren Pengeluaran Harian
                                </div>
                                <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
                                    Distribusi per hari · {filterMonth.format("MMMM YYYY")}
                                </div>
                            </div>
                        </div>
                        <Segmented
                            value={chartMode}
                            onChange={(v) => setChartMode(v as any)}
                            options={[
                                { label: "Area",  value: "area"  },
                                { label: "Bar",   value: "bar"   },
                                { label: "Kombo", value: "combo" },
                            ]}
                            size="small"
                            style={{ fontSize: 11, fontWeight: 600 }}
                        />
                    </div>

                    <Row gutter={[20, 20]}>
                        {/* Daily Trend */}
                        <Col xs={24} xl={16}>
                            <div style={{ width: "100%", height: 290 }}>
                                {isLoading ? (
                                    <Skeleton active paragraph={{ rows: 6 }} />
                                ) : dailyChartData.every(d => d.total === 0) ? (
                                    <Empty description="Belum ada transaksi bulan ini" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                                ) : (
                                    <ResponsiveContainer>
                                        {chartMode === "bar" ? (
                                            <BarChart data={dailyChartData} barCategoryGap="25%">
                                                <defs>
                                                    <linearGradient id="barDanger" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%"   stopColor={DANGER} stopOpacity={0.9} />
                                                        <stop offset="100%" stopColor={DANGER} stopOpacity={0.4} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.07} />
                                                <XAxis dataKey="day" tick={TICK} axisLine={false} tickLine={false}
                                                    interval={Math.floor(dailyChartData.length / 7)} />
                                                <YAxis tickFormatter={(v) => `${v/1000}k`} tick={TICK} axisLine={false} tickLine={false} />
                                                <ReTooltip content={<PremiumTooltip token={token} />}
                                                    cursor={{ fill: isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.025)" }} />
                                                <Bar dataKey="total" name="Pengeluaran" fill="url(#barDanger)" radius={[5, 5, 0, 0]} maxBarSize={18} />
                                            </BarChart>
                                        ) : chartMode === "combo" ? (
                                            <ComposedChart data={dailyChartData}>
                                                <defs>
                                                    <linearGradient id="comboG" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%"   stopColor={AMBER} stopOpacity={0.8} />
                                                        <stop offset="100%" stopColor={AMBER} stopOpacity={0.2} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.07} />
                                                <XAxis dataKey="day" tick={TICK} axisLine={false} tickLine={false}
                                                    interval={Math.floor(dailyChartData.length / 7)} />
                                                <YAxis tickFormatter={(v) => `${v/1000}k`} tick={TICK} axisLine={false} tickLine={false} />
                                                <ReTooltip content={<PremiumTooltip token={token} />} />
                                                <Bar dataKey="total" name="Pengeluaran" fill="url(#comboG)" radius={[5, 5, 0, 0]} maxBarSize={16} />
                                                <Line type="monotone" dataKey="total" name="Tren"
                                                    stroke={DANGER} strokeWidth={2.5}
                                                    dot={false} activeDot={{ r: 5 }} />
                                            </ComposedChart>
                                        ) : (
                                            <AreaChart data={dailyChartData}>
                                                <defs>
                                                    <linearGradient id="areaDanger" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%"   stopColor={DANGER} stopOpacity={0.38} />
                                                        <stop offset="100%" stopColor={DANGER} stopOpacity={0.02} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.07} />
                                                <XAxis dataKey="day" tick={TICK} axisLine={false} tickLine={false}
                                                    interval={Math.floor(dailyChartData.length / 7)} />
                                                <YAxis tickFormatter={(v) => `${v/1000}k`} tick={TICK} axisLine={false} tickLine={false} />
                                                <ReTooltip content={<PremiumTooltip token={token} />} />
                                                <Area type="monotone" dataKey="total" name="Pengeluaran"
                                                    stroke={DANGER} fill="url(#areaDanger)" strokeWidth={2.5} />
                                            </AreaChart>
                                        )}
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </Col>

                        {/* Pie Distribution */}
                        <Col xs={24} xl={8}>
                            <div style={{
                                borderLeft: `1px solid ${isDark ? GOLD + "12" : GOLD + "18"}`,
                                paddingLeft: 24, height: "100%",
                            }}>
                                <div style={{
                                    fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                                    textTransform: "uppercase", color: GOLD, marginBottom: 12,
                                    display: "flex", alignItems: "center", gap: 8,
                                }}>
                                    <PieChartOutlined /> Distribusi Kategori
                                </div>

                                {isLoading ? (
                                    <Skeleton active paragraph={{ rows: 5 }} />
                                ) : pieChartData.length === 0 ? (
                                    <Empty description="Belum ada data" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: "30px 0" }} />
                                ) : (
                                    <>
                                        <div style={{ width: "100%", height: 200 }}>
                                            <ResponsiveContainer>
                                                <PieChart>
                                                    <Pie
                                                        data={pieChartData}
                                                        innerRadius={52} outerRadius={78}
                                                        paddingAngle={3} dataKey="value"
                                                        label={renderPieLabel}
                                                    >
                                                        {pieChartData.map((_, i) => (
                                                            <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} stroke="transparent" />
                                                        ))}
                                                    </Pie>
                                                    <ReTooltip
                                                        formatter={(v: any) => [IDR(Number(v)), "Nominal"]}
                                                        contentStyle={{
                                                            background: token.colorBgElevated,
                                                            border: `1px solid ${token.colorBorderSecondary}`,
                                                            borderRadius: 12, fontSize: 12,
                                                        }}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                        {/* Category list below pie */}
                                        <div style={{ marginTop: 8 }}>
                                            {pieChartData.map((d, i) => {
                                                const pct = totalBulanIni > 0 ? ((d.value / totalBulanIni) * 100).toFixed(1) : "0";
                                                const color = PIE_PALETTE[i % PIE_PALETTE.length];
                                                return (
                                                    <div key={d.name} style={{
                                                        display: "flex", alignItems: "center", justifyContent: "space-between",
                                                        padding: "5px 0",
                                                        borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`,
                                                    }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
                                                            <span style={{ fontSize: 11, fontWeight: 600, color: token.colorTextSecondary }}>{d.name}</span>
                                                        </div>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                            <span style={{ fontSize: 10, color, fontWeight: 700 }}>{pct}%</span>
                                                            <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 11, color: token.colorText }}>
                                                                {fmtShort(d.value)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>
                        </Col>
                    </Row>
                </Card>
            </motion.div>

            {/* ── FILTER & TABLE ───────────────────────────────────────────────── */}
            <motion.div variants={fadeUp} custom={3} style={{ marginBottom: 20 }}>
                <SectionHeader
                    icon={<FilterOutlined />}
                    title="Rincian Transaksi"
                    subtitle="Data pengeluaran terfilter berdasarkan periode & kategori"
                />

                {/* Filter Panel */}
                <Card bordered={false} style={{ ...cardStyle, marginBottom: 16 }} bodyStyle={{ padding: "18px 22px" }}>
                    <Row gutter={[16, 12]} align="middle">
                        <Col xs={24} sm={8} lg={6}>
                            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: GOLD, marginBottom: 7 }}>
                                PERIODE BULAN
                            </div>
                            <DatePicker.MonthPicker
                                value={filterMonth}
                                onChange={val => setFilterMonth(val || dayjs())}
                                style={{ width: "100%", borderRadius: 10 }}
                                allowClear={false}
                            />
                        </Col>
                        <Col xs={24} sm={8} lg={6}>
                            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: GOLD, marginBottom: 7 }}>
                                KATEGORI
                            </div>
                            <Select
                                placeholder="Semua Kategori"
                                options={KATEGORI_LIST.map(k => ({
                                    label: (
                                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                            <span>{KATEGORI_META[k].icon}</span>
                                            <span>{k}</span>
                                        </span>
                                    ),
                                    value: k,
                                }))}
                                onChange={setFilterKategori}
                                style={{ width: "100%", borderRadius: 10 }}
                                allowClear
                            />
                        </Col>
                        {isScopeFree && (
                            <Col xs={24} sm={8} lg={6}>
                                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: GOLD, marginBottom: 7 }}>
                                    SCOPE UNIT
                                </div>
                                <Select
                                    value={filterScope}
                                    onChange={setFilterScope}
                                    style={{ width: "100%", borderRadius: 10 }}
                                    options={[
                                        { label: "Semua Unit",    value: "ALL" },
                                        { label: "Putra Tahfidz", value: "L-TAHFIDZ" },
                                        { label: "Putra Kitab",   value: "L-KITAB" },
                                        { label: "Putri",         value: "P-ALL" },
                                    ]}
                                />
                            </Col>
                        )}
                        {/* Active filter chips */}
                        <Col xs={24} lg={6}>
                            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
                                {filterKategori && (
                                    <motion.span
                                        initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                        style={{
                                            display: "inline-flex", alignItems: "center", gap: 5,
                                            padding: "3px 10px", borderRadius: 99, fontSize: 10, fontWeight: 700,
                                            background: KATEGORI_META[filterKategori]?.color + "18",
                                            border: `1px solid ${KATEGORI_META[filterKategori]?.color}35`,
                                            color: KATEGORI_META[filterKategori]?.color,
                                            cursor: "pointer",
                                        }}
                                        onClick={() => setFilterKategori(null)}>
                                        {filterKategori} ×
                                    </motion.span>
                                )}
                                {filterScope !== "ALL" && (
                                    <motion.span
                                        initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                        style={{
                                            display: "inline-flex", alignItems: "center", gap: 5,
                                            padding: "3px 10px", borderRadius: 99, fontSize: 10, fontWeight: 700,
                                            background: SCOPE_LABEL[filterScope]?.color + "18",
                                            border: `1px solid ${SCOPE_LABEL[filterScope]?.color}35`,
                                            color: SCOPE_LABEL[filterScope]?.color,
                                            cursor: "pointer",
                                        }}
                                        onClick={() => setFilterScope("ALL")}>
                                        {SCOPE_LABEL[filterScope]?.label} ×
                                    </motion.span>
                                )}
                            </div>
                        </Col>
                    </Row>
                </Card>

                {/* Table */}
                <div style={{
                    background: token.colorBgContainer, borderRadius: 20,
                    border: `1px solid ${isDark ? GOLD + "14" : GOLD + "18"}`,
                    overflow: "hidden",
                    boxShadow: isDark ? "0 8px 40px rgba(0,0,0,0.35)" : "0 4px 20px rgba(0,0,0,0.05)",
                }}>
                    <ProTable<IPengeluaran>
                        {...tableProps}
                        dataSource={filteredData}
                        columns={columns}
                        rowKey="id"
                        search={false}
                        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `Total ${t} transaksi` }}
                        headerTitle={
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{ fontWeight: 800, fontSize: 14, fontFamily: "'Syne', sans-serif" }}>
                                    Rincian Pengeluaran
                                </span>
                                {filterScope !== "ALL" && (
                                    <span style={{
                                        padding: "2px 10px", borderRadius: 99, fontSize: 10, fontWeight: 700,
                                        background: SCOPE_LABEL[filterScope]?.color + "18",
                                        color: SCOPE_LABEL[filterScope]?.color,
                                        border: `1px solid ${SCOPE_LABEL[filterScope]?.color}30`,
                                    }}>
                                        {SCOPE_LABEL[filterScope]?.label}
                                    </span>
                                )}
                            </div>
                        }
                        rowClassName={() => "premium-table-row"}
                        onRow={(_record) => ({
                            style: { transition: "background 0.15s" },
                            onMouseEnter: (e) => {
                                (e.currentTarget as HTMLElement).style.background = isDark
                                    ? `${GOLD}08` : `${GOLD}05`;
                            },
                            onMouseLeave: (e) => {
                                (e.currentTarget as HTMLElement).style.background = "";
                            },
                        })}
                    />
                </div>
            </motion.div>

            {/* ── MODAL CREATE / EDIT ──────────────────────────────────────────── */}
            <Modal
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                footer={null}
                centered
                width={580}
                styles={{
                    content: {
                        borderRadius: 24,
                        padding: 0,
                        overflow: "hidden",
                        background: token.colorBgContainer,
                        border: `1px solid ${isDark ? GOLD + "18" : GOLD + "22"}`,
                        boxShadow: isDark ? "0 32px 80px rgba(0,0,0,0.6)" : "0 16px 60px rgba(0,0,0,0.15)",
                    },
                    header: { display: "none" },
                    mask: { backdropFilter: "blur(6px)" },
                }}>

                {/* Modal Header */}
                <div style={{
                    padding: "28px 32px 20px",
                    background: isDark
                        ? `linear-gradient(135deg, ${DANGER}18 0%, ${AMBER}0a 100%)`
                        : `linear-gradient(135deg, ${DANGER}10 0%, ${AMBER}06 100%)`,
                    borderBottom: `1px solid ${isDark ? GOLD + "18" : GOLD + "14"}`,
                }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                            <div style={{
                                width: 48, height: 48, borderRadius: 15,
                                background: `linear-gradient(135deg, ${AMBER} 0%, ${GOLD_BRIGHT} 100%)`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 22, color: "#1a1000",
                                boxShadow: `0 6px 20px ${GOLD}40`,
                            }}>
                                {modalMode === "CREATE" ? <PlusOutlined /> : <EditOutlined />}
                            </div>
                            <div>
                                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: "-0.03em" }}>
                                    {modalMode === "CREATE" ? "Catat Pengeluaran" : "Edit Data Pengeluaran"}
                                </div>
                                <div style={{ fontSize: 12, color: token.colorTextSecondary, marginTop: 2 }}>
                                    {modalMode === "CREATE" ? "Input kas keluar baru" : `Edit · ${editingItem?.judul || ""}`}
                                </div>
                            </div>
                        </div>
                        <Button type="text" onClick={() => setIsModalOpen(false)}
                            style={{ fontSize: 18, color: token.colorTextTertiary, borderRadius: 10, width: 36, height: 36 }}>
                            ×
                        </Button>
                    </div>
                </div>

                {/* Modal Body */}
                <Form form={form} layout="vertical" onFinish={handleSubmit}
                    style={{ padding: "24px 32px 28px" }}>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item label={<span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Tanggal</span>}
                                name="tanggal_pengeluaran" rules={[{ required: true, message: "Wajib diisi" }]}>
                                <DatePicker style={{ width: "100%", borderRadius: 10 }} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label={<span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Kategori</span>}
                                name="kategori" rules={[{ required: true, message: "Wajib diisi" }]}>
                                <Select
                                    options={KATEGORI_LIST.map(k => ({
                                        label: (
                                            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                                <span>{KATEGORI_META[k].icon}</span>
                                                <span>{k}</span>
                                            </span>
                                        ), value: k,
                                    }))}
                                    style={{ borderRadius: 10 }}
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Divider style={{ borderColor: isDark ? GOLD + "18" : GOLD + "22", margin: "4px 0 16px" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: GOLD }}>SCOPING UNIT</span>
                    </Divider>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item label={<span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Target Gender</span>}
                                name="scope_gender" rules={[{ required: true }]}>
                                <Select
                                    disabled={!isScopeFree && user?.scopeGender !== "ALL"}
                                    options={[
                                        { label: "Putra", value: "L" },
                                        { label: "Putri", value: "P" },
                                        { label: "Global", value: "ALL" },
                                    ]}
                                    style={{ borderRadius: 10 }}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label={<span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Target Takhasus</span>}
                                name="scope_jurusan" rules={[{ required: true }]}>
                                <Select
                                    disabled={!isScopeFree && (user?.scopeGender === "P" || user?.scopeJurusan !== "ALL")}
                                    options={[
                                        { label: "Kitab",   value: "KITAB"   },
                                        { label: "Tahfidz", value: "TAHFIDZ" },
                                        { label: "Global",  value: "ALL"     },
                                    ]}
                                    style={{ borderRadius: 10 }}
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item
                        label={<span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Judul / Keperluan</span>}
                        name="judul" rules={[{ required: true, message: "Wajib diisi" }]}>
                        <Input placeholder="Contoh: Beli Alat Tulis Kantor" style={{ borderRadius: 10 }} />
                    </Form.Item>

                    <Form.Item
                        label={<span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Nominal (Rp)</span>}
                        name="nominal" rules={[{ required: true, message: "Wajib diisi" }]}>
                        <InputNumber
                            style={{ width: "100%", borderRadius: 10 }}
                            formatter={v => `Rp ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
                            parser={v => v?.replace(/\Rp\s?|(\.*)/g, "") as any}
                            placeholder="0"
                        />
                    </Form.Item>

                    <Form.Item
                        label={<span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Keterangan</span>}
                        name="keterangan">
                        <Input.TextArea rows={2} placeholder="Catatan tambahan (opsional)" style={{ borderRadius: 10 }} />
                    </Form.Item>

                    <Form.Item
                        label={<span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Bukti Nota</span>}>
                        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                            <Upload customRequest={handleUpload} showUploadList={false} accept="image/*">
                                <Button loading={uploading} icon={<UploadOutlined />}
                                    style={{
                                        borderRadius: 10, border: `1px dashed ${isDark ? GOLD + "40" : GOLD + "50"}`,
                                        background: isDark ? `${GOLD}08` : `${GOLD}06`,
                                        color: GOLD_BRIGHT, fontWeight: 600,
                                    }}>
                                    {uploading ? "Mengupload..." : "Pilih Foto Nota"}
                                </Button>
                            </Upload>
                            <AnimatePresence>
                                {buktiUrl && (
                                    <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                                        <Image src={buktiUrl} height={60} width={60}
                                            style={{ borderRadius: 10, objectFit: "cover", border: `2px solid ${GOLD}40` }} />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </Form.Item>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 8 }}>
                        <Button onClick={() => setIsModalOpen(false)}
                            style={{ borderRadius: 10, fontWeight: 600, paddingInline: 22 }}>
                            Batal
                        </Button>
                        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                            <Button type="primary" htmlType="submit"
                                style={{
                                    borderRadius: 10, fontWeight: 700, paddingInline: 28,
                                    background: `linear-gradient(135deg, ${AMBER} 0%, ${GOLD_BRIGHT} 100%)`,
                                    border: "none", color: "#1a1000",
                                    boxShadow: `0 6px 18px ${GOLD}40`,
                                }}>
                                {modalMode === "CREATE" ? "Simpan Transaksi" : "Perbarui Data"}
                            </Button>
                        </motion.div>
                    </div>
                </Form>
            </Modal>

            {/* ── DELETE CONFIRM ───────────────────────────────────────────────── */}
            <Modal
                open={deleteConfirm !== null}
                onCancel={() => setDeleteConfirm(null)}
                onOk={() => handleDelete(deleteConfirm!)}
                okText="Ya, Hapus"
                cancelText="Batal"
                okButtonProps={{
                    danger: true, style: { borderRadius: 10, fontWeight: 700 },
                }}
                cancelButtonProps={{ style: { borderRadius: 10 } }}
                title={
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{
                            width: 36, height: 36, borderRadius: 10, background: `${DANGER}18`,
                            border: `1px solid ${DANGER}30`, display: "flex", alignItems: "center",
                            justifyContent: "center", color: DANGER, fontSize: 17,
                        }}><DeleteOutlined /></span>
                        <span style={{ fontWeight: 700 }}>Konfirmasi Hapus</span>
                    </div>
                }
                centered
                width={360}
                styles={{
                    content: { borderRadius: 18, border: `1px solid ${isDark ? DANGER + "22" : DANGER + "18"}` },
                    mask: { backdropFilter: "blur(4px)" },
                }}>
                <p style={{ color: token.colorTextSecondary, marginTop: 8 }}>
                    Apakah Anda yakin ingin menghapus pengeluaran ini? Tindakan ini tidak dapat dibatalkan.
                </p>
            </Modal>
        </motion.div>
    );
};
