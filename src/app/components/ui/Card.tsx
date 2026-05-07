interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
  headerRight?: React.ReactNode;
  noPadding?: boolean;
}

export function Card({ children, title, subtitle, className = "", headerRight, noPadding }: CardProps) {
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
      {(title || headerRight) && (
        <div
          className="flex items-center justify-between"
          style={{
            padding: "1rem 1.5rem",
            borderBottom: "1px solid #E2E8F0",
          }}
        >
          <div>
            {title && (
              <h3
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  color: "#0F172A",
                  margin: 0,
                  lineHeight: 1.4,
                }}
              >
                {title}
              </h3>
            )}
            {subtitle && (
              <p style={{ fontSize: "0.8125rem", color: "#94A3B8", margin: "0.125rem 0 0" }}>
                {subtitle}
              </p>
            )}
          </div>
          {headerRight && <div className="flex items-center gap-2">{headerRight}</div>}
        </div>
      )}
      <div style={noPadding ? {} : { padding: "1.5rem" }}>{children}</div>
    </div>
  );
}
