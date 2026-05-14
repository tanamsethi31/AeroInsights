import * as React from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
  headerRight?: React.ReactNode;
  noPadding?: boolean;
  /** When true the card body can be toggled open/closed via a chevron button. */
  collapsible?: boolean;
  /**
   * Initial collapsed state. If this changes (e.g. the user switches modes)
   * the card resets to the new default so exec-mode collapses and analyst
   * re-expands automatically — unless the user has manually overridden it.
   */
  defaultCollapsed?: boolean;
  /** Oxford blue header with white text. */
  blueHeader?: boolean;
}

export function Card({
  children,
  title,
  subtitle,
  className = "",
  headerRight,
  noPadding,
  collapsible,
  defaultCollapsed = false,
  blueHeader = true,
}: CardProps) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

  // Sync when the caller changes defaultCollapsed (mode toggle, etc.)
  React.useEffect(() => {
    setCollapsed(defaultCollapsed);
  }, [defaultCollapsed]);

  const hasHeader = !!(title || headerRight || collapsible);

  return (
    <div
      className={className}
      style={{
        background: "#FFFFFF",
        borderRadius: "var(--radius-lg)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        border: "1px solid #E2E8F0",
        overflow: "hidden",
      }}
    >
      {hasHeader && (
        <div
          className="flex items-center justify-between"
          style={{
            padding: "1rem 1.5rem",
            background: blueHeader ? "#002147" : undefined,
            borderBottom: blueHeader ? "none" : (collapsed ? "none" : "1px solid #E2E8F0"),
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            {title && (
              <h3
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  color: blueHeader ? "#FFFFFF" : "#0F172A",
                  margin: 0,
                  lineHeight: 1.4,
                }}
              >
                {title}
              </h3>
            )}
            {subtitle && (
              <p style={{ fontSize: "0.8125rem", color: blueHeader ? "rgba(255,255,255,0.55)" : "#94A3B8", margin: "0.125rem 0 0" }}>
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {headerRight && (
              <div className="flex items-center gap-2">{headerRight}</div>
            )}
            {collapsible && (
              <button
                onClick={() => setCollapsed((c) => !c)}
                aria-label={collapsed ? "Expand section" : "Collapse section"}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px",
                  display: "flex",
                  alignItems: "center",
                  color: blueHeader ? "rgba(255,255,255,0.65)" : "#94A3B8",
                  flexShrink: 0,
                }}
              >
                <ChevronDown
                  size={15}
                  style={{
                    transform: collapsed ? "rotate(0deg)" : "rotate(180deg)",
                    transition: "transform 220ms cubic-bezier(0.23,1,0.32,1)",
                  }}
                />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Animated collapse — overflow:hidden on wrapper clips height smoothly */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="card-body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div style={noPadding ? {} : { padding: "1.5rem" }}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
