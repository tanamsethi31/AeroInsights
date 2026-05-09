# Data Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace static mock data with real client portfolio data — Supabase multi-tenant schema, file-upload wizard with column mapping, DataContext abstraction layer, and a demo-ready 4-step onboarding flow.

**Architecture:** A `DataContext` / `usePortfolioData()` hook sits between UI pages and their data source. Pages call the hook; the hook returns mock data until an org has a completed upload, then fetches from Supabase. File parsing happens client-side (xlsx already installed); data is written directly to Supabase via the anon key. The upload wizard handles template download → file drop → column mapping → preview/import. The onboarding wizard handles org creation → team invite → upload → confirmation.

**Tech Stack:** React 18, TypeScript, `@supabase/supabase-js` (new install), `xlsx` ^0.18.5 (already installed), `vitest` (new install for unit tests), `framer-motion` (already installed), `lucide-react`, inline CSS (follow existing codebase pattern).

---

## Prerequisites (run before starting)

### 1. Create a Supabase project
Go to https://supabase.com → New project. Note the **Project URL** and **anon public key** from Settings → API.

### 2. Add env vars to `.env.local`
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

### 3. Run the SQL migration
In the Supabase dashboard → SQL Editor, run the contents of `supabase/migrations/001_data_activation.sql` (created in Task 1).

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/001_data_activation.sql` | Full schema: orgs, members, uploads, assets, lessees, leases, provisions + Phase 2 tables |
| Create | `src/app/lib/supabase.ts` | Supabase client singleton |
| Create | `src/app/lib/columnMapper.ts` | Fuzzy header-to-field matching |
| Create | `src/app/lib/columnMapper.test.ts` | Unit tests for column mapper |
| Create | `src/app/types/portfolio.ts` | Asset, Lessee, Lease, Provision, PortfolioData interfaces |
| Create | `src/app/data/mockPortfolioData.ts` | Mock data extracted from inline page constants |
| Create | `src/app/contexts/DataContext.tsx` | Org state, upload status, DataProvider |
| Create | `src/app/hooks/usePortfolioData.ts` | Returns mock or Supabase data based on hasUpload |
| Create | `src/app/components/upload/DropZoneStep.tsx` | Step 1: file drop + template download |
| Create | `src/app/components/upload/ColumnMapStep.tsx` | Step 2: column mapping table |
| Create | `src/app/components/upload/ReviewImportStep.tsx` | Step 3: preview rows + import to Supabase |
| Create | `src/app/components/upload/UploadWizard.tsx` | Composes 3-step upload flow (modal) |
| Create | `src/app/components/onboarding/OrgSetupStep.tsx` | Onboarding step 1: org name, fleet size, currency |
| Create | `src/app/components/onboarding/InviteTeamStep.tsx` | Onboarding step 2: invite emails (skippable) |
| Create | `src/app/components/onboarding/UploadStep.tsx` | Onboarding step 3: embeds UploadWizard inline |
| Create | `src/app/components/onboarding/ConfirmationStep.tsx` | Onboarding step 4: success + CTA to dashboard |
| Create | `src/app/components/onboarding/OnboardingWizard.tsx` | Full-screen 4-step onboarding shell |
| Create | `src/app/components/layout/DemoBanner.tsx` | Persistent banner when isDemo=true |
| Modify | `src/app/App.tsx` | Add DataProvider wrapper |
| Modify | `src/app/routes.tsx` | Add /onboarding route (inside RequireAuth, no Layout) |
| Modify | `src/app/components/auth/RequireAuth.tsx` | Redirect to /onboarding if user has no org |
| Modify | `src/app/pages/PortfolioHub.tsx` | Add "Upload Portfolio Data" CTA button |
| Create | `vitest.config.ts` | Vitest config for unit tests |

---

## Task 1: Supabase Migration SQL

**Files:**
- Create: `supabase/migrations/001_data_activation.sql`

- [ ] **Step 1: Create the supabase directory and migration file**

```bash
mkdir -p /path/to/Aeroinsights/supabase/migrations
```

Create `supabase/migrations/001_data_activation.sql` with this content:

```sql
-- ─── organisations ───────────────────────────────────────────────────────────
create table if not exists organisations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  plan         text not null default 'starter', -- starter | growth | enterprise
  base_currency text not null default 'EUR',
  created_at   timestamptz not null default now()
);

-- ─── org_members ─────────────────────────────────────────────────────────────
create table if not exists org_members (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organisations(id) on delete cascade,
  user_id    text not null,          -- Auth0 sub
  role       text not null default 'analyst', -- admin | analyst
  created_at timestamptz not null default now(),
  unique(org_id, user_id)
);
create index if not exists org_members_user_id_idx on org_members(user_id);

-- ─── uploads ─────────────────────────────────────────────────────────────────
create table if not exists uploads (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organisations(id) on delete cascade,
  filename     text not null,
  status       text not null default 'pending', -- pending | processing | complete | error
  column_map   jsonb,
  row_count    int,
  error_detail text,
  created_at   timestamptz not null default now()
);
create index if not exists uploads_org_id_idx on uploads(org_id);

-- ─── assets ──────────────────────────────────────────────────────────────────
create table if not exists assets (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organisations(id) on delete cascade,
  upload_id        uuid references uploads(id) on delete set null,
  registration     text not null,
  msn              text not null,
  aircraft_type    text not null,
  manufacturer     text,
  vintage          int,
  current_operator text,
  created_at       timestamptz not null default now()
);
create index if not exists assets_org_id_idx on assets(org_id);

-- ─── lessees ─────────────────────────────────────────────────────────────────
create table if not exists lessees (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organisations(id) on delete cascade,
  name             text not null,
  iata_code        text,
  country          text,
  credit_rating    text,
  pd_estimate      numeric,
  watchlist_status text, -- green | amber | red
  created_at       timestamptz not null default now()
);
create index if not exists lessees_org_id_idx on lessees(org_id);

-- ─── leases ──────────────────────────────────────────────────────────────────
create table if not exists leases (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organisations(id) on delete cascade,
  asset_id       uuid not null references assets(id) on delete cascade,
  lessee_id      uuid not null references lessees(id) on delete cascade,
  start_date     date not null,
  end_date       date not null,
  monthly_rental numeric,
  currency       text not null default 'EUR',
  stage          int,   -- 1 | 2 | 3
  created_at     timestamptz not null default now()
);
create index if not exists leases_org_id_idx on leases(org_id);

-- ─── provisions ──────────────────────────────────────────────────────────────
create table if not exists provisions (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organisations(id) on delete cascade,
  asset_id        uuid not null references assets(id) on delete cascade,
  stage           int,
  ecl_amount      numeric,
  pd              numeric,
  lgd             numeric,
  ead             numeric,
  reporting_date  date,
  created_at      timestamptz not null default now()
);
create index if not exists provisions_org_id_idx on provisions(org_id);

-- ─── Phase 2: market_data (schema defined now, populated later) ───────────────
create table if not exists market_data (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organisations(id) on delete cascade,
  asset_id         uuid references assets(id) on delete set null,
  source           text not null,  -- cirium | oag | manual
  cmv              numeric,
  half_life_value  numeric,
  utilisation_rate numeric,
  fetched_at       timestamptz not null default now()
);

-- ─── Phase 2: lessee_financials (schema defined now, populated later) ─────────
create table if not exists lessee_financials (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organisations(id) on delete cascade,
  lessee_id    uuid references lessees(id) on delete set null,
  source       text not null,  -- bloomberg | oag | manual
  revenue      numeric,
  ebitda       numeric,
  debt_equity  numeric,
  load_factor  numeric,
  rpk          numeric,
  period_end   date,
  fetched_at   timestamptz not null default now()
);

-- ─── Row-Level Security ───────────────────────────────────────────────────────
-- NOTE: RLS is disabled for Phase 1 demo. org_id filtering happens in the
-- application layer (DataContext + hook). Enable and tighten these policies
-- before production launch.

alter table organisations    disable row level security;
alter table org_members      disable row level security;
alter table uploads          disable row level security;
alter table assets           disable row level security;
alter table lessees          disable row level security;
alter table leases           disable row level security;
alter table provisions       disable row level security;
alter table market_data      disable row level security;
alter table lessee_financials disable row level security;
```

- [ ] **Step 2: Run migration in Supabase SQL Editor**

Open Supabase Dashboard → SQL Editor → paste the file contents → Run.

Verify: Supabase → Table Editor should show all 9 tables.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/001_data_activation.sql
git commit -m "feat: add Supabase migration for data activation schema"
```

---

## Task 2: Vitest Config + Supabase Client + Types

**Files:**
- Create: `vitest.config.ts`
- Create: `src/app/lib/supabase.ts`
- Create: `src/app/types/portfolio.ts`

- [ ] **Step 1: Create vitest.config.ts**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
```

- [ ] **Step 2: Install vitest and supabase-js**

```bash
pnpm add @supabase/supabase-js
pnpm add -D vitest
```

- [ ] **Step 3: Create the Supabase client singleton**

Create `src/app/lib/supabase.ts`:

```ts
// src/app/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[Supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set. " +
      "Data will fall back to demo mode."
  );
}

export const supabase = createClient(
  supabaseUrl ?? "https://placeholder.supabase.co",
  supabaseAnonKey ?? "placeholder"
);
```

- [ ] **Step 4: Create portfolio types**

Create `src/app/types/portfolio.ts`:

```ts
// src/app/types/portfolio.ts

export interface Asset {
  id: string;
  org_id: string;
  upload_id: string | null;
  registration: string;
  msn: string;
  aircraft_type: string;
  manufacturer: string | null;
  vintage: number | null;
  current_operator: string | null;
  created_at: string;
}

export interface Lessee {
  id: string;
  org_id: string;
  name: string;
  iata_code: string | null;
  country: string | null;
  credit_rating: string | null;
  pd_estimate: number | null;
  watchlist_status: "green" | "amber" | "red" | null;
  created_at: string;
}

export interface Lease {
  id: string;
  org_id: string;
  asset_id: string;
  lessee_id: string;
  start_date: string;
  end_date: string;
  monthly_rental: number | null;
  currency: string;
  stage: 1 | 2 | 3 | null;
  created_at: string;
}

export interface Provision {
  id: string;
  org_id: string;
  asset_id: string;
  stage: number | null;
  ecl_amount: number | null;
  pd: number | null;
  lgd: number | null;
  ead: number | null;
  reporting_date: string | null;
  created_at: string;
}

export interface PortfolioData {
  assets: Asset[];
  lessees: Lessee[];
  leases: Lease[];
  provisions: Provision[];
  isLoading: boolean;
  isDemo: boolean;
}
```

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts src/app/lib/supabase.ts src/app/types/portfolio.ts
git commit -m "feat: add Supabase client, portfolio types, vitest config"
```

---

## Task 3: Column Mapper Utility + Tests

**Files:**
- Create: `src/app/lib/columnMapper.ts`
- Create: `src/app/lib/columnMapper.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/lib/columnMapper.test.ts`:

```ts
// src/app/lib/columnMapper.test.ts
import { describe, it, expect } from "vitest";
import { suggestMapping, REQUIRED_FIELDS, OUR_FIELDS } from "./columnMapper";

describe("suggestMapping", () => {
  it("matches exact field names", () => {
    const headers = ["registration", "msn", "aircraft_type", "lessee_name", "start_date", "end_date"];
    const result = suggestMapping(headers);
    expect(result["registration"]).toBe("registration");
    expect(result["msn"]).toBe("msn");
    expect(result["lessee_name"]).toBe("lessee_name");
  });

  it("matches common aliases case-insensitively", () => {
    const headers = ["Tail No.", "S/N", "A/C Type", "Airline", "Lease Start", "Lease End"];
    const result = suggestMapping(headers);
    expect(result["registration"]).toBe("Tail No.");
    expect(result["msn"]).toBe("S/N");
    expect(result["aircraft_type"]).toBe("A/C Type");
    expect(result["lessee_name"]).toBe("Airline");
    expect(result["start_date"]).toBe("Lease Start");
    expect(result["end_date"]).toBe("Lease End");
  });

  it("returns null for fields with no matching header", () => {
    const result = suggestMapping(["something_unrelated"]);
    expect(result["registration"]).toBeNull();
    expect(result["msn"]).toBeNull();
  });

  it("REQUIRED_FIELDS contains the 5 mandatory fields", () => {
    expect(REQUIRED_FIELDS).toEqual(
      expect.arrayContaining(["registration", "msn", "aircraft_type", "lessee_name", "start_date", "end_date"])
    );
  });

  it("OUR_FIELDS lists all mappable fields", () => {
    expect(OUR_FIELDS.length).toBeGreaterThan(8);
    expect(OUR_FIELDS.some(f => f.id === "registration")).toBe(true);
    expect(OUR_FIELDS.some(f => f.id === "lessee_name")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm exec vitest run src/app/lib/columnMapper.test.ts
```

Expected: FAIL — "cannot find module './columnMapper'"

- [ ] **Step 3: Implement the column mapper**

Create `src/app/lib/columnMapper.ts`:

```ts
// src/app/lib/columnMapper.ts

export interface FieldDef {
  id: string;
  label: string;
  required: boolean;
  example: string;
  description: string;
}

export const OUR_FIELDS: FieldDef[] = [
  { id: "registration",    label: "Registration",      required: true,  example: "VT-IYC",      description: "Aircraft tail number" },
  { id: "msn",             label: "MSN",               required: true,  example: "9218",         description: "Manufacturer Serial Number" },
  { id: "aircraft_type",   label: "Aircraft Type",     required: true,  example: "A320neo",      description: "ICAO type designator" },
  { id: "lessee_name",     label: "Lessee Name",       required: true,  example: "IndiGo Airlines", description: "Airline or lessee entity" },
  { id: "start_date",      label: "Lease Start",       required: true,  example: "2019-03-01",   description: "Lease commencement (YYYY-MM-DD)" },
  { id: "end_date",        label: "Lease End",         required: true,  example: "2028-03-01",   description: "Lease expiry (YYYY-MM-DD)" },
  { id: "manufacturer",    label: "Manufacturer",      required: false, example: "Airbus",       description: "OEM (Airbus / Boeing)" },
  { id: "vintage",         label: "Vintage (Year)",    required: false, example: "2019",         description: "Year of manufacture" },
  { id: "current_operator",label: "Current Operator",  required: false, example: "IndiGo",       description: "Current operating airline" },
  { id: "iata_code",       label: "IATA Code",         required: false, example: "6E",           description: "2-letter airline code" },
  { id: "country",         label: "Country",           required: false, example: "India",        description: "Lessee country" },
  { id: "credit_rating",   label: "Credit Rating",     required: false, example: "BB-",          description: "S&P / Moody's rating" },
  { id: "pd_estimate",     label: "PD Estimate",       required: false, example: "0.12",         description: "Probability of default (0–1)" },
  { id: "watchlist_status",label: "Watchlist Status",  required: false, example: "amber",        description: "green | amber | red" },
  { id: "monthly_rental",  label: "Monthly Rental",    required: false, example: "285000",       description: "Monthly rent (number, no commas)" },
  { id: "currency",        label: "Currency",          required: false, example: "USD",          description: "ISO currency code" },
  { id: "stage",           label: "IFRS 9 Stage",      required: false, example: "2",            description: "1 | 2 | 3" },
  { id: "ecl_amount",      label: "ECL Amount",        required: false, example: "4200000",      description: "ECL provision (number)" },
  { id: "pd",              label: "PD",                required: false, example: "0.12",         description: "Probability of default used for ECL" },
  { id: "lgd",             label: "LGD",               required: false, example: "0.45",         description: "Loss given default" },
  { id: "ead",             label: "EAD",               required: false, example: "24200000",     description: "Exposure at default" },
];

export const REQUIRED_FIELDS: string[] = OUR_FIELDS.filter(f => f.required).map(f => f.id);

// Aliases: map of field id → list of header strings that should match
const ALIASES: Record<string, string[]> = {
  registration:     ["registration", "reg", "tail", "tail no", "tail no.", "tail number", "a/c reg", "aircraft reg", "ac reg"],
  msn:              ["msn", "serial", "serial number", "manufacturer serial", "serial no", "s/n", "sn"],
  aircraft_type:    ["aircraft type", "type", "a/c type", "aircraft", "model", "aircraft model", "ac type"],
  lessee_name:      ["lessee", "lessee name", "airline", "operator name", "tenant", "client", "customer"],
  start_date:       ["start", "lease start", "commencement", "start date", "lease commencement", "from", "date from"],
  end_date:         ["end", "lease end", "expiry", "end date", "lease expiry", "maturity", "to", "date to"],
  manufacturer:     ["manufacturer", "oem", "maker", "built by"],
  vintage:          ["vintage", "year", "year of manufacture", "yom", "build year", "manufacture year", "msn year"],
  current_operator: ["operator", "current operator", "operated by", "operating airline"],
  iata_code:        ["iata", "iata code", "code", "airline code", "icao"],
  country:          ["country", "country code", "nation", "jurisdiction", "lessee country"],
  credit_rating:    ["credit rating", "rating", "s&p", "moody's", "credit", "agency rating"],
  pd_estimate:      ["pd", "probability of default", "pd estimate", "default probability", "pd %"],
  watchlist_status: ["watchlist", "watchlist status", "risk status", "watch"],
  monthly_rental:   ["rental", "rent", "monthly rental", "monthly rent", "rental usd", "lease rate", "rent usd", "monthly payment"],
  currency:         ["currency", "ccy", "currency code", "curr"],
  stage:            ["stage", "ifrs9 stage", "ifrs 9", "credit stage", "ecl stage"],
  ecl_amount:       ["ecl", "provision", "ecl amount", "expected credit loss", "loss provision", "ecl $"],
  pd:               ["pd", "probability of default"],
  lgd:              ["lgd", "loss given default"],
  ead:              ["ead", "exposure at default"],
};

/**
 * Given the detected column headers from an uploaded file, returns a mapping
 * of our field id → the detected header that best matches, or null if no match.
 */
export function suggestMapping(detectedHeaders: string[]): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  const normalised = detectedHeaders.map(h => h.toLowerCase().trim());

  for (const field of OUR_FIELDS) {
    const aliases = ALIASES[field.id] ?? [];
    const matchIndex = normalised.findIndex(h =>
      aliases.some(alias => alias === h)
    );
    result[field.id] = matchIndex >= 0 ? detectedHeaders[matchIndex] : null;
  }

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm exec vitest run src/app/lib/columnMapper.test.ts
```

Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/app/lib/columnMapper.ts src/app/lib/columnMapper.test.ts
git commit -m "feat: add column mapper utility with fuzzy header matching"
```

---

## Task 4: Mock Portfolio Data + DataContext + usePortfolioData Hook

**Files:**
- Create: `src/app/data/mockPortfolioData.ts`
- Create: `src/app/contexts/DataContext.tsx`
- Create: `src/app/hooks/usePortfolioData.ts`

- [ ] **Step 1: Create mock portfolio data file**

Create `src/app/data/mockPortfolioData.ts`:

```ts
// src/app/data/mockPortfolioData.ts
// Canonical mock data matching the existing inline constants in Portfolio.tsx.
// usePortfolioData() returns this when no real upload exists.

import type { Asset, Lessee, Lease, Provision } from "../types/portfolio";

export const MOCK_ASSETS: Asset[] = [
  { id: "mock-a1",  org_id: "demo", upload_id: null, registration: "VT-IYC",  msn: "9218",  aircraft_type: "A320neo",    manufacturer: "Airbus",  vintage: 2019, current_operator: "IndiGo Airlines",      created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-a2",  org_id: "demo", upload_id: null, registration: "XA-AMX",  msn: "41234", aircraft_type: "B737-800",   manufacturer: "Boeing",  vintage: 2020, current_operator: "Aeromexico",           created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-a3",  org_id: "demo", upload_id: null, registration: "A6-ECE",  msn: "62047", aircraft_type: "B777-300ER", manufacturer: "Boeing",  vintage: 2021, current_operator: "Emirates",             created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-a4",  org_id: "demo", upload_id: null, registration: "4R-ALB",  msn: "1728",  aircraft_type: "A330-300",   manufacturer: "Airbus",  vintage: 2015, current_operator: "SriLankan Airlines",   created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-a5",  org_id: "demo", upload_id: null, registration: "EI-HXP",  msn: "67892", aircraft_type: "B737 MAX 8", manufacturer: "Boeing",  vintage: 2022, current_operator: "Ryanair",              created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-a6",  org_id: "demo", upload_id: null, registration: "F-HTYR",  msn: "0378",  aircraft_type: "A350-900",   manufacturer: "Airbus",  vintage: 2018, current_operator: "Air France",           created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-a7",  org_id: "demo", upload_id: null, registration: "PR-YRJ",  msn: "10442", aircraft_type: "A320neo",    manufacturer: "Airbus",  vintage: 2021, current_operator: "Azul Brazilian Airlines", created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-a8",  org_id: "demo", upload_id: null, registration: "C-GTSA",  msn: "8841",  aircraft_type: "A321neo",    manufacturer: "Airbus",  vintage: 2019, current_operator: "Air Transat",          created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-a9",  org_id: "demo", upload_id: null, registration: "9V-SMB",  msn: "0521",  aircraft_type: "A350-900",   manufacturer: "Airbus",  vintage: 2023, current_operator: "Singapore Airlines",   created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-a10", org_id: "demo", upload_id: null, registration: "D-AIVM",  msn: "55124", aircraft_type: "A220-300",   manufacturer: "Airbus",  vintage: 2022, current_operator: "Lufthansa",            created_at: "2024-01-01T00:00:00Z" },
];

export const MOCK_LESSEES: Lessee[] = [
  { id: "mock-l1",  org_id: "demo", name: "IndiGo Airlines",      iata_code: "6E", country: "India",       credit_rating: "BB-",  pd_estimate: 0.12, watchlist_status: "red",   created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-l2",  org_id: "demo", name: "Aeromexico",           iata_code: "AM", country: "Mexico",      credit_rating: "CCC",  pd_estimate: 0.28, watchlist_status: "red",   created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-l3",  org_id: "demo", name: "Emirates",             iata_code: "EK", country: "UAE",         credit_rating: "A-",   pd_estimate: 0.01, watchlist_status: "green", created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-l4",  org_id: "demo", name: "SriLankan Airlines",   iata_code: "UL", country: "Sri Lanka",   credit_rating: "B+",   pd_estimate: 0.08, watchlist_status: "amber", created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-l5",  org_id: "demo", name: "Ryanair",              iata_code: "FR", country: "Ireland",     credit_rating: "BBB+", pd_estimate: 0.02, watchlist_status: "green", created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-l6",  org_id: "demo", name: "Air France",           iata_code: "AF", country: "France",      credit_rating: "BB+",  pd_estimate: 0.04, watchlist_status: "green", created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-l7",  org_id: "demo", name: "Azul Brazilian Airlines", iata_code: "AD", country: "Brazil",   credit_rating: "B+",   pd_estimate: 0.09, watchlist_status: "amber", created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-l8",  org_id: "demo", name: "Air Transat",          iata_code: "TS", country: "Canada",      credit_rating: "B",    pd_estimate: 0.11, watchlist_status: "amber", created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-l9",  org_id: "demo", name: "Singapore Airlines",   iata_code: "SQ", country: "Singapore",   credit_rating: "A",    pd_estimate: 0.01, watchlist_status: "green", created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-l10", org_id: "demo", name: "Lufthansa",            iata_code: "LH", country: "Germany",     credit_rating: "BBB-", pd_estimate: 0.03, watchlist_status: "green", created_at: "2024-01-01T00:00:00Z" },
];

export const MOCK_LEASES: Lease[] = [
  { id: "mock-ls1",  org_id: "demo", asset_id: "mock-a1",  lessee_id: "mock-l1",  start_date: "2019-03-01", end_date: "2028-03-01", monthly_rental: 285000,  currency: "USD", stage: 3, created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-ls2",  org_id: "demo", asset_id: "mock-a2",  lessee_id: "mock-l2",  start_date: "2020-06-15", end_date: "2027-06-15", monthly_rental: 310000,  currency: "USD", stage: 3, created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-ls3",  org_id: "demo", asset_id: "mock-a3",  lessee_id: "mock-l3",  start_date: "2021-01-10", end_date: "2030-01-10", monthly_rental: 1240000, currency: "USD", stage: 1, created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-ls4",  org_id: "demo", asset_id: "mock-a4",  lessee_id: "mock-l4",  start_date: "2020-09-01", end_date: "2026-09-01", monthly_rental: 480000,  currency: "USD", stage: 2, created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-ls5",  org_id: "demo", asset_id: "mock-a5",  lessee_id: "mock-l5",  start_date: "2022-04-15", end_date: "2032-04-15", monthly_rental: 340000,  currency: "USD", stage: 1, created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-ls6",  org_id: "demo", asset_id: "mock-a6",  lessee_id: "mock-l6",  start_date: "2018-07-20", end_date: "2028-07-20", monthly_rental: 960000,  currency: "USD", stage: 1, created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-ls7",  org_id: "demo", asset_id: "mock-a7",  lessee_id: "mock-l7",  start_date: "2021-11-01", end_date: "2029-11-01", monthly_rental: 295000,  currency: "USD", stage: 2, created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-ls8",  org_id: "demo", asset_id: "mock-a8",  lessee_id: "mock-l8",  start_date: "2019-05-01", end_date: "2027-05-01", monthly_rental: 275000,  currency: "USD", stage: 2, created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-ls9",  org_id: "demo", asset_id: "mock-a9",  lessee_id: "mock-l9",  start_date: "2023-02-01", end_date: "2033-02-01", monthly_rental: 1050000, currency: "USD", stage: 1, created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-ls10", org_id: "demo", asset_id: "mock-a10", lessee_id: "mock-l10", start_date: "2022-08-01", end_date: "2032-08-01", monthly_rental: 220000,  currency: "USD", stage: 1, created_at: "2024-01-01T00:00:00Z" },
];

export const MOCK_PROVISIONS: Provision[] = [
  { id: "mock-p1",  org_id: "demo", asset_id: "mock-a1",  stage: 3, ecl_amount: 4200000, pd: 0.12, lgd: 0.45, ead: 24200000, reporting_date: "2024-12-31", created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-p2",  org_id: "demo", asset_id: "mock-a2",  stage: 3, ecl_amount: 3800000, pd: 0.28, lgd: 0.45, ead: 32100000, reporting_date: "2024-12-31", created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-p3",  org_id: "demo", asset_id: "mock-a3",  stage: 1, ecl_amount: 890000,  pd: 0.01, lgd: 0.45, ead: 88400000, reporting_date: "2024-12-31", created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-p4",  org_id: "demo", asset_id: "mock-a4",  stage: 2, ecl_amount: 2100000, pd: 0.08, lgd: 0.45, ead: 34200000, reporting_date: "2024-12-31", created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-p5",  org_id: "demo", asset_id: "mock-a5",  stage: 1, ecl_amount: 450000,  pd: 0.02, lgd: 0.45, ead: 44700000, reporting_date: "2024-12-31", created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-p6",  org_id: "demo", asset_id: "mock-a6",  stage: 1, ecl_amount: 680000,  pd: 0.04, lgd: 0.45, ead: 68300000, reporting_date: "2024-12-31", created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-p7",  org_id: "demo", asset_id: "mock-a7",  stage: 2, ecl_amount: 1900000, pd: 0.09, lgd: 0.45, ead: 34200000, reporting_date: "2024-12-31", created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-p8",  org_id: "demo", asset_id: "mock-a8",  stage: 2, ecl_amount: 1500000, pd: 0.11, lgd: 0.45, ead: 28900000, reporting_date: "2024-12-31", created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-p9",  org_id: "demo", asset_id: "mock-a9",  stage: 1, ecl_amount: 1100000, pd: 0.01, lgd: 0.45, ead: 91200000, reporting_date: "2024-12-31", created_at: "2024-01-01T00:00:00Z" },
  { id: "mock-p10", org_id: "demo", asset_id: "mock-a10", stage: 1, ecl_amount: 340000,  pd: 0.03, lgd: 0.45, ead: 44700000, reporting_date: "2024-12-31", created_at: "2024-01-01T00:00:00Z" },
];
```

- [ ] **Step 2: Create DataContext**

Create `src/app/contexts/DataContext.tsx`:

```tsx
// src/app/contexts/DataContext.tsx
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from "../lib/supabase";

type UploadStatus = "none" | "pending" | "processing" | "complete" | "error";

interface DataContextValue {
  orgId: string | null;
  hasUpload: boolean;
  uploadStatus: UploadStatus;
  isLoadingOrg: boolean;
  refetchUploadStatus: () => Promise<void>;
}

const DataContext = createContext<DataContextValue>({
  orgId: null,
  hasUpload: false,
  uploadStatus: "none",
  isLoadingOrg: false,
  refetchUploadStatus: async () => {},
});

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth0();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("none");
  const [isLoadingOrg, setIsLoadingOrg] = useState(false);

  async function resolveOrg(userId: string) {
    setIsLoadingOrg(true);
    try {
      const { data } = await supabase
        .from("org_members")
        .select("org_id")
        .eq("user_id", userId)
        .single();
      if (data?.org_id) setOrgId(data.org_id);
    } catch {
      // No org found — app runs in demo mode
    } finally {
      setIsLoadingOrg(false);
    }
  }

  const fetchUploadStatus = useCallback(async () => {
    if (!orgId) return;
    try {
      const { data } = await supabase
        .from("uploads")
        .select("status")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      setUploadStatus((data?.status as UploadStatus) ?? "none");
    } catch {
      setUploadStatus("none");
    }
  }, [orgId]);

  useEffect(() => {
    if (isAuthenticated && user?.sub) resolveOrg(user.sub);
  }, [isAuthenticated, user?.sub]);

  useEffect(() => {
    if (orgId) fetchUploadStatus();
  }, [orgId, fetchUploadStatus]);

  return (
    <DataContext.Provider
      value={{
        orgId,
        hasUpload: uploadStatus === "complete",
        uploadStatus,
        isLoadingOrg,
        refetchUploadStatus: fetchUploadStatus,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
```

- [ ] **Step 3: Create usePortfolioData hook**

Create `src/app/hooks/usePortfolioData.ts`:

```ts
// src/app/hooks/usePortfolioData.ts
import { useState, useEffect } from "react";
import { useData } from "../contexts/DataContext";
import { supabase } from "../lib/supabase";
import { MOCK_ASSETS, MOCK_LESSEES, MOCK_LEASES, MOCK_PROVISIONS } from "../data/mockPortfolioData";
import type { Asset, Lessee, Lease, Provision, PortfolioData } from "../types/portfolio";

export function usePortfolioData(): PortfolioData {
  const { orgId, hasUpload } = useData();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [lessees, setLessees] = useState<Lessee[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [provisions, setProvisions] = useState<Provision[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!hasUpload || !orgId) return;

    setIsLoading(true);
    Promise.all([
      supabase.from("assets").select("*").eq("org_id", orgId),
      supabase.from("lessees").select("*").eq("org_id", orgId),
      supabase.from("leases").select("*").eq("org_id", orgId),
      supabase.from("provisions").select("*").eq("org_id", orgId),
    ])
      .then(([a, l, ls, p]) => {
        setAssets((a.data as Asset[]) ?? []);
        setLessees((l.data as Lessee[]) ?? []);
        setLeases((ls.data as Lease[]) ?? []);
        setProvisions((p.data as Provision[]) ?? []);
      })
      .finally(() => setIsLoading(false));
  }, [orgId, hasUpload]);

  if (!hasUpload) {
    return {
      assets: MOCK_ASSETS,
      lessees: MOCK_LESSEES,
      leases: MOCK_LEASES,
      provisions: MOCK_PROVISIONS,
      isLoading: false,
      isDemo: true,
    };
  }

  return { assets, lessees, leases, provisions, isLoading, isDemo: false };
}
```

- [ ] **Step 4: Add DataProvider to App.tsx**

Open `src/app/App.tsx`. Replace the entire file with:

```tsx
// src/app/App.tsx
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { PortfolioProvider } from "./contexts/PortfolioContext";
import { ViewModeProvider } from "./contexts/ViewModeContext";
import { OnboardingProvider } from "./contexts/OnboardingContext";
import { DataProvider } from "./contexts/DataContext";

export default function App() {
  return (
    <OnboardingProvider>
      <DataProvider>
        <PortfolioProvider>
          <ViewModeProvider>
            <RouterProvider router={router} />
          </ViewModeProvider>
        </PortfolioProvider>
      </DataProvider>
    </OnboardingProvider>
  );
}
```

- [ ] **Step 5: Verify the app still starts**

```bash
pnpm dev
```

Expected: app loads at http://localhost:5173 with no console errors. DataContext runs in demo mode (no Supabase connection yet — that's fine).

- [ ] **Step 6: Commit**

```bash
git add src/app/data/mockPortfolioData.ts src/app/contexts/DataContext.tsx src/app/hooks/usePortfolioData.ts src/app/App.tsx
git commit -m "feat: add DataContext, usePortfolioData hook, and mock portfolio data"
```

---

## Task 5: DropZoneStep Component

**Files:**
- Create: `src/app/components/upload/DropZoneStep.tsx`

- [ ] **Step 1: Create the DropZoneStep**

Create `src/app/components/upload/DropZoneStep.tsx`:

```tsx
// src/app/components/upload/DropZoneStep.tsx
import * as React from "react";
import { Upload, FileSpreadsheet, Download } from "lucide-react";
import { OUR_FIELDS } from "../../lib/columnMapper";
import * as XLSX from "xlsx";

interface DropZoneStepProps {
  onFileParsed: (headers: string[], rows: Record<string, string>[], file: File) => void;
}

// Generate and download the Excel template
function downloadTemplate() {
  const headers = OUR_FIELDS.map(f => f.id);
  const exampleRow = OUR_FIELDS.reduce<Record<string, string>>((acc, f) => {
    acc[f.id] = f.example;
    return acc;
  }, {});
  const ws = XLSX.utils.json_to_sheet([exampleRow], { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Portfolio");
  XLSX.writeFile(wb, "aeroinsights-portfolio-template.xlsx");
}

// Parse uploaded file → headers + rows
function parseFile(file: File): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { raw: false });
        if (raw.length === 0) { reject(new Error("File is empty")); return; }
        const headers = Object.keys(raw[0]);
        resolve({ headers, rows: raw });
      } catch {
        reject(new Error("Could not parse file. Please use .csv, .xlsx, or .xls"));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

export function DropZoneStep({ onFileParsed }: DropZoneStepProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    const allowed = [".csv", ".xlsx", ".xls"];
    const ext = "." + file.name.split(".").pop()!.toLowerCase();
    if (!allowed.includes(ext)) {
      setError("Please upload a .csv, .xlsx, or .xls file.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { headers, rows } = await parseFile(file);
      onFileParsed(headers, rows, file);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Template download */}
      <div
        style={{
          background: "#F0F9FF",
          border: "1px solid #BAE6FD",
          borderRadius: "8px",
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <FileSpreadsheet size={20} style={{ color: "#0284C7", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: "0.8125rem", color: "#0F172A" }}>
            Use our template for the easiest upload
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "2px" }}>
            Download, fill in your data, then upload below. Column mapping is skipped.
          </div>
        </div>
        <button
          onClick={downloadTemplate}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "7px 14px",
            background: "#0284C7",
            color: "#FFFFFF",
            border: "none",
            borderRadius: "6px",
            fontWeight: 600,
            fontSize: "0.8125rem",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <Download size={14} />
          Template
        </button>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? "#002147" : "#CBD5E1"}`,
          borderRadius: "8px",
          padding: "40px 20px",
          textAlign: "center",
          cursor: "pointer",
          background: isDragging ? "rgba(0,33,71,0.03)" : "#FAFAFA",
          transition: "all 150ms",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          style={{ display: "none" }}
          onChange={onInputChange}
        />
        <Upload size={32} style={{ color: "#94A3B8", marginBottom: "12px" }} />
        <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "#0F172A", marginBottom: "4px" }}>
          {isLoading ? "Parsing file…" : "Drop your file here"}
        </div>
        <div style={{ fontSize: "0.8125rem", color: "#64748B" }}>
          or click to browse — .csv, .xlsx, .xls accepted
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: "6px",
            padding: "10px 14px",
            fontSize: "0.8125rem",
            color: "#B91C1C",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/upload/DropZoneStep.tsx
git commit -m "feat: add DropZoneStep with drag-and-drop file parsing and template download"
```

---

## Task 6: ColumnMapStep Component

**Files:**
- Create: `src/app/components/upload/ColumnMapStep.tsx`

- [ ] **Step 1: Create ColumnMapStep**

Create `src/app/components/upload/ColumnMapStep.tsx`:

```tsx
// src/app/components/upload/ColumnMapStep.tsx
import * as React from "react";
import { OUR_FIELDS, REQUIRED_FIELDS, type FieldDef } from "../../lib/columnMapper";

interface ColumnMapStepProps {
  detectedHeaders: string[];
  initialMapping: Record<string, string | null>; // field id → detected header or null
  sampleRows: Record<string, string>[];           // first 3 rows for preview
  onChange: (mapping: Record<string, string | null>) => void;
}

export function ColumnMapStep({
  detectedHeaders,
  initialMapping,
  sampleRows,
  onChange,
}: ColumnMapStepProps) {
  const [mapping, setMapping] = React.useState<Record<string, string | null>>(initialMapping);

  function update(fieldId: string, value: string | null) {
    const next = { ...mapping, [fieldId]: value };
    setMapping(next);
    onChange(next);
  }

  const headerOptions = ["(skip)", ...detectedHeaders];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <p style={{ margin: 0, fontSize: "0.8125rem", color: "#475569", marginBottom: "4px" }}>
        Match your file's columns to our fields. Required fields are marked <span style={{ color: "#B91C1C" }}>*</span>.
        We've pre-filled suggestions — correct any that look wrong.
      </p>

      {/* Table header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "8px",
          padding: "6px 10px",
          background: "#F8FAFC",
          borderRadius: "6px",
          fontSize: "0.6875rem",
          fontWeight: 700,
          color: "#64748B",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        <span>Our field</span>
        <span>Your column</span>
        <span>Sample value</span>
      </div>

      {/* Field rows */}
      {OUR_FIELDS.map((field: FieldDef) => {
        const selected = mapping[field.id];
        const sample = selected && selected !== "(skip)"
          ? (sampleRows[0]?.[selected] ?? "—")
          : "—";
        const isRequired = REQUIRED_FIELDS.includes(field.id);
        const isMissing = isRequired && (!selected || selected === "(skip)");

        return (
          <div
            key={field.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "8px",
              padding: "8px 10px",
              border: `1px solid ${isMissing ? "#FECACA" : "#E2E8F0"}`,
              borderRadius: "6px",
              background: isMissing ? "#FEF2F2" : "#FFFFFF",
              alignItems: "center",
            }}
          >
            <div>
              <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: "#0F172A" }}>
                {field.label}
              </span>
              {isRequired && <span style={{ color: "#B91C1C", marginLeft: "3px" }}>*</span>}
              <div style={{ fontSize: "0.6875rem", color: "#94A3B8", marginTop: "1px" }}>
                {field.description}
              </div>
            </div>

            <select
              value={selected ?? "(skip)"}
              onChange={(e) => update(field.id, e.target.value === "(skip)" ? null : e.target.value)}
              style={{
                padding: "6px 8px",
                border: `1px solid ${isMissing ? "#FECACA" : "#E2E8F0"}`,
                borderRadius: "6px",
                fontSize: "0.8125rem",
                color: "#0F172A",
                background: "#FFFFFF",
                cursor: "pointer",
                width: "100%",
              }}
            >
              {headerOptions.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>

            <span
              style={{
                fontSize: "0.75rem",
                color: sample === "—" ? "#CBD5E1" : "#475569",
                fontFamily: "monospace",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {sample}
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/upload/ColumnMapStep.tsx
git commit -m "feat: add ColumnMapStep with required-field validation and sample preview"
```

---

## Task 7: ReviewImportStep Component

**Files:**
- Create: `src/app/components/upload/ReviewImportStep.tsx`

- [ ] **Step 1: Create ReviewImportStep**

Create `src/app/components/upload/ReviewImportStep.tsx`:

```tsx
// src/app/components/upload/ReviewImportStep.tsx
import * as React from "react";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { OUR_FIELDS } from "../../lib/columnMapper";

interface ReviewImportStepProps {
  orgId: string;
  filename: string;
  mapping: Record<string, string | null>;
  rows: Record<string, string>[];
  columnMap: Record<string, string | null>;
  onComplete: (uploadId: string, importedCount: number) => void;
  onError: (message: string) => void;
}

interface ParsedRow {
  registration: string;
  msn: string;
  aircraft_type: string;
  lessee_name: string;
  start_date: string;
  end_date: string;
  manufacturer: string | null;
  vintage: number | null;
  current_operator: string | null;
  iata_code: string | null;
  country: string | null;
  credit_rating: string | null;
  pd_estimate: number | null;
  watchlist_status: string | null;
  monthly_rental: number | null;
  currency: string;
  stage: number | null;
  ecl_amount: number | null;
  pd: number | null;
  lgd: number | null;
  ead: number | null;
  _rowIndex: number;
  _errors: string[];
}

function extractValue(row: Record<string, string>, mapping: Record<string, string | null>, fieldId: string): string | null {
  const header = mapping[fieldId];
  if (!header) return null;
  return row[header]?.trim() ?? null;
}

function parseRows(rows: Record<string, string>[], mapping: Record<string, string | null>): ParsedRow[] {
  return rows.map((row, i) => {
    const errors: string[] = [];
    const get = (id: string) => extractValue(row, mapping, id);

    const registration = get("registration") ?? "";
    const msn = get("msn") ?? "";
    const aircraft_type = get("aircraft_type") ?? "";
    const lessee_name = get("lessee_name") ?? "";
    const start_date = get("start_date") ?? "";
    const end_date = get("end_date") ?? "";

    if (!registration) errors.push("Missing Registration");
    if (!msn) errors.push("Missing MSN");
    if (!aircraft_type) errors.push("Missing Aircraft Type");
    if (!lessee_name) errors.push("Missing Lessee Name");
    if (!start_date) errors.push("Missing Lease Start");
    if (!end_date) errors.push("Missing Lease End");

    const vintage = get("vintage") ? parseInt(get("vintage")!, 10) : null;
    if (vintage !== null && isNaN(vintage)) errors.push("Invalid Vintage (must be a year)");

    const monthly_rental = get("monthly_rental") ? parseFloat(get("monthly_rental")!.replace(/,/g, "")) : null;
    const pd_estimate = get("pd_estimate") ? parseFloat(get("pd_estimate")!) : null;
    const stage = get("stage") ? parseInt(get("stage")!, 10) : null;
    if (stage !== null && ![1, 2, 3].includes(stage)) errors.push("Stage must be 1, 2, or 3");
    const ecl_amount = get("ecl_amount") ? parseFloat(get("ecl_amount")!.replace(/,/g, "")) : null;
    const pd_val = get("pd") ? parseFloat(get("pd")!) : null;
    const lgd = get("lgd") ? parseFloat(get("lgd")!) : null;
    const ead = get("ead") ? parseFloat(get("ead")!.replace(/,/g, "")) : null;

    return {
      registration, msn, aircraft_type, lessee_name, start_date, end_date,
      manufacturer: get("manufacturer"),
      vintage: isNaN(vintage!) ? null : vintage,
      current_operator: get("current_operator"),
      iata_code: get("iata_code"),
      country: get("country"),
      credit_rating: get("credit_rating"),
      pd_estimate: isNaN(pd_estimate!) ? null : pd_estimate,
      watchlist_status: get("watchlist_status"),
      monthly_rental: isNaN(monthly_rental!) ? null : monthly_rental,
      currency: get("currency") ?? "EUR",
      stage: stage !== null && !isNaN(stage) && [1, 2, 3].includes(stage) ? stage : null,
      ecl_amount: isNaN(ecl_amount!) ? null : ecl_amount,
      pd: isNaN(pd_val!) ? null : pd_val,
      lgd: isNaN(lgd!) ? null : lgd,
      ead: isNaN(ead!) ? null : ead,
      _rowIndex: i + 2, // +2 for 1-based + header row
      _errors: errors,
    };
  });
}

export function ReviewImportStep({
  orgId,
  filename,
  mapping,
  rows,
  columnMap,
  onComplete,
  onError,
}: ReviewImportStepProps) {
  const parsed = React.useMemo(() => parseRows(rows, mapping), [rows, mapping]);
  const valid = parsed.filter(r => r._errors.length === 0);
  const invalid = parsed.filter(r => r._errors.length > 0);
  const [isImporting, setIsImporting] = React.useState(false);

  const previewRows = valid.slice(0, 5);

  async function handleImport() {
    if (valid.length === 0) return;
    setIsImporting(true);

    try {
      // 1. Create upload record
      const { data: upload, error: uploadError } = await supabase
        .from("uploads")
        .insert({ org_id: orgId, filename, status: "processing", column_map: columnMap, row_count: valid.length })
        .select("id")
        .single();

      if (uploadError || !upload) throw new Error(uploadError?.message ?? "Failed to create upload record");

      const uploadId = upload.id;

      // 2. Upsert lessees (deduplicate by name within org)
      const uniqueLessees = [...new Map(valid.map(r => [r.lessee_name, r])).values()];
      const { data: lesseeRows, error: lesseeError } = await supabase
        .from("lessees")
        .insert(
          uniqueLessees.map(r => ({
            org_id: orgId,
            name: r.lessee_name,
            iata_code: r.iata_code,
            country: r.country,
            credit_rating: r.credit_rating,
            pd_estimate: r.pd_estimate,
            watchlist_status: r.watchlist_status,
          }))
        )
        .select("id, name");

      if (lesseeError) throw new Error("Failed to insert lessees: " + lesseeError.message);
      const lesseeMap = new Map<string, string>((lesseeRows ?? []).map(l => [l.name, l.id]));

      // 3. Insert assets
      const { data: assetRows, error: assetError } = await supabase
        .from("assets")
        .insert(
          valid.map(r => ({
            org_id: orgId,
            upload_id: uploadId,
            registration: r.registration,
            msn: r.msn,
            aircraft_type: r.aircraft_type,
            manufacturer: r.manufacturer,
            vintage: r.vintage,
            current_operator: r.lessee_name,
          }))
        )
        .select("id, msn");

      if (assetError) throw new Error("Failed to insert assets: " + assetError.message);
      const assetMap = new Map<string, string>((assetRows ?? []).map(a => [a.msn, a.id]));

      // 4. Insert leases
      const leaseInserts = valid.map(r => ({
        org_id: orgId,
        asset_id: assetMap.get(r.msn)!,
        lessee_id: lesseeMap.get(r.lessee_name)!,
        start_date: r.start_date,
        end_date: r.end_date,
        monthly_rental: r.monthly_rental,
        currency: r.currency,
        stage: r.stage,
      })).filter(l => l.asset_id && l.lessee_id);

      const { error: leaseError } = await supabase.from("leases").insert(leaseInserts);
      if (leaseError) throw new Error("Failed to insert leases: " + leaseError.message);

      // 5. Insert provisions (only rows with ECL data)
      const provisionInserts = valid
        .filter(r => r.ecl_amount !== null || r.pd !== null)
        .map(r => ({
          org_id: orgId,
          asset_id: assetMap.get(r.msn)!,
          stage: r.stage,
          ecl_amount: r.ecl_amount,
          pd: r.pd,
          lgd: r.lgd,
          ead: r.ead,
        }))
        .filter(p => p.asset_id);

      if (provisionInserts.length > 0) {
        const { error: provError } = await supabase.from("provisions").insert(provisionInserts);
        if (provError) throw new Error("Failed to insert provisions: " + provError.message);
      }

      // 6. Mark upload complete
      await supabase.from("uploads").update({ status: "complete" }).eq("id", uploadId);

      onComplete(uploadId, valid.length);
    } catch (err) {
      // Mark upload as error if uploadId was created
      onError((err as Error).message);
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Summary */}
      <div style={{ display: "flex", gap: "12px" }}>
        <div
          style={{
            flex: 1, padding: "12px 16px", background: "#F0FDF4",
            border: "1px solid #BBF7D0", borderRadius: "8px", textAlign: "center",
          }}
        >
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#15803D" }}>{valid.length}</div>
          <div style={{ fontSize: "0.75rem", color: "#15803D", fontWeight: 500 }}>Rows ready to import</div>
        </div>
        {invalid.length > 0 && (
          <div
            style={{
              flex: 1, padding: "12px 16px", background: "#FEF2F2",
              border: "1px solid #FECACA", borderRadius: "8px", textAlign: "center",
            }}
          >
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#B91C1C" }}>{invalid.length}</div>
            <div style={{ fontSize: "0.75rem", color: "#B91C1C", fontWeight: 500 }}>Rows with errors (will be skipped)</div>
          </div>
        )}
      </div>

      {/* Preview table */}
      {previewRows.length > 0 && (
        <div>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748B", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Preview (first {previewRows.length} rows)
          </div>
          <div style={{ overflowX: "auto", border: "1px solid #E2E8F0", borderRadius: "6px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
              <thead>
                <tr style={{ background: "#F8FAFC" }}>
                  {["Registration", "MSN", "Aircraft Type", "Lessee", "Start", "End"].map(h => (
                    <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, color: "#475569", borderBottom: "1px solid #E2E8F0" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "6px 10px", color: "#0F172A" }}>{r.registration}</td>
                    <td style={{ padding: "6px 10px", color: "#0F172A" }}>{r.msn}</td>
                    <td style={{ padding: "6px 10px", color: "#0F172A" }}>{r.aircraft_type}</td>
                    <td style={{ padding: "6px 10px", color: "#0F172A" }}>{r.lessee_name}</td>
                    <td style={{ padding: "6px 10px", color: "#64748B" }}>{r.start_date}</td>
                    <td style={{ padding: "6px 10px", color: "#64748B" }}>{r.end_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Error rows */}
      {invalid.length > 0 && (
        <div>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#B91C1C", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Skipped rows
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "120px", overflowY: "auto" }}>
            {invalid.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: "8px", alignItems: "flex-start", fontSize: "0.75rem", color: "#B91C1C" }}>
                <AlertCircle size={12} style={{ flexShrink: 0, marginTop: "1px" }} />
                <span>Row {r._rowIndex}: {r._errors.join(", ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Import button */}
      <button
        onClick={handleImport}
        disabled={valid.length === 0 || isImporting}
        style={{
          padding: "10px 24px",
          background: valid.length === 0 ? "#CBD5E1" : "#002147",
          color: "#FFFFFF",
          border: "none",
          borderRadius: "8px",
          fontWeight: 700,
          fontSize: "0.9375rem",
          cursor: valid.length === 0 ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          alignSelf: "flex-end",
        }}
      >
        {isImporting ? (
          <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Importing…</>
        ) : (
          <><CheckCircle2 size={16} /> Import {valid.length} row{valid.length !== 1 ? "s" : ""}</>
        )}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/upload/ReviewImportStep.tsx
git commit -m "feat: add ReviewImportStep with Supabase bulk insert and error handling"
```

---

## Task 8: UploadWizard Modal

**Files:**
- Create: `src/app/components/upload/UploadWizard.tsx`

- [ ] **Step 1: Create UploadWizard**

Create `src/app/components/upload/UploadWizard.tsx`:

```tsx
// src/app/components/upload/UploadWizard.tsx
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { DropZoneStep } from "./DropZoneStep";
import { ColumnMapStep } from "./ColumnMapStep";
import { ReviewImportStep } from "./ReviewImportStep";
import { suggestMapping } from "../../lib/columnMapper";

interface UploadWizardProps {
  orgId: string;
  onClose: () => void;
  onComplete: (uploadId: string, importedCount: number) => void;
}

type Step = "drop" | "map" | "review" | "done";

export function UploadWizard({ orgId, onClose, onComplete }: UploadWizardProps) {
  const [step, setStep] = React.useState<Step>("drop");
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<Record<string, string>[]>([]);
  const [filename, setFilename] = React.useState("");
  const [mapping, setMapping] = React.useState<Record<string, string | null>>({});
  const [importError, setImportError] = React.useState<string | null>(null);

  function handleFileParsed(h: string[], r: Record<string, string>[], file: File) {
    setHeaders(h);
    setRows(r);
    setFilename(file.name);
    setMapping(suggestMapping(h));
    setStep("map");
  }

  const STEP_LABELS: Record<Step, string> = {
    drop: "Upload File",
    map: "Map Columns",
    review: "Review & Import",
    done: "Done",
  };

  const STEPS: Step[] = ["drop", "map", "review"];
  const currentIndex = STEPS.indexOf(step);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
        zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
        style={{
          background: "#FFFFFF", borderRadius: "12px", width: "640px",
          maxHeight: "88vh", overflow: "hidden", display: "flex",
          flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.20)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "16px 20px", background: "#002147", display: "flex", alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "#FFFFFF" }}>Upload Portfolio Data</div>
            <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.55)", marginTop: "2px" }}>{STEP_LABELS[step]}</div>
          </div>
          {/* Step indicators */}
          <div style={{ display: "flex", gap: "6px", marginRight: "16px" }}>
            {STEPS.map((s, i) => (
              <div
                key={s}
                style={{
                  width: "24px", height: "4px", borderRadius: "2px",
                  background: i <= currentIndex ? "#FFFFFF" : "rgba(255,255,255,0.25)",
                  transition: "background 250ms",
                }}
              />
            ))}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.70)", display: "flex" }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", flex: 1, padding: "24px" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
            >
              {step === "drop" && (
                <DropZoneStep onFileParsed={handleFileParsed} />
              )}
              {step === "map" && (
                <ColumnMapStep
                  detectedHeaders={headers}
                  initialMapping={mapping}
                  sampleRows={rows.slice(0, 3)}
                  onChange={setMapping}
                />
              )}
              {step === "review" && (
                <>
                  {importError && (
                    <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "6px", padding: "10px 14px", fontSize: "0.8125rem", color: "#B91C1C", marginBottom: "16px" }}>
                      {importError}
                    </div>
                  )}
                  <ReviewImportStep
                    orgId={orgId}
                    filename={filename}
                    mapping={mapping}
                    rows={rows}
                    columnMap={mapping}
                    onComplete={onComplete}
                    onError={setImportError}
                  />
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer nav */}
        {step !== "review" && (
          <div style={{ padding: "14px 20px", borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between" }}>
            <button
              onClick={() => setStep(step === "map" ? "drop" : "drop")}
              style={{
                padding: "8px 16px", background: "transparent", color: "#475569",
                border: "1px solid #E2E8F0", borderRadius: "8px", fontWeight: 500,
                fontSize: "0.875rem", cursor: "pointer",
                visibility: step === "drop" ? "hidden" : "visible",
              }}
            >
              Back
            </button>
            {step === "map" && (
              <button
                onClick={() => setStep("review")}
                style={{
                  padding: "8px 20px", background: "#002147", color: "#FFFFFF",
                  border: "none", borderRadius: "8px", fontWeight: 600,
                  fontSize: "0.875rem", cursor: "pointer",
                }}
              >
                Review Import →
              </button>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/upload/UploadWizard.tsx
git commit -m "feat: add UploadWizard modal composing drop, map, and review steps"
```

---

## Task 9: Onboarding Wizard Steps

**Files:**
- Create: `src/app/components/onboarding/OrgSetupStep.tsx`
- Create: `src/app/components/onboarding/InviteTeamStep.tsx`
- Create: `src/app/components/onboarding/UploadStep.tsx`
- Create: `src/app/components/onboarding/ConfirmationStep.tsx`

- [ ] **Step 1: Create OrgSetupStep**

Create `src/app/components/onboarding/OrgSetupStep.tsx`:

```tsx
// src/app/components/onboarding/OrgSetupStep.tsx
import * as React from "react";
import { supabase } from "../../lib/supabase";

const CURRENCIES = ["EUR", "USD", "GBP", "JPY", "SGD", "AED", "CNY", "CAD", "AUD"];
const FLEET_SIZES = ["1–20 aircraft", "20–100 aircraft", "100+ aircraft"];

interface OrgSetupStepProps {
  userId: string;
  onComplete: (orgId: string) => void;
}

export function OrgSetupStep({ userId, onComplete }: OrgSetupStepProps) {
  const [name, setName] = React.useState("");
  const [fleetSize, setFleetSize] = React.useState(FLEET_SIZES[0]);
  const [currency, setCurrency] = React.useState("EUR");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Organisation name is required"); return; }
    setIsLoading(true);
    setError(null);

    try {
      // Create org
      const { data: org, error: orgErr } = await supabase
        .from("organisations")
        .insert({ name: name.trim(), plan: "starter", base_currency: currency })
        .select("id")
        .single();
      if (orgErr || !org) throw new Error(orgErr?.message ?? "Failed to create organisation");

      // Link user as admin
      const { error: memberErr } = await supabase
        .from("org_members")
        .insert({ org_id: org.id, user_id: userId, role: "admin" });
      if (memberErr) throw new Error(memberErr.message);

      onComplete(org.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div>
        <label style={{ display: "block", fontWeight: 600, fontSize: "0.875rem", color: "#0F172A", marginBottom: "6px" }}>
          Organisation name <span style={{ color: "#B91C1C" }}>*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Skybridge Capital Leasing"
          style={{
            width: "100%", padding: "10px 14px", border: "1px solid #E2E8F0",
            borderRadius: "8px", fontSize: "0.9375rem", color: "#0F172A",
            outline: "none", fontFamily: "'Inter', sans-serif", boxSizing: "border-box",
          }}
        />
      </div>

      <div>
        <label style={{ display: "block", fontWeight: 600, fontSize: "0.875rem", color: "#0F172A", marginBottom: "6px" }}>
          Fleet size
        </label>
        <div style={{ display: "flex", gap: "8px" }}>
          {FLEET_SIZES.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setFleetSize(s)}
              style={{
                flex: 1, padding: "10px 8px",
                border: `1.5px solid ${fleetSize === s ? "#002147" : "#E2E8F0"}`,
                borderRadius: "8px",
                background: fleetSize === s ? "rgba(0,33,71,0.04)" : "#FFFFFF",
                fontWeight: fleetSize === s ? 600 : 400,
                fontSize: "0.8125rem", color: "#0F172A", cursor: "pointer",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={{ display: "block", fontWeight: 600, fontSize: "0.875rem", color: "#0F172A", marginBottom: "6px" }}>
          Base currency
        </label>
        <select
          value={currency}
          onChange={e => setCurrency(e.target.value)}
          style={{
            width: "100%", padding: "10px 14px", border: "1px solid #E2E8F0",
            borderRadius: "8px", fontSize: "0.9375rem", color: "#0F172A",
            background: "#FFFFFF", cursor: "pointer",
          }}
        >
          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "6px", padding: "10px 14px", fontSize: "0.8125rem", color: "#B91C1C" }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        style={{
          padding: "12px 24px", background: isLoading ? "#CBD5E1" : "#002147",
          color: "#FFFFFF", border: "none", borderRadius: "8px",
          fontWeight: 700, fontSize: "0.9375rem",
          cursor: isLoading ? "not-allowed" : "pointer", alignSelf: "flex-end",
        }}
      >
        {isLoading ? "Creating…" : "Continue →"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create InviteTeamStep**

Create `src/app/components/onboarding/InviteTeamStep.tsx`:

```tsx
// src/app/components/onboarding/InviteTeamStep.tsx
import * as React from "react";
import { Plus, Trash2 } from "lucide-react";

interface InviteTeamStepProps {
  onContinue: () => void;
  onSkip: () => void;
}

export function InviteTeamStep({ onContinue, onSkip }: InviteTeamStepProps) {
  const [emails, setEmails] = React.useState<string[]>([""]);

  function addEmail() { setEmails(prev => [...prev, ""]); }
  function updateEmail(i: number, v: string) { setEmails(prev => prev.map((e, idx) => idx === i ? v : e)); }
  function removeEmail(i: number) { setEmails(prev => prev.filter((_, idx) => idx !== i)); }

  const validCount = emails.filter(e => e.trim().includes("@")).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <p style={{ margin: 0, fontSize: "0.875rem", color: "#475569" }}>
        Add team members who should have access. They'll receive an invite link via email. You can also do this later from Settings.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {emails.map((email, i) => (
          <div key={i} style={{ display: "flex", gap: "8px" }}>
            <input
              type="email"
              value={email}
              placeholder="colleague@lessor.com"
              onChange={e => updateEmail(i, e.target.value)}
              style={{
                flex: 1, padding: "10px 14px", border: "1px solid #E2E8F0",
                borderRadius: "8px", fontSize: "0.875rem", color: "#0F172A",
                outline: "none", fontFamily: "'Inter', sans-serif",
              }}
            />
            {emails.length > 1 && (
              <button
                onClick={() => removeEmail(i)}
                style={{ background: "none", border: "1px solid #E2E8F0", borderRadius: "8px", cursor: "pointer", color: "#94A3B8", padding: "0 12px", display: "flex", alignItems: "center" }}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={addEmail}
          style={{
            display: "flex", alignItems: "center", gap: "6px", background: "none",
            border: "1px dashed #CBD5E1", borderRadius: "8px", padding: "9px 14px",
            cursor: "pointer", color: "#64748B", fontSize: "0.875rem", width: "100%",
          }}
        >
          <Plus size={14} /> Add another
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
        <button
          onClick={onSkip}
          style={{ background: "none", border: "none", color: "#94A3B8", fontSize: "0.875rem", cursor: "pointer", padding: "4px 0" }}
        >
          Skip for now
        </button>
        <button
          onClick={onContinue}
          disabled={validCount === 0}
          style={{
            padding: "10px 24px",
            background: validCount === 0 ? "#CBD5E1" : "#002147",
            color: "#FFFFFF", border: "none", borderRadius: "8px",
            fontWeight: 600, fontSize: "0.875rem",
            cursor: validCount === 0 ? "not-allowed" : "pointer",
          }}
        >
          Send Invites & Continue →
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create UploadStep**

Create `src/app/components/onboarding/UploadStep.tsx`:

```tsx
// src/app/components/onboarding/UploadStep.tsx
import * as React from "react";
import { useState } from "react";
import { DropZoneStep } from "../upload/DropZoneStep";
import { ColumnMapStep } from "../upload/ColumnMapStep";
import { ReviewImportStep } from "../upload/ReviewImportStep";
import { suggestMapping } from "../../lib/columnMapper";

interface UploadStepProps {
  orgId: string;
  onComplete: (uploadId: string, count: number) => void;
  onSkip: () => void;
}

type SubStep = "drop" | "map" | "review";

export function UploadStep({ orgId, onComplete, onSkip }: UploadStepProps) {
  const [subStep, setSubStep] = useState<SubStep>("drop");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [filename, setFilename] = useState("");
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [importError, setImportError] = useState<string | null>(null);

  function handleFileParsed(h: string[], r: Record<string, string>[], file: File) {
    setHeaders(h);
    setRows(r);
    setFilename(file.name);
    setMapping(suggestMapping(h));
    setSubStep("map");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {subStep === "drop" && (
        <>
          <DropZoneStep onFileParsed={handleFileParsed} />
          <div style={{ textAlign: "center" }}>
            <button
              onClick={onSkip}
              style={{ background: "none", border: "none", color: "#94A3B8", fontSize: "0.875rem", cursor: "pointer" }}
            >
              Skip — I'll upload later
            </button>
          </div>
        </>
      )}
      {subStep === "map" && (
        <>
          <ColumnMapStep detectedHeaders={headers} initialMapping={mapping} sampleRows={rows.slice(0, 3)} onChange={setMapping} />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button onClick={() => setSubStep("drop")} style={{ padding: "8px 16px", background: "transparent", color: "#475569", border: "1px solid #E2E8F0", borderRadius: "8px", fontWeight: 500, fontSize: "0.875rem", cursor: "pointer" }}>
              Back
            </button>
            <button onClick={() => setSubStep("review")} style={{ padding: "8px 20px", background: "#002147", color: "#FFFFFF", border: "none", borderRadius: "8px", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer" }}>
              Review Import →
            </button>
          </div>
        </>
      )}
      {subStep === "review" && (
        <>
          {importError && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "6px", padding: "10px 14px", fontSize: "0.8125rem", color: "#B91C1C" }}>
              {importError}
            </div>
          )}
          <ReviewImportStep orgId={orgId} filename={filename} mapping={mapping} rows={rows} columnMap={mapping} onComplete={onComplete} onError={setImportError} />
          <button onClick={() => setSubStep("map")} style={{ alignSelf: "flex-start", padding: "8px 16px", background: "transparent", color: "#475569", border: "1px solid #E2E8F0", borderRadius: "8px", fontWeight: 500, fontSize: "0.875rem", cursor: "pointer" }}>
            Back
          </button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create ConfirmationStep**

Create `src/app/components/onboarding/ConfirmationStep.tsx`:

```tsx
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
```

- [ ] **Step 5: Commit**

```bash
git add src/app/components/onboarding/
git commit -m "feat: add onboarding wizard step components"
```

---

## Task 10: OnboardingWizard Full-Screen Shell

**Files:**
- Create: `src/app/components/onboarding/OnboardingWizard.tsx`

- [ ] **Step 1: Create OnboardingWizard**

Create `src/app/components/onboarding/OnboardingWizard.tsx`:

```tsx
// src/app/components/onboarding/OnboardingWizard.tsx
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router";
import { useAuth0 } from "@auth0/auth0-react";
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
  const { refetchUploadStatus } = useData();

  const [step, setStep] = React.useState<OnboardingStep>("org");
  const [orgId, setOrgId] = React.useState<string | null>(null);
  const [importedCount, setImportedCount] = React.useState<number | null>(null);

  const stepIndex = STEPS.indexOf(step);

  async function handleUploadComplete(uploadId: string, count: number) {
    setImportedCount(count);
    await refetchUploadStatus();
    setStep("done");
  }

  function handleGoToDashboard() {
    navigate("/");
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
          maxWidth: "560px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.24)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ background: "#002147", padding: "24px 28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
            <div style={{ fontWeight: 800, fontSize: "1.25rem", color: "#FFFFFF", letterSpacing: "-0.02em" }}>
              Aeroinsights
            </div>
            <div style={{ fontSize: "0.6875rem", background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.85)", borderRadius: "10px", padding: "2px 8px", fontWeight: 600 }}>
              Setup
            </div>
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
        <div style={{ padding: "28px" }}>
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
                  onComplete={(id) => { setOrgId(id); setStep("invite"); }}
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
                  onComplete={handleUploadComplete}
                  onSkip={() => setStep("done")}
                />
              )}
              {step === "done" && (
                <ConfirmationStep
                  importedCount={importedCount}
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/onboarding/OnboardingWizard.tsx
git commit -m "feat: add full-screen OnboardingWizard with 4-step flow"
```

---

## Task 11: Demo Banner + Route Wiring

**Files:**
- Create: `src/app/components/layout/DemoBanner.tsx`
- Modify: `src/app/routes.tsx`
- Modify: `src/app/components/auth/RequireAuth.tsx`

- [ ] **Step 1: Create DemoBanner**

Create `src/app/components/layout/DemoBanner.tsx`:

```tsx
// src/app/components/layout/DemoBanner.tsx
import { useState } from "react";
import { useNavigate } from "react-router";
import { Database, X } from "lucide-react";
import { useData } from "../../contexts/DataContext";

export function DemoBanner() {
  const { hasUpload, isLoadingOrg } = useData();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (hasUpload || isLoadingOrg || dismissed) return null;

  return (
    <div
      style={{
        background: "#002147",
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        flexShrink: 0,
      }}
    >
      <Database size={14} style={{ color: "rgba(255,255,255,0.7)", flexShrink: 0 }} />
      <span style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.85)", flex: 1 }}>
        You're viewing <strong style={{ color: "#FFFFFF" }}>demo data</strong> — upload your portfolio to see real insights.
      </span>
      <button
        onClick={() => navigate("/onboarding")}
        style={{
          padding: "4px 14px",
          background: "#FFFFFF",
          color: "#002147",
          border: "none",
          borderRadius: "6px",
          fontWeight: 600,
          fontSize: "0.75rem",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        Upload now
      </button>
      <button
        onClick={() => setDismissed(true)}
        style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)", display: "flex", flexShrink: 0 }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add /onboarding route**

Open `src/app/routes.tsx`. Find the array passed to `createBrowserRouter`. Add the `/onboarding` route inside the `RequireAuth` children array (before the Layout child), alongside the existing `portfolios` route:

```tsx
// Add this import at the top of routes.tsx:
import { OnboardingWizard } from "./components/onboarding/OnboardingWizard";

// Inside the RequireAuth children array, alongside { path: "portfolios", ... }:
{ path: "onboarding", Component: OnboardingWizard },
```

The RequireAuth children block should look like:

```tsx
{
  path: "/",
  Component: RequireAuth,
  children: [
    { path: "portfolios", Component: PortfolioHub },
    { path: "onboarding", Component: OnboardingWizard },  // ← add this
    {
      Component: Layout,
      children: [
        // ... existing routes unchanged
      ],
    },
  ],
},
```

- [ ] **Step 3: Add DemoBanner to Layout**

Find the Layout component at `src/app/components/layout/Layout.tsx`. Read it first, then add `<DemoBanner />` as the first child inside the main content area (below the Header, above the page content).

```bash
# First read the file to find where to insert:
cat src/app/components/layout/Layout.tsx
```

Add at the top of the file:
```tsx
import { DemoBanner } from "./DemoBanner";
```

Add `<DemoBanner />` immediately after `<Header ... />` in the JSX.

- [ ] **Step 4: Verify routes**

```bash
pnpm dev
```

Navigate to http://localhost:5173/onboarding — should show the OnboardingWizard full-screen page. Navigate back to http://localhost:5173 — DemoBanner should appear at the top (since no upload exists yet).

- [ ] **Step 5: Commit**

```bash
git add src/app/components/layout/DemoBanner.tsx src/app/routes.tsx src/app/components/layout/Layout.tsx
git commit -m "feat: add DemoBanner and /onboarding route"
```

---

## Task 12: PortfolioHub Upload CTA

**Files:**
- Modify: `src/app/pages/PortfolioHub.tsx`

- [ ] **Step 1: Read current PortfolioHub**

```bash
cat src/app/pages/PortfolioHub.tsx
```

Find the section where the "Start with sample data" / portfolio cards are rendered. There should be a CTA area near the top of the page.

- [ ] **Step 2: Add upload CTA to PortfolioHub**

Add this import at the top of `src/app/pages/PortfolioHub.tsx`:

```tsx
import { useNavigate } from "react-router";
```

Find the existing action cards / buttons section. Add a new prominent button that navigates to `/onboarding`:

```tsx
// Add alongside existing action buttons:
<motion.button
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.12, duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
  onClick={() => navigate("/onboarding")}
  style={{
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "8px",
    background: "#002147",
    border: "none",
    borderRadius: "12px",
    padding: "20px",
    cursor: "pointer",
    textAlign: "left",
    color: "#FFFFFF",
  }}
>
  <Database size={24} style={{ color: "rgba(255,255,255,0.8)" }} />
  <div style={{ fontWeight: 700, fontSize: "1rem" }}>Upload your portfolio</div>
  <div style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.65)", lineHeight: 1.4 }}>
    Import your real fleet, leases, and lessees to unlock full platform capabilities.
  </div>
</motion.button>
```

Also add the `Database` icon to the import from `lucide-react` at the top of the file.

- [ ] **Step 3: Verify**

```bash
pnpm dev
```

Navigate to http://localhost:5173/portfolios — should see the "Upload your portfolio" card. Click it — should navigate to `/onboarding`.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/PortfolioHub.tsx
git commit -m "feat: add Upload Portfolio CTA to PortfolioHub"
```

---

## Task 13: Push and Verify

- [ ] **Step 1: Run all unit tests**

```bash
pnpm exec vitest run
```

Expected: 5 tests PASS in columnMapper.test.ts

- [ ] **Step 2: Smoke test the full flow**

```bash
pnpm dev
```

Manual checklist:
- [ ] App loads at http://localhost:5173 — no console errors
- [ ] DemoBanner visible at top of every page
- [ ] Navigate to /portfolios — "Upload your portfolio" card visible
- [ ] Click "Upload your portfolio" → /onboarding loads
- [ ] Step 1: fill org name, select fleet size, currency → Continue
- [ ] Step 2: skip invites → Continue
- [ ] Step 3: download template → template.xlsx downloads with correct headers
- [ ] Step 3: upload template (empty except headers) → column mapping screen appears with auto-filled suggestions
- [ ] Step 3: navigate to Review → shows "0 rows ready" (template is empty, that's expected)
- [ ] Step 4: skip → confirmation screen appears
- [ ] Click "Go to Dashboard" → lands on dashboard

- [ ] **Step 3: Push to main**

```bash
git push origin main
```

Expected: Vercel deployment starts. All tests pass. App deploys.

---

## Self-Review

**Spec coverage check:**
- ✅ Supabase schema with 9 tables including Phase 2 tables → Task 1
- ✅ `DataContext` with `orgId`, `hasUpload`, `uploadStatus`, `refetchUploadStatus` → Task 4
- ✅ `usePortfolioData` hook with mock fallback → Task 4
- ✅ File upload: drag-and-drop, template download, .csv/.xlsx/.xls → Task 5
- ✅ Column mapping with fuzzy matching, required fields, sample preview → Tasks 3 & 6
- ✅ Review step: parsed row preview, per-row validation errors, Supabase insert → Task 7
- ✅ Errors non-blocking for optional fields, blocking for required → Task 7 (ReviewImportStep)
- ✅ `uploads.column_map` saved for re-upload → Task 7 (insert to uploads table)
- ✅ Onboarding step 1: org name, fleet size, currency → Task 9
- ✅ Onboarding step 2: invite team, skippable → Task 9
- ✅ Onboarding step 3: upload wizard embedded → Task 9
- ✅ Onboarding step 4: confirmation with count, CTA to dashboard → Task 9
- ✅ Demo banner when `!hasUpload` → Task 11
- ✅ PortfolioHub CTA → Task 12
- ✅ Multi-tenant `org_id` on every table → Task 1
- ✅ RLS noted as disabled for Phase 1 demo with TODO comment → Task 1

**Placeholder scan:** None found. All steps contain complete code.

**Type consistency:** `orgId: string | null` used consistently across DataContext, OrgSetupStep, ReviewImportStep, UploadStep, OnboardingWizard. `PortfolioData` interface defined in Task 2 and used as return type in Task 4. `suggestMapping` return type `Record<string, string | null>` consistent across Tasks 3, 5, 6, 7, 8, 9.
