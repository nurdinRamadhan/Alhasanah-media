import React, { useEffect, useMemo, useState } from "react";
import { ProColumns, ProTable } from "@ant-design/pro-components";
import {
  Alert,
  App,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Col,
  Select,
  Space,
  Statistic,
  Tag,
  Tabs,
  Typography,
} from "antd";
import {
  AlertOutlined,
  AuditOutlined,
  BellOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  FileSearchOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { supabaseClient } from "../../utility/supabaseClient";

const { Text, Title } = Typography;

type RiskStatus = "open" | "acknowledged" | "investigating" | "escalated" | "resolved" | "false_positive";
type RiskSeverity = "low" | "medium" | "high" | "critical";
type DisputeStatus = "open" | "investigating" | "resolved_valid" | "resolved_reversed" | "rejected" | "cancelled";

interface IRiskEvent {
  id: string;
  created_at: string;
  severity: RiskSeverity;
  status: RiskStatus;
  rule_code: string;
  santri_nis?: string | null;
  action: string;
  score: number;
  response_due_at?: string | null;
  details?: Record<string, unknown> | null;
}

interface IDispute {
  id: string;
  ledger_id: number;
  santri_nis: string;
  status: DisputeStatus;
  reason: string;
  response_due_at?: string | null;
  resolution_note?: string | null;
  reversal_ledger_id?: number | null;
  created_at: string;
  resolved_at?: string | null;
  profiles?: { full_name?: string | null; email?: string | null } | null;
  transaksi_dompet?: { amount?: number | null; category?: string | null; created_at?: string | null; balance_after?: number | null } | null;
  santri?: { nama?: string | null; kelas?: string | null; jurusan?: string | null } | null;
}

interface IReconciliationRun {
  id: string;
  started_at: string;
  finished_at?: string | null;
  status: string;
  ledger_net: number;
  cached_balance_total: number;
  reserved_bank_balance?: number | null;
  difference_internal: number;
  difference_bank?: number | null;
  freeze_triggered: boolean;
  reviewed_at?: string | null;
  review_note?: string | null;
  resolution_status?: string | null;
  resolved_at?: string | null;
  resolution_note?: string | null;
}

interface IIntegrityRun {
  id: string;
  started_at: string;
  finished_at?: string | null;
  status: string;
  santri_nis?: string | null;
  checked_entries: number;
  broken_at?: number | null;
  reviewed_at?: string | null;
  review_note?: string | null;
  resolution_status?: string | null;
  resolved_at?: string | null;
  resolution_note?: string | null;
}

interface INotificationQueue {
  id: string;
  created_at: string;
  sent_at?: string | null;
  title: string;
  body: string;
  status?: string | null;
  event_type?: string | null;
  priority: "low" | "normal" | "high" | "critical";
  channel: string;
  error_message?: string | null;
  reference_id?: string | null;
  user_id: string;
  profiles?: { full_name?: string | null; role?: string | null } | null;
}

const money = (value?: number | string | null) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const riskSeverityLabel: Record<RiskSeverity, string> = {
  low: "Rendah",
  medium: "Sedang",
  high: "Tinggi",
  critical: "Kritis",
};

const riskStatusLabel: Record<RiskStatus, string> = {
  open: "Belum ditangani",
  acknowledged: "Sedang ditangani",
  investigating: "Dalam pemeriksaan",
  escalated: "Dieskalasi",
  resolved: "Selesai",
  false_positive: "Bukan masalah",
};

const disputeStatusLabel: Record<DisputeStatus, string> = {
  open: "Baru masuk",
  investigating: "Sedang diperiksa",
  resolved_valid: "Transaksi valid",
  resolved_reversed: "Saldo dikembalikan",
  rejected: "Ditolak",
  cancelled: "Dibatalkan",
};

const priorityColor = (priority?: string) => {
  if (priority === "critical") return "red";
  if (priority === "high") return "orange";
  if (priority === "normal") return "blue";
  return "default";
};

const statusColor = (status?: string) => {
  if (["success", "sent", "resolved", "resolved_valid", "resolved_reversed"].includes(status || "")) return "green";
  if (["failed", "open", "critical"].includes(status || "")) return "red";
  if (["acknowledged", "investigating", "running", "pending"].includes(status || "")) return "gold";
  return "default";
};

export const DompetOperasionalList = () => {
  const { message } = App.useApp();
  const [riskEvents, setRiskEvents] = useState<IRiskEvent[]>([]);
  const [disputes, setDisputes] = useState<IDispute[]>([]);
  const [reconciliationRuns, setReconciliationRuns] = useState<IReconciliationRun[]>([]);
  const [integrityRuns, setIntegrityRuns] = useState<IIntegrityRun[]>([]);
  const [notifications, setNotifications] = useState<INotificationQueue[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionModal, setActionModal] = useState<{
    type:
      | "risk_ack"
      | "risk_investigate"
      | "risk_escalate"
      | "risk_resolve"
      | "dispute_start"
      | "dispute_resolve"
      | "reconciliation_review"
      | "reconciliation_resolve"
      | "integrity_review"
      | "integrity_resolve"
      | "maintenance"
      | "run_reconciliation"
      | "run_integrity";
    record?: IRiskEvent | IDispute | IReconciliationRun | IIntegrityRun;
  } | null>(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [riskRes, disputeRes, reconciliationRes, integrityRes, notificationRes] = await Promise.all([
        supabaseClient
          .from("wallet_risk_events")
          .select("id,created_at,severity,status,rule_code,santri_nis,action,score,response_due_at,details")
          .order("created_at", { ascending: false })
          .limit(80),
        supabaseClient
          .from("wallet_disputes")
          .select("id,ledger_id,santri_nis,status,reason,response_due_at,resolution_note,reversal_ledger_id,created_at,resolved_at,profiles:reported_by(full_name,email),transaksi_dompet(amount,category,created_at,balance_after),santri(nama,kelas,jurusan)")
          .order("created_at", { ascending: false })
          .limit(80),
        supabaseClient
          .from("wallet_reconciliation_runs")
          .select("id,started_at,finished_at,status,ledger_net,cached_balance_total,reserved_bank_balance,difference_internal,difference_bank,freeze_triggered,reviewed_at,review_note,resolution_status,resolved_at,resolution_note")
          .order("started_at", { ascending: false })
          .limit(60),
        supabaseClient
          .from("wallet_ledger_integrity_runs")
          .select("id,started_at,finished_at,status,santri_nis,checked_entries,broken_at,reviewed_at,review_note,resolution_status,resolved_at,resolution_note")
          .order("started_at", { ascending: false })
          .limit(60),
        supabaseClient
          .from("notification_queue")
          .select("id,created_at,sent_at,title,body,status,event_type,priority,channel,error_message,reference_id,user_id,profiles:user_id(full_name,role)")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (riskRes.error) throw riskRes.error;
      if (disputeRes.error) throw disputeRes.error;
      if (reconciliationRes.error) throw reconciliationRes.error;
      if (integrityRes.error) throw integrityRes.error;
      if (notificationRes.error) throw notificationRes.error;

      setRiskEvents((riskRes.data || []) as IRiskEvent[]);
      setDisputes((disputeRes.data || []) as IDispute[]);
      setReconciliationRuns((reconciliationRes.data || []) as IReconciliationRun[]);
      setIntegrityRuns((integrityRes.data || []) as IIntegrityRun[]);
      setNotifications((notificationRes.data || []) as INotificationQueue[]);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Gagal memuat data operasional dompet.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const stats = useMemo(() => {
    const urgentRisk = riskEvents.filter((item) => ["open", "acknowledged"].includes(item.status) && ["high", "critical"].includes(item.severity)).length;
    const openDisputes = disputes.filter((item) => ["open", "investigating"].includes(item.status)).length;
    const failedChecks = reconciliationRuns.filter((item) => item.status !== "success").length + integrityRuns.filter((item) => item.status !== "success").length;
    const pendingNotifications = notifications.filter((item) => ["pending", null, undefined].includes(item.status)).length;
    const criticalNotifications = notifications.filter((item) => item.priority === "critical" && item.status !== "sent").length;
    return { urgentRisk, openDisputes, failedChecks, pendingNotifications, criticalNotifications };
  }, [riskEvents, disputes, reconciliationRuns, integrityRuns, notifications]);

  const callWalletAdmin = async (body: Record<string, unknown>) => {
    setActionLoading(true);
    try {
      const { data, error } = await supabaseClient.functions.invoke("wallet-admin", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await loadData();
      return data?.data;
    } finally {
      setActionLoading(false);
    }
  };

  const openAction = typeof actionModal?.type === "string";

  const closeAction = () => {
    setActionModal(null);
    form.resetFields();
  };

  const submitAction = async () => {
    if (!actionModal) return;
    const values = await form.validateFields();
    const record = actionModal.record as { id?: string } | undefined;

    try {
      if (actionModal.type === "risk_ack") {
        await callWalletAdmin({ action: "acknowledge_risk_event", risk_event_id: record?.id, note: values.note });
        message.success("Peringatan ditandai sedang ditangani.");
      }
      if (actionModal.type === "risk_investigate") {
        await callWalletAdmin({ action: "investigate_risk_event", risk_event_id: record?.id, note: values.note });
        message.success("Peringatan ditandai dalam pemeriksaan.");
      }
      if (actionModal.type === "risk_escalate") {
        await callWalletAdmin({ action: "escalate_risk_event", risk_event_id: record?.id, note: values.note });
        message.success("Peringatan dieskalasi ke super admin.");
      }
      if (actionModal.type === "risk_resolve") {
        await callWalletAdmin({ action: "resolve_risk_event", risk_event_id: record?.id, status: values.status, note: values.note });
        message.success("Peringatan keamanan diselesaikan.");
      }
      if (actionModal.type === "dispute_start") {
        await callWalletAdmin({ action: "start_dispute_investigation", dispute_id: record?.id, note: values.note });
        message.success("Dispute ditandai sedang diperiksa.");
      }
      if (actionModal.type === "dispute_resolve") {
        await callWalletAdmin({ action: "resolve_dispute", dispute_id: record?.id, status: values.status, note: values.note });
        message.success("Dispute diselesaikan.");
      }
      if (actionModal.type === "reconciliation_review") {
        await callWalletAdmin({ action: "review_reconciliation_run", run_id: record?.id, note: values.note });
        message.success("Catatan rekonsiliasi disimpan.");
      }
      if (actionModal.type === "reconciliation_resolve") {
        await callWalletAdmin({ action: "resolve_reconciliation_run", run_id: record?.id, status: values.status, note: values.note });
        message.success("Status rekonsiliasi diperbarui.");
      }
      if (actionModal.type === "integrity_review") {
        await callWalletAdmin({ action: "review_integrity_run", run_id: record?.id, note: values.note });
        message.success("Catatan pemeriksaan ledger disimpan.");
      }
      if (actionModal.type === "integrity_resolve") {
        await callWalletAdmin({ action: "resolve_integrity_run", run_id: record?.id, status: values.status, note: values.note });
        message.success("Status pemeriksaan ledger diperbarui.");
      }
      if (actionModal.type === "maintenance") {
        await callWalletAdmin({
          action: "broadcast_wallet_maintenance",
          title: values.title,
          message: values.message,
          start_at: values.start_at?.toISOString(),
          duration_minutes: values.duration_minutes,
        });
        message.success("Pemberitahuan maintenance masuk antrean notifikasi.");
      }
      if (actionModal.type === "run_reconciliation") {
        await callWalletAdmin({
          action: "run_reconciliation",
          reserved_bank_balance: values.reserved_bank_balance ?? null,
        });
        message.success("Rekonsiliasi manual selesai dijalankan.");
      }
      if (actionModal.type === "run_integrity") {
        await callWalletAdmin({
          action: "run_ledger_integrity_check",
          santri_nis: values.santri_nis || null,
          from_date: values.from_date?.toISOString() || null,
        });
        message.success("Pemeriksaan ledger manual selesai dijalankan.");
      }
      closeAction();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Aksi gagal diproses.");
    }
  };

  const riskColumns: ProColumns<IRiskEvent>[] = [
    { title: "Waktu", dataIndex: "created_at", render: (_, row) => dayjs(row.created_at).format("DD/MM/YYYY HH:mm") },
    {
      title: "Tingkat",
      dataIndex: "severity",
      render: (_, row) => <Tag color={priorityColor(row.severity)}>{riskSeverityLabel[row.severity]}</Tag>,
      valueType: "select",
      valueEnum: {
        low: { text: "Rendah" },
        medium: { text: "Sedang" },
        high: { text: "Tinggi" },
        critical: { text: "Kritis" },
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (_, row) => <Tag color={statusColor(row.status)}>{riskStatusLabel[row.status]}</Tag>,
    },
    { title: "Santri", dataIndex: "santri_nis", render: (_, row) => row.santri_nis || "-" },
    { title: "Penyebab", dataIndex: "rule_code", ellipsis: true },
    {
      title: "Arahan Sistem",
      dataIndex: "action",
      render: (_, row) => {
        const labels: Record<string, string> = {
          flag: "Catat dan pantau",
          require_parent_approval: "Butuh persetujuan wali",
          block: "Tolak transaksi",
          freeze_wallet: "Kunci dompet",
          freeze_system: "Bekukan sistem",
        };
        return labels[row.action] || row.action;
      },
    },
    {
      title: "Batas Respons",
      dataIndex: "response_due_at",
      render: (_, row) => row.response_due_at ? dayjs(row.response_due_at).format("DD/MM/YYYY HH:mm") : "-",
    },
    {
      title: "Aksi",
      valueType: "option",
      width: 230,
      render: (_, row) => (
        <Space wrap>
          {!["resolved", "false_positive"].includes(row.status) && (
            <Button size="small" icon={<ClockCircleOutlined />} onClick={() => setActionModal({ type: "risk_ack", record: row })}>
              Tangani
            </Button>
          )}
          {!["resolved", "false_positive"].includes(row.status) && (
            <Button size="small" icon={<FileSearchOutlined />} onClick={() => setActionModal({ type: "risk_investigate", record: row })}>
              Periksa
            </Button>
          )}
          {!["resolved", "false_positive"].includes(row.status) && (
            <Button size="small" danger onClick={() => setActionModal({ type: "risk_escalate", record: row })}>
              Eskalasi
            </Button>
          )}
          {!["resolved", "false_positive"].includes(row.status) && (
            <Button size="small" type="primary" onClick={() => setActionModal({ type: "risk_resolve", record: row })}>
              Selesaikan
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const disputeColumns: ProColumns<IDispute>[] = [
    { title: "Masuk", dataIndex: "created_at", render: (_, row) => dayjs(row.created_at).format("DD/MM/YYYY HH:mm") },
    {
      title: "Santri",
      dataIndex: "santri_nis",
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Text strong>{row.santri?.nama || row.santri_nis}</Text>
          <Text type="secondary">Kelas {row.santri?.kelas || "-"} · {row.santri?.jurusan || "-"}</Text>
        </Space>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (_, row) => <Tag color={statusColor(row.status)}>{disputeStatusLabel[row.status]}</Tag>,
    },
    { title: "Alasan Wali", dataIndex: "reason", ellipsis: true },
    { title: "Nominal", dataIndex: ["transaksi_dompet", "amount"], align: "right", render: (_, row) => money(row.transaksi_dompet?.amount) },
    { title: "SLA", dataIndex: "response_due_at", render: (_, row) => row.response_due_at ? dayjs(row.response_due_at).format("DD/MM/YYYY HH:mm") : "-" },
    {
      title: "Aksi",
      valueType: "option",
      width: 250,
      render: (_, row) => (
        <Space wrap>
          {["open", "investigating"].includes(row.status) && (
            <Button size="small" icon={<FileSearchOutlined />} onClick={() => setActionModal({ type: "dispute_start", record: row })}>
              Periksa
            </Button>
          )}
          {["open", "investigating"].includes(row.status) && (
            <Button size="small" type="primary" onClick={() => setActionModal({ type: "dispute_resolve", record: row })}>
              Putuskan
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const reconciliationColumns: ProColumns<IReconciliationRun>[] = [
    { title: "Waktu", dataIndex: "started_at", render: (_, row) => dayjs(row.started_at).format("DD/MM/YYYY HH:mm") },
    { title: "Status", dataIndex: "status", render: (_, row) => <Tag color={statusColor(row.status)}>{row.status === "success" ? "Cocok" : "Bermasalah"}</Tag> },
    { title: "Saldo dari Ledger", dataIndex: "ledger_net", align: "right", render: (_, row) => money(row.ledger_net) },
    { title: "Saldo Cepat", dataIndex: "cached_balance_total", align: "right", render: (_, row) => money(row.cached_balance_total) },
    { title: "Selisih", dataIndex: "difference_internal", align: "right", render: (_, row) => money(row.difference_internal) },
    { title: "Sudah Direview", dataIndex: "reviewed_at", render: (_, row) => row.reviewed_at ? <Tag color="green">Sudah</Tag> : <Tag color="gold">Belum</Tag> },
    { title: "Tindak Lanjut", dataIndex: "resolution_status", render: (_, row) => <Tag color={statusColor(row.resolution_status || "open")}>{row.resolution_status || "open"}</Tag> },
    {
      title: "Aksi",
      valueType: "option",
      render: (_, row) => (
        <Space wrap>
          <Button size="small" icon={<AuditOutlined />} onClick={() => setActionModal({ type: "reconciliation_review", record: row })}>
            Beri Catatan
          </Button>
          <Button size="small" type="primary" onClick={() => setActionModal({ type: "reconciliation_resolve", record: row })}>
            Tindak Lanjut
          </Button>
        </Space>
      ),
    },
  ];

  const integrityColumns: ProColumns<IIntegrityRun>[] = [
    { title: "Waktu", dataIndex: "started_at", render: (_, row) => dayjs(row.started_at).format("DD/MM/YYYY HH:mm") },
    { title: "Status", dataIndex: "status", render: (_, row) => <Tag color={statusColor(row.status)}>{row.status === "success" ? "Aman" : "Rusak"}</Tag> },
    { title: "Akun", dataIndex: "santri_nis", render: (_, row) => row.santri_nis || "Semua akun" },
    { title: "Jumlah Ledger", dataIndex: "checked_entries", align: "right" },
    { title: "Rusak di Ledger", dataIndex: "broken_at", render: (_, row) => row.broken_at || "-" },
    { title: "Sudah Direview", dataIndex: "reviewed_at", render: (_, row) => row.reviewed_at ? <Tag color="green">Sudah</Tag> : <Tag color="gold">Belum</Tag> },
    { title: "Tindak Lanjut", dataIndex: "resolution_status", render: (_, row) => <Tag color={statusColor(row.resolution_status || "open")}>{row.resolution_status || "open"}</Tag> },
    {
      title: "Aksi",
      valueType: "option",
      render: (_, row) => (
        <Space wrap>
          <Button size="small" icon={<AuditOutlined />} onClick={() => setActionModal({ type: "integrity_review", record: row })}>
            Beri Catatan
          </Button>
          <Button size="small" type="primary" onClick={() => setActionModal({ type: "integrity_resolve", record: row })}>
            Tindak Lanjut
          </Button>
        </Space>
      ),
    },
  ];

  const notificationColumns: ProColumns<INotificationQueue>[] = [
    { title: "Waktu", dataIndex: "created_at", render: (_, row) => dayjs(row.created_at).format("DD/MM/YYYY HH:mm") },
    {
      title: "Penerima",
      dataIndex: "user_id",
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Text>{row.profiles?.full_name || row.user_id}</Text>
          <Text type="secondary">{row.profiles?.role || "-"}</Text>
        </Space>
      ),
    },
    {
      title: "Judul",
      dataIndex: "title",
      render: (_, row) => (
        <Space>
          {row.priority === "critical" && <Tag color="red">KRITIS</Tag>}
          <Text strong={row.priority === "critical"}>{row.title}</Text>
        </Space>
      ),
    },
    { title: "Isi", dataIndex: "body", ellipsis: true },
    { title: "Jenis", dataIndex: "event_type", ellipsis: true },
    { title: "Prioritas", dataIndex: "priority", render: (_, row) => <Tag color={priorityColor(row.priority)}>{row.priority}</Tag> },
    { title: "Status", dataIndex: "status", render: (_, row) => <Tag color={statusColor(row.status || "pending")}>{row.status || "pending"}</Tag> },
    { title: "Error", dataIndex: "error_message", ellipsis: true, render: (_, row) => row.error_message || "-" },
  ];

  const modalTitle = {
    risk_ack: "Tandai Peringatan Sedang Ditangani",
    risk_investigate: "Periksa Peringatan Keamanan",
    risk_escalate: "Eskalasi Peringatan Keamanan",
    risk_resolve: "Selesaikan Peringatan Keamanan",
    dispute_start: "Mulai Pemeriksaan Dispute",
    dispute_resolve: "Putuskan Dispute",
    reconciliation_review: "Catatan Rekonsiliasi",
    reconciliation_resolve: "Tindak Lanjut Rekonsiliasi",
    integrity_review: "Catatan Pemeriksaan Ledger",
    integrity_resolve: "Tindak Lanjut Pemeriksaan Ledger",
    maintenance: "Pemberitahuan Maintenance Dompet",
    run_reconciliation: "Jalankan Cek Saldo Manual",
    run_integrity: "Jalankan Cek Ledger Manual",
  }[actionModal?.type || "risk_ack"];

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size={18} style={{ width: "100%" }}>
        <div>
          <Title level={2} style={{ marginBottom: 4 }}>
            Pusat Operasional Dompet
          </Title>
          <Text type="secondary">
            Halaman kerja bendahara dan pengawas untuk menangani peringatan, dispute, rekonsiliasi, pemeriksaan ledger, dan notifikasi dompet santri.
          </Text>
        </div>

        <Alert
          showIcon
          type="warning"
          icon={<SafetyCertificateOutlined />}
          message="Gunakan halaman ini untuk tindakan resmi yang tercatat audit."
          description="Setiap keputusan penting wajib memakai catatan yang jelas. Admin tidak mengubah saldo langsung; koreksi saldo tetap lewat ledger resmi."
        />

        {stats.criticalNotifications > 0 && (
          <Alert
            showIcon
            type="error"
            icon={<ExclamationCircleOutlined />}
            message={`${stats.criticalNotifications} notifikasi kritis dompet belum selesai`}
            description="Segera buka tab Notifikasi dan Peringatan Keamanan. Event kritis dapat berarti saldo kritis, akun terkunci, dispute lewat SLA, atau anomali transaksi."
            style={{
              background: "#b91c1c",
              borderColor: "#7f1d1d",
              color: "#ffffff",
              fontWeight: 700,
              boxShadow: "0 0 0 3px rgba(239, 68, 68, 0.24)",
            }}
          />
        )}

        <Row gutter={[16, 16]}>
          <Col xs={24} md={6}>
            <Card>
              <Statistic title="Peringatan Serius" value={stats.urgentRisk} prefix={<AlertOutlined />} />
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card>
              <Statistic title="Dispute Aktif" value={stats.openDisputes} prefix={<FileSearchOutlined />} />
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card>
              <Statistic title="Pemeriksaan Bermasalah" value={stats.failedChecks} prefix={<ExclamationCircleOutlined />} />
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card>
              <Statistic title="Notifikasi Menunggu" value={stats.pendingNotifications} prefix={<BellOutlined />} />
            </Card>
          </Col>
        </Row>

        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            Muat Ulang
          </Button>
          <Button type="primary" icon={<ToolOutlined />} onClick={() => setActionModal({ type: "maintenance" })}>
            Umumkan Maintenance
          </Button>
          <Button icon={<SafetyCertificateOutlined />} onClick={() => setActionModal({ type: "run_reconciliation" })}>
            Jalankan Cek Saldo
          </Button>
          <Button icon={<AuditOutlined />} onClick={() => setActionModal({ type: "run_integrity" })}>
            Jalankan Cek Ledger
          </Button>
        </Space>

        <Tabs
          items={[
            {
              key: "risk",
              label: "Peringatan Keamanan",
              children: <ProTable<IRiskEvent> rowKey="id" loading={loading} dataSource={riskEvents} columns={riskColumns} search={{ labelWidth: "auto" }} pagination={{ pageSize: 10 }} scroll={{ x: 1100 }} />,
            },
            {
              key: "disputes",
              label: "Laporan Wali",
              children: <ProTable<IDispute> rowKey="id" loading={loading} dataSource={disputes} columns={disputeColumns} search={{ labelWidth: "auto" }} pagination={{ pageSize: 10 }} scroll={{ x: 1100 }} />,
            },
            {
              key: "reconciliation",
              label: "Cek Saldo",
              children: <ProTable<IReconciliationRun> rowKey="id" loading={loading} dataSource={reconciliationRuns} columns={reconciliationColumns} search={false} pagination={{ pageSize: 10 }} scroll={{ x: 1000 }} />,
            },
            {
              key: "integrity",
              label: "Cek Ledger",
              children: <ProTable<IIntegrityRun> rowKey="id" loading={loading} dataSource={integrityRuns} columns={integrityColumns} search={false} pagination={{ pageSize: 10 }} scroll={{ x: 900 }} />,
            },
            {
              key: "notifications",
              label: "Notifikasi",
              children: (
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <Alert
                    showIcon
                    type={stats.criticalNotifications > 0 ? "error" : "info"}
                    message={stats.criticalNotifications > 0 ? "Ada notifikasi kritis yang harus segera dilihat" : "Notifikasi dompet tersimpan di sini untuk audit admin"}
                    description="Untuk saat ini pengiriman aktif memakai FCM/push notification. SMS dan email masih dicatat sebagai fitur update karena membutuhkan layanan pihak ketiga."
                  />
                  <ProTable<INotificationQueue>
                    rowKey="id"
                    loading={loading}
                    dataSource={notifications}
                    columns={notificationColumns}
                    search={{ labelWidth: "auto" }}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 1200 }}
                    rowClassName={(row) => row.priority === "critical" && row.status !== "sent" ? "dompet-critical-notification-row" : ""}
                  />
                  <style>
                    {`
                      .dompet-critical-notification-row td {
                        background: #fee2e2 !important;
                        border-top: 1px solid #ef4444 !important;
                        border-bottom: 1px solid #ef4444 !important;
                      }
                      .dompet-critical-notification-row:hover td {
                        background: #fecaca !important;
                      }
                    `}
                  </style>
                </Space>
              ),
            },
          ]}
        />
      </Space>

      <Modal
        title={modalTitle}
        open={openAction}
        onCancel={closeAction}
        onOk={submitAction}
        confirmLoading={actionLoading}
        okText="Simpan"
        cancelText="Batal"
      >
        {actionModal?.record && !["maintenance", "run_reconciliation", "run_integrity"].includes(actionModal.type) && (
          <Descriptions size="small" column={1} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="ID">{String((actionModal.record as { id?: string }).id || "-")}</Descriptions.Item>
          </Descriptions>
        )}

        <Form form={form} layout="vertical">
          {actionModal?.type === "risk_resolve" && (
            <Form.Item name="status" label="Keputusan" rules={[{ required: true, message: "Pilih keputusan." }]}>
              <Select
                options={[
                  { label: "Benar, sudah selesai ditangani", value: "resolved" },
                  { label: "Bukan masalah / false alarm", value: "false_positive" },
                ]}
              />
            </Form.Item>
          )}

          {["reconciliation_resolve", "integrity_resolve"].includes(actionModal?.type || "") && (
            <Form.Item name="status" label="Status Tindak Lanjut" rules={[{ required: true, message: "Pilih status." }]}>
              <Select
                options={[
                  { label: "Selesai diperbaiki", value: "resolved" },
                  { label: "Masih dipantau", value: "monitoring" },
                  { label: "Diterima sebagai risiko sementara", value: "accepted_risk" },
                  { label: "Bukan masalah", value: "false_alarm" },
                ]}
              />
            </Form.Item>
          )}

          {actionModal?.type === "dispute_resolve" && (
            <Form.Item name="status" label="Keputusan" rules={[{ required: true, message: "Pilih keputusan." }]}>
              <Select
                options={[
                  { label: "Transaksi valid, tidak ada refund", value: "resolved_valid" },
                  { label: "Saldo dikembalikan ke wali/santri", value: "resolved_reversed" },
                  { label: "Ditolak", value: "rejected" },
                  { label: "Dibatalkan", value: "cancelled" },
                ]}
              />
            </Form.Item>
          )}

          {actionModal?.type === "maintenance" && (
            <>
              <Form.Item name="title" label="Judul" rules={[{ required: true, message: "Judul wajib diisi." }]}>
                <Input placeholder="Contoh: Maintenance Dompet Santri" />
              </Form.Item>
              <Form.Item name="start_at" label="Mulai" rules={[{ required: true, message: "Waktu mulai wajib diisi." }]}>
                <DatePicker showTime style={{ width: "100%" }} format="DD/MM/YYYY HH:mm" />
              </Form.Item>
              <Form.Item name="duration_minutes" label="Estimasi Durasi Menit" rules={[{ required: true, message: "Durasi wajib diisi." }]}>
                <InputNumber min={1} precision={0} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="message" label="Isi Pemberitahuan" rules={[{ required: true, min: 12, message: "Isi pemberitahuan minimal 12 karakter." }]}>
                <Input.TextArea rows={4} placeholder="Contoh: Sistem dompet santri akan dalam pemeliharaan..." />
              </Form.Item>
            </>
          )}

          {actionModal?.type === "run_reconciliation" && (
            <Form.Item name="reserved_bank_balance" label="Saldo Rekening Cadangan Jika Ada">
              <InputNumber min={0} precision={0} style={{ width: "100%" }} placeholder="Kosongkan jika belum ingin cocokkan rekening bank" />
            </Form.Item>
          )}

          {actionModal?.type === "run_integrity" && (
            <>
              <Form.Item name="santri_nis" label="NIS Santri Opsional">
                <Input placeholder="Kosongkan untuk memeriksa semua akun" />
              </Form.Item>
              <Form.Item name="from_date" label="Mulai Dari Tanggal Opsional">
                <DatePicker showTime style={{ width: "100%" }} format="DD/MM/YYYY HH:mm" />
              </Form.Item>
            </>
          )}

          {!["maintenance", "run_reconciliation", "run_integrity"].includes(actionModal?.type || "") && (
            <Form.Item
              name="note"
              label="Catatan untuk Audit"
              rules={[
                {
                  required: !["risk_ack", "risk_investigate", "dispute_start"].includes(actionModal?.type || ""),
                  min: ["risk_ack", "risk_investigate", "dispute_start"].includes(actionModal?.type || "") ? undefined : 12,
                  message: "Catatan minimal 12 karakter.",
                },
              ]}
            >
              <Input.TextArea rows={4} placeholder="Tulis alasan atau hasil pemeriksaan dengan bahasa yang jelas." />
            </Form.Item>
          )}
        </Form>

        {actionModal?.type === "dispute_resolve" && (
          <Alert
            showIcon
            type="info"
            icon={<CheckCircleOutlined />}
            message="Jika memilih saldo dikembalikan, sistem membuat ledger refund baru."
            description="Ledger lama tidak diubah dan tetap menjadi bukti audit."
          />
        )}
      </Modal>
    </div>
  );
};
