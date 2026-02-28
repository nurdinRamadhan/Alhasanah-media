import React, { useState } from "react";
import { useTable, useSelect } from "@refinedev/antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import { Tag, Space, Button, Typography, Tooltip, Avatar, Modal, DatePicker, Select, Radio, message, Card } from "antd";
import { 
    PlusOutlined, 
    SyncOutlined, 
    UserOutlined, 
    EyeOutlined, 
    DownloadOutlined,
    FileExcelOutlined,
    CalendarOutlined
} from "@ant-design/icons";
import { ISantri } from "../../types";
import { useNavigation } from "@refinedev/core";
import dayjs from "dayjs";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { supabaseClient } from "../../utility/supabaseClient";

const { Text } = Typography;
const { RangePicker } = DatePicker;

export const MurojaahList = () => {
    const { tableProps } = useTable<ISantri>({
        resource: "santri",
        syncWithLocation: true,
        filters: {
            permanent: [
                { field: "jurusan", operator: "eq", value: "TAHFIDZ" },
                { field: "status_santri", operator: "eq", value: "AKTIF" }
            ]
        },
        sorters: { initial: [{ field: "kelas", order: "asc" }] },
    });

    const { push } = useNavigation();

    // --- STATE EXPORT CENTER ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [exportType, setExportType] = useState<'GLOBAL' | 'PERSONAL'>('GLOBAL');
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>([dayjs().startOf('month'), dayjs()]);
    const [selectedSantri, setSelectedSantri] = useState<string | null>(null);
    const [isLoadingExport, setIsLoadingExport] = useState(false);

    // Hook Cari Santri untuk Dropdown Modal
    const { selectProps: santriSelectProps } = useSelect<ISantri>({
        resource: "santri",
        optionLabel: "nama",
        optionValue: "nis",
        filters: [{ field: "jurusan", operator: "eq", value: "TAHFIDZ" }],
        onSearch: (value) => [{ field: "nama", operator: "contains", value }],
    });

    // --- LOGIC EXPORT EXCEL ---
    const handleExport = async () => {
        if (!dateRange) {
            message.error("Mohon pilih rentang tanggal terlebih dahulu");
            return;
        }

        setIsLoadingExport(true);
        try {
            const startDate = dateRange[0].startOf('day').toISOString();
            const endDate = dateRange[1].endOf('day').toISOString();
            const wb = new ExcelJS.Workbook();

            if (exportType === 'GLOBAL') {
                // --- EXPORT GLOBAL (SEMUA SANTRI) ---
                const ws = wb.addWorksheet('Rekap Murojaah');
                
                // Ambil data dengan join santri
                const { data: logs, error } = await supabaseClient
                    .from('murojaah_tahfidz')
                    .select('*, santri(nama, kelas)')
                    .gte('tanggal', startDate)
                    .lte('tanggal', endDate)
                    .order('tanggal', { ascending: false }); // Urutkan tanggal terbaru

                if (error) throw error;

                // Header Info
                ws.mergeCells('A1:G1');
                ws.getCell('A1').value = `LAPORAN MUROJAAH TAHFIDZ (${dateRange[0].format('DD MMM')} - ${dateRange[1].format('DD MMM YYYY')})`;
                ws.getCell('A1').font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
                ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7E22CE' } }; // Ungu
                ws.getCell('A1').alignment = { horizontal: 'center' };

                // Kolom
                ws.getRow(3).values = ['Tanggal', 'NIS', 'Nama Santri', 'Kelas', 'Jenis', 'Cakupan (Surat/Hal)', 'Predikat', 'Catatan'];
                ws.getRow(3).font = { bold: true };
                ws.columns = [
                    { key: 'tgl', width: 15 }, { key: 'nis', width: 15 }, { key: 'nama', width: 25 },
                    { key: 'kelas', width: 10 }, { key: 'jenis', width: 10 }, { key: 'cakupan', width: 30 },
                    { key: 'predikat', width: 15 }, { key: 'note', width: 30 }
                ];

                logs?.forEach(item => {
                    // Logic gabungan Surat vs Halaman
                    const cakupan = item.surat 
                        ? `${item.surat} (Ayat ${item.ayat_awal}-${item.ayat_akhir})` 
                        : `Hal. ${item.halaman_awal} - ${item.halaman_akhir} (Juz ${item.juz})`;

                    ws.addRow({
                        tgl: dayjs(item.tanggal).format('DD/MM/YYYY'),
                        nis: item.santri_nis,
                        nama: item.santri?.nama,
                        kelas: item.santri?.kelas,
                        jenis: item.jenis_murojaah,
                        cakupan: cakupan,
                        predikat: item.predikat,
                        note: item.catatan
                    });
                });

            } else {
                // --- EXPORT PERSONAL (SATU SANTRI) ---
                if (!selectedSantri) {
                    message.error("Pilih santri terlebih dahulu");
                    setIsLoadingExport(false); return;
                }

                const { data: santri } = await supabaseClient.from('santri').select('*').eq('nis', selectedSantri).single();
                const { data: logs } = await supabaseClient
                    .from('murojaah_tahfidz')
                    .select('*')
                    .eq('santri_nis', selectedSantri)
                    .gte('tanggal', startDate)
                    .lte('tanggal', endDate)
                    .order('tanggal', { ascending: false });

                const ws = wb.addWorksheet(`Murojaah - ${santri.nama.substring(0, 20)}`);

                // Header Biodata
                ws.getCell('A1').value = "LAPORAN PERSONAL MUROJAAH";
                ws.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF7E22CE' } };
                ws.getCell('A3').value = "Nama:"; ws.getCell('B3').value = santri.nama;
                ws.getCell('A4').value = "Kelas:"; ws.getCell('B4').value = santri.kelas;
                ws.getCell('A5').value = "Periode:"; ws.getCell('B5').value = `${dateRange[0].format('DD MMM')} s/d ${dateRange[1].format('DD MMM YYYY')}`;

                // Tabel
                ws.getRow(7).values = ['Tanggal', 'Jenis', 'Juz', 'Cakupan Hafalan', 'Predikat', 'Paraf Musyrif'];
                ws.getRow(7).font = { bold: true, color: { argb: 'FFFFFFFF' } };
                ws.getRow(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7E22CE' } };

                ws.columns = [
                    { width: 15 }, { width: 12 }, { width: 8 }, { width: 40 }, { width: 15 }, { width: 15 }
                ];

                logs?.forEach(item => {
                    const cakupan = item.surat 
                        ? `QS. ${item.surat} : ${item.ayat_awal}-${item.ayat_akhir}` 
                        : `Halaman ${item.halaman_awal} - ${item.halaman_akhir}`;

                    ws.addRow([
                        dayjs(item.tanggal).format('DD MMM YYYY'),
                        item.jenis_murojaah,
                        item.juz,
                        cakupan,
                        item.predikat,
                        '' // Kolom paraf kosong untuk diprint
                    ]);
                });
            }

            // Download
            const buffer = await wb.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `Laporan_Murojaah_${exportType}_${dayjs().format('YYYYMMDD')}.xlsx`);
            message.success("Laporan berhasil diunduh");
            setIsModalOpen(false);

        } catch (error: any) {
            message.error("Gagal export: " + error.message);
        } finally {
            setIsLoadingExport(false);
        }
    };

    // --- KOLOM TABEL UTAMA ---
    const columns: ProColumns<ISantri>[] = [
        {
            title: "Santri Tahfidz",
            dataIndex: "nama",
            width: 250,
            fixed: "left",
            render: (_, record) => (
                <div className="flex items-center gap-3">
                    <Avatar 
                        src={record.foto_url} 
                        size={42}
                        icon={<UserOutlined />}
                        className="border border-purple-100 bg-purple-50 text-purple-600"
                    />
                    <div className="flex flex-col">
                        <Text strong className="text-gray-800 dark:text-gray-100">{record.nama}</Text>
                        <Space size={4}>
                            <Tag bordered={false} className="m-0 text-[10px] bg-gray-100">{record.nis}</Tag>
                            <Tag color="cyan" className="m-0 text-[10px]">Kelas {record.kelas}</Tag>
                        </Space>
                    </div>
                </div>
            ),
        },
        {
            title: "Pembimbing",
            dataIndex: "pembimbing",
            width: 180,
            render: (val) => val || "-"
        },
        {
            title: "Status",
            key: "status",
            width: 200,
            render: () => (
                <div className="flex items-center gap-2 text-gray-500 text-xs">
                     <SyncOutlined /> Data log ada di detail
                </div>
            )
        },
        {
            title: "Aksi",
            valueType: "option",
            width: 140,
            fixed: "right",
            render: (_, record) => [
                <Tooltip title="Input Murojaah" key="add">
                    <Button 
                        type="primary" ghost size="small" icon={<PlusOutlined />} 
                        className="border-purple-500 text-purple-600 hover:bg-purple-50"
                        onClick={() => push(`/murojaah/create?nis=${record.nis}`)} 
                    />
                </Tooltip>,
                <Tooltip title="Lihat Log" key="view">
                    <Button 
                        size="small" icon={<EyeOutlined />} 
                        onClick={() => push(`/murojaah/show/${record.nis}`)} 
                    >
                        Detail
                    </Button>
                </Tooltip>
            ]
        }
    ];

    return (
        <>
            <ProTable<ISantri>
                {...tableProps}
                columns={columns}
                rowKey="nis"
                headerTitle={
                    <Space>
                        <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded-lg border border-purple-100 dark:border-purple-800">
                            <SyncOutlined className="text-purple-600 text-lg" />
                        </div>
                        <div className="flex flex-col">
                            <Text strong className="text-base">Murojaah (Pengulangan)</Text>
                            <Text type="secondary" className="text-xs">Maintenance hafalan santri</Text>
                        </div>
                    </Space>
                }
                toolBarRender={() => [
                    <Button 
                        key="export" 
                        icon={<FileExcelOutlined />} 
                        onClick={() => setIsModalOpen(true)}
                        className="text-green-600 border-green-600 hover:bg-green-50"
                    >
                        Export Center
                    </Button>,
                    <Button 
                        key="create" 
                        type="primary" 
                        icon={<PlusOutlined />} 
                        onClick={() => push("/murojaah/create")}
                        className="bg-purple-600 hover:bg-purple-500 border-0"
                    >
                        Input Baru
                    </Button>
                ]}
                options={{ density: true, fullScreen: true, reload: true }}
                search={{ labelWidth: 'auto', layout: 'vertical' }}
                pagination={{ defaultPageSize: 10 }}
                className="bg-white dark:bg-[#141414] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800"
            />

            {/* --- MODAL EXPORT CENTER --- */}
            <Modal
                title={
                    <Space><FileExcelOutlined className="text-green-600"/> Export Data Murojaah</Space>
                }
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                footer={[
                    <Button key="back" onClick={() => setIsModalOpen(false)}>Batal</Button>,
                    <Button 
                        key="submit" type="primary" 
                        icon={<DownloadOutlined />} 
                        loading={isLoadingExport}
                        onClick={handleExport}
                        className="bg-green-600 hover:bg-green-500"
                    >
                        Download Excel
                    </Button>,
                ]}
            >
                <div className="flex flex-col gap-4 py-2">
                    {/* 1. Pilih Tipe Laporan */}
                    <Card size="small" className="bg-gray-50 border-gray-200">
                        <Text strong className="mb-2 block">Jenis Laporan</Text>
                        <Radio.Group 
                            value={exportType} 
                            onChange={(e) => setExportType(e.target.value)}
                            buttonStyle="solid"
                            className="w-full"
                        >
                            <Radio.Button value="GLOBAL" className="w-1/2 text-center">Rekap Semua Santri</Radio.Button>
                            <Radio.Button value="PERSONAL" className="w-1/2 text-center">Rapor Personal</Radio.Button>
                        </Radio.Group>
                    </Card>

                    {/* 2. Pilih Santri (Hanya jika Personal) */}
                    {exportType === 'PERSONAL' && (
                        <div>
                            <Text strong className="mb-1 block">Pilih Santri</Text>
                            <Select
                                {...santriSelectProps}
                                showSearch
                                placeholder="Ketik Nama Santri..."
                                style={{ width: '100%' }}
                                onChange={(val) => setSelectedSantri(val as unknown as string)}
                                allowClear
                            />
                        </div>
                    )}

                    {/* 3. Pilih Rentang Tanggal */}
                    <div>
                        <Text strong className="mb-1 block">Rentang Periode</Text>
                        <RangePicker 
                            value={dateRange}
                            onChange={(dates) => setDateRange(dates as any)}
                            className="w-full"
                            format="DD MMM YYYY"
                            presets={[
                                { label: 'Hari Ini', value: [dayjs(), dayjs()] },
                                { label: 'Minggu Ini', value: [dayjs().startOf('week'), dayjs().endOf('week')] },
                                { label: 'Bulan Ini', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
                            ]}
                        />
                        <Text type="secondary" className="text-xs mt-1 block">
                            *Disarankan export per bulan agar file tidak terlalu besar.
                        </Text>
                    </div>
                </div>
            </Modal>
        </>
    );
};