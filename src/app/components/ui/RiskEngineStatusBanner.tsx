// src/app/components/ui/RiskEngineStatusBanner.tsx
//
// Shown near the top of pages that consume useRiskEngineECL, for orgs with
// a real uploaded portfolio only (demo orgs never see this — loading and
// error are both always false/null for them, so this renders nothing).
interface Props {
  loading: boolean;
  error: string | null;
}

export function RiskEngineStatusBanner({ loading, error }: Props) {
  if (loading) {
    return (
      <div role="status" style={{ fontSize: "0.8125rem", color: "#64748B", marginBottom: "0.75rem" }}>
        Computing live portfolio ECL…
      </div>
    );
  }
  if (error) {
    return (
      <div
        role="alert"
        style={{
          fontSize: "0.8125rem",
          color: "#92400E",
          background: "#FFFBEB",
          border: "1px solid #FDE68A",
          borderRadius: "0.5rem",
          padding: "0.5rem 0.75rem",
          marginBottom: "0.75rem",
        }}
      >
        Live ECL unavailable — showing estimated figures.
      </div>
    );
  }
  return null;
}
