import React, { useState } from "react";
import { logActivity } from "../../utility/logger";
import { Create, useForm, useSelect } from "@refinedev/antd";
import { Form, Input, Select, DatePicker, Card, Row, Col, InputNumber, Radio, Divider, Typography } from "antd";
import dayjs from "dayjs";
import { ISantri } from "../../types";
import { useGetIdentity, useUpdate } from "@refinedev/core"; //
import { DATA_SURAT } from "../../utility/quran-data";
import { useSearchParams } from "react-router-dom";
import { supabaseClient } from "../../utility/supabaseClient";

const { Text } = Typography;

const parseTotalHafalan = (value?: string | number | null) => {
    if (value === null || value === undefined || value === "") return 0;
    const match = String(value).replace(",", ".").match(/\d+(\.\d+)?/);
    return match ? Number(match[0]) : 0;
};

export const HafalanCreate = () => {
    const { formProps, saveButtonProps, form } = useForm();
    const { data: user } = useGetIdentity<{ id: string }>();
    const [searchParams] = useSearchParams();
    const [selectedSuratMaxAyat, setSelectedSuratMaxAyat] = useState<number>(286);
    const [currentTotalSource, setCurrentTotalSource] = useState<string | null>(null);
    const selectedSantriNis = Form.useWatch("santri_nis", form);

    // Hook untuk melakukan update ke tabel santri
    const { mutate: updateSantri } = useUpdate();

    const { selectProps: santriSelectProps } = useSelect<ISantri>({
        resource: "santri",
        optionLabel: "nama",
        optionValue: "nis",
        meta: { select: "nama, nis, kelas, jurusan, status_santri" },
        filters: [{ field: "jurusan", operator: "eq", value: "TAHFIDZ" }],
        onSearch: (value) => [
            { field: "nama", operator: "contains", value },
            { field: "nis", operator: "contains", value },
        ],
    });

    React.useEffect(() => {
        const nisFromUrl = searchParams.get("nis");
        if (nisFromUrl && !form.getFieldValue("santri_nis")) {
            form.setFieldValue("santri_nis", nisFromUrl);
        }
    }, [form, searchParams]);

    React.useEffect(() => {
        if (!selectedSantriNis) {
            setCurrentTotalSource(null);
            return;
        }

        let mounted = true;
        supabaseClient
            .from("santri")
            .select("total_hafalan")
            .eq("nis", selectedSantriNis)
            .maybeSingle()
            .then(({ data, error }) => {
                if (!mounted) return;
                if (error) {
                    console.error("Gagal mengambil total hafalan santri:", error);
                    return;
                }
                const total = data?.total_hafalan ?? "0";
                setCurrentTotalSource(String(total));
                form.setFieldValue("total_hafalan", parseTotalHafalan(total));
            });

        return () => {
            mounted = false;
        };
    }, [form, selectedSantriNis]);

    const handleSuratChange = (value: string) => {
        const surat = DATA_SURAT.find(s => s.nama === value);
        if(surat) {
            setSelectedSuratMaxAyat(surat.ayat);
            form.setFieldValue("ayat_akhir", null);
        }
    };

    // Fungsi Custom untuk menangani Submit
    // 1. Simpan data hafalan baru
    // 2. Update data total_hafalan di tabel santri
    const onFinishHandler = async (values: any) => {
        // Panggil fungsi onFinish bawaan useForm untuk menyimpan data ke tabel 'hafalan'
        if (formProps.onFinish) {
            await formProps.onFinish(values);
            await logActivity({
                user,
                action: "CREATE",
                resource: "hafalan",
                details: values
            });
        }

        // Jika ada input total_hafalan, update tabel 'santri'
        if (values.santri_nis && values.total_hafalan !== undefined && values.total_hafalan !== null) {
            updateSantri({
                resource: "santri",
                id: values.santri_nis,
                values: {
                    total_hafalan: values.total_hafalan,
                },
                successNotification: (_data, _values, _resource) => {
                    return {
                        message: `Data Hafalan & Total Juz Santri Berhasil Diupdate`,
                        description: "Sukses",
                        type: "success",
                    };
                },
            });
        }
    };

    const juzOptions = Array.from({length: 30}, (_, i) => ({ label: `Juz ${i + 1}`, value: i + 1 }));

    return (
        <Create 
            saveButtonProps={saveButtonProps} 
            title="Input Setoran Baru"
        >
            <Form 
                {...formProps} 
                layout="vertical"
                onFinish={onFinishHandler} // Menggunakan handler custom
                initialValues={{
                    tanggal: dayjs(),
                    dicatat_oleh_id: user?.id,
                    predikat: "MUMTAZ",
                    status: "LANCAR",
                    juz: 30 
                }}
            >
                <Form.Item name="dicatat_oleh_id" hidden><Input /></Form.Item>
                <Form.Item name="status" hidden><Input /></Form.Item>

                <Row gutter={24}>
                    <Col xs={24} md={10}>
                        <Card title="Identitas & Posisi" bordered={false} className="shadow-sm mb-6">
                            <Form.Item 
                                label="Nama Santri" 
                                name="santri_nis" 
                                rules={[{ required: true }]}
                            >
                                <Select 
                                    {...santriSelectProps} 
                                    showSearch 
                                    placeholder="Cari Santri Tahfidz..."
                                />
                            </Form.Item>

                            <Form.Item 
                                label="Waktu Setoran" 
                                name="tanggal" 
                                rules={[{ required: true }]}
                                getValueProps={(value) => ({ value: value ? dayjs(value) : "" })}
                            >
                                <DatePicker showTime format="DD MMM YYYY HH:mm" style={{ width: '100%' }} />
                            </Form.Item>

                            <Form.Item 
                                label="Posisi Juz Saat Ini" 
                                name="juz" 
                                help="Santri sedang menghafal di Juz berapa?"
                            >
                                <Select 
                                    options={juzOptions} 
                                    showSearch 
                                    placeholder="Pilih Juz"
                                />
                            </Form.Item>

                            {/* KOLOM BARU: TOTAL HAFALAN */}
                            <Form.Item 
                                label="Total Juz yang Sudah Dihafal" 
                                name="total_hafalan" 
                                help={
                                    currentTotalSource
                                        ? `Terisi otomatis dari data santri saat ini: ${currentTotalSource}. Ubah hanya jika total capaian memang berubah.`
                                        : "Terisi otomatis setelah santri dipilih. Nilai ini akan tersimpan ke profil santri."
                                }
                                rules={[{ required: true, message: 'Harap isi total juz hafalan' }]}
                            >
                                <InputNumber 
                                    min={0} 
                                    max={30} 
                                    step={1}
                                    precision={0}
                                    style={{ width: '100%' }} 
                                    placeholder="Contoh: 5"
                                    addonAfter="Juz"
                                />
                            </Form.Item>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                Nilai ini adalah total capaian santri, bukan tambahan setoran hari ini.
                            </Text>

                        </Card>
                    </Col>

                    <Col xs={24} md={14}>
                        <Card title="Detail Hafalan (Ziyadah)" bordered={false} className="shadow-sm mb-6">
                            <Form.Item 
                                label="Nama Surat" 
                                name="surat" 
                                rules={[{ required: true }]}
                            >
                                <Select 
                                    showSearch
                                    placeholder="Pilih Surat..."
                                    onChange={handleSuratChange}
                                    options={DATA_SURAT.map(s => ({
                                        label: `${s.nomor}. ${s.nama} (${s.ayat} ayat)`,
                                        value: s.nama
                                    }))}
                                    filterOption={(input, option) => 
                                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                    }
                                />
                            </Form.Item>

                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item label="Ayat Awal" name="ayat_awal" rules={[{ required: true }]}>
                                        <InputNumber min={1} max={selectedSuratMaxAyat} style={{ width: '100%' }} />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item label="Ayat Akhir" name="ayat_akhir" rules={[{ required: true }]}>
                                        <InputNumber min={1} max={selectedSuratMaxAyat} style={{ width: '100%' }} />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Divider dashed />

                            <Form.Item label="Kualitas Hafalan (Predikat)" name="predikat">
                                <Radio.Group buttonStyle="solid" className="w-full">
                                    <Radio.Button value="MUMTAZ" className="w-1/3 text-center">Mumtaz</Radio.Button>
                                    <Radio.Button value="JAYYID" className="w-1/3 text-center">Jayyid</Radio.Button>
                                    <Radio.Button value="KURANG" className="w-1/3 text-center">Kurang</Radio.Button>
                                </Radio.Group>
                            </Form.Item>

                            <Form.Item label="Catatan Musyrif" name="catatan">
                                <Input.TextArea rows={2} />
                            </Form.Item>
                        </Card>
                    </Col>
                </Row>
            </Form>
        </Create>
    );
};
