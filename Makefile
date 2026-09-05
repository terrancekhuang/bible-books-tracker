VENV        := backend/.venv
PYTHON      := $(VENV)/bin/python
PIP         := $(VENV)/bin/pip
SERVER      ?= root@5.78.233.181

.DEFAULT_GOAL := help
.PHONY: all install install-frontend install-backend dev dev-frontend dev-backend \
        db db-stop db-tunnel test test-frontend test-backend lint build help

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ── Dependencies ──────────────────────────────────────────────────────────────

install: install-frontend install-backend ## Install all dependencies

install-frontend: ## npm install
	npm install

install-backend: $(VENV)/bin/activate ## pip install backend deps + pytest into venv
	$(PIP) install -r backend/requirements-dev.txt

$(VENV)/bin/activate:
	python3 -m venv $(VENV)

# ── Database ──────────────────────────────────────────────────────────────────

db: ## Start local PostgreSQL via docker compose (skips it if something's already listening on 5432 — e.g. a host-installed Postgres already holding DATABASE_URL's database)
	@python3 -c "import socket,sys; s=socket.socket(); s.settimeout(0.5); sys.exit(0 if s.connect_ex(('127.0.0.1',5432))==0 else 1)" \
		&& echo "Postgres already listening on 127.0.0.1:5432 — skipping docker compose." \
		|| docker compose up -d

db-stop: ## Stop local PostgreSQL
	docker compose down

db-tunnel: ## Forward prod Postgres to localhost:5433 (connect pgAdmin there)
	ssh -i infra/deploy_key -L 5433:localhost:5432 $(SERVER) -N

# ── Dev servers ───────────────────────────────────────────────────────────────

dev-backend: ## Flask backend on :5001
	$(PYTHON) backend/src/routes.py

dev-frontend: ## Vite dev server on :5173
	npm run dev

dev: db ## Start db + backend + frontend together (Ctrl-C stops all)
	@$(PYTHON) backend/src/routes.py & BACKEND_PID=$$!; \
	npm run dev; \
	kill $$BACKEND_PID 2>/dev/null || true

# ── Quality ───────────────────────────────────────────────────────────────────

test: test-frontend test-backend ## Run both suites — the same two CI gates the deploy on

test-frontend: ## vitest
	npm test

test-backend: ## pytest — needs PostgreSQL reachable at $$DATABASE_URL (see `make db`)
	$(PYTHON) -m pytest backend/tests -q

lint: ## Run ESLint
	npm run lint

build: ## tsc + vite build
	npm run build
