VENV        := venv
PYTHON      := $(VENV)/bin/python
PIP         := $(VENV)/bin/pip

.DEFAULT_GOAL := help
.PHONY: all install install-frontend install-backend dev dev-frontend dev-backend \
        db db-stop test lint build help

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ── Dependencies ──────────────────────────────────────────────────────────────

install: install-frontend install-backend ## Install all dependencies

install-frontend: ## npm install
	npm install

install-backend: $(VENV)/bin/activate ## pip install -r requirements.txt into venv
	$(PIP) install -r requirements.txt

$(VENV)/bin/activate:
	python3 -m venv $(VENV)

# ── Database ──────────────────────────────────────────────────────────────────

db: ## Start local PostgreSQL via docker compose
	docker compose up -d

db-stop: ## Stop local PostgreSQL
	docker compose down

# ── Dev servers ───────────────────────────────────────────────────────────────

dev-backend: ## Flask backend on :5001
	$(PYTHON) backend/src/routes.py

dev-frontend: ## Vite dev server on :3000
	npm run dev

dev: db ## Start db + backend + frontend together (Ctrl-C stops all)
	@$(PYTHON) backend/src/routes.py & BACKEND_PID=$$!; \
	npm run dev; \
	kill $$BACKEND_PID 2>/dev/null || true

# ── Quality ───────────────────────────────────────────────────────────────────

test: ## Run vitest
	npm test

lint: ## Run ESLint
	npm run lint

build: ## tsc + vite build
	npm run build
