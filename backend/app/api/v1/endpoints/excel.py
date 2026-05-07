"""
excel.py — Aerinsights Excel Add-in API endpoints
──────────────────────────────────────────────────────────────────────────────
Mounted at  /api/v1/excel/  (see router.py)
All 20 endpoints required by the AER.* custom functions plus a /ping health
check used by the task pane's connection status indicator.

Auth:
  All endpoints use get_current_user (same middleware as all other routes).
  The /ping endpoint uses the same guard — a 401 from ping tells the task
  pane "not signed in".

Data layer:
  Responses are mocked with realistic values matching the six-aircraft
  demo portfolio. Each function is marked with a TODO comment showing
  where to wire the real database / ECL engine query.

Rate limiting:
  Apply a dedicated slowapi / AWS WAF rate-limit rule to the /api/v1/excel/
  path group before go-live (e.g. 200 req / min per tenant).
"""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.auth import get_current_user
from app.models import User

router = APIRouter()

# ─── Mock data ────────────────────────────────────────────────────────────────
# Consistent with the six-aircraft demo portfolio used throughout the platform.
# TODO: replace each lookup with real database / ECL engine queries.

_ECL: dict[str, dict[str, float]] = {
    "LSE-2019-001": {"Baseline": 8.4,  "COVID-Severe": 14.2, "Optimistic": 5.1},
    "LSE-2020-014": {"Baseline": 6.1,  "COVID-Severe": 11.3, "Optimistic": 3.8},
    "LSE-2021-022": {"Baseline": 0.8,  "COVID-Severe": 2.1,  "Optimistic": 0.4},
    "LSE-2020-031": {"Baseline": 4.2,  "COVID-Severe": 8.7,  "Optimistic": 2.6},
    "LSE-2022-009": {"Baseline": 0.6,  "COVID-Severe": 1.8,  "Optimistic": 0.3},
    "LSE-2018-047": {"Baseline": 1.2,  "COVID-Severe": 3.4,  "Optimistic": 0.7},
}

_STAGE: dict[str, int] = {
    "LSE-2019-001": 3, "LSE-2020-014": 3,
    "LSE-2021-022": 1, "LSE-2020-031": 2,
    "LSE-2022-009": 1, "LSE-2018-047": 1,
}

_LGD: dict[str, float] = {
    "LSE-2019-001": 0.44, "LSE-2020-014": 0.39,
    "LSE-2021-022": 0.12, "LSE-2020-031": 0.31,
    "LSE-2022-009": 0.09, "LSE-2018-047": 0.14,
}

_PD_12M: dict[str, float] = {
    "LSE-2019-001": 0.18, "LSE-2020-014": 0.15,
    "LSE-2021-022": 0.02, "LSE-2020-031": 0.08,
    "LSE-2022-009": 0.01, "LSE-2018-047": 0.02,
}

_PD_LIFETIME: dict[str, float] = {
    "LSE-2019-001": 0.42, "LSE-2020-014": 0.36,
    "LSE-2021-022": 0.06, "LSE-2020-031": 0.22,
    "LSE-2022-009": 0.04, "LSE-2018-047": 0.07,
}

_EAD: dict[str, float] = {   # $M
    "LSE-2019-001": 19.1, "LSE-2020-014": 15.7,
    "LSE-2021-022": 6.5,  "LSE-2020-031": 13.5,
    "LSE-2022-009": 6.7,  "LSE-2018-047": 8.3,
}

_MR_BALANCE: dict[str, float] = {   # $M
    "LSE-2019-001": 19.0, "LSE-2020-014": 15.6,
    "LSE-2021-022": 40.3, "LSE-2020-031": 35.5,
    "LSE-2022-009": 8.8,  "LSE-2018-047": 55.9,
}

_SD: dict[str, float] = {   # $M
    "LSE-2019-001": 1.71, "LSE-2020-014": 1.86,
    "LSE-2021-022": 1.24, "LSE-2020-031": 1.44,
    "LSE-2022-009": 0.34, "LSE-2018-047": 0.96,
}

_MR_SHORTFALL: dict[str, float] = {   # $M — positive = shortfall, negative = surplus
    "LSE-2019-001": +3.13, "LSE-2020-014": +4.82,
    "LSE-2021-022": -8.24, "LSE-2020-031": +1.96,
    "LSE-2022-009": -11.42, "LSE-2018-047": -14.70,
}

# jurisdiction code → {p50, p90, cost_pct, ctc_score}
_JURISDICTION: dict[str, dict[str, Any]] = {
    "IN": {"p50": 18, "p90": 36, "cost_pct": 0.08, "ctc": 72},
    "MX": {"p50": 12, "p90": 24, "cost_pct": 0.06, "ctc": 68},
    "LK": {"p50": 24, "p90": 48, "cost_pct": 0.11, "ctc": 58},
    "IE": {"p50":  3, "p90":  6, "cost_pct": 0.02, "ctc": 95},
    "AE": {"p50":  6, "p90": 12, "cost_pct": 0.04, "ctc": 87},
    "BR": {"p50": 18, "p90": 36, "cost_pct": 0.09, "ctc": 63},
    "FR": {"p50":  9, "p90": 18, "cost_pct": 0.05, "ctc": 92},
    "GB": {"p50":  4, "p90":  8, "cost_pct": 0.03, "ctc": 93},
    "SG": {"p50":  4, "p90":  8, "cost_pct": 0.02, "ctc": 96},
    "CN": {"p50": 20, "p90": 40, "cost_pct": 0.10, "ctc": 61},
    "US": {"p50":  5, "p90": 10, "cost_pct": 0.03, "ctc": 91},
    "AU": {"p50":  4, "p90":  9, "cost_pct": 0.03, "ctc": 94},
    "ZA": {"p50": 15, "p90": 30, "cost_pct": 0.07, "ctc": 69},
    "ID": {"p50": 22, "p90": 44, "cost_pct": 0.09, "ctc": 64},
    "TH": {"p50": 12, "p90": 24, "cost_pct": 0.06, "ctc": 75},
}

# lessee_id → {score, status, worst_stage}
_LESSEE: dict[str, dict[str, Any]] = {
    "indigo-airlines":    {"score": 68, "status": "AMBER", "stage": 3},
    "aeromexico":         {"score": 71, "status": "AMBER", "stage": 3},
    "emirates":           {"score": 94, "status": "GREEN", "stage": 1},
    "srilankan-airlines": {"score": 52, "status": "RED",   "stage": 2},
    "ryanair":            {"score": 89, "status": "GREEN", "stage": 1},
    "air-france":         {"score": 88, "status": "GREEN", "stage": 1},
}

_LESSEE_ECL: dict[str, dict[str, float]] = {
    "indigo-airlines":    {"Baseline": 8.4,  "COVID-Severe": 14.2},
    "aeromexico":         {"Baseline": 6.1,  "COVID-Severe": 11.3},
    "emirates":           {"Baseline": 0.8,  "COVID-Severe": 2.1},
    "srilankan-airlines": {"Baseline": 4.2,  "COVID-Severe": 8.7},
    "ryanair":            {"Baseline": 0.6,  "COVID-Severe": 1.8},
    "air-france":         {"Baseline": 1.2,  "COVID-Severe": 3.4},
}

_MARKET_VALUE: dict[str, float] = {   # $M  (MSN → half-life MV)
    "9218":  26.1, "41234": 28.8,
    "62047": 91.2, "1728":  29.1,
    "67892": 47.3, "0378":  72.8,
}

_ENCUMBERED_VALUE: dict[str, float] = {   # $M  (LEV ≈ MV × 0.90)
    "9218":  23.5, "41234": 25.9,
    "62047": 82.1, "1728":  26.2,
    "67892": 42.6, "0378":  65.5,
}

_KPIS: dict[str, float] = {
    "portfolio_ecl":        21.3,
    "book_value":           2840.0,   # $M
    "encumbered_value":     1840.0,   # $M
    "avg_lease_term":       48.2,     # months remaining
    "ecl_rate":             1.66,     # %
    "watchlist_red_count":  1.0,
    "watchlist_amber_count": 2.0,
}

# ─── /ping ────────────────────────────────────────────────────────────────────

@router.get("/ping", summary="Connection health check")
async def ping(
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Returns {"ok": true, "tenant": "<tenant_id>"}.
    The task pane calls this on mount and every 60 s to verify the token is still valid.
    401 = token missing or expired → task pane shows "Not signed in".
    """
    # TODO: return real tenant slug from current_user.tenant (join Tenant table)
    return {"ok": True, "tenant": str(current_user.tenant_id)}


# ─── ECL & Risk ───────────────────────────────────────────────────────────────

@router.get("/ecl", summary="ECL for a lease under a scenario")
async def get_ecl(
    lease_id: str  = Query(..., description="Lease identifier e.g. LSE-2019-001"),
    scenario: str  = Query(..., description="Scenario name e.g. Baseline"),
    as_of:    str  = Query(..., description="ISO date e.g. 2026-04-29"),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """→ {"ecl": <float>}  ECL in $M."""
    # TODO: query ECL engine / ecl_calculations table filtered by lease_id, scenario, as_of
    lease_ecls = _ECL.get(lease_id)
    if lease_ecls is None:
        raise HTTPException(status_code=404, detail=f"Lease {lease_id!r} not found")
    ecl = lease_ecls.get(scenario)
    if ecl is None:
        raise HTTPException(status_code=404, detail=f"Scenario {scenario!r} not found for lease {lease_id!r}")
    return {"ecl": ecl}


@router.get("/portfolio-ecl", summary="Total portfolio ECL")
async def get_portfolio_ecl(
    scenario: str = Query(..., description="Scenario name"),
    as_of:    str = Query(..., description="ISO date"),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """→ {"ecl": <float>}  Total portfolio ECL in $M across all leases."""
    # TODO: sum ECL engine results for tenant's active leases under scenario
    total = sum(
        v.get(scenario, 0.0)
        for v in _ECL.values()
    )
    if total == 0.0 and scenario not in {"Baseline", "COVID-Severe", "Optimistic"}:
        raise HTTPException(status_code=404, detail=f"Scenario {scenario!r} not found")
    return {"ecl": round(total, 2)}


@router.get("/stage", summary="IFRS 9 stage for a lease")
async def get_stage(
    lease_id: str = Query(...),
    as_of:    str = Query(...),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """→ {"stage": 1 | 2 | 3}"""
    # TODO: query leases table: SELECT ifrs9_stage FROM leases WHERE id = lease_id
    stage = _STAGE.get(lease_id)
    if stage is None:
        raise HTTPException(status_code=404, detail=f"Lease {lease_id!r} not found")
    return {"stage": stage}


@router.get("/lgd", summary="Loss Given Default for a lease")
async def get_lgd(
    lease_id: str = Query(...),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """→ {"lgd": <float>}  LGD as decimal net of SD and MR offsets."""
    # TODO: query ecl_parameters: lgd_net = lgd_gross - sd_offset - mr_offset
    lgd = _LGD.get(lease_id)
    if lgd is None:
        raise HTTPException(status_code=404, detail=f"Lease {lease_id!r} not found")
    return {"lgd": lgd}


@router.get("/pd", summary="Probability of Default for a lease")
async def get_pd(
    lease_id: str = Query(...),
    horizon:  Literal["12m", "lifetime"] = Query("12m"),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """→ {"pd": <float>}  PD as decimal. horizon: "12m" or "lifetime"."""
    # TODO: query pd_curves table, interpolate to as_of date
    if horizon == "12m":
        pd = _PD_12M.get(lease_id)
    else:
        pd = _PD_LIFETIME.get(lease_id)
    if pd is None:
        raise HTTPException(status_code=404, detail=f"Lease {lease_id!r} not found")
    return {"pd": pd}


@router.get("/ead", summary="Exposure at Default for a lease")
async def get_ead(
    lease_id: str = Query(...),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """→ {"ead": <float>}  EAD in $M."""
    # TODO: query leases table: ead = remaining_rent_pv + mr_balance + sd_amount
    ead = _EAD.get(lease_id)
    if ead is None:
        raise HTTPException(status_code=404, detail=f"Lease {lease_id!r} not found")
    return {"ead": ead}


# ─── Maintenance Reserve & Security Deposit ───────────────────────────────────

@router.get("/mr-balance", summary="Maintenance reserve balance")
async def get_mr_balance(
    lease_id: str = Query(...),
    as_of:    str = Query(...),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """→ {"balance": <float>}  MR balance in $M as of date."""
    # TODO: query maintenance_reserves, sum by lease_id WHERE collected_at <= as_of
    balance = _MR_BALANCE.get(lease_id)
    if balance is None:
        raise HTTPException(status_code=404, detail=f"Lease {lease_id!r} not found")
    return {"balance": balance}


@router.get("/sd", summary="Security deposit posted")
async def get_sd(
    lease_id: str = Query(...),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """→ {"amount": <float>}  SD posted in $M."""
    # TODO: query security_deposits WHERE lease_id = lease_id AND status = 'active'
    amount = _SD.get(lease_id)
    if amount is None:
        raise HTTPException(status_code=404, detail=f"Lease {lease_id!r} not found")
    return {"amount": amount}


@router.get("/mr-shortfall", summary="Projected MR shortfall at EOL")
async def get_mr_shortfall(
    lease_id: str = Query(...),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """→ {"shortfall": <float>}  Positive = shortfall, negative = surplus ($M)."""
    # TODO: run maintenance forecaster: sum(event_cost - projected_balance) at lease end
    shortfall = _MR_SHORTFALL.get(lease_id)
    if shortfall is None:
        raise HTTPException(status_code=404, detail=f"Lease {lease_id!r} not found")
    return {"shortfall": shortfall}


# ─── Jurisdiction & Repossession ──────────────────────────────────────────────

@router.get("/repossession", summary="Repossession timeline")
async def get_repossession(
    jurisdiction: str = Query(..., description="ISO 3166-1 alpha-2 country code"),
    percentile:   int = Query(50, ge=1, le=99, description="50 or 90"),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """→ {"months": <int>}  Months to successful repossession at Pxx."""
    # TODO: query jurisdictions table, look up repo_p50 / repo_p90 columns
    jdata = _JURISDICTION.get(jurisdiction.upper())
    if jdata is None:
        raise HTTPException(status_code=404, detail=f"Jurisdiction {jurisdiction!r} not found")
    months = jdata["p50"] if percentile <= 50 else jdata["p90"]
    return {"months": months}


@router.get("/repossession-cost", summary="Repossession cost as % of aircraft value")
async def get_repossession_cost(
    jurisdiction: str = Query(...),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """→ {"cost_pct": <float>}  e.g. 0.08 = 8%."""
    # TODO: query jurisdictions table, repo_cost_pct column
    jdata = _JURISDICTION.get(jurisdiction.upper())
    if jdata is None:
        raise HTTPException(status_code=404, detail=f"Jurisdiction {jurisdiction!r} not found")
    return {"cost_pct": jdata["cost_pct"]}


@router.get("/ctc-score", summary="Cape Town Convention compliance score")
async def get_ctc_score(
    jurisdiction: str = Query(...),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """→ {"score": <int>}  CTC compliance score 0–100."""
    # TODO: query jurisdictions table, ctc_score column
    jdata = _JURISDICTION.get(jurisdiction.upper())
    if jdata is None:
        raise HTTPException(status_code=404, detail=f"Jurisdiction {jurisdiction!r} not found")
    return {"score": jdata["ctc"]}


# ─── Counterparty & Watchlist ─────────────────────────────────────────────────

@router.get("/behavior-score", summary="OCPI behavior score for a lessee")
async def get_behavior_score(
    lessee_id: str = Query(...),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """→ {"score": <int>}  OCPI 0–100 (0 = worst contractual performance)."""
    # TODO: query lessees JOIN lessee_behavior_scores WHERE lessee_id = lessee_id
    ldata = _LESSEE.get(lessee_id.lower())
    if ldata is None:
        raise HTTPException(status_code=404, detail=f"Lessee {lessee_id!r} not found")
    return {"score": ldata["score"]}


@router.get("/watchlist", summary="Watchlist status for a lessee")
async def get_watchlist(
    lessee_id: str = Query(...),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """→ {"status": "GREEN" | "AMBER" | "RED"}"""
    # TODO: query watchlist_entries WHERE lessee_id = lessee_id ORDER BY assessed_at DESC LIMIT 1
    ldata = _LESSEE.get(lessee_id.lower())
    if ldata is None:
        raise HTTPException(status_code=404, detail=f"Lessee {lessee_id!r} not found")
    return {"status": ldata["status"]}


@router.get("/lessee-stage", summary="Worst IFRS 9 stage for a lessee")
async def get_lessee_stage(
    lessee_id: str = Query(...),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """→ {"stage": 1 | 2 | 3}  Worst stage across all the lessee's active leases."""
    # TODO: SELECT MAX(ifrs9_stage) FROM leases WHERE lessee_id = lessee_id AND status = 'active'
    ldata = _LESSEE.get(lessee_id.lower())
    if ldata is None:
        raise HTTPException(status_code=404, detail=f"Lessee {lessee_id!r} not found")
    return {"stage": ldata["stage"]}


@router.get("/lessee-ecl", summary="Total ECL for a lessee under a scenario")
async def get_lessee_ecl(
    lessee_id: str = Query(...),
    scenario:  str = Query(...),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """→ {"ecl": <float>}  Aggregate ECL in $M for the lessee across all leases."""
    # TODO: SUM(ecl) FROM ecl_calculations JOIN leases ON lease_id WHERE lessee_id = lessee_id
    ecls = _LESSEE_ECL.get(lessee_id.lower())
    if ecls is None:
        raise HTTPException(status_code=404, detail=f"Lessee {lessee_id!r} not found")
    ecl = ecls.get(scenario)
    if ecl is None:
        raise HTTPException(status_code=404, detail=f"Scenario {scenario!r} not found")
    return {"ecl": ecl}


# ─── Portfolio & Asset ────────────────────────────────────────────────────────

@router.get("/market-value", summary="Half-life market value by MSN")
async def get_market_value(
    msn: str = Query(..., description="Aircraft manufacturer serial number"),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """→ {"value": <float>}  Half-life market value in $M."""
    # TODO: query aircraft JOIN valuations WHERE msn = msn ORDER BY valued_at DESC LIMIT 1
    value = _MARKET_VALUE.get(msn)
    if value is None:
        raise HTTPException(status_code=404, detail=f"MSN {msn!r} not found")
    return {"value": value}


@router.get("/encumbered-value", summary="Lease-encumbered value by MSN")
async def get_encumbered_value(
    msn: str = Query(...),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """→ {"value": <float>}  Lease-encumbered value (LEV) in $M."""
    # TODO: compute LEV from market_value, lease_premium, maintenance_adjustments
    value = _ENCUMBERED_VALUE.get(msn)
    if value is None:
        raise HTTPException(status_code=404, detail=f"MSN {msn!r} not found")
    return {"value": value}


@router.get("/kpi", summary="Named portfolio KPI")
async def get_kpi(
    metric: str = Query(
        ...,
        description=(
            "One of: portfolio_ecl, book_value, encumbered_value, "
            "avg_lease_term, ecl_rate, watchlist_red_count, watchlist_amber_count"
        ),
    ),
    as_of: str = Query(...),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """→ {"value": <float>}  The numeric value of the named KPI."""
    # TODO: route each metric to its real query (portfolio stats, watchlist counts, etc.)
    value = _KPIS.get(metric)
    if value is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Unknown metric {metric!r}. Valid: "
                + ", ".join(_KPIS.keys())
            ),
        )
    return {"value": value}
