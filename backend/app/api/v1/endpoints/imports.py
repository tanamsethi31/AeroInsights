from __future__ import annotations

import io
import uuid
from datetime import date
from decimal import Decimal
from typing import Literal

import pandas as pd
import structlog
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_write
from app.core.database import get_db
from app.models import Aircraft, Lease, Lessee, Payment, User

log = structlog.get_logger()
router = APIRouter()

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB

# Magic-byte signatures for allowed file types
_XLSX_MAGIC = b"PK\x03\x04"            # ZIP-based Office Open XML
_XLS_MAGIC  = b"\xd0\xcf\x11\xe0"     # OLE2 Compound Document

EXPECTED_COLUMNS = {
    "lessee_name", "country_code", "credit_rating",
    "msn", "aircraft_type", "registration", "vintage",
    "lease_start", "lease_end", "monthly_rent_usd",
}


class ImportResult(BaseModel):
    status: Literal["success", "error"]
    lessees_created: int = 0
    aircraft_created: int = 0
    leases_created: int = 0
    errors: list[str] = []


@router.post("/portfolio", response_model=ImportResult)
async def import_portfolio(
    file: UploadFile = File(...),
    current_user: User = Depends(require_write),
    db: AsyncSession = Depends(get_db),
) -> ImportResult:
    """
    Bulk-import portfolio from CSV or XLSX.
    Expected columns: lessee_name, country_code, credit_rating,
    msn, aircraft_type, registration, vintage,
    lease_start, lease_end, monthly_rent_usd
    """
    # Read up to limit + 1 byte — if we hit the extra byte the file is too large
    contents = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB upload limit",
        )

    errors: list[str] = []
    lessees_created = aircraft_created = leases_created = 0

    try:
        is_csv = file.filename is not None and file.filename.lower().endswith(".csv")
        if is_csv:
            # Reject binary file signatures masquerading as CSV
            if contents[:4] in (_XLSX_MAGIC, _XLS_MAGIC):
                raise HTTPException(status_code=415, detail="File content does not match .csv extension")
            df = pd.read_csv(io.BytesIO(contents))
        else:
            # Require valid Office magic bytes for spreadsheet uploads
            if not (contents[:4] == _XLSX_MAGIC or contents[:4] == _XLS_MAGIC):
                raise HTTPException(status_code=415, detail="File must be a valid .xlsx or .xls spreadsheet")
            df = pd.read_excel(io.BytesIO(contents))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Cannot parse file: {exc}")

    missing = EXPECTED_COLUMNS - set(df.columns.str.strip().str.lower())
    if missing:
        raise HTTPException(status_code=422, detail=f"Missing columns: {missing}")

    df.columns = df.columns.str.strip().str.lower()

    for idx, row in df.iterrows():
        row_num = int(idx) + 2  # 1-indexed, +1 for header
        try:
            # Upsert lessee by name within tenant
            lessee = Lessee(
                id=str(uuid.uuid4()),
                tenant_id=current_user.tenant_id,
                name=str(row["lessee_name"]).strip(),
                country_code=str(row["country_code"]).strip().upper(),
                credit_rating=str(row.get("credit_rating", "")).strip() or None,
            )
            db.add(lessee)
            lessees_created += 1

            # Aircraft
            ac = Aircraft(
                id=str(uuid.uuid4()),
                tenant_id=current_user.tenant_id,
                msn=str(row["msn"]).strip(),
                aircraft_type=str(row["aircraft_type"]).strip(),
                registration=str(row.get("registration", "")).strip() or None,
                vintage=int(row["vintage"]) if pd.notna(row.get("vintage")) else None,
            )
            db.add(ac)
            aircraft_created += 1

            # Lease
            lease = Lease(
                id=str(uuid.uuid4()),
                tenant_id=current_user.tenant_id,
                lessee_id=lessee.id,
                aircraft_id=ac.id,
                lease_start=pd.to_datetime(row["lease_start"]).date(),
                lease_end=pd.to_datetime(row["lease_end"]).date(),
                monthly_rent_usd=Decimal(str(row["monthly_rent_usd"])),
            )
            db.add(lease)
            leases_created += 1

        except Exception as exc:
            errors.append(f"Row {row_num}: {exc}")
            log.warning("import_row_error", row=row_num, error=str(exc))

    if errors and leases_created == 0:
        raise HTTPException(status_code=422, detail={"errors": errors})

    await db.flush()

    return ImportResult(
        status="success",
        lessees_created=lessees_created,
        aircraft_created=aircraft_created,
        leases_created=leases_created,
        errors=errors,
    )


@router.post("/validate", response_model=ImportResult)
async def validate_portfolio(
    file: UploadFile = File(...),
    current_user: User = Depends(require_write),
) -> ImportResult:
    """Validate import file without committing — dry run."""
    contents = await file.read()
    errors: list[str] = []
    try:
        if file.filename and file.filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Cannot parse file: {exc}")

    df.columns = df.columns.str.strip().str.lower()
    missing = EXPECTED_COLUMNS - set(df.columns)
    if missing:
        return ImportResult(status="error", errors=[f"Missing columns: {missing}"])

    for idx, row in df.iterrows():
        row_num = int(idx) + 2
        for col in ["lessee_name", "msn", "aircraft_type", "lease_start", "lease_end", "monthly_rent_usd"]:
            if pd.isna(row.get(col)):
                errors.append(f"Row {row_num}: '{col}' is required")

    return ImportResult(
        status="error" if errors else "success",
        leases_created=len(df) if not errors else 0,
        errors=errors,
    )
