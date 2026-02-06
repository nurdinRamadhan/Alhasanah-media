import React, { useMemo, useState } from "react";
import { useList, useNavigation } from "@refinedev/core";
import { 
    Row, Col, Card, Typography, theme, Statistic, 
    List, Avatar, Skeleton, Tag, Select, Empty
} from "antd";
import { 
    UserOutlined, WalletOutlined, ReadOutlined, 
    ArrowUpOutlined, ArrowDownOutlined, 
    CheckCircleOutlined, SyncOutlined, FilterOutlined
} from "@ant-design/icons";
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    BarChart, Bar, PieChart, Pie, Cell, Legend
} from "recharts";
import dayjs from "dayjs";
import { ISantri, ITagihanSantri } from "../../types";

const { Title, Text } = Typography;
const { useToken } = theme;

// --- KOMPONEN KARTU KPI ---
const KPICard = ({ title, value, icon, color, subtext, loading, prefix }: any) => {
    const { token } = useToken();
    return (
        <Card bordered={false} bodyStyle={{ padding: 20 }} className="h-full shadow-sm hover:shadow-md transition-all">
            <Skeleton loading={loading} active avatar paragraph={{ rows: 1 }}>
                <div className="flex items-center justify-between">
                    <div>
                        <Text type="secondary" className="text-xs uppercase font-bold tracking-wider">{title}</Text>
                        <div className="mt-1">
                             <Statistic 
                                value={value} 
                                prefix={prefix}
                                valueStyle={{ fontWeight: 800, fontSize: 26, color: token.colorText }} 
                            />
                        </div>
                        <div className="mt-2 text-xs">
                             {subtext}
                        </div>
                    </div>
                    <div style={{ 
                        background: `linear-gradient(135deg, ${color}20 0%, ${color}40 100%)`, 
                        padding: 12, borderRadius: 12, color: color 
                    }}>
                        {icon}
                    </div>
                </div>
            </Skeleton>
        </Card>
    );
};

export const DashboardPage = () => {
    const { token } = useToken();
    
    // STATE FILTER TAHUN
    const [selectedYear, setSelectedYear] = useState<number>(dayjs().year());

    // 1. FETCH DATA
    // Santri (Ambil semua aktif untuk chart demografi)
    const { data: santriData, isLoading: santriLoading } = useList<ISantri>({
        resource: "santri",
        pagination: { mode: "off" },
        filters: [{ field: "status_santri", operator: "eq", value: "AKTIF" }]
    });

    // Keuangan (Filter berdasarkan Tahun yang dipilih)
    const { data: tagihanData, isLoading: tagihanLoading } = useList<ITagihanSantri>({
        resource: "tagihan_santri",
        pagination: { mode: "off" },
        filters: [
            { field: "created_at", operator: "gte", value: dayjs().year(selectedYear).startOf('year').toISOString() },
            { field: "created_at", operator: "lte", value: dayjs().year(selectedYear).endOf('year').toISOString() }
        ]
    });

    // 2. DATA PROCESSING (MEMOIZED)
    
    // A. Chart Keuangan (Area Chart) - Group by Month
    const revenueChartData = useMemo(() => {
        const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
        const rawData = tagihanData?.data || [];
        
        // Init data bulan
        const data = months.map(m => ({ name: m, total: 0, lunas: 0 }));

        rawData.forEach(t => {
            const monthIdx = dayjs(t.created_at).month();
            data[monthIdx].total += Number(t.nominal_tagihan);
            if(t.status === 'LUNAS') data[monthIdx].lunas += Number(t.nominal_tagihan);
        });

        return data;
    }, [tagihanData]);

    // B. Chart Gender (Pie Chart)
    const genderData = useMemo(() => {
        const raw = santriData?.data || [];
        const laki = raw.filter(s => s.jenis_kelamin === 'L').length;
        const perempuan = raw.filter(s => s.jenis_kelamin === 'P').length;
        return [
            { name: 'Putra', value: laki },
            { name: 'Putri', value: perempuan },
        ];
    }, [santriData]);

    // C. Chart Kelas & Jurusan (Stacked Bar Chart)
    const classData = useMemo(() => {
        const raw = santriData?.data || [];
        const classes = ['1', '2', '3'];
        
        return classes.map(cls => {
            // Filter per kelas dulu
            const studentsInClass = raw.filter(s => s.kelas === cls);
            
            return {
                name: `Kelas ${cls}`,
                // Hitung per Jurusan
                Tahfidz: studentsInClass.filter(s => s.jurusan === 'TAHFIDZ').length,
                Kitab: studentsInClass.filter(s => s.jurusan === 'KITAB').length,
                Total: studentsInClass.length // Untuk tooltip total
            };
        });
    }, [santriData]);

    // D. KPI Calculation
    const totalSantri = santriData?.data?.length || 0;
    
    // Hitung total uang masuk (Lunas)
    const totalRevenue = tagihanData?.data?.filter(t => t.status === 'LUNAS').reduce((acc, c) => acc + Number(c.nominal_tagihan), 0) || 0;
    
    // Hitung total tunggakan (Belum)
    const totalPendingAmount = tagihanData?.data?.filter(t => t.status === 'BELUM').reduce((acc, c) => acc + Number(c.sisa_tagihan), 0) || 0;
    
    // Hitung Jumlah Santri Unik yang Belum Bayar
    // Menggunakan Set untuk menghitung NIS unik dari tagihan status BELUM
    const distinctUnpaidStudents = new Set(
        tagihanData?.data?.filter(t => t.status === 'BELUM').map(t => t.santri_nis)
    ).size;

    // WARNA CHART
    const COLORS_PIE = ['#3b82f6', '#ec4899']; // Biru (L), Pink (P)
    const COLOR_TAHFIDZ = '#3b82f6';
    const COLOR_KITAB = '#10b981';

    // Generate List Tahun (5 Tahun Terakhir)
    const yearOptions = Array.from({length: 5}, (_, i) => {
        const year = dayjs().year() - i;
        return { label: `Tahun ${year}`, value: year };
    });

    return (
        <div className="pb-10">
            <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <Title level={3} style={{ margin: 0 }}>Dashboard Eksekutif</Title>
                    <Text type="secondary">Ringkasan performa Pesantren Al-Hasanah</Text>
                </div>
                {/* Info Tanggal Realtime */}
                <Tag color="blue" className="px-3 py-1 text-sm">
                    {dayjs().format("DD MMMM YYYY")}
                </Tag>
            </div>

            {/* --- ROW 1: KPI CARDS --- */}
            <Row gutter={[24, 24]} className="mb-6">
                <Col xs={24} sm={12} lg={8}>
                    <KPICard 
                        title="Total Santri Aktif" 
                        value={totalSantri} 
                        icon={<UserOutlined style={{ fontSize: 24 }} />}
                        color="#3b82f6"
                        loading={santriLoading}
                        subtext={<Tag color="blue">Data Realtime</Tag>}
                    />
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <KPICard 
                        title={`Pemasukan (${selectedYear})`} 
                        value={new Intl.NumberFormat('id-ID', { notation: "compact", compactDisplay: "short", style: "currency", currency: "IDR" }).format(totalRevenue)} 
                        icon={<WalletOutlined style={{ fontSize: 24 }} />}
                        color="#10b981"
                        loading={tagihanLoading}
                        subtext={<span className="text-emerald-500 flex items-center gap-1"><ArrowUpOutlined/> Cashflow Masuk</span>}
                    />
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <KPICard 
                        title="Total Tunggakan" 
                        value={new Intl.NumberFormat('id-ID', { notation: "compact", compactDisplay: "short", style: "currency", currency: "IDR" }).format(totalPendingAmount)} 
                        icon={<SyncOutlined style={{ fontSize: 24 }} />}
                        color="#f59e0b"
                        loading={tagihanLoading}
                        // FITUR BARU: Menampilkan jumlah santri yang menunggak
                        subtext={<span className="text-orange-600 font-semibold">{distinctUnpaidStudents} Santri Belum Lunas</span>}
                    />
                </Col>
            </Row>

            {/* --- ROW 2: MAIN CHARTS --- */}
            <Row gutter={[24, 24]} className="mb-6">
                {/* 1. FINANCIAL TREND (AREA CHART) */}
                <Col xs={24} lg={16}>
                    <Card 
                        title={
                            <div className="flex justify-between items-center">
                                <span>Tren Keuangan</span>
                                {/* FITUR BARU: Dropdown Filter Tahun */}
                                <Select 
                                    value={selectedYear} 
                                    onChange={setSelectedYear} 
                                    options={yearOptions}
                                    size="small"
                                    style={{ width: 110 }}
                                    prefix={<FilterOutlined />}
                                />
                            </div>
                        } 
                        bordered={false} 
                        className="shadow-sm h-full"
                    >
                        <div style={{ width: '100%', height: 320 }}>
                            <ResponsiveContainer>
                                <AreaChart data={revenueChartData}>
                                    <defs>
                                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={token.colorPrimary} stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor={token.colorPrimary} stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="colorLunas" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={token.colorBorderSecondary} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: token.colorTextSecondary, fontSize: 12}} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: token.colorTextSecondary, fontSize: 12}} tickFormatter={(val) => `${val/1000000}M`} />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: token.colorBgElevated, borderColor: token.colorBorder, borderRadius: 8 }}
                                        itemStyle={{ color: token.colorText }}
                                        formatter={(value: number | string | undefined) => value !== undefined ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(Number(value)) : ""}
                                    />
                                    <Legend verticalAlign="top" height={36}/>
                                    <Area type="monotone" dataKey="total" name="Tagihan Dicetak" stroke={token.colorPrimary} fillOpacity={1} fill="url(#colorTotal)" />
                                    <Area type="monotone" dataKey="lunas" name="Uang Masuk" stroke="#10b981" fillOpacity={1} fill="url(#colorLunas)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </Col>

                {/* 2. CLASS DISTRIBUTION (STACKED BAR CHART) */}
                <Col xs={24} lg={8}>
                    <Card title="Sebaran Kelas & Jurusan" bordered={false} className="shadow-sm h-full">
                         <div style={{ width: '100%', height: 320 }}>
                            <ResponsiveContainer>
                                <BarChart data={classData} layout="vertical" barGap={2}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={token.colorBorderSecondary} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={60} tick={{fill: token.colorTextSecondary, fontSize: 12}} axisLine={false} tickLine={false} />
                                    <Tooltip 
                                         cursor={{fill: 'transparent'}}
                                         contentStyle={{ backgroundColor: token.colorBgElevated, borderRadius: 8 }}
                                    />
                                    <Legend verticalAlign="top" iconType="circle" />
                                    {/* FITUR BARU: Stacked Bar Tahfidz vs Kitab */}
                                    <Bar dataKey="Tahfidz" stackId="a" fill={COLOR_TAHFIDZ} radius={[0, 0, 0, 0]} barSize={20} />
                                    <Bar dataKey="Kitab" stackId="a" fill={COLOR_KITAB} radius={[0, 4, 4, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                         </div>
                    </Card>
                </Col>
            </Row>

            {/* --- ROW 3: PIE CHART & ACTIVITY --- */}
            <Row gutter={[24, 24]}>
                <Col xs={24} md={12} lg={8}>
                    <Card title="Komposisi Gender" bordered={false} className="shadow-sm h-full">
                        <div style={{ width: '100%', height: 250, position: 'relative' }}>
                            <ResponsiveContainer>
                                <PieChart>
                                    <Pie
                                        data={genderData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {genderData.map((_entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS_PIE[index % COLORS_PIE.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: 8 }} />
                                    <Legend verticalAlign="bottom" height={36}/>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 -mt-4 text-center">
                                <div className="text-2xl font-bold" style={{color: token.colorText}}>{totalSantri}</div>
                                <div className="text-xs text-gray-400">Total</div>
                            </div>
                        </div>
                    </Card>
                </Col>

                <Col xs={24} md={12} lg={16}>
                    <Card title="Aktivitas Keuangan Terbaru" bordered={false} className="shadow-sm h-full">
                        <List
                            itemLayout="horizontal"
                            dataSource={tagihanData?.data?.slice(0, 4)} 
                            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada transaksi" /> }}
                            renderItem={(item) => (
                                <List.Item>
                                    <List.Item.Meta
                                        avatar={
                                            <Avatar 
                                                style={{ backgroundColor: item.status === 'LUNAS' ? '#dcfce7' : '#fee2e2' }} 
                                                icon={item.status === 'LUNAS' ? <CheckCircleOutlined style={{color:'#166534'}} /> : <SyncOutlined style={{color:'#991b1b'}} />} 
                                            />
                                        }
                                        title={<Text strong>{item.deskripsi_tagihan}</Text>}
                                        description={`${item.santri?.nama} - ${dayjs(item.created_at).format('DD MMM HH:mm')}`}
                                    />
                                    <div className="text-right">
                                        <Text strong style={{ display: 'block' }}>
                                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(item.nominal_tagihan)}
                                        </Text>
                                        <Tag color={item.status === 'LUNAS' ? 'success' : 'error'}>{item.status}</Tag>
                                    </div>
                                </List.Item>
                            )}
                        />
                    </Card>
                </Col>
            </Row>
        </div>
    );
};