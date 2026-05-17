// src/app/components/counterparties/CarrierSegmentSelector.tsx
import React from "react";
import { CARRIER_SEGMENT_LABELS, type CarrierSegment } from "../../data/pdCurves";

interface CarrierSegmentSelectorProps {
  value: CarrierSegment | null;
  onChange: (segment: CarrierSegment | null) => void;
  disabled?: boolean;
}

export function CarrierSegmentSelector({
  value,
  onChange,
  disabled = false,
}: CarrierSegmentSelectorProps) {
  const segments: CarrierSegment[] = ["network", "lcc", "regional", "charter"];

  return (
    <div className="mt-2">
      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
        Carrier Type
      </label>
      <select
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : (v as CarrierSegment));
        }}
        disabled={disabled}
        className="w-full bg-[#1a1d2e] border border-gray-700/50 text-sm rounded px-2 py-1.5 text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="">Assign carrier type…</option>
        {segments.map((seg) => (
          <option key={seg} value={seg}>
            {CARRIER_SEGMENT_LABELS[seg]}
          </option>
        ))}
      </select>
    </div>
  );
}
