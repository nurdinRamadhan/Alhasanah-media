import React, { useState, useMemo, useEffect, useRef } from "react";
import { useTable, useSelect } from "@refinedev/antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import {
    Tag, Space, Button, Typography, Avatar, Card, Row, Col,
    List, Skeleton, Modal, Form, Select, Input, DatePicker,
    Divider, InputNumber, Tooltip, theme, Empty, message,
} from "antd";
import {
    TrophyOutlined, PlusOutlined, UserOutlined, BookOutlined,
    FireOutlined, SafetyCertificateOutlined, LineChartOutlined,
    EditOutlined, LinkOutlined, FilterOutlined, PieChartOutlined,
    StarOutlined, RiseOutlined, CrownOutlined, ClearOutlined,
    CalendarOutlined,
} from "@ant-design/icons";
import { IPrestasiSantri, ISantri } from "../../types";
import { useCreate, useGetIdentity, useList, useUpdate } from "@refinedev/core";
import dayjs from "dayjs";
import { santriAlias } from "../../utility/privacy";
import { supabaseClient } from "../../utility/supabaseClient";
import { motion, Variants } from "framer-motion";
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip as ReTooltip, ResponsiveContainer, Legend, AreaChart, Area,
} from "recharts";

const { Text, Title } = Typography;
const { useToken } = theme;

// ─── Design Tokens ────────────────────────────────────────────────────────────
const GOLD        = "#C9A84C";
const GOLD_BRIGHT = "#FFB700";
const GOLD_DARK   = "#9A7A00";
const G = (o: number) => `rgba(201,168,76,${o})`;
const EMERALD = "#059669";
const EMERALD_LT = "#10B981";
const INFO    = "#2563EB";
const PURPLE  = "#7C3AED";
const TEAL    = "#0D9488";
const ROSE    = "#BE185D";
const ORANGE  = "#EA580C";
const LIME    = "#65A30D";

const PRESTASI_KATEGORI_OPTIONS = [
    { label: "Tahfidz",   value: "TAHFIDZ",   color: GOLD_BRIGHT },
    { label: "Kitab",     value: "KITAB",     color: INFO    },
    { label: "Khatam",    value: "KHATAM",    color: EMERALD },
    { label: "Akademik",  value: "AKADEMIK",  color: TEAL    },
    { label: "Lomba",     value: "LOMBA",     color: PURPLE  },
    { label: "Akhlak",    value: "AKHLAK",    color: LIME    },
    { label: "Olahraga",  value: "OLAHRAGA",  color: ORANGE  },
    { label: "Seni",      value: "SENI",      color: ROSE    },
    { label: "Umum",      value: "UMUM",      color: "#475569" },
    { label: "Lainnya",   value: "LAINNYA",   color: "#64748B" },
] as const;

const KATEGORI_COLOR_MAP: Record<string, string> = Object.fromEntries(
    PRESTASI_KATEGORI_OPTIONS.map(o => [o.value, o.color])
);
const PIE_PALETTE = PRESTASI_KATEGORI_OPTIONS.map(o => o.color);

const sensitivePattern =
    /(nik|kk|nis|wali|ayah|ibu|alamat|no hp|nomor hp|rekening|\b\d{10,}\b|https?:\/\/|www\.)/i;

const publicTextRules = (required = true) => [
    ...(required ? [{ required: true, message: "Wajib diisi" }] : []),
    {
        validator: (_: unknown, value?: string) => {
            if (value && sensitivePattern.test(value)) {
                return Promise.reject(new Error("Teks publik tidak boleh memuat data sensitif."));
            }
            return Promise.resolve();
        },
    },
];

type PrestasiFormValues = {
    santri_nis: string;
    kategori: IPrestasiSantri["kategori"];
    judul_prestasi: string;
    keterangan?: string;
    tanggal_prestasi: dayjs.Dayjs;
    poin_prestasi?: number;
    sertifikat_url?: string;
};

type TopTahfidzRow = Pick<ISantri, "nis" | "nama" | "kelas" | "jurusan" | "foto_url"> & {
    total_hafalan: number;
    last_setoran: string | null;
    setoran_count: number;
};

type HafalanSantriRow = Pick<ISantri, "nis" | "nama" | "kelas" | "jurusan" | "foto_url"> & {
    total_hafalan: number | null;
};

// ─── Motion ───────────────────────────────────────────────────────────────────
const fadeUp: Variants = {
    hidden: { opacity: 0, y: 22 },
    visible: (i = 0) => ({
        opacity: 1, y: 0,
        transition: { duration: .52, ease: [0.22, 1, 0.36, 1], delay: i * .07 },
    }),
};
const stagger = { visible: { transition: { staggerChildren: .07 } } };

// ─── Animated Counter ─────────────────────────────────────────────────────────
const AnimatedValue: React.FC<{ value: number; formatter?: (v: number) => string }> = ({ value, formatter }) => {
    const [d, setD] = useState(0);
    const prev = useRef(0);
    useEffect(() => {
        const start = prev.current; const t0 = performance.now();
        const tick = (now: number) => {
            const p = Math.min((now - t0) / 850, 1); const e = 1 - Math.pow(1 - p, 3);
            setD(Math.round(start + (value - start) * e));
            if (p < 1) requestAnimationFrame(tick); else prev.current = value;
        };
        requestAnimationFrame(tick);
    }, [value]);
    return <>{formatter ? formatter(d) : d.toLocaleString("id-ID")}</>;
};

// ─── Premium Tooltip ──────────────────────────────────────────────────────────
const PremiumTooltip = ({ active, payload, label, token: tk }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: tk.colorBgElevated, border: `1px solid ${tk.colorBorderSecondary}`,
            borderRadius: 14, padding: "12px 16px", minWidth: 175,
            boxShadow: "0 24px 60px rgba(0,0,0,0.35)", backdropFilter: "blur(20px)",
        }}>
            <p style={{ margin: "0 0 10px", fontWeight: 700, fontSize: 11,
                letterSpacing: "0.1em", textTransform: "uppercase", color: GOLD_BRIGHT }}>{label}</p>
            {payload.map((e: any, i: number) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: e.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: tk.colorTextSecondary, flex: 1 }}>{e.name}</span>
                    <span style={{ fontWeight: 700, fontSize: 12, fontFamily: "'DM Mono',monospace", color: tk.colorText }}>
                        {e.value?.toLocaleString("id-ID")}
                    </span>
                </div>
            ))}
        </div>
    );
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard: React.FC<{
    label: string; value: number; icon: React.ReactNode; color: string;
    subtext?: string; formatter?: (v: number) => string;
    isDark: boolean; token: any; delay?: number; loading?: boolean;
}> = ({ label, value, icon, color, subtext, formatter, isDark, token: tk, delay = 0, loading }) => (
    <motion.div variants={fadeUp} custom={delay} whileHover={{ y: -5, transition: { duration: .18 } }}
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
            <div style={{ position: "absolute", bottom: -40, right: -40, width: 130, height: 130,
                borderRadius: "50%", pointerEvents: "none",
                background: `radial-gradient(circle, ${color}18 0%, transparent 65%)` }} />
            <div style={{ position: "absolute", top: 0, left: "15%", right: "15%", height: 2,
                background: `linear-gradient(90deg, transparent, ${color}70, transparent)` }} />
            <div style={{ width: 46, height: 46, borderRadius: 14, marginBottom: 18,
                background: `linear-gradient(135deg, ${color}20 0%, ${color}38 100%)`,
                border: `1px solid ${color}30`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color, fontSize: 20, boxShadow: `0 4px 14px ${color}22` }}>{icon}</div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                color: isDark ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.38)", marginBottom: 6 }}>{label}</div>
            {loading ? (
                <div style={{ height: 32, background: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)", borderRadius: 8 }} />
            ) : (
                <div style={{ fontFamily: "'DM Mono',monospace", fontWeight: 800,
                    fontSize: formatter ? 20 : 28, letterSpacing: "-0.04em", lineHeight: 1.1, color: tk.colorText }}>
                    <AnimatedValue value={value} formatter={formatter} />
                </div>
            )}
            {subtext && <div style={{ fontSize: 11, marginTop: 8, color: isDark ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.38)" }}>{subtext}</div>}
        </div>
    </motion.div>
);

// ─── Section Header ───────────────────────────────────────────────────────────
const SectionHeader = ({ icon, title, subtitle, action }: {
    icon: React.ReactNode; title: string; subtitle?: string; action?: React.ReactNode;
}) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
            <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: `linear-gradient(135deg, ${GOLD}20 0%, ${GOLD_BRIGHT}15 100%)`,
                border: `1px solid ${GOLD}28`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: GOLD_BRIGHT, fontSize: 17,
            }}>{icon}</div>
            <div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16, letterSpacing: "-0.03em" }}>{title}</div>
                {subtitle && <div style={{ fontSize: 12, color: "rgba(128,128,128,0.75)", marginTop: 2 }}>{subtitle}</div>}
            </div>
            <div style={{ flex: 1, height: 1, marginLeft: 10, background: `linear-gradient(90deg, ${GOLD}28 0%, transparent 80%)` }} />
        </div>
        {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
);

// ─── Pie Label ────────────────────────────────────────────────────────────────
const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.07) return null;
    const R = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.55;
    return (
        <text x={cx + r * Math.cos(-midAngle * R)} y={cy + r * Math.sin(-midAngle * R)}
            fill="#fff" textAnchor="middle" dominantBaseline="central"
            style={{ fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>
            {`${(percent * 100).toFixed(0)}%`}
        </text>
    );
};

const hexLum = (hex: string): number => {
    const c = hex.replace("#", ""); if (c.length < 6) return 200;
    return .299 * parseInt(c.slice(0, 2), 16) + .587 * parseInt(c.slice(2, 4), 16) + .114 * parseInt(c.slice(4, 6), 16);
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export const PrestasiList = () => {
    const { token } = useToken();
    const isDark = hexLum(token.colorBgContainer) < 128;
    const TICK = { fontSize: 10, fill: token.colorTextTertiary as string };

    const { data: user } = useGetIdentity<{ id: string }>();
    const { mutate: createMutate } = useCreate();
    const { mutate: updateMutate } = useUpdate();

    // ── 1. Hall of Fame — RPC Top Tahfidz ───────────────────────────────────
    const [topTahfidz, setTopTahfidz] = useState<TopTahfidzRow[]>([]);
    const [loadingTahfidz, setLoadingTahfidz] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const loadTopTahfidz = async () => {
            setLoadingTahfidz(true);
            const { data, error } = await supabaseClient.rpc("get_admin_top_tahfidz_santri", { p_limit: 10 });
            if (!isMounted) return;
            if (error) { console.error("Gagal memuat top tahfidz:", error); setTopTahfidz([]); }
            else setTopTahfidz((data || []) as TopTahfidzRow[]);
            setLoadingTahfidz(false);
        };
        loadTopTahfidz();
        return () => { isMounted = false; };
    }, []);

    // ── 2. Direct query: SEMUA santri dengan total_hafalan (scrollable list) ─
    const [hafalanList, setHafalanList] = useState<HafalanSantriRow[]>([]);
    const [loadingHafalanList, setLoadingHafalanList] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const loadHafalanList = async () => {
            setLoadingHafalanList(true);
            const { data, error } = await supabaseClient
                .from("santri")
                .select("nis, nama, kelas, jurusan, foto_url, total_hafalan")
                .eq("status_santri", "AKTIF")
                .eq("jurusan", "TAHFIDZ")
                .order("total_hafalan", { ascending: false, nullsFirst: false });
            if (!isMounted) return;
            if (error) { console.error("Gagal memuat daftar hafalan:", error); setHafalanList([]); }
            else setHafalanList((data || []) as HafalanSantriRow[]);
            setLoadingHafalanList(false);
        };
        loadHafalanList();
        return () => { isMounted = false; };
    }, []);

    // ── 3. Top Kitab ──────────────────────────────────────────────────────────
    const { data: topKitab, isLoading: loadingKitab } = useList<ISantri>({
        resource: "santri", pagination: { pageSize: 6 },
        filters: [
            { field: "hafalan_kitab", operator: "null", value: false },
            { field: "status_santri", operator: "eq", value: "AKTIF" },
        ],
    });

    // ── 4. Prestasi table ────────────────────────────────────────────────────
    const { tableProps, tableQueryResult } = useTable<IPrestasiSantri>({
        resource: "prestasi_santri",
        syncWithLocation: true,
        meta: { select: "*, santri(nama, nis, kelas, jurusan, foto_url)" },
        sorters: { initial: [{ field: "tanggal_prestasi", order: "desc" }] },
    });
    const allPrestasi = tableQueryResult?.data?.data ?? [];
    const isLoadingPrestasi = tableQueryResult?.isLoading || tableQueryResult?.isFetching;

    // ── 5. Filter state (smart filters above chart/table) ───────────────────
    const [filterKategori, setFilterKategori] = useState<string | null>(null);
    const [filterRange, setFilterRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

    const filteredPrestasi = useMemo(() => allPrestasi.filter(p => {
        if (filterKategori && p.kategori !== filterKategori) return false;
        if (filterRange) {
            const t = dayjs(p.tanggal_prestasi);
            if (t.isBefore(filterRange[0], "day") || t.isAfter(filterRange[1], "day")) return false;
        }
        return true;
    }), [allPrestasi, filterKategori, filterRange]);

    const activeFilters = [filterKategori, filterRange].filter(Boolean).length;
    const resetFilters = () => { setFilterKategori(null); setFilterRange(null); };

    // ── 6. KPI computations ──────────────────────────────────────────────────
    const kpi = useMemo(() => {
        const totalPrestasi = allPrestasi.length;
        const totalPoin = allPrestasi.reduce((a, p) => a + Number(p.poin_prestasi || 0), 0);
        const totalKhatam = allPrestasi.filter(p => p.kategori === "KHATAM").length;
        const totalLomba = allPrestasi.filter(p => p.kategori === "LOMBA").length;
        const kategoriCount: Record<string, number> = {};
        allPrestasi.forEach(p => { kategoriCount[p.kategori as string] = (kategoriCount[p.kategori as string] || 0) + 1; });
        const topKategori = Object.entries(kategoriCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
        const santriTahfidzCount = hafalanList.length;
        const totalJuzAll = hafalanList.reduce((a, s) => a + Number(s.total_hafalan || 0), 0);
        const rataJuz = santriTahfidzCount > 0 ? (totalJuzAll / santriTahfidzCount) : 0;
        const santriKhatam30 = hafalanList.filter(s => Number(s.total_hafalan || 0) >= 30).length;
        return { totalPrestasi, totalPoin, totalKhatam, totalLomba, topKategori, santriTahfidzCount, rataJuz, santriKhatam30 };
    }, [allPrestasi, hafalanList]);

    // ── 7. Chart data ─────────────────────────────────────────────────────────
    const pieKategoriData = useMemo(() => {
        const map: Record<string, number> = {};
        filteredPrestasi.forEach(p => { map[p.kategori as string] = (map[p.kategori as string] || 0) + 1; });
        return Object.entries(map).map(([name, value]) => ({
            name: PRESTASI_KATEGORI_OPTIONS.find(o => o.value === name)?.label || name,
            value, color: KATEGORI_COLOR_MAP[name] || GOLD,
        }));
    }, [filteredPrestasi]);

    const monthlyTrendData = useMemo(() => {
        const map: Record<string, number> = {};
        filteredPrestasi.forEach(p => {
            const key = dayjs(p.tanggal_prestasi).format("MMM YY");
            map[key] = (map[key] || 0) + 1;
        });
        return Object.entries(map)
            .sort(([a], [b]) => dayjs(a, "MMM YY").valueOf() - dayjs(b, "MMM YY").valueOf())
            .slice(-12)
            .map(([periode, total]) => ({ periode, total }));
    }, [filteredPrestasi]);

    const hafalanDistribution = useMemo(() => {
        const buckets = [
            { label: "0-5 Juz", min: 0, max: 5, color: "#64748B" },
            { label: "6-10 Juz", min: 6, max: 10, color: INFO },
            { label: "11-15 Juz", min: 11, max: 15, color: TEAL },
            { label: "16-20 Juz", min: 16, max: 20, color: PURPLE },
            { label: "21-29 Juz", min: 21, max: 29, color: GOLD_BRIGHT },
            { label: "30 Juz (Khatam)", min: 30, max: 30, color: EMERALD },
        ];
        return buckets.map(b => ({
            name: b.label, color: b.color,
            jumlah: hafalanList.filter(s => {
                const v = Number(s.total_hafalan || 0);
                return v >= b.min && v <= b.max;
            }).length,
        }));
    }, [hafalanList]);

    // ── 8. Modal logic ───────────────────────────────────────────────────────
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<IPrestasiSantri | null>(null);
    const [form] = Form.useForm();

    const { selectProps: santriSelectProps } = useSelect<ISantri>({
        resource: "santri", optionLabel: "nama", optionValue: "nis",
        meta: { select: "nama, nis, kelas, jurusan, status_santri" },
        filters: [{ field: "status_santri", operator: "eq", value: "AKTIF" }],
    });

    const closeModal = () => { setIsModalOpen(false); setEditingRecord(null); form.resetFields(); };
    const openCreateModal = () => {
        setEditingRecord(null);
        form.setFieldsValue({ tanggal_prestasi: dayjs(), poin_prestasi: 0 });
        setIsModalOpen(true);
    };
    const openEditModal = (record: IPrestasiSantri) => {
        setEditingRecord(record);
        form.setFieldsValue({
            santri_nis: record.santri_nis, kategori: record.kategori,
            judul_prestasi: record.judul_prestasi, keterangan: record.keterangan ?? undefined,
            tanggal_prestasi: record.tanggal_prestasi ? dayjs(record.tanggal_prestasi) : dayjs(),
            poin_prestasi: record.poin_prestasi ?? 0, sertifikat_url: record.sertifikat_url ?? undefined,
        });
        setIsModalOpen(true);
    };

    const buildPayload = (values: PrestasiFormValues) => ({
        santri_nis: values.santri_nis, kategori: values.kategori,
        judul_prestasi: values.judul_prestasi.trim(),
        keterangan: values.keterangan?.trim() || null,
        tanggal_prestasi: values.tanggal_prestasi.format("YYYY-MM-DD"),
        poin_prestasi: values.poin_prestasi ?? 0,
        sertifikat_url: values.sertifikat_url?.trim() || null,
    });

    const handleSubmitPrestasi = (values: PrestasiFormValues) => {
        const payload = buildPayload(values);
        if (editingRecord) {
            updateMutate({
                resource: "prestasi_santri", id: editingRecord.id, values: payload,
                successNotification: { message: "Prestasi berhasil diperbarui.", type: "success" },
            }, { onSuccess: () => { closeModal(); tableQueryResult.refetch(); } });
            return;
        }
        createMutate({
            resource: "prestasi_santri",
            values: { ...payload, dicatat_oleh_id: user?.id ?? null },
            successNotification: { message: "Prestasi berhasil dicatat.", type: "success" },
        }, { onSuccess: () => { closeModal(); tableQueryResult.refetch(); } });
    };

    // ── Columns ───────────────────────────────────────────────────────────────
    const columns: ProColumns<IPrestasiSantri>[] = [
        {
            title: "Santri", dataIndex: "santri", hideInSearch: true,
            render: (_, record) => (
                <Space>
                    <Avatar src={record.santri?.foto_url} icon={<UserOutlined />} style={{ border: `2px solid ${G(.25)}` }} />
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <Text strong style={{ fontSize: 13 }}>{record.santri?.nama || santriAlias(record.santri?.nis)}</Text>
                        <Text type="secondary" style={{ fontSize: 10 }}>
                            {record.santri?.kelas ? `Kelas ${record.santri.kelas}` : "Kelas -"} · {record.santri?.jurusan || "-"} · NIS {record.santri?.nis}
                        </Text>
                    </div>
                </Space>
            ),
        },
        {
            title: "Kategori", dataIndex: "kategori", valueType: "select",
            fieldProps: { options: PRESTASI_KATEGORI_OPTIONS.map(({ label, value }) => ({ label, value })) },
            render: (val) => {
                const meta = PRESTASI_KATEGORI_OPTIONS.find(item => item.value === val);
                const c = meta?.color || GOLD;
                return (
                    <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "3px 10px", borderRadius: 99, fontSize: 10.5, fontWeight: 700,
                        background: `${c}18`, color: c, border: `1px solid ${c}30`,
                    }}>{meta?.label || String(val)}</span>
                );
            },
        },
        {
            title: "Judul Prestasi", dataIndex: "judul_prestasi", ellipsis: true,
            render: (val) => <Text strong style={{ color: EMERALD }}>{val as string}</Text>,
        },
        {
            title: "Tanggal", dataIndex: "tanggal_prestasi", valueType: "date", width: 130,
            render: (val) => <Text className="gl-mono" style={{ fontFamily: "'DM Mono',monospace", fontSize: 12 }}>{dayjs(val as string).format("DD MMM YYYY")}</Text>,
        },
        {
            title: "Poin", dataIndex: "poin_prestasi", width: 90, align: "right", search: false,
            render: (val) => (
                <Tag style={{
                    background: `${GOLD_BRIGHT}18`, color: GOLD_DARK, border: `1px solid ${GOLD_BRIGHT}35`,
                    borderRadius: 99, fontWeight: 800, fontFamily: "'DM Mono',monospace",
                }}>+{Number(val ?? 0)}</Tag>
            ),
        },
        { title: "Keterangan", dataIndex: "keterangan", search: false, ellipsis: true },
        {
            title: "Sertifikat", dataIndex: "sertifikat_url", width: 120, search: false,
            render: (val) => val
                ? <Tag icon={<SafetyCertificateOutlined />} style={{ background: `${EMERALD}18`, color: EMERALD, border: `1px solid ${EMERALD}30`, borderRadius: 99 }}>Ada</Tag>
                : <Tag style={{ borderRadius: 99 }}>Tidak Ada</Tag>,
        },
        {
            title: "Aksi", valueType: "option", width: 70, align: "center",
            render: (_, record) => [
                <Tooltip title="Edit prestasi" key="edit">
                    <Button size="small" type="text" icon={<EditOutlined style={{ color: GOLD_BRIGHT }} />}
                        onClick={() => openEditModal(record)}
                        style={{ width: 30, height: 30, borderRadius: 8, background: isDark ? `${GOLD}12` : `${GOLD}0d`, border: `1px solid ${GOLD}22` }} />
                </Tooltip>,
            ],
        },
    ];

    const cardBase: React.CSSProperties = {
        borderRadius: 20, background: token.colorBgContainer,
        border: `1px solid ${isDark ? G(.16) : G(.18)}`,
        boxShadow: isDark ? "0 8px 40px rgba(0,0,0,0.3)" : "0 4px 20px rgba(0,0,0,0.05)",
    };

    // ═════════════════════════════════════════════════════════════════════════
    return (
        <motion.div initial="hidden" animate="visible" variants={stagger}
            style={{ paddingBottom: 64, display: "flex", flexDirection: "column", gap: 26 }}>

            {/* ── HERO HEADER ─────────────────────────────────────────────────── */}
            <motion.div variants={fadeUp} style={{
                borderRadius: 24, overflow: "hidden", position: "relative",
                background: isDark
                    ? `linear-gradient(135deg, #1a1200 0%, #1f1a0d 40%, #0a1a0a 100%)`
                    : `linear-gradient(135deg, #fff7ed 0%, #fefce8 50%, #f0fff4 100%)`,
                border: `1px solid ${G(isDark ? .22 : .28)}`,
                boxShadow: isDark ? `0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 ${G(.15)}` : `0 8px 40px ${G(.15)}`,
                padding: "30px 34px",
            }}>
                <div style={{ position: "absolute", top: -80, right: -80, width: 300, height: 300, borderRadius: "50%", opacity: .06, pointerEvents: "none", background: `radial-gradient(circle, ${GOLD_BRIGHT} 0%, transparent 70%)` }} />
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 18, position: "relative", zIndex: 1 }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                            <div style={{
                                width: 52, height: 52, borderRadius: 17, flexShrink: 0,
                                background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 24, boxShadow: `0 8px 24px ${G(.45)}`,
                            }}><TrophyOutlined style={{ color: "#fff" }} /></div>
                            <div>
                                <span style={{
                                    display: "inline-block", padding: "2px 12px", borderRadius: 99, fontSize: 9.5,
                                    fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase",
                                    background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)`,
                                    color: "#fff", marginBottom: 6, boxShadow: `0 2px 8px ${G(.3)}`,
                                }}>Apresiasi Santri</span>
                                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 25, letterSpacing: "-0.04em", lineHeight: 1.15, color: token.colorText }}>
                                    Prestasi &{" "}
                                    <motion.span
                                        animate={{ backgroundPosition: ["0% center", "200% center"] }}
                                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                                        style={{
                                            background: `linear-gradient(120deg, ${GOLD_DARK}, ${GOLD_BRIGHT}, #FFE680, ${GOLD})`,
                                            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                                            backgroundSize: "250% auto", display: "inline-block",
                                        }}>Hall of Fame</motion.span>
                                </div>
                            </div>
                        </div>
                        <div style={{ fontSize: 13, color: token.colorTextSecondary }}>
                            Apresiasi untuk santri-santri terbaik Pesantren Al-Hasanah
                        </div>
                    </div>
                    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: .97 }}>
                        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}
                            style={{
                                borderRadius: 12, fontWeight: 700, fontSize: 13, height: 40,
                                background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_BRIGHT} 100%)`,
                                border: "none", color: "#1a1000", boxShadow: `0 6px 20px ${G(.4)}`,
                            }}>
                            Catat Prestasi Manual
                        </Button>
                    </motion.div>
                </div>
            </motion.div>

            {/* ── KPI STRIP ────────────────────────────────────────────────────── */}
            <motion.div variants={stagger}>
                <Row gutter={[14, 14]}>
                    {[
                        { label: "Total Prestasi",   value: kpi.totalPrestasi,     icon: <TrophyOutlined />,  color: GOLD_BRIGHT, loading: isLoadingPrestasi },
                        { label: "Total Poin",       value: kpi.totalPoin,         icon: <StarOutlined />,    color: PURPLE,      loading: isLoadingPrestasi },
                        { label: "Total Khatam",     value: kpi.totalKhatam,       icon: <SafetyCertificateOutlined />, color: EMERALD, loading: isLoadingPrestasi, subtext: "30 Juz selesai" },
                        { label: "Santri Tahfidz",   value: kpi.santriTahfidzCount,icon: <UserOutlined />,    color: INFO,         loading: loadingHafalanList },
                        { label: "Rata-rata Hafalan",value: +kpi.rataJuz.toFixed(1), icon: <RiseOutlined />,  color: TEAL,         loading: loadingHafalanList, subtext: "Juz / santri" },
                        { label: "Khatam 30 Juz",    value: kpi.santriKhatam30,    icon: <CrownOutlined />,   color: ORANGE,       loading: loadingHafalanList, subtext: "santri" },
                    ].map((k, i) => (
                        <Col key={k.label} xs={12} sm={8} lg={4}>
                            <KpiCard {...k} isDark={isDark} token={token} delay={i} />
                        </Col>
                    ))}
                </Row>
            </motion.div>

            {/* ── ROW: CHART (left, wide) + SCROLLABLE TOTAL HAFALAN (right, narrow) ── */}
            <motion.div variants={fadeUp} custom={2}>
                <SectionHeader icon={<PieChartOutlined />} title="Analitik Prestasi & Hafalan"
                    subtitle="Distribusi kategori, tren bulanan & peringkat total hafalan seluruh santri tahfidz" />
                <Row gutter={[16, 16]}>
                    {/* Charts column */}
                    <Col xs={24} xl={16}>
                        <Row gutter={[16, 16]}>
                            <Col xs={24} md={12}>
                                <Card bordered={false} style={cardBase} bodyStyle={{ padding: "20px 22px" }}>
                                    <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13, marginBottom: 14 }}>
                                        Distribusi Kategori Prestasi
                                    </div>
                                    {isLoadingPrestasi ? <Skeleton active paragraph={{ rows: 5 }} /> :
                                    pieKategoriData.length === 0 ? (
                                        <Empty description="Belum ada prestasi" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: "16px 0" }} />
                                    ) : (
                                        <>
                                            <div style={{ width: "100%", height: 175 }}>
                                                <ResponsiveContainer>
                                                    <PieChart>
                                                        <Pie data={pieKategoriData} innerRadius={42} outerRadius={68} paddingAngle={3} dataKey="value" label={renderPieLabel}>
                                                            {pieKategoriData.map((d, i) => <Cell key={i} fill={d.color} stroke="transparent" />)}
                                                        </Pie>
                                                        <ReTooltip contentStyle={{ background: token.colorBgElevated, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 12, fontSize: 12 }} />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </div>
                                            <div style={{ marginTop: 6 }}>
                                                {pieKategoriData.map((d, _i) => {
                                                    const total = pieKategoriData.reduce((a, c) => a + c.value, 0);
                                                    const pct = total > 0 ? ((d.value / total) * 100).toFixed(0) : "0";
                                                    return (
                                                        <div key={d.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0" }}>
                                                            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                                                <span style={{ width: 7, height: 7, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                                                                <span style={{ fontSize: 11, color: token.colorTextSecondary }}>{d.name}</span>
                                                            </div>
                                                            <span style={{ fontSize: 11, fontWeight: 700, color: d.color, fontFamily: "'DM Mono',monospace" }}>{d.value} ({pct}%)</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    )}
                                </Card>
                            </Col>
                            <Col xs={24} md={12}>
                                <Card bordered={false} style={cardBase} bodyStyle={{ padding: "20px 22px" }}>
                                    <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13, marginBottom: 14 }}>
                                        Sebaran Pencapaian Hafalan
                                    </div>
                                    {loadingHafalanList ? <Skeleton active paragraph={{ rows: 5 }} /> : (
                                        <div style={{ width: "100%", height: 235 }}>
                                            <ResponsiveContainer>
                                                <BarChart data={hafalanDistribution} layout="vertical" barCategoryGap="25%">
                                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} strokeOpacity={0.07} />
                                                    <XAxis type="number" tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                                                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: token.colorTextSecondary as string }} width={92} axisLine={false} tickLine={false} />
                                                    <ReTooltip content={<PremiumTooltip token={token} />} cursor={{ fill: isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.025)" }} />
                                                    <Bar dataKey="jumlah" name="Santri" radius={[0, 6, 6, 0]} maxBarSize={18}>
                                                        {hafalanDistribution.map((d, i) => <Cell key={i} fill={d.color} />)}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}
                                </Card>
                            </Col>
                            <Col span={24}>
                                <Card bordered={false} style={cardBase} bodyStyle={{ padding: "20px 22px" }}>
                                    <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13, marginBottom: 14 }}>
                                        Tren Prestasi 12 Bulan Terakhir
                                    </div>
                                    {isLoadingPrestasi ? <Skeleton active paragraph={{ rows: 5 }} /> :
                                    monthlyTrendData.length === 0 ? (
                                        <Empty description="Belum ada data tren" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: "16px 0" }} />
                                    ) : (
                                        <div style={{ width: "100%", height: 190 }}>
                                            <ResponsiveContainer>
                                                <AreaChart data={monthlyTrendData}>
                                                    <defs>
                                                        <linearGradient id="gPrestasiTrend" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor={GOLD_BRIGHT} stopOpacity={0.4} />
                                                            <stop offset="100%" stopColor={GOLD_BRIGHT} stopOpacity={0.02} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.07} />
                                                    <XAxis dataKey="periode" tick={TICK} axisLine={false} tickLine={false} />
                                                    <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                                                    <ReTooltip content={<PremiumTooltip token={token} />} />
                                                    <Area type="monotone" dataKey="total" name="Jumlah Prestasi" stroke={GOLD_BRIGHT} fill="url(#gPrestasiTrend)" strokeWidth={2.5} />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}
                                </Card>
                            </Col>
                        </Row>
                    </Col>

                    {/* Scrollable Total Hafalan column — explicitly requested */}
                    <Col xs={24} xl={8}>
                        <Card bordered={false} style={{ ...cardBase, height: "100%", display: "flex", flexDirection: "column" }}
                            bodyStyle={{ padding: "20px 0 0", display: "flex", flexDirection: "column", height: "100%" }}>
                            <div style={{ padding: "0 22px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <div>
                                    <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 14 }}>Total Hafalan Santri</div>
                                    <div style={{ fontSize: 11, color: token.colorTextSecondary, marginTop: 2 }}>
                                        Diurutkan dari juz terbanyak · {hafalanList.length} santri
                                    </div>
                                </div>
                                <span style={{
                                    padding: "2px 9px", borderRadius: 99, fontSize: 9.5, fontWeight: 700,
                                    background: `${GOLD}18`, color: GOLD_BRIGHT, border: `1px solid ${GOLD}30`,
                                }}>Live</span>
                            </div>
                            <div style={{
                                flex: 1, overflowY: "auto", maxHeight: 560, padding: "0 14px 14px",
                                borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}`,
                            }}>
                                {loadingHafalanList ? (
                                    <div style={{ padding: "16px 8px" }}><Skeleton active paragraph={{ rows: 8 }} /></div>
                                ) : hafalanList.length === 0 ? (
                                    <Empty description="Belum ada data santri tahfidz" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: "30px 0" }} />
                                ) : (
                                    hafalanList.map((s, idx) => {
                                        const juz = Number(s.total_hafalan || 0);
                                        const isTop3 = idx < 3;
                                        const isKhatam = juz >= 30;
                                        return (
                                            <motion.div key={s.nis}
                                                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                                                transition={{ duration: 0.3, delay: Math.min(idx * 0.02, 0.6) }}
                                                style={{
                                                    display: "flex", alignItems: "center", gap: 10,
                                                    padding: "9px 10px", borderRadius: 12, marginTop: 6,
                                                    background: isTop3 ? (isDark ? `${GOLD}0e` : `${GOLD}08`) : "transparent",
                                                    border: isTop3 ? `1px solid ${GOLD}22` : "1px solid transparent",
                                                }}>
                                                <div style={{
                                                    width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    fontSize: 11, fontWeight: 800, fontFamily: "'DM Mono',monospace",
                                                    background: isTop3 ? `linear-gradient(135deg, ${GOLD_BRIGHT}, ${GOLD_DARK})` : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"),
                                                    color: isTop3 ? "#fff" : token.colorTextTertiary,
                                                }}>{idx + 1}</div>
                                                <Avatar size={30} src={s.foto_url} icon={<UserOutlined />} style={{ flexShrink: 0, border: `1.5px solid ${G(.25)}` }} />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: 12.5, fontWeight: 700, color: token.colorText, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                        {s.nama}
                                                    </div>
                                                    <div style={{ fontSize: 10, color: token.colorTextTertiary }}>Kelas {s.kelas || "-"}</div>
                                                </div>
                                                <div style={{ textAlign: "right", flexShrink: 0 }}>
                                                    <div style={{
                                                        fontFamily: "'DM Mono',monospace", fontWeight: 800, fontSize: 14,
                                                        color: isKhatam ? EMERALD : GOLD_BRIGHT,
                                                    }}>{juz}</div>
                                                    <div style={{ fontSize: 8.5, color: token.colorTextTertiary }}>Juz</div>
                                                </div>
                                            </motion.div>
                                        );
                                    })
                                )}
                            </div>
                        </Card>
                    </Col>
                </Row>
            </motion.div>

            {/* ── HALL OF FAME (existing RPC-based + Kitab) ───────────────────── */}
            <motion.div variants={fadeUp} custom={3}>
                <SectionHeader icon={<FireOutlined />} title="Hall of Fame" subtitle="Peringkat otomatis berbasis data setoran & capaian kitab" />
                <Row gutter={[16, 16]}>
                    <Col xs={24} lg={14}>
                        <Card bordered={false} style={cardBase} bodyStyle={{ padding: 0 }}>
                            <div style={{ padding: "18px 22px 4px", display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ width: 34, height: 34, borderRadius: 10, background: `${ORANGE}18`, border: `1px solid ${ORANGE}30`, display: "flex", alignItems: "center", justifyContent: "center", color: ORANGE, fontSize: 15 }}>
                                    <FireOutlined />
                                </div>
                                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 14 }}>Top 10 Hafalan Al-Qur'an</div>
                            </div>
                            <List
                                loading={loadingTahfidz}
                                dataSource={topTahfidz}
                                style={{ padding: "8px 0" }}
                                renderItem={(item, index) => (
                                    <List.Item style={{ padding: "10px 22px", border: "none" }}>
                                        <List.Item.Meta
                                            avatar={
                                                <Space size="middle">
                                                    <div style={{
                                                        width: 30, height: 30, borderRadius: "50%", display: "flex",
                                                        alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12,
                                                        background: index < 3 ? `linear-gradient(135deg, ${GOLD_BRIGHT}, ${GOLD_DARK})` : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"),
                                                        color: index < 3 ? "#fff" : token.colorTextTertiary,
                                                    }}>{index + 1}</div>
                                                    <Avatar src={item.foto_url} icon={<UserOutlined />} style={{ border: `1.5px solid ${G(.25)}` }} />
                                                </Space>
                                            }
                                            title={<Text strong style={{ fontSize: 13 }}>{item.nama}</Text>}
                                            description={<Text style={{ fontSize: 11, color: token.colorTextSecondary }}>Kelas {item.kelas} · {item.jurusan}</Text>}
                                        />
                                        <div style={{ textAlign: "right" }}>
                                            <div style={{ fontFamily: "'DM Mono',monospace", fontWeight: 800, fontSize: 17, color: GOLD_DARK }}>
                                                {Number(item.total_hafalan || 0)} <span style={{ fontSize: 11, fontWeight: 600 }}>Juz</span>
                                            </div>
                                            <Text style={{ fontSize: 9.5, color: token.colorTextTertiary }}>
                                                {item.last_setoran ? `Update ${dayjs(item.last_setoran).format("DD MMM YYYY")}` : "Capaian Akumulatif"}
                                            </Text>
                                        </div>
                                    </List.Item>
                                )}
                            />
                        </Card>
                    </Col>
                    <Col xs={24} lg={10}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
                            <Card bordered={false} style={cardBase} bodyStyle={{ padding: "18px 22px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                                    <div style={{ width: 34, height: 34, borderRadius: 10, background: `${INFO}18`, border: `1px solid ${INFO}30`, display: "flex", alignItems: "center", justifyContent: "center", color: INFO, fontSize: 15 }}>
                                        <BookOutlined />
                                    </div>
                                    <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 14 }}>Capaian Kitab Terbanyak</div>
                                </div>
                                <Skeleton loading={loadingKitab} active>
                                    {topKitab?.data.map((item) => (
                                        <div key={item.nis} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                                            <Space>
                                                <Avatar size="small" src={item.foto_url} icon={<UserOutlined />} />
                                                <Text strong style={{ fontSize: 12.5 }}>{item.nama}</Text>
                                            </Space>
                                            <Tag style={{ background: `${INFO}18`, color: INFO, border: `1px solid ${INFO}30`, borderRadius: 99, fontWeight: 700 }}>
                                                {item.hafalan_kitab || "-"}
                                            </Tag>
                                        </div>
                                    ))}
                                </Skeleton>
                            </Card>

                            <div style={{
                                borderRadius: 20, padding: "22px 24px", flex: 1,
                                background: `linear-gradient(135deg, ${EMERALD} 0%, #047857 100%)`,
                                boxShadow: `0 12px 32px ${EMERALD}40`, position: "relative", overflow: "hidden",
                            }}>
                                <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
                                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.8)", marginBottom: 8 }}>
                                    Total Khataman Tahun Ini
                                </div>
                                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                                    <SafetyCertificateOutlined style={{ fontSize: 22, color: "#fff" }} />
                                    <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 900, fontSize: 36, color: "#fff", letterSpacing: "-0.03em" }}>
                                        <AnimatedValue value={kpi.totalKhatam} />
                                    </span>
                                    <span style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>Santri</span>
                                </div>
                                <Divider style={{ borderColor: "rgba(255,255,255,0.15)", margin: "14px 0" }} />
                                <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.7)" }}>
                                    Target: 50 Santri Khatam 30 Juz
                                </div>
                                <div style={{ height: 6, borderRadius: 99, background: "rgba(255,255,255,0.15)", overflow: "hidden", marginTop: 8 }}>
                                    <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min((kpi.totalKhatam / 50) * 100, 100)}%` }}
                                        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
                                        style={{ height: "100%", borderRadius: 99, background: "#fff" }} />
                                </div>
                            </div>
                        </div>
                    </Col>
                </Row>
            </motion.div>

            {/* ── SMART FILTER PANEL ────────────────────────────────────────────── */}
            <motion.div variants={fadeUp} custom={4}>
                <SectionHeader icon={<FilterOutlined />} title="Filter & Pencarian" subtitle="Saring data prestasi berdasarkan kategori dan periode"
                    action={activeFilters > 0 ? (
                        <Button icon={<ClearOutlined />} onClick={resetFilters} size="small"
                            style={{ borderRadius: 10, fontSize: 12, fontWeight: 600 }}>
                            Reset ({activeFilters})
                        </Button>
                    ) : undefined} />
                <Card bordered={false} style={cardBase} bodyStyle={{ padding: "18px 22px" }}>
                    <Row gutter={[16, 12]} align="middle">
                        <Col xs={24} sm={12} lg={8}>
                            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: GOLD, marginBottom: 7 }}>KATEGORI</div>
                            <Select
                                placeholder="Semua Kategori" allowClear value={filterKategori} onChange={setFilterKategori}
                                style={{ width: "100%" }}
                                options={PRESTASI_KATEGORI_OPTIONS.map(o => ({ label: o.label, value: o.value }))}
                            />
                        </Col>
                        <Col xs={24} sm={12} lg={8}>
                            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: GOLD, marginBottom: 7 }}>PERIODE TANGGAL</div>
                            <DatePicker.RangePicker
                                value={filterRange} onChange={(d) => setFilterRange(d && d[0] && d[1] ? [d[0], d[1]] : null)}
                                format="DD MMM YYYY" style={{ width: "100%" }}
                                presets={[
                                    { label: "Bulan Ini", value: [dayjs().startOf("month"), dayjs().endOf("month")] },
                                    { label: "Tahun Ini", value: [dayjs().startOf("year"), dayjs().endOf("year")] },
                                    { label: "30 Hari", value: [dayjs().subtract(29, "day"), dayjs()] },
                                ]}
                            />
                        </Col>
                        <Col xs={24} lg={8}>
                            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center", height: "100%" }}>
                                {filterKategori && (
                                    <span onClick={() => setFilterKategori(null)} style={{
                                        cursor: "pointer", padding: "3px 10px", borderRadius: 99, fontSize: 10, fontWeight: 700,
                                        background: `${KATEGORI_COLOR_MAP[filterKategori]}18`, color: KATEGORI_COLOR_MAP[filterKategori],
                                        border: `1px solid ${KATEGORI_COLOR_MAP[filterKategori]}35`,
                                    }}>{PRESTASI_KATEGORI_OPTIONS.find(o => o.value === filterKategori)?.label} ×</span>
                                )}
                                {filterRange && (
                                    <span onClick={() => setFilterRange(null)} style={{
                                        cursor: "pointer", padding: "3px 10px", borderRadius: 99, fontSize: 10, fontWeight: 700,
                                        background: `${INFO}18`, color: INFO, border: `1px solid ${INFO}35`,
                                    }}><CalendarOutlined style={{ marginRight: 4 }} />{filterRange[0].format("DD/MM")} – {filterRange[1].format("DD/MM")} ×</span>
                                )}
                            </div>
                        </Col>
                    </Row>
                </Card>
            </motion.div>

            {/* ── TABLE ─────────────────────────────────────────────────────────── */}
            <motion.div variants={fadeUp} custom={5}>
                <SectionHeader icon={<LineChartOutlined />} title="Log Prestasi Manual & Khusus"
                    subtitle={`${filteredPrestasi.length} prestasi tercatat · Qubra, Lomba, Khatam, dan lainnya`} />
                <div style={{
                    borderRadius: 20, overflow: "hidden",
                    border: `1px solid ${isDark ? G(.16) : G(.18)}`,
                    boxShadow: isDark ? "0 8px 40px rgba(0,0,0,0.3)" : "0 4px 20px rgba(0,0,0,0.05)",
                }}>
                    <ProTable<IPrestasiSantri>
                        {...tableProps}
                        dataSource={filteredPrestasi}
                        columns={columns}
                        rowKey="id"
                        search={false}
                        headerTitle={
                            <Space>
                                <LineChartOutlined style={{ color: GOLD_BRIGHT }} />
                                <Text strong>Daftar Prestasi</Text>
                            </Space>
                        }
                        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `Total ${t} prestasi` }}
                    />
                </div>
            </motion.div>

            {/* ── MODAL CREATE/EDIT ────────────────────────────────────────────── */}
            <Modal
                open={isModalOpen} onCancel={closeModal} onOk={() => form.submit()} centered destroyOnHidden
                width={560}
                okText={editingRecord ? "Perbarui Data" : "Simpan Prestasi"}
                cancelText="Batal"
                okButtonProps={{ style: { borderRadius: 10, fontWeight: 700, background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})`, border: "none" } }}
                cancelButtonProps={{ style: { borderRadius: 10 } }}
                styles={{
                    content: { borderRadius: 24, overflow: "hidden", border: `1px solid ${isDark ? GOLD + "22" : GOLD + "28"}` },
                    mask: { backdropFilter: "blur(6px)" },
                }}
                title={
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 11, background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 16 }}>
                            <TrophyOutlined />
                        </div>
                        <span style={{ fontWeight: 800, fontFamily: "'Syne',sans-serif" }}>
                            {editingRecord ? "Edit Prestasi" : "Catat Prestasi Baru"}
                        </span>
                    </div>
                }>
                <Form form={form} layout="vertical" onFinish={handleSubmitPrestasi} style={{ marginTop: 16 }}>
                    <Form.Item name="santri_nis" label="Pilih Santri" rules={[{ required: true, message: "Santri wajib dipilih" }]}>
                        <Select {...santriSelectProps} showSearch placeholder="Cari nama santri..." />
                    </Form.Item>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="kategori" label="Kategori" rules={[{ required: true, message: "Kategori wajib dipilih" }]}>
                                <Select options={PRESTASI_KATEGORI_OPTIONS.map(({ label, value }) => ({ label, value }))} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="tanggal_prestasi" label="Tanggal" rules={[{ required: true, message: "Tanggal wajib diisi" }]}>
                                <DatePicker style={{ width: "100%" }} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="judul_prestasi" label="Judul Prestasi (Contoh: Khatam Imrity, Juara 1 MQK)" rules={publicTextRules(true)}>
                        <Input placeholder="Tulis nama prestasi..." />
                    </Form.Item>
                    <Form.Item name="keterangan" label="Keterangan Tambahan" rules={publicTextRules(false)}>
                        <Input.TextArea rows={3} maxLength={300} showCount placeholder="Detail singkat yang aman tampil di Android publik..." />
                    </Form.Item>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="poin_prestasi" label="Poin Prestasi">
                                <InputNumber min={0} precision={0} style={{ width: "100%" }} placeholder="0" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="sertifikat_url" label="URL Sertifikat Internal" rules={[{ type: "url", warningOnly: true, message: "Gunakan URL valid jika diisi" }]}>
                                <Input prefix={<LinkOutlined />} placeholder="Opsional, tidak tampil di publik" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        Judul dan keterangan tampil di Android publik. Jangan isi NIS, nomor HP, alamat, data wali/orang tua, NIK/KK, rekening, atau link sertifikat.
                    </Text>
                </Form>
            </Modal>
        </motion.div>
    );
};
