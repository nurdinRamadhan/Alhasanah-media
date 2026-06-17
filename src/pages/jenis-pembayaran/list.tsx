import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
  theme,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  InfoCircleOutlined,
  PercentageOutlined,
  PlusOutlined,
  ReloadOutlined,
  TeamOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { useGetIdentity } from "@refinedev/core";
import dayjs from "dayjs";
import { IRefJenisPembayaran, ISantri, ITarifKhususSantri } from "../../types";
import { supabaseClient } from "../../utility/supabaseClient";
import { logActivity } from "../../utility/logger";

const { Text, Title } = Typography;

const paymentTypeOptions = [
  { label: "Bulanan", value: "bulanan" },
  { label: "Sekali Bayar", value: "sekali_bayar" },
  { label: "Tabungan", value: "tabungan" },
  { label: "Bebas", value: "bebas" },
];

const formatRupiah = (value?: number | null) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Number(value || 0));

const typeLabel = (type?: string | null) =>
  paymentTypeOptions.find((option) => option.value === type)?.label || type || "-";

export const JenisPembayaranList: React.FC = () => {
  const { token } = theme.useToken();
  const { data: user } = useGetIdentity();
  const [form] = Form.useForm<IRefJenisPembayaran>();
  const [rateForm] = Form.useForm();
  const [rows, setRows] = useState<IRefJenisPembayaran[]>([]);
  const [santriRows, setSantriRows] = useState<ISantri[]>([]);
  const [specialRates, setSpecialRates] = useState<ITarifKhususSantri[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRates, setLoadingRates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingRate, setSavingRate] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<IRefJenisPembayaran | null>(null);
  const [editingRate, setEditingRate] = useState<ITarifKhususSantri | null>(null);
  const [activeTab, setActiveTab] = useState("master");
  const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null);

  const selectedPayment = useMemo(
    () => rows.find((row) => Number(row.id) === Number(selectedPaymentId)) || null,
    [rows, selectedPaymentId],
  );
  const activeCount = useMemo(() => rows.filter((row) => row.is_aktif).length, [rows]);
  const monthlyCount = useMemo(() => rows.filter((row) => row.tipe === "bulanan").length, [rows]);
  const activeSpecialRateCount = useMemo(
    () => specialRates.filter((row) => row.is_aktif).length,
    [specialRates],
  );
  const averageSpecialNominal = useMemo(() => {
    const activeRates = specialRates.filter((row) => row.is_aktif);
    if (!activeRates.length) return 0;
    return Math.round(activeRates.reduce((sum, row) => sum + Number(row.nominal_khusus || 0), 0) / activeRates.length);
  }, [specialRates]);
  const selectedPaymentActiveRates = specialRates.filter((row) => row.is_aktif).length;
  const selectedPaymentDefaultNominal = Number(selectedPayment?.nominal_default || 0);

  const openTarifTab = () => {
    setActiveTab("tarif");
    window.setTimeout(() => {
      document.getElementById("tarif-khusus-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const fetchRows = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseClient
        .from("ref_jenis_pembayaran")
        .select("*")
        .order("id", { ascending: true });

      if (error) throw error;
      const paymentRows = (data || []) as IRefJenisPembayaran[];
      setRows(paymentRows);
      if (!selectedPaymentId && paymentRows.length) {
        setSelectedPaymentId(Number(paymentRows[0].id));
      }
    } catch (error) {
      const err = error as Error;
      message.error(`Gagal memuat master pembayaran: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchSantriRows = async () => {
    try {
      const { data, error } = await supabaseClient
        .from("santri")
        .select("nis, nama, kelas, jurusan, status_santri")
        .eq("status_santri", "AKTIF")
        .order("nama", { ascending: true });

      if (error) throw error;
      setSantriRows((data || []) as ISantri[]);
    } catch (error) {
      const err = error as Error;
      message.error(`Gagal memuat daftar santri: ${err.message}`);
    }
  };

  const fetchSpecialRates = async (paymentId: number | null = selectedPaymentId) => {
    if (!paymentId) {
      setSpecialRates([]);
      return;
    }
    setLoadingRates(true);
    try {
      const { data, error } = await supabaseClient
        .from("tarif_khusus_santri")
        .select("*, santri:santri_nis(nis, nama, kelas, jurusan, status_santri), ref_jenis_pembayaran:jenis_pembayaran_id(id, nama_pembayaran, nominal_default, tipe, is_aktif)")
        .eq("jenis_pembayaran_id", paymentId)
        .order("is_aktif", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSpecialRates((data || []) as ITarifKhususSantri[]);
    } catch (error) {
      const err = error as Error;
      message.error(`Gagal memuat tarif khusus: ${err.message}`);
    } finally {
      setLoadingRates(false);
    }
  };

  useEffect(() => {
    fetchRows();
    fetchSantriRows();
  }, []);

  useEffect(() => {
    fetchSpecialRates(selectedPaymentId);
  }, [selectedPaymentId]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      tipe: "bulanan",
      nominal_default: 0,
      is_aktif: true,
    } as IRefJenisPembayaran);
    setModalOpen(true);
  };

  const openEdit = (record: IRefJenisPembayaran) => {
    setEditing(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const payload = {
        nama_pembayaran: values.nama_pembayaran.trim(),
        tipe: values.tipe,
        nominal_default: Number(values.nominal_default || 0),
        is_aktif: !!values.is_aktif,
      };

      if (editing) {
        const { error } = await supabaseClient
          .from("ref_jenis_pembayaran")
          .update(payload)
          .eq("id", editing.id);

        if (error) throw error;
        await logActivity({
          user,
          action: "UPDATE",
          resource: "ref_jenis_pembayaran",
          record_id: String(editing.id),
          details: payload,
        });
        message.success("Master pembayaran diperbarui");
      } else {
        const nextId = rows.length ? Math.max(...rows.map((row) => Number(row.id))) + 1 : 1;
        const { data, error } = await supabaseClient
          .from("ref_jenis_pembayaran")
          .insert({ id: nextId, ...payload })
          .select("id")
          .single();

        if (error) throw error;
        await logActivity({
          user,
          action: "CREATE",
          resource: "ref_jenis_pembayaran",
          record_id: data?.id ? String(data.id) : undefined,
          details: payload,
        });
        message.success("Master pembayaran ditambahkan");
      }

      setModalOpen(false);
      await fetchRows();
    } catch (error) {
      const err = error as Error;
      message.error(`Gagal menyimpan: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (record: IRefJenisPembayaran, checked: boolean) => {
    try {
      const { error } = await supabaseClient
        .from("ref_jenis_pembayaran")
        .update({ is_aktif: checked })
        .eq("id", record.id);

      if (error) throw error;
      await logActivity({
        user,
        action: "UPDATE",
        resource: "ref_jenis_pembayaran",
        record_id: String(record.id),
        details: { is_aktif: checked },
      });
      message.success(`Master pembayaran ${checked ? "diaktifkan" : "dinonaktifkan"}`);
      await fetchRows();
    } catch (error) {
      const err = error as Error;
      message.error(`Gagal memperbarui status: ${err.message}`);
    }
  };

  const handleDelete = async (record: IRefJenisPembayaran) => {
    try {
      const { count, error: countError } = await supabaseClient
        .from("tagihan_santri")
        .select("id", { count: "exact", head: true })
        .eq("jenis_pembayaran_id", record.id);

      if (countError) throw countError;
      if ((count || 0) > 0) {
        message.warning("Master ini sudah dipakai tagihan. Nonaktifkan saja agar riwayat tetap aman.");
        return;
      }

      const { error } = await supabaseClient
        .from("ref_jenis_pembayaran")
        .delete()
        .eq("id", record.id);

      if (error) throw error;
      await logActivity({
        user,
        action: "DELETE",
        resource: "ref_jenis_pembayaran",
        record_id: String(record.id),
        details: record,
      });
      message.success("Master pembayaran dihapus");
      await fetchRows();
    } catch (error) {
      const err = error as Error;
      message.error(`Gagal menghapus: ${err.message}`);
    }
  };

  const resetRateForm = () => {
    setEditingRate(null);
    rateForm.resetFields();
    rateForm.setFieldsValue({ is_aktif: true });
  };

  const handleRateSubmit = async () => {
    if (!selectedPayment) {
      message.error("Pilih jenis pembayaran terlebih dahulu.");
      return;
    }
    const values = await rateForm.validateFields();
    setSavingRate(true);
    try {
      const santriNisList = Array.isArray(values.santri_nis) ? values.santri_nis : [values.santri_nis].filter(Boolean);
      const payload = {
        jenis_pembayaran_id: selectedPayment.id,
        nominal_khusus: Number(values.nominal_khusus || 0),
        periode_mulai: null,
        periode_selesai: null,
        is_aktif: !!values.is_aktif,
        keterangan: values.keterangan?.trim() || null,
        created_by: (user as any)?.id || null,
      };

      if (!editingRate && payload.is_aktif) {
        const { data: duplicateRows, error: duplicateError } = await supabaseClient
          .from("tarif_khusus_santri")
          .select("santri_nis")
          .eq("jenis_pembayaran_id", selectedPayment.id)
          .eq("is_aktif", true)
          .in("santri_nis", santriNisList);

        if (duplicateError) throw duplicateError;
        if (duplicateRows?.length) {
          throw new Error("Sebagian santri sudah memiliki tarif khusus aktif untuk jenis pembayaran ini. Nonaktifkan atau edit data lama terlebih dahulu.");
        }
      }

      if (editingRate) {
        const { error } = await supabaseClient
          .from("tarif_khusus_santri")
          .update(payload)
          .eq("id", editingRate.id);

        if (error) throw error;
        await logActivity({
          user,
          action: "UPDATE",
          resource: "tarif_khusus_santri",
          record_id: editingRate.id,
          details: payload,
        });
        message.success("Tarif khusus diperbarui");
      } else {
        const insertRows = santriNisList.map((santriNis: string) => ({
          ...payload,
          santri_nis: santriNis,
        }));

        const { error } = await supabaseClient
          .from("tarif_khusus_santri")
          .insert(insertRows);

        if (error) throw error;
        await logActivity({
          user,
          action: "CREATE",
          resource: "tarif_khusus_santri",
          record_id: String(selectedPayment.id),
          details: { ...payload, santri_count: insertRows.length },
        });
        message.success("Tarif khusus ditambahkan");
      }

      resetRateForm();
      await fetchSpecialRates(selectedPayment.id);
    } catch (error) {
      const err = error as Error;
      message.error(`Gagal menyimpan tarif khusus: ${err.message}`);
    } finally {
      setSavingRate(false);
    }
  };

  const openEditRate = (record: ITarifKhususSantri) => {
    setEditingRate(record);
    rateForm.setFieldsValue({
      santri_nis: record.santri_nis,
      nominal_khusus: record.nominal_khusus,
      is_aktif: record.is_aktif,
      keterangan: record.keterangan,
    });
    window.setTimeout(() => {
      document.getElementById("tarif-khusus-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const handleRateDelete = async (record: ITarifKhususSantri) => {
    if (!selectedPayment) return;
    try {
      const { error } = await supabaseClient
        .from("tarif_khusus_santri")
        .delete()
        .eq("id", record.id);

      if (error) throw error;
      await logActivity({
        user,
        action: "DELETE",
        resource: "tarif_khusus_santri",
        record_id: record.id,
        details: record,
      });
      message.success("Tarif khusus dihapus");
      await fetchSpecialRates(selectedPayment.id);
    } catch (error) {
      const err = error as Error;
      message.error(`Gagal menghapus tarif khusus: ${err.message}`);
    }
  };

  const handleRateToggle = async (record: ITarifKhususSantri, checked: boolean) => {
    if (!selectedPayment) return;
    try {
      const { error } = await supabaseClient
        .from("tarif_khusus_santri")
        .update({ is_aktif: checked })
        .eq("id", record.id);

      if (error) throw error;
      await logActivity({
        user,
        action: "UPDATE",
        resource: "tarif_khusus_santri",
        record_id: record.id,
        details: { is_aktif: checked },
      });
      message.success(`Tarif khusus ${checked ? "diaktifkan" : "dinonaktifkan"}`);
      await fetchSpecialRates(selectedPayment.id);
    } catch (error) {
      const err = error as Error;
      message.error(`Gagal mengubah status tarif khusus: ${err.message}`);
    }
  };

  const columns: ColumnsType<IRefJenisPembayaran> = [
    {
      title: "Nama Pembayaran",
      dataIndex: "nama_pembayaran",
      render: (value, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>ID {record.id}</Text>
        </Space>
      ),
    },
    {
      title: "Tipe",
      dataIndex: "tipe",
      width: 160,
      render: (value) => <Tag color={value === "bulanan" ? "blue" : "gold"}>{typeLabel(value)}</Tag>,
    },
    {
      title: "Nominal Default",
      dataIndex: "nominal_default",
      align: "right",
      width: 180,
      render: (value) => <Text strong>{formatRupiah(value)}</Text>,
    },
    {
      title: "Aktif",
      dataIndex: "is_aktif",
      width: 120,
      render: (value, record) => (
        <Switch
          checked={!!value}
          checkedChildren="Aktif"
          unCheckedChildren="Nonaktif"
          onChange={(checked) => handleToggle(record, checked)}
        />
      ),
    },
    {
      title: "Aksi",
      key: "actions",
      align: "right",
      width: 120,
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Popconfirm
            title="Hapus master pembayaran?"
            description="Hapus hanya aman jika belum pernah dipakai tagihan."
            okText="Hapus"
            cancelText="Batal"
            onConfirm={() => handleDelete(record)}
          >
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const specialRateColumns: ColumnsType<ITarifKhususSantri> = [
    {
      title: "Santri",
      dataIndex: "santri_nis",
      width: 190,
      render: (value, record) => (
        <div style={{ minWidth: 0 }}>
          <Text strong ellipsis style={{ display: "block", maxWidth: 150 }}>
            {record.santri?.nama || value}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {value}
          </Text>
        </div>
      ),
    },
    {
      title: "Rombel",
      width: 96,
      align: "center",
      render: (_, record) => (
        <Text ellipsis style={{ display: "block", fontSize: 12 }}>
          {record.santri?.kelas || "-"} / {record.santri?.jurusan || "-"}
        </Text>
      ),
    },
    {
      title: "Default",
      align: "right",
      width: 112,
      render: () => <Text type="secondary" style={{ fontSize: 12 }}>{formatRupiah(selectedPayment?.nominal_default || 0)}</Text>,
    },
    {
      title: "Khusus",
      dataIndex: "nominal_khusus",
      align: "right",
      width: 112,
      render: (value) => <Text strong style={{ color: token.colorSuccess, fontSize: 12 }}>{formatRupiah(value)}</Text>,
    },
    {
      title: "Status",
      dataIndex: "is_aktif",
      width: 74,
      align: "center",
      render: (value, record) => (
        <Switch
          size="small"
          checked={!!value}
          onChange={(checked) => handleRateToggle(record, checked)}
        />
      ),
    },
    {
      title: "Aksi",
      key: "actions",
      align: "center",
      width: 88,
      render: (_, record) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditRate(record)} />
          <Popconfirm
            title="Hapus tarif khusus?"
            okText="Hapus"
            cancelText="Batal"
            onConfirm={() => handleRateDelete(record)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size={20} style={{ width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <Title level={3} style={{ marginBottom: 4 }}>Master Pembayaran</Title>
            <Text type="secondary">
              Atur nominal default dan tarif khusus santri yang otomatis dibaca saat generate tagihan.
            </Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => { fetchRows(); fetchSpecialRates(); }} loading={loading || loadingRates}>
              Muat Ulang
            </Button>
            <Button icon={<TeamOutlined />} onClick={openTarifTab}>
              Atur Tarif Khusus
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Tambah Master
            </Button>
          </Space>
        </div>

        <Row gutter={[12, 12]}>
          <Col xs={24} md={8}>
            <Card>
              <Statistic title="Total Master" value={rows.length} valueStyle={{ fontWeight: 800 }} prefix={<WalletOutlined />} />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic title="Master Aktif" value={activeCount} valueStyle={{ fontWeight: 800, color: token.colorSuccess }} prefix={<CheckCircleOutlined />} />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic title="Tarif Khusus Aktif" value={activeSpecialRateCount} valueStyle={{ fontWeight: 800, color: token.colorInfo }} prefix={<TeamOutlined />} />
            </Card>
          </Col>
        </Row>

        <Card
          style={{
            borderRadius: 12,
            border: `1px solid ${token.colorBorderSecondary}`,
            boxShadow: "0 10px 28px rgba(15,23,42,0.06)",
          }}
          bodyStyle={{ paddingTop: 8 }}
        >
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: "master",
                label: "Daftar Master",
                children: (
                  <Table
                    rowKey="id"
                    loading={loading}
                    columns={columns}
                    dataSource={rows}
                    pagination={false}
                    scroll={{ x: 760 }}
                  />
                ),
              },
              {
                key: "tarif",
                label: (
                  <Space size={6}>
                    <PercentageOutlined />
                    <span>Tarif Khusus Santri</span>
                  </Space>
                ),
                children: (
                  <Space id="tarif-khusus-section" direction="vertical" size={16} style={{ width: "100%" }}>
                    <Card
                      style={{
                        borderRadius: 12,
                        border: `1px solid ${token.colorPrimaryBorder}`,
                        background: `linear-gradient(135deg, ${token.colorPrimaryBg} 0%, ${token.colorBgContainer} 62%, ${token.colorSuccessBg} 100%)`,
                      }}
                      bodyStyle={{ padding: 18 }}
                    >
                      <Row gutter={[16, 16]} align="middle">
                        <Col xs={24} lg={14}>
                          <Space direction="vertical" size={8} style={{ width: "100%" }}>
                            <Tag color="blue" icon={<InfoCircleOutlined />} style={{ width: "fit-content" }}>
                              Otomatis dibaca saat generate tagihan
                            </Tag>
                            <Title level={4} style={{ margin: 0 }}>
                              Tarif khusus untuk santri tertentu
                            </Title>
                            <Text type="secondary">
                              Gunakan untuk keringanan seperti SPP setengah. Sistem hanya melihat status aktif/nonaktif;
                              tidak ada tanggal berlaku, sehingga daftar santri mudah diaudit.
                            </Text>
                            <Space wrap>
                              <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={() => document.getElementById("tarif-khusus-form")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                              >
                                Input Tarif Khusus
                              </Button>
                              <Button
                                icon={<ReloadOutlined />}
                                loading={loadingRates}
                                onClick={() => fetchSpecialRates()}
                              >
                                Refresh Tarif
                              </Button>
                            </Space>
                          </Space>
                        </Col>
                        <Col xs={24} lg={10}>
                          <Row gutter={[10, 10]}>
                            <Col span={12}>
                              <Card size="small" style={{ borderRadius: 10 }}>
                                <Statistic
                                  title="Master Terpilih"
                                  value={selectedPayment?.nama_pembayaran || "-"}
                                  valueStyle={{ fontSize: 15, fontWeight: 800 }}
                                />
                              </Card>
                            </Col>
                            <Col span={12}>
                              <Card size="small" style={{ borderRadius: 10 }}>
                                <Statistic
                                  title="Nominal Default"
                                  value={selectedPaymentDefaultNominal}
                                  formatter={(value) => formatRupiah(Number(value))}
                                  valueStyle={{ fontSize: 15, fontWeight: 800 }}
                                />
                              </Card>
                            </Col>
                            <Col span={12}>
                              <Card size="small" style={{ borderRadius: 10 }}>
                                <Statistic
                                  title="Tarif Aktif"
                                  value={selectedPaymentActiveRates}
                                  valueStyle={{ fontSize: 18, fontWeight: 800, color: token.colorSuccess }}
                                />
                              </Card>
                            </Col>
                            <Col span={12}>
                              <Card size="small" style={{ borderRadius: 10 }}>
                                <Statistic
                                  title="Rata-rata Khusus"
                                  value={averageSpecialNominal}
                                  formatter={(value) => formatRupiah(Number(value))}
                                  valueStyle={{ fontSize: 15, fontWeight: 800, color: token.colorInfo }}
                                />
                              </Card>
                            </Col>
                          </Row>
                        </Col>
                      </Row>
                    </Card>

                    <Card
                      title={
                        <Space>
                          <WalletOutlined />
                          <span>Pilih Master Pembayaran</span>
                        </Space>
                      }
                      style={{ borderRadius: 12 }}
                    >
                      <Row gutter={[10, 10]}>
                        {rows.map((row) => {
                          const selected = Number(row.id) === Number(selectedPaymentId);
                          return (
                            <Col xs={24} sm={12} lg={8} xl={6} key={row.id}>
                              <Button
                                block
                                onClick={() => {
                                  setSelectedPaymentId(Number(row.id));
                                  resetRateForm();
                                }}
                                style={{
                                  height: "auto",
                                  padding: "12px 14px",
                                  textAlign: "left",
                                  borderRadius: 10,
                                  border: selected ? `1.5px solid ${token.colorPrimary}` : `1px solid ${token.colorBorderSecondary}`,
                                  background: selected ? token.colorPrimaryBg : token.colorBgContainer,
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 800, color: token.colorText, whiteSpace: "normal" }}>
                                      {row.nama_pembayaran}
                                    </div>
                                    <div style={{ fontSize: 12, color: token.colorTextSecondary, marginTop: 4 }}>
                                      {typeLabel(row.tipe)} · {formatRupiah(row.nominal_default)}
                                    </div>
                                  </div>
                                  {selected && <ArrowRightOutlined style={{ color: token.colorPrimary, marginTop: 4 }} />}
                                </div>
                              </Button>
                            </Col>
                          );
                        })}
                      </Row>
                    </Card>

                    <Row gutter={[12, 12]} align="top">
                      <Col xs={24} lg={16}>
                        <Card
                          title={
                            <Space direction="vertical" size={0}>
                              <Text strong>Daftar Santri Tarif Khusus</Text>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {selectedPayment?.nama_pembayaran || "Pilih jenis pembayaran"}
                              </Text>
                            </Space>
                          }
                          extra={<Tag color="blue">Rata-rata {formatRupiah(averageSpecialNominal)}</Tag>}
                          style={{
                            borderRadius: 12,
                            minHeight: 560,
                          }}
                          bodyStyle={{ padding: 12 }}
                        >
                          <Table
                            size="small"
                            rowKey="id"
                            loading={loadingRates}
                            columns={specialRateColumns}
                            dataSource={specialRates}
                            pagination={{
                              pageSize: 10,
                              showSizeChanger: true,
                              pageSizeOptions: [10, 20, 50],
                              showTotal: (total) => `${total} santri`,
                            }}
                            tableLayout="fixed"
                            scroll={{ x: 720, y: 520 }}
                            expandable={{
                              rowExpandable: (record) => !!record.keterangan || !!record.santri,
                              expandedRowRender: (record) => (
                                <div style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                                  gap: 12,
                                  padding: "8px 4px",
                                }}>
                                  <div>
                                    <Text type="secondary" style={{ fontSize: 12 }}>Santri</Text>
                                    <div style={{ fontWeight: 700 }}>{record.santri?.nama || record.santri_nis}</div>
                                  </div>
                                  <div>
                                    <Text type="secondary" style={{ fontSize: 12 }}>Kelas / Jurusan</Text>
                                    <div style={{ fontWeight: 700 }}>
                                      Kelas {record.santri?.kelas || "-"} / {record.santri?.jurusan || "-"}
                                    </div>
                                  </div>
                                  <div>
                                    <Text type="secondary" style={{ fontSize: 12 }}>Keterangan</Text>
                                    <div style={{ fontWeight: 700 }}>{record.keterangan || "-"}</div>
                                  </div>
                                  <div>
                                    <Text type="secondary" style={{ fontSize: 12 }}>Dibuat</Text>
                                    <div style={{ fontWeight: 700 }}>
                                      {record.created_at ? dayjs(record.created_at).format("DD MMM YYYY") : "-"}
                                    </div>
                                  </div>
                                </div>
                              ),
                            }}
                          />
                        </Card>
                      </Col>

                      <Col xs={24} lg={8}>
                        <Card
                          id="tarif-khusus-form"
                          title={
                            <Space>
                              <TeamOutlined />
                              <span>{editingRate ? "Edit Tarif Khusus" : "Input Tarif Khusus"}</span>
                            </Space>
                          }
                          extra={editingRate ? <Button onClick={resetRateForm}>Batal Edit</Button> : null}
                          style={{
                            borderRadius: 12,
                            border: `1px solid ${editingRate ? token.colorWarningBorder : token.colorPrimaryBorder}`,
                            position: "sticky",
                            top: 16,
                          }}
                        >
                          <Form form={rateForm} layout="vertical" initialValues={{ is_aktif: true }}>
                            <Alert
                              type={editingRate ? "warning" : "success"}
                              showIcon
                              style={{ marginBottom: 16 }}
                              message={editingRate ? "Mode edit tarif khusus" : "Form input tarif khusus tersedia di sini"}
                              description={selectedPayment ? `${selectedPayment.nama_pembayaran} default ${formatRupiah(selectedPayment.nominal_default)}` : "Pilih master pembayaran terlebih dahulu"}
                            />
                            <Form.Item label="Jenis Pembayaran Terpilih">
                              <Select
                                value={selectedPaymentId || undefined}
                                placeholder="Pilih jenis pembayaran"
                                onChange={(value) => {
                                  setSelectedPaymentId(Number(value));
                                  resetRateForm();
                                }}
                                options={rows.map((row) => ({
                                  label: `${row.nama_pembayaran} - ${formatRupiah(row.nominal_default)}`,
                                  value: row.id,
                                }))}
                              />
                            </Form.Item>
                            <Form.Item
                              label="Santri"
                              name="santri_nis"
                              rules={[{ required: true, message: "Pilih minimal satu santri" }]}
                            >
                              <Select
                                mode={editingRate ? undefined : "multiple"}
                                disabled={!!editingRate}
                                showSearch
                                placeholder="Pilih santri"
                                optionFilterProp="label"
                                options={santriRows.map((santri) => ({
                                  label: `${santri.nama || santri.nis} - Kelas ${santri.kelas || "-"}`,
                                  value: santri.nis,
                                }))}
                              />
                            </Form.Item>
                            <Form.Item
                              label="Nominal Khusus"
                              name="nominal_khusus"
                              rules={[{ required: true, message: "Nominal khusus wajib diisi" }]}
                            >
                              <InputNumber<number>
                                min={0}
                                precision={0}
                                style={{ width: "100%" }}
                                formatter={(value) => `Rp ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
                                parser={(value) => Number((value || "").replace(/[^\d]/g, ""))}
                              />
                            </Form.Item>
                            <Form.Item label="Keterangan" name="keterangan">
                              <Input.TextArea rows={3} placeholder="Contoh: keringanan SPP setengah" />
                            </Form.Item>
                            <Form.Item label="Status" name="is_aktif" valuePropName="checked">
                              <Switch checkedChildren="Aktif" unCheckedChildren="Nonaktif" />
                            </Form.Item>
                            <Button type="primary" block loading={savingRate} onClick={handleRateSubmit}>
                              {editingRate ? "Simpan Perubahan" : "Tambah Tarif"}
                            </Button>
                          </Form>
                        </Card>
                      </Col>
                    </Row>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      </Space>

      <Modal
        title={editing ? "Edit Master Pembayaran" : "Tambah Master Pembayaran"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        okText="Simpan"
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            label="Nama Pembayaran"
            name="nama_pembayaran"
            rules={[{ required: true, message: "Nama pembayaran wajib diisi" }]}
          >
            <Input placeholder="Contoh: SPP Bulanan, Uang Listrik, Kas Bulanan" />
          </Form.Item>
          <Form.Item
            label="Tipe"
            name="tipe"
            rules={[{ required: true, message: "Tipe wajib dipilih" }]}
          >
            <Select options={paymentTypeOptions} />
          </Form.Item>
          <Form.Item
            label="Nominal Default"
            name="nominal_default"
            rules={[{ required: true, message: "Nominal default wajib diisi" }]}
          >
            <InputNumber<number>
              min={0}
              precision={0}
              style={{ width: "100%" }}
              formatter={(value) => `Rp ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
              parser={(value) => Number((value || "").replace(/[^\d]/g, ""))}
            />
          </Form.Item>
          <Form.Item label="Status" name="is_aktif" valuePropName="checked">
            <Switch checkedChildren="Aktif" unCheckedChildren="Nonaktif" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
