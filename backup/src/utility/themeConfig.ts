import { ThemeConfig, theme as antTheme } from "antd";

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  DESIGN TOKENS — Original Premium Islamic Aesthetic                      ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export const GOLD        = "#C9A84C";
export const GOLD_LIGHT  = "#FDE68A";
export const GOLD_BRIGHT = "#FFB700";
export const GOLD_DEEP   = "#8B6914";
export const GOLD_DARK   = "#5C430A";

const D_BG      = "#08070D";
const D_SURFACE = "#0F0F1A";
const D_CARD    = "#141424";

const L_BG      = "#F7F4EE";
const L_CARD    = "#FFFFFF";
const L_HOVER   = "#FFFDF5";

const C_SUCCESS = "#059669";
const C_ERROR   = "#DC2626";
const C_INFO    = "#2563EB";

export const buildPremiumTheme = (mode: "light" | "dark"): ThemeConfig => {
  const isDark = mode === "dark";

  return {
    algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,

    token: {
      colorPrimary:             isDark ? GOLD_BRIGHT : GOLD_DEEP,
      colorPrimaryHover:        isDark ? GOLD_LIGHT  : GOLD,
      colorPrimaryActive:       isDark ? GOLD        : GOLD_DEEP,
      colorLink:                isDark ? GOLD_BRIGHT : GOLD_DEEP,
      colorLinkHover:           isDark ? GOLD_LIGHT  : GOLD,

      colorBgBase:              isDark ? D_BG      : L_BG,
      colorBgContainer:         isDark ? D_SURFACE : L_CARD,
      colorBgElevated:          isDark ? D_CARD    : "#FFFFFF",
      colorBgLayout:            isDark ? D_BG      : L_BG,
      colorBgSpotlight:         isDark ? "#1A1A2E" : "#F7F4EE",
      colorBgMask:              "rgba(0,0,0,0.56)",
      colorFillAlter:           isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
      colorFill:                isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
      colorFillSecondary:       isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",

      colorText:                isDark ? "#F0EDE5" : "#0A0805",
      colorTextSecondary:       isDark ? "#9E9080" : "#6B5F50",
      colorTextTertiary:        isDark ? "#5C5248" : "#9E9080",
      colorTextQuaternary:      isDark ? "#3A342E" : "#C4B89E",
      colorTextLightSolid:      "#FFFFFF",

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

      colorBorder:              isDark ? "rgba(201,168,76,0.14)"  : "rgba(201,168,76,0.20)",
      colorBorderSecondary:     isDark ? "rgba(201,168,76,0.07)"  : "rgba(201,168,76,0.10)",
      colorSplit:               isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",

      controlOutlineWidth:      3,
      controlOutline:           "rgba(201,168,76,0.16)",
      controlItemBgHover:       isDark ? "rgba(201,168,76,0.08)" : "rgba(201,168,76,0.07)",
      controlItemBgActive:      isDark ? "rgba(201,168,76,0.14)" : "rgba(201,168,76,0.10)",
      controlItemBgActiveHover: isDark ? "rgba(201,168,76,0.18)" : "rgba(201,168,76,0.14)",

      borderRadius:             10,
      borderRadiusLG:           14,
      borderRadiusSM:           8,
      borderRadiusXS:           6,
      borderRadiusOuter:        12,

      boxShadow:                isDark
        ? "0 4px 16px rgba(0,0,0,0.50), 0 1px 4px rgba(0,0,0,0.30)"
        : "0 2px 8px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.04)",
      boxShadowSecondary:       isDark
        ? "0 8px 32px rgba(0,0,0,0.60)"
        : "0 4px 16px rgba(0,0,0,0.06)",

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

      controlHeight:            40,
      controlHeightLG:          48,
      controlHeightSM:          32,

      motionDurationMid:        "0.25s",
      motionDurationSlow:       "0.40s",
      motionDurationFast:       "0.15s",
      motionEaseInOut:          "cubic-bezier(0.4, 0, 0.2, 1)",
      motionEaseOut:            "cubic-bezier(0.22, 1, 0.36, 1)",
    },

    components: {
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
        activeBarWidth:         0,
      },
      Button: {
        borderRadius:             10,
        borderRadiusLG:           12,
        fontWeight:               600,
        contentFontSize:          14,
      },
      Table: {
        colorBgContainer:         isDark ? D_SURFACE : "#FFFFFF",
        headerBg:                 isDark ? "rgba(201,168,76,0.06)" : "rgba(201,168,76,0.05)",
      },
      Card: {
        colorBgContainer:         isDark ? D_SURFACE : "#FFFFFF",
        borderRadius:             16,
      },
    },
  };
};

export const buildSidebarCSS = (mode: "light" | "dark", ISLAMIC_SVG: string): string => {
  const isDark    = mode === "dark";
  const accent    = isDark ? GOLD_BRIGHT : GOLD_BRIGHT; 
  const popupBg   = isDark ? "#141424"   : "#231B10";
  const D_SIDER   = "#09090F";

  return `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&display=swap');

@keyframes alhPageIn {
  from { opacity:0; transform:translateY(12px); }
  to   { opacity:1; transform:translateY(0); }
}
.alh-page-enter { animation: alhPageIn 0.35s cubic-bezier(0.22,1,0.36,1) both; }

.ant-layout-sider {
  background: ${D_SIDER} !important;
  border-right: 1px solid rgba(201,168,76,0.09) !important;
  box-shadow: 4px 0 48px rgba(0,0,0,0.45) !important;
  overflow: visible !important;
}

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

.ant-layout-sider-trigger {
  background: rgba(201,168,76,0.07) !important;
  color: ${accent} !important;
}

.ant-layout-sider .ant-menu-item-selected::before {
  content: '';
  position: absolute;
  left: -8px; top: 10px; bottom: 10px;
  width: 3px;
  background: linear-gradient(180deg, ${GOLD} 0%, ${GOLD_BRIGHT} 100%);
  border-radius: 0 3px 3px 0;
}

.ant-modal-mask {
  backdrop-filter: blur(5px) !important;
  background: rgba(0,0,0,0.58) !important;
}
`;
};
