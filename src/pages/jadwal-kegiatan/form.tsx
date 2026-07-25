/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  JADWAL KEGIATAN — FORM (Create / Edit)                                  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useEffect } from "react";
import { Create, Edit, useForm } from "@refinedev/antd";
import {
  Form, Input, Select, DatePicker, TimePicker, Card, Row, Col,
  Switch, Upload, message, InputNumber, Divider, Button, Modal,
} from "antd";
import {
  PictureOutlined, PlusOutlined, DeleteOutlined, BellOutlined,
} from "@ant-design/icons";
import { supabaseClient } from "../../utility/supabaseClient";
import { useGetIdentity } from "@refinedev/core";
import { IJadwalKategori } from "../../types";
import { logActivity } from "../../utility/logger";

interface JadwalKegiatanFormProps {
  isEdit?: boolean;
}

export const JadwalKegiatanForm: React.FC<JadwalKegiatanFormProps> = ({ isEdit = false }) => {
  const { formProps, form, queryResult } = useForm({
    resource: "jadwal_kegiatan",
    onMutationSuccess: (data) => {
      logActivity({
        user,
        action: isEdit ? "UPDATE" : "CREATE",
        resource: "jadwal_kegiatan",
        record_id: data?.data?.id?.toString() || "-",
        details: data?.data,
      });
    },
  });
  const { data: user } = useGetIdentity<{ id: string }>();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [kategoriList, setKategoriList] = useState<IJadwalKategori[]>([]);
  const [showAddKategori, setShowAddKategori] = useState(false);
  const [newKategoriLabel, setNewKategoriLabel] = useState("");
  const [newKategoriWarna, setNewKategoriWarna] = useState("#1890ff");

  // Fetch kategori list
  useEffect(() => {
    supabaseClient.from("jadwal_kategori").select("*").eq("aktif", true).order("urutan")
      .then(({ data }) => setKategoriList(data || []));
  }, []);

  // Set image URL from existing data (edit mode)
  useEffect(() => {
    if (isEdit && queryResult?.data?.data?.gambar_url) {
      setImageUrl(queryResult.data.data.gambar_url);
    }
  }, [isEdit, queryResult?.data?.data?.gambar_url]);

  // Watch frekuensi to show/hide fields
  const frekuensi = Form.useWatch("frekuensi", form);

  // Upload handler
  const handleUpload = async (options: any) => {
    const { file, onSuccess, onError } = options;
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}.${fileExt}`;
    setUploading(true);
    try {
      const { error: uploadError } = await supabaseClient.storage
        .from("jadwal-gambar").upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data } = supabaseClient.storage.from("jadwal-gambar").getPublicUrl(fileName);
      setImageUrl(data.publicUrl);
      form.setFieldValue("gambar_url", data.publicUrl);
      onSuccess("Ok");
      message.success("Gambar berhasil diupload");
    } catch (error: any) {
      message.error("Gagal upload: " + error.message);
      onError({ error });
    } finally {
      setUploading(false);
    }
  };

  // Add new kategori
  const handleAddKategori = async () => {
    if (!newKategoriLabel.trim()) return;
    const id = `custom_${Date.now()}`;
    const { data, error } = await supabaseClient.from("jadwal_kategori").insert({
      id, label: newKategoriLabel.trim(), warna: newKategoriWarna,
      is_custom: true, urutan: kategoriList.length + 1, aktif: true,
    }).select().single();
    if (error) { message.error("Gagal tambah kategori"); return; }
    setKategoriList(prev => [...prev, data]);
    form.setFieldValue("kategori_id", id);
    setShowAddKategori(false);
    setNewKategoriLabel("");
    message.success("Kategori berhasil ditambahkan");
  };

  const showDateFields = frekuensi === "tahunan" || frekuensi === "khusus";
  const showCatatanWaktu = frekuensi === "mingguan" || frekuensi === "bulanan";

  return (
    <Form
      {...formProps}
      layout="vertical"
      initialValues={{
        status: "aktif",
        is_publik: true,
        notifikasi_aktif: false,
        notifikasi_hari: 3,
        urutan: 0,
        frekuensi: "harian",
        ...formProps.initialValues,
      }}
      onValuesChange={(changed) => {
        // Reset date fields when frekuensi changes
        if (changed.frekuensi) {
          if (changed.frekuensi === "harian" || changed.frekuensi === "mingguan" || changed.frekuensi === "bulanan") {
            form.setFieldsValue({ tanggal_mulai: undefined, tanggal_selesai: undefined });
          }
          if (changed.frekuensi === "harian" || changed.frekuensi === "tahunan" || changed.frekuensi === "khusus") {
            form.setFieldsValue({ catatan_waktu: undefined });
          }
        }
      }}
    >
      {/* Hidden fields */}
      <Form.Item name="gambar_url" hidden><Input /></Form.Item>
      <Form.Item name="created_by" hidden><Input /></Form.Item>

      <Row gutter={24}>
        {/* LEFT COLUMN */}
        <Col xs={24} md={16}>
          {/* Info Dasar */}
          <Card title="Informasi Kegiatan" bordered={false}
            style={{ marginBottom: 16, borderRadius: 16 }}>
            <Form.Item label="Nama Kegiatan" name="nama_kegiatan"
              rules={[{ required: true, message: "Wajib diisi" }]}>
              <Input placeholder="Contoh: Pengajian Akbar Bulanan" size="large"
                style={{ fontWeight: 600 }} />
            </Form.Item>

            <Form.Item label="Deskripsi / Keterangan" name="deskripsi">
              <Input.TextArea rows={3}
                placeholder="Deskripsi singkat tentang kegiatan..." />
            </Form.Item>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="Kategori" name="kategori_id"
                  rules={[{ required: true, message: "Pilih kategori" }]}>
                  <Select placeholder="Pilih kategori"
                    dropdownRender={(menu) => (
                      <div>
                        {menu}
                        <Divider style={{ margin: "8px 0" }} />
                        <Button type="link" icon={<PlusOutlined />}
                          onClick={() => setShowAddKategori(true)}
                          style={{ width: "100%" }}>
                          Tambah Kategori Baru
                        </Button>
                      </div>
                    )}>
                    {kategoriList.map(k => (
                      <Select.Option key={k.id} value={k.id}>
                        <span style={{ color: k.warna }}>{k.icon}</span> {k.label}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Frekuensi" name="frekuensi"
                  rules={[{ required: true }]}>
                  <Select placeholder="Pilih frekuensi">
                    <Select.Option value="harian">Harian</Select.Option>
                    <Select.Option value="mingguan">Mingguan</Select.Option>
                    <Select.Option value="bulanan">Bulanan</Select.Option>
                    <Select.Option value="tahunan">Tahunan</Select.Option>
                    <Select.Option value="khusus">Khusus / Satu Kali</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label="Lokasi" name="lokasi"
              rules={[{ required: true, message: "Wajib diisi" }]}>
              <Input placeholder="Contoh: Aula Utama, Masjid, dll" />
            </Form.Item>
          </Card>

          {/* Waktu Pelaksanaan */}
          <Card title="Waktu Pelaksanaan" bordered={false}
            style={{ marginBottom: 16, borderRadius: 16 }}>
            {/* Tanggal untuk Tahunan/Khusus */}
            {showDateFields && (
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item label="Tanggal Mulai" name="tanggal_mulai">
                    <DatePicker format="DD MMM YYYY" style={{ width: "100%" }}
                      placeholder="Pilih tanggal" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Tanggal Selesai" name="tanggal_selesai"
                    help="Kosongkan jika satu hari saja">
                    <DatePicker format="DD MMM YYYY" style={{ width: "100%" }}
                      placeholder="Pilih tanggal selesai" />
                  </Form.Item>
                </Col>
              </Row>
            )}

            {/* Catatan Waktu untuk Mingguan/Bulanan */}
            {showCatatanWaktu && (
              <Form.Item label="Catatan Waktu" name="catatan_waktu"
                help="Contoh: 'Setiap hari Sabtu', 'Malam Jum'at pertama tiap bulan'">
                <Input placeholder="Contoh: Setiap hari Sabtu" />
              </Form.Item>
            )}

            {/* Jam untuk semua frekuensi */}
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="Jam Mulai" name="waktu_mulai">
                  <TimePicker format="HH:mm" style={{ width: "100%" }}
                    placeholder="Pilih jam" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Jam Selesai" name="waktu_selesai">
                  <TimePicker format="HH:mm" style={{ width: "100%" }}
                    placeholder="Pilih jam selesai" />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* Notifikasi */}
          <Card
            title={
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <BellOutlined />
                <span>Pengaturan Notifikasi</span>
              </div>
            }
            bordered={false}
            style={{ marginBottom: 16, borderRadius: 16 }}>
            <div style={{
              padding: "14px 16px", borderRadius: 12,
              background: "rgba(201,168,76,.06)", border: "1px solid rgba(201,168,76,.15)",
            }}>
              <Form.Item name="notifikasi_aktif" valuePropName="checked" noStyle>
                <Switch />
              </Form.Item>
              <span style={{ marginLeft: 10, fontWeight: 700, fontSize: 13 }}>
                Aktifkan Notifikasi Otomatis
              </span>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "#9E9080" }}>
                Sistem akan mengirim notifikasi push ke wali santri secara otomatis sebelum acara dimulai.
              </p>
            </div>

            <Form.Item noStyle shouldUpdate={(prev, cur) => prev.notifikasi_aktif !== cur.notifikasi_aktif}>
              {({ getFieldValue }) => getFieldValue("notifikasi_aktif") && (
                <div style={{ marginTop: 16 }}>
                  <Form.Item label="Kirim Notifikasi (hari sebelum acara)" name="notifikasi_hari">
                    <Select>
                      <Select.Option value={1}>1 hari sebelum (H-1)</Select.Option>
                      <Select.Option value={2}>2 hari sebelum (H-2)</Select.Option>
                      <Select.Option value={3}>3 hari sebelum (H-3) — Default</Select.Option>
                      <Select.Option value={5}>5 hari sebelum (H-5)</Select.Option>
                      <Select.Option value={7}>7 hari sebelum (H-7)</Select.Option>
                    </Select>
                  </Form.Item>
                  <div style={{
                    padding: "10px 14px", borderRadius: 10, fontSize: 12,
                    background: "rgba(52,211,153,.06)", border: "1px solid rgba(52,211,153,.15)", color: "#34D399",
                  }}>
                    Notifikasi akan dikirim setiap hari ke wali santri, dari H-X hingga H-0 (hari acara).
                  </div>
                </div>
              )}
            </Form.Item>
          </Card>
        </Col>

        {/* RIGHT COLUMN */}
        <Col xs={24} md={8}>
          {/* Gambar */}
          <Card title="Gambar (Opsional)" bordered={false}
            style={{ marginBottom: 16, borderRadius: 16 }}>
            <Form.Item label="Gambar Kegiatan">
              <Upload
                customRequest={handleUpload}
                showUploadList={false}
                accept="image/*"
                style={{ display: "block", width: "100%" }}>
                <div style={{
                  width: "100%", height: 180, overflow: "hidden",
                  position: "relative", display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", cursor: "pointer",
                  borderRadius: 12, border: "2px dashed #d9d9d9",
                  backgroundColor: "#fafafa", transition: "all 0.3s",
                }}>
                  {imageUrl ? (
                    <img src={imageUrl} alt="Preview"
                      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : uploading ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 24, height: 24, border: "2px solid #1890ff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                      <span style={{ fontSize: 12 }}>Mengunggah...</span>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", color: "#9E9080", padding: 16 }}>
                      <PictureOutlined style={{ fontSize: 32, marginBottom: 8, display: "block" }} />
                      <div style={{ fontSize: 12, fontWeight: 600 }}>Klik atau Seret Gambar</div>
                      <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4 }}>JPG, PNG, WebP (Maks. 2MB)</div>
                    </div>
                  )}
                </div>
              </Upload>
              {imageUrl && (
                <Button danger icon={<DeleteOutlined />} size="small"
                  onClick={() => { setImageUrl(null); form.setFieldValue("gambar_url", null); }}
                  style={{ marginTop: 8, borderRadius: 8 }}>
                  Hapus Gambar
                </Button>
              )}
            </Form.Item>
          </Card>

          {/* Pengaturan */}
          <Card title="Pengaturan" bordered={false}
            style={{ marginBottom: 16, borderRadius: 16 }}>
            <Form.Item label="Urutan Tampilan" name="urutan"
              help="Menentukan urutan kegiatan di tampilan publik">
              <InputNumber min={0} max={999} style={{ width: "100%" }} />
            </Form.Item>

            <Form.Item label="Status" name="status">
              <Select>
                <Select.Option value="aktif">Aktif</Select.Option>
                <Select.Option value="nonaktif">Nonaktif</Select.Option>
                <Select.Option value="selesai">Selesai</Select.Option>
              </Select>
            </Form.Item>

            <div style={{
              padding: "12px 14px", borderRadius: 12,
              background: "rgba(0,0,0,.03)", border: "1px solid rgba(0,0,0,.06)",
            }}>
              <Form.Item name="is_publik" valuePropName="checked" noStyle>
                <Switch />
              </Form.Item>
              <span style={{ marginLeft: 10, fontWeight: 600, fontSize: 12 }}>
                Tampilkan untuk Publik
              </span>
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "#9E9080" }}>
                Jika aktif, kegiatan akan terlihat oleh publik dan wali santri tanpa login.
              </p>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Modal Tambah Kategori */}
      <Modal
        open={showAddKategori}
        title="Tambah Kategori Baru"
        onCancel={() => setShowAddKategori(false)}
        onOk={handleAddKategori}
        okText="Tambah"
        cancelText="Batal">
        <Form layout="vertical">
          <Form.Item label="Nama Kategori" required>
            <Input value={newKategoriLabel} onChange={e => setNewKategoriLabel(e.target.value)}
              placeholder="Contoh: Olahraga" />
          </Form.Item>
          <Form.Item label="Warna">
            <input type="color" value={newKategoriWarna}
              onChange={e => setNewKategoriWarna(e.target.value)}
              style={{ width: 48, height: 36, border: "none", borderRadius: 8, cursor: "pointer" }} />
          </Form.Item>
        </Form>
      </Modal>
    </Form>
  );
};

// Wrapper untuk Create dan Edit
export const JadwalKegiatanCreate = () => (
  <Create title="Tambah Kegiatan Baru" saveButtonProps={{ size: "large" }}>
    <JadwalKegiatanForm />
  </Create>
);

export const JadwalKegiatanEdit = () => (
  <Edit title="Edit Kegiatan" saveButtonProps={{ size: "large" }}>
    <JadwalKegiatanForm isEdit />
  </Edit>
);
