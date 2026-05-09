// src/app/components/onboarding/ConfirmationStep.tsx
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

const NEXT_STEPS: Record<"admin" | "analyst", string[]> = {
  admin: [
    "Invite your team from Settings → Users",
    "Configure ECL parameters in Settings → ECL",
    "Schedule your first board pack report",
    "Review the watchlist and set lessee stages",
  ],
  analyst: [
    "Browse your portfolio register",
    "Run a stress scenario in the Scenarios module",
    "Check the watchlist for high-risk lessees",
    "Explore intelligence signals and deal feed",
  ],
};

interface ConfirmationStepProps {
  importedCount: number | null; // null if user skipped upload
  role?: "admin" | "analyst";
  onGoToDashboard: () => void;
}

export function ConfirmationStep({ importedCount, role, onGoToDashboard }: ConfirmationStepProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", padding: "24px 0" }}>
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
      >
        <CheckCircle2 size={56} style={{ color: "#15803D" }} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        style={{ textAlign: "center" }}
      >
        <div style={{ fontWeight: 700, fontSize: "1.25rem", color: "#0F172A", marginBottom: "8px" }}>
          {importedCount ? "Your portfolio is live" : "You're all set"}
        </div>
        <div style={{ fontSize: "0.875rem", color: "#64748B", maxWidth: "360px", lineHeight: 1.6 }}>
          {importedCount
            ? `${importedCount} aircraft imported successfully. All pages now reflect your real portfolio data.`
            : "You can upload your portfolio data at any time from Settings or the Portfolio Hub."}
        </div>
      </motion.div>

      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.3 }}
        onClick={onGoToDashboard}
        style={{
          marginTop: "8px", padding: "12px 32px",
          background: "#002147", color: "#FFFFFF",
          border: "none", borderRadius: "8px",
          fontWeight: 700, fontSize: "0.9375rem", cursor: "pointer",
        }}
      >
        Go to Dashboard →
      </motion.button>

      {role && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          style={{ background: "#F8FAFC", borderRadius: "10px", padding: "14px 16px", width: "100%", maxWidth: "380px" }}
        >
          <div style={{ fontWeight: 600, fontSize: "0.8125rem", color: "#0F172A", marginBottom: "8px" }}>
            What's next for you:
          </div>
          {NEXT_STEPS[role].map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "4px 0", fontSize: "0.8125rem", color: "#475569" }}>
              <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#002147", marginTop: "7px", flexShrink: 0 }} />
              {item}
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
