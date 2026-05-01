type Stage = "1" | "2" | "3" | "neutral" | "green" | "amber" | "red";

interface StatusPillProps {
  stage?: Stage;
  label: string;
}

const stageStyles: Record<Stage, React.CSSProperties> = {
  "1": {
    background: "rgba(21, 128, 61, 0.1)",
    color: "#15803D",
    borderColor: "rgba(21, 128, 61, 0.3)",
  },
  "2": {
    background: "rgba(180, 83, 9, 0.1)",
    color: "#B45309",
    borderColor: "rgba(180, 83, 9, 0.3)",
  },
  "3": {
    background: "rgba(185, 28, 28, 0.1)",
    color: "#B91C1C",
    borderColor: "rgba(185, 28, 28, 0.3)",
  },
  green: {
    background: "rgba(21, 128, 61, 0.1)",
    color: "#15803D",
    borderColor: "rgba(21, 128, 61, 0.3)",
  },
  amber: {
    background: "rgba(180, 83, 9, 0.1)",
    color: "#B45309",
    borderColor: "rgba(180, 83, 9, 0.3)",
  },
  red: {
    background: "rgba(185, 28, 28, 0.1)",
    color: "#B91C1C",
    borderColor: "rgba(185, 28, 28, 0.3)",
  },
  neutral: {
    background: "#F4F5F7",
    color: "#475569",
    borderColor: "#E2E8F0",
  },
};

export function StatusPill({ stage = "neutral", label }: StatusPillProps) {
  const s = stageStyles[stage];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "0.25rem 0.625rem",
        borderRadius: "1rem",
        fontSize: "0.75rem",
        fontWeight: 500,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        border: "1px solid",
        whiteSpace: "nowrap",
        ...s,
      }}
    >
      {label}
    </span>
  );
}
