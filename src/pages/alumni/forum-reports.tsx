import React, { useEffect, useMemo, useState } from "react";
import {
    Button,
    Card,
    Descriptions,
    Drawer,
    Empty,
    Input,
    Modal,
    Space,
    Statistic,
    Table,
    Tabs,
    Tag,
    Typography,
    message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
    CheckCircleOutlined,
    CloseCircleOutlined,
    EyeOutlined,
    ReloadOutlined,
    SafetyCertificateOutlined,
    StopOutlined,
    UndoOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { supabaseClient } from "../../utility/supabaseClient";

const { Paragraph, Text, Title } = Typography;

type ReportStatus = "open" | "reviewing" | "resolved" | "rejected" | "all";
type ContentStatus = "published" | "pending_review" | "hidden" | "deleted";

type ProfileSummary = {
    id?: string;
    full_name?: string | null;
    email?: string | null;
};

type ForumThreadSummary = {
    id: string;
    author_id: string;
    content: string;
    status: ContentStatus;
    created_at: string;
    profiles?: ProfileSummary | ProfileSummary[] | null;
};

type ForumCommentSummary = {
    id: string;
    thread_id: string;
    author_id: string;
    content: string;
    status: ContentStatus;
    created_at: string;
    profiles?: ProfileSummary | ProfileSummary[] | null;
};

type ForumReport = {
    id: string;
    reporter_id: string;
    thread_id?: string | null;
    comment_id?: string | null;
    reason: string;
    note?: string | null;
    status: Exclude<ReportStatus, "all">;
    reviewed_by?: string | null;
    reviewed_at?: string | null;
    created_at: string;
    reporter?: ProfileSummary | ProfileSummary[] | null;
    reviewer?: ProfileSummary | ProfileSummary[] | null;
    forum_threads?: ForumThreadSummary | ForumThreadSummary[] | null;
    forum_comments?: ForumCommentSummary | ForumCommentSummary[] | null;
};

type ReportStats = {
    open: number;
    reviewing: number;
    resolved: number;
    rejected: number;
};

const selectFields = `
    id,
    reporter_id,
    thread_id,
    comment_id,
    reason,
    note,
    status,
    reviewed_by,
    reviewed_at,
    created_at,
    reporter:profiles!forum_reports_reporter_id_fkey(id, full_name, email),
    reviewer:profiles!forum_reports_reviewed_by_fkey(id, full_name, email),
    forum_threads(
        id,
        author_id,
        content,
        status,
        created_at,
        profiles!forum_threads_author_id_fkey(id, full_name, email)
    ),
    forum_comments(
        id,
        thread_id,
        author_id,
        content,
        status,
        created_at,
        profiles!forum_comments_author_id_fkey(id, full_name, email)
    )
`;

const statusColor: Record<Exclude<ReportStatus, "all">, string> = {
    open: "red",
    reviewing: "gold",
    resolved: "green",
    rejected: "default",
};

const statusLabel: Record<Exclude<ReportStatus, "all">, string> = {
    open: "Baru",
    reviewing: "Ditinjau",
    resolved: "Selesai",
    rejected: "Ditolak",
};

const reasonLabel: Record<string, string> = {
    spam: "Spam",
    tidak_pantas: "Tidak pantas",
    fitnah: "Fitnah",
    privasi: "Privasi",
    lainnya: "Lainnya",
};

const normalizeOne = <T,>(value?: T | T[] | null): T | null => {
    if (!value) return null;
    return Array.isArray(value) ? value[0] ?? null : value;
};

const getReportedContent = (report: ForumReport) =>
    normalizeOne(report.forum_comments)?.content || normalizeOne(report.forum_threads)?.content || "-";

const getContentStatus = (report: ForumReport) =>
    normalizeOne(report.forum_comments)?.status || normalizeOne(report.forum_threads)?.status || "-";

const getContentAuthor = (report: ForumReport) => {
    const commentAuthor = normalizeOne(normalizeOne(report.forum_comments)?.profiles);
    const threadAuthor = normalizeOne(normalizeOne(report.forum_threads)?.profiles);
    return commentAuthor || threadAuthor;
};

const getProfileLabel = (profile?: ProfileSummary | null) =>
    profile?.full_name || profile?.email || "Tidak diketahui";

const buildReason = (report: ForumReport) => {
    const label = reasonLabel[report.reason] || report.reason;
    return report.note ? `${label}: ${report.note}` : label;
};

export const ForumReportsList = () => {
    const [activeTab, setActiveTab] = useState<ReportStatus>("open");
    const [reports, setReports] = useState<ForumReport[]>([]);
    const [selectedReport, setSelectedReport] = useState<ForumReport | null>(null);
    const [searchText, setSearchText] = useState("");
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [stats, setStats] = useState<ReportStats>({ open: 0, reviewing: 0, resolved: 0, rejected: 0 });
    const [messageApi, contextHolder] = message.useMessage();

    const loadReports = async () => {
        setLoading(true);
        try {
            let query = supabaseClient
                .from("forum_reports")
                .select(selectFields)
                .order("created_at", { ascending: false });

            if (activeTab !== "all") {
                query = query.eq("status", activeTab);
            }

            const { data, error } = await query;
            if (error) throw error;
            setReports((data || []) as ForumReport[]);
        } catch (error) {
            const text = error instanceof Error ? error.message : "Gagal memuat laporan forum.";
            messageApi.error(text);
        } finally {
            setLoading(false);
        }
    };

    const loadStats = async () => {
        const statuses: Exclude<ReportStatus, "all">[] = ["open", "reviewing", "resolved", "rejected"];
        const nextStats: ReportStats = { open: 0, reviewing: 0, resolved: 0, rejected: 0 };

        try {
            await Promise.all(statuses.map(async (status) => {
                const { count, error } = await supabaseClient
                    .from("forum_reports")
                    .select("id", { count: "exact", head: true })
                    .eq("status", status);
                if (error) throw error;
                nextStats[status] = count || 0;
            }));

            setStats(nextStats);
        } catch (error) {
            const text = error instanceof Error ? error.message : "Gagal memuat statistik laporan forum.";
            messageApi.error(text);
        }
    };

    useEffect(() => {
        loadReports();
    }, [activeTab]);

    useEffect(() => {
        loadStats();
    }, []);

    const refreshAll = () => {
        loadReports();
        loadStats();
    };

    const filteredReports = useMemo(() => {
        const query = searchText.trim().toLowerCase();
        if (!query) return reports;

        return reports.filter((report) => {
            const reporter = normalizeOne(report.reporter);
            const author = getContentAuthor(report);
            const haystack = [
                report.reason,
                report.note,
                getReportedContent(report),
                reporter?.full_name,
                reporter?.email,
                author?.full_name,
                author?.email,
            ].join(" ").toLowerCase();
            return haystack.includes(query);
        });
    }, [reports, searchText]);

    const getModeratorId = async () => {
        const { data, error } = await supabaseClient.auth.getUser();
        if (error) throw error;
        if (!data.user?.id) throw new Error("Session admin tidak valid.");
        return data.user.id;
    };

    const writeModerationAction = async (
        report: ForumReport,
        moderatorId: string,
        action: string,
        reason?: string,
    ) => {
        const { error } = await supabaseClient.from("forum_moderation_actions").insert({
            moderator_id: moderatorId,
            thread_id: report.thread_id || null,
            comment_id: report.comment_id || null,
            report_id: report.id,
            action,
            reason: reason || buildReason(report),
        });
        if (error) throw error;
    };

    const updateReportStatus = async (
        report: ForumReport,
        moderatorId: string,
        status: Exclude<ReportStatus, "all">,
    ) => {
        const { error } = await supabaseClient
            .from("forum_reports")
            .update({
                status,
                reviewed_by: moderatorId,
                reviewed_at: new Date().toISOString(),
            })
            .eq("id", report.id);
        if (error) throw error;
    };

    const changeContentStatus = async (report: ForumReport, nextStatus: ContentStatus) => {
        if (report.comment_id) {
            const { error } = await supabaseClient
                .from("forum_comments")
                .update({ status: nextStatus })
                .eq("id", report.comment_id);
            if (error) throw error;
            return;
        }

        if (report.thread_id) {
            const { error } = await supabaseClient
                .from("forum_threads")
                .update({ status: nextStatus })
                .eq("id", report.thread_id);
            if (error) throw error;
            return;
        }

        throw new Error("Laporan tidak memiliki target konten.");
    };

    const runModeration = async (
        report: ForumReport,
        action: "reviewing" | "hide" | "restore" | "resolve" | "reject",
    ) => {
        setActionLoading(`${action}-${report.id}`);
        try {
            const moderatorId = await getModeratorId();

            if (action === "reviewing") {
                await updateReportStatus(report, moderatorId, "reviewing");
                messageApi.success("Laporan ditandai sedang ditinjau.");
            }

            if (action === "hide") {
                await changeContentStatus(report, "hidden");
                await writeModerationAction(report, moderatorId, "hide", "Konten disembunyikan dari forum.");
                await updateReportStatus(report, moderatorId, "resolved");
                messageApi.success("Konten disembunyikan dan laporan diselesaikan.");
            }

            if (action === "restore") {
                await changeContentStatus(report, "published");
                await writeModerationAction(report, moderatorId, "restore", "Konten dipulihkan ke forum.");
                await updateReportStatus(report, moderatorId, "resolved");
                messageApi.success("Konten dipulihkan.");
            }

            if (action === "resolve") {
                await writeModerationAction(report, moderatorId, "resolve_report", "Laporan ditandai selesai tanpa menyembunyikan konten.");
                await updateReportStatus(report, moderatorId, "resolved");
                messageApi.success("Laporan ditandai selesai.");
            }

            if (action === "reject") {
                await writeModerationAction(report, moderatorId, "reject_report", "Laporan ditolak setelah peninjauan.");
                await updateReportStatus(report, moderatorId, "rejected");
                messageApi.success("Laporan ditolak.");
            }

            setSelectedReport(null);
            refreshAll();
        } catch (error) {
            const text = error instanceof Error ? error.message : "Aksi moderasi gagal.";
            messageApi.error(text);
        } finally {
            setActionLoading(null);
        }
    };

    const confirmAction = (
        report: ForumReport,
        action: "reviewing" | "hide" | "restore" | "resolve" | "reject",
        title: string,
        content: string,
        danger = false,
    ) => {
        Modal.confirm({
            title,
            content,
            okText: "Lanjutkan",
            cancelText: "Batal",
            okButtonProps: { danger },
            onOk: () => runModeration(report, action),
        });
    };

    const columns: ColumnsType<ForumReport> = [
        {
            title: "Konten Dilaporkan",
            key: "content",
            render: (_, record) => {
                const content = getReportedContent(record);
                const author = getContentAuthor(record);
                return (
                    <Space direction="vertical" size={4}>
                        <Space wrap>
                            <Tag color={record.comment_id ? "blue" : "purple"}>
                                {record.comment_id ? "Komentar" : "Postingan"}
                            </Tag>
                            <Tag>{getContentStatus(record)}</Tag>
                        </Space>
                        <Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0, maxWidth: 440 }}>
                            {content}
                        </Paragraph>
                        <Text type="secondary">Penulis: {getProfileLabel(author)}</Text>
                    </Space>
                );
            },
        },
        {
            title: "Pelapor",
            key: "reporter",
            width: 220,
            render: (_, record) => {
                const reporter = normalizeOne(record.reporter);
                return (
                    <Space direction="vertical" size={0}>
                        <Text strong>{getProfileLabel(reporter)}</Text>
                        <Text type="secondary">{reporter?.email || "-"}</Text>
                    </Space>
                );
            },
        },
        {
            title: "Alasan",
            key: "reason",
            width: 240,
            render: (_, record) => (
                <Space direction="vertical" size={4}>
                    <Text strong>{reasonLabel[record.reason] || record.reason}</Text>
                    {record.note ? <Text type="secondary">{record.note}</Text> : null}
                </Space>
            ),
        },
        {
            title: "Status",
            dataIndex: "status",
            width: 130,
            render: (status: Exclude<ReportStatus, "all">) => (
                <Tag color={statusColor[status]}>{statusLabel[status]}</Tag>
            ),
        },
        {
            title: "Masuk",
            dataIndex: "created_at",
            width: 160,
            render: (value: string) => dayjs(value).format("DD MMM YYYY HH:mm"),
        },
        {
            title: "Aksi",
            key: "actions",
            width: 250,
            render: (_, record) => {
                const contentStatus = getContentStatus(record);
                const isHidden = contentStatus === "hidden";
                return (
                    <Space wrap>
                        <Button icon={<EyeOutlined />} onClick={() => setSelectedReport(record)}>
                            Detail
                        </Button>
                        {isHidden ? (
                            <Button
                                icon={<UndoOutlined />}
                                loading={actionLoading === `restore-${record.id}`}
                                onClick={() => confirmAction(
                                    record,
                                    "restore",
                                    "Pulihkan konten?",
                                    "Konten akan kembali terlihat di forum alumni.",
                                )}
                            >
                                Pulihkan
                            </Button>
                        ) : (
                            <Button
                                danger
                                icon={<StopOutlined />}
                                loading={actionLoading === `hide-${record.id}`}
                                onClick={() => confirmAction(
                                    record,
                                    "hide",
                                    "Sembunyikan konten?",
                                    "Konten akan disembunyikan dan laporan ditandai selesai.",
                                    true,
                                )}
                            >
                                Sembunyikan
                            </Button>
                        )}
                    </Space>
                );
            },
        },
    ];

    const selectedReporter = normalizeOne(selectedReport?.reporter);
    const selectedAuthor = selectedReport ? getContentAuthor(selectedReport) : null;
    const selectedReviewer = normalizeOne(selectedReport?.reviewer);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {contextHolder}

            <div>
                <Title level={3} style={{ marginBottom: 4 }}>
                    Laporan Forum
                </Title>
                <Text type="secondary">
                    Tinjau laporan, sembunyikan konten bermasalah, dan simpan jejak tindakan moderator.
                </Text>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
                <Card>
                    <Statistic title="Laporan Baru" value={stats.open} prefix={<SafetyCertificateOutlined />} valueStyle={{ color: "#cf1322" }} />
                </Card>
                <Card>
                    <Statistic title="Ditinjau" value={stats.reviewing} valueStyle={{ color: "#d48806" }} />
                </Card>
                <Card>
                    <Statistic title="Selesai" value={stats.resolved} valueStyle={{ color: "#3f8600" }} />
                </Card>
                <Card>
                    <Statistic title="Ditolak" value={stats.rejected} />
                </Card>
            </div>

            <Card>
                <Space direction="vertical" size={16} style={{ width: "100%" }}>
                    <Space style={{ width: "100%", justifyContent: "space-between" }} wrap>
                        <Tabs
                            activeKey={activeTab}
                            onChange={(key) => setActiveTab(key as ReportStatus)}
                            items={[
                                { key: "open", label: `Baru (${stats.open})` },
                                { key: "reviewing", label: `Ditinjau (${stats.reviewing})` },
                                { key: "resolved", label: `Selesai (${stats.resolved})` },
                                { key: "rejected", label: `Ditolak (${stats.rejected})` },
                                { key: "all", label: "Semua" },
                            ]}
                        />
                        <Space wrap>
                            <Input.Search
                                allowClear
                                placeholder="Cari konten, pelapor, atau alasan"
                                style={{ width: 320 }}
                                onSearch={setSearchText}
                                onChange={(event) => setSearchText(event.target.value)}
                            />
                            <Button icon={<ReloadOutlined />} onClick={refreshAll}>
                                Muat ulang
                            </Button>
                        </Space>
                    </Space>

                    <Table
                        rowKey="id"
                        columns={columns}
                        dataSource={filteredReports}
                        loading={loading}
                        locale={{ emptyText: <Empty description="Belum ada laporan forum" /> }}
                        pagination={{ pageSize: 10, showSizeChanger: true }}
                    />
                </Space>
            </Card>

            <Drawer
                title="Detail Laporan Forum"
                width={680}
                open={!!selectedReport}
                onClose={() => setSelectedReport(null)}
                extra={selectedReport ? (
                    <Space wrap>
                        <Button
                            icon={<SafetyCertificateOutlined />}
                            loading={actionLoading === `reviewing-${selectedReport.id}`}
                            onClick={() => confirmAction(
                                selectedReport,
                                "reviewing",
                                "Tandai sedang ditinjau?",
                                "Status laporan akan berubah menjadi ditinjau.",
                            )}
                        >
                            Reviewing
                        </Button>
                        <Button
                            icon={<CheckCircleOutlined />}
                            loading={actionLoading === `resolve-${selectedReport.id}`}
                            onClick={() => confirmAction(
                                selectedReport,
                                "resolve",
                                "Selesaikan laporan?",
                                "Laporan akan ditandai selesai tanpa mengubah status konten.",
                            )}
                        >
                            Selesai
                        </Button>
                        <Button
                            icon={<CloseCircleOutlined />}
                            loading={actionLoading === `reject-${selectedReport.id}`}
                            onClick={() => confirmAction(
                                selectedReport,
                                "reject",
                                "Tolak laporan?",
                                "Laporan akan ditandai ditolak setelah peninjauan.",
                            )}
                        >
                            Tolak
                        </Button>
                    </Space>
                ) : null}
            >
                {selectedReport ? (
                    <Space direction="vertical" size={16} style={{ width: "100%" }}>
                        <Descriptions bordered column={1} size="small">
                            <Descriptions.Item label="Status Laporan">
                                <Tag color={statusColor[selectedReport.status]}>{statusLabel[selectedReport.status]}</Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Jenis Konten">
                                {selectedReport.comment_id ? "Komentar" : "Postingan"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Status Konten">
                                <Tag>{getContentStatus(selectedReport)}</Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Pelapor">
                                {getProfileLabel(selectedReporter)} ({selectedReporter?.email || "-"})
                            </Descriptions.Item>
                            <Descriptions.Item label="Penulis Konten">
                                {getProfileLabel(selectedAuthor)} ({selectedAuthor?.email || "-"})
                            </Descriptions.Item>
                            <Descriptions.Item label="Alasan">
                                {reasonLabel[selectedReport.reason] || selectedReport.reason}
                            </Descriptions.Item>
                            <Descriptions.Item label="Catatan">
                                {selectedReport.note || "-"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Waktu Laporan">
                                {dayjs(selectedReport.created_at).format("DD MMMM YYYY HH:mm")}
                            </Descriptions.Item>
                            <Descriptions.Item label="Ditinjau Oleh">
                                {selectedReviewer ? `${getProfileLabel(selectedReviewer)} (${selectedReviewer.email || "-"})` : "-"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Waktu Tinjauan">
                                {selectedReport.reviewed_at ? dayjs(selectedReport.reviewed_at).format("DD MMMM YYYY HH:mm") : "-"}
                            </Descriptions.Item>
                        </Descriptions>

                        <Card title="Konten">
                            <Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>
                                {getReportedContent(selectedReport)}
                            </Paragraph>
                        </Card>

                        <Space wrap>
                            {getContentStatus(selectedReport) === "hidden" ? (
                                <Button
                                    icon={<UndoOutlined />}
                                    loading={actionLoading === `restore-${selectedReport.id}`}
                                    onClick={() => confirmAction(
                                        selectedReport,
                                        "restore",
                                        "Pulihkan konten?",
                                        "Konten akan kembali terlihat di forum alumni.",
                                    )}
                                >
                                    Pulihkan Konten
                                </Button>
                            ) : (
                                <Button
                                    danger
                                    icon={<StopOutlined />}
                                    loading={actionLoading === `hide-${selectedReport.id}`}
                                    onClick={() => confirmAction(
                                        selectedReport,
                                        "hide",
                                        "Sembunyikan konten?",
                                        "Konten akan disembunyikan dan laporan ditandai selesai.",
                                        true,
                                    )}
                                >
                                    Sembunyikan Konten
                                </Button>
                            )}
                        </Space>
                    </Space>
                ) : null}
            </Drawer>
        </div>
    );
};
