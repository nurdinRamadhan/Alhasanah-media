import React, { useEffect, useState } from "react";
import { logActivity } from "../../utility/logger";
import { Create, useForm, useSelect } from "@refinedev/antd";
import { Form, Input, Select, DatePicker, InputNumber, Card, Row, Col, Alert, message, Typography } from "antd";
const { Text } = Typography;
import { IRefJenisPembayaran, ITagihanSantri, ISantri } from "../../types";
import dayjs from "dayjs";
import { useGetIdentity } from "@refinedev/core";
import { supabaseClient } from "../../utility/supabaseClient";
import { buildSpecialRateMap, loadSpecialRates, resolveNominalWithSpecialRate } from "../../utility/paymentRates";
import { getHijriMonthYear, hijriToGregorian, formatHijriPeriod, HIJRI_MONTH_OPTIONS, HIJRI_YEAR_OPTIONS } from "../../utility/dateHelper";

export const TagihanCreate = () => {
    const { data: user } = useGetIdentity();
    const [paymentRefs, setPaymentRefs] = useState<IRefJenisPembayaran[]>([]);
    const [specialRateApplied, setSpecialRateApplied] = useState(false);
    const currentHijri = getHijriMonthYear();
    const [hijriMonth, setHijriMonth] = useState<number>(currentHijri.hm);
    const [hijriYear, setHijriYear] = useState<number>(currentHijri.hy);
    const { formProps, saveButtonProps, form } = useForm<ITagihanSantri>({
        onMutationSuccess: (data) => {
            logActivity({
                user,
                action: "CREATE",
                resource: "tagihan_santri",
                record_id: data.data.id.toString(),
                details: data.data
            });
        }
    });
    const selectedSantriNis = Form.useWatch("santri_nis", form);
    const selectedPaymentRefId = Form.useWatch("jenis_pembayaran_id", form);

    const { selectProps: santriSelectProps } = useSelect<ISantri>({
        resource: "santri",
        optionLabel: "nama",
        optionValue: "nis",
        meta: { select: "nama, nis, kelas, jurusan, status_santri" },
        filters: [{ field: "status_santri", operator: "eq", value: "AKTIF" }],
        onSearch: (value) => [
            { field: "nama", operator: "contains", value },
            { field: "nis", operator: "contains", value },
        ],
    });

    const loadPaymentRefs = async () => {
        try {
            const { data, error } = await supabaseClient
                .from("ref_jenis_pembayaran")
                .select("*")
                .eq("is_aktif", true)
                .order("id", { ascending: true });

            if (error) throw error;
            setPaymentRefs((data || []) as IRefJenisPembayaran[]);
        } catch (error) {
            const err = error as Error;
            message.error(`Gagal memuat master pembayaran: ${err.message}`);
        }
    };

    useEffect(() => {
        loadPaymentRefs();
    }, []);

    useEffect(() => {
        const applyNominal = async () => {
            if (!selectedSantriNis || !selectedPaymentRefId) return;
            const selectedRef = paymentRefs.find((ref) => Number(ref.id) === Number(selectedPaymentRefId));
            if (!selectedRef) return;
            if (!hijriMonth || !hijriYear) return;

            try {
                const periodLabel = formatHijriPeriod(hijriYear, hijriMonth);
                const gregDate = hijriToGregorian(hijriYear, hijriMonth);
                const jatuhTempo = dayjs(gregDate).endOf("month");

                const rates = await loadSpecialRates([selectedSantriNis], [Number(selectedPaymentRefId)]);
                const rateMap = buildSpecialRateMap(rates);
                const nominal = resolveNominalWithSpecialRate(
                    rateMap,
                    selectedSantriNis,
                    Number(selectedPaymentRefId),
                    Number(selectedRef.nominal_default),
                );

                form.setFieldsValue({
                    deskripsi_tagihan: `${selectedRef.nama_pembayaran} ${periodLabel}`,
                    nominal_tagihan: nominal,
                    sisa_tagihan: nominal,
                    tanggal_jatuh_tempo: jatuhTempo,
                });
                setSpecialRateApplied(rateMap.has(`${selectedSantriNis}:${Number(selectedPaymentRefId)}`));
            } catch (error) {
                const err = error as Error;
                message.error(`Gagal membaca tarif khusus: ${err.message}`);
            }
        };

        applyNominal();
    }, [selectedSantriNis, selectedPaymentRefId, hijriMonth, hijriYear, paymentRefs, form]);

    const handleNominalChange = (value: number | null) => {
        form.setFieldValue("sisa_tagihan", value);
        setSpecialRateApplied(false);
    };

    return (
        <Create saveButtonProps={saveButtonProps} title="Buat Tagihan Personal">
            <Form 
                {...formProps} 
                layout="vertical"
                initialValues={{
                    status: 'BELUM',
                }}
            >
                <Row gutter={24}>
                    <Col xs={24} md={12}>
                        <Card title="Target Tagihan" bordered={false} className="shadow-sm">
                            <Form.Item 
                                label="Pilih Santri" 
                                name="santri_nis" 
                                rules={[{ required: true, message: "Wajib pilih santri" }]}
                                help="Tagihan akan ditujukan ke wali santri ini"
                            >
                                <Select 
                                    {...santriSelectProps} 
                                    showSearch
                                    placeholder="Cari Santri..."
                                />
                            </Form.Item>

                            <Form.Item
                                label="Jenis Pembayaran"
                                name="jenis_pembayaran_id"
                                rules={[{ required: true, message: "Wajib pilih jenis pembayaran" }]}
                                help="Nominal akan diambil dari master pembayaran atau tarif khusus santri."
                            >
                                <Select
                                    placeholder="Pilih jenis pembayaran"
                                    options={paymentRefs.map((ref) => ({
                                        label: `${ref.nama_pembayaran} - Rp ${Number(ref.nominal_default || 0).toLocaleString("id-ID")}`,
                                        value: ref.id,
                                    }))}
                                />
                            </Form.Item>

                            <div style={{ marginBottom: 16 }}>
                                <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 13 }}>
                                    Periode Tagihan (Hijriah)
                                </label>
                                <Row gutter={12}>
                                    <Col span={12}>
                                        <Select
                                            value={hijriMonth}
                                            onChange={setHijriMonth}
                                            options={HIJRI_MONTH_OPTIONS}
                                            placeholder="Bulan"
                                            style={{ width: "100%" }}
                                        />
                                    </Col>
                                    <Col span={12}>
                                        <Select
                                            value={hijriYear}
                                            onChange={setHijriYear}
                                            options={HIJRI_YEAR_OPTIONS}
                                            placeholder="Tahun"
                                            style={{ width: "100%" }}
                                        />
                                    </Col>
                                </Row>
                            </div>

                            <Form.Item
                                label="Deskripsi Tagihan"
                                name="deskripsi_tagihan"
                                rules={[{ required: true }]}
                                help="Deskripsi otomatis mengikuti master, masih bisa disesuaikan bila perlu"
                            >
                                <Input placeholder="Masukkan keterangan tagihan" />
                            </Form.Item>
                        </Card>
                    </Col>

                    <Col xs={24} md={12}>
                        <Card title="Rincian Biaya" bordered={false} className="shadow-sm">
                            {specialRateApplied && (
                                <Alert
                                    type="success"
                                    showIcon
                                    style={{ marginBottom: 16 }}
                                    message="Tarif khusus santri diterapkan"
                                />
                            )}
                            <Form.Item 
                                label="Nominal Tagihan (Rp)" 
                                name="nominal_tagihan" 
                                rules={[{ required: true }]}
                            >
                                <InputNumber 
                                    style={{ width: "100%", fontSize: 16, fontWeight: 'bold' }} 
                                    formatter={(value) => `Rp ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                                    parser={(value) => value?.replace(/\Rp\s?|(\.*)/g, '') as unknown as number}
                                    onChange={handleNominalChange}
                                    placeholder="0"
                                />
                            </Form.Item>

                            {/* Hidden Sisa Tagihan */}
                            <Form.Item name="sisa_tagihan" hidden><InputNumber /></Form.Item>

                            <Form.Item 
                                label="Jatuh Tempo" 
                                name="tanggal_jatuh_tempo"
                                rules={[{ required: true }]}
                                help="Otomatis diisi dari periode Hijriah, bisa disesuaikan"
                                getValueProps={(value) => ({ value: value ? dayjs(value) : "" })}
                            >
                                <DatePicker style={{ width: "100%" }} format="DD MMMM YYYY" />
                            </Form.Item>

                            <Form.Item label="Status Awal" name="status">
                                <Select options={[
                                    { label: "Belum Lunas", value: "BELUM" },
                                    { label: "Lunas (via pembayaran)", value: "LUNAS", disabled: true },
                                ]} />
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                    Status LUNAS akan diatur otomatis oleh sistem setelah pembayaran tercatat
                                </Text>
                            </Form.Item>
                        </Card>
                    </Col>
                </Row>
            </Form>
        </Create>
    );
};
