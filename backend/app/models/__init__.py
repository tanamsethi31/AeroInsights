from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    BigInteger, Boolean, Date, DateTime, Enum, ForeignKey,
    Integer, Numeric, String, Text, UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


# ── Helpers ───────────────────────────────────────────────────────────────────

def gen_uuid() -> str:
    return str(uuid.uuid4())


# ── Enums ─────────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    admin = "admin"
    risk = "risk"
    accounting = "accounting"
    readonly = "readonly"


class LeaseStage(str, enum.Enum):
    stage1 = "1"
    stage2 = "2"
    stage3 = "3"


class LeaseStatus(str, enum.Enum):
    active = "active"
    terminated = "terminated"
    expired = "expired"


class WatchlistStatus(str, enum.Enum):
    green = "green"
    amber = "amber"
    red = "red"


class RunMode(str, enum.Enum):
    deterministic = "deterministic"
    montecarlo = "montecarlo"


class ValuationSource(str, enum.Enum):
    heuristic = "heuristic"
    avitas = "avitas"
    cirium = "cirium"
    iba = "iba"
    user = "user"


class SDType(str, enum.Enum):
    cash = "cash"
    lc = "lc"


# ── Base mixin ────────────────────────────────────────────────────────────────

class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
        onupdate=func.now(), nullable=False
    )


# ── Tenant ────────────────────────────────────────────────────────────────────

class Tenant(TimestampMixin, Base):
    __tablename__ = "tenants"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    primary_currency: Mapped[str] = mapped_column(String(3), default="USD")
    timezone: Mapped[str] = mapped_column(String(64), default="Europe/Dublin")
    fiscal_year_end: Mapped[str] = mapped_column(String(10), default="12-31")
    ifrs9_adoption_date: Mapped[Optional[date]] = mapped_column(Date)
    default_discount_rate: Mapped[Decimal] = mapped_column(Numeric(6, 4), default=Decimal("0.0575"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    users: Mapped[list[User]] = relationship(back_populates="tenant", cascade="all, delete-orphan")
    lessees: Mapped[list[Lessee]] = relationship(back_populates="tenant", cascade="all, delete-orphan")
    scenario_runs: Mapped[list[ScenarioRun]] = relationship(back_populates="tenant")


# ── User ──────────────────────────────────────────────────────────────────────

class User(TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("tenant_id", "email"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)
    auth0_sub: Mapped[Optional[str]] = mapped_column(String(255), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.readonly)
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    tenant: Mapped[Tenant] = relationship(back_populates="users")


# ── Lessee ────────────────────────────────────────────────────────────────────

class Lessee(TimestampMixin, Base):
    __tablename__ = "lessees"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    country_code: Mapped[str] = mapped_column(String(3), nullable=False)
    credit_rating: Mapped[Optional[str]] = mapped_column(String(10))
    stage: Mapped[LeaseStage] = mapped_column(Enum(LeaseStage), default=LeaseStage.stage1)
    watchlist_status: Mapped[WatchlistStatus] = mapped_column(Enum(WatchlistStatus), default=WatchlistStatus.green)
    behavior_score: Mapped[Optional[int]] = mapped_column(Integer)
    behavior_scores_json: Mapped[Optional[dict]] = mapped_column(JSONB)  # sub-scores
    notes: Mapped[Optional[str]] = mapped_column(Text)

    tenant: Mapped[Tenant] = relationship(back_populates="lessees")
    leases: Mapped[list[Lease]] = relationship(back_populates="lessee")
    behavior_score_history: Mapped[list[BehaviorScoreHistory]] = relationship(back_populates="lessee")


# ── Aircraft ──────────────────────────────────────────────────────────────────

class Aircraft(TimestampMixin, Base):
    __tablename__ = "aircraft"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)
    msn: Mapped[str] = mapped_column(String(20), nullable=False)
    aircraft_type: Mapped[str] = mapped_column(String(50), nullable=False)
    registration: Mapped[Optional[str]] = mapped_column(String(20))
    vintage: Mapped[Optional[int]] = mapped_column(Integer)

    leases: Mapped[list[Lease]] = relationship(back_populates="aircraft")
    valuations: Mapped[list[Valuation]] = relationship(back_populates="aircraft", cascade="all, delete-orphan")


# ── Lease ─────────────────────────────────────────────────────────────────────

class Lease(TimestampMixin, Base):
    __tablename__ = "leases"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)
    lessee_id: Mapped[str] = mapped_column(String(36), ForeignKey("lessees.id"), nullable=False, index=True)
    aircraft_id: Mapped[str] = mapped_column(String(36), ForeignKey("aircraft.id"), nullable=False, index=True)
    lease_start: Mapped[date] = mapped_column(Date, nullable=False)
    lease_end: Mapped[date] = mapped_column(Date, nullable=False)
    monthly_rent_usd: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    stage: Mapped[LeaseStage] = mapped_column(Enum(LeaseStage), default=LeaseStage.stage1)
    status: Mapped[LeaseStatus] = mapped_column(Enum(LeaseStatus), default=LeaseStatus.active)
    sicr_trigger: Mapped[Optional[str]] = mapped_column(Text)

    lessee: Mapped[Lessee] = relationship(back_populates="leases")
    aircraft: Mapped[Aircraft] = relationship(back_populates="leases")
    payments: Mapped[list[Payment]] = relationship(back_populates="lease", cascade="all, delete-orphan")
    security_deposits: Mapped[list[SecurityDeposit]] = relationship(back_populates="lease", cascade="all, delete-orphan")
    maintenance_reserves: Mapped[list[MaintenanceReserve]] = relationship(back_populates="lease", cascade="all, delete-orphan")
    ecl_records: Mapped[list[ECLRecord]] = relationship(back_populates="lease")


# ── Payment ───────────────────────────────────────────────────────────────────

class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    lease_id: Mapped[str] = mapped_column(String(36), ForeignKey("leases.id"), nullable=False, index=True)
    tenant_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    paid_date: Mapped[Optional[date]] = mapped_column(Date)
    amount_usd: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    days_late: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    lease: Mapped[Lease] = relationship(back_populates="payments")


# ── Security Deposit ──────────────────────────────────────────────────────────

class SecurityDeposit(TimestampMixin, Base):
    __tablename__ = "security_deposits"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    lease_id: Mapped[str] = mapped_column(String(36), ForeignKey("leases.id"), nullable=False, index=True)
    tenant_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    sd_type: Mapped[SDType] = mapped_column(Enum(SDType), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    refund_triggers: Mapped[Optional[str]] = mapped_column(Text)
    governing_law: Mapped[Optional[str]] = mapped_column(String(100))

    lease: Mapped[Lease] = relationship(back_populates="security_deposits")


# ── Maintenance Reserve ───────────────────────────────────────────────────────

class MaintenanceReserve(TimestampMixin, Base):
    __tablename__ = "maintenance_reserves"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    lease_id: Mapped[str] = mapped_column(String(36), ForeignKey("leases.id"), nullable=False, index=True)
    tenant_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    component: Mapped[str] = mapped_column(String(100), nullable=False)  # airframe_hsi, engine_pr, llp, gear, apu
    rate_basis: Mapped[str] = mapped_column(String(20), nullable=False)   # per_fh, per_cycle
    rate_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    refundable: Mapped[bool] = mapped_column(Boolean, default=True)
    cap_rule: Mapped[Optional[str]] = mapped_column(Text)
    cumulative_balance: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))

    lease: Mapped[Lease] = relationship(back_populates="maintenance_reserves")


# ── Valuation ─────────────────────────────────────────────────────────────────

class Valuation(TimestampMixin, Base):
    __tablename__ = "valuations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    aircraft_id: Mapped[str] = mapped_column(String(36), ForeignKey("aircraft.id"), nullable=False, index=True)
    tenant_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    source: Mapped[ValuationSource] = mapped_column(Enum(ValuationSource), nullable=False)
    half_life_base: Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2))
    current_mv: Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2))
    mav: Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2))
    lease_encumbered: Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2))
    part_out: Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2))
    uncertainty_band_pct: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))
    as_of_date: Mapped[date] = mapped_column(Date, nullable=False)

    aircraft: Mapped[Aircraft] = relationship(back_populates="valuations")


# ── Scenario Template ─────────────────────────────────────────────────────────

class ScenarioTemplate(TimestampMixin, Base):
    __tablename__ = "scenario_templates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(36), index=True)  # None = system template
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    inputs_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    weight_pct: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))

    runs: Mapped[list[ScenarioRun]] = relationship(back_populates="template")


# ── Scenario Run (immutable) ───────────────────────────────────────────────────

class ScenarioRun(Base):
    __tablename__ = "scenario_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), nullable=False, index=True)
    template_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("scenario_templates.id"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    mode: Mapped[RunMode] = mapped_column(Enum(RunMode), nullable=False)
    paths: Mapped[Optional[int]] = mapped_column(Integer)
    seed: Mapped[int] = mapped_column(Integer, nullable=False)
    inputs_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    portfolio_snapshot_id: Mapped[Optional[str]] = mapped_column(String(36))
    ecl_result: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4))
    p5: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4))
    p95: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4))
    s1_ecl: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4))
    s2_ecl: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4))
    s3_ecl: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4))
    shapley_json: Mapped[Optional[dict]] = mapped_column(JSONB)
    key_finding: Mapped[Optional[str]] = mapped_column(Text)
    duration_sec: Mapped[Optional[str]] = mapped_column(String(20))
    scenario_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending/running/complete/failed
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_by: Mapped[Optional[str]] = mapped_column(String(36))  # user_id

    tenant: Mapped[Tenant] = relationship(back_populates="scenario_runs")
    template: Mapped[Optional[ScenarioTemplate]] = relationship(back_populates="runs")
    lease_results: Mapped[list[RunLeaseResult]] = relationship(back_populates="run", cascade="all, delete-orphan")


# ── Run Lease Result ──────────────────────────────────────────────────────────

class RunLeaseResult(Base):
    __tablename__ = "run_lease_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("scenario_runs.id"), nullable=False, index=True)
    lease_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    pd_12m: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4))
    pd_lifetime: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4))
    lgd: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 4))
    ead: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4))
    ecl_12m: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4))
    ecl_lifetime: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4))
    stage: Mapped[Optional[str]] = mapped_column(String(1))
    journal_movement: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4))

    run: Mapped[ScenarioRun] = relationship(back_populates="lease_results")


# ── ECL Record ────────────────────────────────────────────────────────────────

class ECLRecord(TimestampMixin, Base):
    __tablename__ = "ecl_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    lease_id: Mapped[str] = mapped_column(String(36), ForeignKey("leases.id"), nullable=False, index=True)
    tenant_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    as_of_date: Mapped[date] = mapped_column(Date, nullable=False)
    run_id: Mapped[Optional[str]] = mapped_column(String(36))
    scenario_weights_json: Mapped[Optional[dict]] = mapped_column(JSONB)
    weighted_ecl_12m: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4))
    weighted_ecl_lifetime: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 4))
    stage: Mapped[LeaseStage] = mapped_column(Enum(LeaseStage), nullable=False)
    sicr_trigger: Mapped[Optional[str]] = mapped_column(Text)

    lease: Mapped[Lease] = relationship(back_populates="ecl_records")


# ── Stage Migration ───────────────────────────────────────────────────────────

class StageMigration(Base):
    __tablename__ = "stage_migrations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    tenant_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    lease_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    from_stage: Mapped[str] = mapped_column(String(1), nullable=False)
    to_stage: Mapped[str] = mapped_column(String(1), nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text)
    migration_date: Mapped[date] = mapped_column(Date, nullable=False)
    run_id: Mapped[Optional[str]] = mapped_column(String(36))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ── Behavior Score History ────────────────────────────────────────────────────

class BehaviorScoreHistory(Base):
    __tablename__ = "behavior_score_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    lessee_id: Mapped[str] = mapped_column(String(36), ForeignKey("lessees.id"), nullable=False, index=True)
    tenant_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    as_of_date: Mapped[date] = mapped_column(Date, nullable=False)
    overall_score: Mapped[int] = mapped_column(Integer, nullable=False)
    sub_scores_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    lessee: Mapped[Lessee] = relationship(back_populates="behavior_score_history")


# ── Audit Log (immutable) ─────────────────────────────────────────────────────

class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(36), index=True)
    user_id: Mapped[Optional[str]] = mapped_column(String(36), index=True)
    user_email: Mapped[Optional[str]] = mapped_column(String(255))
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_type: Mapped[Optional[str]] = mapped_column(String(50))
    resource_id: Mapped[Optional[str]] = mapped_column(String(36))
    before_hash: Mapped[Optional[str]] = mapped_column(String(64))
    after_hash: Mapped[Optional[str]] = mapped_column(String(64))
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    meta_json: Mapped[Optional[dict]] = mapped_column(JSONB)


# ── Export ────────────────────────────────────────────────────────────────────

class Export(Base):
    __tablename__ = "exports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    tenant_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    report_type: Mapped[str] = mapped_column(String(100), nullable=False)
    format: Mapped[str] = mapped_column(String(10), nullable=False)
    s3_key: Mapped[Optional[str]] = mapped_column(String(500))
    size_bytes: Mapped[Optional[int]] = mapped_column(BigInteger)
    data_hash: Mapped[Optional[str]] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_by: Mapped[Optional[str]] = mapped_column(String(36))


# ── Scheduled Report ──────────────────────────────────────────────────────────

class ScheduledReport(TimestampMixin, Base):
    __tablename__ = "scheduled_reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    tenant_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    frequency: Mapped[str] = mapped_column(String(20), nullable=False)  # daily, weekly, monthly, quarterly
    day: Mapped[Optional[str]] = mapped_column(String(20))
    run_time: Mapped[str] = mapped_column(String(5), nullable=False)  # HH:MM
    recipients_json: Mapped[list] = mapped_column(JSONB, default=list)
    report_template_id: Mapped[Optional[str]] = mapped_column(String(36))
    status: Mapped[str] = mapped_column(String(20), default="active")
    next_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


# ── Watchlist Config ──────────────────────────────────────────────────────────

class WatchlistConfig(TimestampMixin, Base):
    __tablename__ = "watchlist_config"
    __table_args__ = (UniqueConstraint("tenant_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    tenant_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    signal_weights_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    red_threshold: Mapped[int] = mapped_column(Integer, default=70)
    amber_threshold: Mapped[int] = mapped_column(Integer, default=40)


# ── SICR Config ───────────────────────────────────────────────────────────────

class SICRConfig(TimestampMixin, Base):
    __tablename__ = "sicr_config"
    __table_args__ = (UniqueConstraint("tenant_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    tenant_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    dpd_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    dpd_days: Mapped[int] = mapped_column(Integer, default=30)
    upgrade_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    upgrade_notches: Mapped[int] = mapped_column(Integer, default=2)
    country_watchlist_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    insolvency_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
