/**
 * Monthly usage counters per user.
 * Persists to PostgreSQL.
 */

import { ensureSchema, getPool } from "@/lib/server/db";

function getMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getResetAt(): Date {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  return next;
}

/**
 * Get usage count for a user in the current month.
 */
export async function getUsage(userId: string): Promise<number> {
  await ensureSchema();
  const month = getMonthKey();
  const { rows } = await getPool().query<{ count: number }>(
    `SELECT count
     FROM interview_usage_monthly
     WHERE user_id = $1 AND month_key = $2
     LIMIT 1`,
    [userId, month]
  );
  return rows[0]?.count ?? 0;
}

/**
 * Increment usage for a user in the current month.
 */
export async function incrementUsage(userId: string): Promise<number> {
  await ensureSchema();
  const month = getMonthKey();
  const { rows } = await getPool().query<{ count: number }>(
    `INSERT INTO interview_usage_monthly (user_id, month_key, count)
     VALUES ($1, $2, 1)
     ON CONFLICT (user_id, month_key)
     DO UPDATE SET count = interview_usage_monthly.count + 1
     RETURNING count`,
    [userId, month]
  );
  return rows[0]?.count ?? 0;
}

/**
 * Check if the user can use an answer (within quota).
 */
export async function canUseAnswer(
  userId: string,
  limit: number
): Promise<boolean> {
  if (limit === Number.POSITIVE_INFINITY) return true;
  const used = await getUsage(userId);
  return used < limit;
}

export { getMonthKey, getResetAt };
