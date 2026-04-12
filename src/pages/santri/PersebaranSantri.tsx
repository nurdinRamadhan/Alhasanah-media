// src/pages/santri/PersebaranSantri.tsx
import React, { useMemo, useState } from "react";
import { PageContainer } from "@ant-design/pro-components";
import MapScene, { MapMode } from "../components/map/MapScene";
import { Select, Switch, Card } from "antd";
import "../../styles/map.css";
import 'maplibre-gl/dist/maplibre-gl.css';

const { Option } = Select;

export default function PersebaranSantriPage() {
  const [mode, setMode] = useState<MapMode>("heatmap");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [kelas, setKelas] = useState<string | null>(null);
  const [jurusan, setJurusan] = useState<string | null>(null);

  const filters = useMemo(() => ({ kelas, jurusan }), [kelas, jurusan]);

  React.useEffect(() => {
    // use data-theme attr (optional) for CSS theme hooks
    document.documentElement.setAttribute("data-theme", theme === "dark" ? "dark" : "light");
  }, [theme]);

  return (
    <PageContainer title="Peta Persebaran Santri">
      {/* Use flex column with full viewport minus header height.
          Replace 96 with your header height if different. */}
      <div className="flex gap-4 w-full" style={{ height: "calc(100vh - 96px)", position: "relative" }}>
        <aside className="w-80 h-full shrink-0" style={{ zIndex: 80 }}>
          <Card bordered={false} className="h-full shadow-lg overflow-y-auto">
            <div className="mb-4">
              <label className="text-xs font-bold text-gray-400 uppercase">Mode Visual</label>
              <Select value={mode} onChange={(v)=>setMode(v as MapMode)} style={{ width: "100%", marginTop: 8 }}>
                <Option value="heatmap">Heatmap (Kepadatan)</Option>
                <Option value="choropleth">Choropleth (Wilayah)</Option>
                <Option value="points">Titik Santri</Option>
              </Select>
            </div>

            <div className="mb-4">
              <label className="text-xs font-bold text-gray-400 uppercase">Filter Santri</label>
              <Select placeholder="Semua Kelas" allowClear style={{ width: "100%", marginTop: 8 }} onChange={(v)=>setKelas(v ?? null)}>
                <Option value={null}>Semua</Option>
                <Option value="kelas_1">Kelas 1</Option>
                <Option value="kelas_2">Kelas 2</Option>
                <Option value="kelas_3">Kelas 3</Option>
              </Select>
              <Select placeholder="Semua Jurusan" allowClear style={{ width: "100%", marginTop: 8 }} onChange={(v)=>setJurusan(v ?? null)}>
                <Option value={null}>Semua</Option>
                <Option value="umum">Umum</Option>
                <Option value="keagamaan">Keagamaan</Option>
                <Option value="multimedia">Multimedia</Option>
              </Select>
            </div>

            <div className="pt-4 border-t flex items-center justify-between">
              <span className="text-sm">Mode Gelap</span>
              <Switch checked={theme === "dark"} onChange={(c)=>setTheme(c? "dark":"light")} />
            </div>
          </Card>
        </aside>

        {/* Map area */}
        <main className="flex-1 h-full relative rounded-2xl overflow-hidden shadow-2xl bg-[#0b0e14]" style={{ zIndex: 10 }}>
          <MapScene mode={mode} theme={theme} filters={filters} />
        </main>
      </div>
    </PageContainer>
  );
}