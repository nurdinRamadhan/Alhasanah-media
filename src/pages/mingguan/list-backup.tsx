import React, { useState, useEffect, useMemo } from "react";
import {
    Button, Typography, Space, Select, Segmented, message,
    Avatar, Tag, Spin, theme, Modal, DatePicker,
} from "antd";
import {
    CalendarOutlined, DownloadOutlined,
    FileExcelOutlined, UserOutlined,
} from "@ant-design/icons";
import { useGetIdentity } from "@refinedev/core";
import dayjs from "dayjs";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { supabaseClient } from "../../utility/supabaseClient";
import { formatHijri, HIJRI_MONTHS, formatMasehi } from "../../utility/dateHelper";
import { santriAlias } from "../../utility/privacy";
import hijriConverter from "hijri-converter";

const { Text } = Typography;
const { RangePicker } = DatePicker;
const { useToken } = theme;

const STATUS_ABSENSI = [
    { key: 'HADIR',   label: 'Hadir',   icon: '✅', color: '#16A34A', bg: 'rgba(22,163,74,0.10)' },
    { key: 'SAKIT',   label: 'Sakit',   icon: '🤒', color: '#D97706', bg: 'rgba(217,119,6,0.10)' },
    { key: 'IZIN',    label: 'Izin',    icon: '📝', color: '#2563EB', bg: 'rgba(37,99,235,0.10)' },
    { key: 'SEKOLAH', label: 'Sekolah', icon: '🏫', color: '#6366F1', bg: 'rgba(99,102,241,0.10)' },
    { key: 'GHAIB',   label: 'Ghaib',   icon: '❌', color: '#DC2626', bg: 'rgba(220,38,38,0.10)' },
    { key: 'PULANG',  label: 'Pulang',  icon: '🏠', color: '#9333EA', bg: 'rgba(147,51,234,0.10)' },
];

const KEGIATAN_INFO: Record<string, { label: string; icon: string }> = {
    HAFALAN:    { label: 'Hafalan',    icon: '📖' },
    ISTIGHOSAH: { label: 'Istighosah', icon: '🤲' },
    NGAOS_AANG: { label: 'Ngaos Aang', icon: '📚' },
    TILAWAH:    { label: 'Tilawah/Kaligrafi', icon: '🕌' },
    TAWASUL:    { label: 'Tawasul',    icon: '🙏' },
    MHQ:        { label: 'MHQ',        icon: '🏆' },
    MUHADHOROH: { label: 'Muhadhoroh', icon: '🎤' },
};

const KEGIATAN_MINGGUAN: Record<number, string[]> = {
    1: ['ISTIGHOSAH', 'NGAOS_AANG', 'TILAWAH', 'TAWASUL'],
    2: ['NGAOS_AANG', 'TILAWAH', 'TAWASUL', 'MUHADHOROH'],
    3: ['NGAOS_AANG', 'TILAWAH', 'TAWASUL', 'MHQ'],
    4: ['NGAOS_AANG', 'TILAWAH', 'TAWASUL', 'MHQ'],
    5: ['NGAOS_AANG', 'TILAWAH', 'TAWASUL', 'MHQ'],
};

const STATUS_FILLS: Record<string, string> = {
    HADIR: 'FFD1FAE5', SAKIT: 'FFFEF3C7', IZIN: 'FFDBEAFE',
    SEKOLAH: 'FFE0E7FF', GHAIB: 'FFFEE2E2', PULANG: 'FFFFEDD5',
};

const STATUS_CODE: Record<string, string> = {
    HADIR: 'H', SAKIT: 'S', IZIN: 'I', SEKOLAH: 'Sk', GHAIB: 'GH', PULANG: 'P',
};

const hexLum = (hex: string): number => {
    const c = hex.replace("#", "");
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    return 0.299 * r + 0.587 * g + 0.114 * b;
};

const getCurrentHijri = () => {
    const now = new Date();
    return hijriConverter.toHijri(now.getFullYear(), now.getMonth() + 1, now.getDate());
};

export const MingguanList: React.FC = () => {
    const { token } = useToken();
    const isDark = hexLum(token.colorBgContainer) < 128;
    const { data: identity } = useGetIdentity<any>();

    const todayHijri = useMemo(() => getCurrentHijri(), []);
    const [tahun, setTahun] = useState(todayHijri.hy);
    const [bulan, setBulan] = useState(todayHijri.hm);
    const [mingguKe, setMingguKe] = useState(Math.min(Math.ceil(todayHijri.hd / 7), 4));
    const [santriList, setSantriList] = useState<any[]>([]);
    const [sesiMap, setSesiMap] = useState<Record<string, string>>({});
    const [absensiGrid, setAbsensiGrid] = useState<Record<string, Record<string, { status: string | null; nilai_hafalan: number | null }>>>({});
    const [loading, setLoading] = useState(true);
    const [savingCell, setSavingCell] = useState<string | null>(null);
    const [fetchKey, setFetchKey] = useState(0);
    const [exportLoading, setExportLoading] = useState(false);
    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [exportDateRange, setExportDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>([
        dayjs().startOf("month"), dayjs(),
    ]);

    const kegiatanList = KEGIATAN_MINGGUAN[mingguKe] || [];
    const allColumns = kegiatanList; // HAFALAN only in export
    const bulanLabel = HIJRI_MONTHS[bulan - 1];

    // Fetch santri
    useEffect(() => {
        supabaseClient
            .from("santri")
            .select("nis, nama, kelas, total_hafalan, foto_url")
            .eq("jurusan", "TAHFIDZ")
            .eq("status_santri", "AKTIF")
            .order("kelas", { ascending: true })
            .order("nama", { ascending: true })
            .then(({ data, error }) => {
                if (error) { message.error("Gagal memuat data santri"); return; }
                setSantriList(data || []);
            });
    }, []);

    // Fetch or create all sesi for this week + absensi
    useEffect(() => {
        if (!tahun || !bulan || !mingguKe) return;
        setLoading(true);
        setSesiMap({});
        setAbsensiGrid({});

        (async () => {
            const sesiResult: Record<string, string> = {};
            const allKegiatan = KEGIATAN_MINGGUAN[mingguKe] || [];

            if (allKegiatan.length === 0) { setLoading(false); return; }

            const gregorian = hijriConverter.toGregorian(tahun, bulan, 1);
            const firstOfMonth = new Date(gregorian.gy, gregorian.gm - 1, gregorian.gd);
            const weekOffset = (mingguKe - 1) * 7;
            const sesiDate = new Date(firstOfMonth);
            sesiDate.setDate(firstOfMonth.getDate() + weekOffset);
            const tanggalStr = dayjs(sesiDate).format("YYYY-MM-DD");

            for (const kid of allKegiatan) {
                const { data: existing } = await supabaseClient
                    .from("mingguan_sesi")
                    .select("id")
                    .eq("kegiatan_id", kid)
                    .eq("bulan_hijriah", bulanLabel)
                    .eq("tahun_hijriah", tahun)
                    .eq("minggu_ke", mingguKe)
                    .limit(1);

                let sesi = existing && existing.length > 0 ? existing[0] : null;
                if (!sesi) {
                    const { data: newSesi } = await supabaseClient
                        .from("mingguan_sesi")
                        .insert({
                            kegiatan_id: kid,
                            bulan_hijriah: bulanLabel,
                            tahun_hijriah: tahun,
                            bulan_hijriah_number: bulan,
                            minggu_ke: mingguKe,
                            tanggal: tanggalStr,
                            created_by: identity?.id,
                        })
                        .select("id")
                        .single();
                    sesi = newSesi;
                }
                if (sesi) sesiResult[kid] = sesi.id;
            }
            setSesiMap(sesiResult);

            // Fetch all absensi for these sesi
            const sesiIds = Object.values(sesiResult);
            if (sesiIds.length === 0) { setLoading(false); return; }

            const { data: absensiData } = await supabaseClient
                .from("mingguan_absensi")
                .select("sesi_id, santri_nis, status, nilai_hafalan")
                .in("sesi_id", sesiIds);

            const grid: Record<string, Record<string, { status: string | null; nilai_hafalan: number | null }>> = {};
            (absensiData || []).forEach((a: any) => {
                if (!grid[a.santri_nis]) grid[a.santri_nis] = {};
                grid[a.santri_nis][a.sesi_id] = { status: a.status, nilai_hafalan: a.nilai_hafalan };
            });
            setAbsensiGrid(grid);
            setLoading(false);
        })();
    }, [tahun, bulan, mingguKe, identity?.id, fetchKey]);

    const handleStatusClick = async (nis: string, sesiId: string, status: string) => {
        const cellKey = `${nis}_${sesiId}`;
        if (savingCell) return;
        setSavingCell(cellKey);
        try {
            await supabaseClient
                .from("mingguan_absensi")
                .upsert({
                    sesi_id: sesiId,
                    santri_nis: nis,
                    status,
                    nilai_hafalan: null,
                }, { onConflict: "sesi_id, santri_nis" });

            setAbsensiGrid(prev => ({
                ...prev,
                [nis]: { ...prev[nis], [sesiId]: { status, nilai_hafalan: null } },
            }));
        } catch {
            message.error("Gagal menyimpan");
        } finally {
            setSavingCell(null);
        }
    };

    const yearOptions = useMemo(() => {
        const years: number[] = [];
        for (let y = todayHijri.hy - 2; y <= todayHijri.hy + 2; y++) years.push(y);
        return years;
    }, [todayHijri.hy]);

    const colLetter = (n: number): string => {
        let s = '';
        while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
        return s;
    };

    const handleExport = async () => {
        if (!exportDateRange) { message.error("Pilih rentang tanggal"); return; }
        setExportLoading(true);
        try {
            const startDate = exportDateRange[0].format("YYYY-MM-DD");
            const endDate = exportDateRange[1].format("YYYY-MM-DD");

            const { data: santri } = await supabaseClient
                .from("santri")
                .select("nis, nama, kelas, total_hafalan")
                .eq("jurusan", "TAHFIDZ")
                .eq("status_santri", "AKTIF")
                .order("kelas", { ascending: true })
                .order("nama", { ascending: true });
            const santriListData = santri || [];

            const { data: sesiList } = await supabaseClient
                .from("mingguan_sesi")
                .select("id, kegiatan_id, bulan_hijriah, minggu_ke, tanggal")
                .gte("tanggal", startDate)
                .lte("tanggal", endDate)
                .order("tanggal", { ascending: true });

            if (!sesiList || sesiList.length === 0) {
                message.warning("Tidak ada data mingguan di rentang tersebut");
                setExportLoading(false);
                return;
            }

            const sesiIds = sesiList.map(s => s.id);
            const { data: absensiData } = await supabaseClient
                .from("mingguan_absensi")
                .select("sesi_id, santri_nis, status, nilai_hafalan")
                .in("sesi_id", sesiIds);

            const absensiBySesi: Record<string, Record<string, any>> = {};
            (absensiData || []).forEach((a: any) => {
                if (!absensiBySesi[a.sesi_id]) absensiBySesi[a.sesi_id] = {};
                absensiBySesi[a.sesi_id][a.santri_nis] = a;
            });

            const wb = new ExcelJS.Workbook();
            const ws = wb.addWorksheet("Absensi Mingguan");

            const title = `LAPORAN ABSENSI MINGGUAN TAHFIDZ — ${formatMasehi(startDate)} s/d ${formatMasehi(endDate)} / ${formatHijri(startDate)} s/d ${formatHijri(endDate)}`;
            ws.mergeCells(`A1:${colLetter(4 + sesiList.length)}1`);
            ws.getCell("A1").value = title;
            ws.getCell("A1").font = { size: 13, bold: true, color: { argb: "FFFFFFFF" } };
            ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC9A84C" } };
            ws.getCell("A1").alignment = { horizontal: "center" };
            ws.getRow(1).height = 22;

            ws.mergeCells("A3:D3");
            ws.getCell("A3").value = "DATA SANTRI";
            ws.getCell("A3").font = { bold: true, color: { argb: "FFFFFFFF" } };
            ws.getCell("A3").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF374151" } };
            ws.getCell("A3").alignment = { horizontal: "center" };

            ws.columns = [
                { key: "no", width: 5 },
                { key: "nis", width: 13 },
                { key: "nama", width: 24 },
                { key: "kelas", width: 8 },
                ...sesiList.map((sesi: any) => ({ key: `s_${sesi.id}`, width: 13 })),
            ];

            let colIdx = 5;
            sesiList.forEach((sesi: any, i: number) => {
                const startCol = colLetter(colIdx);
                ws.mergeCells(`${startCol}3:${startCol}3`);
                const k = KEGIATAN_INFO[sesi.kegiatan_id];
                ws.getCell(`${startCol}3`).value = `${k?.icon || ''} ${k?.label || sesi.kegiatan_id} Mg${sesi.minggu_ke}`;
                ws.getCell(`${startCol}3`).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
                ws.getCell(`${startCol}3`).fill = {
                    type: "pattern", pattern: "solid",
                    fgColor: { argb: sesi.kegiatan_id === 'HAFALAN' ? "FFC9A84C" : i % 2 === 0 ? "FF7C3AED" : "FF2563EB" },
                };
                ws.getCell(`${startCol}3`).alignment = { horizontal: "center", textRotation: 45 };
                colIdx++;
            });

            ws.getRow(4).values = [
                "NO", "NIS", "Nama Santri", "Kelas",
                ...sesiList.map(s => {
                    const k = KEGIATAN_INFO[s.kegiatan_id];
                    return k?.label || s.kegiatan_id;
                }),
            ];
            ws.getRow(4).font = { bold: true };
            ws.getRow(4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };

            santriListData.forEach((s: any, idx: number) => {
                const row: any = {
                    no: idx + 1, nis: s.nis, nama: s.nama || santriAlias(s.nis), kelas: s.kelas,
                };
                sesiList.forEach((sesi: any) => {
                    const abs = absensiBySesi[sesi.id]?.[s.nis];
                    if (sesi.kegiatan_id === 'HAFALAN') {
                        row[`s_${sesi.id}`] = abs?.nilai_hafalan ?? s.total_hafalan ?? '-';
                    } else {
                        row[`s_${sesi.id}`] = STATUS_CODE[abs?.status] || abs?.status || '-';
                    }
                });
                ws.addRow(row);

                const dataRow = ws.getRow(ws.rowCount);
                sesiList.forEach((sesi: any, si: number) => {
                    const abs = absensiBySesi[sesi.id]?.[s.nis];
                    if (abs?.status) {
                        const fill = STATUS_FILLS[abs.status];
                        if (fill) dataRow.getCell(5 + si).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
                    }
                });
            });

            ws.autoFilter = { from: "A4", to: `${colLetter(4 + sesiList.length)}4` };
            ws.views = [{ state: "frozen", ySplit: 4 }];

            const buffer = await wb.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `Absensi_Mingguan_${dayjs().format("YYYYMMDD")}.xlsx`);
            message.success("Berhasil diunduh");
            setExportModalOpen(false);
        } catch (error: any) {
            message.error("Gagal export: " + error.message);
        } finally {
            setExportLoading(false);
        }
    };

    return (
        <div style={{ padding: "0 0 80px" }}>
            <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                        <Text style={{ fontSize: 18, fontWeight: 500, display: "block" }}>
                            📋 Absensi Mingguan Tahfidz
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            {bulanLabel} {tahun} H — Minggu ke-{mingguKe}
                        </Text>
                    </div>
                    <Space>
                        <Button
                            icon={<FileExcelOutlined />}
                            onClick={() => setExportModalOpen(true)}
                            style={{ color: "#16a34a", borderColor: "#16a34a" }}
                        >
                            Export
                        </Button>
                        <Button
                            type="primary"
                            icon={<CalendarOutlined />}
                            onClick={() => {
                                const h = getCurrentHijri();
                                setTahun(h.hy);
                                setBulan(h.hm);
                                setMingguKe(Math.min(Math.ceil(h.hd / 7), 4));
                            }}
                            style={{
                                background: "linear-gradient(135deg, #C9A84C, #8B6E23)",
                                border: "none",
                                borderRadius: 8, fontWeight: 600,
                            }}
                        >
                            Bulan Ini
                        </Button>
                    </Space>
                </div>
            </div>

            <div style={{
                background: token.colorBgContainer,
                border: `1px solid ${isDark ? "#334155" : token.colorBorderSecondary}`,
                borderRadius: 12, padding: "16px 20px", marginBottom: 16,
                boxShadow: isDark ? "0 1px 3px rgba(0,0,0,0.25)" : "0 1px 3px rgba(0,0,0,0.06)",
            }}>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                    <Space>
                        <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>Tahun:</Text>
                        <Select
                            value={tahun}
                            onChange={setTahun}
                            options={yearOptions.map(y => ({ label: `${y} H`, value: y }))}
                            size="small"
                            style={{ width: 100 }}
                        />
                    </Space>
                    <Space>
                        <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>Bulan:</Text>
                        <Select
                            value={bulan}
                            onChange={v => { setBulan(v); setMingguKe(1); }}
                            options={HIJRI_MONTHS.map((name, i) => ({ label: name, value: i + 1 }))}
                            size="small"
                            style={{ width: 150 }}
                        />
                    </Space>
                    <Space>
                        <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>Minggu:</Text>
                        <Segmented
                            value={mingguKe}
                            onChange={v => setMingguKe(v as number)}
                            size="small"
                            options={[1, 2, 3, 4].map(m => ({
                                label: `Minggu ${m}`,
                                value: m,
                            }))}
                        />
                    </Space>
                </div>

                <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {kegiatanList.map(kid => {
                        const info = KEGIATAN_INFO[kid];
                        return (
                            <Tag key={kid} style={{
                                fontSize: 11, padding: "4px 10px",
                                background: "rgba(124,58,237,0.10)",
                                color: '#7C3AED',
                                border: `1px solid #7C3AED44`,
                                borderRadius: 6,
                            }}>
                                {info?.icon} {info?.label}
                            </Tag>
                        );
                    })}
                </div>
            </div>

            <div style={{
                background: token.colorBgContainer,
                border: `1px solid ${isDark ? "#334155" : token.colorBorderSecondary}`,
                borderRadius: 12, overflow: "hidden",
            }}>
                {loading ? (
                    <div style={{ padding: "40px 20px", textAlign: "center" }}>
                        <Spin /> <span style={{ marginLeft: 8, color: token.colorTextSecondary }}>Memuat data...</span>
                    </div>
                ) : kegiatanList.length === 0 ? (
                    <div style={{ padding: "40px 20px", textAlign: "center", color: token.colorTextSecondary }}>
                            Tidak ada kegiatan untuk minggu ini
                    </div>
                ) : (
                    <>
                        <div style={{
                            padding: "12px 20px", borderBottom: `1px solid ${token.colorBorderSecondary}`,
                            background: isDark ? "#1E293B" : "#F8FAFC",
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                        }}>
                            <Space>
                                <Text strong>{bulanLabel} {tahun} H — Minggu ke-{mingguKe}</Text>
                                <Tag color="green" style={{ fontSize: 10 }}>{santriList.length} santri</Tag>
                            </Space>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                                Klik status untuk simpan
                            </Text>
                        </div>

                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                                <thead>
                                    <tr style={{ background: isDark ? "#1E293B" : "#F8FAFC" }}>
                                        <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, color: token.colorTextSecondary, fontWeight: 600, borderBottom: `1px solid ${token.colorBorderSecondary}`, width: 40 }}>#</th>
                                        <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, color: token.colorTextSecondary, fontWeight: 600, borderBottom: `1px solid ${token.colorBorderSecondary}`, width: 180 }}>Santri</th>
                                        <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, color: token.colorTextSecondary, fontWeight: 600, borderBottom: `1px solid ${token.colorBorderSecondary}`, width: 50 }}>Kls</th>
                                        {kegiatanList.map(kid => {
                                            const info = KEGIATAN_INFO[kid];
                                            return (
                                                <th key={kid} style={{
                                                    padding: "8px 10px", textAlign: "center", fontSize: 11, fontWeight: 700,
                                                    color: '#7C3AED',
                                                    borderBottom: `1px solid ${token.colorBorderSecondary}`,
                                                    background: isDark ? '#1E1B2B' : '#F8F6FF',
                                                    minWidth: 160,
                                                }}>
                                                    {info?.icon} {info?.label}
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {santriList.map((santri: any, idx: number) => {
                                        const santriAbsensi = absensiGrid[santri.nis] || {};

                                        return (
                                            <tr key={santri.nis} style={{
                                                borderBottom: `1px solid ${isDark ? "#1E2D3D" : "#F1F5F9"}`,
                                            }}>
                                                <td style={{ padding: "10px 12px", fontSize: 11, color: token.colorTextSecondary }}>{idx + 1}</td>
                                                <td style={{ padding: "10px 12px" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                        <Avatar src={santri.foto_url} size={28} icon={<UserOutlined />} style={{ background: "#C9A84C", color: "#fff", flexShrink: 0 }} />
                                                        <div style={{ minWidth: 0 }}>
                                                            <div style={{ fontWeight: 600, fontSize: 12, color: token.colorText, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                                {santri.nama || santriAlias(santri.nis)}
                                                            </div>
                                                            <div style={{ fontSize: 10, color: token.colorTextSecondary }}>
                                                                <code style={{ background: isDark ? "#0F172A" : "#F1F5F9", padding: "1px 4px", borderRadius: 4, fontSize: 9 }}>{santri.nis}</code>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ padding: "10px 12px", textAlign: "center" }}>
                                                    <div style={{
                                                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                                                        width: 24, height: 24, borderRadius: 6,
                                                        background: isDark ? "#1E3A5F" : "#DBEAFE",
                                                        color: "#2563EB", fontWeight: 700, fontSize: 11,
                                                    }}>
                                                        {santri.kelas}
                                                    </div>
                                                </td>
                                                {kegiatanList.map(kid => {
                                                    const sesiId = sesiMap[kid];
                                                    const cellKey = `${santri.nis}_${sesiId}`;
                                                    const isSaving = savingCell === cellKey;
                                                    const rec = sesiId ? santriAbsensi[sesiId] : undefined;
                                                    const currentStatus = rec?.status || '';

                                                    return (
                                                        <td key={kid} style={{ padding: "8px 10px", textAlign: "center" }}>
                                                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "center" }}>
                                                                {STATUS_ABSENSI.map(s => {
                                                                    const active = currentStatus === s.key;
                                                                    return (
                                                                        <div
                                                                            key={s.key}
                                                                            onClick={() => sesiId && !isSaving && handleStatusClick(santri.nis, sesiId, currentStatus === s.key ? '' : s.key)}
                                                                            style={{
                                                                                padding: "5px 10px", borderRadius: 6,
                                                                                cursor: isSaving || !sesiId ? "not-allowed" : "pointer",
                                                                                fontSize: 11, fontWeight: active ? 700 : 400,
                                                                                border: `1.5px solid ${active ? s.color : token.colorBorderSecondary}`,
                                                                                background: active ? s.bg : "transparent",
                                                                                color: active ? s.color : token.colorTextTertiary,
                                                                                opacity: isSaving ? 0.5 : 1,
                                                                                transition: "all 0.12s",
                                                                                userSelect: "none",
                                                                                whiteSpace: "nowrap",
                                                                                display: "inline-flex",
                                                                                alignItems: "center",
                                                                                gap: 4,
                                                                            }}
                                                                        >
                                                                            <span style={{ fontSize: 13 }}>{s.icon}</span>
                                                                            <span>{s.label}</span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {santriList.length === 0 && (
                                <div style={{ padding: "40px 20px", textAlign: "center", color: token.colorTextSecondary }}>
                                    Tidak ada santri tahfidz aktif
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            <Modal
                title={<Space><FileExcelOutlined style={{ color: "#16a34a" }} /> Export Absensi Mingguan</Space>}
                open={exportModalOpen}
                onCancel={() => setExportModalOpen(false)}
                footer={[
                    <Button key="back" onClick={() => setExportModalOpen(false)}>Batal</Button>,
                    <Button key="submit" type="primary" icon={<DownloadOutlined />}
                        loading={exportLoading} onClick={handleExport}
                        style={{ background: "#16a34a", borderColor: "#16a34a" }}>
                        Download Excel
                    </Button>,
                ]}
            >
                <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0" }}>
                    <div>
                        <Text strong style={{ display: "block", marginBottom: 6 }}>Rentang Periode</Text>
                        <RangePicker
                            value={exportDateRange}
                            onChange={(dates: any) => setExportDateRange(dates as any)}
                            style={{ width: "100%" }} format="DD MMM YYYY"
                            presets={[
                                { label: "Bulan ini", value: [dayjs().startOf("month"), dayjs().endOf("month")] },
                                { label: "Bulan lalu", value: [dayjs().subtract(1, "month").startOf("month"), dayjs().subtract(1, "month").endOf("month")] },
                            ]}
                        />
                        <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: "block" }}>
                            Semua kegiatan mingguan dalam satu sheet. Gunakan filter Masehi, atau pintasan bulan Hijriah nanti.
                        </Text>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
