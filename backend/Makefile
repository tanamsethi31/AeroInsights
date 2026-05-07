.PHONY: help up down logs migrate seed lint test

help:
	@echo ""
	@echo "Aeroinsights Backend — Developer Commands"
	@echo "────────────────────────────────────────"
	@echo "  make up        Start all services (API, Postgres, Redis, Worker)"
	@echo "  make down      Stop all services"
	@echo "  make logs      Tail API logs"
	@echo "  make migrate   Run Alembic migrations"
	@echo "  make seed      Seed demo data"
	@echo "  make lint      Run ruff + mypy"
	@echo "  make test      Run pytest"
	@echo ""

up:
	docker compose up --build -d
	@echo "API docs: http://localhost:8000/api/v1/docs"

down:
	docker compose down

logs:
	docker compose logs -f api

migrate:
	docker compose exec api alembic upgrade head

revision:
	docker compose exec api alembic revision --autogenerate -m "$(MSG)"

seed:
	docker compose exec api python -m scripts.seed_demo

lint:
	ruff check app/ scripts/
	mypy app/

test:
	pytest tests/ -v --cov=app --cov-report=term-missing

# Generate initial migration from models
init-migration:
	docker compose exec api alembic revision --autogenerate -m "initial schema"
	docker compose exec api alembic upgrade head
