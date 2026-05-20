import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Timeline,
  Typography,
  theme,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  FileSearchOutlined,
  RobotOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  ToolOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { useGetIdentity } from "@refinedev/core";
import dayjs from "dayjs";
import "dayjs/locale/id";
import { supabaseClient } from "../../utility/supabaseClient";
import { IUserIdentity } from "../../types";

dayjs.locale("id");

const { Text, Title, Paragraph } = Typography;
const { useToken } = theme;

type JsonMap = Record<string, any>;
type BackendStatus = "healthy" | "attention" | "degraded" | "critical" | string;
type AiAnalysisScope = "self_healing" | "diagnostics" | "private_audit" | "combined";

const severityColors: Record<string, string> = {
  info: "blue",
  low: "cyan",
  medium: "gold",
  high: "orange",
  critical: "red",
};

const statusColors: Record<string, string> = {
  healthy: "green",
  attention: "gold",
  degraded: "orange",
  critical: "red",
  open: "red",
  acknowledged: "gold",
  repairing: "blue",
  monitoring: "purple",
  escalated: "volcano",
  resolved: "green",
  queued: "gold",
  processing: "blue",
  synced: "green",
  manual_review: "orange",
  failed: "red",
  ignored: "default",
  success: "green",
  active: "green",
  inactive: "default",
};

const panelStyle: React.CSSProperties = {
  borderRadius: 8,
  height: "100%",
};

const compactCodeStyle: React.CSSProperties = {
  display: "block",
  maxWidth: 420,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const toRecord = (value: unknown): JsonMap => {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as JsonMap;
  return {};
};

const toArray = <T extends JsonMap = JsonMap>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  return [];
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("DD MMM YYYY HH:mm") : value;
};

const getText = (row: JsonMap, keys: string[], fallback = "-") => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && value !== "") return String(value);
  }
  return fallback;
};

const getNumber = (row: JsonMap, keys: string[], fallback = 0) => {
  for (const key of keys) {
    const value = Number(row?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return fallback;
};

const shortJson = (value: unknown, max = 220) => {
  if (value === undefined || value === null || value === "") return "-";
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  if (!raw) return "-";
  return raw.length > max ? `${raw.slice(0, max)}...` : raw;
};

const StatusTag = ({ value }: { value?: string | null }) => {
  const normalized = String(value || "-").toLowerCase();
  return <Tag color={statusColors[normalized] || "default"}>{normalized.replaceAll("_", " ")}</Tag>;
};

const SeverityTag = ({ value }: { value?: string | null }) => {
  const normalized = String(value || "info").toLowerCase();
  return <Tag color={severityColors[normalized] || "default"}>{normalized}</Tag>;
};

const JsonPreview = ({ value }: { value: unknown }) => (
  <Text code style={compactCodeStyle} title={shortJson(value, 4000)}>
    {shortJson(value)}
  </Text>
);

const cardTitle = (icon: React.ReactNode, text: string) => (
  <Space size={8}>
    {icon}
    <span>{text}</span>
  </Space>
);

const SuperAdminGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: identity, isLoading } = useGetIdentity<IUserIdentity>();

  if (isLoading) {
    return (
      <Card style={panelStyle}>
        <Space>
          <ReloadOutlined spin />
          <Text>Memeriksa akses...</Text>
        </Space>
      </Card>
    );
  }

  if (!identity || identity.role !== "super_admin") {
    return (
      <Card style={panelStyle}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Halaman ini hanya tersedia untuk super admin."
        />
      </Card>
    );
  }

  return <>{children}</>;
};

const SimpleTable = ({
  data,
  columns,
  rowKeyPrefix,
  size = "small",
}: {
  data: JsonMap[];
  columns: ColumnsType<JsonMap>;
  rowKeyPrefix: string;
  size?: "small" | "middle";
}) => (
  <Table<JsonMap>
    rowKey={(row, index) => String(row.id || row.alert_id || row.incident_id || `${rowKeyPrefix}-${index}`)}
    columns={columns}
    dataSource={data}
    size={size}
    pagination={data.length > 8 ? { pageSize: 8, showSizeChanger: false } : false}
    scroll={{ x: true }}
  />
);

const KeyValueGrid = ({ value }: { value: unknown }) => {
  const rows = Object.entries(toRecord(value));
  if (!rows.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Tidak ada data" />;
  return (
    <Row gutter={[12, 12]}>
      {rows.map(([key, item]) => (
        <Col xs={24} sm={12} lg={8} xl={6} key={key}>
          <Card size="small" style={panelStyle}>
            <Text type="secondary" style={{ display: "block", marginBottom: 4 }}>
              {key.replaceAll("_", " ")}
            </Text>
            <Text strong>{typeof item === "object" ? shortJson(item, 80) : String(item ?? "-")}</Text>
          </Card>
        </Col>
      ))}
    </Row>
  );
};

const Recommendations = ({ items }: { items: unknown }) => {
  const data = Array.isArray(items) ? items : Object.values(toRecord(items));
  if (!data.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Tidak ada rekomendasi" />;
  return (
    <Space direction="vertical" style={{ width: "100%" }} size={8}>
      {data.map((item, index) => {
        const row = toRecord(item);
        const text = typeof item === "string" ? item : getText(row, ["message", "recommendation", "recommended_action", "title"], shortJson(item, 160));
        return (
          <Alert
            key={`${text}-${index}`}
            type={getText(row, ["severity"], "info") === "critical" ? "error" : "info"}
            message={text}
            description={getText(row, ["details", "description"], "")}
            showIcon
          />
        );
      })}
    </Space>
  );
};

const useRpcLoader = <T,>(rpc: () => Promise<T>) => {
  const { message } = App.useApp();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await rpc();
      setData(result);
    } catch (err: any) {
      const msg = err?.message || "Gagal memuat data";
      setError(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [message, rpc]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, refresh: load, setData };
};

const useModalForm = () => {
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<JsonMap | null>(null);
  const [action, setAction] = useState<"assign" | "snooze" | "resolve" | null>(null);

  return { form, open, setOpen, target, setTarget, action, setAction };
};

const AiOperationsAnalyst = ({ scope }: { scope: AiAnalysisScope }) => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<JsonMap | null>(null);
  const [question, setQuestion] = useState("");

  const runAnalysis = async (hours: number) => {
    setLoading(true);
    try {
      const { data, error } = await supabaseClient.functions.invoke("backend-ops-ai-analyst", {
        body: {
          scope,
          hours,
          question: question.trim() || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAnalysis(toRecord(data?.data || data));
      message.success("Analisis AI selesai dibuat");
    } catch (err: any) {
      message.error(err?.message || "Analisis AI gagal dijalankan");
    } finally {
      setLoading(false);
    }
  };

  const renderList = (title: string, value: unknown, color?: string) => {
    const items = Array.isArray(value) ? value : [];
    if (!items.length) return null;
    return (
      <Col xs={24} lg={12}>
        <Card size="small" title={title} style={panelStyle}>
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            {items.map((item, index) => (
              <Alert
                key={`${title}-${index}-${String(item).slice(0, 20)}`}
                type={color === "red" ? "error" : color === "gold" ? "warning" : "info"}
                message={String(item)}
                showIcon
              />
            ))}
          </Space>
        </Card>
      </Col>
    );
  };

  return (
    <Card
      title={cardTitle(<RobotOutlined />, "AI Operations Analyst")}
      style={panelStyle}
      extra={
        <Space wrap>
          <Button loading={loading} onClick={() => runAnalysis(24)}>
            Analisa 24 jam
          </Button>
          <Button type="primary" loading={loading} onClick={() => runAnalysis(168)}>
            Analisa 7 hari
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" size={14} style={{ width: "100%" }}>
        <Input.Search
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onSearch={() => runAnalysis(24)}
          loading={loading}
          allowClear
          placeholder="Tanya konteks operasional tertentu"
        />

        {analysis ? (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Alert
              type={analysis.confidence === "high" ? "success" : analysis.confidence === "low" ? "warning" : "info"}
              showIcon
              message={analysis.executive_summary || "AI tidak memberi ringkasan."}
              description={
                <Space wrap>
                  <Tag color="blue">{analysis.scope || scope}</Tag>
                  <Tag>{analysis.window_hours || "-"} jam</Tag>
                  <Tag color={analysis.confidence === "high" ? "green" : analysis.confidence === "low" ? "gold" : "blue"}>
                    confidence: {analysis.confidence || "medium"}
                  </Tag>
                  <Tag>refresh: {analysis.next_refresh_minutes || 15} menit</Tag>
                </Space>
              }
            />
            <Row gutter={[12, 12]}>
              {renderList("Fakta Terbaca", analysis.facts)}
              {renderList("Temuan Kritis", analysis.critical_findings, "red")}
              {renderList("Saran Eksekusi", analysis.execution_recommendations)}
              {renderList("Perlu Review Manual", analysis.needs_human_review, "gold")}
              {renderList("Catatan Midtrans", analysis.midtrans_notes, "gold")}
              {renderList("Guardrail", analysis.guardrails, "red")}
            </Row>
            <Text type="secondary">
              {analysis.provider || "ai"} {analysis.model ? `- ${analysis.model}` : ""} - {formatDate(analysis.generated_at)}
            </Text>
          </Space>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada analisis AI" />
        )}
      </Space>
    </Card>
  );
};

const SelfHealingContent = () => {
  const { token } = useToken();
  const { message, modal } = App.useApp();
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineData, setTimelineData] = useState<JsonMap | null>(null);
  const [repairLoading, setRepairLoading] = useState(false);
  const [repairResult, setRepairResult] = useState<JsonMap | null>(null);
  const [aiContext, setAiContext] = useState<JsonMap | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const loadSelfHealingCenter = useCallback(async () => {
    const { data, error } = await supabaseClient.rpc("get_self_healing_center");
    if (error) throw error;
    return toRecord(data);
  }, []);
  const center = useRpcLoader<JsonMap>(loadSelfHealingCenter);

  const latestHealth = toRecord(center.data?.latest_health);
  const score = Math.max(0, Math.min(100, getNumber(latestHealth, ["health_score", "score"], 0)));
  const status = getText(latestHealth, ["status", "health_status"], "unknown") as BackendStatus;
  const breakdown = latestHealth.breakdown ?? center.data?.breakdown ?? latestHealth;
  const openIncidents = toArray(center.data?.open_incidents);
  const playbooks = toArray(center.data?.playbooks);
  const weeklyDigest = toRecord(center.data?.latest_weekly_digest);
  const recommendations = center.data?.recommendations ?? latestHealth.recommendations ?? weeklyDigest.recommendations;

  const openTimeline = async (incident: JsonMap) => {
    const incidentId = getText(incident, ["id", "incident_id"], "");
    if (!incidentId) return;
    setTimelineOpen(true);
    setTimelineLoading(true);
    setTimelineData(null);
    try {
      const { data, error } = await supabaseClient.rpc("get_incident_timeline", { p_incident_id: incidentId });
      if (error) throw error;
      setTimelineData(toRecord(data));
    } catch (err: any) {
      message.error(err?.message || "Gagal memuat timeline incident");
    } finally {
      setTimelineLoading(false);
    }
  };

  const runRepair = () => {
    modal.confirm({
      title: "Jalankan safe repair manual?",
      content: "Repair aman tidak mengubah status pembayaran, saldo, tagihan, atau transaksi uang dari UI ini.",
      okText: "Run Safe Repair",
      cancelText: "Batal",
      onOk: async () => {
        setRepairLoading(true);
        setRepairResult(null);
        try {
          const { data, error } = await supabaseClient.rpc("run_super_admin_safe_repair");
          if (error) throw error;
          setRepairResult(toRecord(data));
          message.success("Safe repair selesai dijalankan");
          await center.refresh();
        } catch (err: any) {
          message.error(err?.message || "Safe repair gagal");
          throw err;
        } finally {
          setRepairLoading(false);
        }
      },
    });
  };

  const loadAiContext = async (hours: number) => {
    setAiLoading(true);
    try {
      const { data, error } = await supabaseClient.rpc("get_ai_incident_context", { p_hours: hours });
      if (error) throw error;
      setAiContext(toRecord(data));
      message.success(`Konteks incident ${hours} jam dimuat`);
    } catch (err: any) {
      message.error(err?.message || "Gagal memuat konteks incident");
    } finally {
      setAiLoading(false);
    }
  };

  const incidentColumns: ColumnsType<JsonMap> = [
    { title: "Incident", dataIndex: "title", render: (_, row) => getText(row, ["title", "component", "dedupe_key", "id"]) },
    { title: "Severity", dataIndex: "severity", width: 110, render: (_, row) => <SeverityTag value={getText(row, ["severity"])} /> },
    { title: "Status", dataIndex: "status", width: 130, render: (_, row) => <StatusTag value={getText(row, ["status"])} /> },
    { title: "Dibuka", dataIndex: "opened_at", width: 170, render: (_, row) => formatDate(getText(row, ["opened_at", "created_at"], "")) },
    {
      title: "Aksi",
      width: 120,
      render: (_, row) => (
        <Button size="small" icon={<FileSearchOutlined />} onClick={() => openTimeline(row)}>
          Timeline
        </Button>
      ),
    },
  ];

  const playbookColumns: ColumnsType<JsonMap> = [
    { title: "Playbook", dataIndex: "name", render: (_, row) => getText(row, ["name", "title", "component"]) },
    { title: "Component", dataIndex: "component", width: 160 },
    { title: "Severity", dataIndex: "severity", width: 110, render: (_, row) => <SeverityTag value={getText(row, ["severity"])} /> },
    { title: "Auto Repair", dataIndex: "auto_repair_enabled", width: 120, render: (value) => (value ? <Tag color="green">enabled</Tag> : <Tag>disabled</Tag>) },
    { title: "Action", dataIndex: "repair_action", render: (_, row) => <JsonPreview value={row.repair_action || row.recommended_action || row.action} /> },
  ];

  const timeline = timelineData || {};
  const incidentDetail = toRecord(timeline.incident || timeline.detail || timeline);
  const events = toArray(timeline.events || timeline.timeline || timeline.incident_events);

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Row gutter={[16, 16]} align="stretch">
        <Col xs={24} lg={8}>
          <Card loading={center.loading} style={panelStyle}>
            <Space direction="vertical" style={{ width: "100%" }} size={12}>
              <Space align="center" style={{ justifyContent: "space-between", width: "100%" }}>
                <div>
                  <Text type="secondary">Backend Health Score</Text>
                  <Title level={2} style={{ margin: 0 }}>
                    {score}
                    <Text type="secondary" style={{ fontSize: 16 }}>/100</Text>
                  </Title>
                </div>
                <StatusTag value={status} />
              </Space>
              <Progress
                percent={score}
                status={status === "critical" ? "exception" : status === "healthy" ? "success" : "active"}
                strokeColor={status === "healthy" ? token.colorSuccess : status === "critical" ? token.colorError : token.colorWarning}
              />
              <Space wrap>
                <Button icon={<ReloadOutlined />} loading={center.loading} onClick={center.refresh}>
                  Refresh
                </Button>
                <Button type="primary" danger icon={<ToolOutlined />} loading={repairLoading} onClick={runRepair}>
                  Run Safe Repair
                </Button>
              </Space>
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={16}>
          <Card
            title={cardTitle(<DatabaseOutlined />, "Breakdown")}
            loading={center.loading}
            style={panelStyle}
            extra={center.error ? <Tag color="red">error</Tag> : null}
          >
            {center.error ? <Alert type="error" message={center.error} showIcon /> : <KeyValueGrid value={breakdown} />}
          </Card>
        </Col>
      </Row>

      {repairResult ? (
        <Alert
          type="success"
          showIcon
          message="Safe repair manual selesai"
          description={<JsonPreview value={repairResult} />}
        />
      ) : null}

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card title={cardTitle(<WarningOutlined />, "Open Incidents")} style={panelStyle}>
            <SimpleTable data={openIncidents} columns={incidentColumns} rowKeyPrefix="incident" />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title={cardTitle(<CheckCircleOutlined />, "Recommendations")} style={panelStyle}>
            <Recommendations items={recommendations} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card title={cardTitle(<SafetyCertificateOutlined />, "Playbooks")} style={panelStyle}>
            <SimpleTable data={playbooks} columns={playbookColumns} rowKeyPrefix="playbook" />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title={cardTitle(<ClockCircleOutlined />, "Latest Weekly Digest")} style={panelStyle}>
            {Object.keys(weeklyDigest).length ? (
              <Descriptions size="small" column={1} bordered>
                {Object.entries(weeklyDigest).slice(0, 10).map(([key, value]) => (
                  <Descriptions.Item key={key} label={key.replaceAll("_", " ")}>
                    {typeof value === "object" ? <JsonPreview value={value} /> : String(value ?? "-")}
                  </Descriptions.Item>
                ))}
              </Descriptions>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada digest" />
            )}
          </Card>
        </Col>
      </Row>

      <Card
        title={cardTitle(<FileSearchOutlined />, "AI Incident Context")}
        extra={
          <Space wrap>
            <Button loading={aiLoading} onClick={() => loadAiContext(24)}>
              Analisa 24 jam
            </Button>
            <Button loading={aiLoading} onClick={() => loadAiContext(168)}>
              Analisa 7 hari
            </Button>
          </Space>
        }
      >
        {aiContext ? <JsonPreview value={aiContext} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada konteks" />}
      </Card>

      <AiOperationsAnalyst scope="self_healing" />

      <Modal
        open={timelineOpen}
        title="Incident Timeline"
        onCancel={() => setTimelineOpen(false)}
        footer={<Button onClick={() => setTimelineOpen(false)}>Tutup</Button>}
        width={920}
      >
        {timelineLoading ? (
          <Space>
            <ReloadOutlined spin />
            <Text>Memuat timeline...</Text>
          </Space>
        ) : (
          <Space direction="vertical" style={{ width: "100%" }} size={16}>
            <Descriptions size="small" bordered column={{ xs: 1, md: 2 }}>
              <Descriptions.Item label="Incident">{getText(incidentDetail, ["title", "component", "id"])}</Descriptions.Item>
              <Descriptions.Item label="Status"><StatusTag value={getText(incidentDetail, ["status"])} /></Descriptions.Item>
              <Descriptions.Item label="Severity"><SeverityTag value={getText(incidentDetail, ["severity"])} /></Descriptions.Item>
              <Descriptions.Item label="Dibuka">{formatDate(getText(incidentDetail, ["opened_at", "created_at"], ""))}</Descriptions.Item>
              <Descriptions.Item label="Data" span={2}><JsonPreview value={incidentDetail.data || incidentDetail.details || incidentDetail.metadata} /></Descriptions.Item>
            </Descriptions>
            {events.length ? (
              <Timeline
                items={events.map((event) => ({
                  color: getText(event, ["event_type"], "")?.includes("failed") ? "red" : "blue",
                  children: (
                    <Space direction="vertical" size={4} style={{ width: "100%" }}>
                      <Space wrap>
                        <Tag color="blue">{getText(event, ["event_type", "type"])}</Tag>
                        <Text type="secondary">{formatDate(getText(event, ["created_at", "event_at", "time"], ""))}</Text>
                      </Space>
                      <Text>{getText(event, ["message", "description"], "-")}</Text>
                      <JsonPreview value={event.data || event.details || event.metadata} />
                    </Space>
                  ),
                }))}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Timeline kosong" />
            )}
          </Space>
        )}
      </Modal>
    </Space>
  );
};

const DiagnosticsContent = () => {
  const loadDiagnostics = useCallback(async () => {
    const { data, error } = await supabaseClient.rpc("get_backend_diagnostics");
    if (error) throw error;
    return toRecord(data);
  }, []);
  const diagnostics = useRpcLoader<JsonMap>(loadDiagnostics);

  const data = diagnostics.data || {};
  const cron = toRecord(data.cron);
  const notifications = toRecord(data.notifications);
  const payments = toRecord(data.payments);
  const alerts = toRecord(data.alerts);
  const pgNet = toRecord(data.pg_net);

  const countCards = [
    ["Active Cron Jobs", toArray(cron.active_jobs).length, "active"],
    ["Failed Runs 24h", toArray(cron.failed_runs_24h).length, "failed"],
    ["Stale Midtrans", toArray(payments.stale_pending_midtrans).length, "critical"],
    ["Pg Net Failures", toArray(pgNet.failures_6h).length, "failed"],
  ];

  const genericColumns: ColumnsType<JsonMap> = [
    { title: "Nama", render: (_, row) => getText(row, ["jobname", "name", "component", "status", "id"]) },
    { title: "Status", width: 130, render: (_, row) => <StatusTag value={getText(row, ["status", "severity"], "")} /> },
    { title: "Waktu", width: 170, render: (_, row) => formatDate(getText(row, ["created_at", "started_at", "finished_at", "run_at"], "")) },
    { title: "Data", render: (_, row) => <JsonPreview value={row} /> },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Space style={{ width: "100%", justifyContent: "space-between" }} wrap>
        <Title level={3} style={{ margin: 0 }}>Backend Diagnostics</Title>
        <Button icon={<ReloadOutlined />} loading={diagnostics.loading} onClick={diagnostics.refresh}>
          Refresh
        </Button>
      </Space>

      {diagnostics.error ? <Alert type="error" message={diagnostics.error} showIcon /> : null}

      <Row gutter={[16, 16]}>
        {countCards.map(([label, value, status]) => (
          <Col xs={12} lg={6} key={label}>
            <Card style={panelStyle}>
              <Statistic title={label} value={Number(value)} valueStyle={{ color: status === "critical" || status === "failed" ? "#cf1322" : undefined }} />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card title="Cron Active Jobs" loading={diagnostics.loading} style={panelStyle}>
            <SimpleTable data={toArray(cron.active_jobs)} columns={genericColumns} rowKeyPrefix="cron-active" />
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="Failed Runs 24h" loading={diagnostics.loading} style={panelStyle}>
            <SimpleTable data={toArray(cron.failed_runs_24h)} columns={genericColumns} rowKeyPrefix="cron-failed" />
          </Card>
        </Col>
        <Col xs={24}>
          <Card title="Latest Cron Runs" loading={diagnostics.loading} style={panelStyle}>
            <SimpleTable data={toArray(cron.latest_runs)} columns={genericColumns} rowKeyPrefix="cron-latest" />
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="Notification Queue By Status" loading={diagnostics.loading} style={panelStyle}>
            <KeyValueGrid value={notifications.queue_by_status} />
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="Token Health" loading={diagnostics.loading} style={panelStyle}>
            <KeyValueGrid value={notifications.token_health} />
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="Midtrans Queue By Status" loading={diagnostics.loading} style={panelStyle}>
            <KeyValueGrid value={payments.midtrans_queue_by_status} />
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="Open Alerts By Severity" loading={diagnostics.loading} style={panelStyle}>
            <KeyValueGrid value={alerts.open_by_severity} />
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="Stale Pending Midtrans" loading={diagnostics.loading} style={panelStyle}>
            <SimpleTable data={toArray(payments.stale_pending_midtrans)} columns={genericColumns} rowKeyPrefix="midtrans-stale" />
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="Pg Net Failures" loading={diagnostics.loading} style={panelStyle}>
            <SimpleTable data={toArray(pgNet.failures_6h)} columns={genericColumns} rowKeyPrefix="pgnet-failed" />
          </Card>
        </Col>
      </Row>

      <AiOperationsAnalyst scope="diagnostics" />
    </Space>
  );
};

const PrivateAuditContent = () => {
  const { message, modal } = App.useApp();
  const actionModal = useModalForm();
  const [filters, setFilters] = useState({
    component: undefined as string | undefined,
    severity: undefined as string | undefined,
    status: undefined as string | undefined,
    tableName: undefined as string | undefined,
    search: "",
  });
  const [page, setPage] = useState({ limit: 25, offset: 0 });
  const [auditData, setAuditData] = useState<JsonMap>({});
  const [loading, setLoading] = useState(false);
  const [aiContext, setAiContext] = useState<JsonMap | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const loadAudit = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseClient.rpc("get_private_audit_log_page", {
        p_component: filters.component || null,
        p_severity: filters.severity || null,
        p_status: filters.status || null,
        p_table_name: filters.tableName || null,
        p_search: filters.search?.trim() || null,
        p_limit: page.limit,
        p_offset: page.offset,
      });
      if (error) throw error;
      setAuditData(toRecord(data));
    } catch (err: any) {
      message.error(err?.message || "Gagal memuat private audit log");
    } finally {
      setLoading(false);
    }
  }, [filters, message, page.limit, page.offset]);

  useEffect(() => {
    void loadAudit();
  }, [loadAudit]);

  const alerts = toArray(auditData.alerts);
  const financeEvents = toArray(auditData.finance_audit_events);
  const pagination = toRecord(auditData.pagination);

  const runAlertAction = async (action: "acknowledge" | "assign" | "snooze" | "resolve", alertRow: JsonMap, values: JsonMap = {}) => {
    const alertId = getText(alertRow, ["id", "alert_id"], "");
    if (!alertId) return;
    await supabaseClient.rpc("update_backend_alert_action", {
      p_alert_id: alertId,
      p_action: action,
      p_assigned_to: values.assigned_to || null,
      p_snoozed_until: values.snoozed_until || null,
      p_note: values.note || null,
    }).then(({ error }) => {
      if (error) throw error;
    });
  };

  const confirmQuickAction = (action: "acknowledge" | "resolve", row: JsonMap) => {
    modal.confirm({
      title: action === "acknowledge" ? "Acknowledge alert?" : "Resolve alert?",
      content: getText(row, ["title", "message", "dedupe_key"], "Backend alert"),
      okText: action === "acknowledge" ? "Acknowledge" : "Resolve",
      cancelText: "Batal",
      onOk: async () => {
        try {
          await runAlertAction(action, row);
          message.success("Action berhasil disimpan");
          await loadAudit();
        } catch (err: any) {
          message.error(err?.message || "Action gagal");
          throw err;
        }
      },
    });
  };

  const openFormAction = (action: "assign" | "snooze" | "resolve", row: JsonMap) => {
    actionModal.setAction(action);
    actionModal.setTarget(row);
    actionModal.form.resetFields();
    actionModal.setOpen(true);
  };

  const submitFormAction = async () => {
    const values = await actionModal.form.validateFields();
    const row = actionModal.target;
    const action = actionModal.action;
    if (!row || !action) return;

    modal.confirm({
      title: `${action.replaceAll("_", " ")} alert?`,
      content: getText(row, ["title", "message", "dedupe_key"], "Backend alert"),
      okText: "Konfirmasi",
      cancelText: "Batal",
      onOk: async () => {
        try {
          await runAlertAction(action, row, values);
          message.success("Action berhasil disimpan");
          actionModal.setOpen(false);
          await loadAudit();
        } catch (err: any) {
          message.error(err?.message || "Action gagal");
          throw err;
        }
      },
    });
  };

  const loadPrivateAiContext = async (hours: number) => {
    setAiLoading(true);
    try {
      const { data, error } = await supabaseClient.rpc("get_private_audit_ai_context", { p_hours: hours });
      if (error) throw error;
      setAiContext(toRecord(data));
      message.success(`AI context ${hours} jam dimuat`);
    } catch (err: any) {
      message.error(err?.message || "Gagal memuat AI context");
    } finally {
      setAiLoading(false);
    }
  };

  const alertColumns: ColumnsType<JsonMap> = [
    { title: "Alert", render: (_, row) => getText(row, ["title", "message", "dedupe_key", "component"]) },
    { title: "Component", dataIndex: "component", width: 150 },
    { title: "Severity", width: 110, render: (_, row) => <SeverityTag value={getText(row, ["severity"])} /> },
    { title: "Status", width: 130, render: (_, row) => <StatusTag value={getText(row, ["status"])} /> },
    { title: "Waktu", width: 170, render: (_, row) => formatDate(getText(row, ["created_at", "last_seen_at"], "")) },
    { title: "Rekomendasi", render: (_, row) => <JsonPreview value={row.recommended_action || row.data || row.details} /> },
    {
      title: "Action Center",
      width: 260,
      fixed: "right",
      render: (_, row) => (
        <Space wrap size={4}>
          <Button size="small" onClick={() => confirmQuickAction("acknowledge", row)}>
            Acknowledge
          </Button>
          <Button size="small" onClick={() => openFormAction("assign", row)}>
            Assign
          </Button>
          <Button size="small" onClick={() => openFormAction("snooze", row)}>
            Snooze
          </Button>
          <Button size="small" type="primary" onClick={() => openFormAction("resolve", row)}>
            Resolve
          </Button>
        </Space>
      ),
    },
  ];

  const financeColumns: ColumnsType<JsonMap> = [
    { title: "Waktu", width: 170, render: (_, row) => formatDate(getText(row, ["created_at", "event_at"], "")) },
    { title: "Table", width: 170, render: (_, row) => getText(row, ["table_name", "source_table"]) },
    { title: "Action", width: 120, render: (_, row) => <Tag>{getText(row, ["action", "operation", "event_type"])}</Tag> },
    { title: "Actor", width: 180, render: (_, row) => getText(row, ["actor_email", "actor_id", "changed_by"]) },
    { title: "Record", render: (_, row) => <JsonPreview value={row.record_id || row.row_id || row.primary_key || row} /> },
    { title: "Changes", render: (_, row) => <JsonPreview value={row.changes || row.diff || row.new_data || row.data} /> },
  ];

  const resetFilters = () => {
    setFilters({ component: undefined, severity: undefined, status: undefined, tableName: undefined, search: "" });
    setPage((current) => ({ ...current, offset: 0 }));
  };

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Card style={panelStyle}>
        <Row gutter={[12, 12]} align="bottom">
          <Col xs={24} md={6} lg={4}>
            <Text type="secondary">Component</Text>
            <Input value={filters.component} onChange={(e) => setFilters((f) => ({ ...f, component: e.target.value || undefined }))} allowClear />
          </Col>
          <Col xs={24} md={6} lg={4}>
            <Text type="secondary">Severity</Text>
            <Select
              style={{ width: "100%" }}
              allowClear
              value={filters.severity}
              onChange={(value) => setFilters((f) => ({ ...f, severity: value }))}
              options={["info", "medium", "high", "critical"].map((value) => ({ value, label: value }))}
            />
          </Col>
          <Col xs={24} md={6} lg={4}>
            <Text type="secondary">Status</Text>
            <Select
              style={{ width: "100%" }}
              allowClear
              value={filters.status}
              onChange={(value) => setFilters((f) => ({ ...f, status: value }))}
              options={["open", "acknowledged", "resolved"].map((value) => ({ value, label: value }))}
            />
          </Col>
          <Col xs={24} md={6} lg={4}>
            <Text type="secondary">Table Name</Text>
            <Input value={filters.tableName} onChange={(e) => setFilters((f) => ({ ...f, tableName: e.target.value || undefined }))} allowClear />
          </Col>
          <Col xs={24} lg={5}>
            <Text type="secondary">Search</Text>
            <Input.Search
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              onSearch={() => setPage((current) => ({ ...current, offset: 0 }))}
              allowClear
            />
          </Col>
          <Col xs={24} lg={3}>
            <Space>
              <Button icon={<ReloadOutlined />} loading={loading} onClick={loadAudit}>
                Refresh
              </Button>
              <Button onClick={resetFilters}>Reset</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card style={panelStyle}>
            <Statistic title="Backend Alerts" value={Number(pagination.total_alerts || alerts.length)} prefix={<WarningOutlined />} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card style={panelStyle}>
            <Statistic title="Finance Audit Events" value={Number(pagination.total_finance_audit_events || financeEvents.length)} prefix={<DatabaseOutlined />} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card style={panelStyle}>
            <Statistic title="Page Offset" value={page.offset} prefix={<FileSearchOutlined />} />
          </Card>
        </Col>
      </Row>

      <Tabs
        items={[
          {
            key: "alerts",
            label: "Backend Alerts",
            children: (
              <Card style={panelStyle}>
                <Table<JsonMap>
                  rowKey={(row, index) => String(row.id || row.alert_id || `alert-${index}`)}
                  columns={alertColumns}
                  dataSource={alerts}
                  loading={loading}
                  size="small"
                  pagination={false}
                  scroll={{ x: 1280 }}
                />
              </Card>
            ),
          },
          {
            key: "finance",
            label: "Finance Audit Events",
            children: (
              <Card style={panelStyle}>
                <Table<JsonMap>
                  rowKey={(row, index) => String(row.id || `finance-${index}`)}
                  columns={financeColumns}
                  dataSource={financeEvents}
                  loading={loading}
                  size="small"
                  pagination={false}
                  scroll={{ x: 1100 }}
                />
              </Card>
            ),
          },
          {
            key: "ai",
            label: "AI Context",
            children: (
              <Card
                title="Private Audit AI Context"
                extra={
                  <Space wrap>
                    <Button loading={aiLoading} onClick={() => loadPrivateAiContext(24)}>
                      Analisa 24 jam
                    </Button>
                    <Button loading={aiLoading} onClick={() => loadPrivateAiContext(168)}>
                      Analisa 7 hari
                    </Button>
                  </Space>
                }
              >
                {aiContext ? (
                  <Paragraph>
                    <JsonPreview value={aiContext} />
                  </Paragraph>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada context" />
                )}
              </Card>
            ),
          },
        ]}
      />

      <AiOperationsAnalyst scope="private_audit" />

      <Space style={{ justifyContent: "flex-end", width: "100%" }}>
        <Button
          disabled={page.offset <= 0 || loading}
          onClick={() => setPage((current) => ({ ...current, offset: Math.max(0, current.offset - current.limit) }))}
        >
          Sebelumnya
        </Button>
        <Button
          disabled={loading || alerts.length + financeEvents.length < page.limit}
          onClick={() => setPage((current) => ({ ...current, offset: current.offset + current.limit }))}
        >
          Berikutnya
        </Button>
      </Space>

      <Modal
        open={actionModal.open}
        title={`${actionModal.action || "Action"} backend alert`}
        onCancel={() => actionModal.setOpen(false)}
        onOk={submitFormAction}
        okText="Lanjutkan"
        cancelText="Batal"
        destroyOnClose
      >
        <Form form={actionModal.form} layout="vertical">
          {actionModal.action === "assign" ? (
            <Form.Item name="assigned_to" label="Assigned To (UUID)" rules={[{ required: true, message: "UUID assignee wajib diisi." }]}>
              <Input placeholder="user uuid" />
            </Form.Item>
          ) : null}
          {actionModal.action === "snooze" ? (
            <Form.Item name="snoozed_until" label="Snoozed Until" rules={[{ required: true, message: "Waktu snooze wajib diisi." }]}>
              <Input placeholder="2026-05-20T17:00:00+07:00" />
            </Form.Item>
          ) : null}
          <Form.Item name="note" label="Note">
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

const PageShell = ({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) => (
  <SuperAdminGate>
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div>
        <Title level={2} style={{ marginBottom: 4 }}>
          {title}
        </Title>
        <Text type="secondary">{subtitle}</Text>
      </div>
      {children}
    </Space>
  </SuperAdminGate>
);

export const SelfHealingCenterPage = () => (
  <PageShell title="Self-Healing Center" subtitle="Health score, incident, playbook, digest, dan repair aman manual.">
    <SelfHealingContent />
  </PageShell>
);

export const BackendDiagnosticsPage = () => (
  <PageShell title="Backend Diagnostics" subtitle="Cron, notification, token, Midtrans queue, alert, dan pg_net failures.">
    <DiagnosticsContent />
  </PageShell>
);

export const PrivateAuditLogPage = () => (
  <PageShell title="Private Audit Log" subtitle="Audit operasional dan action center backend alerts.">
    <PrivateAuditContent />
  </PageShell>
);
