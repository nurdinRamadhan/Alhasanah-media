import React, { useState, useMemo, useEffect } from "react";
import { useTable, useSelect } from "@refinedev/antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import {
    Tag, Space, Button, Typography, Tooltip, Avatar,
    Modal, DatePicker, Select, Radio, message, Card,
    Spin, Progress, theme, Segmented, Dropdown, Tabs,
} from "antd";
import {
    PlusOutlined, UserOutlined, EyeOutlined,
    DownloadOutlined, FileExcelOutlined,
    FireOutlined, TeamOutlined, WarningOutlined,
    TrophyOutlined, BookOutlined, RiseOutlined, BarChartOutlined,
    CheckCircleFilled, CalendarOutlined,
    MenuOutlined,
} from "@ant-design/icons";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
} from "recharts";
import { ISantri } from "../../types";
import { useNavigation, useGetIdentity } from "@refinedev/core";
import { formatHijri, formatMasehi } from "../../utility/dateHelper";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { supabaseClient } from "../../utility/supabaseClient";
import { santriAlias } from "../../utility/privacy";

dayjs.extend(isSameOrAfter);

const hexLum = (hex: string): number => {
    const c = hex.replace("#", "");
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    return 0.299 * r + 0.587 * g + 0.114 * b;
};

const { Text } = Typography;
const { RangePicker } = DatePicker;

const DAYS_INDO = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

// ─── Types ────────────────────────────────────────────────────────────────────

type DetailSetoran = {
    status_setoran: string | null;
    surat: string | null;
    ayat_awal: number | null;
    ayat_akhir: number | null;
    juz: number | null;
    jenis_murojaah: string | null;
    predikat: string | null;
    halaman_awal: number | null;
    halaman_akhir: number | null;
};

const PREDIKAT_LABEL: Record<string, string> = { MUMTAZ: 'Mumtaz', JAYYID: 'Jayyid', KURANG: 'Kurang' };

const formatMurojaahDetail = (d: DetailSetoran): string => {
    const icon = d.status_setoran === 'LANCAR' ? '✅' : d.status_setoran === 'MENGULANG' ? '🔄' : '✅';
    const jenis = d.jenis_murojaah || '';

    let detail: string;
    if (d.jenis_murojaah === 'MANZIL' && d.juz) {
        detail = `MANZIL Juz ${d.juz}`;
    } else if (d.surat) {
        const ayat = d.ayat_awal && d.ayat_akhir ? `${d.ayat_awal}–${d.ayat_akhir}` : '';
        detail = `${jenis} ${d.surat}${ayat ? ' ' + ayat : ''}`;
    } else if (d.halaman_awal && d.halaman_akhir) {
        detail = `${jenis} Hal. ${d.halaman_awal}–${d.halaman_akhir}`;
    } else if (d.halaman_awal) {
        detail = `${jenis} Hal. ${d.halaman_awal}`;
    } else if (d.juz) {
        detail = `${jenis} Juz ${d.juz}`;
    } else {
        detail = 'Setoran';
    }

    const predikatStr = d.predikat ? ` · ${PREDIKAT_LABEL[d.predikat] || d.predikat}` : '';
    return `${icon} ${detail}${predikatStr}`.trim();
};

type MurojaahSummary = {
    santri_nis: string;
    total_count: number;
    week_count: number;
    month_count: number;
    last_tanggal: string | null;
    last_jenis_murojaah: "SABAQ" | "MANZIL" | null;
    last_juz: number | null;
    last_surat: string | null;
    last_ayat_awal: number | null;
    last_ayat_akhir: number | null;
    last_halaman_awal: number | null;
    last_halaman_akhir: number | null;
    last_predikat: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatMurojaahCoverage = (item?: Partial<MurojaahSummary> | null): string => {
    if (!item) return "Belum ada log";
    if (item.last_surat) {
        const ayat =
            item.last_ayat_awal && item.last_ayat_akhir
                ? ` Ayat ${item.last_ayat_awal}–${item.last_ayat_akhir}`
                : "";
        return `${item.last_surat}${ayat}`;
    }
    if (item.last_halaman_awal && item.last_halaman_akhir) {
        return `Hal. ${item.last_halaman_awal}–${item.last_halaman_akhir}`;
    }
    return item.last_juz ? `Juz ${item.last_juz}` : "Belum ada log";
};

/** Days since a date string */
const daysSince = (dateStr: string | null): number | null => {
    if (!dateStr) return null;
    return dayjs().diff(dayjs(dateStr.slice(0, 10)), "day");
};

const fetchAllMurojaahLogs = async (params: {
    startDate: string;
    endDate: string;
    santriNis?: string;
}) => {
    const pageSize = 1000;
    let from = 0;
    const rows: any[] = [];
    while (true) {
        let query = supabaseClient
            .from("murojaah_tahfidz")
            .select("*, santri(nama, nis, kelas)")
            .gte("tanggal", params.startDate)
            .lte("tanggal", params.endDate)
            .order("tanggal", { ascending: false })
            .range(from, from + pageSize - 1);
        if (params.santriNis) query = query.eq("santri_nis", params.santriNis);
        const { data, error } = await query;
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < pageSize) break;
        from += pageSize;
    }
    return rows;
};

/**
 * Mengambil data absensi (status kehadiran) per sesi PAGI/SIANG dalam rentang tanggal,
 * lalu digabung dengan detail murojaah (jenis, cakupan/materi) untuk menghasilkan
 * baris pivot: satu baris = satu santri pada satu tanggal, dengan kolom Pagi & Siang.
 *
 * CATATAN ASUMSI SKEMA (mohon sesuaikan jika berbeda dengan database sebenarnya):
 * - Tabel "tahfidz_absensi" punya kolom: santri_nis, status, penyimak_id
 * - Penyimak diasumsikan FK ke tabel "profiles" (kolom "nama")
 * - "murojaah_tahfidz" tidak punya kolom sesi eksplisit — dicocokkan ke sesi
 *   berdasarkan santri_nis + tanggal saja. Jika dalam satu hari ada 2 entry
 *   detail (Pagi & Siang terpisah), hanya entry terakhir yang terbawa di sini.
 *   Jika tabelmu sebenarnya punya kolom pembeda sesi di murojaah_tahfidz,
 *   beri tahu saya nama kolomnya agar query ini diperbaiki.
 */
const fetchAbsensiPivot = async (params: {
    startDate: string;
    endDate: string;
    santriNis?: string;
    santriMap?: Map<string, any>;
}) => {
    // 1. Ambil semua sesi MUROJAAH dalam rentang + absensi di dalamnya
    let sesiQuery = supabaseClient
        .from("tahfidz_sesi")
        .select(
            "id, tanggal, sesi, tahfidz_absensi(santri_nis, status, penyimak_id, penyimak:profiles!penyimak_id(full_name))"
        )
        .eq("kegiatan_id", "MUROJAAH")
        .gte("tanggal", params.startDate.slice(0, 10))
        .lte("tanggal", params.endDate.slice(0, 10))
        .order("tanggal", { ascending: true });
    const { data: sesiData, error: sesiError } = await sesiQuery;
    if (sesiError) throw sesiError;

    // 2. Ambil detail murojaah (jenis SABAQ/MANZIL, cakupan/materi) di rentang sama
    const detailLogs = await fetchAllMurojaahLogs({
        startDate: params.startDate,
        endDate: params.endDate,
        santriNis: params.santriNis,
    });
    const detailMap: Record<string, any> = {};
    detailLogs.forEach((d: any) => {
        const key = `${d.santri_nis}_${dayjs(d.tanggal).format("YYYY-MM-DD")}`;
        detailMap[key] = d;
    });

    const formatCakupan = (d: any): string => {
        if (!d) return "-";
        if (d.surat) {
            const ayat = d.ayat_awal && d.ayat_akhir ? ` : ${d.ayat_awal}-${d.ayat_akhir}` : "";
            return `QS. ${d.surat}${ayat}`;
        }
        if (d.halaman_awal) {
            const akhir = d.halaman_akhir ? `-${d.halaman_akhir}` : "";
            return `Juz ${d.juz ?? "-"} Hal. ${d.halaman_awal}${akhir}`;
        }
        if (d.juz) return `Juz ${d.juz}`;
        return "-";
    };

    // 3. Susun jadi baris pivot per (santri, tanggal)
    const rowMap: Record<string, any> = {};
    const allDates: string[] = [];
    (sesiData || []).forEach((sesi: any) => {
        const tgl = dayjs(sesi.tanggal).format("YYYY-MM-DD");
        if (!allDates.includes(tgl)) allDates.push(tgl);
        (sesi.tahfidz_absensi || []).forEach((a: any) => {
            if (params.santriNis && a.santri_nis !== params.santriNis) return;
            const rowKey = `${a.santri_nis}_${tgl}`;
            const santriInfo = params.santriMap?.get(a.santri_nis);
            if (!rowMap[rowKey]) {
                rowMap[rowKey] = {
                    santri_nis: a.santri_nis,
                    nama: santriInfo?.nama || santriAlias(a.santri_nis),
                    kelas: santriInfo?.kelas ?? "-",
                    tanggal: tgl,
                    pagi: null,
                    siang: null,
                };
            }
            const detail = detailMap[rowKey];
            const sesiInfo = {
                status: a.status || "-",
                jenis: detail?.jenis_murojaah || "-",
                cakupan: formatCakupan(detail),
                penyimak: a.penyimak?.full_name || "-",
            };
            if (sesi.sesi === "PAGI") rowMap[rowKey].pagi = sesiInfo;
            if (sesi.sesi === "SIANG") rowMap[rowKey].siang = sesiInfo;
        });
    });

    // Isi santri tanpa absensi record di tiap tanggal yang punya sesi
    allDates.sort();
    if (params.santriMap) {
        params.santriMap.forEach((santri: any, nis: string) => {
            if (params.santriNis && nis !== params.santriNis) return;
            allDates.forEach(tgl => {
                const rowKey = `${nis}_${tgl}`;
                if (!rowMap[rowKey]) {
                    rowMap[rowKey] = {
                        santri_nis: nis,
                        nama: santri.nama || santriAlias(nis),
                        kelas: santri.kelas ?? "-",
                        tanggal: tgl,
                        pagi: null,
                        siang: null,
                    };
                }
            });
        });
    }

    return Object.values(rowMap).sort((a: any, b: any) => {
        const nameCompare = String(a.nama || "").localeCompare(String(b.nama || ""));
        if (nameCompare !== 0) return nameCompare;
        return String(a.tanggal).localeCompare(String(b.tanggal));
    });
};

// ─── Activity status helpers ──────────────────────────────────────────────────

type ActivityStatus = "aktif" | "perlu-perhatian" | "tidak-aktif" | "belum";

const getActivityStatus = (summary?: MurojaahSummary): ActivityStatus => {
    if (!summary || !summary.last_tanggal) return "belum";
    const days = daysSince(summary.last_tanggal);
    if (days === null) return "belum";
    if (days <= 7) return "aktif";
    if (days <= 14) return "perlu-perhatian";
    return "tidak-aktif";
};

const STATUS_CONFIG: Record<ActivityStatus, { label: string; color: string; antColor: string }> = {
    aktif: { label: "Aktif", color: "#16a34a", antColor: "success" },
    "perlu-perhatian": { label: "Perlu Perhatian", color: "#d97706", antColor: "warning" },
    "tidak-aktif": { label: "Tidak Aktif", color: "#dc2626", antColor: "error" },
    belum: { label: "Belum Ada Log", color: "#9ca3af", antColor: "default" },
};

// ─── Status Absensi ────────────────────────────────────────────────────────────

const STATUS_ABSENSI = [
  { key: 'HADIR',   label: 'Hadir',       icon: '✅', color: '#16A34A', bg: 'rgba(22,163,74,0.10)' },
  { key: 'SAKIT',   label: 'Sakit',       icon: '🤒', color: '#D97706', bg: 'rgba(217,119,6,0.10)' },
  { key: 'GHAIB',   label: 'Ghaib',       icon: '❌', color: '#DC2626', bg: 'rgba(220,38,38,0.10)' },
  { key: 'SEKOLAH', label: 'Sekolah',     icon: '🏫', color: '#2563EB', bg: 'rgba(37,99,235,0.10)' },
  { key: 'PULANG',  label: 'Pulang',      icon: '🏠', color: '#9333EA', bg: 'rgba(147,51,234,0.10)' },
];

// ─── KPI Card ─────────────────────────────────────────────────────────────────

const KpiCard: React.FC<{
    icon: React.ReactNode;
    value: React.ReactNode;
    label: string;
    sub?: string;
    accent?: string;
    loading?: boolean;
    isDark?: boolean;
}> = ({ icon, value, label, sub, accent, loading, isDark }) => {
    const accentColor = accent ?? "#7c3aed";
    return (
        <div
            style={{
                background: "var(--ant-color-bg-container)",
                border: `1px solid ${isDark ? "#334155" : "var(--ant-color-border-secondary)"}`,
                borderRadius: 12,
                display: "flex",
                flexDirection: "column",
                flex: 1,
                boxShadow: isDark ? "0 1px 3px rgba(0,0,0,0.25)" : "0 1px 3px rgba(0,0,0,0.06)",
                overflow: "hidden",
            }}
        >
            <div style={{ height: 4, background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88)`, flexShrink: 0 }} />
            <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 4 }}>
                {loading ? (
                    <Spin size="small" style={{ marginTop: 4 }} />
                ) : (
                    <>
                        <div style={{
                            width: 30, height: 30, borderRadius: 8,
                            background: `${accentColor}18`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: accentColor, fontSize: 15,
                        }}>
                            {icon}
                        </div>
                        <span
                            style={{
                                fontSize: 28,
                                fontWeight: 500,
                                lineHeight: 1,
                                color: accentColor,
                            }}
                        >
                            {value}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ant-color-text)", letterSpacing: "0.02em" }}>{label}</span>
                        {sub && (
                            <span style={{ fontSize: 10, color: "var(--ant-color-text-tertiary)" }}>{sub}</span>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

// ─── Activity Donut (inline SVG bar) ─────────────────────────────────────────

const ActivityBreakdown: React.FC<{
    counts: Record<ActivityStatus, number>;
    total: number;
    isDark?: boolean;
}> = ({ counts, total, isDark }) => {
    const items: ActivityStatus[] = ["aktif", "perlu-perhatian", "tidak-aktif", "belum"];
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {items.map((s) => {
                const pct = total > 0 ? Math.round((counts[s] / total) * 100) : 0;
                const cfg = STATUS_CONFIG[s];
                return (
                    <div key={s} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: `1px solid ${isDark ? "#1E293B" : "#F1F5F9"}`,
                        background: isDark ? "#0F172A15" : "#F8FAFC",
                    }}>
                        <div style={{ width: 3, height: 24, borderRadius: 2, background: cfg.color, flexShrink: 0 }} />
                        <span
                            style={{
                                fontSize: 11,
                                color: "var(--ant-color-text-secondary)",
                                width: 110,
                                flexShrink: 0,
                                fontWeight: 500,
                            }}
                        >
                            {cfg.label}
                        </span>
                        <div
                            style={{
                                flex: 1,
                                height: 7,
                                background: "var(--ant-color-fill-quaternary)",
                                borderRadius: 999,
                                overflow: "hidden",
                            }}
                        >
                            <div
                                style={{
                                    width: `${pct}%`,
                                    height: "100%",
                                    background: cfg.color,
                                    borderRadius: 999,
                                    transition: "width 0.6s ease",
                                }}
                            />
                        </div>
                        <span
                            style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: cfg.color,
                                width: 22,
                                textAlign: "right",
                            }}
                        >
                            {counts[s]}
                        </span>
                        <span
                            style={{
                                fontSize: 10,
                                color: "var(--ant-color-text-tertiary)",
                                width: 28,
                            }}
                        >
                            {pct}%
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const MurojaahList: React.FC = () => {
    const { token } = theme.useToken();
    const isDark = hexLum(token.colorBgContainer) < 128;
    const { tableProps, tableQueryResult } = useTable<ISantri>({
        resource: "santri",
        syncWithLocation: true,
        meta: {
            select:
                "nama, nis, kelas, jurusan, jenis_kelamin, status_santri, pembimbing, total_hafalan, foto_url",
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
    const [summariesByNis, setSummariesByNis] = useState<Record<string, MurojaahSummary>>({});
    const [summaryLoading, setSummaryLoading] = useState(true);
    const [sessionModalOpen, setSessionModalOpen] = useState(false);
    const [sesiTanggal, setSesiTanggal] = useState<dayjs.Dayjs>(dayjs());
    const [sesiJenis] = useState<string>('MUROJAAH');
    const [sesiWaktu, setSesiWaktu] = useState<string>(dayjs().hour() < 12 ? 'PAGI' : 'SIANG');
    const [sesiRecords, setSesiRecords] = useState<Record<string, {status: string; setoran: boolean}>>({});
    const [savingSesi, setSavingSesi] = useState<Record<string, boolean>>({});
    const [santriForSesi, setSantriForSesi] = useState<any[]>([]);
    const [detailSetoranMap, setDetailSetoranMap] = useState<Record<string, DetailSetoran>>({});
    const [fetchKey, setFetchKey] = useState(0);
    const [activeTab, setActiveTab] = useState<'daftar' | 'absensi'>('daftar');

    // Shared handler for both modal and absensi cepat tab
    const handleStatusClick = async (nis: string, status: string) => {
        if (savingSesi[nis]) return;

        // Untuk murojaah, HADIR hanya bisa via form Setoran Murojaah Detail
        if (status === 'HADIR') {
            setSavingSesi(prev => ({ ...prev, [nis]: false }));
            message.info("Silakan catat kehadiran & setoran melalui form Setoran Murojaah Detail");
            push(`/murojaah/create?nis=${nis}`);
            return;
        }

        setSavingSesi(prev => ({ ...prev, [nis]: true }));
        setSesiRecords(prev => ({
            ...prev,
            [nis]: { status, setoran: false }
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
                    setoran: false,
                    penyimak_id: null,
                }, { onConflict: "sesi_id, santri_nis" });

            // Hapus murojaah orphan saat status diubah ke non-HADIR
            const { data: abs } = await supabaseClient
                .from("tahfidz_absensi")
                .select("id")
                .eq("sesi_id", sesi!.id)
                .eq("santri_nis", nis)
                .maybeSingle();
            if (abs) {
                await supabaseClient
                    .from("murojaah_tahfidz")
                    .delete()
                    .eq("absensi_id", abs.id);
            }

            const santri = santriForSesi.find(s => s.nis === nis);
            message.success(`${santri?.nama || nis}: ${STATUS_ABSENSI.find(s => s.key === status)?.label}`);
            setFetchKey(k => k + 1);
        } catch {
            message.error("Gagal menyimpan absensi");
        } finally {
            setSavingSesi(prev => ({ ...prev, [nis]: false }));
        }
    };

    // Fetch sesi records + detail murojaah on mount / date / waktu change
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
                .from("murojaah_tahfidz")
                .select("santri_nis, status_setoran, surat, ayat_awal, ayat_akhir, juz, jenis_murojaah, predikat, halaman_awal, halaman_akhir")
                .in("absensi_id", absensiIds)
                .order("id", { ascending: false });
            const map: Record<string, DetailSetoran> = {};
            const seen = new Set<string>();
            (data || []).forEach((r: any) => {
                if (r.santri_nis && !seen.has(r.santri_nis)) {
                    seen.add(r.santri_nis);
                    map[r.santri_nis] = { status_setoran: r.status_setoran, surat: r.surat, ayat_awal: r.ayat_awal, ayat_akhir: r.ayat_akhir, juz: r.juz, jenis_murojaah: r.jenis_murojaah, predikat: r.predikat, halaman_awal: r.halaman_awal, halaman_akhir: r.halaman_akhir };
                }
            });
            setDetailSetoranMap(map);
        })();
    }, [sesiTanggal, sesiWaktu, tableQueryResult?.data?.data, fetchKey]);

    React.useEffect(() => {
        const nisList = (tableQueryResult?.data?.data || [])
            .map((item) => item.nis)
            .filter(Boolean);

        if (nisList.length === 0) {
            setSummariesByNis({});
            setSummaryLoading(false);
            return;
        }

        let mounted = true;
        setSummaryLoading(true);
        supabaseClient
            .rpc("get_admin_murojaah_summaries", { p_santri_nis: nisList })
            .then(({ data, error }) => {
                if (!mounted) return;
                if (error) {
                    console.error("Gagal memuat ringkasan murojaah:", error);
                    setSummariesByNis({});
                } else {
                    const next: Record<string, MurojaahSummary> = {};
                    (data || []).forEach((item: MurojaahSummary) => {
                        next[item.santri_nis] = item;
                    });
                    setSummariesByNis(next);
                }
                setSummaryLoading(false);
            });

        return () => {
            mounted = false;
        };
    }, [tableQueryResult?.data?.data]);

    // ── Computed KPIs ────────────────────────────────────────────────────────

    const kpi = useMemo(() => {
        const summaries = Object.values(summariesByNis);
        const totalSantri = tableQueryResult?.data?.total ?? 0;

        const aktifMinggu = summaries.filter((s) => (s.week_count ?? 0) > 0).length;
        const totalSesiMinggu = summaries.reduce((acc, s) => acc + (s.week_count ?? 0), 0);
        const totalSesiBulan = summaries.reduce((acc, s) => acc + (s.month_count ?? 0), 0);

        const avgPerSantri =
            summaries.length > 0
                ? (totalSesiBulan / summaries.length).toFixed(1)
                : "0";

        const statusCounts: Record<ActivityStatus, number> = {
            aktif: 0,
            "perlu-perhatian": 0,
            "tidak-aktif": 0,
            belum: 0,
        };
        const allSantri = tableQueryResult?.data?.data ?? [];
        allSantri.forEach((s) => {
            const st = getActivityStatus(summariesByNis[s.nis]);
            statusCounts[st]++;
        });

        // Per-kelas breakdown for bar chart
        const kelasTally: Record<string, { aktif: number; total: number }> = {};
        allSantri.forEach((s) => {
            const kls = s.kelas ?? "–";
            if (!kelasTally[kls]) kelasTally[kls] = { aktif: 0, total: 0 };
            kelasTally[kls].total++;
            if (getActivityStatus(summariesByNis[s.nis]) === "aktif")
                kelasTally[kls].aktif++;
        });
        const kelasChart = Object.entries(kelasTally)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([kelas, v]) => ({
                kelas,
                aktif: v.aktif,
                tidakAktif: v.total - v.aktif,
            }));

        return {
            totalSantri,
            aktifMinggu,
            tidakAktifMinggu: totalSantri - aktifMinggu,
            totalSesiMinggu,
            totalSesiBulan,
            avgPerSantri,
            statusCounts,
            kelasChart,
        };
    }, [summariesByNis, tableQueryResult?.data]);

    // ── Export state ──────────────────────────────────────────────────────────

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [exportType, setExportType] = useState<"GLOBAL" | "PERSONAL">("GLOBAL");
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>([
        dayjs().startOf("month"),
        dayjs(),
    ]);
    const [selectedSantri, setSelectedSantri] = useState<string | null>(null);
    const [isLoadingExport, setIsLoadingExport] = useState(false);

    const { selectProps: santriSelectProps } = useSelect<ISantri>({
        resource: "santri",
        optionLabel: "nama",
        optionValue: "nis",
        meta: { select: "nama, nis, kelas, jurusan, status_santri" },
        filters: [{ field: "jurusan", operator: "eq", value: "TAHFIDZ" }],
        onSearch: (value) => [
            { field: "nama", operator: "contains", value },
            { field: "nis", operator: "contains", value },
        ],
    });

    // ── Export logic (preserved from original) ────────────────────────────────

    // Style helper untuk header blok sesi (Pagi/Siang)
    const applySesiHeaderStyle = (cell: ExcelJS.Cell, fillColor: string) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillColor } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
    };

    const handleExport = async () => {
        if (!dateRange) {
            message.error("Mohon pilih rentang tanggal terlebih dahulu");
            return;
        }

        // ── Warning kalau rentang tanggal lebih dari 1 bulan ──
        const rentangHari = dateRange[1].diff(dateRange[0], "day") + 1;
        if (rentangHari > 31) {
            const lanjut = await new Promise<boolean>((resolve) => {
                Modal.confirm({
                    title: "Rentang Tanggal Lebih dari 1 Bulan",
                    content: `Rentang yang dipilih (${rentangHari} hari) cukup panjang. File hasil export bisa berukuran besar dan berat dibuka. Tetap lanjutkan?`,
                    okText: "Lanjutkan",
                    cancelText: "Batal",
                    onOk: () => resolve(true),
                    onCancel: () => resolve(false),
                });
            });
            if (!lanjut) return;
        }

        setIsLoadingExport(true);
        try {
            const startDate = dateRange[0].startOf("day").toISOString();
            const endDate = dateRange[1].endOf("day").toISOString();
            const wb = new ExcelJS.Workbook();

            // Fetch santri map for nama/kelas lookup
            const { data: santriList } = await supabaseClient
                .from("santri")
                .select("nis, nama, kelas")
                .eq("jurusan", "TAHFIDZ")
                .eq("status_santri", "AKTIF");
            const santriMap = new Map((santriList || []).map((s: any) => [s.nis, s]));

            // Kolom satu blok sesi (Pagi / Siang): Status, Jenis, Cakupan, Penyimak
            const sesiColumns = (key: string, width = [11, 11, 26, 16]) => [
                { key: `${key}_status`, width: width[0] },
                { key: `${key}_jenis`, width: width[1] },
                { key: `${key}_cakupan`, width: width[2] },
                { key: `${key}_penyimak`, width: width[3] },
            ];

            const STATUS_FILLS: Record<string, string> = {
                HADIR: 'FFD1FAE5',
                SAKIT: 'FFFEF3C7',
                GHAIB: 'FFFEE2E2',
                SEKOLAH: 'FFDBEAFE',
                PULANG: 'FFFFEDD5',
            };
            const mapStatusKode = (s: string, _jenis: string): string => {
                if (s === 'HADIR') return 'H';
                if (s === 'SAKIT') return 'S';
                if (s === 'GHAIB') return 'GH';
                if (s === 'SEKOLAH') return 'Sk';
                if (s === 'PULANG') return 'P';
                return s;
            };

            if (exportType === "GLOBAL") {
                const ws = wb.addWorksheet("Rekap Murojaah");
                const rows = await fetchAbsensiPivot({ startDate, endDate, santriMap });

                // Judul
                ws.mergeCells("A1:N1");
                ws.getCell("A1").value =
                    `LAPORAN MUROJAAH TAHFIDZ — ${dateRange[0].format("DD MMM")} s/d ${dateRange[1].format("DD MMM YYYY")} M  /  ` +
                    `${formatHijri(dateRange[0].toDate())} s/d ${formatHijri(dateRange[1].toDate())} H`;
                ws.getCell("A1").font = { size: 13, bold: true, color: { argb: "FFFFFFFF" } };
                ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7E22CE" } };
                ws.getCell("A1").alignment = { horizontal: "center" };
                ws.getRow(1).height = 22;

                // Header baris 1: kelompok kolom (merge per blok sesi)
                ws.mergeCells("A3:F3");
                ws.getCell("A3").value = "DATA SANTRI";
                applySesiHeaderStyle(ws.getCell("A3"), "FF374151");
                ws.mergeCells("G3:J3");
                ws.getCell("G3").value = "SESI PAGI";
                applySesiHeaderStyle(ws.getCell("G3"), "FFD97706");
                ws.mergeCells("K3:N3");
                ws.getCell("K3").value = "SESI SIANG";
                applySesiHeaderStyle(ws.getCell("K3"), "FF2563EB");

                // Header baris 2: nama kolom detail
                ws.getRow(4).values = [
                    "NO", "Hari, Tgl (M)", "Tanggal (H)", "NIS", "Nama Santri", "Kelas",
                    "Status", "Jenis", "Cakupan", "Penyimak",
                    "Status", "Jenis", "Cakupan", "Penyimak",
                ];
                ws.getRow(4).font = { bold: true };
                ws.getRow(4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };

                ws.columns = [
                    { key: "no", width: 5 },
                    { key: "tglM", width: 22 },
                    { key: "tglH", width: 18 },
                    { key: "nis", width: 13 },
                    { key: "nama", width: 24 },
                    { key: "kelas", width: 8 },
                    ...sesiColumns("pagi"),
                    ...sesiColumns("siang"),
                ];

                rows.forEach((r: any, idx: number) => {
                    ws.addRow({
                        no: idx + 1,
                        tglM: `${DAYS_INDO[new Date(r.tanggal).getDay()]}, ${formatMasehi(r.tanggal)}`,
                        tglH: formatHijri(r.tanggal),
                        nis: r.santri_nis,
                        nama: r.nama,
                        kelas: r.kelas,
                        pagi_status: r.pagi?.status || "-",
                        pagi_jenis: r.pagi?.jenis || "-",
                        pagi_cakupan: r.pagi?.cakupan || "-",
                        pagi_penyimak: r.pagi?.penyimak || "-",
                        siang_status: r.siang?.status || "-",
                        siang_jenis: r.siang?.jenis || "-",
                        siang_cakupan: r.siang?.cakupan || "-",
                        siang_penyimak: r.siang?.penyimak || "-",
                    });
                    const row = ws.getRow(ws.rowCount);
                    const pFill = r.pagi?.status ? STATUS_FILLS[r.pagi.status] : undefined;
                    if (pFill) row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pFill } };
                    const sFill = r.siang?.status ? STATUS_FILLS[r.siang.status] : undefined;
                    if (sFill) row.getCell(11).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sFill } };
                });

                // ── Summary block: rekap jumlah per santri ──
                const B = { bold: true };
                const C = { horizontal: 'center' as const };
                const LGF = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF0FDF4' } };
                const TB = {
                    top: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
                    bottom: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
                };
                const rekapRows: any[] = [];
                const santriSeen = new Set<string>();
                rows.forEach((r: any) => {
                    if (santriSeen.has(r.santri_nis)) return;
                    santriSeen.add(r.santri_nis);
                    const h = { nis: r.santri_nis, nama: r.nama, H: 0, S: 0, GH: 0, Sk: 0, P: 0 };
                    rows.forEach((rr: any) => {
                        if (rr.santri_nis !== r.santri_nis) return;
                        [rr.pagi, rr.siang].forEach((sesi: any) => {
                            if (!sesi || !sesi.status || sesi.status === '-') return;
                            const kode = mapStatusKode(sesi.status, sesi.jenis);
                            if (kode in h) (h as any)[kode]++;
                        });
                    });
                    rekapRows.push(h);
                });

                const rekapStart = ws.rowCount + 2;
                ws.mergeCells(`A${rekapStart}:N${rekapStart}`);
                const rekapTitle = ws.getCell(`A${rekapStart}`);
                rekapTitle.value = '▸ REKAP JUMLAH PER SANTRI';
                rekapTitle.font = { size: 11, bold: true, color: { argb: 'FF065F46' } };

                const rekapHeaderRow = rekapStart + 1;
                ws.getRow(rekapHeaderRow).values = ['NIS', 'Nama Santri', 'H', 'S', 'GH', 'Sk', 'P'];
                ws.getRow(rekapHeaderRow).eachCell((cell: any) => { cell.font = B; cell.alignment = C; });
                ws.getRow(rekapHeaderRow).fill = LGF;
                ws.getRow(rekapHeaderRow).outlineLevel = 0;
                ws.columns.forEach((_: any, i: number) => {
                    if (i < 7) { const c = ws.getCell(`${String.fromCharCode(65 + i)}${rekapHeaderRow}`); c.border = TB; }
                });

                rekapRows.forEach((h: any, i: number) => {
                    const r = rekapStart + 2 + i;
                    ws.getRow(r).values = [h.nis, h.nama, h.H, h.S, h.GH, h.Sk, h.P];
                    ws.getRow(r).eachCell((cell: any, colIdx: number) => {
                        if (colIdx > 2) cell.alignment = C;
                    });
                    // Color the count cells
                    const colorMap: Record<string, string> = { H: 'FFD1FAE5', S: 'FFFEF3C7', GH: 'FFFEE2E2', Sk: 'FFDBEAFE', P: 'FFFFEDD5' };
                    ['H', 'S', 'GH', 'Sk', 'P'].forEach((k, ci) => {
                        const cell = ws.getCell(`${String.fromCharCode(67 + ci)}${r}`);
                        if ((h as any)[k] > 0) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorMap[k] } }; }
                    });
                });

                // Filter & freeze pada baris header detail (baris 4)
                ws.autoFilter = { from: "A4", to: "N4" };
                ws.views = [{ state: "frozen", ySplit: 4 }];
            } else {
                if (!selectedSantri) {
                    message.error("Pilih santri terlebih dahulu");
                    setIsLoadingExport(false);
                    return;
                }
                const { data: santri } = await supabaseClient
                    .from("santri")
                    .select("nama, nis, kelas, jurusan")
                    .eq("nis", selectedSantri)
                    .single();
                if (!santri) throw new Error("Data santri tidak ditemukan.");

                const rows = await fetchAbsensiPivot({ startDate, endDate, santriNis: selectedSantri, santriMap });
                const ws = wb.addWorksheet(`Murojaah - ${(santri.nama || santriAlias(santri.nis)).substring(0, 20)}`);

                ws.getCell("A1").value = "LAPORAN PERSONAL MUROJAAH";
                ws.getCell("A1").font = { size: 16, bold: true, color: { argb: "FF7E22CE" } };
                ws.getCell("A3").value = "Nama:"; ws.getCell("B3").value = santri.nama || santriAlias(santri.nis);
                ws.getCell("A4").value = "Kelas:"; ws.getCell("B4").value = santri.kelas;
                ws.getCell("A5").value = "Periode:";
                ws.getCell("B5").value =
                    `${dateRange[0].format("DD MMM")} s/d ${dateRange[1].format("DD MMM YYYY")} M  /  ` +
                    `${formatHijri(dateRange[0].toDate())} s/d ${formatHijri(dateRange[1].toDate())} H`;

                // Header baris 1: kelompok kolom
                ws.mergeCells("A7:B7");
                ws.getCell("A7").value = "TANGGAL";
                applySesiHeaderStyle(ws.getCell("A7"), "FF374151");
                ws.mergeCells("C7:F7");
                ws.getCell("C7").value = "SESI PAGI";
                applySesiHeaderStyle(ws.getCell("C7"), "FFD97706");
                ws.mergeCells("G7:J7");
                ws.getCell("G7").value = "SESI SIANG";
                applySesiHeaderStyle(ws.getCell("G7"), "FF2563EB");

                ws.getRow(8).values = [
                    "Hari, Masehi", "Hijriah",
                    "Status", "Jenis", "Cakupan", "Penyimak",
                    "Status", "Jenis", "Cakupan", "Penyimak",
                ];
                ws.getRow(8).font = { bold: true };
                ws.getRow(8).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };

                ws.columns = [
                    { key: "tglM", width: 22 },
                    { key: "tglH", width: 18 },
                    ...sesiColumns("pagi"),
                    ...sesiColumns("siang"),
                ];

                rows.forEach((r: any) => {
                    ws.addRow({
                        tglM: `${DAYS_INDO[new Date(r.tanggal).getDay()]}, ${formatMasehi(r.tanggal)}`,
                        tglH: formatHijri(r.tanggal),
                        pagi_status: r.pagi?.status || "-",
                        pagi_jenis: r.pagi?.jenis || "-",
                        pagi_cakupan: r.pagi?.cakupan || "-",
                        pagi_penyimak: r.pagi?.penyimak || "-",
                        siang_status: r.siang?.status || "-",
                        siang_jenis: r.siang?.jenis || "-",
                        siang_cakupan: r.siang?.cakupan || "-",
                        siang_penyimak: r.siang?.penyimak || "-",
                    });
                    const row = ws.getRow(ws.rowCount);
                    const pFill = r.pagi?.status ? STATUS_FILLS[r.pagi.status] : undefined;
                    if (pFill) row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pFill } };
                    const sFill = r.siang?.status ? STATUS_FILLS[r.siang.status] : undefined;
                    if (sFill) row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sFill } };
                });

                ws.autoFilter = { from: "A8", to: "J8" };
                ws.views = [{ state: "frozen", ySplit: 8 }];
            }

            const buffer = await wb.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `Laporan_Murojaah_${exportType}_${dayjs().format("YYYYMMDD")}.xlsx`);
            message.success("Laporan berhasil diunduh");
            setIsModalOpen(false);
        } catch (error: any) {
            message.error("Gagal export: " + error.message);
        } finally {
            setIsLoadingExport(false);
        }
    };

    // ── Table columns ─────────────────────────────────────────────────────────

    const columns: ProColumns<ISantri>[] = [
        {
            title: "Santri Tahfidz",
            dataIndex: "nis",
            width: 240,
            fixed: "left",
            render: (_, record) => {
                const status = getActivityStatus(summariesByNis[record.nis]);
                const cfg = STATUS_CONFIG[status];
                return (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ position: "relative", flexShrink: 0 }}>
                            <Avatar
                                src={record.foto_url}
                                size={40}
                                icon={<UserOutlined />}
                                style={{
                                    border: `2px solid ${cfg.color}22`,
                                    background: "var(--ant-color-primary-bg)",
                                    color: "var(--ant-color-primary)",
                                }}
                            />
                            <span
                                style={{
                                    position: "absolute",
                                    bottom: 0,
                                    right: 0,
                                    width: 9,
                                    height: 9,
                                    borderRadius: "50%",
                                    background: cfg.color,
                                    border: "1.5px solid var(--ant-color-bg-container)",
                                }}
                            />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                            <Text strong style={{ fontSize: 13, lineHeight: "18px" }}>
                                {record.nama || santriAlias(record.nis)}
                            </Text>
                            <Space size={4}>
                                <Tag bordered={false} style={{ margin: 0, fontSize: 10, padding: "0 6px", background: "var(--ant-color-fill-secondary)" }}>
                                    {record.nis}
                                </Tag>
                                <Tag color="cyan" style={{ margin: 0, fontSize: 10, padding: "0 6px" }}>
                                    Kelas {record.kelas}
                                </Tag>
                            </Space>
                        </div>
                    </div>
                );
            },
        },
        {
            title: "Pembimbing",
            dataIndex: "pembimbing",
            width: 160,
            render: (val) => (
                <Text style={{ fontSize: 12 }}>{val || "–"}</Text>
            ),
        },
        {
            title: "Status",
            key: "status",
            width: 130,
            search: false,
            render: (_, record) => {
                const summary = summariesByNis[record.nis];
                const status = getActivityStatus(summary);
                const cfg = STATUS_CONFIG[status];
                const days = summary?.last_tanggal ? daysSince(summary.last_tanggal) : null;
                return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <Tag
                            color={cfg.antColor}
                            style={{ margin: 0, fontSize: 10, width: "fit-content" }}
                        >
                            {cfg.label}
                        </Tag>
                        {days !== null && (
                            <Text type="secondary" style={{ fontSize: 10 }}>
                                {days === 0 ? "Hari ini" : `${days} hari lalu`}
                            </Text>
                        )}
                    </div>
                );
            },
        },
        {
            title: "Sesi",
            key: "summary",
            width: 200,
            search: false,
            render: (_, record) => {
                const summary = summariesByNis[record.nis];
                if (!summary) return <Text type="secondary" style={{ fontSize: 12 }}>–</Text>;
                const weekPct = summary.month_count > 0
                    ? Math.round((summary.week_count / summary.month_count) * 100)
                    : 0;
                return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <Space size={4}>
                            <Tag color="purple" style={{ margin: 0, fontSize: 10 }}>
                                Total {summary.total_count}
                            </Tag>
                            <Tag color="blue" style={{ margin: 0, fontSize: 10 }}>
                                Bulan {summary.month_count}
                            </Tag>
                        </Space>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Progress
                                percent={weekPct}
                                size="small"
                                showInfo={false}
                                strokeColor="#7c3aed"
                                style={{ flex: 1, margin: 0 }}
                            />
                            <Text style={{ fontSize: 10, color: "var(--ant-color-text-secondary)", whiteSpace: "nowrap" }}>
                                {summary.week_count} pekan ini
                            </Text>
                        </div>
                    </div>
                );
            },
        },
        {
            title: "Murojaah Terakhir",
            key: "last_murojaah",
            width: 260,
            search: false,
            render: (_, record) => {
                const summary = summariesByNis[record.nis];
                if (!summary?.last_tanggal) {
                    return (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            Belum ada log
                        </Text>
                    );
                }
                return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <Space size={4}>
                            {summary.last_jenis_murojaah && (
                                <Tag
                                    color={summary.last_jenis_murojaah === "SABAQ" ? "blue" : "purple"}
                                    style={{ margin: 0, fontSize: 10 }}
                                >
                                    {summary.last_jenis_murojaah}
                                </Tag>
                            )}
                            {summary.last_predikat && (
                                <Tag
                                    color={summary.last_predikat === "MUMTAZ" ? "success" : "default"}
                                    style={{ margin: 0, fontSize: 10 }}
                                >
                                    {summary.last_predikat}
                                </Tag>
                            )}
                        </Space>
                        <Text
                            ellipsis={{ tooltip: formatMurojaahCoverage(summary) }}
                            style={{ fontSize: 12, maxWidth: 240 }}
                        >
                            {formatMurojaahCoverage(summary)}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 10 }}>
                            {formatMasehi(summary.last_tanggal)}
                        </Text>
                    </div>
                );
            },
        },
        {
            title: "Aksi",
            valueType: "option",
            width: 130,
            fixed: "right",
            render: (_, record) => [
                <Tooltip title="Input Murojaah" key="add">
                    <Button
                        type="primary"
                        ghost
                        size="small"
                        icon={<PlusOutlined />}
                        style={{ borderColor: "#7c3aed", color: "#7c3aed" }}
                        onClick={() => push(`/murojaah/create?nis=${record.nis}`)}
                    />
                </Tooltip>,
                <Tooltip title="Lihat Log & Detail" key="view">
                    <Button
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => push(`/murojaah/show/${record.nis}`)}
                    >
                        Detail
                    </Button>
                </Tooltip>,
            ],
        },
    ];

    // ── Shared styles ─────────────────────────────────────────────────────────

    const card: React.CSSProperties = {
        background: token.colorBgContainer,
        border: `1px solid ${isDark ? "#334155" : token.colorBorderSecondary}`,
        borderRadius: 12,
        padding: "16px 20px",
        boxShadow: isDark ? "0 1px 3px rgba(0,0,0,0.25)" : "0 1px 3px rgba(0,0,0,0.06)",
    };

    const sectionLabel: React.CSSProperties = {
        fontSize: 11,
        fontWeight: 500,
        color: token.colorTextSecondary,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        marginBottom: 12,
        display: "flex",
        alignItems: "center",
        gap: 6,
    };

    const divider: React.CSSProperties = {
        height: "0.5px",
        background: token.colorBorderSecondary,
        margin: "14px 0",
    };

    const totalSantri = kpi.totalSantri;

    return (
        <>
            <div style={{ padding: "0 0 80px" }}>

                {/* ── Page header ── */}
                <div style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                            <Text style={{ fontSize: 18, fontWeight: 500, display: "block" }}>
                                Murojaah Tahfidz
                            </Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                Update per {formatHijri(new Date())}
                            </Text>
                        </div>
                        <Space>
                            <Button
                                icon={<FileExcelOutlined />}
                                onClick={() => setIsModalOpen(true)}
                                style={{ color: "#16a34a", borderColor: "#16a34a" }}
                            >
                                Export Center
                            </Button>
                            <Dropdown.Button
                                type="primary"
                                icon={<MenuOutlined />}
                                menu={{
                                    items: [
                                        { key: 'session', label: '☀️ Absensi Cepat (Murojaah)', onClick: () => setSessionModalOpen(true) },
                                        { key: 'murojaah', label: '🔄 Murojaah Detail', onClick: () => push("/murojaah/create") },
                                        { key: 'hafalan', label: '📝 Setoran Hafalan Detail', onClick: () => push("/hafalan/create") },
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

                {/* ── TABS ── */}
                <Tabs
                    activeKey={activeTab}
                    onChange={(key: string) => setActiveTab(key as 'daftar' | 'absensi')}
                    items={[
                        { key: 'daftar', label: '📋 Daftar Santri', children: (
                            <>

                                {/* ── KPI row ── */}
                                <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                                    <KpiCard
                                        icon={<TeamOutlined />}
                                        value={totalSantri}
                                        label="Total santri aktif"
                                        sub="Takhasus Tahfidz"
                                        loading={summaryLoading}
                                        isDark={isDark}
                                    />
                                    <KpiCard
                                        icon={<FireOutlined />}
                                        value={kpi.aktifMinggu}
                                        label="Aktif minggu ini"
                                        sub={`${totalSantri > 0 ? Math.round((kpi.aktifMinggu / totalSantri) * 100) : 0}% dari total santri`}
                                        accent="#7c3aed"
                                        loading={summaryLoading}
                                        isDark={isDark}
                                    />
                                    <KpiCard
                                        icon={<WarningOutlined />}
                                        value={kpi.tidakAktifMinggu}
                                        label="Belum murojaah minggu ini"
                                        sub="Perlu tindak lanjut"
                                        accent={kpi.tidakAktifMinggu > 0 ? "#dc2626" : "#16a34a"}
                                        loading={summaryLoading}
                                        isDark={isDark}
                                    />
                                    <KpiCard
                                        icon={<BookOutlined />}
                                        value={kpi.totalSesiMinggu}
                                        label="Total sesi minggu ini"
                                        sub={`${kpi.totalSesiBulan} sesi bulan ini`}
                                        loading={summaryLoading}
                                        isDark={isDark}
                                    />
                                    <KpiCard
                                        icon={<RiseOutlined />}
                                        value={kpi.avgPerSantri}
                                        label="Rata-rata sesi/santri"
                                        sub="Bulan ini"
                                        loading={summaryLoading}
                                        isDark={isDark}
                                    />
                                </div>

                                {/* ── Analytics row ── */}
                                <div
                                    style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}
                                >
                                    <div style={card}>
                                        <div style={sectionLabel}>
                                            <TrophyOutlined style={{ fontSize: 13 }} />
                                            <span>Distribusi status aktivitas santri</span>
                                        </div>
                                        {summaryLoading ? (
                                            <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
                                                <Spin />
                                            </div>
                                        ) : (
                                            <ActivityBreakdown counts={kpi.statusCounts} total={totalSantri} isDark={isDark} />
                                        )}
                                    </div>

                                    <div style={card}>
                                        <div style={sectionLabel}>
                                            <BarChartOutlined style={{ fontSize: 13 }} />
                                            <span>Keaktifan per kelas — minggu ini</span>
                                        </div>
                                        <div
                                            style={{
                                                display: "flex",
                                                gap: 16,
                                                marginBottom: 10,
                                                fontSize: 11,
                                                color: "var(--ant-color-text-secondary)",
                                            }}
                                        >
                                            {[
                                                { color: "#7c3aed", label: "Aktif" },
                                                { color: isDark ? "#334155" : "#CBD5E1", label: "Tidak aktif" },
                                            ].map(({ color, label }) => (
                                                <span key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                                    <span
                                                        style={{ width: 10, height: 10, borderRadius: 2, background: color, display: "inline-block" }}
                                                    />
                                                    {label}
                                                </span>
                                            ))}
                                        </div>
                                        {summaryLoading ? (
                                            <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
                                                <Spin />
                                            </div>
                                        ) : kpi.kelasChart.length > 0 ? (
                                            <ResponsiveContainer width="100%" height={140}>
                                                <BarChart data={kpi.kelasChart} barSize={20} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke={token.colorBorderSecondary} vertical={false} />
                                                    <XAxis dataKey="kelas" tick={{ fontSize: 11, fill: token.colorTextSecondary }} axisLine={false} tickLine={false} />
                                                    <YAxis tick={{ fontSize: 10, fill: token.colorTextSecondary }} axisLine={false} tickLine={false} allowDecimals={false} />
                                                    <RechartsTooltip
                                                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "0.5px solid var(--ant-color-border-secondary)", background: "var(--ant-color-bg-container)" }}
                                                        cursor={{ fill: token.colorFillSecondary }}
                                                    />
                                                    <Bar dataKey="aktif" name="Aktif" stackId="a" fill="#7c3aed" radius={[0, 0, 0, 0]} />
                                                    <Bar dataKey="tidakAktif" name="Tidak aktif" stackId="a" fill={isDark ? "#334155" : "#CBD5E1"} radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                Data kelas belum tersedia.
                                            </Text>
                                        )}
                                    </div>
                                </div>

                                {/* ── Main table ── */}
                                <div
                                    style={{
                                        background: token.colorBgContainer,
                                        border: `1px solid ${isDark ? "#334155" : token.colorBorderSecondary}`,
                                        borderRadius: 12,
                                        overflow: "hidden",
                                    }}
                                >
                                    <ProTable<ISantri>
                                        {...tableProps}
                                        columns={columns}
                                        rowKey="nis"
                                        headerTitle={
                                            <div style={{ display: "flex", flexDirection: "column" }}>
                                                <Text strong style={{ fontSize: 14 }}>
                                                    Daftar Santri Tahfidz
                                                </Text>
                                                <Text type="secondary" style={{ fontSize: 11 }}>
                                                    {totalSantri} santri aktif terdaftar
                                                </Text>
                                            </div>
                                        }
                                        toolBarRender={false}
                                        options={{ density: true, fullScreen: true, reload: true }}
                                        search={{ labelWidth: "auto", layout: "vertical" }}
                                        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
                                        style={{ borderRadius: 0 }}
                                        rowClassName={(record) => {
                                            const status = getActivityStatus(summariesByNis[record.nis]);
                                            return status === "tidak-aktif" ? "murojaah-row-warn" : "";
                                        }}
                                    />
                                </div>
                            </>
                        )},
                        { key: 'absensi', label: '☀️ Absensi Cepat Hari Ini', children: (
                            <div style={{ background: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 16, overflow: "hidden" }}>
                                <div style={{ padding: "16px 20px", borderBottom: `1px solid ${token.colorBorderSecondary}`, background: isDark ? "#1E293B" : "#F8FAFC" }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            <span style={{ fontSize: 20 }}>☀️</span>
                                            <Text strong style={{ fontSize: 16, color: token.colorText }}>
                                                Absensi Cepat — {sesiTanggal.format('DD MMM YYYY')} · MUROJAAH / {sesiWaktu}
                                            </Text>
                                        </div>
                                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                            <Tag color="green" style={{ fontSize: 10 }}>HADIR = Setoran</Tag>
                                            <Tag color="red" style={{ fontSize: 10 }}>GHAIB</Tag>
                                            <Tag color="orange" style={{ fontSize: 10 }}>SAKIT</Tag>
                                            <Tag color="purple" style={{ fontSize: 10 }}>PULANG</Tag>
                                            <Tag color="blue" style={{ fontSize: 10 }}>SEKOLAH</Tag>
                                            <DatePicker
                                                value={sesiTanggal}
                                                onChange={(d) => d && setSesiTanggal(d)}
                                                allowClear={false}
                                                format="DD MMM YYYY"
                                                size="small"
                                                style={{ borderRadius: 6, width: 140 }}
                                            />
                                            <Segmented
                                                value={sesiWaktu}
                                                onChange={(v) => setSesiWaktu(v as string)}
                                                size="small"
                                                options={[
                                                    { label: '🌅 Pagi', value: 'PAGI' },
                                                    { label: '☀️ Siang', value: 'SIANG' },
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
                                    </div>
                                    <div style={{ fontSize: 11, color: token.colorTextSecondary }}>
                                        Klik status untuk simpan cepat. Badge hijau = sudah input detail via "Murojaah Detail".
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
                                            {santriForSesi.map((santri: any, idx: number) => {
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
                                                                <Avatar src={santri.foto_url} size={32} icon={<UserOutlined />} style={{ background: "#7c3aed", color: "#fff", flexShrink: 0 }} />
                                                                <div style={{ minWidth: 0 }}>
                                                                    <div style={{ fontWeight: 600, fontSize: 13, color: token.colorText, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                                        {santri.nama}
                                                                    </div>
                                                                    <div style={{ fontSize: 11, color: token.colorTextSecondary }}>
                                                                        <code style={{ background: isDark ? "#0F172A" : "#F1F5F9", padding: "1px 5px", borderRadius: 4, fontSize: 10 }}>{santri.nis}</code>
                                                                    </div>
                                                                </div>
                                                                {rec.status === 'HADIR' && (detailSetoranMap[santri.nis] ? (
                                                                    <Tag style={{ marginLeft: 8, padding: "2px 6px", background: detailSetoranMap[santri.nis].status_setoran === 'MENGULANG' ? "#FEF3C7" : "#EDE9FE", color: detailSetoranMap[santri.nis].status_setoran === 'MENGULANG' ? '#B45309' : '#7C3AED', border: "none", fontSize: 10 }}>
                                                                        {formatMurojaahDetail(detailSetoranMap[santri.nis])}
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
                                                                            <div key={j} style={{ width: 6, height: 8, borderRadius: 1.5, background: j <= Math.round(juzNum / 3) ? "#7c3aed" : isDark ? "#1E293B" : "#E2E8F0", flexShrink: 0 }} />
                                                                        );
                                                                    })}
                                                                </div>
                                                                <div style={{ fontSize: 11, fontWeight: 600, color: "#7c3aed" }}>
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
                                                                            onClick={() => !isSaving && handleStatusClick(santri.nis, s.key)}
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
                                    {santriForSesi.length === 0 && (
                                        <div style={{ padding: "40px 20px", textAlign: "center", color: token.colorTextSecondary }}>
                                            Tidak ada santri aktif
                                        </div>
                                    )}
                                </div>
                            </div>
                        )},
                    ]}
                />
            </div>

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
                <div style={{ display: "flex", gap: 16, marginBottom: 16, alignItems: "center" }}>
                    <Segmented
                        value={sesiWaktu}
                        onChange={(v) => setSesiWaktu(v as string)}
                        options={[
                            { label: '🌅 Pagi', value: 'PAGI' },
                            { label: '☀️ Siang', value: 'SIANG' },
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

                <div style={{ maxHeight: 500, overflowY: 'auto', padding: "0 4px" }}>
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
                            {santriForSesi.map((santri: any, idx: number) => {
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
                                                <Avatar src={santri.foto_url} size={32} icon={<UserOutlined />} style={{ background: "#7c3aed", color: "#fff", flexShrink: 0 }} />
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontWeight: 600, fontSize: 13, color: token.colorText, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                        {santri.nama}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: token.colorTextSecondary }}>
                                                        <code style={{ background: isDark ? "#0F172A" : "#F1F5F9", padding: "1px 5px", borderRadius: 4, fontSize: 10 }}>{santri.nis}</code>
                                                    </div>
                                                </div>
                                                    {rec.status === 'HADIR' && (detailSetoranMap[santri.nis] ? (
                                                        <Tag style={{ marginLeft: 8, padding: "2px 6px", background: detailSetoranMap[santri.nis].status_setoran === 'MENGULANG' ? "#FEF3C7" : "#EDE9FE", color: detailSetoranMap[santri.nis].status_setoran === 'MENGULANG' ? '#B45309' : '#7C3AED', border: "none", fontSize: 10 }}>
                                                            {formatMurojaahDetail(detailSetoranMap[santri.nis])}
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
                                                            <div key={j} style={{ width: 6, height: 8, borderRadius: 1.5, background: j <= Math.round(juzNum / 3) ? "#7c3aed" : isDark ? "#1E293B" : "#E2E8F0", flexShrink: 0 }} />
                                                        );
                                                    })}
                                                </div>
                                                <div style={{ fontSize: 11, fontWeight: 600, color: "#7c3aed" }}>
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
                                                            onClick={() => !isSaving && handleStatusClick(santri.nis, s.key)}
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
                    {santriForSesi.length === 0 && (
                        <div style={{ padding: "40px 20px", textAlign: "center", color: token.colorTextSecondary }}>
                            Tidak ada santri aktif
                        </div>
                    )}
                </div>
            </Modal>

            {/* ── Export Modal (preserved from original) ── */}
            <Modal
                title={
                    <Space>
                        <FileExcelOutlined style={{ color: "#16a34a" }} />
                        Export Data Murojaah
                    </Space>
                }
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                footer={[
                    <Button key="back" onClick={() => setIsModalOpen(false)}>
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
                                onChange={(val) => setSelectedSantri(val as unknown as string)}
                                allowClear
                            />
                        </div>
                    )}

                    <div>
                        <Text strong style={{ display: "block", marginBottom: 6 }}>
                            Rentang Periode
                        </Text>
                        <RangePicker
                            value={dateRange}
                            onChange={(dates) => setDateRange(dates as any)}
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
        </>
    );
};
