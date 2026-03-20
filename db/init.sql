-- InfinityHire Copilot baseline schema
-- Mirrors current app-managed tables so this folder can become source-of-truth.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS interview_users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interview_usage_monthly (
  user_id UUID NOT NULL REFERENCES interview_users(id) ON DELETE CASCADE,
  month_key TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, month_key)
);

CREATE TABLE IF NOT EXISTS interview_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES interview_users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interview_events_user_created
ON interview_events (user_id, created_at DESC);
