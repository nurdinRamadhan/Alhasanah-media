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
  Switch,
  Tooltip
} from "antd";
import React from "react";
import { DownOutlined, LogoutOutlined, UserOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { useLogout } from "@refinedev/core";
import { useColorMode } from "../../contexts/color-mode"; // Import context theme
import { IProfile } from "../../types";
import { formatHijri, formatMasehi } from "../../utility/dateHelper";

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
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', lineHeight: '1', minWidth: 0 }}>
        <Text strong style={{ 
          color: mode === "dark" ? "#ffb700" : token.colorTextHeading, 
          fontSize: "clamp(13px, 2vw, 16px)", 
          lineHeight: "1.1",
          display: "block",
          letterSpacing: "-0.01em",
          whiteSpace: "nowrap",
        }}>
            Pondok Pesantren Al-Hasanah
        </Text>
        <div className="hidden sm:flex" style={{ alignItems: 'center', gap: '6px', marginTop: '4px' }}>
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#ffb700', opacity: 0.8 }}></div>
            <Text style={{ 
              color: token.colorTextSecondary, 
              fontSize: "10px", 
              fontWeight: 500,
              lineHeight: "1",
              whiteSpace: "nowrap",
              opacity: 0.8
            }}>
                Kawalu, Tasikmalaya
            </Text>
        </div>
      </div>

      <Space size={window.innerWidth < 640 ? "small" : "large"} align="center" style={{ flexShrink: 0 }}>
        <div className="flex flex-col items-end justify-center border-r border-gray-200 dark:border-gray-800 pr-3 mr-1" style={{ height: '40px' }}>
            <Tooltip title="Penanggalan Hijriah berdasarkan perhitungan sistem (Hisab), mungkin terdapat selisih +/- 1 hari dengan ketetapan resmi pemerintah/rukyat.">
              <div style={{ cursor: 'help', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                <Text strong style={{ fontSize: 12, color: mode === 'dark' ? '#ffb700' : '#059669', lineHeight: 1 }}>
                    {formatHijri(new Date())}
                </Text>
                <InfoCircleOutlined className="hidden sm:inline" style={{ fontSize: '9px', color: mode === 'dark' ? '#ffb700' : '#059669', opacity: 0.7 }} />
              </div>
            </Tooltip>
            <Text style={{ fontSize: 9, color: token.colorTextDescription, lineHeight: 1 }}>
                {formatMasehi(new Date())}
            </Text>
        </div>

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