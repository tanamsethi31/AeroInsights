// src/app/components/onboarding/ConfirmationStep.tsx
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

interface ConfirmationStepProps {
  importedCount: number | null; // null if user skipped upload
  onGoToDashboard: () => void;
}

export function ConfirmationStep({ importedCount, onGoToDashboard }: ConfirmationStepProps) {
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
    </div>
  );
}
