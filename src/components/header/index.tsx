import { useGetIdentity, useActiveAuthProvider } from "@refinedev/core";
import { Layout, Space, Typography, Avatar, theme, Button, Tag } from "antd";
import { useColorMode } from "../../contexts/color-mode"; // Sesuaikan path context Anda
import { MoonOutlined, SunOutlined, UserOutlined, BellOutlined } from "@ant-design/icons";

const { Header: AntdHeader } = Layout;
const { useToken } = theme;
const { Text } = Typography;

export const Header: React.FC<{ sticky?: boolean }> = ({ sticky }) => {
  const { token } = useToken();
  const { mode, setMode } = useColorMode();
  const authProvider = useActiveAuthProvider();
  const { data: user } = useGetIdentity({ v3LegacyAuthProviderCompatible: Boolean(authProvider?.isLegacy), });

  // Warna Header menyesuaikan mode
  const headerBg = mode === "dark" ? token.colorBgContainer : "#ffffff";

  return (
    <AntdHeader
      style={{
        backgroundColor: headerBg,
        position: sticky ? "sticky" : "relative",
        top: 0,
        zIndex: 999,
        display: "flex",
        justifyContent: "flex-end", // Konten rata kanan
        alignItems: "center",
        padding: "0 24px",
        height: "64px",
        borderBottom: mode === "dark" ? "1px solid #303030" : "1px solid #f0f0f0",
        boxShadow: mode === "light" ? "0 2px 8px #f0f1f2" : "none",
      }}
    >
      <Space size="middle">
        {/* Tombol Notifikasi (Mockup) */}
        <Button 
            type="text" 
            icon={<BellOutlined style={{ fontSize: 18, color: token.colorTextSecondary }} />} 
        />

        {/* Toggle Dark Mode */}
        <Button
          type="text"
          icon={mode === "light" ? <MoonOutlined /> : <SunOutlined />}
          onClick={() => setMode(mode === "light" ? "dark" : "light")}
        />

        {/* Profil User Informatif */}
        <Space size={10} style={{ borderLeft: "1px solid #eee", paddingLeft: 16, marginLeft: 8 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.2 }}>
                <Text strong style={{ fontSize: 14 }}>
                    {user?.name || user?.full_name || "Administrator"}
                </Text>
                <Tag color="gold" style={{ margin: 0, fontSize: 10, lineHeight: "16px", border: 0 }}>
                    {user?.role?.toUpperCase() || "PENGURUS"}
                </Tag>
            </div>
            <Avatar 
                size="large" 
                src={user?.avatar || user?.foto_url} 
                icon={<UserOutlined />} 
                style={{ backgroundColor: token.colorPrimary, verticalAlign: 'middle' }}
            />
        </Space>
      </Space>
    </AntdHeader>
  );
};