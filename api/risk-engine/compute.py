"""
api/risk-engine/compute.py — Per-lease IFRS-9 ECL Vercel Function.

Sibling to api/scenarios/run.py, NOT a replacement. The two functions
serve different jobs:

    api/scenarios/run.py    — macro scenario engine. Takes a scalar
                              portfolio baseline ($47.2M demo) and
                              applies macro shocks via NumPy MC.

    api/risk-engine/compute.py (this file) — *builds* the baseline by
                              reading the live Supabase portfolio for
                              an org and running per-lease PD × LGD × EAD.

The frontend will eventually feed this function's `total_ecl` output
into the scenarios engine as `baseECL`.

Request (POST, application/json):
    {
      "org_id":       "uuid",          (required)
      "persist":      false,           (optional, default false)
      "period_label": "2026-Q2",       (required iff persist=true)
      "locked_by":    "user@x.com"     (optional, default "unknown")
    }

Response: see ./README.md for the full shape.

GET → health probe. Reports SUPABASE_URL presence without leaking the value.

Auth (interim): the function trusts the `X-Org-Id` header and the org_id in
the body — they must agree. The frontend is expected to set both after Auth0
sign-in. RLS-backed JWT forwarding lands with T-4.1; the marker `# TODO(T-4.1)`
below flags every place that changes when that work happens.
"""
from __future__ import annotations

import json
import os
import time
from http.server import BaseHTTPRequestHandler
from typing import Any

# engine.py is pure / no I/O — always safe to import.
from engine import compute_portfolio_ecl

# supabase_client.py imports the supabase package lazily — importing the
# module itself is cheap even if the package isn't installed.
from supabase_client import (
    SnapshotWriteError,
    SupabaseConfigError,
    fetch_portfolio,
    write_snapshot,
)

ENGINE_NAME = "python-numpy-supabase"


# ───────────────────────────────────────────────────────────────────────────────
# Request validation
# ───────────────────────────────────────────────────────────────────────────────

def _validate_request(payload: dict, headers_org_id: str | None) -> tuple[dict, str | None]:
    """Returns (normalised_payload, error_message_or_None)."""
    if not isinstance(payload, dict):
        return {}, "Body must be a JSON object."

    org_id = payload.get("org_id") or headers_org_id
    if not org_id:
        return {}, "org_id is required (body field or X-Org-Id header)."

    # TODO(T-4.1): once Auth0 JWTs forward through, verify the JWT's `org_id`
    # claim matches both the header and body. For now we trust the caller.
    if headers_org_id and payload.get("org_id") and headers_org_id != payload["org_id"]:
        return {}, "X-Org-Id header and body org_id disagree."

    persist = bool(payload.get("persist", False))
    period_label = payload.get("period_label") or ""
    locked_by = payload.get("locked_by") or "unknown"

    if persist and not period_label:
        return {}, "period_label is required when persist=true."

    return {
        "org_id":       org_id,
        "persist":      persist,
        "period_label": period_label,
        "locked_by":    locked_by,
    }, None


# ───────────────────────────────────────────────────────────────────────────────
# Core orchestration — also unit-testable
# ───────────────────────────────────────────────────────────────────────────────

def compute(payload: dict, headers_org_id: str | None = None) -> tuple[int, dict[str, Any]]:
    """Returns (http_status, response_body)."""
    normalised, err = _validate_request(payload, headers_org_id)
    if err is not None:
        return 400, {"error": err}

    start = time.perf_counter()

    try:
        portfolio = fetch_portfolio(normalised["org_id"])
    except SupabaseConfigError as exc:
        return 500, {"error": f"Supabase not configured: {exc}"}
    except Exception as exc:  # network / API errors
        return 502, {"error": f"Supabase read failed: {exc}"}

    aggregates = compute_portfolio_ecl(
        leases     = portfolio["leases"],
        lessees    = portfolio["lessees"],
        assets     = portfolio["assets"],
        provisions = portfolio["provisions"],
        pd_curves  = portfolio["pd_curve_overrides"],
        lgd_override = _pick_lgd_override(portfolio["lgd_recovery_overrides"]),
    )

    snapshot_id: str | None = None
    if normalised["persist"]:
        snap_payload = {
            "aggregates":       aggregates,
            "ecl_rows":         aggregates["ecl_rows"],
            # The fields below mirror the snapshot table's JSONB columns. The
            # risk engine doesn't apply scenario overlays itself, so these are
            # empty placeholders — the scenarios engine fills them on lock.
            "scenario_inputs":  {},
            "weights":          {"base": 1.0},
            "scenario_summary": {"engine": ENGINE_NAME},
            "weighted":         {"total_ecl": aggregates["total_ecl"]},
            "sicr_config":      {},
            "currency":         "USD",
        }
        try:
            snapshot_id = write_snapshot(
                org_id       = normalised["org_id"],
                period_label = normalised["period_label"],
                locked_by    = normalised["locked_by"],
                payload      = snap_payload,
            )
        except SnapshotWriteError as exc:
            return 409, {"error": str(exc), "snapshot_id": None}
        except SupabaseConfigError as exc:
            return 500, {"error": f"Supabase not configured: {exc}"}

    duration_ms = (time.perf_counter() - start) * 1000

    return 200, {
        "engine":       ENGINE_NAME,
        "org_id":       normalised["org_id"],
        "lease_count":  aggregates["lease_count"],
        "total_ecl":    aggregates["total_ecl"],
        "ecl_12m":      aggregates["ecl_12m"],
        "stage1_ecl":   aggregates["stage1_ecl"],
        "stage2_ecl":   aggregates["stage2_ecl"],
        "stage3_ecl":   aggregates["stage3_ecl"],
        "coverage_pct": aggregates["coverage_pct"],
        "book_value":   aggregates["book_value"],
        "ecl_rows":     aggregates["ecl_rows"],
        "duration_ms":  round(duration_ms, 2),
        "snapshot_id":  snapshot_id,
    }


def _pick_lgd_override(rows: list[dict]) -> float | None:
    """Pick the most recent recovery_factor override for the org, or None."""
    if not rows:
        return None
    latest = sorted(
        rows,
        key=lambda r: r.get("updated_at") or "",
        reverse=True,
    )[0]
    rf = latest.get("recovery_factor")
    try:
        return float(rf) if rf is not None else None
    except (TypeError, ValueError):
        return None


# ───────────────────────────────────────────────────────────────────────────────
# HTTP handler — Vercel Python Function entry point
# ───────────────────────────────────────────────────────────────────────────────

class handler(BaseHTTPRequestHandler):  # noqa: N801 — Vercel requires lowercase
    def _send_json(self, status: int, body: dict) -> None:
        encoded = json.dumps(body, default=str).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_POST(self) -> None:  # noqa: N802
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length <= 0:
                self._send_json(400, {"error": "Empty request body."})
                return
            raw = self.rfile.read(length)
            payload = json.loads(raw.decode())
        except json.JSONDecodeError as exc:
            self._send_json(400, {"error": f"Invalid JSON: {exc}"})
            return
        except Exception as exc:  # pragma: no cover — defensive
            self._send_json(400, {"error": f"Cannot read body: {exc}"})
            return

        headers_org_id = self.headers.get("X-Org-Id")
        status, body = compute(payload, headers_org_id=headers_org_id)
        self._send_json(status, body)

    def do_GET(self) -> None:  # noqa: N802
        # Health probe — never 500 on missing env vars.
        if not os.environ.get("SUPABASE_URL"):
            self._send_json(200, {
                "ok": False, "engine": ENGINE_NAME,
                "reason": "SUPABASE_URL not set",
            })
            return
        if not (
            os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
            or os.environ.get("SUPABASE_ANON_KEY")
        ):
            self._send_json(200, {
                "ok": False, "engine": ENGINE_NAME,
                "reason": "SUPABASE_SERVICE_ROLE_KEY not set",
            })
            return
        self._send_json(200, {"ok": True, "engine": ENGINE_NAME})
