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
                <Space><RocketOutlined /> <Text strong style={{fontSize: 16}}>Analisis Diklat Tahunan</Text></Space>
            </Divider>

            {/* --- ROW 3: REFINED DIKLAT SECTION --- */}
<Row gutter={[24, 24]}>
    {/* 1. ANALYTICAL CONTROL CENTER */}
    <Col xs={24} lg={7}>
        <div className="flex flex-col gap-4 h-full">
            <Card 
                bordered={false} 
                className="shadow-xl bg-white/80 backdrop-blur-md border border-white/20 overflow-hidden"
                style={{ borderRadius: '24px' }}
                bodyStyle={{ padding: '24px' }}
            >
                <div className="mb-6">
                    <Text strong className="text-gray-400 text-xs uppercase tracking-widest block mb-4">
                        Control Center
                    </Text>
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded-2xl border border-gray-100">
                        <Space className="ml-2">
                            <SyncOutlined className="text-blue-500" spin={diklatLoading} />
                            <Text strong>Tahun Hijriah</Text>
                        </Space>
                        <Select 
                            variant="borderless"
                            value={selectedHijriYear} 
                            onChange={setSelectedHijriYear} 
                            options={HIJRI_YEARS}
                            className="w-28 font-bold text-blue-600"
                        />
                    </div>
                </div>

                <div className="space-y-6">
                    <div>
                        <Text type="secondary" className="text-xs">Total Mufasirin</Text>
                        <div className="flex items-baseline gap-2">
                            <Title level={2} style={{ margin: 0, fontWeight: 800 }}>{totalDiklatParticipants}</Title>
                            <Text className="text-emerald-500 font-medium text-xs">
                                <ArrowUpOutlined /> Mufasirin
                            </Text>
                        </div>
                    </div>

                    <Divider className="my-2" dashed />

                    <div className="p-4 bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl text-white shadow-lg relative overflow-hidden">
                        {/* Decorative circle */}
                        <div className="absolute -right-4 -top-4 w-20 h-20 bg-emerald-500/20 rounded-full blur-2xl" />
                        
                        <Text className="text-gray-400 text-xs font-medium">Dana terkumpul Pasaran</Text>
                        <div className="mt-1">
                            <span className="text-emerald-400 text-sm font-bold mr-1">Rp</span>
                            <span className="text-2xl font-black">
                                {new Intl.NumberFormat('id-ID').format(diklatStats.reduce((acc, curr) => acc + curr.Pemasukan, 0))}
                            </span>
                        </div>
                        <div className="mt-4 flex items-center gap-2 opacity-80 text-[10px]">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Live Update
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    </Col>

    {/* 2. ADVANCED ANALYTICS CHART */}
    <Col xs={24} lg={17}>
        <Card 
            title={
                <div className="py-2">
                    <Title level={4} style={{ margin: 0 }}>Statistik </Title>
                    <Text type="secondary" className="text-xs font-normal">Perbandingan Volume Peserta vs Uang terkumpul (Tahun {selectedHijriYear} H)</Text>
                </div>
            }
            bordered={false} 
            className="shadow-xl"
            style={{ borderRadius: '24px' }}
        >
            <div style={{ width: '100%', height: 350 }}>
                <ResponsiveContainer>
    <BarChart data={diklatStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={1}/>
                <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.8}/>
            </linearGradient>
        </defs>
        
        {/* Menggunakan token Ant Design agar warna grid adaptif dengan Dark/Light mode */}
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={token.colorBorderSecondary} />
        
        <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: token.colorTextSecondary, fontSize: 11, fontWeight: 600 }} 
            dy={10}
        />
        
        <YAxis 
            yAxisId="left"
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: token.colorTextSecondary, fontSize: 11 }} 
        />
        
        <YAxis 
            yAxisId="right"
            orientation="right"
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: token.colorTextSecondary, fontSize: 11 }}
            tickFormatter={(val) => {
                // Logika format nominal: Juta dan Ribu
                if (val >= 1000000) return `Rp${val / 1000000} Juta`;
                if (val >= 1000) return `Rp${val / 1000} Ribu`;
                return `Rp${val}`;
            }}
        />
        
        <Tooltip 
            // PERBAIKAN 1: Menghilangkan blok putih dengan mengubah cursor menjadi transparent
            cursor={{ fill: 'transparent' }} 
            
            // PERBAIKAN 2: Menggunakan token AntD agar background tooltip menyatu dengan Dark Mode
            contentStyle={{ 
                backgroundColor: token.colorBgElevated, 
                color: token.colorText,
                borderRadius: '16px', 
                border: `1px solid ${token.colorBorderSecondary}`, 
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
                padding: '12px'
            }}
            itemStyle={{ color: token.colorText }}
            
            // PERBAIKAN 3: Format Rupiah di dalam isi Tooltip saat di-hover
            formatter={(value: any, name: any) => {
                if (name === "Terkumpul (Rp)" || name === "Pemasukan") {
                    return [new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value), name];
                }
                return [value, name];
            }}
        />
        
        <Legend 
            verticalAlign="top" 
            align="right" 
            iconType="circle"
            wrapperStyle={{ paddingBottom: '20px', color: token.colorText }}
        />
        
        <Bar 
            yAxisId="left"
            dataKey="Peserta" 
            name="Jumlah Santri" 
            fill="url(#barGradient)" 
            radius={[10, 10, 10, 10]} 
            barSize={32}
        />
        
        <Area 
            yAxisId="right"
            type="monotone" 
            dataKey="Pemasukan" 
            name="Terkumpul (Rp)" 
            stroke="#10b981" 
            strokeWidth={3}
            fill="#10b981"
            fillOpacity={0.1}
        />
             </BarChart>
             </ResponsiveContainer>
            </div>
        </Card>
    </Col>
</Row>
        </div>
    );
};