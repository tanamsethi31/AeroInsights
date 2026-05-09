// src/app/components/dashboard/WatchlistGlobe.tsx
import { useEffect, useRef, useState, useCallback } from "react";
import { geoOrthographic, geoPath, geoGraticule } from "d3-geo";
import { feature } from "topojson-client";
import type { WatchlistStatusEntry } from "../counterparties/watchlistEngine";

// ── World data (fetched once, cached) ─────────────────────────────────────────
let cachedWorld: GeoJSON.FeatureCollection | null = null;
let fetchPromise: Promise<GeoJSON.FeatureCollection> | null = null;

function loadWorld(): Promise<GeoJSON.FeatureCollection> {
  if (cachedWorld) return Promise.resolve(cachedWorld);
  if (!fetchPromise) {
    fetchPromise = fetch(
      "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json",
    )
      .then((r) => r.json())
      .then((topo) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fc = feature(topo as any, (topo as any).objects.countries) as GeoJSON.FeatureCollection;
        cachedWorld = fc;
        return fc;
      });
  }
  return fetchPromise;
}

// ── Country name → ISO numeric code mapping for highlight lookup ──────────────
const COUNTRY_ISO: Record<string, number[]> = {
  India:            [356],
  Mexico:           [484],
  Brazil:           [76],
  "Sri Lanka":      [144],
  Canada:           [124],
  UAE:              [784],
  Ireland:          [372],
  Germany:          [276],
  France:           [250],
  "United Kingdom": [826],
  Singapore:        [702],
  "United States":  [840],
  Australia:        [36],
  Japan:            [392],
  China:            [156],
};

// Country centroid [lon, lat] for auto-centering on load
const COUNTRY_CENTROID: Record<string, [number, number]> = {
  India:            [79, 21],
  Mexico:           [-102, 24],
  Brazil:           [-52, -14],
  "Sri Lanka":      [81, 8],
  Canada:           [-96, 60],
  UAE:              [54, 24],
  Ireland:          [-8, 53],
  Germany:          [10, 51],
  France:           [2, 47],
  "United Kingdom": [-3, 55],
  Singapore:        [104, 1],
  "United States":  [-98, 39],
  Australia:        [134, -26],
};

function statusColor(s: string): string {
  return s === "red" ? "#B91C1C" : s === "amber" ? "#B45309" : "#15803D";
}
function statusFill(s: string): string {
  return s === "red"   ? "rgba(185,28,28,0.30)" :
         s === "amber" ? "rgba(180,83,9,0.28)"  : "rgba(21,128,61,0.25)";
}

interface Props {
  entries: WatchlistStatusEntry[];
}

export function WatchlistGlobe({ entries }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const worldRef   = useRef<GeoJSON.FeatureCollection | null>(null);

  // Rotation state: [lon, lat]
  const rotation  = useRef<[number, number]>([-70, -15]);
  const dragging  = useRef(false);
  const lastXY    = useRef<[number, number]>([0, 0]);
  const rafId     = useRef<number>(0);
  const [hovered, setHovered] = useState<WatchlistStatusEntry | null>(null);
  const [ready,   setReady]   = useState(false);
  const [size,    setSize]    = useState(340);

  // ── Responsive size ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!wrapperRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      setSize(Math.max(260, Math.min(400, w - 32)));
    });
    ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Build highlight lookup ───────────────────────────────────────────────────
  const highlights = useCallback((): Map<number, WatchlistStatusEntry> => {
    const m = new Map<number, WatchlistStatusEntry>();
    for (const e of entries) {
      for (const code of COUNTRY_ISO[e.country] ?? []) {
        m.set(code, e);
      }
    }
    return m;
  }, [entries]);

  // ── Draw ─────────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const world  = worldRef.current;
    if (!canvas || !world) return;

    const ctx    = canvas.getContext("2d")!;
    const dpr    = window.devicePixelRatio || 1;
    const S      = size;
    canvas.width  = S * dpr;
    canvas.height = S * dpr;
    canvas.style.width  = `${S}px`;
    canvas.style.height = `${S}px`;
    ctx.scale(dpr, dpr);

    const projection = geoOrthographic()
      .scale(S / 2 - 6)
      .translate([S / 2, S / 2])
      .rotate(rotation.current)
      .clipAngle(90);

    const path      = geoPath(projection, ctx);
    const graticule = geoGraticule();
    const hl        = highlights();

    // Sphere background
    ctx.beginPath();
    path({ type: "Sphere" });
    ctx.fillStyle = "#EEF2F8";
    ctx.fill();

    // Graticule lines
    ctx.beginPath();
    path(graticule());
    ctx.strokeStyle = "rgba(100,116,139,0.12)";
    ctx.lineWidth   = 0.5;
    ctx.stroke();

    // Countries
    for (const f of world.features) {
      const code   = parseInt((f as GeoJSON.Feature).id as string, 10);
      const entry  = hl.get(code);
      ctx.beginPath();
      path(f as GeoJSON.Feature);
      if (entry) {
        ctx.fillStyle   = statusFill(entry.status);
        ctx.strokeStyle = statusColor(entry.status);
        ctx.lineWidth   = 1.2;
      } else {
        ctx.fillStyle   = "#D4DCE9";
        ctx.strokeStyle = "#B8C4D4";
        ctx.lineWidth   = 0.4;
      }
      ctx.fill();
      ctx.stroke();
    }

    // Sphere border
    ctx.beginPath();
    path({ type: "Sphere" });
    ctx.strokeStyle = "#94A3B8";
    ctx.lineWidth   = 1;
    ctx.stroke();
  }, [size, highlights]);

  // ── Load world + start render loop ──────────────────────────────────────────
  useEffect(() => {
    loadWorld().then((fc) => {
      worldRef.current = fc;
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    let stopped = false;
    function loop() {
      if (stopped) return;
      if (!dragging.current) {
        rotation.current[0] -= 0.12;
      }
      draw();
      rafId.current = requestAnimationFrame(loop);
    }
    rafId.current = requestAnimationFrame(loop);
    return () => { stopped = true; cancelAnimationFrame(rafId.current); };
  }, [ready, draw]);

  // ── Pointer events ───────────────────────────────────────────────────────────
  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    dragging.current = true;
    lastXY.current   = [e.clientX, e.clientY];
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dragging.current) {
      // Hover: detect which highlighted country is under cursor
      const canvas = canvasRef.current;
      if (!canvas || !worldRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const mx   = e.clientX - rect.left;
      const my   = e.clientY - rect.top;
      const proj = geoOrthographic()
        .scale(size / 2 - 6)
        .translate([size / 2, size / 2])
        .rotate(rotation.current)
        .clipAngle(90);
      const path = geoPath(proj);
      const hl   = highlights();
      let hit: WatchlistStatusEntry | null = null;
      // Check highlighted countries first (faster exit)
      for (const f of worldRef.current.features) {
        const code  = parseInt((f as GeoJSON.Feature).id as string, 10);
        const entry = hl.get(code);
        if (entry && path.measure(f as GeoJSON.Feature) > 0) {
          // Use point-in-path check via a temporary canvas
          const tmp = document.createElement("canvas");
          tmp.width  = size;
          tmp.height = size;
          const tc   = tmp.getContext("2d")!;
          const tp   = geoPath(proj, tc);
          tc.beginPath();
          tp(f as GeoJSON.Feature);
          if (tc.isPointInPath(mx, my)) { hit = entry; break; }
        }
      }
      setHovered(hit);
      return;
    }
    const dx = (e.clientX - lastXY.current[0]) * 0.4;
    const dy = (e.clientY - lastXY.current[1]) * 0.4;
    rotation.current[0] += dx;
    rotation.current[1] -= dy;
    rotation.current[1]  = Math.max(-80, Math.min(80, rotation.current[1]));
    lastXY.current = [e.clientX, e.clientY];
  }

  function onPointerUp() {
    dragging.current = false;
  }

  // ── Mouse tooltip position ────────────────────────────────────────────────────
  const [mousePos, setMousePos] = useState<[number, number]>([0, 0]);
  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    setMousePos([e.clientX - rect.left, e.clientY - rect.top]);
  }

  return (
    <div ref={wrapperRef} style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
      <div style={{ position: "relative", userSelect: "none" }}>
        <canvas
          ref={canvasRef}
          style={{
            cursor: dragging.current ? "grabbing" : "grab",
            display: "block",
            filter: "drop-shadow(0 8px 24px rgba(0,33,71,0.18))",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onMouseMove={onMouseMove}
          onMouseLeave={() => setHovered(null)}
        />

        {!ready && (
          <div style={{
            position: "absolute", inset: 0, display: "flex",
            alignItems: "center", justifyContent: "center",
            fontSize: "0.75rem", color: "#94A3B8",
          }}>
            Loading map…
          </div>
        )}

        {/* Tooltip */}
        {hovered && (
          <div
            style={{
              position: "absolute",
              left: Math.min(mousePos[0] + 12, size - 185),
              top:  Math.max(mousePos[1] - 70, 4),
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderLeft: `3px solid ${statusColor(hovered.status)}`,
              borderRadius: "8px",
              padding: "8px 12px",
              fontSize: "0.75rem",
              boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
              zIndex: 20,
              width: "175px",
              pointerEvents: "none",
            }}
          >
            <div style={{ fontWeight: 700, color: "#0F172A", marginBottom: "2px" }}>
              {hovered.lesseeName}
            </div>
            <div style={{ color: "#475569", marginBottom: "5px", lineHeight: 1.4 }}>
              {hovered.trigger}
            </div>
            <span style={{
              display: "inline-block", padding: "1px 8px",
              borderRadius: "9999px", fontSize: "0.6875rem", fontWeight: 600,
              background: statusFill(hovered.status),
              color: statusColor(hovered.status),
            }}>
              {hovered.status.charAt(0).toUpperCase() + hovered.status.slice(1)}
            </span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: "20px", fontSize: "0.75rem", color: "#64748B" }}>
        {(["red", "amber", "green"] as const).map((s) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: 10, height: 10, borderRadius: "2px", background: statusFill(s), border: `1.5px solid ${statusColor(s)}`, flexShrink: 0 }} />
            {s === "red" ? "High Risk" : s === "amber" ? "Watch" : "Performing"}
          </div>
        ))}
      </div>
    </div>
  );
}
