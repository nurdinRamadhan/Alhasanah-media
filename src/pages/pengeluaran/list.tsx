import React, { useState, useMemo, useEffect, useRef } from "react";
import { useTable } from "@refinedev/antd";
import { logActivity } from "../../utility/logger";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import {
    Tag, Space, Button, Typography, Tooltip, Avatar, Modal, Form,
    Select, InputNumber, Input, message, DatePicker, Row, Col,
    Upload, Image, theme, Divider, Card
} from "antd";
import {
    PlusOutlined, DeleteOutlined, EditOutlined,
    UploadOutlined, ShoppingCartOutlined, UserOutlined,
    CalendarOutlined, FilterOutlined, WalletOutlined,
    ArrowDownOutlined, FireOutlined, BarChartOutlined,
    CheckCircleOutlined, ClockCircleOutlined,
    FileExcelOutlined, FilePdfOutlined, PieChartOutlined,
    ThunderboltOutlined
} from "@ant-design/icons";
import { useDelete, useCreate, useUpdate, useGetIdentity, CrudFilter } from "@refinedev/core";
import { useColorMode } from "../../contexts/color-mode";
import dayjs from "dayjs";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { supabaseClient } from "../../utility/supabaseClient";
import { IPengeluaran, IProfile } from "../../types";
import { formatHijri } from "../../utility/dateHelper";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { motion, AnimatePresence } from "framer-motion";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
    ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";

const { Text, Title } = Typography;
const { useToken } = theme;

// ═══════════════════════════════════
// KATEGORI & SCOPE CONFIG
// ═══════════════════════════════════
const KATEGORI_LIST = ["OPERASIONAL", "PENDIDIKAN", "SARANA", "KEGIATAN", "LAINNYA"] as const;

const KATEGORI_META: Record<string, { color: string; antColor: string; icon: string }> = {
    OPERASIONAL:  { color: "#4EA8F8", antColor: "blue",   icon: "⚙️" },
    PENDIDIKAN:   { color: "#7C3AED", antColor: "purple", icon: "📚" },
    SARANA:       { color: "#F09840", antColor: "orange", icon: "🏗️" },
    KEGIATAN:     { color: "#3DC97A", antColor: "cyan",   icon: "🎯" },
    LAINNYA:      { color: "#D4AF37", antColor: "gold",   icon: "📋" },
};

const SCOPE_LABEL: Record<string, { label: string; color: string }> = {
    "L-TAHFIDZ": { label: "Putra Tahfidz",  color: "#2563EB" },
    "L-KITAB":   { label: "Putra Kitab",    color: "#7C3AED" },
    "P-ALL":     { label: "Putri",           color: "#DC2626" },
};

const USER_SCOPE_LABEL = (u: IProfile | undefined): string => {
    if (!u || ["super_admin", "rois", "dewan"].includes(u.role)) return "Semua Unit";
    if (u.akses_gender === 'P') return "Putri";
    return `Putra ${u.akses_jurusan === 'ALL' ? '' : u.akses_jurusan}`.trim() || "Putra";
};

const IDR = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: "rgba(20, 20, 31, 0.9)",
            border: "1px solid rgba(201, 168, 76, 0.3)",
            borderRadius: "12px",
            padding: "12px 16px",
            backdropFilter: "blur(8px)",
        }}>
            <div style={{ fontSize: "10px", fontWeight: 800, color: "#999", textTransform: "uppercase", marginBottom: "4px" }}>{label}</div>
            <div style={{ fontSize: "14px", fontWeight: 800, color: "#C9A84C" }}>{IDR(payload[0].value)}</div>
        </div>
    );
};

// ═══════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════
export const PengeluaranList = () => {
    const { token } = useToken();
    const { data: user } = useGetIdentity<IProfile>();
    const { mutate: createMutate } = useCreate();
    const { mutate: updateMutate } = useUpdate();
    const { mutate: deleteMutate } = useDelete();

    const { mode } = useColorMode();
    const isDark = mode === "dark";

    // ── RBAC LOGIC (Scoping) ──────────────────────────
    const isDewan = user?.role === 'dewan';
    const isScopeFree = user?.role === 'super_admin' || user?.role === 'rois';

    const autoScope = useMemo(() => {
        if (!user || isScopeFree || isDewan) return null;
        if (user.akses_gender === 'P') return 'P-ALL';
        if (user.akses_gender === 'L' && user.akses_jurusan === 'TAHFIDZ') return 'L-TAHFIDZ';
        if (user.akses_gender === 'L' && user.akses_jurusan === 'KITAB') return 'L-KITAB';
        return null;
    }, [user, isScopeFree, isDewan]);

    const jurisdictionFilters = useMemo((): CrudFilter[] => {
        if (!user || isScopeFree || isDewan) return [];

        const filters: CrudFilter[] = [];
        if (user.akses_gender === 'P') {
            filters.push({ field: "scope_gender", operator: "eq", value: "P" });
        } else if (user.akses_gender === 'L') {
            filters.push({ field: "scope_gender", operator: "eq", value: "L" });
            if (user.akses_jurusan !== 'ALL') {
                filters.push({ field: "scope_jurusan", operator: "eq", value: user.akses_jurusan });
            }
        }
        return filters;
    }, [user, isScopeFree, isDewan]);

    // ── Stat Card Component (Premium Style) ──────────────────
    const PremiumStatCard = ({ title, arabic, value, sub, icon, accent, delay = 0 }: any) => (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.5 }} style={{ height: "100%" }}>
            <Card bordered={false} bodyStyle={{ padding: "20px" }}
                style={{ background: token.colorBgContainer, borderRadius: 16, height: "100%", boxShadow: isDark ? "0 8px 32px rgba(0,0,0,0.5)" : "0 4px 24px rgba(0,0,0,0.07)", border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.05)", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${accent}, transparent)` }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.2px", textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 8 }}>{title}</div>
                        <div style={{ fontSize: 24, fontWeight: 900, color: token.colorText, letterSpacing: "-1px" }}>{value}</div>
                        {arabic && <div style={{ fontSize: 11, color: "#C9A84C", direction: "rtl", marginTop: 4, fontWeight: 600 }}>{arabic}</div>}
                        {sub && <div style={{ fontSize: 11, color: token.colorTextSecondary, marginTop: 8 }}>{sub}</div>}
                    </div>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: accent }}>{icon}</div>
                </div>
            </Card>
        </motion.div>
    );

    // ── States ────────────────────────────────────────────────
    const [filterMonth,    setFilterMonth]    = useState<dayjs.Dayjs>(dayjs());
    const [filterKategori, setFilterKategori] = useState<string | null>(null);
    const [filterScope,    setFilterScope]    = useState<string>(() => autoScope || "ALL");
    const [isModalOpen,    setIsModalOpen]    = useState(false);
    const [modalMode,      setModalMode]      = useState<"CREATE" | "EDIT">("CREATE");
    const [editingItem,    setEditingItem]    = useState<IPengeluaran | any>(null);
    const [form]                              = Form.useForm();
    const [uploading,      setUploading]      = useState(false);
    const [buktiUrl,       setBuktiUrl]       = useState<string | null>(null);
    const [deleteConfirm,  setDeleteConfirm]  = useState<number | null>(null);

    // Auto-lock scope filter for restricted admins
    const prevAutoScope = useRef(autoScope);
    useEffect(() => {
        if (autoScope && autoScope !== prevAutoScope.current) {
            setFilterScope(autoScope);
        }
        prevAutoScope.current = autoScope;
    }, [autoScope]);

    // ── Table Data ────────────────────────────────────────────
    const { tableProps, tableQueryResult } = useTable<IPengeluaran>({
        resource: "pengeluaran",
        syncWithLocation: false,
        permanentFilter: jurisdictionFilters,
        filters: {
            mode: "server",
            initial: [
                { field: "tanggal_pengeluaran", operator: "gte", value: filterMonth.startOf("month").format("YYYY-MM-DD") },
                { field: "tanggal_pengeluaran", operator: "lte", value: filterMonth.endOf("month").format("YYYY-MM-DD") }
            ]
        },
        sorters: { initial: [{ field: "tanggal_pengeluaran", order: "desc" }] }
    });

    const scopeMatch = (item: IPengeluaran): boolean => {
        if (filterScope === "ALL") return true;
        if (filterScope === "P-ALL") return item.scope_gender === 'P';
        if (filterScope === "L-TAHFIDZ") return item.scope_gender === 'L' && item.scope_jurusan === 'TAHFIDZ';
        if (filterScope === "L-KITAB") return item.scope_gender === 'L' && item.scope_jurusan === 'KITAB';
        return true;
    };

    const filteredData = (tableQueryResult?.data?.data ?? []).filter(item =>
        (!filterKategori || item.kategori === filterKategori) && scopeMatch(item)
    );

    // ── Statistik Scoped ─────────────────────────────────────
    const totalBulanIni  = filteredData.reduce((a, c) => a + Number(c.nominal), 0);
    const totalHariIni   = filteredData.filter(i => dayjs(i.tanggal_pengeluaran).isSame(dayjs(), "day")).reduce((a, c) => a + Number(c.nominal), 0);
    const jumlahTransaksi = filteredData.length;
    const rataPerTransaksi = jumlahTransaksi > 0 ? totalBulanIni / jumlahTransaksi : 0;
    const transaksiTerbesar = filteredData.reduce((max, c) => Number(c.nominal) > max ? Number(c.nominal) : max, 0);

    // ── Chart Data ────────────────────────────────────────────
    const dailyChartData = useMemo(() => {
        const map: Record<string, number> = {};
        filteredData.forEach(d => {
            const key = dayjs(d.tanggal_pengeluaran).format("DD");
            map[key] = (map[key] || 0) + Number(d.nominal);
        });
        return Object.entries(map)
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([day, total]) => ({ day: `${day}/${filterMonth.format("MM")}`, total }));
    }, [filteredData, filterMonth]);

    const pieChartData = useMemo(() => {
        const map: Record<string, number> = {};
        filteredData.forEach(d => {
            map[d.kategori as string] = (map[d.kategori as string] || 0) + Number(d.nominal);
        });
        return Object.entries(map).map(([name, value]) => ({ name, value }));
    }, [filteredData]);

    // ── Handlers ──────────────────────────────────────────────
    const handleOpenCreate = () => {
        setModalMode("CREATE"); setEditingItem(null); setBuktiUrl(null);
        form.resetFields();
        const gender = isScopeFree ? undefined : (user?.akses_gender === 'ALL' ? 'ALL' : user?.akses_gender);
        const jurusan = isScopeFree ? undefined : (user?.akses_gender === 'P' ? 'ALL' : (user?.akses_jurusan === 'ALL' ? 'ALL' : user?.akses_jurusan));
        form.setFieldsValue({ 
            tanggal_pengeluaran: dayjs(), 
            kategori: "OPERASIONAL", 
            dicatat_oleh_nama: user?.full_name || user?.email,
            scope_gender: gender,
            scope_jurusan: jurusan,
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
            tanggal_pengeluaran: values.tanggal_pengeluaran ? dayjs(values.tanggal_pengeluaran).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"),
            bukti_url: buktiUrl || null,
            ...(modalMode === "CREATE" && { dicatat_oleh_id: user?.id, dicatat_oleh_nama: user?.full_name || user?.email })
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
        } catch (err) { console.error(err); message.error("Terjadi kesalahan"); }
    };

    const handleDelete = (id: number) => {
        deleteMutate({ resource: "pengeluaran", id });
        setDeleteConfirm(null);
        message.success("Data dihapus");
    };

    // ── Columns ───────────────────────────────────────────────
    const columns: ProColumns<IPengeluaran>[] = [
        {
            title: "Tanggal", dataIndex: "tanggal_pengeluaran", width: 120,
            render: (val) => (
                <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{dayjs(val as string).format("DD MMM YYYY")}</div>
                    <div style={{ fontSize: 10, color: "#999" }}>{formatHijri(val as string)}</div>
                </div>
            )
        },
        {
            title: "Detail Pengeluaran", dataIndex: "judul",
            render: (_, r) => (
                <div>
                    <Text strong style={{ fontSize: 14 }}>{r.judul}</Text>
                    <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                        <Tag color="default" style={{ fontSize: 9 }}>{r.scope_gender === 'P' ? 'PUTRI' : 'PUTRA'}</Tag>
                        {r.scope_gender === 'L' && <Tag color="purple" style={{ fontSize: 9 }}>{r.scope_jurusan}</Tag>}
                    </div>
                </div>
            )
        },
        {
            title: "Kategori", dataIndex: "kategori", width: 140,
            render: (val: any) => {
                const meta = KATEGORI_META[val as string] || { color: "#999", antColor: "default", icon: "📌" };
                return <Tag color={meta.antColor} icon={<span>{meta.icon}</span>}>{val}</Tag>;
            }
        },
        {
            title: "Nominal", dataIndex: "nominal", width: 165, align: "right",
            render: (val) => <Text strong style={{ color: "#DC2626", fontVariantNumeric: "tabular-nums" }}>{IDR(Number(val) || 0)}</Text>
        },
        {
            title: "Bukti", dataIndex: "bukti_url", width: 72, align: "center",
            render: (val: any) => val ? (
                <Image src={String(val)} width={32} height={32} style={{ borderRadius: 6, objectFit: "cover" }} />
            ) : "—"
        },
        {
            title: "Aksi", valueType: "option", width: 90, align: "center",
            render: (_, record) => !isDewan ? (
                <Space>
                    <Button size="small" type="text" icon={<EditOutlined />} onClick={() => handleOpenEdit(record)} />
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => setDeleteConfirm(record.id as number)} />
                </Space>
            ) : null
        }
    ];

    return (
        <div style={{ padding: "0 4px" }}>
            {/* PAGE HEADER */}
            <div style={{ padding: "20px 24px", background: token.colorBgContainer, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14, marginBottom: 20, border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 50, height: 50, borderRadius: 13, background: "linear-gradient(135deg,#B45309 0%,#F59E0B 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#fff" }}><WalletOutlined /></div>
                    <div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: token.colorText, display: "flex", alignItems: "center", gap: 10 }}>
                            Kas Keluar
                            {!isDewan && (
                                <Tag color="default" style={{ fontSize: 10, fontWeight: 700, borderRadius: 99, margin: 0 }}>
                                    {USER_SCOPE_LABEL(user)}
                                </Tag>
                            )}
                        </div>
                        <div style={{ fontSize: 11, color: token.colorTextSecondary }}>Monitoring Pengeluaran Unit Terfilter</div>
                    </div>
                </div>
                <Space>
                    <Button icon={<FilePdfOutlined />} onClick={() => message.info("Feature coming soon")}>PDF</Button>
                    {!isDewan && (
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate} style={{ background: "linear-gradient(135deg,#B45309 0%,#F59E0B 100%)", border: "none", fontWeight: 700 }}>Catat Pengeluaran</Button>
                    )}
                </Space>
            </div>

            {/* STATS */}
            <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                <Col xs={24} sm={12} xl={6}><PremiumStatCard title="Total Keluar" value={IDR(totalBulanIni)} sub={SCOPE_LABEL[filterScope]?.label || filterMonth.format("MMMM YYYY")} icon={<WalletOutlined />} accent="#E8685A" /></Col>
                <Col xs={24} sm={12} xl={6}><PremiumStatCard title="Keluar Hari Ini" value={IDR(totalHariIni)} sub={dayjs().format("DD MMM")} icon={<ClockCircleOutlined />} accent="#F09840" /></Col>
                <Col xs={24} sm={12} xl={6}><PremiumStatCard title="Transaksi" value={`${jumlahTransaksi} Trx`} sub="Volume Bulan Ini" icon={<BarChartOutlined />} accent="#4EA8F8" /></Col>
                <Col xs={24} sm={12} xl={6}><PremiumStatCard title="Terbesar" value={IDR(transaksiTerbesar)} sub="Rekor Nominal" icon={<FireOutlined />} accent="#B07CF0" /></Col>
            </Row>

            {/* CHARTS */}
            <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                <Col xs={24} xl={16}>
                    <Card title={`Tren Pengeluaran ${filterScope !== "ALL" ? `• ${SCOPE_LABEL[filterScope]?.label || ""}` : "Unit"}`} bordered={false} style={{ borderRadius: 16 }}>
                        <div style={{ height: 260 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={dailyChartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                    <XAxis dataKey="day" />
                                    <YAxis tickFormatter={v => `${v/1000}k`} />
                                    <ReTooltip content={<CustomBarTooltip />} />
                                    <Bar dataKey="total" fill="#C9A84C" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </Col>
                <Col xs={24} xl={8}>
                    <Card title={`Distribusi ${filterScope !== "ALL" ? `• ${SCOPE_LABEL[filterScope]?.label || ""}` : "Kategori"}`} bordered={false} style={{ borderRadius: 16, height: "100%" }}>
                        <div style={{ height: 260 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={pieChartData} innerRadius={60} outerRadius={80} dataKey="value">
                                        {pieChartData.map((entry, i) => <Cell key={i} fill={KATEGORI_META[entry.name]?.color || "#C9A84C"} />)}
                                    </Pie>
                                    <ReTooltip formatter={v => IDR(Number(v))} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </Col>
            </Row>

            {/* FILTER & TABLE */}
            <Card style={{ marginBottom: 16, borderRadius: 16 }}>
                <Row gutter={16} align="bottom">
                    <Col xs={24} sm={8} lg={6}>
                        <Text type="secondary" strong style={{ fontSize: 10 }}>PERIODE BULAN</Text>
                        <DatePicker.MonthPicker value={filterMonth} onChange={val => setFilterMonth(val || dayjs())} style={{ width: "100%", marginTop: 4 }} allowClear={false} />
                    </Col>
                    <Col xs={24} sm={8} lg={6}>
                        <Text type="secondary" strong style={{ fontSize: 10 }}>KATEGORI</Text>
                        <Select placeholder="Semua" options={KATEGORI_LIST.map(k => ({ label: k, value: k }))} onChange={setFilterKategori} style={{ width: "100%", marginTop: 4 }} allowClear />
                    </Col>
                    {isScopeFree && (
                        <Col xs={24} sm={8} lg={6}>
                            <Text type="secondary" strong style={{ fontSize: 10 }}>SCOPE UNIT</Text>
                            <Select value={filterScope} onChange={setFilterScope} style={{ width: "100%", marginTop: 4 }}>
                                <Select.Option value="ALL">Semua Unit</Select.Option>
                                <Select.Option value="L-TAHFIDZ">Putra Tahfidz</Select.Option>
                                <Select.Option value="L-KITAB">Putra Kitab</Select.Option>
                                <Select.Option value="P-ALL">Putri</Select.Option>
                            </Select>
                        </Col>
                    )}
                </Row>
            </Card>

            <div style={{ background: token.colorBgContainer, borderRadius: 16, border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.05)", overflow: "hidden" }}>
                <ProTable<IPengeluaran>
                    {...tableProps}
                    dataSource={filteredData}
                    columns={columns}
                    rowKey="id"
                    search={false}
                    pagination={{ pageSize: 10 }}
                    headerTitle={`Rincian Pengeluaran ${filterScope !== "ALL" ? `• ${SCOPE_LABEL[filterScope]?.label || ""}` : "Unit"}`}
                />
            </div>

            {/* MODAL CREATE/EDIT */}
            <Modal open={isModalOpen} onCancel={() => setIsModalOpen(false)} footer={null} centered width={600} title={modalMode === "CREATE" ? "Catat Kas Keluar" : "Edit Data"}>
                <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ padding: "20px 0" }}>
                    <Row gutter={16}>
                        <Col span={12}><Form.Item label="Tanggal" name="tanggal_pengeluaran" rules={[{ required: true }]}><DatePicker style={{ width: "100%" }} /></Form.Item></Col>
                        <Col span={12}><Form.Item label="Kategori" name="kategori" rules={[{ required: true }]}><Select options={KATEGORI_LIST.map(k => ({ label: k, value: k }))} /></Form.Item></Col>
                    </Row>
                    
                    <Divider orientation="left" style={{ fontSize: 10 }}>Scoping Dana (Unit)</Divider>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item label="Target Gender" name="scope_gender" rules={[{ required: true }]}>
                                <Select disabled={!isScopeFree && user?.akses_gender !== 'ALL'} options={[{ label: 'PUTRA', value: 'L' }, { label: 'PUTRI', value: 'P' }, { label: 'GLOBAL', value: 'ALL' }]} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Target Takhasus" name="scope_jurusan" rules={[{ required: true }]}>
                                <Select disabled={!isScopeFree && (user?.akses_gender === 'P' || user?.akses_jurusan !== 'ALL')} options={[{ label: 'KITAB', value: 'KITAB' }, { label: 'TAHFIDZ', value: 'TAHFIDZ' }, { label: 'GLOBAL', value: 'ALL' }]} />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item label="Judul / Keperluan" name="judul" rules={[{ required: true }]}><Input placeholder="Misal: Beli Alat Tulis Kantor" /></Form.Item>
                    <Form.Item label="Nominal (Rp)" name="nominal" rules={[{ required: true }]}><InputNumber style={{ width: "100%" }} formatter={v => `Rp ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")} parser={v => v?.replace(/\Rp\s?|(\.*)/g, "") as any} /></Form.Item>
                    <Form.Item label="Keterangan" name="keterangan"><Input.TextArea rows={2} /></Form.Item>
                    
                    <Form.Item label="Bukti Nota">
                        <Upload customRequest={handleUpload} showUploadList={false}><Button icon={<UploadOutlined />}>Pilih Foto</Button></Upload>
                        {buktiUrl && <div style={{ marginTop: 10 }}><Image src={buktiUrl} height={60} /></div>}
                    </Form.Item>

                    <div style={{ textAlign: "right", marginTop: 20 }}>
                        <Button onClick={() => setIsModalOpen(false)} style={{ marginRight: 8 }}>Batal</Button>
                        <Button type="primary" htmlType="submit">Simpan Data</Button>
                    </div>
                </Form>
            </Modal>

            <Modal open={deleteConfirm !== null} onCancel={() => setDeleteConfirm(null)} onOk={() => handleDelete(deleteConfirm!)} okText="Ya, Hapus" cancelText="Batal" okButtonProps={{ danger: true }} title="Konfirmasi Hapus" centered width={300}>
                <p>Hapus pengeluaran ini?</p>
            </Modal>
        </div>
    );
};
