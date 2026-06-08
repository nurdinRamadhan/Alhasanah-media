/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  SISTEM INFORMASI PESANTREN AL-HASANAH                                  ║
 * ║  App.tsx — Global Design System Foundation v3.0                         ║
 * ║                                                                         ║
 * ║  Fix v3:                                                                ║
 * ║  - useEffect DOM injection (fixes React 19 style hoisting bug)          ║
 * ║  - buildSidebarCSS = only what index.css doesn't have (no conflicts)    ║
 * ║  - index.css handles layout/header/font — App.tsx handles sidebar only  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import React, { useEffect, useMemo } from "react";
import "@ant-design/v5-patch-for-react-19";
import "@refinedev/antd/dist/reset.css";
import "./styles/mobile-fix.css";

import { motion, AnimatePresence } from "framer-motion";

import {
  Authenticated,
  Refine,
  useGetIdentity,
  useLogin,
} from "@refinedev/core";
import { DevtoolsProvider } from "@refinedev/devtools";
import {
  ErrorComponent,
  ThemedLayoutV2,
  ThemedSiderV2,
  useThemedLayoutContext,
  useNotificationProvider,
} from "@refinedev/antd";

import {
  ConfigProvider,
  App as AntdApp,
  theme as antTheme,
  Form,
  Input,
  Button,
  type ThemeConfig,
} from "antd";
import idID from "antd/locale/id_ID";

import routerBindings, {
  CatchAllNavigate,
  DocumentTitleHandler,
  NavigateToResource,
  UnsavedChangesNotifier,
} from "@refinedev/react-router-v6";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";
import { dataProvider } from "@refinedev/supabase";
import { BrowserRouter, Outlet, Route, Routes, useLocation } from "react-router-dom";

import { authProvider }          from "./authProvider";
import { accessControlProvider } from "./accessControlProvider";
import { Header }                from "./pages/components/header";
import { Title }                 from "./pages/components/title";
import { ColorModeContextProvider, useColorMode } from "./contexts/color-mode";
import { supabaseClient }        from "./utility/supabaseClient";
import { resources }             from "./utility/resources";
import { IUserIdentity }         from "./types";

import {
  BellOutlined, WarningOutlined, FileProtectOutlined,
  MedicineBoxOutlined, ReadOutlined, GlobalOutlined,
  BarcodeOutlined, WalletOutlined, UserOutlined,
  TeamOutlined, BookOutlined, SyncOutlined, RocketOutlined,
  SettingOutlined, FormOutlined, ProjectOutlined,
  DashboardOutlined, BankOutlined, ShoppingCartOutlined, ShopOutlined,
  SafetyCertificateOutlined, MailOutlined, LockOutlined,
  HistoryOutlined, DatabaseOutlined, TrophyOutlined,
} from "@ant-design/icons";

// ── Lazy Loading Pages ──
import { 
  DashboardPage, InstansiPage, SantriList, SantriCreate, SantriEdit, SantriShow, 
  PersebaranSantriPage, PelanggaranList, PelanggaranCreate, PelanggaranEdit, 
  PerizinanList, PerizinanCreate, PerizinanEdit, KesehatanList, KesehatanCreate, 
  KesehatanEdit, PrestasiList, HafalanList, HafalanCreate, HafalanEdit, HafalanShow,
  BeritaList, BeritaCreate, BeritaEdit, InventarisList, InventarisCreate, 
  InventarisShow, TagihanList, TagihanCreate, TagihanEdit, TransaksiList, 
  JenisPembayaranList, TransaksiCreate, DompetSantriList, DompetOperasionalList, DompetSecurityAuditList, KantinManagementList,
  MurojaahList, MurojaahCreate, MurojaahShow, HafalanKitabList, 
  HafalanKitabCreate, HafalanKitabShow, PengeluaranList, DiklatList, 
  MasterDataPage, AuditLogList, AkademikPage, ScanQR, CreateAdminPage, 
  AdminList, AlumniList, ForumModerationList, ForumReportsList, AlumniChatMonitoringList,
  WeeklyTestList, WeeklyTestCreate, WeeklyTestArsip,
  NotificationList, NotificationCreate, SelfHealingCenterPage, BackendDiagnosticsPage,
  PrivateAuditLogPage, RagKnowledgePage, LoadingFallback
} from "./lazyPages";

import { AiFloatingButton }   from "./components/AiFloatingButton";
import { GeminiConsultant }   from "./components/GeminiConsultant";


// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  § 1  DESIGN TOKENS — synced with index.css CSS variables               ║
// ╚══════════════════════════════════════════════════════════════════════════╝

const GOLD        = "#C9A84C";
const GOLD_LIGHT  = "#FDE68A";  // synced: index.css --gold-light
const GOLD_BRIGHT = "#FFB700";  // synced: index.css --gold-bright (was #FFD166 — FIXED)
const GOLD_DEEP   = "#8B6914";  // synced: index.css --gold-dark (was #A07830 — FIXED)

// Dark — matches index.css .dark values exactly
const D_BG      = "#08070D";   // --surface-base dark
const D_SURFACE = "#0F0F1A";   // --surface-card dark
const D_CARD    = "#141424";   // --surface-elevated dark
const D_SIDER   = "#09090F";   // slightly deeper for sidebar

// Light — matches index.css :root values exactly
const L_BG      = "#F7F4EE";   // --surface-base light
const L_CARD    = "#FFFFFF";   // --surface-card light
const L_HOVER   = "#FFFDF5";

const C_SUCCESS = "#059669";   // --success
const C_ERROR   = "#DC2626";   // --danger
const C_INFO    = "#2563EB";   // --info


// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  § 2  SIDEBAR + UTILITY CSS                                             ║
// ║                                                                         ║
// ║  SCOPE: Only styles that index.css cannot express:                      ║
// ║    • Pseudo-elements (::before / ::after)                               ║
// ║    • Sidebar always-dark treatment (both light & dark mode)             ║
// ║    • Submenu popup overlay                                              ║
// ║    • Page transition keyframe                                           ║
// ║    • A few Ant Design internals index.css doesn't touch                 ║
// ║                                                                         ║
// ║  NOT HERE: layout, body, header, fonts, buttons, inputs, tables        ║
// ║  — those live in index.css (CSS variables) and ConfigProvider tokens   ║
// ╚══════════════════════════════════════════════════════════════════════════╝

const ISLAMIC_SVG = `url("data:image/svg+xml,%3Csvg width='120' height='120' viewBox='0 0 120 120' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='rgba(201%2C168%2C76%2C0.07)' stroke-width='0.8'%3E%3Cpolygon points='60%2C10 110%2C35 110%2C85 60%2C110 10%2C85 10%2C35'/%3E%3Cpolygon points='60%2C25 95%2C42.5 95%2C77.5 60%2C95 25%2C77.5 25%2C42.5'/%3E%3Cline x1='60' y1='10' x2='60' y2='25'/%3E%3Cline x1='110' y1='35' x2='95' y2='42.5'/%3E%3Cline x1='110' y1='85' x2='95' y2='77.5'/%3E%3Cline x1='60' y1='110' x2='60' y2='95'/%3E%3Cline x1='10' y1='85' x2='25' y2='77.5'/%3E%3Cline x1='10' y1='35' x2='25' y2='42.5'/%3E%3C/g%3E%3C/svg%3E")`;

const buildSidebarCSS = (mode: "light" | "dark"): string => {
  const isDark    = mode === "dark";
  const accent    = isDark ? GOLD_BRIGHT : GOLD_BRIGHT; // always bright on dark sider
  const popupBg   = isDark ? "#141424"   : "#231B10";

  return `
/* ── Cormorant for login serif headings only ── */
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&display=swap');

/* ── PAGE TRANSITION ── */
@keyframes alhPageIn {
  from { opacity:0; transform:translateY(12px); }
  to   { opacity:1; transform:translateY(0); }
}
.alh-page-enter { animation: alhPageIn 0.35s cubic-bezier(0.22,1,0.36,1) both; }

/* ──────────────────────────────────────────────────
   SIDEBAR — Dark walnut in BOTH light and dark mode
   This is the premium design choice: sidebar is
   always deep dark for maximum contrast & luxury feel.
   index.css handles .dark .ant-layout-sider for dark,
   we add the light-mode treatment here.
────────────────────────────────────────────────── */
.ant-layout-sider {
  background: ${D_SIDER} !important;
  border-right: 1px solid rgba(201,168,76,0.09) !important;
  box-shadow: 4px 0 48px rgba(0,0,0,0.45) !important;
  overflow: visible !important;
}
/* Islamic geometric mosaic — pseudo-element only possible here */
.ant-layout-sider::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: ${ISLAMIC_SVG};
  background-size: 90px 90px;
  opacity: 0.65;
  pointer-events: none;
  z-index: 0;
}
.ant-layout-sider > * { position: relative; z-index: 1; }

/* Collapse/expand trigger */
.ant-layout-sider-trigger {
  background: rgba(201,168,76,0.07) !important;
  border-top: 1px solid rgba(201,168,76,0.09) !important;
  color: ${accent} !important;
  transition: background 0.2s, color 0.2s !important;
}
.ant-layout-sider-trigger:hover {
  background: rgba(201,168,76,0.14) !important;
  color: ${GOLD_BRIGHT} !important;
}

/* ── Menu items inside sider — always light text on dark bg ── */
.ant-layout-sider .ant-menu {
  background: transparent !important;
  border-inline-end: none !important;
  padding: 6px 8px !important;
}
.ant-layout-sider .ant-menu-item,
.ant-layout-sider .ant-menu-submenu-title {
  border-radius: 10px !important;
  margin: 2px 0 !important;
  height: 42px !important;
  line-height: 42px !important;
  font-size: 13px !important;
  font-weight: 500 !important;
  color: rgba(255,255,255,0.46) !important;
  transition: background 0.15s, color 0.15s !important;
}
.ant-layout-sider .ant-menu-title-content {
  min-width: 0 !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}
.ant-layout-sider:not(.ant-layout-sider-collapsed) .ant-menu-title-content {
  white-space: nowrap !important;
}
.ant-layout-sider:not(.ant-layout-sider-collapsed) .ant-menu-submenu-title {
  padding-right: 32px !important;
}
.ant-layout-sider .ant-menu-item:hover,
.ant-layout-sider .ant-menu-submenu-title:hover {
  background: rgba(201,168,76,0.08) !important;
  color: ${GOLD_LIGHT} !important;
}
.ant-layout-sider .ant-menu-item-selected {
  background: rgba(201,168,76,0.13) !important;
  color: ${GOLD_BRIGHT} !important;
  font-weight: 600 !important;
}
.ant-layout-sider .ant-menu-item-selected .anticon { color: ${GOLD_BRIGHT} !important; }
.ant-layout-sider .ant-menu-item .anticon,
.ant-layout-sider .ant-menu-submenu-title .anticon { font-size: 15px !important; }

/* Gold left-accent bar on selected — pseudo-element, only here */
.ant-layout-sider .ant-menu-item-selected::before {
  content: '';
  position: absolute;
  left: -8px; top: 10px; bottom: 10px;
  width: 3px;
  background: linear-gradient(180deg, ${GOLD} 0%, ${GOLD_BRIGHT} 100%);
  border-radius: 0 3px 3px 0;
  box-shadow: 0 0 10px ${GOLD}70;
  pointer-events: none;
}
/* Hide default Ant active bar */
.ant-layout-sider .ant-menu-item::after { display: none !important; }

/* Submenu expand arrow */
.ant-layout-sider .ant-menu-submenu-arrow { color: rgba(255,255,255,0.28) !important; }
.ant-layout-sider .ant-menu-submenu-open > .ant-menu-submenu-title .ant-menu-submenu-arrow {
  color: ${accent} !important;
}
/* Group title */
.ant-layout-sider .ant-menu-item-group-title {
  font-size: 9px !important; font-weight: 800 !important;
  letter-spacing: 1.8px !important; text-transform: uppercase !important;
  color: rgba(201,168,76,0.36) !important;
  padding: 18px 14px 5px !important;
}

/* ── Submenu popup (sider collapsed) ── */
.ant-menu-submenu-popup .ant-menu {
  background: ${popupBg} !important;
  border: 1px solid rgba(201,168,76,0.15) !important;
  border-radius: 12px !important;
  box-shadow: 0 20px 50px rgba(0,0,0,0.55) !important;
  padding: 6px !important;
}
.ant-menu-submenu-popup .ant-menu-item {
  border-radius: 8px !important; color: rgba(255,255,255,0.50) !important;
  font-size: 13px !important; font-weight: 500 !important; margin: 2px 0 !important;
}
.ant-menu-submenu-popup .ant-menu-item:hover {
  background: rgba(201,168,76,0.09) !important; color: ${GOLD_BRIGHT} !important;
}
.ant-menu-submenu-popup .ant-menu-item-selected {
  background: rgba(201,168,76,0.14) !important; color: ${GOLD_BRIGHT} !important;
}

/* ── Modal mask blur ── */
.ant-modal-mask {
  backdrop-filter: blur(5px) !important;
  -webkit-backdrop-filter: blur(5px) !important;
  background: rgba(0,0,0,0.58) !important;
}

/* ── Tabs ink bar ── */
.ant-tabs-ink-bar {
  background: ${isDark ? GOLD_BRIGHT : GOLD_DEEP} !important;
  border-radius: 2px !important;
}
.ant-tabs-tab.ant-tabs-tab-active .ant-tabs-tab-btn {
  color: ${isDark ? GOLD_BRIGHT : GOLD_DEEP} !important;
  font-weight: 700 !important;
}
.ant-tabs-tab:hover .ant-tabs-tab-btn {
  color: ${isDark ? GOLD_LIGHT : GOLD} !important;
}

/* ── Pagination active ── */
.ant-pagination-item-active {
  border-color: ${isDark ? GOLD_BRIGHT : GOLD_DEEP} !important;
  background: rgba(201,168,76,0.10) !important;
}
.ant-pagination-item-active a { color: ${isDark ? GOLD_BRIGHT : GOLD_DEEP} !important; }

/* ── Table sort arrows ── */
.ant-table-column-sorter-up.active,
.ant-table-column-sorter-down.active { color: ${isDark ? GOLD_BRIGHT : GOLD_DEEP} !important; }

/* ── Spin color ── */
.ant-spin-dot-item { background: ${isDark ? GOLD_BRIGHT : GOLD_DEEP} !important; }
.ant-spin-text     { color: ${isDark ? GOLD_BRIGHT : GOLD_DEEP} !important; }

/* ── Progress bar ── */
.ant-progress-bg {
  background: linear-gradient(90deg, ${GOLD} 0%, ${GOLD_BRIGHT} 100%) !important;
}

/* ── ProTable toolbar wrap ── */
.ant-pro-table-list-toolbar { flex-wrap: wrap !important; gap: 8px !important; }
.ant-pro-table-list-toolbar-right { flex-wrap: wrap !important; }

/* ── Text selection ── */
::selection { background: rgba(201,168,76,0.20); color: inherit; }
`;
};


// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  § 3  ANT DESIGN CONFIG PROVIDER THEME                                  ║
// ║  Tokens synced to index.css CSS variable values for consistency          ║
// ╚══════════════════════════════════════════════════════════════════════════╝

const buildPremiumTheme = (mode: "light" | "dark"): ThemeConfig => {
  const isDark = mode === "dark";

  return {
    algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,

    token: {
      // Brand
      colorPrimary:             isDark ? GOLD_BRIGHT : GOLD_DEEP,
      colorPrimaryHover:        isDark ? GOLD_LIGHT  : GOLD,
      colorPrimaryActive:       isDark ? GOLD        : GOLD_DEEP,
      colorLink:                isDark ? GOLD_BRIGHT : GOLD_DEEP,
      colorLinkHover:           isDark ? GOLD_LIGHT  : GOLD,

      // Canvas — matches index.css CSS variable values exactly
      colorBgBase:              isDark ? D_BG      : L_BG,
      colorBgContainer:         isDark ? D_SURFACE : L_CARD,
      colorBgElevated:          isDark ? D_CARD    : "#FFFFFF",
      colorBgLayout:            isDark ? D_BG      : L_BG,
      colorBgSpotlight:         isDark ? "#1A1A2E" : "#F7F4EE",
      colorBgMask:              "rgba(0,0,0,0.56)",
      colorFillAlter:           isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
      colorFill:                isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
      colorFillSecondary:       isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",

      // Text — matches index.css --text-* variables
      colorText:                isDark ? "#F0EDE5" : "#0A0805",
      colorTextSecondary:       isDark ? "#9E9080" : "#6B5F50",
      colorTextTertiary:        isDark ? "#5C5248" : "#9E9080",
      colorTextQuaternary:      isDark ? "#3A342E" : "#C4B89E",
      colorTextLightSolid:      "#FFFFFF",

      // Semantic — matches index.css --success, --danger, --info
      colorSuccess:             C_SUCCESS,
      colorSuccessBg:           isDark ? "rgba(5,150,105,0.10)"   : "rgba(5,150,105,0.08)",
      colorSuccessBorder:       isDark ? "rgba(5,150,105,0.30)"   : "rgba(5,150,105,0.26)",
      colorWarning:             GOLD_BRIGHT,
      colorWarningBg:           isDark ? "rgba(255,183,0,0.10)"   : "rgba(255,183,0,0.08)",
      colorWarningBorder:       isDark ? "rgba(255,183,0,0.28)"   : "rgba(255,183,0,0.24)",
      colorError:               C_ERROR,
      colorErrorBg:             isDark ? "rgba(220,38,38,0.10)"   : "rgba(220,38,38,0.08)",
      colorErrorBorder:         isDark ? "rgba(220,38,38,0.28)"   : "rgba(220,38,38,0.24)",
      colorInfo:                C_INFO,
      colorInfoBg:              isDark ? "rgba(37,99,235,0.10)"   : "rgba(37,99,235,0.08)",
      colorInfoBorder:          isDark ? "rgba(37,99,235,0.28)"   : "rgba(37,99,235,0.24)",

      // Borders — matches index.css --border-* variables
      colorBorder:              isDark ? "rgba(201,168,76,0.14)"  : "rgba(201,168,76,0.20)",
      colorBorderSecondary:     isDark ? "rgba(201,168,76,0.07)"  : "rgba(201,168,76,0.10)",
      colorSplit:               isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",

      // Interaction
      controlOutlineWidth:      3,
      controlOutline:           "rgba(201,168,76,0.16)",
      controlItemBgHover:       isDark ? "rgba(201,168,76,0.08)" : "rgba(201,168,76,0.07)",
      controlItemBgActive:      isDark ? "rgba(201,168,76,0.14)" : "rgba(201,168,76,0.10)",
      controlItemBgActiveHover: isDark ? "rgba(201,168,76,0.18)" : "rgba(201,168,76,0.14)",

      // Shape
      borderRadius:             10,
      borderRadiusLG:           14,
      borderRadiusSM:           8,
      borderRadiusXS:           6,
      borderRadiusOuter:        12,

      // Shadow — matches index.css --shadow-* variables
      boxShadow:                isDark
        ? "0 4px 16px rgba(0,0,0,0.50), 0 1px 4px rgba(0,0,0,0.30)"
        : "0 2px 8px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.04)",
      boxShadowSecondary:       isDark
        ? "0 8px 32px rgba(0,0,0,0.60)"
        : "0 4px 16px rgba(0,0,0,0.06)",

      // Typography — matches index.css --font-body (DM Sans)
      fontFamily:               "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      fontFamilyCode:           "'DM Mono', 'Fira Code', Consolas, monospace",
      fontSize:                 14,
      fontSizeLG:               16,
      fontSizeSM:               12,
      fontSizeXL:               20,
      fontSizeHeading1:         32,
      fontSizeHeading2:         24,
      fontSizeHeading3:         18,
      fontSizeHeading4:         16,
      fontSizeHeading5:         14,
      fontWeightStrong:         700,
      lineHeight:               1.6,

      // Controls
      controlHeight:            40,
      controlHeightLG:          48,
      controlHeightSM:          32,

      // Motion — matches index.css --ease-* variables
      motionDurationMid:        "0.25s",
      motionDurationSlow:       "0.40s",
      motionDurationFast:       "0.15s",
      motionEaseInOut:          "cubic-bezier(0.4, 0, 0.2, 1)",
      motionEaseOut:            "cubic-bezier(0.22, 1, 0.36, 1)",
    },

    components: {

      // Menu
      Menu: {
        itemBg:                 "transparent",
        subMenuItemBg:          "transparent",
        itemHeight:             42,
        itemBorderRadius:       10,
        itemPaddingInline:      14,
        iconSize:               15,
        iconMarginInlineEnd:    10,
        groupTitleFontSize:     9,
        groupTitleColor:        "rgba(201,168,76,0.36)",
        itemColor:              "rgba(255,255,255,0.46)",
        itemHoverColor:         GOLD_LIGHT,
        itemHoverBg:            "rgba(201,168,76,0.08)",
        itemSelectedColor:      GOLD_BRIGHT,
        itemSelectedBg:         "rgba(201,168,76,0.13)",
        itemActiveBg:           "rgba(201,168,76,0.18)",
        popupBg:                isDark ? "#141424" : "#231B10",
        darkItemBg:             "transparent",
        darkSubMenuItemBg:      "transparent",
        darkItemColor:          "rgba(255,255,255,0.46)",
        darkItemHoverColor:     GOLD_LIGHT,
        darkItemHoverBg:        "rgba(201,168,76,0.08)",
        darkItemSelectedColor:  GOLD_BRIGHT,
        darkItemSelectedBg:     "rgba(201,168,76,0.13)",
        darkPopupBg:            "#141424",
        activeBarWidth:         0,
        activeBarBorderWidth:   0,
        activeBarHeight:        0,
      },

      // Button
      Button: {
        borderRadius:             10,
        borderRadiusLG:           12,
        borderRadiusSM:           8,
        fontWeight:               600,
        defaultBg:                isDark ? D_SURFACE : "#FFFFFF",
        defaultBorderColor:       isDark ? "rgba(201,168,76,0.18)" : "rgba(201,168,76,0.22)",
        defaultColor:             isDark ? "#F0EDE5" : "#0A0805",
        defaultHoverBg:           isDark ? D_CARD  : L_HOVER,
        defaultHoverBorderColor:  isDark ? "rgba(201,168,76,0.40)" : GOLD,
        defaultHoverColor:        isDark ? GOLD_BRIGHT : GOLD_DEEP,
        contentFontSize:          14,
        contentFontSizeLG:        15,
        contentFontSizeSM:        12,
        paddingInline:            18,
        paddingInlineLG:          22,
        paddingInlineSM:          14,
      },

      // Input
      Input: {
        colorBgContainer:       isDark ? D_SURFACE : "#FFFFFF",
        activeBorderColor:      isDark ? GOLD_BRIGHT : GOLD_DEEP,
        hoverBorderColor:       isDark ? "rgba(201,168,76,0.50)" : GOLD,
        borderRadius:           10,
        borderRadiusLG:         12,
        borderRadiusSM:         8,
        paddingBlock:           9,
        paddingBlockLG:         11,
        paddingInline:          14,
        activeShadow:           "0 0 0 3px rgba(201,168,76,0.16)",
        errorActiveShadow:      "0 0 0 3px rgba(220,38,38,0.14)",
        addonBg:                isDark ? D_CARD : "#F7F4EE",
        colorTextPlaceholder:   isDark ? "rgba(240,237,229,0.28)" : "rgba(10,8,5,0.28)",
      },

      // InputNumber
      InputNumber: {
        colorBgContainer:       isDark ? D_SURFACE : "#FFFFFF",
        activeBorderColor:      isDark ? GOLD_BRIGHT : GOLD_DEEP,
        hoverBorderColor:       isDark ? "rgba(201,168,76,0.50)" : GOLD,
        borderRadius:           10,
        paddingBlock:           9,
        paddingInline:          14,
        activeShadow:           "0 0 0 3px rgba(201,168,76,0.16)",
        handleBg:               isDark ? D_CARD : "#F7F4EE",
        handleHoverColor:       isDark ? GOLD_BRIGHT : GOLD_DEEP,
        handleBorderColor:      isDark ? "rgba(201,168,76,0.14)" : "rgba(201,168,76,0.18)",
        colorTextPlaceholder:   isDark ? "rgba(240,237,229,0.28)" : "rgba(10,8,5,0.28)",
      },

      // Select
      Select: {
        colorBgContainer:         isDark ? D_SURFACE : "#FFFFFF",
        colorBgElevated:          isDark ? D_CARD    : "#FFFFFF",
        selectorBg:               isDark ? D_SURFACE : "#FFFFFF",
        optionSelectedBg:         isDark ? "rgba(201,168,76,0.12)" : "rgba(201,168,76,0.09)",
        optionSelectedColor:      isDark ? GOLD_BRIGHT : GOLD_DEEP,
        optionSelectedFontWeight: 600,
        optionActiveBg:           isDark ? "rgba(201,168,76,0.07)" : "rgba(201,168,76,0.05)",
        borderRadius:             10,
        borderRadiusLG:           12,
        activeBorderColor:        isDark ? GOLD_BRIGHT : GOLD_DEEP,
        hoverBorderColor:         isDark ? "rgba(201,168,76,0.50)" : GOLD,
        activeOutlineColor:       "rgba(201,168,76,0.16)",
      },

      // DatePicker
      DatePicker: {
        colorBgContainer:         isDark ? D_SURFACE : "#FFFFFF",
        colorBgElevated:          isDark ? D_CARD    : "#FFFFFF",
        activeBorderColor:        isDark ? GOLD_BRIGHT : GOLD_DEEP,
        hoverBorderColor:         isDark ? "rgba(201,168,76,0.50)" : GOLD,
        activeShadow:             "0 0 0 3px rgba(201,168,76,0.16)",
        cellActiveWithRangeBg:    isDark ? "rgba(201,168,76,0.08)" : "rgba(201,168,76,0.06)",
        borderRadius:             10,
        withoutTimeCellHeight:    36,
      },

      // Modal
      Modal: {
        titleFontSize:    16,
        titleLineHeight:  1.4,
        borderRadiusLG:   20,
        headerBg:         isDark ? D_SURFACE : "#FFFFFF",
        contentBg:        isDark ? D_SURFACE : "#FFFFFF",
        footerBg:         isDark ? D_SURFACE : "#FFFFFF",
      },

      // Table
      Table: {
        colorBgContainer:         isDark ? D_SURFACE : "#FFFFFF",
        headerBg:                 isDark ? "rgba(201,168,76,0.06)" : "rgba(201,168,76,0.05)",
        headerColor:              isDark ? "#9E9080" : "#6B5F50",
        headerSortActiveBg:       isDark ? "rgba(201,168,76,0.09)" : "rgba(201,168,76,0.07)",
        headerSortHoverBg:        isDark ? "rgba(201,168,76,0.07)" : "rgba(201,168,76,0.05)",
        rowHoverBg:               isDark ? D_CARD : L_HOVER,
        rowSelectedBg:            isDark ? "rgba(201,168,76,0.10)" : "rgba(201,168,76,0.08)",
        rowSelectedHoverBg:       isDark ? "rgba(201,168,76,0.14)" : "rgba(201,168,76,0.12)",
        borderColor:              isDark ? "rgba(255,255,255,0.05)" : "rgba(201,168,76,0.08)",
        cellPaddingBlock:         12,
        cellPaddingInline:        16,
        cellPaddingBlockSM:       8,
        cellPaddingInlineSM:      12,
        expandIconBg:             isDark ? D_SURFACE : "#FFFFFF",
      },

      // Card
      Card: {
        colorBgContainer:         isDark ? D_SURFACE : "#FFFFFF",
        headerBg:                 "transparent",
        colorBorderSecondary:     isDark ? "rgba(201,168,76,0.10)" : "rgba(201,168,76,0.14)",
        borderRadius:             16,
        borderRadiusLG:           20,
        borderRadiusSM:           12,
        paddingLG:                20,
        padding:                  16,
      },

      // Form
      Form: {
        labelColor:           isDark ? "#9E9080" : "#6B5F50",
        labelFontSize:        12,
        labelHeight:          30,
        itemMarginBottom:     16,
        verticalLabelPadding: "0 0 6px",
      },

      // Tag
      Tag: {
        borderRadius:    8,
        borderRadiusSM:  6,
        defaultBg:       isDark ? "rgba(255,255,255,0.06)" : "rgba(201,168,76,0.07)",
        defaultColor:    isDark ? "#F0EDE5" : "#0A0805",
      },

      // Tabs
      Tabs: {
        inkBarColor:       isDark ? GOLD_BRIGHT : GOLD_DEEP,
        itemColor:         isDark ? "#9E9080"   : "#6B5F50",
        itemSelectedColor: isDark ? GOLD_BRIGHT : GOLD_DEEP,
        itemHoverColor:    isDark ? GOLD_LIGHT  : GOLD,
        itemActiveColor:   isDark ? GOLD        : GOLD_DEEP,
        cardBg:            isDark ? D_CARD : "#F0EDE5",
        horizontalMargin:  "0 0 16px 0",
        titleFontSize:     14,
      },

      // Tooltip
      Tooltip: {
        colorBgSpotlight:    isDark ? "#141424" : "#1C1812",
        colorTextLightSolid: isDark ? "#F0EDE5" : "#F5EDD8",
        borderRadius:        8,
      },

      // Breadcrumb
      Breadcrumb: {
        linkColor:      isDark ? "#5C5248" : "#9E9080",
        linkHoverColor: isDark ? GOLD_BRIGHT : GOLD_DEEP,
        separatorColor: isDark ? "#3A342E"  : "#C4B89E",
        itemColor:      isDark ? "#F0EDE5"  : "#0A0805",
        fontSize:       12,
        separatorMargin: 6,
      },

      // Divider
      Divider: {
        colorSplit: isDark ? "rgba(201,168,76,0.08)" : "rgba(201,168,76,0.12)",
        margin:     16,
        marginLG:   24,
      },

      // Avatar
      Avatar: {
        colorTextPlaceholder: isDark ? "#5C5248" : "#9E9080",
        colorBgBase:          isDark ? D_CARD    : "#F0ECE0",
        borderRadius:         10,
      },

      // Badge
      Badge: {
        dotSize:       8,
        colorBorderBg: isDark ? D_SURFACE : L_CARD,
      },

      // Notification
      Notification: {
        colorBgElevated: isDark ? D_CARD : "#FFFFFF",
        borderRadius:    14,
        padding:         16,
        paddingMD:       20,
        width:           380,
      },

      // Message
      Message: {
        colorBgElevated: isDark ? D_CARD : "#FFFFFF",
        borderRadius:    12,
      },

      // Switch
      Switch: {
        colorPrimary:      isDark ? GOLD_BRIGHT : GOLD_DEEP,
        colorPrimaryHover: isDark ? GOLD_LIGHT  : GOLD,
        handleBg:          "#FFFFFF",
        trackHeight:       22,
        handleSize:        18,
        trackPadding:      2,
      },

      // Checkbox
      Checkbox: {
        colorPrimary:      isDark ? GOLD_BRIGHT : GOLD_DEEP,
        colorPrimaryHover: isDark ? GOLD_LIGHT  : GOLD,
        colorBgContainer:  isDark ? D_SURFACE   : "#FFFFFF",
        borderRadius:      5,
      },

      // Radio
      Radio: {
        colorPrimary:      isDark ? GOLD_BRIGHT : GOLD_DEEP,
        colorPrimaryHover: isDark ? GOLD_LIGHT  : GOLD,
        colorBgContainer:  isDark ? D_SURFACE   : "#FFFFFF",
        dotSize:           10,
      },

      // Collapse
      Collapse: {
        colorBgContainer: isDark ? D_SURFACE : "#FFFFFF",
        headerBg:         isDark ? D_CARD    : "#F7F4EE",
        borderRadius:     12,
        headerPadding:    "14px 18px",
        contentPadding:   "14px 18px",
      },

      // Upload
      Upload: {
        colorBorder:      isDark ? "rgba(201,168,76,0.22)" : "rgba(201,168,76,0.32)",
        colorBgContainer: isDark ? D_SURFACE : "#FFFFFF",
        colorFillAlter:   isDark ? D_CARD    : "#F7F4EE",
        colorPrimary:     isDark ? GOLD_BRIGHT : GOLD_DEEP,
        borderRadius:     10,
      },

      // Dropdown
      Dropdown: {
        colorBgElevated:     isDark ? D_CARD    : "#FFFFFF",
        controlItemBgHover:  isDark ? "rgba(201,168,76,0.08)" : "rgba(201,168,76,0.06)",
        controlItemBgActive: isDark ? "rgba(201,168,76,0.14)" : "rgba(201,168,76,0.10)",
        borderRadius:        12,
        paddingBlock:        6,
      },

      // Pagination
      Pagination: {
        itemActiveBg: "transparent",
        itemLinkBg:   "transparent",
        itemBg:       "transparent",
        borderRadius: 8,
        itemSize:     34,
        itemSizeSM:   28,
      },

      // Spin
      Spin: {
        colorPrimary: isDark ? GOLD_BRIGHT : GOLD_DEEP,
        dotSizeLG:    44,
        dotSize:      30,
        dotSizeSM:    18,
      },

      // Skeleton
      Skeleton: {
        colorFill:        isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
        colorFillContent: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
        borderRadius:     8,
      },

      // Progress
      Progress: {
        colorSuccess:     C_SUCCESS,
        remainingColor:   isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)",
        lineBorderRadius: 100,
      },

      // Empty
      Empty: {
        colorTextDescription: isDark ? "#5C5248" : "#9E9080",
        colorFill:            isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
      },

      // Statistic
      Statistic: { titleFontSize: 11, contentFontSize: 24 },

      // ColorPicker
      ColorPicker: {
        colorBgElevated:  isDark ? D_CARD    : "#FFFFFF",
        colorBgContainer: isDark ? D_SURFACE : "#FFFFFF",
        borderRadius:     10,
      },

      // Popover
      Popover: {
        colorBgElevated: isDark ? D_CARD : "#FFFFFF",
        borderRadius:    14,
      },

    },
  };
};


// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  § 4  PREMIUM LOGIN PAGE                                                ║
// ╚══════════════════════════════════════════════════════════════════════════╝

const PremiumLoginPage: React.FC = () => {
  const { mode }                     = useColorMode();
  const { mutate: login, isLoading } = useLogin();
  const [form]                       = Form.useForm();
  const isDark                       = mode === "dark";

  // Use index.css variable values directly for consistency
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
              {/* Pesantren SVG Mark — konsisten dengan Title & header */}
              <svg width="42" height="42" viewBox="0 0 32 32" fill="none"
                style={{ filter: `drop-shadow(0 0 6px ${GOLD_BRIGHT}80)` }}>
                <path d="M16 3C11.029 3 7 7.029 7 12V14H25V12C25 7.029 20.971 3 16 3Z"
                  fill={isDark ? GOLD_BRIGHT : GOLD_DEEP} opacity="0.95"/>
                <rect x="5" y="10" width="3" height="11" rx="1.5"
                  fill={isDark ? GOLD_BRIGHT : GOLD_DEEP} opacity="0.7"/>
                <path d="M5.5 10 L8 10 L6.5 7 Z"
                  fill={isDark ? GOLD_BRIGHT : GOLD_DEEP} opacity="0.85"/>
                <rect x="24" y="10" width="3" height="11" rx="1.5"
                  fill={isDark ? GOLD_BRIGHT : GOLD_DEEP} opacity="0.7"/>
                <path d="M24 10 L26.5 10 L25.5 7 Z"
                  fill={isDark ? GOLD_BRIGHT : GOLD_DEEP} opacity="0.85"/>
                <rect x="9" y="14" width="14" height="9" rx="2"
                  fill={isDark ? GOLD_BRIGHT : GOLD_DEEP} opacity="0.85"/>
                <path d="M13.5 23V18.5C13.5 17.12 14.62 16 16 16C17.38 16 18.5 17.12 18.5 18.5V23"
                  stroke="black" strokeWidth="1.2" opacity="0.30"/>
                <circle cx="12" cy="17.5" r="1.2" fill="black" opacity="0.25"/>
                <circle cx="20" cy="17.5" r="1.2" fill="black" opacity="0.25"/>
                <rect x="4" y="23" width="24" height="2" rx="1"
                  fill={isDark ? GOLD_BRIGHT : GOLD_DEEP} opacity="0.5"/>
                <path d="M16 5.5C17.2 5.5 18.3 6 19 6.9C18.3 6.5 17.5 6.3 16.6 6.4C14.8 6.6 13.4 8 13.3 9.8C13.2 8.9 13.4 8 13.9 7.2C14.5 6.2 15.2 5.5 16 5.5Z"
                  fill="white" opacity="0.55"/>
                <path d="M21.5 5L21.9 6.2L23.1 6.2L22.1 7L22.5 8.2L21.5 7.5L20.5 8.2L20.9 7L19.9 6.2L21.1 6.2Z"
                  fill="#FDE68A" opacity="0.80"/>
              </svg>
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
              Masukan kredensial anda untuk mengakses dashboard
            </div>
          </div>

          <Form
            form={form} layout="vertical"
            onFinish={(v) => login(v)}
            initialValues={{ email:"admin@alhasanah.com", password:"password123" }}
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

const AutoCollapseSider: React.FC<any> = (props) => {
  const { siderCollapsed, setSiderCollapsed } = useThemedLayoutContext();
  const timerRef = React.useRef<number | null>(null);

  const clearTimer = React.useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleCollapse = React.useCallback(() => {
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      if (window.innerWidth >= 992) {
        setSiderCollapsed(true);
      }
    }, 5000);
  }, [clearTimer, setSiderCollapsed]);

  const openAndRefresh = React.useCallback(() => {
    if (window.innerWidth >= 992 && siderCollapsed) {
      setSiderCollapsed(false);
    }
    scheduleCollapse();
  }, [scheduleCollapse, setSiderCollapsed, siderCollapsed]);

  React.useEffect(() => {
    scheduleCollapse();
    return clearTimer;
  }, [clearTimer, scheduleCollapse]);

  return (
    <div
      onMouseEnter={openAndRefresh}
      onMouseMove={openAndRefresh}
      onFocus={openAndRefresh}
      onClick={openAndRefresh}
    >
      <ThemedSiderV2 {...props} fixed Title={Title} />
    </div>
  );
};


// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  § 5  HELPERS                                                            ║
// ╚══════════════════════════════════════════════════════════════════════════╝

const AIConsultantWrapper: React.FC = () => {
  const { data: user } = useGetIdentity<IUserIdentity>();
  const allowed = ["super_admin", "dewan", "rois"];
  if (!user || !allowed.includes(user.role)) return null;
  return <><AiFloatingButton /><GeminiConsultant /></>;
};


// ✅ FIX #1: PageWrapper menggunakan useLocation().pathname sebagai key
// Tanpa key berbeda, AnimatePresence TIDAK PERNAH trigger transisi halaman
// karena React menganggap children tidak berubah.
const PageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}           // ← KEY KRITIS: berubah setiap navigasi
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


// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  § 6  INNER APP                                                         ║
// ║                                                                         ║
// ║  THE KEY FIX:                                                           ║
// ║  useEffect writes the style tag imperatively into document.head.        ║
// ║  This bypasses React 19's style hoisting & deduplication which caused   ║
// ║  the "white cards after dark re-toggle" bug.                            ║
// ║                                                                         ║
// ║  React 19 JSX <style> tags → hoisted to <head> → deduplicated by        ║
// ║  content hash → mode toggle updates content but React may skip          ║
// ║  re-injection ("already seen this hash" or "already hoisted").          ║
// ║                                                                         ║
// ║  useEffect DOM → always writes current CSS to the element directly,    ║
// ║  guaranteed to run after every mode change before next paint.           ║
// ╚══════════════════════════════════════════════════════════════════════════╝

const InnerApp: React.FC = () => {
  const { mode } = useColorMode();

  // ✅ FIX #2: useMemo — buildPremiumTheme adalah objek besar 100+ token.
  // Tanpa memo, ia dibuat ulang setiap render menyebabkan seluruh
  // ConfigProvider re-render dan semua komponen Ant Design ikut re-render.
  const antThemeConfig = useMemo(() => buildPremiumTheme(mode), [mode]);

  useEffect(() => {
    // Get or create the style element
    let el = document.getElementById("alh-sidebar-css") as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = "alh-sidebar-css";
      // Append to end of <head> so it has higher specificity order
      // than any statically loaded stylesheet (including index.css)
      document.head.appendChild(el);
    }
    // Direct textContent write — no React involvement, always current
    el.textContent = buildSidebarCSS(mode);
    // No cleanup needed — we reuse the same element across toggles
  }, [mode]);

  return (
    <ConfigProvider theme={antThemeConfig} locale={idID}>
      <AntdApp>
        <DevtoolsProvider>
          {/* ✅ FIX #4: RefineKbarProvider aktifkan command palette (Ctrl+K / ⌘+K) */}
          <RefineKbarProvider>
            <Refine
            dataProvider={dataProvider(supabaseClient)}
            authProvider={authProvider}
            accessControlProvider={accessControlProvider}
            routerProvider={routerBindings}
            notificationProvider={useNotificationProvider}
            options={{
              syncWithLocation:       true,
              warnWhenUnsavedChanges: true,
              useNewQueryKeys:        true,
              projectId:              "alhasanah-admin-panel",
            }}
            resources={resources}
          >
            <Routes>
              {/* LOGIN */}
              <Route element={<Authenticated key="auth-pages" fallback={<Outlet />}><NavigateToResource /></Authenticated>}>
                <Route path="/login" element={<PremiumLoginPage />} />
              </Route>

              {/* PROTECTED */}
              <Route element={
                <Authenticated key="authenticated-inner" fallback={<CatchAllNavigate to="/login" />}>
                  <ThemedLayoutV2
                    Header={() => <Header sticky />}
                    Sider={(props) => <AutoCollapseSider {...props} />}
                  >
                    {/* ✅ FIX #1: AnimatePresence dipindah ke dalam PageWrapper.
                        PageWrapper menggunakan useLocation().pathname sebagai key
                        sehingga setiap navigasi trigger animasi masuk/keluar. */}
                    <PageWrapper><Outlet /></PageWrapper>
                    <AIConsultantWrapper />
                  </ThemedLayoutV2>
                </Authenticated>
              }>
                <Route index element={<DashboardPage />} />
                <Route path="/instansi" element={<InstansiPage />} />

                <Route path="/santri">
                  <Route index          element={<SantriList />}   />
                  <Route path="create"  element={<SantriCreate />} />
                  <Route path="edit/:id" element={<SantriEdit />}  />
                  <Route path="show/:id" element={<SantriShow />}  />
                </Route>
                <Route path="/persebaran-santri" element={<PersebaranSantriPage />} />

                <Route path="/berita">
                  <Route index          element={<BeritaList />}   />
                  <Route path="create"  element={<BeritaCreate />} />
                  <Route path="edit/:id" element={<BeritaEdit />}  />
                </Route>

                <Route path="/pelanggaran">
                  <Route index          element={<PelanggaranList />}   />
                  <Route path="create"  element={<PelanggaranCreate />} />
                  <Route path="edit/:id" element={<PelanggaranEdit />}  />
                </Route>
                <Route path="/perizinan">
                  <Route index          element={<PerizinanList />}   />
                  <Route path="create"  element={<PerizinanCreate />} />
                  <Route path="edit/:id" element={<PerizinanEdit />}  />
                </Route>
                <Route path="/kesehatan">
                  <Route index          element={<KesehatanList />}   />
                  <Route path="create"  element={<KesehatanCreate />} />
                  <Route path="edit/:id" element={<KesehatanEdit />}  />
                </Route>
                <Route path="/prestasi" element={<PrestasiList />} />

                <Route path="/hafalan">
                  <Route index          element={<HafalanList />}   />
                  <Route path="create"  element={<HafalanCreate />} />
                  <Route path="edit/:id" element={<HafalanEdit />}  />
                  <Route path="show/:id" element={<HafalanShow />}  />
                </Route>
                <Route path="/murojaah">
                  <Route index          element={<MurojaahList />}   />
                  <Route path="create"  element={<MurojaahCreate />} />
                  <Route path="show/:id" element={<MurojaahShow />}  />
                </Route>
                <Route path="/hafalan-kitab">
                  <Route index          element={<HafalanKitabList />}   />
                  <Route path="create"  element={<HafalanKitabCreate />} />
                  <Route path="show/:id" element={<HafalanKitabShow />}  />
                </Route>

                <Route path="/alumni">    <Route index element={<AlumniList />}    /></Route>
                <Route path="/forum-alumni" element={<ForumModerationList />} />
                <Route path="/forum-reports" element={<ForumReportsList />} />
                <Route path="/chat-alumni" element={<AlumniChatMonitoringList />} />
                <Route path="/audit-logs"><Route index element={<AuditLogList />}  /></Route>
                <Route path="/rag">       <Route index element={<RagKnowledgePage />} /></Route>
                <Route path="/akademik">  <Route index element={<AkademikPage />} /></Route>

                <Route path="/tagihan">
                  <Route index          element={<TagihanList />}   />
                  <Route path="create"  element={<TagihanCreate />} />
                  <Route path="edit/:id" element={<TagihanEdit />}  />
                </Route>
                <Route path="/jenis-pembayaran" element={<JenisPembayaranList />} />
                <Route path="/transaksi">
                  <Route index element={<TransaksiList />} />
                  <Route path="create" element={<TransaksiCreate />} />
                </Route>
                <Route path="/dompet-santri" element={<DompetSantriList />} />
                <Route path="/dompet-operasional" element={<DompetOperasionalList />} />
                <Route path="/dompet-security-audit" element={<DompetSecurityAuditList />} />
                <Route path="/kantin-management" element={<KantinManagementList />} />
                <Route path="/pengeluaran" element={<PengeluaranList />} />

                <Route path="/diklat">
                  <Route index         element={<DiklatList />}     />
                  <Route path="master" element={<MasterDataPage />} />
                  <Route path="list"   element={<DiklatList />}     />
                </Route>

                <Route path="/scanQr"                      element={<ScanQR />}           />
                <Route path="/admin-management/create"     element={<CreateAdminPage />}  />
                <Route path="/admin-management/list"       element={<AdminList />}        />

                <Route path="/inventaris">
                  <Route index          element={<InventarisList />}   />
                  <Route path="create"  element={<InventarisCreate />} />
                  <Route path="show/:id" element={<InventarisShow />}  />
                </Route>

                <Route path="/ulangan">
                  <Route index         element={<WeeklyTestList />}   />
                  <Route path="create" element={<WeeklyTestCreate />} />
                </Route>
                <Route path="/ulangan/arsip"><Route index element={<WeeklyTestArsip />} /></Route>

                <Route path="/notifications">
                  <Route index         element={<NotificationList />}   />
                  <Route path="create" element={<NotificationCreate />} />
                </Route>

                <Route path="/backend-command-center">
                  <Route path="self-healing" element={<SelfHealingCenterPage />} />
                  <Route path="diagnostics" element={<BackendDiagnosticsPage />} />
                  <Route path="private-audit-log" element={<PrivateAuditLogPage />} />
                </Route>

                <Route path="*" element={<ErrorComponent />} />
              </Route>
            </Routes>

            <UnsavedChangesNotifier />
            {/* ✅ FIX #5: DocumentTitleHandler dengan custom handler
                Sebelumnya: tab selalu "Refine" generic
                Sesudahnya: "Daftar Santri · Al-Hasanah" dst */}
            <DocumentTitleHandler
              handler={({ resource, action }) => {
                const label = resource?.meta?.label ?? resource?.name ?? "";
                const actionMap: Record<string, string> = {
                  list:   label,
                  create: `Tambah ${label}`,
                  edit:   `Edit ${label}`,
                  show:   `Detail ${label}`,
                };
                const title = actionMap[action ?? "list"] ?? label;
                return title ? `${title} · Al-Hasanah` : "Al-Hasanah";
              }}
            />
            {/* ✅ FIX #4: RefineKbar renders command palette UI (Ctrl+K / ⌘+K) */}
            <RefineKbar />
          </Refine>
          </RefineKbarProvider>
        </DevtoolsProvider>
      </AntdApp>
    </ConfigProvider>
  );
};


// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  § 7  APP ROOT                                                           ║
// ╚══════════════════════════════════════════════════════════════════════════╝

const App: React.FC = () => (
  <BrowserRouter>
    <ColorModeContextProvider>
      <InnerApp />
    </ColorModeContextProvider>
  </BrowserRouter>
);

export default App;
