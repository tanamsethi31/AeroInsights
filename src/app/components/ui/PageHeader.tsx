interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 600,
            color: "#0F172A",
            lineHeight: 1.3,
            margin: 0,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              fontSize: "0.875rem",
              color: "#475569",
              marginTop: "0.25rem",
              lineHeight: 1.6,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {children && <div className="flex items-center gap-2 flex-shrink-0">{children}</div>}
    </div>
  );
}
