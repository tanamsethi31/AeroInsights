import { useRef, useState, useLayoutEffect, type ReactNode, type CSSProperties } from "react";

interface PillTabsProps {
  /** Tab identifiers — also used as button keys */
  tabs: string[];
  activeTab: string;
  onChange: (tab: string) => void;
  /**
   * Optional custom label renderer.
   * Receives the tab id and whether it is currently active.
   * Defaults to rendering the tab string directly.
   */
  renderTab?: (tab: string, isActive: boolean) => ReactNode;
  style?: CSSProperties;
}

/**
 * Pill-shaped tab switcher with a sliding indicator.
 * The indicator slides via `transform: translateX()` (GPU-accelerated).
 * Position is measured with `useLayoutEffect` so there is zero flash on first render.
 * The outer wrapper scrolls horizontally when the tab list exceeds the container width.
 * The active tab is automatically scrolled into view on change.
 */
export function PillTabs({ tabs, activeTab, onChange, renderTab, style }: PillTabsProps) {
  const btnRefs   = useRef<Map<string, HTMLButtonElement>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);

  // Re-measure whenever the active tab or tab list changes.
  // useLayoutEffect runs synchronously before paint — no flicker.
  // Also scrolls the active tab into view within the horizontal overflow wrapper.
  useLayoutEffect(() => {
    const btn = btnRefs.current.get(activeTab);
    if (!btn) return;
    setPill({ x: btn.offsetLeft, w: btn.offsetWidth });

    // Keep active tab visible inside the scroll wrapper.
    const wrapper = scrollRef.current;
    if (!wrapper) return;
    const btnLeft  = btn.offsetLeft;
    const btnRight = btnLeft + btn.offsetWidth;
    const visLeft  = wrapper.scrollLeft;
    const visRight = visLeft + wrapper.offsetWidth;
    if (btnLeft < visLeft) {
      wrapper.scrollTo({ left: btnLeft - 8, behavior: "smooth" });
    } else if (btnRight > visRight) {
      wrapper.scrollTo({ left: btnRight - wrapper.offsetWidth + 8, behavior: "smooth" });
    }
  }, [activeTab, tabs]);

  return (
    // Outer wrapper: scrolls horizontally when tabs overflow the viewport width.
    // paddingBottom gives room for the pill's drop shadow to render unclipped.
    <div
      ref={scrollRef}
      className="pill-tabs-scroll"
      style={{
        overflowX: "auto",
        overflowY: "visible",
        paddingBottom: "2px",
        // Hide scrollbar visually while keeping scroll functionality.
        scrollbarWidth: "none",        // Firefox
        msOverflowStyle: "none",       // IE / Edge legacy
        ...style,
      }}
    >
    <div
      style={{
        position: "relative",
        display: "flex",
        gap: "4px",
        background: "#F1F5F9",
        border: "1px solid #E2E8F0",
        borderRadius: "9999px",
        padding: "4px",
        width: "fit-content",
      }}
    >
      {/* Sliding pill — absolutely positioned, pointer-events off so clicks fall through to buttons */}
      {pill && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "4px",
            left: 0,
            height: "calc(100% - 8px)",
            width: pill.w,
            borderRadius: "9999px",
            background: "#002147",
            boxShadow: "0 1px 4px rgba(0,33,71,0.18)",
            transform: `translateX(${pill.x}px)`,
            // translateX slides on the GPU; width transitions when tabs have different widths
            transition:
              "transform 220ms cubic-bezier(0.23,1,0.32,1), width 180ms cubic-bezier(0.23,1,0.32,1)",
            pointerEvents: "none",
          }}
        />
      )}

      {tabs.map((tab) => {
        const isActive = tab === activeTab;
        return (
          <button
            key={tab}
            ref={(el) => {
              if (el) btnRefs.current.set(tab, el);
              else btnRefs.current.delete(tab);
            }}
            onClick={() => onChange(tab)}
            style={{
              // z-index keeps labels above the pill so they read correctly
              position: "relative",
              zIndex: 1,
              padding: "7px 20px",
              borderRadius: "9999px",
              border: "none",
              background: "transparent",
              color: isActive ? "#FFFFFF" : "#64748B",
              fontSize: "13px",
              fontWeight: isActive ? 600 : 500,
              cursor: "pointer",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              transition: "color 180ms cubic-bezier(0.23,1,0.32,1)",
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.color = "#002147";
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.color = "#64748B";
            }}
          >
            {renderTab ? renderTab(tab, isActive) : tab}
          </button>
        );
      })}
    </div>
    </div>
  );
}
