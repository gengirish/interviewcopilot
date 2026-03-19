import { getDefaultPlan, type PlanId } from "@/lib/server/plans";
import { ensureSchema, getPool } from "@/lib/server/db";

export interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  plan: PlanId;
  createdAt: string;
}

export async function getUserByEmail(email: string): Promise<StoredUser | null> {
  await ensureSchema();
  const normalized = email.trim().toLowerCase();
  const { rows } = await getPool().query<{
    id: string;
    email: string;
    password_hash: string;
    plan: PlanId;
    created_at: Date;
  }>(
    `SELECT id, email, password_hash, plan, created_at
     FROM interview_users
     WHERE email = $1
     LIMIT 1`,
    [normalized]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    plan: row.plan,
    createdAt: row.created_at.toISOString(),
  };
}

export async function createUser(
  email: string,
  passwordHash: string
): Promise<StoredUser> {
  await ensureSchema();
  const normalized = email.trim().toLowerCase();
  const id = crypto.randomUUID();
  const { rows } = await getPool().query<{
    id: string;
    email: string;
    password_hash: string;
    plan: PlanId;
    created_at: Date;
  }>(
    `INSERT INTO interview_users (id, email, password_hash, plan)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO NOTHING
     RETURNING id, email, password_hash, plan, created_at`,
    [id, normalized, passwordHash, getDefaultPlan()]
  );
  const row = rows[0];
  if (!row) throw new Error("User already exists");
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    plan: row.plan,
    createdAt: row.created_at.toISOString(),
  };
}

export async function getUserById(id: string): Promise<StoredUser | null> {
  await ensureSchema();
  const { rows } = await getPool().query<{
    id: string;
    email: string;
    password_hash: string;
    plan: PlanId;
    created_at: Date;
  }>(
    `SELECT id, email, password_hash, plan, created_at
     FROM interview_users
     WHERE id = $1
     LIMIT 1`,
    [id]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    plan: row.plan,
    createdAt: row.created_at.toISOString(),
  };
}

export async function getPlan(userId: string): Promise<PlanId> {
  const user = await getUserById(userId);
  return user?.plan ?? getDefaultPlan();
}

export async function setPlan(userId: string, plan: PlanId): Promise<void> {
  await ensureSchema();
  await getPool().query(
    `UPDATE interview_users
     SET plan = $2
     WHERE id = $1`,
    [userId, plan]
  );
}
