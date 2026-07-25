import { useEffect, useLayoutEffect, useRef } from "react";

/* Restore scroll position when a page remounts after the user navigated away.
 * The marketing site is an SPA: clicking a footer link to /privacy unmounts
 * Landing, and clicking the nav "Home" link mounts it again. By default the
 * second mount lands at the top of the page, which is jarring if the user
 * was deep in Pricing or FAQs. This hook keeps the last known scroll position
 * for a given route key in sessionStorage and seeks back to it on mount.
 *
 * It uses useLayoutEffect for the restore so the jump happens before paint
 * (no flash at the top). A throttled scroll listener writes the new position
 * back to storage as the user scrolls, plus a final write on pagehide for
 * hard navigations / tab close. Behaviour is set to "instant" so users do
 * not see an animated jump on every return.
 *
 * Storage is per tab (sessionStorage), so a fresh tab starts cleanly. */
export function useScrollRestore(key: string) {
  const storageKey = `scroll:${key}`;
  const targetRef = useRef<number>(0);
  const restoringUntilRef = useRef<number>(0);

  // Restore on mount, before paint. Also re-apply on a short timer because
  // late-loading content (images, marquee, fade-in groups) can shift layout
  // and bump the user away from the saved position; keep nudging back
  // through a grace window of ~800ms so the final resting position matches
  // where they left.
  useLayoutEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw == null) return;
      const y = Number(raw);
      if (!Number.isFinite(y) || y <= 0) return;
      targetRef.current = y;
      restoringUntilRef.current = performance.now() + 800;
      window.scrollTo({ top: y, left: 0, behavior: "instant" as ScrollBehavior });
      // Re-apply across the grace window to defeat layout shifts.
      const stamps = [50, 150, 300, 500, 800];
      const timers = stamps.map((t) =>
        window.setTimeout(() => {
          if (Math.abs(window.scrollY - y) > 4) {
            window.scrollTo({ top: y, left: 0, behavior: "instant" as ScrollBehavior });
          }
        }, t)
      );
      return () => timers.forEach((t) => clearTimeout(t));
    } catch {
      /* sessionStorage unavailable (private mode quota, SSR-ish) — skip */
    }
  }, [storageKey]);

  // Save continuously (throttled) while this page is mounted, plus on
  // pagehide so the final position is captured even on hard navigation.
  // Suppresses saves while a restore is in flight so transient layout
  // shifts during the grace window do not overwrite the saved position.
  useEffect(() => {
    let timer: number | null = null;

    const save = () => {
      if (performance.now() < restoringUntilRef.current) return;
      const y = window.scrollY;
      try {
        sessionStorage.setItem(storageKey, String(y));
      } catch {
        /* ignore */
      }
    };

    const onScroll = () => {
      if (timer != null) return;
      timer = window.setTimeout(() => {
        timer = null;
        save();
      }, 150);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", save);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", save);
      if (timer != null) clearTimeout(timer);
      save();
    };
  }, [storageKey]);
}
