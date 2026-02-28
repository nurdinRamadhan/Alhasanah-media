import React from "react";
import { useTable } from "@refinedev/antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import { Space, Button, Typography, Tooltip, Image, Switch, theme } from "antd";
import { 
    PlusOutlined, 
    EditOutlined, 
    DeleteOutlined, 
    GlobalOutlined, 
    FileTextOutlined,
    StarOutlined,
    StarFilled,
    ClockCircleOutlined,
    RocketOutlined
} from "@ant-design/icons";
import { IBerita } from "../../types";
import { useNavigation, useDelete, useUpdate } from "@refinedev/core";
import dayjs from "dayjs";

const { Text } = Typography;
const { useToken } = theme;

export const BeritaList = () => {
    const { token } = useToken();
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
            title: "Cover Artikel",
            dataIndex: "thumbnail_url",
            width: 140,
            render: (val) => typeof val === "string" ? (
                <div className="relative overflow-hidden rounded-xl aspect-video shadow-sm border border-black/5 dark:border-white/10 group">
                    <Image 
                        src={val} 
                        className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-110" 
                        preview={{ mask: <div className="text-xs font-medium">Lihat</div> }}
                    />
                </div>
            ) : (
                <div className="w-full aspect-video bg-gray-50 dark:bg-gray-800/50 rounded-xl flex flex-col items-center justify-center text-gray-400 border border-dashed border-gray-200 dark:border-gray-700">
                    <FileTextOutlined className="text-xl mb-1 opacity-50"/>
                </div>
            )
        },
        {
            title: "Informasi Konten",
            dataIndex: "judul",
            render: (_, r) => (
                <div className="flex flex-col gap-1.5 pr-4 py-1">
                    {/* Menggunakan div agar menjadi block element, mencegah teks menumpuk */}
                    <div className="text-sm font-bold text-gray-800 dark:text-gray-100 line-clamp-1 leading-tight">
                        {r.judul}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                        {r.ringkasan || "Tidak ada ringkasan yang ditambahkan..."}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20">
                            {r.kategori}
                        </span>
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-400 font-medium">
                            <ClockCircleOutlined /> {dayjs(r.tanggal_publish).format("DD MMM YYYY • HH:mm")}
                        </div>
                    </div>
                </div>
            )
        },
        {
            title: "Visibilitas",
            dataIndex: "status",
            width: 130,
            filters: true,
            valueEnum: {
                PUBLISHED: { text: "Published", status: "Success" },
                DRAFT: { text: "Draft", status: "Default" },
                ARCHIVED: { text: "Arsip", status: "Warning" },
            },
            render: (_, r) => (
                <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg border border-black/5 dark:border-white/5 w-fit">
                    <Switch 
                        size="small"
                        checked={r.status === 'PUBLISHED'}
                        onChange={() => handleToggleStatus(r.id, r.status)}
                        style={{ background: r.status === 'PUBLISHED' ? '#10b981' : undefined }}
                    />
                    <span className={`text-xs font-bold ${r.status === 'PUBLISHED' ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-400'}`}>
                        {r.status === 'PUBLISHED' ? 'TAYANG' : 'DRAFT'}
                    </span>
                </div>
            )
        },
        {
            title: "Headline",
            dataIndex: "is_featured",
            width: 90,
            align: 'center',
            render: (val, r) => (
                <Tooltip title={val ? "Hapus dari Slider Utama" : "Jadikan Slider Utama"}>
                    <div 
                        className={`cursor-pointer transition-all duration-300 hover:scale-110 flex justify-center items-center w-9 h-9 rounded-full mx-auto shadow-sm ${val ? 'bg-gradient-to-br from-amber-100 to-yellow-50 dark:from-amber-500/20 dark:to-yellow-500/10 border border-amber-200 dark:border-amber-500/30' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                        onClick={() => handleToggleFeatured(r.id, Boolean(val))}
                    >
                        {val ? <StarFilled className="text-amber-500 text-lg drop-shadow-md"/> : <StarOutlined className="text-gray-300 dark:text-gray-500 text-lg"/>}
                    </div>
                </Tooltip>
            )
        },
        {
            title: "Aksi",
            valueType: "option",
            width: 100,
            fixed: "right",
            align: 'center',
            render: (_, record) => (
                <Space size="small">
                    <Tooltip title="Edit Artikel">
                        <Button 
                            type="text" 
                            className="hover:bg-blue-50 dark:hover:bg-blue-500/10" 
                            icon={<EditOutlined className="text-blue-500" />} 
                            onClick={() => push(`/berita/edit/${record.id}`)} 
                        />
                    </Tooltip>
                    <Tooltip title="Hapus Permanen">
                        <Button 
                            type="text" 
                            className="hover:bg-red-50 dark:hover:bg-red-500/10" 
                            icon={<DeleteOutlined className="text-red-500"/>} 
                            onClick={() => {
                                if(confirm("Tindakan ini tidak dapat dibatalkan. Hapus berita ini?")) deleteMutate({ resource: "berita", id: record.id });
                            }} 
                        />
                    </Tooltip>
                </Space>
            )
        }
    ];

    return (
        <ProTable<IBerita>
            {...tableProps}
            columns={columns}
            rowKey="id"
            headerTitle={
                <div className="flex items-center gap-4 py-2">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 border border-white/20">
                        <RocketOutlined className="text-white text-xl" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-lg font-black text-gray-800 dark:text-white tracking-tight">Portal Informasi</span>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Pusat manajemen konten & berita aplikasi mobile</span>
                    </div>
                </div>
            }
            toolBarRender={() => [
                <Button 
                    key="create" 
                    type="primary" 
                    size="large"
                    className="rounded-xl font-medium shadow-md shadow-blue-500/20 flex items-center gap-2"
                    icon={<PlusOutlined />} 
                    onClick={() => push("/berita/create")}
                >
                    Tulis Berita
                </Button>
            ]}
            options={{ density: false, fullScreen: true, reload: true, setting: true }}
            search={{ labelWidth: 'auto', layout: 'vertical' }}
            pagination={{ 
                defaultPageSize: 10,
                showSizeChanger: true,
                className: "px-4"
            }}
            // Menghilangkan bg-white hardcode agar menyatu dengan Dark Mode
            className="rounded-2xl overflow-hidden shadow-sm border border-black/5 dark:border-white/5"
            cardProps={{
                bodyStyle: { padding: 0 }
            }}
        />
    );
};