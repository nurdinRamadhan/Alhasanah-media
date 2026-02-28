import React from "react";
import "@refinedev/antd/dist/reset.css";
import "./styles/mobile-fix.css"
import { Authenticated, Refine } from "@refinedev/core";
import { DevtoolsProvider } from "@refinedev/devtools";
import { AuthPage, ErrorComponent, ThemedLayoutV2, ThemedSiderV2, useNotificationProvider } from "@refinedev/antd";
import "@refinedev/antd/dist/reset.css";
import { ConfigProvider, App as AntdApp, theme } from "antd"; 
import idID from "antd/locale/id_ID";
import routerBindings, { CatchAllNavigate, DocumentTitleHandler, NavigateToResource, UnsavedChangesNotifier } from "@refinedev/react-router-v6";
import { dataProvider } from "@refinedev/supabase"; 
import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";
import { authProvider } from "./authProvider";
import { Header } from "./pages/components/header";
import { Title } from "./pages/components/title"; 
import { ColorModeContextProvider, useColorMode } from "./contexts/color-mode"; 
import { supabaseClient } from "./utility/supabaseClient";

// --- IMPORT ICON ---
import { 
  WarningOutlined, 
  FileProtectOutlined, 
  MedicineBoxOutlined, 
  ReadOutlined,
  GlobalOutlined,
  BarcodeOutlined,
  WalletOutlined,
  UserOutlined,
  TeamOutlined,
  BookOutlined,
  SyncOutlined,
  RocketOutlined
} from "@ant-design/icons";

// Providers

import { accessControlProvider } from "./accessControlProvider"; // Pastikan path benar
// Kita buat wrapper kecil untuk mengecek role sebelum render AI Button
import { useGetIdentity } from "@refinedev/core";
import { IUserIdentity } from "./types";

// --- IMPORT PAGES ---
import { DashboardPage } from "./pages/dashboard";
import { AiFloatingButton } from "./components/AiFloatingButton";
import { GlobalCriticalAlert } from "./components/GlobalCriticalAlert";
import { GeminiConsultant } from "./components/GeminiConsultant";
import { DashboardOutlined } from "@ant-design/icons";

import { InstansiPage } from "./pages/instansi";
import { BankOutlined } from "@ant-design/icons";

import { SantriList } from "./pages/santri/list";
import { SantriCreate } from "./pages/santri/create";
import { SantriEdit } from "./pages/santri/edit";
import { SantriShow } from "./pages/santri/show";

import { PelanggaranList } from "./pages/pelanggaran/list";
import { PelanggaranCreate } from "./pages/pelanggaran/create";
import { PelanggaranEdit } from "./pages/pelanggaran/edit";

import { PerizinanList } from "./pages/perizinan/list";
import { PerizinanCreate } from "./pages/perizinan/create";
import { PerizinanEdit } from "./pages/perizinan/edit";

import { KesehatanList } from "./pages/kesehatan/list";
import { KesehatanCreate } from "./pages/kesehatan/create";
import { KesehatanEdit } from "./pages/kesehatan/edit";

import { HafalanList } from "./pages/hafalan/list";
import { HafalanCreate } from "./pages/hafalan/create";
import { HafalanEdit } from "./pages/hafalan/edit";
import { HafalanShow } from "./pages/hafalan/show";

import { BeritaList } from "./pages/berita/list";
import { BeritaCreate } from "./pages/berita/create";
import { BeritaEdit } from "./pages/berita/edit";

import { InventarisList } from "./pages/inventaris/list";
import { InventarisCreate } from "./pages/inventaris/create";
import { InventarisShow } from "./pages/inventaris/show";

import { TagihanList } from "./pages/tagihan/list";
import { TagihanCreate } from "./pages/tagihan/create";
import { TagihanEdit } from "./pages/tagihan/edit";

import { MurojaahList } from "./pages/murojaah/list";
import { MurojaahCreate } from "./pages/murojaah/create";
import { MurojaahShow } from "./pages/murojaah/show";

import { PengeluaranList } from "./pages/pengeluaran/list";
import { ShoppingCartOutlined } from "@ant-design/icons";
import { DiklatList } from "./pages/diklat/list";

import { AuditLogList } from "./pages/audit/list";
import { AkademikPage } from "./pages/akademik/list";
import { SafetyCertificateOutlined } from "@ant-design/icons";

import { ScanQR } from "./pages/scanQR/ScanQR";

import { CreateAdminPage } from "./pages/admin-management/create";
import { AdminList } from "./pages/admin-management/list";

const AIConsultantWrapper = () => {
    const { data: user } = useGetIdentity<IUserIdentity>();
    
    // Logic: Hanya dewan, super_admin, rois
    const allowedRoles = ["super_admin", "dewan", "rois"];
    
    if (user && allowedRoles.includes(user.role)) {
        return (
            <>
                <AiFloatingButton />
                <GeminiConsultant />
            </>
        );
    }
    return null;
};


const InnerApp = () => {
    const { mode } = useColorMode();
    const { defaultAlgorithm, darkAlgorithm } = theme;

    return (
        <ConfigProvider
            locale={idID}
            theme={{
                algorithm: mode === "dark" ? darkAlgorithm : defaultAlgorithm,
                token: {
                    colorPrimary: "#059669",
                    colorLink: "#059669",
                },
            }}
        >
            <AntdApp>
                <DevtoolsProvider>
                    <Refine
                        dataProvider={dataProvider(supabaseClient)}
                        authProvider={authProvider}
                        accessControlProvider={accessControlProvider}
                        routerProvider={routerBindings}
                        notificationProvider={useNotificationProvider}
                        resources={[
                            //DASHBOARD
                            {
                                name: "dashboard",
                                list: "/", // URL root
                                meta: { label: "Dashboard", icon: <DashboardOutlined /> }
                            },

                            // INSTANSI INFO
                            {
                                name: "instansi_info",
                                list: "/instansi",
                                meta: { label: "Profil Pesantren", icon: <BankOutlined /> }
                            },
                            {
                            name: "admin_management",
                            list: "/admin-management/list",
                            create: "/admin-management/create",
                            meta: { 
                                label: "Buat Admin Baru", 
                                icon: <UserOutlined /> 
                            }
                            },
                            // 1. DATA SANTRI
                            {
                                name: "santri",
                                list: "/santri",
                                create: "/santri/create",
                                edit: "/santri/edit/:id",
                                show: "/santri/show/:id",
                                meta: { label: "Data Santri", icon: <UserOutlined/>, idColumnName: "nis" }
                            },

                            // 2. INFORMASI & BERITA
                            {
                                name: "berita",
                                list: "/berita",
                                create: "/berita/create",
                                edit: "/berita/edit/:id",
                                meta: { label: "Informasi & Berita", icon: <GlobalOutlined /> }
                            },

                            // 3. KESANTRIAN (GROUP)
                            {
                                name: "kesantrian_menu",
                                meta: { label: "Kesantrian", icon: <TeamOutlined /> }
                            },
                            {
                                name: "pelanggaran_santri",
                                list: "/pelanggaran",
                                create: "/pelanggaran/create",
                                edit: "/pelanggaran/edit/:id",
                                meta: { label: "Pelanggaran", parent: "kesantrian_menu", icon: <WarningOutlined /> }
                            },
                            {
                                name: "perizinan_santri",
                                list: "/perizinan",
                                create: "/perizinan/create",
                                edit: "/perizinan/edit/:id",
                                meta: { label: "Perizinan", parent: "kesantrian_menu", icon: <FileProtectOutlined /> }
                            },
                            {
                                name: "kesehatan_santri",
                                list: "/kesehatan",
                                create: "/kesehatan/create",
                                edit: "/kesehatan/edit/:id",
                                meta: { label: "Kesehatan (UKS)", parent: "kesantrian_menu", icon: <MedicineBoxOutlined /> }
                            },

                            // 4. TAHFIDZ QURAN 
                            {
                                name: "tahfidz_menu",
                                meta: { label: "Tahfidz Quran", icon: <ReadOutlined /> }
                            },
                            {
                                name: "hafalan_tahfidz",
                                list: "/hafalan",
                                create: "/hafalan/create",
                                edit: "/hafalan/edit/:id",
                                show: "/hafalan/show/:id",
                                // Ziyadah masuk ke parent tahfidz_menu
                                meta: { label: "Ziyadah (Baru)", parent: "tahfidz_menu", icon: <BookOutlined /> } 
                            },
                            {
                                name: "murojaah_tahfidz",
                                list: "/murojaah",
                                create: "/murojaah/create",
                                show: "/murojaah/show/:id",
                                // Murojaah juga masuk ke parent tahfidz_menu
                                meta: { label: "Murojaah (Ulang)", parent: "tahfidz_menu", icon: <SyncOutlined /> } 
                            },


                            {
                                name: "audit_logs",
                                list: "/audit-logs",
                                meta: { label: "Log Aktivitas (Permanen)", icon: <SafetyCertificateOutlined /> }
                            },
                            {
                                name: "akademik",
                                list: "/akademik",
                                meta: { label: "Laporan nilai", icon: <BookOutlined /> }
                            },


                        

                            // 5. KEUANGAN
                            {
                                name: "tagihan_santri",
                                list: "/tagihan",
                                create: "/tagihan/create",
                                edit: "/tagihan/edit/:id",
                                meta: { label: "Keuangan & SPP", icon: <WalletOutlined /> }
                            },

                            {
                                name: "diklat",
                                list: "/diklat",
                                meta: { 
                                    label: "Diklat & Pasaran", 
                                    icon: <RocketOutlined /> 
                                }
                            },

                            // PENGELUARAN

                            {
                                name: "pengeluaran",
                                list: "/pengeluaran",
                                meta: { label: "Pengeluaran", icon: <ShoppingCartOutlined /> }
                            },

                            {
                                name: "scan-qr",
                                list: "/scanQr",
                                meta: { label: "Scan QR", icon: <BarcodeOutlined /> }
                            },

                            // 6. INVENTARIS
                            {
                                name: "inventaris",
                                list: "/inventaris",
                                create: "/inventaris/create",
                                edit: "/inventaris/edit/:id",
                                show: "/inventaris/show/:id",
                                meta: { label: "Inventaris Aset", icon: <BarcodeOutlined /> }
                            },

                            
                            
                        ]}
                        options={{
                            syncWithLocation: true,
                            warnWhenUnsavedChanges: true,
                            useNewQueryKeys: true,
                            projectId: "alhasanah-admin-panel",
                        }}
                        
                    >
                        
                        <Routes>
                            {/* --- LOGIN PAGE --- */}
                            <Route
                                element={
                                    <Authenticated key="auth-pages" fallback={<Outlet />}>
                                        <NavigateToResource />
                                    </Authenticated>
                                }
                            >
                                <Route
                                    path="/login"
                                    element={
                                        <AuthPage
                                            type="login"
                                            title={
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
                                                     <div style={{ background: '#059669', padding: '8px 16px', borderRadius: 8, color: 'white', fontWeight: 'bold', fontSize: 24 }}>AH</div>
                                                     <span style={{ color: '#064e3b', fontWeight: 'bold', marginTop: 8 }}>Admin Al-Hasanah</span>
                                                </div>
                                            }
                                            formProps={{
                                                initialValues: { email: "admin@alhasanah.com", password: "password123" },
                                            }}
                                        />
                                    }
                                />
                            </Route>
                            

                            {/* --- DASHBOARD & PROTECTED ROUTES --- */}
                            <Route
                                element={
                                    <Authenticated
                                        key="authenticated-inner"
                                        fallback={<CatchAllNavigate to="/login" />}
                                    >
                                        <ThemedLayoutV2
                                            Header={() => <Header sticky />}
                                            Sider={(props) => <ThemedSiderV2 {...props} fixed Title={Title} />}
                                        >
                                            <Outlet />
                                            {/* BUTTON AI DISIMPAN DISINI AGAR GLOBAL TAPI TERFILTER */}
                                        <AIConsultantWrapper />
                                        </ThemedLayoutV2>
                                    </Authenticated>
                                    
                                }
                                
                                
                            >
                                
                                {/*  ROUTE INDEX DASHBOARD */}
                                <Route index element={<DashboardPage />} />

                                {/*  ROUTE INSTANSI */}
                                <Route path="/instansi" element={<InstansiPage />} />
                                
                                {/* 1. Module Santri */}
                                <Route path="/santri">
                                    <Route index element={<SantriList />} />
                                    <Route path="create" element={<SantriCreate />} />
                                    <Route path="edit/:id" element={<SantriEdit />} />
                                    <Route path="show/:id" element={<SantriShow />} />
                                </Route>

                                {/* 2. Module Berita */}
                                <Route path="/berita">
                                    <Route index element={<BeritaList />} />
                                    <Route path="create" element={<BeritaCreate />} />
                                    <Route path="edit/:id" element={<BeritaEdit />} />
                                </Route>

                                {/* 3. Group Kesantrian */}
                                <Route path="/pelanggaran">
                                    <Route index element={<PelanggaranList />} />
                                    <Route path="create" element={<PelanggaranCreate />} />
                                    <Route path="edit/:id" element={<PelanggaranEdit />} />
                                </Route>
                                <Route path="/perizinan">
                                    <Route index element={<PerizinanList />} />
                                    <Route path="create" element={<PerizinanCreate />} />
                                    <Route path="edit/:id" element={<PerizinanEdit />} />
                                </Route>
                                <Route path="/kesehatan">
                                    <Route index element={<KesehatanList />} />
                                    <Route path="create" element={<KesehatanCreate />} />
                                    <Route path="edit/:id" element={<KesehatanEdit />} />
                                </Route>

                                {/* 4. Group Tahfidz */}
                                <Route path="/hafalan">
                                    <Route index element={<HafalanList />} />
                                    <Route path="create" element={<HafalanCreate />} />
                                    <Route path="edit/:id" element={<HafalanEdit />} />
                                    <Route path="show/:id" element={<HafalanShow />} />
                                </Route>
                                <Route path="/murojaah">
                                    <Route index element={<MurojaahList />} />
                                    <Route path="create" element={<MurojaahCreate />} />
                                    <Route path="show/:id" element={<MurojaahShow />} />
                                </Route>

                                {/* 4.5 Module Audit Log */}
                                <Route path="/audit-logs">
                                    <Route index element={<AuditLogList />} />
                                </Route>

                                {/* 4.5 Module Akademik */
                                <Route path="/akademik">
                                    <Route index element={<AkademikPage />} />
                                </Route>}



                                {/* 5. Module Keuangan */}
                                <Route path="/tagihan">
                                    <Route index element={<TagihanList />} />
                                    <Route path="create" element={<TagihanCreate />} />
                                    <Route path="edit/:id" element={<TagihanEdit />} />
                                </Route>
                                <Route path="/diklat" element={<DiklatList />} />

                                {/* Pengeluaran */}
                                <Route path="/pengeluaran" element={<PengeluaranList />} />

                                {/* Scan QR */}
                                <Route path="/scanQr" element={<ScanQR />} />

                            
                            

                                       

                                {/* PERBAIKAN: Path disamakan dengan resources.list */}
                               <Route path="/admin-management/create" element={<CreateAdminPage />} />
                               <Route path="/admin-management/list" element={<AdminList />} />
                                {/* 6. Module Inventaris */}
                                <Route path="/inventaris">
                                    <Route index element={<InventarisList />} />
                                    <Route path="create" element={<InventarisCreate />} />
                                    <Route path="show/:id" element={<InventarisShow />} />
                                </Route>
                                

                                <Route path="*" element={<ErrorComponent />} />
                            </Route>
                        </Routes>
                    
                        

                        <UnsavedChangesNotifier />
                        <DocumentTitleHandler />
                    </Refine>
                </DevtoolsProvider>
            </AntdApp>
        </ConfigProvider>
    );
};

function App() {
  return (
    <BrowserRouter>
      <ColorModeContextProvider>
         <InnerApp />
      </ColorModeContextProvider>
    </BrowserRouter>
  );
}

export default App;
