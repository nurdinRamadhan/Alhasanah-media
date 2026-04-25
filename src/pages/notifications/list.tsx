import React from "react";
import { List, useTable, DateField, TagField } from "@refinedev/antd";
import { Table, Space, Tag, Typography } from "antd";
import { BellOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";

const { Text } = Typography;

export const NotificationList = () => {
    const { tableProps } = useTable({
        resource: "notification_queue",
        sorters: [
            {
                field: "created_at",
                order: "desc",
            },
        ],
    });

    return (
        <List 
            title={
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <BellOutlined style={{ color: "#1890ff" }} />
                    <span>Antrean Notifikasi</span>
                </div>
            }
        >
            <Table {...tableProps} rowKey="id">
                <Table.Column 
                    dataIndex="created_at" 
                    title="Waktu" 
                    render={(value) => <DateField value={value} format="DD MMM YYYY HH:mm" />}
                    sorter
                />
                <Table.Column 
                    dataIndex="title" 
                    title="Judul" 
                    render={(value) => <Text strong>{value}</Text>}
                />
                <Table.Column 
                    dataIndex="body" 
                    title="Pesan" 
                    ellipsis
                />
                <Table.Column 
                    dataIndex="status" 
                    title="Status" 
                    render={(value: string) => {
                        let color = "default";
                        let icon = <ClockCircleOutlined />;
                        
                        if (value === "sent") {
                            color = "success";
                            icon = <CheckCircleOutlined />;
                        } else if (value === "failed") {
                            color = "error";
                            icon = <CloseCircleOutlined />;
                        }

                        return (
                            <Tag icon={icon} color={color}>
                                {value?.toUpperCase()}
                            </Tag>
                        );
                    }}
                    filters={[
                        { text: "Pending", value: "pending" },
                        { text: "Sent", value: "sent" },
                        { text: "Failed", value: "failed" },
                    ]}
                />
                <Table.Column 
                    dataIndex="source_table" 
                    title="Sumber" 
                    render={(value) => <Tag>{value || "manual"}</Tag>}
                />
            </Table>
        </List>
    );
};
