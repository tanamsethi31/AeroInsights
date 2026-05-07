import structlog
from app.workers.celery_app import celery_app

log = structlog.get_logger()


@celery_app.task(bind=True, name="run_scenario", max_retries=2)
def run_scenario_task(self, run_id: str, tenant_id: str) -> dict:
    """
    Phase 2: Full scenario computation engine.
    Placeholder for Phase 1 — actual ECL math implemented in Phase 2.
    """
    log.info("scenario_task_started", run_id=run_id, tenant_id=tenant_id)
    return {"run_id": run_id, "status": "queued_for_phase2"}


@celery_app.task(bind=True, name="generate_report", max_retries=2)
def generate_report_task(self, export_id: str, tenant_id: str, report_type: str, fmt: str) -> dict:
    """
    Phase 4: PDF/XLSX/JSON report generation.
    Placeholder for Phase 1.
    """
    log.info("report_task_started", export_id=export_id, report_type=report_type, fmt=fmt)
    return {"export_id": export_id, "status": "queued_for_phase4"}
