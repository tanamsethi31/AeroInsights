// src/app/components/onboarding/OnboardingWizard.tsx
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router";
import { useAuth0 } from "@auth0/auth0-react";
import { ArrowLeft } from "lucide-react";
import { OrgSetupStep } from "./OrgSetupStep";
import { InviteTeamStep } from "./InviteTeamStep";
import { UploadStep } from "./UploadStep";
import { ConfirmationStep } from "./ConfirmationStep";
import { useData } from "../../contexts/DataContext";

type OnboardingStep = "org" | "invite" | "upload" | "done";

const STEP_LABELS: Record<OnboardingStep, string> = {
  org: "Set up your organisation",
  invite: "Invite your team",
  upload: "Upload your portfolio",
  done: "You're all set",
};

const STEPS: OnboardingStep[] = ["org", "invite", "upload", "done"];

export function OnboardingWizard() {
  const { user } = useAuth0();
  const navigate = useNavigate();
  const location = useLocation();
  const { refetchUploadStatus } = useData();

  // When the user arrives via "Upload Your Portfolio" card, the upload step
  // expands to a 2-column layout with a required-columns reference sidebar.
  const templateMode = (location.state as { templateMode?: boolean } | null)?.templateMode === true;

  const [step, setStep] = React.useState<OnboardingStep>("org");
  const [orgId, setOrgId] = React.useState<string | null>(null);
  const [importedCount, setImportedCount] = React.useState<number | null>(null);
  const [role, setRole] = React.useState<"admin" | "analyst">("admin");

  const stepIndex = STEPS.indexOf(step);

  async function handleUploadComplete(uploadId: string, count: number) {
    setImportedCount(count);
    await refetchUploadStatus();
    setStep("done");
  }

  function handleGoToDashboard() {
    localStorage.setItem("aero_onboarding_role", role);
    localStorage.removeItem("aero_gs_dismissed");
    // Hard reload so DataContext re-runs resolveOrg with the newly-created
    // org_members row in scope. A SPA navigate() would keep the stale
    // orgId=null in context and show demo data on the dashboard.
    window.location.assign("/");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #001830 0%, #002147 60%, #003175 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
        style={{
          background: "#FFFFFF",
          borderRadius: "16px",
          width: "100%",
          // Expand the wizard on the upload step in template mode so the
          // columns-reference sidebar fits next to the dropzone.
          maxWidth: step === "upload" && templateMode ? "960px" : "560px",
          maxHeight: "92vh",
          transition: "max-width 280ms cubic-bezier(0.23,1,0.32,1)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.45), 0 8px 24px rgba(0,0,0,0.28)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{ background: "#002147", padding: "24px 28px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ fontWeight: 800, fontSize: "1.25rem", color: "#FFFFFF", letterSpacing: "-0.02em" }}>
                Aeroinsights
              </div>
              <div style={{ fontSize: "0.6875rem", background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.85)", borderRadius: "10px", padding: "2px 8px", fontWeight: 600 }}>
                Setup
              </div>
            </div>
            <button
              onClick={() => navigate("/portfolios")}
              style={{
                display: "flex", alignItems: "center", gap: "5px",
                background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: "6px", padding: "5px 10px",
                fontSize: "0.75rem", fontWeight: 500, color: "rgba(255,255,255,0.85)",
                cursor: "pointer", flexShrink: 0,
                transition: "background 150ms",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.18)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.10)")}
            >
              <ArrowLeft size={12} />
              Portfolios
            </button>
          </div>
          <div style={{ fontWeight: 600, fontSize: "1.0625rem", color: "#FFFFFF", marginBottom: "4px" }}>
            {STEP_LABELS[step]}
          </div>
          {/* Progress */}
          <div style={{ display: "flex", gap: "6px", marginTop: "14px" }}>
            {STEPS.map((s, i) => (
              <div
                key={s}
                style={{
                  flex: 1, height: "4px", borderRadius: "2px",
                  background: i <= stepIndex ? "#FFFFFF" : "rgba(255,255,255,0.25)",
                  transition: "background 350ms",
                }}
              />
            ))}
          </div>
        </div>

        {/* Step content */}
        <div style={{ padding: "28px", overflowY: "auto", flex: 1, minHeight: 0 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
            >
              {step === "org" && (
                <OrgSetupStep
                  userId={user?.sub ?? ""}
                  onComplete={(id, r) => { setOrgId(id); setRole(r); setStep("invite"); }}
                />
              )}
              {step === "invite" && (
                <InviteTeamStep
                  onContinue={() => setStep("upload")}
                  onSkip={() => setStep("upload")}
                />
              )}
              {step === "upload" && orgId && (
                <UploadStep
                  orgId={orgId}
                  templateMode={templateMode}
                  onComplete={handleUploadComplete}
                  onSkip={() => setStep("done")}
                />
              )}
              {step === "done" && (
                <ConfirmationStep
                  importedCount={importedCount}
                  role={role}
                  onGoToDashboard={handleGoToDashboard}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
