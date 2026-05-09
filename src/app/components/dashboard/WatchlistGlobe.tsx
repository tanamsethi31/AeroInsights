// src/app/components/dashboard/WatchlistGlobe.tsx
import { useEffect, useRef, useState } from "react";
import createGlobe from "cobe";
import type { WatchlistStatusEntry } from "../counterparties/watchlistEngine";

// Country centroid coordinates [lat, lng]
const COUNTRY_COORDS: Record<string, [number, number]> = {
  India: [20.5937, 78.9629],
  Mexico: [23.6345, -102.5528],
  Brazil: [-14.235, -51.9253],
  "Sri Lanka": [7.8731, 80.7718],
  Canada: [56.1304, -106.3468],
  UAE: [23.4241, 53.8478],
  Ireland: [53.1424, -7.6921],
  Germany: [51.1657, 10.4515],
  France: [46.2276, 2.2137],
  "United Kingdom": [55.3781, -3.436],
  Singapore: [1.3521, 103.8198],
  "United States": [37.0902, -95.7129],
  Australia: [-25.2744, 133.7751],
  Japan: [36.2048, 138.2529],
  China: [35.8617, 104.1954],
  Indonesia: [-0.7893, 113.9213],
  Thailand: [15.87, 100.9925],
  Turkey: [38.9637, 35.2433],
  Spain: [40.4637, -3.7492],
  Italy: [41.8719, 12.5674],
  Netherlands: [52.1326, 5.2913],
};

const SIZE = 320;
const THETA = 0.3;

function project(
  lat: number,
  lon: number,
  phi: number,
  size: number,
): { x: number; y: number } | null {
  const lam = (lon * Math.PI) / 180;
  const p = (lat * Math.PI) / 180;

  const x = Math.cos(p) * Math.sin(lam);
  const y = Math.sin(p);
  const z = Math.cos(p) * Math.cos(lam);

  const cp = Math.cos(phi), sp = Math.sin(phi);
  const ct = Math.cos(THETA), st = Math.sin(THETA);

  const xr = x * cp - z * sp;
  const yr = x * sp * st + y * ct + z * cp * st;
  const zr = x * sp * ct - y * st + z * cp * ct;

  if (zr < 0.05) return null;
  return {
    x: ((xr + 1) / 2) * size,
    y: ((1 - yr) / 2) * size,
  };
}

function statusColor(s: string) {
  return s === "red" ? "#B91C1C" : s === "amber" ? "#B45309" : "#15803D";
}

interface Props {
  entries: WatchlistStatusEntry[];
}

export function WatchlistGlobe({ entries }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phi = useRef(0.6);
  const markerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lastPos = useRef<Record<string, { x: number; y: number }>>({});
  const [hovered, setHovered] = useState<string | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Auto-rotate stops on drag
  const pointerDown = useRef(false);
  const lastPointerX = useRef(0);

  useEffect(() => {
    if (!canvasRef.current) return;

    const cobeMarkers = entries
      .filter((e) => COUNTRY_COORDS[e.country])
      .map((e) => ({
        location: COUNTRY_COORDS[e.country] as [number, number],
        size: e.status === "red" ? 0.06 : e.status === "amber" ? 0.048 : 0.036,
      }));

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: SIZE * 2,
      height: SIZE * 2,
      phi: phi.current,
      theta: THETA,
      dark: 0,
      diffuse: 1.1,
      mapSamples: 20000,
      mapBrightness: 5,
      baseColor: [0.88, 0.91, 0.96],
      markerColor: [0.0, 0.13, 0.28],
      glowColor: [0.93, 0.96, 1.0],
      markers: cobeMarkers,
      onRender(state) {
        if (!pointerDown.current) phi.current += 0.0025;
        state.phi = phi.current;

        for (const entry of entries) {
          const coords = COUNTRY_COORDS[entry.country];
          const div = markerRefs.current[entry.lesseeId];
          if (!coords || !div) continue;

          const pos = project(coords[0], coords[1], phi.current, SIZE);
          if (pos) {
            lastPos.current[entry.lesseeId] = pos;
            div.style.display = "block";
            div.style.left = `${pos.x}px`;
            div.style.top = `${pos.y}px`;
          } else {
            div.style.display = "none";
          }
        }

        if (tooltipRef.current && hovered) {
          const p = lastPos.current[hovered];
          if (p) {
            tooltipRef.current.style.left = `${Math.min(p.x, SIZE - 175)}px`;
            tooltipRef.current.style.top = `${p.y - 76}px`;
          }
        }
      },
    });

    // Fade in
    requestAnimationFrame(() => {
      if (canvasRef.current) canvasRef.current.style.opacity = "1";
    });

    return () => globe.destroy();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  function onPointerDown(e: React.PointerEvent) {
    pointerDown.current = true;
    lastPointerX.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerUp() { pointerDown.current = false; }
  function onPointerMove(e: React.PointerEvent) {
    if (!pointerDown.current) return;
    const dx = e.clientX - lastPointerX.current;
    phi.current += dx * 0.005;
    lastPointerX.current = e.clientX;
  }

  const hoveredEntry = hovered ? entries.find((e) => e.lesseeId === hovered) : null;

  return (
    <div
      ref={wrapperRef}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}
    >
      <div style={{ position: "relative", width: SIZE, height: SIZE, cursor: "grab" }}>
        <canvas
          ref={canvasRef}
          width={SIZE * 2}
          height={SIZE * 2}
          style={{ width: SIZE, height: SIZE, opacity: 0, transition: "opacity 0.8s ease" }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerMove={onPointerMove}
        />

        {/* Overlay markers — positions updated directly by onRender, no React re-renders */}
        {entries.map((entry) => {
          if (!COUNTRY_COORDS[entry.country]) return null;
          const color = statusColor(entry.status);
          const isHovered = hovered === entry.lesseeId;
          return (
            <div
              key={entry.lesseeId}
              ref={(el) => { markerRefs.current[entry.lesseeId] = el; }}
              onMouseEnter={() => setHovered(entry.lesseeId)}
              onMouseLeave={() => setHovered(null)}
              style={{
                position: "absolute",
                transform: "translate(-50%, -50%)",
                width: isHovered ? 14 : 9,
                height: isHovered ? 14 : 9,
                borderRadius: "50%",
                background: color,
                border: `2px solid ${isHovered ? "#fff" : "rgba(255,255,255,0.75)"}`,
                boxShadow: isHovered ? `0 0 8px ${color}, 0 0 16px ${color}55` : `0 1px 3px rgba(0,0,0,0.18)`,
                cursor: "pointer",
                transition: "width 120ms ease, height 120ms ease, box-shadow 120ms ease",
                zIndex: isHovered ? 10 : 2,
                pointerEvents: "auto",
              }}
            />
          );
        })}

        {/* Tooltip */}
        {hoveredEntry && (
          <div
            ref={tooltipRef}
            style={{
              position: "absolute",
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderLeft: `3px solid ${statusColor(hoveredEntry.status)}`,
              borderRadius: "8px",
              padding: "8px 12px",
              fontSize: "0.75rem",
              boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
              zIndex: 20,
              width: "168px",
              pointerEvents: "none",
            }}
          >
            <div style={{ fontWeight: 700, color: "#0F172A", marginBottom: "3px", lineHeight: 1.3 }}>
              {hoveredEntry.lesseeName}
            </div>
            <div style={{ color: "#475569", lineHeight: 1.4, marginBottom: "4px" }}>
              {hoveredEntry.trigger}
            </div>
            <div
              style={{
                display: "inline-block",
                padding: "1px 7px",
                borderRadius: "9999px",
                fontSize: "0.6875rem",
                fontWeight: 600,
                background:
                  hoveredEntry.status === "red" ? "rgba(185,28,28,0.10)" :
                  hoveredEntry.status === "amber" ? "rgba(180,83,9,0.10)" : "rgba(21,128,61,0.10)",
                color: statusColor(hoveredEntry.status),
              }}
            >
              {hoveredEntry.status.charAt(0).toUpperCase() + hoveredEntry.status.slice(1)}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: "20px", fontSize: "0.75rem", color: "#64748B" }}>
        {(["red", "amber", "green"] as const).map((s) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: 9, height: 9, borderRadius: "50%", background: statusColor(s), flexShrink: 0 }} />
            {s === "red" ? "High Risk" : s === "amber" ? "Watch" : "Performing"}
          </div>
        ))}
      </div>
    </div>
  );
}
