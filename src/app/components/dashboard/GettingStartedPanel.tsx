// src/app/components/dashboard/GettingStartedPanel.tsx
import { useState } from "react";
import { useNavigate } from "react-router";
import { CheckCircle2, Circle, X, ChevronDown, ChevronUp } from "lucide-react";
import { useData } from "../../contexts/DataContext";

const ADMIN_ITEMS = [
  { id: "upload",    label: "Upload your portfolio",           href: "/onboarding" },
  { id: "invite",    label: "Invite team members",            href: "/settings/users" },
  { id: "ecl",       label: "Review ECL settings",            href: "/settings/ecl" },
  { id: "portfolio", label: "Explore the portfolio register", href: "/portfolio" },
  { id: "report",    label: "Schedule a recurring report",    href: "/reports/scheduled" },
];

const ANALYST_ITEMS = [
  { id: "portfolio", label: "Browse the portfolio register",  href: "/portfolio" },
  { id: "risk",      label: "Review risk & ECL summary",      href: "/risk-ecl" },
  { id: "scenario",  label: "Run your first stress scenario", href: "/scenarios/run" },
  { id: "watchlist", label: "Check the watchlist",            href: "/counterparties" },
  { id: "signals",   label: "Explore intelligence signals",   href: "/intelligence/signals" },
];

export function GettingStartedPanel() {
  const navigate = useNavigate();
  const { hasUpload } = useData();
  const role = localStorage.getItem("aero_onboarding_role") as "admin" | "analyst" | null;
  const [dismissed, setDismissed] = useState(localStorage.getItem("aero_gs_dismissed") === "true");
  const [collapsed, setCollapsed] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    const items = role === "admin" ? ADMIN_ITEMS : ANALYST_ITEMS;
    for (const item of items) {
      initial[item.id] = localStorage.getItem(`aero_gs_done_${item.id}`) === "true";
    }
    return initial;
  });

  if (!role || dismissed) return null;

  const items = role === "admin" ? ADMIN_ITEMS : ANALYST_ITEMS;

  // Admin: auto-check "upload" if hasUpload is true
  const effectiveChecked = { ...checked };
  if (role === "admin") effectiveChecked["upload"] = hasUpload;

  const doneCount = items.filter(it => effectiveChecked[it.id]).length;
  const pct = Math.round((doneCount / items.length) * 100);

  function handleDismiss() {
    localStorage.setItem("aero_gs_dismissed", "true");
    setDismissed(true);
  }

  function handleToggle(id: string) {
    if (role === "admin" && id === "upload") return; // auto-driven by hasUpload
    const next = !checked[id];
    localStorage.setItem(`aero_gs_done_${id}`, next ? "true" : "");
    setChecked(prev => ({ ...prev, [id]: next }));
  }

  function handleItemClick(item: { id: string; href: string }) {
    handleToggle(item.id);
    navigate(item.href);
  }

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "12px",
        padding: "0",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "#F8FAFC",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: collapsed ? "none" : "1px solid #E2E8F0",
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0F172A" }}>
            Getting Started
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "2px" }}>
            {doneCount} / {items.length} done · {role} setup
          </div>
        </div>

        {/* Progress bar */}
        <div
          style={{
            width: "100px",
            height: "4px",
            borderRadius: "2px",
            background: "#E2E8F0",
            margin: "0 12px",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              height: "100%",
              borderRadius: "2px",
              background: "#002147",
              width: `${pct}%`,
              transition: "width 400ms cubic-bezier(0.23,1,0.32,1)",
            }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(c => !c)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#94A3B8",
              display: "flex",
              alignItems: "center",
              padding: "4px",
              borderRadius: "4px",
            }}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
          {/* Dismiss */}
          <button
            onClick={handleDismiss}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#94A3B8",
              display: "flex",
              alignItems: "center",
              padding: "4px",
              borderRadius: "4px",
            }}
            title="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        doneCount === items.length ? (
          <div style={{ padding: "16px", textAlign: "center", color: "#15803D", fontWeight: 600, fontSize: "0.875rem" }}>
            🎉 All set! You've completed your setup.
          </div>
        ) : (
          <div>
            {items.map(item => {
              const done = effectiveChecked[item.id];
              return (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 16px",
                    cursor: "pointer",
                    borderBottom: "1px solid #F1F5F9",
                    transition: "background 120ms ease",
                  }}
                  onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = "#F8FAFC")}
                  onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
                >
                  {done ? (
                    <CheckCircle2 size={16} style={{ color: "#15803D", flexShrink: 0 }} />
                  ) : (
                    <Circle size={16} style={{ color: "#CBD5E1", flexShrink: 0 }} />
                  )}
                  <span
                    style={{
                      fontSize: "0.8125rem",
                      color: done ? "#94A3B8" : "#0F172A",
                      textDecoration: done ? "line-through" : "none",
                      flex: 1,
                    }}
                  >
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
