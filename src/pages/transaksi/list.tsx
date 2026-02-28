import React from "react";
import {
    List,
    useTable,
    DateField,
} from "@refinedev/antd"; // useExport dihapus dari sini
import { 
    useExport // <-- Import yang benar dari @refinedev/core
} from "@refinedev/core"; 
import { Table, Tag, Button, Typography } from "antd";
import { ExportOutlined } from "@ant-design/icons";
import { ITransaksiKeuangan } from "../../types";

const { Text } = Typography;

export const TransaksiList = () => {
    // 1. Setup Table
    const { tableProps } = useTable<ITransaksiKeuangan>({
        resource: "transaksi_keuangan",
        sorters: { initial: [{ field: "tanggal_transaksi", order: "desc" }] }
    });

    // 2. Setup Export CSV (Excel Friendly)
    const { triggerExport, isLoading: exportLoading } = useExport<ITransaksiKeuangan>({
        resource: "transaksi_keuangan",
        // Tentukan kolom apa saja yang mau didownload
        // PERBAIKAN: Menambahkan tipe data (item: ITransaksiKeuangan) agar tidak error 'any'
        mapData: (item: ITransaksiKeuangan) => {
            return {
                ID_Transaksi: item.id,
                Tanggal: item.tanggal_transaksi,
                Jenis: item.jenis_transaksi,
                Nominal: item.jumlah,
                Metode: item.metode_pembayaran,
                Status: item.status_transaksi,
                Midtrans_Order_ID: item.midtrans_order_id || "-",
            };
        },
        exportOptions: {
            filename: "Laporan_Keuangan_Pesantren", // Nama file saat didownload
        }
    });

    return (
        <List
            title="Riwayat Transaksi Keuangan"
            // Tambahkan Tombol Export di Header
            headerButtons={({ defaultButtons }) => (
                <>
                    <Button
                        icon={<ExportOutlined />}
                        onClick={triggerExport}
                        loading={exportLoading}
                    >
                        Export Laporan (CSV)
                    </Button>
                    {defaultButtons}
                </>
            )}
        >
            <Table
                {...tableProps}
                rowKey="id"
                // 3. Fitur Summary Row (Total di Bawah Tabel)
                summary={(pageData) => {
                    let totalMasuk = 0;
                    let totalKeluar = 0;

                    // Kita perlu casting pageData ke tipe yang benar jika diperlukan
                    // atau biarkan inferensi berjalan jika tableProps sudah generic
                    pageData.forEach((record) => {
                        const val = Number(record.jumlah);
                        if (record.jenis_transaksi === 'masuk') totalMasuk += val;
                        else totalKeluar += val;
                    });

                    return (
                        <Table.Summary fixed>
                            <Table.Summary.Row style={{ backgroundColor: '#fafafa' }}>
                                <Table.Summary.Cell index={0} colSpan={2}>
                                    <Text strong>Total Halaman Ini</Text>
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={2} align="right">
                                    <Text strong type="success">
                                        + Rp {totalMasuk.toLocaleString('id-ID')}
                                    </Text>
                                    {totalKeluar > 0 && (
                                        <>
                                            <br />
                                            <Text strong type="danger">
                                                - Rp {totalKeluar.toLocaleString('id-ID')}
                                            </Text>
                                        </>
                                    )}
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={3} colSpan={2} />
                            </Table.Summary.Row>
                        </Table.Summary>
                    );
                }}
            >
                {/* Kolom Tanggal */}
                <Table.Column
                    dataIndex="tanggal_transaksi"
                    title="Tanggal"
                    render={(value) => <DateField value={value} format="DD/MM/YYYY HH:mm" />}
                />

                {/* Kolom Jenis */}
                <Table.Column
                    dataIndex="jenis_transaksi"
                    title="Jenis"
                    render={(value) => (
                        <Tag color={value === 'masuk' ? 'green' : 'red'}>
                            {value?.toUpperCase()}
                        </Tag>
                    )}
                />

                {/* Kolom Nominal */}
                <Table.Column
                    dataIndex="jumlah"
                    title="Nominal"
                    align="right"
                    render={(value) => (
                        <span style={{ fontWeight: 'bold' }}>
                            Rp {Number(value).toLocaleString('id-ID')}
                        </span>
                    )}
                />

                {/* Kolom Metode */}
                <Table.Column
                    dataIndex="metode_pembayaran"
                    title="Metode"
                    render={(value) => <Tag>{value?.toUpperCase()}</Tag>}
                />

                {/* Kolom Status */}
                <Table.Column
                    dataIndex="status_transaksi"
                    title="Status"
                    render={(value) => {
                        let color = 'default';
                        if (value === 'settlement' || value === 'success') color = 'green';
                        if (value === 'pending') color = 'orange';
                        if (value === 'expire' || value === 'failure') color = 'red';
                        return <Tag color={color}>{value?.toUpperCase()}</Tag>;
                    }}
                />

            </Table>
        </List>
    );
};