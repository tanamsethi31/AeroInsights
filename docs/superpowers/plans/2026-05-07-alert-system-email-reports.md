# Alert System & Email Report Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Bell icon to an exception-based RAG alert system (backend + frontend) and the Mail icon to a frontend-only email report distribution modal.

**Architecture:** Backend adds `alert_rules` and `alerts` SQLAlchemy models with a FastAPI CRUD layer; the frontend has a mock-data alertService (no live DB required for prototype), an AlertsPanel dropdown, an AlertRulesConfig settings modal, and an EmailReportModal triggered from the Mail icon. Header.tsx is wired last to avoid broken imports during development.

**Tech Stack:** FastAPI 0.110, SQLAlchemy 2 async mapped columns, Alembic, Pydantic v2, React 18 + TypeScript, inline styles matching `#002147` / `#0F172A` / `#E2E8F0` design tokens. Validation: `node_modules/.bin/vite build`.

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `backend/app/models/__init__.py` | Add `AlertRuleType` enum, `AlertRule` model, `Alert` model |
| Create | `backend/alembic/versions/0002_add_alerts.py` | Migration for alert_rules + alerts tables |
| Create | `backend/app/schemas/alerts.py` | Pydantic request/response schemas |
| Create | `backend/app/api/v1/endpoints/alerts.py` | CRUD endpoints |
| Modify | `backend/app/api/v1/router.py` | Include alerts router |
| Create | `src/app/data/alertsData.ts` | 12 mock Alert objects |
| Create | `src/app/services/alertService.ts` | In-memory store, mark-read, clear-all |
| Create | `src/app/components/alerts/AlertsPanel.tsx` | Bell dropdown panel |
| Create | `src/app/components/alerts/AlertRulesConfig.tsx` | Rule threshold settings modal |
| Create | `src/app/components/reports/EmailReportModal.tsx` | Mail icon modal |
| Modify | `src/app/components/layout/Header.tsx` | Wire click handlers + dynamic badge |

---

### Task 1: Backend Alert Models

**Files:**
- Modify: `backend/app/models/__init__.py`

- [ ] **Step 1: Add enums and models to the end of `backend/app/models/__init__.py`**

Append the following after the `WatchlistConfig` class (before the `SICRConfig` class — actually append at the very end of the file, after `SICRConfig`):

```python
# ── Alert Rule ────────────────────────────────────────────────────────────────

class AlertRuleType(str, enum.Enum):
    stage_migration = "stage_migration"
    watchlist_elevation = "watchlist_elevation"
    ecl_threshold = "ecl_threshold"
    signal_severity = "signal_severity"
    jurisdiction_risk = "jurisdiction_risk"
    fuel_stress = "fuel_stress"
    composite_signal = "composite_signal"


class AlertSeverity(str, enum.Enum):
    red = "red"
    amber = "amber"
    green = "green"


class AlertRule(TimestampMixin, Base):
    __tablename__ = "alert_rules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    tenant_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    rule_type: Mapped[AlertRuleType] = mapped_column(Enum(AlertRuleType), nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    threshold_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    alerts: Mapped[list["Alert"]] = relationship(back_populates="rule", cascade="all, delete-orphan")


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    tenant_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    rule_id: Mapped[str] = mapped_column(String(36), ForeignKey("alert_rules.id"), nullable=False, index=True)
    severity: Mapped[AlertSeverity] = mapped_column(Enum(AlertSeverity), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    entity_type: Mapped[Optional[str]] = mapped_column(String(50))  # lessee / lease / portfolio
    entity_id: Mapped[Optional[str]] = mapped_column(String(36))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    rule: Mapped[AlertRule] = relationship(back_populates="alerts")
```

- [ ] **Step 2: Build to verify no import errors**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && node_modules/.bin/vite build 2>&1 | tail -5
```

Expected: `✓ built in` (frontend build; backend imports verified separately when backend runs)

---

### Task 2: Alembic Migration

**Files:**
- Create: `backend/alembic/versions/0002_add_alerts.py`

- [ ] **Step 1: Create the migration file**

```python
"""add alert_rules and alerts tables

Revision ID: 0002_add_alerts
Revises: 85734ba34a2f
Create Date: 2026-05-07

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0002_add_alerts"
down_revision: Union[str, None] = "85734ba34a2f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "alert_rules",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column(
            "rule_type",
            sa.Enum(
                "stage_migration",
                "watchlist_elevation",
                "ecl_threshold",
                "signal_severity",
                "jurisdiction_risk",
                "fuel_stress",
                "composite_signal",
                name="alertruletype",
            ),
            nullable=False,
        ),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("threshold_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("label", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_alert_rules_tenant_id", "alert_rules", ["tenant_id"])

    op.create_table(
        "alerts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column("rule_id", sa.String(36), sa.ForeignKey("alert_rules.id"), nullable=False),
        sa.Column(
            "severity",
            sa.Enum("red", "amber", "green", name="alertseverity"),
            nullable=False,
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=True),
        sa.Column("entity_id", sa.String(36), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False, index=True),
    )
    op.create_index("ix_alerts_tenant_id", "alerts", ["tenant_id"])
    op.create_index("ix_alerts_rule_id", "alerts", ["rule_id"])
    op.create_index("ix_alerts_created_at", "alerts", ["created_at"])


def downgrade() -> None:
    op.drop_table("alerts")
    op.drop_table("alert_rules")
    op.execute("DROP TYPE IF EXISTS alertseverity")
    op.execute("DROP TYPE IF EXISTS alertruletype")
```

- [ ] **Step 2: Verify frontend build still passes**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && node_modules/.bin/vite build 2>&1 | tail -3
```

Expected: `✓ built in`

---

### Task 3: Pydantic Alert Schemas

**Files:**
- Create: `backend/app/schemas/alerts.py`

- [ ] **Step 1: Create the schemas file**

```python
from __future__ import annotations

from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel

from app.models import AlertRuleType, AlertSeverity


# ── Alert Rule schemas ────────────────────────────────────────────────────────

class AlertRuleOut(BaseModel):
    id: str
    tenant_id: str
    rule_type: AlertRuleType
    is_enabled: bool
    threshold_json: dict[str, Any]
    label: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class AlertRuleCreate(BaseModel):
    rule_type: AlertRuleType
    is_enabled: bool = True
    threshold_json: dict[str, Any] = {}
    label: str
    description: Optional[str] = None


class AlertRuleUpdate(BaseModel):
    is_enabled: Optional[bool] = None
    threshold_json: Optional[dict[str, Any]] = None
    label: Optional[str] = None
    description: Optional[str] = None


# ── Alert schemas ─────────────────────────────────────────────────────────────

class AlertOut(BaseModel):
    id: str
    tenant_id: str
    rule_id: str
    severity: AlertSeverity
    title: str
    body: str
    entity_type: Optional[str]
    entity_id: Optional[str]
    is_read: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class AlertMarkRead(BaseModel):
    alert_ids: list[str]
```

- [ ] **Step 2: Verify frontend build**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && node_modules/.bin/vite build 2>&1 | tail -3
```

Expected: `✓ built in`

---

### Task 4: FastAPI Alert Endpoints

**Files:**
- Create: `backend/app/api/v1/endpoints/alerts.py`

- [ ] **Step 1: Create the endpoints file**

```python
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_write
from app.core.database import get_db
from app.models import AlertRule, Alert, User
from app.schemas.alerts import (
    AlertRuleCreate,
    AlertRuleOut,
    AlertRuleUpdate,
    AlertOut,
    AlertMarkRead,
)
from app.schemas.pagination import Page

router = APIRouter()


# ── Alert Rules ───────────────────────────────────────────────────────────────

@router.get("/rules", response_model=list[AlertRuleOut])
async def list_alert_rules(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AlertRule]:
    result = await db.execute(
        select(AlertRule).where(AlertRule.tenant_id == current_user.tenant_id)
    )
    return list(result.scalars().all())


@router.post("/rules", response_model=AlertRuleOut, status_code=201)
async def create_alert_rule(
    payload: AlertRuleCreate,
    current_user: User = Depends(require_write),
    db: AsyncSession = Depends(get_db),
) -> AlertRule:
    rule = AlertRule(**payload.model_dump(), tenant_id=current_user.tenant_id)
    db.add(rule)
    await db.flush()
    return rule


@router.patch("/rules/{rule_id}", response_model=AlertRuleOut)
async def update_alert_rule(
    rule_id: str,
    payload: AlertRuleUpdate,
    current_user: User = Depends(require_write),
    db: AsyncSession = Depends(get_db),
) -> AlertRule:
    result = await db.execute(
        select(AlertRule).where(
            AlertRule.id == rule_id,
            AlertRule.tenant_id == current_user.tenant_id,
        )
    )
    rule = result.scalar_one_or_none()
    if rule is None:
        raise HTTPException(status_code=404, detail="Alert rule not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(rule, field, value)
    await db.flush()
    return rule


@router.delete("/rules/{rule_id}", status_code=204)
async def delete_alert_rule(
    rule_id: str,
    current_user: User = Depends(require_write),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(AlertRule).where(
            AlertRule.id == rule_id,
            AlertRule.tenant_id == current_user.tenant_id,
        )
    )
    rule = result.scalar_one_or_none()
    if rule is None:
        raise HTTPException(status_code=404, detail="Alert rule not found")
    await db.delete(rule)


# ── Alerts ────────────────────────────────────────────────────────────────────

@router.get("", response_model=Page[AlertOut])
async def list_alerts(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    unread_only: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Page[AlertOut]:
    q = (
        select(Alert)
        .where(Alert.tenant_id == current_user.tenant_id)
        .order_by(Alert.created_at.desc())
    )
    if unread_only:
        q = q.where(Alert.is_read.is_(False))
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    items = (await db.execute(q.offset((page - 1) * page_size).limit(page_size))).scalars().all()
    return Page(items=list(items), total=total, page=page, page_size=page_size)


@router.get("/unread-count")
async def unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    count = (
        await db.execute(
            select(func.count()).where(
                Alert.tenant_id == current_user.tenant_id,
                Alert.is_read.is_(False),
            )
        )
    ).scalar_one()
    return {"count": count}


@router.post("/mark-read", status_code=200)
async def mark_alerts_read(
    payload: AlertMarkRead,
    current_user: User = Depends(require_write),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await db.execute(
        update(Alert)
        .where(
            Alert.id.in_(payload.alert_ids),
            Alert.tenant_id == current_user.tenant_id,
        )
        .values(is_read=True)
    )
    return {"updated": len(payload.alert_ids)}


@router.post("/mark-all-read", status_code=200)
async def mark_all_read(
    current_user: User = Depends(require_write),
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(
        update(Alert)
        .where(Alert.tenant_id == current_user.tenant_id, Alert.is_read.is_(False))
        .values(is_read=True)
    )
    return {"updated": result.rowcount}
```

- [ ] **Step 2: Verify frontend build**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && node_modules/.bin/vite build 2>&1 | tail -3
```

Expected: `✓ built in`

---

### Task 5: Wire Alerts Router

**Files:**
- Modify: `backend/app/api/v1/router.py`

- [ ] **Step 1: Import and register the alerts router**

In `backend/app/api/v1/router.py`, add the import:

```python
from app.api.v1.endpoints import (
    auth,
    tenants,
    users,
    lessees,
    leases,
    aircraft,
    payments,
    security_deposits,
    maintenance_reserves,
    valuations,
    imports,
    audit_log,
    health,
    excel,
    alerts,
)
```

Then add at the end of the router registrations:

```python
api_router.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
```

- [ ] **Step 2: Verify frontend build**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && node_modules/.bin/vite build 2>&1 | tail -3
```

Expected: `✓ built in`

---

### Task 6: Mock Alert Data

**Files:**
- Create: `src/app/data/alertsData.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/app/data/alertsData.ts

export type AlertSeverity = "red" | "amber" | "green";

export type AlertType =
  | "stage_migration"
  | "watchlist_elevation"
  | "ecl_threshold"
  | "signal_severity"
  | "jurisdiction_risk"
  | "fuel_stress"
  | "composite_signal";

export interface AlertItem {
  id: string;
  ruleType: AlertType;
  severity: AlertSeverity;
  title: string;
  body: string;
  entityType?: "lessee" | "lease" | "portfolio";
  entityId?: string;
  isRead: boolean;
  createdAt: string; // ISO-8601
}

export interface AlertRuleConfig {
  id: string;
  ruleType: AlertType;
  label: string;
  description: string;
  isEnabled: boolean;
  threshold: Record<string, number | string>;
}

// ── Mock alert rules (user-configurable thresholds) ───────────────────────────

export const DEFAULT_ALERT_RULES: AlertRuleConfig[] = [
  {
    id: "rule-1",
    ruleType: "stage_migration",
    label: "Stage Migration",
    description: "Alert when a lease migrates to a higher IFRS 9 stage",
    isEnabled: true,
    threshold: { direction: "upgrade" }, // "upgrade" = S1→S2, S2→S3
  },
  {
    id: "rule-2",
    ruleType: "watchlist_elevation",
    label: "Watchlist Elevation",
    description: "Alert when a lessee moves from Green → Amber or Amber → Red",
    isEnabled: true,
    threshold: { minLevel: "amber" },
  },
  {
    id: "rule-3",
    ruleType: "ecl_threshold",
    label: "ECL Threshold Breach",
    description: "Alert when portfolio ECL exceeds configured USD threshold",
    isEnabled: true,
    threshold: { maxEclUsd: 5000000 },
  },
  {
    id: "rule-4",
    ruleType: "signal_severity",
    label: "High Severity Intelligence Signal",
    description: "Alert when an intelligence signal is rated Critical or High",
    isEnabled: true,
    threshold: { minSeverity: "High" },
  },
  {
    id: "rule-5",
    ruleType: "jurisdiction_risk",
    label: "Jurisdiction Risk Spike",
    description: "Alert when a country risk score rises above threshold",
    isEnabled: false,
    threshold: { maxRiskScore: 80 },
  },
  {
    id: "rule-6",
    ruleType: "fuel_stress",
    label: "Fuel Price Stress",
    description: "Alert when fuel delta scenario impact exceeds tolerance",
    isEnabled: false,
    threshold: { fuelDeltaPct: 0.3 },
  },
  {
    id: "rule-7",
    ruleType: "composite_signal",
    label: "Composite Red Signal",
    description: "Alert when a lessee's composite score crosses into Red",
    isEnabled: true,
    threshold: {},
  },
];

// ── Mock alerts (12 items, mix of read/unread) ────────────────────────────────

export const MOCK_ALERTS: AlertItem[] = [
  {
    id: "alert-001",
    ruleType: "stage_migration",
    severity: "red",
    title: "Stage Migration: S2 → S3",
    body: "Lease LEA-0024 (Air Meridian) has migrated from Stage 2 to Stage 3. Lifetime ECL provisioning now required.",
    entityType: "lease",
    entityId: "LEA-0024",
    isRead: false,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "alert-002",
    ruleType: "watchlist_elevation",
    severity: "red",
    title: "Watchlist Elevated: Amber → Red",
    body: "SkyLink Aviation has moved to Red watchlist status following 2 consecutive missed payments and deteriorating behavior score (31/100).",
    entityType: "lessee",
    entityId: "LSE-0007",
    isRead: false,
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "alert-003",
    ruleType: "ecl_threshold",
    severity: "amber",
    title: "ECL Threshold Breach",
    body: "Portfolio ECL has reached $5.24M, exceeding the configured threshold of $5.0M. Stress scenario weighting may require review.",
    entityType: "portfolio",
    isRead: false,
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "alert-004",
    ruleType: "composite_signal",
    severity: "red",
    title: "Composite Red Signal",
    body: "Pacific Wings has crossed into composite Red status. Contributing factors: payment delinquency (+40pts), jurisdiction risk (+25pts), fuel exposure (+15pts).",
    entityType: "lessee",
    entityId: "LSE-0011",
    isRead: false,
    createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "alert-005",
    ruleType: "signal_severity",
    severity: "amber",
    title: "High Severity Intelligence Signal",
    body: "New Critical signal: 'LATAM Fuel Subsidy Removal' — 7 leases in affected region. Review counterparty exposure.",
    isRead: false,
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "alert-006",
    ruleType: "stage_migration",
    severity: "amber",
    title: "Stage Migration: S1 → S2",
    body: "Lease LEA-0031 (Nordic Charter) has migrated from Stage 1 to Stage 2 (SICR triggered: 32-day payment overdue).",
    entityType: "lease",
    entityId: "LEA-0031",
    isRead: false,
    createdAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "alert-007",
    ruleType: "watchlist_elevation",
    severity: "amber",
    title: "Watchlist Elevated: Green → Amber",
    body: "Iberian Sky has moved to Amber watchlist following a 1-notch rating downgrade and 15-day payment delay.",
    entityType: "lessee",
    entityId: "LSE-0003",
    isRead: true,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "alert-008",
    ruleType: "composite_signal",
    severity: "amber",
    title: "Composite Amber Signal",
    body: "Gulf Air Partners composite score has deteriorated to Amber (52/100). Fuel delta exposure is the primary driver.",
    entityType: "lessee",
    entityId: "LSE-0009",
    isRead: true,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "alert-009",
    ruleType: "ecl_threshold",
    severity: "green",
    title: "ECL Within Threshold",
    body: "Following scenario re-run with updated GDP inputs, portfolio ECL has returned to $4.71M — below the $5.0M threshold.",
    entityType: "portfolio",
    isRead: true,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "alert-010",
    ruleType: "signal_severity",
    severity: "amber",
    title: "High Severity Signal: Asian Monsoon Season",
    body: "Seasonal disruption signal elevated to High for 3 SEA lessees. Maintenance reserves for affected aircraft are within tolerance.",
    isRead: true,
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "alert-011",
    ruleType: "stage_migration",
    severity: "green",
    title: "Stage Reversal: S2 → S1",
    body: "Lease LEA-0018 (TransAtlantic) has returned to Stage 1 following 3 consecutive on-time payments and credit score improvement.",
    entityType: "lease",
    entityId: "LEA-0018",
    isRead: true,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "alert-012",
    ruleType: "watchlist_elevation",
    severity: "green",
    title: "Watchlist Improvement: Amber → Green",
    body: "Continental Express has been downgraded to Green status after sustained payment compliance over 90 days.",
    entityType: "lessee",
    entityId: "LSE-0002",
    isRead: true,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
];
```

- [ ] **Step 2: Verify frontend build**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && node_modules/.bin/vite build 2>&1 | tail -3
```

Expected: `✓ built in`

---

### Task 7: Alert Service

**Files:**
- Create: `src/app/services/alertService.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/app/services/alertService.ts
import { MOCK_ALERTS, DEFAULT_ALERT_RULES, type AlertItem, type AlertRuleConfig } from "../data/alertsData";

// In-memory mutable store — simulates API without a live backend
let _alerts: AlertItem[] = [...MOCK_ALERTS];
let _rules: AlertRuleConfig[] = [...DEFAULT_ALERT_RULES];

// ── Alert queries ─────────────────────────────────────────────────────────────

export function getAlerts(): AlertItem[] {
  return [..._alerts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getUnreadCount(): number {
  return _alerts.filter((a) => !a.isRead).length;
}

// ── Alert mutations ───────────────────────────────────────────────────────────

export function markRead(id: string): void {
  _alerts = _alerts.map((a) => (a.id === id ? { ...a, isRead: true } : a));
}

export function markAllRead(): void {
  _alerts = _alerts.map((a) => ({ ...a, isRead: true }));
}

export function clearAll(): void {
  _alerts = [];
}

// ── Alert rule queries and mutations ─────────────────────────────────────────

export function getAlertRules(): AlertRuleConfig[] {
  return [..._rules];
}

export function updateAlertRule(
  id: string,
  patch: Partial<Pick<AlertRuleConfig, "isEnabled" | "threshold">>
): void {
  _rules = _rules.map((r) => (r.id === id ? { ...r, ...patch } : r));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatAlertAge(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
```

- [ ] **Step 2: Verify frontend build**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && node_modules/.bin/vite build 2>&1 | tail -3
```

Expected: `✓ built in`

---

### Task 8: AlertsPanel Component

**Files:**
- Create: `src/app/components/alerts/AlertsPanel.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/app/components/alerts/AlertsPanel.tsx
import * as React from "react";
import { X, Settings, CheckCheck } from "lucide-react";
import {
  getAlerts,
  getUnreadCount,
  markRead,
  markAllRead,
  clearAll,
  formatAlertAge,
} from "../../services/alertService";
import type { AlertItem, AlertSeverity } from "../../data/alertsData";

interface AlertsPanelProps {
  onClose: () => void;
  onOpenRules: () => void;
  onUnreadChange: (count: number) => void;
}

const SEV_COLORS: Record<AlertSeverity, { dot: string; bg: string; border: string }> = {
  red:   { dot: "#B91C1C", bg: "#FEF2F2", border: "#FECACA" },
  amber: { dot: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
  green: { dot: "#15803D", bg: "#F0FDF4", border: "#BBF7D0" },
};

const TYPE_LABELS: Record<string, string> = {
  stage_migration:    "Stage Migration",
  watchlist_elevation:"Watchlist",
  ecl_threshold:      "ECL",
  signal_severity:    "Intelligence",
  jurisdiction_risk:  "Jurisdiction",
  fuel_stress:        "Fuel",
  composite_signal:   "Composite",
};

export function AlertsPanel({ onClose, onOpenRules, onUnreadChange }: AlertsPanelProps) {
  const [alerts, setAlerts] = React.useState<AlertItem[]>(getAlerts);
  const [filter, setFilter] = React.useState<"all" | "unread">("all");

  const displayed = filter === "unread" ? alerts.filter((a) => !a.isRead) : alerts;

  function refresh() {
    setAlerts(getAlerts());
    onUnreadChange(getUnreadCount());
  }

  function handleMarkRead(id: string) {
    markRead(id);
    refresh();
  }

  function handleMarkAll() {
    markAllRead();
    refresh();
  }

  function handleClearAll() {
    clearAll();
    refresh();
  }

  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        right: 0,
        width: "420px",
        maxHeight: "560px",
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: "10px",
        boxShadow: "0 12px 32px rgba(0,0,0,0.14)",
        zIndex: 300,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "12px 16px",
          borderBottom: "1px solid #E2E8F0",
          gap: "8px",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0F172A", flex: 1 }}>
          Alerts
        </span>
        <span
          style={{
            fontSize: "0.6875rem",
            background: "#F1F5F9",
            color: "#475569",
            borderRadius: "12px",
            padding: "2px 8px",
            fontWeight: 600,
          }}
        >
          {alerts.filter((a) => !a.isRead).length} unread
        </span>
        <button
          onClick={handleMarkAll}
          title="Mark all as read"
          style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: "4px", display: "flex" }}
        >
          <CheckCheck size={16} />
        </button>
        <button
          onClick={onOpenRules}
          title="Alert settings"
          style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: "4px", display: "flex" }}
        >
          <Settings size={16} />
        </button>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: "4px", display: "flex" }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: "0", borderBottom: "1px solid #E2E8F0" }}>
        {(["all", "unread"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            style={{
              flex: 1,
              padding: "8px 0",
              background: "transparent",
              border: "none",
              borderBottom: filter === tab ? "2px solid #002147" : "2px solid transparent",
              color: filter === tab ? "#002147" : "#64748B",
              fontWeight: filter === tab ? 600 : 400,
              fontSize: "0.8125rem",
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {tab === "all" ? "All" : "Unread"}
          </button>
        ))}
      </div>

      {/* Alert list */}
      <div style={{ overflowY: "auto", flex: 1 }}>
        {displayed.length === 0 ? (
          <div
            style={{
              padding: "32px 16px",
              textAlign: "center",
              color: "#94A3B8",
              fontSize: "0.8125rem",
            }}
          >
            {filter === "unread" ? "No unread alerts" : "No alerts"}
          </div>
        ) : (
          displayed.map((alert) => {
            const sev = SEV_COLORS[alert.severity];
            return (
              <div
                key={alert.id}
                onClick={() => handleMarkRead(alert.id)}
                style={{
                  display: "flex",
                  gap: "10px",
                  padding: "12px 16px",
                  borderBottom: "1px solid #F8FAFC",
                  cursor: "pointer",
                  background: alert.isRead ? "#FFFFFF" : sev.bg,
                  transition: "background 150ms",
                }}
                onMouseEnter={(e) => {
                  if (alert.isRead) (e.currentTarget as HTMLDivElement).style.background = "#F8FAFC";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = alert.isRead ? "#FFFFFF" : sev.bg;
                }}
              >
                {/* Severity dot */}
                <div style={{ paddingTop: "3px", flexShrink: 0 }}>
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: sev.dot,
                    }}
                  />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "6px", marginBottom: "2px" }}>
                    <span
                      style={{
                        fontSize: "0.8125rem",
                        fontWeight: alert.isRead ? 400 : 600,
                        color: "#0F172A",
                        flex: 1,
                        lineHeight: 1.35,
                      }}
                    >
                      {alert.title}
                    </span>
                    <span
                      style={{
                        fontSize: "0.625rem",
                        color: "#94A3B8",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                        marginTop: "1px",
                      }}
                    >
                      {formatAlertAge(alert.createdAt)}
                    </span>
                  </div>

                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.75rem",
                      color: "#475569",
                      lineHeight: 1.45,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {alert.body}
                  </p>

                  <div style={{ display: "flex", gap: "6px", marginTop: "6px", alignItems: "center" }}>
                    <span
                      style={{
                        fontSize: "0.625rem",
                        background: sev.bg,
                        border: `1px solid ${sev.border}`,
                        color: sev.dot,
                        borderRadius: "10px",
                        padding: "1px 6px",
                        fontWeight: 600,
                      }}
                    >
                      {TYPE_LABELS[alert.ruleType] ?? alert.ruleType}
                    </span>
                    {!alert.isRead && (
                      <span
                        style={{
                          fontSize: "0.625rem",
                          background: "#002147",
                          color: "#FFFFFF",
                          borderRadius: "10px",
                          padding: "1px 6px",
                          fontWeight: 600,
                        }}
                      >
                        NEW
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {alerts.length > 0 && (
        <div
          style={{
            borderTop: "1px solid #E2E8F0",
            padding: "8px 16px",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={handleClearAll}
            style={{
              background: "none",
              border: "none",
              fontSize: "0.75rem",
              color: "#94A3B8",
              cursor: "pointer",
              padding: "2px 0",
            }}
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify frontend build**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && node_modules/.bin/vite build 2>&1 | tail -3
```

Expected: `✓ built in`

---

### Task 9: AlertRulesConfig Component

**Files:**
- Create: `src/app/components/alerts/AlertRulesConfig.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/app/components/alerts/AlertRulesConfig.tsx
import * as React from "react";
import { X } from "lucide-react";
import { getAlertRules, updateAlertRule } from "../../services/alertService";
import type { AlertRuleConfig } from "../../data/alertsData";

interface AlertRulesConfigProps {
  onClose: () => void;
}

export function AlertRulesConfig({ onClose }: AlertRulesConfigProps) {
  const [rules, setRules] = React.useState<AlertRuleConfig[]>(getAlertRules);

  function handleToggle(id: string, enabled: boolean) {
    updateAlertRule(id, { isEnabled: enabled });
    setRules(getAlertRules());
  }

  function handleThresholdChange(id: string, key: string, raw: string) {
    const num = parseFloat(raw);
    if (isNaN(num)) return;
    updateAlertRule(id, { threshold: { ...rules.find((r) => r.id === id)?.threshold, [key]: num } });
    setRules(getAlertRules());
  }

  // Determine if a rule has a numeric threshold to expose
  function numericThresholdEntry(rule: AlertRuleConfig): [string, number] | null {
    const entries = Object.entries(rule.threshold).filter(([, v]) => typeof v === "number");
    if (entries.length === 0) return null;
    return entries[0] as [string, number];
  }

  const THRESHOLD_LABELS: Record<string, string> = {
    maxEclUsd: "Max ECL (USD)",
    maxRiskScore: "Max Risk Score",
    fuelDeltaPct: "Fuel Delta %",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        zIndex: 500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "12px",
          width: "520px",
          maxHeight: "80vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.20)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: "1px solid #E2E8F0",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "#0F172A" }}>
              Alert Rules
            </div>
            <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "2px" }}>
              Configure which conditions trigger notifications
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", display: "flex" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Rule list */}
        <div style={{ overflowY: "auto", flex: 1, padding: "8px 0" }}>
          {rules.map((rule) => {
            const numEntry = numericThresholdEntry(rule);
            return (
              <div
                key={rule.id}
                style={{
                  padding: "14px 20px",
                  borderBottom: "1px solid #F1F5F9",
                  opacity: rule.isEnabled ? 1 : 0.5,
                  transition: "opacity 150ms",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  {/* Toggle */}
                  <label
                    style={{ display: "flex", alignItems: "center", cursor: "pointer", marginTop: "1px", flexShrink: 0 }}
                  >
                    <input
                      type="checkbox"
                      checked={rule.isEnabled}
                      onChange={(e) => handleToggle(rule.id, e.target.checked)}
                      style={{ display: "none" }}
                    />
                    <div
                      style={{
                        width: "36px",
                        height: "20px",
                        borderRadius: "10px",
                        background: rule.isEnabled ? "#002147" : "#CBD5E1",
                        position: "relative",
                        transition: "background 200ms",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: "2px",
                          left: rule.isEnabled ? "18px" : "2px",
                          width: "16px",
                          height: "16px",
                          borderRadius: "50%",
                          background: "#FFFFFF",
                          transition: "left 200ms",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                        }}
                      />
                    </div>
                  </label>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#0F172A" }}>
                      {rule.label}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "2px", lineHeight: 1.4 }}>
                      {rule.description}
                    </div>

                    {/* Numeric threshold input */}
                    {numEntry && rule.isEnabled && (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px" }}>
                        <label
                          style={{ fontSize: "0.75rem", color: "#475569", whiteSpace: "nowrap" }}
                        >
                          {THRESHOLD_LABELS[numEntry[0]] ?? numEntry[0]}:
                        </label>
                        <input
                          type="number"
                          defaultValue={numEntry[1]}
                          onBlur={(e) => handleThresholdChange(rule.id, numEntry[0], e.target.value)}
                          style={{
                            width: "120px",
                            padding: "4px 8px",
                            border: "1px solid #E2E8F0",
                            borderRadius: "6px",
                            fontSize: "0.8125rem",
                            color: "#0F172A",
                            outline: "none",
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid #E2E8F0",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "8px 20px",
              background: "#002147",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify frontend build**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && node_modules/.bin/vite build 2>&1 | tail -3
```

Expected: `✓ built in`

---

### Task 10: EmailReportModal Component

**Files:**
- Create: `src/app/components/reports/EmailReportModal.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/app/components/reports/EmailReportModal.tsx
import * as React from "react";
import { X, Send, Plus, Trash2 } from "lucide-react";

interface EmailReportModalProps {
  onClose: () => void;
}

type ReportType = {
  id: string;
  label: string;
  description: string;
  subject: string;
};

const REPORT_TYPES: ReportType[] = [
  {
    id: "ecl_summary",
    label: "ECL Summary",
    description: "Portfolio-level ECL breakdown by stage with scenario weighting",
    subject: "Aeroinsights — ECL Summary Report",
  },
  {
    id: "watchlist_report",
    label: "Watchlist Report",
    description: "All lessees on Amber or Red watchlist with contributing signals",
    subject: "Aeroinsights — Watchlist Report",
  },
  {
    id: "portfolio_snapshot",
    label: "Portfolio Snapshot",
    description: "Full portfolio overview: stage distribution, rentals, and concentrations",
    subject: "Aeroinsights — Portfolio Snapshot",
  },
  {
    id: "stage_migrations",
    label: "Stage Migration Log",
    description: "All IFRS 9 stage changes recorded in the current period",
    subject: "Aeroinsights — Stage Migration Log",
  },
  {
    id: "intelligence_digest",
    label: "Intelligence Digest",
    description: "Top signals from Aero Intelligence ranked by severity",
    subject: "Aeroinsights — Intelligence Digest",
  },
];

export function EmailReportModal({ onClose }: EmailReportModalProps) {
  const [selectedReport, setSelectedReport] = React.useState<string>("ecl_summary");
  const [recipients, setRecipients] = React.useState<string[]>([""]);
  const [message, setMessage] = React.useState("");
  const [sent, setSent] = React.useState(false);

  const report = REPORT_TYPES.find((r) => r.id === selectedReport)!;

  function addRecipient() {
    setRecipients((prev) => [...prev, ""]);
  }

  function updateRecipient(index: number, value: string) {
    setRecipients((prev) => prev.map((r, i) => (i === index ? value : r)));
  }

  function removeRecipient(index: number) {
    setRecipients((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSend() {
    const validRecipients = recipients.filter((r) => r.trim().includes("@"));
    if (validRecipients.length === 0) return;

    const body = encodeURIComponent(
      [
        message.trim() ? message.trim() + "\n\n---" : "",
        `Report: ${report.label}`,
        `Generated: ${new Date().toLocaleDateString("en-IE", { dateStyle: "long" })}`,
        "",
        "This report was distributed via Aeroinsights.",
      ]
        .filter(Boolean)
        .join("\n")
    );

    const mailto = `mailto:${validRecipients.join(",")}?subject=${encodeURIComponent(report.subject)}&body=${body}`;
    window.location.href = mailto;
    setSent(true);
  }

  const validCount = recipients.filter((r) => r.trim().includes("@")).length;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        zIndex: 500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "12px",
          width: "520px",
          maxHeight: "85vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.20)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: "1px solid #E2E8F0",
            borderLeft: "3px solid #002147",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "#0F172A" }}>
              Distribute Report
            </div>
            <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "2px" }}>
              Send a report via email to your team
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", display: "flex" }}
          >
            <X size={18} />
          </button>
        </div>

        {sent ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "40px 20px",
              gap: "12px",
            }}
          >
            <div style={{ fontSize: "2rem" }}>✅</div>
            <div style={{ fontWeight: 600, fontSize: "1rem", color: "#0F172A" }}>
              Email client opened
            </div>
            <div style={{ fontSize: "0.8125rem", color: "#64748B", textAlign: "center" }}>
              Your default email client should have opened with the report details pre-filled.
            </div>
            <button
              onClick={onClose}
              style={{
                marginTop: "12px",
                padding: "8px 24px",
                background: "#002147",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "8px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        ) : (
          <div style={{ overflowY: "auto", flex: 1, padding: "20px" }}>
            {/* Report type selector */}
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{ display: "block", fontWeight: 600, fontSize: "0.8125rem", color: "#0F172A", marginBottom: "8px" }}
              >
                Report Type
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {REPORT_TYPES.map((rt) => (
                  <div
                    key={rt.id}
                    onClick={() => setSelectedReport(rt.id)}
                    style={{
                      padding: "10px 14px",
                      border: selectedReport === rt.id ? "1.5px solid #002147" : "1px solid #E2E8F0",
                      borderRadius: "8px",
                      cursor: "pointer",
                      background: selectedReport === rt.id ? "rgba(0,33,71,0.04)" : "#FFFFFF",
                      transition: "all 150ms",
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: "0.8125rem", color: "#0F172A" }}>
                      {rt.label}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "2px" }}>
                      {rt.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recipients */}
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{ display: "block", fontWeight: 600, fontSize: "0.8125rem", color: "#0F172A", marginBottom: "8px" }}
              >
                Recipients
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {recipients.map((r, i) => (
                  <div key={i} style={{ display: "flex", gap: "6px" }}>
                    <input
                      type="email"
                      value={r}
                      placeholder="colleague@airline.com"
                      onChange={(e) => updateRecipient(i, e.target.value)}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        border: "1px solid #E2E8F0",
                        borderRadius: "6px",
                        fontSize: "0.8125rem",
                        color: "#0F172A",
                        outline: "none",
                        fontFamily: "'Inter', sans-serif",
                      }}
                    />
                    {recipients.length > 1 && (
                      <button
                        onClick={() => removeRecipient(i)}
                        style={{
                          background: "none",
                          border: "1px solid #E2E8F0",
                          borderRadius: "6px",
                          cursor: "pointer",
                          color: "#94A3B8",
                          padding: "0 8px",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addRecipient}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    background: "none",
                    border: "1px dashed #CBD5E1",
                    borderRadius: "6px",
                    padding: "7px 12px",
                    cursor: "pointer",
                    color: "#64748B",
                    fontSize: "0.8125rem",
                    width: "100%",
                  }}
                >
                  <Plus size={14} />
                  Add recipient
                </button>
              </div>
            </div>

            {/* Optional message */}
            <div style={{ marginBottom: "8px" }}>
              <label
                style={{ display: "block", fontWeight: 600, fontSize: "0.8125rem", color: "#0F172A", marginBottom: "8px" }}
              >
                Message (optional)
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="Add a note to accompany this report…"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #E2E8F0",
                  borderRadius: "6px",
                  fontSize: "0.8125rem",
                  color: "#0F172A",
                  outline: "none",
                  resize: "vertical",
                  fontFamily: "'Inter', sans-serif",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        {!sent && (
          <div
            style={{
              padding: "14px 20px",
              borderTop: "1px solid #E2E8F0",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>
              Opens your default email client
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={onClose}
                style={{
                  padding: "8px 16px",
                  background: "transparent",
                  color: "#475569",
                  border: "1px solid #E2E8F0",
                  borderRadius: "8px",
                  fontWeight: 500,
                  fontSize: "0.875rem",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={validCount === 0}
                style={{
                  padding: "8px 20px",
                  background: validCount === 0 ? "#CBD5E1" : "#002147",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  cursor: validCount === 0 ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Send size={14} />
                Send Report
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify frontend build**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && node_modules/.bin/vite build 2>&1 | tail -3
```

Expected: `✓ built in`

---

### Task 11: Wire Header.tsx

**Files:**
- Modify: `src/app/components/layout/Header.tsx`

This is the final task. AlertsPanel, AlertRulesConfig and EmailReportModal are now created, so imports will resolve.

- [ ] **Step 1: Add imports at the top of `src/app/components/layout/Header.tsx`**

After the existing imports add:

```typescript
import { AlertsPanel } from "../alerts/AlertsPanel";
import { AlertRulesConfig } from "../alerts/AlertRulesConfig";
import { EmailReportModal } from "../reports/EmailReportModal";
import { getUnreadCount } from "../../services/alertService";
```

- [ ] **Step 2: Add state variables in the `Header` function body, after existing state declarations**

After `const [picError, setPicError] = useState(false);` add:

```typescript
const [alertsOpen, setAlertsOpen] = React.useState(false);
const [rulesOpen, setRulesOpen] = React.useState(false);
const [emailOpen, setEmailOpen] = React.useState(false);
const [unreadCount, setUnreadCount] = React.useState(getUnreadCount);

const bellRef = useRef<HTMLDivElement>(null);
const mailRef = useRef<HTMLDivElement>(null);
```

- [ ] **Step 3: Extend the outside-click useEffect to also close the alerts panel**

Replace the existing outside-click `useEffect` (the one that closes the user menu and search dropdown) with:

```typescript
useEffect(() => {
  function handleClick(e: MouseEvent) {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setMenuOpen(false);
    }
    if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
      setResults([]);
      setActiveIdx(-1);
    }
    if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
      setAlertsOpen(false);
    }
  }
  document.addEventListener("mousedown", handleClick);
  return () => document.removeEventListener("mousedown", handleClick);
}, []);
```

- [ ] **Step 4: Replace the hardcoded Bell button with the wired version**

Replace the existing Notifications button block (from `{/* Notifications */}` to the closing `</button>`) with:

```tsx
{/* Notifications / Alerts */}
<div ref={bellRef} style={{ position: "relative" }}>
  <button
    className="relative flex items-center justify-center rounded-md transition-colors"
    style={{
      width: "34px",
      height: "34px",
      color: alertsOpen ? "#002147" : "#475569",
      background: alertsOpen ? "#F1F5F9" : "transparent",
      border: "none",
      cursor: "pointer",
    }}
    onMouseEnter={(e) => { if (!alertsOpen) (e.currentTarget as HTMLButtonElement).style.background = "#F1F5F9"; }}
    onMouseLeave={(e) => { if (!alertsOpen) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
    onClick={() => setAlertsOpen((v) => !v)}
    aria-label="Notifications"
  >
    <Bell size={18} />
    {unreadCount > 0 && (
      <span
        className="absolute top-1 right-1 flex items-center justify-center"
        style={{
          width: "14px",
          height: "14px",
          background: "#B91C1C",
          borderRadius: "50%",
          fontSize: "0.5rem",
          fontWeight: 700,
          color: "#FFFFFF",
          lineHeight: 1,
        }}
      >
        {unreadCount > 9 ? "9+" : unreadCount}
      </span>
    )}
  </button>
  {alertsOpen && (
    <AlertsPanel
      onClose={() => setAlertsOpen(false)}
      onOpenRules={() => { setAlertsOpen(false); setRulesOpen(true); }}
      onUnreadChange={setUnreadCount}
    />
  )}
</div>
```

- [ ] **Step 5: Replace the Mail button with the wired version**

Replace the existing Messages button block (from `{/* Messages */}` to the closing `</button>`) with:

```tsx
{/* Email Report Distribution */}
<div ref={mailRef} style={{ position: "relative" }}>
  <button
    className="flex items-center justify-center rounded-md transition-colors"
    style={{
      width: "34px",
      height: "34px",
      color: emailOpen ? "#002147" : "#475569",
      background: emailOpen ? "#F1F5F9" : "transparent",
      border: "none",
      cursor: "pointer",
    }}
    onMouseEnter={(e) => { if (!emailOpen) (e.currentTarget as HTMLButtonElement).style.background = "#F1F5F9"; }}
    onMouseLeave={(e) => { if (!emailOpen) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
    onClick={() => setEmailOpen((v) => !v)}
    aria-label="Distribute Report"
  >
    <Mail size={18} />
  </button>
  {emailOpen && (
    <EmailReportModal onClose={() => setEmailOpen(false)} />
  )}
</div>
```

- [ ] **Step 6: Add the modals at the end of the returned JSX, before the closing `</header>`**

After the closing `</div>` of `className="flex w-full items-center gap-1 px-4"` and before `</header>` add:

```tsx
{/* Alert Rules Config modal (portal-like, rendered inside header but fixed) */}
{rulesOpen && <AlertRulesConfig onClose={() => setRulesOpen(false)} />}
```

- [ ] **Step 7: Final build verification**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && node_modules/.bin/vite build 2>&1 | tail -5
```

Expected: `✓ built in` with no TypeScript errors

- [ ] **Step 8: Commit**

```bash
cd /Users/tanamsethi/Downloads/Aeroinsights && git add \
  backend/app/models/__init__.py \
  backend/alembic/versions/0002_add_alerts.py \
  backend/app/schemas/alerts.py \
  backend/app/api/v1/endpoints/alerts.py \
  backend/app/api/v1/router.py \
  src/app/data/alertsData.ts \
  src/app/services/alertService.ts \
  src/app/components/alerts/AlertsPanel.tsx \
  src/app/components/alerts/AlertRulesConfig.tsx \
  src/app/components/reports/EmailReportModal.tsx \
  src/app/components/layout/Header.tsx \
  docs/superpowers/plans/2026-05-07-alert-system-email-reports.md && \
git commit -m "$(cat <<'EOF'
feat: add exception-based alert system (Bell) and email report distribution (Mail)

- Backend: AlertRule + Alert SQLAlchemy models, Alembic migration, FastAPI CRUD
- Frontend: alertsData.ts (12 mock alerts, 7 rule types), alertService.ts (in-memory store)
- AlertsPanel: RAG-rated dropdown with filter tabs, mark-read, clear-all
- AlertRulesConfig: toggle + numeric threshold editor for each rule type
- EmailReportModal: 5 report types, multi-recipient mailto: composition
- Header: bell wired to AlertsPanel + dynamic unread badge; mail wired to EmailReportModal

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Backend `alert_rules` + `alerts` tables — Tasks 1–2
- ✅ FastAPI endpoints (list, create, patch, delete rules; list alerts, mark-read, mark-all-read, unread-count) — Tasks 3–5
- ✅ Alert types: stage_migration, watchlist_elevation, ecl_threshold, signal_severity, jurisdiction_risk, fuel_stress, composite_signal — Task 6
- ✅ 12 mock alerts with realistic aviation lesssor content — Task 6
- ✅ alertService in-memory store (no live API needed for prototype) — Task 7
- ✅ AlertsPanel: RAG dots, filter tabs, mark-read on click, clear-all, unread badge — Task 8
- ✅ AlertRulesConfig: toggle switches, numeric threshold inputs — Task 9
- ✅ EmailReportModal: 5 report types, multi-recipient, optional message, mailto: — Task 10
- ✅ Header wiring: bell → panel + dynamic badge; mail → modal; outside-click dismiss — Task 11
- ✅ Mail icon repurposed (no internal team chat) — confirmed by EmailReportModal

**Placeholder scan:** None found. All steps contain complete code.

**Type consistency check:**
- `AlertItem` uses `ruleType: AlertType` — matches TYPE_LABELS keys in AlertsPanel
- `AlertRuleConfig` uses `threshold: Record<string, number | string>` — matches updateAlertRule patch type
- `AlertSeverity` as `"red" | "amber" | "green"` — consistent across alertsData, alertService, AlertsPanel
- `formatAlertAge` imported from alertService in AlertsPanel — correct
- `getAlerts`, `getUnreadCount`, `markRead`, `markAllRead`, `clearAll` imported in AlertsPanel — all exported from alertService
- `getAlertRules`, `updateAlertRule` imported in AlertRulesConfig — both exported
- `onUnreadChange: (count: number) => void` matches `setUnreadCount` (React state setter) in Header
