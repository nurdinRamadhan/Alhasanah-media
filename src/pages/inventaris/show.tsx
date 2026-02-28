import React from "react";
import { useShow } from "@refinedev/core";
import { Typography, Card, Row, Col, Descriptions, Button, Divider, Tag, theme, Image } from "antd";
import { ArrowLeftOutlined, PrinterOutlined, BankOutlined } from "@ant-design/icons";
import { IInventaris } from "../../types";
import { useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { useToken } = theme;

export const InventarisShow = () => {
    const { queryResult } = useShow<IInventaris>({ meta: { select: "*, kategori:kategori_barang(nama_kategori), lokasi:lokasi_aset(nama_lokasi)" } });
    const { data, isLoading } = queryResult;
    const record = data?.data;
    const navigate = useNavigate();
    const { token } = useToken();

    if (isLoading || !record) return <div>Loading...</div>;

    // Data QR (Berisi Kode Barang + Nama)
    const qrValue = JSON.stringify({
        id: record.id,
        kode: record.kode_barang,
        nama: record.nama_barang,
        lokasi: record.lokasi?.nama_lokasi
    });

    return (
        <div className="p-4 pb-20">
            <div className="flex items-center justify-between mb-6 no-print">
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/inventaris')}>Kembali</Button>
                <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>Cetak Label Aset</Button>
            </div>

            <Row gutter={24}>
                {/* --- LABEL ASET (SIAP CETAK) --- */}
                <Col xs={24} md={8}>
                    <Card title="Label Aset (Preview)" className="shadow-sm text-center">
                        <div className="border-4 border-black p-4 inline-block bg-white text-black" style={{ minWidth: 300 }}>
                            <div className="flex items-center justify-center gap-2 mb-2 bg-black text-white py-1">
                                <BankOutlined /> <span className="font-bold">PESANTREN AL-HASANAH</span>
                            </div>
                            <div className="my-4">
                                <QRCodeCanvas value={qrValue} size={120} />
                            </div>
                            <div className="text-left border-t-2 border-black pt-2">
                                <p className="m-0 font-bold text-lg">{record.kode_barang}</p>
                                <p className="m-0 text-sm truncate">{record.nama_barang}</p>
                                <p className="m-0 text-xs mt-1">Lokasi: {record.lokasi?.nama_lokasi}</p>
                                <p className="m-0 text-xs">Tgl: {dayjs(record.tanggal_perolehan).format('DD/MM/YYYY')}</p>
                            </div>
                        </div>
                        <div className="mt-4 text-xs text-gray-500 no-print">
                            *Gunting dan tempelkan label ini pada fisik barang.
                        </div>
                    </Card>
                </Col>

                {/* --- DETAIL INFORMASI --- */}
                <Col xs={24} md={16}>
                    <Card title="Detail Inventaris" className="shadow-sm h-full">
                        <Descriptions bordered column={1}>
                            <Descriptions.Item label="Kode Barang"><Tag color="blue">{record.kode_barang}</Tag></Descriptions.Item>
                            <Descriptions.Item label="Nama Barang">{record.nama_barang}</Descriptions.Item>
                            <Descriptions.Item label="Kategori">{record.kategori?.nama_kategori}</Descriptions.Item>
                            <Descriptions.Item label="Lokasi Saat Ini">{record.lokasi?.nama_lokasi}</Descriptions.Item>
                            <Descriptions.Item label="Spesifikasi">{record.spesifikasi || '-'}</Descriptions.Item>
                            <Descriptions.Item label="Kondisi">
                                <Tag color={record.kondisi === 'BAIK' ? 'green' : 'red'}>{record.kondisi}</Tag>
                            </Descriptions.Item>
                        </Descriptions>
                        
                        <Divider orientation="left">Informasi Keuangan</Divider>
                        
                        <Descriptions bordered column={2}>
                            <Descriptions.Item label="Sumber Dana">{record.sumber_dana}</Descriptions.Item>
                            <Descriptions.Item label="Tanggal Perolehan">{dayjs(record.tanggal_perolehan).format('DD MMMM YYYY')}</Descriptions.Item>
                            <Descriptions.Item label="Harga Perolehan">
                                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(record.harga_perolehan)}
                            </Descriptions.Item>
                            <Descriptions.Item label="Nilai Residu">-</Descriptions.Item>
                        </Descriptions>
                    </Card>
                </Col>
            </Row>

            {/* Print Styles */}
            <style>{`
                @media print {
                    .no-print, .ant-layout-sider, .ant-layout-header { display: none !important; }
                    body { background: white; }
                    .ant-card { box-shadow: none !important; border: none !important; }
                }
            `}</style>
        </div>
    );
};