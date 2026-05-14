import React from "react";
import { Spin } from "antd";

const GOLD = "#C9A84C";

// ── Lazy Loading Pages ──
export const DashboardPage      = React.lazy(() => import("./pages/dashboard").then(m => ({ default: m.DashboardPage })));
export const InstansiPage       = React.lazy(() => import("./pages/instansi").then(m => ({ default: m.InstansiPage })));
export const SantriList         = React.lazy(() => import("./pages/santri/list").then(m => ({ default: m.SantriList })));
export const SantriCreate       = React.lazy(() => import("./pages/santri/create").then(m => ({ default: m.SantriCreate })));
export const SantriEdit         = React.lazy(() => import("./pages/santri/edit").then(m => ({ default: m.SantriEdit })));
export const SantriShow         = React.lazy(() => import("./pages/santri/show").then(m => ({ default: m.SantriShow })));
export const PersebaranSantriPage   = React.lazy(() => import("./pages/santri/PersebaranSantri"));
export const PelanggaranList    = React.lazy(() => import("./pages/pelanggaran/list").then(m => ({ default: m.PelanggaranList })));
export const PelanggaranCreate  = React.lazy(() => import("./pages/pelanggaran/create").then(m => ({ default: m.PelanggaranCreate })));
export const PelanggaranEdit    = React.lazy(() => import("./pages/pelanggaran/edit").then(m => ({ default: m.PelanggaranEdit })));
export const PerizinanList      = React.lazy(() => import("./pages/perizinan/list").then(m => ({ default: m.PerizinanList })));
export const PerizinanCreate    = React.lazy(() => import("./pages/perizinan/create").then(m => ({ default: m.PerizinanCreate })));
export const PerizinanEdit      = React.lazy(() => import("./pages/perizinan/edit").then(m => ({ default: m.PerizinanEdit })));
export const KesehatanList      = React.lazy(() => import("./pages/kesehatan/list").then(m => ({ default: m.KesehatanList })));
export const KesehatanCreate    = React.lazy(() => import("./pages/kesehatan/create").then(m => ({ default: m.KesehatanCreate })));
export const KesehatanEdit      = React.lazy(() => import("./pages/kesehatan/edit").then(m => ({ default: m.KesehatanEdit })));
export const HafalanList        = React.lazy(() => import("./pages/hafalan/list").then(m => ({ default: m.HafalanList })));
export const HafalanCreate      = React.lazy(() => import("./pages/hafalan/create").then(m => ({ default: m.HafalanCreate })));
export const HafalanEdit        = React.lazy(() => import("./pages/hafalan/edit").then(m => ({ default: m.HafalanEdit })));
export const HafalanShow        = React.lazy(() => import("./pages/hafalan/show").then(m => ({ default: m.HafalanShow })));
export const BeritaList         = React.lazy(() => import("./pages/berita/list").then(m => ({ default: m.BeritaList })));
export const BeritaCreate       = React.lazy(() => import("./pages/berita/create").then(m => ({ default: m.BeritaCreate })));
export const BeritaEdit         = React.lazy(() => import("./pages/berita/edit").then(m => ({ default: m.BeritaEdit })));
export const InventarisList     = React.lazy(() => import("./pages/inventaris/list").then(m => ({ default: m.InventarisList })));
export const InventarisCreate   = React.lazy(() => import("./pages/inventaris/create").then(m => ({ default: m.InventarisCreate })));
export const InventarisShow     = React.lazy(() => import("./pages/inventaris/show").then(m => ({ default: m.InventarisShow })));
export const TagihanList        = React.lazy(() => import("./pages/tagihan/list").then(m => ({ default: m.TagihanList })));
export const TagihanCreate      = React.lazy(() => import("./pages/tagihan/create").then(m => ({ default: m.TagihanCreate })));
export const TagihanEdit        = React.lazy(() => import("./pages/tagihan/edit").then(m => ({ default: m.TagihanEdit })));
export const TransaksiList      = React.lazy(() => import("./pages/transaksi/list").then(m => ({ default: m.TransaksiList })));
export const TransaksiCreate    = React.lazy(() => import("./pages/transaksi/create").then(m => ({ default: m.TransaksiCreate })));
export const MurojaahList       = React.lazy(() => import("./pages/murojaah/list").then(m => ({ default: m.MurojaahList })));
export const MurojaahCreate     = React.lazy(() => import("./pages/murojaah/create").then(m => ({ default: m.MurojaahCreate })));
export const MurojaahShow       = React.lazy(() => import("./pages/murojaah/show").then(m => ({ default: m.MurojaahShow })));
export const HafalanKitabList   = React.lazy(() => import("./pages/hafalan-kitab/list").then(m => ({ default: m.HafalanKitabList })));
export const HafalanKitabCreate = React.lazy(() => import("./pages/hafalan-kitab/create").then(m => ({ default: m.HafalanKitabCreate })));
export const HafalanKitabShow   = React.lazy(() => import("./pages/hafalan-kitab/show").then(m => ({ default: m.HafalanKitabShow })));
export const PengeluaranList    = React.lazy(() => import("./pages/pengeluaran/list").then(m => ({ default: m.PengeluaranList })));
export const DiklatList         = React.lazy(() => import("./pages/diklat/list").then(m => ({ default: m.DiklatList })));
export const MasterDataPage     = React.lazy(() => import("./pages/diklat/master").then(m => ({ default: m.MasterDataPage })));
export const AuditLogList       = React.lazy(() => import("./pages/audit/list").then(m => ({ default: m.AuditLogList })));
export const RagKnowledgePage   = React.lazy(() => import("./pages/rag").then(m => ({ default: m.RagKnowledgePage })));
export const AkademikPage       = React.lazy(() => import("./pages/akademik/list").then(m => ({ default: m.AkademikPage })));
export const ScanQR             = React.lazy(() => import("./pages/scanQR/ScanQR").then(m => ({ default: m.ScanQR })));
export const CreateAdminPage    = React.lazy(() => import("./pages/admin-management/create").then(m => ({ default: m.CreateAdminPage })));
export const AdminList          = React.lazy(() => import("./pages/admin-management/list").then(m => ({ default: m.AdminList })));
export const AlumniList         = React.lazy(() => import("./pages/alumni/list").then(m => ({ default: m.AlumniList })));
export const ForumReportsList   = React.lazy(() => import("./pages/alumni/forum-reports").then(m => ({ default: m.ForumReportsList })));
export const WeeklyTestList     = React.lazy(() => import("./pages/ulangan/bank-soal/list").then(m => ({ default: m.WeeklyTestList })));
export const WeeklyTestCreate   = React.lazy(() => import("./pages/ulangan/create").then(m => ({ default: m.WeeklyTestCreate })));
export const WeeklyTestArsip    = React.lazy(() => import("./pages/ulangan/arsip/list").then(m => ({ default: m.WeeklyTestArsip })));
export const NotificationList   = React.lazy(() => import("./pages/notifications/list").then(m => ({ default: m.NotificationList })));
export const NotificationCreate = React.lazy(() => import("./pages/notifications/create").then(m => ({ default: m.NotificationCreate })));


export const LoadingFallback = () => (
  <div style={{
    height: "70vh", display: "flex", alignItems: "center", justifyContent: "center",
    flexDirection: "column", gap: "16px"
  }}>
    <Spin size="large" />
    <div style={{ color: GOLD, fontSize: "12px", fontWeight: 600, letterSpacing: "1px" }}>
      MEMUAT HALAMAN...
    </div>
  </div>
);
