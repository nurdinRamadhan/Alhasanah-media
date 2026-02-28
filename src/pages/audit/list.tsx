import React from "react";
import { useTable } from "@refinedev/antd";
import { ProTable, ProColumns } from "@ant-design/pro-components";
import { Tag, Typography, Avatar, Card, Space } from "antd";
import { SafetyCertificateOutlined, UserOutlined, ClockCircleOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { IAuditLog } from "../../types";

const { Text } = Typography;

export const AuditLogList = () => {
    const { tableProps } = useTable<IAuditLog>({
        resource: "audit_logs",
        syncWithLocation: false,
        sorters: { initial: [{ field: "created_at", order: "desc" }] }
    });

    const columns: ProColumns<IAuditLog>[] = [
        {
            title: "Waktu",
            dataIndex: "created_at",
            width: 180,
            render: (val) => (
                <Space>
                    <ClockCircleOutlined className="text-gray-400"/>
                    <span className="text-xs text-gray-600 font-mono">
                        {dayjs(val as string).format("DD/MM/YY HH:mm:ss")}
                    </span>
                </Space>
            )
        },
        {
            title: "Aktor (User)",
            dataIndex: "user_name",
            render: (_, r) => (
                <div className="flex items-center gap-3">
                    <Avatar size="small" style={{backgroundColor: '#6366f1'}} icon={<UserOutlined/>}/>
                    <div className="flex flex-col">
                        <Text strong className="text-xs">{r.user_name}</Text>
                        <Tag className="m-0 text-[10px] w-fit border-0 bg-gray-100">{r.user_role}</Tag>
                    </div>
                </div>
            )
        },
        {
            title: "Aksi",
            dataIndex: "action",
            width: 100,
            render: (val) => {
                let color = 'blue';
                if(val === 'CREATE') color = 'green';
                if(val === 'UPDATE') color = 'orange';
                if(val === 'DELETE') color = 'red';
                if(val === 'LOGIN') color = 'purple';
                return <Tag color={color} className="font-bold">{val}</Tag>
            }
        },
        {
            title: "Target Data",
            dataIndex: "resource",
            render: (val, r) => (
                <span>
                    <span className="font-semibold uppercase">{val}</span> 
                    {r.record_id !== '-' && <span className="text-gray-400 text-xs ml-2">#{r.record_id}</span>}
                </span>
            )
        },
        {
            title: "Detail Perubahan",
            dataIndex: "details",
            width: 300,
            render: (val) => {
                if (!val) return <span className="text-gray-300">-</span>;
                
                // Jika data sudah berbentuk Object (JSON), langsung tampilkan
                if (typeof val === 'object') {
                     return <Text code className="text-[10px] block">{JSON.stringify(val).substring(0, 80)}...</Text>;
                }
                
                // Jika data berbentuk String, tampilkan saja
                return <Text code className="text-[10px] block">{String(val).substring(0, 80)}...</Text>;
            }
        }
    ];

    return (
        <Card bordered={false} className="shadow-sm">
            <ProTable
                {...tableProps}
                columns={columns}
                rowKey="id"
                headerTitle={
                    <Space>
                        <SafetyCertificateOutlined className="text-indigo-600 text-xl"/>
                        <span className="text-lg font-bold">Audit Trail & Keamanan</span>
                    </Space>
                }
                search={false}
                options={{ density: false }}
                pagination={{ pageSize: 20 }}
            />
        </Card>
    );
};