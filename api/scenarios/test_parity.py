"""
test_parity.py — Verifies the Python port of computeECLFromBase matches the
TypeScript implementation in src/app/utils/eclCalculator.ts.

For each case, the expected ECL was computed by running the TS implementation
locally (node -e ... with the math copy-pasted) on 2026-05-24 and verified
against `npm test`. If you change LGD_DELTAS, MONTHLY_RENT_M, BASE_ECL, or
any coefficient in compute_ecl_from_base, you must regenerate these expected
values from the TS source — they are the ground truth for parity.

Run:    /tmp/graphify-venv-312/bin/pytest -q api/scenarios/test_parity.py
        (or any python that has numpy + pytest)
"""
from __future__ import annotations

import math

from run import (
    BASE_ECL, ZERO_INPUTS, compute_ecl_from_base, compute_scenario, compute_stages,
)


def _merge(**overrides):
    return {**ZERO_INPUTS, **overrides}


# Cases generated from the TS implementation (see docstring above).
PARITY_CASES = [
    # (case_name, inputs, expected_ecl)
    ("baseline_zero_inputs",
        ZERO_INPUTS, BASE_ECL),
    ("rpk_shock_minus_25pct",
        _merge(rpkDelta=-0.25), BASE_ECL + 1.0 * (-0.25 * -48)),
    ("fuel_spike_plus_40pct",
        _merge(fuelDelta=0.40), BASE_ECL + 1.0 * (0.40 * 28)),
    ("pd_s3_lift_x1_5",
        _merge(pdS3Multi=1.5), BASE_ECL + 1.0 * (0.5 * 18.2)),
    ("chapter11_benefit",
        _merge(bankruptcyScenarioType="chapter11"),
        BASE_ECL + (-0.12 * BASE_ECL)),
    ("indonesia_pkpu_penalty",
        _merge(bankruptcyScenarioType="indonesia_pkpu"),
        BASE_ECL + (0.09 * BASE_ECL)),
    ("deferral_with_no_forgiveness_is_neutral",
        _merge(deferralMonths=6, govtSupportProb=0.5, forgivenessRate=0.0),
        BASE_ECL),
    ("deferral_full_writeoff",
        _merge(deferralMonths=6, govtSupportProb=0.0, forgivenessRate=1.0),
        BASE_ECL + 6 * 1.0 * 1.0 * 2.85),
    ("deposit_coverage_reduces_ecl",
        _merge(depositCoverage=0.20), BASE_ECL - 0.20 * BASE_ECL * 0.50),
    ("floor_clamp_at_30pct",
        _merge(depositCoverage=1.0, maintenanceReserveCoverage=1.0,
               pbhConversionPct=1.0, etpRate=1.0, lecRate=1.0),
        BASE_ECL * 0.3),
]


def test_parity_with_typescript():
    """Each scenario must produce ECL within 1e-6 of the TS implementation."""
    failures = []
    for name, inputs, expected in PARITY_CASES:
        actual = compute_ecl_from_base(BASE_ECL, inputs)
        if not math.isclose(actual, expected, rel_tol=1e-6, abs_tol=1e-6):
            failures.append(
                f"  {name}: expected {expected:.6f}, got {actual:.6f} (delta {actual - expected:+.6f})"
            )
    assert not failures, "Parity failures:\n" + "\n".join(failures)


def test_stages_sum_to_ecl():
    """Stage shares must always sum to ECL within rounding."""
    for name, inputs, _ in PARITY_CASES:
        ecl = compute_ecl_from_base(BASE_ECL, inputs)
        stages = compute_stages(ecl, inputs)
        total = stages["s1"] + stages["s2"] + stages["s3"]
        assert math.isclose(total, ecl, rel_tol=1e-9), \
            f"{name}: stages sum to {total}, expected {ecl}"


def test_montecarlo_returns_bounds():
    """MC must return non-null p5/p95/std with p5 < ecl < p95."""
    payload = {
        "inputs": _merge(rpkDelta=-0.20, fuelDelta=0.30),
        "mode": "montecarlo", "paths": 5000, "seed": 42,
        "baseECL": BASE_ECL,
    }
    result = compute_scenario(payload)
    assert result.get("error") is None, result
    assert result["mode"] == "montecarlo"
    assert result["paths"] == 5000
    assert result["p5"] is not None
    assert result["p95"] is not None
    assert result["std"] is not None
    assert result["p5"] <= result["ecl"] <= result["p95"], result
    assert result["std"] > 0


def test_montecarlo_seed_reproducibility():
    """Same seed → identical results across runs (Numpy's PCG64 is deterministic)."""
    payload = {
        "inputs": _merge(rpkDelta=-0.15),
        "mode": "montecarlo", "paths": 1000, "seed": 123,
        "baseECL": BASE_ECL,
    }
    r1 = compute_scenario(payload)
    r2 = compute_scenario(payload)
    assert r1["ecl"] == r2["ecl"]
    assert r1["p5"] == r2["p5"]
    assert r1["p95"] == r2["p95"]


def test_montecarlo_performance_50k_paths_under_1s():
    """Vectorized MC should comfortably do 50k paths in <1s."""
    payload = {
        "inputs": _merge(rpkDelta=-0.10, fuelDelta=0.20),
        "mode": "montecarlo", "paths": 50_000, "seed": 7,
        "baseECL": BASE_ECL,
    }
    result = compute_scenario(payload)
    assert result.get("error") is None, result
    assert result["durationMs"] < 1000, (
        f"50k paths took {result['durationMs']}ms — vectorisation may have regressed"
    )


def test_invalid_mode_returns_error():
    result = compute_scenario({"mode": "garbage"})
    assert "error" in result


def test_invalid_paths_returns_error():
    result = compute_scenario({"mode": "montecarlo", "paths": 50})
    assert "error" in result


def test_negative_base_ecl_returns_error():
    result = compute_scenario({"baseECL": -1})
    assert "error" in result


if __name__ == "__main__":
    # Allow direct invocation without pytest.
    import sys
    tests = [
        ("parity_with_typescript",      test_parity_with_typescript),
        ("stages_sum_to_ecl",           test_stages_sum_to_ecl),
        ("montecarlo_returns_bounds",   test_montecarlo_returns_bounds),
        ("montecarlo_seed_reproducibility", test_montecarlo_seed_reproducibility),
        ("montecarlo_performance_50k",  test_montecarlo_performance_50k_paths_under_1s),
        ("invalid_mode_returns_error",  test_invalid_mode_returns_error),
        ("invalid_paths_returns_error", test_invalid_paths_returns_error),
        ("negative_base_ecl_returns_error", test_negative_base_ecl_returns_error),
    ]
    failed = 0
    for name, fn in tests:
        try:
            fn()
            print(f"  PASS {name}")
        except AssertionError as exc:
            failed += 1
            print(f"  FAIL {name}\n    {exc}")
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    sys.exit(0 if failed == 0 else 1)
