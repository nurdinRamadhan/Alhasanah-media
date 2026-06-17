import React, { useEffect, useMemo } from "react";
import { useGetIdentity, useInvalidate } from "@refinedev/core";
import { List, useModalForm, useTable } from "@refinedev/antd";
import {
  Table, Space, Button, Modal, Form, Input, Select,
  Tag, Typography, TimePicker, Card, Row, Col, theme, Divider,
} from "antd";
import {
  SettingOutlined, PlusOutlined, EditOutlined, ClockCircleOutlined,
} from "@ant-design/icons";
import { motion } from "framer-motion";
import dayjs from "dayjs";

const { Text, Title } = Typography;
const { useToken } = theme;

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const GOLD        = "#C9A84C";
const GOLD_DARK   = "#8B6E23";
const GOLD_BG     = "rgba(201,168,76,0.08)";
const GOLD_BORDER = "rgba(201,168,76,0.2)";

// ─── Category configuration ────────────────────────────────────────────────────
const CATEGORY_CONFIG = {
  SHALAT: {
    color:  "#D97706",
    bg:     "rgba(217,119,6,0.08)",
    border: "rgba(217,119,6,0.25)",
    icon:   "🕌",
    label:  "Ibadah Shalat",
  },
  AKADEMIK: {
    color:  "#2563EB",
    bg:     "rgba(37,99,235,0.08)",
    border: "rgba(37,99,235,0.25)",
    icon:   "📚",
    label:  "Akademik",
  },
  LAINNYA: {
    color:  "#9333EA",
    bg:     "rgba(147,51,234,0.08)",
    border: "rgba(147,51,234,0.25)",
    icon:   "⭐",
    label:  "Lainnya",
  },
} as const;

type CategoryId = keyof typeof CATEGORY_CONFIG;

// ─── Shared form fields (module-level, no hooks) ───────────────────────────────
const AttendanceTypeFormFields: React.FC = () => {
  const { token } = useToken();
  return (
    <>
      <Form.Item label="Kategori" name="category_id" rules={[{ required: true, message: "Wajib diisi" }]}>
        <Select
          style={{ borderRadius: 8 }}
          options={[
            { label: "🕌  Ibadah Shalat",    value: "SHALAT"   },
            { label: "📚  Kegiatan Akademik", value: "AKADEMIK" },
            { label: "⭐  Lainnya",           value: "LAINNYA"  },
          ]}
        />
      </Form.Item>

      <Form.Item
        label="Nama Kegiatan"
        name="name"
        rules={[{ required: true, message: "Wajib diisi" }]}
      >
        <Input
          placeholder="Contoh: Subuh, Tahfidz, KBM"
          style={{ borderRadius: 8 }}
        />
      </Form.Item>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            label="Jam Mulai"
            name="default_starts_at"
            getValueProps={v => ({ value: v ? dayjs(v, "HH:mm:ss") : undefined })}
            getValueFromEvent={v => (v ? v.format("HH:mm:ss") : undefined)}
          >
            <TimePicker format="HH:mm" style={{ width: "100%", borderRadius: 8 }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="Jam Selesai"
            name="default_ends_at"
            getValueProps={v => ({ value: v ? dayjs(v, "HH:mm:ss") : undefined })}
            getValueFromEvent={v => (v ? v.format("HH:mm:ss") : undefined)}
          >
            <TimePicker format="HH:mm" style={{ width: "100%", borderRadius: 8 }} />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item label="Target Takhasus (Scope)" name="target_jurusan">
        <Select
          allowClear
          placeholder="Kosongkan jika untuk semua takhasus"
          style={{ borderRadius: 8 }}
          options={[
            { label: "Tahfidz", value: "TAHFIDZ" },
            { label: "Kitab",   value: "KITAB"   },
          ]}
        />
      </Form.Item>

      <Form.Item label="Deskripsi" name="description">
        <Input.TextArea rows={3} style={{ borderRadius: 8 }} />
      </Form.Item>
    </>
  );
};

// ─── Component ─────────────────────────────────────────────────────────────────
export const AttendanceTypesList: React.FC = () => {
  const { token } = useToken();
  const { data: identity } = useGetIdentity<any>();
  const invalidate = useInvalidate();

  const { tableProps, tableQueryResult, setFilters } = useTable({
    resource: "attendance_types",
    syncWithLocation: true,
  });

  useEffect(() => {
    if (identity && identity.scopeJurusan !== "ALL") {
      setFilters([
        { field: "target_jurusan", operator: "in", value: [identity.scopeJurusan, null] },
      ]);
    } else {
      setFilters([]);
    }
  }, [identity, setFilters]);

  // ── Modals ────────────────────────────────────────────────────────────────────
  const {
    modalProps: createModalProps,
    formProps:  createFormProps,
    show:       showCreateModal,
  } = useModalForm({
    resource: "attendance_types",
    action: "create",
    onMutationSuccess: () => {
      invalidate({ resource: "attendance_types", invalidates: ["list"] });
    },
  });

  const {
    modalProps: editModalProps,
    formProps:  editFormProps,
    show:       showEditModal,
  } = useModalForm({
    resource: "attendance_types",
    action: "edit",
    onMutationSuccess: () => {
      invalidate({ resource: "attendance_types", invalidates: ["list"] });
    },
  });

  const types = (tableQueryResult.data?.data ?? []) as any[];

  // Category counts for summary cards
  const categoryCounts = useMemo(() => {
    const base: Record<string, number> = { SHALAT: 0, AKADEMIK: 0, LAINNYA: 0 };
    types.forEach(t => { if (t.category_id in base) base[t.category_id]++; });
    return base;
  }, [types]);

  // ── Table columns ──────────────────────────────────────────────────────────────
  const columns = [
    {
      title: "Kegiatan",
      dataIndex: "name",
      key: "name",
      render: (value: string, rec: any) => {
        const cfg = CATEGORY_CONFIG[rec.category_id as CategoryId] ?? CATEGORY_CONFIG.LAINNYA;
        return (
          <Space>
            <div
              style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: cfg.bg, border: `1px solid ${cfg.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18,
              }}
            >
              {cfg.icon}
            </div>
            <Space direction="vertical" size={0}>
              <Text strong style={{ color: GOLD }}>{value}</Text>
              {rec.description && (
                <Text type="secondary" style={{ fontSize: 11 }}>{rec.description}</Text>
              )}
            </Space>
          </Space>
        );
      },
    },
    {
      title: "Waktu Default",
      key: "time",
      width: 170,
      render: (_: any, rec: any) => (
        <Tag icon={<ClockCircleOutlined />} style={{ borderRadius: 8, padding: "2px 10px" }}>
          {rec.default_starts_at?.slice(0, 5)} – {rec.default_ends_at?.slice(0, 5)}
        </Tag>
      ),
    },
    {
      title: "Kategori",
      dataIndex: "category_id",
      key: "category_id",
      width: 160,
      render: (value: CategoryId) => {
        const cfg = CATEGORY_CONFIG[value] ?? CATEGORY_CONFIG.LAINNYA;
        return (
          <Tag
            style={{
              background: cfg.bg, border: `1px solid ${cfg.border}`,
              color: cfg.color, borderRadius: 8, fontWeight: 600,
            }}
          >
            {cfg.icon} {cfg.label}
          </Tag>
        );
      },
    },
    {
      title: "Target Takhasus",
      dataIndex: "target_jurusan",
      key: "target_jurusan",
      width: 150,
      render: (val: string) =>
        val ? (
          <Tag color="purple" style={{ borderRadius: 8 }}>{val}</Tag>
        ) : (
          <Tag style={{ borderRadius: 8, background: GOLD_BG, border: `1px solid ${GOLD_BORDER}`, color: GOLD }}>
            SEMUA
          </Tag>
        ),
    },
    {
      title: "",
      key: "actions",
      width: 56,
      render: (_: any, rec: any) => (
        <Button
          size="small"
          icon={<EditOutlined />}
          onClick={() => showEditModal(rec.id)}
          style={{ borderRadius: 8 }}
          type="text"
        />
      ),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ paddingBottom: 40 }}>

      {/* ── Category Summary Cards ─────────────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {(Object.entries(CATEGORY_CONFIG) as [CategoryId, typeof CATEGORY_CONFIG[CategoryId]][])
          .map(([key, cfg], i) => (
          <Col xs={8} key={key}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            >
              <Card
                bordered={false}
                style={{
                  borderRadius: 16,
                  border: `1px solid ${cfg.border}`,
                  background: cfg.bg,
                  overflow: "hidden",
                  position: "relative",
                }}
                styles={{ body: { padding: "18px 20px" } }}
              >
                <div
                  style={{
                    position: "absolute", top: -12, right: -12,
                    width: 64, height: 64,
                    background: `radial-gradient(circle, ${cfg.color}18, transparent 70%)`,
                    borderRadius: "50%", pointerEvents: "none",
                  }}
                />
                <Space>
                  <span style={{ fontSize: 28 }}>{cfg.icon}</span>
                  <Space direction="vertical" size={0}>
                    <Text
                      style={{
                        fontSize: 11, color: cfg.color,
                        textTransform: "uppercase", letterSpacing: 1,
                      }}
                    >
                      {cfg.label}
                    </Text>
                    <Space align="baseline" size={4}>
                      <Title level={3} style={{ margin: 0, color: cfg.color }}>
                        {categoryCounts[key] ?? 0}
                      </Title>
                      <Text style={{ fontSize: 12, color: cfg.color, opacity: 0.7 }}>tipe</Text>
                    </Space>
                  </Space>
                </Space>
              </Card>
            </motion.div>
          </Col>
        ))}
      </Row>

      {/* ── Main Table ────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.28 }}
      >
        <List
          title={
            <Space>
              <SettingOutlined style={{ color: GOLD }} />
              <span>Master Tipe Kegiatan</span>
              <Tag
                style={{
                  background: GOLD_BG, border: `1px solid ${GOLD_BORDER}`,
                  color: GOLD, borderRadius: 8, fontSize: 11,
                }}
              >
                Auto-Config
              </Tag>
            </Space>
          }
          headerButtons={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => showCreateModal()}
              style={{
                background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})`,
                border: "none", borderRadius: 8,
              }}
            >
              Tambah Tipe
            </Button>
          }
        >
          <Table {...tableProps} columns={columns} rowKey="id" style={{ borderRadius: 12 }} />
        </List>
      </motion.div>

      {/* ── Modal Create ──────────────────────────────────────────────────── */}
      <Modal
        {...createModalProps}
        okButtonProps={{
          ...createModalProps.okButtonProps,
          style: {
            background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})`,
            border: "none", borderRadius: 8,
          },
        }}
        cancelButtonProps={{
          ...createModalProps.cancelButtonProps,
          style: { borderRadius: 8 },
        }}
        title={
          <Space>
            <PlusOutlined style={{ color: GOLD }} />
            <Text strong>Tambah Tipe Kegiatan Baru</Text>
          </Space>
        }
        width={480}
      >
        <Divider style={{ margin: "12px 0 16px" }} />
        <Form {...createFormProps} layout="vertical">
          <AttendanceTypeFormFields />
        </Form>
      </Modal>

      {/* ── Modal Edit ───────────────────────────────────────────────────── */}
      <Modal
        {...editModalProps}
        okButtonProps={{
          ...editModalProps.okButtonProps,
          style: {
            background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DARK})`,
            border: "none", borderRadius: 8,
          },
        }}
        cancelButtonProps={{
          ...editModalProps.cancelButtonProps,
          style: { borderRadius: 8 },
        }}
        title={
          <Space>
            <EditOutlined style={{ color: GOLD }} />
            <Text strong>Edit Tipe Kegiatan</Text>
          </Space>
        }
        width={480}
      >
        <Divider style={{ margin: "12px 0 16px" }} />
        <Form {...editFormProps} layout="vertical">
          <AttendanceTypeFormFields />
        </Form>
      </Modal>
    </div>
  );
};
