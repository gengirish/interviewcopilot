import type { FunnelAggregateSummary } from "@/lib/types";
import { ensureSchema, getPool } from "@/lib/server/db";

export type EventType =
  | "signup_completed"
  | "login_completed"
  | "session_started"
  | "first_question_asked"
  | "upgraded_to_pro"
  | "onboarding_started"
  | "onboarding_step_completed"
  | "onboarding_dismissed"
  | "sample_question_used"
  | "debrief_generated"
  | "share_report_generated"
  | "team_panel_summary_generated"
  | "best_answer_rewritten"
  | "question_bank_generated"
  | "prep_plan_generated";

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

/** Cohort: users with signup_completed in the window; step counts = how many of them ever fired each event. */
export async function getFunnelAggregate(days: number): Promise<FunnelAggregateSummary> {
  if (!Number.isFinite(days) || days < 1 || days > 366) {
    throw new RangeError("days must be between 1 and 366");
  }
  await ensureSchema();
  const { rows } = await getPool().query<{
    signups: number;
    session_started: number;
    first_question_asked: number;
    upgraded_to_pro: number;
  }>(
    `WITH bounds AS (
       SELECT NOW() - ($1::int * INTERVAL '1 day') AS start_ts
     ),
     signup_cohort AS (
       SELECT DISTINCT user_id
       FROM interview_events, bounds
       WHERE event_type = 'signup_completed'
         AND created_at >= bounds.start_ts
     )
     SELECT
       (SELECT COUNT(*)::int FROM signup_cohort) AS signups,
       (SELECT COUNT(DISTINCT e.user_id)::int
        FROM interview_events e
        INNER JOIN signup_cohort s ON s.user_id = e.user_id
        WHERE e.event_type = 'session_started') AS session_started,
       (SELECT COUNT(DISTINCT e.user_id)::int
        FROM interview_events e
        INNER JOIN signup_cohort s ON s.user_id = e.user_id
        WHERE e.event_type = 'first_question_asked') AS first_question_asked,
       (SELECT COUNT(DISTINCT e.user_id)::int
        FROM interview_events e
        INNER JOIN signup_cohort s ON s.user_id = e.user_id
        WHERE e.event_type = 'upgraded_to_pro') AS upgraded_to_pro`,
    [days]
  );

  const row = rows[0] ?? {
    signups: 0,
    session_started: 0,
    first_question_asked: 0,
    upgraded_to_pro: 0,
  };
  const signups = row.signups;
  const denom = signups > 0 ? signups : 0;
  const activation_rate = denom ? row.first_question_asked / denom : 0;
  const upgrade_rate = denom ? row.upgraded_to_pro / denom : 0;

  return {
    signups,
    session_started: row.session_started,
    first_question_asked: row.first_question_asked,
    upgraded_to_pro: row.upgraded_to_pro,
    activation_rate: Math.round(activation_rate * 10_000) / 10_000,
    upgrade_rate: Math.round(upgrade_rate * 10_000) / 10_000,
  };
}
