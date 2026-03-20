import { ensureSchema, getPool } from "@/lib/server/db";
import { getMonthKey } from "@/lib/server/usage-store";

const MAX_ANSWER_LEN = 50_000;
const MAX_REASON_LEN = 2_000;

export interface InsertAnswerFeedbackInput {
  userId: string;
  qnaId: string;
  question: string;
  answer: string;
  source: string;
  rating: "up" | "down";
  reason?: string | null;
}

export interface AnswerFeedbackMonthlySummary {
  monthKey: string;
  up: number;
  down: number;
  total: number;
  /** 0–100 when total > 0; null when no votes */
  score: number | null;
}

export async function insertAnswerFeedback(input: InsertAnswerFeedbackInput): Promise<void> {
  const answer =
    input.answer.length > MAX_ANSWER_LEN
      ? input.answer.slice(0, MAX_ANSWER_LEN)
      : input.answer;
  const reason =
    input.reason && input.reason.length > MAX_REASON_LEN
      ? input.reason.slice(0, MAX_REASON_LEN)
      : input.reason ?? null;

  await ensureSchema();
  await getPool().query(
    `INSERT INTO interview_answer_feedback
      (user_id, month_key, qna_id, question, answer, source, rating, reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      input.userId,
      getMonthKey(),
      input.qnaId,
      input.question,
      answer,
      input.source,
      input.rating,
      reason,
    ]
  );
}

export async function getAnswerFeedbackMonthlySummary(
  userId: string,
  monthKey?: string
): Promise<AnswerFeedbackMonthlySummary> {
  const key = monthKey ?? getMonthKey();
  await ensureSchema();
  const { rows } = await getPool().query<{ up: string; down: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE rating = 'up')::text AS up,
       COUNT(*) FILTER (WHERE rating = 'down')::text AS down
     FROM interview_answer_feedback
     WHERE user_id = $1 AND month_key = $2`,
    [userId, key]
  );
  const up = Number(rows[0]?.up ?? 0);
  const down = Number(rows[0]?.down ?? 0);
  const total = up + down;
  const score = total === 0 ? null : Math.round((up / total) * 100);
  return { monthKey: key, up, down, total, score };
}
