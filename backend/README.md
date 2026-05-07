# Aeroinsights — Backend

> Aviation Lessor Decision Platform — FastAPI backend  
> Python 3.12 · FastAPI · PostgreSQL · Celery · Redis · AWS EKS (eu-west-1)

---

## Quick Start (Local)

### Prerequisites
- Docker Desktop
- Python 3.12+ (for local linting/testing only)

### 1. Environment

```bash
cp .env.example .env
# Fill in AUTH0_DOMAIN, AUTH0_AUDIENCE, and AWS credentials
```

### 2. Start all services

```bash
make up
```

This starts:
- **PostgreSQL 16** on `localhost:5432`
- **Redis 7** on `localhost:6379`
- **FastAPI API** on `http://localhost:8000`
- **Celery worker** (background tasks)

### 3. Run migrations

```bash
make migrate
```

### 4. Seed demo data

```bash
make seed
```

Seeds 6 lessees, 8 aircraft, 8 leases, 3 scenario templates — matching the frontend mock data exactly.

### 5. View API docs

[http://localhost:8000/api/v1/docs](http://localhost:8000/api/v1/docs) — Interactive OpenAPI 3.1 UI

---

## Directory Structure

```
backend/
├── app/
│   ├── main.py                  # FastAPI app factory
│   ├── api/
│   │   └── v1/
│   │       ├── router.py        # Central router
│   │       └── endpoints/       # One file per resource
│   │           ├── auth.py
│   │           ├── tenants.py
│   │           ├── users.py
│   │           ├── lessees.py
│   │           ├── leases.py
│   │           ├── aircraft.py
│   │           ├── payments.py
│   │           ├── security_deposits.py
│   │           ├── maintenance_reserves.py
│   │           ├── valuations.py
│   │           ├── imports.py
│   │           └── audit_log.py
│   ├── core/
│   │   ├── config.py            # Pydantic settings (env vars)
│   │   ├── database.py          # Async SQLAlchemy engine + session
│   │   ├── auth.py              # Auth0 JWT + RBAC guards
│   │   └── logging.py           # Structured JSON logging
│   ├── middleware/
│   │   └── audit.py             # Audit log middleware
│   ├── models/
│   │   └── __init__.py          # All SQLAlchemy ORM models
│   ├── schemas/                 # Pydantic request/response schemas
│   └── workers/
│       ├── celery_app.py        # Celery configuration
│       └── tasks.py             # Background task stubs
├── alembic/                     # Database migrations
├── scripts/
│   └── seed_demo.py             # Demo data seed
├── tests/                       # pytest test suite
├── Dockerfile                   # Multi-stage production image
├── docker-compose.yml           # Local dev stack
├── Makefile                     # Developer commands
├── pyproject.toml               # Dependencies + tool config
└── .env.example                 # Environment template
```

---

## API Overview

Base URL: `GET /api/v1/`  
Auth: `Authorization: Bearer <Auth0 JWT>`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/me` | Current user profile |
| GET/PATCH | `/tenant` | Tenant configuration |
| GET/POST/PATCH/DELETE | `/users` | User management (Admin only) |
| GET/POST/PATCH | `/lessees` | Lessee profiles |
| GET/POST/PATCH | `/leases` | Lease register |
| GET/POST/PATCH | `/aircraft` | Aircraft register |
| GET/POST | `/leases/{id}/payments` | Payment history |
| GET/POST/PATCH | `/leases/{id}/security-deposits` | Security deposits |
| GET/POST/PATCH | `/leases/{id}/maintenance-reserves` | MR ledger |
| GET/POST | `/aircraft/{id}/valuations` | Valuation history |
| POST | `/import/portfolio` | CSV/XLSX bulk import |
| POST | `/import/validate` | Dry-run import validation |
| GET | `/audit-log` | Immutable audit trail |
| GET | `/health` | Health check |

Full interactive docs: `http://localhost:8000/api/v1/docs`

---

## RBAC Roles

| Role | Description |
|------|-------------|
| `admin` | Full access including user management and tenant config |
| `risk` | Read + write portfolio data, run scenarios, view audit log |
| `accounting` | Read + write portfolio data, export reports |
| `readonly` | Read-only access to all data |

---

## Development Commands

```bash
make up            # Start stack
make down          # Stop stack
make migrate       # Run pending migrations
make seed          # Load demo data
make lint          # ruff + mypy
make test          # pytest with coverage
make revision MSG="add xyz table"   # Create new migration
```

---

## Compliance Notes

- **Data residency**: All services deployed to `eu-west-1` (Dublin) for GDPR
- **Audit log**: Every mutating operation logged with user, timestamp, IP — 7-year immutable retention
- **Multi-tenancy**: `tenant_id` on all tables; queries always scoped to authenticated tenant
- **Auth**: Auth0 OAuth2 + mandatory MFA (configurable per user)
- **Run immutability**: Scenario runs are write-once — never updated after creation

---

## Phase Roadmap

| Phase | Status | Scope |
|-------|--------|-------|
| **1 — Foundation** | ✅ Done | API scaffold, schema, CRUD, auth, imports, seed |
| **2 — Computation** | Upcoming | Scenario engine, ECL, SICR, watchlist, Monte Carlo |
| **3 — Advanced** | Upcoming | Restructuring simulator, jurisdiction model, valuations |
| **4 — Reports** | Upcoming | PDF/XLSX export, scheduled reports, email delivery |
| **5 — Deployment** | Upcoming | AWS EKS, security audit, pilot onboarding |
