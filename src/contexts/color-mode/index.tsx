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
        locale={idID} // ✅ FIX BAHASA CINA: Paksa semua komponen pakai Bahasa Indonesia
        theme={{
          algorithm: mode === "dark" ? theme.darkAlgorithm : theme.defaultAlgorithm,
          token: {
            colorPrimary: "#059669", // Emerald-600
            colorLink: "#059669",
            borderRadius: 8,
            fontFamily: "'Inter', sans-serif",
          },
          components: {
            Layout: {
              // ✅ FIX SIDEBAR:
              // Dark Mode: Hijau Emerald Gelap (Mewah)
              // Light Mode: Putih (Bersih)
              siderBg: mode === "dark" ? "#022c22" : "#ffffff", 
              triggerBg: mode === "dark" ? "#064e3b" : "#ffffff",
              bodyBg: mode === "dark" ? "#141414" : "#f0f2f5",
            },
            Menu: {
              // Warna Menu Sidebar
              darkItemBg: "#022c22", // Samakan dengan sider
              darkItemSelectedBg: "#059669", // Highlight Emerald
              itemSelectedColor: "#059669", // Text Highlight
              itemSelectedBg: mode === "dark" ? "#064e3b" : "#ecfdf5", // Background item aktif
            },
            Table: {
              headerBg: mode === "dark" ? "#1f1f1f" : "#ecfdf5", // Header Tabel Hijau Muda
              headerColor: mode === "dark" ? "#e5e7eb" : "#064e3b",
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