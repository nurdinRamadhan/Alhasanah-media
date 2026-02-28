import React, { useEffect } from "react";
import { Create, useForm, useSelect } from "@refinedev/antd";
import { Form, Input, Select, DatePicker, InputNumber, Card, Row, Col, Typography, Divider, theme } from "antd";
import { 
    UserOutlined, 
    CalendarOutlined, 
    WarningOutlined, 
    ThunderboltOutlined, 
    FileTextOutlined,
    SafetyCertificateOutlined 
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useGetIdentity } from "@refinedev/core";

const { Title, Text } = Typography;
const { TextArea } = Input;

export const PelanggaranCreate = () => {
    // Hooks Refine & Ant Design
    const { token } = theme.useToken();
    const { formProps, saveButtonProps, form } = useForm();
    const { data: user } = useGetIdentity<{ id: string }>();

    // Mengambil data Santri (Foreign Key: nis)
    const { selectProps: santriSelectProps } = useSelect({
        resource: "santri",
        optionLabel: "nama", // Menampilkan Nama di dropdown
        optionValue: "nis",  // Menyimpan NIS ke database sesuai schema FK
        onSearch: (value) => [
            { field: "nama", operator: "contains", value },
        ],
        sorters: [
            { field: "nama", order: "asc" },
        ],
    });

    // Watcher: Memantau perubahan jenis pelanggaran untuk auto-fill poin
    const jenisPelanggaran = Form.useWatch("jenis_pelanggaran", form);

    useEffect(() => {
        // Logika "Smart Defaults": Mengisi poin otomatis berdasarkan kategori
        // User tetap bisa mengubahnya manual jika perlu
        if (jenisPelanggaran === "RINGAN") {
            form.setFieldValue("poin", 5);
        } else if (jenisPelanggaran === "SEDANG") {
            form.setFieldValue("poin", 25);
        } else if (jenisPelanggaran === "BERAT") {
            form.setFieldValue("poin", 100);
        }
    }, [jenisPelanggaran, form]);

    return (
        <Create 
            saveButtonProps={saveButtonProps} 
            title={
                <div className="flex items-center gap-2">
                    <WarningOutlined className="text-red-500" />
                    <span className="font-semibold text-gray-800 dark:text-gray-100">
                        Input Pelanggaran Santri
                    </span>
                </div>
            }
            wrapperProps={{ className: "bg-transparent" }}
        >
            <Form 
                {...formProps} 
                layout="vertical"
                initialValues={{
                    tanggal: dayjs(), // Default hari ini
                    jenis_pelanggaran: "RINGAN",
                    poin: 5,
                    dicatat_oleh_id: user?.id, // Auto-fill ID pencatat
                }}
            >
                {/* Hidden Field untuk ID Pencatat */}
                <Form.Item name="dicatat_oleh_id" hidden>
                    <Input />
                </Form.Item>

                <Row gutter={[24, 24]}>
                    {/* KOLOM KIRI: Identitas & Waktu */}
                    <Col xs={24} lg={10}>
                        <Card 
                            bordered={false} 
                            className="shadow-sm rounded-xl bg-white dark:bg-[#1f1f1f]"
                            title={<span className="text-emerald-600 dark:text-emerald-400 font-bold">Data Utama</span>}
                        >
                            <Form.Item
                                label={<span className="font-semibold">Nama Santri</span>}
                                name="santri_nis"
                                rules={[{ required: true, message: "Harap pilih santri" }]}
                                tooltip="Cari berdasarkan nama santri"
                            >
                                <Select 
                                    {...santriSelectProps}
                                    showSearch
                                    placeholder="Ketik nama santri..."
                                    suffixIcon={<UserOutlined className="text-gray-400" />}
                                    filterOption={false} // Di-handle oleh onSearch server-side
                                    size="large"
                                    className="w-full"
                                />
                            </Form.Item>

                            <Form.Item
                                label={<span className="font-semibold">Tanggal Kejadian</span>}
                                name="tanggal"
                                rules={[{ required: true, message: "Tanggal wajib diisi" }]}
                                getValueProps={(value) => ({ value: value ? dayjs(value) : "" })}
                            >
                                <DatePicker 
                                    format="DD MMMM YYYY"
                                    className="w-full"
                                    size="large"
                                    suffixIcon={<CalendarOutlined className="text-emerald-500" />}
                                />
                            </Form.Item>

                            <Divider dashed className="border-gray-200 dark:border-gray-700" />

                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800/30">
                                <Text type="secondary" className="text-xs">
                                    <SafetyCertificateOutlined className="mr-1" />
                                    Pastikan data santri dan tanggal sudah benar sebelum mengisi detail hukuman.
                                </Text>
                            </div>
                        </Card>
                    </Col>

                    {/* KOLOM KANAN: Detail Pelanggaran */}
                    <Col xs={24} lg={14}>
                        <Card 
                            bordered={false} 
                            className="shadow-sm rounded-xl bg-white dark:bg-[#1f1f1f]"
                            title={<span className="text-red-600 dark:text-red-400 font-bold">Klasifikasi & Hukuman</span>}
                        >
                            <Row gutter={16}>
                                <Col span={14}>
                                    <Form.Item
                                        label="Kategori Pelanggaran"
                                        name="jenis_pelanggaran"
                                        rules={[{ required: true }]}
                                    >
                                        <Select size="large">
                                            <Select.Option value="RINGAN">
                                                <span className="text-emerald-600 font-medium">RINGAN</span>
                                            </Select.Option>
                                            <Select.Option value="SEDANG">
                                                <span className="text-amber-600 font-medium">SEDANG</span>
                                            </Select.Option>
                                            <Select.Option value="BERAT">
                                                <span className="text-red-600 font-medium">BERAT</span>
                                            </Select.Option>
                                        </Select>
                                    </Form.Item>
                                </Col>
                                <Col span={10}>
                                    <Form.Item
                                        label="Poin"
                                        name="poin"
                                        rules={[{ required: true }]}
                                        help={<span className="text-xs text-gray-400">Otomatis diisi</span>}
                                    >
                                        <InputNumber 
                                            min={0} 
                                            size="large" 
                                            className="w-full font-bold text-red-600"
                                            addonBefore="+"
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Form.Item
                                label={<><ThunderboltOutlined className="mr-1"/> Bentuk Hukuman / Iqob</>}
                                name="hukuman"
                                rules={[{ required: true, message: "Hukuman wajib diisi sebagai bentuk pertanggungjawaban" }]}
                            >
                                <TextArea 
                                    rows={3} 
                                    placeholder="Contoh: Membersihkan halaman masjid selama 3 hari..." 
                                    showCount
                                    maxLength={500}
                                    className="bg-gray-50 dark:bg-[#141414]"
                                />
                            </Form.Item>

                            <Form.Item
                                label={<><FileTextOutlined className="mr-1"/> Kronologi / Catatan</>}
                                name="catatan"
                            >
                                <TextArea 
                                    rows={4} 
                                    placeholder="Ceritakan kronologi kejadian secara singkat..." 
                                    className="bg-gray-50 dark:bg-[#141414]"
                                />
                            </Form.Item>
                        </Card>
                    </Col>
                </Row>
            </Form>
        </Create>
    );
};