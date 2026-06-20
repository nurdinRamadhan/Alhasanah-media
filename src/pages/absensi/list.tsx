import React, { useState, useMemo, useEffect } from "react";
import { useNavigation, useGetIdentity, useList } from "@refinedev/core";
import { List, DateField, useTable } from "@refinedev/antd";
import {
  Table, Tag, Space, Button, Typography, Card,
  Row, Col, Dropdown, Menu, message, Modal, Empty,
  theme, Divider,
} from "antd";
import {
  CalendarOutlined, CheckCircleOutlined, ClockCircleOutlined,
  ArrowRightOutlined, FileExcelOutlined, FilePdfOutlined,
  DownloadOutlined, ThunderboltOutlined, RiseOutlined,
  SyncOutlined, BellOutlined, HistoryOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTip, ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";
import dayjs from "dayjs";
import "dayjs/locale/id";
import {
  REPORT_DEFINITIONS,
  generateReportData,
  exportReportToExcel,
  exportReportToPdf,
} from "../../components/reportEngine";
import { supabaseClient } from "../../utility/supabaseClient";

dayjs.locale("id");

const { Text, Title } = Typography;
const { useToken } = theme;

// ─── Brand tokens ────────────────────────────────────────────────────────────
const GOLD       = "#C9A84C";
const GOLD_DARK  = "#8B6E23";
const GOLD_BG    = "rgba(201,168,76,0.08)";
const GOLD_BORDER= "rgba(201,168,76,0.2)";

function getCategoryIcon(categoryId: string): string {
  if (categoryId === "SHALAT")   return "🕌";
  if (categoryId === "AKADEMIK") return "📚";
  return "⭐";
}

// ─── KPI card data type ───────────────────────────────────────────────────────
interface KpiItem {
  title: string;
  value: number;
  desc: string;
  icon: React.ReactNode;
  color: string;
}

// ─── Component ───────────────────────────────────────────────────────────────
export const AttendanceList: React.FC = () => {
  const { token } = useToken();
  const { data: identity } = useGetIdentity<any>();

  const [isExporting,               setIsExporting]               = useState(false);
  const [isQuickStartModalVisible,  setIsQuickStartModalVisible]  = useState(false);
  const [selectedTypeId,            setSelectedTypeId]            = useState<string | null>(null);
  const [selectedMode,              setSelectedMode]              = useState<string>("manual");
  const [isStarting,                setIsStarting]                = useState(false);
  const [closingIds,                setClosingIds]                = useState<Set<string>>(new Set());

  const { show } = useNavigation();

  const { tableProps, tableQueryResult, setFilters } = useTable({
    resource: "attendance_sessions",
    syncWithLocation: true,
    sorters: { initial: [{ field: "attendance_date", order: "desc" }] },
  });

  useEffect(() => {
    if (identity && identity.scopeJurusan !== "ALL") {
      setFilters([
        { field: "jurusan", operator: "in", value: [identity.scopeJurusan, null] },
      ]);
    } else {
      setFilters([]);
    }
  }, [identity, setFilters]);

  const { data: typesData, isLoading: isLoadingTypes } = useList({
    resource: "attendance_types",
    filters:
      identity && identity.scopeJurusan !== "ALL"
        ? [{ field: "target_jurusan", operator: "in", value: [identity.scopeJurusan, null] }]
        : [],
  });

  const sessions    = (tableQueryResult.data?.data ?? []) as any[];
  const today       = dayjs().format("YYYY-MM-DD");
  const openSessions  = useMemo(() => sessions.filter(s => s.status === "open"),              [sessions]);
  const todaySessions = useMemo(() => sessions.filter(s => s.attendance_date === today),      [sessions, today]);
  const totalSessions = tableQueryResult.data?.total ?? 0;

  // Last-7-days chart data derived from session list
  const chartData = useMemo(() =>
    Array.from({ length: 7 }).map((_, i) => {
      const d = dayjs().subtract(6 - i, "day");
      return {
        day: d.format("ddd"),
        sesi: sessions.filter(s => s.attendance_date === d.format("YYYY-MM-DD")).length,
      };
    }),
  [sessions]);

  // KPI items
  const kpiItems: KpiItem[] = [
    {
      title: "Sesi Aktif",
      value: openSessions.length,
      desc: "sedang berlangsung",
      icon: <SyncOutlined spin />,
      color: "#16A34A",
    },
    {
      title: "Sesi Hari Ini",
      value: todaySessions.length,
      desc: dayjs().format("dddd, DD MMM"),
      icon: <CalendarOutlined />,
      color: GOLD,
    },
    {
      title: "Total Sesi",
      value: totalSessions,
      desc: "seluruh riwayat",
      icon: <HistoryOutlined />,
      color: "#2563EB",
    },
    {
      title: "Tipe Kegiatan",
      value: typesData?.total ?? 0,
      desc: "terdaftar",
      icon: <BellOutlined />,
      color: "#9333EA",
    },
  ];

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleQuickStart = async () => {
    if (!selectedTypeId) return;
    setIsStarting(true);
    try {
      const { data, error } = await supabaseClient.rpc("quick_start_attendance_session", {
        p_type_id: selectedTypeId,
        p_mode: selectedMode,
      });
      if (error) throw error;
      if (data?.id) {
        supabaseClient.rpc("populate_session_records", { p_session_id: data.id })
          .then(({ error: popErr }) => {
            if (popErr) console.error("Populate records failed:", popErr);
          });
        message.success("Sesi otomatis berhasil dimulai!");
        setIsQuickStartModalVisible(false);
        setSelectedTypeId(null);
        tableQueryResult.refetch();
        show("attendance_sessions", data.id);
      }
    } catch (err: any) {
      message.error(err.message || "Gagal memulai sesi otomatis");
    } finally {
      setIsStarting(false);
    }
  };

  const handleCloseSession = async (sessionId: string) => {
    setClosingIds(prev => new Set(prev).add(sessionId));
    try {
      const { error } = await supabaseClient.rpc("close_attendance_session", {
        p_session_id: sessionId,
      });
      if (error) throw error;
      message.success("Sesi ditutup");
      tableQueryResult.refetch();
    } catch {
      message.error("Gagal menutup sesi");
    } finally {
      setClosingIds(prev => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
    }
  };

  const handleExport = async (format: "excel" | "pdf") => {
    if (!identity) return;
    setIsExporting(true);
    const hide = message.loading(`Menyiapkan laporan ${format.toUpperCase()}...`, 0);
    try {
      const def = REPORT_DEFINITIONS.find(d => d.key === "absensi")!;
      const reportData = await generateReportData(
        def,
        { mode: "global", format, dateRange: null },
        identity,
      );
      if (format === "excel") await exportReportToExcel(reportData);
      else                    await exportReportToPdf(reportData);
      message.success(`Laporan ${format.toUpperCase()} berhasil diunduh`);
    } catch (error) {
      console.error(error);
      message.error("Gagal mengekspor laporan");
    } finally {
      hide();
      setIsExporting(false);
    }
  };

  const exportMenu = [
    { key: 'excel', icon: <FileExcelOutlined style={{ color: "#1D6F42" }} />, label: 'Export Excel (.xlsx)' },
    { key: 'pdf', icon: <FilePdfOutlined style={{ color: "#E44134" }} />, label: 'Export PDF (.pdf)' },
  ];

  // ── Table columns ────────────────────────────────────────────────────────────
  const columns = [
    {
      title: "Tanggal",
      dataIndex: "attendance_date",
      key: "attendance_date",
      width: 240,
      render: (value: string) => {
        const isToday = value === today;
        return (
          <Space>
            <div
              style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: isToday
                  ? `linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})`
                  : token.colorFillSecondary,
                display: "flex", alignItems: "center", justifyContent: "center",
                border: `1px solid ${isToday ? GOLD : token.colorBorder}`,
              }}
            >
              <CalendarOutlined style={{ color: isToday ? "#fff" : GOLD, fontSize: 16 }} />
            </div>
            <Space direction="vertical" size={0}>
              <Text strong style={{ fontSize: 13 }}>
                <DateField value={value} format="DD MMMM YYYY" />
              </Text>
              {isToday && (
                <Text style={{ fontSize: 11, color: GOLD }}>● Hari ini</Text>
              )}
            </Space>
          </Space>
        );
      },
    },
    {
      title: "Kegiatan",
      dataIndex: "attendance_types",
      key: "type_id",
      render: (value: any) => (
        <Space>
          <span style={{ fontSize: 20 }}>{getCategoryIcon(value?.category_id)}</span>
          <Text strong>{value?.name || "N/A"}</Text>
        </Space>
      ),
    },
    {
      title: "Waktu",
      key: "time",
      width: 150,
      render: (_: any, record: any) => (
        <Tag
          icon={<ClockCircleOutlined />}
          style={{ borderRadius: 8, padding: "2px 10px" }}
        >
          {record.starts_at?.slice(0, 5)} – {record.ends_at?.slice(0, 5)}
        </Tag>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (value: string) =>
        value === "open" ? (
          <Tag
            icon={<SyncOutlined spin />}
            color="success"
            style={{ borderRadius: 8, fontWeight: 700, padding: "2px 10px" }}
          >
            AKTIF
          </Tag>
        ) : (
          <Tag
            icon={<CheckCircleOutlined />}
            style={{ borderRadius: 8, padding: "2px 10px" }}
          >
            SELESAI
          </Tag>
        ),
    },
    {
      title: "",
      key: "actions",
      width: 240,
      render: (_: any, record: any) => (
        <Space>
          <Button
            type={record.status === "open" ? "primary" : "default"}
            size="small"
            icon={<ArrowRightOutlined />}
            onClick={() => show("attendance_sessions", record.id)}
            style={{
              borderRadius: 8,
              ...(record.status === "open"
                ? { background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})`, border: "none" }
                : {}),
            }}
          >
            {record.status === "open" ? "Absen Sekarang" : "Lihat Detail"}
          </Button>
          {record.status === "open" && (
            <Button
              size="small"
              danger
              icon={<CloseCircleOutlined />}
              loading={closingIds.has(record.id)}
              onClick={() => handleCloseSession(record.id)}
              style={{ borderRadius: 8 }}
            >
              Tutup
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ paddingBottom: 40 }}>

      {/* ── KPI Strip ─────────────────────────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {kpiItems.map((kpi, i) => (
          <Col xs={12} sm={12} lg={6} key={kpi.title}>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            >
              <Card
                bordered={false}
                style={{
                  borderRadius: 16,
                  border: `1px solid ${GOLD_BORDER}`,
                  background: token.colorBgContainer,
                  overflow: "hidden",
                  position: "relative",
                }}
                styles={{ body: { padding: "20px 22px" } }}
              >
                {/* Decorative glow blob */}
                <div
                  style={{
                    position: "absolute", top: -12, right: -12,
                    width: 80, height: 80,
                    background: `radial-gradient(circle, ${kpi.color}22, transparent 70%)`,
                    borderRadius: "50%", pointerEvents: "none",
                  }}
                />
                <Space direction="vertical" size={2}>
                  <Text
                    style={{
                      fontSize: 11, textTransform: "uppercase",
                      letterSpacing: 1, color: token.colorTextTertiary,
                    }}
                  >
                    {kpi.title}
                  </Text>
                  <Title level={2} style={{ margin: 0, color: kpi.color, lineHeight: 1.1 }}>
                    {kpi.value}
                  </Title>
                  <Space size={4}>
                    <span style={{ fontSize: 12, color: kpi.color }}>{kpi.icon}</span>
                    <Text style={{ fontSize: 12, color: kpi.color }}>{kpi.desc}</Text>
                  </Space>
                </Space>
              </Card>
            </motion.div>
          </Col>
        ))}
      </Row>

      {/* ── 7-Day Area Chart ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.36 }}
        style={{ marginBottom: 24 }}
      >
        <Card
          bordered={false}
          style={{ borderRadius: 16, border: `1px solid ${GOLD_BORDER}` }}
          styles={{ body: { padding: 24 } }}
          title={
            <Space>
              <RiseOutlined style={{ color: GOLD }} />
              <Text strong>Aktivitas Sesi — 7 Hari Terakhir</Text>
            </Space>
          }
        >
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="goldAreaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={GOLD} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={GOLD} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={token.colorBorderSecondary}
                vertical={false}
              />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 12, fill: token.colorTextTertiary }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: token.colorTextTertiary }}
                axisLine={false} tickLine={false}
                allowDecimals={false}
              />
              <RechartsTip
                contentStyle={{
                  background: token.colorBgElevated,
                  border: `1px solid ${GOLD_BORDER}`,
                  borderRadius: 10, fontSize: 13,
                }}
                labelStyle={{ color: token.colorText, fontWeight: 600 }}
                itemStyle={{ color: GOLD }}
                formatter={(val: any) => [`${val} sesi`, "Sesi"]}
              />
              <Area
                type="monotone"
                dataKey="sesi"
                stroke={GOLD}
                strokeWidth={2.5}
                fill="url(#goldAreaFill)"
                dot={{ r: 5, fill: GOLD, stroke: token.colorBgContainer, strokeWidth: 2 }}
                activeDot={{ r: 7, fill: GOLD }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </motion.div>

      {/* ── Session Table ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.48 }}
      >
        <List
          title={
            <Space>
              <CalendarOutlined style={{ color: GOLD }} />
              <span>Riwayat Sesi Absensi</span>
              <Tag
                style={{
                  background: GOLD_BG, border: `1px solid ${GOLD_BORDER}`,
                  color: GOLD, borderRadius: 8,
                }}
              >
                {identity?.scopeJurusan || "Global"}
              </Tag>
            </Space>
          }
          headerButtons={
            <Space>
              <Dropdown menu={{ items: exportMenu, onClick: ({ key }) => handleExport(key as "excel" | "pdf") }} trigger={["click"]} disabled={isExporting}>
                <Button
                  icon={<DownloadOutlined />}
                  loading={isExporting}
                  style={{ borderRadius: 8 }}
                >
                  Unduh Laporan
                </Button>
              </Dropdown>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                onClick={() => setIsQuickStartModalVisible(true)}
                loading={isStarting}
                style={{
                  background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})`,
                  border: "none", borderRadius: 8,
                }}
              >
                Mulai Sesi Otomatis
              </Button>
            </Space>
          }
        >
          <Table {...tableProps} columns={columns} rowKey="id" style={{ borderRadius: 12 }} />
        </List>
      </motion.div>

      {/* ── Quick-Start Modal ─────────────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <ThunderboltOutlined style={{ color: GOLD }} />
            <Text strong>Mulai Sesi Otomatis</Text>
          </Space>
        }
        open={isQuickStartModalVisible}
        onOk={handleQuickStart}
        onCancel={() => { setIsQuickStartModalVisible(false); setSelectedTypeId(null); }}
        okText="🚀 Mulai Sekarang"
        cancelText="Batal"
        confirmLoading={isStarting}
        okButtonProps={{
          disabled: !selectedTypeId,
          style: {
            background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})`,
            border: "none", borderRadius: 8,
          },
        }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
        width={560}
      >
        <Divider style={{ margin: "12px 0 16px" }} />
        <Text type="secondary" style={{ display: "block", marginBottom: 16, fontSize: 13 }}>
          Sistem akan menggunakan pengaturan waktu default dan mendaftarkan santri secara
          otomatis sesuai master data.
        </Text>

        {/* Mode selection */}
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ display: "block", marginBottom: 8, fontSize: 13 }}>
            Mode Absensi
          </Text>
          <Row gutter={12}>
            <Col span={12}>
              <div
                onClick={() => setSelectedMode("manual")}
                style={{
                  padding: "12px 14px", borderRadius: 12, cursor: "pointer",
                  border: `2px solid ${selectedMode === "manual" ? GOLD : token.colorBorder}`,
                  background: selectedMode === "manual" ? GOLD_BG : token.colorBgElevated,
                  transition: "all 0.18s ease",
                }}
              >
                <Text strong style={{ color: selectedMode === "manual" ? GOLD : token.colorText, fontSize: 13 }}>
                  📝 Manual
                </Text>
                <Text type="secondary" style={{ display: "block", fontSize: 11, marginTop: 4 }}>
                  Catat setelah kegiatan selesai. recorded_at = waktu jadwal.
                </Text>
              </div>
            </Col>
            <Col span={12}>
              <div
                onClick={() => setSelectedMode("live")}
                style={{
                  padding: "12px 14px", borderRadius: 12, cursor: "pointer",
                  border: `2px solid ${selectedMode === "live" ? GOLD : token.colorBorder}`,
                  background: selectedMode === "live" ? GOLD_BG : token.colorBgElevated,
                  transition: "all 0.18s ease",
                }}
              >
                <Text strong style={{ color: selectedMode === "live" ? GOLD : token.colorText, fontSize: 13 }}>
                  🎯 Live
                </Text>
                <Text type="secondary" style={{ display: "block", fontSize: 11, marginTop: 4 }}>
                  Catat real-time saat kegiatan. Support Scan QR.
                </Text>
              </div>
            </Col>
          </Row>
        </div>

        {isLoadingTypes ? (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <SyncOutlined spin style={{ fontSize: 28, color: GOLD }} />
          </div>
        ) : typesData?.total === 0 ? (
          <Empty description="Tidak ada tipe kegiatan tersedia untuk takhasus Anda" />
        ) : (
          <Row gutter={[12, 12]}>
            {typesData?.data.map((type: any) => {
              const isSelected = selectedTypeId === type.id;
              return (
                <Col xs={12} key={type.id}>
                  <div
                    onClick={() => setSelectedTypeId(type.id)}
                    style={{
                      padding: "14px 16px",
                      borderRadius: 12,
                      border: `2px solid ${isSelected ? GOLD : token.colorBorder}`,
                      background: isSelected ? GOLD_BG : token.colorBgElevated,
                      cursor: "pointer",
                      transition: "all 0.18s ease",
                      position: "relative",
                      userSelect: "none",
                    }}
                  >
                    <div style={{ fontSize: 28, marginBottom: 8 }}>
                      {getCategoryIcon(type.category_id)}
                    </div>
                    <Text
                      strong
                      style={{
                        display: "block", fontSize: 14, marginBottom: 6,
                        color: isSelected ? GOLD : token.colorText,
                      }}
                    >
                      {type.name}
                    </Text>
                    <Space size={4} wrap>
                      <Tag style={{ fontSize: 10, borderRadius: 6, margin: 0 }}>
                        <ClockCircleOutlined style={{ marginRight: 3 }} />
                        {type.default_starts_at?.slice(0, 5)} – {type.default_ends_at?.slice(0, 5)}
                      </Tag>
                      {type.target_jurusan && (
                        <Tag color="purple" style={{ fontSize: 10, borderRadius: 6, margin: 0 }}>
                          {type.target_jurusan}
                        </Tag>
                      )}
                    </Space>
                    {isSelected && (
                      <CheckCircleOutlined
                        style={{
                          position: "absolute", top: 10, right: 10,
                          color: GOLD, fontSize: 18,
                        }}
                      />
                    )}
                  </div>
                </Col>
              );
            })}
          </Row>
        )}
      </Modal>
    </div>
  );
};
