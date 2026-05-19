// src/pages/components/map/MapScene.tsx
import React, { useEffect, useRef, useState } from "react";
import { Scene, Control } from "@antv/l7";
import { MapLibre } from "@antv/l7-maps";
import { HeatmapLayer, PointLayer, PolygonLayer } from "@antv/l7";
import maplibregl from "maplibre-gl";
import type { FeatureCollection, Geometry } from "geojson";
import 'maplibre-gl/dist/maplibre-gl.css';

import { ISantri } from "../../../types";
import { supabaseClient } from "../../../utility/supabaseClient";

import { Button, Drawer, List, Avatar, Spin } from "antd";
import "antd/dist/reset.css";
import "../../../styles/map.css";

export type MapMode = "heatmap" | "choropleth" | "points";
type NativeMapLibre = maplibregl.Map & {
  fitBounds?: (...args: any[]) => void;
  resize?: () => void;
  setStyle?: (...args: any[]) => void;
  triggerRepaint?: () => void;
};

const osmMapStyle = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
} as const;

const darkMapStyle = {
  version: 8,
  sources: {
    cartoDark: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    },
  },
  layers: [
    {
      id: "carto-dark",
      type: "raster",
      source: "cartoDark",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
} as const;

const mapStyleForTheme = (theme: "dark" | "light") => theme === "dark" ? darkMapStyle : osmMapStyle;

const getNativeMap = (scene: Scene | null): NativeMapLibre | null => {
  if (!scene) return null;
  const sceneMap = (scene as any).map;
  if (sceneMap?.getCanvas) return sceneMap as NativeMapLibre;
  if (sceneMap?.map?.getCanvas) return sceneMap.map as NativeMapLibre;
  if (sceneMap?.getMap?.()?.getCanvas) return sceneMap.getMap() as NativeMapLibre;
  return null;
};

const waitForMapPaint = (map: NativeMapLibre) =>
  new Promise<void>((resolve) => {
    let resolved = false;
    const done = () => {
      if (resolved) return;
      resolved = true;
      resolve();
    };

    try {
      map.once("idle", done);
      map.triggerRepaint?.();
      window.setTimeout(done, 900);
    } catch {
      done();
    }
  });

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
  const navigationControlAddedRef = useRef(false);

  const [santriWithCoords, setSantriWithCoords] = useState<ISantri[]>([]);
  const [choroplethGeoJSON, setChoroplethGeoJSON] = useState<FeatureCollection<Geometry, any> | null>(null);
  const layersRef = useRef<{ heatmap?: any; polygon?: any; points?: any }>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerItems, setDrawerItems] = useState<ISantri[]>([]);
  const [loading, setLoading] = useState(true);

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
        const arr = (data ?? [])
          .map((s: any) => ({
            ...s,
            latitude: Number(s.latitude),
            longitude: Number(s.longitude),
          }))
          .filter((s: any) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude));
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
        const { data: json, error } = await supabaseClient.functions.invoke("choropleth-aggregate", {
          body: {},
        });
        if (error) throw error;
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
        map: new MapLibre({
          center: [108.2207, -7.3274],
          zoom: 10,
          style: mapStyleForTheme(theme),
          pitch: 0,
          preserveDrawingBuffer: true,
        }),
        logoVisible: false,
      });
      sceneRef.current = scene;

      // Branding control (one time)
      scene.on("loaded", () => {
        const mapInst = getNativeMap(scene);
        if (mapInst && !navigationControlAddedRef.current) {
          mapInst.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
          navigationControlAddedRef.current = true;
        }

        const brandingControl = new Control({ position: "bottomright" });
        brandingControl.onAdd = () => {
          const el = document.createElement("div");
          el.className = "map-branding";
          el.innerText = "Alhasanah Admin — Peta Santri";
          el.style.pointerEvents = "none"; // make non-interactive
          return el;
        };
        scene.addControl(brandingControl);
        try {
          getNativeMap(scene)?.resize?.();
        } catch {
          // L7 may throw while the underlying map is still initializing.
        }
      });
    } else {
      try {
        const mapInst = getNativeMap(sceneRef.current);
        if (mapInst && typeof mapInst.setStyle === "function") {
          mapInst.setStyle(mapStyleForTheme(theme));
        }
        mapInst?.resize?.();
      } catch (e) {
        console.warn("map resize error:", e);
      }
    }

    // ResizeObserver ensures map resizes with layout changes
    if (containerRef.current && !resizeObserverRef.current) {
      const ro = new ResizeObserver(() => {
        if (sceneRef.current) {
          try {
            getNativeMap(sceneRef.current)?.resize?.();
          } catch {
            // Ignore transient resize errors during layout changes.
          }
        }
      });
      ro.observe(containerRef.current);
      resizeObserverRef.current = ro;
    }

    // cleanup only on unmount (do not destroy on theme change)
    return () => {
      if (resizeObserverRef.current && containerRef.current) {
        try {
          resizeObserverRef.current.unobserve(containerRef.current);
        } catch {
          // Observer cleanup is best effort on unmount.
        }
      }
      // If your app truly navigates away and you want to free memory, you can destroy here:
      // if (sceneRef.current) { sceneRef.current.destroy(); sceneRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef.current]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    try {
      const mapInst = getNativeMap(scene);
      if (mapInst && typeof mapInst.setStyle === "function") {
        mapInst.setStyle(mapStyleForTheme(theme));
      }
      if (mapInst && typeof mapInst.resize === "function") {
        mapInst.resize();
      }
    } catch (err) {
      console.warn("map theme style error:", err);
    }
  }, [theme]);

  /* -------------------------
     4. Render / update layers
     ------------------------- */
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // cleanup previous layers
    Object.values(layersRef.current).forEach((ly) => {
      try {
        if (ly) scene.removeLayer(ly);
      } catch {
        // Layer may already be detached by the map runtime.
      }
    });
    layersRef.current = {};

    const pointsFC = {
      type: "FeatureCollection" as const,
      features: santriWithCoords.map((s) => ({
        type: "Feature" as const,
        geometry: { type: "Point", coordinates: [s.longitude!, s.latitude!] } as Geometry,
        properties: { nis: s.nis, nama: s.nama, kelas: s.kelas, jurusan: s.jurusan, foto_url: s.foto_url, count: 1 },
      })),
    };
    const hasChoroplethFeatures = Boolean(choroplethGeoJSON?.features?.length);

    if (mode === "heatmap") {
      const heat = new HeatmapLayer({})
        .source(pointsFC, { parser: { type: "geojson" } })
        .size("count", [1, 2])
        .style({
          intensity: 2.0,
          radius: 20,
          rampColors: {
            colors: theme === "dark"
              ? ["#22d3ee", "#38bdf8", "#f59e0b", "#ef4444"]
              : ["#2563eb", "#06b6d4", "#f97316", "#dc2626"],
            positions: [0.01, 0.25, 0.55, 1.0],
          },
        });
      layersRef.current.heatmap = heat;
      scene.addLayer(heat);
    } else if (mode === "choropleth" && choroplethGeoJSON && hasChoroplethFeatures) {
      const polygon = new PolygonLayer({})
        .source(choroplethGeoJSON as any, { parser: { type: "geojson" } })
        .shape("fill")
        .color("santri_count", ["#081d58", "#225ea8", "#1d91c0", "#41b6c4", "#a1dab4", "#ffffcc"])
        .style({ opacity: 0.85 })
        .active(true);

      polygon.on("click", async ({ feature }: any) => {
        const kecId = feature.properties?.id ?? feature.properties?.kecamatan_id;
        if (!kecId) return;
        const { data } = await supabaseClient.from("santri").select("nis,nama,foto_url,kelas,jurusan").eq("kecamatan_id", kecId).limit(500);
        setDrawerItems((data as ISantri[]) ?? []);
        setDrawerOpen(true);
      });

      layersRef.current.polygon = polygon;
      scene.addLayer(polygon);
    } else {
      const points = new PointLayer({})
        .source(pointsFC, { parser: { type: "geojson" } })
        .shape("circle")
        .size(9)
        .color(theme === "dark" ? "#22d3ee" : "#0f766e")
        .active({ color: "#facc15" })
        .style({
          opacity: 0.96,
          stroke: theme === "dark" ? "#ecfeff" : "#ffffff",
          strokeWidth: 1.8,
        });

      points.on("click", async ({ feature }: any) => {
        if (!feature || !feature.properties) return;
        const nis = feature.properties.nis;
        const { data } = await supabaseClient.from("santri").select("nis,nama,foto_url,kelas,jurusan").eq("nis", nis).single();
        setDrawerItems(data ? [data as ISantri] : []);
        setDrawerOpen(true);
      });

      layersRef.current.points = points;
      scene.addLayer(points);
    }

    if (santriWithCoords.length > 0) {
      const lngs = santriWithCoords.map((s) => Number(s.longitude));
      const lats = santriWithCoords.map((s) => Number(s.latitude));
      const bounds = [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ];

      try {
        const mapInst = getNativeMap(scene);
        if (mapInst && typeof mapInst.fitBounds === "function") {
          mapInst.fitBounds(bounds, {
            padding: 80,
            maxZoom: santriWithCoords.length === 1 ? 13 : 11,
            duration: 600,
          });
        }
      } catch (err) {
        console.warn("map fit bounds error:", err);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [santriWithCoords, choroplethGeoJSON, mode, theme]);

  /* -------------------------
     Export PNG helper
     ------------------------- */
  const exportPNG = async () => {
    const scene = sceneRef.current;
    if (!scene) return;
    const mapInst = getNativeMap(scene);
    if (!mapInst || typeof mapInst.getCanvas !== "function") return;

    await waitForMapPaint(mapInst);

    const canvas = mapInst.getCanvas();
    const output = document.createElement("canvas");
    const scale = window.devicePixelRatio || 1;
    const width = canvas.width;
    const height = canvas.height;
    output.width = width;
    output.height = height;

    const ctx = output.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(canvas, 0, 0);

    const pad = 24 * scale;
    ctx.save();
    ctx.strokeStyle = "rgba(34, 211, 238, 0.9)";
    ctx.lineWidth = Math.max(2, 2 * scale);
    ctx.shadowColor = "rgba(34, 211, 238, 0.65)";
    ctx.shadowBlur = 18 * scale;
    ctx.strokeRect(pad, pad, width - pad * 2, height - pad * 2);

    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(2, 6, 23, 0.72)";
    ctx.fillRect(pad, pad, Math.min(430 * scale, width - pad * 2), 54 * scale);
    ctx.fillStyle = "#e0f2fe";
    ctx.font = `${14 * scale}px Inter, Arial, sans-serif`;
    ctx.fillText(`Peta Persebaran Santri - ${santriWithCoords.length} data`, pad + 16 * scale, pad + 34 * scale);
    ctx.restore();

    const url = output.toDataURL("image/png", 1.0);
    const a = document.createElement("a");
    a.href = url;
    a.download = `peta_santri_${new Date().toISOString()}.png`;
    a.click();
  };

  return (
    <div className="relative w-full h-full map-container map-cyber" data-map-theme={theme} style={{ minHeight: 480 }}>
      {/* map canvas container */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full" style={{ background: "#0b0e14" }} />

      <div className="map-cyber-grid" />
      <div className="map-scanline" />

      {/* controls — zIndex tinggi so they are above map, but not full overlay */}
      <div style={{ position: "absolute", right: 18, top: 18, zIndex: 60 }}>
        <div className="map-sidebar p-4 w-64 border border-white/10 shadow-2xl">
          <div className="mb-2 text-sm font-semibold text-white">Command Map</div>
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
          <h3 className="text-lg text-white mb-4">Ringkasan Santri</h3>
          <List
            dataSource={drawerItems}
            renderItem={(item: ISantri) => (
              <List.Item>
                <List.Item.Meta
                  avatar={<Avatar src={item.foto_url ?? undefined} />}
                  title={<span className="text-white">{item.nama || "Tanpa Nama"}</span>}
                  description={
                    <div className="text-xs text-gray-300">
                      {item.kelas} • {item.jurusan}
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
