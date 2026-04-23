import React, { createContext, useEffect, useState, useContext } from "react";
import { ConfigProvider, theme } from "antd";
import idID from "antd/locale/id_ID"; // ✅ WAJIB: Import Locale Indonesia

type ColorModeContextType = {
  mode: "light" | "dark";
  setMode: (mode: "light" | "dark") => void;
};

export const ColorModeContext = createContext<ColorModeContextType>({} as ColorModeContextType);

export const ColorModeContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemPreference = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  const [mode, setMode] = useState<"light" | "dark">((localStorage.getItem("theme") as "light" | "dark") || systemPreference);

  useEffect(() => {
    localStorage.setItem("theme", mode);
    if (mode === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [mode]);

  return (
    <ColorModeContext.Provider value={{ setMode, mode }}>
      <ConfigProvider
        locale={idID}
        theme={{
          algorithm: mode === "dark" ? theme.darkAlgorithm : theme.defaultAlgorithm,
          token: {
            colorPrimary: "#059669", 
            colorInfo: "#059669",
            colorSuccess: "#10b981",
            colorWarning: "#ffb700", // More vibrant gold
            colorError: "#ef4444",
            borderRadius: 8,
            fontFamily: "'Inter', sans-serif",
            fontSize: 14,
            // DEEP DARK DRACULA / FUTURISTIC
            colorBgBase: mode === "dark" ? "#000000" : "#ffffff", 
            colorBgLayout: mode === "dark" ? "#000000" : "#f4f7f5",
            colorBgContainer: mode === "dark" ? "#0a0a0a" : "#ffffff",
            colorTextBase: mode === "dark" ? "#e5e7eb" : "#1a1a1a",
            colorBorder: mode === "dark" ? "rgba(255, 183, 0, 0.15)" : "#e5e7eb",
          },
          components: {
            Layout: {
              siderBg: mode === "dark" ? "#000000" : "#ffffff",
              headerBg: mode === "dark" ? "#000000" : "#ffffff",
              bodyBg: mode === "dark" ? "#000000" : "#f4f7f5",
            },
            Menu: {
              itemSelectedBg: "#ffb700",
              itemSelectedColor: "#000000",
              itemHoverColor: "#ffb700",
              darkItemSelectedBg: "#ffb700",
              darkItemSelectedColor: "#000000",
              itemBg: "transparent",
              activeBarBorderWidth: 0,
            },
            Table: {
              headerBg: mode === "dark" ? "rgba(255, 183, 0, 0.05)" : "#f9fafb",
              headerColor: mode === "dark" ? "#ffb700" : "#065f46",
              rowHoverBg: mode === "dark" ? "rgba(255, 255, 255, 0.02)" : "#f0fdf4",
              headerBorderRadius: 4,
            },
            Card: {
              colorBgContainer: mode === "dark" ? "#0a0a0a" : "#ffffff",
              colorBorderSecondary: mode === "dark" ? "rgba(255, 183, 0, 0.1)" : "#f0f0f0",
              boxShadowTertiary: mode === "dark" ? "0 0 20px rgba(0,0,0,0.5)" : "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
            },
            Button: {
              borderRadius: 4,
              fontWeight: 600,
            },
            Switch: {
              colorPrimary: "#ffb700",
            }
          }
        }}
      >
        {children}
      </ConfigProvider>
    </ColorModeContext.Provider>
  );
};

export const useColorMode = () => useContext(ColorModeContext);