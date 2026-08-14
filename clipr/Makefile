# Entry points. `make check` is what CI runs.

PSQL   ?= psql
DB     ?= $(DATABASE_URL)
PYTHON ?= python3

.PHONY: help up down migrate test test-unit test-integration test-all \
        demo verify-demo review review-web eval-clips dataset lint security eval check margins audit

# Where `make demo` writes. A persistent directory in the project, not /tmp:
# the clips are the deliverable, and a deliverable that a reboot deletes is
# not one.
OUT ?= demo_output

help:
	@grep -E '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | \
		awk 'BEGIN{FS=":.*?## "}{printf "  %-16s %s\n", $$1, $$2}'

demo:      ## Run ClipR on a local video: make demo INPUT=/path/video.mp4
	@if [ -z "$(INPUT)" ]; then \
		echo "Usage: make demo INPUT=/path/to/video.mp4 [OUT=demo_output]"; \
		echo ""; \
		echo "Any local mp4/mov/mkv/webm. No Twitch, TikTok, Postgres or"; \
		echo "Stripe credentials are needed or used."; \
		exit 2; \
	fi
	$(PYTHON) -m packages.pipeline.demo --input "$(INPUT)" --out "$(OUT)"

verify-demo: ## Re-check every file `make demo` produced, by decoding it
	$(PYTHON) -m packages.pipeline.verify --dir "$(OUT)"

review-web: ## Review clips in a browser: swipe keep/reject, records the rate
	$(PYTHON) -m packages.pipeline.webreview --dir "$(OUT)"

review:    ## Review the clips in the terminal (no browser)
	$(PYTHON) -m packages.pipeline.review --dir "$(OUT)"

eval-clips: ## Score the ranker against human-labelled VODs, check launch gates
	$(PYTHON) -m packages.ai.cli_clip_eval --dir evaluation/creator_vods

dataset:   ## Publishable Rate, rejection reasons, and which dimensions predict a keep
	$(PYTHON) -m packages.pipeline.dataset --runs evaluation/runs

test-unit: ## Fast tests. Mocks allowed. Never sufficient on their own.
	$(PYTHON) -m pytest tests -m "not integration" -q

test-integration: ## Real ffmpeg against real media. No mocks. Slow.
	$(PYTHON) -m pytest tests/integration -q

test-all: test-unit test-integration  ## Both suites

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
