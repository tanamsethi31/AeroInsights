"""
api/risk-engine/engine.py — Pure per-lease IFRS-9 ECL compute.

This module is intentionally I/O-free. It takes Python primitives in,
returns Python primitives out, so it can be unit-tested without any
network or database dependency.

It is the per-lease counterpart to api/scenarios/run.py — the latter
applies macro shocks to a portfolio-level *baseline*; this module
*builds* that baseline from per-lease PD × LGD × EAD.

Math:
    EAD_usd  = monthly_rental * remaining_months
    PD       = lookup_or_interpolate(segment_curve, tenor_years)
    LGD      = 1 - recovery_factor    (default recovery = 0.45 → LGD = 0.55)
    ECL_usd  = PD * LGD * EAD_usd

Stage assignment follows the lease's `stage` field when present (1/2/3),
or falls back to provisions.stage (latest reporting_date), or 1.

The `drivers` dict on every per-lease row makes it explicit where each
input came from. This is the audit trail surface that T-3.4 will
eventually consume.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any

# ───────────────────────────────────────────────────────────────────────────────
# Defaults
# ───────────────────────────────────────────────────────────────────────────────

DEFAULT_RECOVERY_FACTOR = 0.45   # → LGD = 0.55, aviation industry baseline
DEFAULT_LGD = 1.0 - DEFAULT_RECOVERY_FACTOR

# Aviation default PD curves by carrier segment (annualised PDs at standard
# tenor points). Calibrated from public credit data; matches the segment
# bucketing used in the lessees.carrier_segment column.
# Each curve is interpolated linearly between tenor points; lifetime PD is
# applied for tenors > 5y.
DEFAULT_PD_CURVES: dict[str, dict[str, float]] = {
    "network":  {"pd1yr": 0.0085, "pd2yr": 0.0165, "pd3yr": 0.0240,
                 "pd5yr": 0.0380, "pd_lifetime": 0.0750},
    "lcc":      {"pd1yr": 0.0135, "pd2yr": 0.0260, "pd3yr": 0.0375,
                 "pd5yr": 0.0590, "pd_lifetime": 0.1100},
    "regional": {"pd1yr": 0.0195, "pd2yr": 0.0375, "pd3yr": 0.0540,
                 "pd5yr": 0.0840, "pd_lifetime": 0.1500},
    "charter":  {"pd1yr": 0.0265, "pd2yr": 0.0500, "pd3yr": 0.0720,
                 "pd5yr": 0.1100, "pd_lifetime": 0.1850},
}

# Tenor anchors used by the interpolator. Lifetime is treated as 10y for
# interpolation purposes (anything ≥ 5y uses the 5y→lifetime slope to 10y,
# then clamps to lifetime).
_TENOR_POINTS = (
    (1.0,  "pd1yr"),
    (2.0,  "pd2yr"),
    (3.0,  "pd3yr"),
    (5.0,  "pd5yr"),
    (10.0, "pd_lifetime"),
)


# ───────────────────────────────────────────────────────────────────────────────
# PD curve interpolation
# ───────────────────────────────────────────────────────────────────────────────

def default_pd_for_segment(segment: str | None, tenor_years: float) -> float:
    """
    Linearly interpolate the default PD curve for a segment at the given tenor.

    `segment` may be one of network / lcc / regional / charter; anything else
    (including None) falls back to the LCC curve (median aviation risk).
    Tenors ≤ 1y use pd1yr; tenors ≥ 10y use pd_lifetime. Strictly monotonic
    non-decreasing in tenor by construction.
    """
    curve_key = segment if segment in DEFAULT_PD_CURVES else "lcc"
    curve = DEFAULT_PD_CURVES[curve_key]
    return _interpolate_pd_curve(curve, tenor_years)


def _interpolate_pd_curve(curve: dict[str, float], tenor_years: float) -> float:
    """Linear interpolation between the 5 tenor anchors of a PD curve dict."""
    t = max(0.0, float(tenor_years))
    if t <= _TENOR_POINTS[0][0]:
        return float(curve[_TENOR_POINTS[0][1]])
    if t >= _TENOR_POINTS[-1][0]:
        return float(curve[_TENOR_POINTS[-1][1]])
    for (t_lo, k_lo), (t_hi, k_hi) in zip(_TENOR_POINTS, _TENOR_POINTS[1:]):
        if t_lo <= t <= t_hi:
            v_lo = float(curve[k_lo])
            v_hi = float(curve[k_hi])
            frac = (t - t_lo) / (t_hi - t_lo)
            return v_lo + frac * (v_hi - v_lo)
    return float(curve["pd_lifetime"])  # pragma: no cover — unreachable


# ───────────────────────────────────────────────────────────────────────────────
# Helpers
# ───────────────────────────────────────────────────────────────────────────────

def _coerce_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
        except ValueError:
            try:
                return date.fromisoformat(value[:10])
            except ValueError:
                return None
    return None


def _months_between(start: date, end: date) -> int:
    """Whole calendar months between two dates, never negative."""
    if end <= start:
        return 0
    return max(0, (end.year - start.year) * 12 + (end.month - start.month))


def _resolve_stage(lease: dict, provisions_for_lease: list[dict] | None) -> int:
    """Stage 1/2/3 — leases.stage wins; fallback to latest provision; default 1."""
    s = lease.get("stage")
    if isinstance(s, int) and s in (1, 2, 3):
        return s
    if provisions_for_lease:
        # Pick the provision with the latest reporting_date.
        sorted_provs = sorted(
            provisions_for_lease,
            key=lambda p: _coerce_date(p.get("reporting_date")) or date.min,
            reverse=True,
        )
        for p in sorted_provs:
            ps = p.get("stage")
            if isinstance(ps, int) and ps in (1, 2, 3):
                return ps
    return 1


# ───────────────────────────────────────────────────────────────────────────────
# Per-lease ECL
# ───────────────────────────────────────────────────────────────────────────────

def compute_lease_ecl(
    lease: dict,
    lessee: dict | None,
    asset: dict | None,
    pd_curve: dict | None,
    lgd_override: float | None,
    provisions_for_lease: list[dict] | None = None,
    valuation_date: date | None = None,
) -> dict:
    """
    Compute one lease's IFRS-9 ECL contribution.

    `pd_curve`     — pd_curve_overrides row for this lessee's segment (or None).
    `lgd_override` — recovery_factor from lgd_recovery_overrides (or None).
    Returns a row dict with PD, LGD, EAD, ECL, stage, and a `drivers` audit
    sub-dict explaining each input's provenance.
    """
    today = valuation_date or date.today()

    # ── Remaining months / EAD ────────────────────────────────────────────────
    end_date = _coerce_date(lease.get("end_date"))
    start_date = _coerce_date(lease.get("start_date"))
    if end_date is None:
        remaining_months = 0
        ead_source = "no_end_date"
    elif end_date <= today:
        remaining_months = 0
        ead_source = "lease_ended"
    else:
        remaining_months = _months_between(today, end_date)
        ead_source = "from_end_date"

    monthly_rental = lease.get("monthly_rental")
    try:
        monthly_rental = float(monthly_rental) if monthly_rental is not None else 0.0
    except (TypeError, ValueError):
        monthly_rental = 0.0

    ead_usd = monthly_rental * remaining_months

    # ── Tenor for PD lookup ───────────────────────────────────────────────────
    # Use original lease tenor (start→end) — it's what the segment PD curve was
    # calibrated against. Remaining tenor would understate PD for fresh leases.
    if start_date and end_date and end_date > start_date:
        tenor_years = _months_between(start_date, end_date) / 12.0
    elif remaining_months:
        tenor_years = remaining_months / 12.0
    else:
        tenor_years = 1.0
    tenor_source = "lease_start_to_end" if (start_date and end_date) else "remaining_only"

    # ── PD ────────────────────────────────────────────────────────────────────
    segment = (lessee or {}).get("carrier_segment")
    if pd_curve is not None:
        pd = _interpolate_pd_curve(pd_curve, tenor_years)
        pd_source = f"pd_curve_overrides.{pd_curve.get('segment', segment or 'unknown')}"
    else:
        pd = default_pd_for_segment(segment, tenor_years)
        seg_used = segment if segment in DEFAULT_PD_CURVES else "lcc"
        pd_source = f"default_{seg_used}"

    # ── LGD ───────────────────────────────────────────────────────────────────
    if lgd_override is not None:
        try:
            recovery = float(lgd_override)
            lgd = max(0.0, min(1.0, 1.0 - recovery))
            lgd_source = "lgd_recovery_overrides"
        except (TypeError, ValueError):
            lgd = DEFAULT_LGD
            lgd_source = "default_invalid_override"
    else:
        lgd = DEFAULT_LGD
        lgd_source = "default_aviation_55"

    # ── Stage ─────────────────────────────────────────────────────────────────
    stage = _resolve_stage(lease, provisions_for_lease)
    if isinstance(lease.get("stage"), int):
        stage_source = "leases.stage"
    elif provisions_for_lease:
        stage_source = "provisions.stage_latest"
    else:
        stage_source = "default_stage_1"

    # ── ECL ───────────────────────────────────────────────────────────────────
    # Stage 1: 12-month PD; Stage 2/3: lifetime PD already implicit in the
    # tenor-driven lookup. For Stage 1 we cap PD at the 1y point.
    if stage == 1 and pd_curve is not None:
        pd_used = _interpolate_pd_curve(pd_curve, 1.0)
    elif stage == 1:
        pd_used = default_pd_for_segment(segment, 1.0)
    else:
        pd_used = pd

    ecl_usd = pd_used * lgd * ead_usd

    return {
        "lease_id": lease.get("id"),
        "asset_id": lease.get("asset_id"),
        "lessee_id": lease.get("lessee_id"),
        "registration": (asset or {}).get("registration"),
        "msn": (asset or {}).get("msn"),
        "lessee_name": (lessee or {}).get("name"),
        "segment": segment,
        "stage": stage,
        "tenor_years": round(tenor_years, 4),
        "remaining_months": remaining_months,
        "monthly_rental": monthly_rental,
        "pd": round(float(pd_used), 8),
        "lgd": round(float(lgd), 6),
        "ead_usd": round(ead_usd, 2),
        "ecl_usd": round(ecl_usd, 2),
        "drivers": {
            "pd_source": pd_source,
            "pd_at_lifetime_tenor": round(float(pd), 8),
            "lgd_source": lgd_source,
            "stage_source": stage_source,
            "ead_source": ead_source,
            "tenor_source": tenor_source,
        },
    }


# ───────────────────────────────────────────────────────────────────────────────
# Portfolio aggregate
# ───────────────────────────────────────────────────────────────────────────────

def compute_portfolio_ecl(
    leases: list[dict],
    lessees: list[dict],
    assets: list[dict],
    provisions: list[dict],
    pd_curves: list[dict],
    lgd_override: float | None,
    valuation_date: date | None = None,
) -> dict:
    """
    Build per-lease rows + portfolio-level aggregates.

    Inputs are the raw lists fetched from Supabase (or constructed in tests).
    Output shape matches the response contract documented in compute.py.
    """
    lessees_by_id = {l["id"]: l for l in lessees if l.get("id") is not None}
    assets_by_id  = {a["id"]: a for a in assets  if a.get("id") is not None}

    pd_curves_by_segment: dict[str, dict] = {}
    for row in pd_curves or []:
        seg = row.get("segment")
        if seg:
            pd_curves_by_segment[seg] = row

    provisions_by_lease: dict[Any, list[dict]] = {}
    for p in provisions or []:
        lid = p.get("lease_id")
        if lid is not None:
            provisions_by_lease.setdefault(lid, []).append(p)

    ecl_rows: list[dict] = []
    stage_totals = {1: 0.0, 2: 0.0, 3: 0.0}
    book_value = 0.0

    for lease in leases or []:
        lessee = lessees_by_id.get(lease.get("lessee_id"))
        asset  = assets_by_id.get(lease.get("asset_id"))
        segment = (lessee or {}).get("carrier_segment")
        pd_curve = pd_curves_by_segment.get(segment) if segment else None
        provs_for_lease = provisions_by_lease.get(lease.get("id"))

        row = compute_lease_ecl(
            lease=lease,
            lessee=lessee,
            asset=asset,
            pd_curve=pd_curve,
            lgd_override=lgd_override,
            provisions_for_lease=provs_for_lease,
            valuation_date=valuation_date,
        )
        ecl_rows.append(row)
        stage_totals[row["stage"]] += row["ecl_usd"]
        book_value += row["ead_usd"]

    total_ecl = stage_totals[1] + stage_totals[2] + stage_totals[3]
    ecl_12m = stage_totals[1]   # 12-month ECL — Stage 1 only by IFRS-9
    coverage_pct = (total_ecl / book_value * 100.0) if book_value > 0 else 0.0

    return {
        "ecl_rows":     ecl_rows,
        "stage1_ecl":   round(stage_totals[1], 2),
        "stage2_ecl":   round(stage_totals[2], 2),
        "stage3_ecl":   round(stage_totals[3], 2),
        "total_ecl":    round(total_ecl, 2),
        "ecl_12m":      round(ecl_12m, 2),
        "coverage_pct": round(coverage_pct, 4),
        "book_value":   round(book_value, 2),
        "lease_count":  len(ecl_rows),
    }
