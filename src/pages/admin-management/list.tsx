import React, { useMemo, useRef, useState } from "react";
import { useNavigation, useGetIdentity, useList } from "@refinedev/core";
import { useTable } from "@refinedev/antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import {
  Tag, Button, Typography, Avatar, Popconfirm, message,
  Tooltip, Card, Row, Col, Space, Progress, theme, Divider,
} from "antd";
import {
  UserOutlined, DeleteOutlined, SafetyCertificateOutlined,
  ManOutlined, WomanOutlined, BookOutlined, ReadOutlined,
  UserAddOutlined, EyeOutlined, EyeInvisibleOutlined,
  CheckCircleOutlined, ClockCircleOutlined, TeamOutlined,
  CrownOutlined, HomeOutlined,
} from "@ant-design/icons";
import { motion } from "framer-motion";
import { supabaseClient } from "../../utility/supabaseClient";
import { logActivity } from "../../utility/logger";
import { IProfile, IUserIdentity } from "../../types";

const { Text, Title } = Typography;
const { useToken } = theme;

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const GOLD        = "#C9A84C";
const GOLD_DARK   = "#8B6E23";
const GOLD_BG     = "rgba(201,168,76,0.08)";
const GOLD_BORDER = "rgba(201,168,76,0.2)";

const ADMIN_ROLES = [
  "super_admin", "rois", "bendahara", "kantin", "kesantrian", "dewan",
] as const;

type AdminRole = (typeof ADMIN_ROLES)[number];

// ─── Role visual config ────────────────────────────────────────────────────────
const ROLE_CONFIG: Record<
  string,
  { color: string; bg: string; border: string; label: string; antColor: string; icon: React.ReactNode }
> = {
  super_admin: {
    color: "#DC2626", bg: "rgba(220,38,38,0.08)", border: "rgba(220,38,38,0.22)",
    label: "Super Admin", antColor: "volcano",
    icon: <CrownOutlined />,
  },
  rois: {
    color: "#2563EB", bg: "rgba(37,99,235,0.08)", border: "rgba(37,99,235,0.22)",
    label: "Rois", antColor: "geekblue",
    icon: <SafetyCertificateOutlined />,
  },
  bendahara: {
    color: GOLD, bg: GOLD_BG, border: GOLD_BORDER,
    label: "Bendahara", antColor: "gold",
    icon: <HomeOutlined />,
  },
  kantin: {
    color: "#65A30D", bg: "rgba(101,163,13,0.08)", border: "rgba(101,163,13,0.22)",
    label: "Kantin", antColor: "lime",
    icon: <TeamOutlined />,
  },
  kesantrian: {
    color: "#0891B2", bg: "rgba(8,145,178,0.08)", border: "rgba(8,145,178,0.22)",
    label: "Kesantrian", antColor: "cyan",
    icon: <UserOutlined />,
  },
  dewan: {
    color: "#16A34A", bg: "rgba(22,163,74,0.08)", border: "rgba(22,163,74,0.22)",
    label: "Dewan", antColor: "green",
    icon: <BookOutlined />,
  },
  wali: {
    color: "#9333EA", bg: "rgba(147,51,234,0.08)", border: "rgba(147,51,234,0.22)",
    label: "Wali Santri", antColor: "purple",
    icon: <TeamOutlined />,
  },
};

// ─── Component ─────────────────────────────────────────────────────────────────
export const AdminList = () => {
  const { push } = useNavigation();
  const { data: user } = useGetIdentity<IUserIdentity>();
  const { token } = useToken();

  const [showWali, setShowWali] = useState(false);
  const searchFiltersRef = useRef<any[]>([]);

  // ── Paginated table (wali excluded by default) ─────────────────────────────
  const { tableProps, tableQueryResult, setFilters } = useTable<IProfile>({
    resource: "profiles",
    syncWithLocation: true,
    sorters: { initial: [{ field: "created_at", order: "desc" }] },
    pagination: { pageSize: 10 },
    filters: {
      initial: [{ field: "role", operator: "in" as const, value: [...ADMIN_ROLES] }],
    },
  });

  // ── Full admin list for KPI computation ────────────────────────────────────
  const { data: adminListData } = useList<IProfile>({
    resource: "profiles",
    filters: [{ field: "role", operator: "in" as const, value: [...ADMIN_ROLES] }],
    pagination: { mode: "off" },
  });

  // ── Wali total count (just for the badge, fetch minimal) ──────────────────
  const { data: waliCountData } = useList<IProfile>({
    resource: "profiles",
    filters: [{ field: "role", operator: "eq" as const, value: "wali" }],
    pagination: { pageSize: 1 },
  });

  const admins    = (adminListData?.data ?? []) as IProfile[];
  const waliCount = waliCountData?.total ?? 0;

  // ── KPI computation ────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total     = admins.length;
    const active    = admins.filter(a => a.is_active).length;
    const inactive  = admins.filter(a => !a.is_active).length;

    // Gender distribution
    const putra     = admins.filter(a => a.akses_gender === "L").length;
    const putri     = admins.filter(a => a.akses_gender === "P").length;
    const allGender = admins.filter(a => a.akses_gender === "ALL").length;

    // Takhasus distribution
    const tahfidz   = admins.filter(a => a.akses_jurusan === "TAHFIDZ").length;
    const kitab     = admins.filter(a => a.akses_jurusan === "KITAB").length;
    const allJurusan= admins.filter(a => a.akses_jurusan === "ALL").length;

    // Role counts
    const roleCounts = Object.fromEntries(
      ADMIN_ROLES.map(r => [r, admins.filter(a => a.role === r).length]),
    );

    return {
      total, active, inactive,
      putra, putri, allGender,
      tahfidz, kitab, allJurusan,
      roleCounts,
    };
  }, [admins]);

  // ── Wali toggle ────────────────────────────────────────────────────────────
  const handleToggleWali = () => {
    const next = !showWali;
    setShowWali(next);
    const base = next
      ? []
      : [{ field: "role", operator: "in" as const, value: [...ADMIN_ROLES] }];
    setFilters([...searchFiltersRef.current, ...base], "replace");
  };

  // ── ProTable search sync ───────────────────────────────────────────────────
  const handleSubmit = (params: any) => {
    const f: any[] = [];
    if (params.full_name)
      f.push({ field: "full_name", operator: "contains", value: params.full_name });
    if (params.role)
      f.push({ field: "role", operator: "eq", value: params.role });
    if (params.akses_gender)
      f.push({ field: "akses_gender", operator: "eq", value: params.akses_gender });
    if (params.akses_jurusan)
      f.push({ field: "akses_jurusan", operator: "eq", value: params.akses_jurusan });
    if (params.is_active !== undefined)
      f.push({ field: "is_active", operator: "eq", value: params.is_active === "true" });

    searchFiltersRef.current = f;
    const base = showWali
      ? []
      : [{ field: "role", operator: "in" as const, value: [...ADMIN_ROLES] }];
    setFilters([...f, ...base]);
  };

  const handleReset = () => {
    searchFiltersRef.current = [];
    const base = showWali
      ? []
      : [{ field: "role", operator: "in" as const, value: [...ADMIN_ROLES] }];
    setFilters(base);
  };

  // ── Delete handler ─────────────────────────────────────────────────────────
  const handleDelete = async (record: IProfile) => {
    try {
      message.loading({ content: "Menghapus akses...", key: "deleteUser" });
      const { data, error } = await supabaseClient.functions.invoke("delete-admin-account", {
        body: { user_id: record.id },
      });
      if (error || (data && !data.success))
        throw new Error(error?.message || "Gagal menghapus user");

      await logActivity({
        user,
        action: "DELETE",
        resource: "profiles",
        record_id: record.id,
        details: {
          deleted_user_name: record.full_name,
          deleted_user_email: record.email,
          deleted_user_role: record.role,
        },
      });

      message.success({ content: "User berhasil dihapus permanen", key: "deleteUser" });
      tableQueryResult.refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan";
      message.error({ content: msg, key: "deleteUser" });
    }
  };

  // ── Dynamic role valueEnum (includes wali when visible) ───────────────────
  const roleValueEnum = useMemo(() => ({
    super_admin: { text: "Super Admin", status: "Error"      as const },
    rois:        { text: "Rois",        status: "Processing" as const },
    bendahara:   { text: "Bendahara",   status: "Warning"    as const },
    kantin:      { text: "Kantin",      status: "Processing" as const },
    kesantrian:  { text: "Kesantrian",  status: "Success"    as const },
    dewan:       { text: "Dewan",       status: "Default"    as const },
    ...(showWali ? { wali: { text: "Wali Santri", status: "Default" as const } } : {}),
  }), [showWali]);

  // ── ProTable columns ───────────────────────────────────────────────────────
  const columns: ProColumns<IProfile>[] = [
    {
      title: "#",
      valueType: "index",
      width: 48,
      align: "center",
      hideInSearch: true,
    },
    {
      title: "Pengguna",
      dataIndex: "full_name",
      width: 280,
      fieldProps: { placeholder: "Cari nama pengurus..." },
      render: (_, record) => (
        <Space>
          <Avatar
            size={42}
            src={record.foto_url}
            icon={<UserOutlined />}
            style={{
              background: `linear-gradient(135deg, ${GOLD}35, ${GOLD_DARK}35)`,
              border: `2px solid ${GOLD_BORDER}`,
              flexShrink: 0,
            }}
          />
          <Space direction="vertical" size={0}>
            <Text strong style={{ fontSize: 13 }}>
              {record.full_name || "Tanpa Nama"}
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {record.email || "–"}
            </Text>
          </Space>
        </Space>
      ),
    },
    {
      title: "Jabatan",
      dataIndex: "role",
      width: 140,
      valueEnum: roleValueEnum,
      render: (_, record) => {
        const cfg = ROLE_CONFIG[record.role];
        return cfg ? (
          <Tag
            color={cfg.antColor}
            style={{
              fontWeight: 700, fontSize: 10,
              letterSpacing: "0.5px", textTransform: "uppercase",
              borderRadius: 6, padding: "2px 8px",
            }}
          >
            {cfg.label}
          </Tag>
        ) : (
          <Tag style={{ borderRadius: 6 }}>{record.role}</Tag>
        );
      },
    },
    {
      title: "Akses Gender",
      dataIndex: "akses_gender",
      width: 130,
      valueEnum: {
        ALL: { text: "Semua (L & P)" },
        L:   { text: "Putra Only"    },
        P:   { text: "Putri Only"    },
      },
      render: (_, record) => {
        if (record.akses_gender === "ALL")
          return (
            <Tag bordered={false} style={{ borderRadius: 6 }}>
              Semua
            </Tag>
          );
        return record.akses_gender === "L" ? (
          <Tag color="blue" icon={<ManOutlined />} style={{ borderRadius: 6 }}>
            Putra
          </Tag>
        ) : (
          <Tag color="magenta" icon={<WomanOutlined />} style={{ borderRadius: 6 }}>
            Putri
          </Tag>
        );
      },
    },
    {
      title: "Akses Takhasus",
      dataIndex: "akses_jurusan",
      width: 135,
      valueEnum: {
        ALL:     { text: "Semua Takhasus" },
        TAHFIDZ: { text: "Tahfidz"        },
        KITAB:   { text: "Kitab"          },
      },
      render: (_, record) => {
        if (record.akses_jurusan === "ALL")
          return (
            <Tag bordered={false} style={{ borderRadius: 6 }}>
              Semua
            </Tag>
          );
        return record.akses_jurusan === "TAHFIDZ" ? (
          <Tag color="purple" icon={<ReadOutlined />} style={{ borderRadius: 6 }}>
            Tahfidz
          </Tag>
        ) : (
          <Tag color="orange" icon={<BookOutlined />} style={{ borderRadius: 6 }}>
            Kitab
          </Tag>
        );
      },
    },
    {
      title: "Status",
      dataIndex: "is_active",
      width: 110,
      valueEnum: {
        true:  { text: "Aktif",     status: "Success" as const },
        false: { text: "Non-Aktif", status: "Default" as const },
      },
      render: (_, record) => (
        <Space size={6}>
          <span
            style={{
              width: 8, height: 8, borderRadius: "50%", display: "inline-block",
              background: record.is_active ? "#16A34A" : token.colorTextQuaternary,
              boxShadow: record.is_active ? "0 0 0 3px rgba(22,163,74,0.18)" : "none",
              animation: record.is_active ? "pulse 2s infinite" : "none",
            }}
          />
          <Text
            style={{
              fontSize: 12, fontWeight: 600,
              color: record.is_active ? "#16A34A" : token.colorTextTertiary,
            }}
          >
            {record.is_active ? "AKTIF" : "NON-AKTIF"}
          </Text>
        </Space>
      ),
    },
    {
      title: "",
      valueType: "option",
      fixed: "right",
      width: 60,
      render: (_, record) =>
        record.role === "super_admin" ? null : (
          <Popconfirm
            title="Hapus Akun Pengurus?"
            description={`Anda yakin ingin menghapus akses ${record.full_name}?`}
            onConfirm={() => handleDelete(record)}
            okText="Ya, Hapus"
            cancelText="Batal"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Hapus Akses Permanen">
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                style={{ borderRadius: 8 }}
              />
            </Tooltip>
          </Popconfirm>
        ),
    },
  ];

  // ── Shared card style ──────────────────────────────────────────────────────
  const cardStyle = {
    borderRadius: 16,
    border: `1px solid ${GOLD_BORDER}`,
    background: token.colorBgContainer,
    overflow: "hidden" as const,
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ paddingBottom: 40 }}>

      {/* ══════════════════════════════════════════════════════════════════════
          ROW 1 — Main KPI strip
          ══════════════════════════════════════════════════════════════════════ */}
      <Row gutter={[14, 14]} style={{ marginBottom: 14 }}>

        {/* Total Pengurus */}
        <Col xs={12} sm={12} lg={6}>
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, delay: 0 }}
          >
            <Card bordered={false} style={cardStyle} styles={{ body: { padding: "20px 22px" } }}>
              <div style={{
                position: "absolute", top: -16, right: -16, width: 80, height: 80,
                background: `radial-gradient(circle, ${GOLD}20, transparent 68%)`,
                borderRadius: "50%", pointerEvents: "none",
              }} />
              <Space direction="vertical" size={2}>
                <Text style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: token.colorTextTertiary }}>
                  Total Pengurus
                </Text>
                <Title level={2} style={{ margin: 0, color: GOLD, lineHeight: 1 }}>
                  {kpis.total}
                </Title>
                <Space size={4}>
                  <TeamOutlined style={{ fontSize: 11, color: GOLD }} />
                  <Text style={{ fontSize: 12, color: GOLD }}>akun terdaftar</Text>
                </Space>
              </Space>
            </Card>
          </motion.div>
        </Col>

        {/* Pengurus Aktif */}
        <Col xs={12} sm={12} lg={6}>
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, delay: 0.07 }}
          >
            <Card bordered={false} style={cardStyle} styles={{ body: { padding: "20px 22px" } }}>
              <div style={{
                position: "absolute", top: -16, right: -16, width: 80, height: 80,
                background: "radial-gradient(circle, rgba(22,163,74,0.14), transparent 68%)",
                borderRadius: "50%", pointerEvents: "none",
              }} />
              <Space direction="vertical" size={2}>
                <Text style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: token.colorTextTertiary }}>
                  Aktif
                </Text>
                <Title level={2} style={{ margin: 0, color: "#16A34A", lineHeight: 1 }}>
                  {kpis.active}
                  <Text style={{ fontSize: 14, color: token.colorTextTertiary, fontWeight: 400, marginLeft: 4 }}>
                    /{kpis.total}
                  </Text>
                </Title>
                <Space size={4}>
                  <CheckCircleOutlined style={{ fontSize: 11, color: "#16A34A" }} />
                  <Text style={{ fontSize: 12, color: "#16A34A" }}>pengurus aktif</Text>
                </Space>
              </Space>
            </Card>
          </motion.div>
        </Col>

        {/* Non-Aktif */}
        <Col xs={12} sm={12} lg={6}>
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, delay: 0.14 }}
          >
            <Card bordered={false} style={cardStyle} styles={{ body: { padding: "20px 22px" } }}>
              <div style={{
                position: "absolute", top: -16, right: -16, width: 80, height: 80,
                background: `radial-gradient(circle, ${token.colorTextQuaternary}22, transparent 68%)`,
                borderRadius: "50%", pointerEvents: "none",
              }} />
              <Space direction="vertical" size={2}>
                <Text style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: token.colorTextTertiary }}>
                  Non-Aktif
                </Text>
                <Title level={2} style={{ margin: 0, color: token.colorTextTertiary, lineHeight: 1 }}>
                  {kpis.inactive}
                </Title>
                <Space size={4}>
                  <ClockCircleOutlined style={{ fontSize: 11, color: token.colorTextTertiary }} />
                  <Text style={{ fontSize: 12, color: token.colorTextTertiary }}>akun dinonaktifkan</Text>
                </Space>
              </Space>
            </Card>
          </motion.div>
        </Col>

        {/* Wali Santri — clickable toggle card */}
        <Col xs={12} sm={12} lg={6}>
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, delay: 0.21 }}
          >
            <Card
              bordered={false}
              onClick={handleToggleWali}
              style={{
                ...cardStyle,
                border: showWali
                  ? `1.5px solid rgba(147,51,234,0.45)`
                  : `1px dashed ${token.colorBorder}`,
                background: showWali ? "rgba(147,51,234,0.06)" : token.colorBgContainer,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              styles={{ body: { padding: "20px 22px" } }}
            >
              <Space direction="vertical" size={2}>
                <Text style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: token.colorTextTertiary }}>
                  Wali Santri
                </Text>
                <Title
                  level={2}
                  style={{ margin: 0, lineHeight: 1, color: showWali ? "#9333EA" : token.colorTextTertiary }}
                >
                  {waliCount}
                </Title>
                <Space size={4}>
                  {showWali
                    ? <EyeInvisibleOutlined style={{ fontSize: 11, color: "#9333EA" }} />
                    : <EyeOutlined style={{ fontSize: 11, color: token.colorTextTertiary }} />
                  }
                  <Text style={{ fontSize: 12, color: showWali ? "#9333EA" : token.colorTextTertiary }}>
                    {showWali ? "klik untuk sembunyikan" : "klik untuk tampilkan"}
                  </Text>
                </Space>
              </Space>
            </Card>
          </motion.div>
        </Col>
      </Row>

      {/* ══════════════════════════════════════════════════════════════════════
          ROW 2 — Access intelligence (Gender + Takhasus)
          ══════════════════════════════════════════════════════════════════════ */}
      <Row gutter={[14, 14]} style={{ marginBottom: 14 }}>

        {/* Gender Access Distribution */}
        <Col xs={24} md={12}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.28 }}
          >
            <Card
              bordered={false}
              style={cardStyle}
              styles={{ body: { padding: "20px 24px" } }}
              title={
                <Space>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: "linear-gradient(135deg, rgba(37,99,235,0.15), rgba(236,72,153,0.15))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <TeamOutlined style={{ color: "#2563EB", fontSize: 14 }} />
                  </div>
                  <Text strong style={{ fontSize: 13 }}>Distribusi Akses Gender</Text>
                </Space>
              }
            >
              <Space direction="vertical" style={{ width: "100%" }} size={10}>
                {[
                  { label: "Putra (L)", count: kpis.putra,     color: "#2563EB", icon: <ManOutlined />   },
                  { label: "Putri (P)", count: kpis.putri,     color: "#EC4899", icon: <WomanOutlined /> },
                  { label: "Semua",    count: kpis.allGender,  color: token.colorTextTertiary, icon: null },
                ].map(item => (
                  <div key={item.label}>
                    <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 4 }}>
                      <Space size={5}>
                        {item.icon && (
                          <span style={{ color: item.color, fontSize: 12 }}>{item.icon}</span>
                        )}
                        <Text style={{ fontSize: 12 }}>{item.label}</Text>
                      </Space>
                      <Space size={6}>
                        <Text strong style={{ fontSize: 13, color: item.color }}>
                          {item.count}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {kpis.total > 0
                            ? `${Math.round((item.count / kpis.total) * 100)}%`
                            : "0%"}
                        </Text>
                      </Space>
                    </Space>
                    <Progress
                      percent={kpis.total > 0 ? Math.round((item.count / kpis.total) * 100) : 0}
                      showInfo={false}
                      strokeColor={item.color}
                      trailColor={token.colorFillSecondary}
                      size="small"
                      style={{ margin: 0 }}
                    />
                  </div>
                ))}
              </Space>
            </Card>
          </motion.div>
        </Col>

        {/* Takhasus Access Distribution */}
        <Col xs={24} md={12}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.35 }}
          >
            <Card
              bordered={false}
              style={cardStyle}
              styles={{ body: { padding: "20px 24px" } }}
              title={
                <Space>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: "linear-gradient(135deg, rgba(147,51,234,0.15), rgba(217,119,6,0.15))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <BookOutlined style={{ color: "#9333EA", fontSize: 14 }} />
                  </div>
                  <Text strong style={{ fontSize: 13 }}>Distribusi Akses Takhasus</Text>
                </Space>
              }
            >
              <Space direction="vertical" style={{ width: "100%" }} size={10}>
                {[
                  { label: "Tahfidz",  count: kpis.tahfidz,    color: "#9333EA", icon: <ReadOutlined />  },
                  { label: "Kitab",    count: kpis.kitab,      color: "#D97706", icon: <BookOutlined />  },
                  { label: "Semua",    count: kpis.allJurusan, color: token.colorTextTertiary, icon: null },
                ].map(item => (
                  <div key={item.label}>
                    <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 4 }}>
                      <Space size={5}>
                        {item.icon && (
                          <span style={{ color: item.color, fontSize: 12 }}>{item.icon}</span>
                        )}
                        <Text style={{ fontSize: 12 }}>{item.label}</Text>
                      </Space>
                      <Space size={6}>
                        <Text strong style={{ fontSize: 13, color: item.color }}>
                          {item.count}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {kpis.total > 0
                            ? `${Math.round((item.count / kpis.total) * 100)}%`
                            : "0%"}
                        </Text>
                      </Space>
                    </Space>
                    <Progress
                      percent={kpis.total > 0 ? Math.round((item.count / kpis.total) * 100) : 0}
                      showInfo={false}
                      strokeColor={item.color}
                      trailColor={token.colorFillSecondary}
                      size="small"
                      style={{ margin: 0 }}
                    />
                  </div>
                ))}
              </Space>
            </Card>
          </motion.div>
        </Col>
      </Row>

      {/* ══════════════════════════════════════════════════════════════════════
          ROW 3 — Role Distribution (full width)
          ══════════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.42 }}
        style={{ marginBottom: 14 }}
      >
        <Card
          bordered={false}
          style={cardStyle}
          styles={{ body: { padding: "18px 24px" } }}
          title={
            <Space>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: GOLD_BG,
                border: `1px solid ${GOLD_BORDER}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <SafetyCertificateOutlined style={{ color: GOLD, fontSize: 14 }} />
              </div>
              <Text strong style={{ fontSize: 13 }}>Distribusi Jabatan</Text>
            </Space>
          }
        >
          <Row gutter={[10, 10]}>
            {ADMIN_ROLES.map(role => {
              const cfg   = ROLE_CONFIG[role];
              const count = (kpis.roleCounts as Record<string, number>)[role] ?? 0;
              const pct   = kpis.total > 0 ? Math.round((count / kpis.total) * 100) : 0;
              return (
                <Col xs={12} sm={8} md={4} key={role}>
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: 12,
                      background: cfg.bg,
                      border: `1px solid ${cfg.border}`,
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {/* mini bg bar showing proportion */}
                    <div style={{
                      position: "absolute", bottom: 0, left: 0,
                      height: 3, width: `${pct}%`,
                      background: cfg.color,
                      borderRadius: "0 2px 2px 0",
                      transition: "width 0.6s ease",
                    }} />

                    <Space direction="vertical" size={1}>
                      <Space size={5}>
                        <span style={{ color: cfg.color, fontSize: 13 }}>{cfg.icon}</span>
                        <Text
                          style={{
                            fontSize: 10, textTransform: "uppercase",
                            letterSpacing: "0.5px", color: cfg.color, fontWeight: 600,
                          }}
                        >
                          {cfg.label}
                        </Text>
                      </Space>
                      <Space align="baseline" size={4}>
                        <Title level={4} style={{ margin: 0, color: cfg.color }}>
                          {count}
                        </Title>
                        <Text style={{ fontSize: 11, color: cfg.color, opacity: 0.65 }}>
                          akun
                        </Text>
                      </Space>
                    </Space>
                  </div>
                </Col>
              );
            })}
          </Row>
        </Card>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════════════
          ProTable
          ══════════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
      >
        <ProTable<IProfile>
          {...tableProps}
          columns={columns}
          rowKey="id"
          onSubmit={handleSubmit}
          onReset={handleReset}
          headerTitle={
            <Space>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 4px 12px ${GOLD}40`,
              }}>
                <SafetyCertificateOutlined style={{ color: "#fff", fontSize: 18 }} />
              </div>
              <Space direction="vertical" size={0}>
                <Text strong style={{ fontSize: 15 }}>Manajemen Admin</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Kelola hak akses &amp; profil pengurus sistem
                </Text>
              </Space>
            </Space>
          }
          toolBarRender={() => [
            /* ── Wali toggle button ── */
            <Button
              key="wali"
              icon={showWali ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              onClick={handleToggleWali}
              style={{
                borderRadius: 10,
                border: showWali
                  ? `1.5px solid rgba(147,51,234,0.5)`
                  : `1.5px dashed ${token.colorBorder}`,
                background: showWali ? "rgba(147,51,234,0.08)" : "transparent",
                color: showWali ? "#9333EA" : token.colorTextTertiary,
                height: 40,
              }}
            >
              {showWali
                ? "Sembunyikan Wali"
                : `Wali Santri (${waliCount})`}
            </Button>,

            /* ── Create admin ── */
            <Button
              key="create"
              type="primary"
              icon={<UserAddOutlined />}
              onClick={() => push("/admin-management/create")}
              style={{
                background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})`,
                border: "none", borderRadius: 10,
                height: 40, paddingInline: 20,
                fontWeight: 600,
                boxShadow: `0 4px 12px ${GOLD}35`,
              }}
            >
              Tambah Admin
            </Button>,
          ]}
          options={{
            density:    false,
            fullScreen: true,
            reload:     true,
            setting:    true,
            search:     false,
          }}
          pagination={{
            showSizeChanger: true,
            defaultPageSize: 10,
          }}
          search={{
            labelWidth: "auto",
            filterType: "query",
            span: 6,
            defaultCollapsed: false,
            collapseRender: false,
          }}
          cardBordered={false}
          style={{
            borderRadius: 16,
            border: `1px solid ${GOLD_BORDER}`,
            overflow: "hidden",
          }}
        />
      </motion.div>
    </div>
  );
};