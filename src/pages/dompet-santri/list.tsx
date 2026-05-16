import React, { useEffect, useMemo, useState } from "react";
import { useTable } from "@refinedev/antd";
import { useGetIdentity } from "@refinedev/core";
import { ProColumns, ProTable } from "@ant-design/pro-components";
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Drawer,
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
  theme,
} from "antd";
import {
  LockOutlined,
  PrinterOutlined,
  QrcodeOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  TransactionOutlined,
  UnlockOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { supabaseClient } from "../../utility/supabaseClient";
import { IUserIdentity, ISantri } from "../../types";

const { Title, Text } = Typography;

type WalletStatus = "active" | "locked" | "closed";
type WalletDirection = "credit" | "debit";

interface IWalletAccount {
  santri_nis: string;
  wallet_public_id: string;
  saldo: number;
  status: WalletStatus;
  low_balance_threshold: number;
  daily_spend_limit: number;
  single_transaction_limit: number;
  monthly_spend_limit?: number | null;
  large_transaction_threshold?: number | null;
  locked_reason?: string | null;
  created_at: string;
  updated_at: string;
  santri?: Pick<ISantri, "nama" | "kelas" | "jurusan" | "status_santri"> | null;
}

interface IWalletLedger {
  id: number;
  created_at: string;
  santri_nis: string;
  direction: WalletDirection;
  category: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  actor_role: string;
  keterangan?: string | null;
  entry_hash: string;
}

interface IWalletSystemControl {
  key: string;
  is_frozen: boolean;
  freeze_reason?: string | null;
  frozen_at?: string | null;
  updated_at: string;
}

interface IKantinDevice {
  id: string;
  kantin_user_id: string;
  device_id: string;
  status: "pending" | "active" | "suspended" | "revoked";
  registered_at: string;
  last_seen_at?: string | null;
  last_transaction_at?: string | null;
  profiles?: { full_name?: string | null; email?: string | null } | null;
}

interface IRiskEvent {
  id: string;
  created_at: string;
  severity: "low" | "medium" | "high" | "critical";
  status: string;
  rule_code: string;
  santri_nis?: string | null;
  device_id?: string | null;
  action: string;
  score: number;
}

interface IReconciliationRun {
  id: string;
  started_at: string;
  status: string;
  ledger_net: number;
  cached_balance_total: number;
  difference_internal: number;
  difference_bank?: number | null;
  freeze_triggered: boolean;
}

interface IIntegrityRun {
  id: string;
  started_at: string;
  status: string;
  santri_nis?: string | null;
  checked_entries: number;
  broken_at?: number | null;
}

const money = (value?: number | string | null) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const statusColor: Record<WalletStatus, string> = {
  active: "green",
  locked: "orange",
  closed: "red",
};

export const DompetSantriList = () => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { data: user } = useGetIdentity<IUserIdentity>();
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [selected, setSelected] = useState<IWalletAccount | null>(null);
  const [ledger, setLedger] = useState<IWalletLedger[]>([]);
  const [loadingAction, setLoadingAction] = useState(false);
  const [lookupResult, setLookupResult] = useState<IWalletAccount | null>(null);
  const [systemControl, setSystemControl] = useState<IWalletSystemControl | null>(null);
  const [kantinDevices, setKantinDevices] = useState<IKantinDevice[]>([]);
  const [riskEvents, setRiskEvents] = useState<IRiskEvent[]>([]);
  const [reconciliationRuns, setReconciliationRuns] = useState<IReconciliationRun[]>([]);
  const [integrityRuns, setIntegrityRuns] = useState<IIntegrityRun[]>([]);
  const [adjustForm] = Form.useForm();
  const [lookupForm] = Form.useForm();
  const [reconciliationForm] = Form.useForm();

  const role = String(user?.role || "").toLowerCase();
  const canManage = ["super_admin", "rois", "bendahara"].includes(role);
  const isKantin = role === "kantin";

  const { tableProps, tableQueryResult } = useTable<IWalletAccount>({
    resource: "dompet_santri",
    syncWithLocation: false,
    meta: {
      select:
        "santri_nis,wallet_public_id,saldo,status,low_balance_threshold,daily_spend_limit,single_transaction_limit,monthly_spend_limit,large_transaction_threshold,locked_reason,created_at,updated_at,santri(nama,kelas,jurusan,status_santri)",
    },
    sorters: { initial: [{ field: "updated_at", order: "desc" }] },
  });

  const rows = (tableQueryResult.data?.data || []) as IWalletAccount[];
  const stats = useMemo(() => {
    const totalSaldo = rows.reduce((sum, row) => sum + Number(row.saldo || 0), 0);
    const active = rows.filter((row) => row.status === "active").length;
    const locked = rows.filter((row) => row.status === "locked").length;
    const low = rows.filter((row) => Number(row.saldo || 0) <= Number(row.low_balance_threshold || 0)).length;
    return { totalSaldo, active, locked, low };
  }, [rows]);

  const callWalletAdmin = async (body: Record<string, unknown>) => {
    setLoadingAction(true);
    try {
      const { data, error } = await supabaseClient.functions.invoke("wallet-admin", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await tableQueryResult.refetch();
      return data?.data;
    } finally {
      setLoadingAction(false);
    }
  };

  const loadBankingControls = async () => {
    if (!canManage) return;

    const [controlRes, devicesRes, riskRes, reconciliationRes, integrityRes] = await Promise.all([
      supabaseClient.from("wallet_system_controls").select("key,is_frozen,freeze_reason,frozen_at,updated_at").eq("key", "wallet_transactions").maybeSingle(),
      supabaseClient
        .from("kantin_devices")
        .select("id,kantin_user_id,device_id,status,registered_at,last_seen_at,last_transaction_at,profiles:kantin_user_id(full_name,email)")
        .order("registered_at", { ascending: false })
        .limit(20),
      supabaseClient
        .from("wallet_risk_events")
        .select("id,created_at,severity,status,rule_code,santri_nis,device_id,action,score")
        .order("created_at", { ascending: false })
        .limit(20),
      supabaseClient
        .from("wallet_reconciliation_runs")
        .select("id,started_at,status,ledger_net,cached_balance_total,difference_internal,difference_bank,freeze_triggered")
        .order("started_at", { ascending: false })
        .limit(10),
      supabaseClient
        .from("wallet_ledger_integrity_runs")
        .select("id,started_at,status,santri_nis,checked_entries,broken_at")
        .order("started_at", { ascending: false })
        .limit(10),
    ]);

    if (controlRes.error) message.error(controlRes.error.message);
    if (devicesRes.error) message.error(devicesRes.error.message);
    if (riskRes.error) message.error(riskRes.error.message);
    if (reconciliationRes.error) message.error(reconciliationRes.error.message);
    if (integrityRes.error) message.error(integrityRes.error.message);

    setSystemControl((controlRes.data || null) as IWalletSystemControl | null);
    setKantinDevices((devicesRes.data || []) as IKantinDevice[]);
    setRiskEvents((riskRes.data || []) as IRiskEvent[]);
    setReconciliationRuns((reconciliationRes.data || []) as IReconciliationRun[]);
    setIntegrityRuns((integrityRes.data || []) as IIntegrityRun[]);
  };

  useEffect(() => {
    void loadBankingControls();
  }, [canManage]);

  const loadLedger = async (record: IWalletAccount) => {
    setSelected(record);
    setLedgerOpen(true);
    const { data, error } = await supabaseClient
      .from("transaksi_dompet")
      .select("id,created_at,santri_nis,direction,category,amount,balance_before,balance_after,actor_role,keterangan,entry_hash")
      .eq("santri_nis", record.santri_nis)
      .order("id", { ascending: false })
      .limit(50);
    if (error) {
      message.error(error.message);
      return;
    }
    setLedger((data || []) as IWalletLedger[]);
  };

  const handleLockToggle = async (record: IWalletAccount) => {
    try {
      await callWalletAdmin({
        action: record.status === "locked" ? "unlock_account" : "lock_account",
        santri_nis: record.santri_nis,
        reason: record.status === "locked" ? "Dibuka dari admin panel" : "Dikunci dari admin panel",
      });
      message.success(record.status === "locked" ? "Dompet dibuka." : "Dompet dikunci.");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Operasi gagal.");
    }
  };

  const handleReissueQr = async (record: IWalletAccount) => {
    Modal.confirm({
      title: "Ganti QR kartu santri?",
      content: "QR lama akan dicabut. Kartu lama tidak boleh dipakai lagi setelah QR baru dicetak.",
      okText: "Ganti QR",
      cancelText: "Batal",
      onOk: async () => {
        try {
          await callWalletAdmin({
            action: "reissue_card_qr",
            santri_nis: record.santri_nis,
            reason: "Cetak ulang kartu atau kartu hilang",
          });
          message.success("QR baru berhasil diterbitkan.");
        } catch (error) {
          message.error(error instanceof Error ? error.message : "Gagal mengganti QR.");
        }
      },
    });
  };

  const handleAdjustment = async () => {
    const values = await adjustForm.validateFields();
    if (!selected) return;
    try {
      await callWalletAdmin({
        action: "post_adjustment",
        santri_nis: selected.santri_nis,
        direction: values.direction,
        category: values.category,
        amount: values.amount,
        keterangan: values.keterangan,
      });
      message.success("Transaksi koreksi tercatat di ledger.");
      setAdjustOpen(false);
      adjustForm.resetFields();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Gagal mencatat transaksi.");
    }
  };

  const handleLookupQr = async () => {
    const values = await lookupForm.validateFields();
    try {
      const data = await callWalletAdmin({
        action: "lookup_qr",
        wallet_public_id: values.wallet_public_id,
      });
      setLookupResult(data as IWalletAccount);
    } catch (error) {
      setLookupResult(null);
      message.error(error instanceof Error ? error.message : "QR tidak ditemukan.");
    }
  };

  const handleRunReconciliation = async () => {
    const values = await reconciliationForm.validateFields();
    try {
      await callWalletAdmin({
        action: "run_reconciliation",
        reserved_bank_balance: values.reserved_bank_balance ?? null,
      });
      await loadBankingControls();
      message.success("Rekonsiliasi selesai.");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Rekonsiliasi gagal.");
    }
  };

  const handleRunIntegrityCheck = async () => {
    try {
      await callWalletAdmin({ action: "run_ledger_integrity_check" });
      await loadBankingControls();
      message.success("Verifikasi hash-chain selesai.");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Verifikasi ledger gagal.");
    }
  };

  const handleToggleSystemFreeze = async () => {
    const shouldFreeze = !systemControl?.is_frozen;
    try {
      await callWalletAdmin({
        action: "set_system_freeze",
        is_frozen: shouldFreeze,
        reason: shouldFreeze ? "Manual freeze dari admin panel" : "Manual unfreeze dari admin panel",
      });
      await loadBankingControls();
      message.success(shouldFreeze ? "Transaksi dompet dibekukan." : "Transaksi dompet dibuka kembali.");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Gagal mengubah freeze switch.");
    }
  };

  const handleSetKantinDeviceStatus = async (device: IKantinDevice, status: "active" | "suspended" | "revoked") => {
    try {
      await callWalletAdmin({
        action: "set_kantin_device_status",
        device_id: device.device_id,
        status,
        reason: `Set status ${status} dari admin panel`,
      });
      await loadBankingControls();
      message.success(`Status device menjadi ${status}.`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Gagal mengubah status device.");
    }
  };

  const columns: ProColumns<IWalletAccount>[] = [
    {
      title: "Santri",
      dataIndex: ["santri", "nama"],
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.santri?.nama || record.santri_nis}</Text>
          <Text type="secondary">
            {record.santri_nis} · Kelas {record.santri?.kelas || "-"} · {record.santri?.jurusan || "-"}
          </Text>
        </Space>
      ),
    },
    {
      title: "Saldo",
      dataIndex: "saldo",
      align: "right",
      render: (_, record) => <Text strong>{money(record.saldo)}</Text>,
      sorter: true,
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (_, record) => <Tag color={statusColor[record.status]}>{record.status.toUpperCase()}</Tag>,
      valueType: "select",
      valueEnum: {
        active: { text: "Aktif" },
        locked: { text: "Terkunci" },
        closed: { text: "Ditutup" },
      },
    },
    {
      title: "Limit",
      dataIndex: "single_transaction_limit",
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text>{money(record.single_transaction_limit)} / transaksi</Text>
          <Text type="secondary">Harian {money(record.daily_spend_limit)}</Text>
          <Text type="secondary">Bulanan {money(record.monthly_spend_limit)}</Text>
          <Text type="secondary">Transaksi besar {money(record.large_transaction_threshold)}</Text>
          <Text type="secondary">Saldo rendah {money(record.low_balance_threshold)}</Text>
        </Space>
      ),
      search: false,
    },
    {
      title: "QR Publik",
      dataIndex: "wallet_public_id",
      ellipsis: true,
      copyable: true,
      search: false,
    },
    {
      title: "Aksi",
      valueType: "option",
      width: 260,
      render: (_, record) => (
        <Space wrap>
          <Button size="small" icon={<TransactionOutlined />} onClick={() => loadLedger(record)}>
            Ledger
          </Button>
          <Button
            size="small"
            icon={<QrcodeOutlined />}
            onClick={() => {
              setSelected(record);
              setQrOpen(true);
            }}
          >
            QR
          </Button>
          {canManage && (
            <>
              <Button
                size="small"
                icon={record.status === "locked" ? <UnlockOutlined /> : <LockOutlined />}
                onClick={() => handleLockToggle(record)}
                loading={loadingAction}
              >
                {record.status === "locked" ? "Buka" : "Kunci"}
              </Button>
              <Button
                size="small"
                onClick={() => {
                  setSelected(record);
                  setAdjustOpen(true);
                }}
              >
                Koreksi
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size={18} style={{ width: "100%" }}>
        <div>
          <Title level={2} style={{ marginBottom: 4 }}>
            Dompet Santri
          </Title>
          <Text type="secondary">
            Panel pengawasan closed-loop wallet. Mutasi saldo hanya melalui RPC ledger dan Edge Function terautentikasi.
          </Text>
        </div>

        <Alert
          showIcon
          type="warning"
          icon={<SafetyCertificateOutlined />}
          message="Kontrol keamanan"
          description="QR kartu hanya berisi wallet_public_id. PIN, private key, nonce, dan ciphertext tidak boleh dicetak atau disimpan di admin panel."
        />

        <Row gutter={[16, 16]}>
          <Col xs={24} md={6}>
            <Card>
              <Statistic title="Total Saldo" value={stats.totalSaldo} formatter={(v) => money(Number(v))} prefix={<WalletOutlined />} />
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card>
              <Statistic title="Dompet Aktif" value={stats.active} />
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card>
              <Statistic title="Terkunci" value={stats.locked} />
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card>
              <Statistic title="Saldo Rendah" value={stats.low} />
            </Card>
          </Col>
        </Row>

        {(isKantin || canManage) && (
          <Card title="Lookup QR Kartu Santri" styles={{ body: { paddingBottom: 12 } }}>
            <Form form={lookupForm} layout="inline" onFinish={handleLookupQr}>
              <Form.Item name="wallet_public_id" rules={[{ required: true, message: "Scan atau isi wallet_public_id" }]} style={{ minWidth: 340 }}>
                <Input prefix={<QrcodeOutlined />} placeholder="wallet_public_id dari QR kartu" />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={loadingAction}>
                Cek Dompet
              </Button>
            </Form>
            {lookupResult && (
              <Descriptions column={{ xs: 1, md: 4 }} size="small" style={{ marginTop: 16 }}>
                <Descriptions.Item label="Santri">{lookupResult.santri?.nama || lookupResult.santri_nis}</Descriptions.Item>
                <Descriptions.Item label="Kelas">{lookupResult.santri?.kelas || "-"}</Descriptions.Item>
                <Descriptions.Item label="Jurusan">{lookupResult.santri?.jurusan || "-"}</Descriptions.Item>
                <Descriptions.Item label="Saldo">{money(lookupResult.saldo)}</Descriptions.Item>
              </Descriptions>
            )}
          </Card>
        )}

        {canManage && (
          <Card
            title="Kontrol Banking-Grade"
            extra={
              <Button icon={<ReloadOutlined />} onClick={loadBankingControls} loading={loadingAction}>
                Refresh
              </Button>
            }
          >
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
              <Col xs={24} md={8}>
                <Alert
                  showIcon
                  type={systemControl?.is_frozen ? "error" : "success"}
                  message={systemControl?.is_frozen ? "Transaksi Dompet Dibekukan" : "Transaksi Dompet Aktif"}
                  description={systemControl?.freeze_reason || "Freeze switch global untuk menahan semua transaksi non-recovery."}
                  action={
                    <Button danger={!systemControl?.is_frozen} size="small" onClick={handleToggleSystemFreeze} loading={loadingAction}>
                      {systemControl?.is_frozen ? "Unfreeze" : "Freeze"}
                    </Button>
                  }
                />
              </Col>
              <Col xs={24} md={8}>
                <Form form={reconciliationForm} layout="inline" onFinish={handleRunReconciliation}>
                  <Form.Item name="reserved_bank_balance" style={{ minWidth: 180 }}>
                    <InputNumber min={0} precision={0} placeholder="Saldo rekening cadangan" style={{ width: "100%" }} />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" loading={loadingAction}>
                    Rekonsiliasi
                  </Button>
                </Form>
              </Col>
              <Col xs={24} md={8}>
                <Button block icon={<SafetyCertificateOutlined />} onClick={handleRunIntegrityCheck} loading={loadingAction}>
                  Verifikasi Hash Chain
                </Button>
              </Col>
            </Row>

            <Tabs
              items={[
                {
                  key: "devices",
                  label: "Device Kantin",
                  children: (
                    <ProTable<IKantinDevice>
                      rowKey="id"
                      search={false}
                      pagination={{ pageSize: 5 }}
                      dataSource={kantinDevices}
                      columns={[
                        { title: "Kantin", dataIndex: ["profiles", "full_name"], render: (_, r) => r.profiles?.full_name || r.kantin_user_id },
                        { title: "Device ID", dataIndex: "device_id", ellipsis: true, copyable: true },
                        {
                          title: "Status",
                          dataIndex: "status",
                          render: (_, r) => (
                            <Tag color={r.status === "active" ? "green" : r.status === "pending" ? "gold" : "red"}>{r.status.toUpperCase()}</Tag>
                          ),
                        },
                        { title: "Terdaftar", dataIndex: "registered_at", render: (_, r) => dayjs(r.registered_at).format("DD/MM/YYYY HH:mm") },
                        {
                          title: "Aksi",
                          valueType: "option",
                          render: (_, r) => (
                            <Space wrap>
                              {r.status !== "active" && (
                                <Button size="small" onClick={() => handleSetKantinDeviceStatus(r, "active")}>
                                  Aktifkan
                                </Button>
                              )}
                              {r.status === "active" && (
                                <Button size="small" onClick={() => handleSetKantinDeviceStatus(r, "suspended")}>
                                  Suspend
                                </Button>
                              )}
                              {r.status !== "revoked" && (
                                <Button size="small" danger onClick={() => handleSetKantinDeviceStatus(r, "revoked")}>
                                  Revoke
                                </Button>
                              )}
                            </Space>
                          ),
                        },
                      ]}
                    />
                  ),
                },
                {
                  key: "risk",
                  label: "Risk Events",
                  children: (
                    <ProTable<IRiskEvent>
                      rowKey="id"
                      search={false}
                      pagination={{ pageSize: 5 }}
                      dataSource={riskEvents}
                      columns={[
                        { title: "Waktu", dataIndex: "created_at", render: (_, r) => dayjs(r.created_at).format("DD/MM/YYYY HH:mm") },
                        {
                          title: "Severity",
                          dataIndex: "severity",
                          render: (_, r) => <Tag color={r.severity === "critical" ? "red" : r.severity === "high" ? "orange" : "blue"}>{r.severity.toUpperCase()}</Tag>,
                        },
                        { title: "Rule", dataIndex: "rule_code" },
                        { title: "Santri", dataIndex: "santri_nis" },
                        { title: "Device", dataIndex: "device_id", ellipsis: true },
                        { title: "Action", dataIndex: "action" },
                      ]}
                    />
                  ),
                },
                {
                  key: "reconciliation",
                  label: "Rekonsiliasi",
                  children: (
                    <ProTable<IReconciliationRun>
                      rowKey="id"
                      search={false}
                      pagination={{ pageSize: 5 }}
                      dataSource={reconciliationRuns}
                      columns={[
                        { title: "Waktu", dataIndex: "started_at", render: (_, r) => dayjs(r.started_at).format("DD/MM/YYYY HH:mm") },
                        { title: "Status", dataIndex: "status", render: (_, r) => <Tag color={r.status === "success" ? "green" : "red"}>{r.status}</Tag> },
                        { title: "Ledger Net", dataIndex: "ledger_net", align: "right", render: (_, r) => money(r.ledger_net) },
                        { title: "Cached Balance", dataIndex: "cached_balance_total", align: "right", render: (_, r) => money(r.cached_balance_total) },
                        { title: "Selisih Internal", dataIndex: "difference_internal", align: "right", render: (_, r) => money(r.difference_internal) },
                      ]}
                    />
                  ),
                },
                {
                  key: "integrity",
                  label: "Integrity Runs",
                  children: (
                    <ProTable<IIntegrityRun>
                      rowKey="id"
                      search={false}
                      pagination={{ pageSize: 5 }}
                      dataSource={integrityRuns}
                      columns={[
                        { title: "Waktu", dataIndex: "started_at", render: (_, r) => dayjs(r.started_at).format("DD/MM/YYYY HH:mm") },
                        { title: "Status", dataIndex: "status", render: (_, r) => <Tag color={r.status === "success" ? "green" : "red"}>{r.status}</Tag> },
                        { title: "Scope", dataIndex: "santri_nis", render: (_, r) => r.santri_nis || "Semua akun" },
                        { title: "Entries", dataIndex: "checked_entries", align: "right" },
                        { title: "Broken At", dataIndex: "broken_at" },
                      ]}
                    />
                  ),
                },
              ]}
            />
          </Card>
        )}

        <ProTable<IWalletAccount>
          {...tableProps}
          rowKey="santri_nis"
          columns={columns}
          search={{ labelWidth: "auto" }}
          scroll={{ x: 1200 }}
          toolBarRender={() => [
            <Button key="refresh" icon={<ReloadOutlined />} onClick={() => tableQueryResult.refetch()}>
              Refresh
            </Button>,
          ]}
        />
      </Space>

      <Modal
        title="Koreksi Ledger Dompet"
        open={adjustOpen}
        onCancel={() => setAdjustOpen(false)}
        onOk={handleAdjustment}
        confirmLoading={loadingAction}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Koreksi tidak mengedit saldo lama."
          description="Sistem akan membuat entry ledger baru dengan hash chain dan saldo akhir baru."
        />
        <Form form={adjustForm} layout="vertical" initialValues={{ direction: "credit", category: "correction" }}>
          <Form.Item name="direction" label="Arah" rules={[{ required: true }]}>
            <Select
              options={[
                { label: "Tambah saldo", value: "credit" },
                { label: "Kurangi saldo", value: "debit" },
              ]}
            />
          </Form.Item>
          <Form.Item name="category" label="Kategori" rules={[{ required: true }]}>
            <Select
              options={[
                { label: "Koreksi", value: "correction" },
                { label: "Refund", value: "refund" },
                { label: "Migrasi masuk", value: "account_migration_in" },
                { label: "Migrasi keluar", value: "account_migration_out" },
                { label: "Setor ke ledger pesantren", value: "settlement_to_pesantren_ledger" },
              ]}
            />
          </Form.Item>
          <Form.Item name="amount" label="Nominal" rules={[{ required: true }]}>
            <InputNumber min={1} precision={0} style={{ width: "100%" }} formatter={(value) => `Rp ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")} />
          </Form.Item>
          <Form.Item name="keterangan" label="Keterangan Audit" rules={[{ required: true, min: 12 }]}>
            <Input.TextArea rows={3} placeholder="Wajib jelas, misalnya koreksi top up ganda atau migrasi akun wali." />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="QR Kartu Santri"
        open={qrOpen}
        onCancel={() => setQrOpen(false)}
        footer={[
          canManage && selected ? (
            <Button key="reissue" danger onClick={() => handleReissueQr(selected)} loading={loadingAction}>
              Ganti QR
            </Button>
          ) : null,
          <Button key="print" icon={<PrinterOutlined />} onClick={() => window.print()}>
            Cetak
          </Button>,
          <Button key="close" onClick={() => setQrOpen(false)}>
            Tutup
          </Button>,
        ]}
      >
        {selected && (
          <div style={{ textAlign: "center", padding: 12 }}>
            <QRCode value={selected.wallet_public_id} size={220} />
            <Title level={4} style={{ marginTop: 16, marginBottom: 0 }}>
              {selected.santri?.nama || selected.santri_nis}
            </Title>
            <Text type="secondary">
              {selected.santri_nis} · Kelas {selected.santri?.kelas || "-"} · {selected.santri?.jurusan || "-"}
            </Text>
            <div style={{ marginTop: 12, color: token.colorTextTertiary, fontSize: 12 }}>{selected.wallet_public_id}</div>
          </div>
        )}
      </Modal>

      <Drawer title="Ledger Dompet" width={720} open={ledgerOpen} onClose={() => setLedgerOpen(false)}>
        {selected && (
          <Alert
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
            message={`${selected.santri?.nama || selected.santri_nis} - saldo ${money(selected.saldo)}`}
          />
        )}
        <ProTable<IWalletLedger>
          rowKey="id"
          search={false}
          pagination={{ pageSize: 10 }}
          dataSource={ledger}
          columns={[
            { title: "Waktu", dataIndex: "created_at", render: (_, r) => dayjs(r.created_at).format("DD/MM/YYYY HH:mm") },
            {
              title: "Mutasi",
              dataIndex: "direction",
              render: (_, r) => <Tag color={r.direction === "credit" ? "green" : "red"}>{r.direction === "credit" ? "MASUK" : "KELUAR"}</Tag>,
            },
            { title: "Kategori", dataIndex: "category" },
            { title: "Nominal", dataIndex: "amount", align: "right", render: (_, r) => money(r.amount) },
            { title: "Saldo Akhir", dataIndex: "balance_after", align: "right", render: (_, r) => money(r.balance_after) },
            { title: "Hash", dataIndex: "entry_hash", ellipsis: true, copyable: true },
          ]}
        />
      </Drawer>
    </div>
  );
};
