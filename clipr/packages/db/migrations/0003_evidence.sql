-- Evidence tables.
--
-- The audit engine computes readiness from evidence, which only works if there
-- is somewhere for evidence to live. Three sectors -- Product, Growth and
-- Landing Page -- previously had no path to VERIFIED at all: no query could
-- ever return the thing that would satisfy them, so 20% of the weighted score
-- was permanently capped at 6 for reasons that had nothing to do with evidence.
-- That is a broken instrument, not a strict one.
--
-- Every table here records that a real-world event happened, and every one
-- requires an artifact that a human had to produce: a named person, a date, a
-- document. That is deliberate. A row you can write without doing the work is
-- not evidence, and these tables are designed so that seeding them is
-- indistinguishable from lying rather than indistinguishable from progress.

-- ============================================================
-- Product: usability testing
-- ============================================================

CREATE TABLE usability_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Not a user id: these are people watched doing a task, often before signup.
  participant_ref TEXT NOT NULL,
  task TEXT NOT NULL,
  completed_task BOOLEAN NOT NULL,
  time_to_first_clip_seconds INT,
  blocking_issues TEXT,
  -- A session with no observation record is a claim, not evidence.
  observation_url TEXT NOT NULL CHECK (length(observation_url) > 0),
  conducted_by TEXT NOT NULL,
  conducted_at DATE NOT NULL,
  CHECK (conducted_at <= CURRENT_DATE)
);

-- ============================================================
-- Growth: referrals
-- ============================================================

CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE referral_conversions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  referred_workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  converted_to_paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One workspace cannot be referred twice.
  UNIQUE (referred_workspace_id)
);
CREATE INDEX idx_referral_conversions_paid ON referral_conversions(converted_to_paid_at)
  WHERE converted_to_paid_at IS NOT NULL;

-- ============================================================
-- Landing page: conversion
-- ============================================================

-- Aggregated per day from analytics_events. Materialised rather than computed
-- so the audit reads one number instead of re-deriving a funnel definition it
-- might get wrong differently each time.
CREATE TABLE landing_page_daily (
  day DATE PRIMARY KEY,
  sessions INT NOT NULL CHECK (sessions >= 0),
  signup_starts INT NOT NULL CHECK (signup_starts >= 0),
  signups_completed INT NOT NULL CHECK (signups_completed >= 0),
  CHECK (signup_starts <= sessions),
  CHECK (signups_completed <= signup_starts)
);

-- ============================================================
-- Engineering: load and chaos runs
-- ============================================================

CREATE TABLE load_test_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tool TEXT NOT NULL,
  scenario TEXT NOT NULL,
  concurrency INT NOT NULL CHECK (concurrency > 0),
  operations INT NOT NULL CHECK (operations > 0),
  duration_seconds NUMERIC(10,3) NOT NULL,
  p95_ms NUMERIC(10,3),
  error_rate NUMERIC(6,5) NOT NULL CHECK (error_rate BETWEEN 0 AND 1),
  -- Load-test traffic is real evidence about a mechanism and no evidence at all
  -- about demand. Recording which it was keeps a synthetic run from ever
  -- standing in for production data in a sector that is about customers.
  provenance TEXT NOT NULL DEFAULT 'load_test'
    CHECK (provenance IN ('load_test', 'production')),
  notes TEXT,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_load_test_runs_ran ON load_test_runs(ran_at DESC);

-- ============================================================
-- Security: external assessment
-- ============================================================

CREATE TABLE security_assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_type TEXT NOT NULL
    CHECK (assessment_type IN ('penetration_test', 'code_audit', 'soc2', 'vuln_scan')),
  -- Us testing ourselves is not an external assessment; the vendor name is the
  -- thing that makes this different from an opinion.
  vendor TEXT NOT NULL CHECK (length(vendor) > 0),
  scope TEXT NOT NULL,
  report_url TEXT NOT NULL CHECK (length(report_url) > 0),
  critical_findings_open INT NOT NULL DEFAULT 0 CHECK (critical_findings_open >= 0),
  high_findings_open INT NOT NULL DEFAULT 0 CHECK (high_findings_open >= 0),
  completed_at DATE NOT NULL,
  CHECK (completed_at <= CURRENT_DATE)
);

-- ============================================================
-- Legal: reviews signed by a named person
-- ============================================================

CREATE TABLE legal_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_type TEXT NOT NULL CHECK (review_type IN
    ('entity_formation', 'ip_assignment', 'terms_and_privacy',
     'platform_tos', 'incident_response')),
  counsel_name TEXT NOT NULL CHECK (length(counsel_name) > 0),
  firm TEXT,
  document_url TEXT NOT NULL CHECK (length(document_url) > 0),
  completed_at DATE NOT NULL,
  expires_at DATE,
  CHECK (completed_at <= CURRENT_DATE),
  UNIQUE (review_type)
);

-- ============================================================
-- Isolation
-- ============================================================

-- referrals and referral_conversions carry workspace data and belong under the
-- same policy as everything else. The rest are company-level records with no
-- workspace dimension, readable only by the audit role.
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_isolation ON referrals
  USING (referrer_workspace_id = current_workspace_id())
  WITH CHECK (referrer_workspace_id = current_workspace_id());

ALTER TABLE referral_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_conversions FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_isolation ON referral_conversions
  USING (EXISTS (SELECT 1 FROM referrals r
                 WHERE r.id = referral_conversions.referral_id
                   AND r.referrer_workspace_id = current_workspace_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM referrals r
                      WHERE r.id = referral_conversions.referral_id
                        AND r.referrer_workspace_id = current_workspace_id()));

-- The application never writes evidence about itself.
REVOKE INSERT, UPDATE, DELETE ON
  usability_sessions, landing_page_daily, load_test_runs,
  security_assessments, legal_reviews, interviews
FROM clipr_app;

-- Same guard as 0002: RLS on with no policy is a deny-all outage.
DO $$
DECLARE missing TEXT;
BEGIN
  SELECT string_agg(c.relname, ', ') INTO missing
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
    AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'RLS enabled with no policy (deny-all) on: %', missing;
  END IF;
END $$;
