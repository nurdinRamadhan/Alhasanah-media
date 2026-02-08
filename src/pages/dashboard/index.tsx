import React, { useMemo, useState } from "react";
import { useList } from "@refinedev/core";
import { 
    Row, Col, Card, Typography, theme, Statistic, 
    List, Avatar, Skeleton, Tag, Select, Empty, Divider 
} from "antd";
import { 
    UserOutlined, WalletOutlined, ArrowUpOutlined, ArrowDownOutlined, 
    CheckCircleOutlined, SyncOutlined, FilterOutlined,
    ShoppingCartOutlined, RocketOutlined, ShopOutlined, PieChartOutlined
} from "@ant-design/icons";
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    BarChart, Bar, PieChart, Pie, Cell, Legend
} from "recharts";
import dayjs from "dayjs";
import { ISantri, ITagihanSantri, IPengeluaran, IPesertaDiklat } from "../../types";
import Space from "antd/lib/space";

const { Title, Text } = Typography;
const { useToken } = theme;

// --- KONFIGURASI TAHUN HIJRIAH ---
const HIJRI_YEARS = [
    { label: '1445 H', value: 1445 },
    { label: '1446 H', value: 1446 },
    { label: '1447 H', value: 1447 },
    { label: '1448 H', value: 1448 },
    { label: '1449 H', value: 1449 },
    { label: '1450 H', value: 1450 },
    { label: '1451 H', value: 1451 },
    { label: '1452 H', value: 1452 },
    { label: '1453 H', value: 1453 },
    { label: '1454 H', value: 1454 },
];

// --- KOMPONEN KARTU KPI ---
const KPICard = ({ title, value, icon, color, subtext, loading, prefix }: any) => {
    const { token } = useToken();
    return (
        <Card bordered={false} bodyStyle={{ padding: 24 }} className="h-full shadow-sm hover:shadow-md transition-all">
            <Skeleton loading={loading} active avatar paragraph={{ rows: 1 }}>
                <div className="flex items-center justify-between">
                    <div>
                        <Text type="secondary" className="text-xs uppercase font-bold tracking-wider">{title}</Text>
                        <div className="mt-2">
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
                        padding: 16, borderRadius: 16, color: color,
                        boxShadow: `0 4px 12px ${color}30`
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
    
    // STATE FILTER
    const [selectedYear, setSelectedYear] = useState<number>(dayjs().year()); // Masehi untuk Keuangan
    const [selectedHijriYear, setSelectedHijriYear] = useState<number>(1447); // Hijriah untuk Diklat

    // 1. FETCH DATA (Aggregated)
    
    // A. Santri
    const { data: santriData, isLoading: santriLoading } = useList<ISantri>({
        resource: "santri",
        pagination: { mode: "off" },
        filters: [{ field: "status_santri", operator: "eq", value: "AKTIF" }]
    });

    // B. Pemasukan (Tagihan Lunas Tahun Ini)
    const { data: tagihanData, isLoading: tagihanLoading } = useList<ITagihanSantri>({
        resource: "tagihan_santri",
        pagination: { mode: "off" },
        filters: [
            { field: "created_at", operator: "gte", value: dayjs().year(selectedYear).startOf('year').toISOString() },
            { field: "created_at", operator: "lte", value: dayjs().year(selectedYear).endOf('year').toISOString() }
        ]
    });

    // C. Pengeluaran (Tahun Ini)
    const { data: pengeluaranData, isLoading: pengeluaranLoading } = useList<IPengeluaran>({
        resource: "pengeluaran",
        pagination: { mode: "off" },
        filters: [
            { field: "tanggal_pengeluaran", operator: "gte", value: dayjs().year(selectedYear).startOf('year').format('YYYY-MM-DD') },
            { field: "tanggal_pengeluaran", operator: "lte", value: dayjs().year(selectedYear).endOf('year').format('YYYY-MM-DD') }
        ]
    });

    // D. Diklat (Tahun Hijriah Terpilih)
    const { data: diklatData, isLoading: diklatLoading } = useList<IPesertaDiklat>({
        resource: "peserta_diklat",
        pagination: { mode: "off" },
        filters: [
            { field: "tahun_diklat", operator: "eq", value: selectedHijriYear }
        ]
    });

    // 2. DATA PROCESSING (MEMOIZED)
    
    // A. CASHFLOW CHART (Income vs Expense)
    const cashflowChartData = useMemo(() => {
        const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
        
        // Init 0
        const data = months.map(m => ({ name: m, income: 0, expense: 0, profit: 0 }));

        // Isi Income
        tagihanData?.data?.forEach(t => {
            if(t.status === 'LUNAS') {
                const idx = dayjs(t.created_at).month();
                data[idx].income += Number(t.nominal_tagihan);
            }
        });

        // Isi Expense
        pengeluaranData?.data?.forEach(p => {
            const idx = dayjs(p.tanggal_pengeluaran).month();
            data[idx].expense += Number(p.nominal);
        });

        // Hitung Profit
        data.forEach(d => d.profit = d.income - d.expense);

        return data;
    }, [tagihanData, pengeluaranData]);

    // B. EXPENSE BREAKDOWN (Pie Chart)
    const expenseCategoryData = useMemo(() => {
        const raw = pengeluaranData?.data || [];
        const groups: Record<string, number> = {};

        raw.forEach(p => {
            groups[p.kategori] = (groups[p.kategori] || 0) + Number(p.nominal);
        });

        return Object.keys(groups).map(k => ({ name: k, value: groups[k] }));
    }, [pengeluaranData]);

    // C. DIKLAT STATS (Bar Chart)
    const diklatStats = useMemo(() => {
        const raw = diklatData?.data || [];
        const events = ['MAULID', 'SYABAN', 'RAMADHAN', 'DZULHIJJAH'];

        return events.map(evt => {
            const participants = raw.filter(p => p.jenis_diklat === evt);
            const revenue = participants.reduce((acc, curr) => acc + Number(curr.biaya_pendaftaran) + Number(curr.belanja_kitab_nominal), 0);
            return {
                name: evt,
                Peserta: participants.length,
                Pemasukan: revenue
            };
        });
    }, [diklatData]);

    // D. KPI Calculation
    const totalSantri = santriData?.data?.length || 0;
    const totalRevenue = tagihanData?.data?.filter(t => t.status === 'LUNAS').reduce((acc, c) => acc + Number(c.nominal_tagihan), 0) || 0;
    const totalExpense = pengeluaranData?.data?.reduce((acc, c) => acc + Number(c.nominal), 0) || 0;
    const netProfit = totalRevenue - totalExpense;
    
    // Diklat KPI
    const totalDiklatParticipants = diklatData?.data?.length || 0;

    // COLORS
    const COLORS_EXPENSE = ['#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#64748b'];

    // Year Options for Finance
    const yearOptions = Array.from({length: 5}, (_, i) => {
        const year = dayjs().year() - i;
        return { label: `Tahun ${year}`, value: year };
    });

    return (
        <div className="pb-10">
            {/* --- HEADER --- */}
            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <Title level={3} style={{ margin: 0 }}>Dashboard Admin</Title>
                    <Text type="secondary">Informasi Keuangan & Kegiatan Pesantren</Text>
                </div>
                <div className="flex gap-2">
                    <Select 
                        value={selectedYear} 
                        onChange={setSelectedYear} 
                        options={yearOptions}
                        prefix={<FilterOutlined />}
                        className="w-32"
                    />
                    <Tag color="blue" className="px-3 py-1 text-sm flex items-center">
                        {dayjs().format("DD MMMM YYYY")}
                    </Tag>
                </div>
            </div>

            {/* --- ROW 1: KPI UTAMA (FINANSIAL & SANTRI) --- */}
            <Row gutter={[24, 24]} className="mb-8">
                <Col xs={24} sm={12} lg={6}>
                    <KPICard 
                        title="Santri Mukim Aktif" 
                        value={totalSantri} 
                        icon={<UserOutlined style={{ fontSize: 24 }} />}
                        color="#3b82f6"
                        loading={santriLoading}
                        subtext={<Tag color="blue">Reguler</Tag>}
                    />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <KPICard 
                        title="Pemasukan Bersih (Syahriah)" 
                        value={new Intl.NumberFormat('id-ID', { notation: "compact", compactDisplay: "short", style: "currency", currency: "IDR" }).format(totalRevenue)} 
                        icon={<ArrowUpOutlined style={{ fontSize: 24 }} />}
                        color="#10b981"
                        loading={tagihanLoading}
                        subtext={<span className="text-emerald-500 font-bold">Uang Masuk</span>}
                    />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <KPICard 
                        title="Pengeluaran Operasional" 
                        value={new Intl.NumberFormat('id-ID', { notation: "compact", compactDisplay: "short", style: "currency", currency: "IDR" }).format(totalExpense)} 
                        icon={<ShoppingCartOutlined style={{ fontSize: 24 }} />}
                        color="#ef4444"
                        loading={pengeluaranLoading}
                        subtext={<span className="text-red-500 font-bold">Uang Keluar</span>}
                    />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <KPICard 
                        title="Sisa Kas" 
                        value={new Intl.NumberFormat('id-ID', { notation: "compact", compactDisplay: "short", style: "currency", currency: "IDR" }).format(netProfit)} 
                        icon={<WalletOutlined style={{ fontSize: 24 }} />}
                        color={netProfit >= 0 ? "#8b5cf6" : "#ef4444"}
                        loading={tagihanLoading || pengeluaranLoading}
                        subtext={
                            netProfit >= 0 
                            ? <span className="text-purple-600 font-bold">Surplus</span> 
                            : <span className="text-red-500 font-bold">Defisit</span>
                        }
                    />
                </Col>
            </Row>

            {/* --- ROW 2: CHART KEUANGAN (INCOME VS EXPENSE) --- */}
            <Row gutter={[24, 24]} className="mb-8">
                <Col xs={24} lg={16}>
                    <Card 
                        title={<Space><WalletOutlined className="text-emerald-600"/><span>Arus Kas</span></Space>}
                        bordered={false} 
                        className="shadow-sm h-full"
                    >
                        <div style={{ width: '100%', height: 350 }}>
                            <ResponsiveContainer>
                                <AreaChart data={cashflowChartData}>
                                    <defs>
                                        <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={token.colorBorderSecondary} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: token.colorTextSecondary, fontSize: 12}} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: token.colorTextSecondary, fontSize: 12}} tickFormatter={(val) => `${val/1000000}M`} />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: token.colorBgElevated, borderColor: token.colorBorder, borderRadius: 8 }}
                                        formatter={(value: any) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(Number(value))}
                                    />
                                    <Legend verticalAlign="top" height={36}/>
                                    <Area type="monotone" dataKey="income" name="Pemasukan" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" />
                                    <Area type="monotone" dataKey="expense" name="Pengeluaran" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorExpense)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </Col>

                {/* EXPENSE BREAKDOWN (DONUT) */}
                <Col xs={24} lg={8}>
                    <Card 
                        title={<Space><PieChartOutlined className="text-blue-500"/><span>Komposisi Pengeluaran</span></Space>}
                        bordered={false} 
                        className="shadow-sm h-full"
                    >
                         <div style={{ width: '100%', height: 350, position: 'relative' }}>
                            {expenseCategoryData.length > 0 ? (
                                <ResponsiveContainer>
                                    <PieChart>
                                        <Pie
                                            data={expenseCategoryData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {expenseCategoryData.map((_entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS_EXPENSE[index % COLORS_EXPENSE.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value: any) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(Number(value))}/>
                                        <Legend verticalAlign="bottom" />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <Empty description="Belum ada pengeluaran" className="mt-20" />
                            )}
                         </div>
                    </Card>
                </Col>
            </Row>

            {/* --- SEPARATOR --- */}
            <Divider orientation="left" style={{borderColor: token.colorBorder}}>
                <Space><RocketOutlined /> <Text strong style={{fontSize: 16}}>Analisis Event & Diklat</Text></Space>
            </Divider>

            {/* --- ROW 3: DIKLAT SECTION --- */}
            <Row gutter={[24, 24]}>
                {/* 1. FILTER HIJRI & KPI DIKLAT */}
                <Col xs={24} md={8}>
                    <div className="flex flex-col gap-4 h-full">
                        {/* Control Panel */}
                        <Card bordered={false} className="shadow-sm">
                            <Text type="secondary" className="block mb-2 font-bold text-xs uppercase">Filter Tahun Hijriah</Text>
                            <Select 
                                value={selectedHijriYear} 
                                onChange={setSelectedHijriYear} 
                                options={HIJRI_YEARS}
                                className="w-full mb-4"
                                size="large"
                            />
                            <Statistic 
                                title="Total Peserta Tahun Ini" 
                                value={totalDiklatParticipants} 
                                prefix={<UserOutlined />}
                                valueStyle={{ color: token.colorPrimary, fontWeight: 'bold' }}
                            />
                            <div className="mt-4 pt-4 border-t border-dashed">
                                <Text type="secondary" className="text-xs">
                                    Menampilkan data pasaran Maulid, Syaban, Ramadhan, dan Dzulhijjah pada tahun {selectedHijriYear} H.
                                </Text>
                            </div>
                        </Card>
                        
                        {/* Mini Revenue Diklat */}
                        <Card bordered={false} className="shadow-sm bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900 dark:to-teal-900 border-none">
                             <Statistic 
                                title={<span className="text-emerald-700 dark:text-emerald-300">Total pemasukan Diklat</span>}
                                value={diklatStats.reduce((acc, curr) => acc + curr.Pemasukan, 0)} 
                                prefix="Rp"
                                valueStyle={{ color: '#047857', fontWeight: 'bold', fontSize: 22 }}
                                precision={0}
                            />
                            <div className="flex items-center gap-2 mt-2 text-emerald-600 dark:text-emerald-400 text-xs">
                                <ShopOutlined /> Termasuk Penjualan Kitab
                            </div>
                        </Card>
                    </div>
                </Col>

                {/* 2. GRAFIK BATANG PESERTA */}
                <Col xs={24} md={16}>
                    <Card 
                        title={`Tren Peserta Pasaran (${selectedHijriYear} H)`}
                        bordered={false} 
                        className="shadow-sm h-full"
                    >
                         <div style={{ width: '100%', height: 320 }}>
                            <ResponsiveContainer>
                                <BarChart data={diklatStats} barSize={40}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={token.colorBorderSecondary} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: token.colorTextSecondary}} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: token.colorTextSecondary}} />
                                    <Tooltip 
                                         cursor={{fill: 'transparent'}}
                                         contentStyle={{ backgroundColor: token.colorBgElevated, borderRadius: 8 }}
                                    />
                                    <Legend verticalAlign="top"/>
                                    <Bar dataKey="Peserta" name="Jumlah Santri" fill={token.colorPrimary} radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                         </div>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};