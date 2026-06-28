import React, { useState, useEffect, useMemo } from "react";
import { useTable, useSelect } from "@refinedev/antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import { Tag, Space, Button, Typography, Tooltip, Avatar, theme, Spin, Modal, message, Segmented, Dropdown, Tabs, DatePicker, Radio, Select, Card } from "antd";
import {
    PlusOutlined,
    ReadOutlined,
    UserOutlined,
    EyeOutlined,
    DownloadOutlined,
    SafetyCertificateOutlined,
    TrophyOutlined,
    TeamOutlined,
    BookOutlined,
    RiseOutlined,
    CheckCircleFilled,
    CloseCircleOutlined,
    MedicineBoxOutlined,
    HomeOutlined,
    BankOutlined,
    CalendarOutlined,
    MenuOutlined,
    FileExcelOutlined,
    BarChartOutlined,
    StarOutlined,
    CrownOutlined,
    CheckCircleOutlined,
    WarningOutlined,
} from "@ant-design/icons";
import { ISantri } from "../../types";
import { useNavigation, useGetIdentity } from "@refinedev/core";
import dayjs from "dayjs";
import { formatHijri, formatFullDate, formatMasehi } from "../../utility/dateHelper";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
} from "recharts";
import { santriAlias } from "../../utility/privacy";
import { supabaseClient } from "../../utility/supabaseClient";

const { Text } = Typography;
const { useToken } = theme;

// ─────────────────── Status Absensi ───────────────────
const STATUS_ABSENSI = [
  { key: 'HADIR',   label: 'Hadir',       icon: '✅', color: '#16A34A', bg: 'rgba(22,163,74,0.10)' },
  { key: 'SAKIT',   label: 'Sakit',       icon: '🤒', color: '#D97706', bg: 'rgba(217,119,6,0.10)' },
  { key: 'GHAIB',   label: 'Ghaib',       icon: '❌', color: '#DC2626', bg: 'rgba(220,38,38,0.10)' },
  { key: 'SEKOLAH', label: 'Sekolah',     icon: '🏫', color: '#2563EB', bg: 'rgba(37,99,235,0.10)' },
  { key: 'PULANG',  label: 'Pulang',      icon: '🏠', color: '#9333EA', bg: 'rgba(147,51,234,0.10)' },
];

// ─────────────────────────── Types ───────────────────────────
type LatestHafalan = {
    santri_nis: string;
    tanggal: string | null;
    surat: string | null;
    ayat_awal: number | null;
    ayat_akhir: number | null;
    juz: number | null;
};

type DetailSetoran = {
    surat: string | null;
    ayat_awal: number | null;
    ayat_akhir: number | null;
    juz: number | null;
    status_setoran: string | null;
};

const formatDetailSetoran = (d: DetailSetoran) => {
    const statusLabel = d.status_setoran === 'LANCAR' ? '✅' : d.status_setoran === 'MENGULANG' ? '🔄' : '';
    const setoranInfo = d.surat
        ? (() => {
            const ayat = d.ayat_awal && d.ayat_akhir ? `${d.ayat_awal}–${d.ayat_akhir}` : '';
            return `${d.surat}${ayat ? ' ' + ayat : ''}`;
        })()
        : d.juz
            ? `Juz ${d.juz}`
            : 'Setoran';
    return `${statusLabel} ${setoranInfo}`.trim();
};

// ─────────────────────────── Helpers ───────────────────────────
const formatTotalHafalan = (value?: string | number | null) => {
    if (value === null || value === undefined || value === "") return "0";
    const raw = String(value).trim().replace(/juz/i, "").trim();
    return raw || "0";
};

const formatLatestHafalan = (record?: LatestHafalan) => {
    if (!record) return "Belum ada setoran";
    if (record.surat) {
        const ayat =
            record.ayat_awal && record.ayat_akhir
                ? ` (${record.ayat_awal}–${record.ayat_akhir})`
                : "";
        return `${record.surat}${ayat}`;
    }
    if (record.juz) return `Juz ${record.juz}`;
    if (record.tanggal) return "Setoran (tanpa detail)";
    return "Belum ada setoran";
};

const totalNum = (value?: string | number | null) => {
    const n = parseInt(String(value ?? "0").replace(/[^0-9]/g, ""), 10);
    return isNaN(n) ? 0 : n;
};

// ─────────────────────────── Mini Juz Strip ───────────────────────────
const MiniJuzStrip: React.FC<{ completed: number; current: number | null; isDark: boolean }> = ({
    completed,
    current,
    isDark,
}) => {
    return (
        <Tooltip
            title={`${completed} Juz selesai${current ? `, posisi Juz ${current}` : ""}`}
            placement="top"
        >
            <div style={{ display: "flex", gap: 2, alignItems: "center", cursor: "default" }}>
                {Array.from({ length: 30 }, (_, i) => {
                    const juzNum = i + 1;
                    const done = juzNum <= completed;
                    const isCurrent = juzNum === current;
                    return (
                        <div
                            key={juzNum}
                            style={{
                                width: done ? 7 : 6,
                                height: done ? 10 : 8,
                                borderRadius: 2,
                                background: isCurrent
                                    ? "#D97706"
                                    : done
                                    ? "#047857"
                                    : isDark
                                    ? "#1E293B"
                                    : "#E2E8F0",
                                flexShrink: 0,
                                transition: "all 0.15s",
                            }}
                        />
                    );
                })}
            </div>
        </Tooltip>
    );
};

// ─────────────────── Export helpers (shared by GLOBAL & PERSONAL) ───────────────────

const DAYS_INDO = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const formatSetoranText = (h: any): string => {
    const parts: string[] = [];
    if (h.juz) parts.push(`Juz ${h.juz}`);
    if (h.surat) {
        const ayat = h.ayat_awal && h.ayat_akhir ? ` (${h.ayat_awal}-${h.ayat_akhir})` : '';
        parts.push(`${h.surat}${ayat}`);
    }
    return parts.join(' · ');
};

const mapStatusCode = (status: string, hasSetoran: boolean): string => {
    if (status === 'HADIR') return hasSetoran ? 'H' : 'TS';
    if (status === 'SAKIT') return 'S';
    if (status === 'GHAIB') return 'A';
    if (status === 'SEKOLAH') return 'Sk';
    if (status === 'PULANG') return 'P';
    return status;
};

const colLetter = (n: number): string => {
    let s = '';
    while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
    return s;
};

// ─────────────────────────── KPI Summary Bar ───────────────────────────
const GRADE_COLORS = {
    Mumtaz: { bg: '#D1FAE5', fg: '#047857', icon: '🏆' },
    Jayyid: { bg: '#DBEAFE', fg: '#2563EB', icon: '⭐' },
    Maqbul: { bg: '#FEF3C7', fg: '#D97706', icon: '📗' },
    Kurang: { bg: '#FEE2E2', fg: '#DC2626', icon: '📕' },
};

const getGrade = (juz: number): keyof typeof GRADE_COLORS => {
    if (juz >= 15) return 'Mumtaz';
    if (juz >= 10) return 'Jayyid';
    if (juz >= 5) return 'Maqbul';
    return 'Kurang';
};

const KPISummaryBar: React.FC<{
    data: ISantri[];
    isDark: boolean;
    loading: boolean;
    sudahSetoranHariIni: number;
    ketidakhadiranHariIni: number;
    rataKehadiran7Hari: string;
}> = ({ data, loading, sudahSetoranHariIni, ketidakhadiranHariIni, rataKehadiran7Hari }) => {
    const total = data.length;
    const { token } = useToken();

    const grades = { Mumtaz: 0, Jayyid: 0, Maqbul: 0, Kurang: 0 };
    for (const s of data) {
        const juz = totalNum(s.total_hafalan);
        grades[getGrade(juz)]++;
    }

    const gradeChart = Object.entries(GRADE_COLORS).map(([name, c]) => ({
        name,
        count: grades[name as keyof typeof grades],
        fill: c.fg,
        bg: c.bg,
        icon: c.icon,
    }));

    const stats = [
        {
            label: "Total Santri",
            value: loading ? "…" : total,
            icon: <TeamOutlined />,
            accent: "#2563EB",
            sub: "Takhasus Tahfidz",
        },
        {
            label: "Rata-rata Kehadiran (7 Hari)",
            value: loading ? "…" : rataKehadiran7Hari,
            icon: <CalendarOutlined />,
            accent: "#7C3AED",
            sub: `dari ${total} santri`,
        },
        {
            label: "Grade Santri",
            value: loading ? "…" : (
                <div style={{ display: "flex", gap: 6, fontSize: 12, fontWeight: 600, alignItems: "center" }}>
                    {gradeChart.map(g => (
                        <span key={g.name} style={{
                            padding: "2px 6px", borderRadius: 4,
                            background: g.bg, color: g.fill,
                            fontSize: 10, whiteSpace: "nowrap",
                        }}>
                            {g.icon} {g.name} {g.count}
                        </span>
                    ))}
                </div>
            ),
            icon: <TrophyOutlined />,
            accent: "#D97706",
            sub: `${grades.Mumtaz} Mumtaz · ${grades.Jayyid} Jayyid · ${grades.Maqbul} Maqbul · ${grades.Kurang} Kurang`,
        },
        {
            label: "Setoran Hari Ini",
            value: loading ? "…" : sudahSetoranHariIni,
            icon: <RiseOutlined />,
            accent: "#047857",
            sub: `dari ${total} santri (belum: ${total - sudahSetoranHariIni})`,
        },
        {
            label: "Ketidakhadiran Hari Ini",
            value: loading ? "…" : ketidakhadiranHariIni,
            icon: <WarningOutlined />,
            accent: "#DC2626",
            sub: `${total - ketidakhadiranHariIni} hadir`,
        },
    ];

    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
                gap: 12,
                marginBottom: 16,
            }}
        >
            {stats.map((s) => (
                <div
                    key={s.label}
                    style={{
                        background: token.colorBgContainer,
                        border: `1px solid ${token.colorBorderSecondary}`,
                        borderRadius: 12,
                        padding: "14px 16px",
                        position: "relative",
                        overflow: "hidden",
                    }}
                >
                    <div
                        style={{
                            position: "absolute",
                            top: 0,
                            right: 0,
                            width: 48,
                            height: 48,
                            background: s.accent,
                            opacity: 0.07,
                            borderRadius: "0 12px 0 48px",
                        }}
                    />
                    <div
                        style={{
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            background: s.accent + "20",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: s.accent,
                            fontSize: 14,
                            marginBottom: 8,
                        }}
                    >
                        {s.icon}
                    </div>
                    <Text
                        style={{
                            fontSize: 10,
                            color: token.colorTextSecondary,
                            display: "block",
                            letterSpacing: "0.05em",
                            textTransform: "uppercase",
                        }}
                    >
                        {s.label}
                    </Text>
                    <div
                        style={{
                            fontSize: 20,
                            fontWeight: 700,
                            color: token.colorText,
                            lineHeight: 1.2,
                            marginTop: 2,
                        }}
                    >
                        {s.value}
                    </div>
                    {s.label !== "Grade Santri" && (
                        <Text
                            style={{
                                fontSize: 10,
                                color: token.colorTextSecondary,
                                display: "block",
                                marginTop: 2,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                            }}
                        >
                            {s.sub}
                        </Text>
                    )}
                </div>
            ))}
        </div>
    );
};

// ─────────────────────────── Absensi Cepat Table ───────────────────────────
const AbsensiCepatTable: React.FC<{
    santriData: ISantri[];
    sesiRecords: Record<string, {status: string; setoran: boolean}>;
    detailSetoranMap: Record<string, DetailSetoran>;
    savingSesi: Record<string, boolean>;
    sesiJenis: string;
    sesiWaktu: string;
    sesiTanggal: dayjs.Dayjs;
    onStatusClick: (nis: string, status: string) => void;
    isDark: boolean;
}> = ({
    santriData,
    sesiRecords,
    detailSetoranMap,
    savingSesi,
    sesiJenis,
    sesiWaktu,
    sesiTanggal,
    onStatusClick,
    isDark,
}) => {
    const { token } = useToken();

    return (
        <div style={{ background: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${token.colorBorderSecondary}`, background: isDark ? "#1E293B" : "#F8FAFC" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 20 }}>☀️</span>
                        <Text strong style={{ fontSize: 16, color: token.colorText }}>
                            Absensi Cepat — {sesiTanggal.format('DD MMM YYYY')} · {sesiJenis} / {sesiWaktu}
                        </Text>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <Tag color="green" style={{ fontSize: 10 }}>HADIR = Setoran</Tag>
                        <Tag color="red" style={{ fontSize: 10 }}>GHAIB</Tag>
                        <Tag color="orange" style={{ fontSize: 10 }}>SAKIT</Tag>
                        <Tag color="purple" style={{ fontSize: 10 }}>PULANG</Tag>
                        <Tag color="blue" style={{ fontSize: 10 }}>SEKOLAH</Tag>
                    </div>
                </div>
                <div style={{ fontSize: 11, color: token.colorTextSecondary }}>
                    Klik status untuk simpan cepat. Badge hijau = sudah input detail via "Setoran Hafalan Detail".
                </div>
            </div>

            <div style={{ maxHeight: 600, overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ background: isDark ? "#1E293B" : "#F8FAFC" }}>
                            <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, color: token.colorTextSecondary, fontWeight: 600, borderBottom: `1px solid ${token.colorBorderSecondary}`, width: 40 }}>#</th>
                            <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, color: token.colorTextSecondary, fontWeight: 600, borderBottom: `1px solid ${token.colorBorderSecondary}`, width: 200 }}>Santri</th>
                            <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, color: token.colorTextSecondary, fontWeight: 600, borderBottom: `1px solid ${token.colorBorderSecondary}`, width: 80 }}>Kelas</th>
                            <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, color: token.colorTextSecondary, fontWeight: 600, borderBottom: `1px solid ${token.colorBorderSecondary}`, width: 100 }}>Progress</th>
                            <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, color: token.colorTextSecondary, fontWeight: 600, borderBottom: `1px solid ${token.colorBorderSecondary}` }}>Status Hari Ini</th>
                        </tr>
                    </thead>
                    <tbody>
                        {santriData.map((santri, idx) => {
                            const rec = sesiRecords[santri.nis] || {};
                            const currentStatus = rec.status || '';
                            const isSaving = savingSesi[santri.nis];
                            const juzNum = parseInt(String(santri.total_hafalan ?? "0").replace(/[^0-9]/g, ""), 10) || 0;
                            const pct = Math.round((juzNum / 30) * 100);

                            return (
                                <tr key={santri.nis} style={{ borderBottom: `1px solid ${isDark ? "#1E2D3D" : "#F1F5F9"}` }}>
                                    <td style={{ padding: "10px 12px", fontSize: 11, color: token.colorTextSecondary }}>{idx + 1}</td>
                                    <td style={{ padding: "10px 12px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <Avatar src={santri.foto_url} size={32} icon={<UserOutlined />} style={{ background: "linear-gradient(135deg, #047857, #10B981)", color: "#fff", flexShrink: 0 }} />
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontWeight: 600, fontSize: 13, color: token.colorText, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                    {santri.nama}
                                                </div>
                                                <div style={{ fontSize: 11, color: token.colorTextSecondary }}>
                                                    <code style={{ background: isDark ? "#0F172A" : "#F1F5F9", padding: "1px 5px", borderRadius: 4, fontSize: 10 }}>{santri.nis}</code>
                                                </div>
                                            </div>
                                            {rec.status === 'HADIR' && (detailSetoranMap[santri.nis] ? (
                                                <Tag style={{ marginLeft: 8, padding: "2px 6px", background: detailSetoranMap[santri.nis].status_setoran === 'MENGULANG' ? "#FEF3C7" : "#D1FAE5", color: detailSetoranMap[santri.nis].status_setoran === 'MENGULANG' ? '#B45309' : '#047857', border: "none", fontSize: 10 }}>
                                                    {formatDetailSetoran(detailSetoranMap[santri.nis])}
                                                </Tag>
                                            ) : (
                                                <Tag style={{ marginLeft: 8, padding: "2px 6px", background: "#FEE2E2", color: "#DC2626", border: "none", fontSize: 10 }}>
                                                    ❌ Tidak setoran
                                                </Tag>
                                            ))}
                                        </div>
                                    </td>
                                    <td style={{ padding: "10px 12px" }}>
                                        <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, background: isDark ? "#1E3A5F" : "#DBEAFE", color: "#2563EB", fontWeight: 700, fontSize: 12 }}>
                                            {santri.kelas}
                                        </div>
                                    </td>
                                    <td style={{ padding: "10px 12px" }}>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                            <div style={{ display: "flex", gap: 2 }}>
                                                {Array.from({ length: 10 }, (_, i) => {
                                                    const j = i + 1;
                                                    return (
                                                        <div key={j} style={{ width: 6, height: 8, borderRadius: 1.5, background: j <= Math.round(juzNum / 3) ? "#047857" : isDark ? "#1E293B" : "#E2E8F0", flexShrink: 0 }} />
                                                    );
                                                })}
                                            </div>
                                            <div style={{ fontSize: 11, fontWeight: 600, color: "#047857" }}>
                                                {juzNum} Juz ({pct}%)
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: "10px 12px" }}>
                                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                            {STATUS_ABSENSI.map(s => {
                                                const active = currentStatus === s.key;
                                                return (
                                                    <div
                                                        key={s.key}
                                                        onClick={() => !isSaving && onStatusClick(santri.nis, s.key)}
                                                        style={{
                                                            padding: "6px 10px", borderRadius: 8, cursor: isSaving ? "not-allowed" : "pointer",
                                                            fontSize: 11, fontWeight: active ? 700 : 400,
                                                            border: `1.5px solid ${active ? s.color : token.colorBorder}`,
                                                            background: active ? s.bg : "transparent",
                                                            color: active ? s.color : token.colorTextTertiary,
                                                            transition: "all 0.12s",
                                                            opacity: isSaving ? 0.5 : 1,
                                                            whiteSpace: "nowrap",
                                                        }}
                                                    >
                                                        {s.icon} {s.label}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {santriData.length === 0 && (
                    <div style={{ padding: "40px 20px", textAlign: "center", color: token.colorTextSecondary }}>
                        Tidak ada santri aktif
                    </div>
                )}
            </div>
        </div>
    );
};

// ─────────────────────────── Main Component ───────────────────────────
export const HafalanList = () => {
    const { token } = useToken();
    const hexLum = (hex: string) => {
        const c = hex.replace("#", "");
        if (c.length < 6) return 200;
        return .299 * parseInt(c.slice(0, 2), 16) + .587 * parseInt(c.slice(2, 4), 16) + .114 * parseInt(c.slice(4, 6), 16);
    };
    const isDark = hexLum(token.colorBgContainer) < 128;

    const { tableProps, tableQueryResult } = useTable<ISantri>({
        resource: "santri",
        syncWithLocation: true,
        meta: {
            select:
                "nama, nis, kelas, jurusan, jenis_kelamin, status_santri, pembimbing, total_hafalan, hafalan_kitab, foto_url",
        },
        filters: {
            permanent: [
                { field: "jurusan", operator: "eq", value: "TAHFIDZ" },
                { field: "status_santri", operator: "eq", value: "AKTIF" },
            ],
        },
        sorters: { initial: [{ field: "kelas", order: "asc" }] },
    });

    const { push } = useNavigation();
    const { data: user } = useGetIdentity<{ id: string }>();
    const [latestByNis, setLatestByNis] = React.useState<Record<string, LatestHafalan>>({});
    const [loadingLatest, setLoadingLatest] = React.useState(false);
    const [sessionModalOpen, setSessionModalOpen] = useState(false);
    const [sesiTanggal, setSesiTanggal] = useState<dayjs.Dayjs>(dayjs());
    const [sesiJenis, setSesiJenis] = useState<string>('ZIYADAH');
    const [sesiWaktu, setSesiWaktu] = useState<string>('PAGI');
    const [sesiRecords, setSesiRecords] = useState<Record<string, {status: string; setoran: boolean}>>({});
    const [savingSesi, setSavingSesi] = useState<Record<string, boolean>>({});
    const [santriForSesi, setSantriForSesi] = useState<any[]>([]);
    const [detailSetoranMap, setDetailSetoranMap] = useState<Record<string, DetailSetoran>>({});
    const [fetchKey, setFetchKey] = useState(0);
    const [sudahSetoranHariIni, setSudahSetoranHariIni] = useState<number>(0);
    const [ketidakhadiranHariIni, setKetidakhadiranHariIni] = useState<number>(0);
    const [rataKehadiran7Hari, setRataKehadiran7Hari] = useState<string>("0");
    const [activeTab, setActiveTab] = useState<'daftar' | 'absensi'>('daftar');
    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [exportType, setExportType] = useState<"GLOBAL" | "PERSONAL">("GLOBAL");
    const [exportDateRange, setExportDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
    const [selectedExportSantri, setSelectedExportSantri] = useState<string | undefined>(undefined);
    const [isLoadingExport, setIsLoadingExport] = useState(false);

    const { selectProps: santriSelectProps } = useSelect({
        resource: "santri",
        optionLabel: "nama",
        optionValue: "nis",
        filters: [
            { field: "jurusan", operator: "eq", value: "TAHFIDZ" },
            { field: "status_santri", operator: "eq", value: "AKTIF" },
        ],
        onSearch: (value) => [
            { field: "nama", operator: "contains", value },
            { field: "nis", operator: "contains", value },
        ],
    });

    // Shared handler for both modal and absensi cepat table
    const handleStatusClick = async (nis: string, status: string) => {
        if (savingSesi[nis]) return;

        setSavingSesi(prev => ({ ...prev, [nis]: true }));
        setSesiRecords(prev => ({
            ...prev,
            [nis]: { status, setoran: status === 'HADIR' ? (prev[nis]?.setoran ?? true) : false }
        }));
        try {
            const dateStr = sesiTanggal.format('YYYY-MM-DD');
            const { data: sesiList } = await supabaseClient
                .from("tahfidz_sesi")
                .select("id")
                .eq("tanggal", dateStr)
                .eq("kegiatan_id", sesiJenis)
                .eq("sesi", sesiWaktu)
                .eq("status", "OPEN")
                .limit(1);

            let sesi = sesiList && sesiList.length > 0 ? sesiList[0] : null;
            if (!sesi) {
                const { data: newSesi } = await supabaseClient
                    .from("tahfidz_sesi")
                    .insert({ kegiatan_id: sesiJenis, tanggal: dateStr, sesi: sesiWaktu })
                    .select("id")
                    .single();
                sesi = newSesi;
            }

            await supabaseClient
                .from("tahfidz_absensi")
                .upsert({
                    sesi_id: sesi!.id,
                    santri_nis: nis,
                    status,
                    setoran: status === 'HADIR',
                    penyimak_id: status === 'HADIR' ? user?.id : null,
                }, { onConflict: "sesi_id, santri_nis" });
            message.success(`${santriData.find(s => s.nis === nis)?.nama || nis}: ${STATUS_ABSENSI.find(s => s.key === status)?.label}`);
            setFetchKey(k => k + 1);
        } catch {
            message.error("Gagal menyimpan absensi");
        } finally {
            setSavingSesi(prev => ({ ...prev, [nis]: false }));
        }
    };

    // Fetch sesi records + detail setoran on mount / date / sesi change
    useEffect(() => {
        const santri = tableQueryResult?.data?.data || [];
        setSantriForSesi(santri);
        if (santri.length === 0) return;
        const today = sesiTanggal.format('YYYY-MM-DD');

        (async () => {
            // 1. Get current sesi + absensi records
            const { data: sesiList } = await supabaseClient
                .from("tahfidz_sesi")
                .select("id, tahfidz_absensi(id, santri_nis, status, setoran)")
                .eq("tanggal", today)
                .eq("kegiatan_id", sesiJenis)
                .eq("sesi", sesiWaktu)
                .eq("status", "OPEN")
                .limit(1);

            const sesi = sesiList && sesiList.length > 0 ? sesiList[0] : null;
            if (!sesi) { setSesiRecords({}); setDetailSetoranMap({}); return; }

            // Populate sesiRecords
            const recMap: Record<string, {status: string; setoran: boolean}> = {};
            const absensiIds: string[] = [];
            (sesi.tahfidz_absensi || []).forEach((r: any) => {
                recMap[r.santri_nis] = { status: r.status, setoran: r.setoran ?? true };
                if (r.id) absensiIds.push(r.id);
            });
            setSesiRecords(recMap);

            // 2. Get detail setoran hanya untuk absensi di sesi ini
            if (absensiIds.length === 0) { setDetailSetoranMap({}); return; }

            const { data } = await supabaseClient
                .from("hafalan_tahfidz")
                .select("santri_nis, surat, ayat_awal, ayat_akhir, juz, status_setoran")
                .in("absensi_id", absensiIds)
                .order("id", { ascending: false });
            const map: Record<string, DetailSetoran> = {};
            const seen = new Set<string>();
            (data || []).forEach((r: any) => {
                if (r.santri_nis && !seen.has(r.santri_nis)) {
                    seen.add(r.santri_nis);
                    map[r.santri_nis] = { surat: r.surat, ayat_awal: r.ayat_awal, ayat_akhir: r.ayat_akhir, juz: r.juz, status_setoran: r.status_setoran };
                }
            });
            setDetailSetoranMap(map);
        })();
    }, [sesiTanggal, sesiJenis, sesiWaktu, tableQueryResult?.data?.data, fetchKey]);

    React.useEffect(() => {
        const nisList = (tableQueryResult?.data?.data || [])
            .map((item) => item.nis)
            .filter(Boolean);
        if (nisList.length === 0) {
            setLatestByNis({});
            return;
        }
        let mounted = true;
        setLoadingLatest(true);

        const fetchLatest = async () => {
            const [{ data: hafalanData }, { data: absensiData }] = await Promise.all([
            supabaseClient
                .from("hafalan_tahfidz")
                .select("santri_nis,tanggal,surat,ayat_awal,ayat_akhir,juz")
                .in("santri_nis", nisList)
                .not("tanggal", "is", null)
                .order("tanggal", { ascending: false })
                .order("id", { ascending: false }),
            supabaseClient
                .from("tahfidz_absensi")
                .select("santri_nis, tahfidz_sesi!inner(tanggal)")
                .in("santri_nis", nisList)
                .eq("setoran", true),
            ]);

            if (!mounted) return;

            const next: Record<string, LatestHafalan> = {};
            const latestDateKey: Record<string, string> = {};

            (hafalanData || []).forEach((item) => {
                if (item.santri_nis && item.tanggal && !next[item.santri_nis]) {
                    next[item.santri_nis] = item as LatestHafalan;
                    latestDateKey[item.santri_nis] = dayjs(item.tanggal).format("YYYY-MM-DD");
                }
            });

            (absensiData || []).forEach((item: any) => {
                const nis = item.santri_nis;
                if (!nis) return;
                const sesiDate = item.tahfidz_sesi?.tanggal;
                if (!sesiDate) return;

                const currentDateKey = latestDateKey[nis] || "";
                if (sesiDate > currentDateKey) {
                    next[nis] = {
                        santri_nis: nis,
                        tanggal: sesiDate,
                        surat: null,
                        ayat_awal: null,
                        ayat_akhir: null,
                        juz: null,
                    };
                    latestDateKey[nis] = sesiDate;
                }
            });

            setLatestByNis(next);
            setLoadingLatest(false);
        };

        fetchLatest();
        return () => { mounted = false; };
    }, [tableQueryResult?.data?.data, fetchKey]);

    // Fetch jumlah santri yang sudah setoran hari ini
    React.useEffect(() => {
        const nisList = (tableQueryResult?.data?.data || [])
            .map((item) => item.nis)
            .filter(Boolean);
        if (nisList.length === 0) {
            setSudahSetoranHariIni(0);
            return;
        }
        const day = sesiTanggal.format('YYYY-MM-DD');
        supabaseClient
            .from("hafalan_tahfidz")
            .select("santri_nis")
            .in("santri_nis", nisList)
            .gte("tanggal", day + " 00:00:00")
            .lte("tanggal", day + " 23:59:59")
            .then(({ data }) => {
                const uniqueNis = new Set((data || []).map((r: any) => r.santri_nis));
                setSudahSetoranHariIni(uniqueNis.size);
            });
    }, [tableQueryResult?.data?.data, sesiTanggal]);

    // Fetch kehadiran hari ini & rata-rata 7 hari
    React.useEffect(() => {
        const nisList = (tableQueryResult?.data?.data || [])
            .map((item) => item.nis)
            .filter(Boolean);
        if (nisList.length === 0) {
            setKetidakhadiranHariIni(0);
            setRataKehadiran7Hari("0");
            return;
        }
        const today = sesiTanggal.format('YYYY-MM-DD');
        const lastWeek = dayjs(today).subtract(6, 'day').format('YYYY-MM-DD');
        supabaseClient
            .from("tahfidz_sesi")
            .select("id, tanggal, sesi, tahfidz_absensi(santri_nis, status)")
            .eq("kegiatan_id", "ZIYADAH")
            .gte("tanggal", lastWeek)
            .lte("tanggal", today)
            .then(({ data }) => {
                if (!data) return;
                const nisSet = new Set(nisList);
                // ── Per-date attendance ──
                const dayMap: Record<string, Set<string>> = {};
                const todayAbsent = new Set<string>();
                for (const sesi of data) {
                    if (!dayMap[sesi.tanggal]) dayMap[sesi.tanggal] = new Set();
                    for (const abs of (sesi.tahfidz_absensi || [])) {
                        if (!nisSet.has(abs.santri_nis)) continue;
                        if (abs.status === 'HADIR') dayMap[sesi.tanggal].add(abs.santri_nis);
                        if (sesi.tanggal === today && abs.status !== 'HADIR') todayAbsent.add(abs.santri_nis);
                    }
                }
                setKetidakhadiranHariIni(todayAbsent.size);
                // Rata-rata 7 hari (hanya hari dengan sesi)
                const datesWithData = [...new Set(data.map(s => s.tanggal))].sort();
                const rates = datesWithData.map(d => {
                    const hadir = dayMap[d]?.size || 0;
                    return nisList.length > 0 ? hadir / nisList.length : 0;
                });
                const avg = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
                setRataKehadiran7Hari(`${Math.round(avg * 100)}%`);
            });
    }, [tableQueryResult?.data?.data, sesiTanggal]);

    // ── Export ──
    const handleExport = async () => {
        if (!exportDateRange) {
            message.error("Mohon pilih rentang tanggal terlebih dahulu");
            return;
        }
        setIsLoadingExport(true);
        try {
            const startStr = exportDateRange[0].format("YYYY-MM-DD");
            const endStr = exportDateRange[1].format("YYYY-MM-DD");

            const [absensiRes, santriRes, profileRes] = await Promise.all([
                supabaseClient
                    .from("tahfidz_absensi")
                    .select(`id, santri_nis, status, setoran, penyimak_id,
                        tahfidz_sesi!inner(tanggal, sesi),
                        hafalan_tahfidz(surat, ayat_awal, ayat_akhir, juz, predikat, status_setoran)`)
                    .gte("tahfidz_sesi.tanggal", startStr)
                    .lte("tahfidz_sesi.tanggal", endStr)
                    .eq("tahfidz_sesi.kegiatan_id", "ZIYADAH"),
                supabaseClient.from("santri")
                    .select("nis, nama, kelas")
                    .eq("jurusan", "TAHFIDZ")
                    .eq("status_santri", "AKTIF"),
                supabaseClient.from("profiles").select("id, full_name"),
            ]);

            if (absensiRes.error) throw absensiRes.error;
            const absensiList = absensiRes.data || [];
            const santriList = santriRes.data || [];
            const profileList = profileRes.data || [];

            let filteredAbsensi = absensiList;
            if (exportType === "PERSONAL") {
                if (!selectedExportSantri) {
                    message.error("Pilih santri terlebih dahulu");
                    setIsLoadingExport(false);
                    return;
                }
                filteredAbsensi = absensiList.filter((a: any) => a.santri_nis === selectedExportSantri);
            }

            const santriMap = new Map(santriList.map((s: any) => [s.nis, s]));
            const penyimakMap = new Map(profileList.map((p: any) => [p.id, p.full_name]));

            const lookup = new Map<string, { status: string; setoranLabel: string; materi: string; penyimak: string; predikat: string }>();
            const allDates = new Set<string>();
            const allNis = new Set<string>();

            for (const a of filteredAbsensi) {
                const sesiData = a.tahfidz_sesi as any;
                const tgl = sesiData.tanggal;
                const sesi = sesiData.sesi;
                const nis = a.santri_nis;
                const key = `${tgl}::${sesi}::${nis}`;
                allDates.add(tgl);
                allNis.add(nis);
                const h = a.hafalan_tahfidz;
                const hasSetoran = !!(a.setoran && h);
                const materi = h ? formatSetoranText(h) : '';
                const setoranLabel = a.status === 'HADIR' ? (hasSetoran ? 'SETOR' : 'TIDAK SETOR') : '-';
                const penyimak = a.penyimak_id ? (penyimakMap.get(a.penyimak_id) || '') : '';
                const predikat = (h as any)?.predikat || '-';
                lookup.set(key, { status: a.status, setoranLabel, materi, penyimak, predikat });
            }

            const dates = [...allDates].sort();
            const santriNis = [...allNis].sort((a: string, b: string) =>
                (santriMap.get(a)?.nama || '').localeCompare(santriMap.get(b)?.nama || ''),
            );

            const wb = new ExcelJS.Workbook();

            if (exportType === "GLOBAL") {
                const ws = wb.addWorksheet("Rekap Setoran Ziyadah");
                buildSheet(ws, dates, santriNis, lookup, santriMap, exportDateRange);
            } else {
                const santri = santriMap.get(selectedExportSantri!);
                if (!santri) throw new Error("Data santri tidak ditemukan.");
                const ws = wb.addWorksheet(`Setoran - ${(santri.nama || selectedExportSantri).substring(0, 20)}`);
                buildSheet(ws, dates, santriNis, lookup, santriMap, exportDateRange);
            }

            const buffer = await wb.xlsx.writeBuffer();
            const label = exportType === "GLOBAL" ? "Rekap" : `Personal_${selectedExportSantri}`;
            saveAs(new Blob([buffer]), `Setoran_Ziyadah_${label}_${exportDateRange[0].format("YYYYMM")}.xlsx`);
            message.success('Export berhasil');
            setExportModalOpen(false);
        } catch (err: any) {
            message.error("Gagal export: " + err.message);
        } finally {
            setIsLoadingExport(false);
        }
    };

    const buildSheet = (
        ws: any,
        dates: string[],
        santriNis: string[],
        lookup: Map<string, { status: string; setoranLabel: string; materi: string; penyimak: string; predikat: string }>,
        santriMap: Map<string, any>,
        dateRange: [dayjs.Dayjs, dayjs.Dayjs],
    ) => {
        const totalCols = 11;

        const applySesiHeaderStyle = (cell: any, fillColor: string) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        };

        // ── Title ──
        ws.mergeCells(`A1:${colLetter(totalCols)}1`);
        const t = ws.getCell("A1");
        t.value = `LAPORAN SETORAN ZIYADAH — ${dateRange[0].format("DD MMM")} s/d ${dateRange[1].format("DD MMM YYYY")} M  /  ${formatHijri(dateRange[0].toDate())} s/d ${formatHijri(dateRange[1].toDate())} H`;
        t.font = { size: 13, bold: true, color: { argb: "FFFFFFFF" } };
        t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF047857" } };
        t.alignment = { horizontal: "center" };
        ws.getRow(1).height = 22;

        // ── Header group row (row 3) ──
        ws.mergeCells("A3:F3");
        ws.getCell("A3").value = "DATA SANTRI";
        applySesiHeaderStyle(ws.getCell("A3"), "FF374151");
        ws.mergeCells("G3:K3");
        ws.getCell("G3").value = "SESI PAGI";
        applySesiHeaderStyle(ws.getCell("G3"), "FFD97706");
        // ── Column headers (row 4) ──
        ws.getRow(4).values = [
            "NO", "Hari, Tgl (M)", "Tanggal (H)", "NIS", "Nama Santri", "Kelas",
            "Status", "Setoran", "Materi", "Predikat", "Penyimak",
        ];
        ws.getRow(4).font = { bold: true };
        ws.getRow(4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };

        // ── Column widths ──
        ws.columns = [
            { key: "no", width: 5 },
            { key: "tglM", width: 22 },
            { key: "tglH", width: 18 },
            { key: "nis", width: 13 },
            { key: "nama", width: 24 },
            { key: "kelas", width: 8 },
            { key: "pagi_status", width: 11 },
            { key: "pagi_setoran", width: 11 },
            { key: "pagi_materi", width: 26 },
            { key: "pagi_predikat", width: 13 },
            { key: "pagi_penyimak", width: 16 },
        ];

        // ── Build rows: one per (santri, tanggal) ──
        interface RowMeta { nama: string; nis: string; tgl: string; kelas: string }
        const rows: RowMeta[] = [];
        for (const nis of santriNis) {
            for (const tgl of dates) {
                const pagi = lookup.get(`${tgl}::PAGI::${nis}`);
                if (pagi) {
                    rows.push({ nama: santriMap.get(nis)?.nama || nis, nis, tgl, kelas: santriMap.get(nis)?.kelas || '' });
                }
            }
        }
        rows.sort((a, b) => a.nama.localeCompare(b.nama) || a.tgl.localeCompare(b.tgl));

        const STATUS_FILLS: Record<string, string> = {
            HADIR: 'FFD1FAE5',
            SAKIT: 'FFFEF3C7',
            GHAIB: 'FFFEE2E2',
            SEKOLAH: 'FFDBEAFE',
            PULANG: 'FFFFEDD5',
        };

        rows.forEach((r, idx) => {
            const pagi = lookup.get(`${r.tgl}::PAGI::${r.nis}`);
            ws.addRow({
                no: idx + 1,
                tglM: `${DAYS_INDO[new Date(r.tgl).getDay()]}, ${formatMasehi(r.tgl)}`,
                tglH: formatHijri(new Date(r.tgl + "T00:00:00")),
                nis: r.nis,
                nama: r.nama,
                kelas: r.kelas,
                pagi_status: pagi?.status || "-",
                pagi_setoran: pagi?.setoranLabel || "-",
                pagi_materi: pagi?.materi || "-",
                pagi_predikat: pagi?.predikat || "-",
                pagi_penyimak: pagi?.penyimak || "-",
            });
            const row = ws.getRow(ws.rowCount);
            const pFill = pagi?.status ? STATUS_FILLS[pagi.status] : undefined;
            if (pFill) row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pFill } };
        });

        // ── AutoFilter & frozen pane ──
        ws.autoFilter = { from: "A4", to: `${colLetter(totalCols)}4` };
        ws.views = [{ state: "frozen", ySplit: 4 }];

        // ── Summary block: rekap jumlah per santri ──
        const B = { bold: true };
        const C = { horizontal: 'center' as const };
        const LGF = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF0FDF4' } };
        const TB = {
            top: { style: 'thin' as const },
            left: { style: 'thin' as const },
            bottom: { style: 'thin' as const },
            right: { style: 'thin' as const },
        };

        ws.addRow([]); // blank separator
        const sr = ws.rowCount + 1;

        ws.mergeCells(`A${sr}:F${sr}`);
        ws.getCell(sr, 1).value = 'REKAP JUMLAH PER SANTRI';
        ws.getCell(sr, 1).font = { bold: true, size: 11 };
        ws.getCell(sr, 1).fill = LGF;
        ws.getCell(sr, 1).alignment = C;

        const sumHeaders = ['Nama Santri', '', '', '', '', '', 'H', 'TS', 'S', 'GH', 'Sk', 'P'];
        ws.addRow(sumHeaders);
        ws.getRow(ws.rowCount).font = B;
        ws.getRow(ws.rowCount).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };

        for (const nis of santriNis) {
            const nama = santriMap.get(nis)?.nama || nis;
            const totals: Record<string, number> = { H: 0, TS: 0, S: 0, GH: 0, Sk: 0, P: 0 };
            for (const tgl of dates) {
                const entry = lookup.get(`${tgl}::PAGI::${nis}`);
                if (!entry) continue;
                const code = entry.status === 'HADIR'
                    ? (entry.setoranLabel === 'SETOR' ? 'H' : 'TS')
                    : (entry.status === 'SAKIT' ? 'S' : entry.status === 'GHAIB' ? 'GH' : entry.status === 'SEKOLAH' ? 'Sk' : entry.status === 'PULANG' ? 'P' : '');
                if (code && code in totals) totals[code]++;
            }
            ws.addRow([nama, '', '', '', '', '', totals.H || '', totals.TS || '', totals.S || '', totals.GH || '', totals.Sk || '', totals.P || '']);
            const row = ws.getRow(ws.rowCount);
            for (let c = 1; c <= totalCols; c++) ws.getCell(ws.rowCount, c).border = TB;
        }
    };

    // ── Columns ──
    const columns: ProColumns<ISantri>[] = [
        {
            title: "Santri",
            dataIndex: "nama",
            width: 230,
            fixed: "left",
            render: (_, record) => (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar
                        src={record.foto_url}
                        size={40}
                        icon={<UserOutlined />}
                        style={{
                            background: "linear-gradient(135deg, #047857, #10B981)",
                            color: "#fff",
                            flexShrink: 0,
                            border: `2px solid ${isDark ? "#334155" : "#D1FAE5"}`,
                        }}
                    />
                    <div style={{ minWidth: 0 }}>
                        <Text
                            style={{
                                fontWeight: 600,
                                fontSize: 13,
                                color: token.colorText,
                                display: "block",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                            }}
                        >
                            {record.nama || santriAlias(record.nis)}
                        </Text>
                        <code
                            style={{
                                fontSize: 10,
                                color: token.colorTextSecondary,
                                background: isDark ? "#0F172A" : "#F1F5F9",
                                padding: "1px 5px",
                                borderRadius: 4,
                                letterSpacing: "0.05em",
                            }}
                        >
                            {record.nis}
                        </code>
                    </div>
                </div>
            ),
        },
        {
            title: "Kelas",
            dataIndex: "kelas",
            width: 80,
            filters: true,
            onFilter: true,
            valueEnum: {
                "1": { text: "Kelas 1" },
                "2": { text: "Kelas 2" },
                "3": { text: "Kelas 3" },
            },
            render: (_, r) => (
                <div
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: isDark ? "#1E3A5F" : "#DBEAFE",
                        color: "#2563EB",
                        fontWeight: 700,
                        fontSize: 13,
                    }}
                >
                    {r.kelas}
                </div>
            ),
        },
        {
            title: "Pembimbing",
            dataIndex: "pembimbing",
            width: 160,
            ellipsis: true,
            render: (_, record) => (
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: token.colorTextSecondary }}>
                    <SafetyCertificateOutlined style={{ color: "#047857", fontSize: 12 }} />
                    <Text
                        style={{
                            fontSize: 12,
                            color: token.colorTextSecondary,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {record.pembimbing || "–"}
                    </Text>
                </div>
            ),
        },
        {
            title: "Progress Hafalan",
            key: "progres",
            width: 320,
            render: (_, record) => {
                const juzNum = totalNum(record.total_hafalan);
                const latest = latestByNis[record.nis];
                const currentJuz = latest?.juz ?? null;
                const pct = Math.round((juzNum / 30) * 100);

                return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "4px 0" }}>
                        {/* Juz strip — SIGNATURE ELEMENT */}
                        {loadingLatest ? (
                            <Spin size="small" />
                        ) : (
                            <MiniJuzStrip
                                completed={juzNum}
                                current={currentJuz}
                                isDark={isDark}
                            />
                        )}

                        {/* Stats row */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {/* Total badge */}
                            <div
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    background: isDark ? "#022C22" : "#D1FAE5",
                                    color: "#047857",
                                    borderRadius: 6,
                                    padding: "2px 7px",
                                    fontSize: 11,
                                    fontWeight: 700,
                                }}
                            >
                                {juzNum} Juz
                                <span
                                    style={{
                                        fontSize: 10,
                                        fontWeight: 400,
                                        color: isDark ? "#34D399" : "#059669",
                                        opacity: 0.75,
                                    }}
                                >
                                    ({pct}%)
                                </span>
                            </div>

                            {/* Last setoran */}
                            <Text
                                style={{
                                    fontSize: 11,
                                    color: token.colorTextSecondary,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    flex: 1,
                                    minWidth: 0,
                                }}
                            >
                                {loadingLatest ? "…" : formatLatestHafalan(latest)}
                            </Text>
                        </div>
                    </div>
                );
            },
        },
        {
            title: "Setoran Terakhir",
            key: "tanggal",
            width: 170,
            render: (_, record) => {
                const latest = latestByNis[record.nis];
                if (!latest?.tanggal) {
                    return (
                        <Tag
                            style={{
                                background: isDark ? "#450A0A" : "#FEE2E2",
                                borderColor: "transparent",
                                color: "#DC2626",
                                borderRadius: 6,
                                fontSize: 10,
                                fontWeight: 600,
                            }}
                        >
                            Belum ada
                        </Tag>
                    );
                }
                const date = new Date(latest.tanggal);
                const diffDays = Math.floor(
                    (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)
                );
                const isRecent = diffDays <= 7;
                return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <Text style={{ fontSize: 12, color: token.colorText, fontWeight: 500 }}>
                            {formatFullDate(latest.tanggal)}
                        </Text>
                        <Text
                            style={{
                                fontSize: 10,
                                color: isRecent ? "#047857" : diffDays <= 14 ? "#D97706" : "#DC2626",
                                fontWeight: 600,
                            }}
                        >
                            {diffDays === 0
                                ? "Hari ini"
                                : diffDays === 1
                                ? "Kemarin"
                                : `${diffDays}h lalu`}
                        </Text>
                    </div>
                );
            },
        },
        {
            title: "",
            valueType: "option",
            width: 110,
            fixed: "right",
            render: (_, record) => (
                <Space size={6}>
                    <Tooltip title="Input Setoran Baru">
                        <Button
                            type="primary"
                            size="small"
                            icon={<PlusOutlined />}
                            onClick={() => push(`/hafalan/create?nis=${record.nis}`)}
                            style={{
                                background: "linear-gradient(135deg, #047857, #10B981)",
                                border: "none",
                                borderRadius: 6,
                                fontWeight: 600,
                            }}
                        />
                    </Tooltip>
                    <Tooltip title="Lihat Riwayat Lengkap">
                        <Button
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => push(`/hafalan/show/${record.nis}`)}
                            style={{
                                borderRadius: 6,
                                border: `1px solid ${token.colorBorderSecondary}`,
                                color: token.colorTextSecondary,
                                background: "transparent",
                            }}
                        >
                            Detail
                        </Button>
                    </Tooltip>
                </Space>
            ),
        },
    ];

    const santriData = tableQueryResult?.data?.data || [];

    return (
        <div style={{ background: token.colorBgLayout, minHeight: "100vh", padding: "20px 20px 80px" }}>

            {/* ── HEADER ── */}
            <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                            <div
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 10,
                                    background: "linear-gradient(135deg, #047857, #10B981)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "#fff",
                                    fontSize: 16,
                                }}
                            >
                                <ReadOutlined />
                            </div>
                            <div>
                                <Text
                                    style={{
                                        fontSize: 20,
                                        fontWeight: 700,
                                        color: isDark ? "#F1F5F9" : "#0F172A",
                                        display: "block",
                                        lineHeight: 1.2,
                                    }}
                                >
                                    Monitoring Tahfidz
                                </Text>
                                <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>
                                    Data per {formatHijri(new Date())}
                                </Text>
                            </div>
                        </div>
                    </div>
                    <Space>
                        <Button
                            icon={<DownloadOutlined />}
                            onClick={() => setExportModalOpen(true)}
                            style={{
                                borderRadius: 8,
                                border: `1px solid ${token.colorBorderSecondary}`,
                                color: token.colorTextSecondary,
                                background: "transparent",
                            }}
                        >
                            Export Excel
                        </Button>
                        <Dropdown.Button
                            type="primary"
                            icon={<MenuOutlined />}
                            menu={{
                                items: [
                                    { key: 'session', label: '☀️ Absensi Cepat (Sesi Hari Ini)', onClick: () => setSessionModalOpen(true) },
                                    { key: 'hafalan', label: '📝 Setoran Hafalan Detail', onClick: () => push("/hafalan/create") },
                                    { key: 'murojaah', label: '🔄 Murojaah Detail', onClick: () => push("/murojaah/create") },
                                ]
                            }}
                            style={{
                                background: "linear-gradient(135deg, #C9A84C, #8B6E23)",
                                border: "none",
                                borderRadius: 8,
                                fontWeight: 600,
                            }}
                        >
                            ☀️ Sesi & Setoran
                        </Dropdown.Button>
                    </Space>
                </div>
            </div>

            {/* ── KPI BAR ── */}
            <KPISummaryBar
                data={santriData}
                isDark={isDark}
                loading={tableQueryResult?.isLoading ?? true}
                sudahSetoranHariIni={sudahSetoranHariIni}
                ketidakhadiranHariIni={ketidakhadiranHariIni}
                rataKehadiran7Hari={rataKehadiran7Hari}
            />

            {/* ── GRADE CHART ── */}
            {(() => {
                const grades = { Mumtaz: 0, Jayyid: 0, Maqbul: 0, Kurang: 0 };
                for (const s of santriData) grades[getGrade(totalNum(s.total_hafalan))]++;

                const chartData = Object.entries(GRADE_COLORS).map(([name, c]) => ({
                    name,
                    count: grades[name as keyof typeof grades],
                    fill: c.fg,
                    bg: c.bg,
                    icon: c.icon,
                }));

                const maxCount = Math.max(...chartData.map(d => d.count), 1);

                return (
                    <div
                        style={{
                            background: token.colorBgContainer,
                            border: `1px solid ${token.colorBorderSecondary}`,
                            borderRadius: 12,
                            padding: "16px 20px",
                            marginBottom: 16,
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                            <BarChartOutlined style={{ fontSize: 14, color: token.colorTextSecondary }} />
                            <Text style={{ fontSize: 12, fontWeight: 600, color: token.colorTextSecondary, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                                Distribusi Grade Hafalan Santri
                            </Text>
                        </div>
                        <div style={{ display: "flex", gap: 24, alignItems: "flex-end" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <ResponsiveContainer width="100%" height={160}>
                                    <BarChart data={chartData} barSize={48} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={token.colorBorderSecondary} vertical={false} />
                                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: token.colorTextSecondary }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 10, fill: token.colorTextSecondary }} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, maxCount + 1]} />
                                        <RechartsTooltip
                                            contentStyle={{ fontSize: 12, borderRadius: 8, border: "0.5px solid var(--ant-color-border-secondary)", background: "var(--ant-color-bg-container)" }}
                                            cursor={{ fill: token.colorFillSecondary }}
                                        />
                                        <Bar dataKey="count" radius={[4, 4, 0, 0]} background={{ fill: token.colorFillTertiary }}>
                                            {chartData.map((entry, i) => (
                                                <Cell key={i} fill={entry.fill} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
                                {chartData.map(g => (
                                    <div key={g.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 8, background: g.bg }}>
                                        <span style={{ fontSize: 16 }}>{g.icon}</span>
                                        <div>
                                            <div style={{ fontSize: 11, fontWeight: 600, color: g.fill }}>{g.name}</div>
                                            <div style={{ fontSize: 10, color: token.colorTextSecondary }}>
                                                {g.count} santri {g.count > 0 ? `(${Math.round(g.count / santriData.length * 100)}%)` : ''}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ── TABS ── */}
            <Tabs
                activeKey={activeTab}
                onChange={(key: string) => setActiveTab(key as 'daftar' | 'absensi')}
                items={[
                    { key: 'daftar', label: '📋 Daftar Santri', children: (
                        <div
                            style={{
                                background: token.colorBgContainer,
                                border: `1px solid ${token.colorBorderSecondary}`,
                                borderRadius: 16,
                                overflow: "hidden",
                            }}
                        >
                            <ProTable<ISantri>
                                {...tableProps}
                                columns={columns}
                                rowKey="nis"
                                search={false}
                                options={{
                                    density: false,
                                    fullScreen: false,
                                    reload: true,
                                    setting: { listsHeight: 400 },
                                }}
                                headerTitle={
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <Text style={{ color: isDark ? "#94A3B8" : "#64748B", fontSize: 12 }}>
                                            {santriData.length} santri ditampilkan
                                        </Text>
                                        {/* Legend strip */}
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 8,
                                                marginLeft: 8,
                                                padding: "4px 10px",
                                                background: isDark ? "#0F172A" : "#F8FAFC",
                                                borderRadius: 6,
                                                border: `1px solid ${token.colorBorderSecondary}`,
                                            }}
                                        >
                                            {[
                                                { color: "#047857", label: "Selesai" },
                                                { color: "#D97706", label: "Posisi" },
                                                { color: isDark ? "#1E293B" : "#E2E8F0", label: "Belum", border: true },
                                            ].map(({ color, label, border: hasBorder }) => (
                                                <div
                                                    key={label}
                                                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                                                >
                                                    <div
                                                        style={{
                                                            width: 8,
                                                            height: 10,
                                                            borderRadius: 2,
                                                            background: color,
                                                            border: hasBorder
                                                                ? `1px solid ${isDark ? "#334155" : "#CBD5E1"}`
                                                                : "none",
                                                        }}
                                                    />
                                                    <Text style={{ fontSize: 10, color: token.colorTextSecondary }}>{label}</Text>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                }
                                pagination={{
                                    defaultPageSize: 15,
                                    showSizeChanger: true,
                                    showQuickJumper: true,
                                    size: "small",
                                    style: { padding: "12px 16px" },
                                }}
                                scroll={{ x: 1050 }}
                                style={{ borderRadius: 0 }}
                                cardProps={{ bodyStyle: { padding: 0 } }}
                                rowClassName={(_, index) => (index % 2 === 0 ? "hafalan-row-even" : "hafalan-row-odd")}
                            />
                        </div>
                    )},
                    { key: 'absensi', label: '☀️ Absensi Cepat Hari Ini', children: (
                        <div style={{ marginTop: 12, marginBottom: 12 }}>
                            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                                <DatePicker
                                    value={sesiTanggal}
                                    onChange={(d) => d && setSesiTanggal(d)}
                                    allowClear={false}
                                    format="DD MMM YYYY"
                                    style={{ borderRadius: 8 }}
                                />
                                <Segmented
                                    value={sesiWaktu}
                                    onChange={(v) => setSesiWaktu(v as string)}
                                    options={[
                                        { label: '🌅 Pagi', value: 'PAGI' },
                                    ]}
                                />
                                <Button
                                    size="small"
                                    icon={<CalendarOutlined />}
                                    onClick={() => setSesiTanggal(dayjs())}
                                    style={{ borderRadius: 6, fontSize: 12, color: token.colorTextSecondary }}
                                >
                                    Hari Ini
                                </Button>
                            </div>
                            <AbsensiCepatTable
                                santriData={santriData}
                                sesiRecords={sesiRecords}
                                detailSetoranMap={detailSetoranMap}
                                savingSesi={savingSesi}
                                sesiJenis={sesiJenis}
                                sesiWaktu={sesiWaktu}
                                sesiTanggal={sesiTanggal}
                                onStatusClick={handleStatusClick}
                                isDark={isDark}
                            />
                        </div>
                    )},
                ]}
                style={{ marginTop: 12 }}
            />

            {/* ── Sesi Hari Ini Modal ── */}
            <Modal
                title={
                    <Space>
                        <span style={{ fontSize: 20 }}>☀️</span>
                        <span style={{ fontWeight: 700 }}>Sesi Hari Ini</span>
                    </Space>
                }
                open={sessionModalOpen}
                onCancel={() => setSessionModalOpen(false)}
                width={800}
                footer={null}
                destroyOnHidden
            >
                {/* Sesi Config */}
                <div style={{ display: "flex", gap: 16, marginBottom: 16, alignItems: "center" }}>
                    <Segmented
                        value={sesiJenis}
                        onChange={(v) => setSesiJenis(v as string)}
                        options={[
                            { label: '📖 Ziyadah', value: 'ZIYADAH' },
                            { label: '🔄 Murojaah', value: 'MUROJAAH' },
                        ]}
                    />
                    <Segmented
                        value={sesiWaktu}
                        onChange={(v) => setSesiWaktu(v as string)}
                        options={[
                            { label: '🌅 Pagi', value: 'PAGI' },
                        ]}
                    />
                    <DatePicker
                        value={sesiTanggal}
                        onChange={(d) => d && setSesiTanggal(d)}
                        allowClear={false}
                        format="DD MMM YYYY"
                        size="small"
                        style={{ borderRadius: 6, width: 140 }}
                    />
                </div>

                {/* ── Santri Grid ── */}
                <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                    {santriForSesi.map((santri: any) => {
                        const rec = sesiRecords[santri.nis] || {};
                        const currentStatus = rec.status || '';
                        const isSaving = savingSesi[santri.nis];

                        return (
                            <div key={santri.nis} style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: '10px 12px', marginBottom: 6,
                                background: token.colorBgContainer,
                                border: `1px solid ${token.colorBorderSecondary}`,
                                borderRadius: 10,
                            }}>
                                <Avatar
                                    src={santri.foto_url} size={36}
                                    icon={<UserOutlined />}
                                    style={{ background: '#047857', flexShrink: 0 }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: 13, color: token.colorText }}>
                                        {santri.nama}
                                    </div>
                                    <div style={{ fontSize: 11, color: token.colorTextSecondary }}>
                                        {santri.kelas && `Kelas ${santri.kelas}`} · {santri.total_hafalan || 0} Juz
                                        {rec.status === 'HADIR' && (detailSetoranMap[santri.nis] ? (
                                            <Tag
                                                style={{
                                                    marginLeft: 8, padding: "2px 6px",
                                                    background: detailSetoranMap[santri.nis].status_setoran === 'MENGULANG' ? "#FEF3C7" : "#D1FAE5",
                                                    color: detailSetoranMap[santri.nis].status_setoran === 'MENGULANG' ? '#B45309' : '#047857',
                                                    border: "none", fontSize: 10,
                                                }}
                                            >
                                                {formatDetailSetoran(detailSetoranMap[santri.nis])}
                                            </Tag>
                                        ) : (
                                            <Tag
                                                style={{
                                                    marginLeft: 8, padding: "2px 6px",
                                                    background: "#FEE2E2", color: "#DC2626",
                                                    border: "none", fontSize: 10,
                                                }}
                                            >
                                                ❌ Tidak setoran
                                            </Tag>
                                        ))}
                                    </div>
                                </div>
                                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                        {STATUS_ABSENSI.map(s => {
                                            const active = currentStatus === s.key;
                                            return (
                                                <div
                                                    key={s.key}
                                                    onClick={() => {
                                                        if (s.key === 'HADIR') {
                                                            if (currentStatus === 'HADIR') {
                                                                // Toggle setor/tidak via create page
                                                                push(`/hafalan/create?nis=${santri.nis}`);
                                                                setSessionModalOpen(false);
                                                            } else {
                                                                handleStatusClick(santri.nis, 'HADIR');
                                                            }
                                                        } else {
                                                            handleStatusClick(santri.nis, s.key);
                                                        }
                                                    }}
                                                style={{
                                                    padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
                                                    fontSize: 11, fontWeight: active ? 700 : 400,
                                                    border: `1.5px solid ${active ? s.color : token.colorBorder}`,
                                                    background: active ? s.bg : 'transparent',
                                                    color: active ? s.color : token.colorTextTertiary,
                                                    transition: 'all 0.12s',
                                                    opacity: isSaving ? 0.5 : 1,
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {s.icon} {s.label}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div style={{
                    marginTop: 16, padding: 12, borderRadius: 8,
                    background: isDark ? '#1E293B' : '#FFF7ED',
                    border: `1px solid ${isDark ? '#334155' : '#FED7AA'}`,
                    fontSize: 12, color: token.colorTextSecondary,
                }}>
                    💡 <strong>Tips:</strong> Klik status untuk menyimpan langsung. Klik <strong>Hadir</strong> akan otomatis setor (bisa diubah nanti). Klik <strong>Hadir (jika sudah aktif)</strong> akan buka form lengkap.
                </div>
            </Modal>

            {/* ── Export Modal ── */}
            <Modal
                title={
                    <Space>
                        <FileExcelOutlined style={{ color: "#16a34a" }} />
                        Export Data Setoran Ziyadah
                    </Space>
                }
                open={exportModalOpen}
                onCancel={() => setExportModalOpen(false)}
                footer={[
                    <Button key="back" onClick={() => setExportModalOpen(false)}>
                        Batal
                    </Button>,
                    <Button
                        key="submit"
                        type="primary"
                        icon={<DownloadOutlined />}
                        loading={isLoadingExport}
                        onClick={handleExport}
                        style={{ background: "#16a34a", borderColor: "#16a34a" }}
                    >
                        Download Excel
                    </Button>,
                ]}
            >
                <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0" }}>
                    <Card size="small" style={{ background: "var(--ant-color-fill-quaternary)", border: `1px solid ${isDark ? "#334155" : "var(--ant-color-border-secondary)"}` }}>
                        <Text strong style={{ display: "block", marginBottom: 8 }}>
                            Jenis Laporan
                        </Text>
                        <Radio.Group
                            value={exportType}
                            onChange={(e) => setExportType(e.target.value)}
                            buttonStyle="solid"
                            style={{ width: "100%" }}
                        >
                            <Radio.Button value="GLOBAL" style={{ width: "50%", textAlign: "center" }}>
                                Rekap Semua Santri
                            </Radio.Button>
                            <Radio.Button value="PERSONAL" style={{ width: "50%", textAlign: "center" }}>
                                Rapor Personal
                            </Radio.Button>
                        </Radio.Group>
                    </Card>

                    {exportType === "PERSONAL" && (
                        <div>
                            <Text strong style={{ display: "block", marginBottom: 6 }}>
                                Pilih Santri
                            </Text>
                            <Select
                                {...santriSelectProps}
                                showSearch
                                placeholder="Ketik nama santri..."
                                style={{ width: "100%" }}
                                onChange={(val) => setSelectedExportSantri(val as unknown as string)}
                                allowClear
                            />
                        </div>
                    )}

                    <div>
                        <Text strong style={{ display: "block", marginBottom: 6 }}>
                            Rentang Periode
                        </Text>
                        <DatePicker.RangePicker
                            value={exportDateRange}
                            onChange={(dates) => setExportDateRange(dates as any)}
                            style={{ width: "100%" }}
                            format="DD MMM YYYY"
                            presets={[
                                { label: "Hari ini", value: [dayjs(), dayjs()] },
                                { label: "Minggu ini", value: [dayjs().startOf("week"), dayjs().endOf("week")] },
                                { label: "Bulan ini", value: [dayjs().startOf("month"), dayjs().endOf("month")] },
                            ]}
                        />
                        <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: "block" }}>
                            Disarankan export per bulan agar file tidak terlalu besar.
                        </Text>
                    </div>
                </div>
            </Modal>

            {/* ── Dark mode CSS overrides ── */}
            <style>{`
                /* ── ProTable card wrapper ── */
                .ant-pro-table {
                    background: transparent !important;
                }
                .ant-pro-table > .ant-card {
                    background: ${token.colorBgContainer} !important;
                    border-radius: 16px;
                }
                .ant-pro-table .ant-card-body {
                    background: ${token.colorBgContainer} !important;
                    padding: 0 !important;
                }

                /* ── Table container ── */
                .ant-table-wrapper {
                    background: transparent !important;
                }
                .ant-table {
                    background: transparent !important;
                }
                .ant-table-container {
                    background: transparent !important;
                }

                /* ── Table body cells ── */
                .ant-table-tbody > tr > td {
                    background: transparent !important;
                }
                .hafalan-row-even > td {
                    background: ${isDark ? "rgba(255,255,255,0.015)" : "#FAFCFF"} !important;
                }
                .hafalan-row-odd > td {
                    background: transparent !important;
                }

                /* ── Table header ── */
                .ant-pro-table .ant-table-thead > tr > th {
                    background: ${isDark ? "#1E293B" : "#F8FAFC"} !important;
                    color: ${token.colorTextSecondary} !important;
                    font-size: 11px !important;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    border-bottom: 1px solid ${token.colorBorderSecondary} !important;
                    font-weight: 600;
                    padding: 10px 12px !important;
                }
                .ant-pro-table .ant-table-thead > tr > th::before {
                    background: transparent !important;
                }

                /* ── Table cell borders ── */
                .ant-pro-table .ant-table-cell {
                    border-bottom: 1px solid ${isDark ? "#1E2D3D" : "#F1F5F9"} !important;
                    padding: 10px 12px !important;
                }

                /* ── Toolbar ── */
                .ant-pro-table-list-toolbar {
                    background: ${token.colorBgContainer} !important;
                    border-bottom: 1px solid ${token.colorBorderSecondary};
                    padding: 12px 16px !important;
                    border-radius: 16px 16px 0 0;
                }
                .ant-pro-table-list-toolbar-container {
                    background: transparent !important;
                }
                .ant-pro-table-list-toolbar-left {
                    background: transparent !important;
                }
                .ant-pro-table-list-toolbar-right {
                    background: transparent !important;
                }

                /* ── Row hover ── */
                .ant-pro-table .ant-table-row:hover > td {
                    background: ${isDark ? "#1E293B" : "#F0FDF4"} !important;
                    transition: background 0.15s;
                }

                /* ── Pagination ── */
                .ant-pro-table .ant-table-pagination {
                    background: transparent !important;
                    padding: 12px 16px !important;
                    margin: 0 !important;
                }
                .ant-pro-table .ant-table-pagination > li {
                    background: transparent !important;
                }

                /* ── Empty state ── */
                .ant-table-placeholder > td {
                    background: ${token.colorBgContainer} !important;
                    border-bottom: none !important;
                }
                .ant-empty-description {
                    color: ${token.colorTextSecondary} !important;
                }

                /* ── ProTable setting dropdown / popover ── */
                .ant-popover-content {
                    background: ${token.colorBgContainer} !important;
                }
                .ant-popover-arrow-content {
                    background: ${token.colorBgContainer} !important;
                }
                .ant-popover-inner {
                    background: ${token.colorBgContainer} !important;
                }
                .ant-table-filter-dropdown {
                    background: ${token.colorBgContainer} !important;
                }
            `}</style>
        </div>
    );
};
