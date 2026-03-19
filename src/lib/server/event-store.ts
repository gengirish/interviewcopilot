import { ensureSchema, getPool } from "@/lib/server/db";

export type EventType =
  | "signup_completed"
  | "login_completed"
  | "session_started"
  | "first_question_asked"
  | "upgraded_to_pro";

export interface ActivationSummary {
  score: number;
  completed: string[];
  pending: string[];
}

const ACTIVATION_STEPS: EventType[] = [
  "signup_completed",
  "session_started",
  "first_question_asked",
  "upgraded_to_pro",
];

export async function trackEvent(
  userId: string,
  eventType: EventType,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  await ensureSchema();
  await getPool().query(
    `INSERT INTO interview_events (user_id, event_type, metadata)
     VALUES ($1, $2, $3::jsonb)`,
    [userId, eventType, JSON.stringify(metadata)]
  );
}

export async function getActivationSummary(userId: string): Promise<ActivationSummary> {
  await ensureSchema();
  const { rows } = await getPool().query<{ event_type: string }>(
    `SELECT DISTINCT event_type
     FROM interview_events
     WHERE user_id = $1`,
    [userId]
  );

  const seen = new Set(rows.map((r) => r.event_type as EventType));
  const completed = ACTIVATION_STEPS.filter((step) => seen.has(step));
  const pending = ACTIVATION_STEPS.filter((step) => !seen.has(step));
  const score = Math.round((completed.length / ACTIVATION_STEPS.length) * 100);

  return { score, completed, pending };
}
