"""
api/scenarios/run.py — Aeroinsights scenario engine (Vercel Python Function)

POSTs accept ScenarioInputs identical to the TypeScript client engine
(src/app/utils/eclCalculator.ts). The deterministic path is an exact
parity port of computeECLFromBase. The Monte Carlo path adds vectorized
NumPy sampling around the user's macro inputs and returns true p5/p95
bounds + per-stage uncertainty.

This function replaces the theatrical client-side MC (which just multiplied
ECL by fixed factors with seeded noise). For deterministic runs the client
should keep computing locally — this endpoint exists for large portfolios
and high-path-count MC where vectorized NumPy beats single-threaded JS.

See docs/ADR-001-backend-architecture.md for the rationale.

Request body (JSON):
{
  "inputs": { ...26 ScenarioInputs fields... },
  "mode":    "deterministic" | "montecarlo",
  "paths":   1000 .. 100000,
  "seed":    integer,
  "baseECL": number (typically BASE_ECL = 47.2 for the demo portfolio)
}

Response (JSON):
{
  "ecl":        number,          // mean (MC) or deterministic value
  "p5":         number | null,   // MC only
  "p95":        number | null,   // MC only
  "std":        number | null,   // MC only
  "s1": number, "s2": number, "s3": number,   // stage distribution of mean
  "mode":       string,
  "paths":      number | null,
  "durationMs": number,
  "scenarioHash": string,
  "engine":     "python-numpy"
}
"""
from __future__ import annotations

import hashlib
import json
import time
from http.server import BaseHTTPRequestHandler
from typing import Any

import numpy as np

# ───────────────────────────────────────────────────────────────────────────────
# Constants — keep in sync with src/app/utils/eclCalculator.ts
# ───────────────────────────────────────────────────────────────────────────────

BASE_ECL = 47.2
MONTHLY_RENT_M = 2.85
REPOSS_BENCHMARK_MONTHS = 3
REMARKETING_BENCHMARK_MONTHS = 3

LGD_DELTAS: dict[str, float] = {
    "chapter11":          -0.12,
    "india_ibc":          -0.05,
    "mexico_concurso":     0.02,
    "brazil_rj":           0.04,
    "indonesia_pkpu":      0.09,
    "generic_liquidation": 0.18,
}

# 26 input fields, matching ScenarioInputs in TS exactly.
ZERO_INPUTS: dict[str, Any] = {
    "gdpDelta": 0.0, "rpkDelta": 0.0, "fuelDelta": 0.0, "fxDelta": 0.0,
    "rateDelta": 0.0, "assetValueDelta": 0.0,
    "pdS2Multi": 1.0, "pdS3Multi": 1.0,
    "deferralMonths": 0.0, "govtSupportProb": 0.0, "forgivenessRate": 0.0,
    "pbhConversionPct": 0.0, "etpRate": 0.0, "lecRate": 0.0,
    "bankruptcyScenarioType": None, "leaseAssumptionPct": 0.0,
    "ctcGoldPct": 0.0, "nonCtcPct": 0.0, "repossWeightedMonths": 0.0,
    "remarketingMonths": 0.0, "lgdDecayAdjFactor": 0.0,
    "depositCoverage": 0.0, "maintenanceReserveCoverage": 0.0,
    "payBehaviourCoopPct": 0.0, "payBehaviourAdvPct": 0.0,
    "restructuringType": None,
}

# ───────────────────────────────────────────────────────────────────────────────
# Deterministic ECL — exact port of computeECLFromBase()
# ───────────────────────────────────────────────────────────────────────────────

def compute_ecl_from_base(base_ecl: float, inputs: dict[str, Any]) -> float:
    """
    Pure scalar port of src/app/utils/eclCalculator.ts::computeECLFromBase.
    Used for deterministic runs AND as the per-path kernel inside Monte Carlo
    when paths are computed scalar-wise. The vectorized MC kernel below
    duplicates this logic in NumPy form for speed.
    """
    scale_factor = base_ecl / BASE_ECL

    macro_delta = scale_factor * (
        min(0.0, inputs["gdpDelta"]) * -250
        + min(0.0, inputs["rpkDelta"]) * -48
        + max(0.0, inputs["fuelDelta"]) * 28
        + min(0.0, inputs["fxDelta"]) * -32
        + max(0.0, inputs["rateDelta"]) * 14
        + min(0.0, inputs["assetValueDelta"]) * -52
        + (inputs["pdS2Multi"] - 1.0) * 8.5
        + (inputs["pdS3Multi"] - 1.0) * 18.2
    )

    deferral_penalty = (
        inputs["deferralMonths"]
        * (1 - inputs["govtSupportProb"])
        * inputs["forgivenessRate"]
        * MONTHLY_RENT_M
    )

    pbh_benefit = inputs["pbhConversionPct"] * base_ecl * 0.15
    etp_benefit = inputs["etpRate"] * base_ecl * 0.08
    lec_benefit = inputs["lecRate"] * base_ecl * 0.05

    if inputs["bankruptcyScenarioType"] is not None:
        lgd_delta = LGD_DELTAS.get(inputs["bankruptcyScenarioType"], 0.0) * base_ecl
    else:
        lgd_delta = 0.0

    if inputs["bankruptcyScenarioType"] is not None and inputs["leaseAssumptionPct"] > 0:
        assumption_benefit = inputs["leaseAssumptionPct"] * 0.25 * base_ecl
    else:
        assumption_benefit = 0.0

    ctc_moderate_pct = max(0.0, 1.0 - inputs["ctcGoldPct"] - inputs["nonCtcPct"])
    if inputs["ctcGoldPct"] == 0 and inputs["nonCtcPct"] == 0:
        jurisdiction_lgd_delta = 0.0
    else:
        jurisdiction_lgd_delta = (
            ctc_moderate_pct * 0.06 + inputs["nonCtcPct"] * 0.15
        ) * base_ecl

    if inputs["repossWeightedMonths"] > 0:
        reposs_lgd_delta = (
            max(0.0, inputs["repossWeightedMonths"] - REPOSS_BENCHMARK_MONTHS)
            * 0.025
            * base_ecl
        )
    else:
        reposs_lgd_delta = 0.0

    if inputs["remarketingMonths"] > 0:
        remarketing_lgd_delta = (
            max(0.0, inputs["remarketingMonths"] - REMARKETING_BENCHMARK_MONTHS)
            * 0.015
            * base_ecl
        )
    else:
        remarketing_lgd_delta = 0.0

    if inputs["lgdDecayAdjFactor"] > 0:
        lgd_decay_delta = inputs["lgdDecayAdjFactor"] * base_ecl
    else:
        lgd_decay_delta = 0.0

    deposit_benefit = inputs["depositCoverage"] * base_ecl * 0.50
    mr_benefit = inputs["maintenanceReserveCoverage"] * base_ecl * 0.35

    if inputs["payBehaviourCoopPct"] == 0 and inputs["payBehaviourAdvPct"] == 0:
        pay_behaviour_delta = 0.0
    else:
        pay_behaviour_delta = (
            inputs["payBehaviourAdvPct"] * 0.12 - inputs["payBehaviourCoopPct"] * 0.07
        ) * base_ecl

    delta = (
        macro_delta
        + deferral_penalty
        - pbh_benefit
        - etp_benefit
        - lec_benefit
        + lgd_delta
        - assumption_benefit
        + jurisdiction_lgd_delta
        + reposs_lgd_delta
        - deposit_benefit
        - mr_benefit
        + pay_behaviour_delta
        + remarketing_lgd_delta
        + lgd_decay_delta
    )
    return max(base_ecl * 0.3, base_ecl + delta)


def compute_stages(ecl: float, inputs: dict[str, Any]) -> dict[str, float]:
    """Port of computeStages() — splits ECL into stage 1/2/3 buckets."""
    stress = (
        max(
            0.0,
            min(0.0, inputs["rpkDelta"]) * -2
            + (inputs["pdS3Multi"] - 1) * 1.5
            + min(0.0, inputs["assetValueDelta"]) * -1.5,
        )
        / 3
    )
    s1_share = max(0.05, 0.178 - stress * 0.13)
    s3_share = min(0.70, 0.365 + stress * 0.25)
    s2_share = max(0.05, 1 - s1_share - s3_share)
    return {"s1": ecl * s1_share, "s2": ecl * s2_share, "s3": ecl * s3_share}


# ───────────────────────────────────────────────────────────────────────────────
# Vectorized Monte Carlo kernel
# ───────────────────────────────────────────────────────────────────────────────

# Macro inputs perturbed in MC. Decision variables (e.g. leaseAssumptionPct,
# pbhConversionPct) are held fixed — they represent lessor strategy, not
# stochastic shocks.
MC_PERTURBED_FIELDS = (
    "gdpDelta", "rpkDelta", "fuelDelta", "fxDelta", "rateDelta",
    "assetValueDelta", "pdS2Multi", "pdS3Multi",
)

# Relative-uncertainty defaults. Calibration TODO: these defaults give plausible
# bounds; replace with per-input calibration from historical macro vol when
# T-1.5 (IFRS-9 parameter ingestion) lands.
MC_REL_UNCERTAINTY = {
    "gdpDelta": 0.30, "rpkDelta": 0.30, "fuelDelta": 0.35,
    "fxDelta": 0.25, "rateDelta": 0.40, "assetValueDelta": 0.35,
    "pdS2Multi": 0.20, "pdS3Multi": 0.20,
}


def _sample_inputs_matrix(
    inputs: dict[str, Any], paths: int, rng: np.random.Generator
) -> dict[str, np.ndarray | Any]:
    """Build an N-paths matrix of inputs by sampling perturbed macro fields."""
    sampled = {}
    for field, value in inputs.items():
        if field in MC_PERTURBED_FIELDS and isinstance(value, (int, float)):
            rel = MC_REL_UNCERTAINTY[field]
            # PD multipliers anchor at 1.0; perturb the lift above 1.0
            if field in ("pdS2Multi", "pdS3Multi"):
                lift = max(0.0, value - 1.0)
                stddev = lift * rel
                sampled[field] = np.clip(rng.normal(value, stddev, paths), 1.0, None)
            else:
                stddev = abs(value) * rel if value != 0 else 0.01
                sampled[field] = rng.normal(value, stddev, paths)
        else:
            sampled[field] = value
    return sampled


def _vectorized_ecl(
    base_ecl: float, sampled: dict[str, np.ndarray | Any]
) -> np.ndarray:
    """Vectorized port of compute_ecl_from_base over N paths."""
    scale = base_ecl / BASE_ECL

    gdp_neg  = np.minimum(0.0, sampled["gdpDelta"])
    rpk_neg  = np.minimum(0.0, sampled["rpkDelta"])
    fuel_pos = np.maximum(0.0, sampled["fuelDelta"])
    fx_neg   = np.minimum(0.0, sampled["fxDelta"])
    rate_pos = np.maximum(0.0, sampled["rateDelta"])
    av_neg   = np.minimum(0.0, sampled["assetValueDelta"])

    macro_delta = scale * (
        gdp_neg * -250 + rpk_neg * -48 + fuel_pos * 28
        + fx_neg * -32 + rate_pos * 14 + av_neg * -52
        + (sampled["pdS2Multi"] - 1.0) * 8.5
        + (sampled["pdS3Multi"] - 1.0) * 18.2
    )

    # Decision-variable terms (scalar — broadcast across paths)
    deferral_penalty = (
        sampled["deferralMonths"]
        * (1 - sampled["govtSupportProb"])
        * sampled["forgivenessRate"]
        * MONTHLY_RENT_M
    )
    pbh_benefit = sampled["pbhConversionPct"] * base_ecl * 0.15
    etp_benefit = sampled["etpRate"] * base_ecl * 0.08
    lec_benefit = sampled["lecRate"] * base_ecl * 0.05

    bankruptcy = sampled["bankruptcyScenarioType"]
    if bankruptcy is not None:
        lgd_delta = LGD_DELTAS.get(bankruptcy, 0.0) * base_ecl
        assumption_benefit = (
            sampled["leaseAssumptionPct"] * 0.25 * base_ecl
            if sampled["leaseAssumptionPct"] > 0
            else 0.0
        )
    else:
        lgd_delta = 0.0
        assumption_benefit = 0.0

    ctc_moderate_pct = max(
        0.0, 1.0 - sampled["ctcGoldPct"] - sampled["nonCtcPct"]
    )
    if sampled["ctcGoldPct"] == 0 and sampled["nonCtcPct"] == 0:
        jurisdiction_lgd_delta = 0.0
    else:
        jurisdiction_lgd_delta = (
            ctc_moderate_pct * 0.06 + sampled["nonCtcPct"] * 0.15
        ) * base_ecl

    reposs_lgd_delta = (
        max(0.0, sampled["repossWeightedMonths"] - REPOSS_BENCHMARK_MONTHS)
        * 0.025 * base_ecl
        if sampled["repossWeightedMonths"] > 0 else 0.0
    )
    remarketing_lgd_delta = (
        max(0.0, sampled["remarketingMonths"] - REMARKETING_BENCHMARK_MONTHS)
        * 0.015 * base_ecl
        if sampled["remarketingMonths"] > 0 else 0.0
    )
    lgd_decay_delta = (
        sampled["lgdDecayAdjFactor"] * base_ecl
        if sampled["lgdDecayAdjFactor"] > 0 else 0.0
    )

    deposit_benefit = sampled["depositCoverage"] * base_ecl * 0.50
    mr_benefit = sampled["maintenanceReserveCoverage"] * base_ecl * 0.35

    if sampled["payBehaviourCoopPct"] == 0 and sampled["payBehaviourAdvPct"] == 0:
        pay_behaviour_delta = 0.0
    else:
        pay_behaviour_delta = (
            sampled["payBehaviourAdvPct"] * 0.12
            - sampled["payBehaviourCoopPct"] * 0.07
        ) * base_ecl

    delta = (
        macro_delta + deferral_penalty
        - pbh_benefit - etp_benefit - lec_benefit
        + lgd_delta - assumption_benefit
        + jurisdiction_lgd_delta + reposs_lgd_delta
        - deposit_benefit - mr_benefit
        + pay_behaviour_delta
        + remarketing_lgd_delta + lgd_decay_delta
    )
    return np.maximum(base_ecl * 0.3, base_ecl + delta)


# ───────────────────────────────────────────────────────────────────────────────
# Validation
# ───────────────────────────────────────────────────────────────────────────────

def _validate_inputs(payload: dict) -> tuple[dict, str | None]:
    """Returns (normalised_payload, error_message_or_None)."""
    if not isinstance(payload, dict):
        return {}, "Body must be a JSON object."

    raw_inputs = payload.get("inputs", {})
    if not isinstance(raw_inputs, dict):
        return {}, "`inputs` must be an object."

    # Merge ZERO_INPUTS so any missing field defaults to its neutral value.
    inputs = {**ZERO_INPUTS, **raw_inputs}

    mode = payload.get("mode", "deterministic")
    if mode not in ("deterministic", "montecarlo"):
        return {}, "`mode` must be 'deterministic' or 'montecarlo'."

    paths = int(payload.get("paths", 10_000))
    if not (100 <= paths <= 100_000):
        return {}, "`paths` must be 100..100000."

    try:
        seed = int(payload.get("seed", 42))
    except (TypeError, ValueError):
        return {}, "`seed` must be an integer."

    base_ecl = float(payload.get("baseECL", BASE_ECL))
    if base_ecl <= 0:
        return {}, "`baseECL` must be positive."

    return {
        "inputs": inputs, "mode": mode, "paths": paths,
        "seed": seed, "baseECL": base_ecl,
    }, None


# ───────────────────────────────────────────────────────────────────────────────
# Core compute entry-point — also unit-tested separately
# ───────────────────────────────────────────────────────────────────────────────

def compute_scenario(payload: dict) -> dict[str, Any]:
    """Pure function — same input/output contract regardless of HTTP layer."""
    normalised, err = _validate_inputs(payload)
    if err is not None:
        return {"error": err}

    inputs   = normalised["inputs"]
    mode     = normalised["mode"]
    paths    = normalised["paths"]
    seed     = normalised["seed"]
    base_ecl = normalised["baseECL"]

    start = time.perf_counter()

    if mode == "deterministic":
        ecl = compute_ecl_from_base(base_ecl, inputs)
        stages = compute_stages(ecl, inputs)
        duration_ms = (time.perf_counter() - start) * 1000
        scenario_hash = hashlib.sha256(
            json.dumps(inputs, sort_keys=True, default=str).encode()
        ).hexdigest()[:12]
        return {
            "ecl":          round(ecl, 4),
            "p5":           None,
            "p95":          None,
            "std":          None,
            "s1":           round(stages["s1"], 4),
            "s2":           round(stages["s2"], 4),
            "s3":           round(stages["s3"], 4),
            "mode":         "deterministic",
            "paths":        None,
            "durationMs":   round(duration_ms, 2),
            "scenarioHash": scenario_hash,
            "engine":       "python-numpy",
        }

    # Monte Carlo
    rng = np.random.default_rng(seed)
    sampled = _sample_inputs_matrix(inputs, paths, rng)
    ecls = _vectorized_ecl(base_ecl, sampled)

    mean = float(np.mean(ecls))
    std  = float(np.std(ecls))
    p5   = float(np.percentile(ecls, 5))
    p95  = float(np.percentile(ecls, 95))

    stages = compute_stages(mean, inputs)
    duration_ms = (time.perf_counter() - start) * 1000

    scenario_hash = hashlib.sha256(
        json.dumps(
            {**inputs, "_seed": seed, "_paths": paths},
            sort_keys=True, default=str,
        ).encode()
    ).hexdigest()[:12]

    return {
        "ecl":          round(mean, 4),
        "p5":           round(p5, 4),
        "p95":          round(p95, 4),
        "std":          round(std, 4),
        "s1":           round(stages["s1"], 4),
        "s2":           round(stages["s2"], 4),
        "s3":           round(stages["s3"], 4),
        "mode":         "montecarlo",
        "paths":        paths,
        "durationMs":   round(duration_ms, 2),
        "scenarioHash": scenario_hash,
        "engine":       "python-numpy",
    }


# ───────────────────────────────────────────────────────────────────────────────
# HTTP handler — Vercel Python Function entry point
# ───────────────────────────────────────────────────────────────────────────────

class handler(BaseHTTPRequestHandler):  # noqa: N801 — Vercel requires lowercase
    def _send_json(self, status: int, body: dict) -> None:
        payload = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

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

        result = compute_scenario(payload)
        status = 400 if "error" in result else 200
        self._send_json(status, result)

    def do_GET(self) -> None:  # noqa: N802
        # Health probe.
        self._send_json(200, {
            "ok": True,
            "engine": "python-numpy",
            "base_ecl": BASE_ECL,
        })
