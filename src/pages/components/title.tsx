import React from "react";
import { Typography, theme } from "antd"; // Import theme dari antd
import { BankOutlined } from "@ant-design/icons";

const { Text } = Typography;
const { useToken } = theme; // Hook untuk mengambil token warna aktif

export const Title: React.FC<{ collapsed: boolean }> = ({ collapsed }) => {
    const { token } = useToken(); // Ambil token tema saat ini

    return (
        <div style={{ 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            height: "50px",
            gap: "10px"
        }}>
            {/* Logo Icon */}
            <div style={{
                background: token.colorBgContainer, // Background ikon menyesuaikan tema (Putih/Gelap)
                borderRadius: "6px",
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 5px rgba(0,0,0,0.1)" // Sedikit bayangan agar pop
            }}>
                <BankOutlined style={{ fontSize: "20px", color: "#059669" }} />
            </div>

            {/* Nama Pesantren (Hilang jika sidebar collapsed) */}
            {!collapsed && (
                <div style={{ display: "flex", flexDirection: "column", lineHeight: "1.2" }}>
                    <Text style={{ 
                        color: token.colorTextHeading, // FIX: Otomatis Hitam/Putih
                        fontSize: "16px", 
                        fontWeight: "700",
                        letterSpacing: "0.5px"
                    }}>
                        AL-HASANAH MEDIA
                    </Text>
                    <Text style={{ 
                        color: token.colorTextSecondary, // FIX: Otomatis Abu gelap/Abu terang
                        fontSize: "10px", 
                        fontWeight: "400" 
                    }}>
                        Admin Panel
                    </Text>
                </div>
            )}
        </div>
    );
};