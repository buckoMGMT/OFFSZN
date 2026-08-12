-- Workspace isolation, enforced by the database.
--
-- The original draft enabled RLS on eight tables but wrote policies for two of
-- them, and connected as the table owner. Both halves of that are broken:
--
--   1. Owners bypass RLS entirely unless FORCE ROW LEVEL SECURITY is set. The
--      app connected as `clipr`, which owns every table, so RLS was inert and
--      the "cross-workspace access is blocked at the database" claim was false.
--   2. RLS enabled with no policy denies everything. The six tables that got
--      no policy would have returned zero rows to the app -- a fail-closed
--      outage rather than a leak, but an outage that only shows up under RLS.
--
-- Both are fixed here: a non-owner application role, FORCE on every protected
-- table, and a policy on every protected table. tests/test_rls.py proves it
-- against a real Postgres instance.

-- ------------------------------------------------------------
-- Application role
-- ------------------------------------------------------------
-- Owns nothing. Migrations run as the owner; the app runs as this role.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'clipr_app') THEN
    CREATE ROLE clipr_app NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO clipr_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO clipr_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO clipr_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO clipr_app;

-- Reference data the app reads but must never write.
REVOKE INSERT, UPDATE, DELETE ON plan_limits, audit_items FROM clipr_app;


-- ------------------------------------------------------------
-- Current workspace
-- ------------------------------------------------------------
-- current_setting(x) raises 42704 when x was never set, which turns "no auth
-- context" into a 500 instead of an empty result. The `true` argument makes it
-- return NULL instead, and the policies below treat NULL as "match nothing".
CREATE OR REPLACE FUNCTION current_workspace_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_workspace_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;


-- ------------------------------------------------------------
-- Policies
-- ------------------------------------------------------------
-- Applied uniformly so a table added later without a policy is a visible
-- omission rather than a silent one. USING covers reads and the pre-image of
-- writes; WITH CHECK stops a caller inserting or moving a row into someone
-- else's workspace, which a USING-only policy allows.
DO $$
DECLARE
  t TEXT;
  protected TEXT[] := ARRAY[
    'workspaces','memberships','stream_connections','stream_sessions','vods',
    'processing_jobs','dead_letter_jobs','clips','review_decisions',
    'social_accounts','publish_jobs','publish_metrics','subscriptions','usage_records',
    'processing_costs','analytics_events','creator_preference_profiles','safety_flags'
  ];
  col TEXT;
BEGIN
  FOREACH t IN ARRAY protected LOOP
    -- workspaces keys on id; everything else on workspace_id.
    col := CASE WHEN t = 'workspaces' THEN 'id' ELSE 'workspace_id' END;

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS workspace_isolation ON %I', t);
    EXECUTE format($f$
      CREATE POLICY workspace_isolation ON %I
        USING (%I = current_workspace_id())
        WITH CHECK (%I = current_workspace_id())
    $f$, t, col, col);
  END LOOP;
END $$;

-- clip_versions has no workspace_id of its own; isolate it through its clip.
ALTER TABLE clip_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE clip_versions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_isolation ON clip_versions;
CREATE POLICY workspace_isolation ON clip_versions
  USING (EXISTS (SELECT 1 FROM clips c
                 WHERE c.id = clip_versions.clip_id
                   AND c.workspace_id = current_workspace_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM clips c
                      WHERE c.id = clip_versions.clip_id
                        AND c.workspace_id = current_workspace_id()));

-- analytics_events accepts pre-signup anonymous rows, which have no workspace.
-- Those are insert-only: nobody can read a row that has no workspace.
DROP POLICY IF EXISTS workspace_isolation ON analytics_events;
CREATE POLICY workspace_isolation ON analytics_events
  USING (workspace_id = current_workspace_id())
  WITH CHECK (workspace_id = current_workspace_id() OR workspace_id IS NULL);


-- ------------------------------------------------------------
-- Guard: every protected table must still have a policy
-- ------------------------------------------------------------
DO $$
DECLARE missing TEXT;
BEGIN
  SELECT string_agg(c.relname, ', ') INTO missing
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relrowsecurity
    AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid);

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'RLS enabled with no policy (deny-all) on: %', missing;
  END IF;
END $$;
