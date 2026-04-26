import React from 'react';
import { useTable } from "@refinedev/antd";
import { ProTable, ProColumns, TableDropdown } from "@ant-design/pro-components";
import { Tag, Space, Avatar, Typography, Button, Tooltip } from "antd";
import { 
    UserOutlined, 
    ExportOutlined, 
    PlusOutlined, 
    EyeOutlined, 
    EditOutlined,
    ManOutlined,
    WomanOutlined
} from "@ant-design/icons";
import { ISantri } from "../../types"; 
import { useNavigation } from "@refinedev/core";
import { formatHijri } from "../../utility/dateHelper";
import ExcelJS from 'exceljs';
// @ts-ignore
import { saveAs } from 'file-saver';

const { Text } = Typography;

export const SantriList = () => {
  const { tableProps, tableQueryResult } = useTable<ISantri>({
    resource: "santri",
    syncWithLocation: true,
    sorters: { initial: [{ field: "created_at", order: "desc" }] }
  });

  const { create, show, edit } = useNavigation();

  // --- LOGIKA EXPORT EXCEL (PROFESSIONAL VERSION) ---
  const exportToExcel = async () => {
    // Ambil info instansi dari state atau query (karena ini hook, kita asumsikan data tersedia atau gunakan default)
    // Di aplikasi nyata, Anda bisa memanggil useList untuk instansi_info di sini jika belum ada
    const instansi = {
        nama: "PONDOK PESANTREN AL-HASANAH",
        alamat: "Jl. Raya Cibeuti No.13, Cibeuti, Kec. Kawalu, Tasikmalaya, Jawa Barat 46182",
        kontak: "Telp: 0812-XXXX-XXXX | Email: info@alhasanah.com",
    };

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data Santri');

    // 1. HEADER - KOP SURAT
    worksheet.mergeCells('A1:H1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = instansi.nama;
    titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF065F46' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    worksheet.mergeCells('A2:H2');
    const addrCell = worksheet.getCell('A2');
    addrCell.value = instansi.alamat;
    addrCell.font = { name: 'Arial', size: 10, italic: true };
    addrCell.alignment = { vertical: 'middle', horizontal: 'center' };

    worksheet.mergeCells('A3:H3');
    const contactCell = worksheet.getCell('A3');
    contactCell.value = instansi.kontak;
    contactCell.font = { name: 'Arial', size: 9 };
    contactCell.alignment = { vertical: 'middle', horizontal: 'center' };

    worksheet.addRow([]); // Spacer

    // 2. JUDUL LAPORAN
    worksheet.mergeCells('A5:H5');
    const reportTitle = worksheet.getCell('A5');
    reportTitle.value = `DATABASE SANTRI PER TANGGAL: ${new Date().toLocaleDateString('id-ID')}`;
    reportTitle.font = { name: 'Arial', size: 11, bold: true };
    reportTitle.alignment = { vertical: 'middle', horizontal: 'left' };

    worksheet.addRow([]); // Spacer

    // 3. DEFINISI KOLOM TABLE
    const headerRow = worksheet.addRow([
        'NO', 
        'NIS', 
        'NAMA LENGKAP', 
        'GENDER', 
        'TEMPAT, TGL LAHIR', 
        'JURUSAN', 
        'KELAS', 
        'STATUS'
    ]);

    // Styling Header Table
    headerRow.eachCell((cell) => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF059669' } // Emerald 600
        };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });

    // 4. MENGISI DATA
    const rawData = tableQueryResult?.data?.data || [];
    rawData.forEach((item, index) => {
        const row = worksheet.addRow([
            index + 1,
            item.nis,
            item.nama.toUpperCase(),
            item.jenis_kelamin === 'L' ? 'LAKI-LAKI' : 'PEREMPUAN',
            `${item.tempat_lahir || '-'}, ${item.tanggal_lahir || '-'}`,
            item.jurusan,
            `KELAS ${item.kelas}`,
            item.status_santri
        ]);

        // Zebra Stripes & Borders
        row.eachCell((cell) => {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
            };
            if (index % 2 !== 0) {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF9FAFB' }
                };
            }
        });
        // Center Alignment for specific columns
        row.getCell(1).alignment = { horizontal: 'center' };
        row.getCell(4).alignment = { horizontal: 'center' };
        row.getCell(7).alignment = { horizontal: 'center' };
        row.getCell(8).alignment = { horizontal: 'center' };
    });

    // 5. FINALIZING: Auto-filter, Freeze Pane, Column Width
    worksheet.autoFilter = 'A7:H7';
    worksheet.views = [{ state: 'frozen', ySplit: 7 }];

    const columnsWidth = [5, 15, 35, 15, 30, 15, 10, 15];
    columnsWidth.forEach((w, i) => {
        worksheet.getColumn(i + 1).width = w;
    });

    // Generate & Save
    const buffer = await workbook.xlsx.writeBuffer();
    const dateStr = new Date().toISOString().split('T')[0];
    saveAs(new Blob([buffer]), `Data_Santri_Lengkap_${dateStr}.xlsx`);
  };

  // --- DEFINISI KOLOM (Lebih Informatif) ---
  const columns: ProColumns<ISantri>[] = [
    {
      title: "Identitas Santri",
      dataIndex: "nama",
      copyable: true,
      width: 250,
      render: (_, record) => (
        <div className="flex items-center gap-3 py-1">
          <Avatar 
            shape="circle" 
            size={44}
            src={record.foto_url} // TAMBAHKAN INI
            style={{ 
                backgroundColor: record.jenis_kelamin === 'L' ? '#e0f2fe' : '#fce7f3',
                color: record.jenis_kelamin === 'L' ? '#0284c7' : '#db2777',
                border: `1.5px solid ${record.jenis_kelamin === 'L' ? '#bae6fd' : '#fbcfe8'}`,
                flexShrink: 0
            }}
            icon={record.jenis_kelamin === 'L' ? <ManOutlined /> : <WomanOutlined />} 
          />
          <div className="flex flex-col gap-y-0.5 overflow-hidden">
            <Text strong className="text-[14px] text-gray-900 dark:text-gray-100 truncate block leading-snug">
              {record.nama}
            </Text>
            <div className="flex items-center gap-2">
                <Tag bordered={false} className="m-0 text-[10px] px-1.5 py-0 bg-gray-100 dark:bg-gray-800 dark:text-gray-400">
                  NIS: {record.nis}
                </Tag>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Gender",
      dataIndex: "jenis_kelamin",
      hideInTable: true, // Sembunyikan di tabel, hanya muncul di filter
      valueEnum: {
        L: { text: "Laki-laki" },
        P: { text: "Perempuan" },
      },
    },
    {
      title: "Takhasus & Kelas",
      key: "TakhasusKelas",
      hideInSearch: true,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
             <Tag color={record.jurusan === 'TAHFIDZ' ? 'geekblue' : 'gold'}>
                {record.jurusan}
             </Tag>
             <Text type="secondary" style={{ fontSize: 11, paddingLeft: 4 }}>Kelas {record.kelas}</Text>
        </Space>
      ),
    },
    {
      title: "Jurusan",
      dataIndex: "jurusan",
      hideInTable: true,
      valueEnum: {
        TAHFIDZ: { text: "Tahfidz (Hafalan)" },
        KITAB: { text: "Kitab (Reguler)" },
      },
    },
    {
      title: "Status",
      dataIndex: "status_santri",
      width: 100,
      valueEnum: {
        AKTIF: { text: "Aktif", status: "Success" },
        LULUS: { text: "Lulus", status: "Default" },
        KELUAR: { text: "Keluar", status: "Error" },
        ALUMNI: { text: "Alumni", status: "Processing" },
      },
    },
    {
      title: "Aksi",
      valueType: "option",
      key: "option",
      width: 120,
      render: (_text, record) => [
        <Tooltip title="Lihat Detail & QR" key="view">
            <Button 
                type="text" 
                size="small" 
                icon={<EyeOutlined />} 
                onClick={() => show("santri", record.nis)} 
                style={{ color: '#059669' }}
            />
        </Tooltip>,
        <Tooltip title="Edit Data" key="edit">
            <Button 
                type="text" 
                size="small" 
                icon={<EditOutlined />} 
                onClick={() => edit("santri", record.nis)} 
                style={{ color: '#d97706' }} // Gold/Amber
            />
        </Tooltip>,
      ],
    },
  ];

  return (
    <ProTable<ISantri>
      {...tableProps}
      columns={columns}
      rowKey="nis"
      headerTitle={
        <Space direction="vertical" size={0}>
            <Space>
                <Typography.Title level={4} style={{ margin: 0, color: '#059669' }}>
                    Database Santri
                </Typography.Title>
                <Tag color="cyan">{tableQueryResult?.data?.total || 0} Total</Tag>
            </Space>
            <Text type="secondary" style={{ fontSize: 10 }}>Update Data: {formatHijri(new Date())}</Text>
        </Space>
      }
      // Toolbar: Tempat tombol aksi utama
      toolBarRender={() => [
        <Button key="export" icon={<ExportOutlined />} onClick={exportToExcel}>
          Unduh Excel
        </Button>,
        <Button 
            key="create" 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => create("santri")}
            style={{ backgroundColor: '#059669' }} // Emerald Button
        >
          Santri Baru
        </Button>,
      ]}
      // Opsi Tampilan
      options={{
        density: true, // Kepadatan tabel
        fullScreen: true, // Mode layar penuh
        setting: true, // Pengaturan kolom
        reload: true, // Tombol refresh
      }}
      // Konfigurasi Search Form
      search={{
        labelWidth: 'auto',
        layout: 'vertical',
        defaultCollapsed: false,
        collapseRender: (collapsed) => collapsed ? 'Tampilkan Filter' : 'Sembunyikan',
        searchText: 'Cari',
        resetText: 'Reset',
      }}
      pagination={{
        defaultPageSize: 10,
        showSizeChanger: true,
        showTotal: (total) => `Total ${total} santri`,
      }}
      // Styling Card Table
      cardProps={{
        style: { borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
      }}
      // Mematikan border default agar lebih clean
      tableStyle={{ border: 'none' }}
    />
  );
};