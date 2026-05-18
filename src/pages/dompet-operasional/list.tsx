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
  QRCode,
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
  CreditCardOutlined,
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
  reported_by?: string | null;
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
  santri_balance_total?: number | null;
  merchant_available_total?: number | null;
  merchant_pending_settlement_total?: number | null;
  merchant_liability_total?: number | null;
  merchant_sales_total?: number | null;
  merchant_settled_total?: number | null;
  merchant_pending_request_total?: number | null;
  wallet_topup_midtrans_total?: number | null;
  spp_paid_total?: number | null;
  spp_outstanding_total?: number | null;
  expected_internal_liability?: number | null;
  reserved_bank_balance?: number | null;
  difference_internal: number;
  difference_bank?: number | null;
  difference_liability_vs_bank?: number | null;
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
  wallet_review_status?: "open" | "reviewed" | "resolved" | "ignored_dummy" | null;
  wallet_reviewed_at?: string | null;
  wallet_review_note?: string | null;
  user_id: string;
  profiles?: { full_name?: string | null; role?: string | null } | null;
}

interface IWalletPaymentIntent {
  id: string;
  santri_nis: string;
  type: string;
  status: string;
  amount: number;
  created_by?: string | null;
  created_by_role?: string | null;
  expires_at?: string | null;
  approved_at?: string | null;
  posted_ledger_id?: number | null;
  midtrans_order_id?: string | null;
  idempotency_key?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string | null;
  santri?: { nama?: string | null; kelas?: string | null; jurusan?: string | null } | null;
}

interface IWalletSantriOption {
  santri_nis: string;
  saldo?: number | null;
  santri?: { nama?: string | null; kelas?: string | null; jurusan?: string | null } | null;
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

const reviewStatusLabel: Record<string, string> = {
  open: "Belum diperiksa",
  reviewed: "Sudah diperiksa",
  resolved: "Selesai",
  ignored_dummy: "Data uji",
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
  const [topupIntents, setTopupIntents] = useState<IWalletPaymentIntent[]>([]);
  const [walletSantriOptions, setWalletSantriOptions] = useState<IWalletSantriOption[]>([]);
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
      | "notification_review"
      | "maintenance"
      | "run_reconciliation"
      | "run_integrity"
      | "admin_topup";
    record?: IRiskEvent | IDispute | IReconciliationRun | IIntegrityRun | INotificationQueue;
  } | null>(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [riskRes, disputeRes, reconciliationRes, integrityRes, notificationRes, topupRes, walletAccountsRes] = await Promise.all([
        supabaseClient
          .from("wallet_risk_events")
          .select("id,created_at,severity,status,rule_code,santri_nis,action,score,response_due_at,details")
          .order("created_at", { ascending: false })
          .limit(80),
        supabaseClient
          .from("wallet_disputes")
          .select("id,ledger_id,reported_by,santri_nis,status,reason,response_due_at,resolution_note,reversal_ledger_id,created_at,resolved_at")
          .order("created_at", { ascending: false })
          .limit(80),
        supabaseClient
          .from("wallet_reconciliation_runs")
          .select("id,started_at,finished_at,status,ledger_net,cached_balance_total,santri_balance_total,merchant_available_total,merchant_pending_settlement_total,merchant_liability_total,merchant_sales_total,merchant_settled_total,merchant_pending_request_total,wallet_topup_midtrans_total,spp_paid_total,spp_outstanding_total,expected_internal_liability,reserved_bank_balance,difference_internal,difference_bank,difference_liability_vs_bank,freeze_triggered,reviewed_at,review_note,resolution_status,resolved_at,resolution_note")
          .order("started_at", { ascending: false })
          .limit(60),
        supabaseClient
          .from("wallet_ledger_integrity_runs")
          .select("id,started_at,finished_at,status,santri_nis,checked_entries,broken_at,reviewed_at,review_note,resolution_status,resolved_at,resolution_note")
          .order("started_at", { ascending: false })
          .limit(60),
        supabaseClient
          .from("notification_queue")
          .select("id,created_at,sent_at,title,body,status,event_type,priority,channel,error_message,reference_id,wallet_review_status,wallet_reviewed_at,wallet_review_note,user_id")
          .or("source_table.like.wallet%,event_type.like.wallet.%,event_type.like.dompet.%")
          .order("created_at", { ascending: false })
          .limit(100),
        supabaseClient
          .from("wallet_payment_intents")
          .select("id,santri_nis,type,status,amount,created_by,created_by_role,expires_at,approved_at,posted_ledger_id,midtrans_order_id,idempotency_key,metadata,created_at,updated_at")
          .eq("type", "midtrans_topup")
          .order("created_at", { ascending: false })
          .limit(80),
        supabaseClient
          .from("dompet_santri")
          .select("santri_nis,saldo,status")
          .eq("status", "active")
          .order("santri_nis", { ascending: true })
          .limit(500),
      ]);

      if (riskRes.error) throw new Error(`Gagal memuat peringatan keamanan: ${riskRes.error.message}`);
      if (disputeRes.error) throw new Error(`Gagal memuat laporan wali: ${disputeRes.error.message}`);
      if (reconciliationRes.error) throw new Error(`Gagal memuat cek saldo: ${reconciliationRes.error.message}`);
      if (integrityRes.error) throw new Error(`Gagal memuat cek ledger: ${integrityRes.error.message}`);
      if (notificationRes.error) throw new Error(`Gagal memuat notifikasi dompet: ${notificationRes.error.message}`);
      if (topupRes.error) throw new Error(`Gagal memuat top up Midtrans: ${topupRes.error.message}`);
      if (walletAccountsRes.error) throw new Error(`Gagal memuat daftar dompet aktif: ${walletAccountsRes.error.message}`);

      const disputeRows = (disputeRes.data || []) as IDispute[];
      const notificationRows = (notificationRes.data || []) as INotificationQueue[];
      const topupRows = (topupRes.data || []) as IWalletPaymentIntent[];
      const walletAccountRows = (walletAccountsRes.data || []) as IWalletSantriOption[];
      const disputeProfileIds = disputeRows.map((item) => item.reported_by).filter(Boolean) as string[];
      const notificationUserIds = notificationRows.map((item) => item.user_id).filter(Boolean);
      const userIds = Array.from(new Set([...disputeProfileIds, ...notificationUserIds]));
      const ledgerIds = Array.from(new Set(disputeRows.map((item) => item.ledger_id).filter(Boolean)));
      const santriNisList = Array.from(new Set([...disputeRows.map((item) => item.santri_nis), ...topupRows.map((item) => item.santri_nis), ...walletAccountRows.map((item) => item.santri_nis)].filter(Boolean)));
      let profileMap = new Map<string, { full_name?: string | null; role?: string | null }>();
      let ledgerMap = new Map<number, { amount?: number | null; category?: string | null; created_at?: string | null; balance_after?: number | null }>();
      let santriMap = new Map<string, { nama?: string | null; kelas?: string | null; jurusan?: string | null }>();

      if (userIds.length > 0) {
        const { data: profileRows, error: profileRowsError } = await supabaseClient
          .from("profiles")
          .select("id,full_name,email,role")
          .in("id", userIds);

        if (!profileRowsError) {
          profileMap = new Map((profileRows || []).map((item) => [item.id, { full_name: item.full_name, email: item.email, role: item.role }]));
        }
      }

      if (ledgerIds.length > 0) {
        const { data: ledgerRows, error: ledgerRowsError } = await supabaseClient
          .from("transaksi_dompet")
          .select("id,amount,category,created_at,balance_after")
          .in("id", ledgerIds);

        if (!ledgerRowsError) {
          ledgerMap = new Map((ledgerRows || []).map((item) => [item.id, item]));
        }
      }

      if (santriNisList.length > 0) {
        const { data: santriRows, error: santriRowsError } = await supabaseClient
          .from("santri")
          .select("nis,nama,kelas,jurusan")
          .in("nis", santriNisList);

        if (!santriRowsError) {
          santriMap = new Map((santriRows || []).map((item) => [item.nis, item]));
        }
      }

      setRiskEvents((riskRes.data || []) as IRiskEvent[]);
      setDisputes(
        disputeRows.map((item) => ({
          ...item,
          profiles: item.reported_by ? profileMap.get(item.reported_by) || null : null,
          transaksi_dompet: ledgerMap.get(item.ledger_id) || null,
          santri: santriMap.get(item.santri_nis) || null,
        })),
      );
      setReconciliationRuns((reconciliationRes.data || []) as IReconciliationRun[]);
      setIntegrityRuns((integrityRes.data || []) as IIntegrityRun[]);
      setNotifications(notificationRows.map((item) => ({ ...item, profiles: profileMap.get(item.user_id) || null })));
      setTopupIntents(topupRows.map((item) => ({ ...item, santri: santriMap.get(item.santri_nis) || null })));
      setWalletSantriOptions(walletAccountRows.map((item) => ({ ...item, santri: santriMap.get(item.santri_nis) || null })));
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
    const criticalNotifications = notifications.filter((item) => item.priority === "critical" && item.status !== "sent" && (item.wallet_review_status || "open") === "open").length;
    const pendingTopups = topupIntents.filter((item) => ["pending", "created", "waiting_payment"].includes(item.status) && !item.posted_ledger_id).length;
    const postedTopups = topupIntents.filter((item) => Boolean(item.posted_ledger_id)).length;
    return { urgentRisk, openDisputes, failedChecks, pendingNotifications, criticalNotifications, pendingTopups, postedTopups };
  }, [riskEvents, disputes, reconciliationRuns, integrityRuns, notifications, topupIntents]);

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
      if (actionModal.type === "notification_review") {
        await callWalletAdmin({ action: "review_wallet_notification", notification_id: record?.id, review_status: values.status, note: values.note });
        message.success("Review notifikasi dompet disimpan.");
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
      if (actionModal.type === "admin_topup") {
        const idempotencyKey = `admin-topup:${crypto.randomUUID()}`;
        const { data, error } = await supabaseClient.functions.invoke("wallet-admin-topup-create", {
          body: {
            santri_nis: values.santri_nis,
            amount: values.amount,
            depositor_name: values.depositor_name,
            depositor_relation: values.depositor_relation,
            depositor_phone: values.depositor_phone || null,
            note: values.note,
            idempotency_key: idempotencyKey,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        await loadData();
        const redirectUrl = data?.data?.redirect_url ? String(data.data.redirect_url) : "";
        Modal.success({
          title: "Sesi top up Midtrans dibuat",
          width: 520,
          content: (
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <Text>Berikan halaman pembayaran Midtrans kepada penyetor. Saldo santri baru bertambah setelah pembayaran berhasil.</Text>
              <Text strong>Order: {data?.data?.order_id || "-"}</Text>
              <Text>Nominal: {money(data?.data?.amount)}</Text>
              {redirectUrl ? (
                <>
                  <div style={{ display: "flex", justifyContent: "center", padding: 8 }}>
                    <QRCode value={redirectUrl} size={220} />
                  </div>
                  <Button type="primary" icon={<CreditCardOutlined />} href={redirectUrl} target="_blank" rel="noopener noreferrer" block>
                    Buka Pembayaran Midtrans
                  </Button>
                  <Text copyable={{ text: redirectUrl }} type="secondary">
                    Salin link pembayaran Midtrans
                  </Text>
                </>
              ) : (
                <Alert showIcon type="warning" message="Link pembayaran tidak diterima dari Midtrans" />
              )}
            </Space>
          ),
        });
        message.success("Sesi top up titipan dibuat.");
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
    { title: "Saldo Ledger Santri", dataIndex: "ledger_net", align: "right", render: (_, row) => money(row.ledger_net) },
    { title: "Saldo Cepat Santri", dataIndex: "cached_balance_total", align: "right", render: (_, row) => money(row.cached_balance_total) },
    { title: "Saldo Merchant", dataIndex: "merchant_available_total", align: "right", render: (_, row) => money(row.merchant_available_total) },
    { title: "Pending Cair Merchant", dataIndex: "merchant_pending_settlement_total", align: "right", render: (_, row) => money(row.merchant_pending_settlement_total) },
    { title: "Kewajiban Internal", dataIndex: "expected_internal_liability", align: "right", render: (_, row) => money(row.expected_internal_liability) },
    { title: "Top Up Midtrans", dataIndex: "wallet_topup_midtrans_total", align: "right", render: (_, row) => money(row.wallet_topup_midtrans_total) },
    { title: "SPP Lunas", dataIndex: "spp_paid_total", align: "right", render: (_, row) => money(row.spp_paid_total) },
    { title: "SPP Belum Lunas", dataIndex: "spp_outstanding_total", align: "right", render: (_, row) => money(row.spp_outstanding_total) },
    { title: "Selisih Internal", dataIndex: "difference_internal", align: "right", render: (_, row) => money(row.difference_internal) },
    { title: "Selisih Rekening", dataIndex: "difference_liability_vs_bank", align: "right", render: (_, row) => row.difference_liability_vs_bank == null ? "-" : money(row.difference_liability_vs_bank) },
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

  const topupColumns: ProColumns<IWalletPaymentIntent>[] = [
    { title: "Waktu", dataIndex: "created_at", render: (_, row) => dayjs(row.created_at).format("DD/MM/YYYY HH:mm") },
    {
      title: "Sumber",
      dataIndex: "created_by_role",
      render: (_, row) => {
        const channel = row.metadata?.channel;
        return channel === "admin_panel" ? <Tag color="purple">Titipan Admin</Tag> : <Tag color="blue">Aplikasi Wali</Tag>;
      },
    },
    {
      title: "Santri",
      dataIndex: "santri_nis",
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Text strong>{row.santri?.nama || row.santri_nis}</Text>
          <Text type="secondary">NIS {row.santri_nis} · Kelas {row.santri?.kelas || "-"}</Text>
        </Space>
      ),
    },
    { title: "Nominal", dataIndex: "amount", align: "right", render: (_, row) => money(row.amount) },
    {
      title: "Status Pembayaran",
      dataIndex: "status",
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Tag color={statusColor(row.posted_ledger_id ? "success" : row.status)}>{row.posted_ledger_id ? "Saldo sudah masuk" : row.status}</Tag>
          {row.approved_at && <Text type="secondary">{dayjs(row.approved_at).format("DD/MM/YYYY HH:mm")}</Text>}
        </Space>
      ),
    },
    { title: "Order Midtrans", dataIndex: "midtrans_order_id", ellipsis: true, render: (_, row) => row.midtrans_order_id || "-" },
    {
      title: "Penyetor",
      dataIndex: "metadata",
      ellipsis: true,
      render: (_, row) => row.metadata?.channel === "admin_panel" ? String(row.metadata?.depositor_name || "-") : "Wali santri",
    },
    { title: "Ledger", dataIndex: "posted_ledger_id", render: (_, row) => row.posted_ledger_id || "-" },
    { title: "Kedaluwarsa", dataIndex: "expires_at", render: (_, row) => row.expires_at ? dayjs(row.expires_at).format("DD/MM/YYYY HH:mm") : "-" },
    { title: "Dibuat Dari", dataIndex: "created_by_role", render: (_, row) => row.created_by_role || "wali/aplikasi" },
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
    {
      title: "Review Admin",
      dataIndex: "wallet_review_status",
      render: (_, row) => {
        const value = row.wallet_review_status || "open";
        return (
          <Space direction="vertical" size={0}>
            <Tag color={value === "open" ? "red" : value === "resolved" ? "green" : "blue"}>{reviewStatusLabel[value] || value}</Tag>
            {row.wallet_reviewed_at && <Text type="secondary">{dayjs(row.wallet_reviewed_at).format("DD/MM/YYYY HH:mm")}</Text>}
          </Space>
        );
      },
    },
    { title: "Error", dataIndex: "error_message", ellipsis: true, render: (_, row) => row.error_message || "-" },
    {
      title: "Aksi",
      valueType: "option",
      render: (_, row) => (
        <Button size="small" icon={<AuditOutlined />} onClick={() => setActionModal({ type: "notification_review", record: row })}>
          Review
        </Button>
      ),
    },
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
    notification_review: "Review Notifikasi Dompet",
    maintenance: "Pemberitahuan Maintenance Dompet",
    run_reconciliation: "Jalankan Cek Saldo Manual",
    run_integrity: "Jalankan Cek Ledger Manual",
    admin_topup: "Buat Top Up Titipan via Midtrans",
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
              <Statistic title="Top Up Menunggu" value={stats.pendingTopups} prefix={<ClockCircleOutlined />} />
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
          <Button type="primary" icon={<CreditCardOutlined />} onClick={() => setActionModal({ type: "admin_topup" })}>
            Top Up Titipan
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
              children: (
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <Alert
                    showIcon
                    type="info"
                    message="Rekonsiliasi ini mencakup saldo santri, saldo merchant kantin, top up Midtrans, dan tagihan/SPP."
                    description="Jika ada selisih, jangan ubah saldo manual. Jalankan pemeriksaan, beri catatan, lalu tindak lanjuti melalui ledger atau proses resmi."
                  />
                  <ProTable<IReconciliationRun> rowKey="id" loading={loading} dataSource={reconciliationRuns} columns={reconciliationColumns} search={false} pagination={{ pageSize: 10 }} scroll={{ x: 1900 }} />
                </Space>
              ),
            },
            {
              key: "topups",
              label: "Top Up Midtrans",
              children: (
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <Alert
                    showIcon
                    type="info"
                    message="Top up hanya sah jika dibayar lewat Midtrans."
                    description="Bendahara/super admin boleh membuat top up titipan, tetapi saldo tetap baru bertambah setelah webhook Midtrans berhasil mem-posting ledger. Tidak ada input saldo manual."
                  />
                  <ProTable<IWalletPaymentIntent> rowKey="id" loading={loading} dataSource={topupIntents} columns={topupColumns} search={{ labelWidth: "auto" }} pagination={{ pageSize: 10 }} scroll={{ x: 1200 }} />
                </Space>
              ),
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
                    rowClassName={(row) =>
                      row.priority === "critical" && row.status !== "sent" && (row.wallet_review_status || "open") === "open"
                        ? "dompet-critical-notification-row"
                        : ""
                    }
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
        {actionModal?.record && !["maintenance", "run_reconciliation", "run_integrity", "admin_topup"].includes(actionModal.type) && (
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

          {actionModal?.type === "notification_review" && (
            <Form.Item name="status" label="Keputusan Review" rules={[{ required: true, message: "Pilih keputusan review." }]}>
              <Select
                options={[
                  { label: "Sudah diperiksa, masih perlu dipantau", value: "reviewed" },
                  { label: "Selesai, penyebab sudah jelas/ditangani", value: "resolved" },
                  { label: "Abaikan karena data uji/dummy", value: "ignored_dummy" },
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

          {actionModal?.type === "admin_topup" && (
            <>
              <Alert
                showIcon
                type="warning"
                message="Top up ini tidak menambah saldo secara langsung."
                description="Sistem hanya membuat sesi Midtrans. Saldo santri bertambah otomatis setelah pembayaran berhasil dan webhook mencatat ledger."
                style={{ marginBottom: 16 }}
              />
              <Form.Item name="santri_nis" label="Santri" rules={[{ required: true, message: "Pilih santri." }]}>
                <Select
                  showSearch
                  placeholder="Cari nama atau NIS santri"
                  optionFilterProp="label"
                  options={walletSantriOptions.map((item) => ({
                    value: item.santri_nis,
                    label: `${item.santri?.nama || item.santri_nis} - ${item.santri_nis} - saldo ${money(item.saldo)}`,
                  }))}
                />
              </Form.Item>
              <Form.Item name="amount" label="Nominal Top Up" rules={[{ required: true, message: "Nominal wajib diisi." }]}>
                <InputNumber min={10000} max={5000000} precision={0} step={10000} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="depositor_name" label="Nama Penyetor" rules={[{ required: true, min: 3, message: "Nama penyetor wajib diisi." }]}>
                <Input placeholder="Contoh: Kakek Ahmad / Donatur keluarga" />
              </Form.Item>
              <Form.Item name="depositor_relation" label="Hubungan dengan Santri" rules={[{ required: true, min: 2, message: "Hubungan penyetor wajib diisi." }]}>
                <Input placeholder="Contoh: Kakek, bibi, wali titipan, alumni" />
              </Form.Item>
              <Form.Item name="depositor_phone" label="Nomor HP Penyetor Opsional">
                <Input placeholder="Opsional untuk audit dan konfirmasi pembayaran" />
              </Form.Item>
              <Form.Item name="note" label="Catatan Audit" rules={[{ required: true, min: 10, message: "Catatan audit minimal 10 karakter." }]}>
                <Input.TextArea rows={4} placeholder="Contoh: Top up titipan dari keluarga, pembayaran tetap dilakukan lewat Midtrans." />
              </Form.Item>
            </>
          )}

          {!["maintenance", "run_reconciliation", "run_integrity", "admin_topup"].includes(actionModal?.type || "") && (
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
