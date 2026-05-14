/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  SISTEM INFORMASI PESANTREN AL-HASANAH                                  ║
 * ║  App.tsx — Optimized Architecture v4.0                                  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import React, { useEffect, useMemo, memo } from "react";
import "@ant-design/v5-patch-for-react-19";
import "@refinedev/antd/dist/reset.css";
import "./styles/mobile-fix.css";

import { motion, AnimatePresence } from "framer-motion";
import { Authenticated, Refine, useGetIdentity, useLogin } from "@refinedev/core";
import { DevtoolsProvider } from "@refinedev/devtools";
import { ErrorComponent, ThemedLayoutV2, ThemedSiderV2, useNotificationProvider } from "@refinedev/antd";
import { ConfigProvider, App as AntdApp, Form, Input, Button } from "antd";
import idID from "antd/locale/id_ID";
import routerBindings, { CatchAllNavigate, DocumentTitleHandler, NavigateToResource, UnsavedChangesNotifier } from "@refinedev/react-router-v6";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";
import { dataProvider } from "@refinedev/supabase";
import { BrowserRouter, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { MailOutlined, LockOutlined } from "@ant-design/icons";

import { authProvider }          from "./authProvider";
import { accessControlProvider } from "./accessControlProvider";
import { Header }                from "./pages/components/header";
import { Title }                 from "./pages/components/title";
import { ColorModeContextProvider, useColorMode } from "./contexts/color-mode";
import { supabaseClient }        from "./utility/supabaseClient";
import { IUserIdentity }         from "./types";
import { resources }             from "./utility/resources";
import { buildPremiumTheme, buildSidebarCSS, GOLD, GOLD_BRIGHT, GOLD_LIGHT, GOLD_DEEP } from "./utility/themeConfig";

import { 
  DashboardPage, InstansiPage, SantriList, SantriCreate, SantriEdit, SantriShow, 
  PersebaranSantriPage, PelanggaranList, PelanggaranCreate, PelanggaranEdit, 
  PerizinanList, PerizinanCreate, PerizinanEdit, KesehatanList, KesehatanCreate, 
  KesehatanEdit, HafalanList, HafalanCreate, HafalanEdit, HafalanShow, 
  BeritaList, BeritaCreate, BeritaEdit, InventarisList, InventarisCreate, 
  InventarisShow, TagihanList, TagihanCreate, TagihanEdit, TransaksiList, 
  TransaksiCreate, MurojaahList, MurojaahCreate, MurojaahShow, HafalanKitabList, 
  HafalanKitabCreate, HafalanKitabShow, PengeluaranList, DiklatList, 
  MasterDataPage, AuditLogList, AkademikPage, ScanQR, CreateAdminPage, 
  AdminList, AlumniList, WeeklyTestList, WeeklyTestCreate, WeeklyTestArsip, 
  NotificationList, NotificationCreate, RagKnowledgePage, LoadingFallback 
} from "./lazyPages";

const isDev = import.meta.env.DEV;

const LazyAiFloatingButton = React.lazy(() =>
  import("./components/AiFloatingButton").then((m) => ({ default: m.AiFloatingButton }))
);
const LazyGeminiConsultant = React.lazy(() =>
  import("./components/GeminiConsultant").then((m) => ({ default: m.GeminiConsultant }))
);

const ISLAMIC_SVG = `url("data:image/svg+xml,%3Csvg width='120' height='120' viewBox='0 0 120 120' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='rgba(201%2C168%2C76%2C0.07)' stroke-width='0.8'%3E%3Cpolygon points='60%2C10 110%2C35 110%2C85 60%2C110 10%2C85 10%2C35'/%3E%3Cpolygon points='60%2C25 95%2C42.5 95%2C77.5 60%2C95 25%2C77.5 25%2C42.5'/%3E%3Cline x1='60' y1='10' x2='60' y2='25'/%3E%3Cline x1='110' y1='35' x2='95' y2='42.5'/%3E%3Cline x1='110' y1='85' x2='95' y2='77.5'/%3E%3Cline x1='60' y1='110' x2='60' y2='95'/%3E%3Cline x1='10' y1='85' x2='25' y2='77.5'/%3E%3Cline x1='10' y1='35' x2='25' y2='42.5'/%3E%3C/g%3E%3C/svg%3E")`;

// ── MEMOIZED COMPONENTS ──
const MemoizedHeader = memo(Header);
const MemoizedSider = memo(ThemedSiderV2);

const AIConsultantWrapper: React.FC = memo(() => {
  const { data: user } = useGetIdentity<IUserIdentity>();
  const allowed = ["super_admin", "dewan", "rois"];
  if (!user || !allowed.includes(user.role)) return null;
  return (
    <React.Suspense fallback={null}>
      <LazyAiFloatingButton />
      <LazyGeminiConsultant />
    </React.Suspense>
  );
});

const PageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        className="alh-page-enter"
        initial={{ opacity:0, y:12 }}
        animate={{ opacity:1, y:0  }}
        exit={{ opacity:0, y:-8    }}
        transition={{ duration:0.32, ease:[0.22,1,0.36,1] }}
        style={{ width:"100%", minHeight:"100%" }}
      >
        <React.Suspense fallback={<LoadingFallback />}>
          {children}
        </React.Suspense>
      </motion.div>
    </AnimatePresence>
  );
};

const PremiumLoginPage: React.FC = () => {
  const { mode }                     = useColorMode();
  const { mutate: login, isLoading } = useLogin();
  const [form]                       = Form.useForm();
  const isDark                       = mode === "dark";

  // Use variable values directly for consistency
  const bg      = isDark ? "#08070D" : "#F7F4EE";
  const cardBg  = isDark ? "rgba(15,15,26,0.97)" : "rgba(255,255,255,0.97)";
  const border  = isDark ? "rgba(201,168,76,0.16)" : "rgba(201,168,76,0.28)";
  const text    = isDark ? "#F0EDE5" : "#0A0805";
  const textSub = isDark ? "#9E9080" : "#6B5F50";
  const textMut = isDark ? "#5C5248" : "#9E9080";
  const divider = isDark ? "rgba(201,168,76,0.08)" : "rgba(201,168,76,0.12)";

  return (
    <div style={{
      minHeight: "100vh",
      background: bg,
      backgroundImage: `${ISLAMIC_SVG}, radial-gradient(ellipse 80% 55% at 50% -5%, ${GOLD}0E 0%, transparent 60%)`,
      backgroundSize: "120px 120px, cover",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px 16px", position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position:"absolute", top:"10%", left:"8%",
        width:500, height:400,
        background:`radial-gradient(circle, ${GOLD}0C 0%, transparent 70%)`,
        pointerEvents:"none",
      }} />

      <motion.div
        initial={{ opacity:0, y:30, scale:0.94 }}
        animate={{ opacity:1, y:0,  scale:1    }}
        transition={{ duration:0.55, ease:[0.22,1,0.36,1] }}
        style={{
          width:"100%", maxWidth:440, position:"relative", zIndex:10,
          background: cardBg, border:`1px solid ${border}`,
          borderRadius:24, backdropFilter:"blur(30px)", WebkitBackdropFilter:"blur(30px)",
          boxShadow: isDark
            ? `0 48px 96px rgba(0,0,0,0.80), 0 0 0 1px rgba(201,168,76,0.07)`
            : `0 28px 72px rgba(0,0,0,0.12), 0 0 0 1px rgba(201,168,76,0.14)`,
          overflow:"hidden",
        }}
      >
        {/* Top gold accent */}
        <div style={{
          height:3,
          background:`linear-gradient(90deg, transparent, ${GOLD} 30%, ${GOLD_BRIGHT} 50%, ${GOLD} 70%, transparent)`,
        }} />

        {/* Brand section */}
        <div style={{
          padding:"36px 44px 28px", textAlign:"center",
          background: isDark
            ? "linear-gradient(180deg, rgba(201,168,76,0.05) 0%, transparent 100%)"
            : "linear-gradient(180deg, rgba(201,168,76,0.04) 0%, transparent 100%)",
        }}>
          <motion.div
            initial={{ scale:0.8, opacity:0 }}
            animate={{ scale:1, opacity:1 }}
            transition={{ delay:0.15, duration:0.4, ease:[0.22,1,0.36,1] }}
            style={{ display:"inline-block", marginBottom:22, position:"relative" }}
          >
            <div style={{
              width:76, height:76,
              background:`linear-gradient(135deg, ${GOLD}25, ${GOLD_BRIGHT}15)`,
              border:`1.5px solid ${GOLD}45`, borderRadius:22,
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow: isDark ? `0 0 32px ${GOLD}25, 0 8px 24px rgba(0,0,0,0.30)` : `0 8px 24px ${GOLD}20`,
              position:"relative", overflow:"hidden",
            }}>
              {/* Pesantren Logo from public/logo.ico */}
              <img 
                src="/logo.ico" 
                alt="Al-Hasanah Logo" 
                style={{ 
                  width: "50px", 
                  height: "50px", 
                  objectFit: "contain",
                  filter: isDark ? "drop-shadow(0 0 8px rgba(201, 168, 76, 0.4))" : "none"
                }} 
              />
            </div>
            <div style={{
              position:"absolute", bottom:-6, right:-6,
              width:24, height:24,
              background:`linear-gradient(135deg, ${GOLD}, ${GOLD_BRIGHT})`,
              borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow:`0 4px 10px ${GOLD}60`, border:`2px solid ${cardBg}`,
            }}>
              <span style={{ fontSize:11, color:"#000", fontWeight:900, lineHeight:1 }}>✦</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity:0, y:8 }}
            animate={{ opacity:1, y:0 }}
            transition={{ delay:0.22, duration:0.4 }}
          >
            <h1 style={{
              margin:0, fontFamily:"'Cormorant Garamond', 'Syne', serif",
              fontSize:30, fontWeight:700,
              background:`linear-gradient(135deg, ${GOLD} 0%, ${GOLD_BRIGHT} 55%, ${GOLD_LIGHT} 100%)`,
              WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
              backgroundClip:"text", letterSpacing:"-0.01em", lineHeight:1.15,
            }}>
              Al-Hasanah
            </h1>
            <div style={{
              fontSize:10, fontWeight:700, letterSpacing:"3.5px",
              textTransform:"uppercase", color:textMut, marginTop:8,
            }}>
              Sistem Informasi Pesantren
            </div>
          </motion.div>
        </div>

        <div style={{ height:1, background:divider, margin:"0 36px" }} />

        {/* Form */}
        <motion.div
          initial={{ opacity:0, y:10 }}
          animate={{ opacity:1, y:0 }}
          transition={{ delay:0.30, duration:0.4 }}
          style={{ padding:"28px 44px 36px" }}
        >
          <div style={{ marginBottom:22 }}>
            <div style={{ fontSize:16, fontWeight:800, color:text, marginBottom:5 }}>
              Selamat Datang Kembali
            </div>
            <div style={{ fontSize:12, color:textSub, lineHeight:1.5 }}>
              Masukkan kredensial Anda untuk mengakses dashboard
            </div>
          </div>

          <Form
            form={form} layout="vertical"
            onFinish={(v) => login(v)}
          >
            <Form.Item
              name="email"
              label={<span style={{fontSize:11,fontWeight:700,letterSpacing:"0.7px",textTransform:"uppercase",color:textMut}}>Email Akun</span>}
              rules={[{required:true,message:"Email wajib diisi"},{type:"email",message:"Format tidak valid"}]}
              style={{ marginBottom:14 }}
            >
              <Input size="large"
                prefix={<MailOutlined style={{color: isDark ? GOLD_BRIGHT : GOLD_DEEP, fontSize:15}} />}
                placeholder="admin@alhasanah.com"
                style={{ borderRadius:12, height:50 }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={<span style={{fontSize:11,fontWeight:700,letterSpacing:"0.7px",textTransform:"uppercase",color:textMut}}>Kata Sandi</span>}
              rules={[{required:true,message:"Password wajib diisi"}]}
              style={{ marginBottom:24 }}
            >
              <Input.Password size="large"
                prefix={<LockOutlined style={{color: isDark ? GOLD_BRIGHT : GOLD_DEEP, fontSize:15}} />}
                placeholder="••••••••••"
                style={{ borderRadius:12, height:50 }}
              />
            </Form.Item>

            <Button type="primary" htmlType="submit" size="large" loading={isLoading} block
              style={{
                height:52, borderRadius:12,
                background:`linear-gradient(135deg, ${GOLD} 0%, ${GOLD_BRIGHT} 100%)`,
                border:"none", color:"#000", fontWeight:800, fontSize:15,
                boxShadow:`0 8px 24px ${GOLD}45`,
              }}
            >
              {isLoading ? "Memverifikasi…" : "Masuk ke Dashboard"}
            </Button>
          </Form>

          <div style={{
            marginTop:26, paddingTop:20, borderTop:`1px solid ${divider}`,
            textAlign:"center", fontSize:10, color:textMut, letterSpacing:"0.3px", lineHeight:2,
          }}>
            <span style={{color: isDark ? GOLD_BRIGHT : GOLD_DEEP}}>◆</span>
            {"  "}PONDOK PESANTREN AL-HASANAH{"  "}
            <span style={{color: isDark ? GOLD_BRIGHT : GOLD_DEEP}}>◆</span>
            <br />
            <span style={{fontSize:9}}>Jl. Raya Cibeuti No.13 · Kawalu · Tasikmalaya, Jawa Barat 46182</span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

const GlobalSplashLoader: React.FC = () => {
  const { mode } = useColorMode();
  const isDark = mode === "dark";
  const bg = isDark ? "#08070D" : "#F7F4EE";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: bg,
      backgroundImage: `${ISLAMIC_SVG}`,
      backgroundSize: "120px 120px",
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ 
          opacity: [0.4, 1, 0.4], 
          scale: [0.95, 1, 0.95],
        }}
        transition={{ 
          duration: 2, 
          repeat: Infinity, 
          ease: "easeInOut" 
        }}
        style={{
          width: 100, height: 100,
          background: `linear-gradient(135deg, ${GOLD}25, ${GOLD_BRIGHT}15)`,
          border: `1.5px solid ${GOLD}45`, borderRadius: 28,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: isDark ? `0 0 40px ${GOLD}30` : `0 10px 30px ${GOLD}20`,
          marginBottom: 24, position: "relative"
        }}
      >
        <img src="/logo.ico" alt="Loading..." style={{ width: 60, height: 60, objectFit: "contain" }} />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        style={{ textAlign: "center" }}
      >
        <div style={{ 
          fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 14, 
          letterSpacing: "4px", color: isDark ? GOLD_BRIGHT : GOLD_DEEP,
          textTransform: "uppercase"
        }}>
          Al-Hasanah
        </div>
        <div style={{ 
          fontSize: 9, fontWeight: 600, marginTop: 8, 
          color: isDark ? "rgba(255,183,0,0.4)" : "rgba(139,105,20,0.5)",
          letterSpacing: "1px"
        }}>
          MENYIAPKAN DASHBOARD ANDA
        </div>
      </motion.div>
    </div>
  );
};

const InnerApp: React.FC = () => {
  const { mode } = useColorMode();
  const antThemeConfig = useMemo(() => buildPremiumTheme(mode), [mode]);

  useEffect(() => {
    let el = document.getElementById("alh-sidebar-css") as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = "alh-sidebar-css";
      document.head.appendChild(el);
    }
    el.textContent = buildSidebarCSS(mode, ISLAMIC_SVG);
  }, [mode]);

  const refineApp = (
    <RefineKbarProvider>
      <Refine
        dataProvider={dataProvider(supabaseClient)}
        authProvider={authProvider}
        accessControlProvider={accessControlProvider}
        routerProvider={routerBindings}
        notificationProvider={useNotificationProvider}
        options={{ syncWithLocation:true, warnWhenUnsavedChanges:true, useNewQueryKeys:true, projectId:"alhasanah-admin-panel" }}
        resources={resources}
      >
        <Routes>
          <Route element={<Authenticated key="auth" fallback={<Outlet />}><NavigateToResource /></Authenticated>}><Route path="/login" element={<PremiumLoginPage />} /></Route>
          <Route element={
            <Authenticated key="authenticated" fallback={<CatchAllNavigate to="/login" />}>
              <ThemedLayoutV2 Header={() => <MemoizedHeader sticky />} Sider={(props) => <MemoizedSider {...props} fixed Title={Title} />}>
                <PageWrapper><Outlet /></PageWrapper>
                <AIConsultantWrapper />
              </ThemedLayoutV2>
            </Authenticated>
          }>
            <Route index element={<DashboardPage />} />
            <Route path="/instansi" element={<InstansiPage />} />
            <Route path="/santri">
              <Route index element={<SantriList />} />
              <Route path="create" element={<SantriCreate />} />
              <Route path="edit/:id" element={<SantriEdit />} />
              <Route path="show/:id" element={<SantriShow />} />
            </Route>
            <Route path="/persebaran-santri" element={<PersebaranSantriPage />} />
            <Route path="/berita"><Route index element={<BeritaList />} /><Route path="create" element={<BeritaCreate />} /><Route path="edit/:id" element={<BeritaEdit />} /></Route>
            <Route path="/pelanggaran"><Route index element={<PelanggaranList />} /><Route path="create" element={<PelanggaranCreate />} /><Route path="edit/:id" element={<PelanggaranEdit />} /></Route>
            <Route path="/perizinan"><Route index element={<PerizinanList />} /><Route path="create" element={<PerizinanCreate />} /><Route path="edit/:id" element={<PerizinanEdit />} /></Route>
            <Route path="/kesehatan"><Route index element={<KesehatanList />} /><Route path="create" element={<KesehatanCreate />} /><Route path="edit/:id" element={<KesehatanEdit />} /></Route>
            <Route path="/hafalan"><Route index element={<HafalanList />} /><Route path="create" element={<HafalanCreate />} /><Route path="edit/:id" element={<HafalanEdit />} /><Route path="show/:id" element={<HafalanShow />} /></Route>
            <Route path="/murojaah"><Route index element={<MurojaahList />} /><Route path="create" element={<MurojaahCreate />} /><Route path="show/:id" element={<MurojaahShow />} /></Route>
            <Route path="/hafalan-kitab"><Route index element={<HafalanKitabList />} /><Route path="create" element={<HafalanKitabCreate />} /><Route path="show/:id" element={<HafalanKitabShow />} /></Route>
            <Route path="/alumni"><Route index element={<AlumniList />} /></Route>
            <Route path="/audit-logs"><Route index element={<AuditLogList />} /></Route>
            <Route path="/rag" element={<RagKnowledgePage />} />
            <Route path="/akademik"><Route index element={<AkademikPage />} /></Route>
            <Route path="/tagihan"><Route index element={<TagihanList />} /><Route path="create" element={<TagihanCreate />} /><Route path="edit/:id" element={<TagihanEdit />} /></Route>
            <Route path="/transaksi"><Route index element={<TransaksiList />} /><Route path="create" element={<TransaksiCreate />} /></Route>
            <Route path="/pengeluaran" element={<PengeluaranList />} />
            <Route path="/diklat"><Route index element={<DiklatList />} /><Route path="master" element={<MasterDataPage />} /></Route>
            <Route path="/scanQr" element={<ScanQR />} />
            <Route path="/admin-management/create" element={<CreateAdminPage />} /><Route path="/admin-management/list" element={<AdminList />} />
            <Route path="/inventaris"><Route index element={<InventarisList />} /><Route path="create" element={<InventarisCreate />} /><Route path="show/:id" element={<InventarisShow />} /></Route>
            <Route path="/ulangan"><Route index element={<WeeklyTestList />} /><Route path="create" element={<WeeklyTestCreate />} /></Route>
            <Route path="/ulangan/arsip"><Route index element={<WeeklyTestArsip />} /></Route>
            <Route path="/notifications"><Route index element={<NotificationList />} /><Route path="create" element={<NotificationCreate />} /></Route>
            <Route path="*" element={<ErrorComponent />} />
          </Route>
        </Routes>
        <UnsavedChangesNotifier />
        <DocumentTitleHandler handler={({ resource, action }) => {
          const label = resource?.meta?.label ?? resource?.name ?? "";
          const actionMap: Record<string, string> = { list:label, create:`Tambah ${label}`, edit:`Edit ${label}`, show:`Detail ${label}` };
          return `${actionMap[action ?? "list"] ?? label} · Al-Hasanah`;
        }} />
        <RefineKbar />
      </Refine>
    </RefineKbarProvider>
  );

  return (
    <ConfigProvider theme={antThemeConfig} locale={idID}>
      <AntdApp>
        {isDev ? <DevtoolsProvider>{refineApp}</DevtoolsProvider> : refineApp}
      </AntdApp>
    </ConfigProvider>
  );
};
const App: React.FC = () => (
  <BrowserRouter>
    <ColorModeContextProvider>
      <InnerApp />
    </ColorModeContextProvider>
  </BrowserRouter>
);

export default App;
