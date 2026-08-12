# Entry points. `make check` is what CI runs.

PSQL   ?= psql
DB     ?= $(DATABASE_URL)
PYTHON ?= python3

.PHONY: help up down migrate test lint security eval check margins audit

help:
	@grep -E '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | \
		awk 'BEGIN{FS=":.*?## "}{printf "  %-10s %s\n", $$1, $$2}'

up:        ## Start the local stack
	docker compose up -d

down:      ## Stop the local stack
	docker compose down

migrate:   ## Apply migrations in order
	@for f in packages/db/migrations/*.sql; do \
		echo "-> $$f"; \
		$(PSQL) "$(DB)" -v ON_ERROR_STOP=1 -q -f "$$f" || exit 1; \
	done

test:      ## Run the suite
	$(PYTHON) -m pytest

lint:      ## Style and correctness
	ruff check packages tests

security:  ## Static security scan
	bandit -q -c pyproject.toml -r packages

eval:      ## Run the detection eval harness
	$(PYTHON) -m packages.ai.cli_eval

loadtest:  ## Drive real jobs through the queue and record the run
	$(PYTHON) -m packages.pipeline.loadtest --jobs 1200 --workers 8

label:     ## Build an eval dataset from a real VOD (see docs/PATH_TO_10.md)
	@$(PYTHON) -m packages.ai.labeler --help

evidence:  ## Record an interview, usability session, pentest or legal review
	@$(PYTHON) -m packages.audit.evidence --help

check: lint security test eval  ## Everything CI enforces

margins:   ## Gross margin per tier, self-hosted ASR vs a hosted speech API
	@$(PYTHON) -c "import sys; sys.path.insert(0,'.'); \
from packages.billing.plans import margin_for_plan, CostModel, PLANS; \
paid=[p for p in PLANS if p!='trial']; \
print('self-hosted ASR:'); \
[print(f\"  {m['plan']:<14} rev \$${m['revenue_usd']:>7.2f}  cogs \$${m['cogs_usd']:>7.2f}  margin {m['gross_margin']:.1%}\") for m in (margin_for_plan(p) for p in paid)]; \
print('hosted speech API:'); \
[print(f\"  {m['plan']:<14} rev \$${m['revenue_usd']:>7.2f}  cogs \$${m['cogs_usd']:>7.2f}  margin {m['gross_margin']:.1%}\") for m in (margin_for_plan(p, CostModel(asr_per_candidate_hour=0.36)) for p in paid)]"

economics: ## Unit economics, worst-case customers, breakeven, sensitivity
	@$(PYTHON) -c "import sys; sys.path.insert(0,'.'); \
from packages.billing.economics import unit_economics, stress, business, sensitivity; \
paid=['rail','control_room','network']; \
print('PER CUSTOMER (100% of allowance)'); \
[print(f\"  {u.plan:<14} rev \$${u.revenue_usd:>7.2f}  contrib \$${u.contribution_usd:>7.2f}  \" \
       f\"margin {u.contribution_margin:>5.1%}  LTV:CAC {u.ltv_to_cac:>5.1f}  \" \
       f\"{'ok' if u.healthy else 'UNHEALTHY'}\") for u in (unit_economics(c, utilisation=1.0) for c in paid)]; \
print(); print('WORST CASE EACH PLAN PERMITS'); \
[print(f\"  {s.plan:<14} {s.scenario:<32} profit \$${s.profit_usd:>8.2f}{'  LOSS' if s.loses_money else ''}\") \
 for c in paid for s in stress(c)]; \
b=business(300); print(); \
print(f'BREAKEVEN: {b.breakeven_customers} customers at \$${b.contribution_per_customer_usd:.2f} contribution each'); \
print(); print('IF AN ASSUMPTION IS WRONG (300 customers)'); \
[print(f\"  {k:<44} \$${v['profit_usd']:>8,.0f}  ({v['delta_usd']:>+8,.0f})\") for k,v in sensitivity(300).items()]"

audit:     ## Readiness report, computed from evidence
	$(PYTHON) -m packages.audit.cli
