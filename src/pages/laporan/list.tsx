import React, { useState, useMemo } from "react";
import { useTable } from "@refinedev/antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import {
  Space, Button, Typography, Tag, Card, Row, Col, Select,
  Statistic, Badge, theme, Tooltip, message, Dropdown,
} from "antd";
import {
  BugOutlined, BulbOutlined, QuestionCircleOutlined,
  MessageOutlined, WarningOutlined, ArrowUpOutlined,
  ArrowDownOutlined, MinusOutlined, ThunderboltOutlined,
  ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined,
  InfoCircleOutlined, ReloadOutlined, EyeOutlined,
  MobileOutlined, CalendarOutlined, ExclamationCircleOutlined,
  HolderOutlined, FireOutlined,
} from "@ant-design/icons";
import { useNavigation } from "@refinedev/core";
import { supabaseClient } from "../../utility/supabaseClient";
import { ILaporanMasalah, LaporanStatus, LaporanKategori, LaporanPrioritas } from "../../types";
import { useColorMode } from "../../contexts/color-mode";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

const { Text } = Typography;
const { useToken } = theme;

// ─── STATUS CONFIG ────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  OPEN: { label: "Baru", color: "#2563EB", bg: "rgba(37,99,235,0.08)", border: "rgba(37,99,235,0.24)", icon: <ExclamationCircleOutlined /> },
  IN_PROGRESS: { label: "Ditinjau", color: "#D97706", bg: "rgba(217,119,6,0.08)", border: "rgba(217,119,6,0.24)", icon: <ClockCircleOutlined /> },
  PROCESSING: { label: "Dikerjakan", color: "#7C3AED", bg: "rgba(124,58,237,0.08)", border: "rgba(124,58,237,0.24)", icon: <ThunderboltOutlined /> },
  FIXED: { label: "Selesai", color: "#059669", bg: "rgba(5,150,105,0.08)", border: "rgba(5,150,105,0.24)", icon: <CheckCircleOutlined /> },
  REJECTED: { label: "Ditolak", color: "#DC2626", bg: "rgba(220,38,38,0.08)", border: "rgba(220,38,38,0.24)", icon: <CloseCircleOutlined /> },
  NEED_INFO: { label: "Butuh Info", color: "#8B5CF6", bg: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.24)", icon: <InfoCircleOutlined /> },
};

// ─── KATEGORI CONFIG ──────────────────────────────────────────
const KATEGORI_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  BUG: { label: "Bug", color: "#DC2626", icon: <BugOutlined /> },
  FITUR: { label: "Usulan Fitur", color: "#D97706", icon: <BulbOutlined /> },
  PERTANYAAN: { label: "Pertanyaan", color: "#2563EB", icon: <QuestionCircleOutlined /> },
  MASUKAN: { label: "Masukan", color: "#059669", icon: <MessageOutlined /> },
};

// ─── PRIORITAS CONFIG ─────────────────────────────────────────
const PRIORITAS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  LOW: { label: "Rendah", color: "#059669", icon: <ArrowDownOutlined /> },
  MEDIUM: { label: "Sedang", color: "#D97706", icon: <MinusOutlined /> },
  HIGH: { label: "Tinggi", color: "#DC2626", icon: <ArrowUpOutlined /> },
  URGENT: { label: "Mendesak", color: "#BE123C", icon: <FireOutlined /> },
};

const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([k, v]) => ({ label: v.label, value: k }));
const KATEGORI_OPTIONS = Object.entries(KATEGORI_CONFIG).map(([k, v]) => ({ label: v.label, value: k }));
const PRIORITAS_OPTIONS = Object.entries(PRIORITAS_CONFIG).map(([k, v]) => ({ label: v.label, value: k }));

// ─── COMPONENT ────────────────────────────────────────────────
export const LaporanMasalahList = () => {
  const { token } = useToken();
  const { mode } = useColorMode();
  const isDark = mode === "dark";
  const { show } = useNavigation();

  const G = useMemo(() => ({
    text: isDark ? "#F59E0B" : "#B45309",
    bg: isDark ? "rgba(245,158,11,0.08)" : "rgba(212,160,23,0.06)",
    border: isDark ? "rgba(245,158,11,0.20)" : "rgba(212,160,23,0.18)",
    card: isDark ? "#141424" : "#FFFFFF",
    surface: isDark ? "#0F0F1A" : "#F7F4EE",
    textPrimary: isDark ? "#F0EDE5" : "#0A0805",
    textSecondary: isDark ? "#9E9080" : "#6B5F50",
    textMuted: isDark ? "#5C5248" : "#9E9080",
    rowHover: isDark ? "rgba(245,158,11,0.04)" : "rgba(212,160,23,0.03)",
  }), [isDark]);

  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [kategoriFilter, setKategoriFilter] = useState<string | undefined>();
  const [prioritasFilter, setPrioritasFilter] = useState<string | undefined>();

  const { tableProps, tableQueryResult, filters, setFilters, sorter, setSorters } = useTable<ILaporanMasalah>({
    resource: "laporan_masalah",
    syncWithLocation: false,
    sorters: { initial: [{ field: "created_at", order: "desc" }] },
    meta: { select: "*" },
  });

  const data = useMemo(() => {
    const raw = (tableProps.dataSource as ILaporanMasalah[]) || [];
    let filtered = raw;
    if (statusFilter) filtered = filtered.filter((d) => d.status === statusFilter);
    if (kategoriFilter) filtered = filtered.filter((d) => d.kategori === kategoriFilter);
    if (prioritasFilter) filtered = filtered.filter((d) => d.prioritas === prioritasFilter);
    return filtered;
  }, [tableProps.dataSource, statusFilter, kategoriFilter, prioritasFilter]);

  const stats = useMemo(() => {
    const all = (tableProps.dataSource as ILaporanMasalah[]) || [];
    return {
      total: all.length,
      open: all.filter((d) => d.status === "OPEN").length,
      inProgress: all.filter((d) => ["IN_PROGRESS", "PROCESSING"].includes(d.status)).length,
      fixed: all.filter((d) => d.status === "FIXED").length,
      rejected: all.filter((d) => d.status === "REJECTED").length,
      needInfo: all.filter((d) => d.status === "NEED_INFO").length,
    };
  }, [tableProps.dataSource]);

  const handleQuickStatus = async (record: ILaporanMasalah, newStatus: string) => {
    const oldStatus = record.status;
    const { error: updateErr } = await supabaseClient
      .from("laporan_masalah")
      .update({ status: newStatus, updated_at: new Date().toISOString(), ...(newStatus === "FIXED" ? { fixed_at: new Date().toISOString() } : {}) })
      .eq("id", record.id);
    if (updateErr) { message.error("Gagal update status"); return; }
    const { error: logErr } = await supabaseClient.from("laporan_masalah_log").insert({ laporan_id: record.id, old_status: oldStatus, new_status: newStatus, catatan: `Status diubah ke ${STATUS_CONFIG[newStatus]?.label || newStatus}` });
    if (logErr) console.warn("Log error:", logErr);
    message.success(`Status diubah ke ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
    tableQueryResult.refetch();
  };

  const columns: ProColumns<ILaporanMasalah>[] = [
    {
      title: "Laporan",
      dataIndex: "judul",
      key: "judul",
      width: 280,
      ellipsis: true,
      render: (_, record) => (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Tag
              icon={KATEGORI_CONFIG[record.kategori]?.icon}
              color={KATEGORI_CONFIG[record.kategori]?.color}
              style={{ margin: 0, fontSize: 10, lineHeight: "18px", padding: "0 6px" }}
            >
              {KATEGORI_CONFIG[record.kategori]?.label || record.kategori}
            </Tag>
            <Badge
              status={record.status === "OPEN" ? "processing" : record.status === "FIXED" ? "success" : "default"}
              text={
                <span style={{ fontSize: 11, color: STATUS_CONFIG[record.status]?.color }}>
                  {STATUS_CONFIG[record.status]?.label || record.status}
                </span>
              }
            />
          </div>
          <Text strong style={{ fontSize: 13, color: G.textPrimary, display: "block" }}>
            {record.judul}
          </Text>
          <Text style={{ fontSize: 11, color: G.textMuted }} ellipsis>
            {record.deskripsi}
          </Text>
        </div>
      ),
      sorter: true,
    },
    {
      title: "Prioritas",
      dataIndex: "prioritas",
      key: "prioritas",
      width: 110,
      align: "center",
      render: (_, record) => {
        const cfg = PRIORITAS_CONFIG[record.prioritas];
        return (
          <Tag
            icon={cfg?.icon}
            color={cfg?.color}
            style={{ margin: 0, fontSize: 11, borderRadius: 6 }}
          >
            {cfg?.label || record.prioritas}
          </Tag>
        );
      },
      valueType: "select",
      valueEnum: Object.fromEntries(Object.entries(PRIORITAS_CONFIG).map(([k, v]) => [k, { text: v.label }])),
    },
    {
      title: "Pengguna",
      key: "pengguna",
      width: 160,
      render: (_, record) => (
        <div>
          <Text style={{ fontSize: 12, color: G.textPrimary, display: "block" }}>
            {record.nama_pengguna || "-"}
          </Text>
          <Text style={{ fontSize: 10, color: G.textMuted }}>
            {record.device_brand} {record.device_model}
          </Text>
        </div>
      ),
    },
    {
      title: "Device",
      key: "device",
      width: 140,
      hidden: true,
      render: (_, record) => (
        <div>
          <Text style={{ fontSize: 11, color: G.textSecondary, display: "block" }}>
            <MobileOutlined style={{ marginRight: 4 }} />
            {record.device_brand} {record.device_model}
          </Text>
          <Text style={{ fontSize: 10, color: G.textMuted }}>
            Android {record.android_version} {record.device_sdk ? `(API ${record.device_sdk})` : ""}
          </Text>
          <Text style={{ fontSize: 10, color: G.textMuted, display: "block" }}>
            v{record.app_version} · {record.source}
          </Text>
        </div>
      ),
    },
    {
      title: "Tanggal",
      dataIndex: "created_at",
      key: "created_at",
      width: 140,
      sorter: true,
      render: (_, record) => (
        <Tooltip title={dayjs(record.created_at).format("DD MMM YYYY HH:mm:ss")}>
          <Text style={{ fontSize: 11, color: G.textSecondary }}>
            <CalendarOutlined style={{ marginRight: 4 }} />
            {dayjs(record.created_at).format("DD MMM YYYY")}
          </Text>
          <br />
          <Text style={{ fontSize: 10, color: G.textMuted }}>
            {dayjs(record.created_at).fromNow()}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 130,
      align: "center",
      render: (_, record) => {
        const cfg = STATUS_CONFIG[record.status];
        return (
          <Tag
            icon={cfg?.icon}
            style={{
              color: cfg?.color,
              background: cfg?.bg,
              border: `1px solid ${cfg?.border}`,
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 600,
              margin: 0,
            }}
          >
            {cfg?.label || record.status}
          </Tag>
        );
      },
      valueType: "select",
      valueEnum: Object.fromEntries(Object.entries(STATUS_CONFIG).map(([k, v]) => [k, { text: v.label }])),
    },
    {
      title: "Aksi",
      key: "actions",
      width: 100,
      align: "center",
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Lihat Detail">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              style={{ color: G.text }}
              onClick={() => show("laporan_masalah", record.id)}
            />
          </Tooltip>
          <Dropdown
            menu={{
              items: Object.entries(STATUS_CONFIG)
                .filter(([k]) => k !== record.status)
                .map(([k, v]) => ({
                  key: k,
                  icon: v.icon,
                  label: `Ubah ke ${v.label}`,
                  style: { color: v.color },
                  onClick: () => handleQuickStatus(record, k),
                })),
            }}
            trigger={["click"]}
          >
            <Tooltip title="Ubah Status">
              <Button
                type="text"
                size="small"
                icon={<HolderOutlined />}
                style={{ color: G.textMuted }}
              />
            </Tooltip>
          </Dropdown>
        </Space>
      ),
    },
  ];

  const statCards = [
    { title: "Total", value: stats.total, color: G.text, bg: G.bg },
    { title: "Baru", value: stats.open, color: STATUS_CONFIG.OPEN.color, bg: STATUS_CONFIG.OPEN.bg },
    { title: "Dikerjakan", value: stats.inProgress, color: STATUS_CONFIG.IN_PROGRESS.color, bg: STATUS_CONFIG.IN_PROGRESS.bg },
    { title: "Selesai", value: stats.fixed, color: STATUS_CONFIG.FIXED.color, bg: STATUS_CONFIG.FIXED.bg },
    { title: "Ditolak", value: stats.rejected, color: STATUS_CONFIG.REJECTED.color, bg: STATUS_CONFIG.REJECTED.bg },
    { title: "Butuh Info", value: stats.needInfo, color: STATUS_CONFIG.NEED_INFO.color, bg: STATUS_CONFIG.NEED_INFO.bg },
  ];

  return (
    <div className="alh-page-enter">
      {/* Statistics */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        {statCards.map((s) => (
          <Col key={s.title} xs={12} sm={8} md={4}>
            <Card
              size="small"
              style={{
                background: isDark ? "#141424" : "#FFFFFF",
                border: `1px solid ${isDark ? "rgba(201,168,76,0.10)" : "rgba(201,168,76,0.14)"}`,
                borderRadius: 12,
              }}
            >
              <Statistic
                title={<span style={{ fontSize: 11, color: G.textMuted }}>{s.title}</span>}
                value={s.value}
                valueStyle={{ color: s.color, fontSize: 22, fontWeight: 700 }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Filters */}
      <Card
        size="small"
        style={{
          marginBottom: 16,
          background: isDark ? "#141424" : "#FFFFFF",
          border: `1px solid ${isDark ? "rgba(201,168,76,0.10)" : "rgba(201,168,76,0.14)"}`,
          borderRadius: 12,
        }}
      >
        <Space wrap size={8}>
          <Select
            placeholder="Semua Status"
            allowClear
            style={{ width: 150 }}
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={setStatusFilter}
          />
          <Select
            placeholder="Semua Kategori"
            allowClear
            style={{ width: 150 }}
            options={KATEGORI_OPTIONS}
            value={kategoriFilter}
            onChange={setKategoriFilter}
          />
          <Select
            placeholder="Semua Prioritas"
            allowClear
            style={{ width: 150 }}
            options={PRIORITAS_OPTIONS}
            value={prioritasFilter}
            onChange={setPrioritasFilter}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              setStatusFilter(undefined);
              setKategoriFilter(undefined);
              setPrioritasFilter(undefined);
              tableQueryResult.refetch();
            }}
          >
            Reset
          </Button>
        </Space>
      </Card>

      {/* Table */}
      <ProTable<ILaporanMasalah>
        columns={columns}
        dataSource={data}
        rowKey="id"
        search={false}
        pagination={{
          pageSize: 15,
          showSizeChanger: true,
          showTotal: (total) => `${total} laporan`,
        }}
        toolBarRender={false}
        style={{
          borderRadius: 12,
          overflow: "hidden",
        }}
        onRow={(record) => ({
          onClick: () => show("laporan_masalah", record.id),
          style: { cursor: "pointer" },
        })}
        locale={{
          emptyText: (
            <div style={{ padding: "40px 0", textAlign: "center" }}>
              <BugOutlined style={{ fontSize: 48, color: G.textMuted, opacity: 0.3 }} />
              <div style={{ marginTop: 12, color: G.textMuted, fontSize: 14 }}>Belum ada laporan masuk</div>
            </div>
          ),
        }}
      />
    </div>
  );
};
