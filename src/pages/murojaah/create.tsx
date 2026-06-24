import React, { useState, useEffect } from "react";
import { logActivity } from "../../utility/logger";
import { useSelect } from "@refinedev/antd";
import { Form, Input, Select, DatePicker, Card, Row, Col, InputNumber, Radio, Divider, Segmented, Typography, Tag, Button, theme, Space, message } from "antd";
import dayjs from "dayjs";
import { ISantri, IProfile } from "../../types";
import { useGetIdentity } from "@refinedev/core";
import { DATA_SURAT } from "../../utility/quran-data";
import { ArrowLeftOutlined, EditOutlined, CheckCircleFilled } from "@ant-design/icons";
import { formatHijri } from "../../utility/dateHelper";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabaseClient } from "../../utility/supabaseClient";

const { Text, Title } = Typography;
const { useToken } = theme;

const STATUS_ABSENSI = [
  { key: 'HADIR',   label: 'Hadir',       icon: '✅', color: '#16A34A', bg: 'rgba(22,163,74,0.10)' },
  { key: 'SAKIT',   label: 'Sakit',       icon: '🤒', color: '#D97706', bg: 'rgba(217,119,6,0.10)' },
  { key: 'GHAIB',   label: 'Ghaib',       icon: '❌', color: '#DC2626', bg: 'rgba(220,38,38,0.10)' },
  { key: 'SEKOLAH', label: 'Sekolah',     icon: '🏫', color: '#2563EB', bg: 'rgba(37,99,235,0.10)' },
  { key: 'PULANG',  label: 'Pulang',      icon: '🏠', color: '#9333EA', bg: 'rgba(147,51,234,0.10)' },
];

export const MurojaahCreate = () => {
    const { token } = useToken();
    const hexLum = (hex: string) => {
        const c = hex.replace("#", "");
        if (c.length < 6) return 200;
        return .299 * parseInt(c.slice(0, 2), 16) + .587 * parseInt(c.slice(2, 4), 16) + .114 * parseInt(c.slice(4, 6), 16);
    };
    const isDark = hexLum(token.colorBgContainer) < 128;

    const [form] = Form.useForm();
    const { data: user } = useGetIdentity<IProfile>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [inputType, setInputType] = useState<'SURAT' | 'HALAMAN'>('SURAT');
    const [absensiStatus, setAbsensiStatus] = useState('HADIR');
    const [isSetter, setIsSetter] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [statusSetoran, setStatusSetoran] = useState<string>('LANCAR');
    const [jenisMurojaah, setJenisMurojaah] = useState<string>('SABAQ');
    const [penyimakOptions, setPenyimakOptions] = useState<IProfile[]>([]);
    const selectedDate = Form.useWatch("tanggal", form);
    const selectedSantriNis = Form.useWatch("santri_nis", form);

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
        const nisFromUrl = searchParams.get("nis");
        if (nisFromUrl && !form.getFieldValue("santri_nis")) {
            form.setFieldValue("santri_nis", nisFromUrl);
        }
    }, [form, searchParams]);

    // Auto-fill penyimak when santri selected
    React.useEffect(() => {
        if (!selectedSantriNis || !user) return;
        supabaseClient
            .from("santri")
            .select("penyimak_mode, pembimbing")
            .eq("nis", selectedSantriNis)
            .maybeSingle()
            .then(({ data }) => {
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
    }, [selectedSantriNis, user, penyimakOptions, form]);

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

    const juzOptions = Array.from({length: 30}, (_, i) => ({ label: `Juz ${i + 1}`, value: i + 1 }));

    const labelStyle: React.CSSProperties = {
        fontWeight: 600,
        fontSize: 13,
        color: token.colorText,
    };

    const [manualSesiWaktu, setManualSesiWaktu] = useState<'PAGI' | 'SIANG' | null>(null);

    const onFinishHandler = async (values: any) => {
        if (submitting) return;
        setSubmitting(true);
        try {
            const today = dayjs(values.tanggal).format('YYYY-MM-DD');
            const sesiWaktu = manualSesiWaktu || (dayjs(values.tanggal).hour() < 12 ? 'PAGI' : 'SIANG');

            const { data: sesiList } = await supabaseClient
                .from("tahfidz_sesi")
                .select("id")
                .eq("tanggal", today)
                .eq("kegiatan_id", "MUROJAAH")
                .eq("sesi", sesiWaktu)
                .eq("status", "OPEN")
                .limit(1);

            let sesi = sesiList && sesiList.length > 0 ? sesiList[0] : null;
            if (!sesi) {
                const { data: newSesi } = await supabaseClient
                    .from("tahfidz_sesi")
                    .insert({ kegiatan_id: "MUROJAAH", tanggal: today, sesi: sesiWaktu, created_by: user?.id })
                    .select("id")
                    .single();
                sesi = newSesi;
            }

            const { data: absensi, error: absensiError } = await supabaseClient
                .from("tahfidz_absensi")
                .upsert({
                    sesi_id: sesi!.id,
                    santri_nis: values.santri_nis,
                    status: absensiStatus,
                    setoran: isSetter && absensiStatus === 'HADIR',
                    penyimak_id: absensiStatus === 'HADIR' ? (values.penyimak_id || user?.id) : null,
                    keterangan: absensiStatus !== 'HADIR' ? (values.keterangan_absensi || STATUS_ABSENSI.find(s => s.key === absensiStatus)?.label) : null,
                    created_by: user?.id,
                }, { onConflict: "sesi_id, santri_nis" })
                .select("id")
                .single();

            if (absensiError) throw absensiError;

            if (absensiStatus === 'HADIR' && isSetter) {
                const { error: murojaahError } = await supabaseClient
                    .from("murojaah_tahfidz")
                    .upsert({
                        santri_nis: values.santri_nis,
                        tanggal: values.tanggal,
                        jenis_murojaah: jenisMurojaah,
                        juz: values.juz,
                        surat: values.surat || null,
                        ayat_awal: values.ayat_awal || null,
                        ayat_akhir: values.ayat_akhir || null,
                        halaman_awal: values.halaman_awal || null,
                        halaman_akhir: values.halaman_akhir || null,
                        predikat: values.predikat,
                        catatan: values.catatan || null,
                        dicatat_oleh_id: user?.id,
                        absensi_id: absensi.id,
                        status_setoran: statusSetoran,
                        alasan_tolak: statusSetoran === 'MENGULANG' ? values.alasan_tolak : null,
                    }, { onConflict: "absensi_id" });

                if (murojaahError) throw murojaahError;

                message.success("Setoran & Absensi Murojaah berhasil dicatat");
                navigate("/murojaah");
            } else {
                message.success(`Absensi ${STATUS_ABSENSI.find(s => s.key === absensiStatus)?.label} berhasil dicatat`);
                navigate("/murojaah");
            }
        } catch (err: any) {
            message.error(err.message || "Gagal menyimpan data");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{ background: token.colorBgLayout, minHeight: "100vh", padding: "20px 20px 80px" }}>

            {/* ── Page Header ── */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Button
                        icon={<ArrowLeftOutlined />}
                        onClick={() => navigate("/murojaah")}
                        style={{
                            background: "transparent",
                            border: `1px solid ${token.colorBorderSecondary}`,
                            color: token.colorTextSecondary,
                            borderRadius: 8,
                        }}
                    />
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{
                                width: 32, height: 32, borderRadius: 8,
                                background: "linear-gradient(135deg, #047857, #10B981)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                color: "#fff", fontSize: 14,
                            }}>
                                <EditOutlined />
                            </div>
                            <Title level={4} style={{ margin: 0, color: token.colorText }}>
                                Input Murojaah Baru
                            </Title>
                        </div>
                        <Text style={{ fontSize: 12, color: token.colorTextSecondary, marginLeft: 40 }}>
                            Catat setoran murojaah santri tahfidz
                        </Text>
                    </div>
                </div>
            </div>

            <Form
                form={form}
                layout="vertical"
                onFinish={onFinishHandler}
                initialValues={{
                    tanggal: dayjs(),
                    dicatat_oleh_id: user?.id,
                    predikat: "MUMTAZ",
                }}
            >
                <Form.Item name="dicatat_oleh_id" hidden><Input /></Form.Item>

                <Row gutter={24}>
                    <Col xs={24} lg={10}>
                        <div style={{
                            background: token.colorBgContainer,
                            border: `1px solid ${token.colorBorderSecondary}`,
                            borderRadius: 16,
                            padding: "24px",
                            marginBottom: 16,
                        }}>
                            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: token.colorText }}>
                                📋 Identitas & Absensi
                            </div>
                            <Text style={{ fontSize: 12, color: token.colorTextSecondary, display: "block", marginBottom: 16 }}>
                                Pilih santri & status absensi
                            </Text>

                            <Form.Item
                                label={<span style={labelStyle}>Nama Santri</span>}
                                name="santri_nis"
                                rules={[{ required: true, message: "Pilih santri terlebih dahulu" }]}
                                style={{ marginBottom: 16 }}
                            >
                                <Select {...santriSelectProps} showSearch placeholder="Cari nama atau NIS santri..." size="large" style={{ borderRadius: 8 }} />
                            </Form.Item>

                            <Form.Item
                                label={<span style={labelStyle}>Waktu</span>}
                                name="tanggal"
                                rules={[{ required: true }]}
                                getValueProps={(v) => ({ value: v ? dayjs(v) : "" })}
                                style={{ marginBottom: 16 }}
                                help={
                                    selectedDate && (
                                        <Text style={{ fontSize: 11, color: token.colorTextSecondary }}>
                                            Bertepatan dengan: <b>{formatHijri(selectedDate)}</b>
                                        </Text>
                                    )
                                }
                            >
                                <DatePicker showTime format="DD MMM YYYY HH:mm" style={{ width: '100%' }} size="large" />
                            </Form.Item>

                            <div style={{ marginTop: 12, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
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

                            <Divider style={{ borderColor: isDark ? "#1E293B" : "#F1F5F9", margin: "16px 0" }} />

                            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: token.colorText }}>
                                Status Absensi
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                                {STATUS_ABSENSI.map(s => {
                                    const active = absensiStatus === s.key;
                                    return (
                                        <Tag
                                            key={s.key}
                                            onClick={() => setAbsensiStatus(s.key)}
                                            style={{
                                                padding: "6px 12px",
                                                borderRadius: 8,
                                                cursor: "pointer",
                                                fontSize: 12,
                                                fontWeight: active ? 700 : 400,
                                                border: `1.5px solid ${active ? s.color : token.colorBorder}`,
                                                background: active ? s.bg : "transparent",
                                                color: active ? s.color : token.colorTextTertiary,
                                                margin: 0,
                                                transition: "all 0.12s",
                                            }}
                                        >
                                            {s.icon} {s.label}
                                        </Tag>
                                    );
                                })}
                            </div>

                            {absensiStatus === 'HADIR' && (
                                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                                    <Tag
                                        onClick={() => setIsSetter(true)}
                                        style={{
                                            padding: "6px 16px", borderRadius: 8, cursor: "pointer", fontSize: 12,
                                            fontWeight: isSetter ? 700 : 400,
                                            border: `1.5px solid ${isSetter ? '#16A34A' : token.colorBorder}`,
                                            background: isSetter ? 'rgba(22,163,74,0.10)' : 'transparent',
                                            color: isSetter ? '#16A34A' : token.colorTextTertiary, margin: 0,
                                        }}
                                    >
                                        ✅ Setor
                                    </Tag>
                                    <Tag
                                        onClick={() => setIsSetter(false)}
                                        style={{
                                            padding: "6px 16px", borderRadius: 8, cursor: "pointer", fontSize: 12,
                                            fontWeight: !isSetter ? 700 : 400,
                                            border: `1.5px solid ${!isSetter ? '#DC2626' : token.colorBorder}`,
                                            background: !isSetter ? 'rgba(220,38,38,0.10)' : 'transparent',
                                            color: !isSetter ? '#DC2626' : token.colorTextTertiary, margin: 0,
                                        }}
                                    >
                                        🚫 Tidak Setor
                                    </Tag>
                                </div>
                            )}

                            {absensiStatus === 'HADIR' && (
                                <Form.Item
                                    label={<span style={{ ...labelStyle, fontSize: 11 }}>Penyimak</span>}
                                    name="penyimak_id"
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
                                        options={penyimakOptions.map(p => ({
                                            label: p.full_name || p.id,
                                            value: p.id,
                                        }))}
                                    />
                                </Form.Item>
                            )}

                            {absensiStatus !== 'HADIR' && (
                                <div style={{ marginTop: 12 }}>
                                    {absensiStatus === 'GHAIB' && (
                                        <Form.Item
                                            name="keterangan_absensi"
                                            label={<span style={{ ...labelStyle, fontSize: 11 }}>Alasan Ghaib</span>}
                                            rules={[{ required: true, message: "Harap isi alasan ghaib" }]}
                                            style={{ marginBottom: 0 }}
                                        >
                                            <Input.TextArea rows={2} placeholder="Contoh: pulang kampung, sakit, izin..." style={{ borderRadius: 8, resize: "none" }} />
                                        </Form.Item>
                                    )}
                                </div>
                            )}
                        </div>
                    </Col>

                    <Col xs={24} lg={14}>
                        {absensiStatus === 'HADIR' && isSetter ? (
                            <Card title="Capaian Pengulangan" bordered={false} className="shadow-sm mb-6">
                                <div style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}>
                                    <Segmented
                                        value={jenisMurojaah}
                                        onChange={(v) => setJenisMurojaah(v as string)}
                                        options={[
                                            { value: 'SABAQ', label: '📖 SABAQ' },
                                            { value: 'MANZIL', label: '📚 MANZIL' },
                                        ]}
                                        size="large"
                                    />
                                </div>

                                <Form.Item label="Target Juz" name="juz" rules={[{ required: true }]}>
                                    <Select options={juzOptions} placeholder="Pilih Juz" size="large" style={{ borderRadius: 8 }} />
                                </Form.Item>

                                <Divider dashed>Detail Cakupan</Divider>

                                <div className="mb-4 flex justify-center">
                                    <Segmented
                                        options={[
                                            { label: 'Per Surat', value: 'SURAT' },
                                            { label: 'Per Halaman', value: 'HALAMAN' }
                                        ]}
                                        value={inputType}
                                        onChange={(val) => setInputType(val as any)}
                                    />
                                </div>

                                {inputType === 'SURAT' ? (
                                    <>
                                        <Form.Item label={<span style={labelStyle}>Nama Surat</span>} name="surat">
                                            <Select
                                                showSearch
                                                options={DATA_SURAT.map(s => ({ label: s.nama, value: s.nama }))}
                                                placeholder="Pilih Surat..."
                                                size="large"
                                                style={{ borderRadius: 8 }}
                                            />
                                        </Form.Item>
                                        <Row gutter={16}>
                                            <Col span={12}>
                                                <Form.Item label={<span style={labelStyle}>Ayat Awal</span>} name="ayat_awal">
                                                    <InputNumber style={{ width: '100%', borderRadius: 8 }} size="large" />
                                                </Form.Item>
                                            </Col>
                                            <Col span={12}>
                                                <Form.Item label={<span style={labelStyle}>Ayat Akhir</span>} name="ayat_akhir">
                                                    <InputNumber style={{ width: '100%', borderRadius: 8 }} size="large" />
                                                </Form.Item>
                                            </Col>
                                        </Row>
                                    </>
                                ) : (
                                    <Row gutter={16}>
                                        <Col span={12}>
                                            <Form.Item label={<span style={labelStyle}>Halaman Awal (1-604)</span>} name="halaman_awal">
                                                <InputNumber min={1} max={604} style={{ width: '100%', borderRadius: 8 }} size="large" placeholder="Hal..." />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item label={<span style={labelStyle}>Halaman Akhir</span>} name="halaman_akhir">
                                                <InputNumber min={1} max={604} style={{ width: '100%', borderRadius: 8 }} size="large" placeholder="Hal..." />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                )}

                                <Divider dashed />

                                <Form.Item label={<span style={labelStyle}>Kelancaran (Predikat)</span>} name="predikat">
                                    <Radio.Group buttonStyle="solid" className="w-full" size="large">
                                        <Radio.Button value="MUMTAZ" className="w-1/3 text-center">Mumtaz</Radio.Button>
                                        <Radio.Button value="JAYYID" className="w-1/3 text-center">Jayyid</Radio.Button>
                                        <Radio.Button value="KURANG" className="w-1/3 text-center">Kurang</Radio.Button>
                                    </Radio.Group>
                                </Form.Item>

                                <div style={{ marginBottom: 16 }}>
                                    <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6, color: token.colorTextSecondary }}>Status Setoran</div>
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <Tag
                                            color="success"
                                            onClick={() => setStatusSetoran('LANCAR')}
                                            style={{
                                                padding: "6px 16px", borderRadius: 8, cursor: "pointer", fontSize: 12,
                                                fontWeight: statusSetoran === 'LANCAR' ? 700 : 400,
                                                border: `1.5px solid ${statusSetoran === 'LANCAR' ? '#16A34A' : token.colorBorder}`,
                                                background: statusSetoran === 'LANCAR' ? 'rgba(22,163,74,0.10)' : 'transparent',
                                                color: statusSetoran === 'LANCAR' ? '#16A34A' : token.colorTextTertiary, margin: 0,
                                            }}
                                        >
                                            ✅ Lancar
                                        </Tag>
                                        <Tag
                                            color="warning"
                                            onClick={() => setStatusSetoran('MENGULANG')}
                                            style={{
                                                padding: "6px 16px", borderRadius: 8, cursor: "pointer", fontSize: 12,
                                                fontWeight: statusSetoran === 'MENGULANG' ? 700 : 400,
                                                border: `1.5px solid ${statusSetoran === 'MENGULANG' ? '#D97706' : token.colorBorder}`,
                                                background: statusSetoran === 'MENGULANG' ? 'rgba(217,119,6,0.10)' : 'transparent',
                                                color: statusSetoran === 'MENGULANG' ? '#D97706' : token.colorTextTertiary, margin: 0,
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
                                            <Input.TextArea rows={2} placeholder="Alasan murojaah ditolak..." style={{ borderRadius: 8, resize: "none" }} />
                                        </Form.Item>
                                    )}
                                </div>

                                <Form.Item label={<span style={labelStyle}>Catatan</span>} name="catatan">
                                    <Input.TextArea rows={2} style={{ borderRadius: 8 }} />
                                </Form.Item>
                            </Card>
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
                                    {absensiStatus === 'HADIR' ? 'Tidak Ada Setoran' : STATUS_ABSENSI.find(s => s.key === absensiStatus)?.label}
                                </div>
                                <div style={{ fontSize: 13, color: token.colorTextSecondary }}>
                                    {absensiStatus === 'HADIR'
                                        ? 'Santri hadir tapi tidak menyetorkan murojaah. Hanya absensi yang dicatat.'
                                        : `Absensi dicatat sebagai "${STATUS_ABSENSI.find(s => s.key === absensiStatus)?.label}". Tidak ada data murojaah.`}
                                </div>
                            </div>
                        )}
                    </Col>
                </Row>

                {/* ── Save Button ── */}
                <div style={{
                    position: "sticky", bottom: 0, marginTop: 24,
                    display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12,
                    background: token.colorBgLayout, padding: "16px 0",
                    borderTop: `1px solid ${token.colorBorderSecondary}`,
                }}>
                    <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>
                        {absensiStatus === 'HADIR' && isSetter
                            ? 'Pastikan semua data setoran sudah benar'
                            : 'Absensi akan dicatat tanpa data setoran'}
                    </Text>
                    <Button
                        onClick={() => navigate("/murojaah")}
                        style={{ borderRadius: 8, border: `1px solid ${token.colorBorderSecondary}`, color: token.colorTextSecondary, background: "transparent" }}
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
                            border: "none", borderRadius: 8, fontWeight: 700,
                            paddingLeft: 24, paddingRight: 24,
                        }}
                    >
                        {absensiStatus === 'HADIR' && isSetter ? 'Simpan Setoran' : 'Simpan Absensi'}
                    </Button>
                </div>
            </Form>
        </div>
    );
};
