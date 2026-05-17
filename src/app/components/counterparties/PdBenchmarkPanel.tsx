// src/app/components/counterparties/PdBenchmarkPanel.tsx
import React from "react";
import {
  CARRIER_SEGMENT_LABELS,
  computeDeviation,
  type CarrierSegment,
  type PdCurveLibrary,
  type DeviationBand,
} from "../../data/pdCurves";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";

interface PdBenchmarkPanelProps {
  segment: CarrierSegment;
  pdEstimate: number | null;
  curves: PdCurveLibrary;
  isOverridden: boolean;
  onCustomise: () => void;
}

function fmt(v: number): string {
  return (v * 100).toFixed(2) + "%";
}

const BAND_CLASSES: Record<DeviationBand, string> = {
  green: "bg-green-500/15 text-green-400 border border-green-500/30",
  amber: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  red:   "bg-red-500/15 text-red-400 border border-red-500/30",
};

const BAND_ICONS: Record<DeviationBand, string> = {
  green: "✓",
  amber: "!",
  red:   "!!",
};

export function PdBenchmarkPanel({
  segment,
  pdEstimate,
  curves,
  isOverridden,
  onCustomise,
}: PdBenchmarkPanelProps) {
  const curve = curves[segment];
  const label = CARRIER_SEGMENT_LABELS[segment];

  const deviation =
    pdEstimate !== null
      ? computeDeviation(pdEstimate, curve.pd1yr, segment)
      : null;

  const tenors: { label: string; value: number; isOneYr: boolean }[] = [
    { label: "1-year",    value: curve.pd1yr,       isOneYr: true  },
    { label: "2-year",    value: curve.pd2yr,       isOneYr: false },
    { label: "3-year",    value: curve.pd3yr,       isOneYr: false },
    { label: "5-year",    value: curve.pd5yr,       isOneYr: false },
    { label: "Lifetime",  value: curve.pdLifetime,  isOneYr: false },
  ];

  return (
    <div className="mt-4 rounded-lg border border-gray-700/50 bg-[#1a1d2e] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700/50">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
            PD Benchmark
          </span>
          <span className="text-xs text-gray-500">·</span>
          <span className="text-xs text-gray-400">{label}</span>
        </div>
        {isOverridden && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 uppercase tracking-wider">
            Custom
          </span>
        )}
      </div>

      {/* Term structure table */}
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-700/30">
            <th className="text-left px-4 py-1.5 text-gray-500 font-medium">Tenor</th>
            <th className="text-right px-4 py-1.5 text-gray-500 font-medium">Benchmark</th>
            <th className="text-right px-4 py-1.5 text-gray-500 font-medium">Manual</th>
          </tr>
        </thead>
        <tbody>
          {tenors.map(({ label: tenorLabel, value, isOneYr }) => (
            <tr key={tenorLabel} className="border-b border-gray-700/20 last:border-0">
              <td className="px-4 py-1.5 text-gray-400">{tenorLabel}</td>
              <td className="px-4 py-1.5 text-right text-gray-300 tabular-nums">
                {fmt(value)}
              </td>
              <td className="px-4 py-1.5 text-right">
                {isOneYr && pdEstimate !== null ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-gray-300 tabular-nums">{fmt(pdEstimate)}</span>
                    {deviation && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={`text-[10px] font-bold px-1 py-0.5 rounded cursor-help ${BAND_CLASSES[deviation.band]}`}>
                            {BAND_ICONS[deviation.band]}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {deviation.description}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </span>
                ) : (
                  <span className="text-gray-600">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Source footer + customise link */}
      <div className="px-4 py-2 border-t border-gray-700/30 flex items-center justify-between">
        <p className="text-[10px] text-gray-600 leading-relaxed max-w-[70%]">
          Source: {curve.source} · Calibrated {curve.calibratedYear}
        </p>
        <button
          onClick={onCustomise}
          className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
        >
          Customise curves →
        </button>
      </div>
    </div>
  );
}
