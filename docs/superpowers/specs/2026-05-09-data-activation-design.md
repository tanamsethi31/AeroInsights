# Data Activation Design

## Overview

Data Activation replaces Aeroinsights' static mock data with real client portfolio data — making every page (Portfolio, ECL, Watchlist, Intelligence, Reports) reflect a lessor's actual fleet, leases, and provisions. Phase 1 delivers client data ingestion via file upload. Phase 2 layers in external market data feeds (Cirium, OAG, Bloomberg).

---

## Architecture

A `DataContext` / `usePortfolioData()` hook sits between every UI page and its data source. Pages never import mock files or call Supabase directly — they call the hook. The hook checks whether the current org has a completed upload; if yes, it fetches from Supabase. If not, it returns existing mock data unchanged.

```
UI Pages / Components
       ↓
usePortfolioData() hook  ←── DataContext (org state, upload status)
       ↓                           ↓
  mock data files         Supabase (when org has uploaded data)
```

This means every page works on day one without modification. Real data flows in incrementally as the upload pipeline is wired up. The hook is the migration boundary — it expands over time without touching page-level code.

---

## Supabase Schema

Multi-tenant from day one. Every table has `org_id`. Row-level security policies enforce isolation: `auth.jwt() → org_members → org_id`. No row is readable by a different org.

### Tables

**`organisations`**
- `id` uuid PK
- `name` text
- `plan` text (starter / growth / enterprise)
- `base_currency` text (default: EUR)
- `created_at` timestamptz

**`org_members`**
- `id` uuid PK
- `org_id` uuid FK → organisations
- `user_id` text (Auth0 `sub`)
- `role` text (admin / analyst)
- `created_at` timestamptz

**`uploads`**
- `id` uuid PK
- `org_id` uuid FK → organisations
- `filename` text
- `status` text (pending / processing / complete / error)
- `column_map` jsonb (saved mapping from their headers to our fields)
- `row_count` int
- `error_detail` text (nullable)
- `created_at` timestamptz

**`assets`**
- `id` uuid PK
- `org_id` uuid FK
- `upload_id` uuid FK → uploads
- `registration` text
- `msn` text
- `aircraft_type` text
- `manufacturer` text (nullable)
- `vintage` int (nullable)
- `current_operator` text (nullable)
- `created_at` timestamptz

**`lessees`**
- `id` uuid PK
- `org_id` uuid FK
- `name` text
- `iata_code` text (nullable)
- `country` text (nullable)
- `credit_rating` text (nullable)
- `pd_estimate` numeric (nullable)
- `watchlist_status` text (nullable — green / amber / red)
- `created_at` timestamptz

**`leases`**
- `id` uuid PK
- `org_id` uuid FK
- `asset_id` uuid FK → assets
- `lessee_id` uuid FK → lessees
- `start_date` date
- `end_date` date
- `monthly_rental` numeric (nullable)
- `currency` text (default: EUR)
- `stage` int (nullable — 1 / 2 / 3)
- `created_at` timestamptz

**`provisions`**
- `id` uuid PK
- `org_id` uuid FK
- `asset_id` uuid FK → assets
- `stage` int (nullable)
- `ecl_amount` numeric (nullable)
- `pd` numeric (nullable)
- `lgd` numeric (nullable)
- `ead` numeric (nullable)
- `reporting_date` date (nullable)
- `created_at` timestamptz

All `?` fields are optional. If a lessor doesn't provide a field, it is null. The UI shows "—" or falls back to a model estimate rather than erroring.

### Phase 2 Tables (schema defined now, populated later)

**`market_data`**
- `id`, `org_id`, `asset_id`, `source` (cirium / oag / manual), `cmv` numeric, `half_life_value` numeric, `utilisation_rate` numeric, `fetched_at` timestamptz

**`lessee_financials`**
- `id`, `org_id`, `lessee_id`, `source`, `revenue` numeric, `ebitda` numeric, `debt_equity` numeric, `load_factor` numeric, `rpk` numeric, `period_end` date, `fetched_at` timestamptz

---

## Phase 1: Upload Flow

### Entry Points
- **PortfolioHub** — "Upload Portfolio Data" primary CTA button
- **Settings → Data** tab — manage uploads, re-upload, view history
- **Onboarding wizard** — Step 3 of the org setup flow

### Upload Wizard (3 steps, modal)

**Step 1 — Drop File**
- Drag-and-drop zone accepting `.csv`, `.xlsx`, `.xls`
- Two visible paths:
  - *"Use our template"* — downloads a pre-formatted Excel file. User fills it in and re-uploads; skips Step 2 (column mapping) entirely.
  - *"Upload your own file"* — proceeds to column mapping.
- File is sent to a Supabase Edge Function (`parse-upload`) that reads headers and a 10-row sample, returns detected columns and suggested mappings based on fuzzy header matching.

**Step 2 — Map Columns**
- Two-column table: our field (left) vs. their detected column (right, as a dropdown)
- Auto-suggestions from fuzzy matching: "Tail No." → Registration, "Lessee Name" → Lessee, etc.
- Required fields marked with `*`. Optional fields have a "skip" option.
- Mapping saved to `uploads.column_map` — subsequent uploads from the same source auto-fill.
- Validation preview: 3 sample values shown per field so the user can confirm the match is correct.

**Step 3 — Review & Import**
- Preview table: first 5 parsed rows with mappings applied
- Validation errors surfaced per-row (missing required field, unparseable date, unrecognised currency)
- Errors are non-blocking for optional fields; blocking only for Registration + Lessee + Lease dates
- User clicks **"Import Portfolio"**
- Edge Function (`process-upload`) writes rows into `assets`, `lessees`, `leases`, `provisions`
- On completion, `uploads.status` → `complete`, app refreshes via DataContext

### Error Handling
- Parse errors are per-row, not all-or-nothing — bad rows are flagged and skipped; the rest import cleanly
- A summary shows: N rows imported, M rows skipped (with reasons)
- If the Edge Function fails mid-way, the partial import is rolled back (Supabase transaction)
- Upload history visible in Settings → Data so the user can see past imports and their status

---

## DataContext & usePortfolioData Hook

### DataContext
```tsx
// src/app/context/DataContext.tsx
interface DataContextValue {
  orgId: string | null;
  hasUpload: boolean;
  uploadStatus: "none" | "pending" | "processing" | "complete" | "error";
  refetchUploadStatus: () => void;
}
```

On mount:
1. Reads Auth0 `user.sub` → queries `org_members` → resolves `org_id`
2. Checks `uploads` for a row with `status = complete` for this org
3. Sets `hasUpload = true` if found

### usePortfolioData Hook
```tsx
// src/app/hooks/usePortfolioData.ts
export function usePortfolioData() {
  const { orgId, hasUpload } = useContext(DataContext);

  const { data: assets } = useQuery({
    queryKey: ["assets", orgId],
    queryFn: () => supabase.from("assets").select("*").eq("org_id", orgId),
    enabled: hasUpload && !!orgId,
  });

  // ... similar queries for lessees, leases, provisions

  if (!hasUpload) {
    return { assets: MOCK_ASSETS, lessees: MOCK_LESSEES, leases: MOCK_LEASES, provisions: MOCK_PROVISIONS };
  }

  return {
    assets: assets?.data ?? [],
    lessees: lessees?.data ?? [],
    leases: leases?.data ?? [],
    provisions: provisions?.data ?? [],
  };
}
```

Pages replace their mock imports with one line:
```tsx
const { assets, lessees } = usePortfolioData();
```

---

## Onboarding Flow (demo-ready)

Shown to any authenticated user with no `org_members` row. Full-screen wizard, 4 steps.

**Step 1 — Org Setup**
- Organisation name
- Fleet size bracket (1–20 / 20–100 / 100+ aircraft)
- Base currency (EUR default, 9 options)
- Creates `organisations` row, `org_members` row (role: admin)

**Step 2 — Invite Team** *(skippable)*
- Email list input (same pattern as EmailReportModal)
- Invites stored, Auth0 magic-link emails sent
- Skip link → proceeds to Step 3

**Step 3 — Upload Portfolio**
- Embeds the 3-step upload wizard
- Skip link available → loads with mock data + persistent banner: *"You're viewing demo data — upload your portfolio to get started."*

**Step 4 — Confirmation**
- Animated success state (CheckCircle2, framer-motion scale-in)
- "Your portfolio is live" heading
- CTA → Dashboard (now showing real data)

---

## Phase 2: External Data Feeds

External data enriches client data without replacing it. The hook merges market data onto client rows:

```
client's asset row + Cirium CMV → enriched asset → ECL page shows real valuation
lessee row + OAG load factor → enriched lessee → Intelligence signals become real
```

### Sources (priority order)
| Source | Data | Mechanism |
|---|---|---|
| Cirium | Fleet status, CMV, utilisation | REST API → Edge Function → `market_data` |
| OAG / Airline Data Inc | Traffic (RPK, load factor, capacity) | Scheduled Edge Function (daily) |
| Bloomberg / S&P | Lessee financials, credit ratings | API → `lessee_financials` |
| Manual upload | Any unstructured data | Same upload wizard, mapped to right table |

Phase 2 tables (`market_data`, `lessee_financials`) are defined in the Phase 1 migration so no schema changes are needed when Phase 2 is built.

---

## File Structure

| File | Action | Purpose |
|---|---|---|
| `src/app/context/DataContext.tsx` | Create | Org state, upload status, provider |
| `src/app/hooks/usePortfolioData.ts` | Create | Data abstraction hook |
| `src/app/hooks/useOrg.ts` | Create | Resolves org_id from Auth0 user |
| `src/app/components/onboarding/OnboardingWizard.tsx` | Create | Full-screen 4-step onboarding |
| `src/app/components/onboarding/OrgSetupStep.tsx` | Create | Step 1: org name, fleet size, currency |
| `src/app/components/onboarding/InviteTeamStep.tsx` | Create | Step 2: invite emails |
| `src/app/components/onboarding/UploadStep.tsx` | Create | Step 3: embeds upload wizard |
| `src/app/components/onboarding/ConfirmationStep.tsx` | Create | Step 4: success screen |
| `src/app/components/upload/UploadWizard.tsx` | Create | 3-step upload modal |
| `src/app/components/upload/DropZoneStep.tsx` | Create | File drop + template download |
| `src/app/components/upload/ColumnMapStep.tsx` | Create | Column mapping table |
| `src/app/components/upload/ReviewImportStep.tsx` | Create | Preview + validation + import CTA |
| `src/app/lib/supabase.ts` | Create | Supabase client singleton |
| `supabase/migrations/001_data_activation.sql` | Create | Full schema: orgs, members, uploads, assets, lessees, leases, provisions, market_data, lessee_financials |
| `supabase/functions/parse-upload/index.ts` | Create | Edge Function: parse file headers + suggest mappings |
| `supabase/functions/process-upload/index.ts` | Create | Edge Function: transform + insert rows with rollback |
| `src/app/pages/PortfolioHub.tsx` | Modify | Add "Upload Portfolio Data" CTA |
| `src/app/App.tsx` (or router root) | Modify | Wrap with DataProvider, show OnboardingWizard if no org |

---

## Testing Approach

- **Unit**: `usePortfolioData` — mock Supabase client, assert mock data returned when `hasUpload=false`, Supabase data returned when `hasUpload=true`
- **Unit**: Column mapping logic — given detected headers + our field list, assert fuzzy match suggestions are correct
- **Integration**: Edge Function `parse-upload` — send a sample CSV, assert returned column suggestions
- **Integration**: Edge Function `process-upload` — send column map + rows, assert Supabase tables populated correctly, assert rollback on error
- **E2E**: Onboarding wizard — complete all 4 steps, assert org row created and DataContext resolves `hasUpload=true`
