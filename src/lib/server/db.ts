import { Pool } from "pg";
import type { ConnectionOptions } from "tls";

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}

function isTruthy(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "yes";
}

function getProductionSslConfig(): ConnectionOptions | undefined {
  if (process.env.NODE_ENV !== "production") return undefined;

  // Escape hatch for incidents; keep this disabled in steady state.
  if (isTruthy(process.env.DATABASE_SSL_ALLOW_INSECURE)) {
    return { rejectUnauthorized: false };
  }

  const ca = process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n").trim();
  if (ca) {
    return { rejectUnauthorized: true, ca };
  }

  return { rejectUnauthorized: true };
}

export function getPool(): Pool {
  if (pool) return pool;
  pool = new Pool({
    connectionString: getDatabaseUrl(),
    ssl: getProductionSslConfig(),
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

      await client.query(`
        CREATE TABLE IF NOT EXISTS interview_answer_feedback (
          id BIGSERIAL PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES interview_users(id) ON DELETE CASCADE,
          month_key TEXT NOT NULL,
          qna_id TEXT NOT NULL,
          question TEXT NOT NULL,
          answer TEXT NOT NULL,
          source TEXT NOT NULL,
          rating TEXT NOT NULL CHECK (rating IN ('up', 'down')),
          reason TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_answer_feedback_user_month
        ON interview_answer_feedback (user_id, month_key);
      `);
    } finally {
      client.release();
    }
  })();

  return schemaReady;
}
