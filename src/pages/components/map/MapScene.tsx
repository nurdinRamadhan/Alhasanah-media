// src/pages/components/map/MapScene.tsx
import React, { useEffect, useRef, useState } from "react";
import { Scene, Control } from "@antv/l7";
import { Map } from "@antv/l7-maps";
import { HeatmapLayer, PointLayer, PolygonLayer } from "@antv/l7";
import type { FeatureCollection, Geometry } from "geojson";
import 'maplibre-gl/dist/maplibre-gl.css';

import { ISantri } from "../../../types";
import { supabaseClient } from "../../../utility/supabaseClient";

import { Button, Drawer, List, Avatar, Spin } from "antd";
import "antd/dist/reset.css";
import "../../../styles/map.css";

export type MapMode = "heatmap" | "choropleth" | "points";

export default function MapScene({
  mode,
  theme,
  filters,
}: {
  mode: MapMode;
  theme: "dark" | "light";
  filters: { kelas?: string | null; jurusan?: string | null };
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const [santriWithCoords, setSantriWithCoords] = useState<ISantri[]>([]);
  const [choroplethGeoJSON, setChoroplethGeoJSON] = useState<FeatureCollection<Geometry, any> | null>(null);
  const layersRef = useRef<{ heatmap?: any; polygon?: any; points?: any }>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerItems, setDrawerItems] = useState<ISantri[]>([]);
  const [loading, setLoading] = useState(true);

  // reliable public map styles (CORS friendly)
  const styleDark = "https://demotiles.maplibre.org/style.json";
  const styleLight = "https://tiles.stadiamaps.com/styles/osm-bright.json";

  /* -------------------------
     1. Data fetching (santri)
     ------------------------- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const q = supabaseClient
          .from("santri")
          .select("nis,nama,kelas,jurusan,latitude,longitude,foto_url,kecamatan_id")
          .limit(20000);

        if (filters.kelas) (q as any).eq("kelas", filters.kelas);
        if (filters.jurusan) (q as any).eq("jurusan", filters.jurusan);

        const { data, error } = await q;
        if (error) console.error("supabase santri fetch:", error);
        if (!mounted) return;
        const arr = (data ?? []).filter((s: any) => typeof s.latitude === "number" && typeof s.longitude === "number");
        setSantriWithCoords(arr as ISantri[]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [filters]);

  /* -------------------------
     2. Fetch choropleth GeoJSON
     ------------------------- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/functions/choropleth-aggregate", { cache: "no-cache" });
        if (!res.ok) throw new Error("fetch choropleth failed");
        const json = await res.json();
        const fc = json.fc ?? json.featureCollection ?? json.polygons ?? json;
        if (mounted) setChoroplethGeoJSON(fc);
      } catch (err) {
        console.warn("choropleth fetch error:", err);
        if (mounted) setChoroplethGeoJSON(null);
      }
    })();
    return () => { mounted = false; };
  }, []);

  /* -------------------------
     3. Init Scene ONCE + ResizeObserver
     ------------------------- */
  useEffect(() => {
    if (!containerRef.current) return;

    // Init only once
    if (!sceneRef.current) {
      const scene = new Scene({
        id: containerRef.current,
        map: new Map({
          center: [110.3695, -7.8014],
          zoom: 8,
          style: theme === "dark" ? styleDark : styleLight,
          pitch: 30,
        }),
        logoVisible: false,
      });
      sceneRef.current = scene;

      // Branding control (one time)
      scene.on("loaded", () => {
        const brandingControl = new Control({ position: "bottomright" });
        brandingControl.onAdd = () => {
          const el = document.createElement("div");
          el.className = "map-branding";
          el.innerText = "Alhasanah Admin — Peta Santri";
          el.style.pointerEvents = "none"; // make non-interactive
          return el;
        };
        scene.addControl(brandingControl);
        try { (scene as any).map.resize(); } catch (e) {}
      });
    } else {
      // if scene already exists, just set style (avoid destroy/create)
      try {
        const mapInst = (sceneRef.current as any).map;
        mapInst.setStyle(theme === "dark" ? styleDark : styleLight);
        mapInst.resize();
      } catch (e) {
        console.warn("map.setStyle error:", e);
      }
    }

    // ResizeObserver ensures map resizes with layout changes
    if (containerRef.current && !resizeObserverRef.current) {
      const ro = new ResizeObserver(() => {
        if (sceneRef.current) {
          try { (sceneRef.current as any).map.resize(); } catch (e) {}
        }
      });
      ro.observe(containerRef.current);
      resizeObserverRef.current = ro;
    }

    // cleanup only on unmount (do not destroy on theme change)
    return () => {
      if (resizeObserverRef.current && containerRef.current) {
        try { resizeObserverRef.current.unobserve(containerRef.current); } catch (e) {}
      }
      // If your app truly navigates away and you want to free memory, you can destroy here:
      // if (sceneRef.current) { sceneRef.current.destroy(); sceneRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef.current]);

  /* -------------------------
     4. Render / update layers
     ------------------------- */
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // cleanup previous layers
    Object.values(layersRef.current).forEach((ly) => {
      try { if (ly) scene.removeLayer(ly); } catch (e) {}
    });
    layersRef.current = {};

    const pointsFC = {
      type: "FeatureCollection" as const,
      features: santriWithCoords.map((s) => ({
        type: "Feature" as const,
        geometry: { type: "Point", coordinates: [s.longitude!, s.latitude!] } as Geometry,
        properties: { nis: s.nis, nama: s.nama, kelas: s.kelas, jurusan: s.jurusan, foto_url: s.foto_url },
      })),
    };

    if (mode === "heatmap") {
      const heat = new HeatmapLayer({})
        .source(pointsFC, { parser: { type: "geojson" } })
        .size("count", [1, 2])
        .style({
          intensity: 2.0,
          radius: 20,
          rampColors: {
            colors: ["#0ea5e9", "#06b6d4", "#f97316", "#ef4444"],
            positions: [0.01, 0.25, 0.55, 1.0],
          },
        });
      layersRef.current.heatmap = heat;
      scene.addLayer(heat);
    } else if (mode === "choropleth" && choroplethGeoJSON) {
      const polygon = new PolygonLayer({})
        .source(choroplethGeoJSON as any, { parser: { type: "geojson" } })
        .shape("fill")
        .color("santri_count", ["#081d58", "#225ea8", "#1d91c0", "#41b6c4", "#a1dab4", "#ffffcc"])
        .style({ opacity: 0.85 })
        .active(true);

      polygon.on("click", async ({ feature }: any) => {
        const kecId = feature.properties?.id ?? feature.properties?.kecamatan_id;
        if (!kecId) return;
        const { data } = await supabaseClient.from("santri").select("nis,nama,foto_url,kelas,jurusan,alamat_lengkap").eq("kecamatan_id", kecId).limit(500);
        setDrawerItems((data as ISantri[]) ?? []);
        setDrawerOpen(true);
      });

      layersRef.current.polygon = polygon;
      scene.addLayer(polygon);
    } else {
      const points = new PointLayer({})
        .source(pointsFC, { parser: { type: "geojson" } })
        .shape("circle")
        .size(6)
        .color("#00e5ff")
        .style({ opacity: 0.95 });

      points.on("click", async ({ feature }: any) => {
        if (!feature || !feature.properties) return;
        const nis = feature.properties.nis;
        const { data } = await supabaseClient.from("santri").select("nis,nama,foto_url,kelas,jurusan,alamat_lengkap").eq("nis", nis).single();
        setDrawerItems(data ? [data as ISantri] : []);
        setDrawerOpen(true);
      });

      layersRef.current.points = points;
      scene.addLayer(points);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [santriWithCoords, choroplethGeoJSON, mode]);

  /* -------------------------
     Export PNG helper
     ------------------------- */
  const exportPNG = async () => {
    const scene = sceneRef.current;
    if (!scene) return;
    const mapInst = (scene as any).map;
    if (mapInst && typeof mapInst.getCanvas === "function") {
      const canvas: HTMLCanvasElement = mapInst.getCanvas();
      const url = canvas.toDataURL("image/png", 1.0);
      const a = document.createElement("a");
      a.href = url;
      a.download = `peta_santri_${new Date().toISOString()}.png`;
      a.click();
    }
  };

  return (
    <div className="relative w-full h-full map-container" style={{ minHeight: 480 }}>
      {/* map canvas container */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full" style={{ background: "#0b0e14" }} />

      {/* controls — zIndex tinggi so they are above map, but not full overlay */}
      <div style={{ position: "absolute", right: 18, top: 18, zIndex: 60 }}>
        <div className="map-sidebar p-4 rounded-2xl w-64 border border-white/10 shadow-2xl">
          <div className="mb-2 text-sm font-semibold text-white">Kontrol Cepat</div>
          <div className="flex flex-col gap-2">
            <Button className="neon-btn" onClick={exportPNG} block ghost type="primary">Export PNG</Button>
            <div className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest">
              {santriWithCoords.length} Data Terdeteksi
            </div>
            {loading && <Spin size="small" className="mt-2" />}
          </div>
        </div>
      </div>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={520}
        bodyStyle={{ background: "transparent" }} // correct prop
        style={{ zIndex: 1000 }}
      >
        <div className="map-popup-neon p-3 rounded-lg">
          <h3 className="text-lg text-white mb-4">Daftar Santri</h3>
          <List
            dataSource={drawerItems}
            renderItem={(item: ISantri) => (
              <List.Item>
                <List.Item.Meta
                  avatar={<Avatar src={item.foto_url ?? undefined} />}
                  title={<span className="text-white">{item.nama ?? item.nis}</span>}
                  description={
                    <div className="text-xs text-gray-300">
                      {item.kelas} • {item.jurusan}
                      <div className="text-[11px] opacity-70">{item.alamat_lengkap}</div>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </div>
      </Drawer>
    </div>
  );
}