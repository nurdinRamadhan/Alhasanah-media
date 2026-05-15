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
        {children}
    </ColorModeContext.Provider>
  );
};

export const useColorMode = () => useContext(ColorModeContext);