import React from "react";
import { Typography, theme } from "antd"; // Import theme dari antd
import { BankOutlined } from "@ant-design/icons";
import { useColorMode } from "../../contexts/color-mode";

const { Text } = Typography;
const { useToken } = theme; // Hook untuk mengambil token warna aktif

export const Title: React.FC<{ collapsed: boolean }> = ({ collapsed }) => {
    const { token } = useToken();
    const { mode } = useColorMode();

    return (
        <div style={{ 
            display: "flex", 
            alignItems: "center", 
            justifyContent: collapsed ? "center" : "flex-start", 
            height: "72px",
            gap: "14px",
            padding: collapsed ? "0" : "0 20px",
            transition: "all 0.3s cubic-bezier(0.645, 0.045, 0.355, 1)",
            width: "100%",
            overflow: "hidden",
            backgroundColor: mode === "dark" ? "#000000" : "transparent"
        }}>
            {/* Logo Icon with Deep Dark Palette */}
            <div style={{
                background: mode === "dark" ? "#000000" : `linear-gradient(135deg, #065f46 0%, #042f2e 100%)`,
                borderRadius: "8px",
                width: "42px",
                height: "42px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: mode === "dark" ? `0 0 15px rgba(255, 183, 0, 0.2)` : `0 4px 10px rgba(6, 95, 70, 0.3)`,
                border: `2px solid ${mode === 'dark' ? '#ffb700' : '#fbbf24'}`,
                flexShrink: 0
            }}>
                <BankOutlined style={{ fontSize: "24px", color: mode === 'dark' ? '#ffb700' : '#ffffff' }} />
            </div>

            {/* Nama Pesantren */}
            {!collapsed && (
                <div style={{ 
                    display: "flex", 
                    flexDirection: "column", 
                    lineHeight: "1.2",
                    justifyContent: "center",
                    minWidth: 0
                }}>
                    <Text strong style={{ 
                        color: mode === "dark" ? "#ffffff" : token.colorTextHeading,
                        fontSize: "15px", 
                        fontWeight: "900",
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap"
                    }}>
                        AL-HASANAH
                    </Text>
                    <Text style={{ 
                        color: "#ffb700", 
                        fontSize: "10px", 
                        fontWeight: "800",
                        letterSpacing: "0.2em",
                        marginTop: "2px",
                        whiteSpace: "nowrap",
                        opacity: 0.9
                    }}>
                        MANAGEMENT
                    </Text>
                </div>
            )}
        </div>
    );
};