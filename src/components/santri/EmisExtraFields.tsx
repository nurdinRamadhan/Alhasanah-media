import { Col, Form, Input, Row, Select } from "antd";
import {
  BLOOD_TYPE_OPTIONS,
  EXIT_REASON_OPTIONS,
  HOME_OWNERSHIP_OPTIONS,
  JENJANG_PESANTREN_OPTIONS,
  REGISTRATION_TYPE_OPTIONS,
  RESIDENCE_OPTIONS,
  TRANSPORTATION_OPTIONS,
  npsnRules,
} from "./emisOptions";

export const cleanEmisExtra = (value: Record<string, any> | undefined | null) => {
  if (!value || typeof value !== "object") return {};

  return Object.entries(value).reduce<Record<string, any>>((acc, [key, raw]) => {
    const next = typeof raw === "string" ? raw.trim() : raw;
    if (next === undefined || next === null || next === "") return acc;
    acc[key] = next;
    return acc;
  }, {});
};

export const EmisExtraFields = () => (
  <Row gutter={16}>
    <Col xs={24} md={8}>
      <Form.Item label="Jenjang Pesantren" name={["emis_extra_fields", "jenjang_pesantren"]} rules={[{ required: true, message: "Jenjang wajib diisi." }]}>
        <Select showSearch optionFilterProp="label" options={JENJANG_PESANTREN_OPTIONS} />
      </Form.Item>
    </Col>
    <Col xs={24} md={8}>
      <Form.Item label="Jenis Pendaftaran" name={["emis_extra_fields", "jenis_pendaftaran"]} rules={[{ required: true, message: "Jenis pendaftaran wajib diisi." }]}>
        <Select options={REGISTRATION_TYPE_OPTIONS} />
      </Form.Item>
    </Col>
    <Col xs={24} md={8}>
      <Form.Item label="Status Kepemilikan Rumah" name={["emis_extra_fields", "status_kepemilikan_rumah"]}>
        <Select allowClear showSearch optionFilterProp="label" options={HOME_OWNERSHIP_OPTIONS} />
      </Form.Item>
    </Col>
    <Col xs={24} md={8}>
      <Form.Item label="Golongan Darah" name={["emis_extra_fields", "golongan_darah"]}>
        <Select allowClear options={BLOOD_TYPE_OPTIONS} />
      </Form.Item>
    </Col>
    <Col xs={24} md={8}>
      <Form.Item label="Alasan Keluar" name={["emis_extra_fields", "alasan_keluar_kode"]}>
        <Select allowClear showSearch optionFilterProp="label" options={EXIT_REASON_OPTIONS} />
      </Form.Item>
    </Col>
    <Col xs={24} md={8}>
      <Form.Item label="No. Akta Lahir" name={["emis_extra_fields", "nomor_akta_lahir"]}>
        <Input />
      </Form.Item>
    </Col>
    <Col xs={24} md={8}>
      <Form.Item label="Asal Sekolah" name={["emis_extra_fields", "asal_sekolah"]}>
        <Input />
      </Form.Item>
    </Col>
    <Col xs={24} md={8}>
      <Form.Item label="NPSN Asal Sekolah" name={["emis_extra_fields", "npsn_asal_sekolah"]} rules={npsnRules}>
        <Input maxLength={8} />
      </Form.Item>
    </Col>
    <Col xs={24} md={8}>
      <Form.Item label="No. Ijazah" name={["emis_extra_fields", "nomor_ijazah"]}>
        <Input />
      </Form.Item>
    </Col>
    <Col xs={24} md={8}>
      <Form.Item label="No. SKHUN" name={["emis_extra_fields", "nomor_skhun"]}>
        <Input />
      </Form.Item>
    </Col>
    <Col xs={24} md={8}>
      <Form.Item label="Transportasi" name={["emis_extra_fields", "transportasi"]}>
        <Select allowClear showSearch optionFilterProp="label" options={TRANSPORTATION_OPTIONS} />
      </Form.Item>
    </Col>
    <Col xs={24} md={8}>
      <Form.Item label="Tinggal Bersama" name={["emis_extra_fields", "tinggal_bersama"]}>
        <Select allowClear showSearch optionFilterProp="label" options={RESIDENCE_OPTIONS} />
      </Form.Item>
    </Col>
    <Col xs={24} md={8}>
      <Form.Item label="Hobi" name={["emis_extra_fields", "hobi"]}>
        <Input />
      </Form.Item>
    </Col>
    <Col xs={24} md={8}>
      <Form.Item label="Cita-cita" name={["emis_extra_fields", "cita_cita"]}>
        <Input />
      </Form.Item>
    </Col>
    <Col xs={24} md={12}>
      <Form.Item label="Bahasa Sehari-hari" name={["emis_extra_fields", "bahasa_sehari_hari"]}>
        <Input />
      </Form.Item>
    </Col>
    <Col xs={24} md={12}>
      <Form.Item label="Riwayat Penyakit" name={["emis_extra_fields", "riwayat_penyakit"]}>
        <Input placeholder="Kosongkan bila tidak ada" />
      </Form.Item>
    </Col>
    <Col xs={24}>
      <Form.Item label="Catatan EMIS Tambahan" name={["emis_extra_fields", "catatan"]}>
        <Input.TextArea rows={2} placeholder="Catatan tambahan yang belum memiliki kolom khusus" />
      </Form.Item>
    </Col>
  </Row>
);
