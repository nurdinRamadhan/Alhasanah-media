import React from "react";
import { useTable } from "@refinedev/antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import { Tag, Space, Button, Typography, Tooltip, Avatar, Image, Switch, message } from "antd";
import { 
    PlusOutlined, 
    EditOutlined, 
    DeleteOutlined, 
    GlobalOutlined, 
    FileTextOutlined,
    StarOutlined,
    StarFilled
} from "@ant-design/icons";
import { IBerita } from "../../types";
import { useNavigation, useDelete, useUpdate } from "@refinedev/core";
import dayjs from "dayjs";

const { Text } = Typography;

export const BeritaList = () => {
    const { tableProps } = useTable<IBerita>({
        resource: "berita",
        syncWithLocation: true,
        sorters: { initial: [{ field: "tanggal_publish", order: "desc" }] }
    });

    const { push } = useNavigation();
    const { mutate: deleteMutate } = useDelete();
    const { mutate: updateMutate } = useUpdate();

    // Toggle Featured (Headline)
    const handleToggleFeatured = (id: number, currentVal: boolean) => {
        updateMutate({
            resource: "berita", id,
            values: { is_featured: !currentVal },
            successNotification: { message: currentVal ? "Dihapus dari Headline" : "Dijadikan Headline Utama", type: "success" }
        });
    };

    // Toggle Publish Status
    const handleToggleStatus = (id: number, currentStatus: string) => {
        const newStatus = currentStatus === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
        updateMutate({
            resource: "berita", id: id.toString(),
            values: { status: newStatus },
            successNotification: { message: `Status diubah menjadi ${newStatus}`, type: "success" }
        });
    };

    const columns: ProColumns<IBerita>[] = [
        {
            title: "Thumbnail",
            dataIndex: "thumbnail_url",
            width: 100,
            render: (val) => typeof val === "string" ? <Image src={val} width={80} height={50} className="object-cover rounded" /> : <div className="w-20 h-12 bg-gray-100 rounded flex items-center justify-center text-gray-400"><FileTextOutlined/></div>
        },
        {
            title: "Judul & Ringkasan",
            dataIndex: "judul",
            render: (_, r) => (
                <div className="flex flex-col">
                    <Text strong className="text-base line-clamp-1">{r.judul}</Text>
                    <Text type="secondary" className="text-xs line-clamp-2">{r.ringkasan || "Tidak ada ringkasan"}</Text>
                    <div className="mt-1 flex gap-2">
                        <Tag>{r.kategori}</Tag>
                        <Text className="text-[10px] text-gray-400">{dayjs(r.tanggal_publish).format("DD MMM YYYY HH:mm")}</Text>
                    </div>
                </div>
            )
        },
        {
            title: "Status",
            dataIndex: "status",
            width: 120,
            filters: true,
            valueEnum: {
                PUBLISHED: { text: "Published", status: "Success" },
                DRAFT: { text: "Draft", status: "Default" },
                ARCHIVED: { text: "Arsip", status: "Warning" },
            },
            render: (_, r) => (
                <div className="flex flex-col items-start gap-1">
                    <Tag color={r.status === 'PUBLISHED' ? 'green' : 'default'}>
                        {r.status === 'PUBLISHED' ? <><GlobalOutlined/> Tayang</> : 'Draft'}
                    </Tag>
                    <Button 
                        type="link" size="small" className="text-[10px] p-0 h-auto"
                        onClick={() => handleToggleStatus(r.id, r.status)}
                    >
                        {r.status === 'PUBLISHED' ? 'Tarik (Draft)' : 'Terbitkan'}
                    </Button>
                </div>
            )
        },
        {
            title: "Headline",
            dataIndex: "is_featured",
            width: 100,
            align: 'center',
            render: (val, r) => (
                <Tooltip title="Tampilkan di Slider Aplikasi?">
                    <Button 
                        type="text" 
                        icon={val ? <StarFilled className="text-yellow-500 text-lg"/> : <StarOutlined className="text-gray-300 text-lg"/>}
                        onClick={() => handleToggleFeatured(r.id, Boolean(val))}
                    />
                </Tooltip>
            )
        },
        {
            title: "Aksi",
            valueType: "option",
            width: 120,
            fixed: "right",
            render: (_, record) => [
                <Tooltip title="Edit" key="edit">
                    <Button type="text" size="small" icon={<EditOutlined className="text-blue-600"/>} onClick={() => push(`/berita/edit/${record.id}`)} />
                </Tooltip>,
                <Tooltip title="Hapus" key="delete">
                    <Button 
                        type="text" danger size="small" icon={<DeleteOutlined />} 
                        onClick={() => {
                            if(confirm("Hapus berita ini?")) deleteMutate({ resource: "berita", id: record.id });
                        }} 
                    />
                </Tooltip>
            ]
        }
    ];

    return (
        <ProTable<IBerita>
            {...tableProps}
            columns={columns}
            rowKey="id"
            headerTitle={
                <Space>
                    <div className="bg-blue-50 p-2 rounded-lg border border-blue-100">
                        <GlobalOutlined className="text-blue-600 text-lg" />
                    </div>
                    <div className="flex flex-col">
                        <Text strong className="text-base">Portal Informasi</Text>
                        <Text type="secondary" className="text-xs">Kelola konten aplikasi mobile</Text>
                    </div>
                </Space>
            }
            toolBarRender={() => [
                <Button key="create" type="primary" icon={<PlusOutlined />} onClick={() => push("/berita/create")}>
                    Tulis Berita
                </Button>
            ]}
            options={{ density: true, fullScreen: true, reload: true }}
            search={{ labelWidth: 'auto', layout: 'vertical' }}
            pagination={{ defaultPageSize: 10 }}
            className="bg-white shadow-sm rounded-xl"
        />
    );
};