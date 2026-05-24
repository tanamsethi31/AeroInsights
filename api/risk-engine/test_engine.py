"""
api/risk-engine/test_engine.py — Unit tests for engine.py.

No network, no Supabase, no pytest required. Run with:
    python api/risk-engine/test_engine.py

Five required tests, plus a couple of supporting checks that catch
regressions in the helpers without expanding the headline count.
"""
from __future__ import annotations

import math
import os
import sys
from datetime import date

# Make `engine` importable when running this file from anywhere.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from engine import (  # noqa: E402
    DEFAULT_LGD,
    DEFAULT_PD_CURVES,
    compute_lease_ecl,
    compute_portfolio_ecl,
    default_pd_for_segment,
)

VALUATION_DATE = date(2026, 5, 24)


# ───────────────────────────────────────────────────────────────────────────────
# Fixtures
# ───────────────────────────────────────────────────────────────────────────────

def _lease(
    id_, asset_id, lessee_id,
    start_date="2024-01-01", end_date="2030-01-01",
    monthly_rental=300_000, stage=None,
):
    row = {
        "id": id_, "asset_id": asset_id, "lessee_id": lessee_id,
        "start_date": start_date, "end_date": end_date,
        "monthly_rental": monthly_rental, "currency": "USD",
    }
    if stage is not None:
        row["stage"] = stage
    return row


def _lessee(id_, name, segment):
    return {"id": id_, "name": name, "carrier_segment": segment}


def _asset(id_, msn, reg="N123XX"):
    return {"id": id_, "msn": msn, "registration": reg, "aircraft_type": "A320"}


# ───────────────────────────────────────────────────────────────────────────────
# Test 1 — PD curve interpolates monotonically
# ───────────────────────────────────────────────────────────────────────────────

def test_default_pd_for_segment_monotonic():
    """For every segment, PD must be non-decreasing as tenor increases."""
    tenors = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 7.0, 10.0, 20.0]
    for segment in DEFAULT_PD_CURVES.keys():
        pds = [default_pd_for_segment(segment, t) for t in tenors]
        for i in range(1, len(pds)):
            assert pds[i] >= pds[i - 1] - 1e-12, (
                f"{segment}: PD decreased between tenor {tenors[i-1]} ({pds[i-1]}) "
                f"and {tenors[i]} ({pds[i]})"
            )
        # 1y/5y anchors should match the source dict exactly.
        curve = DEFAULT_PD_CURVES[segment]
        assert math.isclose(default_pd_for_segment(segment, 1.0), curve["pd1yr"], rel_tol=1e-9)
        assert math.isclose(default_pd_for_segment(segment, 5.0), curve["pd5yr"], rel_tol=1e-9)
        assert math.isclose(default_pd_for_segment(segment, 10.0), curve["pd_lifetime"], rel_tol=1e-9)

    # Unknown segment falls back to LCC curve.
    assert default_pd_for_segment("unknown", 1.0) == DEFAULT_PD_CURVES["lcc"]["pd1yr"]
    assert default_pd_for_segment(None,      3.0) == DEFAULT_PD_CURVES["lcc"]["pd3yr"]


# ───────────────────────────────────────────────────────────────────────────────
# Test 2 — ECL = PD × LGD × EAD on a constructed input
# ───────────────────────────────────────────────────────────────────────────────

def test_compute_lease_ecl_arithmetic():
    """Hand-computed: lessee=lcc, end_date=2031-05-24 (60 months from val date),
       monthly_rental=$100,000 → EAD=$6,000,000; stage 1 forces PD=PD_1y(lcc);
       LGD override 0.40 recovery → LGD=0.60. ECL = PD × 0.6 × 6,000,000."""
    lease = _lease(
        "L1", "A1", "LE1",
        start_date="2026-05-24", end_date="2031-05-24",
        monthly_rental=100_000, stage=1,
    )
    lessee = _lessee("LE1", "TestAir", "lcc")
    asset  = _asset("A1", "MSN-001")

    row = compute_lease_ecl(
        lease=lease, lessee=lessee, asset=asset,
        pd_curve=None, lgd_override=0.40,
        valuation_date=VALUATION_DATE,
    )

    expected_pd  = DEFAULT_PD_CURVES["lcc"]["pd1yr"]   # stage 1 → PD_1y
    expected_lgd = 0.60                                # 1 - recovery
    expected_ead = 100_000 * 60
    expected_ecl = expected_pd * expected_lgd * expected_ead

    assert row["remaining_months"] == 60, row
    assert math.isclose(row["pd"], expected_pd, rel_tol=1e-9), row
    assert math.isclose(row["lgd"], expected_lgd, rel_tol=1e-9), row
    assert math.isclose(row["ead_usd"], expected_ead, rel_tol=1e-9), row
    assert math.isclose(row["ecl_usd"], expected_ecl, abs_tol=0.01), row
    assert row["stage"] == 1
    assert row["drivers"]["lgd_source"] == "lgd_recovery_overrides"


# ───────────────────────────────────────────────────────────────────────────────
# Test 3 — falls back to default PD when pd_curve is None, drivers explain it
# ───────────────────────────────────────────────────────────────────────────────

def test_compute_lease_ecl_falls_back_to_default_pd():
    """No pd_curve passed → engine uses DEFAULT_PD_CURVES['network'] for a network carrier."""
    lease = _lease(
        "L2", "A2", "LE2",
        start_date="2024-05-24", end_date="2029-05-24",   # 5y tenor at val date
        monthly_rental=250_000, stage=2,
    )
    lessee = _lessee("LE2", "FlagCarrier", "network")
    asset  = _asset("A2", "MSN-002")

    row = compute_lease_ecl(
        lease=lease, lessee=lessee, asset=asset,
        pd_curve=None, lgd_override=None,
        valuation_date=VALUATION_DATE,
    )

    # tenor = full lease length = 5y → PD = pd5yr of network curve.
    expected_pd = DEFAULT_PD_CURVES["network"]["pd5yr"]
    assert math.isclose(row["pd"], expected_pd, rel_tol=1e-9), row
    assert row["lgd"] == DEFAULT_LGD
    assert row["drivers"]["pd_source"] == "default_network"
    assert row["drivers"]["lgd_source"] == "default_aviation_55"


# ───────────────────────────────────────────────────────────────────────────────
# Test 4 — portfolio aggregator over a synthetic 3-lease portfolio
# ───────────────────────────────────────────────────────────────────────────────

def test_compute_portfolio_ecl_aggregates_three_leases():
    """Three leases, mixed stages and segments, no overrides, no provisions."""
    assets = [
        _asset("A1", "MSN-001", "N100AA"),
        _asset("A2", "MSN-002", "N200BB"),
        _asset("A3", "MSN-003", "N300CC"),
    ]
    lessees = [
        _lessee("LE1", "NetworkCo",  "network"),
        _lessee("LE2", "LCCo",       "lcc"),
        _lessee("LE3", "RegionalCo", "regional"),
    ]
    leases = [
        _lease("L1", "A1", "LE1",
               start_date="2025-05-24", end_date="2027-05-24",
               monthly_rental=400_000, stage=1),
        _lease("L2", "A2", "LE2",
               start_date="2024-05-24", end_date="2029-05-24",
               monthly_rental=300_000, stage=2),
        _lease("L3", "A3", "LE3",
               start_date="2023-05-24", end_date="2028-05-24",
               monthly_rental=200_000, stage=3),
    ]

    agg = compute_portfolio_ecl(
        leases=leases, lessees=lessees, assets=assets,
        provisions=[], pd_curves=[], lgd_override=None,
        valuation_date=VALUATION_DATE,
    )

    assert agg["lease_count"] == 3
    assert len(agg["ecl_rows"]) == 3

    # Recompute per-row and ensure aggregate matches sum.
    total = sum(r["ecl_usd"] for r in agg["ecl_rows"])
    assert math.isclose(agg["total_ecl"], round(total, 2), abs_tol=0.01)

    # Each stage bucket reflects exactly one lease.
    s1 = next(r for r in agg["ecl_rows"] if r["stage"] == 1)
    s2 = next(r for r in agg["ecl_rows"] if r["stage"] == 2)
    s3 = next(r for r in agg["ecl_rows"] if r["stage"] == 3)
    assert math.isclose(agg["stage1_ecl"], s1["ecl_usd"], abs_tol=0.01)
    assert math.isclose(agg["stage2_ecl"], s2["ecl_usd"], abs_tol=0.01)
    assert math.isclose(agg["stage3_ecl"], s3["ecl_usd"], abs_tol=0.01)

    # Book value = sum of EADs.
    book = sum(r["ead_usd"] for r in agg["ecl_rows"])
    assert math.isclose(agg["book_value"], round(book, 2), abs_tol=0.01)

    # Coverage % = total / book × 100.
    assert math.isclose(agg["coverage_pct"], total / book * 100.0, abs_tol=1e-2)

    # ecl_12m = stage1_ecl by IFRS-9 convention.
    assert agg["ecl_12m"] == agg["stage1_ecl"]


# ───────────────────────────────────────────────────────────────────────────────
# Test 5 — stage totals always reconcile with total_ecl
# ───────────────────────────────────────────────────────────────────────────────

def test_stage_totals_sum_to_total_ecl():
    """Property check across several portfolio shapes (incl. empty / single)."""
    cases = [
        # Empty portfolio.
        ([], [], [], []),
        # All-stage-1 portfolio.
        (
            [_asset(f"A{i}", f"MSN-{i:03}") for i in range(5)],
            [_lessee(f"LE{i}", f"L{i}", "lcc") for i in range(5)],
            [_lease(f"L{i}", f"A{i}", f"LE{i}",
                    start_date="2026-01-01", end_date="2030-01-01",
                    monthly_rental=100_000 * (i + 1), stage=1)
             for i in range(5)],
            [],
        ),
        # Mixed stages + a lease with no stage (defaults to 1).
        (
            [_asset(f"A{i}", f"MSN-{i:03}") for i in range(4)],
            [_lessee(f"LE{i}", f"L{i}", ["network", "lcc", "regional", "charter"][i]) for i in range(4)],
            [
                _lease("L0", "A0", "LE0", monthly_rental=500_000, stage=1),
                _lease("L1", "A1", "LE1", monthly_rental=250_000, stage=2),
                _lease("L2", "A2", "LE2", monthly_rental=150_000, stage=3),
                _lease("L3", "A3", "LE3", monthly_rental=200_000),  # no stage → default 1
            ],
            [],
        ),
    ]
    for assets, lessees, leases, provisions in cases:
        agg = compute_portfolio_ecl(
            leases=leases, lessees=lessees, assets=assets,
            provisions=provisions, pd_curves=[], lgd_override=None,
            valuation_date=VALUATION_DATE,
        )
        stage_sum = agg["stage1_ecl"] + agg["stage2_ecl"] + agg["stage3_ecl"]
        assert math.isclose(stage_sum, agg["total_ecl"], abs_tol=0.02), (
            f"stage sum {stage_sum} ≠ total {agg['total_ecl']} for {len(leases)}-lease case"
        )


# ───────────────────────────────────────────────────────────────────────────────
# Test runner
# ───────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    tests = [
        ("default_pd_for_segment_monotonic",          test_default_pd_for_segment_monotonic),
        ("compute_lease_ecl_arithmetic",              test_compute_lease_ecl_arithmetic),
        ("compute_lease_ecl_falls_back_to_default_pd", test_compute_lease_ecl_falls_back_to_default_pd),
        ("compute_portfolio_ecl_aggregates_three_leases", test_compute_portfolio_ecl_aggregates_three_leases),
        ("stage_totals_sum_to_total_ecl",             test_stage_totals_sum_to_total_ecl),
    ]
    failed = 0
    for name, fn in tests:
        try:
            fn()
            print(f"  PASS {name}")
        except AssertionError as exc:
            failed += 1
            print(f"  FAIL {name}\n    {exc}")
        except Exception as exc:
            failed += 1
            print(f"  ERROR {name}\n    {type(exc).__name__}: {exc}")
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    sys.exit(0 if failed == 0 else 1)
