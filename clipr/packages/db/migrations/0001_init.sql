-- ClipR core schema.
--
-- Runs clean on Postgres 16 with only contrib extensions. Two things the
-- original draft got wrong and this file fixes:
--   * citext was used without CREATE EXTENSION citext  -> migration aborted
--   * vector(1536) was used without pgvector           -> migration aborted
-- Embeddings live in 0003_embeddings.sql, which is optional and only applies
-- when pgvector is actually installed.
--
-- Row-level security is in 0002_rls.sql. It is a separate file because it also
-- creates the application role, and RLS is worthless if the app connects as the
-- table owner (owners bypass RLS unless FORCE is set). See that file.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Every table with updated_at gets this trigger. The original schema declared
-- updated_at "for audit" but nothing ever wrote to it, so every row reported
-- its creation time forever.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- Identity and workspaces
-- ============================================================

CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'trial',
  plan_status TEXT NOT NULL DEFAULT 'active',
  trial_ends_at TIMESTAMPTZ,
  -- Hard stop for the budget guard (packages/observability/budget.py).
  -- NULL means "use the plan default".
  monthly_cost_ceiling_usd NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_workspaces_updated BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email CITEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified_at TIMESTAMPTZ,
  two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
  two_factor_secret_encrypted BYTEA,
  last_login_at TIMESTAMPTZ,
  failed_login_count INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','admin','editor','viewer')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  UNIQUE (user_id, workspace_id)
);
CREATE INDEX idx_memberships_user ON memberships(user_id);
CREATE INDEX idx_memberships_workspace ON memberships(workspace_id);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  user_agent TEXT,
  ip_hash TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  -- Refresh rotation: when a token is used, the successor is recorded here.
  -- Presenting a rotated token means the token was stolen -> revoke the family.
  rotated_to UUID REFERENCES sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE password_resets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- Live sources, sessions, jobs
-- ============================================================

CREATE TABLE stream_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('twitch','youtube','kick')),
  external_user_id TEXT NOT NULL,
  external_username TEXT,
  access_token_encrypted BYTEA NOT NULL,
  refresh_token_encrypted BYTEA,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[],
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, platform, external_user_id)
);
CREATE INDEX idx_stream_connections_workspace ON stream_connections(workspace_id);

-- A live session is the billable unit for monitored hours. It exists from
-- go-live to stream end, independent of whether any clip came out of it.
CREATE TABLE stream_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stream_connection_id UUID NOT NULL REFERENCES stream_connections(id) ON DELETE CASCADE,
  external_stream_id TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  monitored_seconds INT NOT NULL DEFAULT 0,
  -- Set when the budget guard or an entitlement ceiling detaches the watcher.
  detached_reason TEXT,
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE INDEX idx_stream_sessions_workspace ON stream_sessions(workspace_id, started_at DESC);
-- One live session per connection at a time.
CREATE UNIQUE INDEX idx_stream_sessions_live
  ON stream_sessions(stream_connection_id) WHERE ended_at IS NULL;

CREATE TABLE vods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stream_connection_id UUID REFERENCES stream_connections(id) ON DELETE SET NULL,
  stream_session_id UUID REFERENCES stream_sessions(id) ON DELETE SET NULL,
  external_id TEXT,
  title TEXT,
  duration_seconds INT,
  source_url TEXT,
  storage_key TEXT,
  storage_size_bytes BIGINT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','downloading','ready','processing','failed','deleted')),
  ingested_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_vods_workspace ON vods(workspace_id);
CREATE INDEX idx_vods_status ON vods(status) WHERE status <> 'deleted';

CREATE TABLE processing_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  vod_id UUID NOT NULL REFERENCES vods(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','succeeded','failed','cancelled','dead_letter')),
  current_stage TEXT,
  stage_checkpoints JSONB NOT NULL DEFAULT '{}',
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 3,
  worker_id TEXT,
  -- Lease-based claim. A worker that dies mid-job lets the lease lapse and the
  -- next claim reclaims it; without this, `status='running'` is a permanent leak.
  lease_expires_at TIMESTAMPTZ,
  -- Retry backoff. A queued job is invisible to claims until this passes.
  next_attempt_at TIMESTAMPTZ,
  error TEXT,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  pipeline_version TEXT NOT NULL DEFAULT 'clipr-ai-v1',
  UNIQUE (vod_id, pipeline_version)
);
CREATE INDEX idx_jobs_workspace ON processing_jobs(workspace_id);
CREATE INDEX idx_jobs_claimable ON processing_jobs(status, queued_at)
  WHERE status IN ('queued','running');

CREATE TABLE dead_letter_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  vod_id UUID NOT NULL,
  last_error TEXT,
  payload JSONB,
  moved_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dlq_workspace ON dead_letter_jobs(workspace_id, moved_at DESC);


-- ============================================================
-- Clips
-- ============================================================

CREATE TABLE clips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  vod_id UUID NOT NULL REFERENCES vods(id) ON DELETE CASCADE,
  job_id UUID REFERENCES processing_jobs(id) ON DELETE SET NULL,
  start_seconds INT NOT NULL,
  end_seconds INT NOT NULL,
  duration_seconds INT NOT NULL,
  ai_score NUMERIC(5,2),
  ai_reasons JSONB,
  ai_model TEXT,
  ai_model_version TEXT,
  ai_prompt_version TEXT,
  ai_pipeline_version TEXT,
  storage_key TEXT,
  thumbnail_key TEXT,
  caption_storage_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review','approved','rejected','published','archived')),
  -- Set the first time the rendered file leaves our system by any route
  -- (download, API read, share link). Rejecting after this does NOT refund the
  -- clip allowance -- see packages/billing/entitlements.py.
  first_egress_at TIMESTAMPTZ,
  review_started_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  review_duration_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_seconds > start_seconds)
);
CREATE TRIGGER trg_clips_updated BEFORE UPDATE ON clips
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_clips_workspace ON clips(workspace_id, created_at DESC);
CREATE INDEX idx_clips_vod ON clips(vod_id);
CREATE INDEX idx_clips_review_queue ON clips(workspace_id, ai_score DESC)
  WHERE status = 'pending_review';

CREATE TABLE clip_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clip_id UUID NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  start_seconds INT,
  end_seconds INT,
  crop_data JSONB,
  caption_data JSONB,
  title TEXT,
  social_caption TEXT,
  hashtags TEXT[],
  changed_by_user_id UUID REFERENCES users(id),
  change_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clip_id, version_number)
);

CREATE TABLE review_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  clip_id UUID NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  decision TEXT NOT NULL CHECK (decision IN ('approved','rejected','edited','regenerated')),
  duration_ms INT NOT NULL,
  edit_changes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_review_clip ON review_decisions(clip_id);
CREATE INDEX idx_review_workspace ON review_decisions(workspace_id, created_at DESC);


-- ============================================================
-- Publishing
-- ============================================================

CREATE TABLE social_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok','instagram','youtube','x')),
  external_account_id TEXT NOT NULL,
  external_username TEXT,
  access_token_encrypted BYTEA NOT NULL,
  refresh_token_encrypted BYTEA,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[],
  connection_status TEXT NOT NULL DEFAULT 'active'
    CHECK (connection_status IN ('active','expired','revoked','degraded')),
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, platform, external_account_id)
);
CREATE INDEX idx_social_accounts_workspace ON social_accounts(workspace_id);

CREATE TABLE publish_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  clip_id UUID NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  social_account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','uploading','processing','published','failed','scheduled','cancelled',
    -- The degrade path: platform API unavailable or unapproved, so the post is
    -- staged and the creator gets a push notification to finish it by hand.
    'manual_handoff'
  )),
  external_post_id TEXT,
  external_post_url TEXT,
  handoff_deeplink TEXT,
  scheduled_for TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  error_code TEXT,
  error_message TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clip_id, social_account_id)
);
CREATE TRIGGER trg_publish_updated BEFORE UPDATE ON publish_jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_publish_workspace ON publish_jobs(workspace_id);
CREATE INDEX idx_publish_due ON publish_jobs(next_attempt_at)
  WHERE status IN ('pending','scheduled','uploading');

-- Retention pulled back from each platform, 48h+ after publish. This is the
-- only accumulating asset in the product, so it gets its own table rather than
-- living in a JSONB blob.
CREATE TABLE publish_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  publish_job_id UUID NOT NULL REFERENCES publish_jobs(id) ON DELETE CASCADE,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  hours_since_publish INT NOT NULL,
  views BIGINT,
  likes BIGINT,
  comments BIGINT,
  shares BIGINT,
  avg_watch_seconds NUMERIC(8,3),
  completion_rate NUMERIC(5,4),
  UNIQUE (publish_job_id, hours_since_publish)
);
CREATE INDEX idx_publish_metrics_workspace ON publish_metrics(workspace_id, collected_at DESC);


-- ============================================================
-- Plans, billing, entitlements
-- ============================================================

-- Plan codes match the public pricing page exactly. The original draft used
-- starter/creator/pro/agency, which matched neither the page nor the Stripe
-- env vars; that mismatch is the classic source of "customer paid for X and
-- got Y" bugs, so there is now exactly one vocabulary.
CREATE TABLE plan_limits (
  plan TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  live_sources INT NOT NULL,
  monitored_hours_per_month INT NOT NULL,        -- -1 = unmetered
  published_clips_per_month INT NOT NULL,
  connected_accounts INT NOT NULL,               -- -1 = unlimited
  team_seats INT NOT NULL,                       -- -1 = unlimited
  storage_gb INT NOT NULL,
  price_monthly_cents INT NOT NULL,
  price_annual_cents INT NOT NULL,
  clip_overage_cents INT NOT NULL,
  -- Overage stops here; past it the customer is upgraded, not surprise-billed.
  overage_cap_cents INT NOT NULL,
  -- Rejections beyond (published_clips * this) stop being free. Without it,
  -- "rejected clips are free" is an unlimited free tier for anyone willing to
  -- reject everything and pull the render over the API.
  free_reject_multiplier NUMERIC(4,2) NOT NULL DEFAULT 3.0,
  sort_order INT NOT NULL
);

-- Must stay identical to PLANS in packages/billing/plans.py.
-- tests/test_plan_parity.py fails the build if these two drift apart.
INSERT INTO plan_limits VALUES
  ('trial',        'Trial',         1,  10,   20, -1,  1,  10,     0,      0,  0,     0, 3.0, 0),
  ('rail',         'Rail',          1,  60,   80, -1,  1,  40,  2900,  29000, 35,  7900, 3.0, 1),
  ('control_room', 'Control Room',  3, 200,  400, -1,  4, 200,  7900,  79000, 35, 24900, 3.0, 2),
  ('network',      'Network',      12, 600, 1500, -1, -1, 600, 24900, 249000, 30, 99900, 3.0, 3);

ALTER TABLE workspaces
  ADD CONSTRAINT workspaces_plan_fk FOREIGN KEY (plan) REFERENCES plan_limits(plan);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  plan TEXT NOT NULL REFERENCES plan_limits(plan),
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('monthly','annual')),
  status TEXT NOT NULL CHECK (status IN ('trialing','active','past_due','cancelled','incomplete')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_subscriptions_updated BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Stripe webhook dedupe. Stripe retries, and retries without this table mean
-- double-granted entitlements.
CREATE TABLE stripe_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB
);

CREATE TABLE usage_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  monitored_seconds BIGINT NOT NULL DEFAULT 0,
  storage_bytes BIGINT NOT NULL DEFAULT 0,
  clips_generated INT NOT NULL DEFAULT 0,
  clips_published INT NOT NULL DEFAULT 0,
  clips_rejected INT NOT NULL DEFAULT 0,
  clips_rejected_after_egress INT NOT NULL DEFAULT 0,
  overage_cents INT NOT NULL DEFAULT 0,
  UNIQUE (workspace_id, period_start)
);
CREATE INDEX idx_usage_workspace ON usage_records(workspace_id, period_start DESC);


-- ============================================================
-- Cost ledger
-- ============================================================

CREATE TABLE processing_costs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  -- Attributing cost to the stream session, not just the job, is what makes
  -- "$ per monitored hour" a single-table query instead of a fan-out join.
  stream_session_id UUID REFERENCES stream_sessions(id) ON DELETE SET NULL,
  job_id UUID REFERENCES processing_jobs(id) ON DELETE SET NULL,
  clip_id UUID REFERENCES clips(id) ON DELETE SET NULL,
  cost_category TEXT NOT NULL CHECK (cost_category IN
    ('storage','bandwidth','transcription','llm_inference','vision','rendering','compute','api','other')),
  amount_usd NUMERIC(12,6) NOT NULL CHECK (amount_usd >= 0),
  units NUMERIC(20,6),
  unit_name TEXT,
  detail JSONB,
  incurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_costs_workspace ON processing_costs(workspace_id, incurred_at DESC);
CREATE INDEX idx_costs_session ON processing_costs(stream_session_id);
CREATE INDEX idx_costs_category ON processing_costs(cost_category, incurred_at DESC);


-- ============================================================
-- Analytics, evaluation, safety, flags
-- ============================================================

CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  anonymous_id TEXT,
  event_name TEXT NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}',
  session_id TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  referrer TEXT,
  landing_page TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_name ON analytics_events(event_name, occurred_at DESC);
CREATE INDEX idx_events_workspace ON analytics_events(workspace_id, occurred_at DESC);
CREATE INDEX idx_events_anon ON analytics_events(anonymous_id, occurred_at DESC);

CREATE TABLE ai_evaluations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_version TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  pipeline_version TEXT NOT NULL,
  dataset_name TEXT NOT NULL,
  dataset_sha256 TEXT NOT NULL,
  sample_count INT NOT NULL,
  labeled_moment_count INT NOT NULL,
  precision_score NUMERIC(5,4),
  recall_score NUMERIC(5,4),
  f1_score NUMERIC(5,4),
  false_negative_rate NUMERIC(5,4),
  boundary_error_seconds NUMERIC(6,3),
  -- NULL means not measured on this run, which is different from zero. The
  -- original schema stored 0.0 for unmeasured caption WER and crop accuracy,
  -- which reads on a dashboard as a perfect score.
  caption_wer NUMERIC(5,4),
  crop_accuracy NUMERIC(5,4),
  duplicate_rate NUMERIC(5,4),
  publishable_rate NUMERIC(5,4),
  -- A run over a fixture dataset. Recorded so the audit engine can refuse to
  -- verify AI quality from it; a smoke test must never read as a result.
  synthetic BOOLEAN NOT NULL DEFAULT false,
  is_baseline BOOLEAN NOT NULL DEFAULT false,
  regressed BOOLEAN NOT NULL DEFAULT false,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_evals_pipeline ON ai_evaluations(pipeline_version, ran_at DESC);
-- Exactly one production baseline per dataset to compare against.
CREATE UNIQUE INDEX idx_evals_baseline ON ai_evaluations(dataset_name) WHERE is_baseline;

CREATE TABLE creator_preference_profiles (
  workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  approved_count INT NOT NULL DEFAULT 0,
  rejected_count INT NOT NULL DEFAULT 0,
  edited_count INT NOT NULL DEFAULT 0,
  preferred_duration_seconds INT,
  preferred_caption_style TEXT,
  preferred_content_types TEXT[],
  weights JSONB,
  profile_ready BOOLEAN NOT NULL DEFAULT false,
  last_trained_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON creator_preference_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE safety_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  clip_id UUID NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  flag_type TEXT NOT NULL CHECK (flag_type IN
    ('profanity','pii','copyright_music','third_party_video','sponsor','unsafe','duplicate','prompt_injection')),
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','block')),
  matched_text TEXT,
  detail JSONB,
  acknowledged_by_user_id UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_safety_clip ON safety_flags(clip_id);

CREATE TABLE feature_flags (
  name TEXT PRIMARY KEY,
  description TEXT,
  enabled_globally BOOLEAN NOT NULL DEFAULT false,
  rollout_percent INT NOT NULL DEFAULT 0 CHECK (rollout_percent BETWEEN 0 AND 100),
  allowed_workspaces UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_flags_updated BEFORE UPDATE ON feature_flags
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO feature_flags (name, description) VALUES
  ('AUTOPILOT',             'Publish without review'),
  ('SMART_CROP_V2',         'Subject-aware reframing engine'),
  ('TIKTOK_PUBLISH',        'TikTok publishing adapter'),
  ('INSTAGRAM_PUBLISH',     'Instagram publishing adapter'),
  ('YOUTUBE_PUBLISH',       'YouTube publishing adapter'),
  ('CHANNEL_INTELLIGENCE',  'Per-creator learning loop'),
  ('AI_V2',                 'clipr-ai-v2 detection pipeline');

-- Referenced by the audit runner. It queried this table without it existing,
-- which crashed the whole audit instead of reporting "no interviews yet".
CREATE TABLE interviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_handle TEXT NOT NULL,
  platform TEXT,
  avg_stream_hours_per_week NUMERIC(6,2),
  currently_pays_for_clipping BOOLEAN,
  notes TEXT,
  conducted_at DATE NOT NULL,
  conducted_by TEXT
);

CREATE TABLE audit_items (
  id TEXT PRIMARY KEY,
  sector TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  owner_role TEXT,
  -- No stored score column. Scores are computed from evidence at read time by
  -- packages/audit/runner.py; a writable score column is an invitation to
  -- hand-set a 10.
  requires_users BOOLEAN NOT NULL DEFAULT false,
  requires_external_party BOOLEAN NOT NULL DEFAULT false,
  required_evidence TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_sector ON audit_items(sector);
