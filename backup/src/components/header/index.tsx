import { useGetIdentity, useActiveAuthProvider } from "@refinedev/core";
import { Layout, Space, Typography, Avatar, theme, Button, Tag, Dropdown } from "antd";
import { useColorMode } from "../../contexts/color-mode"; 
import { 
    MoonOutlined, 
    SunOutlined, 
    UserOutlined, 
    BellOutlined, 
    EnvironmentOutlined,
    DownOutlined
} from "@ant-design/icons";

const { Header: AntdHeader } = Layout;
const { useToken } = theme;
const { Text, Title } = Typography;

export const Header: React.FC<{ sticky?: boolean }> = ({ sticky }) => {
  const { token } = useToken();
  const { mode, setMode } = useColorMode();
  const authProvider = useActiveAuthProvider();
  const { data: user } = useGetIdentity({ v3LegacyAuthProviderCompatible: Boolean(authProvider?.isLegacy), });

  const isDark = mode === "dark";

  return (
    <AntdHeader
      style={{
        backgroundColor: isDark ? "#020617" : "#ffffff", // Dark blue-black yang lebih modern
        position: sticky ? "sticky" : "relative",
        top: 0,
        zIndex: 999,
        display: "flex",
        justifyContent: "space-between", 
        alignItems: "center",
        padding: "0 24px",
        height: "80px",
        borderBottom: isDark ? "1px solid #1e293b" : "1px solid #f1f5f9",
        boxShadow: isDark ? "none" : "0 4px 6px -1px rgb(0 0 0 / 0.1)",
      }}
      className="backdrop-blur-md transition-all duration-300"
    >
      {/* --- SISI KIRI: IDENTITAS LEMBAGA j--- */}
      <div className="flex flex-col justify-center leading-tight">
        <Title level={4} style={{ margin: 0, letterSpacing: '-0.025em' }} className="dark:text-white font-black">
          Pondok Pesantren Al-Hasanah Cibeuti
        </Title>
        <Text className="text-xs font-bold text-blue-500 dark:text-blue-400">
          KH. Lili Syamsul Romli
        </Text>
        <div className="flex items-center gap-1 mt-1 opacity-60">
          <EnvironmentOutlined className="text-[10px]" />
          <Text className="text-[10px] dark:text-gray-400">
            Jl. Raya Cibeuti No.13, Cibeuti, Kec. Kawalu, Tasikmalaya, Jawa Barat 46182
          </Text>
        </div>
      </div>

      {/* --- SISI KANAN: ACTIONS & PROFILE --- */}
      <Space size={24}>
        {/* Toggle Theme Futuristik */}
        <div 
          onClick={() => setMode(isDark ? "light" : "dark")}
          className="relative w-14 h-7 bg-slate-200 dark:bg-slate-800 rounded-full p-1 cursor-pointer transition-all border border-slate-300 dark:border-slate-700 flex items-center shadow-inner"
        >
            <div className={`absolute w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 flex items-center justify-center ${isDark ? 'translate-x-7 bg-blue-500' : 'translate-x-0 bg-white'}`}>
                {isDark ? <MoonOutlined className="text-[10px] text-white" /> : <SunOutlined className="text-[10px] text-yellow-500" />}
            </div>
            <div className="flex justify-between w-full px-1 text-[10px]">
                <SunOutlined className={`${isDark ? 'opacity-40' : 'opacity-0'}`} />
                <MoonOutlined className={`${isDark ? 'opacity-0' : 'opacity-40'}`} />
            </div>
        </div>

        {/* Notifikasi dengan badge */}
        <Button 
            type="text" 
            className="relative hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded-xl"
            icon={<BellOutlined style={{ fontSize: 20, color: isDark ? '#94a3b8' : '#64748b' }} />} 
        >
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" />
        </Button>

        {/* User Profile Dropdown */}
        <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-800 cursor-pointer group">
            <div className="flex flex-col items-end leading-none">
                <Text strong className="text-sm dark:text-white group-hover:text-blue-500 transition-colors">
                    {user?.name || "Administrator"}
                </Text>
                <span className="text-[10px] font-bold tracking-tighter text-slate-400 uppercase">
                    {user?.role || "super_admin"}
                </span>
            </div>
            
            <Dropdown
                menu={{ items: [{ key: 'logout', label: 'Keluar', danger: true }] }}
                trigger={['click']}
                placement="bottomRight"
            >
                <div className="relative">
                    <Avatar 
                        size={40} 
                        src={user?.avatar} 
                        icon={<UserOutlined />} 
                        className="border-2 border-blue-500/20 shadow-lg"
                    />
                    <div className="absolute -bottom-1 -right-1 bg-emerald-500 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900" />
                </div>
            </Dropdown>
        </div>
      </Space>
    </AntdHeader>
  );
};