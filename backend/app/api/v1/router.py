from fastapi import APIRouter

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
)

api_router = APIRouter()

api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(tenants.router, prefix="/tenant", tags=["tenant"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(lessees.router, prefix="/lessees", tags=["lessees"])
api_router.include_router(leases.router, prefix="/leases", tags=["leases"])
api_router.include_router(aircraft.router, prefix="/aircraft", tags=["aircraft"])
api_router.include_router(payments.router, prefix="/leases/{lease_id}/payments", tags=["payments"])
api_router.include_router(
    security_deposits.router, prefix="/leases/{lease_id}/security-deposits", tags=["security-deposits"]
)
api_router.include_router(
    maintenance_reserves.router,
    prefix="/leases/{lease_id}/maintenance-reserves",
    tags=["maintenance-reserves"],
)
api_router.include_router(valuations.router, prefix="/aircraft/{aircraft_id}/valuations", tags=["valuations"])
api_router.include_router(imports.router, prefix="/import", tags=["import"])
api_router.include_router(audit_log.router, prefix="/audit-log", tags=["audit"])
api_router.include_router(excel.router,     prefix="/excel",     tags=["excel-addin"])
