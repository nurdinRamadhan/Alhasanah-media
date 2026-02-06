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
  SyncOutlined
} from "@ant-design/icons";

// --- IMPORT PAGES ---
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
                        routerProvider={routerBindings}
                        notificationProvider={useNotificationProvider}
                        resources={[
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
                                name: "pelanggaran",
                                list: "/pelanggaran",
                                create: "/pelanggaran/create",
                                edit: "/pelanggaran/edit/:id",
                                meta: { label: "Pelanggaran", parent: "kesantrian_menu", icon: <WarningOutlined /> }
                            },
                            {
                                name: "perizinan",
                                list: "/perizinan",
                                create: "/perizinan/create",
                                edit: "/perizinan/edit/:id",
                                meta: { label: "Perizinan", parent: "kesantrian_menu", icon: <FileProtectOutlined /> }
                            },
                            {
                                name: "kesehatan",
                                list: "/kesehatan",
                                create: "/kesehatan/create",
                                edit: "/kesehatan/edit/:id",
                                meta: { label: "Kesehatan (UKS)", parent: "kesantrian_menu", icon: <MedicineBoxOutlined /> }
                            },

                            // 4. TAHFIDZ QURAN (GROUP)
                            {
                                name: "tahfidz_menu",
                                meta: { label: "Tahfidz Quran", icon: <ReadOutlined /> }
                            },
                            {
                                name: "hafalan",
                                list: "/hafalan",
                                create: "/hafalan/create",
                                edit: "/hafalan/edit/:id",
                                show: "/hafalan/show/:id",
                                // Ziyadah masuk ke parent tahfidz_menu
                                meta: { label: "Ziyadah (Baru)", parent: "tahfidz_menu", icon: <BookOutlined /> } 
                            },
                            {
                                name: "murojaah",
                                list: "/murojaah",
                                create: "/murojaah/create",
                                show: "/murojaah/show/:id",
                                // Murojaah juga masuk ke parent tahfidz_menu
                                meta: { label: "Murojaah (Ulang)", parent: "tahfidz_menu", icon: <SyncOutlined /> } 
                            },

                            // 5. KEUANGAN
                            {
                                name: "tagihan",
                                list: "/tagihan",
                                create: "/tagihan/create",
                                edit: "/tagihan/edit/:id",
                                meta: { label: "Keuangan & SPP", icon: <WalletOutlined /> }
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
                                        </ThemedLayoutV2>
                                    </Authenticated>
                                }
                            >
                                {/* Default Route ke Santri */}
                                <Route index element={<NavigateToResource resource="santri" />} />
                                
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

                                {/* 5. Module Keuangan */}
                                <Route path="/tagihan">
                                    <Route index element={<TagihanList />} />
                                    <Route path="create" element={<TagihanCreate />} />
                                    <Route path="edit/:id" element={<TagihanEdit />} />
                                </Route>

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