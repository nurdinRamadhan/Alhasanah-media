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
            padding: collapsed ? "0" : "0 20px",
            transition: "all 0.3s cubic-bezier(0.645, 0.045, 0.355, 1)",
            width: "100%",
            overflow: "hidden",
            backgroundColor: mode === "dark" ? "#0d0d0d" : "transparent",
            // Tambahkan border tipis di bawah untuk kesan profesional
            borderBottom: mode === "dark" ? "1px solid #141414" : "1px solid #f0f0f0"
        }}>
            {/* Logo Icon Container */}
            <div style={{
                background: mode === "dark" ? "linear-gradient(135deg, #141414 0%, #000000 100%)" : `linear-gradient(135deg, #065f46 0%, #042f2e 100%)`,
                borderRadius: "10px",
                width: "36px",
                height: "36px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: mode === "dark" ? `0 0 15px rgba(255, 183, 0, 0.1)` : `0 4px 10px rgba(6, 95, 70, 0.1)`,
                border: `1.5px solid ${mode === 'dark' ? '#ffb700' : '#fbbf24'}`,
                flexShrink: 0,
                // Pastikan margin konsisten
                marginLeft: collapsed ? "0" : "4px"
            }}>
                <BankOutlined style={{ fontSize: "18px", color: mode === 'dark' ? '#ffb700' : '#ffffff' }} />
            </div>

            {/* Nama Pesantren */}
            {!collapsed && (
                <div style={{ 
                    display: "flex", 
                    flexDirection: "column", 
                    lineHeight: "1.1",
                    justifyContent: "center",
                    minWidth: 0,
                    flex: 1,
                    marginLeft: "12px" // Jarak tetap dari logo
                }}>
                    <Text strong style={{ 
                        color: mode === "dark" ? "#ffffff" : token.colorTextHeading,
                        fontSize: "14px", 
                        fontWeight: "900",
                        letterSpacing: "0.02em",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                        display: "block"
                    }}>
                        AL-HASANAH
                    </Text>
                    <Text style={{ 
                        color: "#ffb700", 
                        fontSize: "9px", 
                        fontWeight: "800",
                        letterSpacing: "0.15em",
                        marginTop: "1px",
                        whiteSpace: "nowrap",
                        opacity: 0.9,
                        display: "block"
                    }}>
                        MANAGEMENT
                    </Text>
                </div>
            )}
        </div>
    );
};