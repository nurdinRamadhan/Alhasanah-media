import React, { useState, useMemo } from "react";
import { useForm } from "@refinedev/antd";
import { useList, useUpdate, useCreate, useDelete } from "@refinedev/core";
import {
  Card, Form, Input, Button, Upload, Row, Col, message,
  Typography, Modal, ColorPicker, Avatar, theme, InputNumber,
  Tag, Badge, Select, Tooltip, Tabs, Divider, Space, Spin
} from "antd";
import {
  BankOutlined, UploadOutlined, PlusOutlined,
  DeleteOutlined, UserOutlined, EditOutlined,
  EnvironmentOutlined, PhoneOutlined, MailOutlined,
  SafetyCertificateOutlined, ZoomInOutlined, ZoomOutOutlined,
  ExpandOutlined, CrownOutlined, TeamOutlined,
  ApartmentOutlined, UnorderedListOutlined, CalendarOutlined,
  PlusCircleOutlined, NodeIndexOutlined, StarFilled,
  BranchesOutlined, SettingOutlined
} from "@ant-design/icons";
import { Tree, TreeNode } from "react-organizational-chart";
import { supabaseClient } from "../../utility/supabaseClient";
import { IInstansiInfo, IStrukturOrganisasi } from "../../types";
import { motion, AnimatePresence } from "framer-motion";
import { useColorMode } from "../../contexts/color-mode";

const { Text, Title, Paragraph } = Typography;
const { useToken } = theme;

// ╔══════════════════════════════════════════════════════════════╗
// ║  DESIGN SYSTEM — ISLAMIC LUXURY TECH                        ║
// ╚══════════════════════════════════════════════════════════════╝
const GOLD       = "#C9A84C";
const GOLD_LIGHT = "#E8C96A";
const GOLD_BRIGHT= "#FFD166";
const GOLD_DEEP  = "#A07830";

interface Tokens {
  bg: string; surface: string; card: string; cardHover: string;
  border: string; borderAccent: string; accent: string;
  text: string; textSub: string; textMuted: string; divider: string;
}

const darkT: Tokens = {
  bg:          "#07070A",
  surface:     "#0E0E14",
  card:        "#13131C",
  cardHover:   "#1A1A26",
  border:      "rgba(201,168,76,0.12)",
  borderAccent:"rgba(201,168,76,0.40)",
  accent:      GOLD_BRIGHT,
  text:        "#F2EFE8",
  textSub:     "rgba(242,239,232,0.55)",
  textMuted:   "rgba(242,239,232,0.30)",
  divider:     "rgba(255,255,255,0.06)",
};

const lightT: Tokens = {
  bg:          "#F5F2EB",
  surface:     "#FFFFFF",
  card:        "#FFFFFF",
  cardHover:   "#FFFDF5",
  border:      "rgba(0,0,0,0.07)",
  borderAccent:"rgba(201,168,76,0.45)",
  accent:      GOLD_DEEP,
  text:        "#1A1714",
  textSub:     "rgba(26,23,20,0.55)",
  textMuted:   "rgba(26,23,20,0.35)",
  divider:     "rgba(0,0,0,0.07)",
};

// ──────────────────────────────────────────────────────────────
// GLOBAL STYLES
// ──────────────────────────────────────────────────────────────
const buildStyles = (mode: "light" | "dark") => {
  const t = mode === "dark" ? darkT : lightT;
  const lc = mode === "dark"
    ? "rgba(201,168,76,0.18)"
    : "rgba(201,168,76,0.28)";

  return `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');

.pp-root { font-family:'Plus Jakarta Sans',sans-serif; }
.pp-root .serif { font-family:'Cormorant Garamond',serif; }

/* Gold gradient text */
.g-text {
  background: linear-gradient(135deg, ${GOLD} 0%, ${GOLD_BRIGHT} 55%, ${GOLD_LIGHT} 100%);
  -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
}

/* Org tree lines */
.org-wrap ul  { padding-top:28px; position:relative; transition:all .4s; }
.org-wrap li  { float:left; text-align:center; list-style-type:none; position:relative; padding:28px 10px 0; transition:all .4s; }
.org-wrap li::before,.org-wrap li::after {
  content:''; position:absolute; top:0; right:50%;
  border-top:1px solid ${lc}; width:50%; height:28px;
}
.org-wrap li::after { right:auto; left:50%; border-left:1px solid ${lc}; }
.org-wrap li:only-child::after,.org-wrap li:only-child::before { display:none; }
.org-wrap li:only-child { padding-top:0; }
.org-wrap li:first-child::before,.org-wrap li:last-child::after { border:0 none; }
.org-wrap li:last-child::before { border-right:1px solid ${lc}; border-radius:0 8px 0 0; }
.org-wrap li:first-child::after { border-radius:8px 0 0 0; }
.org-wrap ul ul::before { content:''; position:absolute; top:0; left:50%; border-left:1px solid ${lc}; width:0; height:28px; }

/* Scrollbar */
.org-scroll::-webkit-scrollbar { width:3px; height:3px; }
.org-scroll::-webkit-scrollbar-track { background:transparent; }
.org-scroll::-webkit-scrollbar-thumb { background:rgba(201,168,76,.3); border-radius:4px; }
.org-scroll::-webkit-scrollbar-thumb:hover { background:rgba(201,168,76,.6); }

/* Management list hover */
.mgmt-row { transition:background .18s,border-color .18s; }
.mgmt-row:hover { background:${t.cardHover} !important; border-color:${t.borderAccent} !important; }
.mgmt-row .mgmt-actions { opacity:0; transition:opacity .18s; }
.mgmt-row:hover .mgmt-actions { opacity:1; }

/* Info item hover */
.info-item { transition:box-shadow .2s, border-color .2s; }
.info-item:hover { border-color:${t.borderAccent} !important; box-shadow: 0 4px 24px rgba(201,168,76,0.10) !important; }

/* Node card */
.org-node-card { transition:transform .2s, box-shadow .2s; cursor:default; }
.org-node-card:hover { transform:translateY(-3px); }

/* Keyframes */
@keyframes goldShimmer {
  0%   { background-position: -600px 0; }
  100% { background-position:  600px 0; }
}
@keyframes fadeUp {
  from { opacity:0; transform:translateY(16px); }
  to   { opacity:1; transform:translateY(0);    }
}

.fade-up { animation: fadeUp .5s ease forwards; }

/* Islamic star mosaic bg (inline SVG) */
.hero-bg {
  background-image: url("data:image/svg+xml,%3Csvg width='120' height='120' viewBox='0 0 120 120' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='rgba(201%2C168%2C76%2C0.08)' stroke-width='0.8'%3E%3Cpolygon points='60%2C10 110%2C35 110%2C85 60%2C110 10%2C85 10%2C35'/%3E%3Cpolygon points='60%2C25 95%2C42.5 95%2C77.5 60%2C95 25%2C77.5 25%2C42.5'/%3E%3Cline x1='60' y1='10' x2='60' y2='25'/%3E%3Cline x1='110' y1='35' x2='95' y2='42.5'/%3E%3Cline x1='110' y1='85' x2='95' y2='77.5'/%3E%3Cline x1='60' y1='110' x2='60' y2='95'/%3E%3Cline x1='10' y1='85' x2='25' y2='77.5'/%3E%3Cline x1='10' y1='35' x2='25' y2='42.5'/%3E%3C/g%3E%3C/svg%3E");
  background-size: 120px 120px;
}

/* Ant overrides for premium modal */
.pp-modal .ant-modal-content { 
  border-radius:20px !important;
  border:1px solid ${t.border} !important;
  overflow:hidden !important;
}
.pp-modal .ant-modal-header { border-bottom:1px solid ${t.divider} !important; padding:0 !important; }
.pp-modal .ant-modal-body   { padding:0 !important; }
.pp-modal .ant-modal-footer { border-top:1px solid ${t.divider} !important; }
`;
};

// ──────────────────────────────────────────────────────────────
// STAT CARD  (hero stats)
// ──────────────────────────────────────────────────────────────
const StatChip = ({
  value, label, icon, mode
}: { value: number | string; label: string; icon: React.ReactNode; mode: "light" | "dark" }) => {
  const t = mode === "dark" ? darkT : lightT;
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:10,
      padding:"10px 18px",
      background: mode === "dark"
        ? "rgba(201,168,76,0.07)"
        : "rgba(201,168,76,0.08)",
      border:`1px solid ${t.border}`,
      borderRadius:12,
      backdropFilter:"blur(10px)",
    }}>
      <span style={{ color: t.accent, fontSize:18 }}>{icon}</span>
      <div>
        <div style={{ fontWeight:700, fontSize:18, color: t.text, lineHeight:1 }}>{value}</div>
        <div style={{ fontSize:11, color: t.textMuted, letterSpacing:"0.5px", textTransform:"uppercase" }}>{label}</div>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────
// ORG NODE CARD  (tree view)
// ──────────────────────────────────────────────────────────────
const OrgNodeCard = ({
  node, onEdit, onAddChild, isRoot, mode
}: {
  node: IStrukturOrganisasi;
  onEdit: (n: IStrukturOrganisasi) => void;
  onAddChild: (id: number) => void;
  isRoot?: boolean;
  mode: "light" | "dark";
}) => {
  const t = mode === "dark" ? darkT : lightT;
  const accent = node.warna_kartu || (mode === "dark" ? GOLD_BRIGHT : GOLD_DEEP);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="inline-block org-node-card"
      style={{ margin: "0 6px" }}
    >
      <div style={{
        width: 210,
        background: t.card,
        border: `1px solid ${t.border}`,
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: mode === "dark"
          ? "0 8px 32px rgba(0,0,0,0.6)"
          : "0 4px 20px rgba(0,0,0,0.07)",
        position: "relative",
      }}>
        {/* Top accent bar */}
        <div style={{
          height: 3,
          background: `linear-gradient(90deg, ${accent}AA, ${accent}, ${accent}AA)`,
          boxShadow: mode === "dark" ? `0 0 12px ${accent}60` : "none",
        }} />

        {/* If root, shimmer overlay */}
        {isRoot && (
          <div style={{
            position:"absolute", top:3, left:0, right:0, height:3,
            background:`linear-gradient(90deg,transparent,${accent}80,transparent)`,
            backgroundSize:"600px 100%",
            animation:"goldShimmer 2.5s linear infinite",
          }} />
        )}

        <div style={{ padding:"16px 14px 0", textAlign:"center" }}>
          {/* Position tag */}
          <div style={{ marginBottom:8 }}>
            <span style={{
              display:"inline-block",
              background: `${accent}18`,
              color: accent,
              border: `1px solid ${accent}35`,
              borderRadius:20,
              fontSize:9,
              fontWeight:700,
              letterSpacing:"1px",
              textTransform:"uppercase",
              padding:"3px 10px",
              maxWidth:180,
              overflow:"hidden",
              textOverflow:"ellipsis",
              whiteSpace:"nowrap",
            }}>{node.jabatan || "Jabatan"}</span>
          </div>

          {/* Avatar */}
          <div style={{ position:"relative", display:"inline-block", marginBottom:10 }}>
            <Avatar
              src={node.foto_url}
              size={60}
              icon={<UserOutlined />}
              style={{
                border: `2px solid ${accent}50`,
                boxShadow: mode === "dark"
                  ? `0 0 0 3px ${t.card}, 0 0 16px ${accent}25`
                  : `0 0 0 3px ${t.card}`,
              }}
            />
            {isRoot && (
              <div style={{
                position:"absolute", bottom:-2, right:-2,
                background:`linear-gradient(135deg, ${GOLD}, ${GOLD_BRIGHT})`,
                borderRadius:"50%", padding:3,
                border:`2px solid ${t.card}`,
              }}>
                <CrownOutlined style={{ fontSize:8, color:"#000" }} />
              </div>
            )}
          </div>

          {/* Name */}
          <div style={{
            fontWeight:700, fontSize:13,
            color: t.text, lineHeight:1.3,
            marginBottom:2,
          }}>{node.nama_pejabat || "—"}</div>

          {/* NIY */}
          {node.nip_niy && (
            <div style={{
              fontSize:10, color: t.textMuted,
              letterSpacing:"0.3px", marginBottom:2,
              fontFamily:"monospace",
            }}>{node.nip_niy}</div>
          )}
        </div>

        {/* Action bar */}
        <div style={{
          display:"flex",
          borderTop:`1px solid ${t.divider}`,
          marginTop:12,
        }}>
          <Tooltip title="Edit Jabatan">
            <button
              onClick={() => onEdit(node)}
              style={{
                flex:1, height:34, border:"none", cursor:"pointer",
                background:"transparent",
                color:"#60A5FA",
                fontSize:13,
                borderRight:`1px solid ${t.divider}`,
                transition:"background .15s",
                display:"flex", alignItems:"center", justifyContent:"center",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(96,165,250,0.08)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <EditOutlined />
            </button>
          </Tooltip>
          <Tooltip title="Tambah Bawahan">
            <button
              onClick={() => onAddChild(node.id)}
              style={{
                flex:1, height:34, border:"none", cursor:"pointer",
                background:"transparent",
                color: accent,
                fontSize:13,
                transition:"background .15s",
                display:"flex", alignItems:"center", justifyContent:"center",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = `${accent}12`)}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <PlusOutlined />
            </button>
          </Tooltip>
        </div>
      </div>
    </motion.div>
  );
};

// ──────────────────────────────────────────────────────────────
// MANAGEMENT LIST ROW  (list/edit panel)
// ──────────────────────────────────────────────────────────────
const ManagementRow = ({
  node, depth, mode,
  onEdit, onAddChild, onDelete,
}: {
  node: IStrukturOrganisasi & { children?: IStrukturOrganisasi[] };
  depth: number;
  mode: "light" | "dark";
  onEdit: (n: IStrukturOrganisasi) => void;
  onAddChild: (id: number) => void;
  onDelete: (n: IStrukturOrganisasi) => void;
}) => {
  const t = mode === "dark" ? darkT : lightT;
  const accent = node.warna_kartu || (mode === "dark" ? GOLD_BRIGHT : GOLD_DEEP);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25, delay: depth * 0.05 }}
        className="mgmt-row"
        style={{
          display:"flex", alignItems:"center", gap:10,
          padding:"10px 14px",
          marginLeft: depth * 20,
          marginBottom:4,
          borderRadius:10,
          border:`1px solid transparent`,
          cursor:"default",
        }}
      >
        {/* Depth indicator */}
        {depth > 0 && (
          <div style={{
            width:16, flexShrink:0,
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            <BranchesOutlined style={{ fontSize:10, color:t.textMuted, opacity:0.6 }} />
          </div>
        )}

        {/* Avatar */}
        <Avatar
          src={node.foto_url} size={36} icon={<UserOutlined />}
          style={{ flexShrink:0, border:`2px solid ${accent}40` }}
        />

        {/* Info */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{
            fontSize:13, fontWeight:600, color:t.text,
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
          }}>{node.nama_pejabat || "—"}</div>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:2 }}>
            <span style={{
              fontSize:9, fontWeight:700, letterSpacing:"0.8px",
              textTransform:"uppercase",
              color: accent,
              background:`${accent}15`,
              border:`1px solid ${accent}30`,
              borderRadius:10, padding:"1px 7px",
            }}>{node.jabatan || "—"}</span>
            {hasChildren && (
              <span style={{ fontSize:9, color:t.textMuted }}>
                {node.children!.length} bawahan
              </span>
            )}
          </div>
        </div>

        {/* Actions — always visible, not just on hover */}
        <div className="mgmt-actions" style={{ display:"flex", gap:4, flexShrink:0 }}>
          <Tooltip title="Edit">
            <Button
              type="text" size="small"
              icon={<EditOutlined />}
              onClick={() => onEdit(node)}
              style={{ color:"#60A5FA", borderRadius:8 }}
            />
          </Tooltip>
          <Tooltip title="Tambah Bawahan">
            <Button
              type="text" size="small"
              icon={<PlusCircleOutlined />}
              onClick={() => onAddChild(node.id)}
              style={{ color: accent, borderRadius:8 }}
            />
          </Tooltip>
          <Tooltip title="Hapus">
            <Button
              type="text" size="small"
              icon={<DeleteOutlined />}
              onClick={() => onDelete(node)}
              style={{ color:"#F87171", borderRadius:8 }}
              danger
            />
          </Tooltip>
        </div>
      </motion.div>

      {/* Recursive children */}
      {hasChildren && node.children!.map(child => (
        <ManagementRow
          key={child.id}
          node={child}
          depth={depth + 1}
          mode={mode}
          onEdit={onEdit}
          onAddChild={onAddChild}
          onDelete={onDelete}
        />
      ))}
    </>
  );
};

// ╔══════════════════════════════════════════════════════════════╗
// ║  MAIN PAGE COMPONENT                                        ║
// ╚══════════════════════════════════════════════════════════════╝
export const InstansiPage = () => {
  const { token } = useToken();
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkT : lightT;

  // ── STATE ──────────────────────────────────────────────────
  const [zoom, setZoom]                       = useState(1);
  const [isNodeModalOpen, setIsNodeModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [editingNode, setEditingNode]         = useState<Partial<IStrukturOrganisasi> | null>(null);
  const [modalMode, setModalMode]             = useState<"EDIT" | "ADD">("EDIT");
  const [uploading, setUploading]             = useState(false);

  // ── DATA ───────────────────────────────────────────────────
  const {
    formProps: infoFormProps,
    saveButtonProps: infoSaveProps,
    queryResult: infoData,
  } = useForm<IInstansiInfo>({
    resource: "instansi_info", action: "edit", id: "1", redirect: false,
    onMutationSuccess: () => { setIsInfoModalOpen(false); message.success("Profil berhasil diperbarui"); },
  });

  const instansi = infoData?.data?.data;

  const { data: strukturData, refetch: refetchStruktur } = useList<IStrukturOrganisasi>({
    resource: "struktur_organisasi",
    pagination: { mode: "off" },
    sorters: [{ field: "urutan", order: "asc" }],
  });

  const { mutate: updateNode } = useUpdate();
  const { mutate: createNode } = useCreate();
  const { mutate: deleteNode } = useDelete();

  // ── COMPUTED ───────────────────────────────────────────────
  const buildTree = (items: IStrukturOrganisasi[], parentId: number | null = null): IStrukturOrganisasi[] =>
    items
      .filter(i => i.parent_id === parentId)
      .map(i => ({ ...i, children: buildTree(items, i.id) }))
      .sort((a, b) => (a.urutan || 0) - (b.urutan || 0));

  const allNodes   = strukturData?.data ?? [];
  const rootNodes  = useMemo(() => buildTree(allNodes, null), [allNodes]);
  const totalCount = allNodes.length;

  // flat list for parent selector in modal
  const flatSelectOptions = useMemo(() =>
    allNodes
      .filter(n => editingNode?.id ? n.id !== editingNode.id : true)
      .map(n => ({ value: n.id, label: `${n.jabatan}${n.nama_pejabat ? " — " + n.nama_pejabat : ""}` })),
    [allNodes, editingNode?.id]
  );

  // ── HANDLERS ───────────────────────────────────────────────
  const openAddRoot = () => {
    setEditingNode({ jabatan: "Pimpinan Utama", warna_kartu: mode === "dark" ? GOLD_BRIGHT : GOLD_DEEP, urutan: 1 });
    setModalMode("ADD");
    setIsNodeModalOpen(true);
  };

  const openAddChild = (parentId: number) => {
    setEditingNode({ parent_id: parentId, warna_kartu: mode === "dark" ? GOLD_BRIGHT : GOLD_DEEP, urutan: 0 });
    setModalMode("ADD");
    setIsNodeModalOpen(true);
  };

  const openEdit = (node: IStrukturOrganisasi) => {
    setEditingNode(node);
    setModalMode("EDIT");
    setIsNodeModalOpen(true);
  };

  const handleSaveNode = async () => {
    if (!editingNode) return;
    try {
      const { children: _c, ...payload } = editingNode as any;
      if (modalMode === "EDIT" && editingNode.id) {
        await updateNode({ resource: "struktur_organisasi", id: editingNode.id, values: payload });
      } else {
        await createNode({ resource: "struktur_organisasi", values: payload });
      }
      message.success("Data berhasil disimpan");
      setIsNodeModalOpen(false);
      setTimeout(() => refetchStruktur(), 500);
    } catch { message.error("Gagal menyimpan"); }
  };

  const handleDeleteNode = (node?: Partial<IStrukturOrganisasi>) => {
    const target = node || editingNode;
    Modal.confirm({
      title: "Hapus Jabatan?",
      content: "Tindakan ini permanen. Semua bawahan akan ikut terdampak.",
      okText: "Hapus", okType: "danger", cancelText: "Batal",
      onOk: async () => {
        await deleteNode({ resource: "struktur_organisasi", id: target!.id as number });
        setIsNodeModalOpen(false);
        setTimeout(() => refetchStruktur(), 500);
      },
    });
  };

  const handleUploadFoto = async ({ file, onSuccess }: any) => {
    const ext = file.name.split(".").pop();
    const path = `pejabat-${Date.now()}.${ext}`;
    setUploading(true);
    try {
      const { error } = await supabaseClient.storage.from("struktur-images").upload(path, file);
      if (!error) {
        const { data } = supabaseClient.storage.from("struktur-images").getPublicUrl(path);
        setEditingNode(prev => ({ ...prev, foto_url: data.publicUrl }));
        onSuccess?.("ok");
        message.success("Foto berhasil diunggah");
      }
    } catch { message.error("Gagal mengunggah foto"); }
    finally { setUploading(false); }
  };

  const renderTreeNodes = (nodes: IStrukturOrganisasi[]) =>
    nodes.map(node => (
      <TreeNode
        key={node.id}
        label={
          <OrgNodeCard
            node={node}
            mode={mode}
            onEdit={openEdit}
            onAddChild={openAddChild}
          />
        }
      >
        {node.children?.length ? renderTreeNodes(node.children) : null}
      </TreeNode>
    ));

  // ── INFO ITEM ──────────────────────────────────────────────
  const InfoItem = ({
    icon, label, value, span = 12
  }: { icon: React.ReactNode; label: string; value?: string | number; span?: number }) => (
    <Col xs={24} sm={span}>
      <div
        className="info-item"
        style={{
          display:"flex", alignItems:"flex-start", gap:14,
          padding:"18px 20px",
          background: t.card,
          border:`1px solid ${t.border}`,
          borderRadius:14,
          height:"100%",
          boxShadow:"none",
        }}
      >
        <div style={{
          width:40, height:40, flexShrink:0,
          display:"flex", alignItems:"center", justifyContent:"center",
          background:`linear-gradient(135deg, ${GOLD}18, ${GOLD_BRIGHT}10)`,
          border:`1px solid ${GOLD}25`,
          borderRadius:10,
        }}>
          <span style={{ color: t.accent, fontSize:16 }}>{icon}</span>
        </div>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:10, fontWeight:600, letterSpacing:"0.8px", textTransform:"uppercase", color:t.textMuted, marginBottom:4 }}>
            {label}
          </div>
          <div style={{ fontSize:14, fontWeight:600, color:t.text, lineHeight:1.4, wordBreak:"break-word" }}>
            {value || "—"}
          </div>
        </div>
      </div>
    </Col>
  );

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════
  return (
    <div
      className="pp-root"
      style={{ background: t.bg, minHeight:"100vh", paddingBottom:80 }}
    >
      <style>{buildStyles(mode)}</style>

      {/* ═══════════════════════════════════════════════════
          HERO BANNER
      ═══════════════════════════════════════════════════ */}
      <div style={{ marginBottom:28 }}>
        <div
          className="hero-bg"
          style={{
            background: mode === "dark"
              ? `linear-gradient(135deg, #0E0C07 0%, #151208 50%, #0A0E0C 100%)`
              : `linear-gradient(135deg, #2D2416 0%, #3D3020 50%, #241C10 100%)`,
            borderRadius:24,
            overflow:"hidden",
            padding:"40px 40px 32px",
            position:"relative",
            border:`1px solid ${GOLD}20`,
            boxShadow: mode === "dark"
              ? `0 24px 60px rgba(0,0,0,0.7), inset 0 1px 0 ${GOLD}15`
              : `0 12px 40px rgba(0,0,0,0.2)`,
          }}
        >
          {/* Radial glow */}
          <div style={{
            position:"absolute", top:-60, left:"50%", transform:"translateX(-50%)",
            width:500, height:300,
            background:`radial-gradient(ellipse, ${GOLD}10 0%, transparent 70%)`,
            pointerEvents:"none",
          }} />

          {/* Top stripe */}
          <div style={{
            position:"absolute", top:0, left:0, right:0, height:2,
            background:`linear-gradient(90deg, transparent, ${GOLD_BRIGHT}, ${GOLD}, transparent)`,
            opacity:0.8,
          }} />

          <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:32, position:"relative" }}>
            {/* Logo */}
            <div style={{ position:"relative", flexShrink:0 }}>
              <div style={{
                position:"absolute", inset:-6,
                background:`conic-gradient(from 0deg, ${GOLD}00, ${GOLD_BRIGHT}60, ${GOLD}00)`,
                borderRadius:"50%",
                animation:"none",
              }} />
              <Avatar
                src={instansi?.logo_url}
                size={100}
                icon={<BankOutlined />}
                style={{
                  background: "rgba(0,0,0,0.4)",
                  border:`2px solid ${GOLD}40`,
                  boxShadow:`0 0 30px ${GOLD}25, 0 0 60px ${GOLD}10`,
                  position:"relative",
                }}
              />
              <Button
                shape="circle" size="small"
                icon={<EditOutlined style={{ fontSize:11 }} />}
                onClick={() => setIsInfoModalOpen(true)}
                style={{
                  position:"absolute", bottom:4, right:4,
                  background:`linear-gradient(135deg, ${GOLD}, ${GOLD_BRIGHT})`,
                  border:"none", color:"#000",
                  width:26, height:26, minWidth:26,
                  boxShadow:`0 2px 8px ${GOLD}60`,
                }}
              />
            </div>

            {/* Title block */}
            <div style={{ flex:1, minWidth:200 }}>
              <div style={{
                fontSize:11, fontWeight:700, letterSpacing:"3px",
                textTransform:"uppercase",
                background:`linear-gradient(90deg, ${GOLD}, ${GOLD_BRIGHT})`,
                WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
                marginBottom:8,
              }}>
                ◆ Profil Lembaga ◆
              </div>
              <h1 className="serif" style={{
                margin:0, fontSize:"clamp(22px,3vw,36px)",
                fontWeight:700, color:"#F5EDD8",
                lineHeight:1.2, letterSpacing:"-0.01em",
              }}>
                {instansi?.nama_instansi || "Nama Pesantren"}
              </h1>
              <p style={{
                margin:"10px 0 0",
                color:"rgba(245,237,216,0.55)",
                fontSize:14, fontWeight:400,
              }}>
                {instansi?.alamat || "Alamat pesantren belum diisi"}
              </p>
            </div>

            {/* Stats chips */}
            <div style={{
              display:"flex", flexWrap:"wrap", gap:10, flexShrink:0,
              justifyContent:"flex-end",
            }}>
              <StatChip
                value={totalCount}
                label="Total Jabatan"
                icon={<TeamOutlined />}
                mode={mode}
              />
              <StatChip
                value={rootNodes.length}
                label="Pimpinan"
                icon={<CrownOutlined />}
                mode={mode}
              />
              <StatChip
                value={instansi?.tahun_ajaran_aktif || "—"}
                label="Tahun Ajaran"
                icon={<CalendarOutlined />}
                mode={mode}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          INSTITUTION INFO GRID
      ═══════════════════════════════════════════════════ */}
      <div style={{ marginBottom:28 }}>
        {/* Section header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{
              width:4, height:24, borderRadius:4,
              background:`linear-gradient(180deg, ${GOLD}, ${GOLD_BRIGHT})`,
            }} />
            <span style={{ fontWeight:700, fontSize:16, color:t.text }}>Informasi Instansi</span>
          </div>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => setIsInfoModalOpen(true)}
            style={{
              background:`linear-gradient(135deg, ${GOLD}20, ${GOLD_BRIGHT}15)`,
              border:`1px solid ${GOLD}35`,
              color: t.accent,
              borderRadius:8, fontWeight:600, fontSize:12,
            }}
          >
            Sunting
          </Button>
        </div>

        <Row gutter={[12, 12]}>
          <InfoItem icon={<UserOutlined />}   label="Pimpinan"         value={instansi?.kepala_pesantren} />
          <InfoItem icon={<PhoneOutlined />}  label="No. Telepon"      value={instansi?.no_telp} />
          <InfoItem icon={<MailOutlined />}   label="Email Resmi"      value={instansi?.email} />
          <InfoItem icon={<CalendarOutlined />} label="Tahun Ajaran"   value={instansi?.tahun_ajaran_aktif} />
          <InfoItem icon={<EnvironmentOutlined />} label="Alamat"      value={instansi?.alamat} span={24} />
        </Row>
      </div>

      {/* ═══════════════════════════════════════════════════
          STRUKTUR ORGANISASI — DUAL VIEW
      ═══════════════════════════════════════════════════ */}
      <div>
        {/* Section header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{
              width:4, height:24, borderRadius:4,
              background:`linear-gradient(180deg, ${GOLD}, ${GOLD_BRIGHT})`,
            }} />
            <span style={{ fontWeight:700, fontSize:16, color:t.text }}>Struktur Organisasi</span>
            <span style={{
              fontSize:10, fontWeight:700, letterSpacing:"0.6px",
              color: t.accent, background:`${t.accent}15`,
              border:`1px solid ${t.accent}30`, borderRadius:20, padding:"2px 10px",
            }}>
              {totalCount} Jabatan
            </span>
          </div>

          {rootNodes.length === 0 && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openAddRoot}
              style={{
                background:`linear-gradient(135deg, ${GOLD}, ${GOLD_BRIGHT})`,
                border:"none", color:"#000", fontWeight:700, borderRadius:10,
              }}
            >
              Tambah Pimpinan
            </Button>
          )}
        </div>

        <Tabs
          defaultActiveKey="tree"
          type="card"
          style={{ marginBottom:0 }}
          tabBarStyle={{
            marginBottom:0,
            borderBottom:`1px solid ${t.divider}`,
          }}
          items={[
            // ─────────────────────────────────────────────
            // TAB 1 : VISUAL TREE
            // ─────────────────────────────────────────────
            {
              key: "tree",
              label: (
                <span style={{ display:"flex", alignItems:"center", gap:6, fontWeight:600 }}>
                  <ApartmentOutlined />Bagan Struktur
                </span>
              ),
              children: (
                <div style={{
                  background: t.card,
                  border:`1px solid ${t.border}`,
                  borderRadius:"0 16px 16px 16px",
                  minHeight:480,
                  overflow:"hidden",
                  position:"relative",
                }}>
                  {/* Zoom controls */}
                  <div style={{
                    position:"absolute", top:16, right:16, zIndex:10,
                    display:"flex", gap:6,
                    background: mode === "dark" ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.9)",
                    backdropFilter:"blur(10px)",
                    border:`1px solid ${t.border}`,
                    borderRadius:12, padding:4,
                  }}>
                    <Tooltip title="Perkecil">
                      <Button
                        size="small" type="text"
                        icon={<ZoomOutOutlined />}
                        style={{ borderRadius:8 }}
                        onClick={() => setZoom(z => Math.max(0.4, z - 0.1))}
                      />
                    </Tooltip>
                    <Tooltip title="Reset Zoom">
                      <Button
                        size="small" type="text"
                        icon={<ExpandOutlined />}
                        style={{ borderRadius:8 }}
                        onClick={() => setZoom(1)}
                      />
                    </Tooltip>
                    <Tooltip title="Perbesar">
                      <Button
                        size="small" type="text"
                        icon={<ZoomInOutlined />}
                        style={{ borderRadius:8 }}
                        onClick={() => setZoom(z => Math.min(1.6, z + 0.1))}
                      />
                    </Tooltip>
                    <div style={{
                      display:"flex", alignItems:"center",
                      fontSize:11, fontWeight:700, color:t.accent,
                      padding:"0 8px",
                    }}>
                      {Math.round(zoom * 100)}%
                    </div>
                  </div>

                  {/* Tree canvas */}
                  <div
                    className="org-scroll"
                    style={{ overflowX:"auto", overflowY:"auto", padding:"40px 32px", minHeight:480 }}
                  >
                    <div style={{
                      transform:`scale(${zoom})`,
                      transformOrigin:"top center",
                      transition:"transform .3s cubic-bezier(.4,0,.2,1)",
                      minWidth:"max-content",
                      margin:"0 auto",
                    }}>
                      {rootNodes.length > 0 ? (
                        <div className="org-wrap" style={{ display:"flex", justifyContent:"center" }}>
                          {rootNodes.map(root => (
                            <Tree
                              key={root.id}
                              lineWidth="1px"
                              lineColor="transparent"
                              label={
                                <OrgNodeCard
                                  node={root}
                                  mode={mode}
                                  onEdit={openEdit}
                                  onAddChild={openAddChild}
                                  isRoot
                                />
                              }
                            >
                              {root.children?.length ? renderTreeNodes(root.children) : null}
                            </Tree>
                          ))}
                        </div>
                      ) : (
                        <div style={{
                          display:"flex", flexDirection:"column",
                          alignItems:"center", justifyContent:"center",
                          paddingTop:100, paddingBottom:100,
                          opacity:0.25,
                        }}>
                          <NodeIndexOutlined style={{ fontSize:64, color:t.accent, marginBottom:16 }} />
                          <div style={{ fontWeight:600, color:t.text }}>
                            Struktur organisasi belum tersedia
                          </div>
                          <div style={{ fontSize:12, color:t.textMuted, marginTop:6 }}>
                            Klik "Tambah Pimpinan" untuk memulai
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ),
            },

            // ─────────────────────────────────────────────
            // TAB 2 : MANAGEMENT PANEL (solves editing UX)
            // ─────────────────────────────────────────────
            {
              key: "manage",
              label: (
                <span style={{ display:"flex", alignItems:"center", gap:6, fontWeight:600 }}>
                  <SettingOutlined />Kelola Jabatan
                </span>
              ),
              children: (
                <div style={{
                  background: t.card,
                  border:`1px solid ${t.border}`,
                  borderRadius:"0 16px 16px 16px",
                  minHeight:480,
                }}>
                  {/* Panel header */}
                  <div style={{
                    display:"flex", alignItems:"center", justifyContent:"space-between",
                    padding:"16px 20px",
                    borderBottom:`1px solid ${t.divider}`,
                  }}>
                    <div>
                      <div style={{ fontWeight:700, color:t.text, fontSize:14 }}>
                        Daftar Jabatan & Pengurus
                      </div>
                      <div style={{ fontSize:11, color:t.textMuted, marginTop:2 }}>
                        Klik tombol aksi di setiap baris untuk mengedit, menambah bawahan, atau menghapus
                      </div>
                    </div>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={openAddRoot}
                      size="small"
                      style={{
                        background:`linear-gradient(135deg, ${GOLD}, ${GOLD_BRIGHT})`,
                        border:"none", color:"#000", fontWeight:700, borderRadius:8,
                      }}
                    >
                      Tambah Pimpinan
                    </Button>
                  </div>

                  {/* Legend */}
                  <div style={{
                    display:"flex", gap:16, padding:"10px 20px",
                    borderBottom:`1px solid ${t.divider}`,
                    flexWrap:"wrap",
                  }}>
                    {[
                      { icon:<EditOutlined />, color:"#60A5FA", label:"Edit data" },
                      { icon:<PlusCircleOutlined />, color:t.accent, label:"Tambah bawahan" },
                      { icon:<DeleteOutlined />, color:"#F87171", label:"Hapus jabatan" },
                    ].map(item => (
                      <div key={item.label} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:t.textMuted }}>
                        <span style={{ color:item.color }}>{item.icon}</span>
                        {item.label}
                      </div>
                    ))}
                  </div>

                  {/* List */}
                  <div
                    className="org-scroll"
                    style={{ padding:"12px 8px", maxHeight:500, overflowY:"auto" }}
                  >
                    {rootNodes.length > 0 ? (
                      rootNodes.map(root => (
                        <ManagementRow
                          key={root.id}
                          node={root}
                          depth={0}
                          mode={mode}
                          onEdit={openEdit}
                          onAddChild={openAddChild}
                          onDelete={n => handleDeleteNode(n)}
                        />
                      ))
                    ) : (
                      <div style={{
                        textAlign:"center", padding:"60px 0",
                        opacity:0.3,
                      }}>
                        <TeamOutlined style={{ fontSize:40, color:t.accent, display:"block", marginBottom:12 }} />
                        <div style={{ color:t.text, fontWeight:600 }}>Belum ada data jabatan</div>
                      </div>
                    )}
                  </div>
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* ═══════════════════════════════════════════════════
          MODAL — EDIT / ADD NODE
      ═══════════════════════════════════════════════════ */}
      <Modal
        open={isNodeModalOpen}
        onCancel={() => setIsNodeModalOpen(false)}
        footer={null}
        centered
        width={520}
        className="pp-modal"
        styles={{
          content: {
            background: t.card,
            border:`1px solid ${t.border}`,
            borderRadius:20, padding:0,
            overflow:"hidden",
          },
          mask: { backdropFilter:"blur(4px)" },
        }}
      >
        {/* Modal header */}
        <div style={{
          padding:"20px 24px 16px",
          borderBottom:`1px solid ${t.divider}`,
          background: mode === "dark"
            ? "rgba(201,168,76,0.05)"
            : "rgba(201,168,76,0.04)",
          display:"flex", alignItems:"center", gap:12,
        }}>
          <div style={{
            width:36, height:36,
            background:`linear-gradient(135deg, ${GOLD}, ${GOLD_BRIGHT})`,
            borderRadius:10,
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            {modalMode === "EDIT"
              ? <EditOutlined style={{ color:"#000", fontSize:15 }} />
              : <PlusOutlined  style={{ color:"#000", fontSize:15 }} />
            }
          </div>
          <div>
            <div style={{ fontWeight:800, fontSize:15, color:t.text }}>
              {modalMode === "EDIT" ? "Edit Data Pejabat" : "Tambah Jabatan Baru"}
            </div>
            <div style={{ fontSize:11, color:t.textMuted }}>
              {modalMode === "EDIT"
                ? "Perbarui informasi pejabat yang ada"
                : "Lengkapi data untuk jabatan baru"
              }
            </div>
          </div>
        </div>

        {/* Modal body */}
        <div style={{ padding:"20px 24px 24px" }}>
          {/* Photo upload */}
          <div style={{ display:"flex", justifyContent:"center", marginBottom:20 }}>
            <Upload customRequest={handleUploadFoto} showUploadList={false} accept="image/*">
              <div style={{ position:"relative", cursor:"pointer" }}>
                <Avatar
                  size={90}
                  src={editingNode?.foto_url}
                  icon={<UserOutlined />}
                  style={{
                    background: mode === "dark" ? "#1E1E2A" : "#F0ECE0",
                    border:`2px solid ${GOLD}35`,
                    opacity: uploading ? 0.5 : 1,
                    transition:"opacity .2s",
                  }}
                />
                <div style={{
                  position:"absolute", inset:0,
                  background:"rgba(0,0,0,0.45)",
                  borderRadius:"50%",
                  display:"flex", flexDirection:"column",
                  alignItems:"center", justifyContent:"center",
                  opacity: uploading ? 1 : 0,
                  transition:"opacity .2s",
                  pointerEvents:"none",
                }}
                  className="upload-overlay"
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.opacity = "1"; }}
                >
                  {uploading
                    ? <Spin size="small" />
                    : <>
                        <UploadOutlined style={{ color:"white", fontSize:20 }} />
                        <span style={{ color:"white", fontSize:10, marginTop:4 }}>Upload</span>
                      </>
                  }
                </div>
                <div style={{
                  position:"absolute", inset:0,
                  background:"rgba(0,0,0,0)",
                  borderRadius:"50%",
                  display:"flex", flexDirection:"column",
                  alignItems:"center", justifyContent:"center",
                  transition:"background .2s",
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "rgba(0,0,0,0.4)"; const ic = e.currentTarget.children[0] as HTMLElement; if(ic) ic.style.opacity = "1"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "rgba(0,0,0,0)"; const ic = e.currentTarget.children[0] as HTMLElement; if(ic) ic.style.opacity = "0"; }}
                >
                  <div style={{ opacity:0, transition:"opacity .2s", display:"flex", flexDirection:"column", alignItems:"center" }}>
                    <UploadOutlined style={{ color:"white", fontSize:20 }} />
                    <span style={{ color:"white", fontSize:10, marginTop:4, fontWeight:600 }}>Ganti Foto</span>
                  </div>
                </div>
              </div>
            </Upload>
          </div>

          <Row gutter={[12, 0]}>
            <Col span={24}>
              <Form.Item
                label={<span style={{ fontSize:12, fontWeight:600, color:t.textSub }}>Jabatan / Posisi</span>}
                required style={{ marginBottom:14 }}
              >
                <Input
                  size="large"
                  value={editingNode?.jabatan}
                  onChange={e => setEditingNode(p => ({ ...p, jabatan: e.target.value }))}
                  placeholder="cth: Kepala Sekolah, Bendahara..."
                  style={{ borderRadius:10, borderColor:t.border }}
                />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item
                label={<span style={{ fontSize:12, fontWeight:600, color:t.textSub }}>Nama Lengkap</span>}
                style={{ marginBottom:14 }}
              >
                <Input
                  size="large"
                  value={editingNode?.nama_pejabat}
                  onChange={e => setEditingNode(p => ({ ...p, nama_pejabat: e.target.value }))}
                  placeholder="Nama lengkap pejabat..."
                  style={{ borderRadius:10, borderColor:t.border }}
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label={<span style={{ fontSize:12, fontWeight:600, color:t.textSub }}>NIP / NIY</span>}
                style={{ marginBottom:14 }}
              >
                <Input
                  value={editingNode?.nip_niy}
                  onChange={e => setEditingNode(p => ({ ...p, nip_niy: e.target.value }))}
                  placeholder="Nomor induk..."
                  style={{ borderRadius:10, borderColor:t.border }}
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label={<span style={{ fontSize:12, fontWeight:600, color:t.textSub }}>Urutan Tampilan</span>}
                style={{ marginBottom:14 }}
              >
                <InputNumber
                  className="w-full" style={{ width:"100%", borderRadius:10 }}
                  value={editingNode?.urutan}
                  onChange={v => setEditingNode(p => ({ ...p, urutan: v ?? 0 }))}
                  min={0}
                />
              </Form.Item>
            </Col>

            {/* ★ KEY IMPROVEMENT: Parent selector */}
            <Col span={24}>
              <Form.Item
                label={
                  <span style={{ fontSize:12, fontWeight:600, color:t.textSub }}>
                    Atasan Langsung
                    <span style={{ marginLeft:6, fontSize:10, color:t.textMuted, fontWeight:400 }}>
                      (kosongkan jika pimpinan utama)
                    </span>
                  </span>
                }
                style={{ marginBottom:14 }}
              >
                <Select
                  allowClear
                  showSearch
                  size="large"
                  style={{ width:"100%", borderRadius:10 }}
                  placeholder="Pilih atasan langsung..."
                  value={editingNode?.parent_id ?? null}
                  onChange={v => setEditingNode(p => ({ ...p, parent_id: v ?? null }))}
                  options={flatSelectOptions}
                  filterOption={(input, opt) =>
                    (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                  optionRender={opt => (
                    <div style={{ fontSize:13, fontWeight:500 }}>{opt.label}</div>
                  )}
                />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item
                label={<span style={{ fontSize:12, fontWeight:600, color:t.textSub }}>Warna Aksen Kartu</span>}
                style={{ marginBottom:0 }}
              >
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <ColorPicker
                    value={editingNode?.warna_kartu || GOLD}
                    onChange={c => setEditingNode(p => ({ ...p, warna_kartu: c.toHexString() }))}
                    showText
                    style={{ flex:1 }}
                  />
                  {/* Quick preset swatches */}
                  <div style={{ display:"flex", gap:6 }}>
                    {[GOLD, "#60A5FA", "#34D399", "#F87171", "#A78BFA"].map(color => (
                      <button
                        key={color}
                        onClick={() => setEditingNode(p => ({ ...p, warna_kartu: color }))}
                        style={{
                          width:22, height:22, borderRadius:6, border:"none",
                          background:color, cursor:"pointer",
                          boxShadow: editingNode?.warna_kartu === color
                            ? `0 0 0 2px ${t.card}, 0 0 0 4px ${color}` : "none",
                          transition:"box-shadow .15s",
                        }}
                      />
                    ))}
                  </div>
                </div>
              </Form.Item>
            </Col>
          </Row>

          {/* Action buttons */}
          <div style={{
            display:"flex", justifyContent:"space-between", alignItems:"center",
            marginTop:24, paddingTop:20,
            borderTop:`1px solid ${t.divider}`,
          }}>
            <div>
              {modalMode === "EDIT" && (
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDeleteNode()}
                  style={{ borderRadius:10 }}
                >
                  Hapus Jabatan
                </Button>
              )}
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <Button
                onClick={() => setIsNodeModalOpen(false)}
                style={{ borderRadius:10, borderColor:t.border }}
              >
                Batal
              </Button>
              <Button
                type="primary"
                icon={<StarFilled style={{ fontSize:11 }} />}
                onClick={handleSaveNode}
                style={{
                  background:`linear-gradient(135deg, ${GOLD}, ${GOLD_BRIGHT})`,
                  border:"none", color:"#000",
                  fontWeight:700, borderRadius:10,
                  boxShadow:`0 4px 12px ${GOLD}40`,
                }}
              >
                Simpan Data
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ═══════════════════════════════════════════════════
          MODAL — EDIT INSTITUTION INFO
      ═══════════════════════════════════════════════════ */}
      <Modal
        title={null}
        open={isInfoModalOpen}
        onCancel={() => setIsInfoModalOpen(false)}
        footer={null}
        centered
        width={580}
        className="pp-modal"
        styles={{
          content: {
            background: t.card,
            border:`1px solid ${t.border}`,
            borderRadius:20, padding:0, overflow:"hidden",
          },
          mask: { backdropFilter:"blur(4px)" },
        }}
      >
        {/* Modal header */}
        <div style={{
          padding:"20px 24px 16px",
          borderBottom:`1px solid ${t.divider}`,
          background: mode === "dark"
            ? "rgba(201,168,76,0.05)" : "rgba(201,168,76,0.04)",
          display:"flex", alignItems:"center", gap:12,
        }}>
          <div style={{
            width:36, height:36,
            background:`linear-gradient(135deg, ${GOLD}, ${GOLD_BRIGHT})`,
            borderRadius:10,
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            <BankOutlined style={{ color:"#000", fontSize:15 }} />
          </div>
          <div>
            <div style={{ fontWeight:800, fontSize:15, color:t.text }}>Sunting Profil Instansi</div>
            <div style={{ fontSize:11, color:t.textMuted }}>Perbarui informasi lembaga pesantren</div>
          </div>
        </div>

        {/* Form */}
        <div style={{ padding:"20px 24px" }}>
          <Form {...infoFormProps} layout="vertical">
            <Form.Item
              label={<span style={{ fontSize:12, fontWeight:600, color:t.textSub }}>Nama Pesantren</span>}
              name="nama_instansi"
              style={{ marginBottom:14 }}
            >
              <Input size="large" style={{ borderRadius:10 }} />
            </Form.Item>

            <Form.Item
              label={<span style={{ fontSize:12, fontWeight:600, color:t.textSub }}>Nama Pimpinan</span>}
              name="kepala_pesantren"
              style={{ marginBottom:14 }}
            >
              <Input size="large" style={{ borderRadius:10 }} />
            </Form.Item>

            <Row gutter={12}>
              <Col span={12}>
                <Form.Item
                  label={<span style={{ fontSize:12, fontWeight:600, color:t.textSub }}>No. Telepon</span>}
                  name="no_telp"
                  style={{ marginBottom:14 }}
                >
                  <Input style={{ borderRadius:10 }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label={<span style={{ fontSize:12, fontWeight:600, color:t.textSub }}>Email Resmi</span>}
                  name="email"
                  style={{ marginBottom:14 }}
                >
                  <Input style={{ borderRadius:10 }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label={<span style={{ fontSize:12, fontWeight:600, color:t.textSub }}>Tahun Ajaran Aktif</span>}
              name="tahun_ajaran_aktif"
              style={{ marginBottom:14 }}
            >
              <Input placeholder="cth: 2024/2025" style={{ borderRadius:10 }} />
            </Form.Item>

            <Form.Item
              label={<span style={{ fontSize:12, fontWeight:600, color:t.textSub }}>Alamat Lengkap</span>}
              name="alamat"
              style={{ marginBottom:0 }}
            >
              <Input.TextArea rows={3} style={{ borderRadius:10 }} />
            </Form.Item>
          </Form>

          <div style={{
            display:"flex", justifyContent:"flex-end", gap:10,
            marginTop:20, paddingTop:20,
            borderTop:`1px solid ${t.divider}`,
          }}>
            <Button
              onClick={() => setIsInfoModalOpen(false)}
              style={{ borderRadius:10, borderColor:t.border }}
            >
              Batal
            </Button>
            <Button
              type="primary"
              onClick={(e) => infoSaveProps?.onClick?.(e as any)}
              style={{
                background:`linear-gradient(135deg, ${GOLD}, ${GOLD_BRIGHT})`,
                border:"none", color:"#000",
                fontWeight:700, borderRadius:10,
                boxShadow:`0 4px 12px ${GOLD}40`,
              }}
            >
              Simpan Perubahan
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
