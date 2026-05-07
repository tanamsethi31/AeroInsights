// src/app/data/alertsData.ts

export type AlertSeverity = "red" | "amber" | "green";

export type AlertType =
  | "stage_migration"
  | "watchlist_elevation"
  | "ecl_threshold"
  | "signal_severity"
  | "jurisdiction_risk"
  | "fuel_stress"
  | "composite_signal";

export interface AlertItem {
  id: string;
  ruleType: AlertType;
  severity: AlertSeverity;
  title: string;
  body: string;
  entityType?: "lessee" | "lease" | "portfolio";
  entityId?: string;
  isRead: boolean;
  createdAt: string; // ISO-8601
}

export interface AlertRuleConfig {
  id: string;
  ruleType: AlertType;
  label: string;
  description: string;
  isEnabled: boolean;
  threshold: Record<string, number | string>;
}

// ── Mock alert rules (user-configurable thresholds) ───────────────────────────

export const DEFAULT_ALERT_RULES: AlertRuleConfig[] = [
  {
    id: "rule-1",
    ruleType: "stage_migration",
    label: "Stage Migration",
    description: "Alert when a lease migrates to a higher IFRS 9 stage",
    isEnabled: true,
    threshold: { direction: "upgrade" },
  },
  {
    id: "rule-2",
    ruleType: "watchlist_elevation",
    label: "Watchlist Elevation",
    description: "Alert when a lessee moves from Green → Amber or Amber → Red",
    isEnabled: true,
    threshold: { minLevel: "amber" },
  },
  {
    id: "rule-3",
    ruleType: "ecl_threshold",
    label: "ECL Threshold Breach",
    description: "Alert when portfolio ECL exceeds configured USD threshold",
    isEnabled: true,
    threshold: { maxEclUsd: 5000000 },
  },
  {
    id: "rule-4",
    ruleType: "signal_severity",
    label: "High Severity Intelligence Signal",
    description: "Alert when an intelligence signal is rated Critical or High",
    isEnabled: true,
    threshold: { minSeverity: "High" },
  },
  {
    id: "rule-5",
    ruleType: "jurisdiction_risk",
    label: "Jurisdiction Risk Spike",
    description: "Alert when a country risk score rises above threshold",
    isEnabled: false,
    threshold: { maxRiskScore: 80 },
  },
  {
    id: "rule-6",
    ruleType: "fuel_stress",
    label: "Fuel Price Stress",
    description: "Alert when fuel delta scenario impact exceeds tolerance",
    isEnabled: false,
    threshold: { fuelDeltaPct: 0.3 },
  },
  {
    id: "rule-7",
    ruleType: "composite_signal",
    label: "Composite Red Signal",
    description: "Alert when a lessee's composite score crosses into Red",
    isEnabled: true,
    threshold: {},
  },
];

// ── Mock alerts (12 items, mix of read/unread) ────────────────────────────────

export const MOCK_ALERTS: AlertItem[] = [
  {
    id: "alert-001",
    ruleType: "stage_migration",
    severity: "red",
    title: "Stage Migration: S2 → S3",
    body: "Lease LEA-0024 (Air Meridian) has migrated from Stage 2 to Stage 3. Lifetime ECL provisioning now required.",
    entityType: "lease",
    entityId: "LEA-0024",
    isRead: false,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "alert-002",
    ruleType: "watchlist_elevation",
    severity: "red",
    title: "Watchlist Elevated: Amber → Red",
    body: "SkyLink Aviation has moved to Red watchlist status following 2 consecutive missed payments and deteriorating behavior score (31/100).",
    entityType: "lessee",
    entityId: "LSE-0007",
    isRead: false,
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "alert-003",
    ruleType: "ecl_threshold",
    severity: "amber",
    title: "ECL Threshold Breach",
    body: "Portfolio ECL has reached $5.24M, exceeding the configured threshold of $5.0M. Stress scenario weighting may require review.",
    entityType: "portfolio",
    isRead: false,
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "alert-004",
    ruleType: "composite_signal",
    severity: "red",
    title: "Composite Red Signal",
    body: "Pacific Wings has crossed into composite Red status. Contributing factors: payment delinquency (+40pts), jurisdiction risk (+25pts), fuel exposure (+15pts).",
    entityType: "lessee",
    entityId: "LSE-0011",
    isRead: false,
    createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "alert-005",
    ruleType: "signal_severity",
    severity: "amber",
    title: "High Severity Intelligence Signal",
    body: "New Critical signal: 'LATAM Fuel Subsidy Removal' — 7 leases in affected region. Review counterparty exposure.",
    isRead: false,
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "alert-006",
    ruleType: "stage_migration",
    severity: "amber",
    title: "Stage Migration: S1 → S2",
    body: "Lease LEA-0031 (Nordic Charter) has migrated from Stage 1 to Stage 2 (SICR triggered: 32-day payment overdue).",
    entityType: "lease",
    entityId: "LEA-0031",
    isRead: false,
    createdAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "alert-007",
    ruleType: "watchlist_elevation",
    severity: "amber",
    title: "Watchlist Elevated: Green → Amber",
    body: "Iberian Sky has moved to Amber watchlist following a 1-notch rating downgrade and 15-day payment delay.",
    entityType: "lessee",
    entityId: "LSE-0003",
    isRead: true,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "alert-008",
    ruleType: "composite_signal",
    severity: "amber",
    title: "Composite Amber Signal",
    body: "Gulf Air Partners composite score has deteriorated to Amber (52/100). Fuel delta exposure is the primary driver.",
    entityType: "lessee",
    entityId: "LSE-0009",
    isRead: true,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "alert-009",
    ruleType: "ecl_threshold",
    severity: "green",
    title: "ECL Within Threshold",
    body: "Following scenario re-run with updated GDP inputs, portfolio ECL has returned to $4.71M — below the $5.0M threshold.",
    entityType: "portfolio",
    isRead: true,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "alert-010",
    ruleType: "signal_severity",
    severity: "amber",
    title: "High Severity Signal: Asian Monsoon Season",
    body: "Seasonal disruption signal elevated to High for 3 SEA lessees. Maintenance reserves for affected aircraft are within tolerance.",
    isRead: true,
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "alert-011",
    ruleType: "stage_migration",
    severity: "green",
    title: "Stage Reversal: S2 → S1",
    body: "Lease LEA-0018 (TransAtlantic) has returned to Stage 1 following 3 consecutive on-time payments and credit score improvement.",
    entityType: "lease",
    entityId: "LEA-0018",
    isRead: true,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "alert-012",
    ruleType: "watchlist_elevation",
    severity: "green",
    title: "Watchlist Improvement: Amber → Green",
    body: "Continental Express has been downgraded to Green status after sustained payment compliance over 90 days.",
    entityType: "lessee",
    entityId: "LSE-0002",
    isRead: true,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
];
