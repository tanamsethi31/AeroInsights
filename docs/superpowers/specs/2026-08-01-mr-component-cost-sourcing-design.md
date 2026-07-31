# MR Component Cost Sourcing — Design

**Goal:** Give MR component cost figures real, checkable provenance. Two additive pieces: (1) cite a real, named external source for the heuristic fallback tier instead of a vague caption, and (2) let a user upload an actual MRO invoice/quote and have an AI-assisted extraction pre-fill the existing per-lease override and org-benchmark forms, instead of typing figures in from scratch. Together these answer the SkyWorks demo objection directly — "is this linked to a real source, or manually entered?" — without depending on a live external data API, which research confirmed doesn't exist for free.

**Architecture:** Two independent, additive pieces that share nothing except UI real estate in the existing cost-override panel:
1. **Sourced heuristic** — a metadata-only change to `maintenanceHeuristics.ts` plus a UI caption update. No new infrastructure.
2. **Invoice upload + AI extraction** — a new Supabase Storage bucket, a new Node-runtime serverless API route reusing the existing `resolveAiUpstreams()` AI Gateway resolver, a new nullable column on both `mr_cost_overrides` and `org_cost_benchmarks`, and a new upload affordance inside the existing "Component cost overrides" panel in `MaintenanceForecastTab.tsx`.

Nothing in this design changes `buildProjections()`'s calculation logic or its 3-tier resolution order (override → benchmark → heuristic) — this is entirely about how each tier's number gets *entered* and *cited*, not how it's *used*.

**Tech Stack:** Existing stack (React/TS, Supabase Storage + Postgres, Vercel serverless functions, Auth0-gated AI routes). One new dependency: `pdf-parse` (Node-only PDF text extraction — the standard, widely-used package for this).

---

## Research finding (grounds this design)

No free, publicly-queryable API for aircraft component maintenance costs exists. IATA's Maintenance Cost data eXchange (MCX, formerly MCTF) and MRO SmartHub both require being a contributing member airline — there's no public query endpoint. IATA does publish a free annual public-version executive report (FY2024 MCX Executive Report), but it's an image-heavy PDF, not a queryable dataset, and reports fleet-wide trends rather than per-component-per-aircraft-type dollar figures. This confirms: the heuristic tier stays a static reference table, but gets a real citation instead of no citation.

## Scope

- **In scope:** heuristic citation metadata + UI display; invoice/quote upload for both `mr_cost_overrides` (per-lease) and `org_cost_benchmarks` (org-wide); AI-assisted field extraction with mandatory human review before save; evidence document storage + retrieval (signed URL); graceful fallback to today's manual-entry flow when extraction fails or isn't attempted.
- **Out of scope (explicitly deferred):**
  - OCR/vision-model support for scanned or photographed invoices. The configured AI providers (`Cerebras Llama 3.3 70B`, `Groq Llama 3.3 70B`) are text-only; only the lower-priority `Gemini`/Gateway paths are vision-capable and the code comments note Gemini is "rarely used (prepay snags)." This pass only supports born-digital, text-extractable PDFs.
  - A live external market-data API integration — confirmed none exists for free.
  - Retroactively requiring evidence on existing overrides/benchmarks — this is purely additive; anything saved before this ships keeps working exactly as it does today, with `evidence_storage_path = null`.
  - Auto-saving AI-extracted figures without human confirmation — extraction only pre-fills draft form fields.

---

## 1. Sourced Heuristic Citation

**File:** `src/app/data/maintenanceHeuristics.ts`

Add a citation constant near the top of the file, replacing the plain header comment:

```typescript
export const HEURISTIC_SOURCE_CITATION = {
  label:    "IATA Maintenance Cost data eXchange (MCX) FY2024 public report + IAWG published ranges",
  url:      "https://www.iata.org/contentassets/bf8ca67c8bcd4358b3d004b0d6d0916f/fy2024-mcx-report_public.pdf",
  asOfDate: "2026-01-26", // MCX FY2024 public report publication date
};
```

**File:** `src/app/components/portfolio/MaintenanceForecastTab.tsx`

Replace the existing static caption text (currently: `"Source: IATA MCTF / IAWG heuristic · per-component overrides shown above when evidenced · Cirium adapter in Phase 3"`) with one that reads from `HEURISTIC_SOURCE_CITATION`, links to the report URL, and shows the as-of date, e.g.:

```
Source: IATA MCX FY2024 public report + IAWG ranges (as of 26 Jan 2026) · per-component overrides shown above when evidenced · Cirium adapter in Phase 3
```

The source label text becomes a link (`<a href={HEURISTIC_SOURCE_CITATION.url} target="_blank">`) opening the actual PDF report — so a skeptical viewer can click through and verify it's a real, currently-published document, not an invented citation.

No other file changes for this piece. No new tests needed — this is a display-only change (existing snapshot/rendering tests, if any, get updated to match).

---

## 2. MRO Invoice Upload + AI Extraction

### Storage

New Supabase Storage bucket: `mr-evidence`.

Path convention (mirrors `useReportExports.ts`'s `reports` bucket pattern): `${orgId}/${leaseIdOrAircraftType}/${component}/${Date.now()}-${filename}`.

New migration creates the bucket and RLS-equivalent storage policies scoped by `org_id`, following the same policy shape as the existing `reports` bucket lockdown in `20260525170100_phase4_storage_lockdown.sql` — read this file directly when implementing to copy the exact policy syntax rather than re-deriving it.

### Database

New migration, two `alter table` statements:

```sql
alter table mr_cost_overrides add column if not exists evidence_storage_path text;
alter table org_cost_benchmarks add column if not exists evidence_storage_path text;
```

Both nullable. No backfill, no default. No RLS changes needed — the new column is covered by each table's existing row-level policies.

### API Route

**File:** `api/ai/parse-mr-invoice.ts` (new)

Mirrors `api/ai/narrative.ts`'s structure and auth gate (Auth0 bearer token via `verifyAuth0Sub`, same rate-limit check via `checkAndIncrementAiLimits`, same `resolveAiUpstreams()` provider chain) — copy that file's auth/rate-limit block verbatim rather than reinventing it.

**Key difference from `narrative.ts`:** runs on `nodejs` runtime, not `edge` — `pdf-parse` needs Node APIs unavailable on edge. This exact runtime choice has precedent in this codebase: `api/admin/delete-org.ts` and `api/cron/scheduled-reports.ts` both already use `export const config = { runtime: "nodejs" };` for the same reason (Node-only dependencies).

**Request:** `POST { storagePath: string }` — the path of a file already uploaded to the `mr-evidence` bucket by the client.

**Server-side flow:**
1. Auth + rate-limit gate (as above).
2. Download the file from Supabase Storage using the service-role client (server-side only — never expose the service key to the browser).
3. Run `pdf-parse` on the downloaded bytes to extract raw text. If extraction yields no usable text (empty/whitespace-only, or the file isn't a PDF), return `{ error: "No extractable text found. This may be a scanned image — enter figures manually below.", code: "NO_TEXT_EXTRACTED" }` with HTTP 200 (not an error status — this is an expected, handled outcome, not a server fault).
4. Send the extracted text to the AI Gateway (`resolveAiUpstreams()`) with a structured-extraction system prompt: ask for strict JSON matching `{ suggestions: Array<{ component: string; costUSD: number; currency: string; quoteDate: string | null; vendor: string | null }> }`, where `component` must be one of the five known component names (`"Airframe HSI" | "Engine PR" | "LLPs" | "Landing Gear" | "APU"`).
5. Parse and validate the AI's JSON response with a small pure function (see Testing below) — reject/drop any suggestion with a negative or zero cost, an unrecognized component name, or malformed JSON. If validation yields zero usable suggestions, return `{ suggestions: [], code: "NO_MATCHES_FOUND" }` (HTTP 200) — again, an expected outcome, not an error.
6. Return `{ suggestions: [...] }` on success.

### Client UI

**File:** `src/app/components/portfolio/MaintenanceForecastTab.tsx` (per-lease override panel) and the org-benchmark admin UI added in MOD-Task 13 (same component-cost-input pattern, same panel treatment).

Inside the existing "Component cost overrides (optional)" collapsible section, add above the manual number inputs:

- A file input: "Upload invoice or quote (optional, PDF)".
- On file select:
  1. Immediately upload the raw file to the `mr-evidence` bucket (client-side, mirrors `useReportExports.ts`'s upload call) and capture the resulting `storagePath`.
  2. Show a loading indicator ("Reading document…") and POST `{ storagePath }` to `/api/ai/parse-mr-invoice`.
  3. On success with suggestions: for each returned `{component, costUSD}`, pre-fill that component's cost-override input **only if the field is currently empty** — never overwrite a value the user already typed or a previously-saved override. Show a small inline note next to each pre-filled field: "from uploaded document — review before saving."
  4. On `NO_TEXT_EXTRACTED` or `NO_MATCHES_FOUND` or any network/AI failure: show the file as attached ("Document attached — couldn't auto-read figures, enter manually below") but leave all inputs exactly as they were. The upload itself is never wasted — `storagePath` is still carried forward to be saved as `evidence_storage_path` even if extraction failed, so a human reviewer can later open the actual document.
- When the user clicks **Save**, `evidence_storage_path` (if a file was uploaded this session) is included in the `mr_cost_overrides`/`org_cost_benchmarks` upsert alongside `cost_usd` and `note`.
- Wherever an override/benchmark is already displayed with its existing badge/tooltip (from MR-Task 4 / MOD-Task 13), add: if `evidence_storage_path` is set, show a small "📎 Evidence" link that calls `getDownloadUrl`-equivalent (signed URL, mirrors `useReportExports.ts`'s `getDownloadUrl`) and opens the original document in a new tab.

### Error Handling

- Unsupported file type (not `.pdf`) — rejected client-side before any upload, with a clear inline message. (Scope note: PDF-only for this pass; no image formats, since there's no OCR path to make an image useful.)
- File too large — apply a reasonable client-side cap (10 MB) matching typical invoice PDF sizes, reject with a clear message before upload.
- Storage upload failure — show an error, do not proceed to the parse call, manual entry remains fully available.
- `NO_TEXT_EXTRACTED` / `NO_MATCHES_FOUND` / AI provider failure — all treated as expected, non-blocking outcomes per the Client UI flow above. **Never blocks Save.** A user can always type numbers by hand exactly as they do today, with or without an attached document.
- Malformed AI JSON — caught and validated server-side (see API Route step 5); never surfaces a raw parsing exception to the client, always resolves to `NO_MATCHES_FOUND`.

### Testing

- **Unit tests** (new, e.g. `src/app/lib/mrInvoiceExtraction.test.ts`) for the pure validation/parsing function from API Route step 5: given a raw AI response string, verify it correctly extracts well-typed suggestions, and correctly rejects/drops: malformed JSON, negative costs, zero costs, unrecognized component names, and missing required fields. This function takes a string in and returns validated suggestions out — no network calls, no Supabase, fully testable in isolation.
- **No test** for the live `pdf-parse` call or the live AI network call itself — matches this codebase's existing convention (`api/ai/narrative.ts` has no test file; API routes that are thin network wrappers around external services aren't unit-tested here, confirmed by checking for `narrative.test.ts` — none exists).
- **Manual end-to-end verification** (documented as a checklist in the implementation plan, run after code review, same pattern as MR-Task 5): upload a real sample MRO-quote-style PDF and confirm fields pre-fill correctly; confirm the evidence badge appears after Save; confirm the signed-URL link reopens the correct document; confirm uploading a non-PDF or an image-only PDF falls back gracefully without blocking manual entry; confirm an existing override saved before this feature shipped still displays and edits correctly with `evidence_storage_path = null`.

---

## Explicitly Not Doing

- No OCR or vision-model support for scanned/photographed invoices in this pass.
- No live external market-data API — confirmed none exists for free; the heuristic tier stays a cited static reference table, not a live feed.
- No auto-save of AI-extracted figures — always requires human review and an explicit Save click.
- No retroactive evidence requirement on existing overrides/benchmarks.
- No changes to `buildProjections()`'s calculation logic, the 3-tier resolution order, or any shared calc-engine file.
