import React, { useState, useRef } from "react";
import { useForm } from "@refinedev/antd";
import { useList, useUpdate, useCreate, useDelete } from "@refinedev/core";
import { 
    Card, Form, Input, Button, Upload, Row, Col, message, 
    Typography, Modal, ColorPicker, Avatar, Tooltip, theme, InputNumber, Tag, Badge 
} from "antd";
import { 
    BankOutlined, UploadOutlined, PlusOutlined, 
    DeleteOutlined, UserOutlined, EditOutlined,
    EnvironmentOutlined, PhoneOutlined, MailOutlined, 
    GlobalOutlined, ExpandAltOutlined, SafetyCertificateOutlined
} from "@ant-design/icons";
import { Tree, TreeNode } from "react-organizational-chart";
import { supabaseClient } from "../../utility/supabaseClient";
import { IInstansiInfo, IStrukturOrganisasi } from "../../types";
import { motion, AnimatePresence } from "framer-motion"; // Pastikan install framer-motion

const { Text, Title, Paragraph } = Typography;
const { useToken } = theme;

// --- STYLING KHUSUS UNTUK GARIS CHART ---
// Kita menyisipkan CSS ini agar garis chart terlihat neon/glowing
const treeStyles = `
  .org-tree-container ul { padding-top: 20px; position: relative; transition: all 0.5s; }
  .org-tree-container li { float: left; text-align: center; list-style-type: none; position: relative; padding: 20px 5px 0 5px; transition: all 0.5s; }
  .org-tree-container li::before, .org-tree-container li::after {
    content: ''; position: absolute; top: 0; right: 50%; border-top: 2px solid #303030; width: 50%; height: 20px; z-index: -1;
    border-image: linear-gradient(to right, rgba(16, 185, 129, 0), rgba(16, 185, 129, 0.5)) 1;
  }
  .org-tree-container li::after { right: auto; left: 50%; border-left: 2px solid #303030; }
  .org-tree-container li:only-child::after, .org-tree-container li:only-child::before { display: none; }
  .org-tree-container li:only-child { padding-top: 0; }
  .org-tree-container li:first-child::before, .org-tree-container li:last-child::after { border: 0 none; }
  .org-tree-container li:last-child::before { border-right: 2px solid #303030; border-radius: 0 5px 0 0; }
  .org-tree-container li:first-child::after { border-radius: 5px 0 0 0; }
  .org-tree-container ul ul::before {
    content: ''; position: absolute; top: 0; left: 50%; border-left: 2px solid #303030; width: 0; height: 20px;
  }
`;

// --- KOMPONEN KARTU FUTURISTIK ---
const ModernNodeCard = ({ node, onEdit, onAddChild, isRoot }: { node: IStrukturOrganisasi, onEdit: (n:IStrukturOrganisasi)=>void, onAddChild: (id:number)=>void, isRoot?: boolean }) => {
    const { token } = useToken();
    const primaryColor = node.warna_kartu || token.colorPrimary;
    
    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-block mx-2 relative group z-10"
        >
            <div 
                className={`
                    relative w-64 p-0 rounded-2xl overflow-hidden backdrop-blur-md transition-all duration-300
                    hover:scale-105 hover:shadow-[0_0_30px_rgba(16,185,129,0.3)]
                    border border-white/10
                `}
                style={{ 
                    background: `linear-gradient(145deg, rgba(30,30,30,0.9) 0%, rgba(20,20,20,0.95) 100%)`,
                    boxShadow: `0 8px 32px 0 rgba(0, 0, 0, 0.37)`,
                }}
            >
                {/* Header Strip with Glow */}
                <div 
                    className="h-2 w-full absolute top-0 left-0" 
                    style={{ 
                        background: primaryColor,
                        boxShadow: `0 0 15px ${primaryColor}` 
                    }} 
                />

                <div className="p-5 flex flex-col items-center cursor-pointer" onClick={() => onEdit(node)}>
                    
                    {/* Badge/Jabatan */}
                    <div className="mb-4 mt-2">
                        <Tag 
                            color={primaryColor} 
                            className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border-none shadow-sm"
                            style={{ color: '#fff', background: primaryColor }}
                        >
                            {node.jabatan}
                        </Tag>
                    </div>

                    {/* Foto Profile dengan Ring Bercahaya */}
                    <div className="relative mb-4 group-hover:mb-5 transition-all">
                        <div 
                            className="rounded-full p-1"
                            style={{ background: `linear-gradient(to bottom right, ${primaryColor}, transparent)` }}
                        >
                            <Avatar 
                                src={node.foto_url} 
                                size={90} 
                                icon={<UserOutlined />} 
                                className="border-4 border-[#1f1f1f]"
                                style={{ backgroundColor: '#2a2a2a' }}
                            />
                        </div>
                        {isRoot && (
                            <div className="absolute -top-2 -right-2 text-yellow-500 bg-black/50 rounded-full p-1 border border-yellow-500/30 backdrop-blur-sm">
                                <SafetyCertificateOutlined className="text-xl" />
                            </div>
                        )}
                    </div>

                    {/* Info Text */}
                    <h3 className="text-white font-bold text-lg leading-tight mb-1 line-clamp-1 w-full">
                        {node.nama_pejabat || "Nama Kosong"}
                    </h3>
                    
                    {node.nip_niy && (
                        <Text className="text-gray-400 text-xs font-mono bg-white/5 px-2 py-0.5 rounded">
                            ID: {node.nip_niy}
                        </Text>
                    )}
                </div>

                {/* Footer Action Bar (Muncul saat Hover) */}
                <div 
                    className="h-10 bg-white/5 border-t border-white/5 flex items-center justify-center gap-4 
                               translate-y-10 group-hover:translate-y-0 transition-transform duration-300 absolute bottom-0 w-full"
                >
                    <Tooltip title="Edit Data">
                        <Button type="text" size="small" icon={<EditOutlined className="text-blue-400"/>} onClick={(e) => {e.stopPropagation(); onEdit(node)}} />
                    </Tooltip>
                    <div className="w-[1px] h-4 bg-white/10"></div>
                    <Tooltip title="Tambah Bawahan">
                        <Button type="text" size="small" icon={<PlusOutlined className="text-emerald-400"/>} onClick={(e) => {e.stopPropagation(); onAddChild(node.id)}} />
                    </Tooltip>
                </div>
            </div>

            {/* Connecting Line Enhancement (Bottom) */}
            <div className="absolute -bottom-5 left-1/2 w-[2px] h-5 bg-gradient-to-b from-[#303030] to-transparent -translate-x-1/2 -z-10" />
        </motion.div>
    );
};

export const InstansiPage = () => {
    const { token } = useToken();
    const containerRef = useRef<HTMLDivElement>(null);
    
    // --- STATE ---
    const [isNodeModalOpen, setIsNodeModalOpen] = useState(false);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [editingNode, setEditingNode] = useState<Partial<IStrukturOrganisasi> | null>(null);
    const [modalMode, setModalMode] = useState<'EDIT' | 'ADD'>('EDIT');
    const [uploading, setUploading] = useState(false);

    // --- DATA FETCHING ---
    const { formProps: infoFormProps, saveButtonProps: infoSaveProps, queryResult: infoData } = useForm<IInstansiInfo>({
        resource: "instansi_info", action: "edit", id: "1", redirect: false,
        onMutationSuccess: () => { setIsInfoModalOpen(false); message.success("Profil Diperbarui"); }
    });
    const instansi = infoData?.data?.data;

    const { data: strukturData, refetch: refetchStruktur } = useList<IStrukturOrganisasi>({
        resource: "struktur_organisasi", pagination: { mode: "off" }, sorters: [{ field: "urutan", order: "asc" }]
    });
    const { mutate: updateNode } = useUpdate();
    const { mutate: createNode } = useCreate();
    const { mutate: deleteNode } = useDelete();

    // --- LOGIC ---
    const buildTree = (items: IStrukturOrganisasi[], parentId: number | null = null): IStrukturOrganisasi[] => {
        return items
            .filter(item => item.parent_id === parentId)
            .map(item => ({ ...item, children: buildTree(items, item.id) }))
            .sort((a, b) => (a.urutan || 0) - (b.urutan || 0));
    };
    const rootNodes = strukturData?.data ? buildTree(strukturData.data, null) : [];

    const handleSaveNode = async () => {
        if (!editingNode) return;
        try {
            // @ts-ignore
            const { children, ...payload } = editingNode;
            if (modalMode === 'EDIT' && editingNode?.id) {
                await updateNode({ resource: "struktur_organisasi", id: editingNode.id, values: payload });
            } else if (modalMode === 'ADD') {
                await createNode({ resource: "struktur_organisasi", values: payload });
            }
            message.success("Data Berhasil Disimpan");
            setIsNodeModalOpen(false);
            setTimeout(() => refetchStruktur(), 500); 
        } catch (e) { message.error("Gagal menyimpan"); }
    };

    const handleDeleteNode = () => {
        Modal.confirm({
            title: "Hapus Jabatan?", content: "Tindakan ini permanen dan akan menghapus bawahan.",
            okText: "Hapus", okType: 'danger', cancelText: "Batal",
            onOk: async () => {
                await deleteNode({ resource: "struktur_organisasi", id: editingNode!.id as number });
                setIsNodeModalOpen(false); setTimeout(() => refetchStruktur(), 500);
            }
        });
    };

    const handleUploadFoto = async ({ file, onSuccess }: any) => {
        const filePath = `pejabat-${Date.now()}.${file.name.split('.').pop()}`;
        setUploading(true);
        try {
            const { error } = await supabaseClient.storage.from('struktur-images').upload(filePath, file);
            if(!error) {
                const { data } = supabaseClient.storage.from('struktur-images').getPublicUrl(filePath);
                setEditingNode(prev => ({ ...prev, foto_url: data.publicUrl }));
                onSuccess("Ok");
            }
        } finally { setUploading(false); }
    };

    const renderTreeNodes = (nodes: IStrukturOrganisasi[]) => {
        return nodes.map(node => (
            <TreeNode 
                key={node.id} 
                label={<ModernNodeCard node={node} onEdit={(n) => { setEditingNode(n); setModalMode('EDIT'); setIsNodeModalOpen(true); }} onAddChild={(id) => { setEditingNode({ parent_id: id, warna_kartu: token.colorPrimary, urutan: 0 }); setModalMode('ADD'); setIsNodeModalOpen(true); }} />}
            >
                {node.children && node.children.length > 0 && renderTreeNodes(node.children)}
            </TreeNode>
        ));
    };

    return (
        <div className="min-h-screen bg-[#141414] text-gray-200 font-sans pb-20 relative overflow-x-hidden">
            <style>{treeStyles}</style>

            {/* --- HEADER SECTION: GLASSPANEL DASHBOARD --- */}
            <div className="relative mb-8 pt-4 px-6">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/20 to-blue-900/20 h-64 z-0 pointer-events-none blur-3xl opacity-50"></div>
                
                <Card 
                    bordered={false} 
                    className="backdrop-blur-xl bg-white/5 border border-white/10 shadow-2xl relative z-10 overflow-hidden rounded-2xl"
                    bodyStyle={{ padding: 0 }}
                >
                    <div className="flex flex-col md:flex-row">
                        {/* Kolom Kiri: Identitas Visual */}
                        <div className="p-8 md:w-1/3 flex flex-col items-center md:items-start border-b md:border-b-0 md:border-r border-white/5 relative">
                             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-cyan-500"></div>
                             
                             <div className="relative mb-6 group cursor-pointer" onClick={() => setIsInfoModalOpen(true)}>
                                <div className="absolute inset-0 bg-emerald-500 blur-xl opacity-20 group-hover:opacity-40 transition-opacity rounded-full"></div>
                                <Avatar 
                                    src={instansi?.logo_url} 
                                    size={100} 
                                    className="bg-[#1f1f1f] border-4 border-[#2a2a2a] relative z-10"
                                    icon={<BankOutlined className="text-4xl text-emerald-500"/>}
                                />
                                <div className="absolute bottom-0 right-0 bg-gray-800 p-1 rounded-full border border-gray-600 z-20">
                                    <EditOutlined className="text-xs text-white"/>
                                </div>
                             </div>
                             
                             <Title level={3} className="!text-white !mb-0 text-center md:text-left tracking-tight">
                                {instansi?.nama_instansi || "Pesantren Al-Hasanah"}
                             </Title>
                             <Text className="text-emerald-400 font-medium tracking-widest text-xs uppercase mt-1">
                                Panel Admin Terpadu
                             </Text>
                        </div>

                        {/* Kolom Kanan: Informasi Detail Grid */}
                        <div className="p-8 md:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                            <div className="space-y-4">
                                <div>
                                    <Text className="text-gray-500 text-xs uppercase font-bold block mb-1">Pimpinan / Pengasuh</Text>
                                    <div className="flex items-center gap-3">
                                        <UserOutlined className="text-emerald-500 bg-emerald-500/10 p-2 rounded-lg" />
                                        <Text className="text-lg text-gray-200 font-semibold">{instansi?.kepala_pesantren || "-"}</Text>
                                    </div>
                                </div>
                                <div>
                                    <Text className="text-gray-500 text-xs uppercase font-bold block mb-1">Kontak Resmi</Text>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-gray-300 text-sm hover:text-white transition-colors">
                                            <PhoneOutlined /> {instansi?.no_telp || "-"}
                                        </div>
                                        <div className="flex items-center gap-2 text-gray-300 text-sm hover:text-white transition-colors">
                                            <MailOutlined /> {instansi?.email || "-"}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 md:pl-6 md:border-l border-white/5">
                                <div>
                                    <Text className="text-gray-500 text-xs uppercase font-bold block mb-1">Lokasi & Tahun</Text>
                                    <div className="flex items-start gap-3">
                                        <EnvironmentOutlined className="text-cyan-500 bg-cyan-500/10 p-2 rounded-lg mt-1" />
                                        <div>
                                            <Text className="text-gray-300 text-sm block leading-relaxed mb-1">{instansi?.alamat}</Text>
                                            <Badge status="processing" text={<span className="text-gray-400 text-xs">Tahun Ajaran {instansi?.tahun_ajaran_aktif}</span>} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Decorative Watermark */}
                            <GlobalOutlined className="absolute right-4 bottom-4 text-9xl text-white opacity-[0.02] pointer-events-none" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* --- CHART SECTION --- */}
            <div className="px-6">
                <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-8 relative min-h-[80vh] flex flex-col items-center overflow-hidden">
                    
                    {/* Grid Background Pattern */}
                    <div className="absolute inset-0 z-0 opacity-10" 
                         style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '30px 30px' }}>
                    </div>

                    <div className="relative z-10 w-full flex justify-between items-end mb-12 border-b border-white/5 pb-4">
                        <div>
                            <h2 className="text-2xl font-bold text-white tracking-wide">Struktur Organisasi</h2>
                            <p className="text-gray-500 text-sm">Mapping Hierarki Manajemen Pesantren</p>
                        </div>
                        <div className="flex gap-2">
                            {rootNodes.length === 0 && (
                                <Button type="primary" icon={<PlusOutlined />} className="bg-emerald-600 hover:bg-emerald-500 border-none h-10 px-6" onClick={() => { setEditingNode({ jabatan: 'Pimpinan Utama', warna_kartu: '#10b981', urutan: 1 }); setModalMode('ADD'); setIsNodeModalOpen(true); }}>
                                    Buat Pimpinan
                                </Button>
                            )}
                            <Tooltip title="Reset View (Center)">
                                <Button icon={<ExpandAltOutlined />} className="bg-white/5 border-white/10 text-white" />
                            </Tooltip>
                        </div>
                    </div>

                    <div className="w-full overflow-x-auto pb-20 custom-scrollbar relative z-10 flex justify-center org-tree-container">
                        {rootNodes.length > 0 ? rootNodes.map(root => (
                            <Tree
                                key={root.id}
                                lineWidth={'2px'}
                                lineColor={'#333'} 
                                lineBorderRadius={'12px'}
                                label={<ModernNodeCard node={root} onEdit={(n) => { setEditingNode(n); setModalMode('EDIT'); setIsNodeModalOpen(true); }} onAddChild={(id) => { setEditingNode({ parent_id: id, warna_kartu: token.colorPrimary, urutan: 0 }); setModalMode('ADD'); setIsNodeModalOpen(true); }} isRoot={true} />}
                            >
                                {root.children && renderTreeNodes(root.children)}
                            </Tree>
                        )) : (
                            <div className="text-center py-20 text-gray-500">
                                <div className="text-6xl mb-4 opacity-20"><GlobalOutlined spin /></div>
                                <p>Belum ada data struktur organisasi.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* --- MODAL EDIT/ADD NODE (FUTURISTIC THEME) --- */}
            <Modal
                title={null}
                open={isNodeModalOpen}
                onCancel={() => setIsNodeModalOpen(false)}
                footer={null}
                centered
                className="modal-futuristic"
                width={450}
                styles={{ content: { background: '#1f1f1f', border: '1px solid #333', borderRadius: '16px', overflow: 'hidden', padding: 0 } }}
            >
                <div className="relative bg-[#1f1f1f] text-gray-200">
                    <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-6 border-b border-gray-700 flex justify-between items-center">
                        <span className="font-bold text-lg text-white">{modalMode === 'EDIT' ? "Edit Pejabat" : "Tambah Jabatan Baru"}</span>
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    </div>
                    
                    <div className="p-6 space-y-5">
                        <div className="flex justify-center mb-6">
                             <Upload customRequest={handleUploadFoto} showUploadList={false} accept="image/*">
                                <div className="relative group cursor-pointer inline-block">
                                    <div className="absolute inset-0 bg-emerald-500 blur-lg opacity-20 rounded-full"></div>
                                    <Avatar size={100} src={editingNode?.foto_url} icon={<UserOutlined />} className="border-4 border-gray-700 relative z-10 bg-gray-800" />
                                    <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                        <UploadOutlined className="text-white text-xl"/>
                                    </div>
                                </div>
                             </Upload>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Jabatan</label>
                            <Input 
                                size="large" 
                                value={editingNode?.jabatan} 
                                onChange={e => setEditingNode(prev => ({...prev, jabatan: e.target.value}))} 
                                className="bg-black/20 border-gray-700 text-white placeholder-gray-600 rounded-lg hover:border-emerald-500 focus:border-emerald-500"
                            />
                        </div>
                        
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Nama Lengkap</label>
                            <Input 
                                size="large"
                                value={editingNode?.nama_pejabat} 
                                onChange={e => setEditingNode(prev => ({...prev, nama_pejabat: e.target.value}))}
                                className="bg-black/20 border-gray-700 text-white placeholder-gray-600 rounded-lg"
                            />
                        </div>

                        <Row gutter={16}>
                            <Col span={12}>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">NIP / NIY</label>
                                <Input value={editingNode?.nip_niy} onChange={e => setEditingNode(prev => ({...prev, nip_niy: e.target.value}))} className="bg-black/20 border-gray-700 text-white rounded-lg"/>
                            </Col>
                            <Col span={12}>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Urutan</label>
                                <InputNumber value={editingNode?.urutan} onChange={val => setEditingNode(prev => ({...prev, urutan: val ?? 0}))} className="w-full bg-black/20 border-gray-700 text-white rounded-lg input-dark-number"/>
                            </Col>
                        </Row>

                        <div>
                             <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Kode Warna Divisi</label>
                             <div className="bg-black/20 p-2 rounded-lg border border-gray-700">
                                <ColorPicker value={editingNode?.warna_kartu || '#10b981'} onChange={(c) => setEditingNode(prev => ({...prev, warna_kartu: c.toHexString()}))} showText className="w-full"/>
                             </div>
                        </div>

                        <div className="pt-4 flex gap-3 border-t border-gray-700 mt-6">
                            {modalMode === 'EDIT' && (
                                <Button danger icon={<DeleteOutlined/>} onClick={handleDeleteNode} className="bg-red-900/20 border-red-900/50 text-red-400">Hapus</Button>
                            )}
                            <div className="flex-1 flex justify-end gap-3">
                                <Button onClick={() => setIsNodeModalOpen(false)} className="bg-transparent border-gray-600 text-gray-400 hover:text-white">Batal</Button>
                                <Button type="primary" onClick={handleSaveNode} className="bg-emerald-600 hover:bg-emerald-500 border-none text-white px-6">Simpan Perubahan</Button>
                            </div>
                        </div>
                    </div>
                </div>
            </Modal>

             {/* MODAL 2: EDIT INFO INSTANSI (Disederhanakan untuk singkatnya, gunakan style yang sama) */}
             <Modal title="Edit Profil" open={!!isInfoModalOpen} onCancel={() => setIsInfoModalOpen(false)} onOk={(e) => infoSaveProps?.onClick(e as any)} styles={{ content: { background: '#1f1f1f', border: '1px solid #333' }, header: {background: 'transparent', borderBottom: '1px solid #333'}, body: {color: 'white'} }} width={700}>
                <Form {...infoFormProps} layout="vertical" className="pt-4">
                     <Row gutter={24}>
                        <Col span={12}>
                            <Form.Item label={<span className="text-gray-400">Nama Pesantren</span>} name="nama_instansi"><Input className="bg-black/20 border-gray-700 text-white"/></Form.Item>
                            <Form.Item label={<span className="text-gray-400">Pimpinan</span>} name="kepala_pesantren"><Input className="bg-black/20 border-gray-700 text-white"/></Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label={<span className="text-gray-400">Email</span>} name="email"><Input className="bg-black/20 border-gray-700 text-white"/></Form.Item>
                            <Form.Item label={<span className="text-gray-400">Alamat</span>} name="alamat"><Input.TextArea className="bg-black/20 border-gray-700 text-white"/></Form.Item>
                        </Col>
                    </Row>
                </Form>
            </Modal>
        </div>
    );
};