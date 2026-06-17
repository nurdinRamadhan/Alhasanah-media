import React, { useMemo, useState } from "react";
import { useShow } from "@refinedev/core";
import { List, useTable } from "@refinedev/antd";
import {
  Table, Space, Typography, Card, Row, Col,
  message, Tag, Button, Progress, Tabs,
  theme, Popconfirm, Divider,
} from "antd";
import {
  CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined,
  MedicineBoxOutlined, TeamOutlined, ClockCircleOutlined,
  ThunderboltOutlined, SyncOutlined, CalendarOutlined,
} from "@ant-design/icons";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  Tooltip as RechartsTip,
} from "recharts";
import { motion } from "framer-motion";
import { supabaseClient } from "../../utility/supabaseClient";

const { Text, Title } = Typography;
const { useToken } = theme;

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const GOLD        = "#C9A84C";
const GOLD_DARK   = "#8B6E23";
const GOLD_BG     = "rgba(201,168,76,0.08)";
const GOLD_BORDER = "rgba(201,168,76,0.2)";

// ─── Status configuration ─────────────────────────────────────────────────────
const STATUS_CONFIG = {
  HADIR: {
    color: "#16A34A",
    bg:    "rgba(22,163,74,0.10)",
    border:"rgba(22,163,74,0.30)",
    label: "Hadir",
    icon:  <CheckCircleOutlined />,
  },
  SAKIT: {
    color: "#D97706",
    bg:    "rgba(217,119,6,0.10)",
    border:"rgba(217,119,6,0.30)",
    label: "Sakit",
    icon:  <MedicineBoxOutlined />,
  },
  IZIN: {
    color: "#2563EB",
    bg:    "rgba(37,99,235,0.10)",
    border:"rgba(37,99,235,0.30)",
    label: "Izin",
    icon:  <ExclamationCircleOutlined />,
  },
  ALFA: {
    color: "#DC2626",
    bg:    "rgba(220,38,38,0.10)",
    border:"rgba(220,38,38,0.30)",
    label: "Alfa",
    icon:  <CloseCircleOutlined />,
  },
} as const;

type AttendanceStatus = keyof typeof STATUS_CONFIG;

// ─── Component ────────────────────────────────────────────────────────────────
export const AttendanceShow: React.FC = () => {
  const { token } = useToken();
  const [activeFilter,   setActiveFilter]   = useState<string>("ALL");
  const [isBulkMarking,  setIsBulkMarking]  = useState(false);

  const { queryResult } = useShow({ resource: "attendance_sessions" });
  const record = queryResult.data?.data as any;

  const { tableProps, tableQueryResult } = useTable({
    resource: "attendance_records",
    permanentFilter: [{ field: "session_id", operator: "eq", value: record?.id }],
    pagination: { mode: "off" },
  });

  const allRecords = (tableQueryResult.data?.data ?? []) as any[];
  const total      = allRecords.length;
  const isOpen     = record?.status === "open";

  // ── Aggregated counts ────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const base = { HADIR: 0, SAKIT: 0, IZIN: 0, ALFA: 0 };
    allRecords.forEach(r => {
      if (r.status in base) base[r.status as AttendanceStatus]++;
    });
    return base;
  }, [allRecords]);

  const markedTotal   = counts.HADIR + counts.SAKIT + counts.IZIN + counts.ALFA;
  const unmarked      = total - markedTotal;
  const hadirPct      = total > 0 ? Math.round((counts.HADIR  / total) * 100) : 0;
  const completionPct = total > 0 ? Math.round((markedTotal   / total) * 100) : 0;

  const donutRaw: { name: string; value: number; color: string }[] = [
    { name: "Hadir", value: counts.HADIR, color: "#16A34A" },
    { name: "Sakit", value: counts.SAKIT, color: "#D97706" },
    { name: "Izin",  value: counts.IZIN,  color: "#2563EB" },
    { name: "Alfa",  value: counts.ALFA,  color: "#DC2626" },
  ];
  const donutData = donutRaw.filter(d => d.value > 0);
  const donutFallback = [{ name: "Belum", value: 1, color: token.colorBorderSecondary }];

  // ── Filtered table data ───────────────────────────────────────────────────────
  const filteredRecords = useMemo(() => {
    if (activeFilter === "ALL")     return allRecords;
    if (activeFilter === "PENDING") return allRecords.filter(r => !r.status || r.status === "PENDING");
    return allRecords.filter(r => r.status === activeFilter);
  }, [allRecords, activeFilter]);

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleMarkAttendance = async (santriNis: string, status: string) => {
    try {
      const { error } = await supabaseClient.rpc("mark_attendance", {
        p_session_id: record?.id,
        p_santri_nis: santriNis,
        p_status:     status,
      });
      if (error) throw error;
      message.success(`✓ ${status}`);
      tableQueryResult.refetch();
    } catch {
      message.error("Gagal memperbarui status");
    }
  };

  const handleMarkAllHadir = async () => {
    setIsBulkMarking(true);
    const pending = allRecords.filter(r => !r.status || r.status === "PENDING");
    try {
      await Promise.all(
        pending.map(r =>
          supabaseClient.rpc("mark_attendance", {
            p_session_id: record?.id,
            p_santri_nis: r.santri_nis,
            p_status:     "HADIR",
          }),
        ),
      );
      message.success(`${pending.length} santri ditandai HADIR`);
      tableQueryResult.refetch();
    } catch {
      message.error("Sebagian data gagal diperbarui");
    } finally {
      setIsBulkMarking(false);
    }
  };

  // ── Table columns ─────────────────────────────────────────────────────────────
  const columns = [
    {
      title: "No",
      key: "no",
      width: 48,
      render: (_: any, __: any, index: number) => (
        <Text type="secondary" style={{ fontSize: 12 }}>{index + 1}</Text>
      ),
    },
    {
      title: "Santri",
      dataIndex: "santri",
      key: "santri",
      render: (_: any, rec: any) => (
        <Space>
          {/* Avatar initial */}
          <div
            style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: `linear-gradient(135deg, ${GOLD}30, ${GOLD_DARK}30)`,
              border: `1px solid ${GOLD_BORDER}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, color: GOLD, fontSize: 14,
            }}
          >
            {rec.santri?.nama?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <Space direction="vertical" size={0}>
            <Text strong style={{ fontSize: 13 }}>{rec.santri?.nama || "–"}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>NIS: {rec.santri_nis}</Text>
          </Space>
        </Space>
      ),
    },
    {
      title: "Status Kehadiran",
      dataIndex: "status",
      key: "status",
      render: (value: AttendanceStatus, rec: any) => (
        <Space wrap>
          {(Object.keys(STATUS_CONFIG) as AttendanceStatus[]).map(s => {
            const cfg     = STATUS_CONFIG[s];
            const isActive = value === s;
            return (
              <button
                key={s}
                onClick={() => isOpen && handleMarkAttendance(rec.santri_nis, s)}
                style={{
                  padding: "4px 12px",
                  borderRadius: 8,
                  border: `1.5px solid ${isActive ? cfg.color : token.colorBorder}`,
                  background: isActive ? cfg.bg : "transparent",
                  color: isActive ? cfg.color : token.colorTextTertiary,
                  cursor: isOpen ? "pointer" : "not-allowed",
                  fontWeight: isActive ? 700 : 400,
                  fontSize: 12,
                  fontFamily: "inherit",
                  transition: "all 0.15s ease",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  opacity: isOpen ? 1 : 0.65,
                  outline: "none",
                }}
              >
                <span style={{ fontSize: 11 }}>{cfg.icon}</span>
                {cfg.label}
              </button>
            );
          })}
        </Space>
      ),
    },
    {
      title: "Dicatat",
      dataIndex: "marked_at",
      key: "marked_at",
      width: 90,
      render: (val: string) =>
        val ? (
          <Tag icon={<ClockCircleOutlined />} style={{ fontSize: 11, borderRadius: 6 }}>
            {new Date(val).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
          </Tag>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>–</Text>
        ),
    },
  ];

  // ── Tab items ─────────────────────────────────────────────────────────────────
  const tabItems = [
    { key: "ALL",     label: `Semua (${total})` },
    { key: "HADIR",   label: <Space size={4}><CheckCircleOutlined style={{ color: "#16A34A" }} />Hadir ({counts.HADIR})</Space> },
    { key: "SAKIT",   label: <Space size={4}><MedicineBoxOutlined style={{ color: "#D97706" }} />Sakit ({counts.SAKIT})</Space> },
    { key: "IZIN",    label: <Space size={4}><ExclamationCircleOutlined style={{ color: "#2563EB" }} />Izin ({counts.IZIN})</Space> },
    { key: "ALFA",    label: <Space size={4}><CloseCircleOutlined style={{ color: "#DC2626" }} />Alfa ({counts.ALFA})</Space> },
    { key: "PENDING", label: `Belum Absen (${unmarked})` },
  ];

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ paddingBottom: 40 }}>

      {/* ── Hero Session Banner ────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ marginBottom: 24 }}
      >
        <Card
          bordered={false}
          style={{
            borderRadius: 20,
            background: `linear-gradient(135deg, ${token.colorBgElevated} 0%, ${token.colorBgContainer} 100%)`,
            border: `1px solid ${GOLD_BORDER}`,
            overflow: "hidden",
            position: "relative",
          }}
          styles={{ body: { padding: "28px 32px" } }}
        >
          {/* Decorative blobs */}
          <div style={{
            position:"absolute", top:-50, right:-50,
            width:200, height:200,
            background:`radial-gradient(circle, ${GOLD}14, transparent 65%)`,
            pointerEvents:"none",
          }} />
          <div style={{
            position:"absolute", bottom:-40, left:-30,
            width:160, height:160,
            background:`radial-gradient(circle, ${GOLD}08, transparent 65%)`,
            pointerEvents:"none",
          }} />

          <Row align="middle" gutter={[32, 24]}>

            {/* ── Session meta ───────────────────────────────────────────── */}
            <Col flex="auto">
              <Space direction="vertical" size={6}>
                {/* Status badges */}
                <Space>
                  <Tag
                    style={{
                      borderRadius: 8, fontWeight: 700,
                      background: isOpen ? "rgba(22,163,74,0.12)" : "rgba(107,114,128,0.12)",
                      border: `1px solid ${isOpen ? "rgba(22,163,74,0.4)" : "rgba(107,114,128,0.4)"}`,
                      color: isOpen ? "#16A34A" : token.colorTextTertiary,
                    }}
                  >
                    {isOpen
                      ? <><SyncOutlined spin style={{ marginRight: 4 }} />SESI AKTIF</>
                      : <><CheckCircleOutlined style={{ marginRight: 4 }} />SELESAI</>}
                  </Tag>
                  {record?.attendance_types?.category_id && (
                    <Tag color="gold" style={{ borderRadius: 8 }}>
                      {record.attendance_types.category_id}
                    </Tag>
                  )}
                </Space>

                {/* Title */}
                <Title level={3} style={{ color: GOLD, margin: 0 }}>
                  {record?.attendance_types?.name} — {record?.title || "Sesi Reguler"}
                </Title>

                {/* Date / time */}
                <Space split={<Text type="secondary">·</Text>}>
                  <Space>
                    <CalendarOutlined style={{ color: GOLD }} />
                    <Text type="secondary">{record?.attendance_date}</Text>
                  </Space>
                  <Space>
                    <ClockCircleOutlined style={{ color: GOLD }} />
                    <Text type="secondary">
                      {record?.starts_at?.slice(0, 5)} – {record?.ends_at?.slice(0, 5)}
                    </Text>
                  </Space>
                </Space>
              </Space>
            </Col>

            {/* ── Donut chart ─────────────────────────────────────────────── */}
            <Col xs={24} sm={8} md={6}>
              <div style={{ height: 160, position: "relative" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData.length > 0 ? donutData : donutFallback}
                      cx="50%" cy="50%"
                      innerRadius={46} outerRadius={68}
                      paddingAngle={3}
                      dataKey="value"
                      startAngle={90} endAngle={-270}
                      strokeWidth={0}
                    >
                      {(donutData.length > 0 ? donutData : donutFallback).map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTip
                      contentStyle={{
                        background: token.colorBgElevated,
                        border: `1px solid ${GOLD_BORDER}`,
                        borderRadius: 8, fontSize: 12,
                      }}
                      formatter={(val: any, name: any) => [`${val} santri`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Centre label */}
                <div
                  style={{
                    position: "absolute", top: "50%", left: "50%",
                    transform: "translate(-50%, -50%)",
                    textAlign: "center", pointerEvents: "none",
                  }}
                >
                  <div style={{ fontSize: 26, fontWeight: 800, color: GOLD, lineHeight: 1 }}>
                    {hadirPct}%
                  </div>
                  <div style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 2 }}>hadir</div>
                </div>
              </div>
            </Col>

            {/* ── Mini KPI grid ─────────────────────────────────────────────── */}
            <Col xs={24} md="auto">
              <Row gutter={[10, 10]}>
                {(Object.entries(STATUS_CONFIG) as [AttendanceStatus, typeof STATUS_CONFIG[AttendanceStatus]][])
                  .map(([status, cfg]) => (
                  <Col xs={12} sm={6} md={12} key={status}>
                    <div
                      style={{
                        padding: "10px 14px", borderRadius: 10,
                        background: cfg.bg,
                        border: `1px solid ${cfg.border}`,
                        minWidth: 80,
                      }}
                    >
                      <Text style={{ fontSize: 11, color: cfg.color, display: "block" }}>
                        {cfg.label}
                      </Text>
                      <Space align="baseline" size={2}>
                        <Title level={4} style={{ margin: 0, color: cfg.color, lineHeight: 1.2 }}>
                          {counts[status]}
                        </Title>
                        <Text style={{ fontSize: 11, color: cfg.color, opacity: 0.6 }}>
                          /{total}
                        </Text>
                      </Space>
                    </div>
                  </Col>
                ))}
              </Row>
            </Col>
          </Row>

          {/* ── Progress bar ────────────────────────────────────────────────── */}
          <div style={{ marginTop: 24 }}>
            <Space
              style={{ width: "100%", justifyContent: "space-between", marginBottom: 6 }}
            >
              <Text style={{ fontSize: 12, color: token.colorTextTertiary }}>
                Progress Pengisian Absensi
              </Text>
              <Text style={{ fontSize: 12, color: GOLD, fontWeight: 700 }}>
                {completionPct}%
              </Text>
            </Space>
            <Progress
              percent={completionPct}
              showInfo={false}
              strokeColor={{ from: GOLD, to: GOLD_DARK }}
              trailColor={token.colorFillSecondary}
              strokeWidth={8}
            />
            <Text
              style={{
                fontSize: 11, color: token.colorTextTertiary,
                marginTop: 6, display: "block",
              }}
            >
              {markedTotal} dari {total} santri telah diabsen
              {unmarked > 0 && <span style={{ color: "#D97706" }}> · {unmarked} belum tercatat</span>}
            </Text>
          </div>
        </Card>
      </motion.div>

      {/* ── Attendance Table ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
      >
        <List
          title={
            <Space>
              <TeamOutlined style={{ color: GOLD }} />
              <span>Daftar Absensi Santri</span>
              {!isOpen && (
                <Tag style={{ borderRadius: 8, fontSize: 11 }}>Mode Baca Saja</Tag>
              )}
            </Space>
          }
          headerButtons={
            isOpen ? (
              <Popconfirm
                title="Tandai semua yang belum absen sebagai HADIR?"
                okText="Ya, tandai semua"
                cancelText="Batal"
                onConfirm={handleMarkAllHadir}
                okButtonProps={{
                  style: {
                    background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})`,
                    border: "none",
                  },
                }}
              >
                <Button
                  icon={<ThunderboltOutlined />}
                  loading={isBulkMarking}
                  style={{
                    background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})`,
                    border: "none", borderRadius: 8, color: "#fff",
                  }}
                >
                  Tandai Semua Hadir
                </Button>
              </Popconfirm>
            ) : null
          }
        >
          {/* Filter tabs */}
          <Tabs
            activeKey={activeFilter}
            onChange={setActiveFilter}
            size="small"
            style={{ marginBottom: 0 }}
            tabBarStyle={{ marginBottom: 0 }}
            items={tabItems.map(t => ({
              key: t.key,
              label: t.label,
              children: (
                <Table
                  dataSource={filteredRecords}
                  loading={tableQueryResult.isLoading || tableQueryResult.isFetching}
                  columns={columns}
                  rowKey="id"
                  pagination={false}
                  scroll={{ y: 480 }}
                />
              ),
            }))}
          />
        </List>
      </motion.div>
    </div>
  );
};
