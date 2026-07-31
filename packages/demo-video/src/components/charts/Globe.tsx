import React, {useState, useEffect, useMemo} from 'react';
import {useCurrentFrame, interpolate, staticFile, delayRender, continueRender} from 'remotion';
import {geoOrthographic, geoPath, geoGraticule, geoDistance} from 'd3-geo';
import {feature} from 'topojson-client';
import {COLORS, statusColor, statusFill, RiskStatus} from '../../theme/tokens';

const COUNTRY_ISO: Record<string, number> = {
  India: 356, Mexico: 484, Brazil: 76, 'Sri Lanka': 144, Canada: 124, UAE: 784,
  Ireland: 372, Germany: 276, France: 250, 'United Kingdom': 826, Singapore: 702,
  'United States': 840, Australia: 36, Japan: 392, China: 156,
};
const CENTROID: Record<string, [number, number]> = {
  India: [79, 21], Mexico: [-102, 24], Brazil: [-52, -14], 'Sri Lanka': [81, 8],
  Ireland: [-8, 53], 'United Kingdom': [-3, 55], Singapore: [104, 1], 'United States': [-98, 39],
  Germany: [10, 51], France: [2, 47], Japan: [138, 37], Australia: [134, -26],
  UAE: [54, 24], Canada: [-96, 60], China: [104, 35],
};

export const Globe: React.FC<{
  size?: number;
  markers: {country: string; status: RiskStatus}[];
}> = ({size = 460, markers}) => {
  const frame = useCurrentFrame();
  const [world, setWorld] = useState<any>(null);

  useEffect(() => {
    const h = delayRender('Loading world atlas');
    fetch(staticFile('countries-110m.json'))
      .then((r) => r.json())
      .then((topo) => { setWorld(feature(topo, topo.objects.countries)); continueRender(h); })
      .catch(() => continueRender(h));
  }, []);

  const rotateLon = interpolate(frame, [0, 420], [-70, -40]); // slow drift
  const rotate: [number, number] = [rotateLon, -15];
  const proj = useMemo(
    () => geoOrthographic().scale(size / 2 - 6).translate([size / 2, size / 2]).rotate(rotate),
    [rotateLon, size],
  );
  const path = geoPath(proj) as any;
  const center: [number, number] = [-rotate[0], -rotate[1]];
  const flagged = new Map(markers.map((m) => [COUNTRY_ISO[m.country], m.status]));

  if (!world) return <div style={{width: size, height: size}} />;

  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={size / 2 - 6} fill="#eef3fb" stroke={COLORS.line} />
      <path d={path(geoGraticule()()) || ''} fill="none" stroke="rgba(0,33,71,0.08)" />
      {world.features.map((f: any, i: number) => {
        const id = Number(f.id);
        const st = flagged.get(id) as RiskStatus | undefined;
        return <path key={i} d={path(f) || ''} fill={st ? statusFill(st) : '#dbe5f4'} stroke="#c3d2e8" strokeWidth={0.5} />;
      })}
      {markers.map((m) => {
        const c = CENTROID[m.country];
        if (!c) return null;
        if (geoDistance(c, center) > Math.PI / 2) return null; // far side — cull
        const pt = proj(c);
        if (!pt) return null;
        const pulse = 1 + 0.4 * Math.sin(frame / 12 + (COUNTRY_ISO[m.country] || 0));
        return <circle key={m.country} cx={pt[0]} cy={pt[1]} r={5 * pulse} fill={statusColor(m.status)} opacity={0.9} />;
      })}
    </svg>
  );
};
