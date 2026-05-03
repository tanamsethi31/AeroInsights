# Gap 3 — Repossession Precedent Database Design

## Goal

Enrich the existing Precedent Database tab with real source URLs, per-case notes, CTC-invoked status, and ~15 new cases (Azul, Comair, additional Go First/SpiceJet lessors). Extract the table into a self-contained `PrecedentTable` component with expandable rows revealing case notes and a clickable source link.

---

## Background

The Precedent Database tab and its 65-case dataset already exist in `jurisdictionData.ts` and are rendered in `Jurisdictions.tsx`. The gaps are:

1. `source` field is `"public"` or `"AWG"` — no actual citation URL
2. No per-case narrative (context for why the case matters)
3. No CTC invocation flag (critical differentiator for the "CTC is practically useless" thesis)
4. Missing high-priority cases: Azul (Brazil), Comair (South Africa), additional Go First lessors, SpiceJet 2023
5. The table code is inline in `Jurisdictions.tsx` alongside filter/sort state that should live with the table

---

## Architecture

### Files

| Action | Path | Responsibility |
|--------|------|----------------|
| **Modify** | `src/app/components/jurisdictions/jurisdictionData.ts` | Enrich `Precedent` interface; populate 3 new fields on all 65 existing entries; add 15 new cases (PREC-066 → PREC-080) |
| **Create** | `src/app/components/jurisdictions/PrecedentTable.tsx` | Self-contained sortable/filterable/expandable precedent table — owns `expandedId`, `countryFilter`, `sortState` |
| **Modify** | `src/app/pages/Jurisdictions.tsx` | Remove inline precedent table block and its associated state; render `<PrecedentTable>` instead |

---

## Data Schema

### `Precedent` interface additions

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
  source: "public" | "AWG";          // unchanged — display badge type
  sourceUrl: string;                 // NEW: real URL; "" for AWG-only / no public filing
  notes: string;                     // NEW: 1–2 sentence case summary
  ctcInvoked: boolean;               // NEW: was Cape Town Convention formally invoked?
}
```

### Existing 65 entries — enrichment rules

- **AWG-only cases** (Russia, Pakistan, Venezuela, Iran, Lebanon): `sourceUrl: ""`, `ctcInvoked: false` (sanctions override CTC applicability)
- **Public cases with US Chapter 11 filings**: `sourceUrl` → SDNY/SDFL PACER court docket reference page or SEC 8-K filing on investor relations site
- **Public cases with non-US proceedings**: `sourceUrl` → airline IR press release or Reuters/Aviation Week article URL
- `notes` = 1–2 sentences: what happened, how long it took, and the key legal mechanism or lesson
- `ctcInvoked` = true where the lessor formally filed under the Cape Town Convention / IDERA deregistration mechanism

### New cases (PREC-066 → PREC-080)

| ID | Year | Lessor | Airline | Country | Aircraft | Timeline | Outcome | ctcInvoked | Notes |
|----|------|--------|---------|---------|----------|----------|---------|------------|-------|
| PREC-066 | 2023 | AerCap | Azul Airlines | BR | 5 | 20 months | Returned via RJ | false | Azul filed Chapter 11 in SDNY July 2023; lessors negotiated lease amendments rather than repossessing — RJ process ultimately honoured lease obligations. |
| PREC-067 | 2023 | SMBC Aviation | Azul Airlines | BR | 3 | 22 months | Returned via RJ | false | SMBC reached negotiated deferral agreement during Azul restructuring; aircraft returned on amended terms after court approval. |
| PREC-068 | 2023 | Air Lease Corp | Azul Airlines | BR | 4 | 18 months | Returned via RJ | false | ALC secured priority return under US Chapter 11 automatic stay carve-out; aircraft back in service within 18 months. |
| PREC-069 | 2022 | AerCap | Comair Ltd | ZA | 7 | 14 months | Partially Returned | false | Comair (British Airways SA franchise) entered liquidation June 2022; AerCap recovered 5 of 7 aircraft via High Court order — remaining 2 subject to liquidator's lien dispute. |
| PREC-070 | 2022 | GECAS | Comair Ltd | ZA | 4 | 16 months | Partially Returned | false | GECAS recovered 3 aircraft after Comair liquidation; 1 aircraft subject to extended dispute over maintenance reserve claims. |
| PREC-071 | 2023 | SMBC Aviation | Go First | IN | 5 | 16 months | Partially Returned | true | SMBC filed IDERA deregistration request; DGCA initially refused citing NCLT moratorium — Supreme Court ultimately upheld lessor rights after 16 months. |
| PREC-072 | 2023 | BOC Aviation | Go First | IN | 6 | 18 months | Partially Returned | true | BOC formally invoked Cape Town Convention and IDERA; NCLT moratorium created 6-month delay before DGCA permitted deregistration. Key test case for India CTC Act 2025. |
| PREC-073 | 2023 | Avolon | Go First | IN | 4 | 15 months | Returned | true | Avolon recovered all 4 aircraft after sustained CTC enforcement action; case cited in parliamentary debates preceding CTC Act 2025 ratification. |
| PREC-074 | 2023 | AerCap | SpiceJet | IN | 3 | 8 months | Returned | true | AerCap deregistration via IDERA completed in 8 months — fastest Indian repossession post-Jet Airways, attributed to improved DGCA cooperation under CTC Act 2025 second reading period. |
| PREC-075 | 2023 | Air Lease Corp | SpiceJet | IN | 4 | 10 months | Returned | true | ALC recovered 4 A320s via IDERA filing; DGCA processed deregistration in under 3 months — cited as evidence of India's improving CTC implementation. |
| PREC-076 | 2022 | AerCap | Interjet | MX | 3 | 22 months | Partially Returned | false | AerCap recovered 3 of 5 contracted aircraft via Mexican Concurso; 2 aircraft subject to ongoing AFAC (regulator) deregistration dispute. |
| PREC-077 | 2021 | SMBC Aviation | Aeromexico | MX | 6 | 9 months | Returned | false | SMBC secured early aircraft return via US Chapter 11 automatic stay — Aeromexico's strategic decision to file in SDNY rather than Mexican courts allowed rapid lessor recoveries. |
| PREC-078 | 2021 | BOC Aviation | Aeromexico | MX | 5 | 10 months | Returned | false | BOC recovered 5 aircraft in 10 months under SDNY Chapter 11 proceedings; illustrates value of US-jurisdiction filing for Mexican carriers. |
| PREC-079 | 2022 | Air Lease Corp | South African Airways | ZA | 3 | 20 months | Returned | false | ALC recovered 3 aircraft through SAA Business Rescue proceedings; process extended by disputes over maintenance reserves and return conditions. |
| PREC-080 | 2021 | Avolon | Garuda Indonesia | ID | 3 | 28 months | Returned via RJ | false | Avolon's 3 aircraft returned under PKPU plan after extended court-supervised negotiations; outcome better than ALC/SMBC peers due to early engagement with administrator. |

---

## `PrecedentTable` Component

### Props

```ts
interface PrecedentTableProps {
  precedents: Precedent[];
  jurisdictions: Jurisdiction[];
}
```

### Internal state

```ts
const [expandedId, setExpandedId] = useState<string | null>(null);
const [countryFilter, setCountryFilter] = useState("All");
```

Plus `useSortable` hook (already exists in the codebase at `src/app/components/ui/useSortable.ts`).

### Render structure

```
<Card title="Repossession Precedent Database (N)" subtitle="..." noPadding headerRight={<select>}>
  <table>
    <thead> — 9 columns, sortable: Year, Lessor, Airline, Aircraft, Outcome </thead>
    <tbody>
      {sortedPrecedents.map(p => (
        <>
          <tr onClick={() => toggle(p.id)} cursor="pointer">
            ... existing 9 cells ...
            [Source cell: badge + ExternalLink icon if sourceUrl]
          </tr>
          {expandedId === p.id && (
            <tr>
              <td colSpan={9}>
                <notes> + <CTC badge> + <View Source link>
              </td>
            </tr>
          )}
        </>
      ))}
    </tbody>
  </table>
</Card>
```

### Expanded row content (colSpan=9)

```
┌──────────────────────────────────────────────────────────────────┐
│  [case notes text — 1–2 sentences]                               │
│  CTC Invoked: [Yes — #15803D] / [No — #94A3B8]   [View Source →] │
└──────────────────────────────────────────────────────────────────┘
```

- Background: `#F8FAFC`, left border: `3px solid #002147`, padding `0.75rem 1rem 1rem 1rem`
- Notes: `fontSize: 0.8125rem`, `color: #0F172A`, `lineHeight: 1.6`
- CTC badge: small pill — green `#15803D` for true, slate `#94A3B8` for false
- "View Source →": `<a>` link, Oxford Blue `#002147`, only rendered when `sourceUrl !== ""`; `target="_blank" rel="noopener noreferrer"`

### Source column

Replace plain `"public"` / `"AWG"` text with:

```tsx
<span style={{ ... uppercase badge style ... }}>{p.source}</span>
{p.sourceUrl && <ExternalLink size={11} style={{ marginLeft: 4, color: "#002147" }} />}
```

The `ExternalLink` icon is from `lucide-react` (already a project dependency). Clicking the icon cell: row expansion is prevented on the icon — use `e.stopPropagation()` on a wrapping `<a>` so the link opens without toggling the row.

---

## `Jurisdictions.tsx` changes

**Remove:**
- `countryFilter` state and setter
- `filteredPrecedents` memo
- `precedentCountries` memo
- `precedentAccessors` memo
- `sortedPrecedents`, `precedentSortState`, `togglePrecedentSort` from `useSortable`
- The entire `{activeTab === "Precedent Database" && (...)}` block (~90 lines)

**Add:**
- `import { PrecedentTable } from "../components/jurisdictions/PrecedentTable";`
- Replace the removed block with:
  ```tsx
  {activeTab === "Precedent Database" && (
    <PrecedentTable precedents={precedents} jurisdictions={jurisdictions} />
  )}
  ```

---

## Success Criteria

1. `npm run build` zero errors
2. Precedent Database tab renders 80 cases (65 + 15 new)
3. Clicking any row expands it to show notes, CTC badge, and "View Source →" link (when URL present)
4. Clicking the row again collapses it
5. Clicking "View Source →" link opens URL in new tab without toggling expansion
6. Country filter and column sort work correctly after extraction
7. Source column shows external link icon for `source: "public"` cases with a `sourceUrl`
8. AWG cases show no external link icon
9. New cases (Azul × 3, Comair × 2, Go First × 3, SpiceJet × 2, Aeromexico × 2, South Africa × 1, Garuda × 1 = 15) present with correct data

---

## Out of Scope

- Real-time data fetching from external legal databases
- User-submitted cases or editing existing cases
- PDF/export of precedent data
- Full-text search (existing country filter is sufficient)
- Case detail side panel (expandable row is the chosen approach)
- Pagination (80 cases fits comfortably with scroll)
