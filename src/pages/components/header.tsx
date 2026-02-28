import type { RefineThemedLayoutV2HeaderProps } from "@refinedev/antd";
import { useGetIdentity } from "@refinedev/core";
import {
  Layout as AntdLayout,
  Avatar,
  Space,
  Typography,
  theme,
  Dropdown,
  MenuProps,
  Button,
  Switch
} from "antd";
import React from "react";
import { DownOutlined, LogoutOutlined, UserOutlined } from "@ant-design/icons";
import { useLogout } from "@refinedev/core";
import { useColorMode } from "../../contexts/color-mode"; // Import context theme
import { IProfile } from "../../types";

const { Text } = Typography;
const { useToken } = theme;

export const Header: React.FC<RefineThemedLayoutV2HeaderProps> = ({ sticky }) => {
  const { token } = useToken();
  const { data: user } = useGetIdentity<IProfile>();
  const { mutate: logout } = useLogout();
  const { mode, setMode } = useColorMode(); // Hook untuk ganti tema

  const headerStyles: React.CSSProperties = {
    backgroundColor: "#001529", 
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0px 16px", // Kurangi padding horizontal agar muat di HP
    height: "auto",
    minHeight: "64px",
    position: sticky ? "sticky" : "relative",
    top: 0,
    zIndex: 1000, // ENTERPRISE FIX: Pastikan ini lebih tinggi dari z-index tabel (biasanya 100)
    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)" // Tambah bayangan agar pemisah jelas saat discroll
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Logout",
      onClick: () => logout(),
    },
  ];

  return (
    <AntdLayout.Header style={headerStyles}>
      {/* --- BAGIAN KIRI: IDENTITAS PESANTREN --- */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '8px 0' }}>
        <Text strong style={{ color: "white", fontSize: "16px", lineHeight: "1.2" }}>
            Pondok Pesantren Al-Hasanah Cibeuti
        </Text>
        <Text style={{ color: "#d1d5db", fontSize: "12px" }}>
            KH. Lili Syamsul Romli
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: "11px", maxWidth: '600px', lineHeight: "1.2", marginTop: "2px" }}>
            Jl. Raya Cibeuti No.13, Cibeuti, Kec. Kawalu, Tasikmalaya, Jawa Barat 46182
        </Text>
      </div>

      {/* --- BAGIAN KANAN: TOGGLE TEMA & USER --- */}
      <Space size="middle">
        {/* Toggle Dark/Light Mode */}
        <Switch
            checkedChildren="🌙"
            unCheckedChildren="☀️"
            checked={mode === "dark"}
            onChange={() => setMode(mode === "light" ? "dark" : "light")}
            style={{ background: mode === 'dark' ? '#059669' : 'rgba(255,255,255,0.3)' }}
        />

        {/* Info User */}
        <Dropdown menu={{ items: userMenuItems }} trigger={["click"]}>
            <Button type="text" style={{ color: "white", height: "100%" }} className="flex items-center gap-2 hover:bg-white/10">
                <Space>
                    <Avatar 
                        size="small" 
                        src={user?.foto_url} 
                        icon={<UserOutlined />} 
                        style={{ backgroundColor: "#059669" }}
                    />
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "start", lineHeight: 1.2 }}>
                        <Text style={{ color: "white", fontSize: 12, fontWeight: "bold" }}>
                            {user?.full_name || user?.email || "Administrator"}
                        </Text>
                        <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 10 }}>
                            {user?.role || "Pengurus"}
                        </Text>
                    </div>
                    <DownOutlined style={{ fontSize: "10px", color: "rgba(255,255,255,0.6)" }} />
                </Space>
            </Button>
        </Dropdown>
      </Space>
    </AntdLayout.Header>
  );
};