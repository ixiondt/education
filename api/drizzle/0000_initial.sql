-- Letters & Numbers backend — initial schema (v0.1)
-- Hand-written rather than drizzle-kit generated so we can:
--   - keep advisory locks for safe concurrent runs
--   - add postgres extensions (pgcrypto for gen_random_uuid)
--   - use IF NOT EXISTS everywhere for idempotent re-runs

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ────────────────────────────  parents  ────────────────────────────
CREATE TABLE IF NOT EXISTS parents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_login  timestamptz
);

-- ────────────────────────────  children  ───────────────────────────
CREATE TABLE IF NOT EXISTS children (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   uuid NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  name        text NOT NULL,
  age_months  integer NOT NULL CHECK (age_months BETWEEN 12 AND 144),
  created_at  timestamptz NOT NULL DEFAULT now(),
  settings    jsonb NOT NULL DEFAULT '{}'::jsonb,
  interests   jsonb NOT NULL DEFAULT '{}'::jsonb,
  streaks     jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS children_parent_idx ON children(parent_id);

-- ────────────────────────────  devices  ────────────────────────────
CREATE TABLE IF NOT EXISTS devices (
  id            text PRIMARY KEY,                                    -- client-generated UUID
  child_id      uuid REFERENCES children(id) ON DELETE CASCADE,
  parent_id     uuid REFERENCES parents(id)  ON DELETE CASCADE,
  claimed_at    timestamptz,
  last_sync_at  timestamptz,
  user_agent    text
);
CREATE INDEX IF NOT EXISTS devices_child_idx  ON devices(child_id);
CREATE INDEX IF NOT EXISTS devices_parent_idx ON devices(parent_id);

-- ────────────────────────  skill_progress  ─────────────────────────
CREATE TABLE IF NOT EXISTS skill_progress (
  child_id      uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  skill_id      text NOT NULL,
  successes     integer NOT NULL DEFAULT 0,
  attempts      integer NOT NULL DEFAULT 0,
  last_seen_at  timestamptz,
  mastered_at   timestamptz,
  PRIMARY KEY (child_id, skill_id)
);
CREATE INDEX IF NOT EXISTS skill_progress_mastered_idx
  ON skill_progress(child_id, mastered_at);

-- ─────────────────────────  play_events  ───────────────────────────
CREATE TABLE IF NOT EXISTS play_events (
  id                bigserial PRIMARY KEY,
  child_id          uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  skill_id          text NOT NULL,
  success           boolean NOT NULL,
  duration_ms       integer,
  mode              text,
  client_ts         timestamptz NOT NULL,
  server_ts         timestamptz NOT NULL DEFAULT now(),
  device_id         text REFERENCES devices(id) ON DELETE SET NULL,
  client_event_id   text NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS play_events_child_ts_idx
  ON play_events(child_id, client_ts);
CREATE INDEX IF NOT EXISTS play_events_server_ts_idx
  ON play_events(server_ts);

-- ───────────────────────  session_summaries  ───────────────────────
CREATE TABLE IF NOT EXISTS session_summaries (
  child_id          uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  day               date NOT NULL,
  attempts          integer NOT NULL DEFAULT 0,
  successes         integer NOT NULL DEFAULT 0,
  duration_minutes  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (child_id, day)
);

-- ─────────────────────────  magic_links  ───────────────────────────
CREATE TABLE IF NOT EXISTS magic_links (
  token        text PRIMARY KEY,
  email        text NOT NULL,
  parent_id    uuid REFERENCES parents(id) ON DELETE CASCADE,
  expires_at   timestamptz NOT NULL,
  used_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS magic_links_email_idx ON magic_links(email);

COMMIT;
