import React, { useState, useRef, useMemo } from "react";
import { useList, useCreate, useGetIdentity } from "@refinedev/core";
import { 
    Card, Select, Button, Table, InputNumber, Input, 
    Typography, message, Tabs, Avatar, Empty 
} from "antd";
import { 
    SaveOutlined, PrinterOutlined, ReadOutlined, 
    DownloadOutlined, CheckCircleOutlined 
} from "@ant-design/icons";
import { supabaseClient } from "../../utility/supabaseClient";
import { useReactToPrint } from 'react-to-print';
import { ISantri, IMataPelajaran } from "../../types";
import dayjs from "dayjs";

const { Title, Text } = Typography;

export const AkademikPage = () => {
    const { data: user } = useGetIdentity<{ name: string }>();
    
    // --- STATES ---
    const [activeTab, setActiveTab] = useState("input");
    
    // Filter State
    const [selectedKelas, setSelectedKelas] = useState<string | null>(null);
    const [selectedMapel, setSelectedMapel] = useState<number | null>(null);
    const [tahunAjaran, setTahunAjaran] = useState("2025/2026");
    
    // Data Input Holder
    const [inputData, setInputData] = useState<Record<string, number>>({}); // {nis: nilai}
    const [catatanData, setCatatanData] = useState<Record<string, string>>({}); // {nis: catatan}

    // Rapor Preview State
    const [raporSantri, setRaporSantri] = useState<any>(null); 
    const [raporNilai, setRaporNilai] = useState<any[]>([]); 
    const [isRaporModalOpen, setIsRaporModalOpen] = useState(false);
    const raporRef = useRef(null);

    const handlePrint = useReactToPrint({
        contentRef: raporRef,
    });

    // --- OPTIONS GENERATOR ---
    // 1. Tahun Ajaran (Sampai 2030)
    const yearOptions = useMemo(() => {
        const years = [];
        const startYear = 2024;
        const endYear = 2030;
        for (let i = startYear; i <= endYear; i++) {
            years.push({ value: `${i}/${i+1}`, label: `${i}/${i+1}` });
        }
        return years;
    }, []);

    // 2. Kelas (Hanya 1, 2, 3)
    const classOptions = ['1', '2', '3'].map(k => ({ value: k, label: `Kelas ${k}` }));

    // --- FETCH DATA ---
    const { data: mapelData } = useList<IMataPelajaran>({ 
        resource: "mata_pelajaran", 
        pagination: { mode: "off" },
        filters: [{ field: "aktif", operator: "eq", value: true }]
    });
    
    const { data: santriData } = useList<ISantri>({ 
        resource: "santri", 
        pagination: { mode: "off" },
        filters: [
            { field: "status_santri", operator: "eq", value: "AKTIF" },
            { field: "kelas", operator: "eq", value: selectedKelas || '' }
        ],
        queryOptions: { enabled: !!selectedKelas } // Hanya fetch jika kelas dipilih
    });

    // --- HANDLERS ---

    // 1. Simpan Nilai
    const handleSaveNilai = async () => {
        if (!selectedMapel || !selectedKelas) return message.error("Pilih Kelas & Mapel dulu");
        
        // Siapkan Payload
        const payload = santriData?.data.map(santri => ({
            santri_nis: santri.nis,
            mapel_id: selectedMapel,
            semester: "TAHUNAN", // Default Value agar DB tidak error
            tahun_ajaran: tahunAjaran,
            nilai_angka: inputData[santri.nis] || 0,
            catatan_ustadz: catatanData[santri.nis] || "",
            dicatat_oleh: user?.name || "Admin"
        }));

        if (!payload || payload.length === 0) return message.warning("Tidak ada santri di kelas ini");

        try {
            // Upsert Logic (Update jika ada, Insert jika baru)
            const { error } = await supabaseClient
                .from('nilai_santri')
                .upsert(payload as any, { onConflict: 'santri_nis, mapel_id, semester, tahun_ajaran' });

            if (error) throw error;
            message.success(`Nilai ${payload.length} santri berhasil disimpan!`);
        } catch (e: any) {
            console.error(e);
            message.error("Gagal simpan nilai. Pastikan Database sudah update.");
        }
    };

    // 2. Preview Rapor
    const handlePreviewRapor = async (santri: ISantri) => {
        const loadingMsg = message.loading("Menyiapkan rapor...", 0);
        
        // Ambil nilai santri ini setahun penuh
        const { data: nilai, error } = await supabaseClient
            .from('nilai_santri')
            .select(`*, mata_pelajaran (nama_mapel, kategori, kkm)`)
            .eq('santri_nis', santri.nis)
            .eq('tahun_ajaran', tahunAjaran)
            .eq('semester', 'TAHUNAN'); // Filter sesuai default kita
        
        loadingMsg();

        if (error) return message.error("Gagal mengambil data nilai");
        if (!nilai || nilai.length === 0) return message.warning("Belum ada nilai yang diinput untuk santri ini");
        
        setRaporSantri(santri);
        setRaporNilai(nilai || []);
        setIsRaporModalOpen(true);
    };

    // --- COLUMNS CONFIG ---
    const columnsInput = [
        { title: "NIS", dataIndex: "nis", width: 100 },
        { 
            title: "Nama Santri", 
            dataIndex: "nama", 
            width: 250,
            render: (val: string) => <Text strong>{val}</Text>
        },
        { 
            title: "Nilai (0-100)", 
            key: "nilai",
            width: 150,
            render: (_: any, r: ISantri) => (
                <InputNumber 
                    min={0} max={100} 
                    value={inputData[r.nis]} 
                    onChange={(val) => setInputData(prev => ({...prev, [r.nis]: val as number}))}
                    className={`w-full ${inputData[r.nis] < 70 ? "border-red-500 text-red-600" : "font-bold"}`}
                    placeholder="0"
                />
            )
        },
        { 
            title: "Catatan Ustadz (Opsional)", 
            key: "catatan",
            render: (_: any, r: ISantri) => (
                <Input 
                    placeholder="Contoh: Tingkatkan hafalan..." 
                    value={catatanData[r.nis]}
                    onChange={(e) => setCatatanData(prev => ({...prev, [r.nis]: e.target.value}))}
                />
            )
        }
    ];

    const columnsCetak = [
        { title: "NIS", dataIndex: "nis", width: 120 },
        { 
            title: "Nama Santri", 
            dataIndex: "nama",
            render: (val: string, r: ISantri) => (
                <div className="flex flex-col">
                    <Text strong>{val}</Text>
                    <Text type="secondary" className="text-xs">{r.jurusan}</Text>
                </div>
            )
        },
        { title: "Kelas", dataIndex: "kelas", width: 80, align: "center" as const },
        { 
            title: "Aksi", 
            align: "right" as const,
            render: (_:any, r: ISantri) => (
                <Button type="primary" ghost size="small" icon={<PrinterOutlined/>} onClick={() => handlePreviewRapor(r)}>
                    Cetak Rapor
                </Button>
            )
        }
    ];

    return (
        <div className="pb-20">
            <Card bordered={false} className="shadow-sm">
                <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
                    {
                        key: "input",
                        label: <span className="flex items-center gap-2"><ReadOutlined /> Input Nilai Akademik</span>,
                        children: (
                            <div>
                                {/* CONTROL PANEL */}
                                <div className="bg-blue-50 p-5 rounded-xl mb-6 border border-blue-100">
                                    <div className="flex flex-wrap gap-4 items-end">
                                        <div>
                                            <Text className="text-xs font-bold text-gray-500 block mb-1 uppercase tracking-wider">Tahun Ajaran</Text>
                                            <Select value={tahunAjaran} onChange={setTahunAjaran} style={{width: 160}} options={yearOptions} size="large" />
                                        </div>
                                        <div>
                                            <Text className="text-xs font-bold text-gray-500 block mb-1 uppercase tracking-wider">Kelas</Text>
                                            <Select 
                                                placeholder="Pilih Kelas" 
                                                value={selectedKelas} 
                                                onChange={setSelectedKelas} 
                                                style={{width: 140}} 
                                                options={classOptions} 
                                                size="large"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <Text className="text-xs font-bold text-gray-500 block mb-1 uppercase tracking-wider">Mata Pelajaran</Text>
                                            <Select 
                                                placeholder="Pilih Kitab/jenis pelajaran untuk diinput..." 
                                                value={selectedMapel} 
                                                onChange={setSelectedMapel} 
                                                style={{width: '100%'}} 
                                                options={mapelData?.data.map(m => ({value: m.id, label: `${m.nama_mapel} (${m.kategori})`}))} 
                                                showSearch
                                                optionFilterProp="label"
                                                size="large"
                                            />
                                        </div>
                                        <div>
                                             <Button 
                                                type="primary" 
                                                icon={<SaveOutlined />} 
                                                onClick={handleSaveNilai} 
                                                disabled={!selectedKelas || !selectedMapel}
                                                size="large"
                                                className="bg-blue-600"
                                            >
                                                Simpan Nilai
                                             </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* TABLE AREA */}
                                {selectedKelas && selectedMapel ? (
                                    <Table 
                                        dataSource={santriData?.data} 
                                        columns={columnsInput} 
                                        rowKey="nis" 
                                        pagination={false}
                                        bordered
                                        size="middle"
                                        title={() => <div className="font-bold text-gray-600">Daftar Santri Kelas {selectedKelas}</div>}
                                    />
                                ) : (
                                    <Empty description="Silakan pilih Kelas dan Mapel terlebih dahulu" className="py-20" />
                                )}
                            </div>
                        )
                    },
                    {
                        key: "cetak",
                        label: <span className="flex items-center gap-2"><PrinterOutlined /> Cetak Rapor (PDF)</span>,
                        children: (
                            <div>
                                <div className="mb-6 flex gap-4 bg-gray-50 p-4 rounded-lg">
                                     <Select 
                                        placeholder="Filter Kelas" 
                                        onChange={setSelectedKelas} 
                                        style={{width: 200}} 
                                        options={classOptions} 
                                     />
                                     <Select 
                                        value={tahunAjaran} 
                                        onChange={setTahunAjaran} 
                                        style={{width: 160}} 
                                        options={yearOptions} 
                                     />
                                </div>
                                <Table 
                                    dataSource={santriData?.data} 
                                    columns={columnsCetak} 
                                    rowKey="nis" 
                                    pagination={{ pageSize: 10 }}
                                />
                            </div>
                        )
                    }
                ]} />
            </Card>

            {/* MODAL PREVIEW & PRINT */}
            {isRaporModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center">
                            <Title level={4} style={{margin:0}}>Preview Rapor</Title>
                            <div className="flex gap-2">
                                <Button onClick={() => setIsRaporModalOpen(false)}>Tutup</Button>
                                <Button type="primary" icon={<PrinterOutlined />} onClick={() => handlePrint()}>Cetak Sekarang</Button>
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-auto p-8 bg-gray-100">
                            {/* HALAMAN RAPOR (A4 STYLE) */}
                            <div ref={raporRef} className="bg-white mx-auto p-10 shadow-sm" style={{ width: '210mm', minHeight: '297mm' }}>
                                <style>{`
                                    @media print { 
                                        body { -webkit-print-color-adjust: exact; } 
                                        @page { size: A4; margin: 10mm; }
                                    }
                                `}</style>
                                
                                {/* KOP */}
                                <div className="text-center border-b-4 border-double border-black pb-4 mb-8">
                                    <div className="font-bold text-xl tracking-widest">LAPORAN HASIL BELAJAR (RAPOR)</div>
                                    <div className="font-bold text-2xl uppercase mt-1">PONDOK PESANTREN AL-HASANAH</div>
                                    <div className="text-sm italic mt-1">Jl. Raya Cibeuti No.13, Kec. Kawalu, Tasikmalaya</div>
                                </div>

                                {/* INFO SANTRI */}
                                <table className="w-full text-sm mb-8 font-medium">
                                    <tbody>
                                        <tr>
                                            <td className="py-1" width="15%">Nama Santri</td><td width="45%">: {raporSantri?.nama.toUpperCase()}</td>
                                            <td className="py-1" width="15%">Tahun Ajaran</td><td width="25%">: {tahunAjaran}</td>
                                        </tr>
                                        <tr>
                                            <td className="py-1">Nomor Induk</td><td>: {raporSantri?.nis}</td>
                                            <td className="py-1">Kelas</td><td>: {raporSantri?.kelas} ({raporSantri?.jurusan})</td>
                                        </tr>
                                    </tbody>
                                </table>

                                {/* TABEL NILAI */}
                                <table className="w-full text-sm border-collapse border border-black mb-8">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="border border-black p-2 text-center w-10">No</th>
                                            <th className="border border-black p-2 text-left">Mata Pelajaran</th>
                                            <th className="border border-black p-2 text-center w-16">KKM</th>
                                            <th className="border border-black p-2 text-center w-16">Nilai</th>
                                            <th className="border border-black p-2 text-center w-16">Predikat</th>
                                            <th className="border border-black p-2 text-left">Catatan Ustadz</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {['KITAB', 'TAHFIDZ', 'UMUM'].map((kategori) => {
                                            const mapelGroup = raporNilai.filter(n => n.mata_pelajaran?.kategori === kategori);
                                            if(mapelGroup.length === 0) return null;
                                            return (
                                                <React.Fragment key={kategori}>
                                                    <tr>
                                                        <td colSpan={6} className="border border-black px-3 py-1 bg-gray-50 font-bold text-xs tracking-wider">
                                                            KELOMPOK {kategori}
                                                        </td>
                                                    </tr>
                                                    {mapelGroup.map((n, idx) => (
                                                        <tr key={n.id}>
                                                            <td className="border border-black p-2 text-center">{idx+1}</td>
                                                            <td className="border border-black p-2">{n.mata_pelajaran?.nama_mapel}</td>
                                                            <td className="border border-black p-2 text-center text-gray-500">{n.mata_pelajaran?.kkm}</td>
                                                            <td className="border border-black p-2 text-center font-bold text-base">{n.nilai_angka}</td>
                                                            <td className="border border-black p-2 text-center">
                                                                {n.nilai_angka >= 90 ? 'A' : n.nilai_angka >= 75 ? 'B' : n.nilai_angka >= 60 ? 'C' : 'D'}
                                                            </td>
                                                            <td className="border border-black p-2 italic text-xs text-gray-600">{n.catatan_ustadz}</td>
                                                        </tr>
                                                    ))}
                                                </React.Fragment>
                                            )
                                        })}
                                    </tbody>
                                </table>

                                {/* CATATAN AKHIR */}
                                <div className="border border-black p-4 mb-12 rounded">
                                    <div className="font-bold underline text-sm mb-2">KESIMPULAN AKHIR TAHUN:</div>
                                    <div className="text-sm h-16">
                                        {/* Bisa diisi manual oleh wali kelas nanti */}
                                        Santri tersebut dinyatakan: .......................................................................
                                    </div>
                                </div>

                                {/* TANDA TANGAN */}
                                <div className="flex justify-between text-sm px-8">
                                    <div className="text-center">
                                        <div className="mb-20">Mengetahui,<br/>Orang Tua / Wali</div>
                                        <div className="border-b border-black w-48 mx-auto"></div>
                                    </div>
                                    <div className="text-center">
                                        <div className="mb-20">Tasikmalaya, {dayjs().format('DD MMMM YYYY')}<br/>Kepala Pesantren</div>
                                        <div className="font-bold underline">KH. Lili Syamsul Romli</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};