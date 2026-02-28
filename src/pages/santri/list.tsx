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

  // --- LOGIKA EXPORT EXCEL (Tetap Sama) ---
  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data Santri');

    worksheet.columns = [
      { header: 'NIS', key: 'nis', width: 15 },
      { header: 'Nama Lengkap', key: 'nama', width: 30 },
      { header: 'Gender', key: 'jenis_kelamin', width: 10 },
      { header: 'Jurusan', key: 'jurusan', width: 15 },
      { header: 'Kelas', key: 'kelas', width: 10 },
      { header: 'Status', key: 'status_santri', width: 15 },
    ];

    const data = tableQueryResult?.data?.data || [];
    data.forEach((item) => {
      worksheet.addRow({
        nis: item.nis,
        nama: item.nama,
        jenis_kelamin: item.jenis_kelamin,
        jurusan: item.jurusan,
        kelas: item.kelas,
        status_santri: item.status_santri,
      });
    });

    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } }; // Emerald

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Data_Santri_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // --- DEFINISI KOLOM (Lebih Informatif) ---
  const columns: ProColumns<ISantri>[] = [
    {
      title: "Identitas Santri",
      dataIndex: "nama",
      copyable: true,
      width: 250,
      render: (_, record) => (
        <Space>
          <Avatar 
            shape="circle" 
            size={40}
            style={{ 
                backgroundColor: record.jenis_kelamin === 'L' ? '#e0f2fe' : '#fce7f3',
                color: record.jenis_kelamin === 'L' ? '#0284c7' : '#db2777',
                border: `1px solid ${record.jenis_kelamin === 'L' ? '#bae6fd' : '#fbcfe8'}`
            }}
            icon={record.jenis_kelamin === 'L' ? <ManOutlined /> : <WomanOutlined />} 
          />
          <div className="flex flex-col">
            <Text strong className="text-gray-800 dark:text-gray-100">{record.nama}</Text>
            <Space size={4}>
                <Tag bordered={false} style={{ fontSize: 10, margin: 0 }}>{record.nis}</Tag>
            </Space>
          </div>
        </Space>
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
        <Space>
            <Typography.Title level={4} style={{ margin: 0, color: '#059669' }}>
                Database Santri
            </Typography.Title>
            <Tag color="cyan">{tableQueryResult?.data?.total || 0} Total</Tag>
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