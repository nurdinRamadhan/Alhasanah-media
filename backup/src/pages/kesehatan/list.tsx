import React, { useState, useMemo } from "react";
import { logActivity } from "../../utility/logger";
import { useTable, useSelect } from "@refinedev/antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import {
    Space, Button, Typography, Tooltip, message, Modal,
    Select, Avatar, Card, Row, Col, Tag, DatePicker,
    Progress, Popconfirm, theme, Divider, Badge,
} from "antd";
import {
    PlusOutlined, MedicineBoxOutlined, DeleteOutlined,
    EditOutlined, DownloadOutlined, UserOutlined,
    FileExcelOutlined, CalendarOutlined, FilterOutlined,
    HeartOutlined, ExperimentOutlined, TeamOutlined,
    AlertOutlined, CheckCircleOutlined, ClockCircleOutlined,
    BarChartOutlined, SyncOutlined, FileTextOutlined,
    ThunderboltOutlined,
} from "@ant-design/icons";
import { IKesehatanSantri, ISantri } from "../../types";
import { useNavigation, useDelete, useGetIdentity } from "@refinedev/core";
import { formatHijri, formatMasehi } from "../../utility/dateHelper";
import dayjs from "dayjs";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { supabaseClient } from "../../utility/supabaseClient";
import { useColorMode } from "../../contexts/color-mode";

const { Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;
const { useToken } = theme;

// ─────────────────────────────────────────────────────────────
//  MEDICAL DESIGN TOKENS
// ─────────────────────────────────────────────────────────────
// Teal/medical green sebagai primary medical color — beda dari gold
// agar nuansa UKS/klinis terasa, tapi shell tetap gold premium
const MED = {
    primary:   "#0D9488",   // teal-600
    primaryBg: "rgba(13,148,136,0.08)",
    primaryBorder: "rgba(13,148,136,0.22)",
    primaryGrad: "linear-gradient(135deg,#134E4A 0%,#0D9488 55%,#2DD4BF 100%)",
    accent:    "#0891B2",   // cyan-600  
    accentBg:  "rgba(8,145,178,0.08)",
    accentBorder: "rgba(8,145,178,0.22)",
    danger:    "#DC2626",
    dangerBg:  "rgba(220,38,38,0.08)",
    dangerBorder: "rgba(220,38,38,0.22)",
    dangerGrad: "linear-gradient(135deg,#7F1D1D 0%,#DC2626 55%,#F87171 100%)",
    warn:      "#D97706",
    warnBg:    "rgba(217,119,6,0.09)",
    warnBorder:"rgba(217,119,6,0.28)",
    warnGrad:  "linear-gradient(135deg,#78350F 0%,#D97706 55%,#F59E0B 100%)",
    purple:    "#7C3AED",
    purpleBg:  "rgba(124,58,237,0.08)",
    purpleBorder: "rgba(124,58,237,0.22)",
    purpleGrad:"linear-gradient(135deg,#4C1D95 0%,#7C3AED 55%,#A78BFA 100%)",
};

// ─────────────────────────────────────────────────────────────
//  COMPONENT
// ─────────────────────────────────────────────────────────────
export const KesehatanList = () => {
    const { token } = useToken();
    const { mode } = useColorMode();
    const isDark = mode === "dark";
    const { data: user } = useGetIdentity();
    const { edit, push } = useNavigation();
    const { mutate: deleteMutate } = useDelete();

    // ── Gold shell system (shared across all pages) ────────────
    const G = {
        text:        isDark ? "#F59E0B" : "#B45309",
        bg:          isDark ? "rgba(245,158,11,0.08)" : "rgba(212,160,23,0.06)",
        border:      isDark ? "rgba(245,158,11,0.18)" : "rgba(180,83,9,0.14)",
        borderStrong:isDark ? "rgba(245,158,11,0.35)" : "rgba(180,83,9,0.28)",
        gradient:    "linear-gradient(135deg,#92400E 0%,#B45309 30%,#D4A017 65%,#F59E0B 100%)",
        gradientSoft:isDark
            ? "linear-gradient(135deg,rgba(146,64,14,0.35) 0%,rgba(245,158,11,0.18) 100%)"
            : "linear-gradient(135deg,rgba(180,83,9,0.10) 0%,rgba(245,158,11,0.05) 100%)",
        shadow:      isDark
            ? "0 8px 32px rgba(0,0,0,0.5),0 1px 0 rgba(255,255,255,0.05)"
            : "0 4px 24px rgba(0,0,0,0.07)",
        cardBorder:  isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.05)",
    };

    // ── Filter state ───────────────────────────────────────────
    const [filterKelas,    setFilterKelas]    = useState<string | null>(null);
    const [filterJurusan,  setFilterJurusan]  = useState<string | null>(null);
    const [filterDateRange,setFilterDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

    // ── Export modal state ─────────────────────────────────────
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportMode,        setExportMode]        = useState<"personal" | "global">("global");
    const [selectedSantriNis, setSelectedSantriNis] = useState<string | null>(null);
    const [exportLoading,     setExportLoading]     = useState(false);

    // ── Santri select for modal ────────────────────────────────
    const { selectProps: santriSelectProps } = useSelect<ISantri>({
        resource: "santri",
        optionLabel: "nama",
        optionValue: "nis",
        onSearch: (v) => [
            { field: "nama", operator: "contains", value: v },
            { field: "nis",  operator: "contains", value: v },
        ],
    });

    // ── Table ──────────────────────────────────────────────────
    const { tableProps, tableQueryResult } = useTable<IKesehatanSantri>({
        resource: "kesehatan_santri",
        syncWithLocation: false,
        meta: { select: "*, santri!inner(nama, nis, kelas, jurusan, foto_url)" },
        sorters: { initial: [{ field: "tanggal", order: "desc" }] },
        pagination: { pageSize: 10 },
    });

    // ── Client-side filter ─────────────────────────────────────
    const allData = tableQueryResult?.data?.data || [];

    const filteredData = useMemo(() => {
        return allData.filter((item) => {
            if (filterKelas   && item.santri?.kelas   !== filterKelas)   return false;
            if (filterJurusan && item.santri?.jurusan !== filterJurusan) return false;
            if (filterDateRange) {
                const d = dayjs(item.tanggal);
                if (d.isBefore(filterDateRange[0], "day") || d.isAfter(filterDateRange[1], "day"))
                    return false;
            }
            return true;
        });
    }, [allData, filterKelas, filterJurusan, filterDateRange]);

    const finalTableProps = {
        ...tableProps,
        dataSource: filteredData,
        pagination: { ...tableProps.pagination, total: filteredData.length },
    };

    // ── KPI stats ──────────────────────────────────────────────
    const stats = useMemo(() => {
        const thisMonth = allData.filter((d) =>
            dayjs(d.tanggal).isSame(dayjs(), "month")
        );
        const lastMonth = allData.filter((d) =>
            dayjs(d.tanggal).isSame(dayjs().subtract(1, "month"), "month")
        );

        // Santri unik yang pernah berobat
        const uniqueSantri = new Set(allData.map((d) => d.santri_nis)).size;

        // Tindakan terbanyak
        const tindakanMap: Record<string, number> = {};
        allData.forEach((d) => {
            if (d.tindakan) tindakanMap[d.tindakan] = (tindakanMap[d.tindakan] || 0) + 1;
        });
        const topTindakan = Object.entries(tindakanMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4);

        // Santri sering berobat
        const freqMap: Record<string, { nama: string; count: number }> = {};
        allData.forEach((d) => {
            const k = d.santri_nis;
            if (!freqMap[k])
                freqMap[k] = { nama: d.santri?.nama || "-", count: 0 };
            freqMap[k].count += 1;
        });
        const frequentPatients = Object.entries(freqMap)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 3);

        const trend = thisMonth.length - lastMonth.length;

        return {
            total:    allData.length,
            thisMonth: thisMonth.length,
            lastMonth: lastMonth.length,
            trend,
            uniqueSantri,
            topTindakan,
            frequentPatients,
        };
    }, [allData]);

    const hasFilter = filterKelas || filterJurusan || filterDateRange;
    const clearFilters = () => {
        setFilterKelas(null);
        setFilterJurusan(null);
        setFilterDateRange(null);
    };

    // ══════════════════════════════════════════════════════════
    //  EXPORT LOGIC
    // ══════════════════════════════════════════════════════════
    const handleExport = async () => {
        if (exportMode === "personal" && !selectedSantriNis) {
            message.warning("Pilih santri terlebih dahulu.");
            return;
        }
        setExportLoading(true);
        const instansi = {
            nama:   "PONDOK PESANTREN AL-HASANAH",
            alamat: "Jl. Raya Cibeuti No.13, Cibeuti, Kec. Kawalu, Tasikmalaya, Jawa Barat 46182",
            kontak: "Telp: 0812-XXXX-XXXX | Email: info@alhasanah.com",
        };

        try {
            const workbook  = new ExcelJS.Workbook();

            if (exportMode === "personal") {
                // ── REKAM MEDIS PERSONAL ──────────────────────
                const { data: santri } = await supabaseClient
                    .from("santri").select("*").eq("nis", selectedSantriNis).single();
                const { data: history } = await supabaseClient
                    .from("kesehatan_santri").select("*")
                    .eq("santri_nis", selectedSantriNis)
                    .order("tanggal", { ascending: false });

                const ws = workbook.addWorksheet(`Rekam Medis - ${santri.nama}`);

                ws.mergeCells("A1:F1");
                ws.getCell("A1").value = instansi.nama;
                ws.getCell("A1").font = { size: 16, bold: true, color: { argb: "FFB45309" } };
                ws.getCell("A1").alignment = { horizontal: "center" };

                ws.mergeCells("A2:F2");
                ws.getCell("A2").value = instansi.alamat;
                ws.getCell("A2").font = { size: 10, italic: true };
                ws.getCell("A2").alignment = { horizontal: "center" };

                ws.addRow([]);
                ws.addRow(["REKAM JEJAK KESEHATAN SANTRI (UKS)"]).font = { bold: true, size: 12 };
                ws.addRow([`NAMA   : ${santri.nama.toUpperCase()}`]).font = { bold: true };
                ws.addRow([`NIS    : ${santri.nis}`]);
                ws.addRow([`KELAS  : ${santri.kelas} (${santri.jurusan})`]);
                ws.addRow([`CETAK  : ${dayjs().format("DD MMMM YYYY HH:mm")}`]).font = { italic: true, size: 9 };
                ws.addRow([]);

                const hRow = ws.addRow(["TANGGAL (M)", "TANGGAL (H)", "KELUHAN / DIAGNOSA", "TINDAKAN / PENANGANAN", "CATATAN", "DICATAT OLEH"]);
                hRow.eachCell((cell) => {
                    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D9488" } };
                    cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
                    cell.alignment = { vertical: "middle", horizontal: "center" };
                    cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
                });

                (history || []).forEach((item: any, idx) => {
                    const row = ws.addRow([
                        formatMasehi(item.tanggal),
                        formatHijri(item.tanggal),
                        item.keluhan,
                        item.tindakan,
                        item.catatan || "-",
                        "-",
                    ]);
                    row.eachCell((cell) => {
                        cell.border = { top: { style: "thin", color: { argb: "FFE5E7EB" } }, left: { style: "thin", color: { argb: "FFE5E7EB" } }, bottom: { style: "thin", color: { argb: "FFE5E7EB" } }, right: { style: "thin", color: { argb: "FFE5E7EB" } } };
                        if (idx % 2 !== 0)
                            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6FFFA" } };
                    });
                });

                ws.addRow([]);
                ws.addRow([`Total Tindakan: ${(history || []).length} kali`]).font = { bold: true };
                [20, 25, 35, 35, 40, 18].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

                const buf = await workbook.xlsx.writeBuffer();
                saveAs(new Blob([buf]), `Rekam_Medis_${santri.nama.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`);
                message.success("Rekam medis personal berhasil diunduh.");

            } else {
                // ── LAPORAN GLOBAL ────────────────────────────
                const ws = workbook.addWorksheet("Laporan UKS");

                ws.mergeCells("A1:H1");
                ws.getCell("A1").value = instansi.nama;
                ws.getCell("A1").font = { size: 16, bold: true, color: { argb: "FFB45309" } };
                ws.getCell("A1").alignment = { horizontal: "center" };

                ws.mergeCells("A2:H2");
                ws.getCell("A2").value = instansi.alamat;
                ws.getCell("A2").font = { size: 10, italic: true };
                ws.getCell("A2").alignment = { horizontal: "center" };

                ws.addRow([]);
                const periodeTxt = filterDateRange
                    ? `${filterDateRange[0].format("DD MMM YYYY")} s/d ${filterDateRange[1].format("DD MMM YYYY")}`
                    : "Seluruh Data";
                ws.addRow([`LAPORAN UNIT KESEHATAN SANTRI (UKS) — ${periodeTxt}`]).font = { bold: true, size: 12 };
                ws.addRow([`Dicetak: ${dayjs().format("DD MMMM YYYY HH:mm")}`]).font = { italic: true, size: 9 };
                ws.addRow([]);

                const hRow = ws.addRow(["NO", "TANGGAL (M)", "TANGGAL (H)", "NAMA SANTRI", "KELAS", "TAKHASUS", "KELUHAN / DIAGNOSA", "TINDAKAN / PENANGANAN", "CATATAN"]);
                hRow.eachCell((cell) => {
                    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D9488" } };
                    cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
                    cell.alignment = { vertical: "middle", horizontal: "center" };
                    cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
                });

                const { data: allExport } = await supabaseClient
                    .from("kesehatan_santri")
                    .select("*, santri(nama, nis, kelas, jurusan)")
                    .order("tanggal", { ascending: false });

                (allExport || []).forEach((item: any, idx) => {
                    const row = ws.addRow([
                        idx + 1,
                        formatMasehi(item.tanggal),
                        formatHijri(item.tanggal),
                        item.santri?.nama?.toUpperCase(),
                        item.santri?.kelas,
                        item.santri?.jurusan,
                        item.keluhan,
                        item.tindakan,
                        item.catatan || "-",
                    ]);
                    row.eachCell((cell) => {
                        cell.border = { top: { style: "thin", color: { argb: "FFE5E7EB" } }, left: { style: "thin", color: { argb: "FFE5E7EB" } }, bottom: { style: "thin", color: { argb: "FFE5E7EB" } }, right: { style: "thin", color: { argb: "FFE5E7EB" } } };
                        if (idx % 2 !== 0)
                            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6FFFA" } };
                    });
                });

                ws.addRow([]);
                ws.addRow(["", "", "", "", "", "", "", "TOTAL TINDAKAN", (allExport || []).length]).font = { bold: true };
                ws.autoFilter = "A6:I6";
                ws.views = [{ state: "frozen", xSplit: 0, ySplit: 6 }];
                [5, 18, 23, 30, 8, 12, 35, 35, 40].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

                const buf = await workbook.xlsx.writeBuffer();
                saveAs(new Blob([buf]), `Laporan_UKS_${new Date().toISOString().split("T")[0]}.xlsx`);
                message.success("Laporan UKS global berhasil diunduh.");
            }

            setIsExportModalOpen(false);
        } catch {
            message.error("Gagal mengekspor data.");
        } finally {
            setExportLoading(false);
        }
    };

    // ══════════════════════════════════════════════════════════
    //  KPI CARD
    // ══════════════════════════════════════════════════════════
    const KpiCard = ({
        label, value, sub, color, gradient, icon, badge,
    }: {
        label: string; value: React.ReactNode; sub?: React.ReactNode;
        color: string; gradient: string; icon: React.ReactNode; badge?: React.ReactNode;
    }) => (
        <Card
            bordered={false}
            bodyStyle={{ padding: "18px 20px 16px" }}
            style={{
                background: token.colorBgContainer, borderRadius: 16,
                overflow: "hidden", position: "relative",
                boxShadow: G.shadow, border: G.cardBorder,
            }}
        >
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: gradient }} />
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ flex: 1 }}>
                    <div style={{
                        fontSize: 9, fontWeight: 800, letterSpacing: "1.3px",
                        textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 9,
                    }}>
                        {label}
                    </div>
                    <div style={{
                        fontSize: 28, fontWeight: 900, color,
                        lineHeight: 1, letterSpacing: "-1.5px", marginBottom: 7,
                    }}>
                        {value}
                    </div>
                    {sub && (
                        <div style={{ fontSize: 11, color: token.colorTextSecondary, fontWeight: 500 }}>
                            {sub}
                        </div>
                    )}
                    {badge}
                </div>
                <div style={{
                    width: 44, height: 44, borderRadius: 11, background: gradient,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 19, color: "#fff", flexShrink: 0, marginLeft: 12,
                    boxShadow: `0 5px 14px ${color}30`,
                }}>
                    {icon}
                </div>
            </div>
        </Card>
    );

    // ══════════════════════════════════════════════════════════
    //  TABLE COLUMNS
    // ══════════════════════════════════════════════════════════
    const columns: ProColumns<IKesehatanSantri>[] = [
        {
            title: "TANGGAL PERIKSA",
            dataIndex: "tanggal",
            width: 155,
            fixed: "left",
            sorter: true,
            render: (_, r) => (
                <div>
                    <div style={{
                        fontWeight: 700, fontSize: 13, color: token.colorText, letterSpacing: "-0.2px",
                    }}>
                        {dayjs(r.tanggal).format("DD MMM YYYY")}
                    </div>
                    <div style={{ fontSize: 11, color: G.text, fontWeight: 600, marginTop: 3 }}>
                        {formatHijri(r.tanggal)}
                    </div>
                    <div style={{
                        display: "inline-flex", alignItems: "center", gap: 4, marginTop: 5,
                        padding: "1px 7px", borderRadius: 4,
                        background: MED.primaryBg, border: `1px solid ${MED.primaryBorder}`,
                    }}>
                        <CalendarOutlined style={{ fontSize: 9, color: MED.primary }} />
                        <span style={{ fontSize: 9, fontWeight: 700, color: MED.primary, letterSpacing: "0.3px" }}>
                            {dayjs(r.tanggal).format("dddd")}
                        </span>
                    </div>
                </div>
            ),
        },
        {
            title: "PASIEN (SANTRI)",
            dataIndex: "santri_nis",
            width: 255,
            render: (_, record) => (
                <Space size={11} align="center">
                    <div style={{ position: "relative", flexShrink: 0 }}>
                        <Avatar
                            size={44}
                            src={record.santri?.foto_url}
                            icon={<UserOutlined />}
                            style={{
                                background: MED.primaryBg,
                                border: `2px solid ${MED.primaryBorder}`,
                                color: MED.primary,
                            }}
                        />
                        {/* Medical pulse dot */}
                        <div style={{
                            position: "absolute", bottom: 0, right: 0,
                            width: 12, height: 12, borderRadius: "50%",
                            background: MED.primary,
                            border: `2px solid ${token.colorBgContainer}`,
                        }}>
                            <div style={{
                                position: "absolute", inset: -3,
                                borderRadius: "50%",
                                background: `${MED.primary}22`,
                                animation: "pulseRing 2.5s ease-in-out infinite",
                            }} />
                        </div>
                    </div>
                    <div>
                        <div style={{
                            fontWeight: 800, fontSize: 13.5, color: token.colorText,
                            lineHeight: 1.25, letterSpacing: "-0.2px",
                        }}>
                            {record.santri?.nama || "Tanpa Nama"}
                        </div>
                        <div style={{
                            fontSize: 10, color: token.colorTextTertiary,
                            fontFamily: "ui-monospace,monospace", marginTop: 3,
                        }}>
                            NIS: {record.santri?.nis || "—"}
                        </div>
                        <div style={{ display: "flex", gap: 5, marginTop: 5 }}>
                            <span style={{
                                fontSize: 10, padding: "1px 7px", borderRadius: 4,
                                background: token.colorFillAlter,
                                border: `1px solid ${token.colorBorderSecondary}`,
                                color: token.colorTextSecondary, fontWeight: 700,
                            }}>
                                Kls {record.santri?.kelas}
                            </span>
                            <span style={{
                                fontSize: 10, padding: "1px 7px", borderRadius: 4,
                                background: MED.accentBg, border: `1px solid ${MED.accentBorder}`,
                                color: MED.accent, fontWeight: 700,
                            }}>
                                {record.santri?.jurusan}
                            </span>
                        </div>
                    </div>
                </Space>
            ),
        },
        {
            title: "KELUHAN / DIAGNOSA",
            dataIndex: "keluhan",
            width: 260,
            render: (_, r) => (
                <div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                        <div style={{
                            width: 24, height: 24, borderRadius: 6, flexShrink: 0, marginTop: 1,
                            background: MED.dangerBg, border: `1px solid ${MED.dangerBorder}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                            <HeartOutlined style={{ fontSize: 11, color: MED.danger }} />
                        </div>
                        <Paragraph
                            ellipsis={{ rows: 2, tooltip: r.keluhan }}
                            style={{
                                margin: 0, fontSize: 13, fontWeight: 700,
                                color: isDark ? "#FCA5A5" : "#9B1C1C", lineHeight: 1.5,
                            }}
                        >
                            {r.keluhan}
                        </Paragraph>
                    </div>
                    {r.catatan && (
                        <div style={{
                            marginTop: 8, paddingLeft: 8,
                            borderLeft: `2px solid ${token.colorBorderSecondary}`,
                        }}>
                            <div style={{
                                fontSize: 9, fontWeight: 800, letterSpacing: "1px",
                                textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 2,
                            }}>
                                Catatan
                            </div>
                            <Paragraph
                                ellipsis={{ rows: 2, tooltip: r.catatan }}
                                style={{
                                    margin: 0, fontSize: 11,
                                    color: token.colorTextSecondary, fontStyle: "italic", lineHeight: 1.5,
                                }}
                            >
                                {r.catatan}
                            </Paragraph>
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: "TINDAKAN / PENANGANAN",
            dataIndex: "tindakan",
            width: 230,
            render: (_, r) => (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <div style={{
                        width: 24, height: 24, borderRadius: 6, flexShrink: 0, marginTop: 1,
                        background: MED.primaryBg, border: `1px solid ${MED.primaryBorder}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                        <MedicineBoxOutlined style={{ fontSize: 11, color: MED.primary }} />
                    </div>
                    <Paragraph
                        ellipsis={{ rows: 2, tooltip: r.tindakan }}
                        style={{
                            margin: 0, fontSize: 12.5, fontWeight: 600,
                            color: isDark ? "#5EEAD4" : "#0F766E", lineHeight: 1.5,
                        }}
                    >
                        {r.tindakan || <span style={{ opacity: 0.45, fontStyle: "italic" }}>—</span>}
                    </Paragraph>
                </div>
            ),
        },
        {
            title: "AKSI",
            valueType: "option",
            width: 90,
            fixed: "right",
            render: (_, record) => (
                <Space size={5}>
                    <Tooltip title="Edit Rekam Medis">
                        <Button
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => edit("kesehatan_santri", record.id)}
                            style={{
                                border: `1.5px solid ${G.border}`,
                                color: G.text, background: G.bg,
                                borderRadius: 7, width: 30, height: 30,
                                display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                        />
                    </Tooltip>
                    <Popconfirm
                        title="Hapus Data Medis?"
                        description={<span style={{ fontSize: 12 }}>Data rekam medis ini akan dihapus permanen.</span>}
                        onConfirm={() =>
                            deleteMutate(
                                { resource: "kesehatan_santri", id: record.id },
                                {
                                    onSuccess: () =>
                                        logActivity({
                                            user,
                                            action: "DELETE",
                                            resource: "kesehatan_santri",
                                            record_id: record.id.toString(),
                                            details: { id: record.id },
                                        }),
                                }
                            )
                        }
                        okText="Hapus"
                        cancelText="Batal"
                        okButtonProps={{ danger: true, size: "small" }}
                    >
                        <Tooltip title="Hapus Data">
                            <Button
                                danger size="small"
                                icon={<DeleteOutlined />}
                                style={{
                                    borderRadius: 7, width: 30, height: 30,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                }}
                            />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    // ══════════════════════════════════════════════════════════
    //  RENDER
    // ══════════════════════════════════════════════════════════
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 18, paddingBottom: 80 }}>

            <style>{`
                .uks-table .ant-table-thead .ant-table-cell {
                    background: ${isDark ? "rgba(13,148,136,0.10)" : "rgba(13,148,136,0.06)"} !important;
                    font-size: 10px !important; font-weight: 800 !important;
                    letter-spacing: 1.1px !important; text-transform: uppercase !important;
                    color: ${isDark ? "#2DD4BF" : "#0D9488"} !important;
                    border-bottom: 2px solid ${isDark ? "rgba(13,148,136,0.30)" : "rgba(13,148,136,0.20)"} !important;
                    padding: 12px 14px !important;
                }
                .uks-table .ant-table-row:hover .ant-table-cell {
                    background: ${isDark ? "rgba(13,148,136,0.05)" : "rgba(13,148,136,0.03)"} !important;
                }
                .uks-table .ant-table-cell {
                    transition: background 0.16s ease !important;
                    border-bottom: 1px solid ${token.colorBorderSecondary} !important;
                    padding: 14px !important;
                }
                .uks-table .ant-pro-table-list-toolbar {
                    padding: 14px 16px !important;
                    border-bottom: 1px solid ${G.border} !important;
                }
                .uks-table .ant-table-body::-webkit-scrollbar { height: 5px; }
                .uks-table .ant-table-body::-webkit-scrollbar-thumb {
                    background: rgba(13,148,136,0.20); border-radius: 3px;
                }
                .premium-scroll::-webkit-scrollbar { width: 4px; }
                .premium-scroll::-webkit-scrollbar-track { background: transparent; }
                .premium-scroll::-webkit-scrollbar-thumb {
                    background: ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"};
                    border-radius: 10px;
                }
                .premium-scroll::-webkit-scrollbar-thumb:hover {
                    background: ${MED.primary};
                }
            `}</style>

            {/* ═══════════════════════════════════════════
                MASTHEAD
            ═══════════════════════════════════════════ */}
            <div style={{
                padding: "20px 24px",
                background: token.colorBgContainer,
                borderRadius: 16, boxShadow: G.shadow, border: G.cardBorder,
                position: "relative", overflow: "hidden",
                display: "flex", alignItems: "center",
                justifyContent: "space-between", flexWrap: "wrap", gap: 14,
            }}>
                {/* Teal left accent — medical context */}
                <div style={{
                    position: "absolute", left: 0, top: 0, bottom: 0, width: 4,
                    background: MED.primaryGrad, borderRadius: "16px 0 0 16px",
                }} />
                <div style={{
                    position: "absolute", right: -35, top: -35,
                    width: 130, height: 130, borderRadius: "50%",
                    background: isDark ? "rgba(13,148,136,0.05)" : "rgba(13,148,136,0.04)",
                    pointerEvents: "none",
                }} />
                <div style={{
                    position: "absolute", right: 90, bottom: -25,
                    width: 70, height: 70, borderRadius: "50%",
                    background: isDark ? "rgba(13,148,136,0.03)" : "rgba(13,148,136,0.03)",
                    pointerEvents: "none",
                }} />

                <div style={{ display: "flex", alignItems: "center", gap: 14, paddingLeft: 10 }}>
                    <div style={{
                        width: 50, height: 50, borderRadius: 13,
                        background: MED.primaryGrad,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 22, color: "#fff",
                        boxShadow: "0 6px 20px rgba(13,148,136,0.38)",
                    }}>
                        <MedicineBoxOutlined />
                    </div>
                    <div>
                        <div style={{
                            fontSize: 20, fontWeight: 900, color: token.colorText,
                            letterSpacing: "-0.5px", lineHeight: 1.2,
                        }}>
                            Unit Kesehatan Santri (UKS)
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 11, color: token.colorTextSecondary }}>
                                Rekam Medis & Monitoring Kesehatan
                            </span>
                            <span style={{
                                fontSize: 10, padding: "2px 9px", borderRadius: 20,
                                background: G.bg, border: `1px solid ${G.border}`,
                                color: G.text, fontWeight: 800,
                            }}>
                                ✦ {formatHijri(new Date())}
                            </span>
                            {stats.thisMonth > 0 && (
                                <span style={{
                                    fontSize: 10, padding: "2px 9px", borderRadius: 20,
                                    background: MED.primaryBg, border: `1px solid ${MED.primaryBorder}`,
                                    color: MED.primary, fontWeight: 800,
                                }}>
                                    {stats.thisMonth} layanan kesehatan bulan ini
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <Space size={8}>
                    <Button
                        icon={<SyncOutlined spin={tableQueryResult.isFetching} />}
                        onClick={() => tableQueryResult.refetch()}
                        style={{ border: G.cardBorder, borderRadius: 9, height: 38, color: token.colorTextSecondary }}
                    >
                        Refresh
                    </Button>
                    <Button
                        icon={<DownloadOutlined />}
                        onClick={() => { setExportMode("global"); setIsExportModalOpen(true); }}
                        style={{
                            borderRadius: 9, fontWeight: 700, height: 38,
                            border: `1.5px solid ${MED.primaryBorder}`,
                            color: MED.primary, background: MED.primaryBg,
                        }}
                    >
                        Export Laporan
                    </Button>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => push("/kesehatan/create")}
                        style={{
                            background: MED.primaryGrad,
                            border: "none", borderRadius: 9, fontWeight: 700, height: 38,
                            boxShadow: "0 4px 14px rgba(13,148,136,0.35)",
                        }}
                    >
                        Catat Tindakan
                    </Button>
                </Space>
            </div>

            {/* ═══════════════════════════════════════════
                KPI STATISTICS
            ═══════════════════════════════════════════ */}
            <Row gutter={[14, 14]}>
                <Col xs={24} sm={12} xl={6}>
                    <KpiCard
                        label="Total Rekam Kesehatan"
                        value={<span style={{ fontSize: 36 }}>{stats.total}</span>}
                        sub={`${stats.uniqueSantri} santri terlayani`}
                        color={MED.primary}
                        gradient={MED.primaryGrad}
                        icon={<MedicineBoxOutlined />}
                    />
                </Col>
                <Col xs={24} sm={12} xl={6}>
                    <KpiCard
                        label="Tindakan Bulan Ini"
                        value={<span style={{ fontSize: 36 }}>{stats.thisMonth}</span>}
                        sub={
                            <span style={{
                                display: "inline-flex", alignItems: "center", gap: 5, marginTop: 4,
                            }}>
                                <span style={{
                                    fontSize: 10, padding: "1px 8px", borderRadius: 10,
                                    background: stats.trend > 0 ? MED.dangerBg : stats.trend < 0 ? MED.primaryBg : token.colorFillAlter,
                                    border: `1px solid ${stats.trend > 0 ? MED.dangerBorder : stats.trend < 0 ? MED.primaryBorder : token.colorBorderSecondary}`,
                                    color: stats.trend > 0 ? MED.danger : stats.trend < 0 ? MED.primary : token.colorTextTertiary,
                                    fontWeight: 800,
                                }}>
                                    {stats.trend > 0 ? `▲ +${stats.trend}` : stats.trend < 0 ? `▼ ${stats.trend}` : "= Sama"} vs bulan lalu
                                </span>
                            </span>
                        }
                        color={MED.accent}
                        gradient={`linear-gradient(135deg,#164E63 0%,${MED.accent} 55%,#22D3EE 100%)`}
                        icon={<CalendarOutlined />}
                    />
                </Col>
                <Col xs={24} sm={12} xl={6}>
                    <KpiCard
                        label="Santri Terdaftar Medis"
                        value={<span style={{ fontSize: 36 }}>{stats.uniqueSantri}</span>}
                        sub="Santri dengan riwayat kesehatan"
                        color={MED.warn}
                        gradient={MED.warnGrad}
                        icon={<TeamOutlined />}
                    />
                </Col>
                <Col xs={24} sm={12} xl={6}>
                    {/* Tindakan terbanyak */}
                    <Card
                        bordered={false}
                        bodyStyle={{ padding: "18px 20px 16px" }}
                        style={{
                            background: token.colorBgContainer, borderRadius: 16,
                            overflow: "hidden", position: "relative",
                            boxShadow: G.shadow, border: G.cardBorder,
                            height: 185, // Fixed height for absolute layout stability
                        }}
                    >
                        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: MED.primaryGrad }} />
                        <div style={{
                            fontSize: 9, fontWeight: 800, letterSpacing: "1.3px",
                            textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 12,
                        }}>
                            Tindakan Terbanyak
                        </div>
                        {stats.topTindakan.length > 0 ? (
                            <div className="premium-scroll" style={{ 
                                display: "flex", 
                                flexDirection: "column", 
                                gap: 10,
                                height: 120,
                                overflowY: "auto",
                                paddingRight: 4
                            }}>
                                {stats.topTindakan.map(([tindakan, count], idx) => {
                                    const pct = Math.round((count / stats.total) * 100);
                                    return (
                                        <div key={tindakan} style={{ flexShrink: 0 }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                                                <Tooltip title={tindakan}>
                                                    <span style={{
                                                        fontSize: 11, fontWeight: 600, color: token.colorText,
                                                        maxWidth: "75%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                                    }}>
                                                        {tindakan}
                                                    </span>
                                                </Tooltip>
                                                <span style={{ fontSize: 10, fontWeight: 800, color: MED.primary, fontFamily: "monospace" }}>
                                                    {count}×
                                                </span>
                                            </div>
                                            <Progress
                                                percent={pct}
                                                showInfo={false}
                                                strokeColor={idx === 0 ? MED.primaryGrad : `linear-gradient(90deg,${MED.accent},#22D3EE)`}
                                                trailColor={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}
                                                strokeWidth={5}
                                                style={{ margin: 0 }}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{ 
                                height: 120, 
                                display: "flex", 
                                alignItems: "center", 
                                justifyContent: "center", 
                                color: token.colorTextTertiary, 
                                fontSize: 12 
                            }}>
                                Belum ada data
                            </div>
                        )}
                    </Card>
                </Col>
            </Row>

            {/* ═══════════════════════════════════════════
                FREQUENT PATIENTS + FILTER — 2 col
            ═══════════════════════════════════════════ */}
            <Row gutter={[14, 14]}>
                {/* Sering Berobat */}
                <Col xs={24} lg={8}>
                    <Card
                        bordered={false}
                        bodyStyle={{ padding: "18px 20px" }}
                        style={{
                            background: token.colorBgContainer, borderRadius: 16,
                            boxShadow: G.shadow, border: G.cardBorder,
                            position: "relative", overflow: "hidden", height: "100%",
                        }}
                    >
                        <div style={{
                            position: "absolute", top: 0, left: 0, right: 0, height: 3,
                            background: MED.warnGrad,
                        }} />
                        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
                            <div style={{
                                width: 30, height: 30, borderRadius: 8,
                                background: MED.warnBg, border: `1px solid ${MED.warnBorder}`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 14, color: MED.warn,
                            }}>
                                <AlertOutlined />
                            </div>
                            <div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: token.colorText }}>
                                Sering Tindakan Medis
                            </div>
                            <div style={{ fontSize: 10, color: token.colorTextTertiary }}>
                                Santri dengan tindakan terbanyak
                            </div>
                            </div>
                            </div>

                            {stats.frequentPatients.length === 0 ? (
                            <div style={{ textAlign: "center", color: token.colorTextTertiary, fontSize: 12, padding: "20px 0" }}>
                            Belum ada data tindakan
                            </div>
                            ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {stats.frequentPatients.map(([nis, data], idx) => (
                                <div key={nis} style={{
                                    display: "flex", alignItems: "center", gap: 10,
                                    padding: "10px 12px", borderRadius: 10,
                                    background: idx === 0 ? MED.warnBg : token.colorFillAlter,
                                    border: `1px solid ${idx === 0 ? MED.warnBorder : token.colorBorderSecondary}`,
                                }}>
                                    <div style={{
                                        width: 26, height: 26, borderRadius: "50%",
                                        background: idx === 0
                                            ? MED.warnGrad
                                            : idx === 1
                                                ? MED.primaryGrad
                                                : `linear-gradient(135deg,#6B7280,#9CA3AF)`,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 11, fontWeight: 900, color: "#fff", flexShrink: 0,
                                    }}>
                                        {idx + 1}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontWeight: 700, fontSize: 12.5, color: token.colorText,
                                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                        }}>
                                            {data.nama}
                                        </div>
                                    </div>
                                    <div style={{
                                        fontFamily: "ui-monospace,monospace",
                                        fontWeight: 900, fontSize: 16,
                                        color: idx === 0 ? MED.warn : token.colorText,
                                    }}>
                                        {data.count}
                                        <span style={{ fontSize: 9, fontWeight: 600, color: token.colorTextTertiary, marginLeft: 2 }}>
                                            ×
                                        </span>
                                    </div>
                                </div>
                            ))}
                            </div>
                            )}

                            <Divider style={{ margin: "16px 0 12px", borderColor: token.colorBorderSecondary }} />
                            <Button
                            block
                            icon={<FileExcelOutlined />}
                            onClick={() => { setExportMode("personal"); setIsExportModalOpen(true); }}
                            style={{
                            border: `1.5px solid ${MED.primaryBorder}`,
                            color: MED.primary, background: MED.primaryBg,
                            borderRadius: 9, fontWeight: 700, height: 36,
                            }}
                            >
                            Cetak Rekam Medis Personal
                            </Button>
                            </Card>
                            </Col>

                            {/* Filter Panel */}
                            <Col xs={24} lg={16}>
                            <Card
                            bordered={false}
                            bodyStyle={{ padding: "18px 20px" }}
                            style={{
                            background: token.colorBgContainer, borderRadius: 16,
                            boxShadow: G.shadow, border: `1px solid ${G.border}`,
                            position: "relative", overflow: "hidden", height: "100%",
                            }}
                            >
                            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: G.gradient }} />

                            <div style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16,
                            }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{
                                width: 28, height: 28, borderRadius: 7,
                                background: G.bg, border: `1px solid ${G.border}`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                                <FilterOutlined style={{ color: G.text, fontSize: 13 }} />
                            </div>
                            <span style={{
                                fontSize: 10, fontWeight: 900, letterSpacing: "1.2px",
                                textTransform: "uppercase", color: G.text,
                            }}>
                                Filter Data
                            </span>
                            {hasFilter && (
                                <span style={{
                                    fontSize: 10, padding: "1px 8px", borderRadius: 10,
                                    background: MED.primaryBg, border: `1px solid ${MED.primaryBorder}`,
                                    color: MED.primary, fontWeight: 800,
                                }}>
                                    Aktif
                                </span>
                            )}
                            </div>
                            {hasFilter && (
                            <Button
                                size="small" onClick={clearFilters}
                                style={{
                                    fontSize: 11, height: 26, borderRadius: 6,
                                    border: `1px solid ${G.border}`, color: token.colorTextSecondary,
                                }}
                            >
                                Hapus Semua Filter
                            </Button>
                            )}
                            </div>

                            <Row gutter={[12, 12]}>
                            <Col xs={12} sm={8}>
                            <div style={{
                                fontSize: 9, fontWeight: 800, letterSpacing: "1px",
                                textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 5,
                            }}>
                                Kelas
                            </div>
                            <Select
                                allowClear placeholder="Semua Kelas"
                                value={filterKelas} onChange={setFilterKelas}
                                style={{ width: "100%" }}
                                options={[1, 2, 3].map((k) => ({ label: `Kelas ${k}`, value: `${k}` }))}
                            />
                            </Col>
                            <Col xs={12} sm={8}>
                            <div style={{
                                fontSize: 9, fontWeight: 800, letterSpacing: "1px",
                                textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 5,
                            }}>
                                Takhasus
                            </div>
                            <Select
                                allowClear placeholder="Semua Takhasus"
                                value={filterJurusan} onChange={setFilterJurusan}
                                style={{ width: "100%" }}
                                options={[
                                    { label: "Tahfidz", value: "TAHFIDZ" },
                                    { label: "Kitab",   value: "KITAB"   },
                                ]}
                            />
                            </Col>
                            <Col xs={24} sm={8}>
                            <div style={{
                                fontSize: 9, fontWeight: 800, letterSpacing: "1px",
                                textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 5,
                            }}>
                                Periode Laporan
                            </div>
                            <RangePicker
                                value={filterDateRange}
                                onChange={(d) => setFilterDateRange(d as any)}
                                style={{ width: "100%" }} format="DD MMM YYYY" allowClear
                                presets={[
                                    { label: "Minggu Ini",     value: [dayjs().startOf("week"), dayjs().endOf("week")] },
                                    { label: "Bulan Ini",      value: [dayjs().startOf("month"), dayjs().endOf("month")] },
                                    { label: "Bulan Lalu",     value: [dayjs().subtract(1, "month").startOf("month"), dayjs().subtract(1, "month").endOf("month")] },
                                    { label: "3 Bulan Terakhir", value: [dayjs().subtract(3, "month"), dayjs()] },
                                ]}
                            />
                            </Col>
                            </Row>

                            {/* Active filter summary */}
                            {hasFilter && (
                            <div style={{
                            marginTop: 14, paddingTop: 12,
                            borderTop: `1px solid ${token.colorBorderSecondary}`,
                            display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                            }}>
                            <span style={{ fontSize: 10, color: token.colorTextTertiary, fontWeight: 700 }}>
                                Menampilkan:
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 800, color: MED.primary }}>
                                {filteredData.length} dari {allData.length} record
                            </span>
                            {filterKelas && (
                                <Tag closable onClose={() => setFilterKelas(null)}
                                    style={{ borderRadius: 6, fontSize: 10, fontWeight: 700 }}>
                                    Kelas {filterKelas}
                                </Tag>
                            )}
                            {filterJurusan && (
                                <Tag closable onClose={() => setFilterJurusan(null)}
                                    color="cyan"
                                    style={{ borderRadius: 6, fontSize: 10, fontWeight: 700 }}>
                                    {filterJurusan}
                                </Tag>
                            )}
                            {filterDateRange && (
                                <Tag closable onClose={() => setFilterDateRange(null)}
                                    color="teal"
                                    style={{ borderRadius: 6, fontSize: 10, fontWeight: 700 }}>
                                    {filterDateRange[0].format("DD MMM")} – {filterDateRange[1].format("DD MMM YYYY")}
                                </Tag>
                            )}
                            </div>
                            )}

                            {/* Quick Stats Row */}
                            <div style={{
                            marginTop: 16, paddingTop: 14,
                            borderTop: `1px solid ${token.colorBorderSecondary}`,
                            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10,
                            }}>
                            {[
                            { label: "Total Record", value: allData.length, color: MED.primary },
                            { label: "Bulan Ini", value: stats.thisMonth, color: MED.accent },
                            { label: "Santri Unik", value: stats.uniqueSantri, color: MED.warn },
                            ].map((s) => (
                            <div key={s.label} style={{
                                textAlign: "center", padding: "10px 6px", borderRadius: 10,
                                background: token.colorFillAlter,
                                border: `1px solid ${token.colorBorderSecondary}`,
                            }}>
                                <div style={{
                                    fontFamily: "ui-monospace,monospace",
                                    fontWeight: 900, fontSize: 22, color: s.color, lineHeight: 1,
                                }}>
                                    {s.value}
                                </div>
                                <div style={{
                                    fontSize: 9, fontWeight: 800, color: token.colorTextTertiary,
                                    letterSpacing: "0.8px", textTransform: "uppercase", marginTop: 5,
                                }}>
                                    {s.label}
                                </div>
                            </div>
                            ))}
                            </div>
                            </Card>
                            </Col>
                            </Row>
            {/* ═══════════════════════════════════════════
                DATA TABLE
            ═══════════════════════════════════════════ */}
            <div style={{
                background: token.colorBgContainer,
                borderRadius: 16, overflow: "hidden",
                boxShadow: G.shadow, border: G.cardBorder,
            }}>
                <ProTable<IKesehatanSantri>
                    {...finalTableProps}
                    columns={columns}
                    rowKey="id"
                    search={false}
                    className="uks-table"
                    scroll={{ x: 1050 }}
                    headerTitle={
                        <Space size={10} align="center">
                            <div style={{
                                width: 34, height: 34, borderRadius: 9,
                                background: MED.primaryGrad,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 15, color: "#fff",
                            }}>
                                <MedicineBoxOutlined />
                            </div>
                            <div>
                                <div style={{
                                    fontSize: 14, fontWeight: 800,
                                    color: token.colorText, letterSpacing: "-0.3px",
                                }}>
                                    Rekam Medis Santri
                                </div>
                                <div style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 1 }}>
                                    {filteredData.length} record · {formatHijri(new Date())}
                                </div>
                            </div>
                        </Space>
                    }
                    toolBarRender={() => [
                        <Button
                            key="rekam"
                            icon={<FileExcelOutlined />}
                            onClick={() => { setExportMode("personal"); setIsExportModalOpen(true); }}
                            style={{
                                borderRadius: 8, fontWeight: 700,
                                border: `1.5px solid ${MED.primaryBorder}`,
                                color: MED.primary, background: MED.primaryBg,
                            }}
                        >
                            Rekam Personal
                        </Button>,
                        <Button
                            key="export"
                            icon={<DownloadOutlined />}
                            onClick={() => { setExportMode("global"); setIsExportModalOpen(true); }}
                            style={{ borderRadius: 8, fontWeight: 700 }}
                        >
                            Laporan Global
                        </Button>,
                        <Button
                            key="create"
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => push("/kesehatan/create")}
                            style={{
                                background: MED.primaryGrad,
                                border: "none", borderRadius: 8, fontWeight: 700,
                                boxShadow: "0 3px 10px rgba(13,148,136,0.32)",
                            }}
                        >
                            Catat
                        </Button>,
                    ]}
                    cardProps={{ bodyStyle: { padding: 0 } }}
                    tableStyle={{ padding: 0 }}
                    pagination={{
                        ...finalTableProps.pagination,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (total, range) =>
                            `${range[0]}-${range[1]} dari ${total} rekam medis`,
                    }}
                />
            </div>

            {/* ═══════════════════════════════════════════
                MODAL: EXPORT
            ═══════════════════════════════════════════ */}
            <Modal
                title={null}
                open={isExportModalOpen}
                onCancel={() => setIsExportModalOpen(false)}
                footer={
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                        <Button onClick={() => setIsExportModalOpen(false)} style={{ borderRadius: 9 }}>
                            Batal
                        </Button>
                        <Button
                            loading={exportLoading}
                            icon={<DownloadOutlined />}
                            onClick={handleExport}
                            disabled={exportMode === "personal" && !selectedSantriNis}
                            style={{
                                background: MED.primaryGrad, border: "none", color: "#fff",
                                borderRadius: 9, fontWeight: 800,
                                boxShadow: "0 4px 14px rgba(13,148,136,0.30)",
                                opacity: (exportMode === "personal" && !selectedSantriNis) ? 0.5 : 1,
                            }}
                        >
                            Download Excel
                        </Button>
                    </div>
                }
                width={460}
                centered
                styles={{ content: { padding: 0, borderRadius: 20, overflow: "hidden" } }}
            >
                {/* Modal Teal Header */}
                <div style={{
                    background: MED.primaryGrad,
                    padding: "22px 28px 20px", position: "relative", overflow: "hidden",
                }}>
                    <div style={{
                        position: "absolute", right: -15, top: -15,
                        width: 90, height: 90, borderRadius: "50%",
                        background: "rgba(255,255,255,0.10)",
                    }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: 11,
                            background: "rgba(255,255,255,0.18)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 18, color: "#fff",
                        }}>
                            <FileExcelOutlined />
                        </div>
                        <div>
                            <div style={{ fontSize: 17, fontWeight: 900, color: "#fff", letterSpacing: "-0.3px" }}>
                                Export Laporan UKS
                            </div>
                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>
                                Format Excel · Pesantren Al-Hasanah
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ padding: "22px 28px 28px", background: token.colorBgContainer }}>
                    {/* Mode selector */}
                    <div style={{ marginBottom: 20 }}>
                        <div style={{
                            fontSize: 10, fontWeight: 800, letterSpacing: "1.2px",
                            textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 10,
                        }}>
                            Jenis Laporan
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            {[
                                {
                                    val: "global" as const,
                                    label: "Laporan Global",
                                    sub: "Semua rekam medis santri",
                                    icon: <TeamOutlined />,
                                },
                                {
                                    val: "personal" as const,
                                    label: "Rekam Personal",
                                    sub: "Riwayat satu santri",
                                    icon: <UserOutlined />,
                                },
                            ].map((opt) => {
                                const active = exportMode === opt.val;
                                return (
                                    <button
                                        key={opt.val}
                                        onClick={() => setExportMode(opt.val)}
                                        style={{
                                            padding: "14px 16px", borderRadius: 12, cursor: "pointer",
                                            textAlign: "left", outline: "none",
                                            transition: "all 0.18s ease",
                                            border: `2px solid ${active ? MED.primary : token.colorBorder}`,
                                            background: active ? MED.primaryBg : "transparent",
                                            boxShadow: active ? `0 4px 14px ${MED.primary}18` : "none",
                                        }}
                                    >
                                        <div style={{ fontSize: 20, marginBottom: 8, color: active ? MED.primary : token.colorTextTertiary }}>
                                            {opt.icon}
                                        </div>
                                        <div style={{ fontWeight: 800, fontSize: 13, color: token.colorText, marginBottom: 3 }}>
                                            {opt.label}
                                        </div>
                                        <div style={{ fontSize: 11, color: token.colorTextTertiary }}>
                                            {opt.sub}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Personal selector */}
                    {exportMode === "personal" && (
                        <div style={{ marginBottom: 16 }}>
                            <div style={{
                                fontSize: 10, fontWeight: 800, letterSpacing: "1px",
                                textTransform: "uppercase", color: token.colorTextTertiary, marginBottom: 6,
                            }}>
                                Pilih Santri
                            </div>
                            <Select
                                {...santriSelectProps}
                                showSearch
                                placeholder="Cari nama atau NIS santri..."
                                style={{ width: "100%" }}
                                filterOption={false}
                                onChange={(val) => setSelectedSantriNis(val as unknown as string)}
                                suffixIcon={<UserOutlined style={{ color: MED.primary }} />}
                            />
                        </div>
                    )}

                    <div style={{
                        marginTop: 12, padding: "10px 14px", borderRadius: 10,
                        background: MED.primaryBg, border: `1px solid ${MED.primaryBorder}`,
                        fontSize: 11, color: MED.primary, fontWeight: 500,
                    }}>
                        <MedicineBoxOutlined style={{ marginRight: 6 }} />
                        File Excel akan menggunakan kop surat resmi Pesantren Al-Hasanah dengan format tabel gold premium.
                    </div>
                </div>
            </Modal>
        </div>
    );
};
