import React, { useState } from "react";
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
  Popconfirm,
  Space,
  Statistic,
  Tag,
  Typography,
} from "antd";
import {
  AuditOutlined,
  DeleteOutlined,
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
  const [loadingAction, setLoadingAction] = useState(false);

  const canManage = ["super_admin", "rois", "bendahara"].includes(String(user?.role || "").toLowerCase());

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
      message.success(isActive ? "Akun kantin diaktifkan." : "Akun kantin dinonaktifkan dan device direvoke.");
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
            record.is_active ? (
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
            )
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
          description="Transaksi hanya bisa diproses oleh aplikasi Android kantin dari device terdaftar dan aktif. Menonaktifkan akun kantin akan merevoke device dan akses merchant, bukan menghapus histori ledger."
        />

        <Space wrap size={16}>
          <Statistic title="Total Akun Kantin" value={kantinRows.length} prefix={<ShopOutlined />} />
          <Statistic title="Aktif" value={activeCount} />
          <Statistic title="Nonaktif" value={inactiveCount} />
        </Space>

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
    </div>
  );
};
