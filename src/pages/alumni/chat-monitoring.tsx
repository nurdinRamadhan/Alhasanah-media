import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  List,
  Row,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
  theme,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  AuditOutlined,
  BlockOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  MessageOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { supabaseClient } from "../../utility/supabaseClient";
import { GOLD, GOLD_BRIGHT, GOLD_DEEP } from "../../utility/themeConfig";

const { Text, Title } = Typography;
const { useToken } = theme;

type ProfileRef = {
  id?: string;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
};

type ChatParticipant = {
  user_id: string;
  role: string;
  joined_at: string;
  archived_at?: string | null;
  muted_until?: string | null;
  profile?: ProfileRef;
};

type ChatConversation = {
  id: string;
  type: "direct" | "group";
  title?: string | null;
  created_at: string;
  updated_at: string;
  last_message_at?: string | null;
  last_message_preview?: string | null;
  created_by?: ProfileRef;
  last_sender?: ProfileRef;
  participant_count: number;
  message_count: number;
  open_report_count: number;
  participants: ChatParticipant[];
};

type ChatMessage = {
  id: string;
  conversation_id: string;
  sender?: ProfileRef;
  message_type: string;
  status: string;
  content_preview?: string | null;
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
};

type ChatReport = {
  id: string;
  status: "open" | "reviewing" | "resolved" | "rejected";
  reason: string;
  note?: string | null;
  created_at: string;
  reviewed_at?: string | null;
  conversation_id: string;
  reporter?: ProfileRef;
  reviewed_by?: ProfileRef;
  message?: ChatMessage;
};

type PresenceRow = {
  user_id: string;
  is_online: boolean;
  last_seen_at: string;
  updated_at: string;
  profile?: ProfileRef;
};

type BlockRow = {
  blocker?: ProfileRef;
  blocked?: ProfileRef;
  created_at: string;
};

type ChatMonitorPayload = {
  stats: {
    conversations: number;
    messages: number;
    open_reports: number;
    online_users: number;
    blocked_pairs: number;
  };
  conversations: ChatConversation[];
  recent_messages: ChatMessage[];
  reports: ChatReport[];
  presence: PresenceRow[];
  blocks: BlockRow[];
};

const emptyPayload: ChatMonitorPayload = {
  stats: {
    conversations: 0,
    messages: 0,
    open_reports: 0,
    online_users: 0,
    blocked_pairs: 0,
  },
  conversations: [],
  recent_messages: [],
  reports: [],
  presence: [],
  blocks: [],
};

const displayName = (profile?: ProfileRef | null) =>
  profile?.full_name || profile?.email || "Tidak diketahui";

const timeAgo = (value?: string | null) => value ? dayjs(value).format("DD MMM YYYY HH:mm") : "-";

const statusColor: Record<string, string> = {
  sent: "processing",
  edited: "warning",
  deleted: "default",
  open: "error",
  reviewing: "warning",
  resolved: "success",
  rejected: "default",
};

export const AlumniChatMonitoringList: React.FC = () => {
  const { token } = useToken();
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<ChatMonitorPayload>(emptyPayload);
  const [selectedConversation, setSelectedConversation] = useState<ChatConversation | null>(null);

  const isDark = useMemo(() => {
    const c = token.colorBgContainer.replace("#", "");
    if (c.length < 6) return false;
    const lum = 0.299 * parseInt(c.slice(0, 2), 16)
      + 0.587 * parseInt(c.slice(2, 4), 16)
      + 0.114 * parseInt(c.slice(4, 6), 16);
    return lum < 128;
  }, [token.colorBgContainer]);

  const cardStyle: React.CSSProperties = {
    borderRadius: 12,
    border: `1px solid ${isDark ? "rgba(201,168,76,0.14)" : "rgba(201,168,76,0.18)"}`,
    boxShadow: isDark ? "0 8px 26px rgba(0,0,0,0.34)" : "0 6px 20px rgba(15,23,42,0.06)",
  };

  const loadMonitor = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseClient.rpc("get_chat_admin_monitor", { p_limit: 80 });
      if (error) throw error;
      setPayload({
        ...emptyPayload,
        ...(data || {}),
        stats: { ...emptyPayload.stats, ...(data?.stats || {}) },
      });
    } catch (error: any) {
      message.error(error.message || "Gagal memuat monitoring chat alumni.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMonitor();
  }, [loadMonitor]);

  const conversationColumns: ColumnsType<ChatConversation> = [
    {
      title: "Percakapan",
      dataIndex: "title",
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Space>
            <Tag color={record.type === "group" ? "purple" : "blue"}>{record.type}</Tag>
            <Text strong>{record.title || `Chat ${record.id.slice(0, 8)}`}</Text>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Dibuat oleh {displayName(record.created_by)}
          </Text>
        </Space>
      ),
    },
    {
      title: "Peserta",
      dataIndex: "participant_count",
      width: 100,
      align: "center",
      render: (value) => <Badge count={value} color={GOLD_BRIGHT} />,
    },
    {
      title: "Pesan",
      dataIndex: "message_count",
      width: 100,
      align: "center",
    },
    {
      title: "Laporan",
      dataIndex: "open_report_count",
      width: 110,
      align: "center",
      render: (value) => <Tag color={value > 0 ? "error" : "success"}>{value} open</Tag>,
    },
    {
      title: "Terakhir",
      dataIndex: "last_message_at",
      width: 180,
      render: (value, record) => (
        <Space direction="vertical" size={2}>
          <Text>{timeAgo(value)}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {displayName(record.last_sender)}
          </Text>
        </Space>
      ),
    },
    {
      title: "Aksi",
      width: 90,
      align: "center",
      render: (_, record) => (
        <Tooltip title="Lihat peserta dan metadata">
          <Button icon={<EyeOutlined />} onClick={() => setSelectedConversation(record)} />
        </Tooltip>
      ),
    },
  ];

  const messageColumns: ColumnsType<ChatMessage> = [
    {
      title: "Pengirim",
      dataIndex: "sender",
      width: 220,
      render: (profile) => (
        <Space>
          <Avatar icon={<UserOutlined />} />
          <Space direction="vertical" size={0}>
            <Text strong>{displayName(profile)}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>{profile?.email || "-"}</Text>
          </Space>
        </Space>
      ),
    },
    {
      title: "Preview Monitoring",
      dataIndex: "content_preview",
      render: (value, record) => (
        <Space direction="vertical" size={4}>
          <Text>{value || "(tanpa preview)"}</Text>
          <Space>
            <Tag color={statusColor[record.status] || "default"}>{record.status}</Tag>
            <Tag>{record.message_type}</Tag>
          </Space>
        </Space>
      ),
    },
    {
      title: "Waktu",
      dataIndex: "created_at",
      width: 180,
      render: timeAgo,
    },
  ];

  const reportColumns: ColumnsType<ChatReport> = [
    {
      title: "Laporan",
      render: (_, record) => (
        <Space direction="vertical" size={3}>
          <Space>
            <Tag color={statusColor[record.status] || "default"}>{record.status}</Tag>
            <Tag color="volcano">{record.reason}</Tag>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Pelapor: {displayName(record.reporter)} · {timeAgo(record.created_at)}
          </Text>
        </Space>
      ),
    },
    {
      title: "Pesan Dilaporkan",
      render: (_, record) => (
        <Space direction="vertical" size={3}>
          <Text>{record.message?.content_preview || "(tanpa preview)"}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Pengirim: {displayName(record.message?.sender)}
          </Text>
        </Space>
      ),
    },
    {
      title: "Catatan",
      dataIndex: "note",
      width: 220,
      render: (value) => value || "-",
    },
  ];

  return (
    <Space direction="vertical" size={18} style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <Text style={{ color: GOLD_DEEP, fontWeight: 800, letterSpacing: 1.4, fontSize: 11 }}>
            MONITORING KOMUNITAS ALUMNI
          </Text>
          <Title level={3} style={{ margin: "4px 0 0" }}>
            Chat Alumni
          </Title>
          <Text type="secondary">
            Panel ini hanya untuk pemantauan metadata, laporan, dan aktivitas percakapan. Fitur kirim pesan admin tidak disediakan.
          </Text>
        </div>
        <Button type="primary" icon={<ReloadOutlined spin={loading} />} onClick={loadMonitor} loading={loading}>
          Muat Ulang
        </Button>
      </div>

      <Alert
        type="info"
        showIcon
        message="Siap untuk transisi E2EE"
        description="Monitoring tidak bergantung pada kemampuan admin membaca seluruh isi chat. Jika nanti pesan menjadi ciphertext, panel ini tetap berguna untuk melihat percakapan, peserta, laporan, presence, dan blokir."
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} xl={5}>
          <Card style={cardStyle}>
            <Statistic title="Percakapan" value={payload.stats.conversations} prefix={<MessageOutlined />} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={5}>
          <Card style={cardStyle}>
            <Statistic title="Pesan Aktif" value={payload.stats.messages} prefix={<AuditOutlined />} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={5}>
          <Card style={cardStyle}>
            <Statistic title="Laporan Open" value={payload.stats.open_reports} prefix={<WarningOutlined />} valueStyle={{ color: payload.stats.open_reports > 0 ? "#dc2626" : "#16a34a" }} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={5}>
          <Card style={cardStyle}>
            <Statistic title="User Online" value={payload.stats.online_users} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={4}>
          <Card style={cardStyle}>
            <Statistic title="Blokir" value={payload.stats.blocked_pairs} prefix={<BlockOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card style={cardStyle}>
        {loading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : (
          <Tabs
            items={[
              {
                key: "conversations",
                label: "Percakapan",
                children: (
                  <Table
                    rowKey="id"
                    columns={conversationColumns}
                    dataSource={payload.conversations}
                    pagination={{ pageSize: 10 }}
                    locale={{ emptyText: <Empty description="Belum ada percakapan chat" /> }}
                  />
                ),
              },
              {
                key: "reports",
                label: (
                  <Space>
                    Laporan
                    {payload.stats.open_reports > 0 && <Badge count={payload.stats.open_reports} />}
                  </Space>
                ),
                children: (
                  <Table
                    rowKey="id"
                    columns={reportColumns}
                    dataSource={payload.reports}
                    pagination={{ pageSize: 10 }}
                    locale={{ emptyText: <Empty description="Belum ada laporan chat" /> }}
                  />
                ),
              },
              {
                key: "messages",
                label: "Aktivitas Terbaru",
                children: (
                  <Table
                    rowKey="id"
                    columns={messageColumns}
                    dataSource={payload.recent_messages}
                    pagination={{ pageSize: 10 }}
                    locale={{ emptyText: <Empty description="Belum ada aktivitas chat" /> }}
                  />
                ),
              },
              {
                key: "presence",
                label: "Presence",
                children: (
                  <List
                    dataSource={payload.presence}
                    locale={{ emptyText: <Empty description="Belum ada presence user" /> }}
                    renderItem={(item) => (
                      <List.Item>
                        <List.Item.Meta
                          avatar={<Badge dot color={item.is_online ? "#16a34a" : "#94a3b8"}><Avatar icon={<UserOutlined />} /></Badge>}
                          title={<Text strong>{displayName(item.profile)}</Text>}
                          description={`${item.profile?.email || "-"} · terakhir ${timeAgo(item.last_seen_at)}`}
                        />
                        <Tag color={item.is_online ? "success" : "default"}>{item.is_online ? "online" : "offline"}</Tag>
                      </List.Item>
                    )}
                  />
                ),
              },
              {
                key: "blocks",
                label: "Blokir",
                children: (
                  <List
                    dataSource={payload.blocks}
                    locale={{ emptyText: <Empty description="Belum ada relasi blokir" /> }}
                    renderItem={(item) => (
                      <List.Item>
                        <List.Item.Meta
                          avatar={<Avatar icon={<SafetyCertificateOutlined />} style={{ background: GOLD }} />}
                          title={`${displayName(item.blocker)} memblokir ${displayName(item.blocked)}`}
                          description={timeAgo(item.created_at)}
                        />
                      </List.Item>
                    )}
                  />
                ),
              },
            ]}
          />
        )}
      </Card>

      <Drawer
        width={620}
        open={!!selectedConversation}
        title="Detail Percakapan"
        onClose={() => setSelectedConversation(null)}
      >
        {selectedConversation && (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="ID">{selectedConversation.id}</Descriptions.Item>
              <Descriptions.Item label="Tipe">{selectedConversation.type}</Descriptions.Item>
              <Descriptions.Item label="Judul">{selectedConversation.title || "-"}</Descriptions.Item>
              <Descriptions.Item label="Dibuat">{timeAgo(selectedConversation.created_at)}</Descriptions.Item>
              <Descriptions.Item label="Terakhir">{timeAgo(selectedConversation.last_message_at)}</Descriptions.Item>
              <Descriptions.Item label="Jumlah Pesan">{selectedConversation.message_count}</Descriptions.Item>
              <Descriptions.Item label="Laporan Open">{selectedConversation.open_report_count}</Descriptions.Item>
            </Descriptions>

            <Title level={5}>Peserta</Title>
            <List
              dataSource={selectedConversation.participants || []}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar icon={<TeamOutlined />} />}
                    title={
                      <Space>
                        <Text strong>{displayName(item.profile)}</Text>
                        <Tag>{item.role}</Tag>
                        {item.archived_at && <Tag color="default">archived</Tag>}
                      </Space>
                    }
                    description={`${item.profile?.email || "-"} · bergabung ${timeAgo(item.joined_at)}`}
                  />
                </List.Item>
              )}
            />
          </Space>
        )}
      </Drawer>
    </Space>
  );
};
