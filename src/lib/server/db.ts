import { Pool } from "pg";

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}

export function getPool(): Pool {
  if (pool) return pool;
  pool = new Pool({
    connectionString: getDatabaseUrl(),
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  });
  return pool;
}

export async function ensureSchema(): Promise<void> {
  if (schemaReady) return schemaReady;

  schemaReady = (async () => {
    const client = await getPool().connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS interview_users (
          id UUID PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          plan TEXT NOT NULL DEFAULT 'free',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS interview_usage_monthly (
          user_id UUID NOT NULL REFERENCES interview_users(id) ON DELETE CASCADE,
          month_key TEXT NOT NULL,
          count INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (user_id, month_key)
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS interview_events (
          id BIGSERIAL PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES interview_users(id) ON DELETE CASCADE,
          event_type TEXT NOT NULL,
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_interview_events_user_created
        ON interview_events (user_id, created_at DESC);
      `);
    } finally {
      client.release();
    }
  })();

  return schemaReady;
}
