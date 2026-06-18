import React, { useState, useMemo, useCallback } from "react";
import {
    UserOutlined, LockOutlined, MailOutlined, SafetyCertificateOutlined,
    ManOutlined, BookOutlined, ArrowLeftOutlined, CheckCircleOutlined,
    CrownOutlined, ShopOutlined, TeamOutlined, ReadOutlined,
    DollarCircleOutlined, AuditOutlined, KeyOutlined, CheckOutlined,
    EyeInvisibleOutlined, EyeOutlined, ThunderboltOutlined, InfoCircleOutlined,
    SolutionOutlined
} from "@ant-design/icons";
import {
    message, Typography, Button, Space, theme, Tag, Form, Input, Select, Tooltip, Divider
} from "antd";
import { motion, AnimatePresence } from "framer-motion";
import { supabaseClient } from "../../utility/supabaseClient";
import { useNavigation, useGetIdentity } from "@refinedev/core";
import { logActivity } from "../../utility/logger";
import { IUserIdentity } from "../../types";

const { Text, Title } = Typography;

// ─── Motion Variants ──────────────────────────────────────────────────────────
const fadeUp = {
    hidden: { opacity: 0, y: 18 },
    visible: (i: number) => ({
        opacity: 1, y: 0,
        transition: { delay: i * 0.075, duration: 0.4, ease: [0.22, 1, 0.36, 1] as const }
    })
};

const slideSwap = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: "easeOut" as const } },
    exit:   { opacity: 0, y: -8, transition: { duration: 0.18 } }
};

// ─── Role Config — colors via Ant Design semantic token keys ─────────────────
interface RoleConfig {
    value: string;
    label: string;
    icon: React.ReactNode;
    description: string;
    permissions: string[];
    bgKey: string;         // token key for background
    borderKey: string;     // token key for border
    iconColorKey: string;  // token key for icon/text color
    badge?: string;
}

const ROLES: RoleConfig[] = [
    {
        value: "super_admin",
        label: "Super Admin",
        icon: <CrownOutlined />,
        description: "Akses penuh ke seluruh konfigurasi sistem dan manajemen pengguna.",
        permissions: ["Manajemen Admin", "Konfigurasi Sistem", "Audit Log", "Semua Modul"],
        bgKey: "colorErrorBg",
        borderKey: "colorErrorBorder",
        iconColorKey: "colorError",
        badge: "Tertinggi",
    },
    {
        value: "rois",
        label: "Rois / Kepala",
        icon: <SolutionOutlined />,
        description: "Kepala operasional dengan akses monitoring dan persetujuan menyeluruh.",
        permissions: ["Laporan & Analitik", "Monitoring Santri", "Persetujuan Keuangan"],
        bgKey: "colorWarningBg",
        borderKey: "colorWarningBorder",
        iconColorKey: "colorWarning",
    },
    {
        value: "bendahara",
        label: "Bendahara",
        icon: <DollarCircleOutlined />,
        description: "Kelola keuangan, pembayaran SPP, dan pelaporan keuangan santri.",
        permissions: ["Pembayaran SPP", "Laporan Keuangan", "Tagihan & Cicilan"],
        bgKey: "colorSuccessBg",
        borderKey: "colorSuccessBorder",
        iconColorKey: "colorSuccess",
    },
    {
        value: "kesantrian",
        label: "Kesantrian",
        icon: <TeamOutlined />,
        description: "Urus absensi, perizinan, dan pengembangan karakter santri harian.",
        permissions: ["Absensi Harian", "Data Perizinan", "Rekap Kehadiran"],
        bgKey: "colorPrimaryBg",
        borderKey: "colorPrimaryBorder",
        iconColorKey: "colorPrimary",
    },
    {
        value: "kantin",
        label: "Kantin",
        icon: <ShopOutlined />,
        description: "Manajemen transaksi kantin, saldo, dan riwayat belanja santri.",
        permissions: ["Transaksi Kantin", "Top-up Saldo", "Laporan Penjualan"],
        bgKey: "colorInfoBg",
        borderKey: "colorInfoBorder",
        iconColorKey: "colorInfo",
    },
    {
        value: "dewan",
        label: "Dewan Guru",
        icon: <ReadOutlined />,
        description: "Akses modul akademik, nilai, dan informasi kurikulum pesantren.",
        permissions: ["Data Akademik", "Input Nilai", "Jadwal & Kurikulum"],
        bgKey: "colorFillSecondary",
        borderKey: "colorBorderSecondary",
        iconColorKey: "colorTextSecondary",
    },
];

const GENDER_OPTIONS = [
    { label: "Seluruh Santri (Putra & Putri)", value: "ALL" },
    { label: "Khusus Putra", value: "L" },
    { label: "Khusus Putri", value: "P" },
];

const JURUSAN_OPTIONS = [
    { label: "Semua Takhasus", value: "ALL" },
    { label: "Tahfidz", value: "TAHFIDZ" },
    { label: "Kitab", value: "KITAB" },
];

// ─── Password Strength Utility ────────────────────────────────────────────────
function getPasswordStrength(pwd: string): { score: number; label: string; colorKey: string } {
    if (!pwd) return { score: 0, label: "", colorKey: "colorFillSecondary" };
    let score = 0;
    if (pwd.length >= 8)  score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 1) return { score: 1, label: "Lemah",        colorKey: "colorError" };
    if (score === 2) return { score: 2, label: "Cukup",        colorKey: "colorWarning" };
    if (score === 3) return { score: 3, label: "Baik",         colorKey: "colorInfo" };
    if (score === 4) return { score: 4, label: "Kuat",         colorKey: "colorSuccess" };
    return              { score: 5, label: "Sangat Kuat",  colorKey: "colorSuccess" };
}

function getInitials(name: string): string {
    return name.trim().split(/\s+/).map(w => w[0] ?? "").join("").toUpperCase().slice(0, 2) || "?";
}

// ─── Section Header ───────────────────────────────────────────────────────────
const SectionHeader: React.FC<{ icon: React.ReactNode; label: string; token: any }> = ({ icon, label, token }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: token.colorPrimaryBg,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: token.colorPrimary, fontSize: 14,
        }}>
            {icon}
        </div>
        <Text style={{ fontSize: 11, fontWeight: 700, color: token.colorTextDescription, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {label}
        </Text>
        <div style={{ flex: 1, height: 1, background: token.colorBorderSecondary, marginLeft: 4 }} />
    </div>
);

// ─── Role Card ────────────────────────────────────────────────────────────────
const RoleCard: React.FC<{
    role: RoleConfig; selected: boolean; onClick: () => void; token: any;
}> = ({ role, selected, onClick, token }) => {
    const bg          = (token as any)[role.bgKey];
    const border      = (token as any)[role.borderKey];
    const iconColor   = (token as any)[role.iconColorKey];

    return (
        <motion.div
            whileHover={{ y: -2, transition: { duration: 0.15 } }}
            whileTap={{ scale: 0.97 }}
            onClick={onClick}
            style={{
                padding: "14px 16px",
                borderRadius: 12,
                border: `1.5px solid ${selected ? border : token.colorBorderSecondary}`,
                background: selected ? bg : token.colorBgContainer,
                cursor: "pointer",
                position: "relative",
                transition: "all 0.2s ease",
                boxShadow: selected ? `0 0 0 3px ${border}55` : "none",
            }}
        >
            {/* Selected checkmark */}
            <AnimatePresence>
                {selected && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        style={{
                            position: "absolute", top: 8, right: 8,
                            width: 18, height: 18, borderRadius: "50%",
                            background: iconColor,
                            display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                    >
                        <CheckOutlined style={{ fontSize: 10, color: "#fff" }} />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Badge */}
            {role.badge && (
                <div style={{
                    position: "absolute", top: -8, left: 12,
                    fontSize: 9, fontWeight: 700,
                    background: iconColor, color: "#fff",
                    padding: "1px 8px", borderRadius: 10,
                    letterSpacing: "0.05em", textTransform: "uppercase"
                }}>
                    {role.badge}
                </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: selected ? `${iconColor}20` : token.colorFillAlter,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 17, color: selected ? iconColor : token.colorTextDescription,
                    transition: "all 0.2s",
                }}>
                    {role.icon}
                </div>
                <div>
                    <Text style={{
                        fontSize: 13, fontWeight: 700, lineHeight: 1.2, display: "block",
                        color: selected ? iconColor : token.colorText,
                    }}>
                        {role.label}
                    </Text>
                    <Text style={{ fontSize: 11, color: token.colorTextDescription, lineHeight: 1.3 }}>
                        {role.description.length > 48
                            ? role.description.slice(0, 48) + "…"
                            : role.description}
                    </Text>
                </div>
            </div>
        </motion.div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
interface AdminFormValues {
    email: string;
    password: string;
    fullName: string;
    role: string;
    aksesGender: string;
    aksesJurusan: string;
}

export const CreateAdminPage = () => {
    const { token } = theme.useToken();
    const [loading, setLoading] = useState(false);
    const [form] = Form.useForm<AdminFormValues>();
    const { push } = useNavigation();
    const { data: user } = useGetIdentity<IUserIdentity>();

    // Live field watch
    const [fullName,    setFullName]    = useState("");
    const [selectedRole, setSelectedRole] = useState<string | null>(null);
    const [password,    setPassword]    = useState("");
    const [aksesGender,  setAksesGender]  = useState("ALL");
    const [aksesJurusan, setAksesJurusan] = useState("ALL");

    const roleConfig = useMemo(
        () => ROLES.find(r => r.value === selectedRole) ?? null,
        [selectedRole]
    );

    const pwStrength = useMemo(() => getPasswordStrength(password), [password]);
    const initials   = useMemo(() => getInitials(fullName), [fullName]);

    const handleFinish = async (values: AdminFormValues) => {
        setLoading(true);
        try {
            const { data, error } = await supabaseClient.functions.invoke("create-admin-account", {
                body: values,
            });
            if (error || (data && !data.success)) {
                throw new Error(error?.message || data?.error || "Gagal membuat akun");
            }
            await logActivity({
                user,
                action: "CREATE",
                resource: "profiles",
                details: {
                    new_admin_name: values.fullName,
                    new_admin_email: values.email,
                    assigned_role: values.role,
                },
            });
            message.success({
                content: `✅ Akun ${values.fullName} berhasil dibuat!`,
                duration: 3,
            });
            form.resetFields();
            setSelectedRole(null);
            setFullName("");
            setPassword("");
            setTimeout(() => push("/admin-management"), 1500);
        } catch (err: Error | unknown) {
            message.error(err instanceof Error ? err.message : "Gagal membuat akun");
        } finally {
            setLoading(false);
        }
    };

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div style={{
            minHeight: "100vh",
            background: token.colorBgLayout,
            padding: "24px",
        }}>
            <div style={{ maxWidth: 1000, margin: "0 auto" }}>

                {/* ── Page Header ─────────────────────────────────────────── */}
                <motion.div variants={fadeUp} custom={0} initial="hidden" animate="visible"
                    style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}
                >
                    <div>
                        <Button
                            type="text"
                            size="small"
                            icon={<ArrowLeftOutlined />}
                            onClick={() => push("/admin-management")}
                            style={{
                                color: token.colorTextDescription,
                                padding: "0 4px", marginBottom: 8,
                                fontWeight: 500, display: "flex", alignItems: "center", gap: 4
                            }}
                        >
                            Kembali ke Daftar Admin
                        </Button>
                        <Title level={3} style={{ margin: 0, lineHeight: 1.1, fontWeight: 800 }}>
                            Registrasi Akun Admin
                        </Title>
                        <Text type="secondary" style={{ fontSize: 13 }}>
                            Tambah pengurus baru dan tetapkan hak akses berbasis peran
                        </Text>
                    </div>

                    {/* Icon badge */}
                    <div style={{
                        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                        background: token.colorPrimaryBg,
                        border: `1px solid ${token.colorPrimaryBorder}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 20, color: token.colorPrimary,
                    }}>
                        <SafetyCertificateOutlined />
                    </div>
                </motion.div>

                {/* ── Main Card ────────────────────────────────────────────── */}
                <motion.div variants={fadeUp} custom={1} initial="hidden" animate="visible">
                    <div style={{
                        display: "flex",
                        borderRadius: 20,
                        overflow: "hidden",
                        border: `1px solid ${token.colorBorderSecondary}`,
                        background: token.colorBgContainer,
                        boxShadow: `0 4px 24px ${token.colorFillSecondary}, 0 1px 3px ${token.colorFillSecondary}`,
                        minHeight: 640,
                    }}>

                        {/* ── LEFT PANEL: Dynamic Preview ─────────────────── */}
                        <div style={{
                            width: "38%",
                            flexShrink: 0,
                            background: token.colorPrimaryBg,
                            borderRight: `1px solid ${token.colorPrimaryBorder}`,
                            padding: "36px 28px",
                            display: "flex",
                            flexDirection: "column",
                            position: "relative",
                            overflow: "hidden",
                        }}>
                            {/* Decorative blobs — using token.colorPrimary with alpha */}
                            <div style={{
                                position: "absolute", top: -40, right: -40,
                                width: 140, height: 140, borderRadius: "50%",
                                background: token.colorPrimary, opacity: 0.06,
                                pointerEvents: "none",
                            }} />
                            <div style={{
                                position: "absolute", bottom: 60, left: -30,
                                width: 100, height: 100, borderRadius: "50%",
                                background: token.colorPrimary, opacity: 0.06,
                                pointerEvents: "none",
                            }} />

                            {/* Avatar Preview */}
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
                                <motion.div
                                    key={initials}
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ duration: 0.25 }}
                                    style={{
                                        width: 80, height: 80, borderRadius: "50%",
                                        background: selectedRole && roleConfig
                                            ? `${(token as any)[roleConfig.iconColorKey]}20`
                                            : token.colorFillSecondary,
                                        border: `3px solid ${selectedRole && roleConfig
                                            ? (token as any)[roleConfig.iconColorKey]
                                            : token.colorBorderSecondary}`,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 26, fontWeight: 800,
                                        color: selectedRole && roleConfig
                                            ? (token as any)[roleConfig.iconColorKey]
                                            : token.colorTextDisabled,
                                        transition: "border-color 0.3s, background 0.3s, color 0.3s",
                                        marginBottom: 12,
                                        position: "relative",
                                    }}
                                >
                                    {initials}
                                    {selectedRole && roleConfig && (
                                        <div style={{
                                            position: "absolute", bottom: 2, right: 2,
                                            width: 22, height: 22, borderRadius: "50%",
                                            background: (token as any)[roleConfig.iconColorKey],
                                            border: `2px solid ${token.colorPrimaryBg}`,
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            fontSize: 11, color: "#fff"
                                        }}>
                                            {roleConfig.icon}
                                        </div>
                                    )}
                                </motion.div>
                                <Text style={{
                                    fontWeight: 700, fontSize: 15, textAlign: "center",
                                    color: token.colorText,
                                    maxWidth: 180, wordBreak: "break-word"
                                }}>
                                    {fullName || <span style={{ color: token.colorTextDisabled, fontWeight: 400, fontSize: 13 }}>Nama lengkap admin</span>}
                                </Text>
                                {selectedRole && (
                                    <Tag
                                        style={{
                                            marginTop: 6, borderRadius: 20,
                                            background: `${(token as any)[roleConfig!.iconColorKey]}15`,
                                            border: `1px solid ${(token as any)[roleConfig!.borderKey]}`,
                                            color: (token as any)[roleConfig!.iconColorKey],
                                            fontSize: 11, fontWeight: 600
                                        }}
                                    >
                                        {roleConfig?.label}
                                    </Tag>
                                )}
                            </div>

                            <Divider style={{ margin: "0 0 20px", borderColor: token.colorPrimaryBorder }} />

                            {/* Dynamic Role Info */}
                            <AnimatePresence mode="wait">
                                {roleConfig ? (
                                    <motion.div key={selectedRole!} variants={slideSwap} initial="hidden" animate="visible" exit="exit">
                                        <Text style={{
                                            fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                                            textTransform: "uppercase", color: token.colorTextDescription,
                                            display: "block", marginBottom: 8
                                        }}>
                                            Hak Akses · {roleConfig.label}
                                        </Text>
                                        <Text style={{
                                            fontSize: 12, color: token.colorTextSecondary,
                                            lineHeight: 1.7, display: "block", marginBottom: 14
                                        }}>
                                            {roleConfig.description}
                                        </Text>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                            {roleConfig.permissions.map(perm => (
                                                <div key={perm} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                    <div style={{
                                                        width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                                                        background: `${(token as any)[roleConfig.iconColorKey]}18`,
                                                        display: "flex", alignItems: "center", justifyContent: "center",
                                                    }}>
                                                        <CheckOutlined style={{ fontSize: 9, color: (token as any)[roleConfig.iconColorKey] }} />
                                                    </div>
                                                    <Text style={{ fontSize: 12, color: token.colorText }}>{perm}</Text>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div key="empty" variants={slideSwap} initial="hidden" animate="visible" exit="exit">
                                        <Text style={{
                                            fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                                            textTransform: "uppercase", color: token.colorTextDescription,
                                            display: "block", marginBottom: 8
                                        }}>
                                            Role Based Access Control
                                        </Text>
                                        <Text style={{ fontSize: 12, color: token.colorTextDescription, lineHeight: 1.7 }}>
                                            Sistem ini menggunakan RBAC untuk memastikan setiap pengurus hanya mengakses data sesuai tanggung jawabnya.
                                        </Text>
                                        <Text style={{
                                            fontSize: 12, color: token.colorTextDescription,
                                            marginTop: 10, display: "block", lineHeight: 1.7,
                                        }}>
                                            Pilih jabatan struktural di formulir untuk melihat ringkasan akses yang akan diberikan.
                                        </Text>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Access scope summary */}
                            <AnimatePresence>
                                {(aksesGender !== "ALL" || aksesJurusan !== "ALL") && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        style={{ marginTop: 18 }}
                                    >
                                        <Divider style={{ margin: "0 0 14px", borderColor: token.colorPrimaryBorder }} />
                                        <Text style={{
                                            fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                                            textTransform: "uppercase", color: token.colorTextDescription,
                                            display: "block", marginBottom: 8
                                        }}>
                                            Batasan Akses Data
                                        </Text>
                                        <Space size={6} wrap>
                                            {aksesGender !== "ALL" && (
                                                <Tag color="blue" style={{ fontSize: 11, borderRadius: 6 }}>
                                                    {aksesGender === "L" ? "Putra saja" : "Putri saja"}
                                                </Tag>
                                            )}
                                            {aksesJurusan !== "ALL" && (
                                                <Tag color="purple" style={{ fontSize: 11, borderRadius: 6 }}>
                                                    {aksesJurusan}
                                                </Tag>
                                            )}
                                        </Space>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Audit notice */}
                            <div style={{ marginTop: "auto", paddingTop: 20 }}>
                                <div style={{
                                    display: "flex", gap: 8, alignItems: "flex-start",
                                    padding: "10px 12px", borderRadius: 10,
                                    background: `${token.colorPrimary}10`,
                                    border: `1px solid ${token.colorPrimaryBorder}`,
                                }}>
                                    <AuditOutlined style={{ color: token.colorPrimary, fontSize: 13, marginTop: 1, flexShrink: 0 }} />
                                    <Text style={{ fontSize: 11, color: token.colorTextDescription, lineHeight: 1.5 }}>
                                        Setiap aktivitas admin tercatat otomatis dalam sistem audit log untuk keamanan dan integritas data pesantren.
                                    </Text>
                                </div>
                            </div>
                        </div>

                        {/* ── RIGHT PANEL: Form ────────────────────────────── */}
                        <div style={{ flex: 1, padding: "36px 36px 32px", overflowY: "auto" }}>
                            <Form
                                form={form}
                                layout="vertical"
                                onFinish={handleFinish}
                                requiredMark={false}
                                initialValues={{ aksesGender: "ALL", aksesJurusan: "ALL" }}
                            >
                                {/* ── Section 1: Kredensial ──────────────── */}
                                <motion.div variants={fadeUp} custom={2} initial="hidden" animate="visible">
                                    <SectionHeader icon={<KeyOutlined />} label="Kredensial Login" token={token} />
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
                                        <Form.Item
                                            name="email"
                                            label={<Text style={{ fontSize: 13, fontWeight: 600 }}>Email</Text>}
                                            rules={[
                                                { required: true, message: "Email wajib diisi" },
                                                { type: "email", message: "Format email tidak valid" },
                                            ]}
                                        >
                                            <Input
                                                prefix={<MailOutlined style={{ color: token.colorTextDisabled }} />}
                                                placeholder="ustadz@alhasanah.id"
                                                size="large"
                                                style={{ borderRadius: 10 }}
                                            />
                                        </Form.Item>

                                        <Form.Item
                                            name="password"
                                            label={
                                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                    <Text style={{ fontSize: 13, fontWeight: 600 }}>Password Awal</Text>
                                                    {password && (
                                                        <motion.div
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: 1 }}
                                                            style={{ display: "flex", alignItems: "center", gap: 6 }}
                                                        >
                                                            {/* Strength bar segments */}
                                                            {[1, 2, 3, 4, 5].map(i => (
                                                                <div
                                                                    key={i}
                                                                    style={{
                                                                        width: 18, height: 4, borderRadius: 2,
                                                                        transition: "background 0.3s",
                                                                        background: i <= pwStrength.score
                                                                            ? (token as any)[pwStrength.colorKey]
                                                                            : token.colorFillSecondary,
                                                                    }}
                                                                />
                                                            ))}
                                                            <Text style={{ fontSize: 11, color: (token as any)[pwStrength.colorKey], fontWeight: 600 }}>
                                                                {pwStrength.label}
                                                            </Text>
                                                        </motion.div>
                                                    )}
                                                </div>
                                            }
                                            rules={[{ required: true, min: 6, message: "Password minimal 6 karakter" }]}
                                        >
                                            <Input.Password
                                                prefix={<LockOutlined style={{ color: token.colorTextDisabled }} />}
                                                placeholder="Min. 6 karakter"
                                                size="large"
                                                style={{ borderRadius: 10 }}
                                                onChange={e => setPassword(e.target.value)}
                                                iconRender={visible =>
                                                    visible
                                                        ? <EyeOutlined style={{ color: token.colorTextDisabled }} />
                                                        : <EyeInvisibleOutlined style={{ color: token.colorTextDisabled }} />
                                                }
                                            />
                                        </Form.Item>
                                    </div>
                                </motion.div>

                                {/* ── Section 2: Identitas ───────────────── */}
                                <motion.div variants={fadeUp} custom={3} initial="hidden" animate="visible">
                                    <SectionHeader icon={<UserOutlined />} label="Identitas Pengurus" token={token} />
                                    <Form.Item
                                        name="fullName"
                                        label={<Text style={{ fontSize: 13, fontWeight: 600 }}>Nama Lengkap</Text>}
                                        rules={[{ required: true, message: "Nama lengkap wajib diisi" }]}
                                        style={{ marginBottom: 28 }}
                                    >
                                        <Input
                                            prefix={<UserOutlined style={{ color: token.colorTextDisabled }} />}
                                            placeholder="Contoh: Ust. Ahmad Fauzi, M.Pd."
                                            size="large"
                                            style={{ borderRadius: 10 }}
                                            onChange={e => setFullName(e.target.value)}
                                        />
                                    </Form.Item>
                                </motion.div>

                                {/* ── Section 3: Role Cards ──────────────── */}
                                <motion.div variants={fadeUp} custom={4} initial="hidden" animate="visible">
                                    <SectionHeader icon={<SafetyCertificateOutlined />} label="Jabatan Struktural" token={token} />
                                    <Form.Item
                                        name="role"
                                        rules={[{ required: true, message: "Jabatan wajib dipilih" }]}
                                        style={{ marginBottom: 28 }}
                                    >
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                            {ROLES.map(role => (
                                                <RoleCard
                                                    key={role.value}
                                                    role={role}
                                                    selected={selectedRole === role.value}
                                                    token={token}
                                                    onClick={() => {
                                                        const next = selectedRole === role.value ? null : role.value;
                                                        setSelectedRole(next);
                                                        form.setFieldValue("role", next);
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </Form.Item>
                                </motion.div>

                                {/* ── Section 4: Access Filters ──────────── */}
                                <motion.div variants={fadeUp} custom={5} initial="hidden" animate="visible">
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                        <SectionHeader icon={<BookOutlined />} label="Batasan Akses Data" token={token} />
                                    </div>
                                    <div style={{
                                        background: token.colorFillAlter,
                                        border: `1px solid ${token.colorBorderSecondary}`,
                                        borderRadius: 12, padding: "10px 14px",
                                        display: "flex", gap: 8, marginBottom: 16,
                                    }}>
                                        <InfoCircleOutlined style={{ color: token.colorPrimary, fontSize: 13, marginTop: 2, flexShrink: 0 }} />
                                        <Text style={{ fontSize: 12, color: token.colorTextDescription, lineHeight: 1.6 }}>
                                            Filter ini membatasi data santri yang dapat diakses. Pilih <strong>Seluruh</strong> untuk tanpa batasan, atau pilih spesifik sesuai tanggung jawab.
                                        </Text>
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
                                        <Form.Item
                                            name="aksesGender"
                                            label={<Text style={{ fontSize: 13, fontWeight: 600 }}>Filter Gender</Text>}
                                        >
                                            <Select
                                                size="large"
                                                options={GENDER_OPTIONS}
                                                style={{ borderRadius: 10 }}
                                                onChange={v => setAksesGender(v)}
                                                suffixIcon={<ManOutlined style={{ color: token.colorTextDisabled }} />}
                                            />
                                        </Form.Item>
                                        <Form.Item
                                            name="aksesJurusan"
                                            label={<Text style={{ fontSize: 13, fontWeight: 600 }}>Filter Takhasus</Text>}
                                        >
                                            <Select
                                                size="large"
                                                options={JURUSAN_OPTIONS}
                                                style={{ borderRadius: 10 }}
                                                onChange={v => setAksesJurusan(v)}
                                                suffixIcon={<BookOutlined style={{ color: token.colorTextDisabled }} />}
                                            />
                                        </Form.Item>
                                    </div>
                                </motion.div>

                                {/* ── Submit ────────────────────────────────── */}
                                <motion.div variants={fadeUp} custom={6} initial="hidden" animate="visible">
                                    <div style={{
                                        display: "flex", gap: 12,
                                        paddingTop: 8,
                                        borderTop: `1px solid ${token.colorBorderSecondary}`,
                                    }}>
                                        <Button
                                            size="large"
                                            onClick={() => push("/admin-management")}
                                            style={{ flex: "0 0 auto", borderRadius: 10, fontWeight: 600 }}
                                        >
                                            Batal
                                        </Button>
                                        <Button
                                            type="primary"
                                            size="large"
                                            htmlType="submit"
                                            loading={loading}
                                            icon={loading ? undefined : <ThunderboltOutlined />}
                                            style={{
                                                flex: 1, borderRadius: 10, fontWeight: 700, fontSize: 14,
                                                height: 46,
                                                background: `linear-gradient(135deg, ${token.colorPrimary}, ${token.colorPrimaryActive})`,
                                                border: "none",
                                                boxShadow: `0 4px 14px ${token.colorPrimary}44`,
                                            }}
                                        >
                                            {loading ? "Mendaftarkan Akun..." : "Konfirmasi & Buat Akun"}
                                        </Button>
                                    </div>
                                </motion.div>
                            </Form>
                        </div>
                    </div>
                </motion.div>

            </div>
        </div>
    );
};
