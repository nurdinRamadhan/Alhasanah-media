import React, { useState, useEffect, useMemo } from "react";
import {
  Card, Row, Col, Typography, Tag, Badge, Button, Space, Descriptions,
  Input, message, Divider, Timeline, Alert, Spin, Tooltip, theme,
  Modal, Form, Select,
} from "antd";
import {
  ArrowLeftOutlined, BugOutlined, BulbOutlined,
  QuestionCircleOutlined, MessageOutlined, ClockCircleOutlined,
  CheckCircleOutlined, CloseCircleOutlined, InfoCircleOutlined,
  ThunderboltOutlined, MobileOutlined, AndroidOutlined,
  CalendarOutlined, GlobalOutlined, EditOutlined, SaveOutlined,
  ExclamationCircleOutlined, ArrowUpOutlined, ArrowDownOutlined,
  MinusOutlined, FireOutlined, TagOutlined, UserOutlined,
  SendOutlined, HistoryOutlined, ToolOutlined,
} from "@ant-design/icons";
import { useNavigation, useOne } from "@refinedev/core";
import { supabaseClient } from "../../utility/supabaseClient";
import { ILaporanMasalah, ILaporanMasalahLog, LaporanStatus } from "../../types";
import { useColorMode } from "../../contexts/color-mode";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

const { Text, Paragraph, Title } = Typography;
const { TextArea } = Input;
const { useToken } = theme;

// ─── CONFIGS ──────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode; desc: string }> = {
  OPEN: { label: "Baru", color: "#2563EB", bg: "rgba(37,99,235,0.08)", border: "rgba(37,99,235,0.24)", icon: <ExclamationCircleOutlined />, desc: "Laporan sedang menunggu peninjauan" },
  IN_PROGRESS: { label: "Ditinjau", color: "#D97706", bg: "rgba(217,119,6,0.08)", border: "rgba(217,119,6,0.24)", icon: <ClockCircleOutlined />, desc: "Laporan sedang ditinjau oleh tim kami" },
  PROCESSING: { label: "Dikerjakan", color: "#7C3AED", bg: "rgba(124,58,237,0.08)", border: "rgba(124,58,237,0.24)", icon: <ThunderboltOutlined />, desc: "Laporan sedang dalam proses perbaikan" },
  FIXED: { label: "Selesai", color: "#059669", bg: "rgba(5,150,105,0.08)", border: "rgba(5,150,105,0.24)", icon: <CheckCircleOutlined />, desc: "Masalah telah diperbaiki" },
  REJECTED: { label: "Ditolak", color: "#DC2626", bg: "rgba(220,38,38,0.08)", border: "rgba(220,38,38,0.24)", icon: <CloseCircleOutlined />, desc: "Laporan ditolak oleh admin" },
  NEED_INFO: { label: "Butuh Info", color: "#8B5CF6", bg: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.24)", icon: <InfoCircleOutlined />, desc: "Menunggu informasi tambahan dari pengguna" },
};

const KATEGORI_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  BUG: { label: "Bug", color: "#DC2626", icon: <BugOutlined /> },
  FITUR: { label: "Usulan Fitur", color: "#D97706", icon: <BulbOutlined /> },
  PERTANYAAN: { label: "Pertanyaan", color: "#2563EB", icon: <QuestionCircleOutlined /> },
  MASUKAN: { label: "Masukan", color: "#059669", icon: <MessageOutlined /> },
};

const PRIORITAS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  LOW: { label: "Rendah", color: "#059669", icon: <ArrowDownOutlined /> },
  MEDIUM: { label: "Sedang", color: "#D97706", icon: <MinusOutlined /> },
  HIGH: { label: "Tinggi", color: "#DC2626", icon: <ArrowUpOutlined /> },
  URGENT: { label: "Mendesak", color: "#BE123C", icon: <FireOutlined /> },
};

const TIMELINE_STEPS = [
  { key: "OPEN", label: "Baru", desc: "Laporan sedang menunggu peninjauan" },
  { key: "IN_PROGRESS", label: "Ditinjau", desc: "Laporan sedang ditinjau oleh tim kami" },
  { key: "PROCESSING", label: "Dikerjakan", desc: "Laporan sedang dalam proses perbaikan" },
  { key: "FIXED", label: "Selesai", desc: "Masalah telah diperbaiki" },
];

const STATUS_ORDER: Record<string, number> = { OPEN: 0, IN_PROGRESS: 1, PROCESSING: 2, FIXED: 3, REJECTED: 3, NEED_INFO: 1 };

// ─── COMPONENT ────────────────────────────────────────────────
export const LaporanMasalahShow = () => {
  const { token } = useToken();
  const { mode } = useColorMode();
  const isDark = mode === "dark";
  const { list, goBack } = useNavigation();

  const G = useMemo(() => ({
    text: isDark ? "#F59E0B" : "#B45309",
    bg: isDark ? "rgba(245,158,11,0.08)" : "rgba(212,160,23,0.06)",
    border: isDark ? "rgba(245,158,11,0.20)" : "rgba(212,160,23,0.18)",
    card: isDark ? "#141424" : "#FFFFFF",
    surface: isDark ? "#0F0F1A" : "#F7F4EE",
    textPrimary: isDark ? "#F0EDE5" : "#0A0805",
    textSecondary: isDark ? "#9E9080" : "#6B5F50",
    textMuted: isDark ? "#5C5248" : "#9E9080",
  }), [isDark]);

  const id = window.location.pathname.split("/show/")[1]?.split("?")[0] || "";
  const [laporan, setLaporan] = useState<ILaporanMasalah | null>(null);
  const [logs, setLogs] = useState<ILaporanMasalahLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminNote, setAdminNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedNewStatus, setSelectedNewStatus] = useState<string>("");
  const [statusNote, setStatusNote] = useState("");

  useEffect(() => {
    if (!id) return;
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    const { data: laporanData } = await supabaseClient.from("laporan_masalah").select("*").eq("id", id).single();
    if (laporanData) {
      setLaporan(laporanData);
      setAdminNote(laporanData.admin_note || "");
    }
    const { data: logData } = await supabaseClient.from("laporan_masalah_log").select("*").eq("laporan_id", id).order("created_at", { ascending: true });
    setLogs(logData || []);
    setLoading(false);
  };

  const handleSaveNote = async () => {
    if (!laporan) return;
    setSavingNote(true);
    const { error } = await supabaseClient.from("laporan_masalah").update({ admin_note: adminNote, updated_at: new Date().toISOString() }).eq("id", laporan.id);
    if (error) { message.error("Gagal menyimpan catatan"); setSavingNote(false); return; }
    message.success("Catatan berhasil disimpan");
    setSavingNote(false);
    setLaporan({ ...laporan, admin_note: adminNote });
  };

  const handleChangeStatus = async () => {
    if (!laporan || !selectedNewStatus) return;
    setChangingStatus(true);
    const oldStatus = laporan.status;
    const { error: updateErr } = await supabaseClient
      .from("laporan_masalah")
      .update({
        status: selectedNewStatus,
        updated_at: new Date().toISOString(),
        ...(selectedNewStatus === "FIXED" ? { fixed_at: new Date().toISOString() } : {}),
        ...(statusNote ? { admin_note: statusNote } : {}),
      })
      .eq("id", laporan.id);
    if (updateErr) { message.error("Gagal mengubah status"); setChangingStatus(false); return; }
    const { error: logErr } = await supabaseClient.from("laporan_masalah_log").insert({
      laporan_id: laporan.id,
      old_status: oldStatus,
      new_status: selectedNewStatus,
      catatan: statusNote || `Status diubah ke ${STATUS_CONFIG[selectedNewStatus]?.label}`,
    });
    if (logErr) console.warn("Log error:", logErr);
    message.success(`Status berhasil diubah ke ${STATUS_CONFIG[selectedNewStatus]?.label}`);
    setStatusModalVisible(false);
    setSelectedNewStatus("");
    setStatusNote("");
    setChangingStatus(false);
    fetchData();
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!laporan) {
    return <Alert type="error" message="Laporan tidak ditemukan" showIcon />;
  }

  const statusCfg = STATUS_CONFIG[laporan.status] || STATUS_CONFIG.OPEN;
  const kategoriCfg = KATEGORI_CONFIG[laporan.kategori];
  const prioritasCfg = PRIORITAS_CONFIG[laporan.prioritas];
  const currentIdx = STATUS_ORDER[laporan.status] ?? 0;

  const cardStyle: React.CSSProperties = {
    background: G.card,
    border: `1px solid ${isDark ? "rgba(201,168,76,0.10)" : "rgba(201,168,76,0.14)"}`,
    borderRadius: 16,
  };

  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: "0.7px", textTransform: "uppercase" as const, color: G.textMuted };

  return (
    <div className="alh-page-enter">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => list("laporan_masalah")}
          style={{ color: G.text }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Tag
              icon={statusCfg.icon}
              style={{
                color: statusCfg.color,
                background: statusCfg.bg,
                border: `1px solid ${statusCfg.border}`,
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                padding: "2px 12px",
              }}
            >
              {statusCfg.label}
            </Tag>
            <Text style={{ fontSize: 11, color: G.textMuted }}>
              ID: #{laporan.id.slice(0, 8).toUpperCase()}
            </Text>
          </div>
        </div>
        <Button
          type="primary"
          icon={<ToolOutlined />}
          onClick={() => setStatusModalVisible(true)}
          style={{
            background: `linear-gradient(135deg, ${G.text} 0%, ${isDark ? "#F59E0B" : "#B45309"} 100%)`,
            border: "none",
            fontWeight: 600,
          }}
        >
          Ubah Status
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        {/* Main Content */}
        <Col xs={24} lg={16}>
          {/* Kategori + Prioritas */}
          <Card size="small" style={{ ...cardStyle, marginBottom: 16 }}>
            <Space size={8}>
              <Tag
                icon={kategoriCfg?.icon}
                color={kategoriCfg?.color}
                style={{ fontSize: 11, borderRadius: 6 }}
              >
                {kategoriCfg?.label || laporan.kategori}
              </Tag>
              <Tag
                icon={prioritasCfg?.icon}
                color={prioritasCfg?.color}
                style={{ fontSize: 11, borderRadius: 6 }}
              >
                {prioritasCfg?.label || laporan.prioritas}
              </Tag>
            </Space>
          </Card>

          {/* Judul + Deskripsi */}
          <Card size="small" style={{ ...cardStyle, marginBottom: 16 }}>
            <Title level={4} style={{ margin: 0, color: G.textPrimary, fontWeight: 700 }}>
              {laporan.judul}
            </Title>
            <Divider style={{ margin: "12px 0", borderColor: isDark ? "rgba(201,168,76,0.08)" : "rgba(201,168,76,0.12)" }} />
            <Paragraph style={{ color: G.textSecondary, fontSize: 14, lineHeight: 1.7, margin: 0 }}>
              {laporan.deskripsi}
            </Paragraph>
          </Card>

          {/* Riwayat Status */}
          <Card size="small" style={{ ...cardStyle, marginBottom: 16 }}>
            <Title level={5} style={{ margin: "0 0 16px 0", color: G.textPrimary, fontWeight: 700 }}>
              <HistoryOutlined style={{ marginRight: 8 }} />
              Riwayat Status
            </Title>
            <Timeline
              items={TIMELINE_STEPS.map((step, idx) => {
                const isCompleted = idx < currentIdx;
                const isCurrent = step.key === laporan.status;
                const dotColor = isCompleted ? "#059669" : isCurrent ? statusCfg.color : "#D1D5DB";
                return {
                  dot: (
                    <div style={{
                      width: 14, height: 14, borderRadius: "50%",
                      background: dotColor,
                      border: isCurrent ? `3px solid ${dotColor}40` : "none",
                    }} />
                  ),
                  color: isCompleted ? "#059669" : isCurrent ? statusCfg.color : "#D1D5DB",
                  children: (
                    <div style={{ opacity: isCompleted || isCurrent ? 1 : 0.45 }}>
                      <Text strong style={{ color: G.textPrimary, fontSize: 13 }}>{step.label}</Text>
                      <br />
                      <Text style={{ color: G.textSecondary, fontSize: 12 }}>{step.desc}</Text>
                      <br />
                      <Text style={{ color: G.textMuted, fontSize: 11 }}>
                        {isCompleted || isCurrent ? dayjs(laporan.created_at).format("DD MMM YYYY · HH:mm") : "-"}
                      </Text>
                    </div>
                  ),
                };
              })}
            />
          </Card>

          {/* Admin Notes */}
          <Card size="small" style={cardStyle}>
            <Title level={5} style={{ margin: "0 0 12px 0", color: G.textPrimary, fontWeight: 700 }}>
              <EditOutlined style={{ marginRight: 8 }} />
              Catatan Admin
            </Title>
            {laporan.admin_note && (
              <Alert
                type="success"
                message={
                  <Text style={{ fontSize: 13, color: isDark ? "#F0EDE5" : "#0A0805" }}>
                    {laporan.admin_note}
                  </Text>
                }
                style={{ marginBottom: 12, borderRadius: 10 }}
                showIcon
              />
            )}
            <TextArea
              rows={3}
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="Tambahkan catatan untuk laporan ini..."
              style={{
                borderRadius: 10,
                background: isDark ? "#0F0F1A" : "#FFFFFF",
                borderColor: isDark ? "rgba(201,168,76,0.14)" : "rgba(201,168,76,0.20)",
                color: G.textPrimary,
              }}
            />
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSaveNote}
              loading={savingNote}
              disabled={adminNote === (laporan.admin_note || "")}
              style={{ marginTop: 8, borderRadius: 8 }}
            >
              Simpan Catatan
            </Button>
          </Card>
        </Col>

        {/* Sidebar */}
        <Col xs={24} lg={8}>
          {/* Device Info */}
          <Card size="small" style={{ ...cardStyle, marginBottom: 16 }}>
            <Title level={5} style={{ margin: "0 0 12px 0", color: G.textPrimary, fontWeight: 700 }}>
              <MobileOutlined style={{ marginRight: 8 }} />
              Info Perangkat
            </Title>
            <Descriptions column={1} size="small">
              <Descriptions.Item label={<span style={labelStyle}>Pengguna</span>}>
                <Text style={{ color: G.textPrimary }}>{laporan.nama_pengguna || "-"}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={<span style={labelStyle}>Device</span>}>
                <Text style={{ color: G.textPrimary }}>{laporan.device_brand} {laporan.device_model}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={<span style={labelStyle}>Manufacturer</span>}>
                <Text style={{ color: G.textPrimary }}>{laporan.device_manufacturer || "-"}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={<span style={labelStyle}>Android</span>}>
                <Text style={{ color: G.textPrimary }}>
                  Android {laporan.android_version} {laporan.device_sdk ? `(API ${laporan.device_sdk})` : ""}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label={<span style={labelStyle}>App Version</span>}>
                <Text style={{ color: G.textPrimary }}>Al-Hasanah Media v{laporan.app_version}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={<span style={labelStyle}>Source</span>}>
                <Tag style={{ fontSize: 11, borderRadius: 6 }}>{laporan.source}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={<span style={labelStyle}>Locale</span>}>
                <Text style={{ color: G.textPrimary }}>{laporan.locale || "-"}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={<span style={labelStyle}>Timezone</span>}>
                <Text style={{ color: G.textPrimary }}>{laporan.timezone || "-"}</Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Timestamps */}
          <Card size="small" style={{ ...cardStyle, marginBottom: 16 }}>
            <Title level={5} style={{ margin: "0 0 12px 0", color: G.textPrimary, fontWeight: 700 }}>
              <CalendarOutlined style={{ marginRight: 8 }} />
              Waktu
            </Title>
            <Descriptions column={1} size="small">
              <Descriptions.Item label={<span style={labelStyle}>Dibuat</span>}>
                <Text style={{ color: G.textPrimary }}>{dayjs(laporan.created_at).format("DD MMM YYYY · HH:mm:ss")}</Text>
                <br />
                <Text style={{ color: G.textMuted, fontSize: 11 }}>{dayjs(laporan.created_at).fromNow()}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={<span style={labelStyle}>Diupdate</span>}>
                <Text style={{ color: G.textPrimary }}>{dayjs(laporan.updated_at).format("DD MMM YYYY · HH:mm:ss")}</Text>
              </Descriptions.Item>
              {laporan.fixed_at && (
                <Descriptions.Item label={<span style={labelStyle}>Selesai</span>}>
                  <Text style={{ color: "#059669" }}>{dayjs(laporan.fixed_at).format("DD MMM YYYY · HH:mm:ss")}</Text>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          {/* Log Perubahan */}
          {logs.length > 0 && (
            <Card size="small" style={cardStyle}>
              <Title level={5} style={{ margin: "0 0 12px 0", color: G.textPrimary, fontWeight: 700 }}>
                <HistoryOutlined style={{ marginRight: 8 }} />
                Log Perubahan
              </Title>
              <Timeline
                items={logs.map((log) => ({
                  dot: (
                    <div style={{
                      width: 10, height: 10, borderRadius: "50%",
                      background: STATUS_CONFIG[log.new_status]?.color || "#999",
                    }} />
                  ),
                  children: (
                    <div>
                      <Text style={{ color: G.textPrimary, fontSize: 12 }}>
                        {log.old_status ? (STATUS_CONFIG[log.old_status]?.label || log.old_status) : "-"} →{" "}
                        <Text strong style={{ color: STATUS_CONFIG[log.new_status]?.color }}>
                          {STATUS_CONFIG[log.new_status]?.label || log.new_status}
                        </Text>
                      </Text>
                      {log.catatan && (
                        <><br /><Text style={{ color: G.textMuted, fontSize: 11 }}>{log.catatan}</Text></>
                      )}
                      <br />
                      <Text style={{ color: G.textMuted, fontSize: 10 }}>
                        {dayjs(log.created_at).format("DD MMM YYYY · HH:mm")}
                      </Text>
                    </div>
                  ),
                }))}
              />
            </Card>
          )}
        </Col>
      </Row>

      {/* Status Change Modal */}
      <Modal
        title={
          <Space>
            <ToolOutlined style={{ color: G.text }} />
            <span>Ubah Status Laporan</span>
          </Space>
        }
        open={statusModalVisible}
        onCancel={() => { setStatusModalVisible(false); setSelectedNewStatus(""); setStatusNote(""); }}
        onOk={handleChangeStatus}
        confirmLoading={changingStatus}
        okText="Ubah Status"
        okButtonProps={{
          disabled: !selectedNewStatus,
          style: {
            background: selectedNewStatus ? STATUS_CONFIG[selectedNewStatus]?.color : undefined,
            borderColor: selectedNewStatus ? STATUS_CONFIG[selectedNewStatus]?.color : undefined,
          },
        }}
      >
        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="Status Baru" required>
            <Select
              placeholder="Pilih status baru"
              value={selectedNewStatus || undefined}
              onChange={setSelectedNewStatus}
              options={Object.entries(STATUS_CONFIG)
                .filter(([k]) => k !== laporan.status)
                .map(([k, v]) => ({
                  value: k,
                  label: (
                    <Space>
                      <Tag icon={v.icon} color={v.color} style={{ margin: 0, fontSize: 11 }}>
                        {v.label}
                      </Tag>
                      <Text style={{ fontSize: 12, color: G.textSecondary }}>{v.desc}</Text>
                    </Space>
                  ),
                }))}
            />
          </Form.Item>
          <Form.Item label="Catatan (Opsional)">
            <TextArea
              rows={3}
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              placeholder="Tambahkan catatan perubahan status..."
              style={{ borderRadius: 10 }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
