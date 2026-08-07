import React, { useState, useEffect, useCallback } from "react";
import { logActivity } from "../../utility/logger";
import { useSelect } from "@refinedev/antd";
import {
    Form,
    Input,
    Select,
    DatePicker,
    Row,
    Col,
    InputNumber,
    Divider,
    Typography,
    Avatar,
    Tag,
    Tooltip,
    theme,
    Space,
    Button,
    message,
    Segmented,
    Modal,
    Radio,
} from "antd";
import dayjs from "dayjs";
import { ISantri, IProfile } from "../../types";
import { useGetIdentity, useUpdate } from "@refinedev/core";
import { DATA_SURAT, getJuzFromSurat } from "../../utility/quran-data";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabaseClient } from "../../utility/supabaseClient";
import {
    UserOutlined,
    CalendarOutlined,
    BookOutlined,
    StarFilled,
    CheckCircleFilled,
    ArrowLeftOutlined,
    InfoCircleOutlined,
    ReadOutlined,
    EditOutlined,
    TrophyOutlined,
    FireOutlined,
    SafetyCertificateOutlined,
    ReloadOutlined,
} from "@ant-design/icons";

const { Text, Title } = Typography;
const { useToken } = theme;

// ─────────────────── Status Absensi ───────────────────
const STATUS_ABSENSI = [
  { key: 'HADIR',   label: 'Hadir',       icon: '✅', color: '#16A34A' },
  { key: 'SAKIT',   label: 'Sakit',       icon: '🤒', color: '#D97706' },
  { key: 'IZIN',    label: 'Izin',        icon: '📋', color: '#2563EB' },
  { key: 'GHAIB',   label: 'Ghaib',       icon: '❌', color: '#DC2626' },
];

const STATUS_LABEL: Record<string, string> = {
  HADIR: 'Hadir', SAKIT: 'Sakit', IZIN: 'Izin', GHAIB: 'Ghaib', SEKOLAH: 'Sekolah', PULANG: 'Pulang',
};

// ─────────────────────────── Helpers ───────────────────────────
const parseTotalHafalan = (value?: string | number | null) => {
    if (value === null || value === undefined || value === "") return 0;
    const match = String(value).replace(",", ".").match(/\d+(\.\d+)?/);
    return match ? Number(match[0]) : 0;
};

// ─────────────────────────── Helpers: Halaman Display ───────────────────────────
const formatHalaman = (kuartal: number): string => {
    if (kuartal <= 0) return "—";
    const h = Math.floor(kuartal / 4);
    const s = kuartal % 4;
    const pecahan = ["", "¼", "½", "¾"];
    if (h === 0) return pecahan[s];
    if (s === 0) return `${h}`;
    return `${h} ${pecahan[s]}`;
};

interface PetaJuzData {
    juz: number;
    halaman_progress: number;
    is_completed: boolean;
}

interface HalamanPerJuz {
    juz: number;
    total_halaman: number;
}

// ─────────────────────────── Juz Card (Grid) ───────────────────────────
const JuzCard: React.FC<{
    data: PetaJuzData;
    totalHal: number;
    isSelected: boolean;
    isDark: boolean;
    isCurrentJuz: boolean;
    onClick: () => void;
    onEdit: (e: React.MouseEvent) => void;
}> = ({ data, totalHal, isSelected, isDark, isCurrentJuz, onClick, onEdit }) => {
    const totalKuartal = totalHal * 4;
    const progress = data.is_completed ? 1 : Math.min(data.halaman_progress / totalKuartal, 1);
    const pct = Math.round(progress * 100);

    // Hitung halaman dan pecahan
    const halaman = Math.floor(data.halaman_progress / 4);
    const pecahan = data.halaman_progress % 4;
    const pecahanLabel = ["", "¼", "½", "¾"][pecahan];
    const progressText = data.halaman_progress > 0
        ? `${halaman > 0 ? halaman : ""}${pecahanLabel}`
        : "—";

    const cardBg = data.is_completed
        ? (isDark ? "#022C22" : "#F0FDF4")
        : data.halaman_progress > 0
        ? (isDark ? "#422006" : "#FFFBEB")
        : (isDark ? "#1E293B" : "#F8FAFC");

    const barColor = data.is_completed ? "#047857" : data.halaman_progress > 0 ? "#D97706" : "#CBD5E1";
    const textColor = data.is_completed ? "#047857" : data.halaman_progress > 0 ? "#D97706" : isDark ? "#64748B" : "#94A3B8";
    const borderColor = isSelected
        ? "#2563EB"
        : isCurrentJuz
        ? "#F59E0B"
        : data.is_completed
        ? "#047857"
        : isDark ? "#334155" : "#E2E8F0";

    return (
        <div
            onClick={onClick}
            style={{
                padding: "8px 6px",
                borderRadius: 10,
                background: cardBg,
                border: `1.5px solid ${borderColor}`,
                cursor: "pointer",
                transition: "all 0.15s",
                position: "relative",
                minHeight: 70,
            }}
        >
            {/* Edit button */}
            <div
                onClick={onEdit}
                style={{
                    position: "absolute",
                    top: 3,
                    right: 3,
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: isDark ? "#334155" : "#F1F5F9",
                    color: isDark ? "#94A3B8" : "#64748B",
                    fontSize: 9,
                    cursor: "pointer",
                    opacity: 0.7,
                    zIndex: 1,
                }}
            >
                <EditOutlined />
            </div>

            {/* Juz number */}
            <div style={{
                fontSize: 13,
                fontWeight: 700,
                color: isDark ? "#F1F5F9" : "#0F172A",
                marginBottom: 4,
                textAlign: "center",
                lineHeight: 1,
            }}>
                {data.juz}
            </div>

            {/* Progress bar */}
            <div style={{
                width: "100%",
                height: 5,
                borderRadius: 3,
                background: isDark ? "#0F172A" : "#F1F5F9",
                marginBottom: 5,
                overflow: "hidden",
            }}>
                <div style={{
                    width: `${pct}%`,
                    height: "100%",
                    borderRadius: 3,
                    background: barColor,
                    transition: "width 0.3s",
                }} />
            </div>

            {/* Progress text - halaman info */}
            <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: textColor,
                textAlign: "center",
                lineHeight: 1.2,
                marginBottom: 2,
            }}>
                {data.is_completed ? "✓ Selesai" : progressText}
            </div>

            {/* Total info */}
            {!data.is_completed && (
                <div style={{
                    fontSize: 8,
                    color: isDark ? "#475569" : "#94A3B8",
                    textAlign: "center",
                    lineHeight: 1,
                }}>
                    / {totalHal} hal
                </div>
            )}
        </div>
    );
};

// ─────────────────────────── Juz Detail Inline Modal ───────────────────────────
const JuzDetailInlineModal: React.FC<{
    open: boolean;
    juz: number;
    totalHal: number;
    santriNis: string;
    isDark: boolean;
    onClose: () => void;
    onSaved: () => void;
}> = ({ open, juz, totalHal, santriNis, isDark, onClose, onSaved }) => {
    const [status, setStatus] = useState<"PROSES" | "SELESAI">("PROSES");
    const [halaman, setHalaman] = useState(0);
    const [pecahan, setPecahan] = useState<0 | 1 | 2 | 3>(0);
    const [loading, setLoading] = useState(false);

    const kuartal = halaman * 4 + pecahan;

    useEffect(() => {
        if (!open || !santriNis || !juz) return;
        supabaseClient
            .from("santri_peta_hafalan")
            .select("halaman_progress, is_completed")
            .eq("santri_nis", santriNis)
            .eq("juz", juz)
            .maybeSingle()
            .then(({ data }) => {
                if (data) {
                    setHalaman(Math.floor(data.halaman_progress / 4));
                    setPecahan((data.halaman_progress % 4) as 0 | 1 | 2 | 3);
                    setStatus(data.is_completed ? "SELESAI" : "PROSES");
                } else {
                    setHalaman(0);
                    setPecahan(0);
                    setStatus("PROSES");
                }
            });
    }, [open, santriNis, juz]);

    const handleSave = async () => {
        setLoading(true);
        try {
            const totalKuartal = totalHal * 4;
            const isCompleted = status === "SELESAI" || kuartal >= totalKuartal;

            const { error } = await supabaseClient
                .from("santri_peta_hafalan")
                .upsert({
                    santri_nis: santriNis,
                    juz,
                    halaman_progress: kuartal,
                    is_completed: isCompleted,
                }, { onConflict: "santri_nis, juz" });

            if (error) throw error;
            message.success(`Juz ${juz} berhasil diperbarui`);
            onSaved();
            onClose();
        } catch (err: any) {
            message.error(err.message || "Gagal menyimpan");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            open={open}
            title={`Edit Juz ${juz}`}
            onCancel={onClose}
            onOk={handleSave}
            okText="Simpan"
            cancelText="Batal"
            confirmLoading={loading}
            width={400}
        >
            <div style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 12, fontWeight: 600, color: isDark ? "#94A3B8" : "#64748B", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Status
                </Text>
                <Radio.Group
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    style={{ marginTop: 8, display: "flex", gap: 8 }}
                >
                    <Radio.Button value="PROSES" style={{ flex: 1, textAlign: "center" }}>
                        🟡 Proses
                    </Radio.Button>
                    <Radio.Button value="SELESAI" style={{ flex: 1, textAlign: "center" }}>
                        🟢 Selesai
                    </Radio.Button>
                </Radio.Group>
            </div>

            <div style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 12, fontWeight: 600, color: isDark ? "#94A3B8" : "#64748B", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Halaman (0-{totalHal})
                </Text>
                <InputNumber
                    min={0}
                    max={totalHal}
                    value={halaman}
                    onChange={(v) => setHalaman(v || 0)}
                    style={{ width: "100%", marginTop: 8 }}
                    size="large"
                />
            </div>

            <div style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 12, fontWeight: 600, color: isDark ? "#94A3B8" : "#64748B", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Pecahan
                </Text>
                <Segmented
                    value={pecahan}
                    onChange={(v) => setPecahan(v as 0 | 1 | 2 | 3)}
                    options={[
                        { label: "Utuh", value: 0 },
                        { label: "¼", value: 1 },
                        { label: "½", value: 2 },
                        { label: "¾", value: 3 },
                    ]}
                    style={{ marginTop: 8, width: "100%" }}
                />
            </div>

            <div style={{
                padding: "8px 12px",
                borderRadius: 8,
                background: isDark ? "#1E293B" : "#F0FDF4",
                border: `1px solid ${isDark ? "#334155" : "#BBF7D0"}`,
            }}>
                <Text style={{ fontSize: 12, color: isDark ? "#94A3B8" : "#64748B" }}>
                    Total: <strong style={{ color: isDark ? "#F1F5F9" : "#0F172A" }}>
                        {formatHalaman(kuartal)}
                    </strong> halaman ({Math.round((kuartal / (totalHal * 4)) * 100)}%)
                </Text>
                <Text style={{ fontSize: 10, color: isDark ? "#475569" : "#94A3B8", display: "block", marginTop: 4 }}>
                    * DATABASE adalah sumber kebenaran untuk progress hafalan
                </Text>
            </div>
        </Modal>
    );
};

// ─────────────────────────── Peta Hafalan Inline ───────────────────────────
const PetaHafalanInline: React.FC<{
    santriNis: string | undefined;
    isDark: boolean;
    value?: number;
    onChange?: (juz: number) => void;
    onRefresh?: () => void;
}> = ({ santriNis, isDark, value, onChange, onRefresh }) => {
    const [juzData, setJuzData] = useState<Map<number, PetaJuzData>>(new Map());
    const [halamanPerJuz, setHalamanPerJuz] = useState<Map<number, number>>(new Map());
    const [loading, setLoading] = useState(false);
    const [editJuz, setEditJuz] = useState<number | null>(null);

    // Fetch halaman per juz from backend (source of truth)
    useEffect(() => {
        supabaseClient
            .rpc('get_halaman_per_juz')
            .then(({ data }) => {
                if (data) {
                    const map = new Map<number, number>();
                    data.forEach((row: HalamanPerJuz) => {
                        map.set(row.juz, Number(row.total_halaman));
                    });
                    setHalamanPerJuz(map);
                }
            });
    }, []);

    const fetchData = useCallback(async () => {
        if (!santriNis) { setJuzData(new Map()); return; }
        setLoading(true);
        try {
            const { data } = await supabaseClient
                .from("santri_peta_hafalan")
                .select("juz, halaman_progress, is_completed")
                .eq("santri_nis", santriNis)
                .order("juz");

            const map = new Map<number, PetaJuzData>();
            if (data) {
                data.forEach((row) => {
                    map.set(row.juz, {
                        juz: row.juz,
                        halaman_progress: row.halaman_progress,
                        is_completed: row.is_completed,
                    });
                });
            }
            setJuzData(map);
        } catch {
            // silently fail
        } finally {
            setLoading(false);
        }
    }, [santriNis]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSaved = () => {
        fetchData();
        onRefresh?.();
    };

    // Get total halaman for a juz (from backend)
    const getTotalHal = (juz: number): number => {
        return halamanPerJuz.get(juz) || 20; // fallback to 20 if not loaded yet
    };

    // Generate all 30 juz entries
    const allJuz: PetaJuzData[] = Array.from({ length: 30 }, (_, i) => {
        const juz = i + 1;
        const existing = juzData.get(juz);
        return existing || { juz, halaman_progress: 0, is_completed: false };
    });

    // Hitung total progress
    const totalSelesai = allJuz.filter(j => j.is_completed).length;
    const totalProses = allJuz.filter(j => !j.is_completed && j.halaman_progress > 0).length;
    const totalBelum = allJuz.filter(j => !j.is_completed && j.halaman_progress === 0).length;

    if (!santriNis) return null;

    return (
        <div>
            {loading && juzData.size === 0 ? (
                <div style={{ padding: "16px 0", textAlign: "center", color: isDark ? "#64748B" : "#94A3B8", fontSize: 12 }}>
                    Memuat peta hafalan...
                </div>
            ) : (
                <>
                    {/* Summary */}
                    <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                        <div style={{
                            flex: 1,
                            minWidth: 60,
                            padding: "4px 6px",
                            borderRadius: 6,
                            background: isDark ? "#022C22" : "#F0FDF4",
                            border: `1px solid ${isDark ? "#065F46" : "#BBF7D0"}`,
                            textAlign: "center",
                        }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#047857" }}>{totalSelesai}</div>
                            <div style={{ fontSize: 8, color: isDark ? "#6EE7B7" : "#059669" }}>Selesai</div>
                        </div>
                        <div style={{
                            flex: 1,
                            minWidth: 60,
                            padding: "4px 6px",
                            borderRadius: 6,
                            background: isDark ? "#422006" : "#FFFBEB",
                            border: `1px solid ${isDark ? "#92400E" : "#FDE68A"}`,
                            textAlign: "center",
                        }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#D97706" }}>{totalProses}</div>
                            <div style={{ fontSize: 8, color: isDark ? "#FCD34D" : "#B45309" }}>Proses</div>
                        </div>
                        <div style={{
                            flex: 1,
                            minWidth: 60,
                            padding: "4px 6px",
                            borderRadius: 6,
                            background: isDark ? "#1E293B" : "#F8FAFC",
                            border: `1px solid ${isDark ? "#334155" : "#E2E8F0"}`,
                            textAlign: "center",
                        }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: isDark ? "#94A3B8" : "#64748B" }}>{totalBelum}</div>
                            <div style={{ fontSize: 8, color: isDark ? "#64748B" : "#94A3B8" }}>Belum</div>
                        </div>
                    </div>

                    {/* Grid */}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(6, 1fr)",
                            gap: 5,
                        }}
                    >
                        {allJuz.map((juz) => (
                            <JuzCard
                                key={juz.juz}
                                data={juz}
                                totalHal={getTotalHal(juz.juz)}
                                isSelected={juz.juz === value}
                                isDark={isDark}
                                isCurrentJuz={false}
                                onClick={() => onChange?.(juz.juz)}
                                onEdit={(e) => { e.stopPropagation(); setEditJuz(juz.juz); }}
                            />
                        ))}
                    </div>

                    {/* Legend */}
                    <div style={{ display: "flex", gap: 10, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                        {[
                            { color: "#047857", label: "Selesai" },
                            { color: "#D97706", label: "Proses" },
                            { color: isDark ? "#1E293B" : "#E2E8F0", label: "Belum", border: true },
                        ].map(({ color, label, border }) => (
                            <div key={label} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                <div style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: 2,
                                    background: color,
                                    border: border ? `1px solid ${isDark ? "#334155" : "#CBD5E1"}` : "none",
                                }} />
                                <Text style={{ fontSize: 9, color: isDark ? "#64748B" : "#94A3B8" }}>{label}</Text>
                            </div>
                        ))}
                        <div style={{ marginLeft: "auto" }}>
                            <Button
                                type="link"
                                size="small"
                                icon={<ReloadOutlined />}
                                onClick={fetchData}
                                style={{ fontSize: 9, padding: 0 }}
                            >
                                Refresh
                            </Button>
                        </div>
                    </div>
                </>
            )}

            {/* Edit Modal */}
            {editJuz !== null && (
                <JuzDetailInlineModal
                    open={editJuz !== null}
                    juz={editJuz}
                    totalHal={getTotalHal(editJuz)}
                    santriNis={santriNis}
                    isDark={isDark}
                    onClose={() => setEditJuz(null)}
                    onSaved={handleSaved}
                />
            )}
        </div>
    );
};

// ─────────────────────────── Predikat Selector ───────────────────────────
const PREDIKAT_OPTIONS = [
    {
        value: "MUMTAZ",
        label: "Mumtaz",
        sub: "Sangat baik & lancar",
        icon: <StarFilled />,
        color: "#D97706",
        bg: "#FEF3C7",
        darkBg: "#451A03",
    },
    {
        value: "JAYYID",
        label: "Jayyid",
        sub: "Baik, sedikit salah",
        icon: <TrophyOutlined />,
        color: "#059669",
        bg: "#D1FAE5",
        darkBg: "#022C22",
    },
    {
        value: "MAQBUL",
        label: "Maqbul",
        sub: "Cukup, perlu latihan",
        icon: <BookOutlined />,
        color: "#2563EB",
        bg: "#DBEAFE",
        darkBg: "#1E3A5F",
    },
    {
        value: "KURANG",
        label: "Kurang",
        sub: "Banyak koreksi",
        icon: <FireOutlined />,
        color: "#DC2626",
        bg: "#FEE2E2",
        darkBg: "#450A0A",
    },
];

const PredikatSelector: React.FC<{
    value?: string;
    onChange?: (v: string) => void;
    isDark: boolean;
}> = ({ value, onChange, isDark }) => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
        {PREDIKAT_OPTIONS.map((opt) => {
            const isSelected = value === opt.value;
            return (
                <div
                    key={opt.value}
                    onClick={() => onChange?.(opt.value)}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        borderRadius: 10,
                        cursor: "pointer",
                        border: isSelected
                            ? `2px solid ${opt.color}`
                            : `1px solid ${isDark ? "#334155" : "#E2E8F0"}`,
                        background: isSelected
                            ? (isDark ? opt.darkBg : opt.bg)
                            : (isDark ? "#0F172A" : "#FAFAFA"),
                        transition: "all 0.15s",
                        transform: isSelected ? "scale(1.02)" : "scale(1)",
                    }}
                >
                    <div
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: isSelected ? opt.color + "25" : isDark ? "#1E293B" : "#F1F5F9",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: isSelected ? opt.color : isDark ? "#475569" : "#94A3B8",
                            fontSize: 14,
                            flexShrink: 0,
                        }}
                    >
                        {opt.icon}
                    </div>
                    <div>
                        <Text
                            style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: isSelected ? opt.color : isDark ? "#F1F5F9" : "#0F172A",
                                display: "block",
                                lineHeight: 1.2,
                            }}
                        >
                            {opt.label}
                        </Text>
                        <Text style={{ fontSize: 10, color: isDark ? "#64748B" : "#94A3B8" }}>
                            {opt.sub}
                        </Text>
                    </div>
                    {isSelected && (
                        <CheckCircleFilled
                            style={{ color: opt.color, marginLeft: "auto", fontSize: 14 }}
                        />
                    )}
                </div>
            );
        })}
    </div>
);

// ─────────────────────────── Section Header ───────────────────────────
const SectionHeader: React.FC<{
    step: number;
    title: string;
    sub: string;
    icon: React.ReactNode;
    accent: string;
    isDark: boolean;
}> = ({ step, title, sub, icon, accent, isDark }) => (
    <div
        style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 20,
            paddingBottom: 16,
            borderBottom: `1px solid ${isDark ? "#1E293B" : "#F1F5F9"}`,
        }}
    >
        <div
            style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: accent + "20",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: accent,
                fontSize: 16,
                flexShrink: 0,
                position: "relative",
            }}
        >
            {icon}
            <div
                style={{
                    position: "absolute",
                    top: -6,
                    right: -6,
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: accent,
                    color: "#fff",
                    fontSize: 9,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                {step}
            </div>
        </div>
        <div>
            <Text
                style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: isDark ? "#F1F5F9" : "#0F172A",
                    display: "block",
                    lineHeight: 1.2,
                }}
            >
                {title}
            </Text>
            <Text style={{ fontSize: 11, color: isDark ? "#64748B" : "#94A3B8" }}>{sub}</Text>
        </div>
    </div>
);

// ─────────────────────────── Santri Preview Card ───────────────────────────
const SantriPreview: React.FC<{
    nis: string | undefined;
    isDark: boolean;
}> = ({ nis, isDark }) => {
    const [info, setInfo] = React.useState<{
        nama: string; kelas: string; total_hafalan: string | null; foto_url: string | null;
    } | null>(null);

    React.useEffect(() => {
        if (!nis) { setInfo(null); return; }
        supabaseClient
            .from("santri")
            .select("nama, kelas, total_hafalan, foto_url")
            .eq("nis", nis)
            .maybeSingle()
            .then(({ data }) => setInfo(data));
    }, [nis]);

    if (!nis || !info) return null;

    const juzNum = parseTotalHafalan(info.total_hafalan);
    const pct = Math.round((juzNum / 30) * 100);

    return (
        <div
            style={{
                marginTop: 8,
                padding: "12px 14px",
                borderRadius: 10,
                background: isDark ? "#0F172A" : "#F0FDF4",
                border: `1px solid ${isDark ? "#134E26" : "#BBF7D0"}`,
                display: "flex",
                alignItems: "center",
                gap: 12,
            }}
        >
            <Avatar
                src={info.foto_url}
                size={40}
                icon={<UserOutlined />}
                style={{
                    background: "linear-gradient(135deg, #047857, #10B981)",
                    color: "#fff",
                    flexShrink: 0,
                }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 13, fontWeight: 700, color: isDark ? "#F1F5F9" : "#0F172A", display: "block" }}>
                    {info.nama}
                </Text>
                <Text style={{ fontSize: 11, color: isDark ? "#64748B" : "#64748B" }}>
                    Kelas {info.kelas} · {juzNum} Juz ({pct}%)
                </Text>
            </div>
            <div
                style={{
                    display: "flex",
                    gap: 2,
                    flexWrap: "nowrap",
                    overflow: "hidden",
                    maxWidth: 120,
                }}
            >
                {Array.from({ length: 10 }, (_, i) => {
                    const j = i + 1;
                    return (
                        <div
                            key={j}
                            style={{
                                width: 8,
                                height: 12,
                                borderRadius: 2,
                                background:
                                    j <= Math.round(juzNum / 3)
                                        ? "#047857"
                                        : isDark ? "#1E293B" : "#E2E8F0",
                                flexShrink: 0,
                            }}
                        />
                    );
                })}
            </div>
        </div>
    );
};

// ─────────────────────────── Main Component ───────────────────────────
export const HafalanCreate = () => {
    const [form] = Form.useForm();
    const { data: user } = useGetIdentity<{ id: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { token } = useToken();

    const hexLum = (hex: string) => {
        const c = hex.replace("#", "");
        if (c.length < 6) return 200;
        return .299 * parseInt(c.slice(0, 2), 16) + .587 * parseInt(c.slice(2, 4), 16) + .114 * parseInt(c.slice(4, 6), 16);
    };
    const isDark = hexLum(token.colorBgContainer) < 128;

    const [selectedSuratMaxAyat, setSelectedSuratMaxAyat] = useState<number>(286);
    const [currentTotalSource, setCurrentTotalSource] = useState<string | null>(null);
    const [absensiStatus, setAbsensiStatus] = useState<string>('HADIR');
    const [isSetter, setIsSetter] = useState<boolean>(true);
    const [submitting, setSubmitting] = useState(false);
    const [statusSetoran, setStatusSetoran] = useState<string>('LANCAR');
    const [manualSesiWaktu, setManualSesiWaktu] = useState<'PAGI' | 'SIANG' | null>(null);
    const [selectedSantriNis, setSelectedSantriNis] = useState<string | undefined>();
    const [selectedJuz, setSelectedJuz] = useState<number>(30);
    const [penyimakList, setPenyimakList] = useState<{ id: number; nama: string }[]>([]);

    const { mutate: updateSantri } = useUpdate();

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

    React.useEffect(() => {
        const nisFromUrl = searchParams.get("nis");
        if (nisFromUrl && !form.getFieldValue("santri_nis")) {
            form.setFieldValue("santri_nis", nisFromUrl);
            setSelectedSantriNis(nisFromUrl);
        }
    }, [form, searchParams]);

    useEffect(() => {
        supabaseClient
            .from("ref_penyimak")
            .select("id, nama")
            .eq("is_active", true)
            .order("nama")
            .then(({ data }) => {
                if (data) setPenyimakList(data);
            });
    }, []);

    React.useEffect(() => {
        if (!selectedSantriNis) { setCurrentTotalSource(null); return; }
        let mounted = true;
        supabaseClient
            .from("santri")
            .select("total_hafalan")
            .eq("nis", selectedSantriNis)
            .maybeSingle()
            .then(({ data }) => {
                if (!mounted) return;
                const total = data?.total_hafalan ?? "0";
                setCurrentTotalSource(String(total));
                form.setFieldValue("total_hafalan", parseTotalHafalan(total));
            });
        return () => { mounted = false; };
    }, [form, selectedSantriNis]);

    const handleSuratChange = (value: string) => {
        const surat = DATA_SURAT.find((s) => s.nama === value);
        if (surat) {
            setSelectedSuratMaxAyat(surat.ayat);
            form.setFieldValue("ayat_akhir", null);
            // Auto-set juz berdasarkan surat (default: juz pertama untuk surat lintas juz)
            const juz = getJuzFromSurat(value, null);
            if (juz) {
                form.setFieldValue("juz", juz);
                setSelectedJuz(juz);
            }
        }
    };

    const onFinishHandler = async (values: any) => {
        if (submitting) return;
        setSubmitting(true);
        try {
            // 1. Cari atau buat sesi hari ini
            const today = dayjs(values.tanggal).format("YYYY-MM-DD");
            const sesiWaktu = manualSesiWaktu || 'PAGI';

            const { data: sesiList } = await supabaseClient
                .from("tahfidz_sesi")
                .select("id")
                .eq("tanggal", today)
                .eq("kegiatan_id", "ZIYADAH")
                .eq("sesi", sesiWaktu)
                .eq("status", "OPEN")
                .limit(1);

            let sesi = sesiList && sesiList.length > 0 ? sesiList[0] : null;
            if (!sesi) {
                const { data: newSesi, error: sesiErr } = await supabaseClient
                    .from("tahfidz_sesi")
                    .insert({
                        kegiatan_id: "ZIYADAH",
                        tanggal: today,
                        sesi: sesiWaktu,
                        created_by: user?.id,
                    })
                    .select("id")
                    .single();
                if (sesiErr) throw sesiErr;
                sesi = newSesi;
            }

            // 2. Buat record absensi
            const { data: absensi, error: absErr } = await supabaseClient
                .from("tahfidz_absensi")
                .upsert({
                    sesi_id: sesi!.id,
                    santri_nis: values.santri_nis,
                    status: absensiStatus,
                    setoran: absensiStatus === 'HADIR' ? isSetter : false,
                    keterangan: absensiStatus !== 'HADIR' ? (values.keterangan_absensi || STATUS_LABEL[absensiStatus]) : null,
                    penyimak_id: absensiStatus === 'HADIR' ? (values.penyimak_id || user?.id) : null,
                    created_by: user?.id,
                }, {
                    onConflict: "sesi_id, santri_nis",
                    ignoreDuplicates: false,
                })
                .select("id")
                .single();
            if (absErr) throw absErr;

            // 3. Jika SETOR, upsert hafalan_tahfidz (hindari duplikat via unique absensi_id)
            if (absensiStatus === 'HADIR' && isSetter) {
                const { penyimak_id, keterangan_absensi, total_hafalan, alasan_tolak, ...hafalanValues } = values;
                const { error: hafError } = await supabaseClient
                    .from("hafalan_tahfidz")
                    .upsert({
                        ...hafalanValues,
                        absensi_id: absensi!.id,
                        status: "LANCAR",
                        status_setoran: statusSetoran,
                        alasan_tolak: statusSetoran === 'MENGULANG' ? (values.alasan_tolak || null) : null,
                        detail_hafalan: values.detail_hafalan || null,
                        penyimak: values.penyimak || null,
                    }, { onConflict: "absensi_id" });
                if (hafError) throw hafError;

                await logActivity({ user, action: "CREATE", resource: "hafalan", details: values });

                if (values.total_hafalan !== undefined && values.total_hafalan !== null) {
                    updateSantri({
                        resource: "santri",
                        id: values.santri_nis,
                        values: { total_hafalan: values.total_hafalan },
                        successNotification: () => ({
                            message: "Setoran & Absensi berhasil dicatat",
                            description: "Sukses",
                            type: "success",
                        }),
                    });
                }

                message.success("Setoran & Absensi berhasil dicatat");
                navigate("/hafalan");
            } else {
                message.success(`Absensi ${STATUS_LABEL[absensiStatus] || absensiStatus} berhasil dicatat`);
                navigate("/hafalan");
            }
        } catch (err: any) {
            message.error(err.message || "Gagal menyimpan data");
        } finally {
            setSubmitting(false);
        }
    };

    const labelStyle: React.CSSProperties = {
        fontSize: 12,
        fontWeight: 600,
        color: token.colorTextSecondary,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
    };

    return (
        <div style={{ background: token.colorBgLayout, minHeight: "100vh", padding: "20px 20px 80px" }}>

            {/* ── Page Header ── */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Button
                        icon={<ArrowLeftOutlined />}
                        onClick={() => navigate("/hafalan")}
                        style={{
                            background: "transparent",
                            border: `1px solid ${token.colorBorderSecondary}`,
                            color: token.colorTextSecondary,
                            borderRadius: 8,
                        }}
                    />
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 8,
                                    background: "linear-gradient(135deg, #047857, #10B981)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "#fff",
                                    fontSize: 14,
                                }}
                            >
                                <EditOutlined />
                            </div>
                            <Title level={4} style={{ margin: 0, color: token.colorText }}>
                                Input Setoran Baru
                            </Title>
                        </div>
                        <Text style={{ fontSize: 12, color: token.colorTextSecondary, marginLeft: 40 }}>
                            Catat setoran ziyadah santri tahfidz
                        </Text>
                    </div>
                </div>
            </div>

            <Form
                form={form}
                layout="vertical"
                onFinish={onFinishHandler}
                onValuesChange={(changedValues) => {
                    if ('santri_nis' in changedValues) {
                        setSelectedSantriNis(changedValues.santri_nis);
                    }
                }}
                initialValues={{
                    tanggal: dayjs(),
                    dicatat_oleh_id: user?.id,
                    predikat: "MUMTAZ",
                    status: "LANCAR",
                    juz: 30,
                }}
            >
                <Form.Item name="dicatat_oleh_id" hidden><Input /></Form.Item>
                <Form.Item name="status" hidden><Input /></Form.Item>

                {/* ── STATUS KEHADIRAN ── */}
                <div style={{
                    background: token.colorBgContainer,
                    border: `1px solid ${token.colorBorderSecondary}`,
                    borderRadius: 16, padding: "20px 24px",
                    marginBottom: 16,
                }}>
                    <SectionHeader
                        step={0} title="Status Kehadiran"
                        sub="Pilih status absensi santri sebelum setoran"
                        icon={<UserOutlined />} accent="#C9A84C" isDark={isDark}
                    />
                    <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                        {STATUS_ABSENSI.map(s => {
                            const isActive = absensiStatus === s.key;
                            return (
                                <div
                                    key={s.key} onClick={() => setAbsensiStatus(s.key)}
                                    style={{
                                        flex: 1, minWidth: 100, padding: "14px 16px", borderRadius: 12,
                                        cursor: "pointer", userSelect: "none", textAlign: "center",
                                        border: `2px solid ${isActive ? s.color : token.colorBorder}`,
                                        background: isActive ? `${s.color}15` : "transparent",
                                        transition: "all 0.15s",
                                        transform: isActive ? "scale(1.04)" : "scale(1)",
                                    }}
                                >
                                    <div style={{ fontSize: 28, marginBottom: 4 }}>{s.icon}</div>
                                    <div style={{
                                        fontSize: 13, fontWeight: 700,
                                        color: isActive ? s.color : token.colorText,
                                    }}>{s.label}</div>
                                </div>
                            );
                        })}
                    </div>

                    {absensiStatus === 'HADIR' && (
                        <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
                            <div
                                onClick={() => setIsSetter(true)}
                                style={{
                                    flex: 1, padding: "12px 16px", borderRadius: 10, cursor: "pointer",
                                    border: `2px solid ${isSetter ? '#047857' : token.colorBorder}`,
                                    background: isSetter ? 'rgba(4,120,87,0.08)' : 'transparent',
                                    textAlign: "center",
                                }}
                            >
                                <div style={{ fontSize: 24 }}>📖</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: isSetter ? '#047857' : token.colorText }}>
                                    SETOR
                                </div>
                                <div style={{ fontSize: 11, color: token.colorTextSecondary }}>
                                    Santri menyetorkan hafalan
                                </div>
                            </div>
                            <div
                                onClick={() => setIsSetter(false)}
                                style={{
                                    flex: 1, padding: "12px 16px", borderRadius: 10, cursor: "pointer",
                                    border: `2px solid ${!isSetter ? '#DC2626' : token.colorBorder}`,
                                    background: !isSetter ? 'rgba(220,38,38,0.06)' : 'transparent',
                                    textAlign: "center",
                                }}
                            >
                                <div style={{ fontSize: 24 }}>🚫</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: !isSetter ? '#DC2626' : token.colorText }}>
                                    TIDAK SETOR
                                </div>
                                <div style={{ fontSize: 11, color: token.colorTextSecondary }}>
                                    Santri hadir tapi tidak setor
                                </div>
                            </div>
                        </div>
                    )}

                    {absensiStatus !== 'HADIR' && (
                        <div style={{ marginTop: 12 }}>
                            <div style={{
                                padding: "10px 14px", borderRadius: 8, marginBottom: 12,
                                background: isDark ? "#1E293B" : "#FFF7ED",
                                border: `1px solid ${isDark ? "#334155" : "#FED7AA"}`,
                                fontSize: 12, color: token.colorTextSecondary,
                            }}>
                                Status "{STATUS_LABEL[absensiStatus]}" — absensi tanpa data setoran.
                            </div>
                            {absensiStatus === 'GHAIB' && (
                                <Form.Item
                                    name="keterangan_absensi"
                                    label={<span style={labelStyle}>Alasan Ghaib</span>}
                                    rules={[{ required: true, message: "Harap isi alasan ghaib" }]}
                                    style={{ marginBottom: 0 }}
                                >
                                    <Input.TextArea
                                        rows={2}
                                        placeholder="Contoh: pulang kampung, sakit, izin keluarga..."
                                        style={{ borderRadius: 8, resize: "none", fontSize: 13 }}
                                    />
                                </Form.Item>
                            )}
                            {absensiStatus === 'SAKIT' && (
                                <Form.Item
                                    name="keterangan_absensi"
                                    label={<span style={labelStyle}>Keterangan Sakit</span>}
                                    style={{ marginBottom: 0 }}
                                >
                                    <Input.TextArea
                                        rows={2}
                                        placeholder="Opsional: jenis sakit, keterangan..."
                                        style={{ borderRadius: 8, resize: "none", fontSize: 13 }}
                                    />
                                </Form.Item>
                            )}
                        </div>
                    )}
                </div>

                <Row gutter={[20, 0]}>

                    {/* ── KOLOM KIRI ── */}
                    <Col xs={24} lg={10}>
                        <div
                            style={{
                                background: token.colorBgContainer,
                                border: `1px solid ${token.colorBorderSecondary}`,
                                borderRadius: 16,
                                padding: "24px",
                                marginBottom: 16,
                            }}
                        >
                            <SectionHeader
                                step={1}
                                title="Identitas Santri"
                                sub="Pilih santri & waktu setoran"
                                icon={<UserOutlined />}
                                accent="#2563EB"
                                isDark={isDark}
                            />

                            <Form.Item
                                label={<span style={labelStyle}>Nama Santri</span>}
                                name="santri_nis"
                                rules={[{ required: true, message: "Pilih santri terlebih dahulu" }]}
                                style={{ marginBottom: 16 }}
                            >
                                <Select
                                    {...santriSelectProps}
                                    showSearch
                                    placeholder="Cari nama atau NIS santri..."
                                    style={{ borderRadius: 8 }}
                                    size="large"
                                />
                            </Form.Item>

                            {/* Preview Card Santri */}
                            <SantriPreview nis={selectedSantriNis} isDark={isDark} />

                            <Divider style={{ borderColor: isDark ? "#1E293B" : "#F1F5F9", margin: "20px 0" }} />

                            <Form.Item
                                label={<span style={labelStyle}>Waktu Setoran</span>}
                                name="tanggal"
                                rules={[{ required: true }]}
                                getValueProps={(value) => ({ value: value ? dayjs(value) : "" })}
                                style={{ marginBottom: 0 }}
                            >
                                <DatePicker
                                    showTime
                                    format="DD MMM YYYY HH:mm"
                                    style={{ width: "100%", borderRadius: 8 }}
                                    size="large"
                                    suffixIcon={<CalendarOutlined style={{ color: token.colorTextSecondary }} />}
                                />
                            </Form.Item>

                            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
                                <Text style={{ ...labelStyle, margin: 0, whiteSpace: "nowrap" }}>Sesi</Text>
                                <Segmented
                                    value={manualSesiWaktu || 'PAGI'}
                                    onChange={(v) => setManualSesiWaktu(v as 'PAGI')}
                                    options={[
                                        { value: 'PAGI', label: <span>☀️ PAGI</span> },
                                    ]}
                                    size="small"
                                />
                                {manualSesiWaktu && (
                                    <Tag
                                        color="blue"
                                        style={{ cursor: "pointer", margin: 0, fontSize: 11 }}
                                        onClick={() => setManualSesiWaktu(null)}
                                    >
                                        Auto
                                    </Tag>
                                )}
                            </div>
                        </div>

                        {/* Total Hafalan Card */}
                        <div
                            style={{
                                background: token.colorBgContainer,
                                border: `1px solid ${token.colorBorderSecondary}`,
                                borderRadius: 16,
                                padding: "24px",
                            }}
                        >
                            <SectionHeader
                                step={3}
                                title="Total Capaian Hafalan"
                                sub="Update total juz yang sudah dihafal"
                                icon={<ReadOutlined />}
                                accent="#7C3AED"
                                isDark={isDark}
                            />

                            <Form.Item
                                name="total_hafalan"
                                rules={[{ required: true, message: "Harap isi total juz hafalan" }]}
                                style={{ marginBottom: 8 }}
                            >
                                <InputNumber
                                    min={0}
                                    max={30}
                                    step={1}
                                    precision={0}
                                    size="large"
                                    style={{ width: "100%", borderRadius: 8 }}
                                    placeholder="0"
                                    addonAfter={
                                        <Text style={{ color: token.colorTextSecondary, fontSize: 12 }}>/ 30 Juz</Text>
                                    }
                                    addonBefore={<ReadOutlined style={{ color: "#7C3AED" }} />}
                                />
                            </Form.Item>

                            {currentTotalSource && (
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "flex-start",
                                        gap: 6,
                                        padding: "8px 10px",
                                        borderRadius: 8,
                                        background: isDark ? "#1E3A5F" : "#EFF6FF",
                                        border: `1px solid ${isDark ? "#1E40AF50" : "#BFDBFE"}`,
                                    }}
                                >
                                    <InfoCircleOutlined
                                        style={{ color: "#2563EB", fontSize: 12, marginTop: 1, flexShrink: 0 }}
                                    />
                                    <Text style={{ fontSize: 11, color: isDark ? "#93C5FD" : "#1D4ED8", lineHeight: 1.5 }}>
                                        Data sebelumnya: <strong>{currentTotalSource} Juz</strong>. Ubah hanya jika total capaian memang berubah hari ini.
                                    </Text>
                                </div>
                            )}
                        </div>

                        {/* Peta Hafalan Inline */}
                        <div
                            style={{
                                background: token.colorBgContainer,
                                border: `1px solid ${token.colorBorderSecondary}`,
                                borderRadius: 16,
                                padding: "20px",
                                marginTop: 16,
                            }}
                        >
                            <div style={{ ...labelStyle, marginBottom: 10 }}>
                                Peta Hafalan (Preview)
                                <Text style={{ fontSize: 10, color: token.colorTextSecondary, fontWeight: 400, marginLeft: 6, textTransform: "none" }}>
                                    — data dari DATABASE, klik ✏️ untuk koreksi
                                </Text>
                            </div>
                            <PetaHafalanInline
                                santriNis={selectedSantriNis}
                                isDark={isDark}
                                value={selectedJuz}
                                onChange={() => {
                                    // Juz sekarang ditentukan otomatis dari surat + ayat_awal
                                    // Grid hanya untuk visual, tidak override form juz
                                }}
                            />
                            {/* Hidden form field for juz */}
                            <Form.Item name="juz" hidden><InputNumber /></Form.Item>
                        </div>
                    </Col>

                    {/* ── KOLOM KANAN ── */}
                    <Col xs={24} lg={14}>
                    {absensiStatus === 'HADIR' && isSetter ? (
                        <div
                            style={{
                                background: token.colorBgContainer,
                                border: `1px solid ${token.colorBorderSecondary}`,
                                borderRadius: 16,
                                padding: "24px",
                                marginBottom: 16,
                            }}
                        >
                            <SectionHeader
                                step={2}
                                title="Detail Hafalan (Ziyadah)"
                                sub="Surat, ayat, dan posisi juz"
                                icon={<BookOutlined />}
                                accent="#047857"
                                isDark={isDark}
                            />

                            <Form.Item
                                label={<span style={labelStyle}>Nama Surat</span>}
                                name="surat"
                                rules={[{ required: true, message: "Pilih surat yang disetorkan" }]}
                                style={{ marginBottom: 16 }}
                            >
                                <Select
                                    showSearch
                                    placeholder="Cari nama surat..."
                                    onChange={handleSuratChange}
                                    size="large"
                                    style={{ borderRadius: 8 }}
                                    options={DATA_SURAT.map((s) => ({
                                        label: `${s.nomor}. ${s.nama} (${s.ayat} ayat)`,
                                        value: s.nama,
                                    }))}
                                    filterOption={(input, option) =>
                                        (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                                    }
                                    optionRender={(option) => (
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <div
                                                style={{
                                                    width: 24,
                                                    height: 24,
                                                    borderRadius: 6,
                                                    background: isDark ? "#1E293B" : "#F1F5F9",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    fontSize: 9,
                                                    fontWeight: 700,
                                                    color: token.colorTextSecondary,
                                                    flexShrink: 0,
                                                }}
                                            >
                                                {(option.data as any)?.label?.split(".")[0]}
                                            </div>
                                            <span>{option.label}</span>
                                        </div>
                                    )}
                                />
                            </Form.Item>

                            {/* Ayat Range */}
                            <Row gutter={12} style={{ marginBottom: 16 }}>
                                <Col span={12}>
                                    <Form.Item
                                        label={<span style={labelStyle}>Ayat Awal</span>}
                                        name="ayat_awal"
                                        rules={[{ required: true, message: "Isi ayat awal" }]}
                                        style={{ marginBottom: 0 }}
                                    >
                                        <InputNumber
                                            min={1}
                                            max={selectedSuratMaxAyat}
                                            size="large"
                                            style={{ width: "100%", borderRadius: 8 }}
                                            placeholder="1"
                                            onChange={(val) => {
                                                const surat = form.getFieldValue("surat");
                                                if (surat && val) {
                                                    const juz = getJuzFromSurat(surat, val);
                                                    if (juz) {
                                                        form.setFieldValue("juz", juz);
                                                        setSelectedJuz(juz);
                                                    }
                                                }
                                            }}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item
                                        label={<span style={labelStyle}>Ayat Akhir</span>}
                                        name="ayat_akhir"
                                        rules={[{ required: true, message: "Isi ayat akhir" }]}
                                        style={{ marginBottom: 0 }}
                                    >
                                        <InputNumber
                                            min={1}
                                            max={selectedSuratMaxAyat}
                                            size="large"
                                            style={{ width: "100%", borderRadius: 8 }}
                                            placeholder={String(selectedSuratMaxAyat)}
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Divider style={{ borderColor: isDark ? "#1E293B" : "#F1F5F9", margin: "16px 0" }} />

                            {/* Predikat + Catatan */}
                            <div
                                style={{
                                    background: token.colorBgContainer,
                                    border: `1px solid ${token.colorBorderSecondary}`,
                                    borderRadius: 16,
                                    padding: "24px",
                                }}
                            >
                                <SectionHeader
                                    step={4}
                                    title="Penilaian Musyrif"
                                    sub="Kualitas hafalan & catatan tambahan"
                                    icon={<StarFilled />}
                                    accent="#D97706"
                                    isDark={isDark}
                                />

                                <Form.Item
                                    label={<span style={labelStyle}>Kualitas Hafalan (Predikat)</span>}
                                    name="predikat"
                                    style={{ marginBottom: 16 }}
                                >
                                    <PredikatSelector isDark={isDark} />
                                </Form.Item>

                                {/* Status Setoran */}
                                {absensiStatus === 'HADIR' && isSetter && (
                                    <div style={{ marginBottom: 16 }}>
                                        <div style={labelStyle}>Status Setoran</div>
                                        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                                            <Tag
                                                color="success"
                                                onClick={() => setStatusSetoran('LANCAR')}
                                                style={{
                                                    padding: "6px 16px", borderRadius: 8, cursor: "pointer",
                                                    fontSize: 12, fontWeight: statusSetoran === 'LANCAR' ? 700 : 400,
                                                    border: `1.5px solid ${statusSetoran === 'LANCAR' ? '#16A34A' : token.colorBorder}`,
                                                    background: statusSetoran === 'LANCAR' ? 'rgba(22,163,74,0.10)' : 'transparent',
                                                    color: statusSetoran === 'LANCAR' ? '#16A34A' : token.colorTextTertiary,
                                                    margin: 0, transition: "all 0.12s",
                                                }}
                                            >
                                                ✅ Lancar
                                            </Tag>
                                            <Tag
                                                color="warning"
                                                onClick={() => setStatusSetoran('MENGULANG')}
                                                style={{
                                                    padding: "6px 16px", borderRadius: 8, cursor: "pointer",
                                                    fontSize: 12, fontWeight: statusSetoran === 'MENGULANG' ? 700 : 400,
                                                    border: `1.5px solid ${statusSetoran === 'MENGULANG' ? '#D97706' : token.colorBorder}`,
                                                    background: statusSetoran === 'MENGULANG' ? 'rgba(217,119,6,0.10)' : 'transparent',
                                                    color: statusSetoran === 'MENGULANG' ? '#D97706' : token.colorTextTertiary,
                                                    margin: 0, transition: "all 0.12s",
                                                }}
                                            >
                                                🔄 Mengulang
                                            </Tag>
                                        </div>
                                        {statusSetoran === 'MENGULANG' && (
                                            <Form.Item
                                                name="alasan_tolak"
                                                rules={[{ required: true, message: "Harap isi alasan perlu mengulang" }]}
                                                style={{ marginTop: 8, marginBottom: 0 }}
                                            >
                                                <Input.TextArea
                                                    rows={2}
                                                    placeholder="Alasan setoran perlu diulang (misal: tajwid belum sesuai, makhraj kurang tepat)..."
                                                    style={{ borderRadius: 8, resize: "none", fontSize: 13 }}
                                                />
                                            </Form.Item>
                                        )}
                                    </div>
                                )}

                                <Form.Item
                                    label={<span style={labelStyle}>Catatan Musyrif</span>}
                                    name="catatan"
                                    style={{ marginBottom: 12 }}
                                >
                                    <Input.TextArea
                                    rows={3}
                                    placeholder="Tambahkan catatan evaluasi, tajwid yang perlu diperbaiki, atau pencapaian khusus..."
                                    style={{
                                        borderRadius: 8,
                                        resize: "none",
                                        fontSize: 13,
                                    }}
                                />
                            </Form.Item>

                            <Form.Item
                                label={<span style={labelStyle}>Detail Hafalan (Cakupan Ayat)</span>}
                                name="detail_hafalan"
                                style={{ marginBottom: 12 }}
                            >
                                <Input.TextArea
                                    rows={2}
                                    placeholder="Contoh: سورة آل عمران — الآيات ١ إلى ١٠"
                                    style={{ borderRadius: 8, resize: "none", fontSize: 13 }}
                                />
                            </Form.Item>

                            <Form.Item
                                label={<span style={labelStyle}>Penyimak</span>}
                                name="penyimak"
                                style={{ marginBottom: 0 }}
                            >
                                <Select
                                    placeholder="Pilih penyimak"
                                    allowClear
                                    showSearch
                                    size="large"
                                    style={{ borderRadius: 8 }}
                                    filterOption={(input, option) =>
                                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                    }
                                    options={penyimakList.map(p => ({
                                        label: p.nama,
                                        value: p.nama,
                                    }))}
                                />
                            </Form.Item>
                        </div>
                        </div>
                    ) : (
                        <div style={{
                            background: token.colorBgContainer,
                            border: `1px solid ${token.colorBorderSecondary}`,
                            borderRadius: 16, padding: "40px 24px",
                            textAlign: "center",
                        }}>
                            <div style={{ fontSize: 48, marginBottom: 12 }}>
                                {absensiStatus === 'HADIR' ? '🚫' : STATUS_ABSENSI.find(s => s.key === absensiStatus)?.icon || '📝'}
                            </div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: token.colorText, marginBottom: 4 }}>
                                {absensiStatus === 'HADIR' ? 'Tidak Ada Setoran' : `${STATUS_LABEL[absensiStatus] || absensiStatus}`}
                            </div>
                            <div style={{ fontSize: 13, color: token.colorTextSecondary }}>
                                {absensiStatus === 'HADIR'
                                    ? 'Santri hadir tapi tidak menyetorkan hafalan. Hanya absensi yang dicatat.'
                                    : `Absensi dicatat sebagai "${STATUS_LABEL[absensiStatus]}". Tidak ada data hafalan.`}
                            </div>
                        </div>
                    )}
                    </Col>
                </Row>

                {/* ── Sticky Save Bar ── */}
                <div
                    style={{
                        position: "fixed",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        padding: "14px 24px",
                        background: isDark
                            ? "rgba(15,23,42,0.95)"
                            : "rgba(255,255,255,0.95)",
                        backdropFilter: "blur(12px)",
                        borderTop: `1px solid ${token.colorBorderSecondary}`,
                        display: "flex",
                        justifyContent: "flex-end",
                        alignItems: "center",
                        gap: 12,
                        zIndex: 100,
                    }}
                >
                    <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>
                        {absensiStatus === 'HADIR' && isSetter
                            ? 'Pastikan semua data setoran sudah benar'
                            : 'Absensi akan dicatat tanpa data setoran'}
                    </Text>
                    <Button
                        onClick={() => navigate("/hafalan")}
                        style={{
                            borderRadius: 8,
                            border: `1px solid ${token.colorBorderSecondary}`,
                            color: token.colorTextSecondary,
                            background: "transparent",
                        }}
                    >
                        Batal
                    </Button>
                    <Button
                        htmlType="submit"
                        type="primary"
                        size="large"
                        icon={<CheckCircleFilled />}
                        loading={submitting}
                        style={{
                            background: absensiStatus === 'HADIR' && isSetter
                                ? "linear-gradient(135deg, #047857, #10B981)"
                                : "linear-gradient(135deg, #C9A84C, #8B6E23)",
                            border: "none",
                            borderRadius: 8,
                            fontWeight: 700,
                            paddingLeft: 24,
                            paddingRight: 24,
                        }}
                    >
                        {absensiStatus === 'HADIR' && isSetter ? 'Simpan Setoran' : 'Simpan Absensi'}
                    </Button>
                </div>
            </Form>

            {/* ── Form style overrides ── */}
            <style>{`
                .ant-form-item-label > label {
                    height: auto !important;
                }
                .ant-input-lg, .ant-select-lg .ant-select-selector,
                .ant-picker-large, .ant-input-number-lg {
                    border-radius: 8px !important;
                    border-color: ${token.colorBorderSecondary} !important;
                    background: ${isDark ? "#0F172A" : "#FAFAFA"} !important;
                }
                .ant-input-number-lg:hover, .ant-select-lg .ant-select-selector:hover,
                .ant-picker-large:hover {
                    border-color: #047857 !important;
                }
                .ant-input-number-lg:focus-within, .ant-select-lg.ant-select-focused .ant-select-selector,
                .ant-picker-large.ant-picker-focused {
                    border-color: #047857 !important;
                    box-shadow: 0 0 0 2px rgba(4,120,87,0.15) !important;
                }
                .ant-input-textarea textarea {
                    border-color: ${token.colorBorderSecondary} !important;
                    background: ${isDark ? "#0F172A" : "#FAFAFA"} !important;
                }
                .ant-input-textarea textarea:focus {
                    border-color: #047857 !important;
                    box-shadow: 0 0 0 2px rgba(4,120,87,0.15) !important;
                }
            `}</style>
        </div>
    );
};
