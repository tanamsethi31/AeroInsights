// src/app/pages/scenarios/CalibrationToolsPage.tsx
//
// /scenarios/tools → Calibration Tools page. Houses the ten analysis sub-tabs
// from the old monolithic Scenarios page (Insolvency, Jurisdiction Risk,
// Asset Risk, Rating/PD, Security Deposits, Deferral Risk, Lessor Mitigation,
// Payment Behaviour, Concentration Stress, Lease Pricing) under one
// internal PillTabs switcher. Each sub-tab's "Use in Custom Builder"
// CTA navigates to /scenarios/build with the appropriate form inputs
// applied via the shared context.

import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { PageHeader } from "../../components/ui/PageHeader";
import { PillTabs } from "../../components/ui/PillTabs";
import { InsolvencyTab } from "../../components/scenarios/InsolvencyTab";
import { JurisdictionRiskTab } from "../../components/scenarios/JurisdictionRiskTab";
import { AssetRiskTab } from "../../components/scenarios/AssetRiskTab";
import { RatingPDTab } from "../../components/scenarios/RatingPDTab";
import { CreditDepositTab } from "../../components/scenarios/CreditDepositTab";
import { DeferralRiskTab } from "../../components/scenarios/DeferralRiskTab";
import { LessorMitigationTab } from "../../components/scenarios/LessorMitigationTab";
import { PaymentBehaviourTab } from "../../components/scenarios/PaymentBehaviourTab";
import { ConcentrationStressTab } from "../../components/scenarios/ConcentrationStressTab";
import { LeasePricingTab } from "../../components/scenarios/LeasePricingTab";
import { useScenariosContext } from "../../contexts/ScenariosContext";

const TOOL_TABS = [
  "Insolvency Regimes",
  "Jurisdiction Risk",
  "Asset Risk",
  "Rating / PD",
  "Security Deposits",
  "Deferral Risk",
  "Lessor Mitigation",
  "Payment Behaviour",
  "Concentration Stress",
  "Lease Pricing",
] as const;
type ToolTab = (typeof TOOL_TABS)[number];

// Maps URL hash (?tool=jurisdiction) → tab id.
const HASH_TAB: Record<string, ToolTab> = {
  insolvency: "Insolvency Regimes",
  jurisdiction: "Jurisdiction Risk",
  asset: "Asset Risk",
  rating: "Rating / PD",
  deposits: "Security Deposits",
  deferral: "Deferral Risk",
  mitigation: "Lessor Mitigation",
  payment: "Payment Behaviour",
  concentration: "Concentration Stress",
  pricing: "Lease Pricing",
};

export default function CalibrationToolsPage() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const ctx = useScenariosContext();
  const initial = (() => {
    const t = new URLSearchParams(search).get("tool");
    return (t && HASH_TAB[t]) ?? "Insolvency Regimes";
  })();
  const [active, setActive] = useState<ToolTab>(initial);

  // Sync ?tool=… query param so the user can deep-link / bookmark.
  useEffect(() => {
    const t = new URLSearchParams(search).get("tool");
    if (t && HASH_TAB[t]) setActive(HASH_TAB[t]);
  }, [search]);

  // Helper: "Use in Custom Builder" CTAs all funnel here.
  function useInBuilder(partial: Parameters<typeof ctx.updateFormInputs>[0]) {
    ctx.updateFormInputs(partial);
    navigate("/scenarios/build");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <PageHeader
        title="Calibration Tools"
        subtitle="Analyse and import portfolio-derived calibration into Custom Builder"
      />

      <PillTabs
        tabs={[...TOOL_TABS]}
        activeTab={active}
        onChange={(t) => setActive(t as ToolTab)}
        style={{ marginTop: "-1.5rem" }}
      />

      {active === "Insolvency Regimes" && <InsolvencyTab />}

      {active === "Jurisdiction Risk" && (
        <JurisdictionRiskTab
          onUseInCustomBuilder={(gold, nonCtc, repossMonths) => {
            useInBuilder({ ctcGoldPct: gold, nonCtcPct: nonCtc, repossWeightedMonths: repossMonths });
            ctx.setJurisdictionOpen(true);
          }}
        />
      )}

      {active === "Asset Risk" && (
        <AssetRiskTab
          onUseInCustomBuilder={(months, adj) => {
            useInBuilder({ remarketingMonths: months, lgdDecayAdjFactor: adj });
            ctx.setAssetRiskOpen(true);
          }}
        />
      )}

      {active === "Rating / PD" && (
        <RatingPDTab
          onUseInCustomBuilder={(s2Multi, s3Multi) => useInBuilder({ pdS2Multi: s2Multi, pdS3Multi: s3Multi })}
        />
      )}

      {active === "Security Deposits" && (
        <CreditDepositTab
          onUseInCustomBuilder={(cov) => useInBuilder({ depositCoverage: cov })}
        />
      )}

      {active === "Deferral Risk" && (
        <DeferralRiskTab
          onUseInCustomBuilder={(type, months, govtProb, forgiveness) =>
            useInBuilder({
              restructuringType: type,
              deferralMonths: months,
              govtSupportProb: govtProb,
              forgivenessRate: forgiveness,
            })
          }
        />
      )}

      {active === "Lessor Mitigation" && (
        <LessorMitigationTab
          onUseInCustomBuilder={(pbh, etp, lec) =>
            useInBuilder({ pbhConversionPct: pbh, etpRate: etp, lecRate: lec })
          }
        />
      )}

      {active === "Payment Behaviour" && (
        <PaymentBehaviourTab
          onUseInCustomBuilder={(coop, adv) =>
            useInBuilder({ payBehaviourCoopPct: coop, payBehaviourAdvPct: adv })
          }
        />
      )}

      {active === "Concentration Stress" && (
        <ConcentrationStressTab
          onUseInCustomBuilder={(pdS3Multi) => {
            useInBuilder({ pdS3Multi });
            ctx.setDistressOpen(true);
          }}
        />
      )}

      {active === "Lease Pricing" && <LeasePricingTab />}
    </div>
  );
}
