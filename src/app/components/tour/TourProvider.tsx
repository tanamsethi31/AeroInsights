// src/app/components/tour/TourProvider.tsx
//
// Manages the sample-portfolio guided tour. Exposes startTour() / status
// via context so any page (and the replay pill) can trigger it.
//
// Cross-page steps: when the next step's `path` differs from the current
// route, we navigate first and use a MutationObserver to wait for the
// target element to mount before advancing the driver instance.

import * as React from "react";
import { useLocation, useNavigate } from "react-router";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { usePortfolio } from "../../contexts/PortfolioContext";
import { useViewMode } from "../../contexts/ViewModeContext";
import { TOUR_STEPS, TOUR_VERSION_KEY, type TourStep } from "./tourSteps";
import "./tour.css";

const SAMPLE_ID = "global-sample";

interface TourContextValue {
  isCompleted: boolean;
  startTour: () => void;
  resetTour: () => void;
}

const TourContext = React.createContext<TourContextValue>({
  isCompleted: false,
  startTour: () => {},
  resetTour: () => {},
});

export function useTour(): TourContextValue {
  return React.useContext(TourContext);
}

// Wait for a CSS selector to appear in the DOM. Resolves the element or
// null after `timeoutMs`. Used between cross-page steps so the driver
// doesn't try to highlight an element that hasn't mounted yet.
function waitForSelector(selector: string, timeoutMs = 4000): Promise<Element | null> {
  return new Promise((resolve) => {
    const existing = document.querySelector(selector);
    if (existing) return resolve(existing);
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeoutMs);
  });
}

function getStored(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(TOUR_VERSION_KEY) === "1";
}

function setStored(done: boolean): void {
  if (typeof window === "undefined") return;
  if (done) localStorage.setItem(TOUR_VERSION_KEY, "1");
  else localStorage.removeItem(TOUR_VERSION_KEY);
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { activePortfolioId } = usePortfolio();
  const { setIsExecutiveMode } = useViewMode();
  const driverRef = React.useRef<Driver | null>(null);
  const stepIndexRef = React.useRef(0);
  const [isCompleted, setIsCompleted] = React.useState(getStored);

  // Keep refs reading the freshest location so callbacks below close
  // over the right value even after route changes.
  const navigateRef = React.useRef(navigate);
  const locationRef = React.useRef(location);
  React.useEffect(() => { navigateRef.current = navigate; }, [navigate]);
  React.useEffect(() => { locationRef.current = location; }, [location]);

  const finish = React.useCallback((markCompleted: boolean) => {
    if (markCompleted) {
      setStored(true);
      setIsCompleted(true);
    }
    driverRef.current?.destroy();
    driverRef.current = null;
    stepIndexRef.current = 0;
  }, []);

  // Move to the next step. If the next step lives on a different route
  // we navigate there first. If the anchor element doesn't exist within
  // the timeout (e.g. collapsed section, inactive tab) we SKIP that step
  // rather than killing the tour — silent death was the reported bug.
  const advance = React.useCallback(async () => {
    let i = stepIndexRef.current;
    while (true) {
      const nextIndex = i + 1;
      if (nextIndex >= TOUR_STEPS.length) {
        finish(true);
        return;
      }
      const next = TOUR_STEPS[nextIndex];
      const onTargetRoute = locationRef.current.pathname === next.path
        || locationRef.current.pathname.startsWith(next.path + "/");
      if (!onTargetRoute) {
        navigateRef.current(next.path);
      }
      const el = await waitForSelector(next.selector, 2500);
      if (el) {
        stepIndexRef.current = nextIndex;
        driverRef.current?.moveNext();
        return;
      }
      // Anchor never appeared — log + skip forward instead of closing.
      // eslint-disable-next-line no-console
      console.warn(`[tour] step ${nextIndex} anchor missing (${next.selector}), skipping`);
      // Advance driver's internal cursor too so a future moveNext() lands
      // on the right step.
      driverRef.current?.moveNext();
      i = nextIndex;
    }
  }, [finish]);

  const startTour = React.useCallback(() => {
    if (driverRef.current) driverRef.current.destroy();
    stepIndexRef.current = 0;
    // Force Executive Mode off for the duration of the tour — that mode
    // collapses the Charts & Analysis section, which would hide the step
    // 2 anchor. Users who genuinely prefer Executive Mode can flip it
    // back on from the toggle once the tour finishes.
    setIsExecutiveMode(false);

    const driverSteps = TOUR_STEPS.map((s: TourStep) => ({
      element: s.selector,
      popover: {
        title: s.title,
        description: s.description,
        side: s.side ?? "bottom",
        align: s.align ?? "center",
      },
    }));

    const inst = driver({
      showProgress: true,
      progressText: "Step {{current}} of {{total}}",
      nextBtnText:  "Next →",
      prevBtnText:  "← Back",
      doneBtnText:  "Done",
      allowClose:        true,
      disableActiveInteraction: true,
      animate:           true,
      smoothScroll:      true,
      overlayColor:      "rgba(2, 17, 36, 0.72)",
      stagePadding:      6,
      stageRadius:       8,
      popoverClass:      "aero-tour-popover",
      onNextClick:       () => { void advance(); },
      onPrevClick:       () => {
        const prev = stepIndexRef.current - 1;
        if (prev < 0) return;
        stepIndexRef.current = prev;
        const step = TOUR_STEPS[prev];
        if (locationRef.current.pathname !== step.path) {
          navigateRef.current(step.path);
          void waitForSelector(step.selector).then(() => driverRef.current?.movePrevious());
        } else {
          driverRef.current?.movePrevious();
        }
      },
      onCloseClick:      () => finish(true),
      onDestroyStarted:  () => {
        // Mark completed when the user reaches the last step's Done.
        if (stepIndexRef.current >= TOUR_STEPS.length - 1) setStored(true);
        if (driverRef.current?.hasNextStep() === false) {
          setStored(true);
          setIsCompleted(true);
        }
        driverRef.current?.destroy();
      },
      steps: driverSteps,
    });

    driverRef.current = inst;
    // Make sure the first anchor exists before we open.
    void waitForSelector(TOUR_STEPS[0].selector).then((el) => {
      if (!el) return finish(false);
      inst.drive();
    });
  }, [advance, finish]);

  const resetTour = React.useCallback(() => {
    setStored(false);
    setIsCompleted(false);
    startTour();
  }, [startTour]);

  // Auto-start on first visit to the sample portfolio. Defer by ~700ms
  // so Dashboard's first paint settles before the overlay shows.
  const autoStartedRef = React.useRef(false);
  React.useEffect(() => {
    if (autoStartedRef.current) return;
    if (isCompleted) return;
    if (activePortfolioId !== SAMPLE_ID) return;
    autoStartedRef.current = true;
    const t = window.setTimeout(() => startTour(), 700);
    return () => window.clearTimeout(t);
  }, [activePortfolioId, isCompleted, startTour]);

  // Clean up on unmount.
  React.useEffect(() => () => { driverRef.current?.destroy(); }, []);

  const value = React.useMemo<TourContextValue>(
    () => ({ isCompleted, startTour, resetTour }),
    [isCompleted, startTour, resetTour],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}
