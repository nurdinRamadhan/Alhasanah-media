import React, { useState, useCallback } from "react";
import { Create, useForm, useSelect } from "@refinedev/antd";
import {
    Form, Input, Select, DatePicker, Row, Col,
    InputNumber, Divider, theme, Upload, message,
    Progress,
} from "antd";
import { motion, type Variants } from "framer-motion";
import {
    BarcodeOutlined, TagOutlined, AppstoreOutlined,
    EnvironmentOutlined, DollarOutlined, CalendarOutlined,
    SafetyCertificateOutlined, FileProtectOutlined,
    CheckCircleOutlined, WarningOutlined, CloseCircleOutlined,
    QuestionCircleOutlined, CameraOutlined, PlusOutlined,
    InfoCircleOutlined, ShopOutlined, CrownOutlined,
    RocketOutlined, AimOutlined, BankOutlined,
    UploadOutlined, SaveOutlined,
} from "@ant-design/icons";
import { useGetIdentity } from "@refinedev/core";
import { logActivity } from "../../utility/logger";
import dayjs from "dayjs";
import { IInventaris, IKategoriBarang, ILokasiAset, IProfile } from "../../types";

const { useToken } = theme;
const { Dragger } = Upload;

// ═══════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════
const GOLD        = "#C9A84C";
const GOLD_BRIGHT = "#FFB700";
const GOLD_LIGHT  = "#FDE68A";
const GOLD_DEEP   = "#8B6914";
const GOLD_DARK   = "#5C430A";
const SUCCESS     = "#059669";
const DANGER      = "#DC2626";
const WARNING     = "#D97706";
const INFO        = "#2563EB";
const PURPLE      = "#7C3AED";
const G           = (o: number) => `rgba(201,168,76,${o})`;

// ═══════════════════════════════════════════════════════════════
// ANIMATION VARIANTS
// ═══════════════════════════════════════════════════════════════
const fadeUp: Variants = {
    hidden:  { opacity: 0, y: 18 },
    visible: (i = 0) => ({
        opacity: 1, y: 0,
        transition: { duration: 0.48, ease: [0.22, 1, 0.36, 1] as const, delay: i * 0.07 },
    }),
};
const stagger: Variants = { visible: { transition: { staggerChildren: 0.07 } } };

// ═══════════════════════════════════════════════════════════════
// KONDISI OPTIONS — dengan warna & icon
// ═══════════════════════════════════════════════════════════════
const KONDISI_OPTIONS = [
    { value:"BAIK",         label:"Baik",         color:SUCCESS, icon:<CheckCircleOutlined /> },
    { value:"RUSAK_RINGAN", label:"Rusak Ringan",  color:WARNING, icon:<WarningOutlined />    },
    { value:"RUSAK_BERAT",  label:"Rusak Berat",   color:DANGER,  icon:<CloseCircleOutlined /> },
    { value:"HILANG",       label:"Hilang",        color:"#6B7280", icon:<QuestionCircleOutlined /> },
];

const SUMBER_OPTIONS = [
    { value:"WAKAF",  label:"Wakaf Umat",            color:GOLD,    icon:"🕌" },
    { value:"INFAQ",  label:"Infaq Jamaah",           color:SUCCESS, icon:"💚" },
    { value:"HIBAH",  label:"Hibah / Donasi Khusus",  color:PURPLE,  icon:"🎁" },
    { value:"BELI",   label:"Pembelian Mandiri",       color:INFO,    icon:"🛒" },
    { value:"DONASI", label:"Donasi Umum",             color:"#0891B2", icon:"🤲" },
];

// ═══════════════════════════════════════════════════════════════
// SECTION HEADER
// ═══════════════════════════════════════════════════════════════
const SectionHeader: React.FC<{
    icon:  React.ReactNode;
    title: string;
    subtitle?: string;
    step:  number;
    isDark: boolean;
}> = ({ icon, title, subtitle, step, isDark }) => (
    <div style={{
        display: "flex", alignItems: "center", gap: 14,
        marginBottom: 22, paddingBottom: 14,
        borderBottom: `1px solid ${G(isDark ? 0.14 : 0.10)}`,
    }}>
        {/* Step number */}
        <div style={{
            width: 38, height: 38, borderRadius: 12, flexShrink: 0,
            background: `linear-gradient(135deg, ${GOLD}, ${GOLD_BRIGHT})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 4px 16px ${G(0.35)}`,
        }}>
            <span style={{
                fontFamily: "'Syne', sans-serif", fontWeight: 800,
                fontSize: 15, color: "#000",
            }}>
                {step}
            </span>
        </div>
        {/* Icon badge */}
        <div style={{
            width: 38, height: 38, borderRadius: 12, flexShrink: 0,
            background: `linear-gradient(135deg, ${G(0.20)}, ${G(0.35)})`,
            border: `1px solid ${G(0.28)}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: GOLD_BRIGHT, fontSize: 16,
            boxShadow: `0 3px 12px ${G(0.20)}`,
        }}>
            {icon}
        </div>
        <div>
            <div style={{
                fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 15,
                letterSpacing: "-0.02em", lineHeight: 1.2,
                color: isDark ? "#F0EDE5" : "#0A0805",
            }}>
                {title}
            </div>
            {subtitle && (
                <div style={{ fontSize: 11, color: isDark ? "#5C5248" : "#9E9080", marginTop: 2 }}>
                    {subtitle}
                </div>
            )}
        </div>
        <div style={{
            flex: 1, height: 1, marginLeft: 4,
            background: `linear-gradient(90deg, ${G(0.30)} 0%, transparent 100%)`,
        }} />
    </div>
);

// ═══════════════════════════════════════════════════════════════
// FORM LABEL COMPONENT
// ═══════════════════════════════════════════════════════════════
const FieldLabel: React.FC<{
    label: string;
    required?: boolean;
    hint?: string;
    icon?: React.ReactNode;
    isDark: boolean;
}> = ({ label, required, hint, icon, isDark }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        {icon && (
            <span style={{ fontSize: 12, color: isDark ? G(0.75) : GOLD_DEEP, flexShrink: 0 }}>
                {icon}
            </span>
        )}
        <span style={{
            fontSize: 11, fontWeight: 800, letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: isDark ? G(0.80) : GOLD_DEEP,
            fontFamily: "'DM Sans', sans-serif",
        }}>
            {label}
        </span>
        {required && (
            <span style={{ color: DANGER, fontSize: 12, fontWeight: 900 }}>*</span>
        )}
        {hint && (
            <span style={{
                fontSize: 9.5, color: isDark ? "#5C5248" : "#9E9080",
                fontStyle: "italic", marginLeft: 2,
            }}>
                ({hint})
            </span>
        )}
    </div>
);

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export const InventarisCreate = () => {
    const { token } = useToken();
    const bg     = token.colorBgContainer;
    const isDark = (() => {
        const c = bg.replace("#","");
        if (c.length < 6) return false;
        const lum = 0.299*parseInt(c.slice(0,2),16)
                  + 0.587*parseInt(c.slice(2,4),16)
                  + 0.114*parseInt(c.slice(4,6),16);
        return lum < 128;
    })();

    const { data: user } = useGetIdentity<IProfile>();

    // ── Form ─────────────────────────────────────────────────
    const { formProps, saveButtonProps, form } = useForm<IInventaris>({
        onMutationSuccess: (data) => {
            logActivity({
                user,
                action:    "CREATE",
                resource:  "inventaris",
                record_id: data?.data?.id?.toString() || "-",
                details:   data?.data,
            });
        },
    });

    // Watch values for live preview
    const namaBarang    = Form.useWatch("nama_barang", form);
    const kodeBarang    = Form.useWatch("kode_barang", form);
    const harga         = Form.useWatch("harga_perolehan", form) || 0;
    const jumlah        = Form.useWatch("jumlah", form) || 1;
    const kondisiWatch  = Form.useWatch("kondisi", form) || "BAIK";
    const sumberWatch   = Form.useWatch("sumber_dana", form) || "WAKAF";

    const nilaiTotal    = Number(harga) * Number(jumlah);
    const kondisiCfg    = KONDISI_OPTIONS.find(k => k.value === kondisiWatch) || KONDISI_OPTIONS[0];
    const sumberCfg     = SUMBER_OPTIONS.find(s => s.value === sumberWatch);

    // ── Select props ─────────────────────────────────────────
    const { selectProps: kategoriProps } = useSelect<IKategoriBarang>({
        resource:     "kategori_barang",
        optionLabel:  "nama_kategori",
        optionValue:  "id",
    });

    const { selectProps: lokasiProps } = useSelect<ILokasiAset>({
        resource:    "lokasi_aset",
        optionLabel: "nama_lokasi",
        optionValue: "id",
    });

    // ── Shared styles ─────────────────────────────────────────
    const cardSt: React.CSSProperties = {
        borderRadius: 20,
        border: `1px solid ${G(isDark ? 0.12 : 0.13)}`,
        background: token.colorBgContainer,
        boxShadow: isDark
            ? `0 6px 28px rgba(0,0,0,0.38), 0 0 0 1px ${G(0.07)}`
            : `0 4px 20px ${G(0.08)}, 0 2px 6px rgba(0,0,0,0.04)`,
        padding: "26px 28px",
        position: "relative",
        overflow: "hidden",
    };

    const inputSt: React.CSSProperties = {
        borderRadius: 10,
        height: 42,
        fontFamily: "'DM Sans', sans-serif",
    };

    // ═══════════════════════════════════════════════════════════
    return (
        <motion.div
            initial="hidden" animate="visible" variants={stagger}
            style={{ paddingBottom: 80 }}
        >
            {/* ══════════════════════════════════════════════
                PAGE HEADER
            ══════════════════════════════════════════════ */}
            <motion.div variants={fadeUp} style={{
                display: "flex", alignItems: "flex-end",
                justifyContent: "space-between", flexWrap: "wrap", gap: 16,
                marginBottom: 28, paddingBottom: 22,
                borderBottom: `1px solid ${G(isDark ? 0.10 : 0.12)}`,
            }}>
                <div>
                    <div style={{
                        display: "flex", alignItems: "center", gap: 8, marginBottom: 6,
                        fontSize: 10, fontWeight: 800, letterSpacing: "0.14em",
                        textTransform: "uppercase", color: GOLD,
                        fontFamily: "'Syne', sans-serif",
                    }}>
                        <span style={{
                            width: 6, height: 6, borderRadius: "50%", background: GOLD_BRIGHT,
                            display: "inline-block",
                            animation: "dotPulse 2s ease-in-out infinite",
                        }} />
                        Manajemen Aset Pesantren
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{
                            width: 52, height: 52, borderRadius: 16, flexShrink: 0,
                            background: `linear-gradient(135deg, ${G(0.22)}, ${G(0.38)})`,
                            border: `1px solid ${G(0.30)}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: GOLD_BRIGHT, fontSize: 22,
                            boxShadow: `0 6px 20px ${G(0.25)}`,
                        }}>
                            <BarcodeOutlined />
                        </div>
                        <div>
                            <h1 style={{
                                margin: 0, fontFamily: "'Syne', sans-serif", fontWeight: 800,
                                fontSize: "clamp(20px,3vw,26px)", letterSpacing: "-0.03em",
                                color: token.colorText, lineHeight: 1.2,
                            }}>
                                Registrasi{" "}
                                <span style={{
                                    background: `linear-gradient(90deg, ${GOLD_DEEP}, ${GOLD_BRIGHT}, ${GOLD})`,
                                    backgroundSize: "200% auto",
                                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                                    backgroundClip: "text",
                                    animation: "goldShimmer 5s linear infinite",
                                }}>
                                    Aset Baru
                                </span>
                            </h1>
                            <span style={{ fontSize: 12.5, color: token.colorTextSecondary }}>
                                Daftarkan inventaris dan aset pesantren ke dalam sistem
                            </span>
                        </div>
                    </div>
                </div>

                {/* Step indicator */}
                <div style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "8px 16px", borderRadius: 12,
                    background: G(isDark ? 0.08 : 0.06),
                    border: `1px solid ${G(isDark ? 0.16 : 0.14)}`,
                }}>
                    {[1,2,3].map((s) => (
                        <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{
                                width: 26, height: 26, borderRadius: 8,
                                background: `linear-gradient(135deg, ${GOLD}, ${GOLD_BRIGHT})`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 11, fontWeight: 800, color: "#000",
                                boxShadow: `0 2px 8px ${G(0.30)}`,
                            }}>
                                {s}
                            </div>
                            {s < 3 && (
                                <div style={{ width: 18, height: 1.5,
                                    background: G(isDark ? 0.28 : 0.22) }} />
                            )}
                        </div>
                    ))}
                    <span style={{
                        fontSize: 10, fontWeight: 700, marginLeft: 6,
                        color: isDark ? G(0.70) : GOLD_DEEP,
                        letterSpacing: "0.08em", textTransform: "uppercase",
                        fontFamily: "'Syne', sans-serif",
                    }}>
                        Registrasi Aset
                    </span>
                </div>
            </motion.div>

            {/* Wrap form dengan Create dari refine — simpan saveButtonProps */}
            <Create
                saveButtonProps={{
                    ...saveButtonProps,
                    style: {
                        background: `linear-gradient(135deg, ${GOLD}, ${GOLD_BRIGHT})`,
                        border: "none", color: "#000", fontWeight: 800,
                        height: 42, borderRadius: 12, padding: "0 28px",
                        fontSize: 13,
                        boxShadow: `0 4px 16px ${G(0.40)}`,
                        display: "flex", alignItems: "center", gap: 7,
                    },
                    icon: <SaveOutlined />,
                    children: "Simpan & Daftarkan Aset",
                }}
                title={false}
                breadcrumb={false}
                headerButtons={<></>}
            >
                <Form
                    {...formProps}
                    layout="vertical"
                    requiredMark={false}
                    initialValues={{
                        tanggal_perolehan: dayjs(),
                        dicatat_oleh_id:   user?.id,
                        kondisi:           "BAIK",
                        jumlah:            1,
                        satuan:            "Unit",
                        sumber_dana:       "WAKAF",
                    }}
                >
                    <Form.Item name="dicatat_oleh_id" hidden><Input /></Form.Item>

                    <Row gutter={[22, 22]}>

                        {/* ── KIRI: Form Utama ── */}
                        <Col xs={24} lg={15}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                                {/* ═════ SECTION 1: Identitas Aset ═════ */}
                                <motion.div custom={1} variants={fadeUp}>
                                    <div style={cardSt}>
                                        {/* Gold top line */}
                                        <div style={{
                                            position: "absolute", top: 0, left: 0, right: 0, height: 2,
                                            background: `linear-gradient(90deg, transparent, ${GOLD}, ${GOLD_BRIGHT}, ${GOLD}, transparent)`,
                                        }} />
                                        {/* Ambient glow */}
                                        <div style={{
                                            position: "absolute", bottom: -30, right: -30,
                                            width: 150, height: 150, borderRadius: "50%",
                                            background: `radial-gradient(circle, ${G(0.12)} 0%, transparent 70%)`,
                                            pointerEvents: "none",
                                        }} />

                                        <SectionHeader
                                            icon={<BarcodeOutlined />}
                                            title="Identitas Aset"
                                            subtitle="Kode unik, nama, dan klasifikasi barang"
                                            step={1}
                                            isDark={isDark}
                                        />

                                        {/* Kode Barang */}
                                        <Form.Item
                                            name="kode_barang"
                                            rules={[{ required: true, message: "Kode barang wajib diisi" }]}
                                            style={{ marginBottom: 18 }}
                                            label={
                                                <FieldLabel
                                                    label="Kode Barang"
                                                    required
                                                    hint="Format: KATEGORI-TAHUN-NOURUT"
                                                    icon={<TagOutlined />}
                                                    isDark={isDark}
                                                />
                                            }
                                        >
                                            <Input
                                                placeholder="ELK-2026-055"
                                                style={{
                                                    ...inputSt,
                                                    fontFamily: "'DM Mono', monospace",
                                                    fontWeight: 800,
                                                    letterSpacing: "0.10em",
                                                    fontSize: 15,
                                                    textTransform: "uppercase",
                                                }}
                                            />
                                        </Form.Item>

                                        {/* Nama Barang */}
                                        <Form.Item
                                            name="nama_barang"
                                            rules={[{ required: true, message: "Nama barang wajib diisi" }]}
                                            style={{ marginBottom: 18 }}
                                            label={
                                                <FieldLabel
                                                    label="Nama Barang / Aset"
                                                    required
                                                    icon={<AppstoreOutlined />}
                                                    isDark={isDark}
                                                />
                                            }
                                        >
                                            <Input
                                                placeholder="Contoh: Laptop Asus Vivobook 14 Core i5"
                                                style={inputSt}
                                            />
                                        </Form.Item>

                                        <Row gutter={16}>
                                            <Col xs={24} sm={12}>
                                                <Form.Item
                                                    name="kategori_id"
                                                    rules={[{ required: true, message: "Kategori wajib dipilih" }]}
                                                    style={{ marginBottom: 18 }}
                                                    label={
                                                        <FieldLabel
                                                            label="Kategori"
                                                            required
                                                            icon={<FileProtectOutlined />}
                                                            isDark={isDark}
                                                        />
                                                    }
                                                >
                                                    <Select
                                                        {...kategoriProps}
                                                        placeholder="Pilih kategori aset..."
                                                        style={{ height: 42 }}
                                                    />
                                                </Form.Item>
                                            </Col>
                                            <Col xs={24} sm={12}>
                                                <Form.Item
                                                    name="lokasi_id"
                                                    rules={[{ required: true, message: "Lokasi wajib dipilih" }]}
                                                    style={{ marginBottom: 18 }}
                                                    label={
                                                        <FieldLabel
                                                            label="Lokasi Penempatan"
                                                            required
                                                            icon={<EnvironmentOutlined />}
                                                            isDark={isDark}
                                                        />
                                                    }
                                                >
                                                    <Select
                                                        {...lokasiProps}
                                                        placeholder="Pilih ruangan/lokasi..."
                                                        style={{ height: 42 }}
                                                    />
                                                </Form.Item>
                                            </Col>
                                        </Row>

                                        {/* Spesifikasi */}
                                        <Form.Item
                                            name="spesifikasi"
                                            style={{ marginBottom: 0 }}
                                            label={
                                                <FieldLabel
                                                    label="Spesifikasi Teknis"
                                                    hint="opsional"
                                                    icon={<InfoCircleOutlined />}
                                                    isDark={isDark}
                                                />
                                            }
                                        >
                                            <Input.TextArea
                                                rows={3}
                                                placeholder="Warna, Serial Number, Model, Spesifikasi detail..."
                                                style={{
                                                    borderRadius: 12,
                                                    fontFamily: "'DM Sans', sans-serif",
                                                    resize: "none",
                                                }}
                                            />
                                        </Form.Item>
                                    </div>
                                </motion.div>

                                {/* ═════ SECTION 2: Keuangan & Pengadaan ═════ */}
                                <motion.div custom={2} variants={fadeUp}>
                                    <div style={cardSt}>
                                        <div style={{
                                            position: "absolute", top: 0, left: 0, right: 0, height: 2,
                                            background: `linear-gradient(90deg, transparent, ${SUCCESS}80, ${SUCCESS}, ${SUCCESS}80, transparent)`,
                                        }} />

                                        <SectionHeader
                                            icon={<DollarOutlined />}
                                            title="Keuangan & Pengadaan"
                                            subtitle="Sumber dana, tanggal perolehan dan nilai aset"
                                            step={2}
                                            isDark={isDark}
                                        />

                                        <Row gutter={16}>
                                            <Col xs={24} sm={12}>
                                                <Form.Item
                                                    name="sumber_dana"
                                                    rules={[{ required: true }]}
                                                    style={{ marginBottom: 18 }}
                                                    label={
                                                        <FieldLabel
                                                            label="Sumber Dana"
                                                            required
                                                            icon={<CrownOutlined />}
                                                            isDark={isDark}
                                                        />
                                                    }
                                                >
                                                    <Select
                                                        style={{ height: 42 }}
                                                        placeholder="Pilih sumber dana..."
                                                        optionRender={(opt) => {
                                                            const cfg = SUMBER_OPTIONS.find(s => s.value === opt.data.value);
                                                            return (
                                                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                                    <span>{cfg?.icon}</span>
                                                                    <span style={{ fontWeight: 600, color: cfg?.color }}>
                                                                        {opt.data.label}
                                                                    </span>
                                                                </div>
                                                            );
                                                        }}
                                                        options={SUMBER_OPTIONS.map(s => ({ label: `${s.icon} ${s.label}`, value: s.value }))}
                                                    />
                                                </Form.Item>
                                            </Col>
                                            <Col xs={24} sm={12}>
                                                <Form.Item
                                                    name="tanggal_perolehan"
                                                    rules={[{ required: true, message: "Tanggal perolehan wajib diisi" }]}
                                                    getValueProps={(v) => ({ value: v ? dayjs(v) : "" })}
                                                    style={{ marginBottom: 18 }}
                                                    label={
                                                        <FieldLabel
                                                            label="Tanggal Perolehan"
                                                            required
                                                            icon={<CalendarOutlined />}
                                                            isDark={isDark}
                                                        />
                                                    }
                                                >
                                                    <DatePicker
                                                        style={{ width: "100%", height: 42, borderRadius: 10 }}
                                                        format="DD MMMM YYYY"
                                                        placeholder="Pilih tanggal..."
                                                    />
                                                </Form.Item>
                                            </Col>
                                        </Row>

                                        {/* Harga */}
                                        <Form.Item
                                            name="harga_perolehan"
                                            rules={[{ required: true, message: "Harga perolehan wajib diisi" }]}
                                            style={{ marginBottom: 18 }}
                                            label={
                                                <FieldLabel
                                                    label="Harga Perolehan (Rp)"
                                                    required
                                                    hint="Harga per unit"
                                                    icon={<DollarOutlined />}
                                                    isDark={isDark}
                                                />
                                            }
                                        >
                                            <InputNumber<number>
                                                style={{ width: "100%", height: 42, borderRadius: 10 }}
                                                formatter={v => `Rp ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
                                                parser={v => Number(v?.replace(/Rp\s?|(\.)/g, "") || 0)}
                                                placeholder="0"
                                                min={0}
                                            />
                                        </Form.Item>

                                        <Row gutter={16}>
                                            <Col xs={12} sm={8}>
                                                <Form.Item
                                                    name="jumlah"
                                                    rules={[{ required: true }]}
                                                    style={{ marginBottom: 18 }}
                                                    label={
                                                        <FieldLabel
                                                            label="Jumlah"
                                                            required
                                                            icon={<ShopOutlined />}
                                                            isDark={isDark}
                                                        />
                                                    }
                                                >
                                                    <InputNumber
                                                        min={1} style={{ width: "100%", height: 42, borderRadius: 10 }}
                                                    />
                                                </Form.Item>
                                            </Col>
                                            <Col xs={12} sm={8}>
                                                <Form.Item
                                                    name="satuan"
                                                    style={{ marginBottom: 18 }}
                                                    label={
                                                        <FieldLabel
                                                            label="Satuan"
                                                            isDark={isDark}
                                                        />
                                                    }
                                                >
                                                    <Select
                                                        style={{ height: 42 }}
                                                        placeholder="Unit..."
                                                        options={[
                                                            { label: "Unit",  value: "Unit"  },
                                                            { label: "Pcs",   value: "Pcs"   },
                                                            { label: "Set",   value: "Set"   },
                                                            { label: "Buah",  value: "Buah"  },
                                                            { label: "Lembar",value: "Lembar"},
                                                            { label: "Meter", value: "Meter" },
                                                            { label: "Kg",    value: "Kg"    },
                                                            { label: "Liter", value: "Liter" },
                                                        ]}
                                                    />
                                                </Form.Item>
                                            </Col>
                                            <Col xs={24} sm={8}>
                                                {/* Total value display */}
                                                <div style={{ marginBottom: 18 }}>
                                                    <FieldLabel label="Total Nilai" isDark={isDark} icon={<RocketOutlined />} />
                                                    <div style={{
                                                        height: 42, borderRadius: 10,
                                                        background: isDark ? G(0.10) : G(0.07),
                                                        border: `1px solid ${G(isDark ? 0.22 : 0.18)}`,
                                                        display: "flex", alignItems: "center",
                                                        padding: "0 12px",
                                                    }}>
                                                        <span style={{
                                                            fontFamily: "'DM Mono', monospace",
                                                            fontWeight: 800, fontSize: 13,
                                                            color: isDark ? GOLD_BRIGHT : GOLD_DEEP,
                                                        }}>
                                                            {nilaiTotal > 0
                                                                ? `Rp ${nilaiTotal.toLocaleString("id-ID")}`
                                                                : "—"
                                                            }
                                                        </span>
                                                    </div>
                                                </div>
                                            </Col>
                                        </Row>
                                    </div>
                                </motion.div>

                                {/* ═════ SECTION 3: Kondisi & Catatan ═════ */}
                                <motion.div custom={3} variants={fadeUp}>
                                    <div style={cardSt}>
                                        <div style={{
                                            position: "absolute", top: 0, left: 0, right: 0, height: 2,
                                            background: `linear-gradient(90deg, transparent, ${kondisiCfg.color}80, ${kondisiCfg.color}, ${kondisiCfg.color}80, transparent)`,
                                            transition: "all 0.4s ease",
                                        }} />

                                        <SectionHeader
                                            icon={<SafetyCertificateOutlined />}
                                            title="Kondisi & Keterangan"
                                            subtitle="Status fisik aset saat didaftarkan"
                                            step={3}
                                            isDark={isDark}
                                        />

                                        <Form.Item
                                            name="kondisi"
                                            style={{ marginBottom: 18 }}
                                            label={
                                                <FieldLabel
                                                    label="Kondisi Aset"
                                                    required
                                                    icon={<CheckCircleOutlined />}
                                                    isDark={isDark}
                                                />
                                            }
                                        >
                                            {/* Custom kondisi picker — pill buttons */}
                                            <Form.Item name="kondisi" noStyle>
                                                <Select
                                                    style={{ height: 42 }}
                                                    optionRender={(opt) => {
                                                        const cfg = KONDISI_OPTIONS.find(k => k.value === opt.data.value);
                                                        return (
                                                            <div style={{
                                                                display: "flex", alignItems: "center", gap: 8,
                                                                padding: "4px 0",
                                                            }}>
                                                                <span style={{ color: cfg?.color, fontSize: 14 }}>
                                                                    {cfg?.icon}
                                                                </span>
                                                                <span style={{ fontWeight: 600, color: cfg?.color }}>
                                                                    {opt.data.label}
                                                                </span>
                                                            </div>
                                                        );
                                                    }}
                                                    options={KONDISI_OPTIONS.map(k => ({ label: k.label, value: k.value }))}
                                                />
                                            </Form.Item>
                                        </Form.Item>

                                        {/* Kondisi indicator bar */}
                                        <div style={{
                                            padding: "12px 16px", borderRadius: 12,
                                            background: isDark ? `${kondisiCfg.color}10` : `${kondisiCfg.color}08`,
                                            border: `1px solid ${kondisiCfg.color}22`,
                                            marginBottom: 18, transition: "all 0.3s ease",
                                        }}>
                                            <div style={{ display: "flex", justifyContent: "space-between",
                                                alignItems: "center", marginBottom: 6 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                                    <span style={{ color: kondisiCfg.color, fontSize: 14 }}>
                                                        {kondisiCfg.icon}
                                                    </span>
                                                    <span style={{ fontFamily: "'Syne', sans-serif",
                                                        fontWeight: 800, fontSize: 13,
                                                        color: kondisiCfg.color }}>
                                                        {kondisiCfg.label}
                                                    </span>
                                                </div>
                                                <span style={{ fontFamily: "'DM Mono', monospace",
                                                    fontWeight: 800, fontSize: 12,
                                                    color: kondisiCfg.color }}>
                                                    {kondisiCfg.value === "BAIK" ? "100%" :
                                                     kondisiCfg.value === "RUSAK_RINGAN" ? "50%" :
                                                     kondisiCfg.value === "RUSAK_BERAT" ? "20%" : "0%"}
                                                </span>
                                            </div>
                                            <Progress
                                                percent={
                                                    kondisiCfg.value === "BAIK" ? 100 :
                                                    kondisiCfg.value === "RUSAK_RINGAN" ? 50 :
                                                    kondisiCfg.value === "RUSAK_BERAT" ? 20 : 0
                                                }
                                                showInfo={false}
                                                strokeColor={kondisiCfg.color}
                                                trailColor={isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)"}
                                                strokeWidth={7}
                                                style={{ margin: 0 }}
                                            />
                                        </div>

                                        {/* Keterangan */}
                                        <Form.Item
                                            name="keterangan"
                                            style={{ marginBottom: 0 }}
                                            label={
                                                <FieldLabel
                                                    label="Keterangan Tambahan"
                                                    hint="opsional"
                                                    icon={<InfoCircleOutlined />}
                                                    isDark={isDark}
                                                />
                                            }
                                        >
                                            <Input.TextArea
                                                rows={3}
                                                placeholder="Catatan kondisi, sejarah pemakaian, atau informasi tambahan..."
                                                style={{
                                                    borderRadius: 12,
                                                    fontFamily: "'DM Sans', sans-serif",
                                                    resize: "none",
                                                }}
                                            />
                                        </Form.Item>
                                    </div>
                                </motion.div>
                            </div>
                        </Col>

                        {/* ── KANAN: Pratinjau & Foto ── */}
                        <Col xs={24} lg={9}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 20,
                                position: "sticky", top: 80 }}>

                                {/* ═════ LIVE PREVIEW CARD ═════ */}
                                <motion.div custom={0} variants={fadeUp}>
                                    <div style={{ ...cardSt, padding: "22px 24px" }}>
                                        <div style={{
                                            position: "absolute", top: 0, left: 0, right: 0, height: 2,
                                            background: `linear-gradient(90deg, transparent, ${GOLD}, ${GOLD_BRIGHT}, ${GOLD}, transparent)`,
                                        }} />

                                        <div style={{
                                            display: "flex", alignItems: "center", gap: 8, marginBottom: 16,
                                            paddingBottom: 12,
                                            borderBottom: `1px solid ${G(isDark ? 0.14 : 0.10)}`,
                                        }}>
                                            <div style={{
                                                width: 30, height: 30, borderRadius: 9,
                                                background: `linear-gradient(135deg, ${G(0.25)}, ${G(0.45)})`,
                                                border: `1px solid ${G(0.30)}`,
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                color: GOLD_BRIGHT, fontSize: 13,
                                            }}>
                                                <AimOutlined />
                                            </div>
                                            <span style={{
                                                fontFamily: "'Syne', sans-serif", fontWeight: 800,
                                                fontSize: 13, color: isDark ? GOLD_BRIGHT : GOLD_DEEP,
                                                letterSpacing: "0.08em", textTransform: "uppercase",
                                            }}>
                                                Pratinjau Aset
                                            </span>
                                            <div style={{
                                                marginLeft: "auto", fontSize: 9, fontWeight: 700,
                                                color: SUCCESS,
                                                background: `${SUCCESS}14`,
                                                border: `1px solid ${SUCCESS}28`,
                                                borderRadius: 99, padding: "2px 8px",
                                            }}>
                                                ● LIVE
                                            </div>
                                        </div>

                                        {/* Preview content */}
                                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                            {/* Kode */}
                                            <div style={{
                                                padding: "10px 14px", borderRadius: 10,
                                                background: G(isDark ? 0.10 : 0.07),
                                                border: `1px solid ${G(isDark ? 0.20 : 0.14)}`,
                                            }}>
                                                <div style={{ fontSize: 9, fontWeight: 800,
                                                    color: isDark ? G(0.60) : GOLD_DEEP,
                                                    letterSpacing: "0.12em", textTransform: "uppercase",
                                                    marginBottom: 4 }}>
                                                    Kode Barang
                                                </div>
                                                <div style={{
                                                    fontFamily: "'DM Mono', monospace", fontWeight: 800,
                                                    fontSize: 16, color: isDark ? GOLD_BRIGHT : GOLD_DEEP,
                                                    letterSpacing: "0.12em", minHeight: 22,
                                                }}>
                                                    {kodeBarang || <span style={{ opacity: 0.3, fontStyle: "italic" }}>XXX-0000-000</span>}
                                                </div>
                                            </div>

                                            {/* Nama */}
                                            <div style={{
                                                padding: "10px 14px", borderRadius: 10,
                                                background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                                            }}>
                                                <div style={{ fontSize: 9, fontWeight: 800,
                                                    color: isDark ? G(0.60) : GOLD_DEEP,
                                                    letterSpacing: "0.12em", textTransform: "uppercase",
                                                    marginBottom: 4 }}>
                                                    Nama Aset
                                                </div>
                                                <div style={{ fontWeight: 700, fontSize: 13.5,
                                                    color: token.colorText, lineHeight: 1.3, minHeight: 20 }}>
                                                    {namaBarang || <span style={{ opacity: 0.3, fontStyle: "italic" }}>Nama belum diisi</span>}
                                                </div>
                                            </div>

                                            {/* Kondisi badge */}
                                            <div style={{
                                                display: "flex", alignItems: "center", gap: 8,
                                                padding: "8px 14px", borderRadius: 10,
                                                background: isDark ? `${kondisiCfg.color}10` : `${kondisiCfg.color}08`,
                                                border: `1px solid ${kondisiCfg.color}22`,
                                                transition: "all 0.3s ease",
                                            }}>
                                                <span style={{ color: kondisiCfg.color, fontSize: 14 }}>
                                                    {kondisiCfg.icon}
                                                </span>
                                                <div>
                                                    <div style={{ fontSize: 9, fontWeight: 800,
                                                        color: isDark ? G(0.60) : GOLD_DEEP,
                                                        letterSpacing: "0.10em", textTransform: "uppercase" }}>
                                                        Kondisi
                                                    </div>
                                                    <div style={{ fontWeight: 800, fontSize: 12,
                                                        color: kondisiCfg.color,
                                                        fontFamily: "'Syne', sans-serif" }}>
                                                        {kondisiCfg.label}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Sumber dana */}
                                            {sumberCfg && (
                                                <div style={{
                                                    display: "flex", alignItems: "center", gap: 8,
                                                    padding: "8px 14px", borderRadius: 10,
                                                    background: isDark ? `${sumberCfg.color}10` : `${sumberCfg.color}08`,
                                                    border: `1px solid ${sumberCfg.color}22`,
                                                    transition: "all 0.3s ease",
                                                }}>
                                                    <span style={{ fontSize: 18 }}>{sumberCfg.icon}</span>
                                                    <div>
                                                        <div style={{ fontSize: 9, fontWeight: 800,
                                                            color: isDark ? G(0.60) : GOLD_DEEP,
                                                            letterSpacing: "0.10em", textTransform: "uppercase" }}>
                                                            Sumber Dana
                                                        </div>
                                                        <div style={{ fontWeight: 700, fontSize: 12,
                                                            color: sumberCfg.color }}>
                                                            {sumberCfg.label}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Nilai total */}
                                            {nilaiTotal > 0 && (
                                                <div style={{
                                                    padding: "14px 16px", borderRadius: 12,
                                                    background: isDark
                                                        ? "linear-gradient(135deg, #0D0D1A 0%, #111128 100%)"
                                                        : `linear-gradient(135deg, ${GOLD_DARK} 0%, #3D2800 100%)`,
                                                    boxShadow: `0 6px 24px rgba(0,0,0,0.25), inset 0 0 0 1px ${G(0.20)}`,
                                                    position: "relative", overflow: "hidden",
                                                }}>
                                                    <div style={{
                                                        position: "absolute", inset: 0,
                                                        background: `linear-gradient(105deg, transparent 40%, ${G(0.07)} 60%, transparent 80%)`,
                                                        pointerEvents: "none",
                                                    }} />
                                                    <div style={{ fontSize: 9, fontWeight: 800,
                                                        color: "rgba(255,255,255,0.40)",
                                                        letterSpacing: "0.14em", textTransform: "uppercase",
                                                        marginBottom: 6 }}>
                                                        Total Nilai Aset
                                                    </div>
                                                    <div style={{
                                                        fontFamily: "'Syne', sans-serif", fontWeight: 800,
                                                        fontSize: 20, color: "#FFFFFF",
                                                        letterSpacing: "-0.03em",
                                                    }}>
                                                        Rp {nilaiTotal.toLocaleString("id-ID")}
                                                    </div>
                                                    <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.35)",
                                                        marginTop: 4 }}>
                                                        {jumlah} unit × Rp {Number(harga).toLocaleString("id-ID")}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>

                                {/* ═════ UPLOAD FOTO ═════ */}
                                <motion.div custom={4} variants={fadeUp}>
                                    <div style={{ ...cardSt, padding: "22px 24px" }}>
                                        <div style={{
                                            display: "flex", alignItems: "center", gap: 8, marginBottom: 16,
                                            paddingBottom: 12,
                                            borderBottom: `1px solid ${G(isDark ? 0.14 : 0.10)}`,
                                        }}>
                                            <div style={{
                                                width: 30, height: 30, borderRadius: 9,
                                                background: isDark ? "rgba(37,99,235,0.16)" : "rgba(37,99,235,0.10)",
                                                border: "1px solid rgba(37,99,235,0.22)",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                color: INFO, fontSize: 13,
                                            }}>
                                                <CameraOutlined />
                                            </div>
                                            <span style={{
                                                fontFamily: "'Syne', sans-serif", fontWeight: 800,
                                                fontSize: 13, color: isDark ? "#F0EDE5" : "#0A0805",
                                                letterSpacing: "-0.01em",
                                            }}>
                                                Foto Aset
                                            </span>
                                            <span style={{ fontSize: 10, color: token.colorTextTertiary,
                                                fontStyle: "italic" }}>
                                                opsional
                                            </span>
                                        </div>

                                        <Form.Item name="foto_url" noStyle>
                                            <Input type="hidden" />
                                        </Form.Item>

                                        {/* Dragger */}
                                        <Dragger
                                            name="file"
                                            multiple={false}
                                            accept="image/*"
                                            showUploadList={false}
                                            style={{
                                                borderRadius: 14,
                                                border: `1.5px dashed ${G(isDark ? 0.30 : 0.22)}`,
                                                background: isDark ? G(0.05) : G(0.04),
                                            }}
                                            beforeUpload={() => {
                                                message.info("Upload foto dikelola melalui Supabase Storage pada mode production.");
                                                return false;
                                            }}
                                        >
                                            <div style={{ padding: "20px 16px" }}>
                                                <div style={{
                                                    width: 52, height: 52, borderRadius: 14,
                                                    background: G(isDark ? 0.14 : 0.08),
                                                    border: `1px solid ${G(isDark ? 0.25 : 0.18)}`,
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    color: isDark ? GOLD_BRIGHT : GOLD_DEEP, fontSize: 22,
                                                    margin: "0 auto 12px",
                                                }}>
                                                    <CameraOutlined />
                                                </div>
                                                <p style={{ fontFamily: "'Syne', sans-serif",
                                                    fontWeight: 700, fontSize: 13,
                                                    color: token.colorText, margin: "0 0 4px" }}>
                                                    Klik atau seret foto ke sini
                                                </p>
                                                <p style={{ fontSize: 11,
                                                    color: token.colorTextTertiary, margin: 0 }}>
                                                    JPG, PNG, WEBP · Maks. 5MB
                                                </p>
                                                <p style={{ fontSize: 10,
                                                    color: isDark ? G(0.50) : GOLD_DEEP,
                                                    margin: "8px 0 0", fontStyle: "italic" }}>
                                                    Foto membantu identifikasi fisik aset di lapangan
                                                </p>
                                            </div>
                                        </Dragger>

                                        {/* Tips */}
                                        <div style={{
                                            marginTop: 12, padding: "10px 12px", borderRadius: 10,
                                            background: isDark ? "rgba(37,99,235,0.08)" : "rgba(37,99,235,0.05)",
                                            border: "1px solid rgba(37,99,235,0.15)",
                                            display: "flex", alignItems: "flex-start", gap: 8,
                                        }}>
                                            <InfoCircleOutlined style={{ color: INFO, fontSize: 13,
                                                marginTop: 1, flexShrink: 0 }} />
                                            <p style={{ margin: 0, fontSize: 11,
                                                color: token.colorTextSecondary, lineHeight: 1.5 }}>
                                                Foto aset digunakan pada label QR, kartu inventaris PDF,
                                                dan direktori aset digital.
                                            </p>
                                        </div>
                                    </div>
                                </motion.div>

                                {/* ═════ INFO PANDUAN ═════ */}
                                <motion.div custom={5} variants={fadeUp}>
                                    <div style={{
                                        padding: "16px 18px", borderRadius: 16,
                                        background: isDark
                                            ? "linear-gradient(135deg, #0D0D1A, #111128)"
                                            : `linear-gradient(135deg, ${GOLD_DARK}, #3D2800)`,
                                        boxShadow: `0 6px 20px rgba(0,0,0,0.20), inset 0 0 0 1px ${G(0.20)}`,
                                        position: "relative", overflow: "hidden",
                                    }}>
                                        <div style={{
                                            position: "absolute", inset: 0,
                                            background: `linear-gradient(105deg, transparent 40%, ${G(0.06)} 60%, transparent 80%)`,
                                            pointerEvents: "none",
                                        }} />
                                        <div style={{ fontSize: 10, fontWeight: 800,
                                            color: "rgba(255,255,255,0.35)",
                                            letterSpacing: "0.14em", textTransform: "uppercase",
                                            marginBottom: 10 }}>
                                            Panduan Format Kode
                                        </div>
                                        {[
                                            { prefix:"ELK", desc:"Elektronik" },
                                            { prefix:"FRN", desc:"Furnitur & Perabot" },
                                            { prefix:"KND", desc:"Kendaraan" },
                                            { prefix:"GDG", desc:"Gedung & Bangunan" },
                                            { prefix:"OFC", desc:"Alat Kantor" },
                                        ].map((item) => (
                                            <div key={item.prefix} style={{
                                                display: "flex", alignItems: "center", gap: 8, marginBottom: 6,
                                            }}>
                                                <span style={{
                                                    fontFamily: "'DM Mono', monospace", fontWeight: 800,
                                                    fontSize: 11, color: GOLD_BRIGHT,
                                                    background: "rgba(255,255,255,0.08)",
                                                    padding: "1px 7px", borderRadius: 5,
                                                }}>
                                                    {item.prefix}
                                                </span>
                                                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.50)" }}>
                                                    —
                                                </span>
                                                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
                                                    {item.desc}
                                                </span>
                                            </div>
                                        ))}
                                        <div style={{
                                            marginTop: 10, paddingTop: 10,
                                            borderTop: "1px solid rgba(255,255,255,0.08)",
                                            fontSize: 10, color: "rgba(255,255,255,0.30)",
                                            fontStyle: "italic",
                                        }}>
                                            Contoh: ELK-2026-055 · FRN-2025-012
                                        </div>
                                    </div>
                                </motion.div>

                            </div>
                        </Col>
                    </Row>
                </Form>
            </Create>
        </motion.div>
    );
};
