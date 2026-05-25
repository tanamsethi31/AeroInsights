// src/app/hooks/useScenarioRuns.ts
//
// T-3.1 — scenario_runs persistence.
//
// Reads every persisted run for the active portfolio and exposes an
// `insertRun()` writer that the Custom Builder + Library handlers call after
// each run completes. RunHistory tab consumes `runs` directly — no more
// in-memory state, no more localStorage round-trip, no more dead runs on
// refresh.
//
// Why the hook owns the (run → row) shape:
//   The DB stores normalised columns (mode, seed, run_at) plus two JSONB
//   blobs (inputs, result). The UI works with a denormalised
//   ScenarioRunResult shape that bundles everything together. The hook
//   bridges both directions so callers never touch snake_case.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../contexts/DataContext";
import { usePortfolio } from "../contexts/PortfolioContext";
import type { ScenarioRunResult, ShapleyDriver } from "../components/scenarios/RunResultPanel";
import type { ScenarioInputs } from "../utils/eclCalculator";

// ─── DB row shape (mirror migration 20260525120000) ─────────────────────────

interface ScenarioRunRow {
  id:              string;
  org_id:          string;
  portfolio_id:    string;
  run_code:        string;
  scenario_id:     string | null;
  name:            string;
  mode:            "deterministic" | "montecarlo";
  paths:           number | null;
  seed:            number;
  inputs:          unknown;
  result:          unknown;
  parent_run_id:   string | null;
  run_at:          string;
  run_by:          string;
}

// Bundle written into `result` JSONB. Keeps the shape contained so future
// schema-level columns can be promoted without breaking historical rows.
interface ResultBlob {
  durationSec:  string;
  ecl:          number;
  p5:           number | null;
  p95:          number | null;
  s1:           number;
  s2:           number;
  s3:           number;
  shapley:      ShapleyDriver[];
  keyFinding:   string;
  scenarioHash: string;
  topLessees:   ScenarioRunResult["topLessees"];
  s3LeaseCount: number;
  engine?:      string;
}

// ─── Row ↔ ScenarioRunResult mapping ───────────────────────────────────────

function rowToResult(row: ScenarioRunRow, codeToUuid: Map<string, string>): ScenarioRunResult {
  const result = (row.result ?? {}) as ResultBlob;
  // Parent display id: rows store FK uuid, UI works with run_code. Translate
  // via the reverse map we build from the current batch.
  let parentDisplay: string | undefined;
  if (row.parent_run_id) {
    parentDisplay = codeToUuid.get(row.parent_run_id);
  }
  return {
    id:           row.run_code,
    templateId:   row.scenario_id,
    name:         row.name,
    mode:         row.mode,
    paths:        row.paths,
    seed:         row.seed,
    runDate:      formatRunDate(row.run_at),
    durationSec:  result.durationSec ?? "—",
    ecl:          result.ecl ?? 0,
    p5:           result.p5 ?? null,
    p95:          result.p95 ?? null,
    s1:           result.s1 ?? 0,
    s2:           result.s2 ?? 0,
    s3:           result.s3 ?? 0,
    shapley:      result.shapley ?? [],
    keyFinding:   result.keyFinding ?? "",
    scenarioHash: result.scenarioHash ?? "",
    topLessees:   result.topLessees ?? [],
    s3LeaseCount: result.s3LeaseCount ?? 0,
    parentId:     parentDisplay,
  };
}

// Format an ISO timestamp the same way the in-memory code did so the table
// looks identical to the previous render.
function formatRunDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).replace(",", "");
  } catch {
    return iso;
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export interface InsertRunArgs {
  /** UI display id (e.g. RUN-2026-0042). MUST be unique within (org, portfolio). */
  runCode:     string;
  scenarioId:  string | null;
  name:        string;
  mode:        "deterministic" | "montecarlo";
  paths:       number | null;
  seed:        number;
  inputs:      ScenarioInputs;
  result:      ResultBlob;
  /** Display id of the parent run (run_code), translated to uuid before insert. */
  parentRunCode?: string | null;
}

export interface UseScenarioRunsResult {
  runs:      ScenarioRunResult[];
  loading:   boolean;
  error:     string | null;
  /** Returns the freshly-inserted UI ScenarioRunResult, or null on failure. */
  insertRun: (args: InsertRunArgs) => Promise<ScenarioRunResult | null>;
  refetch:   () => Promise<void>;
  /** True iff at least one persisted row exists for the active portfolio. */
  hasIngested: boolean;
}

export function useScenarioRuns(): UseScenarioRunsResult {
  const { orgId } = useData();
  const { activePortfolioId } = usePortfolio();

  const [rows,    setRows]    = useState<ScenarioRunRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const fetchOnce = useCallback(async () => {
    if (!orgId || !activePortfolioId) { setRows([]); return; }
    setLoading(true); setError(null);
    try {
      const { data, error: e } = await supabase
        .from("scenario_runs")
        .select("*")
        .eq("org_id", orgId)
        .eq("portfolio_id", activePortfolioId)
        .order("run_at", { ascending: false })
        .limit(200);
      if (e) throw e;
      setRows((data ?? []) as ScenarioRunRow[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [orgId, activePortfolioId]);

  useEffect(() => { fetchOnce(); }, [fetchOnce]);

  const insertRun = useCallback(async (args: InsertRunArgs): Promise<ScenarioRunResult | null> => {
    if (!orgId || !activePortfolioId) {
      setError("No active portfolio — cannot persist run.");
      return null;
    }
    // Translate parent display id → uuid (parent must be present in the
    // current batch — we only persist 200 rows, and clone/branch always
    // references a recent run).
    let parentUuid: string | null = null;
    if (args.parentRunCode) {
      const parentRow = rows.find(r => r.run_code === args.parentRunCode);
      parentUuid = parentRow?.id ?? null;
    }
    const insertPayload = {
      org_id:        orgId,
      portfolio_id:  activePortfolioId,
      run_code:      args.runCode,
      scenario_id:   args.scenarioId,
      name:          args.name,
      mode:          args.mode,
      paths:         args.paths,
      seed:          args.seed,
      inputs:        args.inputs,
      result:        args.result,
      parent_run_id: parentUuid,
    };
    const { data, error: e } = await supabase
      .from("scenario_runs")
      .insert(insertPayload)
      .select("*")
      .single();
    if (e) { setError(e.message); return null; }
    const newRow = data as ScenarioRunRow;
    // Optimistic insert at the top so the UI updates synchronously.
    setRows((prev) => [newRow, ...prev]);
    const codeToUuid = new Map<string, string>();
    for (const r of [newRow, ...rows]) codeToUuid.set(r.id, r.run_code);
    return rowToResult(newRow, codeToUuid);
  }, [orgId, activePortfolioId, rows]);

  // Build (uuid → run_code) lookup once per fetch so parent translation is O(1).
  const codeToUuid = new Map<string, string>();
  for (const r of rows) codeToUuid.set(r.id, r.run_code);

  return {
    runs:        rows.map((r) => rowToResult(r, codeToUuid)),
    loading,
    error,
    insertRun,
    refetch:     fetchOnce,
    hasIngested: rows.length > 0,
  };
}
