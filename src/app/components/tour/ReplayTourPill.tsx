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
        width:        "34px",
        height:       "34px",
        display:      "flex",
        alignItems:   "center",
        justifyContent: "center",
        borderRadius: "6px",
        color:        hovered ? "#002147" : "#475569",
        background:   hovered ? "#F1F5F9" : "transparent",
        border:       "none",
        cursor:       "pointer",
        transition:   "background 90ms ease-out, color 90ms ease-out",
      }}
    >
      <RotateCcw size={18} />
    </button>
  );
}
