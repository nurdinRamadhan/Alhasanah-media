import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import {
    Tag, Space, Button, Typography, Tooltip, Avatar, theme, Modal,
    message, Segmented, DatePicker, Select, Card, Row, Col, Statistic,
    InputNumber, Radio, Badge,
} from "antd";
import {
    AppstoreOutlined, DownloadOutlined, CameraOutlined, BookOutlined,
    CheckCircleFilled, ClockCircleOutlined, CloseCircleFilled,
    UserOutlined, TrophyOutlined, ReloadOutlined,
} from "@ant-design/icons";
import { useGetIdentity } from "@refinedev/core";
import dayjs, { Dayjs } from "dayjs";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { supabaseClient } from "../../utility/supabaseClient";

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

// ── Types ──
interface PetaJuzData {
    juz: number;
    is_completed: boolean;
    halaman_progress: number;
}

interface PetaSantri {
    santri_nis: string;
    santri_nama: string;
    santri_kelas: string;
    santri_jurusan: string;
    santri_foto_url: string | null;
    juzData: Map<number, PetaJuzData>;
    total_juz_selesai: number;
    total_halaman_progress: number;
}

interface SurahData {
    santri_nis: string;
    juz: number;
    surah_list: string | null;
}

// ── Helpers ──
const formatHalaman = (kuartal: number): string => {
    if (kuartal <= 0) return "—";
    const h = Math.floor(kuartal / 4);
    const s = kuartal % 4;
    const p = ["", "¼", "½", "¾"];
    if (h === 0) return p[s];
    if (s === 0) return `${h}`;
    return `${h} ${p[s]}`;
};

const getCellColor = (juz: PetaJuzData): string => {
    if (juz.is_completed) return "#22c55e";
    if (juz.halaman_progress > 0) return "#eab308";
    return "#ef4444";
};

const getCellBg = (juz: PetaJuzData): string => {
    if (juz.is_completed) return "#f0fdf4";
    if (juz.halaman_progress > 0) return "#fefce8";
    return "#fef2f2";
};

const ADMIN_ROLES = ["super_admin", "rois", "kesantrian", "admin_akademik_tahfidz"];

// ── JuzDetailModal ──
const JuzDetailModal: React.FC<{
    open: boolean;
    santri: PetaSantri | null;
    juz: number;
    onClose: () => void;
    onSaved: () => void;
}> = ({ open, santri, juz, onClose, onSaved }) => {
    const { useToken: useT } = theme;
    const { token } = useT();
    const [status, setStatus] = useState<"SELESAI" | "PROSES" | "BELUM">("BELUM");
    const [halaman, setHalaman] = useState(0);
    const [pecahan, setPecahan] = useState<0 | 1 | 2 | 3>(0);
    const [catatan, setCatatan] = useState("");
    const [loading, setLoading] = useState(false);

    // Load existing data
    useEffect(() => {
        if (open && santri && juz) {
            const existing = santri.juzData.get(juz);
            if (existing) {
                setHalaman(Math.floor(existing.halaman_progress / 4));
                setPecahan(existing.halaman_progress % 4 as 0 | 1 | 2 | 3);
                setStatus(existing.is_completed ? "SELESAI" : existing.halaman_progress > 0 ? "PROSES" : "BELUM");
            } else {
                setHalaman(0);
                setPecahan(0);
                setStatus("BELUM");
            }
            setCatatan("");
        }
    }, [open, santri, juz]);

    const kuartal = halaman * 4 + pecahan;

    const preview = useMemo(() => {
        if (status === "SELESAI") return "✅ Selesai";
        if (status === "BELUM") return "— Belum";
        if (kuartal === 0) return "— Belum";
        return `${formatHalaman(kuartal)} Halaman`;
    }, [status, kuartal]);

    const handleSave = async () => {
        if (!santri) return;
        setLoading(true);
        try {
            const isCompleted = status === "SELESAI";
            const { error } = await supabaseClient.rpc("upsert_peta_hafalan", {
                p_santri_nis: santri.santri_nis,
                p_juz: juz,
                p_is_completed: isCompleted,
                p_halaman_progress: isCompleted ? 0 : kuartal,
                p_catatan: catatan || null,
            });
            if (error) throw error;
            message.success(`Juz ${juz} — ${santri.santri_nama} berhasil diperbarui`);
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
            onCancel={onClose}
            title={
                <span>
                    <BookOutlined style={{ marginRight: 8 }} />
                    Juz {juz} — {santri?.santri_nama}
                </span>
            }
            onOk={handleSave}
            okText="Simpan"
            cancelText="Batal"
            confirmLoading={loading}
            width={480}
        >
            <div style={{ marginBottom: 16 }}>
                <Text type="secondary">Status Juz</Text>
                <Radio.Group
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}
                >
                    <Radio value="SELESAI">
                        <CheckCircleFilled style={{ color: "#22c55e" }} /> Selesai
                    </Radio>
                    <Radio value="PROSES">
                        <ClockCircleOutlined style={{ color: "#eab308" }} /> Sedang Proses
                    </Radio>
                    <Radio value="BELUM">
                        <CloseCircleFilled style={{ color: "#ef4444" }} /> Belum Dikerjakan
                    </Radio>
                </Radio.Group>
            </div>

            {status === "PROSES" && (
                <div style={{ background: token.colorBgLayout, borderRadius: 8, padding: 16 }}>
                    <div style={{ marginBottom: 12 }}>
                        <Text strong>Halaman yang sudah dihafal:</Text>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                            <InputNumber
                                min={0}
                                max={23}
                                value={halaman}
                                onChange={(v) => setHalaman(v || 0)}
                                style={{ width: 80 }}
                            />
                            <Text>halaman</Text>
                        </div>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                        <Text strong>Pecahan:</Text>
                        <div style={{ marginTop: 8 }}>
                            <Segmented
                                options={[
                                    { label: "utuh", value: 0 },
                                    { label: "¼", value: 1 },
                                    { label: "½", value: 2 },
                                    { label: "¾", value: 3 },
                                ]}
                                value={pecahan}
                                onChange={(v) => setPecahan(v as 0 | 1 | 2 | 3)}
                            />
                        </div>
                    </div>
                    <div style={{ padding: "8px 12px", background: token.colorBgContainer, borderRadius: 6, border: `1px solid ${token.colorBorderSecondary}` }}>
                        <Text strong style={{ fontSize: 16 }}>{preview}</Text>
                    </div>
                </div>
            )}

            {status !== "PROSES" && (
                <div style={{ padding: "12px 16px", background: token.colorBgLayout, borderRadius: 8, textAlign: "center" }}>
                    <Text style={{ fontSize: 16 }}>{preview}</Text>
                </div>
            )}

            <div style={{ marginTop: 16 }}>
                <Text type="secondary">Catatan (opsional)</Text>
                <input
                    type="text"
                    value={catatan}
                    onChange={(e) => setCatatan(e.target.value)}
                    placeholder="Catatan..."
                    style={{
                        width: "100%", padding: "8px 12px", marginTop: 8,
                        border: `1px solid ${token.colorBorderSecondary}`,
                        borderRadius: 6, outline: "none",
                    }}
                />
            </div>
        </Modal>
    );
};

// ── Main Component ──
export const PetaHafalan: React.FC = () => {
    const { data: identity } = useGetIdentity<any>();
    const isAdmin = ADMIN_ROLES.includes(identity?.role);

    const [data, setData] = useState<PetaSantri[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterKelas, setFilterKelas] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
        dayjs().startOf("week"),
        dayjs().endOf("week"),
    ]);
    const [surahData, setSurahData] = useState<SurahData[]>([]);

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedSantri, setSelectedSantri] = useState<PetaSantri | null>(null);
    const [selectedJuz, setSelectedJuz] = useState(1);

    // Snapshot state
    const [snapshotLoading, setSnapshotLoading] = useState(false);

    // ── Fetch peta hafalan data ──
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const rpcName = isAdmin ? "get_peta_hafalan" : "get_wali_peta_hafalan";
            const params = isAdmin ? { p_kelas: filterKelas || null } : {};

            const { data: rows, error } = await supabaseClient.rpc(rpcName, params);
            if (error) throw error;

            // Transform flat rows into PetaSantri[]
            const santriMap = new Map<string, PetaSantri>();
            (rows || []).forEach((row: any) => {
                if (!santriMap.has(row.santri_nis)) {
                    santriMap.set(row.santri_nis, {
                        santri_nis: row.santri_nis,
                        santri_nama: row.santri_nama,
                        santri_kelas: row.santri_kelas,
                        santri_jurusan: row.santri_jurusan,
                        santri_foto_url: row.santri_foto_url,
                        juzData: new Map(),
                        total_juz_selesai: Number(row.total_juz_selesai) || 0,
                        total_halaman_progress: Number(row.total_halaman_progress) || 0,
                    });
                }
                const s = santriMap.get(row.santri_nis)!;
                s.juzData.set(row.juz, {
                    juz: row.juz,
                    is_completed: row.is_completed,
                    halaman_progress: row.halaman_progress,
                });
            });

            setData(Array.from(santriMap.values()));
        } catch (err: any) {
            message.error(err.message || "Gagal memuat data peta hafalan");
        } finally {
            setLoading(false);
        }
    }, [isAdmin, filterKelas]);

    // ── Fetch surah data for date range ──
    const fetchSurahData = useCallback(async () => {
        try {
            const { data: rows, error } = await supabaseClient.rpc("get_hafalan_surah_per_juz", {
                p_start_date: dateRange[0].startOf("day").toISOString(),
                p_end_date: dateRange[1].endOf("day").toISOString(),
            });
            if (error) throw error;
            setSurahData(rows || []);
        } catch (err: any) {
            console.error("Fetch surah data error:", err);
        }
    }, [dateRange]);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { fetchSurahData(); }, [fetchSurahData]);

    // ── KPI stats ──
    const stats = useMemo(() => {
        if (data.length === 0) return { avgJuz: 0, avgHalaman: 0, totalSelesai: 0, tercepat: null };
        const totalJuz = data.reduce((sum, s) => sum + s.total_juz_selesai, 0);
        const totalHlm = data.reduce((sum, s) => sum + s.total_halaman_progress, 0);
        const tercepat = data.reduce((best, s) =>
            s.total_juz_selesai > (best?.total_juz_selesai || 0) ? s : best, data[0]);
        return {
            avgJuz: Math.round((totalJuz / data.length) * 10) / 10,
            avgHalaman: Math.round(totalHlm / data.length / 4 * 10) / 10,
            totalSelesai: data.filter((s) => s.total_juz_selesai === 30).length,
            tercepat,
        };
    }, [data]);

    // ── Snapshot ──
    const handleSnapshot = async () => {
        setSnapshotLoading(true);
        try {
            const label = `${dateRange[0].format("DD MMM")} - ${dateRange[1].format("DD MMM YYYY")}`;
            const { data: count, error } = await supabaseClient.rpc("capture_peta_snapshot", {
                p_snapshot_date: dateRange[1].format("YYYY-MM-DD"),
                p_label: label,
            });
            if (error) throw error;
            message.success(`Snapshot tersimpan: ${count} baris`);
        } catch (err: any) {
            message.error(err.message || "Gagal capture snapshot");
        } finally {
            setSnapshotLoading(false);
        }
    };

    // ── Export Excel ──
    const handleExport = async () => {
        try {
            // 1. Fetch weekly data
            const { data: weeklyRows, error: weeklyErr } = await supabaseClient.rpc(
                "get_peta_hafalan_mingguan",
                { p_snapshot_date: dateRange[1].format("YYYY-MM-DD") }
            );
            if (weeklyErr) throw weeklyErr;

            const wb = new ExcelJS.Workbook();
            wb.creator = "Alhasanah Admin";
            wb.created = new Date();

            // ── Sheet 1: Rekap Mingguan + Surah ──
            const ws1 = wb.addWorksheet("Rekap Mingguan");
            const dateLabel = `${dateRange[0].format("DD MMM")} - ${dateRange[1].format("DD MMM YYYY")}`;

            ws1.mergeCells("A1:G1");
            const title1 = ws1.getCell("A1");
            title1.value = `REKAP HAFALAN MINGGUAN — ${dateLabel}`;
            title1.font = { size: 13, bold: true, color: { argb: "FFFFFFFF" } };
            title1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF047857" } };
            title1.alignment = { horizontal: "center", vertical: "middle" };
            ws1.getRow(1).height = 26;

            const headers1 = ["NO", "NAMA", "KELAS", "AWAL MINGGU", "AKHIR MINGGU", "DELTA", "SURAH MINGGU INI"];
            ws1.getRow(3).values = headers1;
            ws1.getRow(3).eachCell((cell) => {
                cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
                cell.alignment = { horizontal: "center", vertical: "middle" };
                cell.border = {
                    bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
                };
            });
            ws1.getRow(3).height = 22;

            // Group weekly rows by santri
            const weeklyBySantri = new Map<string, any[]>();
            (weeklyRows || []).forEach((r: any) => {
                if (!weeklyBySantri.has(r.santri_nis)) weeklyBySantri.set(r.santri_nis, []);
                weeklyBySantri.get(r.santri_nis)!.push(r);
            });

            let idx1 = 1;
            weeklyBySantri.forEach((rows, nis) => {
                const first = rows[0];
                const totalAwal = rows.reduce((sum: number, r: any) =>
                    sum + (r.awal_is_completed ? 1 : 0), 0);
                const totalAkhir = rows.reduce((sum: number, r: any) =>
                    sum + (r.akhir_is_completed ? 1 : 0), 0);
                const awalHlm = rows.reduce((sum: number, r: any) =>
                    sum + (r.awal_is_completed ? 0 : r.awal_halaman_progress), 0);
                const akhirHlm = rows.reduce((sum: number, r: any) =>
                    sum + (r.akhir_is_completed ? 0 : r.akhir_halaman_progress), 0);

                const formatJuzHlm = (j: number, h: number) => {
                    if (j === 0 && h === 0) return "0 Juz";
                    const hlmStr = h > 0 ? ` ${formatHalaman(h)} Hlm` : "";
                    return `${j} Juz${hlmStr}`;
                };

                // Collect surah for this santri across all juz
                const surahs = surahData
                    .filter((s) => s.santri_nis === nis)
                    .map((s) => s.surah_list)
                    .filter(Boolean)
                    .join(", ");

                ws1.addRow([
                    idx1,
                    first.santri_nama,
                    first.santri_kelas,
                    formatJuzHlm(totalAwal, awalHlm),
                    formatJuzHlm(totalAkhir, akhirHlm),
                    totalAkhir > totalAwal ? `+${totalAkhir - totalAwal} Juz` :
                        totalAkhir < totalAwal ? `${totalAkhir - totalAwal} Juz` : "—",
                    surahs || "—",
                ]);

                const row = ws1.getRow(ws1.rowCount);
                row.getCell(1).alignment = { horizontal: "center" };
                row.getCell(4).alignment = { horizontal: "center" };
                row.getCell(5).alignment = { horizontal: "center" };
                row.getCell(6).alignment = { horizontal: "center" };
                if (totalAkhir > totalAwal) {
                    row.getCell(6).font = { color: { argb: "FF16A34A" }, bold: true };
                } else if (totalAkhir < totalAwal) {
                    row.getCell(6).font = { color: { argb: "FFDC2626" }, bold: true };
                }
                idx1++;
            });

            ws1.getColumn(1).width = 5;
            ws1.getColumn(2).width = 25;
            ws1.getColumn(3).width = 8;
            ws1.getColumn(4).width = 18;
            ws1.getColumn(5).width = 18;
            ws1.getColumn(6).width = 15;
            ws1.getColumn(7).width = 45;
            ws1.autoFilter = { from: "A3", to: `G3` };
            ws1.views = [{ state: "frozen", ySplit: 3 }];

            // ── Sheet 2: Detail Per Santri ──
            const ws2 = wb.addWorksheet("Detail Per Santri");
            ws2.mergeCells("A1:F1");
            const title2 = ws2.getCell("A1");
            title2.value = `DETAIL HAFALAN — ${dateLabel}`;
            title2.font = { size: 13, bold: true, color: { argb: "FFFFFFFF" } };
            title2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7C3AED" } };
            title2.alignment = { horizontal: "center", vertical: "middle" };
            ws2.getRow(1).height = 26;

            const headers2 = ["NIS", "NAMA", "JUZ", "AWAL", "AKHIR", "DELTA"];
            ws2.getRow(3).values = headers2;
            ws2.getRow(3).eachCell((cell) => {
                cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4C1D95" } };
                cell.alignment = { horizontal: "center", vertical: "middle" };
            });

            let currentNis2 = "";
            (weeklyRows || []).forEach((r: any) => {
                const formatJuzCell = (completed: boolean, hlm: number) => {
                    if (completed) return "✅ Selesai";
                    if (hlm > 0) return `🔄 ${formatHalaman(hlm)} Hlm`;
                    return "—";
                };
                const delta = r.delta_juz_selesai !== 0 ? `+${r.delta_juz_selesai} Juz` :
                    r.delta_halaman !== 0 ? `+${formatHalaman(Math.abs(r.delta_halaman))} Hlm` : "—";

                const row2: (string | number)[] = [
                    r.santri_nis === currentNis2 ? "" : r.santri_nis,
                    r.santri_nis === currentNis2 ? "" : r.santri_nama,
                    r.juz,
                    formatJuzCell(r.awal_is_completed, r.awal_halaman_progress),
                    formatJuzCell(r.akhir_is_completed, r.akhir_halaman_progress),
                    delta,
                ];
                ws2.addRow(row2);
                currentNis2 = r.santri_nis;
            });

            ws2.getColumn(1).width = 12;
            ws2.getColumn(2).width = 25;
            ws2.getColumn(3).width = 6;
            ws2.getColumn(4).width = 18;
            ws2.getColumn(5).width = 18;
            ws2.getColumn(6).width = 15;

            // ── Sheet 3: Grid 30 Juz ──
            const ws3 = wb.addWorksheet("Grid 30 Juz");
            ws3.mergeCells("A1:AH1");
            const title3 = ws3.getCell("A1");
            title3.value = `PETA HAFALAN — ${dateRange[1].format("DD MMM YYYY")}`;
            title3.font = { size: 13, bold: true, color: { argb: "FFFFFFFF" } };
            title3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDC2626" } };
            title3.alignment = { horizontal: "center", vertical: "middle" };
            ws3.getRow(1).height = 26;

            const headers3 = ["NO", "NAMA", "KELAS", "JML", ...Array.from({ length: 30 }, (_, i) => `J${i + 1}`)];
            ws3.getRow(3).values = headers3;
            ws3.getRow(3).eachCell((cell) => {
                cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
                cell.alignment = { horizontal: "center", vertical: "middle" };
            });

            data.forEach((s, i) => {
                const row3: (string | number)[] = [i + 1, s.santri_nama, s.santri_kelas, s.total_juz_selesai];
                for (let j = 1; j <= 30; j++) {
                    const juzD = s.juzData.get(j);
                    row3.push(juzD ? (juzD.is_completed ? "✅" : juzD.halaman_progress > 0 ? formatHalaman(juzD.halaman_progress) : "—") : "—");
                }
                ws3.addRow(row3);
                const row = ws3.getRow(ws3.rowCount);
                row.getCell(1).alignment = { horizontal: "center" };
                row.getCell(4).alignment = { horizontal: "center" };
                for (let c = 5; c <= 34; c++) {
                    row.getCell(c).alignment = { horizontal: "center" };
                    row.getCell(c).font = { size: 9 };
                }
            });

            ws3.getColumn(1).width = 4;
            ws3.getColumn(2).width = 22;
            ws3.getColumn(3).width = 6;
            ws3.getColumn(4).width = 5;
            for (let c = 5; c <= 34; c++) ws3.getColumn(c).width = 5;

            // Save
            const buffer = await wb.xlsx.writeBuffer();
            const filename = `Peta_Hafalan_${dateRange[0].format("YYYYMMDD")}_${dateRange[1].format("YYYYMMDD")}.xlsx`;
            saveAs(new Blob([buffer]), filename);
            message.success(`Export berhasil: ${filename}`);
        } catch (err: any) {
            message.error(err.message || "Gagal export");
        }
    };

    // ── Cell click handler ──
    const handleCellClick = useCallback((santri: PetaSantri, juz: number) => {
        if (!isAdmin) return; // wali read-only
        setSelectedSantri(santri);
        setSelectedJuz(juz);
        setModalOpen(true);
    }, [isAdmin]);

    // ── Build ProTable columns ──
    const columns = useMemo<ProColumns<PetaSantri>[]>(() => {
        const base: ProColumns<PetaSantri>[] = [
            {
                title: "NO",
                dataIndex: "index",
                valueType: "indexBorder",
                width: 48,
                fixed: "left",
                align: "center",
            },
            {
                title: "NAMA",
                dataIndex: "santri_nama",
                fixed: "left",
                width: 200,
                render: (_, record) => (
                    <Space>
                        <Avatar
                            size="small"
                            src={record.santri_foto_url}
                            icon={<UserOutlined />}
                        />
                        <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{record.santri_nama}</div>
                            <Text type="secondary" style={{ fontSize: 11 }}>NIS: {record.santri_nis}</Text>
                        </div>
                    </Space>
                ),
            },
            {
                title: "KLS",
                dataIndex: "santri_kelas",
                width: 50,
                align: "center",
                render: (_, r) => <Tag>{r.santri_kelas}</Tag>,
            },
            {
                title: "JML",
                dataIndex: "total_juz_selesai",
                width: 50,
                align: "center",
                sorter: (a, b) => a.total_juz_selesai - b.total_juz_selesai,
                defaultSortOrder: "descend",
                render: (_, r) => (
                    <span style={{ fontWeight: 700, color: r.total_juz_selesai === 30 ? "#22c55e" : "#1F2937" }}>
                        {r.total_juz_selesai}
                    </span>
                ),
            },
        ];

        // Juz 1-30 columns
        for (let j = 1; j <= 30; j++) {
            base.push({
                title: `${j}`,
                dataIndex: `juz_${j}`,
                width: 52,
                align: "center",
                render: (_, record) => {
                    const juzD = record.juzData.get(j);
                    if (!juzD) return <span style={{ color: "#D1D5DB" }}>—</span>;

                    const bgColor = getCellBg(juzD);
                    const fgColor = getCellColor(juzD);
                    const content = juzD.is_completed ? "✅" :
                        juzD.halaman_progress > 0 ? formatHalaman(juzD.halaman_progress) : "—";

                    return (
                        <Tooltip
                            title={
                                <div>
                                    <div><b>Juz {j}</b> — {record.santri_nama}</div>
                                    {juzD.is_completed ? (
                                        <div>✅ Selesai</div>
                                    ) : juzD.halaman_progress > 0 ? (
                                        <div>🔄 {formatHalaman(juzD.halaman_progress)} halaman</div>
                                    ) : (
                                        <div>❌ Belum</div>
                                    )}
                                    {isAdmin && <div style={{ marginTop: 4, fontStyle: "italic" }}>Klik untuk update</div>}
                                </div>
                            }
                        >
                            <div
                                onClick={() => handleCellClick(record, j)}
                                style={{
                                    background: bgColor,
                                    color: fgColor,
                                    borderRadius: 4,
                                    padding: "2px 4px",
                                    fontSize: 11,
                                    fontWeight: 600,
                                    cursor: isAdmin ? "pointer" : "default",
                                    border: `1px solid ${fgColor}20`,
                                    lineHeight: "18px",
                                    minHeight: 22,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                {content}
                            </div>
                        </Tooltip>
                    );
                },
            });
        }

        return base;
    }, [isAdmin, handleCellClick]);

    return (
        <div>
            {/* Header */}
            <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div>
                    <Title level={4} style={{ margin: 0 }}>
                        <AppstoreOutlined style={{ marginRight: 8 }} />
                        Peta Hafalan Tahfidz
                    </Title>
                    <Text type="secondary">Status progress hafalan juz per santri</Text>
                </div>
                <Space wrap>
                    {isAdmin && (
                        <Select
                            placeholder="Filter Kelas"
                            allowClear
                            style={{ width: 140 }}
                            value={filterKelas}
                            onChange={(v) => setFilterKelas(v)}
                            options={[
                                { label: "Kelas 1", value: "1" },
                                { label: "Kelas 2", value: "2" },
                                { label: "Kelas 3", value: "3" },
                            ]}
                        />
                    )}
                    <RangePicker
                        value={dateRange}
                        onChange={(dates) => {
                            if (dates && dates[0] && dates[1]) {
                                setDateRange([dates[0], dates[1]]);
                            }
                        }}
                        format="DD MMM YYYY"
                    />
                    {isAdmin && (
                        <>
                            <Button
                                icon={<CameraOutlined />}
                                onClick={handleSnapshot}
                                loading={snapshotLoading}
                            >
                                Snapshot
                            </Button>
                            <Button
                                type="primary"
                                icon={<DownloadOutlined />}
                                onClick={handleExport}
                                style={{ background: "#047857" }}
                            >
                                Export Excel
                            </Button>
                        </>
                    )}
                    {!isAdmin && (
                        <Button
                            icon={<DownloadOutlined />}
                            onClick={handleExport}
                            style={{ background: "#047857", color: "#fff" }}
                        >
                            Export Excel
                        </Button>
                    )}
                </Space>
            </div>

            {/* KPI Cards */}
            <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={6}>
                    <Card size="small">
                        <Statistic
                            title="Rata-rata Juz Selesai"
                            value={stats.avgJuz}
                            suffix="/ 30"
                            valueStyle={{ color: "#047857" }}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card size="small">
                        <Statistic
                            title="Rata-rata Halaman Lanjutan"
                            value={stats.avgHalaman}
                            suffix="Hlm"
                            valueStyle={{ color: "#CA8A04" }}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card size="small">
                        <Statistic
                            title="Santri Selesai 30 Juz"
                            value={stats.totalSelesai}
                            suffix={`/ ${data.length}`}
                            valueStyle={{ color: "#7C3AED" }}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card size="small">
                        <Statistic
                            title="Santri Tercepat"
                            value={stats.tercepat?.total_juz_selesai || 0}
                            suffix="Juz"
                            valueStyle={{ color: "#DC2626" }}
                            prefix={<TrophyOutlined />}
                        />
                        {stats.tercepat && (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                                {stats.tercepat.santri_nama}
                            </Text>
                        )}
                    </Card>
                </Col>
            </Row>

            {/* Grid Table */}
            <ProTable<PetaSantri>
                columns={columns}
                dataSource={data}
                loading={loading}
                rowKey="santri_nis"
                search={false}
                pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} santri` }}
                scroll={{ x: 1800 }}
                size="small"
                bordered
                headerTitle={
                    <Space>
                        <BookOutlined />
                        <span>Grid 30 Juz</span>
                        <Badge count={data.length} style={{ backgroundColor: "#047857" }} />
                    </Space>
                }
                toolBarRender={() => [
                    <Button
                        key="refresh"
                        icon={<ReloadOutlined />}
                        onClick={() => { fetchData(); fetchSurahData(); }}
                    >
                        Refresh
                    </Button>,
                ]}
            />

            {/* Juz Detail Modal */}
            <JuzDetailModal
                open={modalOpen}
                santri={selectedSantri}
                juz={selectedJuz}
                onClose={() => setModalOpen(false)}
                onSaved={() => { fetchData(); fetchSurahData(); }}
            />
        </div>
    );
};

export default PetaHafalan;
