import React, { useMemo } from "react";
import { Alert, Button, Space } from "antd";
import { useList, useNavigation } from "@refinedev/core";
import { WarningOutlined, MedicineBoxOutlined, WalletOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

export const GlobalCriticalAlert = () => {
    const { push } = useNavigation();

    // Hitung tanggal 7 hari ke belakang
    const sevenDaysAgo = dayjs().subtract(7, 'day').toISOString();

    // 1. MONITOR KEUANGAN (SPP Belum Lunas)
    // Keuangan sebaiknya tetap Global (Hutang lama pun harus ditagih)
    const { data: dataTunggakan } = useList({
        resource: "tagihan_santri",
        filters: [{ field: "status", operator: "ne", value: "LUNAS" }],
        pagination: { mode: "off" },
        meta: { select: "id" } 
    });

    // 2. MONITOR KESEHATAN (Wabah Minggu Ini)
    // Filter: Hanya ambil data 7 hari terakhir
    const { data: dataSakit } = useList({
        resource: "kesehatan_santri",
        filters: [
             // Ambil data yang dibuat setelah tanggal 7 hari lalu
             { field: "created_at", operator: "gte", value: sevenDaysAgo }
        ],
        pagination: { mode: "off" },
        meta: { select: "id" }
    });

    // 3. LOGIKA DETEKSI KRITIS
    const criticalIssues = useMemo(() => {
        const issues = [];
        
        // Rule 1: Keuangan Kritis (> 20 santri nunggak total)
        const totalNunggak = dataTunggakan?.total || 0;
        if (totalNunggak > 20) { 
            issues.push({
                type: 'finance',
                message: `DARURAT KEUANGAN: ${totalNunggak} Santri belum lunas.`,
                action: () => push('/tagihan')
            });
        }

        // Rule 2: Wabah Penyakit Mingguan (> 5 kasus minggu ini)
        const totalSakitMingguIni = dataSakit?.total || 0;
        if (totalSakitMingguIni > 5) {
            issues.push({
                type: 'health',
                message: `PERINGATAN WABAH: ${totalSakitMingguIni} kasus sakit baru minggu ini.`,
                action: () => push('/kesehatan')
            });
        }

        return issues;
    }, [dataTunggakan, dataSakit]);

    if (criticalIssues.length === 0) return null;

    return (
        // UI FIX: Tambah z-index tinggi dan padding agar tidak terpotong
        <div className="fixed top-0 left-0 right-0 z-[99999] flex flex-col shadow-2xl">
            {criticalIssues.map((issue, idx) => (
                <Alert
                    key={idx}
                    message={
                        <div className="flex justify-between items-center w-full px-2">
                            <Space>
                                {issue.type === 'finance' ? <WalletOutlined className="text-xl"/> : <MedicineBoxOutlined className="text-xl"/>}
                                <span className="font-bold uppercase tracking-wider text-sm md:text-base">
                                    {issue.message}
                                </span>
                            </Space>
                            <Button size="small" type="primary" danger onClick={issue.action} className="ml-4 shadow-sm">
                                CEK
                            </Button>
                        </div>
                    }
                    type="error"
                    banner
                    className="animate-pulse-red border-b border-red-900"
                    style={{ 
                        background: '#fee2e2', 
                        color: '#991b1b',
                        padding: '12px 0' // Padding vertikal agar teks lega
                    }}
                />
            ))}
            
            <style>{`
                @keyframes pulse-red {
                    0% { background-color: #fee2e2; }
                    50% { background-color: #fca5a5; }
                    100% { background-color: #fee2e2; }
                }
                .animate-pulse-red {
                    animation: pulse-red 1.5s infinite;
                }
            `}</style>
        </div>
    );
};