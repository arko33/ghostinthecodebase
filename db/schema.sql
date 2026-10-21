-- GhostInTheCodebase — Ghost Cloud schema (Neon PostgreSQL)
-- Runs with: psql $DATABASE_URL -f db/schema.sql   (idempotent-safe to re-run pieces)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id    text UNIQUE NOT NULL,
  login        text NOT NULL,
  name         text,
  email        text,
  avatar_url   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS devices (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        text NOT NULL DEFAULT 'device',
  token_hash  text UNIQUE NOT NULL,          -- sha256 of the raw token; raw never stored
  revoked     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);

CREATE TABLE IF NOT EXISTS pairing_codes (
  code        text PRIMARY KEY,
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  raw_token   text,                          -- populated on bind; returned once by CLI poll
  bound_at    timestamptz,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
DELETE FROM pairing_codes WHERE expires_at < now();   -- lazy sweep on install

CREATE TABLE IF NOT EXISTS projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  repo        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  external_ref text,                         -- local recorder session id
  status      text NOT NULL DEFAULT 'recorded',
  head        text,
  started_at  timestamptz,
  ended_at    timestamptz,
  sync        text NOT NULL DEFAULT 'off',
  payload     jsonb NOT NULL,                -- policy-gated snapshot (scrubbed)
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS turns (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  turn_index  int,
  external_id text,
  estimated   boolean NOT NULL DEFAULT false,
  agent       text,
  prompt      text,                          -- present only when sync=FULL (consented)
  started_at  timestamptz,
  ended_at    timestamptz,
  files       jsonb
);
CREATE INDEX IF NOT EXISTS idx_turns_session ON turns(session_id, turn_index);

CREATE TABLE IF NOT EXISTS checkpoints (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  turn_index  int,
  sha         text,
  files       jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS metric_samples (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  turn_index    int,
  captured_at   timestamptz,
  probe_failed  boolean NOT NULL DEFAULT false,
  metrics       jsonb
);
CREATE INDEX IF NOT EXISTS idx_samples_session ON metric_samples(session_id, captured_at);

CREATE TABLE IF NOT EXISTS anomalies (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  type           text,
  severity       text,
  evidence       jsonb
);
