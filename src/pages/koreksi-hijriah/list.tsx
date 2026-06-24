import React, { useState, useEffect } from "react";
import {
    Button, Typography, Space, Select, DatePicker, Input, InputNumber,
    Table, message, Popconfirm, Card, Tag, theme, Tooltip, Switch,
} from "antd";
import {
    PlusOutlined, DeleteOutlined, ReloadOutlined, CheckCircleOutlined,
    CloseCircleOutlined,
} from "@ant-design/icons";
import { supabaseClient } from "../../utility/supabaseClient";
import { HIJRI_MONTHS } from "../../utility/dateHelper";
import { useHijriCorrection } from "../../hooks/useHijriCorrection";
import hijriConverter from "hijri-converter";
import dayjs from "dayjs";

const { Text, Title } = Typography;
const { useToken } = theme;

interface BulanKoreksiRow {
    tahun_hijriah: number;
    bulan_hijriah_number: number;
    tanggal_awal_masehi: string;
    panjang_bulan: number;
    verified: boolean;
    keterangan: string | null;
    created_at: string;
    updated_at: string;
}

const bulanOptions = HIJRI_MONTHS.map((name, i) => ({ label: name, value: i + 1 }));

export const KoreksiHijriahList: React.FC = () => {
    const { token } = useToken();
    const [rows, setRows] = useState<BulanKoreksiRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [tahunHijriah, setTahunHijriah] = useState<number>(0);
    const [bulanHijriah, setBulanHijriah] = useState(1);
    const [tanggalAwal, setTanggalAwal] = useState<dayjs.Dayjs | null>(null);
    const [panjangBulan, setPanjangBulan] = useState<30 | 29>(30);
    const [verified, setVerified] = useState(false);
    const [keterangan, setKeterangan] = useState("");

    const { refresh: refreshCache } = useHijriCorrection();

    const fetchRows = async () => {
        setLoading(true);
        const { data } = await supabaseClient
            .from("koreksi_bulan_hijriah")
            .select("*")
            .order("tahun_hijriah", { ascending: false })
            .order("bulan_hijriah_number", { ascending: false });
        setRows(data || []);
        setLoading(false);
    };

    useEffect(() => { fetchRows(); }, []);

    const autoFill = (tahun: number, bulan: number) => {
        if (!tahun || !bulan) return;
        const approxGreg = Math.round(622 + (tahun - 1) * 354.367 / 365.2425);
        const startDate = dayjs().year(approxGreg - 1).startOf("year");
        for (let i = 0; i < 800; i++) {
            const d = startDate.add(i, "day");
            const h = hijriConverter.toHijri(d.year(), d.month() + 1, d.date());
            if (h.hy === tahun && h.hm === bulan && h.hd === 1) {
                setTanggalAwal(d);
                return;
            }
        }
    };

    const handleTahunBulanChange = () => {
        if (tahunHijriah && bulanHijriah) {
            autoFill(tahunHijriah, bulanHijriah);
        }
    };

    const resetForm = () => {
        setTahunHijriah(0);
        setBulanHijriah(1);
        setTanggalAwal(null);
        setPanjangBulan(30);
        setVerified(false);
        setKeterangan("");
    };

    const handleSave = async () => {
        if (!tahunHijriah) { message.warning("Isi Tahun Hijriah"); return; }
        if (!tanggalAwal) { message.warning("Isi Tanggal Awal Masehi"); return; }
        setSaving(true);
        try {
            const payload = {
                tahun_hijriah: tahunHijriah,
                bulan_hijriah_number: bulanHijriah,
                tanggal_awal_masehi: tanggalAwal.format("YYYY-MM-DD"),
                panjang_bulan: panjangBulan,
                verified,
                keterangan: keterangan.trim() || null,
            };
            const { error } = await supabaseClient
                .from("koreksi_bulan_hijriah")
                .upsert(payload, { onConflict: "tahun_hijriah,bulan_hijriah_number" });

            if (error) throw error;
            message.success("Koreksi bulan tersimpan");
            refreshCache();
            resetForm();
            fetchRows();
        } catch (e: any) {
            message.error("Gagal: " + (e.message || "Error"));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (tahun: number, bulan: number) => {
        try {
            await supabaseClient
                .from("koreksi_bulan_hijriah")
                .delete()
                .eq("tahun_hijriah", tahun)
                .eq("bulan_hijriah_number", bulan);
            message.success("Koreksi dihapus");
            refreshCache();
            fetchRows();
        } catch (e: any) {
            message.error("Gagal hapus: " + (e.message || "Error"));
        }
    };

    const columns = [
        {
            title: "Bulan H",
            key: "bulan",
            width: 160,
            render: (_: any, r: BulanKoreksiRow) =>
                `${HIJRI_MONTHS[r.bulan_hijriah_number - 1]} ${r.tahun_hijriah} H`,
        },
        {
            title: "Awal Masehi",
            dataIndex: "tanggal_awal_masehi",
            key: "awal",
            width: 140,
            render: (v: string) => dayjs(v).format("DD/MM/YYYY"),
        },
        {
            title: "Panjang",
            dataIndex: "panjang_bulan",
            key: "panjang",
            width: 80,
            render: (v: number) => `${v} hari`,
        },
        {
            title: "Status",
            key: "status",
            width: 100,
            render: (_: any, r: BulanKoreksiRow) => r.verified
                ? <Tag icon={<CheckCircleOutlined />} color="success">Verified</Tag>
                : <Tag icon={<CloseCircleOutlined />} color="warning">Unverified</Tag>,
        },
        {
            title: "Keterangan",
            dataIndex: "keterangan",
            key: "ket",
            render: (v: string) => v || <Text type="secondary">—</Text>,
        },
        {
            title: "Aksi",
            key: "aksi",
            width: 80,
            render: (_: any, r: BulanKoreksiRow) => (
                <Tooltip title="Hapus koreksi bulan ini">
                    <Popconfirm
                        title="Hapus koreksi bulan ini?"
                        description={`${HIJRI_MONTHS[r.bulan_hijriah_number - 1]} ${r.tahun_hijriah} H`}
                        onConfirm={() => handleDelete(r.tahun_hijriah, r.bulan_hijriah_number)}
                        okText="Hapus"
                        cancelText="Batal"
                        okButtonProps={{ danger: true }}
                    >
                        <Button danger size="small" icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Tooltip>
            ),
        },
    ];

    return (
        <div style={{ padding: "0 0 80px" }}>
            <div style={{ marginBottom: 16 }}>
                <Title level={4} style={{ margin: 0 }}>
                    Koreksi Bulan Hijriah
                </Title>
                <Text type="secondary">
                    Tentukan awal bulan Hijriah berdasarkan rukyah Indonesia — satu baris mencakup 29–30 hari
                </Text>
            </div>

            <Card
                title={
                    <Space>
                        <PlusOutlined />
                        Tambah / Edit Bulan
                    </Space>
                }
                style={{ marginBottom: 16, borderRadius: 12 }}
                styles={{ body: { padding: "20px 24px" } }}
            >
                <Space direction="vertical" style={{ width: "100%" }} size={16}>
                    <Space wrap align="end">
                        <div>
                            <Text style={{ fontSize: 12, display: "block", marginBottom: 4, color: token.colorTextSecondary }}>
                                Tahun H
                            </Text>
                            <InputNumber
                                value={tahunHijriah}
                                onChange={v => { setTahunHijriah(v || 0); }}
                                onBlur={handleTahunBulanChange}
                                min={1440}
                                max={1500}
                                style={{ width: 100 }}
                                placeholder="1448"
                            />
                        </div>
                        <div>
                            <Text style={{ fontSize: 12, display: "block", marginBottom: 4, color: token.colorTextSecondary }}>
                                Bulan H
                            </Text>
                            <Select
                                value={bulanHijriah}
                                onChange={v => { setBulanHijriah(v); handleTahunBulanChange(); }}
                                options={bulanOptions}
                                style={{ width: 150 }}
                            />
                        </div>
                        <div>
                            <Text style={{ fontSize: 12, display: "block", marginBottom: 4, color: token.colorTextSecondary }}>
                                Tanggal Awal Masehi
                            </Text>
                            <DatePicker
                                value={tanggalAwal}
                                onChange={setTanggalAwal}
                                format="DD/MM/YYYY"
                                style={{ width: 160 }}
                            />
                        </div>
                        <div>
                            <Text style={{ fontSize: 12, display: "block", marginBottom: 4, color: token.colorTextSecondary }}>
                                Panjang Bulan
                            </Text>
                            <Select
                                value={panjangBulan}
                                onChange={v => setPanjangBulan(v)}
                                options={[
                                    { label: "30 hari", value: 30 },
                                    { label: "29 hari", value: 29 },
                                ]}
                                style={{ width: 110 }}
                            />
                        </div>
                        <div>
                            <Text style={{ fontSize: 12, display: "block", marginBottom: 4, color: token.colorTextSecondary }}>
                                Verified
                            </Text>
                            <Switch
                                checked={verified}
                                onChange={setVerified}
                                checkedChildren="Ya"
                                unCheckedChildren="Tidak"
                            />
                        </div>
                        <div>
                            <Text style={{ fontSize: 12, display: "block", marginBottom: 4, color: token.colorTextSecondary }}>
                                Keterangan
                            </Text>
                            <Input
                                value={keterangan}
                                onChange={e => setKeterangan(e.target.value)}
                                placeholder="Opsional"
                                style={{ width: 180 }}
                                allowClear
                            />
                        </div>
                        <Button
                            type="primary"
                            icon={<CheckCircleOutlined />}
                            onClick={handleSave}
                            loading={saving}
                            style={{ marginBottom: 0 }}
                        >
                            Simpan
                        </Button>
                    </Space>
                </Space>
            </Card>

            <Card
                title={
                    <Space>
                        <Text>Daftar Koreksi Bulan</Text>
                        <Tag>{rows.length} bulan</Tag>
                    </Space>
                }
                extra={
                    <Button size="small" icon={<ReloadOutlined />} onClick={fetchRows} loading={loading}>
                        Refresh
                    </Button>
                }
                style={{ borderRadius: 12 }}
                styles={{ body: { padding: 0 } }}
            >
                <Table
                    dataSource={rows}
                    columns={columns}
                    rowKey={r => `${r.tahun_hijriah}_${r.bulan_hijriah_number}`}
                    loading={loading}
                    pagination={{ pageSize: 20, showSizeChanger: true }}
                    size="small"
                    locale={{ emptyText: "Belum ada koreksi bulan" }}
                />
            </Card>
        </div>
    );
};
