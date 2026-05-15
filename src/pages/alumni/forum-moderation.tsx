import React, { useEffect, useMemo, useState } from "react";
import {
    Button,
    Card,
    Descriptions,
    Drawer,
    Empty,
    Image,
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
    DeleteOutlined,
    EyeOutlined,
    LockOutlined,
    PushpinFilled,
    PushpinOutlined,
    ReloadOutlined,
    StopOutlined,
    UndoOutlined,
    UnlockOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { supabaseClient } from "../../utility/supabaseClient";

const { Paragraph, Text, Title } = Typography;

type ContentStatus = "published" | "pending_review" | "hidden" | "deleted";
type StatusTab = ContentStatus | "all";
type ModerationTarget = "thread" | "comment";

type ProfileSummary = {
    id: string;
    full_name?: string | null;
    email?: string | null;
};

type ForumAttachment = {
    id: string;
    storage_bucket: string;
    storage_path: string;
    mime_type: string;
    alt_text?: string | null;
};

type ForumThread = {
    id: string;
    author_id: string;
    content: string;
    visibility: string;
    status: ContentStatus;
    is_pinned: boolean;
    is_locked: boolean;
    comment_count: number;
    reaction_count: number;
    created_at: string;
    updated_at: string;
    edited_at?: string | null;
    deleted_at?: string | null;
    repost_of_thread_id?: string | null;
    profiles?: ProfileSummary | ProfileSummary[] | null;
    forum_attachments?: ForumAttachment[] | null;
};

type ForumComment = {
    id: string;
    thread_id: string;
    parent_comment_id?: string | null;
    author_id: string;
    content: string;
    status: ContentStatus;
    reaction_count: number;
    created_at: string;
    updated_at: string;
    edited_at?: string | null;
    deleted_at?: string | null;
    profiles?: ProfileSummary | ProfileSummary[] | null;
    forum_threads?: Pick<ForumThread, "id" | "content" | "profiles"> | Pick<ForumThread, "id" | "content" | "profiles">[] | null;
    forum_attachments?: ForumAttachment[] | null;
};

type ForumStats = {
    alumniPending: number;
    alumniActive: number;
    publishedThreads: number;
    openReports: number;
    pendingContent: number;
};

const threadSelect = `
    id,
    author_id,
    content,
    visibility,
    status,
    is_pinned,
    is_locked,
    comment_count,
    reaction_count,
    created_at,
    updated_at,
    edited_at,
    deleted_at,
    repost_of_thread_id,
    profiles!forum_threads_author_id_fkey(id, full_name, email),
    forum_attachments(id, storage_bucket, storage_path, mime_type, alt_text)
`;

const commentSelect = `
    id,
    thread_id,
    parent_comment_id,
    author_id,
    content,
    status,
    reaction_count,
    created_at,
    updated_at,
    edited_at,
    deleted_at,
    profiles!forum_comments_author_id_fkey(id, full_name, email),
    forum_threads(id, content, profiles!forum_threads_author_id_fkey(id, full_name, email)),
    forum_attachments(id, storage_bucket, storage_path, mime_type, alt_text)
`;

const statusColor: Record<ContentStatus, string> = {
    published: "green",
    pending_review: "gold",
    hidden: "red",
    deleted: "default",
};

const statusLabel: Record<ContentStatus, string> = {
    published: "Published",
    pending_review: "Pending Review",
    hidden: "Hidden",
    deleted: "Deleted",
};

const normalizeOne = <T,>(value?: T | T[] | null): T | null => {
    if (!value) return null;
    return Array.isArray(value) ? value[0] ?? null : value;
};

const getProfileLabel = (profile?: ProfileSummary | null) =>
    profile?.full_name || profile?.email || "Tidak diketahui";

const ellipsisText = (text: string, max = 130) =>
    text.length > max ? `${text.slice(0, max)}...` : text;

export const ForumModerationList = () => {
    const [activeView, setActiveView] = useState<ModerationTarget>("thread");
    const [threadStatus, setThreadStatus] = useState<StatusTab>("published");
    const [commentStatus, setCommentStatus] = useState<StatusTab>("published");
    const [threads, setThreads] = useState<ForumThread[]>([]);
    const [comments, setComments] = useState<ForumComment[]>([]);
    const [selectedThread, setSelectedThread] = useState<ForumThread | null>(null);
    const [selectedComment, setSelectedComment] = useState<ForumComment | null>(null);
    const [searchText, setSearchText] = useState("");
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});
    const [stats, setStats] = useState<ForumStats>({
        alumniPending: 0,
        alumniActive: 0,
        publishedThreads: 0,
        openReports: 0,
        pendingContent: 0,
    });
    const [messageApi, contextHolder] = message.useMessage();

    const activeStatus = activeView === "thread" ? threadStatus : commentStatus;

    const loadThreads = async () => {
        let query = supabaseClient
            .from("forum_threads")
            .select(threadSelect)
            .order("is_pinned", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(300);

        if (threadStatus !== "all") query = query.eq("status", threadStatus);
        const { data, error } = await query;
        if (error) throw error;
        setThreads((data || []) as ForumThread[]);
    };

    const loadComments = async () => {
        let query = supabaseClient
            .from("forum_comments")
            .select(commentSelect)
            .order("created_at", { ascending: false })
            .limit(300);

        if (commentStatus !== "all") query = query.eq("status", commentStatus);
        const { data, error } = await query;
        if (error) throw error;
        setComments((data || []) as ForumComment[]);
    };

    const loadContent = async () => {
        setLoading(true);
        try {
            if (activeView === "thread") await loadThreads();
            else await loadComments();
        } catch (error) {
            const text = error instanceof Error ? error.message : "Gagal memuat moderasi forum.";
            messageApi.error(text);
        } finally {
            setLoading(false);
        }
    };

    const loadStats = async () => {
        try {
            const [
                alumni,
                publishedThreads,
                openReports,
                pendingThreads,
                pendingComments,
            ] = await Promise.all([
                supabaseClient.from("alumni_data").select("id, profiles(is_active)"),
                supabaseClient.from("forum_threads").select("id", { count: "exact", head: true }).eq("status", "published"),
                supabaseClient.from("forum_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
                supabaseClient.from("forum_threads").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
                supabaseClient.from("forum_comments").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
            ]);

            if (alumni.error) throw alumni.error;
            const rows = (alumni.data || []) as Array<{ profiles?: { is_active?: boolean } | { is_active?: boolean }[] | null }>;
            const alumniActive = rows.filter((row) => {
                const profile = normalizeOne(row.profiles);
                return profile?.is_active === true;
            }).length;

            setStats({
                alumniActive,
                alumniPending: rows.length - alumniActive,
                publishedThreads: publishedThreads.count || 0,
                openReports: openReports.count || 0,
                pendingContent: (pendingThreads.count || 0) + (pendingComments.count || 0),
            });
        } catch (error) {
            console.error("Gagal memuat statistik forum alumni:", error);
        }
    };

    useEffect(() => {
        loadContent();
    }, [activeView, threadStatus, commentStatus]);

    useEffect(() => {
        loadStats();
    }, []);

    useEffect(() => {
        const attachments = [
            ...(selectedThread?.forum_attachments || []),
            ...(selectedComment?.forum_attachments || []),
        ].filter((item) => item.storage_path);

        if (attachments.length === 0) {
            setAttachmentUrls({});
            return;
        }

        const bucket = attachments[0].storage_bucket || "forum-media";
        supabaseClient.storage
            .from(bucket)
            .createSignedUrls([...new Set(attachments.map((item) => item.storage_path))], 60 * 15)
            .then(({ data, error }) => {
                if (error) {
                    console.error("Gagal membuat signed URL lampiran forum:", error);
                    return;
                }
                const urls = (data || []).reduce<Record<string, string>>((acc, item) => {
                    if (item.path && item.signedUrl) acc[item.path] = item.signedUrl;
                    return acc;
                }, {});
                setAttachmentUrls(urls);
            });
    }, [selectedThread, selectedComment]);

    const refreshAll = () => {
        loadContent();
        loadStats();
    };

    const getModeratorId = async () => {
        const { data, error } = await supabaseClient.auth.getUser();
        if (error) throw error;
        if (!data.user?.id) throw new Error("Session admin tidak valid.");
        return data.user.id;
    };

    const writeModerationAction = async (
        target: ModerationTarget,
        id: string,
        moderatorId: string,
        action: "hide" | "restore" | "lock" | "unlock" | "pin" | "unpin",
        reason: string,
    ) => {
        const { error } = await supabaseClient.from("forum_moderation_actions").insert({
            moderator_id: moderatorId,
            thread_id: target === "thread" ? id : null,
            comment_id: target === "comment" ? id : null,
            action,
            reason,
        });
        if (error) throw error;
    };

    const updateThread = async (
        record: ForumThread,
        values: Partial<Pick<ForumThread, "status" | "is_pinned" | "is_locked" | "deleted_at">>,
        action: "hide" | "restore" | "lock" | "unlock" | "pin" | "unpin",
        successText: string,
        reason: string,
    ) => {
        setActionLoading(`${action}-${record.id}`);
        try {
            const moderatorId = await getModeratorId();
            const { error } = await supabaseClient.from("forum_threads").update(values).eq("id", record.id);
            if (error) throw error;
            await writeModerationAction("thread", record.id, moderatorId, action, reason);
            messageApi.success(successText);
            setSelectedThread(null);
            refreshAll();
        } catch (error) {
            const text = error instanceof Error ? error.message : "Aksi moderasi posting gagal.";
            messageApi.error(text);
        } finally {
            setActionLoading(null);
        }
    };

    const updateComment = async (
        record: ForumComment,
        values: Partial<Pick<ForumComment, "status" | "deleted_at">>,
        action: "hide" | "restore",
        successText: string,
        reason: string,
    ) => {
        setActionLoading(`${action}-${record.id}`);
        try {
            const moderatorId = await getModeratorId();
            const { error } = await supabaseClient.from("forum_comments").update(values).eq("id", record.id);
            if (error) throw error;
            await writeModerationAction("comment", record.id, moderatorId, action, reason);
            messageApi.success(successText);
            setSelectedComment(null);
            refreshAll();
        } catch (error) {
            const text = error instanceof Error ? error.message : "Aksi moderasi komentar gagal.";
            messageApi.error(text);
        } finally {
            setActionLoading(null);
        }
    };

    const confirmThread = (
        record: ForumThread,
        title: string,
        content: string,
        values: Partial<Pick<ForumThread, "status" | "is_pinned" | "is_locked" | "deleted_at">>,
        action: "hide" | "restore" | "lock" | "unlock" | "pin" | "unpin",
        successText: string,
        reason: string,
        danger = false,
    ) => {
        Modal.confirm({
            title,
            content,
            okText: "Lanjutkan",
            cancelText: "Batal",
            okButtonProps: { danger },
            onOk: () => updateThread(record, values, action, successText, reason),
        });
    };

    const confirmComment = (
        record: ForumComment,
        title: string,
        content: string,
        values: Partial<Pick<ForumComment, "status" | "deleted_at">>,
        action: "hide" | "restore",
        successText: string,
        reason: string,
        danger = false,
    ) => {
        Modal.confirm({
            title,
            content,
            okText: "Lanjutkan",
            cancelText: "Batal",
            okButtonProps: { danger },
            onOk: () => updateComment(record, values, action, successText, reason),
        });
    };

    const filteredThreads = useMemo(() => {
        const query = searchText.trim().toLowerCase();
        if (!query) return threads;
        return threads.filter((record) => {
            const author = normalizeOne(record.profiles);
            return [
                record.content,
                record.status,
                author?.full_name,
                author?.email,
                String(record.comment_count),
                String(record.reaction_count),
            ].join(" ").toLowerCase().includes(query);
        });
    }, [searchText, threads]);

    const filteredComments = useMemo(() => {
        const query = searchText.trim().toLowerCase();
        if (!query) return comments;
        return comments.filter((record) => {
            const author = normalizeOne(record.profiles);
            const thread = normalizeOne(record.forum_threads);
            return [
                record.content,
                record.status,
                thread?.content,
                author?.full_name,
                author?.email,
                String(record.reaction_count),
            ].join(" ").toLowerCase().includes(query);
        });
    }, [comments, searchText]);

    const threadColumns: ColumnsType<ForumThread> = [
        {
            title: "Postingan",
            key: "content",
            render: (_, record) => {
                const author = normalizeOne(record.profiles);
                return (
                    <Space direction="vertical" size={4}>
                        <Space wrap>
                            <Tag color={statusColor[record.status]}>{statusLabel[record.status]}</Tag>
                            {record.is_pinned ? <Tag icon={<PushpinFilled />} color="blue">Pinned</Tag> : null}
                            {record.is_locked ? <Tag icon={<LockOutlined />} color="volcano">Locked</Tag> : null}
                        </Space>
                        <Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0, maxWidth: 520 }}>
                            {record.content}
                        </Paragraph>
                        <Text type="secondary">
                            {getProfileLabel(author)} · {author?.email || "-"}
                        </Text>
                    </Space>
                );
            },
        },
        {
            title: "Interaksi",
            width: 160,
            render: (_, record) => (
                <Space direction="vertical" size={2}>
                    <Text>{record.comment_count} komentar</Text>
                    <Text>{record.reaction_count} reaksi</Text>
                    <Text>{record.forum_attachments?.length || 0} lampiran</Text>
                </Space>
            ),
        },
        {
            title: "Waktu",
            dataIndex: "created_at",
            width: 165,
            render: (value: string) => dayjs(value).format("DD MMM YYYY HH:mm"),
        },
        {
            title: "Aksi",
            key: "actions",
            width: 280,
            render: (_, record) => (
                <Space wrap>
                    <Button icon={<EyeOutlined />} onClick={() => setSelectedThread(record)}>
                        Detail
                    </Button>
                    {record.status === "hidden" || record.status === "deleted" ? (
                        <Button
                            icon={<UndoOutlined />}
                            loading={actionLoading === `restore-${record.id}`}
                            onClick={() => confirmThread(
                                record,
                                "Pulihkan postingan?",
                                "Postingan akan kembali berstatus published.",
                                { status: "published", deleted_at: null },
                                "restore",
                                "Postingan dipulihkan.",
                                "Admin memulihkan postingan.",
                            )}
                        >
                            Restore
                        </Button>
                    ) : (
                        <Button
                            danger
                            icon={<StopOutlined />}
                            loading={actionLoading === `hide-${record.id}`}
                            onClick={() => confirmThread(
                                record,
                                "Sembunyikan postingan?",
                                "Postingan tidak akan tampil di forum alumni.",
                                { status: "hidden" },
                                "hide",
                                "Postingan disembunyikan.",
                                "Admin menyembunyikan postingan.",
                                true,
                            )}
                        >
                            Hide
                        </Button>
                    )}
                </Space>
            ),
        },
    ];

    const commentColumns: ColumnsType<ForumComment> = [
        {
            title: "Komentar",
            key: "content",
            render: (_, record) => {
                const author = normalizeOne(record.profiles);
                const thread = normalizeOne(record.forum_threads);
                return (
                    <Space direction="vertical" size={4}>
                        <Tag color={statusColor[record.status]}>{statusLabel[record.status]}</Tag>
                        <Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0, maxWidth: 520 }}>
                            {record.content}
                        </Paragraph>
                        <Text type="secondary">
                            {getProfileLabel(author)} · thread: {thread ? ellipsisText(thread.content, 80) : "-"}
                        </Text>
                    </Space>
                );
            },
        },
        {
            title: "Interaksi",
            width: 140,
            render: (_, record) => (
                <Space direction="vertical" size={2}>
                    <Text>{record.reaction_count} reaksi</Text>
                    <Text>{record.forum_attachments?.length || 0} lampiran</Text>
                </Space>
            ),
        },
        {
            title: "Waktu",
            dataIndex: "created_at",
            width: 165,
            render: (value: string) => dayjs(value).format("DD MMM YYYY HH:mm"),
        },
        {
            title: "Aksi",
            key: "actions",
            width: 250,
            render: (_, record) => (
                <Space wrap>
                    <Button icon={<EyeOutlined />} onClick={() => setSelectedComment(record)}>
                        Detail
                    </Button>
                    {record.status === "hidden" || record.status === "deleted" ? (
                        <Button
                            icon={<UndoOutlined />}
                            loading={actionLoading === `restore-${record.id}`}
                            onClick={() => confirmComment(
                                record,
                                "Pulihkan komentar?",
                                "Komentar akan kembali berstatus published.",
                                { status: "published", deleted_at: null },
                                "restore",
                                "Komentar dipulihkan.",
                                "Admin memulihkan komentar.",
                            )}
                        >
                            Restore
                        </Button>
                    ) : (
                        <Button
                            danger
                            icon={<StopOutlined />}
                            loading={actionLoading === `hide-${record.id}`}
                            onClick={() => confirmComment(
                                record,
                                "Sembunyikan komentar?",
                                "Komentar tidak akan tampil di forum alumni.",
                                { status: "hidden" },
                                "hide",
                                "Komentar disembunyikan.",
                                "Admin menyembunyikan komentar.",
                                true,
                            )}
                        >
                            Hide
                        </Button>
                    )}
                </Space>
            ),
        },
    ];

    const statusTabs = [
        { key: "published", label: "Published" },
        { key: "pending_review", label: "Pending Review" },
        { key: "hidden", label: "Hidden" },
        { key: "deleted", label: "Deleted" },
        { key: "all", label: "Semua" },
    ];

    const selectedThreadAuthor = normalizeOne(selectedThread?.profiles);
    const selectedCommentAuthor = normalizeOne(selectedComment?.profiles);
    const selectedCommentThread = normalizeOne(selectedComment?.forum_threads);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {contextHolder}

            <div>
                <Title level={3} style={{ marginBottom: 4 }}>Forum Alumni</Title>
                <Text type="secondary">
                    Moderasi posting, komentar, status publish, pin, lock, dan lampiran forum alumni.
                </Text>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 12 }}>
                <Card><Statistic title="Alumni Pending" value={stats.alumniPending} /></Card>
                <Card><Statistic title="Alumni Aktif" value={stats.alumniActive} /></Card>
                <Card><Statistic title="Posting Published" value={stats.publishedThreads} /></Card>
                <Card><Statistic title="Laporan Open" value={stats.openReports} /></Card>
                <Card><Statistic title="Pending Review" value={stats.pendingContent} /></Card>
            </div>

            <Card>
                <Space direction="vertical" size={16} style={{ width: "100%" }}>
                    <Space style={{ width: "100%", justifyContent: "space-between" }} wrap>
                        <Tabs
                            activeKey={activeView}
                            onChange={(key) => setActiveView(key as ModerationTarget)}
                            items={[
                                { key: "thread", label: "Posting Forum" },
                                { key: "comment", label: "Komentar" },
                            ]}
                        />
                        <Space wrap>
                            <Input.Search
                                allowClear
                                placeholder="Cari konten, nama author, email"
                                style={{ width: 320 }}
                                value={searchText}
                                onChange={(event) => setSearchText(event.target.value)}
                            />
                            <Button icon={<ReloadOutlined />} onClick={refreshAll}>
                                Muat ulang
                            </Button>
                        </Space>
                    </Space>

                    <Tabs
                        activeKey={activeStatus}
                        onChange={(key) => {
                            if (activeView === "thread") setThreadStatus(key as StatusTab);
                            else setCommentStatus(key as StatusTab);
                        }}
                        items={statusTabs}
                    />

                    {activeView === "thread" ? (
                        <Table
                            rowKey="id"
                            columns={threadColumns}
                            dataSource={filteredThreads}
                            loading={loading}
                            locale={{ emptyText: <Empty description="Belum ada posting forum" /> }}
                            pagination={{ pageSize: 10, showSizeChanger: true }}
                        />
                    ) : (
                        <Table
                            rowKey="id"
                            columns={commentColumns}
                            dataSource={filteredComments}
                            loading={loading}
                            locale={{ emptyText: <Empty description="Belum ada komentar forum" /> }}
                            pagination={{ pageSize: 10, showSizeChanger: true }}
                        />
                    )}
                </Space>
            </Card>

            <Drawer
                title="Detail Postingan Forum"
                width={720}
                open={Boolean(selectedThread)}
                onClose={() => setSelectedThread(null)}
                extra={selectedThread ? (
                    <Space wrap>
                        <Button
                            icon={selectedThread.is_pinned ? <PushpinOutlined /> : <PushpinFilled />}
                            loading={actionLoading === `${selectedThread.is_pinned ? "unpin" : "pin"}-${selectedThread.id}`}
                            onClick={() => confirmThread(
                                selectedThread,
                                selectedThread.is_pinned ? "Lepas pin postingan?" : "Pin postingan?",
                                selectedThread.is_pinned ? "Postingan tidak lagi diprioritaskan di feed." : "Postingan akan diprioritaskan di feed.",
                                { is_pinned: !selectedThread.is_pinned },
                                selectedThread.is_pinned ? "unpin" : "pin",
                                selectedThread.is_pinned ? "Postingan dilepas dari pin." : "Postingan berhasil dipin.",
                                selectedThread.is_pinned ? "Admin melepas pin postingan." : "Admin melakukan pin postingan.",
                            )}
                        >
                            {selectedThread.is_pinned ? "Unpin" : "Pin"}
                        </Button>
                        <Button
                            icon={selectedThread.is_locked ? <UnlockOutlined /> : <LockOutlined />}
                            loading={actionLoading === `${selectedThread.is_locked ? "unlock" : "lock"}-${selectedThread.id}`}
                            onClick={() => confirmThread(
                                selectedThread,
                                selectedThread.is_locked ? "Buka komentar?" : "Kunci komentar?",
                                selectedThread.is_locked ? "Alumni bisa kembali membalas postingan." : "Alumni tidak bisa menambah komentar baru.",
                                { is_locked: !selectedThread.is_locked },
                                selectedThread.is_locked ? "unlock" : "lock",
                                selectedThread.is_locked ? "Komentar dibuka." : "Komentar dikunci.",
                                selectedThread.is_locked ? "Admin membuka komentar postingan." : "Admin mengunci komentar postingan.",
                            )}
                        >
                            {selectedThread.is_locked ? "Unlock" : "Lock"}
                        </Button>
                    </Space>
                ) : null}
            >
                {selectedThread ? (
                    <Space direction="vertical" size={16} style={{ width: "100%" }}>
                        <Descriptions bordered column={1} size="small">
                            <Descriptions.Item label="Author">
                                {getProfileLabel(selectedThreadAuthor)} ({selectedThreadAuthor?.email || "-"})
                            </Descriptions.Item>
                            <Descriptions.Item label="Status">
                                <Space wrap>
                                    <Tag color={statusColor[selectedThread.status]}>{statusLabel[selectedThread.status]}</Tag>
                                    {selectedThread.is_pinned ? <Tag color="blue">Pinned</Tag> : null}
                                    {selectedThread.is_locked ? <Tag color="volcano">Locked</Tag> : null}
                                </Space>
                            </Descriptions.Item>
                            <Descriptions.Item label="Interaksi">
                                {selectedThread.comment_count} komentar, {selectedThread.reaction_count} reaksi, {selectedThread.forum_attachments?.length || 0} lampiran
                            </Descriptions.Item>
                            <Descriptions.Item label="Waktu">
                                {dayjs(selectedThread.created_at).format("DD MMMM YYYY HH:mm")}
                            </Descriptions.Item>
                            <Descriptions.Item label="Edited/Deleted">
                                {selectedThread.edited_at ? `Edited ${dayjs(selectedThread.edited_at).format("DD MMM YYYY HH:mm")}` : "Belum diedit"}
                                {" / "}
                                {selectedThread.deleted_at ? `Deleted ${dayjs(selectedThread.deleted_at).format("DD MMM YYYY HH:mm")}` : "Belum dihapus"}
                            </Descriptions.Item>
                        </Descriptions>

                        <Card title="Konten">
                            <Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{selectedThread.content}</Paragraph>
                        </Card>

                        {selectedThread.forum_attachments?.length ? (
                            <Card title="Lampiran">
                                <Image.PreviewGroup>
                                    <Space wrap>
                                        {selectedThread.forum_attachments.map((item) => (
                                            <Image
                                                key={item.id}
                                                width={128}
                                                height={128}
                                                style={{ objectFit: "cover", borderRadius: 6 }}
                                                src={attachmentUrls[item.storage_path]}
                                                alt={item.alt_text || "Lampiran forum"}
                                            />
                                        ))}
                                    </Space>
                                </Image.PreviewGroup>
                            </Card>
                        ) : null}

                        <Space wrap>
                            {selectedThread.status === "hidden" || selectedThread.status === "deleted" ? (
                                <Button
                                    icon={<UndoOutlined />}
                                    onClick={() => confirmThread(
                                        selectedThread,
                                        "Pulihkan postingan?",
                                        "Postingan akan kembali terlihat di forum alumni.",
                                        { status: "published", deleted_at: null },
                                        "restore",
                                        "Postingan dipulihkan.",
                                        "Admin memulihkan postingan.",
                                    )}
                                >
                                    Restore
                                </Button>
                            ) : (
                                <Button
                                    danger
                                    icon={<StopOutlined />}
                                    onClick={() => confirmThread(
                                        selectedThread,
                                        "Sembunyikan postingan?",
                                        "Postingan tidak akan tampil di forum alumni.",
                                        { status: "hidden" },
                                        "hide",
                                        "Postingan disembunyikan.",
                                        "Admin menyembunyikan postingan.",
                                        true,
                                    )}
                                >
                                    Hide
                                </Button>
                            )}
                            <Button
                                danger
                                ghost
                                icon={<DeleteOutlined />}
                                onClick={() => confirmThread(
                                    selectedThread,
                                    "Soft delete postingan?",
                                    "Status postingan menjadi deleted dan deleted_at akan diisi.",
                                    { status: "deleted", deleted_at: new Date().toISOString() },
                                    "hide",
                                    "Postingan di-soft delete.",
                                    "Admin melakukan soft delete postingan.",
                                    true,
                                )}
                            >
                                Soft Delete
                            </Button>
                        </Space>
                    </Space>
                ) : null}
            </Drawer>

            <Drawer
                title="Detail Komentar Forum"
                width={680}
                open={Boolean(selectedComment)}
                onClose={() => setSelectedComment(null)}
            >
                {selectedComment ? (
                    <Space direction="vertical" size={16} style={{ width: "100%" }}>
                        <Descriptions bordered column={1} size="small">
                            <Descriptions.Item label="Author">
                                {getProfileLabel(selectedCommentAuthor)} ({selectedCommentAuthor?.email || "-"})
                            </Descriptions.Item>
                            <Descriptions.Item label="Status">
                                <Tag color={statusColor[selectedComment.status]}>{statusLabel[selectedComment.status]}</Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Thread Asal">
                                {selectedCommentThread?.content || "-"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Interaksi">
                                {selectedComment.reaction_count} reaksi, {selectedComment.forum_attachments?.length || 0} lampiran
                            </Descriptions.Item>
                            <Descriptions.Item label="Waktu">
                                {dayjs(selectedComment.created_at).format("DD MMMM YYYY HH:mm")}
                            </Descriptions.Item>
                        </Descriptions>

                        <Card title="Komentar">
                            <Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{selectedComment.content}</Paragraph>
                        </Card>

                        <Space wrap>
                            {selectedComment.status === "hidden" || selectedComment.status === "deleted" ? (
                                <Button
                                    icon={<UndoOutlined />}
                                    onClick={() => confirmComment(
                                        selectedComment,
                                        "Pulihkan komentar?",
                                        "Komentar akan kembali terlihat di forum alumni.",
                                        { status: "published", deleted_at: null },
                                        "restore",
                                        "Komentar dipulihkan.",
                                        "Admin memulihkan komentar.",
                                    )}
                                >
                                    Restore
                                </Button>
                            ) : (
                                <Button
                                    danger
                                    icon={<StopOutlined />}
                                    onClick={() => confirmComment(
                                        selectedComment,
                                        "Sembunyikan komentar?",
                                        "Komentar tidak akan tampil di forum alumni.",
                                        { status: "hidden" },
                                        "hide",
                                        "Komentar disembunyikan.",
                                        "Admin menyembunyikan komentar.",
                                        true,
                                    )}
                                >
                                    Hide
                                </Button>
                            )}
                            <Button
                                danger
                                ghost
                                icon={<DeleteOutlined />}
                                onClick={() => confirmComment(
                                    selectedComment,
                                    "Soft delete komentar?",
                                    "Status komentar menjadi deleted dan deleted_at akan diisi.",
                                    { status: "deleted", deleted_at: new Date().toISOString() },
                                    "hide",
                                    "Komentar di-soft delete.",
                                    "Admin melakukan soft delete komentar.",
                                    true,
                                )}
                            >
                                Soft Delete
                            </Button>
                        </Space>
                    </Space>
                ) : null}
            </Drawer>
        </div>
    );
};
