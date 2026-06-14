// src/app/components/tour/ReplayTourPill.tsx
//
// Bottom-right floating pill that replays the tour. Always visible
// (inside the app shell only) so users who dismissed the auto-tour
// can pick it back up at any time.

import { useTour } from "./TourProvider";

export function ReplayTourPill() {
  const { resetTour } = useTour();
  return (
    <button
      type="button"
      className="aero-replay-pill"
      onClick={resetTour}
      aria-label="Replay product tour"
      title="Replay product tour"
    >
      <span className="aero-replay-pill__icon" aria-hidden="true">↻</span>
      <span>Tour</span>
    </button>
  );
}
