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
            justifyContent: "center", 
            height: "72px",
            width: "100%",
            transition: "all 0.3s ease",
            overflow: "hidden",
            backgroundColor: mode === "dark" ? "#000000" : "transparent",
            borderBottom: mode === "dark" ? "1px solid rgba(255, 183, 0, 0.1)" : "1px solid #f0f0f0",
            padding: collapsed ? "0" : "0 12px",
        }}>
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: collapsed ? "center" : "flex-start",
                width: collapsed ? "100%" : "auto",
                gap: "12px"
            }}>
                {/* Logo Icon Container */}
                <div style={{
                    background: mode === "dark" ? "linear-gradient(135deg, #141414 0%, #000000 100%)" : `linear-gradient(135deg, #065f46 0%, #042f2e 100%)`,
                    borderRadius: "8px",
                    width: "36px",
                    height: "36px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: mode === "dark" ? `0 0 15px rgba(255, 183, 0, 0.15)` : `0 4px 10px rgba(6, 95, 70, 0.1)`,
                    border: `1.5px solid ${mode === 'dark' ? '#ffb700' : '#fbbf24'}`,
                    flexShrink: 0
                }}>
                    <BankOutlined style={{ fontSize: "18px", color: mode === 'dark' ? '#ffb700' : '#ffffff' }} />
                </div>

                {/* Nama Pesantren */}
                {!collapsed && (
                    <div style={{ 
                        display: "flex", 
                        flexDirection: "column", 
                        lineHeight: "1.1",
                        minWidth: 0,
                    }}>
                        <Text strong style={{ 
                            color: mode === "dark" ? "#ffffff" : token.colorTextHeading,
                            fontSize: "14px", 
                            fontWeight: "900",
                            letterSpacing: "0.02em",
                            textTransform: "uppercase",
                            whiteSpace: "nowrap",
                        }}>
                            AL-HASANAH
                        </Text>
                        <Text style={{ 
                            color: "#ffb700", 
                            fontSize: "10px", 
                            fontWeight: "800",
                            letterSpacing: "0.1em",
                            marginTop: "2px",
                            whiteSpace: "nowrap",
                            opacity: 0.9,
                        }}>
                            MANAGEMENT
                        </Text>
                    </div>
                )}
            </div>
        </div>
    );
};