import React from "react";
import { useTable } from "@refinedev/antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import { Tag, Space, Button, Typography, Tooltip, Avatar, theme, Spin } from "antd";
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
} from "@ant-design/icons";
import { ISantri } from "../../types";
import { useNavigation } from "@refinedev/core";
import { formatHijri, formatFullDate } from "../../utility/dateHelper";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { santriAlias } from "../../utility/privacy";
import { supabaseClient } from "../../utility/supabaseClient";

const { Text } = Typography;
const { useToken } = theme;

// ─────────────────────────── Types ───────────────────────────
type LatestHafalan = {
    santri_nis: string;
    tanggal: string | null;
    surat: string | null;
    ayat_awal: number | null;
    ayat_akhir: number | null;
    juz: number | null;
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
    return record.juz ? `Juz ${record.juz}` : "Belum ada setoran";
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

// ─────────────────────────── KPI Summary Bar ───────────────────────────
const KPISummaryBar: React.FC<{
    data: ISantri[];
    latestByNis: Record<string, LatestHafalan>;
    isDark: boolean;
    loading: boolean;
}> = ({ data, latestByNis, loading }) => {
    const total = data.length;
    const totalJuz = data.reduce((acc, s) => acc + totalNum(s.total_hafalan), 0);
    const avgJuz = total > 0 ? (totalJuz / total).toFixed(1) : "0";
    const topSantri = [...data].sort(
        (a, b) => totalNum(b.total_hafalan) - totalNum(a.total_hafalan)
    )[0];
    const sudahSetoran = Object.keys(latestByNis).length;

    const { token } = useToken();

    const stats = [
        {
            label: "Total Santri Aktif",
            value: loading ? "…" : total,
            icon: <TeamOutlined />,
            accent: "#2563EB",
            sub: "jurusan Tahfidz",
        },
        {
            label: "Rata-rata Hafalan",
            value: loading ? "…" : `${avgJuz} Juz`,
            icon: <ReadOutlined />,
            accent: "#047857",
            sub: "per santri",
        },
        {
            label: "Total Juz Terkumpul",
            value: loading ? "…" : `${totalJuz} Juz`,
            icon: <BookOutlined />,
            accent: "#7C3AED",
            sub: `dari ${total * 30} target`,
        },
        {
            label: "Sudah Setoran",
            value: loading ? "…" : sudahSetoran,
            icon: <RiseOutlined />,
            accent: "#D97706",
            sub: `dari ${total} santri`,
        },
        {
            label: "Hafalan Terbanyak",
            value: loading ? "…" : topSantri ? `${totalNum(topSantri.total_hafalan)} Juz` : "–",
            icon: <TrophyOutlined />,
            accent: "#DC2626",
            sub: topSantri
                ? topSantri.nama || santriAlias(topSantri.nis)
                : "–",
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
                </div>
            ))}
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
    const [latestByNis, setLatestByNis] = React.useState<Record<string, LatestHafalan>>({});
    const [loadingLatest, setLoadingLatest] = React.useState(false);

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
        supabaseClient
            .from("hafalan_tahfidz")
            .select("santri_nis,tanggal,surat,ayat_awal,ayat_akhir,juz")
            .in("santri_nis", nisList)
            .order("tanggal", { ascending: false })
            .order("id", { ascending: false })
            .then(({ data }) => {
                if (!mounted) return;
                const next: Record<string, LatestHafalan> = {};
                (data || []).forEach((item) => {
                    if (item.santri_nis && !next[item.santri_nis]) {
                        next[item.santri_nis] = item as LatestHafalan;
                    }
                });
                setLatestByNis(next);
                setLoadingLatest(false);
            });
        return () => { mounted = false; };
    }, [tableQueryResult?.data?.data]);

    // ── Export ──
    const exportProgres = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Progres Tahfidz");

        worksheet.mergeCells("A1:H1");
        const titleCell = worksheet.getCell("A1");
        titleCell.value = "PONDOK PESANTREN AL-HASANAH";
        titleCell.font = { name: "Arial", size: 16, bold: true, color: { argb: "FFB45309" } };
        titleCell.alignment = { vertical: "middle", horizontal: "center" };

        worksheet.mergeCells("A2:H2");
        worksheet.getCell("A2").value =
            "Jl. Raya Cibeuti No.13, Cibeuti, Kec. Kawalu, Tasikmalaya, Jawa Barat 46182";
        worksheet.getCell("A2").font = { name: "Arial", size: 10, italic: true };
        worksheet.getCell("A2").alignment = { horizontal: "center" };

        worksheet.addRow([]);
        worksheet.addRow([
            `LAPORAN CAPAIAN HAFALAN SANTRI - ${new Date().toLocaleDateString("id-ID")}`,
        ]).font = { bold: true };
        worksheet.addRow([]);

        const headerRow = worksheet.addRow([
            "NO", "NIS", "NAMA SANTRI", "KELAS", "PEMBIMBING",
            "TOTAL JUZ", "CAPAIAN TERAKHIR", "TANGGAL SETORAN TERAKHIR",
        ]);
        headerRow.eachCell((cell) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF59E0B" } };
            cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
            cell.alignment = { vertical: "middle", horizontal: "center" };
            cell.border = {
                top: { style: "thin" }, left: { style: "thin" },
                bottom: { style: "thin" }, right: { style: "thin" },
            };
        });

        const data = tableQueryResult?.data?.data || [];
        data.forEach((item, index) => {
            const latest = latestByNis[item.nis];
            const row = worksheet.addRow([
                index + 1,
                item.nis,
                (item.nama || santriAlias(item.nis)).toUpperCase(),
                item.kelas,
                item.pembimbing || "-",
                `${formatTotalHafalan(item.total_hafalan)} Juz`,
                formatLatestHafalan(latest),
                latest?.tanggal ?? "-",
            ]);
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: "thin", color: { argb: "FFE5E7EB" } },
                    left: { style: "thin", color: { argb: "FFE5E7EB" } },
                    bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
                    right: { style: "thin", color: { argb: "FFE5E7EB" } },
                };
                if (index % 2 !== 0)
                    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDF6E3" } };
            });
        });

        worksheet.autoFilter = "A6:H6";
        worksheet.views = [{ state: "frozen", ySplit: 6 }];
        [5, 14, 34, 8, 24, 10, 34, 18].forEach((w, i) => { worksheet.getColumn(i + 1).width = w; });

        const buffer = await workbook.xlsx.writeBuffer();
        const dateStr = new Date().toISOString().split("T")[0];
        saveAs(new Blob([buffer]), `Laporan_Capaian_Hafalan_Santri_${dateStr}.xlsx`);
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
                            onClick={exportProgres}
                            style={{
                                borderRadius: 8,
                                border: `1px solid ${token.colorBorderSecondary}`,
                                color: token.colorTextSecondary,
                                background: "transparent",
                            }}
                        >
                            Export Excel
                        </Button>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => push("/hafalan/create")}
                            style={{
                                background: "linear-gradient(135deg, #047857, #10B981)",
                                border: "none",
                                borderRadius: 8,
                                fontWeight: 600,
                            }}
                        >
                            Setoran Baru
                        </Button>
                    </Space>
                </div>
            </div>

            {/* ── KPI BAR ── */}
            <KPISummaryBar
                data={santriData}
                latestByNis={latestByNis}
                isDark={isDark}
                loading={tableQueryResult?.isLoading ?? true}
            />

            {/* ── TABLE ── */}
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
