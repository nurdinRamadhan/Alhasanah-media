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
  const { mode, setMode } = useColorMode();

  const headerStyles: React.CSSProperties = {
    backgroundColor: mode === "dark" ? "#000000" : "#ffffff",
    borderBottom: `1px solid ${mode === "dark" ? "rgba(255, 183, 0, 0.1)" : "#e5e7eb"}`,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0px 24px",
    height: "72px",
    position: sticky ? "sticky" : "relative",
    top: 0,
    zIndex: 1000,
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: "logout",
      icon: <LogoutOutlined style={{ color: "#ef4444" }} />,
      label: <span style={{ color: "#ef4444", fontWeight: 500 }}>Logout</span>,
      onClick: () => logout(),
    },
  ];

  return (
    <AntdLayout.Header style={headerStyles}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
        <Text strong style={{ 
          color: mode === "dark" ? "#ffb700" : token.colorTextHeading, 
          fontSize: "16px", 
          lineHeight: "1.2",
          display: "block",
          marginBottom: "4px",
          letterSpacing: "0.02em"
        }}>
            Pondok Pesantren Al-Hasanah Cibeuti
        </Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ffb700', boxShadow: mode === 'dark' ? '0 0 8px #ffb700' : 'none' }}></div>
            <Text style={{ 
              color: token.colorTextSecondary, 
              fontSize: "11px", 
              fontWeight: 500,
              lineHeight: "1",
              letterSpacing: "0.01em"
            }}>
                Jl. Raya Cibeuti No.13, Cibeuti, Kec. Kawalu, Tasikmalaya, Jawa Barat 46182
            </Text>
        </div>
      </div>

      <Space size="large">
        <Switch
            checkedChildren="🌙"
            unCheckedChildren="☀️"
            checked={mode === "dark"}
            onChange={() => setMode(mode === "light" ? "dark" : "light")}
            style={{ 
              background: mode === 'dark' ? '#ffb700' : '#059669',
            }}
        />

        <Dropdown menu={{ items: userMenuItems }} trigger={["click"]} placement="bottomRight">
            <Button 
              type="text" 
              className="flex items-center gap-3 p-1 h-auto hover:bg-white/5"
            >
                <Avatar 
                    size={40} 
                    src={user?.foto_url} 
                    icon={<UserOutlined />} 
                    style={{ 
                      backgroundColor: "#000000",
                      border: `2px solid ${mode === 'dark' ? '#ffb700' : '#059669'}`,
                      boxShadow: mode === 'dark' ? '0 0 10px rgba(255, 183, 0, 0.2)' : 'none'
                    }}
                />
                <div className="hidden sm:flex flex-col items-start text-left leading-tight">
                    <Text strong style={{ fontSize: 13, color: token.colorTextHeading }}>
                        {user?.full_name || user?.email || "Administrator"}
                    </Text>
                    <Text style={{ color: token.colorTextDescription, fontSize: 10, textTransform: 'uppercase' }}>
                        {user?.role || "Pengurus"}
                    </Text>
                </div>
                <DownOutlined style={{ fontSize: "10px", color: token.colorTextDescription }} />
            </Button>
        </Dropdown>
      </Space>
    </AntdLayout.Header>
  );
};