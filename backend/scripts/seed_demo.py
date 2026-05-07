"""
Seed script — creates a demo tenant with realistic Aeroinsights data
matching the frontend mock data so the UI works immediately.

Usage:
    python -m scripts.seed_demo
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models import (
    Aircraft, AuditLog, ECLRecord, Lease, LeaseStage, LeaseStatus,
    Lessee, MaintenanceReserve, Payment, SDType, ScenarioTemplate,
    SecurityDeposit, SICRConfig, Tenant, User, UserRole, Valuation,
    ValuationSource, WatchlistConfig, WatchlistStatus,
)


DEMO_TENANT_ID = "demo-tenant-0001"
DEMO_USER_ID = "demo-user-0001"


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        # ── Tenant ──────────────────────────────────────────────────────────
        existing = (await db.execute(select(Tenant).where(Tenant.id == DEMO_TENANT_ID))).scalar_one_or_none()
        if existing:
            print("Demo data already seeded. Skipping.")
            return

        tenant = Tenant(
            id=DEMO_TENANT_ID,
            name="Aer Capital Partners Ltd.",
            primary_currency="USD",
            timezone="Europe/Dublin",
            fiscal_year_end="12-31",
            ifrs9_adoption_date=date(2019, 1, 1),
            default_discount_rate=Decimal("0.0575"),
        )
        db.add(tenant)
        await db.flush()  # persist tenant so FK constraints on child tables are satisfied

        # ── Users ────────────────────────────────────────────────────────────
        # auth0_sub="dev|usr-001" on the admin user matches the DEV_AUTH_BYPASS
        # identity in app/core/auth.py so all local API calls resolve to USR-001.
        users_data = [
            ("USR-001", "John Williams", "john@aerinsights.com", UserRole.admin, True, "dev|usr-001"),
            ("USR-002", "Alex Johnson", "alex@aerinsights.com", UserRole.risk, True, None),
            ("USR-003", "Sarah Chen", "sarah@aerinsights.com", UserRole.accounting, True, None),
            ("USR-004", "Marcus Webb", "marcus@aerinsights.com", UserRole.readonly, False, None),
        ]
        for uid, name, email, role, mfa, auth0_sub in users_data:
            db.add(User(
                id=uid, tenant_id=DEMO_TENANT_ID,
                name=name, email=email, role=role, mfa_enabled=mfa,
                auth0_sub=auth0_sub,
            ))

        # ── Lessees ──────────────────────────────────────────────────────────
        lessees_data = [
            ("LSE-001", "IndiGo Airlines", "IND", "BB-", LeaseStage.stage3, WatchlistStatus.red, 44,
             {"punctuality": 28, "restructuringCoop": 52, "govtInterference": 41, "litigationPropensity": 55}),
            ("LSE-002", "Aeromexico", "MEX", "CCC", LeaseStage.stage3, WatchlistStatus.red, 29,
             {"punctuality": 18, "restructuringCoop": 38, "govtInterference": 35, "litigationPropensity": 25}),
            ("LSE-003", "SriLankan Airlines", "LKA", "B+", LeaseStage.stage2, WatchlistStatus.amber, 62,
             {"punctuality": 55, "restructuringCoop": 70, "govtInterference": 48, "litigationPropensity": 75}),
            ("LSE-004", "Azul Brazilian Airlines", "BRA", "B+", LeaseStage.stage2, WatchlistStatus.amber, 71,
             {"punctuality": 68, "restructuringCoop": 78, "govtInterference": 62, "litigationPropensity": 76}),
            ("LSE-005", "Air Transat", "CAN", "B", LeaseStage.stage2, WatchlistStatus.amber, 68,
             {"punctuality": 62, "restructuringCoop": 75, "govtInterference": 88, "litigationPropensity": 47}),
            ("LSE-006", "Emirates", "ARE", "A-", LeaseStage.stage1, WatchlistStatus.green, 94,
             {"punctuality": 98, "restructuringCoop": 95, "govtInterference": 92, "litigationPropensity": 91}),
        ]
        lessee_objs = {}
        for lid, name, country, rating, stage, watchlist, score, sub_scores in lessees_data:
            l = Lessee(
                id=lid, tenant_id=DEMO_TENANT_ID,
                name=name, country_code=country, credit_rating=rating,
                stage=stage, watchlist_status=watchlist,
                behavior_score=score, behavior_scores_json=sub_scores,
            )
            db.add(l)
            lessee_objs[lid] = l

        # ── Aircraft ─────────────────────────────────────────────────────────
        aircraft_data = [
            ("AC-001", "MSN-3841", "A320neo", "VT-IZA", 2019, "LSE-001"),
            ("AC-002", "MSN-5129", "B737 MAX 8", "XA-AMX", 2021, "LSE-002"),
            ("AC-003", "MSN-2847", "A330-300", "4R-ALA", 2017, "LSE-003"),
            ("AC-004", "MSN-6072", "E195-E2", "PR-AZU", 2022, "LSE-004"),
            ("AC-005", "MSN-4418", "A321neo", "C-GTSY", 2020, "LSE-005"),
            ("AC-006", "MSN-7201", "B777-300ER", "A6-EBW", 2018, "LSE-006"),
            ("AC-007", "MSN-3912", "A320neo", "VT-IZB", 2019, "LSE-001"),
            ("AC-008", "MSN-5241", "B737 MAX 8", "A6-EBX", 2020, "LSE-006"),
        ]
        ac_objs = {}
        for acid, msn, atype, reg, vintage, _ in aircraft_data:
            ac = Aircraft(
                id=acid, tenant_id=DEMO_TENANT_ID,
                msn=msn, aircraft_type=atype, registration=reg, vintage=vintage,
            )
            db.add(ac)
            ac_objs[acid] = ac

        # ── Valuations ────────────────────────────────────────────────────────
        valuations = [
            ("AC-001", 38_500_000, 36_100_000, 40_200_000, 32_800_000, 18_000_000, 12),
            ("AC-002", 45_200_000, 42_300_000, 47_100_000, 39_500_000, 21_000_000, 10),
            ("AC-006", 112_000_000, 108_500_000, 115_200_000, 102_000_000, 55_000_000, 8),
        ]
        for acid, hlb, mv, mav, le, po, band in valuations:
            db.add(Valuation(
                id=str(uuid.uuid4()), aircraft_id=acid, tenant_id=DEMO_TENANT_ID,
                source=ValuationSource.heuristic,
                half_life_base=Decimal(hlb), current_mv=Decimal(mv),
                mav=Decimal(mav), lease_encumbered=Decimal(le),
                part_out=Decimal(po), uncertainty_band_pct=Decimal(band),
                as_of_date=date(2026, 4, 30),
            ))

        # ── Leases ────────────────────────────────────────────────────────────
        leases_data = [
            ("LS-001", "LSE-001", "AC-001", date(2020, 3, 1), date(2027, 2, 28), 385_000, LeaseStage.stage3),
            ("LS-002", "LSE-002", "AC-002", date(2021, 6, 1), date(2026, 5, 31), 425_000, LeaseStage.stage3),
            ("LS-003", "LSE-003", "AC-003", date(2019, 1, 15), date(2025, 1, 14), 520_000, LeaseStage.stage2),
            ("LS-004", "LSE-004", "AC-004", date(2022, 8, 1), date(2028, 7, 31), 310_000, LeaseStage.stage2),
            ("LS-005", "LSE-005", "AC-005", date(2020, 11, 1), date(2026, 10, 31), 415_000, LeaseStage.stage2),
            ("LS-006", "LSE-006", "AC-006", date(2018, 4, 1), date(2030, 3, 31), 1_100_000, LeaseStage.stage1),
            ("LS-007", "LSE-001", "AC-007", date(2019, 7, 1), date(2026, 6, 30), 385_000, LeaseStage.stage3),
            ("LS-008", "LSE-006", "AC-008", date(2020, 9, 1), date(2028, 8, 31), 445_000, LeaseStage.stage1),
        ]
        for lid, lessee_id, ac_id, start, end, rent, stage in leases_data:
            db.add(Lease(
                id=lid, tenant_id=DEMO_TENANT_ID,
                lessee_id=lessee_id, aircraft_id=ac_id,
                lease_start=start, lease_end=end,
                monthly_rent_usd=Decimal(rent),
                stage=stage, status=LeaseStatus.active,
            ))

        # ── Security Deposits ─────────────────────────────────────────────────
        sd_data = [
            ("LS-001", SDType.cash, 1_155_000),
            ("LS-002", SDType.lc, 1_275_000),
            ("LS-006", SDType.cash, 3_300_000),
        ]
        for lease_id, sd_type, amount in sd_data:
            db.add(SecurityDeposit(
                id=str(uuid.uuid4()), lease_id=lease_id, tenant_id=DEMO_TENANT_ID,
                sd_type=sd_type, amount=Decimal(amount), currency="USD",
            ))

        # ── Maintenance Reserves ─────────────────────────────────────────────
        for lease_id in ["LS-001", "LS-006"]:
            for component, rate in [("airframe_hsi", 95), ("engine_pr", 180), ("llp", 240)]:
                db.add(MaintenanceReserve(
                    id=str(uuid.uuid4()), lease_id=lease_id, tenant_id=DEMO_TENANT_ID,
                    component=component, rate_basis="per_fh",
                    rate_amount=Decimal(rate), refundable=True,
                    cumulative_balance=Decimal(rate * 1200),
                ))

        # ── Scenario Templates ────────────────────────────────────────────────
        templates = [
            ("TMPL-001", "Baseline Q1 2026", "Central economic scenario — gradual recovery",
             {"gdp_shock": 0.0, "rpk_growth": 0.045, "fuel_delta": 0.0, "fx_stress": 0.0}, 60),
            ("TMPL-002", "Adverse — Fuel Spike +40%", "WTI/Brent +40% sustained 12 months",
             {"gdp_shock": -0.01, "rpk_growth": -0.12, "fuel_delta": 0.40, "fx_stress": 0.05}, 25),
            ("TMPL-003", "Severe — Global Recession",
             "GDP -3%, RPK -25%, fuel +20%, EM FX -15%",
             {"gdp_shock": -0.03, "rpk_growth": -0.25, "fuel_delta": 0.20, "fx_stress": 0.15}, 15),
        ]
        for tid, name, desc, inputs, weight in templates:
            db.add(ScenarioTemplate(
                id=tid, tenant_id=DEMO_TENANT_ID,
                name=name, description=desc,
                inputs_json=inputs, is_system=True,
                weight_pct=Decimal(weight),
            ))

        # ── Watchlist Config ──────────────────────────────────────────────────
        db.add(WatchlistConfig(
            id=str(uuid.uuid4()), tenant_id=DEMO_TENANT_ID,
            signal_weights_json={
                "paymentLateness": 35,
                "scheduleQoQ": 25,
                "ratingChange": 20,
                "ctcWatchlist": 10,
                "newsKeywordHits": 10,
            },
            red_threshold=70,
            amber_threshold=40,
        ))

        # ── SICR Config ───────────────────────────────────────────────────────
        db.add(SICRConfig(
            id=str(uuid.uuid4()), tenant_id=DEMO_TENANT_ID,
            dpd_enabled=True, dpd_days=30,
            upgrade_enabled=True, upgrade_notches=2,
            country_watchlist_enabled=True, insolvency_enabled=True,
        ))

        # ── Audit log seed entries ────────────────────────────────────────────
        audit_entries = [
            ("AUD-9814", "USR-002", "alex@aerinsights.com", "Export: Auditor Evidence Pack"),
            ("AUD-9813", "USR-002", "alex@aerinsights.com", "Run Scenario"),
            ("AUD-9812", "USR-001", "john@aerinsights.com", "Login"),
            ("AUD-9811", "USR-003", "sarah@aerinsights.com", "Export: Portfolio Register"),
        ]
        for aid, uid, email, action in audit_entries:
            db.add(AuditLog(
                id=aid, tenant_id=DEMO_TENANT_ID,
                user_id=uid, user_email=email,
                action=action, ip_address="10.0.1.44",
            ))

        await db.commit()
        print(f"✅ Demo seed complete — tenant: {DEMO_TENANT_ID}")
        print(f"   {len(lessees_data)} lessees, {len(leases_data)} leases, {len(aircraft_data)} aircraft")
        print(f"   {len(templates)} scenario templates, watchlist + SICR config")


if __name__ == "__main__":
    asyncio.run(seed())
