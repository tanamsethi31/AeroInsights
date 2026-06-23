// src/app/components/tour/ReplayTourPill.tsx
//
// Header icon button that replays the tour. Lives in the right-side
// header cluster next to the alerts bell — matches its 34x34 / hover
// behaviour so the two read as siblings.

import * as React from "react";
import { RotateCcw } from "lucide-react";
import { useTour } from "./TourProvider";

export function ReplayTourPill() {
  const { resetTour } = useTour();
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      type="button"
      className="aero-replay-pill"
      onClick={resetTour}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label="Replay product tour"
      title="Replay product tour"
      style={{
        height:       "34px",
        display:      "inline-flex",
        alignItems:   "center",
        gap:          "0.4rem",
        padding:      "0 0.85rem",
        borderRadius: "9999px",
        color:        hovered ? "#002147" : "#475569",
        background:   hovered ? "#F1F5F9" : "transparent",
        border:       `1px solid ${hovered ? "rgba(0,33,71,0.22)" : "#E2E8F0"}`,
        cursor:       "pointer",
        fontFamily:   "inherit",
        fontSize:     "0.8125rem",
        fontWeight:   600,
        letterSpacing: "0.01em",
        transition:   "background 90ms ease-out, color 90ms ease-out, border-color 90ms ease-out",
      }}
    >
      <RotateCcw size={14} />
      <span>Tour</span>
    </button>
  );
}
