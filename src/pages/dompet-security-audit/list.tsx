import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  List,
  Modal,
  Progress,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  ApiOutlined,
  EyeOutlined,
  FileExcelOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  ExclamationCircleOutlined,
  LockOutlined,
  BulbOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import type { ColumnsType } from "antd/es/table";
import { supabaseClient } from "../../utility/supabaseClient";

const { Text, Title, Paragraph } = Typography;

type AuditStatus = "running" | "success" | "warning" | "critical" | "failed";
type AuditSeverity = "unknown" | "aman" | "perlu_perhatian" | "berisiko" | "kritis";

interface SecurityCheck {
  layer: string;
  name: string;
  status: "ok" | "warning" | "critical" | "manual_review" | "review";
  label: string;
  details?: Record<string, unknown>;
}

interface SecurityAuditRun {
  id: string;
  started_at: string;
  finished_at?: string | null;
  status: AuditStatus;
  score: number;
  severity: AuditSeverity;
  triggered_by_role?: string | null;
  layer_summary?: Record<string, { status?: string; label?: string }> | null;
  checks?: SecurityCheck[] | null;
  findings?: string[] | null;
  recommendations?: string[] | null;
  ai_summary?: string | null;
}

interface SecurityAiAnalysis {
  id: string;
  audit_run_id: string;
  created_at: string;
  status: "success" | "failed";
  provider?: string | null;
  model?: string | null;
  triggered_by_role?: string | null;
  executive_summary?: string | null;
  critical_findings?: string[] | null;
  early_warning_signals?: string[] | null;
  recommended_actions?: string[] | null;
  production_blockers?: string[] | null;
  android_specific_risks?: string[] | null;
  database_specific_risks?: string[] | null;
  consistency_notes?: string[] | null;
  confidence?: "low" | "medium" | "high" | null;
  do_not_proceed_reason?: string | null;
  error_message?: string | null;
  raw_response?: string | null;
}

const statusColor = (status?: string) => {
  if (["success", "ok", "aman"].includes(status || "")) return "green";
  if (["warning", "review", "manual_review", "perlu_perhatian", "berisiko"].includes(status || "")) return "gold";
  if (["critical", "failed", "kritis"].includes(status || "")) return "red";
  return "default";
};

const severityLabel: Record<AuditSeverity, string> = {
  unknown: "Belum diketahui",
  aman: "Aman",
  perlu_perhatian: "Perlu perhatian",
  berisiko: "Berisiko",
  kritis: "Kritis",
};

const layerIcon: Record<string, React.ReactNode> = {
  Network: <ThunderboltOutlined />,
  App: <SafetyCertificateOutlined />,
  API: <ApiOutlined />,
  Database: <DatabaseOutlined />,
  Data: <LockOutlined />,
};

export const DompetSecurityAuditList = () => {
  const { message } = App.useApp();
  const [runs, setRuns] = useState<SecurityAuditRun[]>([]);
  const [aiAnalyses, setAiAnalyses] = useState<SecurityAiAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);
  const [exportingAi, setExportingAi] = useState(false);
  const [selectedAi, setSelectedAi] = useState<SecurityAiAnalysis | null>(null);

  const latest = runs[0];
  const latestAi = latest ? aiAnalyses.find((item) => item.audit_run_id === latest.id) : undefined;

  const loadData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseClient
        .from("wallet_security_audit_runs")
        .select("id,started_at,finished_at,status,score,severity,triggered_by_role,layer_summary,checks,findings,recommendations,ai_summary")
        .order("started_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      setRuns((data || []) as SecurityAuditRun[]);

      const runIds = (data || []).map((item) => item.id);
      if (runIds.length) {
        const { data: aiData, error: aiError } = await supabaseClient
          .from("wallet_security_ai_analyses")
          .select("id,audit_run_id,created_at,status,provider,model,triggered_by_role,executive_summary,critical_findings,early_warning_signals,recommended_actions,production_blockers,android_specific_risks,database_specific_risks,consistency_notes,confidence,do_not_proceed_reason,error_message,raw_response")
          .in("audit_run_id", runIds)
          .order("created_at", { ascending: false });
        if (aiError) throw aiError;
        setAiAnalyses((aiData || []) as SecurityAiAnalysis[]);
      } else {
        setAiAnalyses([]);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Gagal memuat audit keamanan dompet.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const runAudit = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabaseClient.functions.invoke("wallet-admin", {
        body: { action: "run_security_audit" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      message.success("Audit keamanan selesai dijalankan.");
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Audit keamanan gagal dijalankan.");
    } finally {
      setRunning(false);
    }
  };

  const runAiAnalysis = async () => {
    if (!latest?.id) {
      message.warning("Jalankan audit manual terlebih dahulu sebelum analisis AI.");
      return;
    }

    setAiRunning(true);
    try {
      const { data, error } = await supabaseClient.functions.invoke("wallet-security-ai-auditor", {
        body: { audit_run_id: latest.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.warning) {
        message.warning("Analisis AI belum sempurna, catatan gagal sudah disimpan.");
      } else {
        message.success("Analisis AI selesai dibuat.");
      }
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Analisis AI gagal dijalankan.");
      await loadData();
    } finally {
      setAiRunning(false);
    }
  };

  const stats = useMemo(() => {
    const checks = latest?.checks || [];
    return {
      ok: checks.filter((item) => item.status === "ok").length,
      warning: checks.filter((item) => ["warning", "review", "manual_review"].includes(item.status)).length,
      critical: checks.filter((item) => item.status === "critical").length,
    };
  }, [latest]);

  const renderAiList = (items?: string[] | null) => (
    <List
      size="small"
      dataSource={items || []}
      locale={{ emptyText: "Tidak ada catatan." }}
      renderItem={(item) => (
        <List.Item>
          <Text>{item}</Text>
        </List.Item>
      )}
    />
  );

  const joinItems = (items?: string[] | null) => (items && items.length ? items.join("\n") : "-");

  const exportAiAnalyses = async () => {
    if (!aiAnalyses.length) {
      message.warning("Belum ada data analisis AI untuk diekspor.");
      return;
    }

    setExportingAi(true);
    try {
      const [{ default: ExcelJS }, { saveAs }] = await Promise.all([
        import("exceljs"),
        import("file-saver"),
      ]);
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Admin Panel Alhasanah";
      workbook.created = new Date();

      const sheet = workbook.addWorksheet("Analisis AI Dompet");
      sheet.columns = [
        { header: "Waktu", key: "created_at", width: 20 },
        { header: "Status", key: "status", width: 12 },
        { header: "Confidence", key: "confidence", width: 14 },
        { header: "Role", key: "role", width: 14 },
        { header: "Model", key: "model", width: 22 },
        { header: "Ringkasan", key: "summary", width: 60 },
        { header: "Temuan Kritis", key: "critical", width: 50 },
        { header: "Gejala Awal", key: "warning", width: 50 },
        { header: "Blocker Produksi", key: "blockers", width: 50 },
        { header: "Risiko Android", key: "android", width: 50 },
        { header: "Risiko Database", key: "database", width: 50 },
        { header: "Rekomendasi", key: "actions", width: 50 },
        { header: "Catatan Konsistensi", key: "consistency", width: 50 },
        { header: "Alasan Jangan Lanjut", key: "do_not_proceed", width: 50 },
        { header: "Error", key: "error", width: 40 },
      ];

      aiAnalyses.forEach((item) => {
        sheet.addRow({
          created_at: dayjs(item.created_at).format("DD/MM/YYYY HH:mm"),
          status: item.status,
          confidence: item.confidence || "-",
          role: item.triggered_by_role || "-",
          model: item.model || item.provider || "-",
          summary: item.executive_summary || "-",
          critical: joinItems(item.critical_findings),
          warning: joinItems(item.early_warning_signals),
          blockers: joinItems(item.production_blockers),
          android: joinItems(item.android_specific_risks),
          database: joinItems(item.database_specific_risks),
          actions: joinItems(item.recommended_actions),
          consistency: joinItems(item.consistency_notes),
          do_not_proceed: item.do_not_proceed_reason || "-",
          error: item.error_message || "-",
        });
      });

      sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
      sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
      sheet.eachRow((row, rowNumber) => {
        row.alignment = { vertical: "top", wrapText: true };
        if (rowNumber > 1 && rowNumber % 2 === 0) {
          row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Analisis_AI_Dompet_${dayjs().format("YYYYMMDD_HHmm")}.xlsx`);
      message.success("Data analisis AI berhasil diekspor.");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Gagal mengekspor analisis AI.");
    } finally {
      setExportingAi(false);
    }
  };

  const aiHistoryColumns: ColumnsType<SecurityAiAnalysis> = [
    {
      title: "Waktu",
      dataIndex: "created_at",
      width: 160,
      render: (value: string) => dayjs(value).format("DD/MM/YYYY HH:mm"),
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 110,
      render: (value: string) => <Tag color={statusColor(value)}>{value}</Tag>,
    },
    {
      title: "Kepercayaan",
      dataIndex: "confidence",
      width: 120,
      render: (value?: string | null) => <Tag color={value === "high" ? "green" : value === "low" ? "red" : "gold"}>{value || "medium"}</Tag>,
    },
    {
      title: "Ringkasan",
      dataIndex: "executive_summary",
      ellipsis: true,
      render: (value?: string | null) => value || "-",
    },
    {
      title: "Role",
      dataIndex: "triggered_by_role",
      width: 120,
      render: (value?: string | null) => value || "-",
    },
    {
      title: "Aksi",
      width: 105,
      render: (_, record) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => setSelectedAi(record)}>
          Detail
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size={18} style={{ width: "100%" }}>
        <div>
          <Title level={2} style={{ marginBottom: 4 }}>
            Audit Keamanan Dompet
          </Title>
          <Text type="secondary">
            Pemeriksaan satu klik untuk melihat gejala awal masalah keamanan dompet sebelum menjadi insiden besar.
          </Text>
        </div>

        {latest?.severity === "kritis" && (
          <Alert
            showIcon
            type="error"
            icon={<ExclamationCircleOutlined />}
            message="Status keamanan dompet kritis"
            description="Segera buka temuan dan rekomendasi di bawah. Jangan lanjutkan operasional besar sebelum penyebab utama ditangani."
            style={{ background: "#b91c1c", borderColor: "#7f1d1d", color: "#ffffff", fontWeight: 700 }}
          />
        )}

        <Space wrap>
          <Button type="primary" danger={latest?.severity === "kritis"} icon={<SafetyCertificateOutlined />} loading={running} onClick={runAudit}>
            Jalankan Audit Keamanan
          </Button>
          <Button icon={<BulbOutlined />} loading={aiRunning} disabled={!latest} onClick={runAiAnalysis}>
            Analisis AI
          </Button>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={loadData}>
            Muat Ulang
          </Button>
        </Space>

        {latest ? (
          <>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={6}>
                <Card>
                  <Statistic title="Skor Keamanan" value={latest.score} suffix="/ 100" />
                  <Progress percent={latest.score} status={latest.score < 55 ? "exception" : latest.score < 90 ? "active" : "success"} showInfo={false} />
                </Card>
              </Col>
              <Col xs={24} md={6}>
                <Card>
                  <Statistic title="Status" value={severityLabel[latest.severity]} />
                  <Tag color={statusColor(latest.severity)}>{severityLabel[latest.severity]}</Tag>
                </Card>
              </Col>
              <Col xs={24} md={4}>
                <Card>
                  <Statistic title="Aman" value={stats.ok} prefix={<CheckCircleOutlined />} />
                </Card>
              </Col>
              <Col xs={24} md={4}>
                <Card>
                  <Statistic title="Perlu dicek" value={stats.warning} />
                </Card>
              </Col>
              <Col xs={24} md={4}>
                <Card>
                  <Statistic title="Kritis" value={stats.critical} prefix={<ExclamationCircleOutlined />} />
                </Card>
              </Col>
            </Row>

            <Card>
              <Descriptions title="Ringkasan Audit" bordered column={{ xs: 1, md: 2 }}>
                <Descriptions.Item label="Waktu audit">{dayjs(latest.started_at).format("DD/MM/YYYY HH:mm")}</Descriptions.Item>
                <Descriptions.Item label="Selesai">{latest.finished_at ? dayjs(latest.finished_at).format("DD/MM/YYYY HH:mm") : "Masih berjalan"}</Descriptions.Item>
                <Descriptions.Item label="Dijalankan oleh role">{latest.triggered_by_role || "-"}</Descriptions.Item>
                <Descriptions.Item label="Status teknis">
                  <Tag color={statusColor(latest.status)}>{latest.status}</Tag>
                </Descriptions.Item>
              </Descriptions>
              <Paragraph style={{ marginTop: 16, marginBottom: 0 }}>{latest.ai_summary}</Paragraph>
            </Card>

            <Card
              title="Analisis AI Auditor"
              extra={latestAi ? <Tag color="blue">Kepercayaan {latestAi.confidence || "medium"}</Tag> : undefined}
            >
              <Alert
                showIcon
                type="info"
                message="Audit manual tetap menjadi sumber kebenaran"
                description="AI hanya membaca hasil audit manual yang sudah disaring, lalu membantu menjelaskan risiko, gejala awal, dan urutan tindakan. AI tidak memegang saldo dan tidak membuat keputusan transaksi."
                style={{ marginBottom: 16 }}
              />

              {latestAi ? (
                <Space direction="vertical" size={16} style={{ width: "100%" }}>
                  <Descriptions bordered column={{ xs: 1, md: 2 }}>
                    <Descriptions.Item label="Waktu analisis">{dayjs(latestAi.created_at).format("DD/MM/YYYY HH:mm")}</Descriptions.Item>
                    <Descriptions.Item label="Model">{latestAi.model || latestAi.provider || "-"}</Descriptions.Item>
                    <Descriptions.Item label="Dijalankan oleh role">{latestAi.triggered_by_role || "-"}</Descriptions.Item>
                    <Descriptions.Item label="Status">
                      <Tag color={statusColor(latestAi.status)}>{latestAi.status}</Tag>
                    </Descriptions.Item>
                  </Descriptions>

                  {latestAi.do_not_proceed_reason && (
                    <Alert
                      showIcon
                      type="error"
                      message="AI menyarankan jangan lanjut produksi"
                      description={latestAi.do_not_proceed_reason}
                    />
                  )}

                  {latestAi.status === "failed" && (
                    <Alert
                      showIcon
                      type="error"
                      message="Analisis AI gagal"
                      description={latestAi.error_message || "Audit manual tetap tersedia. Periksa konfigurasi AI atau coba lagi."}
                    />
                  )}

                  <div>
                    <Text strong>Ringkasan AI</Text>
                    <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>{latestAi.executive_summary}</Paragraph>
                  </div>

                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                      <div>
                        <Text strong>Temuan Kritis</Text>
                        {renderAiList(latestAi.critical_findings)}
                      </div>
                    </Col>
                    <Col xs={24} md={12}>
                      <div>
                        <Text strong>Gejala Awal</Text>
                        {renderAiList(latestAi.early_warning_signals)}
                      </div>
                    </Col>
                    <Col xs={24} md={12}>
                      <div>
                        <Text strong>Risiko Android</Text>
                        {renderAiList(latestAi.android_specific_risks)}
                      </div>
                    </Col>
                    <Col xs={24} md={12}>
                      <div>
                        <Text strong>Risiko Database</Text>
                        {renderAiList(latestAi.database_specific_risks)}
                      </div>
                    </Col>
                    <Col xs={24} md={12}>
                      <div>
                        <Text strong>Rekomendasi AI</Text>
                        {renderAiList(latestAi.recommended_actions)}
                      </div>
                    </Col>
                    <Col xs={24} md={12}>
                      <div>
                        <Text strong>Catatan Konsistensi</Text>
                        {renderAiList(latestAi.consistency_notes)}
                      </div>
                    </Col>
                  </Row>
                </Space>
              ) : (
                <Empty description="Belum ada analisis AI untuk audit manual terbaru. Tekan tombol Analisis AI setelah audit manual selesai." />
              )}
            </Card>

            <Card
              title="Riwayat Analisis AI"
              extra={
                <Button icon={<FileExcelOutlined />} loading={exportingAi} onClick={exportAiAnalyses}>
                  Ekspor Excel
                </Button>
              }
            >
              <Table
                rowKey="id"
                size="middle"
                loading={loading}
                columns={aiHistoryColumns}
                dataSource={aiAnalyses}
                pagination={{ pageSize: 10, showSizeChanger: false }}
                locale={{ emptyText: "Belum ada riwayat analisis AI." }}
                scroll={{ x: 900 }}
              />
            </Card>

            <Row gutter={[16, 16]}>
              {Object.entries(latest.layer_summary || {}).map(([layer, item]) => (
                <Col xs={24} md={8} xl={4} key={layer}>
                  <Card>
                    <Space direction="vertical" size={6}>
                      <Space>
                        {layerIcon[layer] || <SafetyCertificateOutlined />}
                        <Text strong>{layer}</Text>
                      </Space>
                      <Tag color={statusColor(item.status)}>{item.status || "review"}</Tag>
                      <Text type="secondary">{item.label}</Text>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>

            <Card title="Hasil Pemeriksaan">
              <List
                dataSource={latest.checks || []}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<Tag color={statusColor(item.status)}>{item.status === "ok" ? "AMAN" : item.status === "critical" ? "KRITIS" : "CEK"}</Tag>}
                      title={
                        <Space wrap>
                          <Text strong>{item.name}</Text>
                          <Tag>{item.layer}</Tag>
                        </Space>
                      }
                      description={item.label}
                    />
                  </List.Item>
                )}
              />
            </Card>

            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Card title="Temuan">
                  <List
                    dataSource={latest.findings || []}
                    renderItem={(item) => (
                      <List.Item>
                        <Text>{item}</Text>
                      </List.Item>
                    )}
                  />
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card title="Rekomendasi">
                  <List
                    dataSource={latest.recommendations || []}
                    renderItem={(item) => (
                      <List.Item>
                        <Text>{item}</Text>
                      </List.Item>
                    )}
                  />
                </Card>
              </Col>
            </Row>

            <Card title="Riwayat Audit Terakhir">
              <List
                loading={loading}
                dataSource={runs}
                renderItem={(item) => (
                  <List.Item>
                    <Space wrap style={{ width: "100%", justifyContent: "space-between" }}>
                      <Space wrap>
                        <Text strong>{dayjs(item.started_at).format("DD/MM/YYYY HH:mm")}</Text>
                        <Tag color={statusColor(item.severity)}>{severityLabel[item.severity]}</Tag>
                        <Text>Skor {item.score}/100</Text>
                      </Space>
                      <Text type="secondary">{item.triggered_by_role || "-"}</Text>
                    </Space>
                  </List.Item>
                )}
              />
            </Card>
          </>
        ) : (
          <Card>
            <Empty description="Belum ada audit keamanan dompet. Jalankan audit pertama untuk melihat status sistem." />
          </Card>
        )}
      </Space>

      <Modal
        title="Detail Analisis AI"
        open={Boolean(selectedAi)}
        onCancel={() => setSelectedAi(null)}
        footer={<Button onClick={() => setSelectedAi(null)}>Tutup</Button>}
        width={980}
      >
        {selectedAi && (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Descriptions bordered column={{ xs: 1, md: 2 }}>
              <Descriptions.Item label="Waktu">{dayjs(selectedAi.created_at).format("DD/MM/YYYY HH:mm")}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={statusColor(selectedAi.status)}>{selectedAi.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Kepercayaan">{selectedAi.confidence || "medium"}</Descriptions.Item>
              <Descriptions.Item label="Model">{selectedAi.model || selectedAi.provider || "-"}</Descriptions.Item>
              <Descriptions.Item label="Role">{selectedAi.triggered_by_role || "-"}</Descriptions.Item>
              <Descriptions.Item label="Audit Run">{selectedAi.audit_run_id}</Descriptions.Item>
            </Descriptions>

            {selectedAi.status === "failed" && (
              <Alert
                showIcon
                type="error"
                message="Analisis AI gagal"
                description={selectedAi.error_message || "Tidak ada pesan error."}
              />
            )}

            {selectedAi.do_not_proceed_reason && (
              <Alert
                showIcon
                type="error"
                message="Alasan AI menyarankan jangan lanjut"
                description={selectedAi.do_not_proceed_reason}
              />
            )}

            <div>
              <Text strong>Ringkasan</Text>
              <Paragraph style={{ marginTop: 8 }}>{selectedAi.executive_summary || "-"}</Paragraph>
            </div>

            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Text strong>Temuan Kritis</Text>
                {renderAiList(selectedAi.critical_findings)}
              </Col>
              <Col xs={24} md={12}>
                <Text strong>Gejala Awal</Text>
                {renderAiList(selectedAi.early_warning_signals)}
              </Col>
              <Col xs={24} md={12}>
                <Text strong>Blocker Produksi</Text>
                {renderAiList(selectedAi.production_blockers)}
              </Col>
              <Col xs={24} md={12}>
                <Text strong>Rekomendasi</Text>
                {renderAiList(selectedAi.recommended_actions)}
              </Col>
              <Col xs={24} md={12}>
                <Text strong>Risiko Android</Text>
                {renderAiList(selectedAi.android_specific_risks)}
              </Col>
              <Col xs={24} md={12}>
                <Text strong>Risiko Database</Text>
                {renderAiList(selectedAi.database_specific_risks)}
              </Col>
              <Col xs={24}>
                <Text strong>Catatan Konsistensi</Text>
                {renderAiList(selectedAi.consistency_notes)}
              </Col>
            </Row>

            {selectedAi.raw_response && (
              <div>
                <Text strong>Respons Mentah AI</Text>
                <Paragraph code style={{ display: "block", whiteSpace: "pre-wrap", marginTop: 8 }}>
                  {selectedAi.raw_response}
                </Paragraph>
              </div>
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
};
