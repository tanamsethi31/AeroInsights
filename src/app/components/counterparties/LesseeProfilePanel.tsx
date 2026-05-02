import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  AreaChart, Area,
} from "recharts";
import { ChevronUp, ChevronDown } from "lucide-react";
import { KpiCard } from "../ui/KpiCard";
import { StatusPill } from "../ui/StatusPill";
import { Card } from "../ui/Card";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LesseeId = "INDIGO" | "AEROMEX" | "SRILNKN" | "AZUL" | "TRANSATCA" | "EMIRATES";

interface LesseeMeta {
  name: string;
  country: string;
  rating: string;
  stage: "1" | "2" | "3";
  exposure: number;
  leaseCount: number;
  behaviorScore: number;
  scores: { punctuality: number; restructuringCoop: number; govtInterference: number; litigationPropensity: number };
  lastPayment: string;
  daysOverdue: number;
  notes: string;
}

interface LesseeLeaseRow {
  id: string;
  aircraft: string;
  msn: string;
  monthlyRentUSD: number;
  ead: number;
  leaseEnd: string;
  stage: "1" | "2" | "3";
}

interface LesseeECLRow {
  leaseId: string;
  aircraft: string;
  ead: number;
  pd12m: number;
  pdLifetime: number;
  lgd: number;
  ecl12m: number;
  eclLifetime: number;
  stage: "1" | "2" | "3";
}

type EventType = "payment" | "late" | "missed" | "rating-change" | "stage-change" | "trigger" | "deferral";

interface PaymentEvent {
  date: string;
  type: EventType;
  description: string;
  impact: string;
  daysOverdue?: number;
}

interface MonthlyDPD {
  month: string;
  daysOverdue: number;
}

interface ScenarioRow {
  name: string;
  description: string;
  ecl12m: number;
  eclLifetime: number;
  vsBase12mPct: number;
  stageComment: string;
}

type SubScoreKey = "punctuality" | "restructuringCoop" | "govtInterference" | "litigationPropensity";

interface EvidenceEvent {
  date: string;
  event: string;
  outcome: string;
  weight: number;
}

interface BehaviourEvidence {
  punctuality: EvidenceEvent[];
  restructuringCoop: EvidenceEvent[];
  govtInterference: EvidenceEvent[];
  litigationPropensity: EvidenceEvent[];
}

interface ScoreHistoryPoint {
  month: string;
  punctuality: number;
  restructuringCoop: number;
  govtInterference: number;
  litigationPropensity: number;
}

interface OverrideEntry {
  id: string;
  timestamp: string;
  user: string;
  subScore: string;
  oldValue: number;
  newValue: number;
  reason: string;
}

interface LesseeProfile {
  meta: LesseeMeta;
  leases: LesseeLeaseRow[];
  eclRows: LesseeECLRow[];
  monthlyDPD: MonthlyDPD[];
  events: PaymentEvent[];
  scenarios: ScenarioRow[];
  behaviourEvidence: BehaviourEvidence;
  scoreHistory: ScoreHistoryPoint[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const M = 1_000_000;
const K = 1_000;

const DPD_MONTHS = ["May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr"];

function makeDPD(values: number[]): MonthlyDPD[] {
  return DPD_MONTHS.map((month, i) => ({ month, daysOverdue: values[i] }));
}

const RESTRUCTURING_OPTIONS = [
  { name: "Payment Holiday",      npv: "$82.1M", irr: "7.2%", ecl: "$12.4M", p95: "$24.1M", recovery: "14 mo" },
  { name: "Deferral w/ Catch-up", npv: "$86.4M", irr: "7.8%", ecl: "$10.8M", p95: "$19.7M", recovery: "18 mo" },
  { name: "Forgiveness (30%)",    npv: "$72.3M", irr: "5.9%", ecl: "$8.2M",  p95: "$14.2M", recovery: "24 mo" },
  { name: "PBH Conversion",       npv: "$79.8M", irr: "7.1%", ecl: "$11.2M", p95: "$21.8M", recovery: "20 mo" },
  { name: "Term Extension",       npv: "$88.2M", irr: "8.1%", ecl: "$9.4M",  p95: "$17.6M", recovery: "16 mo" },
  { name: "Rate Reduction (−15%)",npv: "$77.9M", irr: "6.8%", ecl: "$10.1M", p95: "$18.4M", recovery: "22 mo" },
  { name: "Termination (baseline)",npv: "$61.2M",irr: "4.2%", ecl: "$18.7M", p95: "$38.9M", recovery: "36 mo" },
];

// ─── Profile Data ─────────────────────────────────────────────────────────────

const PROFILE_DATA: Record<LesseeId, LesseeProfile> = {
  INDIGO: {
    meta: {
      name: "IndiGo Airlines", country: "India", rating: "BB-", stage: "3",
      exposure: 184 * M, leaseCount: 6, behaviorScore: 44,
      scores: { punctuality: 28, restructuringCoop: 52, govtInterference: 41, litigationPropensity: 55 },
      lastPayment: "2026-03-14", daysOverdue: 45,
      notes: "Payment 45 days overdue. §1110 cure risk elevated. Seeking deferral.",
    },
    leases: [
      { id: "LSE-2019-001", aircraft: "A320neo", msn: "9218",  monthlyRentUSD: 285*K, ead: 24.2*M, leaseEnd: "2028-03-01", stage: "3" },
      { id: "LSE-2019-002", aircraft: "A320neo", msn: "9341",  monthlyRentUSD: 285*K, ead: 23.8*M, leaseEnd: "2028-06-01", stage: "3" },
      { id: "LSE-2020-005", aircraft: "A321neo", msn: "9876",  monthlyRentUSD: 295*K, ead: 28.1*M, leaseEnd: "2029-01-15", stage: "3" },
      { id: "LSE-2021-008", aircraft: "A320neo", msn: "10122", monthlyRentUSD: 280*K, ead: 31.4*M, leaseEnd: "2030-07-01", stage: "3" },
      { id: "LSE-2022-011", aircraft: "A320neo", msn: "10567", monthlyRentUSD: 275*K, ead: 38.2*M, leaseEnd: "2031-03-15", stage: "2" },
      { id: "LSE-2022-014", aircraft: "A321neo", msn: "10891", monthlyRentUSD: 290*K, ead: 38.3*M, leaseEnd: "2031-09-01", stage: "2" },
    ],
    eclRows: [
      { leaseId: "LSE-2019-001", aircraft: "A320neo", ead: 24.2*M, pd12m: 18.2, pdLifetime: 24.1, lgd: 54, ecl12m: 2.38*M, eclLifetime: 4.69*M, stage: "3" },
      { leaseId: "LSE-2019-002", aircraft: "A320neo", ead: 23.8*M, pd12m: 18.2, pdLifetime: 24.1, lgd: 54, ecl12m: 2.34*M, eclLifetime: 4.61*M, stage: "3" },
      { leaseId: "LSE-2020-005", aircraft: "A321neo", ead: 28.1*M, pd12m: 14.6, pdLifetime: 20.8, lgd: 54, ecl12m: 2.22*M, eclLifetime: 4.28*M, stage: "3" },
      { leaseId: "LSE-2021-008", aircraft: "A320neo", ead: 31.4*M, pd12m: 14.6, pdLifetime: 20.8, lgd: 54, ecl12m: 2.48*M, eclLifetime: 4.79*M, stage: "3" },
      { leaseId: "LSE-2022-011", aircraft: "A320neo", ead: 38.2*M, pd12m:  4.8, pdLifetime:  9.2, lgd: 50, ecl12m: 0.92*M, eclLifetime: 1.76*M, stage: "2" },
      { leaseId: "LSE-2022-014", aircraft: "A321neo", ead: 38.3*M, pd12m:  4.8, pdLifetime:  9.2, lgd: 50, ecl12m: 0.92*M, eclLifetime: 1.76*M, stage: "2" },
    ],
    monthlyDPD: makeDPD([0, 0, 2, 4, 8, 12, 18, 24, 30, 38, 42, 45]),
    events: [
      { date: "2026-03-14", type: "late",         description: "$285k rent — 45 DPD on LSE-2019-001",                       impact: "ECL stage 3 backstop triggered",    daysOverdue: 45 },
      { date: "2026-02-01", type: "stage-change",  description: "SICR backstop: 30+ DPD · all leases moved to Stage 3",      impact: "Lifetime ECL now required" },
      { date: "2026-01-10", type: "trigger",       description: "India sovereign watchlist event — AWG CTC score downgraded", impact: "SICR qualitative trigger" },
      { date: "2025-12-10", type: "rating-change", description: "S&P: BBB- → BB-",                                            impact: "PD curve shifted +4pp" },
      { date: "2025-11-15", type: "late",          description: "$285k rent — 12 DPD on LSE-2019-001",                       impact: "Monitoring elevated",               daysOverdue: 12 },
      { date: "2025-10-01", type: "payment",       description: "All leases current",                                         impact: "—" },
    ],
    scenarios: [
      { name: "Base Case",     description: "Q1 2026 actuals; no macro shock",                           ecl12m: 11.26*M, eclLifetime: 21.89*M, vsBase12mPct:   0, stageComment: "Stage 3 maintained" },
      { name: "Mild Stress",   description: "GDP −1%, RPK −10%, fuel +15%",                              ecl12m: 14.98*M, eclLifetime: 29.11*M, vsBase12mPct:  33, stageComment: "Write-off risk rising" },
      { name: "Severe Stress", description: "GDP −3%, RPK −30%, fuel +40%, USD/INR −15%",                ecl12m: 27.75*M, eclLifetime: 53.94*M, vsBase12mPct: 146, stageComment: "Full write-off likely" },
    ],
    behaviourEvidence: {
      punctuality: [
        { date: "2025-05-12", event: "On-time payment", outcome: "Apr 2025 rental received in full on due date", weight: 8 },
        { date: "2025-08-14", event: "Late payment — 18 DPD", outcome: "Aug 2025 rental received 18 days past due", weight: -12 },
        { date: "2025-11-20", event: "Late payment — 28 DPD", outcome: "Nov 2025 rental received 28 days past due; backstop monitoring activated", weight: -18 },
        { date: "2026-01-15", event: "30+ DPD backstop breach", outcome: "SICR §B5.5.17 trigger activated; Stage 2 → Stage 3 migration", weight: -35 },
        { date: "2026-03-14", event: "Partial payment received", outcome: "Mar 2026 rental partially settled; $45K shortfall outstanding", weight: -14 },
      ],
      restructuringCoop: [
        { date: "2025-10-05", event: "Initial deferral request submitted", outcome: "Lessee submitted deferral request; documentation provided within 5 days", weight: 5 },
        { date: "2025-11-18", event: "Restructuring meeting — partial cooperation", outcome: "Lessee attended meeting; declined to provide updated cash flow projections", weight: -8 },
        { date: "2026-02-02", event: "Second meeting — seeking deferral", outcome: "New management team; cooperative tone but no formal agreement reached", weight: 4 },
        { date: "2026-03-28", event: "Term sheet refused", outcome: "Lessee declined term sheet for payment holiday citing board approval delay", weight: -10 },
      ],
      govtInterference: [
        { date: "2025-08-01", event: "India sovereign watchlist added", outcome: "AWG CTC score downgraded −4 pts; judicial enforcement risk elevated", weight: -12 },
        { date: "2025-11-10", event: "DGCA fleet continuity intervention", outcome: "Indian DGCA contacted lessor regarding fleet continuity; political pressure noted", weight: -18 },
        { date: "2026-01-15", event: "Sovereign watchlist — dual trigger active", outcome: "IMF quarterly India review flagged aviation sector; dual-trigger SICR classification", weight: -11 },
      ],
      litigationPropensity: [
        { date: "2024-09-14", event: "Prior arbitration resolved", outcome: "2024 dispute over maintenance reserve drawdown settled in lessor's favour", weight: -8 },
        { date: "2025-04-22", event: "Legal notice on lease amendment", outcome: "Lessee issued formal objection to lease amendment clause; withdrawn after negotiation", weight: -10 },
        { date: "2026-01-28", event: "Threat of injunction re repossession", outcome: "Lessee counsel issued letter threatening injunction; not filed as of Q1 2026", weight: -22 },
        { date: "2026-03-15", event: "§1110 cure letter contested", outcome: "Lessee's legal team disputed cure period calculation; still unresolved", weight: -15 },
      ],
    },
    scoreHistory: [
      { month: "May '25", punctuality: 62, restructuringCoop: 65, govtInterference: 35, litigationPropensity: 42 },
      { month: "Jun '25", punctuality: 58, restructuringCoop: 63, govtInterference: 36, litigationPropensity: 44 },
      { month: "Jul '25", punctuality: 55, restructuringCoop: 61, govtInterference: 37, litigationPropensity: 46 },
      { month: "Aug '25", punctuality: 52, restructuringCoop: 59, govtInterference: 38, litigationPropensity: 48 },
      { month: "Sep '25", punctuality: 50, restructuringCoop: 58, govtInterference: 39, litigationPropensity: 50 },
      { month: "Oct '25", punctuality: 47, restructuringCoop: 57, govtInterference: 40, litigationPropensity: 52 },
      { month: "Nov '25", punctuality: 44, restructuringCoop: 56, govtInterference: 40, litigationPropensity: 53 },
      { month: "Dec '25", punctuality: 40, restructuringCoop: 55, govtInterference: 41, litigationPropensity: 54 },
      { month: "Jan '26", punctuality: 36, restructuringCoop: 54, govtInterference: 41, litigationPropensity: 55 },
      { month: "Feb '26", punctuality: 32, restructuringCoop: 53, govtInterference: 41, litigationPropensity: 55 },
      { month: "Mar '26", punctuality: 30, restructuringCoop: 53, govtInterference: 41, litigationPropensity: 55 },
      { month: "Apr '26", punctuality: 28, restructuringCoop: 52, govtInterference: 41, litigationPropensity: 55 },
    ],
  },

  AEROMEX: {
    meta: {
      name: "Aeromexico", country: "Mexico", rating: "CCC", stage: "3",
      exposure: 122*M, leaseCount: 4, behaviorScore: 29,
      scores: { punctuality: 18, restructuringCoop: 38, govtInterference: 35, litigationPropensity: 25 },
      lastPayment: "2026-01-31", daysOverdue: 88,
      notes: "Chapter 11 filing. §1110 cure window active. AerCap and Air Lease precedent reviewed.",
    },
    leases: [
      { id: "LSE-2020-014", aircraft: "B737-800",   msn: "41234", monthlyRentUSD: 310*K, ead: 32.1*M, leaseEnd: "2027-06-15", stage: "3" },
      { id: "LSE-2021-019", aircraft: "B737-800",   msn: "43812", monthlyRentUSD: 310*K, ead: 29.4*M, leaseEnd: "2028-01-10", stage: "3" },
      { id: "LSE-2022-023", aircraft: "B737 MAX 8", msn: "67102", monthlyRentUSD: 340*K, ead: 33.6*M, leaseEnd: "2029-04-20", stage: "3" },
      { id: "LSE-2023-007", aircraft: "B737 MAX 8", msn: "72845", monthlyRentUSD: 340*K, ead: 26.9*M, leaseEnd: "2030-08-01", stage: "3" },
    ],
    eclRows: [
      { leaseId: "LSE-2020-014", aircraft: "B737-800",   ead: 32.1*M, pd12m: 28.4, pdLifetime: 36.2, lgd: 58, ecl12m: 5.28*M, eclLifetime: 10.27*M, stage: "3" },
      { leaseId: "LSE-2021-019", aircraft: "B737-800",   ead: 29.4*M, pd12m: 28.4, pdLifetime: 36.2, lgd: 58, ecl12m: 4.84*M, eclLifetime:  9.41*M, stage: "3" },
      { leaseId: "LSE-2022-023", aircraft: "B737 MAX 8", ead: 33.6*M, pd12m: 22.1, pdLifetime: 30.4, lgd: 56, ecl12m: 4.16*M, eclLifetime:  8.09*M, stage: "3" },
      { leaseId: "LSE-2023-007", aircraft: "B737 MAX 8", ead: 26.9*M, pd12m: 22.1, pdLifetime: 30.4, lgd: 56, ecl12m: 3.33*M, eclLifetime:  6.48*M, stage: "3" },
    ],
    monthlyDPD: makeDPD([0, 5, 14, 22, 31, 45, 54, 66, 72, 80, 85, 88]),
    events: [
      { date: "2026-02-14", type: "missed",        description: "No rent received — 88 DPD on all 4 leases",              impact: "§1110 cure window active",         daysOverdue: 88 },
      { date: "2026-01-20", type: "stage-change",  description: "Chapter 11 voluntary filing — Mexico City court",         impact: "All leases Stage 3; lifetime ECL" },
      { date: "2025-12-01", type: "deferral",      description: "60-day deferral request received; lessor declined",       impact: "Negotiations ongoing" },
      { date: "2025-11-08", type: "rating-change", description: "S&P: B- → CCC",                                           impact: "PD curve shifted +8pp" },
      { date: "2025-10-15", type: "late",          description: "$310k rent — 14 DPD on LSE-2020-014",                    impact: "Stage 2 SICR threshold breached",  daysOverdue: 14 },
      { date: "2025-09-01", type: "stage-change",  description: "Stage 1 → 2 on all Aeromexico leases",                   impact: "Lifetime ECL monitoring begins" },
    ],
    scenarios: [
      { name: "Base Case",     description: "Chapter 11 in progress; §1110 resolution assumed",       ecl12m: 17.61*M, eclLifetime: 34.25*M, vsBase12mPct:   0, stageComment: "Stage 3; §1110 resolution" },
      { name: "Mild Stress",   description: "GDP −1%, RPK −10%; restructuring extended 6 months",     ecl12m: 22.10*M, eclLifetime: 43.01*M, vsBase12mPct:  26, stageComment: "Recovery timeline extended" },
      { name: "Severe Stress", description: "GDP −3%, RPK −30%; airline liquidation scenario",        ecl12m: 38.41*M, eclLifetime: 74.73*M, vsBase12mPct: 118, stageComment: "Full write-off; repo scenario" },
    ],
    behaviourEvidence: {
      punctuality: [
        { date: "2025-06-10", event: "Late payment — 22 DPD", outcome: "Jun 2025 rental received 22 days past due", weight: -15 },
        { date: "2025-09-18", event: "Late payment — 35 DPD", outcome: "Sep 2025 rental 35 DPD; SICR watch activated", weight: -22 },
        { date: "2025-12-05", event: "Missed payment", outcome: "Dec 2025 rental not received; formal default notice issued", weight: -30 },
        { date: "2026-01-08", event: "Chapter 11 filing — automatic stay", outcome: "§1110 clock running; all rent obligations stayed", weight: -40 },
      ],
      restructuringCoop: [
        { date: "2025-11-12", event: "Pre-filing discussion — limited info", outcome: "Lessee counsel engaged; limited financial information provided", weight: -5 },
        { date: "2026-01-08", event: "Ch.11 filed without advance notice", outcome: "Lessor not given pre-filing consultation; standard practice in contested filings", weight: -20 },
        { date: "2026-02-14", event: "§1110 agreement framework proposed", outcome: "DIP counsel engaged; agreement framework proposed by lessee counsel", weight: 10 },
        { date: "2026-03-20", event: "3 of 4 lease assumptions confirmed", outcome: "Three lease assumptions signed; one lease disputed pending committee approval", weight: 5 },
      ],
      govtInterference: [
        { date: "2025-08-15", event: "Prior Concurso precedent assessed", outcome: "2010 Concurso Mercantil review: lessor recovered 100% after 18 months", weight: 8 },
        { date: "2026-01-08", event: "US Ch.11 filed in SDNY", outcome: "Southern District of New York filing; §1110 framework applies — strong lessor protection", weight: 12 },
        { date: "2026-02-01", event: "Mexican government employment comment", outcome: "SICT commented on fleet continuity; no legal intervention made", weight: -10 },
      ],
      litigationPropensity: [
        { date: "2025-09-10", event: "Maintenance reserve dispute", outcome: "Lessee disputed $2.1M maintenance reserve drawdown; settled out of court in 30 days", weight: -8 },
        { date: "2026-01-08", event: "Ch.11 adversary proceeding risk", outcome: "Filing creates §365 rejection risk for one lease; avoidance action capability noted", weight: -15 },
        { date: "2026-03-05", event: "No adversary proceedings filed", outcome: "90-day preference period monitored; no avoidance actions filed to date", weight: 5 },
      ],
    },
    scoreHistory: [
      { month: "May '25", punctuality: 55, restructuringCoop: 55, govtInterference: 28, litigationPropensity: 20 },
      { month: "Jun '25", punctuality: 50, restructuringCoop: 52, govtInterference: 30, litigationPropensity: 21 },
      { month: "Jul '25", punctuality: 46, restructuringCoop: 50, govtInterference: 32, litigationPropensity: 22 },
      { month: "Aug '25", punctuality: 42, restructuringCoop: 48, govtInterference: 33, litigationPropensity: 23 },
      { month: "Sep '25", punctuality: 38, restructuringCoop: 45, govtInterference: 34, litigationPropensity: 24 },
      { month: "Oct '25", punctuality: 33, restructuringCoop: 42, govtInterference: 35, litigationPropensity: 25 },
      { month: "Nov '25", punctuality: 28, restructuringCoop: 40, govtInterference: 35, litigationPropensity: 25 },
      { month: "Dec '25", punctuality: 24, restructuringCoop: 38, govtInterference: 35, litigationPropensity: 25 },
      { month: "Jan '26", punctuality: 20, restructuringCoop: 38, govtInterference: 35, litigationPropensity: 25 },
      { month: "Feb '26", punctuality: 19, restructuringCoop: 38, govtInterference: 35, litigationPropensity: 25 },
      { month: "Mar '26", punctuality: 18, restructuringCoop: 38, govtInterference: 35, litigationPropensity: 25 },
      { month: "Apr '26", punctuality: 18, restructuringCoop: 38, govtInterference: 35, litigationPropensity: 25 },
    ],
  },

  SRILNKN: {
    meta: {
      name: "SriLankan Airlines", country: "Sri Lanka", rating: "B+", stage: "2",
      exposure: 118*M, leaseCount: 4, behaviorScore: 62,
      scores: { punctuality: 55, restructuringCoop: 70, govtInterference: 48, litigationPropensity: 75 },
      lastPayment: "2026-04-10", daysOverdue: 12,
      notes: "Downgraded by S&P. Government-owned carrier. High litigation propensity.",
    },
    leases: [
      { id: "LSE-2020-031", aircraft: "A330-300", msn: "1728",  monthlyRentUSD: 480*K, ead: 34.2*M, leaseEnd: "2026-09-01", stage: "2" },
      { id: "LSE-2021-034", aircraft: "A330-300", msn: "1842",  monthlyRentUSD: 480*K, ead: 31.8*M, leaseEnd: "2027-03-15", stage: "2" },
      { id: "LSE-2022-038", aircraft: "A320neo",  msn: "10244", monthlyRentUSD: 285*K, ead: 28.6*M, leaseEnd: "2028-11-01", stage: "2" },
      { id: "LSE-2023-012", aircraft: "A320neo",  msn: "11102", monthlyRentUSD: 285*K, ead: 23.4*M, leaseEnd: "2030-05-20", stage: "2" },
    ],
    eclRows: [
      { leaseId: "LSE-2020-031", aircraft: "A330-300", ead: 34.2*M, pd12m: 9.8, pdLifetime: 16.4, lgd: 60, ecl12m: 2.01*M, eclLifetime: 5.23*M, stage: "2" },
      { leaseId: "LSE-2021-034", aircraft: "A330-300", ead: 31.8*M, pd12m: 9.8, pdLifetime: 16.4, lgd: 60, ecl12m: 1.87*M, eclLifetime: 4.86*M, stage: "2" },
      { leaseId: "LSE-2022-038", aircraft: "A320neo",  ead: 28.6*M, pd12m: 7.2, pdLifetime: 12.8, lgd: 55, ecl12m: 1.13*M, eclLifetime: 2.93*M, stage: "2" },
      { leaseId: "LSE-2023-012", aircraft: "A320neo",  ead: 23.4*M, pd12m: 7.2, pdLifetime: 12.8, lgd: 55, ecl12m: 0.93*M, eclLifetime: 2.40*M, stage: "2" },
    ],
    monthlyDPD: makeDPD([0, 3, 6, 4, 8, 10, 7, 9, 11, 12, 10, 12]),
    events: [
      { date: "2026-03-22", type: "rating-change", description: "S&P: BB- → B+",                                             impact: "PD curve shifted +2pp" },
      { date: "2026-02-10", type: "late",          description: "$480k rent — 12 DPD on LSE-2020-031",                       impact: "Stage 2 maintained",              daysOverdue: 12 },
      { date: "2025-12-15", type: "stage-change",  description: "Stage 1 → 2; sovereign CDS +85bps qualitative trigger",     impact: "Lifetime ECL monitoring" },
      { date: "2025-11-01", type: "trigger",       description: "Sri Lanka sovereign watchlist event",                        impact: "SICR qualitative trigger" },
      { date: "2025-09-14", type: "payment",       description: "All leases current",                                         impact: "—" },
    ],
    scenarios: [
      { name: "Base Case",     description: "Stage 2 monitoring; deferral risk moderate",             ecl12m:  5.94*M, eclLifetime: 15.42*M, vsBase12mPct:   0, stageComment: "Stage 2 maintained" },
      { name: "Mild Stress",   description: "GDP −1%, RPK −10%; sovereign risk elevated",             ecl12m:  8.02*M, eclLifetime: 20.81*M, vsBase12mPct:  35, stageComment: "Stage 2→3 risk on A330 leases" },
      { name: "Severe Stress", description: "GDP −3%, RPK −30%; sovereign default scenario",          ecl12m: 14.18*M, eclLifetime: 36.80*M, vsBase12mPct: 139, stageComment: "All leases Stage 3" },
    ],
    behaviourEvidence: {
      punctuality: [
        { date: "2025-06-01", event: "On-time payment", outcome: "Jun 2025 rental received on due date", weight: 6 },
        { date: "2025-10-14", event: "Late payment — 8 DPD", outcome: "Oct 2025 rental 8 days late; attributed to bank processing delays", weight: -5 },
        { date: "2026-01-22", event: "Late payment — 12 DPD", outcome: "Jan 2026 rental 12 days past due; country watchlist event active", weight: -15 },
        { date: "2026-04-10", event: "Late payment — 12 DPD", outcome: "Apr 2026 rental 12 days past due; pattern emerging with month-end timing", weight: -8 },
      ],
      restructuringCoop: [
        { date: "2025-07-20", event: "Lease amendment agreed without dispute", outcome: "Lessee accepted minor lease amendment in full", weight: 8 },
        { date: "2025-12-05", event: "Proactive cash flow submission", outcome: "Lessee submitted quarterly cash flow projections proactively", weight: 10 },
        { date: "2026-02-18", event: "Restructuring meeting — full attendance", outcome: "Full management team present; provided audited financials on request", weight: 7 },
      ],
      govtInterference: [
        { date: "2025-05-01", event: "Government-owned carrier designation", outcome: "SriLankan Airlines confirmed as wholly government-owned; political interference risk elevated", weight: -20 },
        { date: "2025-09-15", event: "IMF EFF compliance review flagged", outcome: "Sri Lanka IMF Extended Fund Facility review flagged aviation sector restructuring", weight: -10 },
        { date: "2026-01-22", event: "Sovereign watchlist — SICR trigger", outcome: "AWG CTC country watchlist activated; dual-trigger SICR potential", weight: -18 },
      ],
      litigationPropensity: [
        { date: "2024-11-08", event: "LCIA arbitration resolved", outcome: "2023 LCIA arbitration re maintenance reserves ($1.8M); settled after 14 months", weight: -20 },
        { date: "2025-06-14", event: "Legal challenge to insurance clause", outcome: "SriLankan challenged hull insurance requirement; withdrew objection after negotiation", weight: -12 },
        { date: "2025-11-22", event: "6-month clean period", outcome: "No new legal actions in 6-month review; positive compliance signal", weight: 8 },
      ],
    },
    scoreHistory: [
      { month: "May '25", punctuality: 72, restructuringCoop: 75, govtInterference: 38, litigationPropensity: 68 },
      { month: "Jun '25", punctuality: 70, restructuringCoop: 74, govtInterference: 40, litigationPropensity: 70 },
      { month: "Jul '25", punctuality: 68, restructuringCoop: 72, govtInterference: 42, litigationPropensity: 71 },
      { month: "Aug '25", punctuality: 65, restructuringCoop: 72, govtInterference: 43, litigationPropensity: 72 },
      { month: "Sep '25", punctuality: 63, restructuringCoop: 71, govtInterference: 44, litigationPropensity: 72 },
      { month: "Oct '25", punctuality: 61, restructuringCoop: 70, govtInterference: 45, litigationPropensity: 73 },
      { month: "Nov '25", punctuality: 59, restructuringCoop: 70, govtInterference: 46, litigationPropensity: 74 },
      { month: "Dec '25", punctuality: 57, restructuringCoop: 70, govtInterference: 47, litigationPropensity: 75 },
      { month: "Jan '26", punctuality: 56, restructuringCoop: 70, govtInterference: 47, litigationPropensity: 75 },
      { month: "Feb '26", punctuality: 55, restructuringCoop: 70, govtInterference: 48, litigationPropensity: 75 },
      { month: "Mar '26", punctuality: 55, restructuringCoop: 70, govtInterference: 48, litigationPropensity: 75 },
      { month: "Apr '26", punctuality: 55, restructuringCoop: 70, govtInterference: 48, litigationPropensity: 75 },
    ],
  },

  AZUL: {
    meta: {
      name: "Azul Brazilian Airlines", country: "Brazil", rating: "B+", stage: "2",
      exposure: 142*M, leaseCount: 5, behaviorScore: 71,
      scores: { punctuality: 68, restructuringCoop: 78, govtInterference: 62, litigationPropensity: 76 },
      lastPayment: "2026-04-20", daysOverdue: 6,
      notes: "Schedule reductions. Liquidity tightening. Constructive engagement so far.",
    },
    leases: [
      { id: "LSE-2021-055", aircraft: "A320neo", msn: "10442", monthlyRentUSD: 295*K, ead: 28.6*M, leaseEnd: "2029-11-01", stage: "2" },
      { id: "LSE-2021-056", aircraft: "A320neo", msn: "10543", monthlyRentUSD: 295*K, ead: 27.8*M, leaseEnd: "2029-11-01", stage: "2" },
      { id: "LSE-2022-061", aircraft: "A321neo", msn: "11234", monthlyRentUSD: 310*K, ead: 29.4*M, leaseEnd: "2030-05-15", stage: "2" },
      { id: "LSE-2022-064", aircraft: "A320neo", msn: "11456", monthlyRentUSD: 290*K, ead: 28.1*M, leaseEnd: "2030-09-01", stage: "1" },
      { id: "LSE-2023-018", aircraft: "A321neo", msn: "12001", monthlyRentUSD: 310*K, ead: 28.1*M, leaseEnd: "2031-03-20", stage: "1" },
    ],
    eclRows: [
      { leaseId: "LSE-2021-055", aircraft: "A320neo", ead: 28.6*M, pd12m: 8.4, pdLifetime: 14.2, lgd: 52, ecl12m: 1.25*M, eclLifetime: 3.23*M, stage: "2" },
      { leaseId: "LSE-2021-056", aircraft: "A320neo", ead: 27.8*M, pd12m: 8.4, pdLifetime: 14.2, lgd: 52, ecl12m: 1.21*M, eclLifetime: 3.14*M, stage: "2" },
      { leaseId: "LSE-2022-061", aircraft: "A321neo", ead: 29.4*M, pd12m: 8.4, pdLifetime: 14.2, lgd: 52, ecl12m: 1.29*M, eclLifetime: 3.33*M, stage: "2" },
      { leaseId: "LSE-2022-064", aircraft: "A320neo", ead: 28.1*M, pd12m: 1.8, pdLifetime:  5.4, lgd: 48, ecl12m: 0.24*M, eclLifetime: 0.73*M, stage: "1" },
      { leaseId: "LSE-2023-018", aircraft: "A321neo", ead: 28.1*M, pd12m: 1.8, pdLifetime:  5.4, lgd: 48, ecl12m: 0.24*M, eclLifetime: 0.73*M, stage: "1" },
    ],
    monthlyDPD: makeDPD([0, 0, 2, 4, 3, 6, 5, 7, 6, 6, 7, 6]),
    events: [
      { date: "2026-04-20", type: "late",         description: "$295k rent — 6 DPD on LSE-2021-055",                      impact: "Monitoring",                       daysOverdue: 6 },
      { date: "2026-02-18", type: "stage-change", description: "LSE-2021-055/056/061 Stage 1 → 2: schedule −18% QoQ",     impact: "Lifetime ECL on 3 leases" },
      { date: "2025-11-04", type: "trigger",      description: "Liquidity ratio below covenant threshold",                 impact: "SICR qualitative review initiated" },
      { date: "2025-08-01", type: "payment",      description: "All leases current",                                       impact: "—" },
    ],
    scenarios: [
      { name: "Base Case",     description: "Stage 2 on 3 leases; liquidity watch",               ecl12m:  4.23*M, eclLifetime: 11.16*M, vsBase12mPct:   0, stageComment: "Stage 2 on 3 leases" },
      { name: "Mild Stress",   description: "GDP −1%, RPK −10%; BRL −10% vs USD",                 ecl12m:  5.84*M, eclLifetime: 15.41*M, vsBase12mPct:  38, stageComment: "All 5 leases Stage 2" },
      { name: "Severe Stress", description: "GDP −3%, RPK −30%, BRL −25% vs USD",                 ecl12m: 10.22*M, eclLifetime: 26.97*M, vsBase12mPct: 142, stageComment: "Stage 3 risk on oldest leases" },
    ],
    behaviourEvidence: {
      punctuality: [
        { date: "2025-07-01", event: "On-time payment", outcome: "Jul 2025 rental received in full on due date", weight: 7 },
        { date: "2025-10-01", event: "On-time payment", outcome: "Oct 2025 rental received in full on due date", weight: 7 },
        { date: "2026-01-28", event: "Late payment — 6 DPD", outcome: "Jan 2026 rental 6 days past due; attributed to BRL/USD rate impact on cash conversion", weight: -6 },
        { date: "2026-04-20", event: "Late payment — 6 DPD", outcome: "Apr 2026 rental 6 days past due; month-end FX settlement pattern emerging", weight: -6 },
      ],
      restructuringCoop: [
        { date: "2025-08-15", event: "Proactive schedule discussion", outcome: "Lessee initiated discussion about schedule reductions; full fleet utilisation data provided", weight: 10 },
        { date: "2026-01-15", event: "Agreed monthly reporting", outcome: "Lessee agreed to monthly reporting cadence; no formal disputes raised", weight: 8 },
        { date: "2026-03-10", event: "Payment smoothing plan proposed", outcome: "Lessee proposed 90-day payment smoothing plan; under lessor review", weight: 5 },
      ],
      govtInterference: [
        { date: "2025-09-01", event: "ANAC assessment — neutral", outcome: "Brazilian ANAC aviation authority assessment: no enforcement actions or adverse findings", weight: 5 },
        { date: "2026-01-28", event: "BRL/USD pressure — no govt intervention", outcome: "Brazilian real depreciation +14% YoY; impacts rent-to-revenue ratio but no government action", weight: -8 },
      ],
      litigationPropensity: [
        { date: "2025-05-14", event: "Lease amendment accepted", outcome: "Lessee accepted aircraft re-delivery condition amendment without dispute", weight: 8 },
        { date: "2025-12-10", event: "Clean 6-month legal review", outcome: "6-month review: no active proceedings or threatened actions", weight: 10 },
        { date: "2026-02-28", event: "Minor maintenance reserve dispute resolved", outcome: "$85K maintenance reserve shortfall resolved administratively within 10 days", weight: -4 },
      ],
    },
    scoreHistory: [
      { month: "May '25", punctuality: 82, restructuringCoop: 80, govtInterference: 58, litigationPropensity: 72 },
      { month: "Jun '25", punctuality: 80, restructuringCoop: 80, govtInterference: 59, litigationPropensity: 73 },
      { month: "Jul '25", punctuality: 78, restructuringCoop: 79, govtInterference: 60, litigationPropensity: 74 },
      { month: "Aug '25", punctuality: 76, restructuringCoop: 79, govtInterference: 60, litigationPropensity: 74 },
      { month: "Sep '25", punctuality: 74, restructuringCoop: 79, govtInterference: 61, litigationPropensity: 75 },
      { month: "Oct '25", punctuality: 72, restructuringCoop: 78, govtInterference: 61, litigationPropensity: 75 },
      { month: "Nov '25", punctuality: 72, restructuringCoop: 78, govtInterference: 62, litigationPropensity: 76 },
      { month: "Dec '25", punctuality: 71, restructuringCoop: 78, govtInterference: 62, litigationPropensity: 76 },
      { month: "Jan '26", punctuality: 70, restructuringCoop: 78, govtInterference: 62, litigationPropensity: 76 },
      { month: "Feb '26", punctuality: 69, restructuringCoop: 78, govtInterference: 62, litigationPropensity: 76 },
      { month: "Mar '26", punctuality: 68, restructuringCoop: 78, govtInterference: 62, litigationPropensity: 76 },
      { month: "Apr '26", punctuality: 68, restructuringCoop: 78, govtInterference: 62, litigationPropensity: 76 },
    ],
  },

  TRANSATCA: {
    meta: {
      name: "Air Transat", country: "Canada", rating: "B", stage: "2",
      exposure: 96*M, leaseCount: 3, behaviorScore: 68,
      scores: { punctuality: 62, restructuringCoop: 75, govtInterference: 88, litigationPropensity: 47 },
      lastPayment: "2026-04-22", daysOverdue: 8,
      notes: "Restructuring discussions initiated. Canadian jurisdiction favorable for lessor.",
    },
    leases: [
      { id: "LSE-2019-063", aircraft: "A321neo", msn: "8841", monthlyRentUSD: 275*K, ead: 32.8*M, leaseEnd: "2027-05-01", stage: "2" },
      { id: "LSE-2020-068", aircraft: "A321neo", msn: "9104", monthlyRentUSD: 275*K, ead: 31.4*M, leaseEnd: "2027-11-15", stage: "2" },
      { id: "LSE-2021-072", aircraft: "A321neo", msn: "9562", monthlyRentUSD: 275*K, ead: 31.8*M, leaseEnd: "2028-06-01", stage: "2" },
    ],
    eclRows: [
      { leaseId: "LSE-2019-063", aircraft: "A321neo", ead: 32.8*M, pd12m: 7.8, pdLifetime: 13.6, lgd: 50, ecl12m: 1.28*M, eclLifetime: 3.10*M, stage: "2" },
      { leaseId: "LSE-2020-068", aircraft: "A321neo", ead: 31.4*M, pd12m: 7.8, pdLifetime: 13.6, lgd: 50, ecl12m: 1.22*M, eclLifetime: 2.97*M, stage: "2" },
      { leaseId: "LSE-2021-072", aircraft: "A321neo", ead: 31.8*M, pd12m: 7.8, pdLifetime: 13.6, lgd: 50, ecl12m: 1.24*M, eclLifetime: 3.01*M, stage: "2" },
    ],
    monthlyDPD: makeDPD([0, 2, 4, 6, 5, 7, 6, 8, 8, 9, 8, 8]),
    events: [
      { date: "2026-04-22", type: "late",         description: "$275k rent — 8 DPD on LSE-2019-063",              impact: "Monitoring",                daysOverdue: 8 },
      { date: "2026-03-10", type: "deferral",     description: "30-day deferral request received; under review",  impact: "Potential SICR trigger" },
      { date: "2026-01-15", type: "stage-change", description: "Stage 1 → 2: restructuring negotiations initiated",impact: "Lifetime ECL begins" },
      { date: "2025-10-01", type: "payment",      description: "All leases current",                              impact: "—" },
    ],
    scenarios: [
      { name: "Base Case",     description: "Stage 2; restructuring negotiation ongoing",          ecl12m: 3.74*M, eclLifetime:  9.08*M, vsBase12mPct:   0, stageComment: "Stage 2; restructuring likely" },
      { name: "Mild Stress",   description: "GDP −1%, RPK −10%; deferral accepted",               ecl12m: 5.02*M, eclLifetime: 12.18*M, vsBase12mPct:  34, stageComment: "Deferral accepted; ECL rises" },
      { name: "Severe Stress", description: "GDP −3%, RPK −30%; airline enters CCAA",             ecl12m: 8.72*M, eclLifetime: 21.17*M, vsBase12mPct: 133, stageComment: "Stage 3; repo scenario" },
    ],
    behaviourEvidence: {
      punctuality: [
        { date: "2025-07-01", event: "On-time payment", outcome: "Jul 2025 rental received on due date", weight: 7 },
        { date: "2026-01-19", event: "Late payment — 8 DPD", outcome: "Jan 2026 rental 8 days past due; payment holiday discussion ongoing", weight: -8 },
        { date: "2026-04-22", event: "Late payment — 8 DPD", outcome: "Apr 2026 rental 8 days past due; consistent with cash-flow timing pattern", weight: -8 },
      ],
      restructuringCoop: [
        { date: "2025-10-20", event: "Proactive restructuring approach", outcome: "Lessee proactively approached with restructuring proposal; full documentation provided", weight: 12 },
        { date: "2025-12-15", event: "Counsel engaged — no adversarial stance", outcome: "Lessee retained restructuring counsel but maintained cooperative posture throughout", weight: 8 },
        { date: "2026-02-28", event: "Initial term sheet accepted", outcome: "Lessee accepted initial term sheet for payment deferral; constructive engagement confirmed", weight: 15 },
      ],
      govtInterference: [
        { date: "2025-05-01", event: "Canada CTC full accession — TOP remedy elected", outcome: "Canada elected TOP (Topping-Up) remedy under CTC; strong lessor repossession framework", weight: 20 },
        { date: "2025-08-01", event: "Transport Canada review — neutral", outcome: "Transport Canada restructuring review: no adverse public interest determination", weight: 15 },
        { date: "2026-01-05", event: "CCAA eligibility confirmed", outcome: "Air Transat has CCAA (Companies' Creditors Arrangement Act) eligibility; Canadian insolvency is creditor-friendly", weight: 12 },
      ],
      litigationPropensity: [
        { date: "2025-06-10", event: "No prior litigation on record", outcome: "Historical review confirmed: no prior arbitration or litigation against this lessor", weight: 15 },
        { date: "2026-01-19", event: "Financial difficulty indicator met — no legal threat", outcome: "IFRS 9 §B5.5.17 financial difficulty indicator met; no legal action threatened", weight: -5 },
        { date: "2026-03-14", event: "Arbitration waiver agreed", outcome: "Lessee agreed to arbitration-only dispute resolution in restructuring term sheet", weight: 10 },
      ],
    },
    scoreHistory: [
      { month: "May '25", punctuality: 75, restructuringCoop: 68, govtInterference: 84, litigationPropensity: 43 },
      { month: "Jun '25", punctuality: 74, restructuringCoop: 69, govtInterference: 85, litigationPropensity: 44 },
      { month: "Jul '25", punctuality: 73, restructuringCoop: 70, govtInterference: 86, litigationPropensity: 44 },
      { month: "Aug '25", punctuality: 72, restructuringCoop: 71, govtInterference: 87, litigationPropensity: 45 },
      { month: "Sep '25", punctuality: 71, restructuringCoop: 72, govtInterference: 87, litigationPropensity: 46 },
      { month: "Oct '25", punctuality: 70, restructuringCoop: 73, govtInterference: 88, litigationPropensity: 46 },
      { month: "Nov '25", punctuality: 70, restructuringCoop: 74, govtInterference: 88, litigationPropensity: 47 },
      { month: "Dec '25", punctuality: 68, restructuringCoop: 74, govtInterference: 88, litigationPropensity: 47 },
      { month: "Jan '26", punctuality: 66, restructuringCoop: 75, govtInterference: 88, litigationPropensity: 47 },
      { month: "Feb '26", punctuality: 64, restructuringCoop: 75, govtInterference: 88, litigationPropensity: 47 },
      { month: "Mar '26", punctuality: 63, restructuringCoop: 75, govtInterference: 88, litigationPropensity: 47 },
      { month: "Apr '26", punctuality: 62, restructuringCoop: 75, govtInterference: 88, litigationPropensity: 47 },
    ],
  },

  EMIRATES: {
    meta: {
      name: "Emirates", country: "UAE", rating: "A-", stage: "1",
      exposure: 412*M, leaseCount: 8, behaviorScore: 94,
      scores: { punctuality: 98, restructuringCoop: 95, govtInterference: 92, litigationPropensity: 91 },
      lastPayment: "2026-04-28", daysOverdue: 0,
      notes: "Exemplary payment history. Strong sovereign backing. Low risk.",
    },
    leases: [
      { id: "LSE-2021-022", aircraft: "B777-300ER", msn: "62047", monthlyRentUSD: 1_240*K, ead: 88.4*M, leaseEnd: "2030-01-10", stage: "1" },
      { id: "LSE-2021-023", aircraft: "B777-300ER", msn: "62204", monthlyRentUSD: 1_240*K, ead: 86.2*M, leaseEnd: "2030-04-01", stage: "1" },
      { id: "LSE-2022-041", aircraft: "A350-900",   msn: "0612",  monthlyRentUSD:   960*K, ead: 68.8*M, leaseEnd: "2031-07-15", stage: "1" },
      { id: "LSE-2022-042", aircraft: "A350-900",   msn: "0634",  monthlyRentUSD:   960*K, ead: 66.4*M, leaseEnd: "2031-10-01", stage: "1" },
      { id: "LSE-2023-031", aircraft: "B777-300ER", msn: "64102", monthlyRentUSD: 1_240*K, ead: 38.2*M, leaseEnd: "2032-02-20", stage: "1" },
      { id: "LSE-2023-032", aircraft: "B777-300ER", msn: "64318", monthlyRentUSD: 1_240*K, ead: 36.4*M, leaseEnd: "2032-05-01", stage: "1" },
      { id: "LSE-2024-011", aircraft: "A350-900",   msn: "0891",  monthlyRentUSD:   960*K, ead: 14.8*M, leaseEnd: "2033-08-10", stage: "1" },
      { id: "LSE-2024-012", aircraft: "A350-900",   msn: "0912",  monthlyRentUSD:   960*K, ead: 12.8*M, leaseEnd: "2033-11-01", stage: "1" },
    ],
    eclRows: [
      { leaseId: "LSE-2021-022", aircraft: "B777-300ER", ead: 88.4*M, pd12m: 0.4, pdLifetime: 1.8, lgd: 38, ecl12m: 0.13*M, eclLifetime: 0.60*M, stage: "1" },
      { leaseId: "LSE-2021-023", aircraft: "B777-300ER", ead: 86.2*M, pd12m: 0.4, pdLifetime: 1.8, lgd: 38, ecl12m: 0.13*M, eclLifetime: 0.59*M, stage: "1" },
      { leaseId: "LSE-2022-041", aircraft: "A350-900",   ead: 68.8*M, pd12m: 0.4, pdLifetime: 1.8, lgd: 38, ecl12m: 0.10*M, eclLifetime: 0.47*M, stage: "1" },
      { leaseId: "LSE-2022-042", aircraft: "A350-900",   ead: 66.4*M, pd12m: 0.4, pdLifetime: 1.8, lgd: 38, ecl12m: 0.10*M, eclLifetime: 0.45*M, stage: "1" },
      { leaseId: "LSE-2023-031", aircraft: "B777-300ER", ead: 38.2*M, pd12m: 0.4, pdLifetime: 1.8, lgd: 38, ecl12m: 0.06*M, eclLifetime: 0.26*M, stage: "1" },
      { leaseId: "LSE-2023-032", aircraft: "B777-300ER", ead: 36.4*M, pd12m: 0.4, pdLifetime: 1.8, lgd: 38, ecl12m: 0.06*M, eclLifetime: 0.25*M, stage: "1" },
      { leaseId: "LSE-2024-011", aircraft: "A350-900",   ead: 14.8*M, pd12m: 0.4, pdLifetime: 1.8, lgd: 38, ecl12m: 0.02*M, eclLifetime: 0.10*M, stage: "1" },
      { leaseId: "LSE-2024-012", aircraft: "A350-900",   ead: 12.8*M, pd12m: 0.4, pdLifetime: 1.8, lgd: 38, ecl12m: 0.02*M, eclLifetime: 0.09*M, stage: "1" },
    ],
    monthlyDPD: makeDPD([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    events: [
      { date: "2026-04-28", type: "payment", description: "All 8 leases current — $8.56M total rent received", impact: "—" },
      { date: "2026-01-28", type: "payment", description: "All leases current",                                impact: "—" },
      { date: "2025-10-28", type: "payment", description: "All leases current",                                impact: "—" },
      { date: "2025-07-28", type: "payment", description: "All leases current",                                impact: "—" },
    ],
    scenarios: [
      { name: "Base Case",     description: "Strong counterparty; sovereign-backed",                    ecl12m: 0.62*M, eclLifetime: 2.81*M, vsBase12mPct:   0, stageComment: "Stage 1 maintained" },
      { name: "Mild Stress",   description: "GDP −1%, RPK −10%; UAE insulated",                        ecl12m: 0.94*M, eclLifetime: 4.26*M, vsBase12mPct:  52, stageComment: "Stage 1 maintained" },
      { name: "Severe Stress", description: "GDP −3%, RPK −30%, oil shock; UAE sovereign under stress", ecl12m: 1.88*M, eclLifetime: 8.51*M, vsBase12mPct: 203, stageComment: "SICR watch; Stage 2 possible" },
    ],
    behaviourEvidence: {
      punctuality: [
        { date: "2025-05-01", event: "On-time payment", outcome: "May 2025 rental received in full on due date", weight: 10 },
        { date: "2025-08-01", event: "On-time payment", outcome: "Aug 2025 rental received in full on due date", weight: 10 },
        { date: "2026-01-01", event: "On-time payment", outcome: "Jan 2026 rental received in full on due date", weight: 10 },
        { date: "2026-04-28", event: "On-time payment — 8-year record", outcome: "Apr 2026 rental received on due date in full; 8-year unbroken payment record maintained", weight: 10 },
      ],
      restructuringCoop: [
        { date: "2025-06-15", event: "Lease renewal agreed 18 months early", outcome: "Emirates proactively agreed 3-year lease extension 18 months before expiry; no negotiation required", weight: 15 },
        { date: "2026-02-10", event: "Audited financials provided proactively", outcome: "Emirates provided Q3 2025 audited financials without lessor request", weight: 10 },
      ],
      govtInterference: [
        { date: "2025-05-01", event: "ICD sovereign backing confirmed", outcome: "Investment Corporation of Dubai holds 55.6% stake in Emirates; strong sovereign guarantor", weight: 15 },
        { date: "2026-04-01", event: "UAE fiscal consolidation — minor note", outcome: "Minor UAE fiscal policy adjustment noted; no impact on Emirates operating licence or fleet financing", weight: -3 },
      ],
      litigationPropensity: [
        { date: "2025-05-01", event: "Zero litigation history confirmed", outcome: "Full historical review: zero arbitration or litigation actions by Emirates against any lessor", weight: 20 },
        { date: "2026-01-01", event: "Annual legal review — clean", outcome: "Annual legal review confirmed: zero active or threatened proceedings", weight: 10 },
      ],
    },
    scoreHistory: [
      { month: "May '25", punctuality: 96, restructuringCoop: 93, govtInterference: 90, litigationPropensity: 88 },
      { month: "Jun '25", punctuality: 97, restructuringCoop: 94, govtInterference: 91, litigationPropensity: 89 },
      { month: "Jul '25", punctuality: 97, restructuringCoop: 94, govtInterference: 91, litigationPropensity: 89 },
      { month: "Aug '25", punctuality: 98, restructuringCoop: 95, govtInterference: 92, litigationPropensity: 90 },
      { month: "Sep '25", punctuality: 98, restructuringCoop: 95, govtInterference: 92, litigationPropensity: 90 },
      { month: "Oct '25", punctuality: 98, restructuringCoop: 95, govtInterference: 92, litigationPropensity: 91 },
      { month: "Nov '25", punctuality: 98, restructuringCoop: 95, govtInterference: 92, litigationPropensity: 91 },
      { month: "Dec '25", punctuality: 98, restructuringCoop: 95, govtInterference: 92, litigationPropensity: 91 },
      { month: "Jan '26", punctuality: 98, restructuringCoop: 95, govtInterference: 92, litigationPropensity: 91 },
      { month: "Feb '26", punctuality: 98, restructuringCoop: 95, govtInterference: 92, litigationPropensity: 91 },
      { month: "Mar '26", punctuality: 98, restructuringCoop: 95, govtInterference: 92, litigationPropensity: 91 },
      { month: "Apr '26", punctuality: 98, restructuringCoop: 95, govtInterference: 92, litigationPropensity: 91 },
    ],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtM(n: number): string {
  const m = n / 1_000_000;
  if (m >= 1000) return `$${(m / 1000).toFixed(1)}B`;
  if (m % 1 === 0) return `$${m.toFixed(0)}M`;
  return `$${m.toFixed(1)}M`;
}

function fmtPct(n: number): string { return `${n.toFixed(1)}%`; }

function fmtK(n: number): string {
  const k = n / 1_000;
  return k % 1 === 0 ? `$${k.toFixed(0)}k` : `$${k.toFixed(1)}k`;
}

function dpdColour(days: number): string {
  if (days <= 0) return "#15803D";
  if (days < 30)  return "#B45309";
  return "#B91C1C";
}

function eventColour(type: EventType): string {
  switch (type) {
    case "payment":       return "#15803D";
    case "late":          return "#B45309";
    case "missed":        return "#B91C1C";
    case "rating-change": return "#7C3AED";
    case "stage-change":  return "#B91C1C";
    case "trigger":       return "#B45309";
    case "deferral":      return "#0F4C5C";
  }
}

function eventLabel(type: EventType): string {
  switch (type) {
    case "payment":       return "Payment";
    case "late":          return "Late Payment";
    case "missed":        return "Missed";
    case "rating-change": return "Rating ↓";
    case "stage-change":  return "Stage ↑";
    case "trigger":       return "SICR Trigger";
    case "deferral":      return "Deferral";
  }
}

function scenarioBg(name: string): string {
  if (name === "Mild Stress")   return "#FEF3C7";
  if (name === "Severe Stress") return "#FEE2E2";
  return "#FFFFFF";
}

function stageColour(stage: "1" | "2" | "3"): string {
  if (stage === "3") return "#B91C1C";
  if (stage === "2") return "#B45309";
  return "#002147";
}

function waRemainingTerm(leases: LesseeLeaseRow[]): number {
  const today = new Date("2026-05-02");
  const totalEAD = leases.reduce((sum, l) => sum + l.ead, 0);
  if (totalEAD === 0) return 0;
  return leases.reduce((sum, l) => {
    const yrs = (new Date(l.leaseEnd).getTime() - today.getTime()) / (365.25 * 24 * 3600 * 1000);
    return sum + Math.max(0, yrs) * l.ead;
  }, 0) / totalEAD;
}

function waPd(eclRows: LesseeECLRow[]): number {
  const totalEAD = eclRows.reduce((sum, r) => sum + r.ead, 0);
  if (totalEAD === 0) return 0;
  return eclRows.reduce((sum, r) => sum + r.pd12m * r.ead, 0) / totalEAD;
}

// ─── Tab sub-components ───────────────────────────────────────────────────────

const TABS = ["Overview", "Leases", "ECL", "Timeline", "Scenarios", "Behaviour"] as const;
type TabKey = typeof TABS[number];

// ── OverviewTab ───────────────────────────────────────────────────────────────

function OverviewTab({ meta }: { meta: LesseeMeta }) {
  const [showRestructuring, setShowRestructuring] = useState(false);
  const radarData = [
    { subject: "Punctuality",        score: meta.scores.punctuality },
    { subject: "Restr. Coop.",       score: meta.scores.restructuringCoop },
    { subject: "Govt. Independence", score: 100 - meta.scores.govtInterference },
    { subject: "Low Litigation",     score: 100 - meta.scores.litigationPropensity },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Analyst note */}
      <div style={{ padding: "0.75rem", background: meta.stage === "3" ? "rgba(185,28,28,0.05)" : meta.stage === "2" ? "rgba(180,83,9,0.05)" : "rgba(21,128,61,0.05)", borderRadius: "0.75rem", borderLeft: `3px solid ${stageColour(meta.stage)}` }}>
        <div style={{ fontSize: "0.8125rem", color: "#475569" }}>
          <strong style={{ color: "#0F172A" }}>Analyst Note:</strong> {meta.notes}
        </div>
      </div>
      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <KpiCard
          label="Behavior Score"
          value={meta.behaviorScore.toString()}
          subtitle="0 = worst · 100 = best"
          delta={meta.behaviorScore >= 80 ? "Low risk" : meta.behaviorScore >= 60 ? "Medium risk" : "High risk"}
          deltaType={meta.behaviorScore >= 80 ? "positive" : meta.behaviorScore >= 60 ? "neutral" : "negative"}
        />
        <KpiCard
          label="Days Overdue"
          value={meta.daysOverdue.toString()}
          subtitle={`Last payment: ${meta.lastPayment}`}
          delta={meta.daysOverdue === 0 ? "Current" : `${meta.daysOverdue} days late`}
          deltaType={meta.daysOverdue > 30 ? "negative" : meta.daysOverdue > 0 ? "neutral" : "positive"}
        />
      </div>
      {/* Radar + score bars */}
      <Card title="Behavior Score Breakdown" subtitle="Observed contractual-performance indicator under stress">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", alignItems: "center" }}>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#E2E8F0" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#475569" }} />
              <Radar name="Score" dataKey="score" stroke="#002147" fill="#002147" fillOpacity={0.15} />
            </RadarChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[
              { label: "Payment Punctuality",       score: meta.scores.punctuality },
              { label: "Restructuring Cooperation", score: meta.scores.restructuringCoop },
              { label: "Govt. Interference Risk",   score: 100 - meta.scores.govtInterference },
              { label: "Litigation Propensity",     score: 100 - meta.scores.litigationPropensity },
            ].map((item) => (
              <div key={item.label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                  <span style={{ fontSize: "0.8125rem", color: "#475569" }}>{item.label}</span>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: item.score >= 70 ? "#15803D" : item.score >= 50 ? "#B45309" : "#B91C1C" }}>{item.score}</span>
                </div>
                <div style={{ height: "5px", background: "#E2E8F0", borderRadius: "3px" }}>
                  <div style={{ width: `${item.score}%`, height: "100%", background: item.score >= 70 ? "#15803D" : item.score >= 50 ? "#B45309" : "#B91C1C", borderRadius: "3px" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
      {/* Restructuring Simulator */}
      <Card
        title="Restructuring Simulator"
        subtitle="Side-by-side comparison of 7 restructuring options"
        headerRight={
          <button
            onClick={() => setShowRestructuring(!showRestructuring)}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#002147", color: "#FFFFFF", border: "none", borderRadius: "9999px", padding: "0.5rem 1rem", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer" }}
          >
            {showRestructuring ? "Hide" : "Show"} Comparison
          </button>
        }
      >
        {showRestructuring ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums" }}>
              <thead>
                <tr style={{ background: "#F4F5F7" }}>
                  {["Option", "NPV to Lessor", "IRR", "ECL", "P95 Downside", "Time-to-Recovery", ""].map((h) => (
                    <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600, color: "#0F172A", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RESTRUCTURING_OPTIONS.map((opt, i) => {
                  const isTermination = opt.name.includes("Termination");
                  const isBest = opt.name === "Term Extension";
                  return (
                    <tr key={opt.name} style={{ borderBottom: "1px solid #E2E8F0", background: isBest ? "rgba(21,128,61,0.04)" : isTermination ? "rgba(185,28,28,0.04)" : i % 2 === 0 ? "#FFFFFF" : "#F4F5F7" }}>
                      <td style={{ padding: "0.75rem 1rem", fontWeight: isBest ? 600 : 400, color: "#0F172A" }}>
                        {isBest && <span style={{ fontSize: "0.625rem", color: "#15803D", fontWeight: 600, marginRight: "0.375rem", background: "rgba(21,128,61,0.1)", padding: "0.125rem 0.375rem", borderRadius: "0.5rem" }}>BEST</span>}
                        {opt.name}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#0F172A" }}>{opt.npv}</td>
                      <td style={{ padding: "0.75rem 1rem", color: "#0F172A" }}>{opt.irr}</td>
                      <td style={{ padding: "0.75rem 1rem", color: isTermination ? "#B91C1C" : "#0F172A" }}>{opt.ecl}</td>
                      <td style={{ padding: "0.75rem 1rem", color: isTermination ? "#B91C1C" : "#0F172A" }}>{opt.p95}</td>
                      <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{opt.recovery}</td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        {!isTermination && (
                          <button style={{ fontSize: "0.75rem", fontWeight: 500, color: "#002147", background: "transparent", border: "1px solid #E2E8F0", borderRadius: "9999px", padding: "0.25rem 0.625rem", cursor: "pointer" }}>
                            Draft Term Sheet
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: "1rem", background: "#F4F5F7", borderRadius: "0.75rem", fontSize: "0.8125rem", color: "#475569" }}>
            Click "Show Comparison" to compare NPV, IRR, ECL, and downside across 7 options for {meta.name}.
          </div>
        )}
      </Card>
    </div>
  );
}

// ── LeasesTab ─────────────────────────────────────────────────────────────────

function LeasesTab({ leases }: { leases: LesseeLeaseRow[] }) {
  const totalRent = leases.reduce((sum, l) => sum + l.monthlyRentUSD, 0);
  const waRT = waRemainingTerm(leases);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem" }}>
        <KpiCard label="Active Leases"     value={leases.length.toString()} />
        <KpiCard label="Total Rent / mo"   value={fmtM(totalRent)} />
        <KpiCard label="WA Remaining Term" value={`${waRT.toFixed(1)} yrs`} subtitle="EAD-weighted" />
      </div>
      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.75rem", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums" }}>
          <thead>
            <tr style={{ background: "#F4F5F7", borderBottom: "1px solid #E2E8F0" }}>
              {["Lease ID", "Aircraft", "MSN", "Rent / mo", "EAD", "Lease End", "Stage"].map((h) => (
                <th key={h} style={{ padding: "0.625rem 0.875rem", textAlign: "left", fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leases.map((l, i) => (
              <tr key={l.id} style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }}>
                <td style={{ padding: "0.5rem 0.875rem", fontFamily: "monospace", color: "#475569", fontSize: "0.75rem" }}>{l.id}</td>
                <td style={{ padding: "0.5rem 0.875rem", fontWeight: 600, color: "#0F172A" }}>{l.aircraft}</td>
                <td style={{ padding: "0.5rem 0.875rem", fontFamily: "monospace", color: "#475569" }}>{l.msn}</td>
                <td style={{ padding: "0.5rem 0.875rem", color: "#0F172A" }}>{fmtK(l.monthlyRentUSD)}</td>
                <td style={{ padding: "0.5rem 0.875rem", color: "#475569" }}>{fmtM(l.ead)}</td>
                <td style={{ padding: "0.5rem 0.875rem", color: "#475569" }}>{l.leaseEnd}</td>
                <td style={{ padding: "0.5rem 0.875rem" }}><StatusPill stage={l.stage} label={`S${l.stage}`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── ECLTab ────────────────────────────────────────────────────────────────────

function ECLTab({ eclRows }: { eclRows: LesseeECLRow[] }) {
  const totalEAD    = eclRows.reduce((sum, r) => sum + r.ead, 0);
  const totalEcl12m = eclRows.reduce((sum, r) => sum + r.ecl12m, 0);
  const totalEclLT  = eclRows.reduce((sum, r) => sum + r.eclLifetime, 0);
  const eclRate     = totalEAD > 0 ? (totalEclLT / totalEAD) * 100 : 0;
  const chartHeight = Math.max(160, eclRows.length * 44);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem" }}>
        <KpiCard label="Total ECL 12m"      value={fmtM(totalEcl12m)} />
        <KpiCard label="Total ECL Lifetime" value={fmtM(totalEclLT)} />
        <KpiCard label="ECL Rate"           value={fmtPct(eclRate)} subtitle="ECL LT / EAD" />
        <KpiCard label="WA PD 12m"          value={fmtPct(waPd(eclRows))} />
      </div>
      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.75rem", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums" }}>
          <thead>
            <tr style={{ background: "#F4F5F7", borderBottom: "1px solid #E2E8F0" }}>
              {["Lease", "Aircraft", "EAD", "PD 12m", "PD LT", "LGD", "ECL 12m", "ECL LT", "Stage"].map((h) => (
                <th key={h} style={{ padding: "0.625rem 0.875rem", textAlign: "left", fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {eclRows.map((r, i) => (
              <tr key={r.leaseId} style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }}>
                <td style={{ padding: "0.5rem 0.875rem", fontFamily: "monospace", color: "#475569", fontSize: "0.75rem" }}>{r.leaseId}</td>
                <td style={{ padding: "0.5rem 0.875rem", fontWeight: 600, color: "#0F172A" }}>{r.aircraft}</td>
                <td style={{ padding: "0.5rem 0.875rem", color: "#475569" }}>{fmtM(r.ead)}</td>
                <td style={{ padding: "0.5rem 0.875rem", color: "#475569" }}>{fmtPct(r.pd12m)}</td>
                <td style={{ padding: "0.5rem 0.875rem", color: "#475569" }}>{fmtPct(r.pdLifetime)}</td>
                <td style={{ padding: "0.5rem 0.875rem", color: "#475569" }}>{fmtPct(r.lgd)}</td>
                <td style={{ padding: "0.5rem 0.875rem", fontWeight: 600, color: (r.ecl12m / r.ead) > 0.05 ? "#B91C1C" : (r.ecl12m / r.ead) > 0.02 ? "#B45309" : "#0F172A" }}>{fmtM(r.ecl12m)}</td>
                <td style={{ padding: "0.5rem 0.875rem", color: "#475569" }}>{fmtM(r.eclLifetime)}</td>
                <td style={{ padding: "0.5rem 0.875rem" }}><StatusPill stage={r.stage} label={`S${r.stage}`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.75rem", padding: "1rem" }}>
        <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>ECL 12m by Lease</div>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={eclRows} layout="vertical" margin={{ left: 0, right: 52, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
            <XAxis type="number" tick={{ fontSize: 10, fill: "#475569" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtM(v)} />
            <YAxis type="category" dataKey="leaseId" tick={{ fontSize: 10, fill: "#475569" }} axisLine={false} tickLine={false} width={120} />
            <Tooltip
              cursor={{ fill: "rgba(0,33,71,0.04)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const r = payload[0].payload as LesseeECLRow;
                return (
                  <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.75rem", padding: "0.625rem 0.875rem", fontSize: "0.8125rem" }}>
                    <div style={{ fontWeight: 600, color: "#0F172A", marginBottom: "0.25rem" }}>{r.leaseId}</div>
                    <div style={{ color: "#475569" }}>Aircraft: {r.aircraft}</div>
                    <div style={{ color: "#475569" }}>ECL 12m: {fmtM(r.ecl12m)}</div>
                    <div style={{ color: "#475569" }}>ECL LT: {fmtM(r.eclLifetime)}</div>
                  </div>
                );
              }}
            />
            <Bar dataKey="ecl12m" radius={[0, 3, 3, 0]}>
              {eclRows.map((r) => (
                <Cell key={r.leaseId} fill={stageColour(r.stage)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── TimelineTab ───────────────────────────────────────────────────────────────

function TimelineTab({ monthlyDPD, events }: { monthlyDPD: MonthlyDPD[]; events: PaymentEvent[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.75rem", padding: "1rem" }}>
        <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>Payment Lateness — 12 Month DPD</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={monthlyDPD} margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#475569" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#475569" }} axisLine={false} tickLine={false} label={{ value: "DPD", angle: -90, position: "insideLeft", fontSize: 9, fill: "#94A3B8" }} />
            <Tooltip
              cursor={{ fill: "rgba(0,33,71,0.04)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as MonthlyDPD;
                return (
                  <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.75rem", padding: "0.5rem 0.75rem", fontSize: "0.8125rem" }}>
                    <div style={{ fontWeight: 600, color: "#0F172A" }}>{d.month}</div>
                    <div style={{ color: dpdColour(d.daysOverdue) }}>{d.daysOverdue > 0 ? `${d.daysOverdue} DPD` : "On time"}</div>
                  </div>
                );
              }}
            />
            <ReferenceLine y={30} stroke="#B91C1C" strokeDasharray="4 2" label={{ value: "30d trigger", position: "insideTopRight", fontSize: 9, fill: "#B91C1C" }} />
            <Bar dataKey="daysOverdue" radius={[3, 3, 0, 0]}>
              {monthlyDPD.map((d) => (
                <Cell key={d.month} fill={dpdColour(d.daysOverdue)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.75rem", overflow: "hidden" }}>
        <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #E2E8F0", fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Credit Event Log
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
          <thead>
            <tr style={{ background: "#F4F5F7", borderBottom: "1px solid #E2E8F0" }}>
              {["Date", "Type", "Description", "Impact"].map((h) => (
                <th key={h} style={{ padding: "0.625rem 0.875rem", textAlign: "left", fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map((ev, i) => {
              const isSevere = ev.type === "missed" || ev.type === "stage-change";
              const isAmber  = ev.type === "late"   || ev.type === "trigger" || ev.type === "deferral";
              const rowBg    = isSevere ? "rgba(185,28,28,0.03)" : isAmber ? "rgba(180,83,9,0.03)" : i % 2 === 0 ? "#FFFFFF" : "#F8FAFC";
              return (
                <tr key={`${ev.date}-${ev.type}-${i}`} style={{ borderBottom: "1px solid #F1F5F9", background: rowBg }}>
                  <td style={{ padding: "0.5rem 0.875rem", fontFamily: "monospace", color: "#475569", fontSize: "0.75rem", whiteSpace: "nowrap" }}>{ev.date}</td>
                  <td style={{ padding: "0.5rem 0.875rem", whiteSpace: "nowrap" }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "0.15rem 0.45rem", borderRadius: "0.25rem", background: `${eventColour(ev.type)}18`, color: eventColour(ev.type), border: `1px solid ${eventColour(ev.type)}30` }}>
                      {eventLabel(ev.type)}
                    </span>
                  </td>
                  <td style={{ padding: "0.5rem 0.875rem", color: "#0F172A" }}>{ev.description}</td>
                  <td style={{ padding: "0.5rem 0.875rem", color: "#64748B", fontSize: "0.75rem" }}>{ev.impact}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── ScenariosTab ──────────────────────────────────────────────────────────────

function ScenariosTab({ scenarios }: { scenarios: ScenarioRow[] }) {
  const base = scenarios[0];
  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.75rem", overflow: "hidden" }}>
      <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #E2E8F0", fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Lessee ECL Sensitivity — 3 Macro Scenarios
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums" }}>
        <thead>
          <tr style={{ background: "#F4F5F7", borderBottom: "1px solid #E2E8F0" }}>
            {["Scenario", "Macro Assumptions", "ECL 12m", "ECL Lifetime", "Δ vs Base", "Stage Impact"].map((h) => (
              <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {scenarios.map((s) => (
            <tr key={s.name} style={{ borderBottom: "1px solid #E2E8F0", background: scenarioBg(s.name) }}>
              <td style={{ padding: "0.875rem 1rem", fontWeight: 700, color: s.name === "Severe Stress" ? "#B91C1C" : s.name === "Mild Stress" ? "#B45309" : "#0F172A" }}>{s.name}</td>
              <td style={{ padding: "0.875rem 1rem", color: "#475569", fontStyle: "italic", fontSize: "0.75rem", maxWidth: "240px" }}>{s.description}</td>
              <td style={{ padding: "0.875rem 1rem", fontWeight: 600, color: "#0F172A" }}>{fmtM(s.ecl12m)}</td>
              <td style={{ padding: "0.875rem 1rem", color: "#475569" }}>{fmtM(s.eclLifetime)}</td>
              <td style={{ padding: "0.875rem 1rem", fontWeight: 700, color: s.vsBase12mPct === 0 ? "#64748B" : s.vsBase12mPct > 100 ? "#B91C1C" : "#B45309" }}>
                {s.vsBase12mPct === 0 ? "—" : `+${s.vsBase12mPct}%`}
              </td>
              <td style={{ padding: "0.875rem 1rem", fontSize: "0.75rem", color: s.name === "Severe Stress" ? "#B91C1C" : s.name === "Mild Stress" ? "#B45309" : "#475569" }}>{s.stageComment}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ padding: "0.625rem 1rem", background: "#F8FAFC", borderTop: "1px solid #E2E8F0", fontSize: "0.75rem", color: "#94A3B8" }}>
        Base: {base.description}
      </div>
    </div>
  );
}

// ─── BehaviourTab ─────────────────────────────────────────────────────────────

const SCORE_LABELS: Record<SubScoreKey, string> = {
  punctuality: "Payment Punctuality",
  restructuringCoop: "Restructuring Cooperation",
  govtInterference: "Govt. Interference Risk",
  litigationPropensity: "Litigation Propensity",
};

function BehaviourTab({ meta, behaviourEvidence, scoreHistory }: {
  meta: LesseeMeta;
  behaviourEvidence: BehaviourEvidence;
  scoreHistory: ScoreHistoryPoint[];
}) {
  const [openSection, setOpenSection] = useState<SubScoreKey | null>("punctuality");
  const [overrides, setOverrides] = useState<OverrideEntry[]>([]);
  const [overrideForm, setOverrideForm] = useState<{ subScore: SubScoreKey; newValue: number; reason: string }>({
    subScore: "punctuality",
    newValue: 50,
    reason: "",
  });

  // Apply active overrides to scores
  const currentScores = { ...meta.scores };
  for (const o of overrides) {
    const key = (Object.keys(SCORE_LABELS) as SubScoreKey[]).find(
      k => SCORE_LABELS[k] === o.subScore
    );
    if (key) currentScores[key] = o.newValue;
  }

  const scoreItems: Array<{ key: SubScoreKey; label: string; displayScore: number }> = [
    { key: "punctuality",        label: "Payment Punctuality",       displayScore: currentScores.punctuality },
    { key: "restructuringCoop",  label: "Restructuring Cooperation", displayScore: currentScores.restructuringCoop },
    { key: "govtInterference",   label: "Govt. Interference Risk",   displayScore: 100 - currentScores.govtInterference },
    { key: "litigationPropensity", label: "Litigation Propensity",   displayScore: 100 - currentScores.litigationPropensity },
  ];

  function scoreColor(s: number): string {
    return s >= 70 ? "#15803D" : s >= 50 ? "#B45309" : "#B91C1C";
  }
  function scoreBg(s: number): string {
    return s >= 70 ? "rgba(21,128,61,0.1)" : s >= 50 ? "rgba(180,83,9,0.1)" : "rgba(185,28,28,0.1)";
  }

  function handleOverrideSubmit() {
    const item = scoreItems.find(s => s.key === overrideForm.subScore);
    if (!item || !overrideForm.reason.trim()) return;
    const entry: OverrideEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      user: "analyst@aeroinsights.com",
      subScore: item.label,
      oldValue: item.displayScore,
      newValue: overrideForm.newValue,
      reason: overrideForm.reason.trim(),
    };
    setOverrides(prev => [entry, ...prev]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

      {/* OCPI Banner */}
      <div style={{ background: "#002147", borderRadius: "0.5rem", padding: "0.75rem 1rem" }}>
        <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#FFFFFF", marginBottom: "0.25rem" }}>
          Observed Contractual Performance Indicator (OCPI) — IFRS 9 §B5.5.17 compliance scoring framework
        </div>
        <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.7)" }}>
          All scores derived exclusively from observable contractual events. Cultural, national, or subjective proxies are excluded.
        </div>
      </div>

      {/* 2×2 Sparkline Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        {scoreItems.map(({ key, label, displayScore }) => {
          const sparkData = scoreHistory.map(h => ({
            month: h.month,
            value: (key === "govtInterference" || key === "litigationPropensity")
              ? 100 - h[key]
              : h[key],
          }));
          const sc = scoreColor(displayScore);
          return (
            <div key={key} style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "0.5rem", padding: "0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", lineHeight: 1.3 }}>OCPI — {label}</div>
                <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: sc, background: scoreBg(displayScore), borderRadius: "4px", padding: "0.125rem 0.375rem", flexShrink: 0 }}>
                  {displayScore}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={56}>
                <AreaChart data={sparkData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                  <defs>
                    <linearGradient id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={sc} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={sc} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="value" stroke={sc} strokeWidth={1.5} fill={`url(#grad-${key})`} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>

      {/* Evidence Accordion */}
      <Card title="OCPI Evidence Log" subtitle="Itemised contractual events underlying each sub-score">
        <div style={{ display: "flex", flexDirection: "column" }}>
          {scoreItems.map(({ key, label, displayScore }) => {
            const isOpen = openSection === key;
            const events = behaviourEvidence[key];
            const sc = scoreColor(displayScore);
            return (
              <div key={key} style={{ borderBottom: "1px solid #F1F5F9" }}>
                <button
                  onClick={() => setOpenSection(isOpen ? null : key)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.75rem 0",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0F172A" }}>
                      OCPI — {label}
                    </span>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: sc, background: scoreBg(displayScore), borderRadius: "4px", padding: "0.1rem 0.35rem" }}>
                      {displayScore}
                    </span>
                  </div>
                  {isOpen
                    ? <ChevronUp size={14} color="#94A3B8" />
                    : <ChevronDown size={14} color="#94A3B8" />}
                </button>
                {isOpen && (
                  <div style={{ paddingBottom: "0.75rem", overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                      <thead>
                        <tr style={{ background: "#F4F5F7" }}>
                          {["Date", "Event", "Observed Outcome", "Weight"].map(h => (
                            <th key={h} style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontSize: "0.6875rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {events.map((ev, i) => (
                          <tr
                            key={i}
                            style={{ borderBottom: "1px solid #F1F5F9" }}
                            onMouseEnter={e => ((e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA")}
                            onMouseLeave={e => ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")}
                          >
                            <td style={{ padding: "0.5rem 0.75rem", color: "#475569", whiteSpace: "nowrap", fontSize: "0.75rem" }}>{ev.date}</td>
                            <td style={{ padding: "0.5rem 0.75rem", fontWeight: 500, color: "#0F172A" }}>{ev.event}</td>
                            <td style={{ padding: "0.5rem 0.75rem", color: "#475569", maxWidth: "260px" }}>{ev.outcome}</td>
                            <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600, color: ev.weight >= 0 ? "#15803D" : "#B91C1C", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                              {ev.weight >= 0 ? `+${ev.weight}` : ev.weight}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Override Panel */}
      <Card title="Score Override — Governance & Audit Log" subtitle="Analyst overrides are immutably logged with reason and timestamp">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
          {/* Form */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "0.25rem" }}>Sub-Score</label>
              <select
                value={overrideForm.subScore}
                onChange={e => setOverrideForm(p => ({ ...p, subScore: e.target.value as SubScoreKey }))}
                style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #E2E8F0", borderRadius: "0.375rem", fontSize: "0.8125rem", color: "#0F172A", background: "#FFFFFF" }}
              >
                {scoreItems.map(s => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "0.25rem" }}>New Value (0–100)</label>
              <input
                type="number" min={0} max={100}
                value={overrideForm.newValue}
                onChange={e => setOverrideForm(p => ({ ...p, newValue: Math.min(100, Math.max(0, Number(e.target.value))) }))}
                style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #E2E8F0", borderRadius: "0.375rem", fontSize: "0.8125rem", color: "#0F172A", boxSizing: "border-box" as const }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", display: "block", marginBottom: "0.25rem" }}>Reason (required)</label>
              <textarea
                value={overrideForm.reason}
                onChange={e => setOverrideForm(p => ({ ...p, reason: e.target.value }))}
                placeholder="Describe the basis for this override..."
                rows={3}
                style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #E2E8F0", borderRadius: "0.375rem", fontSize: "0.8125rem", color: "#0F172A", resize: "none" as const, boxSizing: "border-box" as const }}
              />
            </div>
            <button
              onClick={handleOverrideSubmit}
              disabled={!overrideForm.reason.trim()}
              style={{
                background: overrideForm.reason.trim() ? "#002147" : "#94A3B8",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "9999px",
                padding: "0.5rem 1rem",
                fontSize: "0.8125rem",
                fontWeight: 500,
                cursor: overrideForm.reason.trim() ? "pointer" : "not-allowed",
              }}
            >
              Submit Override
            </button>
          </div>
          {/* Audit log */}
          <div>
            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.5rem" }}>
              Audit Log ({overrides.length} {overrides.length === 1 ? "entry" : "entries"})
            </div>
            {overrides.length === 0 ? (
              <div style={{ padding: "1rem", background: "#F8FAFC", borderRadius: "0.5rem", fontSize: "0.8125rem", color: "#94A3B8", textAlign: "center" as const }}>
                No overrides recorded
              </div>
            ) : (
              <div style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid #E2E8F0", borderRadius: "0.5rem" }}>
                {overrides.map(o => (
                  <div key={o.id} style={{ padding: "0.625rem 0.75rem", borderBottom: "1px solid #F1F5F9" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#0F172A" }}>{o.subScore}</span>
                      <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>{o.timestamp.slice(0, 10)}</span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#475569", marginBottom: "0.25rem" }}>
                      {o.oldValue} → <strong style={{ color: "#0F172A" }}>{o.newValue}</strong> · {o.user}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#475569", fontStyle: "italic" as const }}>{o.reason}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── LesseeProfilePanel ───────────────────────────────────────────────────────

export function LesseeProfilePanel({ lesseeId }: { lesseeId: LesseeId }) {
  const [activeTab, setActiveTab] = useState<TabKey>("Overview");
  const { meta, leases, eclRows, monthlyDPD, events, scenarios, behaviourEvidence, scoreHistory } = PROFILE_DATA[lesseeId];

  useEffect(() => { setActiveTab("Overview"); }, [lesseeId]);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Profile header */}
      <div style={{ background: "#002147", borderRadius: "1rem 1rem 0 0", padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "#FFFFFF", marginBottom: "0.25rem" }}>{meta.name}</div>
          <div style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.7)" }}>
            {meta.country} · {meta.rating} · {meta.leaseCount} leases · {fmtM(meta.exposure)} exposure
          </div>
        </div>
        <StatusPill stage={meta.stage} label={`Stage ${meta.stage}`} />
      </div>

      {/* Tab nav */}
      <div style={{ background: "#FFFFFF", borderLeft: "1px solid #E2E8F0", borderRight: "1px solid #E2E8F0", display: "flex", gap: 0, borderBottom: "1px solid #E2E8F0" }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "0.625rem 1.125rem",
              fontSize: "0.8125rem",
              fontWeight: 500,
              border: "none",
              borderBottom: activeTab === tab ? "2px solid #002147" : "2px solid transparent",
              background: "transparent",
              color: activeTab === tab ? "#002147" : "#475569",
              cursor: "pointer",
              transition: "all 200ms ease",
              marginBottom: "-1px",
              whiteSpace: "nowrap",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderTop: "none", borderRadius: "0 0 1rem 1rem", padding: "1.25rem" }}>
        {activeTab === "Overview"  && <OverviewTab  meta={meta} />}
        {activeTab === "Leases"    && <LeasesTab    leases={leases} />}
        {activeTab === "ECL"       && <ECLTab        eclRows={eclRows} />}
        {activeTab === "Timeline"  && <TimelineTab   monthlyDPD={monthlyDPD} events={events} />}
        {activeTab === "Scenarios" && <ScenariosTab  scenarios={scenarios} />}
        {activeTab === "Behaviour" && <BehaviourTab meta={meta} behaviourEvidence={behaviourEvidence} scoreHistory={scoreHistory} />}
      </div>
    </div>
  );
}
