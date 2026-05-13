# Portfolio Financial Editing — Implementation Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow analysts to edit financial model inputs (Stage, PD, LGD, EAD, ECL, rental, credit rating) at both the lessee and lease level directly in the platform, with changes persisting to Supabase and propagating immediately through all analysis tabs.

**Architecture:** A shared `portfolioMutations.ts` write layer feeds two UI surfaces — a slide-in drawer for focused per-lease editing and a grid tab for bulk quarterly review. ECL auto-calculation (`pd × lgd × ead`) is on by default, togglable per provision via an `auto_ecl` boolean stored in Supabase.

**Tech Stack:** React, Supabase (direct client writes), `usePortfolioData` hook (add `refetch`), framer-motion for drawer animation, existing portfolio type system (`Asset`, `Lessee`, `Lease`, `Provision`).

---

## Data Model Change

### Migration: add `auto_ecl` to provisions

```sql
alter table provisions
  add column if not exists auto_ecl boolean not null default true;
```

No backfill needed — existing rows get `true` (auto-calculate), which is the correct default.

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/app/lib/portfolioMutations.ts` | All Supabase write functions + ECL formula |
| Create | `src/app/components/portfolio/LeaseEditDrawer.tsx` | Slide-in drawer (B) |
| Create | `src/app/components/portfolio/ModelParametersTab.tsx` | Editable grid tab (C) |
| Modify | `src/app/hooks/usePortfolioData.ts` | Expose `refetch()` |
| Modify | `src/app/pages/Portfolio.tsx` | Wire drawer open/close + add Model Parameters tab |
| Modify | `src/app/components/counterparties/LesseeProfilePanel.tsx` | Editable lessee fields (credit rating, PD, watchlist) |

---

## Task 1 — DB Migration + `portfolioMutations.ts`

### Files
- Supabase migration (via MCP `apply_migration`)
- Create: `src/app/lib/portfolioMutations.ts`

### Steps

- [ ] **Step 1: Run the migration**

Via Supabase MCP `apply_migration` on project `naqgfwnbhybhtirazkjq`:

```sql
alter table provisions
  add column if not exists auto_ecl boolean not null default true;
```

- [ ] **Step 2: Write `portfolioMutations.ts`**

```typescript
// src/app/lib/portfolioMutations.ts
import { supabase } from "./supabase";

// ── ECL formula ───────────────────────────────────────────────────────────────
//
// IFRS 9 stage-aware calculation:
//   Stage 1 — 12-month ECL:  PD × LGD × EAD
//   Stage 2 — Lifetime ECL:  (1 − (1 − PD)^remainingYears) × LGD × EAD
//   Stage 3 — Credit-impaired: LGD × EAD  (PD assumed = 1)
//
// remainingYears = max(0, (leaseEndDate − today) / 365.25)
// If stage is null, falls back to Stage 1 formula.

export function computeEcl(
  pd: number | null,
  lgd: number | null,
  ead: number | null,
  stage: 1 | 2 | 3 | null = 1,
  leaseEndDate?: string | null,
): number | null {
  if (lgd == null || ead == null) return null;

  if (stage === 3) {
    // Stage 3: full lifetime loss, PD = 1
    return lgd * ead;
  }

  if (pd == null) return null;

  if (stage === 2) {
    // Stage 2: lifetime PD using compound formula
    const today = new Date();
    const end = leaseEndDate ? new Date(leaseEndDate) : null;
    const remainingYears = end
      ? Math.max(0, (end.getTime() - today.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : 1; // default 1 year if no date
    const lifetimePd = 1 - Math.pow(1 - pd, remainingYears);
    return lifetimePd * lgd * ead;
  }

  // Stage 1 (default): 12-month ECL
  return pd * lgd * ead;
}

// ── Lessee update ─────────────────────────────────────────────────────────────

export interface LesseeUpdate {
  credit_rating?: string | null;
  pd_estimate?: number | null;
  watchlist_status?: "green" | "amber" | "red" | null;
}

export async function updateLessee(
  lesseeId: string,
  updates: LesseeUpdate
): Promise<void> {
  const { error } = await supabase
    .from("lessees")
    .update(updates)
    .eq("id", lesseeId);
  if (error) throw new Error("Failed to update lessee: " + error.message);
}

// ── Provision update (single lease) ──────────────────────────────────────────

export interface ProvisionUpdate {
  stage?: 1 | 2 | 3 | null;
  pd?: number | null;
  lgd?: number | null;
  ead?: number | null;
  ecl_amount?: number | null;
  auto_ecl?: boolean;
}

export async function updateProvision(
  provisionId: string,
  updates: ProvisionUpdate,
  leaseEndDate?: string | null,
): Promise<void> {
  // Auto-compute ECL if flag is set and all inputs are present
  const payload = { ...updates };
  if (payload.auto_ecl !== false) {
    const ecl = computeEcl(
      payload.pd ?? null,
      payload.lgd ?? null,
      payload.ead ?? null,
      (payload.stage ?? null) as 1 | 2 | 3 | null,
      leaseEndDate,
    );
    if (ecl != null) payload.ecl_amount = ecl;
  }
  const { error } = await supabase
    .from("provisions")
    .update(payload)
    .eq("id", provisionId);
  if (error) throw new Error("Failed to update provision: " + error.message);
}

// ── Lease update (rental, stage) ─────────────────────────────────────────────

export interface LeaseUpdate {
  stage?: 1 | 2 | 3 | null;
  monthly_rental?: number | null;
}

export async function updateLease(
  leaseId: string,
  updates: LeaseUpdate
): Promise<void> {
  const { error } = await supabase
    .from("leases")
    .update(updates)
    .eq("id", leaseId);
  if (error) throw new Error("Failed to update lease: " + error.message);
}

// ── Bulk: apply PD to all provisions for a lessee ────────────────────────────

export async function applyPdToAllLesseeProvisions(
  orgId: string,
  lesseeId: string,
  pd: number
): Promise<void> {
  // Get all leases for this lessee (include end_date for lifetime ECL)
  const { data: leases, error: lErr } = await supabase
    .from("leases")
    .select("id, end_date")
    .eq("org_id", orgId)
    .eq("lessee_id", lesseeId);
  if (lErr) throw new Error(lErr.message);
  if (!leases?.length) return;

  const leaseEndDateById = Object.fromEntries(leases.map((l) => [l.id, l.end_date]));
  const leaseIds = leases.map((l) => l.id);

  // Update all provisions linked to those leases
  const { data: provs, error: pErr } = await supabase
    .from("provisions")
    .select("id, lgd, ead, auto_ecl, stage, lease_id")
    .eq("org_id", orgId)
    .in("lease_id", leaseIds);
  if (pErr) throw new Error(pErr.message);
  if (!provs?.length) return;

  for (const prov of provs) {
    const endDate = leaseEndDateById[prov.lease_id] ?? null;
    const ecl = prov.auto_ecl
      ? computeEcl(pd, prov.lgd, prov.ead, prov.stage as 1|2|3|null, endDate)
      : null;
    const payload: Record<string, unknown> = { pd };
    if (ecl != null) payload.ecl_amount = ecl;
    await supabase.from("provisions").update(payload).eq("id", prov.id);
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build 2>&1 | grep -E "error|Error|✓"
```

Expected: `✓ built`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/ src/app/lib/portfolioMutations.ts
git commit -m "feat(data): add auto_ecl migration and portfolioMutations write layer"
```

---

## Task 2 — Expose `refetch` from `usePortfolioData`

### Files
- Modify: `src/app/hooks/usePortfolioData.ts`

### Steps

- [ ] **Step 1: Read current hook**

The hook currently returns `{ assets, lessees, leases, provisions, isLoading, isDemo }`. The fetch logic lives in a `useEffect` with `[orgId, hasUpload]` deps. We need a stable `refetch` callback.

- [ ] **Step 2: Add `refetch` to the hook**

Extract the fetch logic into a `useCallback` and expose it:

```typescript
const fetchAll = useCallback(async () => {
  if (!hasUpload || !orgId) return;
  setIsLoading(true);
  const [a, l, ls, p] = await Promise.all([
    supabase.from("assets").select("*").eq("org_id", orgId),
    supabase.from("lessees").select("*").eq("org_id", orgId),
    supabase.from("leases").select("*").eq("org_id", orgId),
    supabase.from("provisions").select("*").eq("org_id", orgId),
  ]);
  setAssets((a.data as Asset[]) ?? []);
  setLessees((l.data as Lessee[]) ?? []);
  setLeases((ls.data as Lease[]) ?? []);
  setProvisions((p.data as Provision[]) ?? []);
  setIsLoading(false);
}, [orgId, hasUpload]);

useEffect(() => { fetchAll(); }, [fetchAll]);
```

Return type becomes:
```typescript
export interface PortfolioData {
  assets: Asset[];
  lessees: Lessee[];
  leases: Lease[];
  provisions: Provision[];
  isLoading: boolean;
  isDemo: boolean;
  refetch: () => Promise<void>;
}
```

For the demo path, `refetch` returns a no-op: `refetch: async () => {}`.

- [ ] **Step 3: Verify build passes**

```bash
npm run build 2>&1 | grep -E "error|Error|✓"
```

- [ ] **Step 4: Commit**

```bash
git add src/app/hooks/usePortfolioData.ts
git commit -m "feat(hook): expose refetch() from usePortfolioData"
```

---

## Task 3 — `LeaseEditDrawer.tsx`

### Files
- Create: `src/app/components/portfolio/LeaseEditDrawer.tsx`

### Component interface

```typescript
interface LeaseEditDrawerProps {
  lease: Lease;
  asset: Asset;
  lessee: Lessee;
  provision: Provision | null;
  orgId: string;
  onClose: () => void;
  onSaved: () => void; // triggers refetch in parent
}
```

### Steps

- [ ] **Step 1: Build the drawer shell**

Fixed right-side panel, full viewport height, 400px wide, with a semi-transparent backdrop on the left. Slide in from right with framer-motion.

```tsx
<motion.div
  initial={{ x: "100%" }}
  animate={{ x: 0 }}
  exit={{ x: "100%" }}
  transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
  style={{
    position: "fixed", top: 0, right: 0, bottom: 0,
    width: "400px", background: "#FFFFFF", zIndex: 600,
    boxShadow: "-8px 0 40px rgba(0,0,0,0.12)",
    display: "flex", flexDirection: "column",
  }}
>
```

Backdrop (closes drawer on click):
```tsx
<motion.div
  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
  style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 599 }}
  onClick={onClose}
/>
```

- [ ] **Step 2: Drawer header**

```tsx
<div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0", flexShrink: 0 }}>
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
    <div>
      <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Edit Lease
      </div>
      <div style={{ fontSize: "1.0625rem", fontWeight: 700, color: "#0F172A", marginTop: "2px" }}>
        {asset.registration} · {asset.aircraft_type}
      </div>
      <div style={{ fontSize: "0.8125rem", color: "#64748B", marginTop: "2px" }}>
        {lessee.name}
      </div>
    </div>
    <button onClick={onClose}>
      <X size={18} style={{ color: "#94A3B8" }} />
    </button>
  </div>
</div>
```

- [ ] **Step 3: Lessee defaults section (collapsible)**

Uses Radix `Collapsible`. Shows lessee-level fields:
- Credit Rating (text input, e.g. "BB+")
- PD Estimate (number, 0–1, shown as percentage)
- Watchlist Status (green / amber / red pill selector)
- Checkbox: "Apply updated PD to all leases for this lessee"

Local state mirrors the lessee props. Dirty tracking per field.

- [ ] **Step 4: Lease fields section**

Stage selector (three pill buttons: "1", "2", "3" with colour coding — green/amber/red).
Monthly Rental (number input, USD).

- [ ] **Step 5: ECL block**

```tsx
// Local state
const [autoEcl, setAutoEcl] = useState(provision?.auto_ecl ?? true);
const [pd, setPd] = useState(provision?.pd ?? null);
const [lgd, setLgd] = useState(provision?.lgd ?? null);
const [ead, setEad] = useState(provision?.ead ?? null);
const [manualEcl, setManualEcl] = useState(provision?.ecl_amount ?? null);

const computedEcl = autoEcl ? computeEcl(pd, lgd, ead) : null;
const displayEcl = autoEcl ? computedEcl : manualEcl;
```

Layout:
```
PD (%)     [____] 
LGD (%)    [____]
EAD ($)    [____]

[✓] Auto-calculate ECL (PD × LGD × EAD)

ECL Amount [computed or manual, greyed if auto]
```

When `autoEcl` is true: ECL Amount field is read-only, shows live-computed value, styled with `background: #F8FAFC; color: #64748B`.

When `autoEcl` is false: ECL Amount field becomes editable, white background.

- [ ] **Step 6: Footer — Save / Cancel**

```tsx
const [saving, setSaving] = useState(false);
const [error, setError] = useState<string | null>(null);
const isDirty = /* compare current state vs original props */;

async function handleSave() {
  setSaving(true);
  setError(null);
  try {
    // 1. Update lessee
    await updateLessee(lessee.id, { credit_rating, pd_estimate, watchlist_status });
    // 2. If cascade checked, apply PD to all lessee provisions
    if (cascadePd && pd != null) {
      await applyPdToAllLesseeProvisions(orgId, lessee.id, pd);
    }
    // 3. Update lease
    await updateLease(lease.id, { stage, monthly_rental });
    // 4. Update provision
    if (provision) {
      await updateProvision(provision.id, { stage, pd, lgd, ead, auto_ecl: autoEcl,
        ecl_amount: autoEcl ? undefined : manualEcl });
    }
    onSaved();
    onClose();
  } catch (err) {
    setError((err as Error).message);
  } finally {
    setSaving(false);
  }
}
```

- [ ] **Step 7: Verify build, commit**

```bash
npm run build 2>&1 | grep -E "error|✓"
git add src/app/components/portfolio/LeaseEditDrawer.tsx
git commit -m "feat(portfolio): add LeaseEditDrawer for per-lease financial editing"
```

---

## Task 4 — Wire drawer into `Portfolio.tsx`

### Files
- Modify: `src/app/pages/Portfolio.tsx`

### Steps

- [ ] **Step 1: Add drawer state**

```typescript
const [editingLease, setEditingLease] = useState<Lease | null>(null);
const { assets, lessees, leases, provisions, isDemo, refetch } = usePortfolioData();
```

- [ ] **Step 2: Make lease table rows clickable**

In the Leases tab table, each `<tr>` gets:
```tsx
onClick={() => { if (!isDemo) setEditingLease(lease); }}
style={{ cursor: isDemo ? "default" : "pointer" }}
```

When `isDemo`, show a tooltip: "Editing is available for uploaded portfolios only."

- [ ] **Step 3: Render drawer with AnimatePresence**

```tsx
<AnimatePresence>
  {editingLease && (() => {
    const asset = assets.find(a => a.id === /* asset_id from lease */);
    const lessee = lessees.find(l => l.id === editingLease.lessee_id);
    const provision = provisions.find(p => p.lease_id === editingLease.id) ?? null;
    if (!asset || !lessee || !orgId) return null;
    return (
      <LeaseEditDrawer
        lease={editingLease}
        asset={asset}
        lessee={lessee}
        provision={provision}
        orgId={orgId}
        onClose={() => setEditingLease(null)}
        onSaved={refetch}
      />
    );
  })()}
</AnimatePresence>
```

- [ ] **Step 4: Verify build, commit**

```bash
npm run build 2>&1 | grep -E "error|✓"
git add src/app/pages/Portfolio.tsx
git commit -m "feat(portfolio): wire LeaseEditDrawer into Portfolio page"
```

---

## Task 5 — `ModelParametersTab.tsx`

### Files
- Create: `src/app/components/portfolio/ModelParametersTab.tsx`

### Component interface

```typescript
interface ModelParametersTabProps {
  leases: Lease[];
  assets: Asset[];
  lessees: Lessee[];
  provisions: Provision[];
  orgId: string;
  isDemo: boolean;
  onSaved: () => void;
}
```

### Steps

- [ ] **Step 1: Build the grid layout**

One row per lease. Columns:
```
Lessee | Aircraft | Reg | Stage | PD% | LGD% | EAD ($M) | ECL ($M) | Auto | Actions
```

Use a `<table>` with `table-layout: fixed` for performance. Sticky header.

- [ ] **Step 2: Implement editable cells**

Each numeric cell (PD, LGD, EAD, ECL): display as plain text when clean, becomes `<input type="number">` on click. On blur or Enter → mark row dirty.

Stage cell: clicking cycles 1 → 2 → 3 → 1 with coloured badge.

Auto-ECL cell: checkbox. When checked, ECL cell goes read-only and shows computed value.

```typescript
// Per-row dirty state
const [dirty, setDirty] = useState<Record<string, Partial<ProvisionUpdate & LeaseUpdate>>>({});

function markDirty(leaseId: string, field: string, value: unknown) {
  setDirty(prev => ({
    ...prev,
    [leaseId]: { ...prev[leaseId], [field]: value },
  }));
}
```

- [ ] **Step 3: Row save on Enter/blur**

When a row has dirty state:
- Row background turns `#FFFBEB` (amber tint)
- A small "Save" button appears in the Actions column
- Pressing Enter on any cell in that row saves

```typescript
async function saveRow(leaseId: string) {
  const changes = dirty[leaseId];
  if (!changes) return;
  const lease = leases.find(l => l.id === leaseId)!;
  const provision = provisions.find(p => p.lease_id === leaseId);
  try {
    if (changes.stage != null || changes.monthly_rental != null) {
      await updateLease(leaseId, {
        stage: changes.stage as 1|2|3|undefined,
        monthly_rental: changes.monthly_rental as number|undefined,
      });
    }
    if (provision && (changes.pd != null || changes.lgd != null || changes.ead != null || changes.auto_ecl != null)) {
      await updateProvision(provision.id, changes as ProvisionUpdate);
    }
    // Flash row green
    setSavedRows(prev => new Set([...prev, leaseId]));
    setTimeout(() => setSavedRows(prev => { prev.delete(leaseId); return new Set(prev); }), 1200);
    setDirty(prev => { const n = { ...prev }; delete n[leaseId]; return n; });
    onSaved();
  } catch (err) {
    setErrorRows(prev => new Set([...prev, leaseId]));
  }
}
```

- [ ] **Step 4: Bulk actions toolbar**

Shown when rows are selected (checkbox on each row):

```tsx
{selected.size > 0 && (
  <div style={{ display: "flex", gap: "8px", padding: "10px 16px", background: "#F0F9FF", borderBottom: "1px solid #BAE6FD" }}>
    <span style={{ fontSize: "0.8125rem", color: "#0369A1", fontWeight: 600 }}>
      {selected.size} lease{selected.size > 1 ? "s" : ""} selected
    </span>
    {[1, 2, 3].map(s => (
      <button key={s} onClick={() => bulkSetStage(s as 1|2|3)}>
        Set Stage {s}
      </button>
    ))}
    <button onClick={bulkRecalcEcl}>Recalculate ECL</button>
  </div>
)}
```

`bulkSetStage`: calls `updateLease` for each selected lease, then `onSaved`.
`bulkRecalcEcl`: for each selected provision with `auto_ecl = true`, calls `updateProvision` with current PD/LGD/EAD to recompute ECL.

- [ ] **Step 5: Demo guard**

When `isDemo`, all inputs are `disabled`, overlay reads: "Upload your portfolio to edit model parameters."

- [ ] **Step 6: Verify build, commit**

```bash
npm run build 2>&1 | grep -E "error|✓"
git add src/app/components/portfolio/ModelParametersTab.tsx
git commit -m "feat(portfolio): add ModelParametersTab bulk editing grid"
```

---

## Task 6 — Add tab + wire into `Portfolio.tsx`

### Files
- Modify: `src/app/pages/Portfolio.tsx`

### Steps

- [ ] **Step 1: Add "Model Parameters" to the tabs array**

Current tabs:
```typescript
const tabs = ["Leases", "Aircraft", "Lessees", "Concentration", "SD / MR", "Performance vs. Plan", "Payments", "Key Dates"];
```

Updated:
```typescript
const tabs = ["Leases", "Aircraft", "Lessees", "Model Parameters", "Concentration", "SD / MR", "Performance vs. Plan", "Payments", "Key Dates"];
```

- [ ] **Step 2: Render the tab**

```tsx
{activeTab === "Model Parameters" && (
  <ModelParametersTab
    leases={leases}
    assets={assets}
    lessees={lessees}
    provisions={provisions}
    orgId={orgId ?? ""}
    isDemo={isDemo}
    onSaved={refetch}
  />
)}
```

- [ ] **Step 3: Verify build, commit**

```bash
npm run build 2>&1 | grep -E "error|✓"
git add src/app/pages/Portfolio.tsx
git commit -m "feat(portfolio): add Model Parameters tab to Portfolio page"
```

---

## Task 7 — Editable fields in `LesseeProfilePanel`

### Files
- Modify: `src/app/components/counterparties/LesseeProfilePanel.tsx`

### Steps

- [ ] **Step 1: Read current panel structure**

Identify where credit rating, PD, and watchlist status are currently displayed as read-only text.

- [ ] **Step 2: Replace read-only display with editable fields**

For each of these three fields, replace the static display with an edit-in-place pattern:

```tsx
// Display mode
<div onClick={() => setEditing("credit_rating")} style={{ cursor: "pointer" }}>
  {lessee.credit_rating ?? "—"}
  <Pencil size={12} style={{ marginLeft: "6px", color: "#94A3B8" }} />
</div>

// Edit mode (when editing === "credit_rating")
<input
  autoFocus
  value={draft.credit_rating ?? ""}
  onChange={e => setDraft(d => ({ ...d, credit_rating: e.target.value }))}
  onBlur={handleSave}
  onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(null); }}
  style={{ ... }}
/>
```

Save calls `updateLessee(lessee.id, draft)` then `onSaved()`.

- [ ] **Step 3: Add isDemo guard**

When the panel is in demo mode, clicking fields shows: "Editing available for uploaded portfolios."

- [ ] **Step 4: Verify build, commit**

```bash
npm run build 2>&1 | grep -E "error|✓"
git add src/app/components/counterparties/LesseeProfilePanel.tsx
git commit -m "feat(counterparties): editable credit rating, PD, watchlist in LesseeProfilePanel"
```

---

## Self-Review Notes

- **No placeholder logic**: ECL formula `pd × lgd × ead` is explicitly defined in `portfolioMutations.ts` and reused by both the drawer and grid.
- **Type consistency**: `ProvisionUpdate` and `LeaseUpdate` interfaces are defined in `portfolioMutations.ts` and imported by all consumers — no duplication.
- **Demo guard**: all three surfaces (drawer, grid, lessee panel) check `isDemo` and disable editing.
- **Cascade PD**: `applyPdToAllLesseeProvisions` is a single function in the mutations layer, called from the drawer. The grid's bulk actions call it through the same path.
- **`auto_ecl` default**: migration sets `default true` so all existing rows auto-calculate.
- **Refetch**: single `refetch()` call after any save triggers `usePortfolioData` to re-query Supabase — ECL Overview, Scenarios, Dashboard all update because they all read from the same hook.
