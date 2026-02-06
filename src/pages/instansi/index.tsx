import React, { useState } from "react";
import { useForm } from "@refinedev/antd";
import { useList, useUpdate, useCreate, useDelete } from "@refinedev/core";
import { 
    Card, Form, Input, Button, Upload, Row, Col, message, 
    Typography, Modal, ColorPicker, Avatar, Tooltip, theme, InputNumber, Divider 
} from "antd";
import { 
    BankOutlined, UploadOutlined, PlusCircleOutlined, 
    DeleteOutlined, UserOutlined, SaveOutlined, EditOutlined,
    EnvironmentOutlined, PhoneOutlined, MailOutlined, TeamOutlined
} from "@ant-design/icons";
import { Tree, TreeNode } from "react-organizational-chart";
import { supabaseClient } from "../../utility/supabaseClient";
import { IInstansiInfo, IStrukturOrganisasi } from "../../types";

const { Text, Title } = Typography;
const { useToken } = theme;

// --- 1. KOMPONEN KARTU PENGURUS (REVISI DESAIN) ---
const NodeCard = ({ node, onEdit, onAddChild }: { node: IStrukturOrganisasi, onEdit: (n:IStrukturOrganisasi)=>void, onAddChild: (id:number)=>void }) => {
    const { token } = useToken();
    return (
        <div className="inline-block mx-4 relative group">
            <Card 
                hoverable
                bordered={false}
                bodyStyle={{ padding: '20px 10px' }}
                style={{ 
                    borderTop: `5px solid ${node.warna_kartu || token.colorPrimary}`, 
                    width: 220,
                    borderRadius: 16,
                    background: token.colorBgContainer,
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                }}
                className="transition-all transform hover:-translate-y-2"
                onClick={() => onEdit(node)}
            >
                <div className="flex flex-col items-center text-center cursor-pointer">
                    {/* FOTO (ATAS) */}
                    <div className="relative mb-3">
                        <Avatar 
                            src={node.foto_url} 
                            size={80} 
                            icon={<UserOutlined />} 
                            className="border-4 border-gray-50 shadow-md"
                            style={{ backgroundColor: node.warna_kartu ? `${node.warna_kartu}20` : '#f3f4f6' }}
                        />
                    </div>

                    {/* JABATAN (TENGAH) */}
                    <Text 
                        className="text-[10px] uppercase font-bold tracking-widest mb-1 block" 
                        style={{color: node.warna_kartu || token.colorPrimary}}
                    >
                        {node.jabatan}
                    </Text>

                    {/* NAMA (BAWAH) */}
                    <Text className="text-base font-bold leading-tight line-clamp-2 mb-1" style={{color: token.colorText}}>
                        {node.nama_pejabat}
                    </Text>

                    {/* NIP/NIY (OPTIONAL) */}
                    {node.nip_niy && (
                         <Text type="secondary" className="text-[10px]">
                            {node.nip_niy}
                        </Text>
                    )}
                </div>
            </Card>
            
            {/* TOMBOL ADD CHILD (HOVER) */}
            <div className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10 pt-2">
                <Tooltip title="Tambah Bawahan">
                    <Button 
                        type="primary" shape="circle" icon={<PlusCircleOutlined />} size="large"
                        onClick={(e) => { e.stopPropagation(); onAddChild(node.id); }} 
                        className="shadow-lg border-2 border-white"
                        style={{ background: token.colorPrimary }}
                    />
                </Tooltip>
            </div>
        </div>
    );
};

export const InstansiPage = () => {
    const { token } = useToken();
    
    // --- STATE MODALS ---
    const [isNodeModalOpen, setIsNodeModalOpen] = useState(false); // Modal Edit Struktur
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false); // Modal Edit Info Instansi
    
    const [editingNode, setEditingNode] = useState<Partial<IStrukturOrganisasi> | null>(null);
    const [modalMode, setModalMode] = useState<'EDIT' | 'ADD'>('EDIT');
    const [uploading, setUploading] = useState(false);

    // --- FETCH DATA INFO INSTANSI ---
    const { formProps: infoFormProps, saveButtonProps: infoSaveProps, queryResult: infoData } = useForm<IInstansiInfo>({
        resource: "instansi_info",
        action: "edit",
        id: "1",
        redirect: false,
        onMutationSuccess: (_data) => {
            setIsInfoModalOpen(false);
            message.success("Profil Instansi Diperbarui");
        }
    });

    const instansi = infoData?.data?.data;

    // --- FETCH DATA STRUKTUR ---
    const { data: strukturData, refetch: refetchStruktur } = useList<IStrukturOrganisasi>({
        resource: "struktur_organisasi",
        pagination: { mode: "off" },
        sorters: [{ field: "urutan", order: "asc" }]
    });

    const { mutate: updateNode } = useUpdate();
    const { mutate: createNode } = useCreate();
    const { mutate: deleteNode } = useDelete();

    // --- TREE BUILDER LOGIC ---
    const buildTree = (items: IStrukturOrganisasi[], parentId: number | null = null): IStrukturOrganisasi[] => {
        return items
            .filter(item => item.parent_id === parentId)
            .map(item => ({ ...item, children: buildTree(items, item.id) }))
            .sort((a, b) => (a.urutan || 0) - (b.urutan || 0));
    };
    const rootNodes = strukturData?.data ? buildTree(strukturData.data, null) : [];

    // --- HANDLERS STRUKTUR ---
    const handleEditNode = (node: IStrukturOrganisasi) => {
        setEditingNode(node);
        setModalMode('EDIT');
        setIsNodeModalOpen(true);
    };

    const handleAddChild = (parentId: number) => {
        setEditingNode({ parent_id: parentId, warna_kartu: token.colorPrimary, urutan: 0 });
        setModalMode('ADD');
        setIsNodeModalOpen(true);
    };

    const handleSaveNode = async () => {
        if (!editingNode) return;
        try {
            // @ts-ignore
            const { children, ...payload } = editingNode; // Bersihkan children
            if (modalMode === 'EDIT' && editingNode?.id) {
                await updateNode({ resource: "struktur_organisasi", id: editingNode.id, values: payload });
                message.success("Jabatan diperbarui");
            } else if (modalMode === 'ADD') {
                await createNode({ resource: "struktur_organisasi", values: payload });
                message.success("Jabatan ditambahkan");
            }
            setIsNodeModalOpen(false);
            setTimeout(() => refetchStruktur(), 500); 
        } catch (e: any) {
            message.error("Gagal menyimpan");
        }
    };

    const handleDeleteNode = () => {
        if (!editingNode?.id) return;
        Modal.confirm({
            title: "Hapus Jabatan Ini?",
            content: "Menghapus jabatan ini akan menghapus semua jabatan di bawahnya.",
            okText: "Hapus Permanen",
            okType: 'danger',
            onOk: async () => {
                await deleteNode({ resource: "struktur_organisasi", id: editingNode.id as number });
                setIsNodeModalOpen(false);
                setTimeout(() => refetchStruktur(), 500);
            }
        });
    };

    const handleUploadFoto = async (options: any) => {
        const { file, onSuccess } = options;
        const filePath = `pejabat-${Date.now()}.${file.name.split('.').pop()}`;
        setUploading(true);
        try {
            const { error } = await supabaseClient.storage.from('struktur-images').upload(filePath, file);
            if(!error) {
                const { data } = supabaseClient.storage.from('struktur-images').getPublicUrl(filePath);
                setEditingNode(prev => ({ ...prev, foto_url: data.publicUrl }));
                onSuccess("Ok");
            }
        } catch(e) {} finally { setUploading(false); }
    };

    // --- RENDER TREE ---
    const renderTreeNodes = (nodes: IStrukturOrganisasi[]) => {
        return nodes.map(node => (
            <TreeNode 
                key={node.id} 
                label={<NodeCard node={node} onEdit={handleEditNode} onAddChild={handleAddChild} />}
            >
                {node.children && node.children.length > 0 && renderTreeNodes(node.children)}
            </TreeNode>
        ));
    };

    return (
        <div className="pb-20">
            {/* BAGIAN 1: HEADER INFORMASI INSTANSI */}
            <Card bordered={false} className="mb-6 shadow-sm overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4">
                    <Button 
                        type="default" icon={<EditOutlined />} 
                        onClick={() => setIsInfoModalOpen(true)}
                    >
                        Edit Profil
                    </Button>
                </div>

                <div className="flex flex-col md:flex-row items-center md:items-start gap-6 p-2">
                    {/* Logo */}
                    <div className="flex-shrink-0">
                         <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center border-4 border-emerald-50">
                             {instansi?.logo_url ? (
                                <img src={instansi.logo_url} alt="Logo" className="w-full h-full object-cover rounded-full" />
                             ) : (
                                <BankOutlined className="text-4xl text-emerald-600" />
                             )}
                         </div>
                    </div>

                    {/* Info Text */}
                    <div className="flex-1 text-center md:text-left">
                        <Title level={2} style={{ margin: 0, color: token.colorPrimary }}>
                            {instansi?.nama_instansi || "Nama Instansi Belum Diisi"}
                        </Title>
                        <Text className="text-lg text-gray-500 block mb-2">
                            Pimpinan: <span className="font-bold text-gray-700">{instansi?.kepala_pesantren || "-"}</span>
                        </Text>
                        
                        <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-3 text-gray-500">
                            <span className="flex items-center gap-1 text-xs">
                                <EnvironmentOutlined /> {instansi?.alamat || "-"}
                            </span>
                            <span className="flex items-center gap-1 text-xs">
                                <PhoneOutlined /> {instansi?.no_telp || "-"}
                            </span>
                             <span className="flex items-center gap-1 text-xs">
                                <MailOutlined /> {instansi?.email || "-"}
                            </span>
                        </div>
                    </div>
                </div>
            </Card>

            {/* BAGIAN 2: DIAGRAM STRUKTUR ORGANISASI */}
            <div className="p-8 bg-white dark:bg-[#1f1f1f] rounded-xl shadow-sm overflow-auto text-center relative" style={{ minHeight: '80vh' }}>
                
                {/* Judul Section */}
                <div className="mb-10 border-b pb-4 border-gray-100 dark:border-gray-800">
                    <Text strong className="text-xl block tracking-wide">STRUKTUR KEPENGURUSAN</Text>
                    <Text type="secondary" className="text-xs">Tahun Ajaran {instansi?.tahun_ajaran_aktif}</Text>
                    
                    {/* Tombol Tambah Root */}
                    <div className="absolute top-8 right-8">
                        <Tooltip title="Tambah Pimpinan Puncak Baru">
                            <Button 
                                type="dashed" 
                                icon={<PlusCircleOutlined />} 
                                onClick={() => {
                                    setEditingNode({ jabatan: 'Pimpinan Baru', warna_kartu: '#dc2626', urutan: rootNodes.length + 1, parent_id: null });
                                    setModalMode('ADD');
                                    setIsNodeModalOpen(true);
                                }}
                            >
                                Tambah Pimpinan
                            </Button>
                        </Tooltip>
                    </div>
                </div>

                {/* AREA CHART */}
                {rootNodes.length > 0 ? (
                    <div className="flex justify-center gap-12 items-start pt-4">
                        {/* Render semua node paling atas secara sejajar */}
                        {rootNodes.map(root => (
                            <Tree
                                key={root.id}
                                lineWidth={'2px'}
                                lineColor={token.colorBorder}
                                lineBorderRadius={'16px'}
                                label={<NodeCard node={root} onEdit={handleEditNode} onAddChild={handleAddChild} />}
                            >
                                {root.children && renderTreeNodes(root.children)}
                            </Tree>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                        <TeamOutlined className="text-4xl text-gray-300 mb-4"/>
                        <Text type="secondary" className="block mb-4">Struktur organisasi belum dibuat.</Text>
                        <Button type="primary" onClick={() => {
                            setEditingNode({ jabatan: 'Pimpinan Ponpes', warna_kartu: '#dc2626', urutan: 1 });
                            setModalMode('ADD');
                            setIsNodeModalOpen(true);
                        }}>Buat Pimpinan Pertama</Button>
                    </div>
                )}
            </div>

            {/* MODAL 1: EDIT STRUKTUR (NODE) */}
            <Modal
                title={modalMode === 'EDIT' ? "Edit Data Pengurus" : "Tambah Pengurus Baru"}
                open={isNodeModalOpen}
                onCancel={() => setIsNodeModalOpen(false)}
                footer={[
                    modalMode === 'EDIT' && <Button key="del" danger icon={<DeleteOutlined/>} onClick={handleDeleteNode} className="float-left">Hapus</Button>,
                    <Button key="cancel" onClick={() => setIsNodeModalOpen(false)}>Batal</Button>,
                    <Button key="save" type="primary" onClick={handleSaveNode}>Simpan</Button>
                ]}
                centered
            >
                <div className="flex flex-col gap-4 py-4">
                    <div className="text-center mb-6">
                         <Upload customRequest={handleUploadFoto} showUploadList={false} accept="image/*">
                            <div className="relative group cursor-pointer inline-block">
                                <Avatar size={100} src={editingNode?.foto_url} icon={<UserOutlined />} className="border-4 border-gray-100 shadow-md" />
                                <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-bold">
                                    {uploading ? '...' : <><UploadOutlined className="text-xl"/><br/>GANTI</>}
                                </div>
                            </div>
                         </Upload>
                    </div>
                    <Input placeholder="Nama Jabatan (Contoh: Bendahara)" value={editingNode?.jabatan} onChange={e => setEditingNode(prev => ({...prev, jabatan: e.target.value}))} addonBefore="Jabatan" />
                    <Input placeholder="Nama Lengkap Pejabat" value={editingNode?.nama_pejabat} onChange={e => setEditingNode(prev => ({...prev, nama_pejabat: e.target.value}))} addonBefore="Nama" />
                    <Row gutter={16}>
                        <Col span={12}><Input placeholder="NIP/NIY" value={editingNode?.nip_niy} onChange={e => setEditingNode(prev => ({...prev, nip_niy: e.target.value}))} /></Col>
                        <Col span={12}><InputNumber placeholder="Urutan" value={editingNode?.urutan} onChange={val => setEditingNode(prev => ({...prev, urutan: val ?? 0}))} className="w-full" /></Col>
                    </Row>
                    <div className="mt-2">
                         <Text className="text-xs text-gray-500 uppercase font-bold">Warna Header</Text>
                         <ColorPicker value={editingNode?.warna_kartu || token.colorPrimary} onChange={(c) => setEditingNode(prev => ({...prev, warna_kartu: c.toHexString()}))} showText className="w-full justify-start mt-1"/>
                    </div>
                </div>
            </Modal>

            {/* MODAL 2: EDIT INFO INSTANSI */}
            <Modal
                title="Edit Profil Pesantren"
                open={!!isInfoModalOpen}
                onCancel={() => setIsInfoModalOpen(false)}
                onOk={(e) => infoSaveProps?.onClick(e as any)}
                confirmLoading={!!infoSaveProps?.loading}
                width={700}
                centered
            >
                <Form {...infoFormProps} layout="vertical" className="pt-4">
                    <Row gutter={24}>
                        <Col span={12}>
                            <Form.Item label="Nama Pesantren" name="nama_instansi" rules={[{required:true}]}><Input /></Form.Item>
                            <Form.Item label="Kepala Pesantren" name="kepala_pesantren"><Input /></Form.Item>
                            <Form.Item label="Alamat" name="alamat"><Input.TextArea rows={3}/></Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Tahun Ajaran" name="tahun_ajaran_aktif"><Input /></Form.Item>
                            <Form.Item label="Telepon" name="no_telp"><Input /></Form.Item>
                            <Form.Item label="Email" name="email"><Input /></Form.Item>
                            <Form.Item label="URL Logo" name="logo_url" help="Paste link gambar logo disini"><Input prefix={<BankOutlined/>} /></Form.Item>
                        </Col>
                    </Row>
                </Form>
            </Modal>
        </div>
    );
};