import React, { useEffect, useMemo, useState } from "react";
import { useTable } from "@refinedev/antd";
import { ProColumns, ProTable } from "@ant-design/pro-components";
import {
    Avatar,
    Button,
    Card,
    Descriptions,
    Drawer,
    Empty,
    Form,
    Input,
    Modal,
    Space,
    Statistic,
    Switch,
    Tabs,
    Tag,
    Typography,
    message,
} from "antd";
import {
    CheckCircleOutlined,
    CloseCircleOutlined,
    DeleteOutlined,
    EditOutlined,
    EyeOutlined,
    FileExcelOutlined,
    GlobalOutlined,
    PhoneOutlined,
    ReloadOutlined,
    StopOutlined,
    TeamOutlined,
    UserOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { IAlumniData } from "../../types";
import { formatHijri } from "../../utility/dateHelper";
import { supabaseClient } from "../../utility/supabaseClient";

const { Text, Title } = Typography;

type AlumniTab = "pending" | "active" | "all";

type AlumniStats = {
    pending: number;
    active: number;
    total: number;
    follows: number;
};

type AlumniStatsRow = {
    id: string;
    profiles?: { is_active?: boolean } | { is_active?: boolean }[] | null;
};

type AlumniProfileFormValues = {
    full_name: string;
    tahun_lulus: number;
    no_wa?: string;
    profesi_sekarang?: string;
    instansi_kerja?: string;
    alamat_domisili?: string;
    bio?: string;
    show_whatsapp: boolean;
    show_profession: boolean;
    show_location: boolean;
    forum_notify_replies: boolean;
    forum_notify_reactions: boolean;
};

type FollowCounts = {
    followers: number;
    following: number;
};

const tabToActiveValue = (tab: AlumniTab) => {
    if (tab === "pending") return false;
    if (tab === "active") return true;
    return undefined;
};

const getProfileActive = (record?: IAlumniData) => record?.profiles?.is_active === true;

const buildWaLink = (phone?: string) => {
    if (!phone) return undefined;
    const normalized = phone.replace(/[^\d]/g, "");
    if (!normalized) return undefined;
    const international = normalized.startsWith("0")
        ? `62${normalized.slice(1)}`
        : normalized;
    return `https://wa.me/${international}`;
};

const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) return error.message;
    if (error && typeof error === "object") {
        const messageText = (error as { message?: unknown }).message;
        if (typeof messageText === "string" && messageText.trim()) return messageText;
    }
    return fallback;
};

export const AlumniList = () => {
    const [form] = Form.useForm<AlumniProfileFormValues>();
    const [activeTab, setActiveTab] = useState<AlumniTab>("pending");
    const [selectedAlumni, setSelectedAlumni] = useState<IAlumniData | null>(null);
    const [editingAlumni, setEditingAlumni] = useState<IAlumniData | null>(null);
    const [searchText, setSearchText] = useState("");
    const [stats, setStats] = useState<AlumniStats>({ pending: 0, active: 0, total: 0, follows: 0 });
    const [statsLoading, setStatsLoading] = useState(false);
    const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});
    const [followCounts, setFollowCounts] = useState<Record<string, FollowCounts>>({});
    const [isSavingProfile, setIsSavingProfile] = useState(false);

    const { tableProps, tableQueryResult, setFilters } = useTable<IAlumniData>({
        resource: "alumni_data",
        syncWithLocation: true,
        meta: { select: "*, profiles(*)" },
        filters: {
            initial: [
                { field: "profiles.is_active", operator: "eq", value: false },
            ],
        },
        sorters: { initial: [{ field: "created_at", order: "desc" }] },
    });

    const records = useMemo(() => tableProps.dataSource || [], [tableProps.dataSource]);

    const filteredRecords = useMemo(() => {
        const query = searchText.trim().toLowerCase();
        if (!query) return records;
        return records.filter((item) => {
            const social = followCounts[item.id];
            const haystack = [
                item.full_name,
                item.profiles?.email,
                item.no_wa,
                item.profesi_sekarang,
                item.instansi_kerja,
                item.alamat_domisili,
                item.province_name,
                item.regency_name,
                item.district_name,
                item.village_name,
                item.bio,
                String(item.tahun_lulus || ""),
                String(social?.followers || ""),
                String(social?.following || ""),
            ].join(" ").toLowerCase();
            return haystack.includes(query);
        });
    }, [followCounts, records, searchText]);

    useEffect(() => {
        const paths = records
            .map((item) => item.avatar_storage_path)
            .filter((path): path is string => Boolean(path));

        if (paths.length === 0) {
            setAvatarUrls({});
            return;
        }

        supabaseClient.storage
            .from("alumni-avatars")
            .createSignedUrls([...new Set(paths)], 60 * 60 * 6)
            .then(({ data, error }) => {
                if (error) {
                    console.error("Gagal membuat signed URL avatar alumni:", error);
                    return;
                }
                const nextUrls = (data || []).reduce<Record<string, string>>((acc, item) => {
                    if (item.path && item.signedUrl) acc[item.path] = item.signedUrl;
                    return acc;
                }, {});
                setAvatarUrls(nextUrls);
            });
    }, [records]);

    useEffect(() => {
        const ids = records.map((item) => item.id);
        if (ids.length === 0) {
            setFollowCounts({});
            return;
        }

        let cancelled = false;
        const loadFollowCounts = async () => {
            const [followersResult, followingResult] = await Promise.all([
                supabaseClient
                    .from("alumni_follows")
                    .select("following_id")
                    .in("following_id", ids),
                supabaseClient
                    .from("alumni_follows")
                    .select("follower_id")
                    .in("follower_id", ids),
            ]);

            if (cancelled) return;
            if (followersResult.error || followingResult.error) {
                console.error("Gagal memuat statistik follow alumni:", followersResult.error || followingResult.error);
                return;
            }

            const nextCounts = ids.reduce<Record<string, FollowCounts>>((acc, id) => {
                acc[id] = { followers: 0, following: 0 };
                return acc;
            }, {});

            (followersResult.data || []).forEach((row) => {
                const id = row.following_id as string;
                if (nextCounts[id]) nextCounts[id].followers += 1;
            });
            (followingResult.data || []).forEach((row) => {
                const id = row.follower_id as string;
                if (nextCounts[id]) nextCounts[id].following += 1;
            });
            setFollowCounts(nextCounts);
        };

        loadFollowCounts();
        return () => {
            cancelled = true;
        };
    }, [records]);

    const refreshAll = () => {
        tableQueryResult.refetch();
        loadStats();
    };

    const getAvatarSrc = (record?: IAlumniData | null) => {
        if (!record) return undefined;
        return record.avatar_storage_path ? avatarUrls[record.avatar_storage_path] : record.profiles?.foto_url;
    };

    const applyTabFilter = (tab: AlumniTab) => {
        const isActive = tabToActiveValue(tab);
        setActiveTab(tab);
        setFilters(
            isActive === undefined
                ? []
                : [{ field: "profiles.is_active", operator: "eq", value: isActive }],
            "replace",
        );
    };

    const loadStats = async () => {
        setStatsLoading(true);
        try {
            const [alumniResult, followsResult] = await Promise.all([
                supabaseClient
                    .from("alumni_data")
                    .select("id, profiles(is_active)"),
                supabaseClient
                    .from("alumni_follows")
                    .select("follower_id", { count: "exact", head: true }),
            ]);

            const { data, error } = alumniResult;
            if (error) throw error;

            const alumni = (data || []) as unknown as AlumniStatsRow[];
            const active = alumni.filter((item) => {
                const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
                return profile?.is_active === true;
            }).length;
            setStats({
                active,
                pending: alumni.length - active,
                total: alumni.length,
                follows: followsResult.count || 0,
            });
        } catch (error) {
            console.error("Gagal memuat statistik alumni:", error);
        } finally {
            setStatsLoading(false);
        }
    };

    useEffect(() => {
        loadStats();
    }, []);

    const updateAlumniAccessProfile = async (
        record: IAlumniData,
        values: { full_name?: string; is_active?: boolean },
    ) => {
        const { error } = await supabaseClient.rpc("update_alumni_admin_profile", {
            p_alumni_id: record.id,
            p_full_name: values.full_name ?? null,
            p_is_active: values.is_active ?? null,
        });
        if (error) throw error;
    };

    const handleVerify = (record: IAlumniData) => {
        Modal.confirm({
            title: "Konfirmasi Verifikasi Alumni",
            content: (
                <div className="space-y-2">
                    <Text>
                        Verifikasi akun alumni <Text strong>{record.full_name}</Text>?
                    </Text>
                    <div>
                        <Text type="secondary">
                            Setelah aktif, alumni dapat login dan mengakses Forum Alumni.
                        </Text>
                    </div>
                </div>
            ),
            okText: "Verifikasi",
            cancelText: "Batal",
            okButtonProps: { className: "bg-emerald-600" },
            onOk: async () => {
                try {
                    await updateAlumniAccessProfile(record, { full_name: record.full_name, is_active: true });
                    message.success("Akses Forum Alumni telah dibuka.");
                    refreshAll();
                } catch (error) {
                    const text = getErrorMessage(error, "Gagal memverifikasi alumni.");
                    message.error(text);
                    throw error;
                }
            },
        });
    };

    const handleDeactivate = (record: IAlumniData) => {
        Modal.confirm({
            title: "Nonaktifkan Akses Alumni",
            content: (
                <div className="space-y-2">
                    <Text>
                        Nonaktifkan akses Forum Alumni untuk <Text strong>{record.full_name}</Text>?
                    </Text>
                    <div>
                        <Text type="secondary">
                            Akun tetap tersimpan, tetapi tidak bisa membuka forum sampai diverifikasi ulang.
                        </Text>
                    </div>
                </div>
            ),
            okText: "Nonaktifkan",
            cancelText: "Batal",
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    await updateAlumniAccessProfile(record, { is_active: false });
                    message.success("Akses alumni telah dinonaktifkan.");
                    refreshAll();
                } catch (error) {
                    const text = getErrorMessage(error, "Gagal menonaktifkan alumni.");
                    message.error(text);
                    throw error;
                }
            },
        });
    };

    const openEditProfile = (record: IAlumniData) => {
        setEditingAlumni(record);
        form.setFieldsValue({
            full_name: record.full_name,
            tahun_lulus: record.tahun_lulus,
            no_wa: record.no_wa,
            profesi_sekarang: record.profesi_sekarang,
            instansi_kerja: record.instansi_kerja,
            alamat_domisili: record.alamat_domisili,
            bio: record.bio || undefined,
            show_whatsapp: record.show_whatsapp ?? false,
            show_profession: record.show_profession ?? true,
            show_location: record.show_location ?? true,
            forum_notify_replies: record.forum_notify_replies ?? true,
            forum_notify_reactions: record.forum_notify_reactions ?? true,
        });
    };

    const handleSaveProfile = async () => {
        if (!editingAlumni) return;
        setIsSavingProfile(true);
        try {
            const values = await form.validateFields();
            const payload = {
                full_name: values.full_name.trim(),
                tahun_lulus: Number(values.tahun_lulus),
                no_wa: values.no_wa?.trim() || null,
                profesi_sekarang: values.profesi_sekarang?.trim() || null,
                instansi_kerja: values.instansi_kerja?.trim() || null,
                alamat_domisili: values.alamat_domisili?.trim() || null,
                bio: values.bio?.trim() || null,
                show_whatsapp: values.show_whatsapp,
                show_profession: values.show_profession,
                show_location: values.show_location,
                forum_notify_replies: values.forum_notify_replies,
                forum_notify_reactions: values.forum_notify_reactions,
            };

            const { error: alumniError } = await supabaseClient
                .from("alumni_data")
                .update(payload)
                .eq("id", editingAlumni.id);
            if (alumniError) throw alumniError;

            await updateAlumniAccessProfile(editingAlumni, { full_name: payload.full_name });

            message.success("Profil alumni berhasil diperbarui.");
            setEditingAlumni(null);
            refreshAll();
        } catch (error) {
            const text = getErrorMessage(error, "Gagal menyimpan profil alumni.");
            message.error(text);
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handleResetAvatar = (record: IAlumniData) => {
        Modal.confirm({
            title: "Reset Foto Profil Alumni",
            content: `Hapus foto profil publik milik ${record.full_name}? File lama di Storage tidak dihapus, tetapi tidak lagi dipakai di profil.`,
            okText: "Reset Foto",
            cancelText: "Batal",
            okButtonProps: { danger: true },
            onOk: async () => {
                const { error } = await supabaseClient
                    .from("alumni_data")
                    .update({ avatar_storage_path: null })
                    .eq("id", record.id);
                if (error) {
                    message.error(error.message);
                    return;
                }
                message.success("Foto profil alumni direset.");
                refreshAll();
            },
        });
    };

    const exportExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Database Alumni");
        worksheet.columns = [
            { header: "Nama Lengkap", key: "nama", width: 30 },
            { header: "Email", key: "email", width: 32 },
            { header: "Angkatan/Lulus", key: "lulus", width: 16 },
            { header: "WhatsApp", key: "wa", width: 18 },
            { header: "Profesi", key: "profesi", width: 24 },
            { header: "Instansi", key: "instansi", width: 26 },
            { header: "Domisili", key: "domisili", width: 36 },
            { header: "Bio", key: "bio", width: 42 },
            { header: "Tampilkan WhatsApp", key: "show_wa", width: 18 },
            { header: "Tampilkan Profesi", key: "show_profesi", width: 18 },
            { header: "Tampilkan Domisili", key: "show_domisili", width: 18 },
            { header: "Status Akun", key: "status", width: 16 },
            { header: "Followers", key: "followers", width: 12 },
            { header: "Following", key: "following", width: 12 },
            { header: "Tanggal Daftar", key: "tanggal", width: 18 },
        ];

        filteredRecords.forEach((item) => {
            worksheet.addRow({
                nama: item.full_name,
                email: item.profiles?.email || "-",
                lulus: item.tahun_lulus,
                wa: item.no_wa || "-",
                profesi: item.profesi_sekarang || "-",
                instansi: item.instansi_kerja || "-",
                domisili: item.alamat_domisili || "-",
                bio: item.bio || "-",
                show_wa: item.show_whatsapp ? "YA" : "TIDAK",
                show_profesi: item.show_profession ? "YA" : "TIDAK",
                show_domisili: item.show_location ? "YA" : "TIDAK",
                status: getProfileActive(item) ? "AKTIF" : "PENDING",
                followers: followCounts[item.id]?.followers || 0,
                following: followCounts[item.id]?.following || 0,
                tanggal: item.created_at ? dayjs(item.created_at).format("YYYY-MM-DD") : "-",
            });
        });

        worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
        worksheet.getRow(1).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF059669" },
        };

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Data_Alumni_${activeTab}_${dayjs().format("YYYY-MM-DD")}.xlsx`);
    };

    const columns: ProColumns<IAlumniData>[] = [
        {
            title: "Data Alumni",
            dataIndex: "full_name",
            render: (_, record) => {
                const active = getProfileActive(record);
                return (
                    <div className="flex items-center gap-3">
                        <Avatar
                            size="large"
                            src={getAvatarSrc(record)}
                            icon={<UserOutlined />}
                            className={active ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}
                        />
                        <div className="flex flex-col min-w-0">
                            <Space size={6} wrap>
                                <Text strong className="truncate">{record.full_name}</Text>
                                {active ? (
                                    <Tag color="success" className="m-0">Aktif</Tag>
                                ) : (
                                    <Tag color="warning" className="m-0">Pending</Tag>
                                )}
                            </Space>
                            <Text type="secondary" className="text-xs">{record.profiles?.email || "-"}</Text>
                            <Space className="mt-1" size={6} wrap>
                                <Tag bordered={false} className="m-0 bg-emerald-50 text-emerald-700 font-semibold">
                                    Angkatan {record.tahun_lulus}
                                </Tag>
                                {record.no_wa ? (
                                    <Tag icon={<PhoneOutlined />} bordered={false} className="m-0">
                                        {record.no_wa}
                                    </Tag>
                                ) : null}
                                {record.bio ? (
                                    <Tag bordered={false} className="m-0 bg-blue-50 text-blue-700">
                                        Profil publik
                                    </Tag>
                                ) : null}
                            </Space>
                        </div>
                    </div>
                );
            },
        },
        {
            title: "Karier & Domisili",
            render: (_, record) => (
                <div className="flex flex-col">
                    <Text strong className="text-sm">{record.profesi_sekarang || "-"}</Text>
                    <Text type="secondary" className="text-xs">{record.instansi_kerja || "-"}</Text>
                    <Text type="secondary" className="mt-1 text-xs">
                        {record.alamat_domisili || "Domisili belum diisi"}
                    </Text>
                </div>
            ),
        },
        {
            title: "Jejaring",
            width: 150,
            render: (_, record) => {
                const social = followCounts[record.id] || { followers: 0, following: 0 };
                return (
                    <Space direction="vertical" size={2}>
                        <Tag icon={<TeamOutlined />} color="processing" className="m-0">
                            {social.followers} followers
                        </Tag>
                        <Tag color="default" className="m-0">
                            {social.following} following
                        </Tag>
                    </Space>
                );
            },
        },
        {
            title: "Tanggal Daftar",
            dataIndex: "created_at",
            width: 150,
            render: (value) => (
                <div className="flex flex-col">
                    <Text className="text-xs">
                        {value ? dayjs(value as string).format("DD MMM YYYY") : "-"}
                    </Text>
                    {value ? (
                        <Text type="secondary" style={{ fontSize: 10 }}>
                            {formatHijri(value as string)}
                        </Text>
                    ) : null}
                </div>
            ),
        },
        {
            title: "Kelengkapan",
            width: 135,
            render: (_, record) => {
                const complete = Boolean(
                    record.full_name &&
                    record.tahun_lulus &&
                    record.no_wa &&
                    record.profesi_sekarang &&
                    record.alamat_domisili &&
                    record.bio,
                );
                return complete ? (
                    <Tag color="success" icon={<CheckCircleOutlined />}>Lengkap</Tag>
                ) : (
                    <Tag color="default" icon={<CloseCircleOutlined />}>Perlu Cek</Tag>
                );
            },
        },
        {
            title: "Aksi",
            valueType: "option",
            width: 210,
            fixed: "right",
            render: (_, record) => {
                const active = getProfileActive(record);
                return [
                    <Button
                        key="detail"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => setSelectedAlumni(record)}
                    >
                        Detail
                    </Button>,
                    <Button
                        key="edit"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => openEditProfile(record)}
                    >
                        Edit
                    </Button>,
                    active ? (
                        <Button
                            key="suspend"
                            size="small"
                            danger
                            ghost
                            icon={<StopOutlined />}
                            onClick={() => handleDeactivate(record)}
                        >
                            Suspend
                        </Button>
                    ) : (
                        <Button
                            key="verify"
                            size="small"
                            type="primary"
                            className="bg-emerald-600"
                            icon={<CheckCircleOutlined />}
                            onClick={() => handleVerify(record)}
                        >
                            Verifikasi
                        </Button>
                    ),
                ];
            },
        },
    ];

    const selectedWaLink = buildWaLink(selectedAlumni?.no_wa);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Card size="small" className="rounded-xl">
                    <Statistic title="Menunggu Verifikasi" value={stats.pending} loading={statsLoading} />
                </Card>
                <Card size="small" className="rounded-xl">
                    <Statistic title="Alumni Aktif" value={stats.active} loading={statsLoading} />
                </Card>
                <Card size="small" className="rounded-xl">
                    <Statistic title="Total Database Alumni" value={stats.total} loading={statsLoading} />
                </Card>
                <Card size="small" className="rounded-xl">
                    <Statistic title="Total Follow" value={stats.follows} loading={statsLoading} prefix={<TeamOutlined />} />
                </Card>
            </div>

            <div className="bg-white dark:bg-[#141414] p-2 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
                <Tabs
                    activeKey={activeTab}
                    onChange={(key) => applyTabFilter(key as AlumniTab)}
                    className="px-4"
                    items={[
                        { label: `Menunggu Verifikasi (${stats.pending})`, key: "pending" },
                        { label: `Alumni Aktif (${stats.active})`, key: "active" },
                        { label: `Semua (${stats.total})`, key: "all" },
                    ]}
                />
            </div>

            <ProTable<IAlumniData>
                {...tableProps}
                dataSource={filteredRecords}
                columns={columns}
                rowKey="id"
                headerTitle={
                    <Space>
                        <GlobalOutlined className="text-emerald-600 text-xl" />
                        <div className="flex flex-col">
                            <Text strong>Manajemen Alumni</Text>
                            <Text type="secondary" style={{ fontSize: 10 }}>
                                Verifikasi pendaftaran dan akses Forum Alumni
                            </Text>
                        </div>
                    </Space>
                }
                toolBarRender={() => [
                    <Input.Search
                        key="search"
                        allowClear
                        placeholder="Cari nama, email, angkatan, profesi, follow..."
                        value={searchText}
                        onChange={(event) => setSearchText(event.target.value)}
                        style={{ width: 320 }}
                    />,
                    <Button key="reload" icon={<ReloadOutlined />} onClick={refreshAll}>
                        Muat Ulang
                    </Button>,
                    <Button key="export" icon={<FileExcelOutlined />} onClick={exportExcel}>
                        Export Excel
                    </Button>,
                ]}
                search={false}
                pagination={{ defaultPageSize: 10, showSizeChanger: true }}
                locale={{
                    emptyText: (
                        <Empty
                            description={
                                activeTab === "pending"
                                    ? "Belum ada alumni yang menunggu verifikasi."
                                    : "Data alumni belum tersedia."
                            }
                        />
                    ),
                }}
                className="bg-white dark:bg-[#141414] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800"
            />

            <Drawer
                title="Detail Alumni"
                width={520}
                open={Boolean(selectedAlumni)}
                onClose={() => setSelectedAlumni(null)}
                extra={
                    selectedAlumni ? (
                        <Space>
                            <Button icon={<EditOutlined />} onClick={() => openEditProfile(selectedAlumni)}>
                                Edit Profil
                            </Button>
                            {selectedAlumni.avatar_storage_path ? (
                                <Button danger ghost icon={<DeleteOutlined />} onClick={() => handleResetAvatar(selectedAlumni)}>
                                    Reset Foto
                                </Button>
                            ) : null}
                            {getProfileActive(selectedAlumni) ? (
                                <Button danger icon={<StopOutlined />} onClick={() => handleDeactivate(selectedAlumni)}>
                                    Suspend
                                </Button>
                            ) : (
                                <Button
                                    type="primary"
                                    className="bg-emerald-600"
                                    icon={<CheckCircleOutlined />}
                                    onClick={() => handleVerify(selectedAlumni)}
                                >
                                    Verifikasi
                                </Button>
                            )}
                        </Space>
                    ) : null
                }
            >
                {selectedAlumni ? (
                    <div className="space-y-5">
                        <div className="flex items-center gap-3">
                            <Avatar
                                size={56}
                                src={getAvatarSrc(selectedAlumni)}
                                icon={<UserOutlined />}
                                className="bg-emerald-50 text-emerald-700"
                            />
                            <div>
                                <Title level={5} className="!mb-0">{selectedAlumni.full_name}</Title>
                                <Text type="secondary">{selectedAlumni.profiles?.email || "-"}</Text>
                                <div className="mt-1">
                                    {getProfileActive(selectedAlumni) ? (
                                        <Tag color="success">Akses Forum Aktif</Tag>
                                    ) : (
                                        <Tag color="warning">Menunggu Verifikasi</Tag>
                                    )}
                                </div>
                            </div>
                        </div>

                        <Descriptions column={1} bordered size="small">
                            <Descriptions.Item label="Angkatan/Tahun Lulus">
                                {selectedAlumni.tahun_lulus}
                            </Descriptions.Item>
                            <Descriptions.Item label="WhatsApp">
                                {selectedAlumni.no_wa ? (
                                    selectedWaLink ? (
                                        <a href={selectedWaLink} target="_blank" rel="noreferrer">
                                            {selectedAlumni.no_wa}
                                        </a>
                                    ) : selectedAlumni.no_wa
                                ) : "-"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Profesi">
                                {selectedAlumni.profesi_sekarang || "-"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Instansi">
                                {selectedAlumni.instansi_kerja || "-"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Domisili">
                                {selectedAlumni.alamat_domisili || "-"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Wilayah Detail">
                                {[
                                    selectedAlumni.village_name,
                                    selectedAlumni.district_name,
                                    selectedAlumni.regency_name,
                                    selectedAlumni.province_name,
                                ].filter(Boolean).join(", ") || "-"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Jejaring Alumni">
                                <Space wrap>
                                    <Tag icon={<TeamOutlined />} color="processing">
                                        {followCounts[selectedAlumni.id]?.followers || 0} followers
                                    </Tag>
                                    <Tag color="default">
                                        {followCounts[selectedAlumni.id]?.following || 0} following
                                    </Tag>
                                </Space>
                            </Descriptions.Item>
                            <Descriptions.Item label="Bio Profil">
                                {selectedAlumni.bio || "-"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Privasi Profil">
                                <Space wrap>
                                    <Tag color={selectedAlumni.show_whatsapp ? "success" : "default"}>
                                        WA {selectedAlumni.show_whatsapp ? "Tampil" : "Tersembunyi"}
                                    </Tag>
                                    <Tag color={selectedAlumni.show_profession ? "success" : "default"}>
                                        Karier {selectedAlumni.show_profession ? "Tampil" : "Tersembunyi"}
                                    </Tag>
                                    <Tag color={selectedAlumni.show_location ? "success" : "default"}>
                                        Domisili {selectedAlumni.show_location ? "Tampil" : "Tersembunyi"}
                                    </Tag>
                                </Space>
                            </Descriptions.Item>
                            <Descriptions.Item label="Preferensi Forum">
                                <Space wrap>
                                    <Tag color={selectedAlumni.forum_notify_replies ? "processing" : "default"}>
                                        Balasan {selectedAlumni.forum_notify_replies ? "Aktif" : "Nonaktif"}
                                    </Tag>
                                    <Tag color={selectedAlumni.forum_notify_reactions ? "processing" : "default"}>
                                        Dukungan {selectedAlumni.forum_notify_reactions ? "Aktif" : "Nonaktif"}
                                    </Tag>
                                </Space>
                            </Descriptions.Item>
                            <Descriptions.Item label="Tanggal Daftar">
                                {selectedAlumni.created_at
                                    ? `${dayjs(selectedAlumni.created_at).format("DD MMMM YYYY")} / ${formatHijri(selectedAlumni.created_at)}`
                                    : "-"}
                            </Descriptions.Item>
                        </Descriptions>
                    </div>
                ) : null}
            </Drawer>

            <Modal
                title="Edit Profil Alumni"
                width={720}
                open={Boolean(editingAlumni)}
                onCancel={() => setEditingAlumni(null)}
                onOk={handleSaveProfile}
                okText="Simpan"
                cancelText="Batal"
                confirmLoading={isSavingProfile}
            >
                <Form form={form} layout="vertical" className="mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                        <Form.Item
                            label="Nama Lengkap"
                            name="full_name"
                            rules={[{ required: true, message: "Nama wajib diisi." }]}
                        >
                            <Input />
                        </Form.Item>
                        <Form.Item
                            label="Angkatan/Tahun Lulus"
                            name="tahun_lulus"
                            rules={[{ required: true, message: "Tahun lulus wajib diisi." }]}
                        >
                            <Input type="number" />
                        </Form.Item>
                        <Form.Item label="WhatsApp" name="no_wa">
                            <Input />
                        </Form.Item>
                        <Form.Item label="Profesi" name="profesi_sekarang">
                            <Input />
                        </Form.Item>
                        <Form.Item label="Instansi" name="instansi_kerja">
                            <Input />
                        </Form.Item>
                        <Form.Item label="Domisili" name="alamat_domisili">
                            <Input />
                        </Form.Item>
                    </div>
                    <Form.Item
                        label="Bio Profil"
                        name="bio"
                        rules={[{ max: 300, message: "Bio maksimal 300 karakter." }]}
                    >
                        <Input.TextArea rows={3} showCount maxLength={300} />
                    </Form.Item>

                    <Card size="small" title="Privasi Profil" className="mb-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <Form.Item label="Tampilkan WhatsApp" name="show_whatsapp" valuePropName="checked">
                                <Switch />
                            </Form.Item>
                            <Form.Item label="Tampilkan Karier" name="show_profession" valuePropName="checked">
                                <Switch />
                            </Form.Item>
                            <Form.Item label="Tampilkan Domisili" name="show_location" valuePropName="checked">
                                <Switch />
                            </Form.Item>
                        </div>
                    </Card>

                    <Card size="small" title="Preferensi Forum">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Form.Item label="Notifikasi Balasan" name="forum_notify_replies" valuePropName="checked">
                                <Switch />
                            </Form.Item>
                            <Form.Item label="Notifikasi Dukungan" name="forum_notify_reactions" valuePropName="checked">
                                <Switch />
                            </Form.Item>
                        </div>
                    </Card>
                </Form>
            </Modal>
        </div>
    );
};
