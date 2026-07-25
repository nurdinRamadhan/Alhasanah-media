/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  JADWAL KEGIATAN PESANTREN — LIST                                        ║
 * ║  Islamic Luxury Tech · Info/Agenda Kegiatan                              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useMemo } from "react";
import { useTable } from "@refinedev/antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import {
  Button, Tooltip, Switch, Modal,
  Select, Input,
} from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  EyeOutlined, FilterOutlined, SearchOutlined,
  CalendarOutlined, ClockCircleOutlined, BellOutlined,
  CheckCircleFilled, MinusCircleFilled,
  ExclamationCircleOutlined, EnvironmentOutlined,
} from "@ant-design/icons";
import { IJadwalKegiatan, IJadwalKategori } from "../../types";
import { useNavigation, useDelete, useUpdate } from "@refinedev/core";
import { useColorMode } from "../../contexts/color-mode";
import dayjs from "dayjs";
import { motion } from "framer-motion";

// ── DESIGN TOKENS ──
const GOLD = "#C9A84C";
const GOLD_BRIGHT = "#FFD166";
const GOLD_DEEP = "#A07830";

const darkT = {
  bg: "#08070D", surface: "#0F0F1A", card: "#141424", cardHover: "#1A1A2E",
  border: "rgba(201,168,76,0.13)", borderAccent: "rgba(201,168,76,0.38)",
  accent: GOLD_BRIGHT,
  text: "#F0EDE5", textSub: "#9E9080", textMuted: "#5C5248",
  divider: "rgba(255,255,255,0.055)",
};
const lightT = {
  bg: "#F7F4EE", surface: "#FFFFFF", card: "#FFFFFF", cardHover: "#FFFDF5",
  border: "rgba(0,0,0,0.07)", borderAccent: "rgba(201,168,76,0.40)",
  accent: GOLD_DEEP,
  text: "#0A0805", textSub: "#6B5F50", textMuted: "#9E9080",
  divider: "rgba(0,0,0,0.06)",
};

const ISLAMIC_SVG = `url("data:image/svg+xml,%3Csvg width='120' height='120' viewBox='0 0 120 120' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='rgba(201%2C168%2C76%2C0.07)' stroke-width='0.8'%3E%3Cpolygon points='60%2C10 110%2C35 110%2C85 60%2C110 10%2C85 10%2C35'/%3E%3Cpolygon points='60%2C25 95%2C42.5 95%2C77.5 60%2C95 25%2C77.5 25%2C42.5'/%3E%3Cline x1='60' y1='10' x2='60' y2='25'/%3E%3Cline x1='110' y1='35' x2='95' y2='42.5'/%3E%3Cline x1='110' y1='85' x2='95' y2='77.5'/%3E%3Cline x1='60' y1='110' x2='60' y2='95'/%3E%3Cline x1='10' y1='85' x2='25' y2='77.5'/%3E%3Cline x1='10' y1='35' x2='25' y2='42.5'/%3E%3C/g%3E%3C/svg%3E")`;

// ── FREKUENSI CONFIG ──
const FREKUENSI_MAP: Record<string, { label: string; color: string; bg: string }> = {
  harian:   { label: "Harian",     color: "#60A5FA", bg: "rgba(96,165,250,.12)" },
  mingguan: { label: "Mingguan",   color: "#34D399", bg: "rgba(52,211,153,.12)" },
  bulanan:  { label: "Bulanan",    color: "#A78BFA", bg: "rgba(167,139,250,.12)" },
  tahunan:  { label: "Tahunan",    color: GOLD_BRIGHT, bg: "rgba(255,209,102,.12)" },
  khusus:   { label: "Khusus",     color: "#F87171", bg: "rgba(248,113,113,.12)" },
};

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  aktif:    { label: "AKTIF",    color: "#34D399", bg: "rgba(52,211,153,.12)", border: "rgba(52,211,153,.28)", icon: <CheckCircleFilled /> },
  nonaktif: { label: "NONAKTIF", color: "#9E9080", bg: "rgba(158,144,128,.10)", border: "rgba(158,144,128,.24)", icon: <MinusCircleFilled /> },
  selesai:  { label: "SELESAI",  color: GOLD_BRIGHT, bg: "rgba(255,209,102,.10)", border: "rgba(255,209,102,.28)", icon: <ExclamationCircleOutlined /> },
};

// ── CSS ──
const buildCSS = (mode: "light" | "dark") => {
  const t = mode === "dark" ? darkT : lightT;
  return `
.jw-table .ant-pro-card { background:transparent!important; }
.jw-table .ant-card-body { padding:0!important; }
.jw-table .ant-pro-table-list-toolbar {
  background:${t.card}!important; border-bottom:1px solid ${t.divider}!important;
  border-radius:20px 20px 0 0!important; padding:16px 20px!important;
}
.jw-table .ant-table { background:${t.card}!important; }
.jw-table .ant-table-thead>tr>th {
  background:${mode==="dark"?"rgba(201,168,76,.06)":"rgba(201,168,76,.05)"}!important;
  border-bottom:1px solid ${t.border}!important; color:${t.textSub}!important;
  font-size:10px!important; font-weight:800!important; letter-spacing:.8px!important; text-transform:uppercase!important;
}
.jw-table .ant-table-tbody>tr>td {
  background:${t.card}!important; border-bottom:1px solid ${t.divider}!important;
  transition:background .12s!important; vertical-align:top!important;
}
.jw-table .ant-table-tbody>tr:hover>td { background:${t.cardHover}!important; }
.jw-filter .ant-select-selector,.jw-filter .ant-input-affix-wrapper {
  background:${t.card}!important; border-color:${t.border}!important; border-radius:10px!important;
}
.jw-sw.ant-switch-checked { background:linear-gradient(90deg,${GOLD},${GOLD_BRIGHT})!important; }
@keyframes jwFadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
.jw-in { animation:jwFadeUp .38s cubic-bezier(.22,1,.36,1) both; }
`;
};

// ── SUB COMPONENTS ──
const FrekuensiBadge = ({ f }: { f: string }) => {
  const c = FREKUENSI_MAP[f] || FREKUENSI_MAP.khusus;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 10px", borderRadius: 20,
      fontSize: 10, fontWeight: 800, letterSpacing: ".6px",
      color: c.color, background: c.bg, border: `1px solid ${c.color}30`,
    }}>
      {c.label}
    </span>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const c = STATUS_MAP[status] || STATUS_MAP.aktif;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "4px 10px", borderRadius: 20,
      fontSize: 10, fontWeight: 800, letterSpacing: "1px",
      color: c.color, background: c.bg, border: `1px solid ${c.border}`,
    }}>
      {c.icon} {c.label}
    </span>
  );
};

const KategoriTag = ({ kategori }: { kategori?: IJadwalKategori }) => {
  if (!kategori) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 9px", borderRadius: 8,
      fontSize: 10, fontWeight: 700, letterSpacing: ".5px",
      color: kategori.warna, background: `${kategori.warna}18`, border: `1px solid ${kategori.warna}30`,
    }}>
      {kategori.icon} {kategori.label}
    </span>
  );
};

const NotifBadge = ({ active }: { active: boolean }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "2px 8px", borderRadius: 8,
    fontSize: 9, fontWeight: 700,
    color: active ? "#34D399" : "#9E9080",
    background: active ? "rgba(52,211,153,.10)" : "rgba(158,144,128,.08)",
    border: `1px solid ${active ? "rgba(52,211,153,.25)" : "rgba(158,144,128,.20)"}`,
  }}>
    <BellOutlined style={{ fontSize: 9 }} />
    {active ? "Notif Aktif" : "Tanpa Notif"}
  </span>
);

// ── MAIN ──
export const JadwalKegiatanList = () => {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkT : lightT;

  const { tableQueryResult } = useTable<IJadwalKegiatan>({
    resource: "jadwal_kegiatan",
    syncWithLocation: false,
    pagination: { mode: "off" },
    sorters: { initial: [{ field: "urutan", order: "asc" }] },
    meta: {
      select: "*, kategori:jadwal_kategori(id, label, warna, icon)",
    },
  });

  const { push } = useNavigation();
  const { mutate: delFn } = useDelete();
  const { mutate: updFn } = useUpdate();

  const [fFrekuensi, setFrekuensi] = useState<string | null>(null);
  const [fStatus, setFStatus] = useState<string | null>(null);
  const [fSearch, setFSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const allData = useMemo(() => tableQueryResult?.data?.data ?? [], [tableQueryResult?.data?.data]);

  const filteredData = useMemo(() =>
    allData.filter(i => {
      if (fFrekuensi && i.frekuensi !== fFrekuensi) return false;
      if (fStatus && i.status !== fStatus) return false;
      if (fSearch && !i.nama_kegiatan?.toLowerCase().includes(fSearch.toLowerCase())) return false;
      return true;
    }), [allData, fFrekuensi, fStatus, fSearch]
  );

  const pagedData = useMemo(() =>
    filteredData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredData, page]
  );

  const totalAll = allData.length;
  const totalAktif = allData.filter(i => i.status === "aktif").length;
  const totalNotif = allData.filter(i => i.notifikasi_aktif).length;

  const handleToggleStatus = (id: string, currentStatus: string) => {
    const next = currentStatus === "aktif" ? "nonaktif" : "aktif";
    updFn({
      resource: "jadwal_kegiatan", id, values: { status: next },
      successNotification: { message: `Status → ${next}`, type: "success" },
    });
  };

  const handleDelete = (record: IJadwalKegiatan) =>
    Modal.confirm({
      title: "Hapus Kegiatan?",
      icon: <ExclamationCircleOutlined style={{ color: "#F87171" }} />,
      content: <div style={{ fontSize: 13 }}>Kegiatan <strong>"{record.nama_kegiatan}"</strong> akan dihapus permanen.</div>,
      okText: "Hapus", okType: "danger", cancelText: "Batal",
      onOk: () => delFn({ resource: "jadwal_kegiatan", id: record.id }),
    });

  const columns: ProColumns<IJadwalKegiatan>[] = [
    {
      title: "#", dataIndex: "urutan", width: 50, search: false,
      render: (_, r, i) => (
        <span style={{
          fontSize: 11, fontWeight: 800, color: t.textMuted,
          fontVariantNumeric: "tabular-nums",
        }}>
          {r.urutan || (i !== undefined ? i + 1 : 0)}
        </span>
      ),
    },
    {
      title: "Kegiatan", dataIndex: "nama_kegiatan",
      render: (_, r) => (
        <div style={{ paddingRight: 12 }}>
          <div style={{
            fontWeight: 700, fontSize: 13, color: t.text, lineHeight: 1.35, marginBottom: 4,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {r.nama_kegiatan}
          </div>
          {r.deskripsi && (
            <div style={{
              fontSize: 11, color: t.textSub, lineHeight: 1.4, marginBottom: 6,
              display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>
              {r.deskripsi}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <FrekuensiBadge f={r.frekuensi} />
            <KategoriTag kategori={r.kategori} />
            <NotifBadge active={r.notifikasi_aktif} />
          </div>
        </div>
      ),
    },
    {
      title: "Waktu", dataIndex: "tanggal_mulai", width: 180, search: false,
      render: (_, r) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 4 }}>
          {r.tanggal_mulai ? (
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: t.text }}>
              <CalendarOutlined style={{ fontSize: 11, color: GOLD }} />
              {dayjs(r.tanggal_mulai).format("DD MMM YYYY")}
              {r.tanggal_selesai && r.tanggal_selesai !== r.tanggal_mulai && (
                <span style={{ color: t.textMuted }}> — {dayjs(r.tanggal_selesai).format("DD MMM YYYY")}</span>
              )}
            </div>
          ) : r.catatan_waktu ? (
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: t.textSub, fontStyle: "italic" }}>
              <ClockCircleOutlined style={{ fontSize: 11, color: GOLD }} />
              {r.catatan_waktu}
            </div>
          ) : (
            <span style={{ fontSize: 11, color: t.textMuted }}>—</span>
          )}
          {r.waktu_mulai && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: t.textSub }}>
              <ClockCircleOutlined style={{ fontSize: 10 }} />
              {r.waktu_mulai?.substring(0, 5)}
              {r.waktu_selesai && ` — ${r.waktu_selesai?.substring(0, 5)}`}
            </div>
          )}
          {r.lokasi && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: t.textMuted }}>
              <EnvironmentOutlined style={{ fontSize: 10 }} />
              {r.lokasi}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Status", dataIndex: "status", width: 120, search: false,
      render: (_, r) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start", paddingTop: 4 }}>
          <StatusBadge status={r.status} />
          <div style={{
            display: "flex", alignItems: "center", gap: 6, padding: "4px 8px",
            background: mode === "dark" ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)",
            border: `1px solid ${t.border}`, borderRadius: 8,
          }}>
            <Switch size="small" checked={r.status === "aktif"}
              onChange={() => handleToggleStatus(r.id, r.status)}
              className="jw-sw"
              style={{ background: r.status === "aktif" ? undefined : "rgba(158,144,128,.30)" }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: r.status === "aktif" ? "#34D399" : t.textMuted }}>
              {r.status === "aktif" ? "Aktif" : "Off"}
            </span>
          </div>
        </div>
      ),
    },
    {
      title: "Aksi", valueType: "option", width: 110, fixed: "right", align: "center",
      render: (_, record) => (
        <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
          <Tooltip title="Detail">
            <Button size="small" type="text" icon={<EyeOutlined />}
              onClick={() => push(`/jadwal-kegiatan/show/${record.id}`)}
              style={{ borderRadius: 8, color: t.textSub, background: mode === "dark" ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)" }} />
          </Tooltip>
          <Tooltip title="Edit">
            <Button size="small" type="text" icon={<EditOutlined />}
              onClick={() => push(`/jadwal-kegiatan/edit/${record.id}`)}
              style={{ borderRadius: 8, color: "#60A5FA", background: "rgba(96,165,250,.09)" }} />
          </Tooltip>
          <Tooltip title="Hapus">
            <Button size="small" type="text" danger icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
              style={{ borderRadius: 8, color: "#F87171", background: "rgba(248,113,113,.09)" }} />
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <div style={{ background: t.bg, minHeight: "100vh", paddingBottom: 80 }}>
      <style>{buildCSS(mode)}</style>

      {/* HERO */}
      <div style={{
        background: mode === "dark"
          ? "linear-gradient(135deg,#0E0C07 0%,#151208 50%,#0A0E0C 100%)"
          : "linear-gradient(135deg,#2D2416 0%,#3D3020 50%,#241C10 100%)",
        backgroundImage: ISLAMIC_SVG, backgroundSize: "120px 120px",
        borderRadius: 24, padding: "28px 32px", marginBottom: 24,
        position: "relative", overflow: "hidden",
        border: `1px solid ${GOLD}18`,
        boxShadow: mode === "dark"
          ? `0 24px 60px rgba(0,0,0,.60),inset 0 1px 0 rgba(201,168,76,.13)`
          : "0 8px 32px rgba(0,0,0,.20)",
      }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg,transparent,${GOLD_BRIGHT},${GOLD},transparent)`, opacity: .8 }} />
        <div style={{ position: "absolute", top: -40, right: "20%", width: 300, height: 200,
          background: `radial-gradient(ellipse,${GOLD}10 0%,transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 16, position: "relative" }}>
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase",
              background: `linear-gradient(90deg,${GOLD},${GOLD_BRIGHT})`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 6,
            }}>
              ◆ Jadwal & Agenda ◆
            </div>
            <h1 style={{ margin: 0, fontSize: "clamp(20px,2.5vw,28px)", fontWeight: 800, color: "#F5EDD8", lineHeight: 1.2 }}>
              Jadwal Kegiatan Pesantren
            </h1>
            <p style={{ margin: "6px 0 0", color: "rgba(245,237,216,.50)", fontSize: 13 }}>
              {totalAll} kegiatan terdaftar · {totalAktif} aktif
            </p>
          </div>
          <Button type="primary" size="large" icon={<PlusOutlined />}
            onClick={() => push("/jadwal-kegiatan/create")}
            style={{
              background: `linear-gradient(135deg,${GOLD},${GOLD_BRIGHT})`,
              border: "none", color: "#000", fontWeight: 700, borderRadius: 12, height: 46,
              paddingInline: 24, boxShadow: `0 6px 18px ${GOLD}50`,
            }}>
            Tambah Kegiatan
          </Button>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total", value: totalAll, color: "#60A5FA" },
          { label: "Aktif", value: totalAktif, color: "#34D399" },
          { label: "Dengan Notifikasi", value: totalNotif, color: GOLD_BRIGHT },
        ].map((s, i) => (
          <motion.div key={s.label}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: .38, delay: i * .06, ease: [.22, 1, .36, 1] }}
            style={{
              background: t.card, border: `1px solid ${t.border}`, borderRadius: 14,
              padding: "14px 16px", display: "flex", alignItems: "center", gap: 12,
            }}>
            <div style={{
              width: 38, height: 38, flexShrink: 0, display: "flex", alignItems: "center",
              justifyContent: "center", background: `${s.color}18`, border: `1px solid ${s.color}28`, borderRadius: 10,
            }}>
              <CalendarOutlined style={{ color: s.color, fontSize: 15 }} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".6px", textTransform: "uppercase", color: t.textMuted }}>
                {s.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                {s.value}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* FILTER */}
      <div className="jw-filter" style={{
        background: t.card, border: `1px solid ${t.border}`,
        borderRadius: 16, padding: "14px 18px", marginBottom: 16,
        display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, alignSelf: "center" }}>
          <div style={{
            width: 32, height: 32, background: `linear-gradient(135deg,${GOLD}20,${GOLD_BRIGHT}14)`,
            border: `1px solid ${GOLD}28`, borderRadius: 9,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <FilterOutlined style={{ color: t.accent, fontSize: 13 }} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 13, color: t.textSub, whiteSpace: "nowrap" }}>Filter</span>
        </div>
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".6px", textTransform: "uppercase", color: t.textMuted, marginBottom: 5 }}>Nama Kegiatan</div>
            <Input prefix={<SearchOutlined style={{ color: t.textMuted, fontSize: 13 }} />}
              placeholder="Cari..." value={fSearch}
              onChange={e => { setFSearch(e.target.value); setPage(1); }}
              style={{ borderRadius: 10 }} />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".6px", textTransform: "uppercase", color: t.textMuted, marginBottom: 5 }}>Frekuensi</div>
            <Select allowClear placeholder="Semua" style={{ width: "100%" }} value={fFrekuensi}
              onChange={v => { setFrekuensi(v); setPage(1); }}
              options={[
                { label: "Harian", value: "harian" },
                { label: "Mingguan", value: "mingguan" },
                { label: "Bulanan", value: "bulanan" },
                { label: "Tahunan", value: "tahunan" },
                { label: "Khusus", value: "khusus" },
              ]} />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".6px", textTransform: "uppercase", color: t.textMuted, marginBottom: 5 }}>Status</div>
            <Select allowClear placeholder="Semua" style={{ width: "100%" }} value={fStatus}
              onChange={v => { setFStatus(v); setPage(1); }}
              options={[
                { label: "Aktif", value: "aktif" },
                { label: "Nonaktif", value: "nonaktif" },
                { label: "Selesai", value: "selesai" },
              ]} />
          </div>
        </div>
        {(fFrekuensi || fStatus || fSearch) && (
          <button onClick={() => { setFrekuensi(null); setFStatus(null); setFSearch(""); setPage(1); }}
            style={{
              fontSize: 10, fontWeight: 700, color: "#F87171", background: "rgba(248,113,113,.10)",
              border: "1px solid rgba(248,113,113,.25)", borderRadius: 8, padding: "4px 10px", cursor: "pointer",
            }}>
            Reset ✕
          </button>
        )}
      </div>

      {/* TABLE */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .28 }}>
        <ProTable
          dataSource={pagedData}
          loading={tableQueryResult.isLoading}
          columns={columns}
          rowKey="id"
          search={false}
          options={false}
          className="jw-table"
          style={{ borderRadius: 20, overflow: "hidden", border: `1px solid ${t.border}` }}
          ghost
          scroll={{ x: 900 }}
          pagination={false}
          headerTitle={
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 36, height: 36, background: `linear-gradient(135deg,${GOLD}20,${GOLD_BRIGHT}14)`,
                border: `1px solid ${GOLD}25`, borderRadius: 10,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <CalendarOutlined style={{ color: t.accent, fontSize: 16 }} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: t.text }}>Daftar Kegiatan</div>
                <div style={{ fontSize: 11, color: t.textMuted }}>
                  {filteredData.length} kegiatan{fFrekuensi || fStatus || fSearch ? " (difilter)" : ""}
                </div>
              </div>
            </div>
          }
          toolBarRender={() => []}
        />
        {filteredData.length > PAGE_SIZE && (
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
            <Button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              style={{ borderRadius: 9, borderColor: t.border, color: t.textSub }}>← Sebelumnya</Button>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: t.textSub, padding: "0 12px" }}>
              Hal {page} / {Math.ceil(filteredData.length / PAGE_SIZE)}
            </span>
            <Button disabled={page >= Math.ceil(filteredData.length / PAGE_SIZE)} onClick={() => setPage(p => p + 1)}
              style={{ borderRadius: 9, borderColor: t.border, color: t.textSub }}>Berikutnya →</Button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
