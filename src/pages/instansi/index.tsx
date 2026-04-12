import React, { useState } from "react";
import { useForm } from "@refinedev/antd";
import { useList, useUpdate, useCreate, useDelete } from "@refinedev/core";
import { 
    Card, Form, Input, Button, Upload, Row, Col, message, 
    Typography, Modal, ColorPicker, Avatar, theme, InputNumber, Tag, Badge 
} from "antd";
import { 
    BankOutlined, UploadOutlined, PlusOutlined, 
    DeleteOutlined, UserOutlined, EditOutlined,
    EnvironmentOutlined, PhoneOutlined, MailOutlined, 
    SafetyCertificateOutlined,
    ZoomInOutlined,
    ZoomOutOutlined,
    ExpandOutlined
} from "@ant-design/icons";
import { Tree, TreeNode } from "react-organizational-chart";
import { supabaseClient } from "../../utility/supabaseClient";
import { IInstansiInfo, IStrukturOrganisasi } from "../../types";
import { motion } from "framer-motion";
import { useColorMode } from "../../contexts/color-mode";

const { Text, Title, Paragraph } = Typography;
const { useToken } = theme;

// --- DYNAMIC TREE STYLES ---
const getTreeStyles = (mode: 'light' | 'dark') => `
  .org-tree-container {
    padding: 40px;
    display: flex;
    justify-content: center;
  }
  .org-tree-container ul { 
    padding-top: 20px; 
    position: relative; 
    transition: all 0.5s; 
  }
  .org-tree-container li { 
    float: left; 
    text-align: center; 
    list-style-type: none; 
    position: relative; 
    padding: 20px 5px 0 5px; 
    transition: all 0.5s; 
  }
  .org-tree-container li::before, .org-tree-container li::after {
    content: ''; 
    position: absolute; 
    top: 0; 
    right: 50%; 
    border-top: 2px solid ${mode === 'dark' ? 'rgba(255, 183, 0, 0.2)' : 'rgba(6, 95, 70, 0.1)'}; 
    width: 50%; 
    height: 20px; 
    z-index: 1;
  }
  .org-tree-container li::after { 
    right: auto; 
    left: 50%; 
    border-left: 2px solid ${mode === 'dark' ? 'rgba(255, 183, 0, 0.2)' : 'rgba(6, 95, 70, 0.1)'}; 
  }
  .org-tree-container li:only-child::after, .org-tree-container li:only-child::before { 
    display: none; 
  }
  .org-tree-container li:only-child { 
    padding-top: 0; 
  }
  .org-tree-container li:first-child::before, .org-tree-container li:last-child::after { 
    border: 0 none; 
  }
  .org-tree-container li:last-child::before { 
    border-right: 2px solid ${mode === 'dark' ? 'rgba(255, 183, 0, 0.2)' : 'rgba(6, 95, 70, 0.1)'}; 
    border-radius: 0 10px 0 0; 
  }
  .org-tree-container li:first-child::after { 
    border-radius: 10px 0 0 0; 
  }
  .org-tree-container ul ul::before {
    content: ''; 
    position: absolute; 
    top: 0; 
    left: 50%; 
    border-left: 2px solid ${mode === 'dark' ? 'rgba(255, 183, 0, 0.2)' : 'rgba(6, 95, 70, 0.1)'}; 
    width: 0; 
    height: 20px;
  }
`;

const ModernNodeCard = ({ node, onEdit, onAddChild, isRoot }: { node: IStrukturOrganisasi, onEdit: (n:IStrukturOrganisasi)=>void, onAddChild: (id:number)=>void, isRoot?: boolean }) => {
    const { token } = useToken();
    const { mode } = useColorMode();
    const primaryColor = node.warna_kartu || (mode === 'dark' ? '#ffb700' : '#065f46');
    
    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block relative group"
        >
            <div 
                style={{ 
                    backgroundColor: mode === 'dark' ? '#0a0a0a' : '#ffffff',
                    border: `1px solid ${mode === 'dark' ? 'rgba(255, 183, 0, 0.1)' : 'rgba(6, 95, 70, 0.1)'}`,
                    boxShadow: mode === 'dark' ? '0 10px 30px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.05)',
                    borderRadius: '16px',
                    width: '240px',
                    overflow: 'hidden',
                    position: 'relative'
                }}
                className="transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
                {/* Glow bar */}
                <div style={{ height: '4px', width: '100%', backgroundColor: primaryColor, boxShadow: mode === 'dark' ? `0 0 10px ${primaryColor}` : 'none' }} />
                
                <div className="p-5 flex flex-col items-center">
                    <div className="mb-3">
                        <Tag style={{ 
                            backgroundColor: `${primaryColor}15`, 
                            color: primaryColor, 
                            border: `1px solid ${primaryColor}30`,
                            borderRadius: '20px',
                            fontWeight: 700,
                            fontSize: '10px',
                            textTransform: 'uppercase',
                            letterSpacing: '1px',
                            padding: '2px 10px'
                        }}>
                            {node.jabatan}
                        </Tag>
                    </div>

                    <div className="relative mb-3">
                        <Avatar 
                            src={node.foto_url} 
                            size={70} 
                            icon={<UserOutlined />} 
                            style={{ 
                                border: `3px solid ${mode === 'dark' ? '#1a1a1a' : '#f0f0f0'}`,
                                boxShadow: `0 0 0 2px ${primaryColor}40`
                            }}
                        />
                        {isRoot && (
                            <div className="absolute -bottom-1 -right-1 bg-amber-500 rounded-full p-1 border-2 border-black">
                                <SafetyCertificateOutlined style={{ fontSize: '12px', color: 'white' }} />
                            </div>
                        )}
                    </div>

                    <Title level={5} style={{ margin: 0, color: token.colorTextHeading, fontSize: '14px', fontWeight: 800 }}>
                        {node.nama_pejabat || "Nama Belum Diisi"}
                    </Title>
                    
                    {node.nip_niy && (
                        <Text style={{ color: token.colorTextDescription, fontSize: '10px', marginTop: '4px', letterSpacing: '0.5px' }}>
                            {node.nip_niy}
                        </Text>
                    )}
                </div>

                {/* Actions Overlay */}
                <div className="flex border-t border-black/5 dark:border-white/5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/5 dark:bg-white/5">
                    <Button 
                        type="text" 
                        block 
                        icon={<EditOutlined style={{ color: '#3b82f6' }} />} 
                        onClick={() => onEdit(node)}
                        className="rounded-none h-10"
                    />
                    <div className="w-px bg-black/5 dark:bg-white/5 h-10" />
                    <Button 
                        type="text" 
                        block 
                        icon={<PlusOutlined style={{ color: '#10b981' }} />} 
                        onClick={() => onAddChild(node.id)}
                        className="rounded-none h-10"
                    />
                </div>
            </div>
        </motion.div>
    );
};

export const InstansiPage = () => {
    const { token } = useToken();
    const { mode } = useColorMode();
    const [zoom, setZoom] = useState(1);
    
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
           
            const { children: _, ...payload } = editingNode;
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
                message.success("Foto berhasil diunggah");
            }
        } catch (_error) {
            message.error("Gagal mengunggah foto");
        } finally { setUploading(false); }
    };

    const renderTreeNodes = (nodes: IStrukturOrganisasi[]) => {
        return nodes.map(node => (
            <TreeNode 
                key={node.id} 
                label={<ModernNodeCard node={node} onEdit={(n) => { setEditingNode(n); setModalMode('EDIT'); setIsNodeModalOpen(true); }} onAddChild={(id) => { setEditingNode({ parent_id: id, warna_kartu: mode === 'dark' ? '#ffb700' : '#065f46', urutan: 0 }); setModalMode('ADD'); setIsNodeModalOpen(true); }} />}
            >
                {node.children && node.children.length > 0 && renderTreeNodes(node.children)}
            </TreeNode>
        ));
    };

    return (
        <div style={{ background: token.colorBgBase, minHeight: '100vh', paddingBottom: '100px' }}>
            <style>{getTreeStyles(mode)}</style>

            {/* --- HERO SECTION: INSTITUTION PROFILE --- */}
            <div className="mb-8">
                <Card 
                    bordered={false} 
                    style={{ 
                        borderRadius: '24px', 
                        overflow: 'hidden',
                        backgroundColor: mode === 'dark' ? '#0a0a0a' : '#ffffff',
                        border: `1px solid ${mode === 'dark' ? 'rgba(255, 183, 0, 0.1)' : 'rgba(0,0,0,0.05)'}`,
                        boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
                    }}
                    bodyStyle={{ padding: 0 }}
                >
                    <div className="flex flex-col lg:flex-row">
                        {/* Visual Identity */}
                        <div className="p-10 lg:w-1/3 flex flex-col items-center justify-center text-center border-b lg:border-b-0 lg:border-r border-black/5 dark:border-white/5 bg-gradient-to-br from-black/5 to-transparent">
                            <div className="relative mb-6">
                                <Avatar 
                                    src={instansi?.logo_url} 
                                    size={140} 
                                    icon={<BankOutlined />}
                                    style={{ 
                                        backgroundColor: mode === 'dark' ? '#111' : '#f0f0f0',
                                        border: `4px solid ${mode === 'dark' ? '#ffb70030' : '#065f4620'}`,
                                        boxShadow: mode === 'dark' ? '0 0 30px rgba(255, 183, 0, 0.1)' : 'none'
                                    }}
                                />
                                <Button 
                                    shape="circle" 
                                    icon={<EditOutlined />} 
                                    size="small" 
                                    style={{ position: 'absolute', bottom: 10, right: 10, backgroundColor: mode === 'dark' ? '#ffb700' : '#065f46', color: mode === 'dark' ? '#000' : '#fff', border: 'none' }}
                                    onClick={() => setIsInfoModalOpen(true)}
                                />
                            </div>
                            <Title level={2} style={{ margin: 0, fontWeight: 900, letterSpacing: '-0.02em', color: token.colorTextHeading }}>
                                {instansi?.nama_instansi || "Nama Pesantren"}
                            </Title>
                            <Text style={{ color: mode === 'dark' ? '#ffb700' : '#065f46', fontWeight: 700, letterSpacing: '2px', fontSize: '12px', marginTop: '8px', textTransform: 'uppercase' }}>
                                Profil Lembaga
                            </Text>
                        </div>

                        {/* Detailed Information */}
                        <div className="p-10 lg:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="space-y-8">
                                <div>
                                    <Text strong style={{ color: token.colorTextDescription, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Pimpinan Utama</Text>
                                    <div className="flex items-center gap-4 mt-2">
                                        <div style={{ backgroundColor: mode === 'dark' ? '#ffb70015' : '#065f4610', padding: '10px', borderRadius: '12px' }}>
                                            <UserOutlined style={{ color: mode === 'dark' ? '#ffb700' : '#065f46', fontSize: '20px' }} />
                                        </div>
                                        <Title level={4} style={{ margin: 0, fontWeight: 700 }}>{instansi?.kepala_pesantren || "-"}</Title>
                                    </div>
                                </div>
                                <div>
                                    <Text strong style={{ color: token.colorTextDescription, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Informasi Kontak</Text>
                                    <div className="space-y-3 mt-3">
                                        <div className="flex items-center gap-3">
                                            <PhoneOutlined style={{ color: mode === 'dark' ? '#ffb700' : '#065f46' }} />
                                            <Text>{instansi?.no_telp || "-"}</Text>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <MailOutlined style={{ color: mode === 'dark' ? '#ffb700' : '#065f46' }} />
                                            <Text>{instansi?.email || "-"}</Text>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-8">
                                <div>
                                    <Text strong style={{ color: token.colorTextDescription, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Alamat Instansi</Text>
                                    <div className="flex items-start gap-4 mt-2">
                                        <div style={{ backgroundColor: mode === 'dark' ? '#3b82f615' : '#3b82f610', padding: '10px', borderRadius: '12px' }}>
                                            <EnvironmentOutlined style={{ color: '#3b82f6', fontSize: '20px' }} />
                                        </div>
                                        <Paragraph style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: token.colorTextSecondary }}>
                                            {instansi?.alamat || "-"}
                                        </Paragraph>
                                    </div>
                                </div>
                                <div className="bg-black/5 dark:bg-white/5 p-4 rounded-xl border border-black/5 dark:border-white/5">
                                    <Badge status="processing" color={mode === 'dark' ? '#ffb700' : '#065f46'} text={<Text style={{ fontSize: '13px', fontWeight: 600 }}>Tahun Ajaran: {instansi?.tahun_ajaran_aktif}</Text>} />
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* --- HIERARCHY SECTION --- */}
            <div>
                <Card 
                    bordered={false} 
                    style={{ 
                        borderRadius: '24px', 
                        backgroundColor: mode === 'dark' ? '#0a0a0a' : '#ffffff',
                        border: `1px solid ${mode === 'dark' ? 'rgba(255, 183, 0, 0.1)' : 'rgba(0,0,0,0.05)'}`,
                        minHeight: '600px',
                        overflow: 'hidden'
                    }}
                    title={
                        <div className="py-4">
                            <Title level={4} style={{ margin: 0, fontWeight: 800 }}>Struktur Organisasi</Title>
                            <Text style={{ color: token.colorTextDescription, fontSize: '12px' }}>Hierarki Manajemen & Pengurus Pesantren</Text>
                        </div>
                    }
                    extra={
                        <div className="flex gap-2">
                            <Button icon={<ZoomOutOutlined />} onClick={() => setZoom(Math.max(0.5, zoom - 0.1))} />
                            <Button icon={<ExpandOutlined />} onClick={() => setZoom(1)} />
                            <Button icon={<ZoomInOutlined />} onClick={() => setZoom(Math.min(1.5, zoom + 0.1))} />
                            {rootNodes.length === 0 && (
                                <Button 
                                    type="primary" 
                                    icon={<PlusOutlined />} 
                                    style={{ backgroundColor: mode === 'dark' ? '#ffb700' : '#065f46', border: 'none', color: mode === 'dark' ? '#000' : '#fff' }}
                                    onClick={() => { setEditingNode({ jabatan: 'Pimpinan Utama', warna_kartu: mode === 'dark' ? '#ffb700' : '#065f46', urutan: 1 }); setModalMode('ADD'); setIsNodeModalOpen(true); }}
                                >
                                    Tambah Pimpinan
                                </Button>
                            )}
                        </div>
                    }
                >
                    <div className="w-full overflow-auto custom-scrollbar" style={{ cursor: 'grab' }}>
                        <div style={{ 
                            transform: `scale(${zoom})`, 
                            transformOrigin: 'top center',
                            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            minWidth: 'max-content',
                            margin: '0 auto'
                        }}>
                            <div className="org-tree-container">
                                {rootNodes.length > 0 ? rootNodes.map(root => (
                                    <Tree
                                        key={root.id}
                                        lineWidth={'2px'}
                                        lineColor={'transparent'} 
                                        label={<ModernNodeCard node={root} onEdit={(n) => { setEditingNode(n); setModalMode('EDIT'); setIsNodeModalOpen(true); }} onAddChild={(id) => { setEditingNode({ parent_id: id, warna_kartu: mode === 'dark' ? '#ffb700' : '#065f46', urutan: 0 }); setModalMode('ADD'); setIsNodeModalOpen(true); }} isRoot={true} />}
                                    >
                                        {root.children && renderTreeNodes(root.children)}
                                    </Tree>
                                )) : (
                                    <div className="flex flex-col items-center justify-center py-20 opacity-20">
                                        <BankOutlined style={{ fontSize: '80px' }} />
                                        <Text style={{ marginTop: '20px', fontWeight: 600 }}>Data Struktur Belum Tersedia</Text>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* --- MODALS --- */}
            <Modal
                title={modalMode === 'EDIT' ? "Perbarui Data Pejabat" : "Tambah Jabatan Baru"}
                open={isNodeModalOpen}
                onCancel={() => setIsNodeModalOpen(false)}
                footer={null}
                centered
                styles={{ content: { backgroundColor: mode === 'dark' ? '#0f0f0f' : '#fff', border: `1px solid ${mode === 'dark' ? '#333' : '#eee'}` } }}
            >
                <div className="space-y-6 pt-4">
                    <div className="flex justify-center mb-6">
                        <Upload customRequest={handleUploadFoto} showUploadList={false}>
                            <div className="relative group cursor-pointer">
                                <Avatar size={100} src={editingNode?.foto_url} icon={<UserOutlined />} style={{ backgroundColor: mode === 'dark' ? '#222' : '#f5f5f5', border: `3px solid ${mode === 'dark' ? '#333' : '#eee'}`, opacity: uploading ? 0.6 : 1 }} />
                                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <UploadOutlined style={{ color: 'white', fontSize: '24px' }} />
                                </div>
                            </div>
                        </Upload>
                    </div>

                    <Row gutter={16}>
                        <Col span={24}>
                            <Form.Item label="Jabatan / Posisi" required>
                                <Input value={editingNode?.jabatan} onChange={e => setEditingNode(prev => ({...prev, jabatan: e.target.value}))} size="large" />
                            </Form.Item>
                        </Col>
                        <Col span={24}>
                            <Form.Item label="Nama Lengkap Pejabat" required>
                                <Input value={editingNode?.nama_pejabat} onChange={e => setEditingNode(prev => ({...prev, nama_pejabat: e.target.value}))} size="large" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="NIP / NIY">
                                <Input value={editingNode?.nip_niy} onChange={e => setEditingNode(prev => ({...prev, nip_niy: e.target.value}))} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Urutan Tampilan">
                                <InputNumber className="w-full" value={editingNode?.urutan} onChange={val => setEditingNode(prev => ({...prev, urutan: val ?? 0}))} />
                            </Form.Item>
                        </Col>
                        <Col span={24}>
                            <Form.Item label="Aksen Warna Kartu">
                                <ColorPicker value={editingNode?.warna_kartu || '#065f46'} onChange={(c) => setEditingNode(prev => ({...prev, warna_kartu: c.toHexString()}))} showText className="w-full" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <div className="flex gap-3 justify-end pt-4">
                        {modalMode === 'EDIT' && (
                            <Button danger onClick={handleDeleteNode} icon={<DeleteOutlined />}>Hapus</Button>
                        )}
                        <Button onClick={() => setIsNodeModalOpen(false)}>Batal</Button>
                        <Button type="primary" onClick={handleSaveNode} style={{ backgroundColor: mode === 'dark' ? '#ffb700' : '#065f46', color: mode === 'dark' ? '#000' : '#fff', border: 'none' }}>Simpan Data</Button>
                    </div>
                </div>
            </Modal>

            <Modal 
                title="Sunting Profil Instansi" 
                open={isInfoModalOpen} 
                onCancel={() => setIsInfoModalOpen(false)} 
                onOk={(e) => infoSaveProps?.onClick(e as any)}
                width={600}
                styles={{ content: { backgroundColor: mode === 'dark' ? '#0f0f0f' : '#fff' } }}
            >
                <Form {...infoFormProps} layout="vertical" className="pt-4">
                    <Form.Item label="Nama Pesantren" name="nama_instansi"><Input size="large" /></Form.Item>
                    <Form.Item label="Nama Pimpinan" name="kepala_pesantren"><Input size="large" /></Form.Item>
                    <Row gutter={16}>
                        <Col span={12}><Form.Item label="No. Telepon" name="no_telp"><Input /></Form.Item></Col>
                        <Col span={12}><Form.Item label="Email Resmi" name="email"><Input /></Form.Item></Col>
                    </Row>
                    <Form.Item label="Tahun Ajaran Aktif" name="tahun_ajaran_aktif"><Input /></Form.Item>
                    <Form.Item label="Alamat Lengkap" name="alamat"><Input.TextArea rows={3} /></Form.Item>
                </Form>
            </Modal>
        </div>
    );
};