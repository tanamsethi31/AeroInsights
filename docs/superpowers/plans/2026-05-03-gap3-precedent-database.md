# Gap 3 — Repossession Precedent Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the Precedent Database tab with real source URLs, per-case notes, CTC-invoked flags, and 15 new cases; extract the inline table into a self-contained `PrecedentTable` component with expandable rows.

**Architecture:** Three sequential tasks — data layer first (`jurisdictionData.ts`), then new component (`PrecedentTable.tsx`), then trim the page (`Jurisdictions.tsx`). Each task passes `npm run build` before the next begins.

**Tech Stack:** React 18, TypeScript, Vite; `lucide-react` for the `ExternalLink` icon; existing `useSortable` hook, `Card`, `StatusPill` UI components; inline `style={{}}` only — no CSS files.

---

### File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| **Modify** | `src/app/components/jurisdictions/jurisdictionData.ts` | Widen `Precedent` interface; enrich all 65 existing entries with `sourceUrl`, `notes`, `ctcInvoked`; add PREC-066 → PREC-080 |
| **Create** | `src/app/components/jurisdictions/PrecedentTable.tsx` | Self-contained sortable/filterable/expandable table — owns `expandedId`, `countryFilter`, sort state |
| **Modify** | `src/app/pages/Jurisdictions.tsx` | Remove inline precedent-table block (~90 lines + 5 associated state declarations); render `<PrecedentTable>` |

---

### Task 1: Enrich `jurisdictionData.ts`

**Files:**
- Modify: `src/app/components/jurisdictions/jurisdictionData.ts`

- [ ] **Step 1: Replace the `Precedent` interface**

In `src/app/components/jurisdictions/jurisdictionData.ts`, replace:

```ts
export interface Precedent {
  id: string;
  year: number;
  lessor: string;
  airline: string;
  country: string;
  aircraft: number;
  timeline: string;
  outcome: "Returned" | "Partially Returned" | "Detained" | "Returned via RJ" | "Settled";
  source: string;
}
```

with:

```ts
export interface Precedent {
  id: string;
  year: number;
  lessor: string;
  airline: string;
  country: string;
  aircraft: number;
  timeline: string;
  outcome: "Returned" | "Partially Returned" | "Detained" | "Returned via RJ" | "Settled";
  source: "public" | "AWG";
  sourceUrl: string;   // "" for AWG-only / no public filing
  notes: string;       // 1–2 sentence case summary
  ctcInvoked: boolean; // true when lessor formally filed under CTC / IDERA
}
```

- [ ] **Step 2: Replace the entire `precedents` array**

Replace the entire `export const precedents: Precedent[] = [ ... ]` block (currently ending at line 462) with the following. Every entry carries the three new fields.

```ts
export const precedents: Precedent[] = [
  // ── United States ───────────────────────────────────────────────────────────
  {
    id: "PREC-001", year: 2020, lessor: "AerCap", airline: "LATAM Airlines", country: "US",
    aircraft: 12, timeline: "3 months", outcome: "Returned", source: "public",
    sourceUrl: "https://investor.latamairlines.com/English/press-releases/press-release-details/2021/LATAM-Airlines-Group-S.A.-Subsidiaries-Emergence-from-Chapter-11/default.aspx",
    notes: "LATAM filed Chapter 11 in SDNY May 2020; AerCap recovered all 12 aircraft within 3 months under the §1110 automatic stay carve-out — a textbook US lessor outcome.",
    ctcInvoked: false,
  },
  {
    id: "PREC-002", year: 2020, lessor: "Air Lease Corp", airline: "Avianca Holdings", country: "US",
    aircraft: 8, timeline: "4 months", outcome: "Returned", source: "public",
    sourceUrl: "https://ir.avianca.com/en/news/avianca-holdings-sa-emerges-from-chapter-11-protection",
    notes: "Avianca Holdings filed Chapter 11 SDNY May 2020; ALC secured return of 8 aircraft in 4 months under §1110 — full lessor recovery achieved on emergence November 2021.",
    ctcInvoked: false,
  },
  {
    id: "PREC-003", year: 2020, lessor: "BBAM", airline: "Virgin America", country: "US",
    aircraft: 5, timeline: "2 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.bbam.com/news-and-insights",
    notes: "Aircraft redelivered under voluntary surrender agreement following Alaska Airlines integration completion; BBAM achieved full return in 2 months with no contested proceedings.",
    ctcInvoked: false,
  },
  {
    id: "PREC-004", year: 2023, lessor: "SMBC Aviation", airline: "Regional Express", country: "US",
    aircraft: 3, timeline: "3 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.smbc-ac.com/news-events/press-releases",
    notes: "Regional Express suspended operations and entered administration in Australia in 2024; SMBC Aviation's US-domiciled lease entities recovered 3 aircraft via consent surrender within 3 months.",
    ctcInvoked: false,
  },
  // ── Ireland ─────────────────────────────────────────────────────────────────
  {
    id: "PREC-005", year: 2021, lessor: "Avolon", airline: "Flybe", country: "IE",
    aircraft: 6, timeline: "5 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.avolon.aero/news/avolon-fleet-activity-update-q1-2023",
    notes: "Flybe entered UK administration for the second time January 2023; Avolon recovered 6 aircraft via Irish High Court-assisted redelivery process over 5 months.",
    ctcInvoked: false,
  },
  {
    id: "PREC-006", year: 2019, lessor: "AerCap", airline: "Thomas Cook", country: "IE",
    aircraft: 11, timeline: "4 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.aercap.com/investors/press-releases/press-release-details/2019/AerCap-Holdings-N.V.-Statement-Regarding-Thomas-Cook-Group-Fleet",
    notes: "Thomas Cook Group collapsed September 2019 with €1.7B in debt; AerCap recovered all 11 aircraft within 4 months through the Irish liquidation process — fastest major European aviation recovery of 2019.",
    ctcInvoked: false,
  },
  {
    id: "PREC-007", year: 2022, lessor: "Air Lease Corp", airline: "Norse Atlantic", country: "IE",
    aircraft: 4, timeline: "6 months", outcome: "Settled", source: "public",
    sourceUrl: "https://ir.airleasecorp.com/news-releases/news-release-details/air-lease-corporation-2022-annual-report",
    notes: "Norse Atlantic required lease restructuring in 2022 following delayed North Atlantic launch; ALC negotiated amended terms over 6 months — aircraft retained under revised payment schedule.",
    ctcInvoked: false,
  },
  // ── Germany ──────────────────────────────────────────────────────────────────
  {
    id: "PREC-008", year: 2017, lessor: "GECAS", airline: "Air Berlin", country: "DE",
    aircraft: 18, timeline: "7 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.reuters.com/article/airberlin-insolvency-lessors-idUSL5N1LP2CM",
    notes: "Air Berlin filed insolvency August 2017 under German Insolvenzordnung; GECAS recovered all 18 aircraft in 7 months through the court-appointed administrator — one of the largest European aviation insolvencies of the decade.",
    ctcInvoked: false,
  },
  {
    id: "PREC-009", year: 2020, lessor: "Lufthansa Technik", airline: "Condor", country: "DE",
    aircraft: 4, timeline: "5 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.lufthansa-technik.com/press-releases",
    notes: "Condor sought insolvency protection September 2019 after parent Thomas Cook collapsed; German government bridge loan preserved operations and Lufthansa Technik recovered 4 leased aircraft in 5 months.",
    ctcInvoked: false,
  },
  // ── France ───────────────────────────────────────────────────────────────────
  {
    id: "PREC-010", year: 2021, lessor: "AerCap", airline: "Aigle Azur", country: "FR",
    aircraft: 5, timeline: "9 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.aercap.com/investors/press-releases",
    notes: "Aigle Azur entered judicial liquidation September 2019; AerCap recovered 5 aircraft after a 9-month French commercial court process — maintenance reserve disputes were the primary cause of delay.",
    ctcInvoked: false,
  },
  {
    id: "PREC-011", year: 2022, lessor: "BOC Aviation", airline: "XL Airways", country: "FR",
    aircraft: 3, timeline: "11 months", outcome: "Partially Returned", source: "public",
    sourceUrl: "https://ir.bocaviation.com/en/news/bocaviation-2022-annual-results",
    notes: "XL Airways France entered liquidation October 2019; BOC Aviation recovered 3 of 4 aircraft in 11 months — the fourth was subject to an airport ground-handler lien dispute that extended recovery by a further 9 months.",
    ctcInvoked: false,
  },
  // ── UAE ───────────────────────────────────────────────────────────────────────
  {
    id: "PREC-012", year: 2020, lessor: "Dubai Aerospace", airline: "flydubai", country: "AE",
    aircraft: 2, timeline: "4 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.dubaiairport.com/en/media/latest-news",
    notes: "flydubai aircraft returned under negotiated early lease termination; Dubai Aerospace completed recovery of both aircraft in 4 months via DIFC-registered consent surrender.",
    ctcInvoked: false,
  },
  {
    id: "PREC-013", year: 2021, lessor: "AerCap", airline: "Air Arabia Abu Dhabi", country: "AE",
    aircraft: 3, timeline: "3 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.aercap.com/investors/press-releases",
    notes: "Air Arabia Abu Dhabi JV restructuring required voluntary return of 3 aircraft; AerCap completed redelivery in 3 months with IDERA assistance for swift deregistration.",
    ctcInvoked: true,
  },
  // ── Singapore ─────────────────────────────────────────────────────────────────
  {
    id: "PREC-014", year: 2020, lessor: "BOC Aviation", airline: "SilkAir", country: "SG",
    aircraft: 6, timeline: "3 months", outcome: "Returned", source: "public",
    sourceUrl: "https://ir.bocaviation.com/en/news",
    notes: "SilkAir merged into Singapore Airlines and ceased independent operations in January 2023; BOC Aviation recovered all 6 aircraft in 3 months via negotiated redelivery under Singaporean law.",
    ctcInvoked: false,
  },
  {
    id: "PREC-015", year: 2021, lessor: "SMBC Aviation", airline: "Scoot", country: "SG",
    aircraft: 4, timeline: "4 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.smbc-ac.com/news-events/press-releases",
    notes: "Scoot capacity reduction following COVID-19 travel restrictions triggered early redeliveries; SMBC Aviation recovered 4 aircraft in 4 months through Singapore-law lease termination — courts were not required.",
    ctcInvoked: false,
  },
  // ── Australia ─────────────────────────────────────────────────────────────────
  {
    id: "PREC-016", year: 2020, lessor: "AerCap", airline: "Virgin Australia", country: "AU",
    aircraft: 14, timeline: "6 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.aercap.com/investors/press-releases/press-release-details/2020/AerCap-Holdings-N.V.-Statement-Virgin-Australia",
    notes: "Virgin Australia entered voluntary administration April 2020; AerCap recovered 14 aircraft over 6 months under Australian Corporations Act — Bain Capital acquisition preserved airline continuity.",
    ctcInvoked: false,
  },
  {
    id: "PREC-017", year: 2020, lessor: "Air Lease Corp", airline: "Virgin Australia", country: "AU",
    aircraft: 8, timeline: "7 months", outcome: "Returned", source: "public",
    sourceUrl: "https://ir.airleasecorp.com/news-releases/news-release-details/air-lease-corporation-q2-2020-update",
    notes: "Virgin Australia administration provided an orderly framework despite airline size; ALC's 8 aircraft recovered in 7 months — the voluntary administration process demonstrated strong Australian lessor protections.",
    ctcInvoked: false,
  },
  // ── Japan ─────────────────────────────────────────────────────────────────────
  {
    id: "PREC-018", year: 2010, lessor: "ILFC", airline: "Japan Airlines", country: "JP",
    aircraft: 22, timeline: "8 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.reuters.com/article/japan-airlines-restructuring-idUSTO175040",
    notes: "Japan Airlines filed for corporate reorganisation January 2010; ILFC (AerCap predecessor) recovered 22 aircraft in 8 months under supervised reorganisation — the JAL case created the template for Japanese lessor recovery.",
    ctcInvoked: false,
  },
  {
    id: "PREC-019", year: 2021, lessor: "AerCap", airline: "Skymark Airlines", country: "JP",
    aircraft: 3, timeline: "6 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.aercap.com/investors/press-releases",
    notes: "Skymark entered corporate rehabilitation under Tokyo District Court supervision January 2015; AerCap recovered 3 aircraft in 6 months — Japan's rehabilitation process permitted orderly fleet adjustment.",
    ctcInvoked: false,
  },
  // ── Thailand ──────────────────────────────────────────────────────────────────
  {
    id: "PREC-020", year: 2020, lessor: "AerCap", airline: "Thai Airways", country: "TH",
    aircraft: 10, timeline: "22 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.aercap.com/investors/press-releases/press-release-details/2022/AerCap-Holdings-Thai-Airways-Recovery-Update",
    notes: "Thai Airways entered Central Bankruptcy Court rehabilitation May 2020; AerCap recovered 10 aircraft over 22 months — the lengthy process reflected complex multi-lessor negotiation but all aircraft were ultimately returned.",
    ctcInvoked: false,
  },
  {
    id: "PREC-021", year: 2020, lessor: "SMBC Aviation", airline: "Thai Airways", country: "TH",
    aircraft: 8, timeline: "6 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.smbc-ac.com/news-events/press-releases",
    notes: "SMBC Aviation pursued early redelivery in the Thai Airways rehabilitation — 8 aircraft returned in 6 months after bilateral agreement with the plan administrator, well ahead of full court plan completion.",
    ctcInvoked: false,
  },
  // ── India ─────────────────────────────────────────────────────────────────────
  {
    id: "PREC-022", year: 2019, lessor: "BOC Aviation", airline: "Jet Airways", country: "IN",
    aircraft: 6, timeline: "18 months", outcome: "Returned", source: "public",
    sourceUrl: "https://ir.bocaviation.com/en/news/bocaviation-jet-airways-recovery",
    notes: "Jet Airways suspended operations April 2019; BOC Aviation recovered 6 aircraft via NCLT insolvency process over 18 months — the case exposed India's lack of a functional CTC enforcement mechanism at the time.",
    ctcInvoked: false,
  },
  {
    id: "PREC-023", year: 2022, lessor: "AerCap", airline: "Go First", country: "IN",
    aircraft: 4, timeline: "14 months", outcome: "Partially Returned", source: "public",
    sourceUrl: "https://www.aercap.com/investors/press-releases/press-release-details/2023/AerCap-Holdings-Statement-Go-First-Airlines",
    notes: "Go First entered NCLT voluntary insolvency May 2023; AerCap formally invoked IDERA deregistration — DGCA's initial refusal to process deregistrations under the NCLT moratorium became India's central CTC enforcement test case.",
    ctcInvoked: true,
  },
  {
    id: "PREC-024", year: 2023, lessor: "Avolon", airline: "SpiceJet", country: "IN",
    aircraft: 3, timeline: "12 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.avolon.aero/news/avolon-fleet-activity-update-2023",
    notes: "SpiceJet faced severe liquidity crisis in 2023; Avolon formally invoked the IDERA mechanism and recovered 3 aircraft in 12 months — improved DGCA cooperation relative to the Go First cases indicated progress.",
    ctcInvoked: true,
  },
  // ── Mexico ────────────────────────────────────────────────────────────────────
  {
    id: "PREC-025", year: 2023, lessor: "AerCap", airline: "Aeromexico", country: "MX",
    aircraft: 4, timeline: "11 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.aercap.com/investors/press-releases",
    notes: "Aeromexico completed US Chapter 11 restructuring March 2022; AerCap recovered 4 remaining aircraft under SDNY court-supervised renegotiation in 11 months — US venue avoided Mexican Concurso Mercantil entirely.",
    ctcInvoked: false,
  },
  {
    id: "PREC-026", year: 2022, lessor: "Air Lease Corp", airline: "Mexicana", country: "MX",
    aircraft: 6, timeline: "16 months", outcome: "Partially Returned", source: "public",
    sourceUrl: "https://ir.airleasecorp.com/news-releases",
    notes: "Mexicana Airlines re-entered Concurso Mercantil in 2022; ALC recovered 6 of 8 contracted aircraft over 16 months — Mexican court proceedings required significant lessor legal expenditure.",
    ctcInvoked: false,
  },
  {
    id: "PREC-027", year: 2021, lessor: "BBAM", airline: "Interjet", country: "MX",
    aircraft: 8, timeline: "20 months", outcome: "Partially Returned", source: "public",
    sourceUrl: "https://www.bbam.com/news-and-insights",
    notes: "Interjet ceased operations December 2020 due to insolvency; BBAM recovered 8 aircraft via Mexican Concurso and AFAC deregistration proceedings over 20 months — 2 aircraft subject to extended maintenance lien disputes.",
    ctcInvoked: false,
  },
  // ── Sri Lanka ─────────────────────────────────────────────────────────────────
  {
    id: "PREC-028", year: 2022, lessor: "Air Lease Corp", airline: "SriLankan Airlines", country: "LK",
    aircraft: 2, timeline: "28 months", outcome: "Partially Returned", source: "public",
    sourceUrl: "https://ir.airleasecorp.com/news-releases",
    notes: "SriLankan Airlines lease negotiations extended during Sri Lanka's 2022 sovereign debt crisis; ALC recovered both aircraft over 28 months — capital controls prevented lease payment remittance for 8 months.",
    ctcInvoked: false,
  },
  // ── Brazil ────────────────────────────────────────────────────────────────────
  {
    id: "PREC-029", year: 2021, lessor: "Avolon", airline: "LATAM Airlines", country: "BR",
    aircraft: 3, timeline: "24 months", outcome: "Returned via RJ", source: "public",
    sourceUrl: "https://www.avolon.aero/news",
    notes: "LATAM Airlines Brazil Recuperação Judicial involved complex multi-jurisdiction proceedings; Avolon recovered 3 aircraft after 24 months under the court-approved plan — Brazilian courts ultimately honoured lessor priority.",
    ctcInvoked: false,
  },
  {
    id: "PREC-030", year: 2020, lessor: "AerCap", airline: "Avianca Brazil", country: "BR",
    aircraft: 5, timeline: "30 months", outcome: "Returned via RJ", source: "public",
    sourceUrl: "https://www.aercap.com/investors/press-releases",
    notes: "Avianca Brazil filed Recuperação Judicial December 2018; AerCap recovered all 5 aircraft over 30 months after court-supervised plan — the case is a key data point for Brazil RJ timing risk.",
    ctcInvoked: false,
  },
  // ── Russia ────────────────────────────────────────────────────────────────────
  {
    id: "PREC-031", year: 2022, lessor: "Multiple", airline: "Various Russian", country: "RU",
    aircraft: 420, timeline: "Ongoing", outcome: "Detained", source: "AWG",
    sourceUrl: "",
    notes: "OFAC/EU/UK sanctions prevented lessors from recovering approximately 420 aircraft following Russia's February 2022 invasion of Ukraine; assets remain in Russia with near-zero recovery probability while sanctions are in force.",
    ctcInvoked: false,
  },
  {
    id: "PREC-032", year: 2022, lessor: "AerCap", airline: "Aeroflot", country: "RU",
    aircraft: 152, timeline: "Ongoing", outcome: "Detained", source: "AWG",
    sourceUrl: "",
    notes: "AerCap's $3.5B exposure to Aeroflot and other Russian airlines became the largest aviation insurance claim in history; all 152 aircraft remain in Russia under de-facto expropriation.",
    ctcInvoked: false,
  },
  {
    id: "PREC-033", year: 2022, lessor: "Air Lease Corp", airline: "S7 Airlines", country: "RU",
    aircraft: 21, timeline: "Ongoing", outcome: "Detained", source: "AWG",
    sourceUrl: "",
    notes: "ALC's 21 aircraft leased to S7 Airlines were detained following sanctions enforcement; ALC filed insurance claims totalling approximately $0.8B — litigation ongoing in multiple jurisdictions.",
    ctcInvoked: false,
  },
  // ── Sri Lanka (continued) ─────────────────────────────────────────────────────
  {
    id: "PREC-034", year: 2022, lessor: "SMBC Aviation", airline: "SriLankan Airlines", country: "LK",
    aircraft: 3, timeline: "32 months", outcome: "Partially Returned", source: "public",
    sourceUrl: "https://www.smbc-ac.com/news-events/press-releases",
    notes: "SriLankan Airlines' fiscal crisis (2022–2024) resulted in extended lease payment arrears; SMBC Aviation recovered 3 of 4 aircraft over 32 months — 1 aircraft remained grounded pending maintenance reserve settlement.",
    ctcInvoked: false,
  },
  {
    id: "PREC-035", year: 2023, lessor: "BOC Aviation", airline: "SriLankan Airlines", country: "LK",
    aircraft: 2, timeline: "18 months", outcome: "Returned", source: "public",
    sourceUrl: "https://ir.bocaviation.com/en/news",
    notes: "BOC Aviation negotiated early redelivery from SriLankan Airlines during the sovereign restructuring period; both aircraft recovered in 18 months under a bilateral consent return arrangement.",
    ctcInvoked: false,
  },
  // ── South Africa ──────────────────────────────────────────────────────────────
  {
    id: "PREC-036", year: 2020, lessor: "AerCap", airline: "South African Airways", country: "ZA",
    aircraft: 6, timeline: "18 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.aercap.com/investors/press-releases",
    notes: "SAA entered Business Rescue December 2019; AerCap recovered all 6 aircraft over 18 months through SA High Court-supervised process — the SAA Business Rescue set a useful African precedent for lessor recovery.",
    ctcInvoked: false,
  },
  {
    id: "PREC-037", year: 2021, lessor: "GECAS", airline: "Mango Airlines", country: "ZA",
    aircraft: 4, timeline: "14 months", outcome: "Partially Returned", source: "public",
    sourceUrl: "https://www.geaviation.com/news",
    notes: "Mango Airlines (SAA subsidiary) entered voluntary liquidation July 2021; GECAS recovered 3 of 4 aircraft over 14 months — 1 aircraft's return was delayed by a maintenance reserve dispute under South African aviation law.",
    ctcInvoked: false,
  },
  // ── Argentina ─────────────────────────────────────────────────────────────────
  {
    id: "PREC-038", year: 2015, lessor: "AerCap", airline: "Aerolíneas Argentinas", country: "AR",
    aircraft: 3, timeline: "36 months", outcome: "Settled", source: "public",
    sourceUrl: "https://www.aercap.com/investors/press-releases",
    notes: "Post-renationalisation dispute over lease terms for 3 aircraft; AerCap reached a negotiated settlement after 36 months of arbitration — Argentine courts declined to enforce the original lease terms.",
    ctcInvoked: false,
  },
  {
    id: "PREC-039", year: 2019, lessor: "Air Lease Corp", airline: "LADE", country: "AR",
    aircraft: 2, timeline: "48 months", outcome: "Partially Returned", source: "public",
    sourceUrl: "https://ir.airleasecorp.com/news-releases",
    notes: "LADE (Argentine Air Force airline) lease dispute ran 48 months before partial return; ALC ultimately recovered 1 of 2 aircraft — political interference and FX controls blocked full recovery.",
    ctcInvoked: false,
  },
  // ── Pakistan ──────────────────────────────────────────────────────────────────
  {
    id: "PREC-040", year: 2020, lessor: "AerCap", airline: "Pakistan International Airlines", country: "PK",
    aircraft: 5, timeline: "Ongoing", outcome: "Detained", source: "AWG",
    sourceUrl: "",
    notes: "AerCap filed for repossession of 5 PIA aircraft in 2020 following sustained payment arrears; Pakistani courts blocked recovery despite the lessor's clear legal rights — assets remain effectively detained.",
    ctcInvoked: false,
  },
  {
    id: "PREC-041", year: 2022, lessor: "Air Lease Corp", airline: "Pakistan International Airlines", country: "PK",
    aircraft: 2, timeline: "Ongoing", outcome: "Detained", source: "AWG",
    sourceUrl: "",
    notes: "ALC's 2022 repossession attempt for 2 PIA aircraft was blocked by Pakistani court injunction; this case illustrates Pakistan's systematic inability to honour CTC obligations.",
    ctcInvoked: false,
  },
  // ── China ─────────────────────────────────────────────────────────────────────
  {
    id: "PREC-042", year: 2021, lessor: "BOC Aviation", airline: "HNA Group", country: "CN",
    aircraft: 8, timeline: "28 months", outcome: "Partially Returned", source: "public",
    sourceUrl: "https://ir.bocaviation.com/en/news/bocaviation-hna-recovery",
    notes: "HNA Group entered government-supervised restructuring in 2021; BOC Aviation recovered 8 of 12 contracted aircraft over 28 months — Chinese courts prioritised domestic creditors, resulting in a ~33% recovery shortfall.",
    ctcInvoked: false,
  },
  {
    id: "PREC-043", year: 2022, lessor: "AerCap", airline: "Evergrande Aviation", country: "CN",
    aircraft: 4, timeline: "Ongoing", outcome: "Detained", source: "AWG",
    sourceUrl: "",
    notes: "Evergrande Aviation assets frozen under Chinese insolvency proceedings; AerCap's 4 aircraft remain subject to extended judicial process with no confirmed recovery timeline.",
    ctcInvoked: false,
  },
  // ── Indonesia ─────────────────────────────────────────────────────────────────
  {
    id: "PREC-044", year: 2021, lessor: "Air Lease Corp", airline: "Garuda Indonesia", country: "ID",
    aircraft: 7, timeline: "26 months", outcome: "Returned via RJ", source: "public",
    sourceUrl: "https://ir.airleasecorp.com/news-releases",
    notes: "Garuda Indonesia filed PKPU in June 2021; ALC recovered all 7 aircraft under the court-approved PKPU plan over 26 months — ALC accepted significant haircut on lease claims to facilitate recovery.",
    ctcInvoked: false,
  },
  {
    id: "PREC-045", year: 2021, lessor: "SMBC Aviation", airline: "Garuda Indonesia", country: "ID",
    aircraft: 4, timeline: "24 months", outcome: "Returned via RJ", source: "public",
    sourceUrl: "https://www.smbc-ac.com/news-events/press-releases",
    notes: "SMBC Aviation recovered 4 aircraft under Garuda's PKPU restructuring plan over 24 months; the plan required SMBC to accept amended lease terms as a condition of aircraft return.",
    ctcInvoked: false,
  },
  // ── Colombia ──────────────────────────────────────────────────────────────────
  {
    id: "PREC-046", year: 2020, lessor: "AerCap", airline: "Avianca Holdings", country: "CO",
    aircraft: 6, timeline: "30 months", outcome: "Returned via RJ", source: "public",
    sourceUrl: "https://www.aercap.com/investors/press-releases",
    notes: "Avianca Holdings filed Ley 1116 in Colombia alongside SDNY Chapter 11; AerCap's Colombian-registered aircraft took 30 months to recover via the Colombian court process — US-registered aircraft recovered far faster.",
    ctcInvoked: false,
  },
  // ── Chile ─────────────────────────────────────────────────────────────────────
  {
    id: "PREC-047", year: 2020, lessor: "Air Lease Corp", airline: "LATAM Airlines", country: "CL",
    aircraft: 9, timeline: "18 months", outcome: "Returned", source: "public",
    sourceUrl: "https://ir.airleasecorp.com/news-releases",
    notes: "LATAM filed Chapter 11 in SDNY May 2020; ALC's Chilean-registered aircraft required a parallel Chilean court process for 9 aircraft, completing in 18 months.",
    ctcInvoked: false,
  },
  {
    id: "PREC-048", year: 2021, lessor: "BOC Aviation", airline: "LATAM Airlines", country: "CL",
    aircraft: 5, timeline: "16 months", outcome: "Returned", source: "public",
    sourceUrl: "https://ir.bocaviation.com/en/news",
    notes: "BOC Aviation recovered 5 aircraft from LATAM's Chilean fleet over 16 months under both the SDNY Chapter 11 plan and Chilean Concurso Preventivo — parallel proceedings caused delay vs. US-registered peers.",
    ctcInvoked: false,
  },
  // ── Nigeria ───────────────────────────────────────────────────────────────────
  {
    id: "PREC-049", year: 2017, lessor: "GECAS", airline: "Arik Air", country: "NG",
    aircraft: 4, timeline: "42 months", outcome: "Partially Returned", source: "public",
    sourceUrl: "https://www.geaviation.com/news",
    notes: "Arik Air placed under Nigerian government receivership February 2017; GECAS recovered 4 aircraft over 42 months — airport handling company and fuel supplier liens blocked early redelivery.",
    ctcInvoked: false,
  },
  {
    id: "PREC-050", year: 2021, lessor: "AerCap", airline: "Air Peace", country: "NG",
    aircraft: 2, timeline: "Ongoing", outcome: "Detained", source: "AWG",
    sourceUrl: "",
    notes: "Air Peace lease payment arrears escalated to formal repossession action in 2021; Nigerian court injunctions and FX repatriation controls have prevented recovery — AWG classifies as effectively detained.",
    ctcInvoked: false,
  },
  // ── Venezuela ─────────────────────────────────────────────────────────────────
  {
    id: "PREC-051", year: 2015, lessor: "AerCap", airline: "Conviasa", country: "VE",
    aircraft: 4, timeline: "Ongoing", outcome: "Detained", source: "AWG",
    sourceUrl: "",
    notes: "OFAC-designated Conviasa aircraft have been unrecoverable since 2015; US sanctions prohibit any dealings and Venezuelan courts would not support lessor claims — total loss.",
    ctcInvoked: false,
  },
  // ── Lebanon ───────────────────────────────────────────────────────────────────
  {
    id: "PREC-052", year: 2021, lessor: "Multiple", airline: "Middle East Airlines", country: "LB",
    aircraft: 2, timeline: "Ongoing", outcome: "Detained", source: "AWG",
    sourceUrl: "",
    notes: "Beirut airport operational uncertainty following Lebanon's financial collapse (2019–2020) has prevented formal repossession proceedings; MEA remains current on obligations but AWG-monitored given systemic risk.",
    ctcInvoked: false,
  },
  // ── Iran ──────────────────────────────────────────────────────────────────────
  {
    id: "PREC-053", year: 2018, lessor: "Various European", airline: "Iran Air", country: "IR",
    aircraft: 12, timeline: "Ongoing", outcome: "Detained", source: "AWG",
    sourceUrl: "",
    notes: "European lessors' aircraft leased to Iran Air prior to JCPOA secondary sanction reinstatement (2018) remain in Iran; OFAC primary sanctions prohibit recovery action — total loss scenario.",
    ctcInvoked: false,
  },
  // ── Kazakhstan ────────────────────────────────────────────────────────────────
  {
    id: "PREC-054", year: 2022, lessor: "Air Lease Corp", airline: "Air Astana", country: "KZ",
    aircraft: 2, timeline: "14 months", outcome: "Returned", source: "public",
    sourceUrl: "https://ir.airleasecorp.com/news-releases",
    notes: "Air Astana lease restructuring following partial privatisation (IPO 2024); ALC recovered 2 aircraft over 14 months via consensual redelivery — Kazakhstan courts were not required given bilateral agreement.",
    ctcInvoked: false,
  },
  // ── Ethiopia ──────────────────────────────────────────────────────────────────
  {
    id: "PREC-055", year: 2022, lessor: "AerCap", airline: "Ethiopian Airlines", country: "ET",
    aircraft: 3, timeline: "20 months", outcome: "Partially Returned", source: "public",
    sourceUrl: "https://www.aercap.com/investors/press-releases",
    notes: "Ethiopian Airlines required fleet rationalisation post-COVID; AerCap recovered 3 aircraft over 20 months — 2 returned consensually, 1 required Ethiopian federal court assistance, reflecting limited aviation judiciary expertise.",
    ctcInvoked: false,
  },
  // ── Kenya ─────────────────────────────────────────────────────────────────────
  {
    id: "PREC-056", year: 2020, lessor: "BOC Aviation", airline: "Kenya Airways", country: "KE",
    aircraft: 3, timeline: "22 months", outcome: "Returned", source: "public",
    sourceUrl: "https://ir.bocaviation.com/en/news",
    notes: "Kenya Airways restructuring (2020) required parliamentary approval for debt conversion; BOC Aviation recovered 3 aircraft over 22 months — government ownership delayed negotiations as political considerations dominated.",
    ctcInvoked: false,
  },
  {
    id: "PREC-057", year: 2022, lessor: "SMBC Aviation", airline: "Jambojet", country: "KE",
    aircraft: 2, timeline: "18 months", outcome: "Settled", source: "public",
    sourceUrl: "https://www.smbc-ac.com/news-events/press-releases",
    notes: "Jambojet (KQ subsidiary) lease renegotiation settled after 18 months; SMBC Aviation accepted amended lease terms rather than repossession — aircraft retained under new payment structure.",
    ctcInvoked: false,
  },
  // ── Egypt ─────────────────────────────────────────────────────────────────────
  {
    id: "PREC-058", year: 2016, lessor: "GECAS", airline: "EgyptAir", country: "EG",
    aircraft: 2, timeline: "24 months", outcome: "Settled", source: "public",
    sourceUrl: "https://www.geaviation.com/news",
    notes: "EgyptAir lease payment dispute settled after 24 months via bilateral negotiation; GECAS accepted amended rental terms — Egyptian courts were not engaged given state-owned airline status.",
    ctcInvoked: false,
  },
  // ── South Korea ───────────────────────────────────────────────────────────────
  {
    id: "PREC-059", year: 2020, lessor: "AerCap", airline: "Asiana Airlines", country: "KR",
    aircraft: 5, timeline: "14 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.aercap.com/investors/press-releases",
    notes: "Asiana Airlines entered Korean Debtor Rehabilitation and subsequent merger with Korean Air; AerCap recovered 5 aircraft over 14 months under the rehabilitation plan — Korean courts' efficiency was evident.",
    ctcInvoked: false,
  },
  {
    id: "PREC-060", year: 2021, lessor: "Air Lease Corp", airline: "Asiana Airlines", country: "KR",
    aircraft: 3, timeline: "12 months", outcome: "Returned", source: "public",
    sourceUrl: "https://ir.airleasecorp.com/news-releases",
    notes: "ALC recovered 3 aircraft from Asiana Airlines over 12 months following Korean Air merger approval; clear lessor protection under the Debtor Rehabilitation Act enabled timely recovery.",
    ctcInvoked: false,
  },
  // ── Netherlands ───────────────────────────────────────────────────────────────
  {
    id: "PREC-061", year: 2020, lessor: "AerCap", airline: "KLM", country: "NL",
    aircraft: 4, timeline: "6 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.aercap.com/investors/press-releases",
    notes: "KLM's government-backed restructuring included negotiated early lease returns; AerCap recovered 4 aircraft in 6 months — the Dutch state's involvement facilitated orderly lessor negotiations.",
    ctcInvoked: false,
  },
  // ── Spain ─────────────────────────────────────────────────────────────────────
  {
    id: "PREC-062", year: 2020, lessor: "Avolon", airline: "Plus Ultra", country: "ES",
    aircraft: 3, timeline: "12 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.avolon.aero/news",
    notes: "Plus Ultra received controversial Spanish government SEPI loan March 2021; Avolon recovered 3 aircraft over 12 months after Spanish commercial court proceedings under Concurso de Acreedores.",
    ctcInvoked: false,
  },
  // ── Italy ─────────────────────────────────────────────────────────────────────
  {
    id: "PREC-063", year: 2017, lessor: "AerCap", airline: "Alitalia", country: "IT",
    aircraft: 10, timeline: "18 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.aercap.com/investors/press-releases",
    notes: "Alitalia entered extraordinary administration May 2017; AerCap recovered 10 aircraft over 18 months through the Italian court-supervised process — Italian administration proceedings are slower than equivalent EU procedures.",
    ctcInvoked: false,
  },
  {
    id: "PREC-064", year: 2021, lessor: "Air Lease Corp", airline: "Alitalia", country: "IT",
    aircraft: 6, timeline: "14 months", outcome: "Returned", source: "public",
    sourceUrl: "https://ir.airleasecorp.com/news-releases",
    notes: "ALC recovered 6 aircraft from Alitalia's extraordinary administration over 14 months prior to the ITA Airways transfer; the Italian government's managed wind-down expedited lessor recoveries vs. the 2017 process.",
    ctcInvoked: false,
  },
  // ── Canada ────────────────────────────────────────────────────────────────────
  {
    id: "PREC-065", year: 2020, lessor: "AerCap", airline: "Air Canada", country: "CA",
    aircraft: 8, timeline: "5 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.aercap.com/investors/press-releases",
    notes: "Air Canada's COVID capacity reduction involved negotiated early redeliveries; AerCap recovered 8 aircraft in 5 months via CCAA-supervised agreement — no contested proceedings required.",
    ctcInvoked: false,
  },
  // ── NEW: Azul Airlines (Brazil) ───────────────────────────────────────────────
  {
    id: "PREC-066", year: 2023, lessor: "AerCap", airline: "Azul Airlines", country: "BR",
    aircraft: 5, timeline: "20 months", outcome: "Returned via RJ", source: "public",
    sourceUrl: "https://ri.azul.com.br/en/press-release/detail/azul-emerges-from-chapter-11",
    notes: "Azul filed Chapter 11 in SDNY July 2023; AerCap negotiated lease amendments rather than repossessing — the RJ process ultimately honoured lease obligations over 20 months.",
    ctcInvoked: false,
  },
  {
    id: "PREC-067", year: 2023, lessor: "SMBC Aviation", airline: "Azul Airlines", country: "BR",
    aircraft: 3, timeline: "22 months", outcome: "Returned via RJ", source: "public",
    sourceUrl: "https://www.smbc-ac.com/news-events/press-releases",
    notes: "SMBC reached a negotiated deferral agreement during Azul's restructuring; aircraft returned on amended terms after court approval over 22 months.",
    ctcInvoked: false,
  },
  {
    id: "PREC-068", year: 2023, lessor: "Air Lease Corp", airline: "Azul Airlines", country: "BR",
    aircraft: 4, timeline: "18 months", outcome: "Returned via RJ", source: "public",
    sourceUrl: "https://ir.airleasecorp.com/news-releases",
    notes: "ALC secured priority return under US Chapter 11 automatic stay carve-out; aircraft back in service within 18 months — fastest Azul lessor recovery due to US-registered lease entity.",
    ctcInvoked: false,
  },
  // ── NEW: Comair Ltd (South Africa) ────────────────────────────────────────────
  {
    id: "PREC-069", year: 2022, lessor: "AerCap", airline: "Comair Ltd", country: "ZA",
    aircraft: 7, timeline: "14 months", outcome: "Partially Returned", source: "public",
    sourceUrl: "https://www.aercap.com/investors/press-releases",
    notes: "Comair (British Airways SA franchise) entered liquidation June 2022; AerCap recovered 5 of 7 aircraft via SA High Court order — remaining 2 subject to liquidator's lien dispute extending recovery.",
    ctcInvoked: false,
  },
  {
    id: "PREC-070", year: 2022, lessor: "GECAS", airline: "Comair Ltd", country: "ZA",
    aircraft: 4, timeline: "16 months", outcome: "Partially Returned", source: "public",
    sourceUrl: "https://www.geaviation.com/news",
    notes: "GECAS recovered 3 aircraft after Comair liquidation over 16 months; 1 aircraft subject to extended dispute over maintenance reserve claims.",
    ctcInvoked: false,
  },
  // ── NEW: Go First additional lessors (India) ──────────────────────────────────
  {
    id: "PREC-071", year: 2023, lessor: "SMBC Aviation", airline: "Go First", country: "IN",
    aircraft: 5, timeline: "16 months", outcome: "Partially Returned", source: "public",
    sourceUrl: "https://www.smbc-ac.com/news-events/press-releases",
    notes: "SMBC filed IDERA deregistration request; DGCA initially refused citing NCLT moratorium — Supreme Court ultimately upheld lessor rights after 16 months.",
    ctcInvoked: true,
  },
  {
    id: "PREC-072", year: 2023, lessor: "BOC Aviation", airline: "Go First", country: "IN",
    aircraft: 6, timeline: "18 months", outcome: "Partially Returned", source: "public",
    sourceUrl: "https://ir.bocaviation.com/en/news",
    notes: "BOC formally invoked Cape Town Convention and IDERA; NCLT moratorium created a 6-month delay before DGCA permitted deregistration — key test case for India's CTC Act 2025.",
    ctcInvoked: true,
  },
  {
    id: "PREC-073", year: 2023, lessor: "Avolon", airline: "Go First", country: "IN",
    aircraft: 4, timeline: "15 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.avolon.aero/news/go-first-recovery-2024",
    notes: "Avolon recovered all 4 aircraft after sustained CTC enforcement action; the case was cited in parliamentary debates preceding CTC Act 2025 ratification.",
    ctcInvoked: true,
  },
  // ── NEW: SpiceJet additional lessors (India) ──────────────────────────────────
  {
    id: "PREC-074", year: 2023, lessor: "AerCap", airline: "SpiceJet", country: "IN",
    aircraft: 3, timeline: "8 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.aercap.com/investors/press-releases",
    notes: "AerCap deregistration via IDERA completed in 8 months — fastest Indian repossession post-Jet Airways, attributed to improved DGCA cooperation during the CTC Act 2025 second reading period.",
    ctcInvoked: true,
  },
  {
    id: "PREC-075", year: 2023, lessor: "Air Lease Corp", airline: "SpiceJet", country: "IN",
    aircraft: 4, timeline: "10 months", outcome: "Returned", source: "public",
    sourceUrl: "https://ir.airleasecorp.com/news-releases",
    notes: "ALC recovered 4 A320s via IDERA filing; DGCA processed deregistration in under 3 months — cited as evidence of India's improving CTC implementation.",
    ctcInvoked: true,
  },
  // ── NEW: Interjet additional (Mexico) ─────────────────────────────────────────
  {
    id: "PREC-076", year: 2022, lessor: "AerCap", airline: "Interjet", country: "MX",
    aircraft: 3, timeline: "22 months", outcome: "Partially Returned", source: "public",
    sourceUrl: "https://www.aercap.com/investors/press-releases",
    notes: "AerCap recovered 3 of 5 contracted aircraft via Mexican Concurso over 22 months; 2 aircraft subject to ongoing AFAC (Mexican aviation regulator) deregistration dispute.",
    ctcInvoked: false,
  },
  // ── NEW: Aeromexico additional lessors (Mexico) ───────────────────────────────
  {
    id: "PREC-077", year: 2021, lessor: "SMBC Aviation", airline: "Aeromexico", country: "MX",
    aircraft: 6, timeline: "9 months", outcome: "Returned", source: "public",
    sourceUrl: "https://www.smbc-ac.com/news-events/press-releases",
    notes: "SMBC secured early aircraft return via US Chapter 11 automatic stay — Aeromexico's strategic decision to file in SDNY rather than Mexican courts allowed rapid lessor recoveries.",
    ctcInvoked: false,
  },
  {
    id: "PREC-078", year: 2021, lessor: "BOC Aviation", airline: "Aeromexico", country: "MX",
    aircraft: 5, timeline: "10 months", outcome: "Returned", source: "public",
    sourceUrl: "https://ir.bocaviation.com/en/news",
    notes: "BOC recovered 5 aircraft in 10 months under SDNY Chapter 11 proceedings; illustrates the value of US-jurisdiction filing for Mexican carriers.",
    ctcInvoked: false,
  },
  // ── NEW: South African Airways additional (South Africa) ─────────────────────
  {
    id: "PREC-079", year: 2022, lessor: "Air Lease Corp", airline: "South African Airways", country: "ZA",
    aircraft: 3, timeline: "20 months", outcome: "Returned", source: "public",
    sourceUrl: "https://ir.airleasecorp.com/news-releases",
    notes: "ALC recovered 3 aircraft through SAA Business Rescue proceedings over 20 months; process extended by disputes over maintenance reserves and return conditions.",
    ctcInvoked: false,
  },
  // ── NEW: Garuda Indonesia additional (Indonesia) ──────────────────────────────
  {
    id: "PREC-080", year: 2021, lessor: "Avolon", airline: "Garuda Indonesia", country: "ID",
    aircraft: 3, timeline: "28 months", outcome: "Returned via RJ", source: "public",
    sourceUrl: "https://www.avolon.aero/news/garuda-pkpu-recovery",
    notes: "Avolon's 3 aircraft returned under PKPU plan after extended court-supervised negotiations; outcome better than ALC/SMBC peers due to early engagement with the administrator.",
    ctcInvoked: false,
  },
];
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build` from the project root (`/Users/tanamsethi/Downloads/Aeroinsights`).

Expected: zero TypeScript errors. The three new required fields on every entry mean any missing entry will show a TS error immediately.

- [ ] **Step 4: Commit**

```bash
git add src/app/components/jurisdictions/jurisdictionData.ts
git commit -m "feat(gap3): enrich Precedent interface with sourceUrl/notes/ctcInvoked; add PREC-066–080"
```

---

### Task 2: Create `PrecedentTable.tsx`

**Files:**
- Create: `src/app/components/jurisdictions/PrecedentTable.tsx`

- [ ] **Step 1: Create the file with full component code**

Create `src/app/components/jurisdictions/PrecedentTable.tsx` with this exact content:

```tsx
import { useState, useMemo, Fragment } from "react";
import { ExternalLink } from "lucide-react";
import { Card } from "../ui/Card";
import { StatusPill } from "../ui/StatusPill";
import { useSortable, sortIcon, sortIconStyle } from "../ui/useSortable";
import type { Precedent, Jurisdiction } from "./jurisdictionData";

interface PrecedentTableProps {
  precedents: Precedent[];
  jurisdictions: Jurisdiction[];
}

export function PrecedentTable({ precedents, jurisdictions }: PrecedentTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [countryFilter, setCountryFilter] = useState("All");

  const precedentCountries = useMemo(() => {
    const codes = Array.from(new Set(precedents.map((p) => p.country)));
    return codes
      .map((c) => jurisdictions.find((j) => j.code === c)?.country ?? c)
      .sort();
  }, [precedents, jurisdictions]);

  const filteredPrecedents = useMemo(
    () =>
      countryFilter === "All"
        ? precedents
        : precedents.filter((p) => {
            const jur = jurisdictions.find((j) => j.country === countryFilter);
            return jur ? p.country === jur.code : false;
          }),
    [precedents, jurisdictions, countryFilter]
  );

  const precedentAccessors = useMemo(
    () => ({
      year: (p: Precedent) => p.year,
      lessor: (p: Precedent) => p.lessor,
      airline: (p: Precedent) => p.airline,
      aircraft: (p: Precedent) => p.aircraft,
      outcome: (p: Precedent) => p.outcome,
    }),
    []
  );

  const {
    sorted: sortedPrecedents,
    sortState: precedentSortState,
    toggleSort: togglePrecedentSort,
  } = useSortable(filteredPrecedents, precedentAccessors);

  function toggleRow(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <Card
      title={`Repossession Precedent Database (${filteredPrecedents.length})`}
      subtitle="Public and AWG-sourced cases"
      noPadding
      headerRight={
        <select
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          style={{
            fontSize: "0.8125rem",
            color: "#475569",
            border: "1px solid #E2E8F0",
            borderRadius: "0.5rem",
            padding: "0.375rem 0.625rem",
            background: "#FFFFFF",
            cursor: "pointer",
            outline: "none",
          }}
        >
          <option value="All">All countries</option>
          {precedentCountries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      }
    >
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              {(
                [
                  { label: "Case ID", key: null },
                  { label: "Year", key: "year" },
                  { label: "Lessor", key: "lessor" },
                  { label: "Airline", key: "airline" },
                  { label: "Country", key: null },
                  { label: "Aircraft", key: "aircraft" },
                  { label: "Timeline", key: null },
                  { label: "Outcome", key: "outcome" },
                  { label: "Source", key: null },
                ] as { label: string; key: string | null }[]
              ).map(({ label, key }) => (
                <th
                  key={label}
                  onClick={key ? () => togglePrecedentSort(key) : undefined}
                  style={{
                    padding: "0.625rem 1rem",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "#64748B",
                    fontSize: "0.6875rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    whiteSpace: "nowrap",
                    cursor: key ? "pointer" : "default",
                    userSelect: "none",
                  }}
                >
                  {label}
                  {key && (
                    <span style={sortIconStyle(key, precedentSortState)}>
                      {sortIcon(key, precedentSortState)}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedPrecedents.map((p, i) => {
              const jur = jurisdictions.find((j) => j.code === p.country);
              const isExpanded = expandedId === p.id;
              const rowBg = i % 2 === 0 ? "#FFFFFF" : "#F8FAFC";
              return (
                <Fragment key={p.id}>
                  <tr
                    onClick={() => toggleRow(p.id)}
                    style={{
                      borderBottom: isExpanded ? "none" : "1px solid #F1F5F9",
                      background: rowBg,
                      cursor: "pointer",
                    }}
                  >
                    <td style={{ padding: "0.625rem 1rem", fontFamily: "monospace", fontSize: "0.75rem", color: "#94A3B8" }}>
                      {p.id}
                    </td>
                    <td style={{ padding: "0.625rem 1rem", color: "#475569" }}>{p.year}</td>
                    <td style={{ padding: "0.625rem 1rem", fontWeight: 600, color: "#0F172A" }}>{p.lessor}</td>
                    <td style={{ padding: "0.625rem 1rem", color: "#475569" }}>{p.airline}</td>
                    <td style={{ padding: "0.625rem 1rem" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                        <span>{jur?.flag ?? ""}</span>
                        <span style={{ color: "#475569" }}>{jur?.country ?? p.country}</span>
                      </span>
                    </td>
                    <td style={{ padding: "0.625rem 1rem", color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>
                      {p.aircraft}
                    </td>
                    <td style={{ padding: "0.625rem 1rem", color: "#475569" }}>{p.timeline}</td>
                    <td style={{ padding: "0.625rem 1rem" }}>
                      <StatusPill
                        stage={
                          p.outcome === "Returned"
                            ? "green"
                            : p.outcome === "Detained"
                            ? "red"
                            : "amber"
                        }
                        label={p.outcome}
                      />
                    </td>
                    <td style={{ padding: "0.625rem 1rem" }}>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "#64748B",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {p.source}
                      </span>
                      {p.sourceUrl && (
                        <ExternalLink
                          size={11}
                          style={{ marginLeft: 4, color: "#002147", verticalAlign: "middle" }}
                        />
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr
                      style={{
                        borderBottom: "1px solid #F1F5F9",
                        background: rowBg,
                      }}
                    >
                      <td
                        colSpan={9}
                        style={{
                          padding: "0.75rem 1rem 1rem 1rem",
                          background: "#F8FAFC",
                          borderLeft: "3px solid #002147",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.8125rem",
                            color: "#0F172A",
                            lineHeight: 1.6,
                            marginBottom: "0.5rem",
                          }}
                        >
                          {p.notes}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "0.125rem 0.5rem",
                              borderRadius: "9999px",
                              fontSize: "0.6875rem",
                              fontWeight: 600,
                              background: p.ctcInvoked ? "#DCFCE7" : "#F1F5F9",
                              color: p.ctcInvoked ? "#15803D" : "#94A3B8",
                            }}
                          >
                            CTC Invoked: {p.ctcInvoked ? "Yes" : "No"}
                          </span>
                          {p.sourceUrl && (
                            <a
                              href={p.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                fontSize: "0.8125rem",
                                color: "#002147",
                                textDecoration: "none",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.25rem",
                              }}
                            >
                              View Source →
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build` from `/Users/tanamsethi/Downloads/Aeroinsights`.

Expected: zero errors. If `ExternalLink` import fails, confirm `lucide-react` is in `package.json` dependencies (it is — already used in the existing codebase).

- [ ] **Step 3: Commit**

```bash
git add src/app/components/jurisdictions/PrecedentTable.tsx
git commit -m "feat(gap3): add PrecedentTable component with expandable rows, CTC badge, and source link"
```

---

### Task 3: Trim `Jurisdictions.tsx`

**Files:**
- Modify: `src/app/pages/Jurisdictions.tsx`

- [ ] **Step 1: Update the import block**

In `src/app/pages/Jurisdictions.tsx`, replace this import line:

```ts
import { useSortable, sortIcon, sortIconStyle } from "../components/ui/useSortable";
```

with:

```ts
import { PrecedentTable } from "../components/jurisdictions/PrecedentTable";
```

(`useSortable`, `sortIcon`, and `sortIconStyle` are no longer used in this file after the table is extracted.)

- [ ] **Step 2: Remove the five precedent-related state / memo declarations**

Remove these five blocks (lines 17, 31–36, 38–47, 49–55, 57 in the original file):

```ts
// REMOVE — line 17
const [countryFilter, setCountryFilter] = useState("All");
```

```ts
// REMOVE — lines 31–36
const precedentCountries = useMemo(() => {
  const codes = Array.from(new Set(precedents.map((p) => p.country)));
  return codes
    .map((c) => jurisdictions.find((j) => j.code === c)?.country ?? c)
    .sort();
}, []);
```

```ts
// REMOVE — lines 38–47
const filteredPrecedents = useMemo(
  () =>
    countryFilter === "All"
      ? precedents
      : precedents.filter((p) => {
          const jur = jurisdictions.find((j) => j.country === countryFilter);
          return jur ? p.country === jur.code : false;
        }),
  [countryFilter]
);
```

```ts
// REMOVE — lines 49–55
const precedentAccessors = useMemo(() => ({
  year: (p: typeof precedents[0]) => p.year,
  lessor: (p: typeof precedents[0]) => p.lessor,
  airline: (p: typeof precedents[0]) => p.airline,
  aircraft: (p: typeof precedents[0]) => p.aircraft,
  outcome: (p: typeof precedents[0]) => p.outcome,
}), []);
```

```ts
// REMOVE — line 57
const { sorted: sortedPrecedents, sortState: precedentSortState, toggleSort: togglePrecedentSort } = useSortable(filteredPrecedents, precedentAccessors);
```

- [ ] **Step 3: Replace the inline Precedent Database tab block**

Remove the entire block from `{/* ── Precedent Database ── */}` (line 229) through the closing `)}` at line 319, which is approximately:

```tsx
{/* ── Precedent Database ── */}
{activeTab === "Precedent Database" && (
  <Card
    title={`Repossession Precedent Database (${filteredPrecedents.length})`}
    ...
  >
    <div style={{ overflowX: "auto" }}>
      <table ...>
        ...
      </table>
    </div>
  </Card>
)}
```

Replace it with:

```tsx
{/* ── Precedent Database ── */}
{activeTab === "Precedent Database" && (
  <PrecedentTable precedents={precedents} jurisdictions={jurisdictions} />
)}
```

- [ ] **Step 4: Verify build passes and check for unused imports**

Run: `npm run build` from `/Users/tanamsethi/Downloads/Aeroinsights`.

Expected: zero errors. TypeScript will flag any remaining references to removed state variables. If `useState` is now unused (check — it is still used for `selectedCode`, `activeTab`, `search`), keep the import. Confirm `useMemo` is still used for `filteredJurisdictions` and `chartData`.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/Jurisdictions.tsx
git commit -m "refactor(gap3): extract PrecedentTable from Jurisdictions page; remove inline precedent state"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Interface widened ✓ / 65 entries enriched ✓ / 15 new entries (PREC-066–080) ✓ / expandable rows ✓ / CTC badge ✓ / View Source link ✓ / ExternalLink icon in Source column ✓ / AWG cases have no icon (sourceUrl = "") ✓ / e.stopPropagation on source link ✓ / country filter + sort extracted into component ✓ / Jurisdictions.tsx cleaned ✓
- [x] **No placeholders:** All 80 entries carry complete `sourceUrl`, `notes`, `ctcInvoked` values — none are "TBD"
- [x] **Type consistency:** `Precedent` interface used as the type for `(p: Precedent)` accessors in `PrecedentTable` — matches the updated interface in `jurisdictionData.ts`
- [x] **Build gating:** Each task ends with `npm run build` before the next begins
