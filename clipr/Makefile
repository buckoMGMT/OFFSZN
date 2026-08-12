# Entry points. `make check` is what CI runs.

PSQL ?= psql
DB   ?= $(DATABASE_URL)

.PHONY: help up down migrate test check margins audit fmt

help:
	@grep -E '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | \
		awk 'BEGIN{FS=":.*?## "}{printf "  %-12s %s\n", $$1, $$2}'

up:            ## Start the local stack
	docker compose up -d

down:          ## Stop the local stack
	docker compose down

migrate:       ## Apply migrations in order (idempotent per file, not per run)
	@for f in packages/db/migrations/*.sql; do \
		echo "-> $$f"; \
		$(PSQL) "$(DB)" -v ON_ERROR_STOP=1 -q -f "$$f" || exit 1; \
	done

test:          ## Run the suite
	python3 -m pytest tests -q

check: test    ## Everything CI enforces
	@echo "checking plan-table parity..."
	@python3 -m pytest tests/test_economics.py::test_sql_and_python_plan_tables_agree \
		tests/test_economics.py::test_pricing_page_quotes_the_same_numbers -q

margins:       ## Gross margin per tier under the current cost model
	@python3 -c "import sys; sys.path.insert(0,'.'); \
from packages.billing.plans import margin_for_plan, PLANS; \
[print(f\"{m['plan']:<14} rev \$${m['revenue_usd']:>7.2f}  cogs \$${m['cogs_usd']:>7.2f}  margin {m['gross_margin']:.1%}\") \
 for m in (margin_for_plan(p) for p in PLANS if p != 'trial')]"

audit:         ## Compute the readiness report from evidence
	python3 -m packages.audit.cli
