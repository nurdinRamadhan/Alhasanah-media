/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  JADWAL KEGIATAN — SHOW (Detail + Log Notifikasi)                       ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import React from "react";
import { useShow, useNavigation } from "@refinedev/core";
import {
  Card, Row, Col, Tag, Descriptions, Button,
  Image, Empty,
} from "antd";
import {
  EditOutlined, ArrowLeftOutlined, CalendarOutlined,
  ClockCircleOutlined, EnvironmentOutlined, BellOutlined,
  CheckCircleFilled, CloseCircleOutlined, PictureOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { IJadwalKegiatan } from "../../types";
import { useColorMode } from "../../contexts/color-mode";
import { motion } from "framer-motion";

const GOLD = "#C9A84C";
const GOLD_BRIGHT = "#FFD166";

const darkT = {
  bg: "#08070D", card: "#141424", surface: "#0F0F1A",
  border: "rgba(201,168,76,0.13)", borderAccent: "rgba(201,168,76,0.38)",
  text: "#F0EDE5", textSub: "#9E9080", textMuted: "#5C5248",
  divider: "rgba(255,255,255,0.055)",
};
const lightT = {
  bg: "#F7F4EE", card: "#FFFFFF", surface: "#FFFFFF",
  border: "rgba(0,0,0,0.07)", borderAccent: "rgba(201,168,76,0.40)",
  text: "#0A0805", textSub: "#6B5F50", textMuted: "#9E9080",
  divider: "rgba(0,0,0,0.06)",
};

const FREKUENSI_MAP: Record<string, { label: string; color: string }> = {
  harian: { label: "Harian", color: "#60A5FA" },
  mingguan: { label: "Mingguan", color: "#34D399" },
  bulanan: { label: "Bulanan", color: "#A78BFA" },
  tahunan: { label: "Tahunan", color: GOLD_BRIGHT },
  khusus: { label: "Khusus", color: "#F87171" },
};

export const JadwalKegiatanShow = () => {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkT : lightT;
  const { push } = useNavigation();

  const { queryResult } = useShow<IJadwalKegiatan>({
    resource: "jadwal_kegiatan",
    meta: { select: "*, kategori:jadwal_kategori(id, label, warna, icon)" },
  });

  const record = queryResult?.data?.data;
  const isLoading = queryResult?.isLoading;

  if (isLoading) {
    return (
      <div style={{ background: t.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: GOLD, fontSize: 14, fontWeight: 600 }}>Memuat...</div>
      </div>
    );
  }

  if (!record) {
    return (
      <div style={{ background: t.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Empty description="Kegiatan tidak ditemukan" />
      </div>
    );
  }

  const frekuensi = FREKUENSI_MAP[record.frekuensi] || FREKUENSI_MAP.khusus;

  return (
    <div style={{ background: t.bg, minHeight: "100vh", padding: "0 0 80px" }}>
      {/* Header */}
      <div style={{
        background: mode === "dark"
          ? "linear-gradient(135deg,#0E0C07 0%,#151208 50%,#0A0E0C 100%)"
          : "linear-gradient(135deg,#2D2416 0%,#3D3020 50%,#241C10 100%)",
        borderRadius: 24, padding: "24px 28px", margin: "16px 16px 20px",
        position: "relative", overflow: "hidden",
        border: `1px solid ${GOLD}18`,
      }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg,transparent,${GOLD_BRIGHT},${GOLD},transparent)`, opacity: .8 }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => push("/jadwal-kegiatan")}
              style={{ borderRadius: 10, borderColor: "rgba(245,237,216,.2)", color: "#F5EDD8" }} />
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase",
                background: `linear-gradient(90deg,${GOLD},${GOLD_BRIGHT})`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                ◆ Detail Kegiatan ◆
              </div>
              <h1 style={{ margin: 0, fontSize: "clamp(18px,2.5vw,24px)", fontWeight: 800, color: "#F5EDD8", lineHeight: 1.3 }}>
                {record.nama_kegiatan}
              </h1>
            </div>
          </div>
          <Button type="primary" icon={<EditOutlined />}
            onClick={() => push(`/jadwal-kegiatan/edit/${record.id}`)}
            style={{
              background: `linear-gradient(135deg,${GOLD},${GOLD_BRIGHT})`,
              border: "none", color: "#000", fontWeight: 700, borderRadius: 10,
              boxShadow: `0 4px 12px ${GOLD}50`,
            }}>
            Edit
          </Button>
        </div>
      </div>

      <div style={{ padding: "0 16px" }}>
        <Row gutter={20}>
          {/* Main Info */}
          <Col xs={24} md={16}>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }}>
              <Card bordered={false} style={{
                background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, marginBottom: 16,
              }}>
                {/* Image */}
                {record.gambar_url && (
                  <div style={{ marginBottom: 20, borderRadius: 12, overflow: "hidden" }}>
                    <Image src={record.gambar_url} alt={record.nama_kegiatan}
                      style={{ width: "100%", maxHeight: 300, objectFit: "cover", borderRadius: 12 }}
                      preview={{ mask: <PictureOutlined style={{ fontSize: 20 }} /> }} />
                  </div>
                )}

                {/* Badges */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                  <Tag color={frekuensi.color} style={{ borderRadius: 20, padding: "3px 12px", fontWeight: 700 }}>
                    {frekuensi.label}
                  </Tag>
                  {record.kategori && (
                    <Tag color={record.kategori.warna} style={{ borderRadius: 20, padding: "3px 12px", fontWeight: 700 }}>
                      {record.kategori.icon} {record.kategori.label}
                    </Tag>
                  )}
                  <Tag color={record.status === "aktif" ? "success" : record.status === "selesai" ? "default" : "warning"}
                    style={{ borderRadius: 20, padding: "3px 12px", fontWeight: 700 }}>
                    {record.status?.toUpperCase()}
                  </Tag>
                  {record.is_publik && (
                    <Tag color="blue" style={{ borderRadius: 20, padding: "3px 12px" }}>Publik</Tag>
                  )}
                </div>

                {/* Description */}
                {record.deskripsi && (
                  <div style={{
                    padding: "14px 16px", borderRadius: 12, marginBottom: 16,
                    background: mode === "dark" ? "rgba(201,168,76,.06)" : "rgba(201,168,76,.04)",
                    border: `1px solid ${GOLD}20`, borderLeft: `3px solid ${GOLD}60`,
                    fontSize: 13, color: t.textSub, lineHeight: 1.7, fontStyle: "italic",
                  }}>
                    {record.deskripsi}
                  </div>
                )}

                {/* Detail Info */}
                <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small"
                  style={{ background: t.card }}>
                  <Descriptions.Item label={<><CalendarOutlined /> Tanggal</>}>
                    {record.tanggal_mulai ? (
                      <span>
                        {dayjs(record.tanggal_mulai).format("dddd, DD MMMM YYYY")}
                        {record.tanggal_selesai && record.tanggal_selesai !== record.tanggal_mulai && (
                          <> — {dayjs(record.tanggal_selesai).format("DD MMMM YYYY")}</>
                        )}
                      </span>
                    ) : record.catatan_waktu ? (
                      <span style={{ fontStyle: "italic" }}>{record.catatan_waktu}</span>
                    ) : (
                      <span style={{ color: t.textMuted }}>—</span>
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label={<><ClockCircleOutlined /> Waktu</>}>
                    {record.waktu_mulai ? (
                      <span>
                        {record.waktu_mulai?.substring(0, 5)}
                        {record.waktu_selesai && ` — ${record.waktu_selesai?.substring(0, 5)}`}
                      </span>
                    ) : (
                      <span style={{ color: t.textMuted }}>—</span>
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label={<><EnvironmentOutlined /> Lokasi</>} span={2}>
                    {record.lokasi || <span style={{ color: t.textMuted }}>—</span>}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </motion.div>
          </Col>

          {/* Sidebar */}
          <Col xs={24} md={8}>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3, delay: .1 }}>
              {/* Notifikasi */}
              <Card title={<><BellOutlined /> Notifikasi</>} bordered={false}
                style={{
                  background: t.card, border: `1px solid ${t.border}`,
                  borderRadius: 16, marginBottom: 16,
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: record.notifikasi_aktif ? "rgba(52,211,153,.12)" : "rgba(158,144,128,.08)",
                    border: `1px solid ${record.notifikasi_aktif ? "rgba(52,211,153,.28)" : "rgba(158,144,128,.20)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {record.notifikasi_aktif
                      ? <CheckCircleFilled style={{ color: "#34D399", fontSize: 16 }} />
                      : <CloseCircleOutlined style={{ color: "#9E9080", fontSize: 16 }} />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: record.notifikasi_aktif ? "#34D399" : t.textMuted }}>
                      {record.notifikasi_aktif ? "Notifikasi Aktif" : "Tanpa Notifikasi"}
                    </div>
                    <div style={{ fontSize: 11, color: t.textMuted }}>
                      {record.notifikasi_aktif
                        ? `H-${record.notifikasi_hari} s/d H-0`
                        : "Notifikasi dinonaktifkan"}
                    </div>
                  </div>
                </div>
                {record.notifikasi_aktif && record.tanggal_mulai && (
                  <div style={{
                    padding: "10px 12px", borderRadius: 10, fontSize: 12,
                    background: "rgba(96,165,250,.06)", border: "1px solid rgba(96,165,250,.15)",
                    color: "#60A5FA",
                  }}>
                    Notifikasi otomatis dikirim ke wali santri mulai {dayjs(record.tanggal_mulai).subtract(record.notifikasi_hari, "day").format("DD MMM YYYY")} hingga hari acara.
                  </div>
                )}
              </Card>

              {/* Info Tambahan */}
              <Card title="Info Tambahan" bordered={false}
                style={{
                  background: t.card, border: `1px solid ${t.border}`,
                  borderRadius: 16, marginBottom: 16,
                }}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Urutan">{record.urutan || 0}</Descriptions.Item>
                  <Descriptions.Item label="Dibuat">{dayjs(record.created_at).format("DD MMM YYYY HH:mm")}</Descriptions.Item>
                  <Descriptions.Item label="Diupdate">{dayjs(record.updated_at).format("DD MMM YYYY HH:mm")}</Descriptions.Item>
                </Descriptions>
              </Card>
            </motion.div>
          </Col>
        </Row>
      </div>
    </div>
  );
};
