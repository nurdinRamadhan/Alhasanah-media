import React, { useEffect, useState } from "react";
import { useTable } from "@refinedev/antd";
import { useGetIdentity, useNavigation } from "@refinedev/core";
import { ProColumns, ProTable } from "@ant-design/pro-components";
import {
  Alert,
  App,
  Avatar,
  Button,
  Descriptions,
  Drawer,
  Form,
  Input,
  Popconfirm,
  Modal,
  Select,
  Space,
  Statistic,
  Tag,
  Tabs,
  Typography,
} from "antd";
import {
  AuditOutlined,
  BankOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  DollarOutlined,
  HistoryOutlined,
  MobileOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  ShopOutlined,
  UserAddOutlined,
  UserOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { supabaseClient } from "../../utility/supabaseClient";
import { IProfile, IUserIdentity } from "../../types";

const { Text, Title } = Typography;

interface IKantinDevice {
  id: string;
  device_id: string;
  status: "pending" | "active" | "suspended" | "revoked";
  registered_at: string;
  approved_at?: string | null;
  revoked_at?: string | null;
  last_seen_at?: string | null;
  last_transaction_at?: string | null;
  device_fingerprint: string;
}

interface IKantinHistory {
  id: number;
  created_at: string;
  santri_nis: string;
  santri_nama?: string | null;
  amount: number;
  status: string;
  entry_hash: string;
  kantin_device_id?: string | null;
}

interface IKantinMerchantUser {
  id: string;
  merchant_role: string;
  status: string;
  created_at: string;
  wallet_merchants?: { name?: string | null; ownership_model?: string | null; settlement_mode?: string | null } | null;
  wallet_merchant_outlets?: { name?: string | null; location?: string | null } | null;
}

interface IWalletMerchant {
  id: string;
  name: string;
  ownership_model: string;
  owner_profile_id?: string | null;
  status: string;
  settlement_mode: string;
  created_at: string;
}

interface IWalletOutlet {
  id: string;
  merchant_id: string;
  name: string;
  location?: string | null;
  status: string;
  created_at: string;
}

interface IWalletBalance {
  id: string;
  merchant_id: string;
  outlet_id?: string | null;
  saldo_available: number;
  saldo_pending_settlement: number;
  total_sales: number;
  total_settled: number;
  updated_at: string;
}

interface IWalletMerchantLedger {
  id: number;
  created_at: string;
  merchant_id: string;
  outlet_id?: string | null;
  direction: string;
  category: string;
  amount: number;
  balance_available_after: number;
  pending_settlement_after: number;
  actor_role: string;
  keterangan?: string | null;
}

interface IWalletSettlement {
  id: string;
  merchant_id: string;
  outlet_id?: string | null;
  requested_by: string;
  amount: number;
  status: string;
  payout_method: string;
  destination_note?: string | null;
  reviewed_at?: string | null;
  review_note?: string | null;
  created_at: string;
}

const money = (value?: number | string | null) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

export const KantinManagementList = () => {
  const { message } = App.useApp();
  const { push } = useNavigation();
  const { data: user } = useGetIdentity<IUserIdentity>();
  const [selected, setSelected] = useState<IProfile | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [devices, setDevices] = useState<IKantinDevice[]>([]);
  const [history, setHistory] = useState<IKantinHistory[]>([]);
  const [assignments, setAssignments] = useState<IKantinMerchantUser[]>([]);
  const [merchants, setMerchants] = useState<IWalletMerchant[]>([]);
  const [outlets, setOutlets] = useState<IWalletOutlet[]>([]);
  const [ownerProfiles, setOwnerProfiles] = useState<IProfile[]>([]);
  const [balances, setBalances] = useState<IWalletBalance[]>([]);
  const [merchantLedger, setMerchantLedger] = useState<IWalletMerchantLedger[]>([]);
  const [settlements, setSettlements] = useState<IWalletSettlement[]>([]);
  const [merchantLoading, setMerchantLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [actionModal, setActionModal] = useState<{
    type: "merchant" | "outlet" | "assign" | "settlement" | "quarantineMerchant";
    record?: IWalletMerchant | IWalletOutlet | IProfile | IWalletSettlement;
  } | null>(null);
  const [form] = Form.useForm();

  const canManage = ["super_admin", "rois", "bendahara"].includes(String(user?.role || "").toLowerCase());
  const canSettle = ["super_admin", "bendahara"].includes(String(user?.role || "").toLowerCase());

  const { tableProps, tableQueryResult } = useTable<IProfile>({
    resource: "profiles",
    syncWithLocation: false,
    filters: { permanent: [{ field: "role", operator: "eq", value: "kantin" }] },
    sorters: { initial: [{ field: "created_at", order: "desc" }] },
    pagination: { pageSize: 10 },
  });

  const kantinRows = (tableQueryResult.data?.data || []) as IProfile[];
  const activeCount = kantinRows.filter((row) => row.is_active).length;
  const inactiveCount = kantinRows.length - activeCount;

  const callWalletAdmin = async (body: Record<string, unknown>) => {
    setLoadingAction(true);
    try {
      const { data, error } = await supabaseClient.functions.invoke("wallet-admin", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data?.data;
    } finally {
      setLoadingAction(false);
    }
  };

  const callSettlementAdmin = async (body: Record<string, unknown>) => {
    setLoadingAction(true);
    try {
      const { data, error } = await supabaseClient.functions.invoke("wallet-merchant-settlement-admin", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data?.data;
    } finally {
      setLoadingAction(false);
    }
  };

  const provisionKantin = async (record: IProfile, reason: string) => {
    const { data, error } = await supabaseClient.functions.invoke("wallet-kantin-provision", {
      body: {
        kantin_user_id: record.id,
        reason,
      },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data?.data;
  };

  const loadMerchantData = async () => {
    setMerchantLoading(true);
    try {
      const [merchantRes, outletRes, balanceRes, ledgerRes, settlementRes, ownerRes] = await Promise.all([
        supabaseClient
          .from("wallet_merchants")
          .select("id,name,ownership_model,owner_profile_id,status,settlement_mode,created_at")
          .order("created_at", { ascending: false }),
        supabaseClient
          .from("wallet_merchant_outlets")
          .select("id,merchant_id,name,location,status,created_at")
          .order("created_at", { ascending: false }),
        supabaseClient
          .from("wallet_merchant_balances")
          .select("id,merchant_id,outlet_id,saldo_available,saldo_pending_settlement,total_sales,total_settled,updated_at")
          .order("updated_at", { ascending: false }),
        supabaseClient
          .from("wallet_merchant_ledger")
          .select("id,created_at,merchant_id,outlet_id,direction,category,amount,balance_available_after,pending_settlement_after,actor_role,keterangan")
          .order("created_at", { ascending: false })
          .limit(80),
        supabaseClient
          .from("wallet_merchant_settlement_requests")
          .select("id,merchant_id,outlet_id,requested_by,amount,status,payout_method,destination_note,reviewed_at,review_note,created_at")
          .order("created_at", { ascending: false })
          .limit(80),
        supabaseClient
          .from("profiles")
          .select("id,email,full_name,role,is_active,created_at,no_hp,foto_url,akses_gender,akses_jurusan")
          .in("role", ["kantin", "pengurus", "dewan", "bendahara", "rois", "super_admin"])
          .eq("is_active", true)
          .order("full_name", { ascending: true }),
      ]);

      if (merchantRes.error) throw merchantRes.error;
      if (outletRes.error) throw outletRes.error;
      if (balanceRes.error) throw balanceRes.error;
      if (ledgerRes.error) throw ledgerRes.error;
      if (settlementRes.error) throw settlementRes.error;
      if (ownerRes.error) throw ownerRes.error;

      setMerchants((merchantRes.data || []) as IWalletMerchant[]);
      setOutlets((outletRes.data || []) as IWalletOutlet[]);
      setBalances((balanceRes.data || []) as IWalletBalance[]);
      setMerchantLedger((ledgerRes.data || []) as IWalletMerchantLedger[]);
      setSettlements((settlementRes.data || []) as IWalletSettlement[]);
      setOwnerProfiles((ownerRes.data || []) as IProfile[]);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Gagal memuat data merchant kantin.");
    } finally {
      setMerchantLoading(false);
    }
  };

  useEffect(() => {
    void loadMerchantData();
  }, []);

  const merchantName = (merchantId?: string | null) => merchants.find((item) => item.id === merchantId)?.name || merchantId || "-";
  const outletName = (outletId?: string | null) => outlets.find((item) => item.id === outletId)?.name || (outletId ? outletId : "Semua outlet");

  const closeAction = () => {
    setActionModal(null);
    form.resetFields();
  };

  const openMerchantModal = (record?: IWalletMerchant) => {
    setActionModal({ type: "merchant", record });
    form.setFieldsValue({
      name: record?.name,
      ownership_model: record?.ownership_model || "pesantren",
      owner_profile_id: record?.owner_profile_id || undefined,
      status: record?.status || "active",
      settlement_mode: record?.settlement_mode || "manual_settlement",
    });
  };

  const openOutletModal = (record?: IWalletOutlet) => {
    setActionModal({ type: "outlet", record });
    form.setFieldsValue({
      merchant_id: record?.merchant_id,
      name: record?.name,
      location: record?.location,
      status: record?.status || "active",
    });
  };

  const openAssignModal = (record?: IProfile) => {
    setActionModal({ type: "assign", record });
    form.setFieldsValue({
      kantin_user_id: record?.id,
      merchant_role: "cashier",
    });
  };

  const openSettlementModal = (record: IWalletSettlement) => {
    setActionModal({ type: "settlement", record });
    form.setFieldsValue({
      status: record.status === "requested" ? "approved" : "paid",
    });
  };

  const openQuarantineMerchantModal = (record: IWalletMerchant) => {
    setActionModal({ type: "quarantineMerchant", record });
    form.setFieldsValue({ note: undefined });
  };

  const submitAction = async () => {
    if (!actionModal) return;
    const values = await form.validateFields();

    try {
      if (actionModal.type === "merchant") {
        await callWalletAdmin({
          action: "create_or_update_merchant",
          merchant_id: (actionModal.record as IWalletMerchant | undefined)?.id,
          ...values,
        });
        message.success("Data merchant kantin disimpan.");
      }

      if (actionModal.type === "outlet") {
        await callWalletAdmin({
          action: "create_or_update_merchant_outlet",
          outlet_id: (actionModal.record as IWalletOutlet | undefined)?.id,
          ...values,
        });
        message.success("Data outlet kantin disimpan.");
      }

      if (actionModal.type === "assign") {
        await callWalletAdmin({
          action: "assign_kantin_merchant",
          ...values,
        });
        message.success("Assignment kantin disimpan.");
      }

      if (actionModal.type === "settlement") {
        await callSettlementAdmin({
          settlement_request_id: (actionModal.record as IWalletSettlement).id,
          status: values.status,
          note: values.note,
        });
        message.success("Status pencairan kantin diperbarui.");
      }

      if (actionModal.type === "quarantineMerchant") {
        await callWalletAdmin({
          action: "quarantine_merchant",
          merchant_id: (actionModal.record as IWalletMerchant).id,
          note: values.note,
        });
        message.success("Merchant kantin dikarantina. Assignment dan device aktif terkait disuspend.");
      }

      closeAction();
      await loadMerchantData();
      await tableQueryResult.refetch();
      if (selected) await openDetail(selected);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Aksi gagal diproses.");
    }
  };

  const setDeviceStatus = async (device: IKantinDevice, status: "active" | "suspended" | "revoked") => {
    try {
      await callWalletAdmin({
        action: "set_kantin_device_status",
        device_id: device.device_id,
        status,
        reason: `Update status device kantin dari admin panel menjadi ${status}`,
      });
      if (status === "active" && selected) {
        await provisionKantin(selected, "Provisioning otomatis setelah device kantin diaktifkan admin");
      }
      message.success(status === "active" ? "Device aktif. Merchant, outlet, dan assignment otomatis disiapkan." : "Status device kantin diperbarui.");
      await loadMerchantData();
      if (selected) await openDetail(selected);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Gagal mengubah status device.");
    }
  };

  const ensureKantinReady = async (record: IProfile) => {
    try {
      setLoadingAction(true);
      await provisionKantin(record, "Admin menyiapkan otomatis akses merchant, outlet, dan assignment kantin");
      message.success("Akses kantin siap. Merchant, outlet, dan assignment sudah aktif.");
      await loadMerchantData();
      await tableQueryResult.refetch();
      if (selected?.id === record.id) await openDetail(record);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Gagal menyiapkan akses kantin.");
    } finally {
      setLoadingAction(false);
    }
  };

  const openDetail = async (record: IProfile) => {
    setSelected(record);
    setDrawerOpen(true);

    const [deviceRes, historyRes, assignmentRes] = await Promise.all([
      supabaseClient
        .from("kantin_devices")
        .select("id,device_id,status,registered_at,approved_at,revoked_at,last_seen_at,last_transaction_at,device_fingerprint")
        .eq("kantin_user_id", record.id)
        .order("registered_at", { ascending: false }),
      supabaseClient
        .from("view_kantin_transaction_history")
        .select("id,created_at,santri_nis,santri_nama,amount,status,entry_hash,kantin_device_id")
        .eq("kantin_user_id", record.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseClient
        .from("wallet_merchant_users")
        .select("id,merchant_role,status,created_at,wallet_merchants(name,ownership_model,settlement_mode),wallet_merchant_outlets(name,location)")
        .eq("profile_id", record.id)
        .order("created_at", { ascending: false }),
    ]);

    if (deviceRes.error) message.error(deviceRes.error.message);
    if (historyRes.error) message.error(historyRes.error.message);
    if (assignmentRes.error) message.error(assignmentRes.error.message);

    setDevices((deviceRes.data || []) as IKantinDevice[]);
    setHistory((historyRes.data || []) as IKantinHistory[]);
    setAssignments((assignmentRes.data || []) as IKantinMerchantUser[]);
  };

  const setAccountStatus = async (record: IProfile, isActive: boolean) => {
    try {
      await callWalletAdmin({
        action: "set_kantin_account_status",
        kantin_user_id: record.id,
        is_active: isActive,
        reason: isActive ? "Aktivasi akun kantin dari admin panel" : "Nonaktifkan akun kantin dari admin panel",
      });
      if (isActive) {
        await provisionKantin(record, "Provisioning otomatis setelah akun kantin diaktifkan admin");
      }
      message.success(isActive ? "Akun kantin aktif. Merchant, outlet, dan assignment otomatis disiapkan." : "Akun kantin dinonaktifkan dan device direvoke.");
      await loadMerchantData();
      await tableQueryResult.refetch();
      if (selected?.id === record.id) await openDetail({ ...record, is_active: isActive });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Gagal mengubah status akun kantin.");
    }
  };

  const columns: ProColumns<IProfile>[] = [
    {
      title: "Kantin",
      dataIndex: "full_name",
      render: (_, record) => (
        <Space>
          <Avatar icon={<UserOutlined />} src={record.foto_url} />
          <Space direction="vertical" size={0}>
            <Text strong>{record.full_name || "Tanpa Nama"}</Text>
            <Text type="secondary">{record.email}</Text>
          </Space>
        </Space>
      ),
    },
    {
      title: "Kontak",
      dataIndex: "no_hp",
      render: (_, record) => record.no_hp || "-",
      search: false,
    },
    {
      title: "Status",
      dataIndex: "is_active",
      render: (_, record) => <Tag color={record.is_active ? "green" : "red"}>{record.is_active ? "AKTIF" : "NONAKTIF"}</Tag>,
      valueType: "select",
      valueEnum: {
        true: { text: "Aktif" },
        false: { text: "Nonaktif" },
      },
    },
    {
      title: "Aksi",
      valueType: "option",
      width: 260,
      render: (_, record) => (
        <Space wrap>
          <Button size="small" icon={<AuditOutlined />} onClick={() => openDetail(record)}>
            Audit
          </Button>
          {canManage && (
            <>
              <Button size="small" icon={<ShopOutlined />} onClick={() => openAssignModal(record)}>
                Assign
              </Button>
              <Button size="small" icon={<SafetyCertificateOutlined />} onClick={() => ensureKantinReady(record)} loading={loadingAction}>
                Siapkan Otomatis
              </Button>
              {record.is_active ? (
                <Popconfirm
                  title="Nonaktifkan akun kantin?"
                  description="Device kantin akan direvoke dan akun tidak bisa memproses transaksi baru. Riwayat tetap utuh."
                  okText="Nonaktifkan"
                  cancelText="Batal"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => setAccountStatus(record, false)}
                >
                  <Button size="small" danger icon={<DeleteOutlined />} loading={loadingAction}>
                    Nonaktifkan
                  </Button>
                </Popconfirm>
              ) : (
                <Button size="small" onClick={() => setAccountStatus(record, true)} loading={loadingAction}>
                  Aktifkan
                </Button>
              )}
            </>
          )}
        </Space>
      ),
    },
  ];

  const merchantColumns: ProColumns<IWalletMerchant>[] = [
    { title: "Merchant", dataIndex: "name" },
    { title: "Kepemilikan", dataIndex: "ownership_model", render: (_, r) => <Tag>{r.ownership_model}</Tag> },
    { title: "Settlement", dataIndex: "settlement_mode", render: (_, r) => <Tag color="blue">{r.settlement_mode}</Tag> },
    { title: "Status", dataIndex: "status", render: (_, r) => <Tag color={r.status === "active" ? "green" : "red"}>{r.status}</Tag> },
    {
      title: "Aksi",
      valueType: "option",
      render: (_, r) => canManage ? (
        <Space>
          <Button size="small" icon={<AuditOutlined />} onClick={() => openMerchantModal(r)}>
            Ubah
          </Button>
          {r.status === "active" && (
            <Button size="small" danger icon={<SafetyCertificateOutlined />} onClick={() => openQuarantineMerchantModal(r)}>
              Karantina
            </Button>
          )}
        </Space>
      ) : null,
    },
  ];

  const outletColumns: ProColumns<IWalletOutlet>[] = [
    { title: "Outlet", dataIndex: "name" },
    { title: "Merchant", dataIndex: "merchant_id", render: (_, r) => merchantName(r.merchant_id) },
    { title: "Lokasi", dataIndex: "location", render: (_, r) => r.location || "-" },
    { title: "Status", dataIndex: "status", render: (_, r) => <Tag color={r.status === "active" ? "green" : "red"}>{r.status}</Tag> },
    {
      title: "Aksi",
      valueType: "option",
      render: (_, r) => canManage ? (
        <Button size="small" icon={<AuditOutlined />} onClick={() => openOutletModal(r)}>
          Ubah
        </Button>
      ) : null,
    },
  ];

  const balanceColumns: ProColumns<IWalletBalance>[] = [
    { title: "Merchant", dataIndex: "merchant_id", render: (_, r) => merchantName(r.merchant_id) },
    { title: "Outlet", dataIndex: "outlet_id", render: (_, r) => outletName(r.outlet_id) },
    { title: "Saldo Bisa Dicairkan", dataIndex: "saldo_available", align: "right", render: (_, r) => money(r.saldo_available) },
    { title: "Saldo Menunggu", dataIndex: "saldo_pending_settlement", align: "right", render: (_, r) => money(r.saldo_pending_settlement) },
    { title: "Total Penjualan", dataIndex: "total_sales", align: "right", render: (_, r) => money(r.total_sales) },
    { title: "Total Dicairkan", dataIndex: "total_settled", align: "right", render: (_, r) => money(r.total_settled) },
    { title: "Update", dataIndex: "updated_at", render: (_, r) => dayjs(r.updated_at).format("DD/MM/YYYY HH:mm") },
  ];

  const ledgerColumns: ProColumns<IWalletMerchantLedger>[] = [
    { title: "Waktu", dataIndex: "created_at", render: (_, r) => dayjs(r.created_at).format("DD/MM/YYYY HH:mm") },
    { title: "Merchant", dataIndex: "merchant_id", render: (_, r) => merchantName(r.merchant_id) },
    { title: "Outlet", dataIndex: "outlet_id", render: (_, r) => outletName(r.outlet_id) },
    { title: "Arah", dataIndex: "direction", render: (_, r) => <Tag color={r.direction === "credit" ? "green" : "orange"}>{r.direction}</Tag> },
    { title: "Kategori", dataIndex: "category" },
    { title: "Nominal", dataIndex: "amount", align: "right", render: (_, r) => money(r.amount) },
    { title: "Saldo Akhir", dataIndex: "balance_available_after", align: "right", render: (_, r) => money(r.balance_available_after) },
    { title: "Pending Akhir", dataIndex: "pending_settlement_after", align: "right", render: (_, r) => money(r.pending_settlement_after) },
    { title: "Catatan", dataIndex: "keterangan", ellipsis: true, render: (_, r) => r.keterangan || "-" },
  ];

  const settlementColumns: ProColumns<IWalletSettlement>[] = [
    { title: "Waktu", dataIndex: "created_at", render: (_, r) => dayjs(r.created_at).format("DD/MM/YYYY HH:mm") },
    { title: "Merchant", dataIndex: "merchant_id", render: (_, r) => merchantName(r.merchant_id) },
    { title: "Outlet", dataIndex: "outlet_id", render: (_, r) => outletName(r.outlet_id) },
    { title: "Nominal", dataIndex: "amount", align: "right", render: (_, r) => money(r.amount) },
    { title: "Status", dataIndex: "status", render: (_, r) => <Tag color={r.status === "paid" ? "green" : r.status === "rejected" ? "red" : "gold"}>{r.status}</Tag> },
    { title: "Tujuan", dataIndex: "destination_note", ellipsis: true, render: (_, r) => r.destination_note || "-" },
    { title: "Review", dataIndex: "review_note", ellipsis: true, render: (_, r) => r.review_note || "-" },
    {
      title: "Aksi",
      valueType: "option",
      render: (_, r) => canSettle && !["paid", "rejected", "cancelled"].includes(r.status) ? (
        <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => openSettlementModal(r)}>
          Proses
        </Button>
      ) : null,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size={18} style={{ width: "100%" }}>
        <div>
          <Title level={2} style={{ marginBottom: 4 }}>
            Manajemen Kantin
          </Title>
          <Text type="secondary">
            Kelola akun kantin, device terminal, assignment outlet, dan audit transaksi dompet santri.
          </Text>
        </div>

        <Alert
          type="warning"
          showIcon
          icon={<SafetyCertificateOutlined />}
          message="Akun kantin tidak cukup untuk transaksi."
          description="Transaksi hanya bisa diproses oleh aplikasi Android kantin dari device terdaftar, akun aktif, dan assignment merchant aktif. Tombol Siapkan Otomatis akan membuat merchant, outlet, dan assignment default agar admin non teknis tidak perlu mengatur satu per satu."
        />

        <Space wrap size={16}>
          <Statistic title="Total Akun Kantin" value={kantinRows.length} prefix={<ShopOutlined />} />
          <Statistic title="Aktif" value={activeCount} />
          <Statistic title="Nonaktif" value={inactiveCount} />
          <Statistic title="Merchant" value={merchants.length} prefix={<BankOutlined />} />
          <Statistic title="Pencairan Menunggu" value={settlements.filter((item) => ["requested", "approved"].includes(item.status)).length} prefix={<DollarOutlined />} />
        </Space>

        <Tabs
          items={[
            {
              key: "accounts",
              label: "Akun Kantin",
              children: (
                <ProTable<IProfile>
                  {...tableProps}
                  rowKey="id"
                  columns={columns}
                  search={{ labelWidth: "auto" }}
                  toolBarRender={() => [
                    <Button key="refresh" icon={<ReloadOutlined />} onClick={() => tableQueryResult.refetch()}>
                      Refresh
                    </Button>,
                    canManage ? (
                      <Button key="create" type="primary" icon={<UserAddOutlined />} onClick={() => push("/admin-management/create")}>
                        Buat Akun Kantin
                      </Button>
                    ) : null,
                  ]}
                />
              ),
            },
            {
              key: "merchants",
              label: "Merchant",
              children: (
                <ProTable<IWalletMerchant>
                  rowKey="id"
                  loading={merchantLoading}
                  dataSource={merchants}
                  columns={merchantColumns}
                  search={{ labelWidth: "auto" }}
                  pagination={{ pageSize: 10 }}
                  toolBarRender={() => [
                    <Button key="refresh" icon={<ReloadOutlined />} onClick={loadMerchantData}>
                      Refresh
                    </Button>,
                    canManage ? (
                      <Button key="create" type="primary" icon={<ShopOutlined />} onClick={() => openMerchantModal()}>
                        Tambah Merchant
                      </Button>
                    ) : null,
                  ]}
                />
              ),
            },
            {
              key: "outlets",
              label: "Outlet",
              children: (
                <ProTable<IWalletOutlet>
                  rowKey="id"
                  loading={merchantLoading}
                  dataSource={outlets}
                  columns={outletColumns}
                  search={{ labelWidth: "auto" }}
                  pagination={{ pageSize: 10 }}
                  toolBarRender={() => [
                    canManage ? (
                      <Button key="create" type="primary" icon={<ShopOutlined />} onClick={() => openOutletModal()}>
                        Tambah Outlet
                      </Button>
                    ) : null,
                  ]}
                />
              ),
            },
            {
              key: "balances",
              label: "Saldo Merchant",
              children: <ProTable<IWalletBalance> rowKey="id" loading={merchantLoading} dataSource={balances} columns={balanceColumns} search={{ labelWidth: "auto" }} pagination={{ pageSize: 10 }} scroll={{ x: 1000 }} />,
            },
            {
              key: "settlements",
              label: "Pencairan",
              children: <ProTable<IWalletSettlement> rowKey="id" loading={merchantLoading} dataSource={settlements} columns={settlementColumns} search={{ labelWidth: "auto" }} pagination={{ pageSize: 10 }} scroll={{ x: 1100 }} />,
            },
            {
              key: "ledger",
              label: "Ledger Merchant",
              children: <ProTable<IWalletMerchantLedger> rowKey="id" loading={merchantLoading} dataSource={merchantLedger} columns={ledgerColumns} search={{ labelWidth: "auto" }} pagination={{ pageSize: 10 }} scroll={{ x: 1200 }} />,
            },
          ]}
        />
      </Space>

      <Drawer title="Audit Kantin" width={860} open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        {selected && (
          <Space direction="vertical" size={18} style={{ width: "100%" }}>
            <Descriptions column={{ xs: 1, md: 2 }} bordered size="small">
              <Descriptions.Item label="Nama">{selected.full_name || "-"}</Descriptions.Item>
              <Descriptions.Item label="Email">{selected.email || "-"}</Descriptions.Item>
              <Descriptions.Item label="No HP">{selected.no_hp || "-"}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={selected.is_active ? "green" : "red"}>{selected.is_active ? "AKTIF" : "NONAKTIF"}</Tag>
              </Descriptions.Item>
            </Descriptions>

            <ProTable<IKantinDevice>
              rowKey="id"
              headerTitle={<Space><MobileOutlined />Device Kantin</Space>}
              search={false}
              pagination={{ pageSize: 5 }}
              dataSource={devices}
              columns={[
                { title: "Device ID", dataIndex: "device_id", ellipsis: true, copyable: true },
                { title: "Status", dataIndex: "status", render: (_, r) => <Tag color={r.status === "active" ? "green" : r.status === "pending" ? "gold" : "red"}>{r.status}</Tag> },
                { title: "Registered", dataIndex: "registered_at", render: (_, r) => dayjs(r.registered_at).format("DD/MM/YYYY HH:mm") },
                { title: "Last Tx", dataIndex: "last_transaction_at", render: (_, r) => r.last_transaction_at ? dayjs(r.last_transaction_at).format("DD/MM/YYYY HH:mm") : "-" },
                {
                  title: "Aksi",
                  valueType: "option",
                  render: (_, r) => canManage ? (
                    <Space>
                      {r.status !== "active" && (
                        <Button size="small" onClick={() => setDeviceStatus(r, "active")}>Aktifkan</Button>
                      )}
                      {r.status === "active" && (
                        <Button size="small" onClick={() => setDeviceStatus(r, "suspended")}>Suspend</Button>
                      )}
                      {r.status !== "revoked" && (
                        <Button size="small" danger onClick={() => setDeviceStatus(r, "revoked")}>Revoke</Button>
                      )}
                    </Space>
                  ) : null,
                },
              ]}
            />

            <ProTable<IKantinMerchantUser>
              rowKey="id"
              headerTitle={<Space><ShopOutlined />Assignment Merchant/Outlet</Space>}
              search={false}
              pagination={{ pageSize: 5 }}
              dataSource={assignments}
              columns={[
                { title: "Merchant", dataIndex: ["wallet_merchants", "name"], render: (_, r) => r.wallet_merchants?.name || "-" },
                { title: "Outlet", dataIndex: ["wallet_merchant_outlets", "name"], render: (_, r) => r.wallet_merchant_outlets?.name || "-" },
                { title: "Role", dataIndex: "merchant_role" },
                { title: "Status", dataIndex: "status", render: (_, r) => <Tag color={r.status === "active" ? "green" : "red"}>{r.status}</Tag> },
              ]}
            />

            <ProTable<IKantinHistory>
              rowKey="id"
              headerTitle={<Space><HistoryOutlined />Riwayat Transaksi Kantin</Space>}
              search={false}
              pagination={{ pageSize: 10 }}
              dataSource={history}
              columns={[
                { title: "Waktu", dataIndex: "created_at", render: (_, r) => dayjs(r.created_at).format("DD/MM/YYYY HH:mm") },
                { title: "Santri", dataIndex: "santri_nama", render: (_, r) => r.santri_nama || r.santri_nis },
                { title: "Nominal", dataIndex: "amount", align: "right", render: (_, r) => money(r.amount) },
                { title: "Status", dataIndex: "status", render: (_, r) => <Tag color={r.status === "posted" ? "green" : "gold"}>{r.status}</Tag> },
                { title: "Device", dataIndex: "kantin_device_id", ellipsis: true },
                { title: "Hash", dataIndex: "entry_hash", ellipsis: true, copyable: true },
              ]}
            />
          </Space>
        )}
      </Drawer>

      <Modal
        title={
          actionModal?.type === "merchant" ? "Data Merchant Kantin" :
          actionModal?.type === "outlet" ? "Data Outlet Kantin" :
          actionModal?.type === "assign" ? "Assign Akun Kantin" :
          actionModal?.type === "quarantineMerchant" ? "Karantina Merchant Kantin" :
          "Proses Pencairan Kantin"
        }
        open={Boolean(actionModal)}
        onCancel={closeAction}
        onOk={submitAction}
        confirmLoading={loadingAction}
        okText="Simpan"
        cancelText="Batal"
      >
        <Form form={form} layout="vertical">
          {actionModal?.type === "merchant" && (
            <>
              <Form.Item name="name" label="Nama Merchant" rules={[{ required: true, message: "Nama merchant wajib diisi." }]}>
                <Input placeholder="Contoh: Kantin Pesantren" />
              </Form.Item>
              <Form.Item name="ownership_model" label="Pengelola" rules={[{ required: true, message: "Pilih pengelola." }]}>
                <Select
                  options={[
                    { label: "Pesantren", value: "pesantren" },
                    { label: "Pengurus", value: "pengurus" },
                    { label: "Dewan", value: "dewan" },
                    { label: "Pihak Luar", value: "external" },
                    { label: "Lainnya", value: "other" },
                  ]}
                />
              </Form.Item>
              <Form.Item name="owner_profile_id" label="Akun Pengelola Opsional">
                <Select
                  allowClear
                  showSearch
                  placeholder="Kosongkan jika dikelola pesantren"
                  optionFilterProp="label"
                  options={ownerProfiles.map((item) => ({
                    label: `${item.full_name || item.email || item.id} (${item.role || "-"})`,
                    value: item.id,
                  }))}
                />
              </Form.Item>
              <Form.Item name="settlement_mode" label="Mode Pencairan" rules={[{ required: true, message: "Pilih mode pencairan." }]}>
                <Select
                  options={[
                    { label: "Rekening pesantren", value: "pesantren_account" },
                    { label: "Ledger merchant internal", value: "merchant_subledger" },
                    { label: "Pencairan manual", value: "manual_settlement" },
                  ]}
                />
              </Form.Item>
              <Form.Item name="status" label="Status" rules={[{ required: true, message: "Pilih status." }]}>
                <Select
                  options={[
                    { label: "Aktif", value: "active" },
                    { label: "Suspend", value: "suspended" },
                    { label: "Tutup permanen", value: "closed" },
                  ]}
                />
              </Form.Item>
            </>
          )}

          {actionModal?.type === "outlet" && (
            <>
              <Form.Item name="merchant_id" label="Merchant" rules={[{ required: true, message: "Pilih merchant." }]}>
                <Select options={merchants.map((item) => ({ label: item.name, value: item.id }))} />
              </Form.Item>
              <Form.Item name="name" label="Nama Outlet" rules={[{ required: true, message: "Nama outlet wajib diisi." }]}>
                <Input placeholder="Contoh: Kantin Utama" />
              </Form.Item>
              <Form.Item name="location" label="Lokasi">
                <Input placeholder="Contoh: Samping aula" />
              </Form.Item>
              <Form.Item name="status" label="Status" rules={[{ required: true, message: "Pilih status." }]}>
                <Select
                  options={[
                    { label: "Aktif", value: "active" },
                    { label: "Suspend", value: "suspended" },
                    { label: "Tutup permanen", value: "closed" },
                  ]}
                />
              </Form.Item>
            </>
          )}

          {actionModal?.type === "assign" && (
            <>
              <Form.Item name="kantin_user_id" label="Akun Kantin" rules={[{ required: true, message: "Pilih akun kantin." }]}>
                <Select options={kantinRows.map((item) => ({ label: item.full_name || item.email || item.id, value: item.id }))} />
              </Form.Item>
              <Form.Item name="merchant_id" label="Merchant" rules={[{ required: true, message: "Pilih merchant." }]}>
                <Select options={merchants.map((item) => ({ label: item.name, value: item.id }))} />
              </Form.Item>
              <Form.Item name="outlet_id" label="Outlet Opsional">
                <Select allowClear options={outlets.map((item) => ({ label: `${item.name} - ${merchantName(item.merchant_id)}`, value: item.id }))} />
              </Form.Item>
              <Form.Item name="merchant_role" label="Peran di Merchant" rules={[{ required: true, message: "Pilih peran." }]}>
                <Select
                  options={[
                    { label: "Owner", value: "owner" },
                    { label: "Manager", value: "manager" },
                    { label: "Kasir", value: "cashier" },
                    { label: "Auditor", value: "auditor" },
                  ]}
                />
              </Form.Item>
            </>
          )}

          {actionModal?.type === "settlement" && (
            <>
              <Descriptions size="small" column={1} bordered style={{ marginBottom: 16 }}>
                <Descriptions.Item label="Merchant">{merchantName((actionModal.record as IWalletSettlement)?.merchant_id)}</Descriptions.Item>
                <Descriptions.Item label="Outlet">{outletName((actionModal.record as IWalletSettlement)?.outlet_id)}</Descriptions.Item>
                <Descriptions.Item label="Nominal">{money((actionModal.record as IWalletSettlement)?.amount)}</Descriptions.Item>
              </Descriptions>
              <Form.Item name="status" label="Keputusan" rules={[{ required: true, message: "Pilih keputusan." }]}>
                <Select
                  options={[
                    { label: "Setujui untuk dibayar", value: "approved" },
                    { label: "Tandai sudah dibayar", value: "paid" },
                    { label: "Tolak dan kembalikan saldo pending", value: "rejected" },
                  ]}
                />
              </Form.Item>
            </>
          )}

          {actionModal?.type === "quarantineMerchant" && (
            <Alert
              type="error"
              showIcon
              message="Karantina akan menghentikan transaksi merchant ini."
              description="Merchant disuspend, assignment akun kantin aktif disuspend, dan device aktif terkait ikut disuspend. Saldo dan ledger tidak diubah."
              style={{ marginBottom: 16 }}
            />
          )}

          {actionModal?.type !== "assign" && (
            <Form.Item name="note" label="Catatan Audit" rules={[{ required: true, min: 12, message: "Catatan minimal 12 karakter." }]}>
              <Input.TextArea rows={4} placeholder="Tulis alasan tindakan dengan jelas." />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};
