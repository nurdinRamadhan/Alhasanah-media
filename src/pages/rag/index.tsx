import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from "antd";
import type { UploadProps } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CloudUploadOutlined,
  DatabaseOutlined,
  FileSearchOutlined,
  MessageOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useGetIdentity } from "@refinedev/core";
import dayjs from "dayjs";

import { supabaseClient } from "../../utility/supabaseClient";
import { IRagDocument, IRagQueryLog, IUserIdentity, RagSourceType } from "../../types";
import { extractTextFromFile } from "./fileExtractors";

const { Text, Title } = Typography;

const sourceLabels: Record<RagSourceType, string> = {
  public: "Dokumen Publik",
  kitab: "Kitab & Referensi",
  internal: "Dokumen Internal",
};

const statusColors: Record<string, string> = {
  active: "green",
  draft: "gold",
  archived: "default",
};

const decisionRoles = ["super_admin", "rois", "dewan"];
const manageRoles = ["super_admin", "rois"];

type CreateDocumentValues = {
  title: string;
  source_type: RagSourceType;
  document_type: IRagDocument["document_type"];
  status: IRagDocument["status"];
  content: string;
  chunk_size?: number;
  chunk_overlap?: number;
  metadata_text?: string;
};

type QueryTestValues = {
  source: "pesantren" | "kitab";
  query: string;
};

type QueryTestResult = {
  answer: string;
  sources?: Array<{
    title: string;
    metadata?: Record<string, unknown>;
    similarity?: number;
  }>;
  has_relevant_context?: boolean;
};

type AdminDecisionValues = {
  query: string;
  context_type: "financial" | "academic" | "santri" | "kitab" | "operational";
  include_kitab: boolean;
  include_db_context: boolean;
  include_internal: boolean;
  kelas?: string;
  bulan?: string;
  tahun?: string;
};

type AdminDecisionResult = {
  answer: string;
  data_sources?: {
    db_context?: boolean;
    kitab_references?: Array<{ title: string; metadata?: Record<string, unknown>; similarity?: number }>;
    internal_docs?: Array<{ title: string; metadata?: Record<string, unknown>; similarity?: number }>;
  };
  confidence_note?: string;
};

export const RagKnowledgePage: React.FC = () => {
  const { message } = App.useApp();
  const { data: user } = useGetIdentity<IUserIdentity>();
  const [activeTab, setActiveTab] = useState<string>("public");
  const [documents, setDocuments] = useState<IRagDocument[]>([]);
  const [logs, setLogs] = useState<IRagQueryLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [querying, setQuerying] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryTestResult | null>(null);
  const [adminQuerying, setAdminQuerying] = useState(false);
  const [adminResult, setAdminResult] = useState<AdminDecisionResult | null>(null);
  const [chunkModalOpen, setChunkModalOpen] = useState(false);
  const [chunkLoading, setChunkLoading] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<IRagDocument | null>(null);
  const [chunks, setChunks] = useState<Array<{ id: string; chunk_index: number; title: string; content: string; metadata: Record<string, unknown>; created_at: string }>>([]);
  const [form] = Form.useForm<CreateDocumentValues>();
  const [queryForm] = Form.useForm<QueryTestValues>();
  const [adminForm] = Form.useForm<AdminDecisionValues>();

  const canAccess = !!user && decisionRoles.includes(user.role);
  const canManage = !!user && manageRoles.includes(user.role);
  const canDelete = user?.role === "super_admin";

  const visibleSources = useMemo<RagSourceType[]>(() => {
    if (!canAccess) return [];
    return ["public", "kitab", "internal"];
  }, [canAccess]);

  const fetchData = useCallback(async () => {
    if (!canAccess) return;
    setLoading(true);
    try {
      const [{ data: docs, error: docsError }, { data: queryLogs, error: logsError }] = await Promise.all([
        supabaseClient
          .from("rag_documents")
          .select("*")
          .order("created_at", { ascending: false }),
        supabaseClient
          .from("rag_query_logs")
          .select("id, session_id, query_text, source_type, context_type, retrieved_chunk_ids, response_preview, latency_ms, metadata, created_at")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (docsError) throw docsError;
      if (logsError) throw logsError;

      setDocuments((docs || []) as IRagDocument[]);
      setLogs((queryLogs || []) as IRagQueryLog[]);
    } catch (error: any) {
      message.error(error?.message || "Gagal memuat data RAG.");
    } finally {
      setLoading(false);
    }
  }, [canAccess, message]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = useMemo(() => {
    const latencies = logs
      .map((log) => Number(log.latency_ms || 0))
      .filter((latency) => latency > 0);
    const avgLatency = latencies.length
      ? Math.round(latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length)
      : 0;

    return {
      total: documents.length,
      active: documents.filter((doc) => doc.status === "active").length,
      chunks: documents.reduce((sum, doc) => sum + Number(doc.chunk_count || 0), 0),
      logs: logs.length,
      avgLatency,
      activeWithoutChunks: documents.filter((doc) => doc.status === "active" && Number(doc.chunk_count || 0) === 0).length,
    };
  }, [documents, logs]);

  const logContextStats = useMemo(() => {
    return logs.reduce<Record<string, number>>((acc, log) => {
      const key = log.context_type || "unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [logs]);

  const openCreateModal = (sourceType: RagSourceType) => {
    setSelectedFileName(null);
    form.setFieldsValue({
      source_type: sourceType,
      document_type: sourceType === "kitab" ? "kitab" : "general",
      status: "active",
      chunk_size: 500,
      chunk_overlap: 50,
      metadata_text: "{}",
    });
    setModalOpen(true);
  };

  const handleFileSelect: UploadProps["beforeUpload"] = async (file) => {
    setExtracting(true);
    try {
      const text = await extractTextFromFile(file);
      if (!text) {
        message.warning("File berhasil dibaca, tetapi tidak ditemukan teks.");
        return Upload.LIST_IGNORE;
      }

      const currentTitle = form.getFieldValue("title");
      if (!currentTitle) {
        form.setFieldValue("title", file.name.replace(/\.[^.]+$/, ""));
      }
      form.setFieldValue("content", text);
      setSelectedFileName(file.name);
      message.success(`Teks berhasil diekstrak dari ${file.name}.`);
    } catch (error: any) {
      message.error(error?.message || "Gagal mengekstrak file.");
    } finally {
      setExtracting(false);
    }

    return Upload.LIST_IGNORE;
  };

  const createDocument = async (values: CreateDocumentValues) => {
    if (!canManage || !user) return;
    setIngesting(true);

    let metadata = {};
    try {
      metadata = values.metadata_text ? JSON.parse(values.metadata_text) : {};
    } catch {
      message.error("Metadata harus berupa JSON valid.");
      setIngesting(false);
      return;
    }

    const { data, error } = await supabaseClient.functions.invoke("rag-ingest", {
      body: {
        title: values.title,
        source_type: values.source_type,
        document_type: values.document_type,
        status: values.status,
        content: values.content,
        metadata,
        chunk_size: values.chunk_size || 500,
        chunk_overlap: values.chunk_overlap || 50,
      },
    });

    setIngesting(false);

    if (error) {
      message.error(error.message);
      return;
    }

    if (data?.error) {
      message.error(data.error);
      return;
    }

    message.success(`${data?.chunks_created || 0} chunk berhasil dibuat.`);
    setModalOpen(false);
    form.resetFields();
    fetchData();
  };

  const createMetadataOnly = async () => {
    if (!canManage || !user) return;
    await form.validateFields(["title", "source_type", "document_type", "metadata_text"]);
    const values = form.getFieldsValue();

    let metadata = {};
    try {
      metadata = values.metadata_text ? JSON.parse(values.metadata_text) : {};
    } catch {
      message.error("Metadata harus berupa JSON valid.");
      return;
    }

    const { error } = await supabaseClient.from("rag_documents").insert({
      title: values.title,
      source_type: values.source_type,
      document_type: values.document_type,
      status: "draft",
      content_preview: values.content?.slice(0, 500) || null,
      metadata,
      created_by: user.id,
      embedding_model: null,
      embedding_dimension: 768,
    });

    if (error) {
      message.error(error.message);
      return;
    }

    message.success("Draft metadata dibuat tanpa embedding.");
    setModalOpen(false);
    form.resetFields();
    fetchData();
  };

  const runQueryTest = async (values: QueryTestValues) => {
    setQuerying(true);
    setQueryResult(null);

    const { data, error } = await supabaseClient.functions.invoke("rag-query-public", {
      body: {
        source: values.source,
        query: values.query,
        session_id: `admin-test-${user?.id || "unknown"}`,
      },
    });

    setQuerying(false);

    if (error) {
      message.error(error.message);
      return;
    }

    if (data?.error) {
      message.error(data.error);
      return;
    }

    setQueryResult(data as QueryTestResult);
    fetchData();
  };

  const runAdminDecision = async (values: AdminDecisionValues) => {
    setAdminQuerying(true);
    setAdminResult(null);

    const { data, error } = await supabaseClient.functions.invoke("rag-query-admin", {
      body: {
        query: values.query,
        context_type: values.context_type,
        include_kitab: values.include_kitab,
        include_db_context: values.include_db_context,
        include_internal: values.include_internal,
        filters: {
          kelas: values.kelas || undefined,
          bulan: values.bulan || undefined,
          tahun: values.tahun || undefined,
        },
      },
    });

    setAdminQuerying(false);

    if (error) {
      message.error(error.message);
      return;
    }

    if (data?.error) {
      message.error(data.error);
      return;
    }

    setAdminResult(data as AdminDecisionResult);
    fetchData();
  };

  const updateStatus = async (record: IRagDocument, status: IRagDocument["status"]) => {
    if (!canManage) return;
    const { error } = await supabaseClient
      .from("rag_documents")
      .update({ status })
      .eq("id", record.id);

    if (error) {
      message.error(error.message);
      return;
    }

    message.success("Status dokumen diperbarui.");
    fetchData();
  };

  const deleteDocument = async (record: IRagDocument) => {
    if (!canDelete) return;
    Modal.confirm({
      title: "Hapus dokumen RAG?",
      content: "Chunk terkait akan ikut terhapus. Data existing di modul lain tidak tersentuh.",
      okText: "Hapus",
      okButtonProps: { danger: true },
      cancelText: "Batal",
      onOk: async () => {
        const { error } = await supabaseClient.from("rag_documents").delete().eq("id", record.id);
        if (error) {
          message.error(error.message);
          return;
        }
        message.success("Dokumen RAG dihapus.");
        fetchData();
      },
    });
  };

  const openChunks = async (record: IRagDocument) => {
    setSelectedDocument(record);
    setChunkModalOpen(true);
    setChunkLoading(true);

    const { data, error } = await supabaseClient
      .from("rag_document_chunks")
      .select("id, chunk_index, title, content, metadata, created_at")
      .eq("document_id", record.id)
      .order("chunk_index", { ascending: true });

    setChunkLoading(false);

    if (error) {
      message.error(error.message);
      return;
    }

    setChunks((data || []) as typeof chunks);
  };

  const documentColumns: ColumnsType<IRagDocument> = [
    {
      title: "Judul",
      dataIndex: "title",
      render: (_, record) => (
        <Space direction="vertical" size={1}>
          <Text strong>{record.title}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.content_preview || "Belum ada preview"}
          </Text>
        </Space>
      ),
    },
    {
      title: "Tipe",
      dataIndex: "document_type",
      width: 120,
      render: (value) => <Tag>{value}</Tag>,
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 130,
      render: (value, record) => canManage ? (
        <Select
          size="small"
          value={value}
          style={{ width: 110 }}
          onChange={(nextStatus) => updateStatus(record, nextStatus)}
          options={[
            { value: "draft", label: "Draft" },
            { value: "active", label: "Aktif" },
            { value: "archived", label: "Arsip" },
          ]}
        />
      ) : (
        <Tag color={statusColors[value]}>{value}</Tag>
      ),
    },
    {
      title: "Chunk",
      dataIndex: "chunk_count",
      width: 90,
      align: "right",
    },
    {
      title: "Embedding",
      width: 160,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text>{record.embedding_model || "Belum diproses"}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.embedding_dimension} dimensi</Text>
        </Space>
      ),
    },
    {
      title: "Diperbarui",
      dataIndex: "updated_at",
      width: 150,
      render: (value) => dayjs(value).format("DD MMM YYYY HH:mm"),
    },
    {
      title: "",
      width: 100,
      render: (_, record) => (
        <Space>
          <Tooltip title="Detail metadata">
            <Button
              size="small"
              icon={<FileSearchOutlined />}
              onClick={() => Modal.info({
                title: record.title,
                width: 720,
                content: (
                  <Descriptions size="small" bordered column={1}>
                    <Descriptions.Item label="ID">{record.id}</Descriptions.Item>
                    <Descriptions.Item label="Sumber">{sourceLabels[record.source_type]}</Descriptions.Item>
                    <Descriptions.Item label="Metadata">
                      <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                        {JSON.stringify(record.metadata || {}, null, 2)}
                      </pre>
                    </Descriptions.Item>
                  </Descriptions>
                ),
              })}
            />
          </Tooltip>
          <Tooltip title="Lihat chunk">
            <Button size="small" onClick={() => openChunks(record)}>
              Chunk
            </Button>
          </Tooltip>
          {canDelete && (
            <Button size="small" danger onClick={() => deleteDocument(record)}>
              Hapus
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const logColumns: ColumnsType<IRagQueryLog> = [
    {
      title: "Waktu",
      dataIndex: "created_at",
      width: 160,
      render: (value) => dayjs(value).format("DD MMM YYYY HH:mm"),
    },
    {
      title: "Query",
      dataIndex: "query_text",
      render: (value) => <Text>{value}</Text>,
    },
    {
      title: "Context",
      dataIndex: "context_type",
      width: 150,
      render: (value) => <Tag>{value || "unknown"}</Tag>,
    },
    {
      title: "Sumber",
      dataIndex: "source_type",
      width: 100,
      render: (value) => <Tag>{value || "mixed"}</Tag>,
    },
    {
      title: "Latency",
      dataIndex: "latency_ms",
      width: 100,
      align: "right",
      render: (value) => value ? `${value} ms` : "-",
    },
    {
      title: "",
      width: 90,
      render: (_, record) => (
        <Button
          size="small"
          icon={<FileSearchOutlined />}
          onClick={() => Modal.info({
            title: "Detail Log RAG",
            width: 760,
            content: (
              <Descriptions size="small" bordered column={1}>
                <Descriptions.Item label="Query">{record.query_text}</Descriptions.Item>
                <Descriptions.Item label="Jawaban">
                  <Text style={{ whiteSpace: "pre-wrap" }}>{record.response_preview || "-"}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Chunk">
                  {(record.retrieved_chunk_ids || []).length} chunk
                </Descriptions.Item>
                <Descriptions.Item label="Metadata">
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                    {JSON.stringify(record.metadata || {}, null, 2)}
                  </pre>
                </Descriptions.Item>
              </Descriptions>
            ),
          })}
        >
          Detail
        </Button>
      ),
    },
  ];

  if (!canAccess) {
    return (
      <Card>
        <Empty description="Akses RAG hanya tersedia untuk role keputusan AI." />
      </Card>
    );
  }

  const tabItems = [
    ...visibleSources.map((sourceType) => ({
      key: sourceType,
      label: sourceLabels[sourceType],
      children: (
        <Card
          title={sourceLabels[sourceType]}
          extra={canManage && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreateModal(sourceType)}>
              Tambah
            </Button>
          )}
        >
          <Table
            rowKey="id"
            loading={loading}
            columns={documentColumns}
            dataSource={documents.filter((doc) => doc.source_type === sourceType)}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 980 }}
          />
        </Card>
      ),
    })),
    {
      key: "test",
      label: "Test Chatbot",
      children: (
        <Card title="Test Query Public RAG">
          <Row gutter={[18, 18]}>
            <Col xs={24} lg={10}>
              <Form
                form={queryForm}
                layout="vertical"
                initialValues={{ source: "pesantren" }}
                onFinish={runQueryTest}
              >
                <Form.Item name="source" label="Knowledge Source" rules={[{ required: true }]}>
                  <Select
                    options={[
                      { value: "pesantren", label: "Dokumen Publik Pesantren" },
                      { value: "kitab", label: "Kitab & Referensi" },
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  name="query"
                  label="Pertanyaan"
                  rules={[
                    { required: true, message: "Pertanyaan wajib diisi" },
                    { max: 500, message: "Maksimal 500 karakter" },
                  ]}
                >
                  <Input.TextArea rows={5} placeholder="Contoh: Apa profil Pesantren Al-Hasanah?" />
                </Form.Item>
                <Button type="primary" htmlType="submit" icon={<MessageOutlined />} loading={querying}>
                  Test Query
                </Button>
              </Form>
            </Col>
            <Col xs={24} lg={14}>
              {queryResult ? (
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <Card size="small" title="Jawaban">
                    <Text style={{ whiteSpace: "pre-wrap" }}>{queryResult.answer}</Text>
                  </Card>
                  <Card size="small" title="Sumber Ditemukan">
                    {queryResult.sources?.length ? (
                      <Space direction="vertical" style={{ width: "100%" }}>
                        {queryResult.sources.map((source, index) => (
                          <Card key={`${source.title}-${index}`} size="small">
                            <Space direction="vertical" size={2}>
                              <Text strong>{source.title}</Text>
                              <Text type="secondary">
                                Similarity: {typeof source.similarity === "number" ? source.similarity.toFixed(3) : "-"}
                              </Text>
                              <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12 }}>
                                {JSON.stringify(source.metadata || {}, null, 2)}
                              </pre>
                            </Space>
                          </Card>
                        ))}
                      </Space>
                    ) : (
                      <Empty description="Belum ada konteks relevan" />
                    )}
                  </Card>
                </Space>
              ) : (
                <Empty description="Jalankan test query untuk melihat jawaban dan sumber." />
              )}
            </Col>
          </Row>
        </Card>
      ),
    },
    {
      key: "logs",
      label: "Log Query RAG",
      children: (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={6}>
              <Card><Statistic title="Rata-rata Latency" value={stats.avgLatency} suffix="ms" /></Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card><Statistic title="Dokumen Aktif Tanpa Chunk" value={stats.activeWithoutChunks} /></Card>
            </Col>
            {Object.entries(logContextStats).slice(0, 2).map(([context, count]) => (
              <Col xs={24} sm={12} lg={6} key={context}>
                <Card><Statistic title={context} value={count} /></Card>
              </Col>
            ))}
          </Row>
          <Card title="Log Query RAG">
            <Table
              rowKey="id"
              loading={loading}
              columns={logColumns}
              dataSource={logs}
              pagination={{ pageSize: 10 }}
              scroll={{ x: 980 }}
            />
          </Card>
        </Space>
      ),
    },
    {
      key: "admin",
      label: "Admin Decision",
      children: (
        <Card title="Admin Decision Support">
          <Row gutter={[18, 18]}>
            <Col xs={24} lg={10}>
              <Form
                form={adminForm}
                layout="vertical"
                initialValues={{
                  context_type: "operational",
                  include_kitab: false,
                  include_db_context: true,
                  include_internal: true,
                  tahun: dayjs().format("YYYY"),
                  bulan: dayjs().format("MM"),
                }}
                onFinish={runAdminDecision}
              >
                <Form.Item
                  name="query"
                  label="Pertanyaan Keputusan"
                  rules={[
                    { required: true, message: "Pertanyaan wajib diisi" },
                    { max: 500, message: "Maksimal 500 karakter" },
                  ]}
                >
                  <Input.TextArea rows={4} placeholder="Contoh: Bagaimana evaluasi operasional bulan ini?" />
                </Form.Item>
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item name="context_type" label="Konteks" rules={[{ required: true }]}>
                      <Select
                        options={[
                          { value: "operational", label: "Operasional" },
                          { value: "financial", label: "Keuangan" },
                          { value: "academic", label: "Akademik" },
                          { value: "santri", label: "Kesantrian" },
                          { value: "kitab", label: "Kitab" },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="kelas" label="Filter Kelas">
                      <Select
                        allowClear
                        options={[
                          { value: "1", label: "Kelas 1" },
                          { value: "2", label: "Kelas 2" },
                          { value: "3", label: "Kelas 3" },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item name="bulan" label="Bulan">
                      <Select
                        allowClear
                        options={Array.from({ length: 12 }, (_, index) => {
                          const value = String(index + 1).padStart(2, "0");
                          return { value, label: dayjs(`2026-${value}-01`).format("MMMM") };
                        })}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="tahun" label="Tahun">
                      <Input placeholder="2026" />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={12}>
                  <Col span={8}>
                    <Form.Item name="include_db_context" label="Data DB">
                      <Select options={[{ value: true, label: "Ya" }, { value: false, label: "Tidak" }]} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="include_internal" label="Dok. Internal">
                      <Select options={[{ value: true, label: "Ya" }, { value: false, label: "Tidak" }]} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="include_kitab" label="Kitab">
                      <Select options={[{ value: true, label: "Ya" }, { value: false, label: "Tidak" }]} />
                    </Form.Item>
                  </Col>
                </Row>
                <Button type="primary" htmlType="submit" icon={<MessageOutlined />} loading={adminQuerying}>
                  Jalankan Analisis
                </Button>
              </Form>
            </Col>
            <Col xs={24} lg={14}>
              {adminResult ? (
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <Card size="small" title="Jawaban Admin">
                    <Text style={{ whiteSpace: "pre-wrap" }}>{adminResult.answer}</Text>
                  </Card>
                  <Card size="small" title="Sumber Data">
                    <Space direction="vertical" style={{ width: "100%" }}>
                      <Tag color={adminResult.data_sources?.db_context ? "green" : "default"}>
                        Data DB: {adminResult.data_sources?.db_context ? "digunakan" : "tidak digunakan"}
                      </Tag>
                      <Descriptions size="small" bordered column={1}>
                        <Descriptions.Item label="Kitab">
                          {adminResult.data_sources?.kitab_references?.length || 0} referensi
                        </Descriptions.Item>
                        <Descriptions.Item label="Internal">
                          {adminResult.data_sources?.internal_docs?.length || 0} dokumen
                        </Descriptions.Item>
                        <Descriptions.Item label="Catatan">
                          {adminResult.confidence_note || "-"}
                        </Descriptions.Item>
                      </Descriptions>
                    </Space>
                  </Card>
                </Space>
              ) : (
                <Empty description="Jalankan analisis untuk melihat rekomendasi admin." />
              )}
            </Col>
          </Row>
        </Card>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={18} style={{ width: "100%" }}>
      <Row justify="space-between" align="middle" gutter={[16, 16]}>
        <Col>
          <Space direction="vertical" size={2}>
            <Title level={3} style={{ margin: 0 }}>
              RAG Knowledge Base
            </Title>
            <Text type="secondary">Pondasi dokumen, chunk embedding, dan log query AI.</Text>
          </Space>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
              Refresh
            </Button>
            {canManage && (
              <Button type="primary" icon={<CloudUploadOutlined />} onClick={() => openCreateModal("public")}>
                Tambah Dokumen
              </Button>
            )}
          </Space>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="Dokumen" value={stats.total} prefix={<DatabaseOutlined />} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="Aktif" value={stats.active} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="Chunk" value={stats.chunks} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="Log Terbaru" value={stats.logs} /></Card>
        </Col>
      </Row>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

      <Modal
        title="Tambah dan Embed Dokumen RAG"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        okText="Proses Embedding"
        confirmLoading={ingesting}
        width={760}
        destroyOnClose
        footer={[
          <Button key="cancel" onClick={() => setModalOpen(false)}>
            Batal
          </Button>,
          <Button key="draft" onClick={createMetadataOnly} disabled={ingesting}>
            Simpan Draft Metadata
          </Button>,
          <Button key="submit" type="primary" loading={ingesting} onClick={() => form.submit()}>
            Proses Embedding
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical" onFinish={createDocument}>
          <Form.Item name="title" label="Judul" rules={[{ required: true, message: "Judul wajib diisi" }]}>
            <Input maxLength={160} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="source_type" label="Sumber" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: "public", label: "Publik" },
                    { value: "kitab", label: "Kitab" },
                    { value: "internal", label: "Internal" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="document_type" label="Tipe" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: "general", label: "General" },
                    { value: "kitab", label: "Kitab" },
                    { value: "report", label: "Report" },
                    { value: "policy", label: "Policy" },
                    { value: "sop", label: "SOP" },
                    { value: "faq", label: "FAQ" },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="status" label="Status" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "draft", label: "Draft" },
                { value: "active", label: "Aktif" },
                { value: "archived", label: "Arsip" },
              ]}
            />
          </Form.Item>
          <Upload.Dragger
            accept=".txt,.md,.markdown,.csv,.docx,.xlsx,.pdf"
            maxCount={1}
            showUploadList={false}
            beforeUpload={handleFileSelect}
            disabled={extracting || ingesting}
            style={{ marginBottom: 16 }}
          >
            <p className="ant-upload-drag-icon">
              <CloudUploadOutlined />
            </p>
            <p className="ant-upload-text">Upload file atau tarik ke area ini</p>
            <p className="ant-upload-hint">
              Mendukung .txt, .md, .csv, .docx, .xlsx, dan .pdf. Teks akan diekstrak ke field konten sebelum embedding.
            </p>
            {selectedFileName && (
              <Tag color="blue" style={{ marginTop: 8 }}>
                {selectedFileName}
              </Tag>
            )}
          </Upload.Dragger>
          <Form.Item
            name="content"
            label="Konten Dokumen"
            rules={[
              { required: true, message: "Konten wajib diisi untuk embedding" },
              { max: 250000, message: "Maksimal 250.000 karakter" },
            ]}
          >
            <Input.TextArea rows={9} placeholder="Tempel teks dokumen, panduan, FAQ, atau referensi kitab di sini." />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="chunk_size" label="Chunk Size">
                <Input type="number" min={120} max={800} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="chunk_overlap" label="Chunk Overlap">
                <Input type="number" min={0} max={100} />
              </Form.Item>
            </Col>
          </Row>
          <Divider style={{ margin: "8px 0 14px" }} />
          <Form.Item name="metadata_text" label="Metadata JSON">
            <Input.TextArea rows={5} spellCheck={false} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title={selectedDocument ? `Chunk: ${selectedDocument.title}` : "Chunk Dokumen"}
        open={chunkModalOpen}
        onCancel={() => setChunkModalOpen(false)}
        footer={<Button onClick={() => setChunkModalOpen(false)}>Tutup</Button>}
        width={860}
      >
        <Table
          rowKey="id"
          loading={chunkLoading}
          dataSource={chunks}
          pagination={{ pageSize: 5 }}
          columns={[
            {
              title: "#",
              dataIndex: "chunk_index",
              width: 70,
            },
            {
              title: "Konten",
              dataIndex: "content",
              render: (value, record) => (
                <Space direction="vertical" size={4} style={{ width: "100%" }}>
                  <Text style={{ whiteSpace: "pre-wrap" }}>{value}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {dayjs(record.created_at).format("DD MMM YYYY HH:mm")}
                  </Text>
                </Space>
              ),
            },
            {
              title: "Metadata",
              dataIndex: "metadata",
              width: 260,
              render: (value) => (
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12 }}>
                  {JSON.stringify(value || {}, null, 2)}
                </pre>
              ),
            },
          ]}
          scroll={{ x: 760 }}
        />
      </Modal>
    </Space>
  );
};
