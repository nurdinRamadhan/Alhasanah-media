import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Col, Form, Input, InputNumber, Row, Select, Space, Typography, message } from "antd";
import { AimOutlined } from "@ant-design/icons";
import { supabaseClient } from "../../utility/supabaseClient";

type WilayahItem = {
  id: string;
  name: string;
};

type Props = {
  form: any;
};

const API_BASE = "https://www.emsifa.com/api-wilayah-indonesia/api";

const fetchWilayah = async (path: string): Promise<WilayahItem[]> => {
  const res = await fetch(`${API_BASE}/${path}`);
  if (!res.ok) throw new Error("Gagal memuat data wilayah.");
  return res.json();
};

const toOptions = (items: WilayahItem[]) => items.map((item) => ({ label: item.name, value: item.id }));

export const IndonesiaLocationFields = ({ form }: Props) => {
  const [provinces, setProvinces] = useState<WilayahItem[]>([]);
  const [regencies, setRegencies] = useState<WilayahItem[]>([]);
  const [districts, setDistricts] = useState<WilayahItem[]>([]);
  const [villages, setVillages] = useState<WilayahItem[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  const provinceId = Form.useWatch("province_id", form);
  const regencyId = Form.useWatch("regency_id", form);
  const districtId = Form.useWatch("kecamatan_id", form);

  const provinceMap = useMemo(() => new Map(provinces.map((item) => [item.id, item.name])), [provinces]);
  const regencyMap = useMemo(() => new Map(regencies.map((item) => [item.id, item.name])), [regencies]);
  const districtMap = useMemo(() => new Map(districts.map((item) => [item.id, item.name])), [districts]);
  const villageMap = useMemo(() => new Map(villages.map((item) => [item.id, item.name])), [villages]);

  useEffect(() => {
    fetchWilayah("provinces.json")
      .then((items) => {
        setProvinces(items);
        setApiError(null);
      })
      .catch((error) => setApiError(error.message));
  }, []);

  useEffect(() => {
    if (!provinceId) {
      setRegencies([]);
      return;
    }
    fetchWilayah(`regencies/${provinceId}.json`)
      .then((items) => {
        setRegencies(items);
        setApiError(null);
      })
      .catch((error) => setApiError(error.message));
  }, [provinceId]);

  useEffect(() => {
    if (!regencyId) {
      setDistricts([]);
      return;
    }
    fetchWilayah(`districts/${regencyId}.json`)
      .then((items) => {
        setDistricts(items);
        setApiError(null);
      })
      .catch((error) => setApiError(error.message));
  }, [regencyId]);

  useEffect(() => {
    if (!districtId) {
      setVillages([]);
      return;
    }
    fetchWilayah(`villages/${districtId}.json`)
      .then((items) => {
        setVillages(items);
        setApiError(null);
      })
      .catch((error) => setApiError(error.message));
  }, [districtId]);

  const setNameFromSelection = (field: string, id: string | undefined, map: Map<string, string>) => {
    form.setFieldValue(field, id ? map.get(id) : undefined);
    form.setFieldValue("geocode_status", "PENDING");
  };

  const buildAddress = () => {
    const values = form.getFieldsValue([
      "alamat_lengkap",
      "rt",
      "rw",
      "desa_kelurahan",
      "kecamatan_nama",
      "kecamatan_id",
      "kabupaten_kota",
      "provinsi",
      "kode_pos",
    ]);

    return [
      values.alamat_lengkap,
      values.rt ? `RT ${values.rt}` : null,
      values.rw ? `RW ${values.rw}` : null,
      values.desa_kelurahan,
      values.kecamatan_nama || values.kecamatan_id,
      values.kabupaten_kota,
      values.provinsi,
      values.kode_pos,
      "Indonesia",
    ]
      .filter(Boolean)
      .join(", ");
  };

  const runGeocode = async () => {
    const address = buildAddress();
    if (!address || address === "Indonesia") {
      message.warning("Lengkapi alamat atau wilayah sebelum geocode otomatis.");
      return;
    }

    setGeocoding(true);
    try {
      const { data, error } = await supabaseClient.functions.invoke("geocode-single", {
        body: { address },
      });

      if (error) throw error;
      if (data?.found === false) throw new Error(data.message || "Alamat tidak ditemukan oleh layanan geocode.");
      if (!data?.lat || !data?.lon) throw new Error("Koordinat tidak ditemukan dari layanan geocode.");

      form.setFieldsValue({
        latitude: Number(data.lat),
        longitude: Number(data.lon),
        geocode_status: "GEOCODED",
        geocode_provider: "nominatim",
        geocode_confidence: data.confidence ?? 1,
        geocoded_at: new Date().toISOString(),
        emis_extra_fields: {
          ...(form.getFieldValue("emis_extra_fields") || {}),
          geocode_display_name: data.display_name,
          geocode_matched_query: data.matched_query,
        },
      });
      message.success(
        data.confidence && data.confidence < 0.8
          ? "Koordinat ditemukan dari area administratif. Periksa kembali titiknya."
          : "Latitude dan longitude berhasil diisi otomatis.",
      );
    } catch (error: any) {
      form.setFieldValue("geocode_status", "FAILED");
      message.error(error.message || "Geocode otomatis gagal.");
    } finally {
      setGeocoding(false);
    }
  };

  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      {apiError && (
        <Alert
          type="warning"
          showIcon
          message="Dropdown wilayah gagal dimuat"
          description="Input nama provinsi, kabupaten/kota, kecamatan, dan desa secara manual."
        />
      )}
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item label="Provinsi" name="province_id">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={toOptions(provinces)}
              onChange={(id) => {
                form.setFieldsValue({ regency_id: undefined, kecamatan_id: undefined, village_id: undefined, kabupaten_kota: undefined, desa_kelurahan: undefined });
                setNameFromSelection("provinsi", id, provinceMap);
              }}
              placeholder="Pilih provinsi"
            />
          </Form.Item>
          <Form.Item name="provinsi" hidden><Input /></Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="Kabupaten/Kota" name="regency_id">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              disabled={!provinceId}
              options={toOptions(regencies)}
              onChange={(id) => {
                form.setFieldsValue({ kecamatan_id: undefined, village_id: undefined, desa_kelurahan: undefined });
                setNameFromSelection("kabupaten_kota", id, regencyMap);
              }}
              placeholder="Pilih kabupaten/kota"
            />
          </Form.Item>
          <Form.Item name="kabupaten_kota" hidden><Input /></Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="Kecamatan" name="kecamatan_id">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              disabled={!regencyId}
              options={toOptions(districts)}
              onChange={(id) => {
                form.setFieldsValue({ village_id: undefined });
                form.setFieldValue("kecamatan_nama", id ? districtMap.get(id) : undefined);
                form.setFieldValue("geocode_status", "PENDING");
              }}
              placeholder="Pilih kecamatan"
            />
          </Form.Item>
          <Form.Item name="kecamatan_nama" hidden><Input /></Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="Desa/Kelurahan" name="village_id">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              disabled={!districtId}
              options={toOptions(villages)}
              onChange={(id) => setNameFromSelection("desa_kelurahan", id, villageMap)}
              placeholder="Pilih desa/kelurahan"
            />
          </Form.Item>
          <Form.Item name="desa_kelurahan" hidden><Input /></Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={24} md={6}><Form.Item label="RT" name="rt"><Input /></Form.Item></Col>
        <Col xs={24} md={6}><Form.Item label="RW" name="rw"><Input /></Form.Item></Col>
        <Col xs={24} md={6}><Form.Item label="Kode Pos" name="kode_pos"><Input /></Form.Item></Col>
        <Col xs={24} md={6}><Form.Item label="Jarak Rumah (km)" name="jarak_rumah_km"><InputNumber style={{ width: "100%" }} min={0} /></Form.Item></Col>
        <Col xs={24}>
          <Form.Item label="Alamat Lengkap" name="alamat_lengkap">
            <Input.TextArea rows={2} placeholder="Nama jalan, nomor rumah, dusun/kampung, patokan alamat" />
          </Form.Item>
        </Col>
      </Row>
      <Space direction="vertical" size={6}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Latitude/longitude bisa diisi otomatis dari alamat dan dropdown wilayah.
        </Typography.Text>
        <Button icon={<AimOutlined />} loading={geocoding} onClick={runGeocode}>
          Isi Koordinat Otomatis
        </Button>
      </Space>
      <Row gutter={16}>
        <Col xs={24} md={8}><Form.Item label="Latitude" name="latitude"><InputNumber style={{ width: "100%" }} /></Form.Item></Col>
        <Col xs={24} md={8}><Form.Item label="Longitude" name="longitude"><InputNumber style={{ width: "100%" }} /></Form.Item></Col>
        <Col xs={24} md={8}><Form.Item label="Status Geocode" name="geocode_status"><Select options={["PENDING", "GEOCODED", "FAILED", "MANUAL"].map((value) => ({ label: value, value }))} /></Form.Item></Col>
      </Row>
      <Form.Item name="geocode_provider" hidden><Input /></Form.Item>
      <Form.Item name="geocode_confidence" hidden><InputNumber /></Form.Item>
      <Form.Item name="geocoded_at" hidden><Input /></Form.Item>
    </Space>
  );
};
