import React, { useState, useEffect } from "react";
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
} from "antd";
import dayjs from "dayjs";
import { ISantri, IProfile } from "../../types";
import { useGetIdentity, useUpdate } from "@refinedev/core";
import { DATA_SURAT } from "../../utility/quran-data";
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
} from "@ant-design/icons";

const { Text, Title } = Typography;
const { useToken } = theme;

// ─────────────────── Status Absensi ───────────────────
const STATUS_ABSENSI = [
  { key: 'HADIR',   label: 'Hadir',       icon: '✅', color: '#16A34A' },
  { key: 'SAKIT',   label: 'Sakit',       icon: '🤒', color: '#D97706' },
  { key: 'GHAIB',   label: 'Ghaib',       icon: '❌', color: '#DC2626' },
  { key: 'SEKOLAH', label: 'Sekolah',     icon: '🏫', color: '#2563EB' },
  { key: 'PULANG',  label: 'Pulang',      icon: '🏠', color: '#9333EA' },
];

const STATUS_LABEL: Record<string, string> = {
  HADIR: 'Hadir', SAKIT: 'Sakit', GHAIB: 'Ghaib', SEKOLAH: 'Sekolah', PULANG: 'Pulang',
};

// ─────────────────────────── Helpers ───────────────────────────
const parseTotalHafalan = (value?: string | number | null) => {
    if (value === null || value === undefined || value === "") return 0;
    const match = String(value).replace(",", ".").match(/\d+(\.\d+)?/);
    return match ? Number(match[0]) : 0;
};

// ─────────────────────────── Juz Visual Picker ───────────────────────────
const JuzPicker: React.FC<{
    value?: number;
    onChange?: (v: number) => void;
    isDark: boolean;
    completedJuz?: number;
}> = ({ value, onChange, isDark, completedJuz = 0 }) => {
    return (
        <div>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(10, 1fr)",
                    gap: 5,
                }}
            >
                {Array.from({ length: 30 }, (_, i) => {
                    const juzNum = i + 1;
                    const isSelected = juzNum === value;
                    const isDone = juzNum <= completedJuz;
                    return (
                        <Tooltip key={juzNum} title={`Juz ${juzNum}`}>
                            <div
                                onClick={() => onChange?.(juzNum)}
                                style={{
                                    aspectRatio: "1",
                                    borderRadius: 6,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 11,
                                    fontWeight: isSelected ? 700 : 500,
                                    cursor: "pointer",
                                    transition: "all 0.15s",
                                    background: isSelected
                                        ? "linear-gradient(135deg, #D97706, #F59E0B)"
                                        : isDone
                                        ? isDark ? "#022C22" : "#D1FAE5"
                                        : isDark ? "#1E293B" : "#F1F5F9",
                                    color: isSelected
                                        ? "#fff"
                                        : isDone
                                        ? "#047857"
                                        : isDark ? "#475569" : "#94A3B8",
                                    border: isSelected
                                        ? "2px solid #F59E0B"
                                        : `1px solid ${isDark ? "#334155" : "#E2E8F0"}`,
                                    boxShadow: isSelected ? "0 2px 8px rgba(217,119,6,0.4)" : "none",
                                    transform: isSelected ? "scale(1.12)" : "scale(1)",
                                }}
                            >
                                {juzNum}
                            </div>
                        </Tooltip>
                    );
                })}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 8, alignItems: "center" }}>
                {[
                    { color: "#D97706", label: "Pilihan saat ini", border: false },
                    { color: isDark ? "#022C22" : "#D1FAE5", label: "Sudah hafal", border: false },
                    { color: isDark ? "#1E293B" : "#F1F5F9", label: "Belum", border: true },
                ].map(({ color, label, border }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <div
                            style={{
                                width: 12,
                                height: 12,
                                borderRadius: 3,
                                background: color,
                                border: border ? `1px solid ${isDark ? "#334155" : "#CBD5E1"}` : "none",
                            }}
                        />
                        <Text style={{ fontSize: 10, color: isDark ? "#64748B" : "#94A3B8" }}>{label}</Text>
                    </div>
                ))}
            </div>
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
    const [penyimakOptions, setPenyimakOptions] = useState<IProfile[]>([]);
    const [selectedSantriNis, setSelectedSantriNis] = useState<string | undefined>();

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

    // Load daftar penyimak (dewan/kesantrian dengan akses TAHFIDZ)
    useEffect(() => {
        supabaseClient
            .from("profiles")
            .select("id, full_name")
            .in("role", ["dewan", "kesantrian"])
            .or("akses_jurusan.eq.ALL,akses_jurusan.ilike.%TAHFIDZ%")
            .order("full_name")
            .then(({ data }) => {
                if (data) setPenyimakOptions(data as IProfile[]);
            });
    }, []);

    React.useEffect(() => {
        if (!selectedSantriNis) { setCurrentTotalSource(null); return; }
        let mounted = true;
        supabaseClient
            .from("santri")
            .select("total_hafalan, penyimak_mode, pembimbing")
            .eq("nis", selectedSantriNis)
            .maybeSingle()
            .then(({ data }) => {
                if (!mounted) return;
                const total = data?.total_hafalan ?? "0";
                setCurrentTotalSource(String(total));
                form.setFieldValue("total_hafalan", parseTotalHafalan(total));

                // Auto-fill penyimak based on mode
                const mode = data?.penyimak_mode || 'admin';
                if (mode === 'admin' && user?.id) {
                    form.setFieldValue("penyimak_id", user.id);
                } else if (mode === 'pembimbing' && data?.pembimbing) {
                    const match = penyimakOptions.find(p =>
                        p.full_name?.toLowerCase().includes(data!.pembimbing!.toLowerCase())
                    );
                    if (match) form.setFieldValue("penyimak_id", match.id);
                    else form.setFieldValue("penyimak_id", user?.id || undefined);
                }
            });
        return () => { mounted = false; };
    }, [form, selectedSantriNis, user, penyimakOptions]);

    const handleSuratChange = (value: string) => {
        const surat = DATA_SURAT.find((s) => s.nama === value);
        if (surat) {
            setSelectedSuratMaxAyat(surat.ayat);
            form.setFieldValue("ayat_akhir", null);
        }
    };

    const onFinishHandler = async (values: any) => {
        if (submitting) return;
        setSubmitting(true);
        try {
            // 1. Cari atau buat sesi hari ini
            const today = dayjs(values.tanggal).format("YYYY-MM-DD");
            const sesiWaktu = manualSesiWaktu || (dayjs(values.tanggal).hour() < 12 ? 'PAGI' : 'SIANG');

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

                            {absensiStatus === 'HADIR' && (
                                <>
                                    <Divider style={{ borderColor: isDark ? "#1E293B" : "#F1F5F9", margin: "16px 0" }} />
                                    <Form.Item
                                        label={
                                            <span style={labelStyle}>
                                                <SafetyCertificateOutlined style={{ marginRight: 4 }} />
                                                Penyimak
                                            </span>
                                        }
                                        name="penyimak_id"
                                        style={{ marginBottom: 0 }}
                                    >
                                        <Select
                                            placeholder="Pilih penyimak (ustadz penguji)"
                                            allowClear
                                            showSearch
                                            size="large"
                                            style={{ borderRadius: 8 }}
                                            filterOption={(input, option) =>
                                                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                            }
                                            options={penyimakOptions.map(p => ({
                                                label: p.full_name || p.id,
                                                value: p.id,
                                            }))}
                                        />
                                    </Form.Item>
                                </>
                            )}

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
                                    value={manualSesiWaktu || (dayjs().hour() < 12 ? 'PAGI' : 'SIANG')}
                                    onChange={(v) => setManualSesiWaktu(v as 'PAGI' | 'SIANG')}
                                    options={[
                                        { value: 'PAGI', label: <span>☀️ PAGI</span> },
                                        { value: 'SIANG', label: <span>🌤️ SIANG</span> },
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

                            {/* Juz Picker */}
                            <Form.Item
                                label={
                                    <span style={labelStyle}>
                                        Posisi Juz Saat Ini
                                        <Text style={{ fontSize: 10, color: token.colorTextSecondary, fontWeight: 400, marginLeft: 6, textTransform: "none" }}>
                                            — santri sedang di juz mana?
                                        </Text>
                                    </span>
                                }
                                name="juz"
                                style={{ marginBottom: 0 }}
                            >
                                <JuzPicker
                                    isDark={isDark}
                                    completedJuz={parseTotalHafalan(currentTotalSource)}
                                />
                            </Form.Item>

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
                                    style={{ marginBottom: 0 }}
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
